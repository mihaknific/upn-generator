const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_RECORDS = 500;

const FIELD_ALIASES = new Map();

function normalizeHeader(value) {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
}

function addFieldAliases(field, aliases = []) {
    [field, ...aliases].forEach(alias => FIELD_ALIASES.set(normalizeHeader(alias), field));
}

addFieldAliases('mode', ['tip', 'tipNaloga', 'vrstaNaloga', 'vrsta']);
addFieldAliases('payerName', ['imePlacnika', 'placnik', 'payer']);
addFieldAliases('payerAddress', ['naslovPlacnika', 'ulicaPlacnika']);
addFieldAliases('payerCity', ['krajPlacnika', 'postaInKrajPlacnika', 'postnaStevilkaInKrajPlacnika']);
addFieldAliases('payerIban', ['ibanPlacnika']);
addFieldAliases('payerRefCode', ['modelPlacnika', 'referencaPlacnikaModel']);
addFieldAliases('payerRef', ['sklicPlacnika', 'referencaPlacnika']);
addFieldAliases('amount', ['znesek', 'vsota']);
addFieldAliases('currency', ['valuta']);
addFieldAliases('paymentDate', ['datumPlacila']);
addFieldAliases('dueDate', ['rokPlacila', 'datumZapadlosti']);
addFieldAliases('polog', ['deposit']);
addFieldAliases('dvig', ['withdrawal']);
addFieldAliases('humanitarno', ['humanitarni', 'humanitarian']);
addFieldAliases('nujno', ['urgent', 'nujnoPlacilo']);
addFieldAliases('purposeCode', ['kodaNamena', 'namenKoda']);
addFieldAliases('purpose', ['namen', 'namenPlacila']);
addFieldAliases('recipientName', ['imePrejemnika', 'prejemnik']);
addFieldAliases('recipientAddress', ['naslovPrejemnika', 'ulicaPrejemnika']);
addFieldAliases('recipientCity', ['krajPrejemnika', 'postaInKrajPrejemnika', 'postnaStevilkaInKrajPrejemnika']);
addFieldAliases('recipientIban', ['ibanPrejemnika']);
addFieldAliases('recipientRefCode', ['modelPrejemnika', 'referencaPrejemnikaModel']);
addFieldAliases('recipientRef', ['sklicPrejemnika', 'referencaPrejemnika']);

const TEXT_FIELDS = [
    'payerName', 'payerAddress', 'payerCity', 'payerIban', 'payerRefCode', 'payerRef',
    'amount', 'currency', 'paymentDate', 'dueDate', 'purposeCode', 'purpose',
    'recipientName', 'recipientAddress', 'recipientCity', 'recipientIban',
    'recipientRefCode', 'recipientRef'
];
const BOOLEAN_FIELDS = ['polog', 'dvig', 'humanitarno', 'nujno'];
const MODE_FLAGS = {
    placilo: { polog: false, dvig: false, humanitarno: false },
    polog: { polog: true, dvig: false, humanitarno: false },
    dvig: { polog: false, dvig: true, humanitarno: false },
    humanitarno: { polog: false, dvig: false, humanitarno: true }
};

function parseCsvRows(text, delimiter) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let index = 0; index < text.length; index++) {
        const character = text[index];

        if (quoted) {
            if (character === '"') {
                if (text[index + 1] === '"') {
                    cell += '"';
                    index++;
                } else {
                    quoted = false;
                }
            } else {
                cell += character;
            }
            continue;
        }

        if (character === '"' && cell.length === 0) {
            quoted = true;
        } else if (character === '"') {
            throw new Error('CSV vsebuje narekovaj na nepričakovanem mestu.');
        } else if (character === delimiter) {
            row.push(cell);
            cell = '';
        } else if (character === '\n') {
            row.push(cell);
            if (row.some(value => value.trim() !== '')) rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += character;
        }
    }

    if (quoted) throw new Error('CSV vsebuje nedokončano besedilo v narekovajih.');
    if (cell.length > 0 || row.length > 0) {
        row.push(cell);
        if (row.some(value => value.trim() !== '')) rows.push(row);
    }
    return rows;
}

