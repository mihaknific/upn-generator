import { Store } from './store.js';
import { Validator } from './validator.js';

const MAX_NAME_LENGTH = 70;
const MAX_REMITTANCE_LENGTH = 140;
const MAX_INFORMATION_LENGTH = 70;
const BIC_PATTERN = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/;

function text(value, label, limit) {
    const result = (value || '').trim();
    if (/[\u0000-\u001F\u007F]/.test(result)) {
        throw new Error(`${label} ne sme vsebovati kontrolnih znakov ali novih vrstic.`);
    }
    const length = [...result].length;
    if (length > limit) {
        throw new Error(`${label} je predolgo (${length}/${limit} znakov).`);
    }
    return result;
}

function amount(value) {
    const raw = (value || '').toString().trim().replace(',', '.');
    if (!raw) return '';
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw) || Number(raw) > 999999999.99) {
        throw new Error('Znesek mora biti EUR z največ dvema decimalkama.');
    }
    const numericAmount = Number(raw);
    if (numericAmount === 0) return '';
    if (numericAmount < 0) throw new Error('Znesek ne sme biti negativen.');
    return `EUR${numericAmount.toFixed(2)}`;
}

export const EPCQR = {
    error: '',
    payload: '',

    buildPayload(store = Store) {
        const name = text(store.recipientName, 'Ime prejemnika', MAX_NAME_LENGTH);
        if (!name) throw new Error('Vnesite ime prejemnika za EPC QR.');

        const iban = (store.recipientIban || '').replace(/\s/g, '').toUpperCase();
        if (!iban || !Validator.validateSepaIBAN(iban)) {
            throw new Error('Za EPC QR vnesite veljaven SEPA IBAN prejemnika.');
        }

        const bic = (store.epcBic || '').replace(/\s/g, '').toUpperCase();
        if (bic && !BIC_PATTERN.test(bic)) {
            throw new Error('BIC mora imeti 8 ali 11 veljavnih znakov.');
        }

        const purposeCode = text(store.purposeCode, 'Koda namena', 4).toUpperCase();
        if (purposeCode && !/^[A-Z0-9]{4}$/.test(purposeCode)) {
            throw new Error('Koda namena EPC QR mora vsebovati natanko 4 črke ali številke.');
        }

        const remittance = text(store.purpose, 'Opis plačila', MAX_REMITTANCE_LENGTH);
        const information = text(store.epcInformation, 'Dodatne informacije', MAX_INFORMATION_LENGTH);
        const lines = [
            'BCD',
            '002',
            '1',
            'SCT',
            bic,
            name,
            iban,
            amount(store.amount),
            purposeCode,
            remittance,
            information
        ];
        this.lines = lines;
        const payload = `${lines.join('\n')}\n`;
        const byteLength = new TextEncoder().encode(payload).length;
        if (byteLength > 331) {
            throw new Error(`EPC QR je predolg (${byteLength}/331 bajtov).`);
        }
        return payload;
    },

    clear(message = '') {
        this.lines = [];
        this.payload = '';
        this.updateInspectView();
        const container = document.getElementById('epc-qr-code');
        if (!container) return;
        container.replaceChildren();
        container.classList.remove('qr-error');
        container.textContent = message;
    },

    generate() {
        const container = document.getElementById('epc-qr-code');
        if (!container) return false;

        const hasEpcInput = [
            Store.recipientName,
            Store.recipientIban,
            Store.amount,
            Store.purpose,
            Store.purposeCode,
            Store.epcBic,
            Store.epcInformation
        ].some(value => value && value.toString().trim());
        if (!hasEpcInput) {
            this.payload = '';
            this.lines = [];
            this.error = '';
            this.updateInspectView();
            this.clear('Vnesite ime in IBAN prejemnika za EPC QR.');
            return false;
        }

        try {
            const payload = this.buildPayload();
            const bytes = new TextEncoder().encode(payload);
            const { QrCode, QrSegment } = window.qrcodegen;
            const qr = QrCode.encodeSegments([
                QrSegment.makeEci(26),
                QrSegment.makeBytes(Array.from(bytes))
            ], QrCode.Ecc.MEDIUM, 1, 40, -1, false);
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
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}" viewBox="0 0 ${dimension} ${dimension}" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h${dimension}v${dimension}H0z"/><path fill="#000" d="${darkModules.join('')}"/></svg>`;
            const image = document.createElement('img');
            image.alt = 'EPC SEPA plačilna QR koda';
            image.dataset.qrVersion = String(qr.version);
            image.dataset.qrEcc = 'M';
            image.dataset.qrEci = '26';
            image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
            container.classList.remove('qr-error');
            container.replaceChildren(image);
            this.payload = payload;
            this.error = '';
            this.updateInspectView();
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'EPC QR ni veljaven.';
            this.payload = '';
            this.lines = [];
            this.error = message;
            this.updateInspectView();
            container.replaceChildren();
            container.classList.add('qr-error');
            container.textContent = message;
            return false;
        }
    },

    updateInspectView() {
        const pre = document.getElementById('epc-qr-inspect-content');
        const rawLinesEl = document.getElementById('epc-qr-inspect-raw-lines');
        const pillCount = document.getElementById('epc-pill-count');
        if (pillCount) {
            if (this.lines && this.lines.length > 0) {
                pillCount.textContent = String(this.lines.length);
                pillCount.hidden = false;
            } else {
                pillCount.hidden = true;
                pillCount.textContent = '';
            }
        }
        if (!pre) return;
        if (!this.lines || this.lines.length === 0) {
            pre.innerHTML = '<span class="qr-inspect-empty">Vnesite ime in IBAN prejemnika za veljaven EPC QR zapis.</span>';
            if (rawLinesEl) {
                rawLinesEl.innerHTML = '<span class="qr-inspect-empty">Vnesite ime in IBAN prejemnika za veljaven EPC QR zapis.</span>';
            }
            return;
        }

        const labels = [
            '1. Servisna oznaka (BCD)',
            '2. Različica (002)',
            '3. Nabor znakov (1 = UTF-8)',
            '4. Identifikator (SCT)',
            '5. BIC prejemnika',
            '6. Ime prejemnika',
            '7. IBAN prejemnika',
            '8. Znesek (EUR...)',
            '9. Koda namena (4 znaki)',
            '10. Opis plačila (namen)',
            '11. Dodatna informacija'
        ];

        pre.innerHTML = this.lines.map((val, idx) => {
            const num = String(idx + 1).padStart(2, '0');
            const label = labels[idx] ? labels[idx].replace(/^\d+\.\s*/, '') : `Vrstica ${idx + 1}`;
            const displayVal = val === '' ? '<span style="color:#64748b; font-style:italic;">&lt;prazno&gt;</span>' : String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<div class="qr-inspect-row"><span class="qr-inspect-linenum">${num}</span><span class="qr-inspect-idx">${label}</span><code class="qr-inspect-val">${displayVal}</code></div>`;
        }).join('');

        if (rawLinesEl) {
            const safePayload = String(this.payload).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            rawLinesEl.innerHTML = `<pre class="qr-raw-text-block">${safePayload}</pre>`;
        }
    }
};
