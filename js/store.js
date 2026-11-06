import { Render } from './render.js';
import { Storage } from './storage.js';

export const Store = new Proxy({
    payerName: '',
    payerAddress: '',
    payerCity: '',
    payerIban: '',
    amount: '',
    purposeCode: '',
    purpose: '',
    recipientName: '',
    recipientAddress: '',
    recipientCity: '',
    recipientIban: '',
    recipientRefCode: '',
    recipientRef: '',
    payerRefCode: '',
    payerRef: '',
    paymentDate: '',
    dueDate: '',
    polog: false,
    dvig: false,
    humanitarno: false,
    nujno: false,
    currency: 'EUR',
    epcBic: '',
    epcInformation: '',
    mode: ''
}, {
    set(target, prop, value) {
        if (target[prop] === value) return true;

        target[prop] = value;
        Storage.scheduleSave(target);

        requestAnimationFrame(() => {
            Render.updateField(prop, value);
        });
        return true;
    }
});
