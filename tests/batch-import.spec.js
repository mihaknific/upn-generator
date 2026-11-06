const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { PDFDocument } = require('../js/vendor/pdf-lib-1.17.1.min.js');

const validRecords = Array.from({ length: 4 }, (_, index) => ({
    payerName: `ANA NOVAK ${index + 1}`,
    payerAddress: 'CESTA 1',
    payerCity: '1000 LJUBLJANA',
    recipientName: 'PRIMER D.O.O.',
    recipientAddress: 'GLAVNA ULICA 1',
    recipientCity: '1000 LJUBLJANA',
    recipientIban: 'GB82WEST12345698765432',
    amount: `${index + 1},25`,
    purposeCode: 'GDSV',
    purpose: `PLACILO RACUNA ${index + 1}`
}));

const csvHeaders = [
    'amount', 'purpose', 'purposeCode', 'recipientIban', 'recipientCity',
    'recipientAddress', 'recipientName', 'payerCity', 'payerAddress', 'payerName'
];

function createCsv(records) {
    return [
        csvHeaders.join(';'),
        ...records.map(record => csvHeaders.map(header => record[header]).join(';'))
    ].join('\r\n');
}

async function importFile(page, name, content, mimeType) {
    await page.locator('#batch-file').setInputFiles({
        name,
        mimeType,
        buffer: Buffer.from(content, 'utf8')
    });
}