function detectDelimiter(text) {
    const counts = new Map([[';', 0], [',', 0], ['\t', 0]]);
    let quoted = false;

    for (let index = 0; index < text.length && text[index] !== '\n'; index++) {
        const character = text[index];
        if (character === '"') {
            if (quoted && text[index + 1] === '"') index++;
            else quoted = !quoted;
        } else if (!quoted && counts.has(character)) {
            counts.set(character, counts.get(character) + 1);
        }
    }

    return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}

function mapHeaders(headers) {
    const fields = [];
    const seen = new Set();

    headers.forEach((header, index) => {
        const normalized = normalizeHeader(header.replace(/^\uFEFF/, '').trim());
        const field = FIELD_ALIASES.get(normalized);
        if (!field) {
            throw new Error(`Neznan stolpec "${header}". Preverite imena stolpcev v vzorčni datoteki.`);
        }
        if (seen.has(field)) {
            throw new Error(`Stolpec za polje "${field}" je naveden več kot enkrat.`);
        }
        seen.add(field);
        fields[index] = field;
    });

    return fields;
}

function localToday() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeBoolean(value, field, recordNumber) {
    if (typeof value === 'boolean') return value;
    const normalized = String(value ?? '').trim().toLowerCase();
    if (['', '0', 'false', 'ne', 'no'].includes(normalized)) return false;
    if (['1', 'true', 'da', 'yes', 'x'].includes(normalized)) return true;
    throw new Error(`Nalog ${recordNumber}: polje "${field}" mora biti da/ne, true/false, 1/0 ali X.`);
}

function normalizeDate(value) {
    const date = String(value ?? '').trim();
    const localized = date.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (localized) {
        return `${localized[3]}-${localized[2].padStart(2, '0')}-${localized[1].padStart(2, '0')}`;
    }
    return date;
}

function normalizeMode(value, recordNumber) {
    const mode = normalizeHeader(value);
    const aliases = {
        placilo: 'placilo',
        payment: 'placilo',
        polog: 'polog',
        deposit: 'polog',
        dvig: 'dvig',
        withdrawal: 'dvig',
        humanitarno: 'humanitarno',
        humanitarni: 'humanitarno',
        humanitarian: 'humanitarno'
    };
    if (!aliases[mode]) {
        throw new Error(`Nalog ${recordNumber}: neznan tip naloga "${value}". Dovoljeni so placilo, polog, dvig in humanitarno.`);
    }
    return aliases[mode];
}

function normalizeRecord(input, recordNumber) {
    const record = Object.fromEntries(TEXT_FIELDS.map(field => [field, '']));
    BOOLEAN_FIELDS.forEach(field => { record[field] = false; });
    record.currency = 'EUR';

    for (const [field, value] of Object.entries(input)) {
        if (field === 'mode') continue;
        if (BOOLEAN_FIELDS.includes(field)) {
            record[field] = normalizeBoolean(value, field, recordNumber);
            continue;
        }
        if (!TEXT_FIELDS.includes(field)) {
            throw new Error(`Nalog ${recordNumber}: nepričakovano polje "${field}".`);
        }
        if (value !== null && typeof value === 'object') {
            throw new Error(`Nalog ${recordNumber}: polje "${field}" mora vsebovati besedilo ali število.`);
        }
        const text = String(value ?? '').trim();
        record[field] = field === 'paymentDate' || field === 'dueDate'
            ? normalizeDate(text)
            : text;
    }

    if (record.purposeCode) record.purposeCode = record.purposeCode.toUpperCase();
    if (Object.hasOwn(input, 'mode') && String(input.mode ?? '').trim() !== '') {
        const mode = normalizeMode(input.mode, recordNumber);
        const flags = MODE_FLAGS[mode];
        for (const field of Object.keys(flags)) {
            if (Object.hasOwn(input, field) && record[field] !== flags[field]) {
                throw new Error(`Nalog ${recordNumber}: "mode" in polje "${field}" si nasprotujeta.`);
            }
            record[field] = flags[field];
        }
    }

    if (record.humanitarno) {
        for (const field of ['payerName', 'payerAddress', 'payerCity']) {
            if (record[field]) {
                throw new Error(`Nalog ${recordNumber}: pri humanitarnem nalogu polje "${field}" ne sme biti izpolnjeno.`);
            }
        }
        if (!Object.hasOwn(input, 'purposeCode')) record.purposeCode = 'CHAR';
        if (!Object.hasOwn(input, 'purpose')) record.purpose = 'DONACIJA';
    }

    if (!Object.hasOwn(input, 'paymentDate')) {
        record.paymentDate = record.humanitarno ? '' : localToday();
    }

    return record;
}

