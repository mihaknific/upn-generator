/**
 * Export Module — QR PNG, QR PDF, UPN A4 PDF, UPN Exact PDF
 * Uses pdf-lib for UPN rendering (true vector PDF with custom TTF fonts)
 */
import { Store } from './store.js';
import { Utils } from './utils.js';
import { QR } from './qr.js';

const PT = 2.83464566929;
const RIGHT_FIELD_TEXT_Y_OFFSET_MM = 0.2;
// ZBS print specification: 77 QR modules plus a four-module quiet zone on each side.
const UPN_QR_SIZE_MM = 35.98333;
function mm(v) { return v * PT; }

export const Export = {

    // ─── Helpers ───
    _rgb(r, g, b) {
        return window.PDFLib.rgb(r / 255, g / 255, b / 255);
    },

    _downloadBlob(bytes, filename) {
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 500);
    },

    _showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const iconWrapper = document.createElement('span');
        iconWrapper.className = 'toast-icon';
        iconWrapper.innerHTML = type === 'success'
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

        const msgSpan = document.createElement('span');
        msgSpan.textContent = message;

        toast.appendChild(iconWrapper);
        toast.appendChild(msgSpan);
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    },

    async _preparePdf() {
        const { PDFDocument, StandardFonts } = window.PDFLib;
        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(window.fontkit);

        let myriadFont;
        try {
            const myriadBytes = await fetch('myriad-pro-webfont/Myriad Pro Semibold.ttf').then(r => r.arrayBuffer());
            myriadFont = await pdfDoc.embedFont(myriadBytes);
        } catch (e) {
            console.warn('Could not load Myriad Pro TTF, falling back to Helvetica Bold');
            myriadFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        }

        const courier = await pdfDoc.embedFont(StandardFonts.Courier);
        const courierBold = await pdfDoc.embedFont(StandardFonts.CourierBold);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        return {
            pdfDoc,
            fonts: { myriad: myriadFont, courier, courierBold, helveticaBold }
        };
    },

    // ─── Core: Draw UPN onto a pdf-lib page at offset (ox, oy) ───
    async _drawUPN(page, ox, oy, fonts, pageHeight, pdfDoc, record = Store, qrPngBytes = null) {
        const s = record;

        // Colors
        const C = {
            p172: this._rgb(250, 70, 22),
            p172u: this._rgb(240, 94, 61),
            p116u: this._rgb(246, 183, 82),
            black: this._rgb(0, 0, 0),
            bgTop: this._rgb(254, 228, 220),
            bgBottom: this._rgb(255, 245, 204),
            white: this._rgb(255, 255, 255)
        };

        const lc = C.p172;
        const rc = C.p172u; // Right orange

        // Coord transformers
        const px = (x) => mm(ox + x);
        const py = (y) => pageHeight - mm(oy + y);

        // Drawing primitives
        const line = (x1, y1, x2, y2, color, width = 0.1, dashArray = undefined) => {
            page.drawLine({
                start: { x: px(x1), y: py(y1) },
                end: { x: px(x2), y: py(y2) },
                thickness: width * PT,
                color: color,
                dashArray: dashArray ? dashArray.map(d => d * PT) : undefined
            });
        };

        const rect = (x, y, w, h, fillCol, strokeCol, width = 0.18) => {
            page.drawRectangle({
                x: px(x),
                y: py(y + h), // Bottom Y
                width: mm(w),
                height: mm(h),
                color: fillCol,
                borderColor: strokeCol,
                borderWidth: strokeCol ? (width * PT) : 0
            });
        };

        const label = (x, y, txt, color, size = 7) => {
            if (!txt) return;
            page.drawText(Utils.sanitizeForQr(txt), {
                x: px(x),
                y: py(y),
                size: size,
                font: fonts.myriad,
                color: color
            });
        };

        const fieldRect = (x, y, w, h, color, hasTicks = true) => {
            rect(x, y, w, h, C.white, color, 0.18);
            if (h === 5 && hasTicks) {
                const numTicks = Math.floor(w / 3.75);
                for (let i = 1; i < numTicks; i++) {
                    const tx = x + (i * 3.75);
                    line(tx, y, tx, y + 1, color, 0.1);
                    line(tx, y + h - 1, tx, y + h, color, 0.1);
                }
            }
        };

        const drawFieldDividers = (x, y, h, totalCells, interval, color) => {
            const step = 3.75;
            for (let i = interval; i < totalCells; i += interval) {
                const lx = x + (i * step);
                line(lx, y, lx, y + h, color, 0.1);
            }
        };

        const drawX = (x, y, w, h, color) => {
            line(x, y, x + w, y + h, color, 0.25);
            line(x + w, y, x, y + h, color, 0.25);
        };

        const dottedLineColor = (x1, y1, x2, y2, color) => {
            line(x1, y1, x2, y2, color, 0.1, [0.5, 0.8]);
        };

        const drawMarker = (x, y) => {
            rect(x, y, 1.5, 1.5, C.black, undefined, 0);
        };

        const fieldText = (x, y, w, h, txt, align = 'left', size = 10, weight = 'normal', yOffsetMm = 0) => {
            if (!txt) return;
            const sText = Utils.sanitizeForQr(txt.toString());
            const font = weight === 'bold' ? fonts.courierBold : fonts.courier;

            const maxChars = Math.floor(mm(w - 1.5) / (size * 0.6));
            let dispText = sText.substring(0, maxChars);

            const y_mm = y + (h / 2) + (size * 0.3527 / 2.8) + yOffsetMm;
            const textWidthStr = font.widthOfTextAtSize(dispText, size);
            const padding = mm(0.75);

            let txtX = px(x) + padding;
            if (align === 'right') {
                txtX = px(x + w) - padding - textWidthStr;
            } else if (align === 'center') {
                txtX = px(x + w / 2) - (textWidthStr / 2);
            }

            page.drawText(dispText, { x: txtX, y: py(y_mm), size, font, color: C.black });
        };

        const fieldTextMultiline = (x, y, w, h, txt, size = 9) => {
            if (!txt) return;
            const lines = txt.toString().split('\n').map(line => Utils.sanitizeForQr(line));
            const padding = 0.75;
            const lineH = size * 0.3527 * 1.2;

            lines.forEach((l, i) => {
                if (i < 3) {
                    const textWidth = fonts.courier.widthOfTextAtSize(l, size);
                    const availableWidth = mm(w - 1.5);
                    const fittedSize = textWidth > availableWidth ? size * availableWidth / textWidth : size;
                    const baselineY_mm = y + padding + i * lineH + (fittedSize * 0.3527 * 0.8);

                    page.drawText(l, {
                        x: px(x + padding),
                        y: py(baselineY_mm),
                        size: fittedSize,
                        font: fonts.courier,
                        color: C.black
                    });
                }
            });
        };

        const fieldTextGridded = (x, y, w, h, txt, size = 10, align = 'left', yOffsetMm = 0) => {
            if (!txt) return;
            const sText = Utils.sanitizeForQr(txt.toString());
            const chars = sText.split('');
            const step = 3.75;
            const maxCells = Math.floor(w / step);
            const y_mm = y + (h / 2) + (size * 0.3527 / 2.8) + yOffsetMm;
            const font = fonts.courier;

            const realChars = chars.filter(c => c !== '.' && c !== ',');
            let startInx = 0;
            if (align === 'right') {
                startInx = Math.max(0, maxCells - realChars.length);
            }

            let cellIdx = 0;
            chars.forEach((char) => {
                const isSep = (char === '.' || char === ',');
                const textW = font.widthOfTextAtSize(char, size);

                if (isSep) {
                    const boundaryIdx = startInx + cellIdx;
                    if (boundaryIdx >= 0 && boundaryIdx <= maxCells) {
                        const xP = px(x + boundaryIdx * step) - (textW / 2);
                        page.drawText(char, { x: xP, y: py(y_mm), size, font, color: C.black });
                    }
                } else {
                    const currentCell = startInx + cellIdx;
                    if (currentCell >= 0 && currentCell < maxCells) {
                        const xP = px(x + currentCell * step + step / 2) - (textW / 2);
                        page.drawText(char, { x: xP, y: py(y_mm), size, font, color: C.black });
                    }
                    cellIdx++;
                }
            });
        };

        const fmtAmount = val => Utils.formatAmountForDisplay(val);
        const fmtDate = val => {
            if (!val || !val.includes('-')) return val || '';
            const p = val.split('-');
            return `${p[2]}.${p[1]}.${p[0]}`;
        };

        // ── Background & Structure ──
        rect(0, 0, 60, 99, C.white);
        rect(60, 0, 150, 55, C.bgTop);
        rect(60, 55, 150, 44, C.bgBottom);
        dottedLineColor(60, 0, 60, 99, C.black);

        drawMarker(61, 1);
        drawMarker(207.5, 1);
        drawMarker(207.5, 96.5);

        // Potrdilo (levi del)
        const dataS = 10;

        label(32.6, 4.5, 'UPN QR - potrdilo', C.black, 9);
        label(4, 5.5, 'Ime plačnika', lc);

        fieldRect(4, 6, 52.5, 13.5, lc);
        fieldTextMultiline(4, 6, 52.5, 13.5, `${s.payerName || ''}\n${s.payerAddress || ''}\n${s.payerCity || ''}`, dataS);

        label(4, 22, 'Namen in rok plačila', lc);
        fieldRect(4, 22.5, 52.5, 9, lc);
        const fDue = fmtDate(s.dueDate);
        fieldTextMultiline(4, 22.5, 52.5, 9, `${s.purpose || ''}${(s.purpose && fDue) ? ', ' : ''}${fDue}`, dataS);

        label(16.5, 34, 'Znesek', lc);
        label(7.8, 38.5, (s.currency || 'EUR').toUpperCase(), C.black, 11);
        fieldRect(16.5, 34.5, 40, 5, lc, false);
        fieldText(16.5, 34.5, 40, 5, fmtAmount(s.amount), 'right', dataS);

        label(4, 42, 'IBAN in referenca prejemnika', lc);
        fieldRect(4, 42.5, 52.5, 13.5, lc);
        fieldTextMultiline(4, 42.5, 52.5, 13.5, `${(s.recipientIban || '').toUpperCase()}\n${s.recipientRefCode || ''}${s.recipientRef || ''}`, dataS);

        label(4, 58.5, 'Ime prejemnika', lc);
        fieldRect(4, 59, 52.5, 13.5, lc);
        fieldTextMultiline(4, 59, 52.5, 13.5, `${s.recipientName || ''}\n${s.recipientAddress || ''}\n${s.recipientCity || ''}`, dataS);

        label(13.8, 97, 'Prostor za vpise ponudnika plačilnih storitev', lc, 5);

        // ═══════════════════════════════════════
        //  NALOG (DESNI DEL)
        // ═══════════════════════════════════════
        const rDataS = 10;

        label(63.5, 5.5, 'Koda QR', rc);
        rect(63.5, 6, 40, 39.5, C.white, rc); // White inside, orange border

        // A21 – Vodila za QR kodo (8 registracijskih oznak)
        const a21w = 0.6;
        const a21t = 0.25; // 0.25pt → mm ≈ 0.088mm
        // Horizontal marks
        rect(63.5, 7.8, a21w, a21t, rc);            // top-left H
        rect(102.9, 7.8, a21w, a21t, rc);           // top-right H
        rect(63.5, 43.7, a21w, a21t, rc);           // bottom-left H
        rect(102.9, 43.7, a21w, a21t, rc);          // bottom-right H
        // Vertical marks
        rect(65.3, 6.0, a21t, a21w, rc);            // top-left V
        rect(101.7, 6.0, a21t, a21w, rc);           // top-right V
        rect(65.3, 44.9, a21t, a21w, rc);           // bottom-left V
        rect(101.7, 44.9, a21t, a21w, rc);          // bottom-right V

        const qrImg = qrPngBytes ? null : document.querySelector('#qr-code img');
        if ((qrPngBytes || qrImg) && pdfDoc) {
            try {
                let imageObj;
                if (qrPngBytes) {
                    imageObj = await pdfDoc.embedPng(qrPngBytes);
                } else {
                    const qrCanvas = document.createElement('canvas');
                    qrCanvas.width = 400; qrCanvas.height = 400;
                    const qrCtx = qrCanvas.getContext('2d');
                    qrCtx.fillStyle = '#ffffff'; qrCtx.fillRect(0, 0, 400, 400);
                    qrCtx.drawImage(qrImg, 0, 0, 400, 400);
                    imageObj = await pdfDoc.embedPng(qrCanvas.toDataURL('image/png'));
                }
                page.drawImage(imageObj, {
                    x: px(65.3),
                    y: py(7.8 + UPN_QR_SIZE_MM),
                    width: mm(UPN_QR_SIZE_MM),
                    height: mm(UPN_QR_SIZE_MM)
                });
            } catch (error) {
                if (qrPngBytes) throw error;
                console.warn('QR embed failed', error);
            }
        }

        label(106.5, 5.5, 'IBAN plačnika', rc);
        fieldRect(106.5, 6, 71.25, 5, rc);
        drawFieldDividers(106.5, 6, 5, 19, 4, rc);
        fieldTextGridded(106.5, 6, 71.25, 5, s.payerIban ? s.payerIban.replace(/\s/g, '').toUpperCase() : '', rDataS, 'left', RIGHT_FIELD_TEXT_Y_OFFSET_MM);

        label(184.3, 5.5, 'Polog', rc);
        label(196.1, 5.5, 'Dvig', rc);

        fieldRect(185.2, 6.5, 4, 4, rc);
        drawX(185.2, 6.5, 4, 4, rc);
        if (s.polog) fieldText(185.2, 6.5, 4, 4, 'X', 'center', 11, 'bold');

        fieldRect(196.5, 6.5, 4, 4, rc);
        drawX(196.5, 6.5, 4, 4, rc);
        if (s.dvig) fieldText(196.5, 6.5, 4, 4, 'X', 'center', 11, 'bold');

        label(106.5, 13.5, 'Referenca plačnika', rc);
        fieldRect(106.5, 14, 15, 5, rc);
        fieldTextGridded(106.5, 14, 15, 5, s.payerRefCode, rDataS, 'left', RIGHT_FIELD_TEXT_Y_OFFSET_MM);
        fieldRect(123.5, 14, 82.5, 5, rc);
        fieldTextGridded(123.5, 14, 82.5, 5, s.payerRef, rDataS, 'left', RIGHT_FIELD_TEXT_Y_OFFSET_MM);

        label(106.5, 21.5, 'Ime, ulica in kraj plačnika', rc);
        fieldRect(106.5, 22, 99.5, 15, rc);
        fieldText(106.5, 22, 99.5, 5, s.payerName, 'left', rDataS, 'normal', RIGHT_FIELD_TEXT_Y_OFFSET_MM);
        dottedLineColor(106.5, 27, 206, 27, rc);
        fieldText(106.5, 27, 99.5, 5, s.payerAddress, 'left', rDataS, 'normal', RIGHT_FIELD_TEXT_Y_OFFSET_MM);
        dottedLineColor(106.5, 32, 206, 32, rc);
        fieldText(106.5, 32, 99.5, 5, s.payerCity, 'left', rDataS, 'normal', RIGHT_FIELD_TEXT_Y_OFFSET_MM);

        label(114.2, 40, 'Znesek', rc);
        label(106.5, 44.5, (s.currency || 'EUR').toUpperCase(), C.black, 11);
        fieldRect(114.2, 40.5, 41.25, 5, rc);
        drawFieldDividers(114.2, 40.5, 5, 11, 3, rc);

        // Amount dots/comma
        const amtChW = 3 * 3.75;
        for (let i = 1; i <= 3; i++) {
            const lx = 114.2 + i * amtChW;
            if (i === 3) {
                rect(lx - 0.4, 44.3, 0.8, 1.2, rc);
                page.drawText(',', { x: px(lx - 0.25), y: py(45.0), size: 5, font: fonts.helveticaBold, color: C.white });
            } else {
                rect(lx - 0.4, 44.7, 0.8, 0.8, rc);
            }
        }

        fieldTextGridded(114.2, 40.5, 41.25, 5, fmtAmount(s.amount), dataS, 'right', RIGHT_FIELD_TEXT_Y_OFFSET_MM);

        label(161.2, 40, 'Datum plačila', rc);
        fieldRect(161.2, 40.5, 30, 5, rc);
        drawFieldDividers(161.2, 40.5, 5, 8, 2, rc);

        const dateChW = 2 * 3.75;
        for (let i = 1; i <= 2; i++) {
            rect(161.2 + i * dateChW - 0.4, 44.7, 0.8, 0.8, rc);
        }

        fieldTextGridded(161.2, 40.5, 30, 5, fmtDate(s.paymentDate), dataS, 'left', RIGHT_FIELD_TEXT_Y_OFFSET_MM);

        label(195.3, 40, 'Nujno', rc);
        fieldRect(196.5, 41, 4, 4, rc);
        drawX(196.5, 41, 4, 4, rc);
        if (s.nujno) fieldText(196.5, 41, 4, 4, 'X', 'center', 11, 'bold');

        label(63.5, 48.5, 'Koda namena', rc);
        label(80.5, 48.5, 'Namen plačila', rc);
        label(176.2, 48.5, 'Rok plačila', rc);

        fieldRect(63.5, 49, 15, 5, rc);
        fieldTextGridded(63.5, 49, 15, 5, s.purposeCode, rDataS, 'left', RIGHT_FIELD_TEXT_Y_OFFSET_MM);

        fieldRect(80.5, 49, 93.75, 5, rc);
        fieldText(80.5, 49, 93.75, 5, s.purpose, 'left', rDataS, 'normal', RIGHT_FIELD_TEXT_Y_OFFSET_MM);

        fieldRect(176.2, 49, 29.75, 5, rc);
        drawFieldDividers(176.2, 49, 5, 8, 2, rc);

        for (let i = 1; i <= 2; i++) {
            rect(176.2 + i * dateChW - 0.4, 53.2, 0.8, 0.8, rc);
        }

        fieldTextGridded(176.2, 49, 29.75, 5, fmtDate(s.dueDate), dataS, 'left', RIGHT_FIELD_TEXT_Y_OFFSET_MM);

        label(63.5, 57.5, 'IBAN prejemnika', rc);
        fieldRect(63.5, 58, 127.5, 5, rc);
        drawFieldDividers(63.5, 58, 5, 34, 4, rc);
        fieldTextGridded(63.5, 58, 127.5, 5, s.recipientIban ? s.recipientIban.replace(/\s/g, '').toUpperCase() : '', rDataS, 'left', RIGHT_FIELD_TEXT_Y_OFFSET_MM);

        label(194.3, 61.5, 'UPN QR', C.black, 10);
        label(63.5, 65.5, 'Referenca prejemnika', rc);
        fieldRect(63.5, 66, 15, 5, rc);
        fieldTextGridded(63.5, 66, 15, 5, s.recipientRefCode, rDataS, 'left', RIGHT_FIELD_TEXT_Y_OFFSET_MM);
        fieldRect(80.5, 66, 82.5, 5, rc);
        fieldTextGridded(80.5, 66, 82.5, 5, s.recipientRef, rDataS, 'left', RIGHT_FIELD_TEXT_Y_OFFSET_MM);

        fieldRect(166, 66, 40, 23, rc);
        line(168.6, 85.3, 203.6, 85.3, rc);
        label(172, 88, 'Podpis plačnika (neobvezno žig)', rc, 5);

        label(63.5, 73.5, 'Ime, ulica in kraj prejemnika', rc);
        fieldRect(63.5, 74, 99.5, 15, rc);
        fieldText(63.5, 74, 99.5, 5, s.recipientName, 'left', rDataS, 'normal', RIGHT_FIELD_TEXT_Y_OFFSET_MM);
        dottedLineColor(63.5, 79, 163, 79, rc);
        fieldText(63.5, 79, 99.5, 5, s.recipientAddress, 'left', rDataS, 'normal', RIGHT_FIELD_TEXT_Y_OFFSET_MM);
        dottedLineColor(63.5, 84, 163, 84, rc);
        fieldText(63.5, 84, 99.5, 5, s.recipientCity, 'left', rDataS, 'normal', RIGHT_FIELD_TEXT_Y_OFFSET_MM);

        label(118.9, 97, 'Prostor za vpise ponudnika plačilnih storitev', rc, 5);
    },

    // ═══════════════════════════════════════════════
    //  PUBLIC API
    // ═══════════════════════════════════════════════

    /** Header helper */
    _loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    },

    async _svgToPngBytes(svg) {
        const image = await this._loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 600;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Brskalnik ne more pripraviti slike QR-kode.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const encoded = atob(canvas.toDataURL('image/png').split(',')[1]);
        return Uint8Array.from(encoded, character => character.charCodeAt(0));
    },

    async _exportQrPng(selector, buttonId, filename, successMessage) {
        const qrImg = document.querySelector(selector);
        if (!qrImg) {
            this._showToast('QR koda še ni pripravljena.', 'error');
            return;
        }
        try {
            this._showLoading(buttonId);
            const size = 400;
            const canvas = document.createElement('canvas');
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
            const img = await this._loadImage(qrImg.src);
            ctx.drawImage(img, 0, 0, size, size);

            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();
            this._showToast(successMessage);
        } catch (err) {
            console.error('QR PNG export error:', err);
            this._showToast('Napaka pri izvozu QR PNG.', 'error');
        } finally {
            this._hideLoading(buttonId);
        }
    },

    async qrPng() {
        return this._exportQrPng('#qr-code img', 'btn-qr-png', 'upn-qr-koda.png', 'UPN QR koda (PNG) izvožena.');
    },

    async epcQrPng() {
        return this._exportQrPng('#epc-qr-code img', 'btn-epc-qr-png', 'epc-sepa-qr-koda.png', 'EPC QR koda (PNG) izvožena.');
    },

    async qrPdf() {
        const qrImg = document.querySelector('#qr-code img');
        if (!qrImg) {
            this._showToast('Najprej izpolnite obrazec, da se ustvari QR koda.', 'error');
            return;
        }
        try {
            this._showLoading('btn-qr-pdf');
            const pdfDoc = await window.PDFLib.PDFDocument.create();
            const page = pdfDoc.addPage([mm(80), mm(80)]); // 80x80mm

            const size = 600;
            const canvas = document.createElement('canvas');
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
            const img = await this._loadImage(qrImg.src);
            ctx.drawImage(img, 0, 0, size, size);
            const b64 = canvas.toDataURL('image/png');

            const imageObj = await pdfDoc.embedPng(b64);
            const margin = 5;
            const qrSize = 70;
            page.drawImage(imageObj, {
                x: mm(margin),
                y: mm(80 - margin - qrSize), // Bottom coordinate!
                width: mm(qrSize),
                height: mm(qrSize)
            });

            const pdfBytes = await pdfDoc.save();
            this._downloadBlob(pdfBytes, 'upn-qr-koda.pdf');
            this._showToast('QR koda (PDF) izvožena.');
        } catch (err) {
            console.error('QR PDF error:', err);
            this._showToast('Napaka pri izvozu QR PDF.', 'error');
        } finally {
            this._hideLoading('btn-qr-pdf');
        }
    },

    async upnA4Pdf() {
        try {
            this._showLoading('btn-upn-a4');
            const { pdfDoc, fonts } = await this._preparePdf();
            const pageHeightMm = 297;
            const page = pdfDoc.addPage([mm(210), mm(pageHeightMm)]);

            await this._drawUPN(page, 0, 198, fonts, mm(pageHeightMm), pdfDoc);

            const pdfBytes = await pdfDoc.save();
            this._downloadBlob(pdfBytes, 'upn-nalog-a4.pdf');
            this._showToast('UPN nalog (A4 PDF) izvožen.');
        } catch (err) {
            console.error('Export A4 PDF error:', err);
            this._showToast('Napaka pri izvozu A4 PDF.', 'error');
        } finally {
            this._hideLoading('btn-upn-a4');
        }
    },

    async upnBatchPdf(records, layout) {
        if (!Array.isArray(records) || records.length === 0) {
            this._showToast('Najprej izberite in preverite CSV ali JSON datoteko.', 'error');
            return;
        }
        if (!['one', 'two', 'three'].includes(layout)) {
            this._showToast('Izberite veljavno razporeditev nalogov.', 'error');
            return;
        }

        const button = document.getElementById('btn-batch-export');
        try {
            this._showLoading('btn-batch-export');
            if (button) button.disabled = true;
            const { pdfDoc, fonts } = await this._preparePdf();
            const pageHeightMm = 297;
            const slipsPerPage = layout === 'three' ? 3 : layout === 'two' ? 2 : 1;
            let page;

            for (let index = 0; index < records.length; index++) {
                const slot = index % slipsPerPage;
                if (slot === 0) {
                    page = pdfDoc.addPage([mm(210), mm(pageHeightMm)]);
                }
                const record = records[index];
                const qrPngBytes = await this._svgToPngBytes(QR.createSvg(record));
                const topOffsetMm = layout === 'three'
                    ? slot * 99
                    : layout === 'two'
                        ? 33 + slot * 132
                        : 198;
                await this._drawUPN(
                    page, 0, topOffsetMm, fonts, mm(pageHeightMm), pdfDoc, record, qrPngBytes
                );
            }

            const pdfBytes = await pdfDoc.save();
            this._downloadBlob(pdfBytes, 'upn-nalogi-uvoz.pdf');
            this._showToast(`PDF z ${records.length} nalogov je bil izvožen.`);
        } catch (error) {
            console.error('Batch UPN PDF export error:', error);
            this._showToast(`Napaka pri izdelavi skupnega PDF-ja: ${error.message || 'neznana napaka'}`, 'error');
        } finally {
            this._hideLoading('btn-batch-export');
            if (button) button.disabled = false;
        }
    },

    async upnExactPdf() {
        try {
            this._showLoading('btn-upn-exact');
            const { pdfDoc, fonts } = await this._preparePdf();
            const pageHeightMm = 99;
            const page = pdfDoc.addPage([mm(210), mm(pageHeightMm)]);

            await this._drawUPN(page, 0, 0, fonts, mm(pageHeightMm), pdfDoc);

            const pdfBytes = await pdfDoc.save();
            this._downloadBlob(pdfBytes, 'upn-nalog-210x99.pdf');
            this._showToast('UPN nalog (210×99 mm PDF) izvožen.');
        } catch (err) {
            console.error('Export Exact PDF error:', err);
            this._showToast('Napaka pri izvozu PDF.', 'error');
        } finally {
            this._hideLoading('btn-upn-exact');
        }
    },

    async upnExactPng() {
        const el = document.querySelector('.upn');
        if (!el) return;
        const ms = window.modernScreenshot;
        if (!ms) {
            this._showToast('Knjižnica za zajem zaslona ni naložena.', 'error');
            return;
        }
        try {
            this._showLoading('btn-upn-png');
            await document.fonts.ready;
            const dataUrl = await ms.domToPng(el, {
                scale: 3, backgroundColor: '#ffffff', style: { margin: '0', padding: '0' }
            });
            const link = document.createElement('a');
            link.download = 'upn-nalog-predogled.png';
            link.href = dataUrl;
            link.click();
            this._showToast('UPN nalog (PNG) izvožen.');
        } catch (err) {
            console.error('Export PNG error:', err);
            this._showToast('Napaka pri izvozu PNG.', 'error');
        } finally {
            this._hideLoading('btn-upn-png');
        }
    },

    async upnExactCapturePdf() {
        const el = document.querySelector('.upn');
        if (!el) return;
        const ms = window.modernScreenshot;
        if (!ms) {
            this._showToast('Knjižnica za zajem zaslona ni naložena.', 'error');
            return;
        }
        try {
            this._showLoading('btn-upn-capture-pdf');
            await document.fonts.ready;

            // Začasno povečamo višino kontejnerja, da screenshot knjižnica
            // ne odreže spodnjih pikslov teksta A14/A60 (standard: 97mm, kontejner: 99mm)
            const originalHeight = el.style.height;
            el.style.height = '100mm';

            const dataUrl = await ms.domToPng(el, {
                scale: 3, backgroundColor: '#ffffff', style: { margin: '0', padding: '0' }
            });

            // Takoj obnovimo prvotno višino
            el.style.height = originalHeight;

            const pdfDoc = await window.PDFLib.PDFDocument.create();
            const page = pdfDoc.addPage([mm(210), mm(99)]);
            const imageObj = await pdfDoc.embedPng(dataUrl);
            page.drawImage(imageObj, { x: 0, y: 0, width: mm(210), height: mm(99) });

            const pdfBytes = await pdfDoc.save();
            this._downloadBlob(pdfBytes, 'upn-nalog-vizualni.pdf');
            this._showToast('UPN nalog (vizualni PDF) izvožen.');
        } catch (err) {
            console.error('Export Capture PDF error:', err);
            this._showToast('Napaka pri izvozu vizualnega PDF.', 'error');
        } finally {
            // Varnostna obnovitev za vsak primer
            el.style.height = '';
            this._hideLoading('btn-upn-capture-pdf');
        }
    },

    _showLoading(btnId) {
        const activeBtn = document.getElementById(btnId);
        const allBtns = document.querySelectorAll('.actions .action-btn');
        allBtns.forEach(btn => {
            btn.disabled = true; btn.style.opacity = '0.5'; btn.style.cursor = 'wait';
        });
        if (activeBtn) {
            activeBtn.dataset.originalText = activeBtn.innerHTML;
            const textEl = activeBtn.querySelector('span:first-child');
            if (textEl) textEl.innerHTML = 'Izvažam…';
            activeBtn.style.opacity = '1';
        }
    },

    _hideLoading(btnId) {
        const activeBtn = document.getElementById(btnId);
        const allBtns = document.querySelectorAll('.actions .action-btn');
        allBtns.forEach(btn => {
            btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = '';
        });
        if (activeBtn && activeBtn.dataset.originalText) {
            activeBtn.innerHTML = activeBtn.dataset.originalText;
            delete activeBtn.dataset.originalText;
        }
    }
};