async function downloadPdf(page, testInfo) {
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-batch-export').click();
    const download = await downloadPromise;
    const path = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(path);
    const bytes = await fs.readFile(path);
    const pdf = await PDFDocument.load(bytes);
    const pageSizes = pdf.getPages().map(page => page.getSize());
    return { download, pageCount: pdf.getPageCount(), pageSizes };
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('paketni uvoz je prikazan pod razdelkom EPC QR', async ({ page }) => {
    const sectionOrder = await page.evaluate(() => {
        const epc = document.querySelector('.epc-qr-section');
        const batch = document.querySelector('.batch-import');
        return Boolean(epc && batch && (epc.compareDocumentPosition(batch) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(sectionOrder).toBe(true);
    const supportCards = page.locator('.footer-support-card');
    await expect(supportCards).toHaveCount(2);
    await expect(page.locator('.top-support-card')).toContainText('brezplačen in brez oglasov');
    await expect(page.locator('.top-support-card .support-btn')).toHaveAttribute(
        'href',
        'https://mihaknific.github.io/podpora'
    );
    await expect(page.locator('.top-support-card .support-btn')).toContainText('Podpri projekt');
    await expect(page.locator('footer .footer-support-card .support-btn')).toHaveCount(1);
});

test('prazno statusno polje je skrito in postavitev A4 je narisano', async ({ page }) => {
    const status = page.locator('#batch-status');
    await expect(status).toBeHidden();
    await expect(page.locator('#batch-layout-help')).toHaveCount(0);

    const layoutRow = await page.locator('.batch-layout-field').evaluate(element => ({
        gridColumn: getComputedStyle(element).gridColumn,
        width: element.getBoundingClientRect().width,
        controlsWidth: element.parentElement.getBoundingClientRect().width
    }));
    expect(layoutRow.gridColumn).toBe('1 / -1');
    expect(layoutRow.width).toBeCloseTo(layoutRow.controlsWidth, 0);

    const preview = page.locator('#batch-layout-preview');
    await expect(preview).toHaveAttribute('aria-label', 'Predogled: en UPN nalog na dnu lista A4');
    await expect(preview.locator('.layout-slips-one')).toBeVisible();
    await expect(preview.locator('.layout-slips-two')).toBeHidden();

    await page.locator('#batch-layout').selectOption('two');
    await expect(preview).toHaveAttribute('aria-label', 'Predogled: dva UPN naloga, zgoraj in spodaj na listu A4');
    await expect(preview.locator('.layout-slips-two')).toBeVisible();
    await expect(preview.locator('.layout-slips-one')).toBeHidden();

    await page.locator('#batch-layout').selectOption('three');
    await expect(preview).toHaveAttribute('aria-label', 'Predogled: trije UPN nalogi, en pod drugim na listu A4');
    await expect(preview.locator('.layout-slips-three')).toBeVisible();
});

test('spustno območje je veliko, dostopno in pokaže izbrane datoteke', async ({ page }) => {
    const fileInput = page.getByLabel('Datoteke CSV ali JSON');
    await expect(fileInput).toBeAttached();
    await expect(fileInput).toHaveAttribute('multiple', '');
    const dropzoneWidths = await page.locator('.batch-file-dropzone').evaluate(element => ({
        width: element.getBoundingClientRect().width,
        controlsWidth: element.closest('.batch-import-controls').getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
        fieldGridColumn: getComputedStyle(element.closest('.batch-import-field')).gridColumn
    }));
    expect(dropzoneWidths.width).toBeCloseTo(dropzoneWidths.controlsWidth, 0);
    expect(dropzoneWidths.fieldGridColumn).toBe('1 / -1');
    expect(dropzoneWidths.height).toBeGreaterThanOrEqual(176);
    await expect(page.locator('.batch-file-dropzone-content')).toContainText('Povlecite datoteke sem');
    await expect(page.locator('#batch-file-help')).toContainText('vse datoteke skupaj');
    await expect(page.locator('#batch-file-help')).toContainText('obdela v vašem brskalniku');
    await expect(page.locator('#batch-file-help')).toContainText('ne pošljejo na strežnik');

    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#batch-file-name').click();
    const chooser = await chooserPromise;
    expect(chooser.isMultiple()).toBe(true);
    await chooser.setFiles({
        name: 'primer-nalogov.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(createCsv([validRecords[0]]), 'utf8')
    });
    await expect(page.locator('#batch-file-name')).toHaveText('1 datoteka: primer-nalogov.csv');
});

test('več CSV/JSON datotek se združi v en predogled in en PDF', async ({ page }, testInfo) => {
    await page.locator('#batch-file').setInputFiles([
        {
            name: 'prvi.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(createCsv([validRecords[0]]), 'utf8')
        },
        {
            name: 'drugi.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify([validRecords[1]]), 'utf8')
        }
    ]);

    await expect(page.locator('#batch-status')).toContainText('2 naloga sta preverjena');
    await expect(page.locator('#batch-status')).toContainText('Združeni sta 2 datoteki');
    await expect(page.locator('#batch-preview-body tr')).toHaveCount(2);
    await expect(page.locator('#batch-file-name')).toContainText('2 datoteki: prvi.csv, drugi.json');
    await page.locator('#batch-layout').selectOption('three');
    const { pageCount } = await downloadPdf(page, testInfo);
    expect(pageCount).toBe(1);
});

test('spuščanje več datotek v območje uvoza jih prebere skupaj', async ({ page }) => {
    const firstCsv = createCsv([validRecords[0]]);
    const secondJson = JSON.stringify([validRecords[1]]);
    await page.locator('#batch-file-dropzone').evaluate((dropzone, files) => {
        const transfer = new DataTransfer();
        transfer.items.add(new File([files.firstCsv], 'prvi.csv', { type: 'text/csv' }));
        transfer.items.add(new File([files.secondJson], 'drugi.json', { type: 'application/json' }));
        dropzone.dispatchEvent(new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer
        }));
    }, { firstCsv, secondJson });

    await expect(page.locator('#batch-status')).toContainText('Združeni sta 2 datoteki');
    await expect(page.locator('#batch-preview-body tr')).toHaveCount(2);
});

test('napaka pri eni od več datotek pove ime datoteke in prepreči izvoz', async ({ page }) => {
    await page.locator('#batch-file').setInputFiles([
        {
            name: 'veljaven.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(createCsv([validRecords[0]]), 'utf8')
        },
        {
            name: 'napacen.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from('neznan_stolpec\nvrednost', 'utf8')
        }
    ]);

    await expect(page.locator('#batch-status')).toContainText('napacen.csv');
    await expect(page.locator('#batch-status')).toContainText('Neznan stolpec');
    await expect(page.locator('#btn-batch-export')).toBeDisabled();
    await expect(page.locator('#batch-preview')).toBeHidden();
});

test('CSV uvoz prepozna stolpce po imenih in ustvari tri-na-A4 PDF za 1 do 4 naloge', async ({ page }, testInfo) => {
    for (const count of [1, 2, 3, 4]) {
        await importFile(page, 'nalogi.csv', createCsv(validRecords.slice(0, count)), 'text/csv');
        await expect(page.locator('#batch-status')).toContainText(`${count}`);
        await expect(page.locator('#batch-status')).toContainText('Podatki ostanejo');
        await expect(page.locator('#btn-batch-export')).toBeEnabled();
        await page.locator('#batch-layout').selectOption('three');

        const { download, pageCount, pageSizes } = await downloadPdf(page, testInfo);
        expect(download.suggestedFilename()).toBe('upn-nalogi-uvoz.pdf');
        expect(pageCount).toBe(Math.ceil(count / 3));
        for (const size of pageSizes) {
            expect(size.width).toBeCloseTo(210 * 72 / 25.4, 1);
            expect(size.height).toBeCloseTo(297 * 72 / 25.4, 1);
        }
    }
});

test('dva naloga sta razporejena zgoraj in spodaj, s tremi enakimi praznimi odmiki', async ({ page }, testInfo) => {
    for (const count of [1, 2, 3]) {
        await importFile(page, 'nalogi.csv', createCsv(validRecords.slice(0, count)), 'text/csv');
        await expect(page.locator('#batch-status')).toContainText('Podatki ostanejo');
        await page.locator('#batch-layout').selectOption('two');
        await expect(page.locator('#batch-layout-preview')).toHaveAttribute(
            'aria-label',
            'Predogled: dva UPN naloga, zgoraj in spodaj na listu A4'
        );

        const { pageCount, pageSizes } = await downloadPdf(page, testInfo);
        expect(pageCount).toBe(Math.ceil(count / 2));
        expect(pageSizes.every(size =>
            Math.abs(size.width - 210 * 72 / 25.4) < 0.1 &&
            Math.abs(size.height - 297 * 72 / 25.4) < 0.1
        )).toBe(true);
    }
});

test('CSV uvoz sprejme tudi slovensko ime stolpca', async ({ page }) => {
    const localizedCsv = createCsv([validRecords[0]]).replace('payerName', 'Ime plačnika');
    await importFile(page, 'nalogi.csv', localizedCsv, 'text/csv');
    await expect(page.locator('#batch-status')).toContainText('1 nalog je preverjen');
});

test('ena možnost na A4 ohrani en nalog na vsaki strani', async ({ page }, testInfo) => {
    await importFile(page, 'nalogi.csv', createCsv(validRecords.slice(0, 2)), 'text/csv');
    await expect(page.locator('#batch-status')).toContainText('2 naloga sta preverjena');
    await page.locator('#batch-layout').selectOption('one');

    const { pageCount, pageSizes } = await downloadPdf(page, testInfo);
    expect(pageCount).toBe(2);
    expect(pageSizes.every(size =>
        Math.abs(size.width - 210 * 72 / 25.4) < 0.1 &&
        Math.abs(size.height - 297 * 72 / 25.4) < 0.1
    )).toBe(true);
});

test('JSON seznam nalogov deluje brez spreminjanja obrazca ali lokalnega shranjevanja', async ({ page }) => {
    await page.locator('[data-bind="payerName"]').fill('OBSTOJECI OBRAZEC');
    await page.waitForTimeout(650);
    const savedBefore = await page.evaluate(() =>
        Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))
    );

    await importFile(page, 'nalogi.json', JSON.stringify({ nalogi: validRecords.slice(0, 2) }), 'application/json');
    await expect(page.locator('#batch-status')).toContainText('2 naloga sta preverjena');
    await expect(page.locator('[data-bind="payerName"]')).toHaveValue('OBSTOJECI OBRAZEC');

    const savedAfter = await page.evaluate(() =>
        Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))
    );
    expect(savedAfter).toEqual(savedBefore);
});

