import { Utils } from './utils.js';

export const Render = {
    updateField(fieldId, value) {
        const elements = document.querySelectorAll(`[data-field="${fieldId}"]`);

        // Composite update trigger for .a10 (Left part - Recipient)
        if (fieldId === 'recipientIban' || fieldId === 'recipientRef' || fieldId === 'recipientRefCode') {
            const iban = document.querySelector('[data-bind="recipientIban"]')?.value || '';
            const refCode = document.querySelector('[data-bind="recipientRefCode"]')?.value || '';
            const ref = document.querySelector('[data-bind="recipientRef"]')?.value || '';
            const composite = `${iban}\n${refCode}${ref}`;
            this.updateField('recipientComposite', composite);
        }

        // Composite update trigger for .a5 (Left part - Purpose + Due Date)
        if (fieldId === 'purpose' || fieldId === 'dueDate') {
            const purpose = document.querySelector('[data-bind="purpose"]')?.value || '';
            const dueDateValue = document.querySelector('[data-bind="dueDate"]')?.value || '';
            let dateStr = '';
            if (dueDateValue && dueDateValue.includes('-')) {
                const p = dueDateValue.split('-');
                dateStr = `${p[2]}.${p[1]}.${p[0]}`;
            } else {
                dateStr = dueDateValue || '';
            }
            const composite = `${purpose}${purpose && dateStr ? ', ' : ''}${dateStr}`;
            this.updateField('purposeComposite', composite);
        }

        // Composite update trigger for .a3 (Left part - Payer)
        if (fieldId === 'payerName' || fieldId === 'payerAddress' || fieldId === 'payerCity') {
            const name = document.querySelector('[data-bind="payerName"]')?.value || '';
            const addr = document.querySelector('[data-bind="payerAddress"]')?.value || '';
            const city = document.querySelector('[data-bind="payerCity"]')?.value || '';
            const composite = `${name}\n${addr}\n${city}`;
            this.updateField('payerComposite', composite);
        }

        if (fieldId === 'recipientName' || fieldId === 'recipientAddress' || fieldId === 'recipientCity') {
            const name = document.querySelector('[data-bind="recipientName"]')?.value || '';
            const addr = document.querySelector('[data-bind="recipientAddress"]')?.value || '';
            const city = document.querySelector('[data-bind="recipientCity"]')?.value || '';
            this.updateField('recipientDetails', `${name}\n${addr}\n${city}`);
        }

        elements.forEach(el => {
            let displayValue = value || '';

            // Handle functional formatting
            if (fieldId === 'amount') {
                displayValue = Utils.formatAmountForDisplay(value);
            } else if (fieldId === 'recipientIban' || fieldId === 'payerIban' || fieldId === 'recipientRef' || fieldId === 'recipientRefCode' || fieldId === 'payerRef' || fieldId === 'payerRefCode') {
                displayValue = (value || '').toString().replace(/\s/g, '');
            } else if (fieldId === 'dueDate' || fieldId === 'paymentDate') {
                if (value && value.includes('-')) {
                    const p = value.split('-');
                    displayValue = `${p[2]}.${p[1]}.${p[0]}`;
                }
            }

            if (el.dataset.uppercase === 'true') {
                displayValue = displayValue.toUpperCase();
            }

            // Checkbox handling (X character)
            if (typeof value === 'boolean' || el.classList.contains('field-x')) {
                el.textContent = value === true ? 'X' : '';
                return;
            }

            const hasBlocks = el.querySelector('.blocks') !== null;
            const alwaysGridFields = ['a44', 'a27', 'a28', 'a50', 'a51', 'a43'];
            const isSpecificGridElement = alwaysGridFields.some(cls => el.classList.contains(cls));

            const isGrid = (hasBlocks || isSpecificGridElement) && el.classList.contains('field');

            let textLayer = el.querySelector('.text-layer');

            if (isGrid) {
                if (!textLayer) {
                    textLayer = document.createElement('div');
                    textLayer.className = 'text-layer';
                    Object.assign(textLayer.style, {
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        zIndex: '100',
                        pointerEvents: 'none'
                    });
                    el.appendChild(textLayer);
                } else {
                    textLayer.innerHTML = '';
                    textLayer.style.zIndex = '100';
                    textLayer.style.overflow = 'visible';
                }

                textLayer.style.display = 'flex';

                if (el.dataset.align === 'right' || fieldId === 'amount') {
                    textLayer.style.justifyContent = 'flex-end';
                } else {
                    textLayer.style.justifyContent = 'flex-start';
                }

                const chars = displayValue.toString().split('');
                chars.forEach(char => {
                    const charDiv = document.createElement('div');

                    if (char === '.' || char === ',') {
                        // Perfect centering: zero-width flex container centers content on the boundary line
                        charDiv.style.width = '0';
                        charDiv.style.position = 'relative';
                        charDiv.style.overflow = 'visible';
                        charDiv.style.display = 'flex';
                        charDiv.style.justifyContent = 'center';
                        charDiv.style.alignItems = 'center';
                        charDiv.style.zIndex = '5';
                    } else {
                        charDiv.style.width = '3.75mm';
                    }

                    charDiv.style.height = '100%';
                    charDiv.style.display = 'flex';
                    charDiv.style.alignItems = 'center'; /* Vertically centered */
                    charDiv.style.justifyContent = 'center';
                    charDiv.style.transform = 'translateX(-0.5px)'; // Optična korekcija Courier New pisave v levo
                    charDiv.style.fontFamily = "'Courier New', Courier, monospace";
                    charDiv.style.fontSize = "9pt";
                    charDiv.style.fontWeight = "bold";
                    charDiv.style.lineHeight = "1"; // Force consistent baseline
                    charDiv.textContent = char;
                    textLayer.appendChild(charDiv);
                });
            } else {
                const blocks = el.querySelector('.blocks');
                el.textContent = '';
                if (blocks) el.appendChild(blocks);

                // .upn-data elements (A31/A32/A55/A56) get styling from CSS class
                // .field elements need inline styles set here
                if (!el.classList.contains('upn-data')) {
                    Object.assign(el.style, {
                        fontFamily: "'Courier New', Courier, monospace",
                        fontSize: "9pt",
                        fontWeight: "bold",
                        whiteSpace: "pre-wrap",
                        overflow: "visible",
                        zIndex: "100",
                        textAlign: (el.dataset.align === 'right' || fieldId === 'amount') ? 'right' : 'left'
                    });

                    if (fieldId === 'recipientComposite' || fieldId === 'purposeComposite' || fieldId === 'payerComposite') {
                        el.style.lineHeight = "1.2";
                    }

                    if (['payerComposite', 'recipientComposite', 'recipientDetails'].includes(fieldId)) {
                        const computedStyle = getComputedStyle(el);
                        const horizontalPadding = parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight);
                        const availableWidth = el.clientWidth - horizontalPadding;
                        const longestLine = Math.max(...displayValue.toString().split('\n').map(line => line.length));
                        if (availableWidth > 0 && longestLine > 0) {
                            el.style.fontSize = `${Math.min(9, (availableWidth * 0.75) / (longestLine * 0.6))}pt`;
                        }
                    }
                }

                // Uporabi insertBefore namesto textContent, da ohranimo .blocks otroke
                if (['payerName', 'recipientName'].includes(fieldId)) {
                    const textValue = document.createElement('span');
                    textValue.className = 'field-text-value';
                    textValue.textContent = displayValue;
                    el.insertBefore(textValue, blocks || null);
                } else {
                    const textNode = document.createTextNode(displayValue);
                    el.insertBefore(textNode, blocks || null);
                }
            }
        });
    }
};
