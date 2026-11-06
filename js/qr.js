import { Utils } from './utils.js';
import { Store } from './store.js';

/**
 * QR Module — Generates the ZBS Standard UPNQR string (20 fields)
 * Following official Priloga 7.3 specifications.
 */
export const QR = {
    error: '',

    _textField(value, label, limit) {
        const text = value || '';
        if (Utils.hasUnsupportedQrChars(text) || Utils.hasLossyQrText(text)) {
            throw new Error(`${label} vsebuje znake, ki niso podprti v ISO-8859-2 ali bi se v QR spremenili.`);
        }

        const encoded = text.trim();
        const byteLength = Utils.encodeIso88592(encoded).length;
        if (byteLength > limit) {
            throw new Error(`${label} je predolgo za UPN QR (${byteLength}/${limit} znakov).`);
        }
        return encoded;
    },

    clear() {
        this.lines = [];
        this.payload = '';
        this.updateInspectView();
        const container = document.querySelector('.qr-placeholder');
        if (container) {
            container.innerHTML = '';
            container.classList.remove('qr-error');
            container.textContent = '';
        }
    },

    showError(message) {
        const container = document.querySelector('.qr-placeholder');
        this.error = message;
        this.lines = [];
        this.payload = '';
        this.updateInspectView();

        if (container) {
            container.innerHTML = '';
            container.classList.add('qr-error');
            container.textContent = message;
        }

        return false;
    },

    _buildCode(data, includeSvg) {
        const lines = [
            'UPNQR',                                                        // 1. Vodilni slog
            (data.payerIban || '').replace(/\s/g, '').toUpperCase(),       // 2. IBAN plačnika
            data.polog ? 'X' : '',                                         // 3. Polog
            data.dvig ? 'X' : '',                                          // 4. Dvig
            Utils.formatReferenceForQr(data.payerRefCode, data.payerRef),  // 5. Referenca plačnika (2+2+22)
            this._textField(data.payerName, 'Ime plačnika', 33),           // 6. Ime plačnika
            this._textField(data.payerAddress, 'Naslov plačnika', 33),     // 7. Ulica plačnika
            this._textField(data.payerCity, 'Kraj plačnika', 33),          // 8. Kraj plačnika
            Utils.formatAmountForQr(data.amount),                          // 9. Znesek (11 digits)
            Utils.formatDateForQr(data.paymentDate),                       // 10. Datum plačila
            data.nujno ? 'X' : '',                                         // 11. Nujno
            (data.purposeCode || 'OTHR').toUpperCase().substring(0, 4),    // 12. Koda namena
            this._textField(data.purpose, 'Namen plačila', 42),            // 13. Namen plačila
            Utils.formatDateForQr(data.dueDate),                           // 14. Rok plačila
            (data.recipientIban || '').replace(/\s/g, '').toUpperCase(),   // 15. IBAN prejemnika
            Utils.formatReferenceForQr(data.recipientRefCode, data.recipientRef), // 16. Referenca prejemnika
            this._textField(data.recipientName, 'Ime prejemnika', 33),     // 17. Ime prejemnika
            this._textField(data.recipientAddress, 'Naslov prejemnika', 33), // 18. Ulica prejemnika
            this._textField(data.recipientCity, 'Kraj prejemnika', 33)     // 19. Kraj prejemnika
        ];

        lines.push(Utils.calculateQrChecksum(lines));
        const payload = `${lines.join('\n')}\n`;
        const payloadBytes = Utils.encodeIso88592(payload, true);
        if (payloadBytes.length > 411) {
            throw new Error(`QR ni veljaven: prevelika vsebina (${payloadBytes.length}/411 bajtov).`);
        }

        const { QrCode, QrSegment } = window.qrcodegen;
        const qr = QrCode.encodeSegments([
            QrSegment.makeEci(4),
            QrSegment.makeBytes(Array.from(payloadBytes))
        ], QrCode.Ecc.MEDIUM, 15, 15, -1, false);

        let svg = '';
        if (includeSvg) {
            const quietZone = 4;
            const dimension = qr.size + quietZone * 2;
            const darkModules = [];
            for (let y = 0; y < qr.size; y++) {
                for (let x = 0; x < qr.size; x++) {
                    if (qr.getModule(x, y)) {
                        darkModules.push(`M${x + quietZone} ${y + quietZone}h1v1h-1z`);
                    }
                }
            }
            svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}" viewBox="0 0 ${dimension} ${dimension}" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h${dimension}v${dimension}H0z"/><path fill="#000" d="${darkModules.join('')}"/></svg>`;
        }

        return { lines, payload, svg, version: qr.version };
    },

    validateData(data) {
        this._buildCode(data, false);
        return true;
    },

    createSvg(data) {
        return this._buildCode(data, true).svg;
    },

    generate() {
        const container = document.querySelector('.qr-placeholder');
        this.clear();

        try {
            const result = this._buildCode(Store, true);
            this.lines = result.lines;
            this.payload = result.payload;

            if (container) {
                const imgEl = document.createElement('img');
                imgEl.alt = 'UPN QR koda';
                imgEl.dataset.qrVersion = String(result.version);
                imgEl.dataset.qrEcc = 'M';
                imgEl.dataset.qrEci = '4';
                imgEl.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`;
                imgEl.style.width = '100%';
                imgEl.style.height = '100%';
                imgEl.style.display = 'block';
                container.replaceChildren(imgEl);
            }

            this.updateInspectView();
            this.error = '';
            return true;
            
        } catch (error) {
            console.error('QR Generate Error:', error);
            this.lines = [];
            this.payload = '';
            this.updateInspectView();
            return this.showError(error instanceof Error ? error.message : 'QR ni veljaven.');
        }
    },

    updateInspectView() {
        const pre = document.getElementById('upn-qr-inspect-content');
        const rawLinesEl = document.getElementById('upn-qr-inspect-raw-lines');
        if (!pre) return;
        if (!this.lines || this.lines.length === 0) {
            pre.innerHTML = '<span class="qr-inspect-empty">Izpolnite obrazec za veljaven UPN QR zapis.</span>';
            if (rawLinesEl) {
                rawLinesEl.innerHTML = '<span class="qr-inspect-empty">Izpolnite obrazec za veljaven UPN QR zapis.</span>';
            }
            return;
        }

        const labels = [
            '1. Vodilni slog (UPNQR)',
            '2. IBAN plačnika',
            '3. Polog (X / prazno)',
            '4. Dvig (X / prazno)',
            '5. Referenca plačnika',
            '6. Ime plačnika',
            '7. Ulica in hišna št. plačnika',
            '8. Poštna št. in kraj plačnika',
            '9. Znesek (11 mest v centih)',
            '10. Datum plačila (dd.mm.yyyy)',
            '11. Nujno (X / prazno)',
            '12. Koda namena (4 znaki)',
            '13. Namen plačila',
            '14. Rok plačila (dd.mm.yyyy)',
            '15. IBAN prejemnika',
            '16. Referenca prejemnika',
            '17. Ime prejemnika',
            '18. Ulica in hišna št. prejemnika',
            '19. Poštna št. in kraj prejemnika',
            '20. Kontrolna vsota'
        ];

        pre.innerHTML = this.lines.map((val, idx) => {
            const num = String(idx + 1).padStart(2, '0');
            const label = labels[idx] ? labels[idx].replace(/^\d+\.\s*/, '') : `Vrstica ${idx + 1}`;
            const displayVal = val === '' ? '<span style="color:#64748b; font-style:italic;">&lt;prazno&gt;</span>' : Utils.escapeHtml(val);
            return `<div class="qr-inspect-row"><span class="qr-inspect-linenum">${num}</span><span class="qr-inspect-idx">${label}</span><code class="qr-inspect-val">${displayVal}</code></div>`;
        }).join('');

        if (rawLinesEl) {
            rawLinesEl.innerHTML = `<pre class="qr-raw-text-block">${Utils.escapeHtml(this.payload)}</pre>`;
        }
    }
};
