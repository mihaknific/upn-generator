import { Store } from './store.js';
import { QR } from './qr.js';
import { EPCQR } from './epc-qr.js';
import { Storage } from './storage.js';
import { Export } from './export.js';
import { Validator } from './validator.js';
import { PURPOSE_CODES } from './purpose-codes.js';
import { BatchImport } from './batch-import.js';

export const App = {
    // Evidenca polj, ki jih je uporabnik že urejal.
    // Opozorila se prikažejo SAMO za ta polja.
    _touchedFields: new Set(),
    _showAllValidationErrors: false,
    _storageLifecycleBound: false,
    _aboutLinkBound: false,
    _installPrompt: null,
    _batchRecords: null,
    _batchImportSequence: 0,

    init() {
        console.log('UPN QR Studio: Initialization started.');
        this._bindEvents();
        this._bindAboutLink();
        this._bindStorageLifecycle();
        this._bindInstallPrompt();

        const savedData = Storage.load();
        if (savedData) {
            Object.keys(savedData).forEach(key => {
                if (key in Store && key !== 'mode') {
                    const val = savedData[key];
                    if (val !== undefined && val !== null) {
                        Store[key] = val;
                        const input = document.querySelector(`[data-bind="${key}"]`);
                        if (input) {
                            if (input.type === 'checkbox') {
                                input.checked = Boolean(val);
                            } else {
                                input.value = val;
                            }
                        }
                        const hasValue = typeof val === 'boolean' ? val : (val && val.toString().trim() !== '');
                        if (hasValue) this._touchedFields.add(key);
                    }
                }
            });
        }

        // Helper for local YYYY-MM-DD format
        const toLocalISODate = (d) => {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };

        // Initialize Defaults if missing
        const now = new Date();
        const today = toLocalISODate(now);

        if (!Store.purposeCode && Store.humanitarno) Store.purposeCode = 'CHAR';
        Store.currency = 'EUR';
        if (!Store.paymentDate) Store.paymentDate = today;
        if (Store.humanitarno) {
            Store.dueDate = '';
            if (!Store.purpose || !Store.purpose.trim()) Store.purpose = 'DONACIJA';
            if (!Store.purposeCode || Store.purposeCode === 'GDSV') {
                Store.purposeCode = 'CHAR';
                const purposeCodeField = document.querySelector('[data-bind="purposeCode"]');
                if (purposeCodeField) purposeCodeField.value = 'CHAR';
            }
            Store.payerName = '';
            Store.payerAddress = '';
            Store.payerCity = '';
        }

        this._populatePurposeCodes();

        // Sync defaults to form
        document.querySelectorAll('[data-bind]').forEach(el => {
            const key = el.dataset.bind;
            const val = Store[key];

            if (val !== undefined && val !== null) {
                if (el.type === 'checkbox') {
                    el.checked = !!val;
                } else if (el.type === 'date' || el.tagName === 'SELECT' || el.tagName === 'INPUT') {
                    el.value = val;
                }
            }
        });

        // Initialize Theme
        this._initTheme();

        // Apply initial field rules based on restored checkbox state
        this._applyFieldRules();
        this._validateUI();
    },

    _bindInstallPrompt() {
        const installButton = document.getElementById('install-app');
        if (!installButton || installButton.dataset.bound === 'true') return;

        installButton.dataset.bound = 'true';
        window.addEventListener('beforeinstallprompt', event => {
            event.preventDefault();
            this._installPrompt = event;
            installButton.hidden = false;
        });

        window.addEventListener('appinstalled', () => {
            this._installPrompt = null;
            installButton.hidden = true;
        });

        installButton.addEventListener('click', async () => {
            if (!this._installPrompt) return;

            const prompt = this._installPrompt;
            this._installPrompt = null;
            installButton.disabled = true;

            try {
                await prompt.prompt();
                await prompt.userChoice;
            } catch (error) {
                console.error('UPN QR Studio: App installation prompt failed.', error);
            } finally {
                installButton.disabled = false;
                installButton.hidden = true;
            }
        });
    },

    _bindAboutLink() {
        const aboutDetails = document.getElementById('about-app');
        if (!aboutDetails) return;

        if (!this._aboutLinkBound) {
            document.querySelectorAll('a[href="#about-app"]').forEach(link => {
                link.addEventListener('click', () => {
                    aboutDetails.open = true;
                });
            });
            this._aboutLinkBound = true;
        }

        if (window.location.hash === '#about-app') aboutDetails.open = true;
    },

    _bindStorageLifecycle() {
        if (this._storageLifecycleBound) return;

        const flushPendingSave = () => Storage.flush();
        window.addEventListener('pagehide', flushPendingSave);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') flushPendingSave();
        });
        this._storageLifecycleBound = true;
    },

    _populatePurposeCodes() {
        const select = document.querySelector('[data-bind="purposeCode"]');
        if (!select) return;

        const options = document.createDocumentFragment();
        options.append(new Option('— Izberi kodo namena —', ''));
        PURPOSE_CODES.forEach(({ code, label }) => {
            options.append(new Option(`${code} - ${label}`, code));
        });
        select.replaceChildren(options);
    },

    _initTheme() {
        const savedTheme = localStorage.getItem('upn_studio_theme');
        if (savedTheme) {
            Store.mode = savedTheme;
        }
        const isDark = (Store.mode === 'dark');
        if (isDark) {
            document.body.classList.add('dark-theme');
            const sunIcon = document.querySelector('.sun-icon');
            const moonIcon = document.querySelector('.moon-icon');
            if (sunIcon) sunIcon.style.display = 'block';
            if (moonIcon) moonIcon.style.display = 'none';
        }
    },

    /**
     * Derives the current transaction mode from checkbox state.
     * Priority: polog > dvig > humanitarno > placilo (default)
     */
    _deriveMode() {
        if (Store.polog) return 'polog';
        if (Store.dvig) return 'dvig';
        if (Store.humanitarno) return 'humanitarno';
        return 'placilo';
    },

    _setBatchStatus(message, isError = false) {
        const status = document.getElementById('batch-status');
        if (!status) return;
        status.textContent = message;
        status.hidden = false;
        status.dataset.state = isError ? 'error' : 'success';
        status.setAttribute('role', isError ? 'alert' : 'status');
        status.setAttribute('aria-live', isError ? 'assertive' : 'polite');
    },

    _updateBatchLayoutPreview() {
        const layout = document.getElementById('batch-layout')?.value;
        const preview = document.getElementById('batch-layout-preview');
        if (!preview) return;

        const previewLabels = {
            one: 'Predogled: en UPN nalog na dnu lista A4',
            two: 'Predogled: dva UPN naloga, zgoraj in spodaj na listu A4',
            three: 'Predogled: trije UPN nalogi, en pod drugim na listu A4'
        };
        preview.classList.remove('layout-one', 'layout-two', 'layout-three');
        preview.classList.add(`layout-${layout in previewLabels ? layout : 'one'}`);
        preview.setAttribute('aria-label', previewLabels[layout] || previewLabels.one);
    },

    _renderBatchPreview(records) {
        const preview = document.getElementById('batch-preview');
        const body = document.getElementById('batch-preview-body');
        if (!preview || !body) return;

        const modeLabels = {
            placilo: 'Plačilo',
            polog: 'Polog',
            dvig: 'Dvig',
            humanitarno: 'Humanitarni'
        };
        const formatDate = value => {
            if (!value) return '—';
            const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
        };
        const details = [
            ['Vrsta naloga', record => modeLabels[record.polog ? 'polog'
                : record.dvig ? 'dvig'
                    : record.humanitarno ? 'humanitarno'
                        : 'placilo']],
            ['Plačnik', record => record.payerName],
            ['Naslov plačnika', record => record.payerAddress],
            ['Kraj plačnika', record => record.payerCity],
            ['IBAN plačnika', record => record.payerIban],
            ['Model plačnika', record => record.payerRefCode],
            ['Sklic plačnika', record => record.payerRef],
            ['Prejemnik', record => record.recipientName],
            ['Naslov prejemnika', record => record.recipientAddress],
            ['Kraj prejemnika', record => record.recipientCity],
            ['IBAN prejemnika', record => record.recipientIban],
            ['Model prejemnika', record => record.recipientRefCode],
            ['Sklic prejemnika', record => record.recipientRef],
            ['Znesek', record => `${record.amount || '0,00'} ${(record.currency || 'EUR').toUpperCase()}`],
            ['Koda namena', record => record.purposeCode],
            ['Namen', record => record.purpose],
            ['Datum plačila', record => formatDate(record.paymentDate)],
            ['Rok plačila', record => formatDate(record.dueDate)],
            ['Nujno', record => record.nujno ? 'Da' : 'Ne']
        ];
        const rows = records.map((record, index) => {
            const row = document.createElement('tr');
            const mode = record.polog ? 'polog'
                : record.dvig ? 'dvig'
                    : record.humanitarno ? 'humanitarno'
                        : 'placilo';
            const values = [
                String(index + 1),
                record.payerName || (record.humanitarno ? '—' : ''),
                `${record.recipientName || (record.dvig ? '—' : '')}\n${record.recipientIban || ''}`,
                `${record.amount || '0,00'} ${(record.currency || 'EUR').toUpperCase()}`,
                `${record.purposeCode || ''}${record.purposeCode && record.purpose ? ' · ' : ''}${record.purpose || ''}`,
                formatDate(record.paymentDate),
                modeLabels[mode]
            ];
            values.forEach((value, cellIndex) => {
                const cell = document.createElement('td');
                cell.textContent = value;
                if (cellIndex === 2) cell.classList.add('batch-recipient-cell');
                row.append(cell);
            });

            const detailsCell = document.createElement('td');
            const disclosure = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = 'Podatki';
            disclosure.append(summary);
            const definitionList = document.createElement('dl');
            details.forEach(([label, getValue]) => {
                const term = document.createElement('dt');
                term.textContent = label;
                const description = document.createElement('dd');
                description.textContent = getValue(record) || '—';
                definitionList.append(term, description);
            });
            disclosure.append(definitionList);
            detailsCell.append(disclosure);
            row.append(detailsCell);
            return row;
        });

        body.replaceChildren(...rows);
        preview.hidden = false;
    },

    _bindBatchImport() {
        const fileInput = document.getElementById('batch-file');
        const fileName = document.getElementById('batch-file-name');
        const dropzone = document.getElementById('batch-file-dropzone');
        const exportButton = document.getElementById('btn-batch-export');
        const layoutSelect = document.getElementById('batch-layout');
        if (!fileInput || !dropzone || !exportButton || !layoutSelect) return;

        this._updateBatchLayoutPreview();
        layoutSelect.addEventListener('change', () => this._updateBatchLayoutPreview());

        fileInput.addEventListener('change', async () => {
            const sequence = ++this._batchImportSequence;
            this._batchRecords = null;
            exportButton.disabled = true;
            const files = Array.from(fileInput.files || []);
            if (fileName) {
                fileName.textContent = files.length
                    ? `${files.length} ${files.length === 1 ? 'datoteka' : files.length === 2 ? 'datoteki' : files.length < 5 ? 'datoteke' : 'datotek'}: ${files.map(file => file.name).join(', ')}`
                    : 'Datoteka ni izbrana';
                fileName.title = files.map(file => file.name).join('\n');
            }
            document.getElementById('batch-preview')?.setAttribute('hidden', '');
            document.getElementById('batch-preview-body')?.replaceChildren();
            if (files.length === 0) {
                const status = document.getElementById('batch-status');
                if (status) {
                    status.hidden = true;
                    status.textContent = '';
                }
                return;
            }
            if (files.some(file => file.size > BatchImport.MAX_FILE_BYTES)) {
                this._setBatchStatus('Vsaka datoteka je lahko velika največ 5 MB.', true);
                return;
            }
            const totalBytes = files.reduce((total, file) => total + file.size, 0);
            if (totalBytes > BatchImport.MAX_FILE_BYTES) {
                this._setBatchStatus('Skupna velikost izbranih datotek presega omejitev 5 MB.', true);
                return;
            }

            const readingMessage = files.length === 1
                ? 'Berem in preverjam datoteko …'
                : files.length === 2
                    ? 'Berem in preverjam 2 datoteki …'
                    : `Berem in preverjam ${files.length} datotek …`;
            this._setBatchStatus(readingMessage);
            const records = [];
            const errors = [];

            for (const file of files) {
                try {
                    const format = file.name.toLowerCase().endsWith('.json') ? 'json'
                        : file.name.toLowerCase().endsWith('.csv') ? 'csv'
                            : '';
                    if (!format) throw new Error('podprti sta samo končnici .csv in .json.');

                    const bytes = await file.arrayBuffer();
                    if (sequence !== this._batchImportSequence) return;
                    let text;
                    try {
                        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
                    } catch {
                        if (format !== 'csv') throw new Error('JSON mora biti kodiran v UTF-8.');
                        try {
                            text = new TextDecoder('windows-1250', { fatal: true }).decode(bytes);
                        } catch {
                            throw new Error('datoteke CSV ni mogoče prebrati kot UTF-8 ali Windows-1250.');
                        }
                    }

                    const fileRecords = BatchImport.parseText(text, format);
                    if (records.length + fileRecords.length > BatchImport.MAX_RECORDS) {
                        errors.push(`Skupno število nalogov presega omejitev ${BatchImport.MAX_RECORDS}. Datoteka "${file.name}" je presegla dovoljeno število.`);
                        break;
                    }
                    fileRecords.forEach((record, index) => {
                        const prefix = `"${file.name}" — nalog ${index + 1}`;
                        Validator.validateForm(record).forEach(error => {
                            errors.push(`${prefix} (${error.field}): ${error.msg}`);
                        });
                        try {
                            QR.validateData(record);
                        } catch (error) {
                            errors.push(`${prefix} (QR): ${error.message}`);
                        }
                    });
                    records.push(...fileRecords);
                } catch (error) {
                    errors.push(`Datoteka "${file.name}": ${error.message || 'ni je bilo mogoče prebrati.'}`);
                }
            }

            if (sequence !== this._batchImportSequence) return;
            if (errors.length > 0) {
                const shownErrors = errors.slice(0, 20);
                if (errors.length > shownErrors.length) {
                    shownErrors.push(`… in še ${errors.length - shownErrors.length} napak.`);
                }
                this._setBatchStatus(
                    `Uvoz ni pripravljen. Popravite napake in znova izberite datoteke:\n${shownErrors.join('\n')}`,
                    true
                );
                return;
            }

            this._batchRecords = records;
            exportButton.disabled = false;
            this._renderBatchPreview(records);
            const summary = records.length === 1
                ? '1 nalog je preverjen.'
                : records.length === 2
                    ? '2 naloga sta preverjena.'
                    : records.length < 5
                        ? `${records.length} nalogi so preverjeni.`
                        : `${records.length} nalogov je preverjenih.`;
            const fileSummary = files.length === 1
                ? ''
                : files.length === 2
                    ? 'Združeni sta 2 datoteki. '
                    : `Združenih je ${files.length} datotek. `;
            this._setBatchStatus(
                `${summary} ${fileSummary}Podatki ostanejo v tem zavihku in se ne shranijo v obrazec ali brskalnik.`
            );
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, event => {
                if (!event.dataTransfer?.types.includes('Files')) return;
                event.preventDefault();
                dropzone.classList.add('is-dragging');
            });
        });
        ['dragleave', 'dragend'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => dropzone.classList.remove('is-dragging'));
        });
        dropzone.addEventListener('drop', event => {
            event.preventDefault();
            dropzone.classList.remove('is-dragging');
            if (!event.dataTransfer?.files.length) return;
            fileInput.files = event.dataTransfer.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        });

        exportButton.addEventListener('click', () => {
            if (!this._batchRecords) return;
            Export.upnBatchPdf(
                this._batchRecords.map(record => ({ ...record })),
                layoutSelect.value
            );
        });
    },

    _bindEvents() {
        const form = document.querySelector('form');
        if (!form) return;

        form.addEventListener('submit', event => event.preventDefault());
        this._bindBatchImport();

        // Handle inputs safely, filtering out duplicate checkbox events
        form.addEventListener('input', (e) => {
            if (e.target.type !== 'checkbox') {
                this._handleChange(e.target);
            }
        });

        // change event za select in checkbox elemente
        form.addEventListener('change', (e) => {
            if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') {
                this._handleChange(e.target);
            }
        });

        document.querySelectorAll('.epc-data-input').forEach(input => {
            input.addEventListener('input', () => this._handleChange(input));
        });

        const exportActions = {
            'btn-upn-a4': () => Export.upnA4Pdf(),
            'btn-upn-exact': () => Export.upnExactPdf(),
            'btn-upn-capture-pdf': () => Export.upnExactCapturePdf(),
            'btn-upn-png': () => Export.upnExactPng(),
            'btn-qr-png': () => Export.qrPng(),
            'btn-qr-pdf': () => Export.qrPdf()
        };

        Object.keys(exportActions).forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    this._markAllTouched();
                    if (!this._hasErrors()) {
                        exportActions[id]();
                    } else {
                        const warnBox = document.getElementById('global-warning-box');
                        if (warnBox) warnBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            }
        });

        const epcPngButton = document.getElementById('btn-epc-qr-png');
        if (epcPngButton) {
            epcPngButton.addEventListener('click', () => Export.epcQrPng());
        }

        // Očisti posamezen fieldset
        document.addEventListener('click', (e) => {
            const clearBtn = e.target.closest('.clear-fieldset-btn');
            if (!clearBtn) return;

            const section = clearBtn.dataset.clear;
            let fieldsToClear = [];

            if (section === 'payer') {
                fieldsToClear = ['payerName', 'payerAddress', 'payerCity', 'payerIban', 'payerRefCode', 'payerRef'];
            } else if (section === 'recipient') {
                fieldsToClear = ['recipientName', 'recipientAddress', 'recipientCity', 'recipientIban', 'recipientRefCode', 'recipientRef'];
            } else if (section === 'amount') {
                fieldsToClear = ['amount', 'purposeCode', 'purpose', 'paymentDate', 'dueDate'];
            }

            fieldsToClear.forEach(key => {
                const el = document.querySelector(`[data-bind="${key}"]`);
                if (el && !el.disabled) {
                    Store[key] = '';
                    el.value = '';
                    // Remove touched state so it doesn't immediately show errors
                    this._touchedFields.delete(key);
                }
            });
            this._validateUI();
        });

        // Toggle Dropdowns
        document.querySelectorAll('.split-arrow').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const wrapper = btn.closest('.dropdown-wrapper');
                const menu = wrapper?.querySelector('.dropdown-menu');
                if (!menu) return;

                const isHidden = menu.hasAttribute('hidden');
                // Zapremo ostale odprte menije
                document.querySelectorAll('.dropdown-menu').forEach(m => m.setAttribute('hidden', ''));

                if (isHidden) {
                    menu.removeAttribute('hidden');
                }
            });
        });

        // Close dropdowns on click outside or choice
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown-wrapper')) {
                document.querySelectorAll('.dropdown-menu').forEach(m => m.setAttribute('hidden', ''));
            }
        });

        // Close dropdowns on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.dropdown-menu').forEach(m => m.setAttribute('hidden', ''));
            }
        });

        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.dropdown-menu').forEach(m => m.setAttribute('hidden', ''));
            });
        });

        // QR Inspector Terminal Triggers & Actions
        const setupInspector = (toggleId, panelId, closeId, copyId, getPayloadFn) => {
            const toggleBtn = document.getElementById(toggleId);
            const panel = document.getElementById(panelId);
            const closeBtn = document.getElementById(closeId);
            const copyBtn = document.getElementById(copyId);

            if (toggleBtn && panel) {
                toggleBtn.addEventListener('click', () => {
                    const isHidden = panel.hasAttribute('hidden');
                    if (isHidden) {
                        panel.removeAttribute('hidden');
                        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    } else {
                        panel.setAttribute('hidden', '');
                    }
                });
            }

            const switchBtns = panel ? panel.querySelectorAll('.qr-switch-btn') : [];
            const tableBody = panel ? panel.querySelector('.qr-terminal-body') : null;
            const rawWrap = panel ? panel.querySelector('.qr-terminal-raw-wrap') : null;

            switchBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const view = btn.dataset.view;
                    switchBtns.forEach(b => {
                        const isActive = b === btn;
                        b.classList.toggle('active', isActive);
                        b.setAttribute('aria-selected', String(isActive));
                    });
                    if (view === 'raw') {
                        if (tableBody) tableBody.hidden = true;
                        if (rawWrap) rawWrap.hidden = false;
                    } else {
                        if (tableBody) tableBody.hidden = false;
                        if (rawWrap) rawWrap.hidden = true;
                    }
                });
            });

            if (closeBtn && panel) {
                closeBtn.addEventListener('click', () => {
                    panel.setAttribute('hidden', '');
                });
            }

            if (copyBtn) {
                copyBtn.addEventListener('click', async () => {
                    const payload = getPayloadFn();
                    if (!payload) {
                        Export._showToast('Ni veljavne vsebine za kopiranje.', 'error');
                        return;
                    }
                    try {
                        await navigator.clipboard.writeText(payload);
                        const labelSpan = copyBtn.querySelector('span');
                        const originalText = labelSpan ? labelSpan.textContent : '';
                        if (labelSpan) labelSpan.textContent = 'Kopirano!';
                        setTimeout(() => {
                            if (labelSpan) labelSpan.textContent = originalText;
                        }, 2000);
                    } catch (err) {
                        console.error('Clipboard copy failed:', err);
                    }
                });
            }
        };

        setupInspector('btn-toggle-upn-inspect', 'upn-qr-inspect', 'btn-close-upn-inspect', 'btn-copy-upn-raw', () => QR.payload);
        setupInspector('btn-toggle-epc-inspect', 'epc-qr-inspect', 'btn-close-epc-inspect', 'btn-copy-epc-raw', () => EPCQR.payload);

        // Prepreči, da bi klik na besedilo oznake (<label>) znotraj sprožil <button popovertarget>
        document.addEventListener('click', (e) => {
            const label = e.target.closest('label');
            if (label && !e.target.closest('.info-btn')) {
                const infoBtn = label.querySelector('.info-btn[popovertarget]');
                if (infoBtn) {
                    const popId = infoBtn.getAttribute('popovertarget');
                    const pop = popId ? document.getElementById(popId) : null;
                    if (pop && pop.matches(':popover-open')) {
                        pop.hidePopover();
                    }
                }
            }
        });

        // Private Mode Toggle
        const privateBtn = document.getElementById('private-mode-toggle');
        if (privateBtn) {
            const updatePrivateBtnUI = (isPriv) => {
                privateBtn.classList.toggle('active', isPriv);
                privateBtn.setAttribute('aria-pressed', isPriv ? 'true' : 'false');
                const label = privateBtn.querySelector('.private-mode-label');
                if (label) {
                    label.textContent = isPriv ? 'Zasebno (vklopljeno)' : 'Zasebno';
                }
            };

            updatePrivateBtnUI(Storage.isPrivate());

            privateBtn.addEventListener('click', () => {
                const nextState = !Storage.isPrivate();
                Storage.setPrivate(nextState);
                updatePrivateBtnUI(nextState);
                if (nextState) {
                    Export._showToast('Zasebni način vklopljen: podatki se ne shranjujejo v brskalnik.', 'success');
                } else {
                    Storage.save(Store);
                    Export._showToast('Zasebni način izklopljen: samodejno shranjevanje je aktivno.', 'success');
                }
            });
        }

        // Theme Toggle
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const body = document.body;
                const isDark = body.classList.toggle('dark-theme');
                const sunIcon = themeBtn.querySelector('.sun-icon');
                const moonIcon = themeBtn.querySelector('.moon-icon');

                Store.mode = isDark ? 'dark' : 'light';
                localStorage.setItem('upn_studio_theme', Store.mode);
                Storage.save(Store);

                if (sunIcon) sunIcon.style.display = isDark ? 'block' : 'none';
                if (moonIcon) moonIcon.style.display = isDark ? 'none' : 'block';
            });
        }

        // IBAN Copy
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.copyTarget;
                const input = document.getElementById(targetId);
                if (!input || !input.value) return;

                navigator.clipboard.writeText(input.value).then(() => {
                    btn.classList.add('success');
                    setTimeout(() => btn.classList.remove('success'), 1500);
                });
            });
        });

        // Magic Wand - Smart Calculation
        document.querySelectorAll('.magic-wand-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.magicTarget;
                const input = document.getElementById(targetId);
                const bindBase = targetId === 'payerRef' ? 'payerRef' : 'recipientRef';
                const modelSelect = document.querySelector(`[data-bind="${bindBase}Code"]`);

                if (!input || !modelSelect) return;

                const model = modelSelect.value;
                const rawValue = input.value.trim();

                if (model.startsWith('SI')) {
                    const generated = Validator.buildSIReference(model.substring(2), rawValue);
                    if (generated === null) return;
                    input.value = generated;
                } else if (model === 'RF') {
                    const generated = Validator.buildRFReference(rawValue);
                    if (generated === null) return;
                    input.value = generated;
                }

                this._handleChange(input);
            });
        });

        // Reset Form
        const resetBtn = document.getElementById('reset-form');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Ali ste prepričani, da želite počistiti celoten obrazec?')) {
                    this._resetLogic();
                }
            });
        }
    },

    _resetLogic() {
        console.log('UPN QR Studio: Resetting form.');

        this._touchedFields.clear();

        const currentMode = Store.mode;

        Object.keys(Store).forEach(key => {
            if (typeof Store[key] === 'boolean') {
                Store[key] = false;
            } else {
                Store[key] = '';
            }
        });

        Store.mode = currentMode;
        localStorage.removeItem(Storage.KEY);
        Storage.save({ mode: currentMode });

        this.init();

        document.querySelectorAll('[data-bind]').forEach(el => {
            const key = el.dataset.bind;
            if (el.type === 'checkbox') {
                el.checked = !!Store[key];
            } else {
                el.value = Store[key] || '';
            }
        });

        this._validateUI();
    },

    /**
     * Handles mutual exclusivity of Polog/Dvig/Humanitarno checkboxes
     * and then applies field enable/disable rules.
     */
    _handleCheckboxExclusion(changedKey) {
        const exclusiveKeys = ['polog', 'dvig', 'humanitarno'];

        // If the user just checked one of these, uncheck the others
        if (exclusiveKeys.includes(changedKey) && Store[changedKey]) {
            exclusiveKeys.forEach(key => {
                if (key !== changedKey) {
                    Store[key] = false;
                    const el = document.querySelector(`[data-bind="${key}"]`);
                    if (el) el.checked = false;
                }
            });
        }

        if (changedKey === 'humanitarno' && Store.humanitarno) {
            this._touchedFields.add('recipientRef');
            ['dueDate', 'payerName', 'payerAddress', 'payerCity'].forEach(key => {
                Store[key] = '';
                const field = document.querySelector(`[data-bind="${key}"]`);
                if (field) field.value = '';
                this._touchedFields.delete(key);
            });
            if (!Store.purpose || !Store.purpose.trim()) {
                Store.purpose = 'DONACIJA';
                const purposeField = document.querySelector('[data-bind="purpose"]');
                if (purposeField) purposeField.value = 'DONACIJA';
            }
            if (!Store.purposeCode || Store.purposeCode === 'GDSV') {
                Store.purposeCode = 'CHAR';
                const purposeCodeField = document.querySelector('[data-bind="purposeCode"]');
                if (purposeCodeField) purposeCodeField.value = 'CHAR';
            }
        }

        this._applyFieldRules();
    },

    /**
     * Applies enable/disable and visual rules to form fields
     * based on the derived transaction mode.
     */
    _applyFieldRules() {
        const m = this._deriveMode();
        const urgencyHint = document.getElementById('urgency-mode-hint');
        if (urgencyHint) {
            const urgencyRestrictions = {
                polog: 'Oznake »Nujno« po navodilih ZBS ni dovoljeno uporabiti pri pologu gotovine.',
                dvig: 'Oznake »Nujno« po navodilih ZBS ni dovoljeno uporabiti pri dvigu gotovine.',
                humanitarno: 'Oznake »Nujno« po navodilih ZBS ni dovoljeno uporabiti pri humanitarnem nalogu.'
            };
            urgencyHint.textContent = urgencyRestrictions[m] || '';
            urgencyHint.hidden = !urgencyHint.textContent;
        }

        const setFieldState = (key, forbidden) => {
            const el = document.querySelector(`[data-bind="${key}"]`);
            if (!el) return;

            if (forbidden) {
                el.disabled = true;
                el.parentElement.style.opacity = '0.5';
                if (el.type === 'checkbox') {
                    // Don't clear the mode-defining checkboxes themselves
                    if (key !== 'polog' && key !== 'dvig' && key !== 'humanitarno') {
                        Store[key] = false;
                        el.checked = false;
                    }
                } else {
                    Store[key] = '';
                    el.value = '';
                }
            } else {
                el.disabled = false;
                el.parentElement.style.opacity = '1';
            }
        };

        // Reset: enable everything first (checkboxes stay as-is)
        ['payerIban', 'payerRefCode', 'payerRef', 'nujno', 'recipientIban',
            'recipientRefCode', 'recipientRef', 'recipientName', 'recipientAddress',
            'recipientCity', 'dueDate', 'paymentDate'].forEach(key => {
                setFieldState(key, false);
            });

        // Apply mode-specific restrictions
        if (m === 'humanitarno') {
            setFieldState('payerIban', true);
            setFieldState('payerRefCode', true);
            setFieldState('payerRef', true);
            setFieldState('paymentDate', true);
            setFieldState('nujno', true);
        } else if (m === 'polog') {
            setFieldState('payerIban', true);
            setFieldState('payerRefCode', true);
            setFieldState('payerRef', true);
            setFieldState('nujno', true);
            setFieldState('dueDate', true);
        } else if (m === 'dvig') {
            setFieldState('recipientIban', true);
            setFieldState('recipientRefCode', true);
            setFieldState('recipientRef', true);
            setFieldState('nujno', true);
            setFieldState('dueDate', true);
        }
        // 'placilo' = default, nothing extra disabled

        const paymentDateField = document.getElementById('payment-date-field');
        if (paymentDateField) paymentDateField.hidden = m === 'humanitarno';
        this._syncRefInputState('payerRefCode');
        this._syncRefInputState('recipientRefCode');

        const humanitarianReferenceHint = document.getElementById('humanitarian-reference-hint');
        if (humanitarianReferenceHint) humanitarianReferenceHint.hidden = m !== 'humanitarno';

        this._updateBadges(m);
    },

    /**
     * Updates "optional/mandatory/forbidden" labels based on transaction mode.
     * Declarative config: for each badge, define state per mode.
     * States: 'mandatory' | 'optional' | 'forbidden' | null (hidden)
     */
    _updateBadges(mode) {
        const badgeConfig = {
            'badge-payer-name': {
                placilo: 'mandatory', polog: 'optional', dvig: 'mandatory', humanitarno: 'optional'
            },
            'badge-payer-address': {
                placilo: 'mandatory', polog: 'optional', dvig: 'mandatory', humanitarno: 'optional'
            },
            'badge-payer-city': {
                placilo: 'mandatory', polog: 'optional', dvig: 'mandatory', humanitarno: 'optional'
            },
            'badge-payer-ref': {
                placilo: 'optional', polog: 'forbidden', dvig: 'optional', humanitarno: 'forbidden'
            },
            'badge-payer-iban': {
                placilo: 'optional', polog: 'forbidden', dvig: 'mandatory', humanitarno: 'forbidden'
            },
            'badge-recipient-iban': {
                placilo: 'mandatory', polog: 'mandatory', dvig: 'forbidden', humanitarno: 'mandatory'
            },
            'badge-recipient-name': {
                placilo: 'mandatory', polog: 'mandatory', dvig: 'optional', humanitarno: 'mandatory'
            },
            'badge-recipient-address': {
                placilo: 'mandatory', polog: 'mandatory', dvig: 'optional', humanitarno: 'mandatory'
            },
            'badge-recipient-city': {
                placilo: 'mandatory', polog: 'mandatory', dvig: 'optional', humanitarno: 'mandatory'
            },
            'badge-recipient-ref': {
                placilo: 'optional', polog: 'optional', dvig: 'forbidden', humanitarno: 'mandatory'
            },
            'badge-amount': {
                placilo: 'mandatory', polog: 'mandatory', dvig: 'mandatory', humanitarno: 'optional'
            },
            'badge-payment-date': {
                placilo: 'optional', polog: 'mandatory', dvig: 'mandatory', humanitarno: 'forbidden'
            },
            'badge-due-date': {
                placilo: 'optional', polog: 'forbidden', dvig: 'forbidden', humanitarno: 'optional'
            },
            'badge-purpose': {
                placilo: 'mandatory', polog: 'mandatory', dvig: 'mandatory', humanitarno: 'mandatory'
            },
            'badge-purpose-code': {
                placilo: 'mandatory', polog: 'mandatory', dvig: 'mandatory', humanitarno: 'mandatory'
            }
        };

        if (mode !== 'dvig' && (Store.recipientIban || '').replace(/\s/g, '').startsWith('SI5601')) {
            badgeConfig['badge-recipient-ref'][mode] = 'mandatory';
        }

        const labels = {
            mandatory: 'obvezno',
            optional: 'neobvezno',
            forbidden: 'prepovedano'
        };

        Object.entries(badgeConfig).forEach(([id, states]) => {
            const badge = document.getElementById(id);
            if (!badge) return;

            const state = states[mode] || 'optional';

            // Reset classes
            badge.classList.remove('badge-mandatory', 'badge-forbidden');
            badge.innerText = labels[state] || 'neobvezno';

            if (state === 'mandatory') {
                badge.classList.add('badge-mandatory');
            } else if (state === 'forbidden') {
                badge.classList.add('badge-forbidden');
            }
        });
    },

    _handleChange(target) {
        const bindKey = target.dataset.bind;
        if (!bindKey) return;

        let value;
        if (target.type === 'checkbox') {
            value = target.checked;
        } else {
            value = target.value;
        }

        if (target.dataset.uppercase === 'true' && typeof value === 'string') {
            value = value.toUpperCase();
        }

        if (typeof value === 'string' && ['payerRef', 'recipientRef'].includes(bindKey)) {
            const codeKey = `${bindKey}Code`;
            const codeField = document.querySelector(`[data-bind="${codeKey}"]`);
            const text = value.trim().toUpperCase();
            const prefix = text.match(/^(SI\d{2}|RF)/)?.[1] || '';
            const selectedCode = Store[codeKey] || '';

            if (prefix && codeField) {
                const option = Array.from(codeField.options).find(item => item.value === prefix && !item.disabled);
                if (option) {
                    if (selectedCode !== prefix) {
                        codeField.value = prefix;
                        Store[codeKey] = prefix;
                        this._syncRefInputState(codeKey);
                        this._touchedFields.add(codeKey);
                    }
                    value = text.slice(prefix.length).trim();
                }
            }
        }

        if (typeof value === 'string' && target.value !== value) {
            target.value = value;
        }

        Store[bindKey] = value;

        // Označi polje kot touched — uporabnik ga je urejal
        this._touchedFields.add(bindKey);

        if (bindKey === 'recipientIban' && (value || '').replace(/\s/g, '').startsWith('SI5601')) {
            this._touchedFields.add('recipientRef');
        }

        // If a mode-defining checkbox changed, handle exclusivity
        if (['polog', 'dvig', 'humanitarno'].includes(bindKey)) {
            this._handleCheckboxExclusion(bindKey, value);
        }

        // If a reference model select changed, sync the ref input state
        if (bindKey === 'payerRefCode' || bindKey === 'recipientRefCode') {
            this._syncRefInputState(bindKey);
        }

        this._validateUI();
    },

    /**
     * Disables the reference input when SI99 is selected (no data allowed),
     * enables it otherwise.
     */
    _syncRefInputState(codeKey) {
        const refKey = codeKey === 'payerRefCode' ? 'payerRef' : 'recipientRef';
        const refEl = document.querySelector(`[data-bind="${refKey}"]`);
        if (!refEl) return;

        const code = (Store[codeKey] || '').toUpperCase();
        const mode = this._deriveMode();

        if ((codeKey === 'payerRefCode' && ['polog', 'humanitarno'].includes(mode)) ||
            (codeKey === 'recipientRefCode' && mode === 'dvig')) {
            refEl.disabled = true;
            return;
        }

        if (code === 'SI99') {
            refEl.disabled = true;
            refEl.value = '';
            Store[refKey] = '';
            refEl.placeholder = 'Ni sklica (SI99)';
        } else if (code === '') {
            refEl.disabled = false;
            refEl.value = '';
            Store[refKey] = '';
            refEl.placeholder = 'Številka sklica';
        } else {
            refEl.disabled = false;
            refEl.placeholder = 'Številka sklica';
        }
    },

    _hasErrors() {
        return Validator.validateForm(Store).length > 0 || !!QR.error;
    },

    /**
     * Označi vsa polja kot touched (ob kliku na izvoz / submit).
     * Po tem se prikažejo VSE napake, ne le za urejana polja.
     */
    _markAllTouched() {
        this._showAllValidationErrors = true;
        document.querySelectorAll('[data-bind]').forEach(el => {
            this._touchedFields.add(el.dataset.bind);
        });
        this._validateUI();
    },

    _validateUI() {
        this._updateBadges(this._deriveMode());

        document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
        document.querySelectorAll('.is-valid').forEach(el => el.classList.remove('is-valid'));
        document.querySelectorAll('.error-msg').forEach(el => el.remove());

        const errors = Validator.validateForm(Store);

        const mode = this._deriveMode();
        const missingHumanitarianReference = err =>
            mode === 'humanitarno' &&
            err.field === 'recipientRef' &&
            (!Store.recipientRefCode || !Store.recipientRef);
        const visibleErrors = errors.filter(err =>
            this._touchedFields.has(err.field) &&
            (this._showAllValidationErrors || !missingHumanitarianReference(err))
        );

        const warnBox = document.getElementById('global-warning-box');
        const warnList = document.getElementById('global-warning-list');

        if (visibleErrors.length > 0) {
            if (warnBox) warnBox.classList.remove('hidden');
            if (warnList) warnList.innerHTML = '';

            // Check if any error is a reference check-digit failure
            const hasRefError = visibleErrors.some(err => (err.field === 'payerRef' || err.field === 'recipientRef') && err.msg.toLowerCase().includes('kontroln'));

            visibleErrors.forEach(err => {
                if (warnList) {
                    const li = document.createElement('li');

                    if ((err.field === 'payerRef' || err.field === 'recipientRef') && err.msg.toLowerCase().includes('kontroln')) {
                        const strong = document.createElement('strong');
                        strong.textContent = err.msg;
                        li.appendChild(strong);
                        const span = document.createElement('span');
                        span.innerHTML = ' — Kliknite na gumb za <strong>izračun kontrolne številke</strong> (ikona čarobne palčke) ob polju za samodejni popravek.';
                        li.appendChild(span);
                    } else {
                        li.textContent = err.msg;
                    }
                    warnList.appendChild(li);
                }

                // Highlight field — samo touched polja
                const el = document.querySelector(`[data-bind="${err.field}"]`);
                if (el) {
                    el.classList.add('has-error');

                    let targetElement = el;
                    if (el.parentElement && (el.parentElement.classList.contains('ref-inline') || el.parentElement.classList.contains('input-wrapper'))) {
                        targetElement = el.parentElement;
                        targetElement.classList.add('has-error');
                    }

                    let msgDiv = targetElement.nextElementSibling;
                    if (!msgDiv || !msgDiv.classList.contains('error-msg')) {
                        msgDiv = document.createElement('div');
                        msgDiv.className = 'error-msg';
                        targetElement.parentNode.insertBefore(msgDiv, targetElement.nextSibling);
                    }
                    msgDiv.innerText = err.msg;
                }
            });

            // Show Magic Wand icons where relevant
            ['payerRef', 'recipientRef'].forEach(refField => {
                const wand = document.getElementById(`magic-wand-${refField === 'payerRef' ? 'payer' : 'recipient'}`);
                const modelSelect = document.querySelector(`[data-bind="${refField}Code"]`);
                const model = modelSelect?.value || '';
                const canCalculate = model === 'RF' || (model.startsWith('SI') && Validator.canBuildSIReference(model.substring(2)));
                const hasErr = visibleErrors.some(err => err.field === refField && err.msg.toLowerCase().includes('kontroln'));
                if (wand) wand.style.display = hasErr && canCalculate ? 'flex' : 'none';
            });

        } else {
            // Ni vidnih napak
            if (warnBox) warnBox.classList.add('hidden');

            // Hide all Magic Wand icons
            document.querySelectorAll('.magic-wand-btn').forEach(wand => {
                wand.style.display = 'none';
            });
        }

        // Clear QR string if invalid
        const container = document.querySelector('.qr-placeholder');
        if (errors.length > 0) {
            const qrMessage = errors.length === 1
                ? `QR ni veljaven: ${errors[0].msg}`
                : 'QR ni veljaven: preveri vsa polja.';
            if (container) {
                QR.showError(qrMessage);
            } else {
                QR.error = qrMessage;
            }
        } else {
            // Only generate QR if there are no errors
            const hasData = Object.values(Store).some(v => v && v.toString().trim() !== '');
            if (hasData) {
                QR.generate();
            }
        }
        EPCQR.generate();

        // Green validation for SI/RF references
        const checkValidRef = (bindKey) => {
            const el = document.querySelector(`[data-bind="${bindKey}"]`);
            if (el && !el.disabled) {
                const val = Store[bindKey] || '';
                const code = Store[bindKey + 'Code'] || '';
                const full = (code + val).toUpperCase();
                if (full.startsWith('SI') || full.startsWith('RF')) {
                    const hasErr = errors.some(err => err.field === bindKey);
                    // Only mark green if there is no error on this field specifically
                    if (!hasErr && val.trim().length > 0) {
                        el.classList.add('is-valid');
                    }
                }
            }
        };
        checkValidRef('payerRef');
        checkValidRef('recipientRef');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .catch(error => console.error('ServiceWorker registration failed:', error));
    }
});