test('predogled pokaže ključne podatke, razširjene podrobnosti pa celoten nalog', async ({ page }) => {
    const exampleDirectory = path.resolve(__dirname, '..', 'examples');
    await page.locator('#batch-file').setInputFiles(path.join(exampleDirectory, 'primer-vec-nalogov.json'));

    const firstRow = page.locator('#batch-preview-body tr').first();
    await expect(firstRow).toContainText('ANA NOVAK');
    await expect(firstRow).toContainText('12.34 EUR');
    await firstRow.locator('summary').click();
    await expect(firstRow.locator('dl')).toContainText('GB82WEST12345698765432');
    await expect(firstRow.locator('dl')).toContainText('GLAVNA ULICA 1');
});

test('priložena vzorčna CSV in JSON datoteka sta uporabni za preizkus', async ({ page }) => {
    const exampleDirectory = path.resolve(__dirname, '..', 'examples');
    await page.locator('#batch-file').setInputFiles(path.join(exampleDirectory, 'primer-vec-nalogov.csv'));
    await expect(page.locator('#batch-status')).toContainText('2 naloga sta preverjena');

    await page.locator('#batch-file').setInputFiles(path.join(exampleDirectory, 'primer-vec-nalogov.json'));
    await expect(page.locator('#batch-status')).toContainText('2 naloga sta preverjena');
    await expect(page.locator('#btn-batch-export')).toBeEnabled();
});

test('uvoz zavrne neveljavne zapise in podvojena imena stolpcev', async ({ page }) => {
    const invalidRecord = { ...validRecords[0], amount: '0' };
    await importFile(page, 'nalogi.csv', createCsv([invalidRecord]), 'text/csv');
    await expect(page.locator('#batch-status')).toContainText('Uvoz ni pripravljen');
    await expect(page.locator('#batch-status')).toContainText('"nalogi.csv"');
    await expect(page.locator('#batch-status')).toContainText('nalog 1');
    await expect(page.locator('#batch-status')).toHaveAttribute('role', 'alert');
    await expect(page.locator('#batch-preview')).toBeHidden();
    await expect(page.locator('#btn-batch-export')).toBeDisabled();

    const duplicateHeaderCsv = [
        'payerName;imePlacnika',
        'ANA NOVAK;ANA NOVAK'
    ].join('\n');
    await importFile(page, 'podvojeni.csv', duplicateHeaderCsv, 'text/csv');
    await expect(page.locator('#batch-status')).toContainText('naveden več kot enkrat');
    await expect(page.locator('#btn-batch-export')).toBeDisabled();
});