function normalizeObjectKeys(source, recordNumber) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        throw new Error(`Nalog ${recordNumber} mora biti objekt s poimenovanimi polji.`);
    }
    const input = {};
    for (const [key, value] of Object.entries(source)) {
        const field = FIELD_ALIASES.get(normalizeHeader(key));
        if (!field) throw new Error(`Nalog ${recordNumber}: neznano polje "${key}".`);
        if (Object.hasOwn(input, field)) {
            throw new Error(`Nalog ${recordNumber}: polje "${field}" je navedeno več kot enkrat.`);
        }
        input[field] = value;
    }
    return input;
}

function checkRecordCount(records) {
    if (records.length === 0) throw new Error('Datoteka ne vsebuje nobenega naloga.');
    if (records.length > MAX_RECORDS) {
        throw new Error(`Datoteka vsebuje ${records.length} nalogov; največje dovoljeno število je ${MAX_RECORDS}.`);
    }
}

function parseCsv(text) {
    const normalizedText = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const rows = parseCsvRows(normalizedText, detectDelimiter(normalizedText));
    if (rows.length < 2) throw new Error('CSV mora vsebovati vrstico z imeni stolpcev in vsaj en nalog.');
    if (rows.length - 1 > MAX_RECORDS) {
        throw new Error(`Datoteka vsebuje več kot ${MAX_RECORDS} nalogov; največje dovoljeno število je ${MAX_RECORDS}.`);
    }
    const fields = mapHeaders(rows[0]);
    const records = [];

    rows.slice(1).forEach((row, index) => {
        if (row.length !== fields.length) {
            throw new Error(`CSV vrstica ${index + 2} ima ${row.length} vrednosti, pričakovanih pa je ${fields.length}.`);
        }
        const input = {};
        fields.forEach((field, fieldIndex) => { input[field] = row[fieldIndex]; });
        records.push(normalizeRecord(input, index + 1));
    });
    checkRecordCount(records);
    return records;
}

function parseJson(text) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        throw new Error(`JSON ni veljaven: ${error.message}`);
    }

    const source = Array.isArray(parsed) ? parsed : parsed?.nalogi;
    if (!Array.isArray(source)) {
        throw new Error('JSON mora biti seznam objektov ali objekt z lastnostjo "nalogi", ki vsebuje seznam.');
    }
    checkRecordCount(source);
    return source.map((record, index) =>
        normalizeRecord(normalizeObjectKeys(record, index + 1), index + 1)
    );
}

export const BatchImport = {
    MAX_FILE_BYTES,
    MAX_RECORDS,

    parseText(text, format) {
        if (typeof text !== 'string' || text.trim() === '') {
            throw new Error('Datoteka je prazna.');
        }
        if (format === 'json') return parseJson(text);
        if (format === 'csv') return parseCsv(text);
        throw new Error('Podprti sta samo datoteki CSV in JSON.');
    }
};
