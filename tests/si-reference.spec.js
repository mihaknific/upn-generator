const { test, expect } = require('@playwright/test');

const modelLayouts = {
    '00': { min: 1, max: 3, checks: [] },
    '01': { min: 1, max: 3, checks: [[0, 1, 2]] },
    '02': { min: 3, max: 3, checks: [[1], [2]] },
    '03': { min: 3, max: 3, checks: [[0], [1], [2]] },
    '04': { min: 3, max: 3, checks: [[0], [2]] },
    '05': { min: 1, max: 3, checks: [[0]] },
    '06': { min: 2, max: 3, checks: [[1, 2]] },
    '07': { min: 2, max: 3, checks: [[1]] },
    '08': { min: 3, max: 3, checks: [[0, 1], [2]] },
    '09': { min: 1, max: 3, checks: [[0, 1]] },
    '10': { min: 2, max: 3, checks: [[0], [1, 2]] },
    '11': { min: 2, max: 3, checks: [[0], [1]] },
    '12': { min: 1, max: 1, checks: [[0]] },
    '18': { min: 2, max: 3, checks: [[0], [1]] },
    '19': { min: 2, max: 3, checks: [[0], [1]] },
    '21': { min: 2, max: 2, checks: [[0]] },
    '22': { min: 2, max: 2, checks: [[0]] },
    '23': { min: 2, max: 2, checks: [[0], [1]] },
    '28': { min: 2, max: 3, checks: [[0], [1]] },
    '31': { min: 2, max: 2, checks: [[0]] },
    '32': { min: 2, max: 2, checks: [[0]] },
    '38': { min: 2, max: 3, checks: [[0], [1]] },
    '40': { min: 2, max: 3, checks: [[0], [1]] },
    '41': { min: 2, max: 3, checks: [[0], [1]] },
    '48': { min: 2, max: 3, checks: [[0], [1]] },
    '49': { min: 2, max: 3, checks: [[0], [1]] },
    '51': { min: 2, max: 3, checks: [[0], [1]] },
    '55': { min: 1, max: 3, checks: [[0]] },
    '58': { min: 2, max: 3, checks: [[0], [1]] }
};

function checkDigit(value) {
    let sum = 0;
    let weight = 2;
    for (let index = value.length - 1; index >= 0; index--) {
        sum += Number(value[index]) * weight;
        weight = weight === 13 ? 2 : weight + 1;
    }
    const remainder = sum % 11;
    return remainder <= 1 ? 0 : 11 - remainder;
}

function makeReference(model, layout, requestedGroupCount = layout.max) {
    if (model === '12') {
        for (let core = 123456789012; core < 123456789112; core++) {
            const data = String(core).padStart(12, '0');
            const digit = checkDigit(data);
            if (digit < 10) return `SI12${data}${digit}`;
        }
        throw new Error('Unable to create SI12 fixture');
    }

    const groupCount = requestedGroupCount;
    for (let attempt = 0; attempt < 100; attempt++) {
        const groups = Array.from({ length: groupCount }, (_, index) => String([1234, 5678, 9123][index] + attempt));
        let valid = true;
        for (const indexes of layout.checks) {
            const activeIndexes = indexes.filter(index => index < groups.length);
            const lastIndex = activeIndexes[activeIndexes.length - 1];
            const data = activeIndexes.map(index => groups[index]).join('');
            const digit = checkDigit(data);
            if (digit > 9) {
                valid = false;
                break;
            }
            groups[lastIndex] += digit;
        }
        if (valid) return `SI${model}${groups.join('-')}`;
    }
    throw new Error(`Unable to create SI${model} fixture`);
}

test('vsi modeli SI iz pravil ZBS sprejmejo ustrezno obliko in zavrnejo napacno kontrolo', async ({ page }) => {
    await page.goto('/');
    const references = Object.entries(modelLayouts).flatMap(([model, layout]) => {
        const counts = layout.min === layout.max ? [layout.min] : [layout.min, layout.max];
        return counts.map(groupCount => ({
            model,
            reference: makeReference(model, layout, groupCount),
            firstCheckGroup: layout.checks[0]?.filter(index => index < groupCount).at(-1) ?? null
        }));
    });

    const results = await page.evaluate(async (cases) => {
        const { Validator } = await import('/js/validator.js');
        return cases.map(({ model, reference, firstCheckGroup }) => {
            const groups = reference.slice(4).split('-');
            let invalid = null;
            if (firstCheckGroup !== null) {
                const group = groups[firstCheckGroup];
                const last = group.at(-1);
                groups[firstCheckGroup] = group.slice(0, -1) + (last === '9' ? '8' : '9');
                invalid = `SI${reference.slice(2, 4)}${groups.join('-')}`;
            }
            return {
                reference,
                valid: Validator.validateSI(reference),
                generated: Validator.buildSIReference(model, reference.slice(4)),
                invalidRejected: invalid === null || !Validator.validateSI(invalid)
            };
        });
    }, references);

    for (const result of results) {
        expect(result.valid, result.reference).toBe(true);
        expect(result.invalidRejected, result.reference).toBe(true);
        if (result.reference.slice(2, 4) !== '00') {
            expect(result.generated, result.reference).toBe(result.reference.slice(4));
        }
    }
});

test('uradna primera SI00 in RF ter model SI99 se obravnavajo pravilno', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const { Validator } = await import('/js/validator.js');
        return {
            si00: Validator.validateSI('SI00225268-32526-222'),
            si00OtherData: Validator.validateSI('SI00225268-32526-223'),
            si00ReadableSpaces: Validator.validateSI('SI00 225268-32526-222'),
            si00LeadingZeroInP2: Validator.validateSI('SI00225268-032526-222'),
            si12RemainderZero: Validator.validateSI('SI120000000000140'),
            si12RemainderOne: Validator.validateSI('SI120000000000540'),
            si99Empty: Validator.validateSI('SI99'),
            si99WithData: Validator.validateSI('SI991'),
            rfOfficialExample: Validator.validateRF('RF712348231'),
            rfReadableSpaces: Validator.validateRF('RF45 SBO2 010'),
            rfLowercase: Validator.validateRF('rf45sbo2010'),
            rfOfficialBuilder: Validator.buildRFReference('SBO2010'),
            rfRecalculatesExistingControl: Validator.buildRFReference('18 SBO2010'),
            rfFullVisualBuilder: Validator.buildRFReference('RF45 SBO2 010'),
            rfRejectsInvalidCharacter: Validator.buildRFReference('SBO2010!'),
            si01MissingCheck: Validator.validateSI('SI011234-5678')
        };
    });

    expect(result).toEqual({
        si00: true,
        si00OtherData: true,
        si00ReadableSpaces: true,
        si00LeadingZeroInP2: false,
        si12RemainderZero: true,
        si12RemainderOne: true,
        si99Empty: true,
        si99WithData: false,
        rfOfficialExample: true,
        rfReadableSpaces: true,
        rfLowercase: true,
        rfOfficialBuilder: '45SBO2010',
        rfRecalculatesExistingControl: '45SBO2010',
        rfFullVisualBuilder: '45SBO2010',
        rfRejectsInvalidCharacter: null,
        si01MissingCheck: false
    });
});

test('SI kontrolna stevilka ustreza primerom iz priloge 3 ZBS', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const { Validator } = await import('/js/validator.js');
        return {
            exampleA: Validator.calculateMod11('102674'),
            exampleB: Validator.calculateMod11('14'),
            exampleC: Validator.calculateMod11('54'),
            checkedExampleA: Validator.validateSI('SI051026747'),
            checkedExampleB: Validator.validateSI('SI05140'),
            checkedExampleC: Validator.validateSI('SI05540')
        };
    });

    expect(result).toEqual({
        exampleA: 7,
        exampleB: 0,
        exampleC: 0,
        checkedExampleA: true,
        checkedExampleB: true,
        checkedExampleC: true
    });
});

test('model 12 zahteva 13 znakov, SI00 pa najvec 20 stevilk', async ({ page }) => {
    await page.goto('/');
    const si12Reference = makeReference('12', modelLayouts['12']);
    const result = await page.evaluate(async (reference) => {
        const { Validator } = await import('/js/validator.js');
        const valid12 = Validator.buildSIReference('12', reference.slice(4));
        return {
            valid12,
            valid12Accepted: !!valid12 && Validator.validateSI(`SI12${valid12}`),
            invalid12Length: Validator.validateSI('SI1212345678'),
            si00Max: Validator.validateSI('SI00' + '1'.repeat(12) + '-' + '2'.repeat(8)),
            si00Overflow: Validator.validateSI('SI00' + '1'.repeat(12) + '-' + '2'.repeat(9)),
            unknownModel: Validator.validateSI('SI13' + '123')
        };
    }, si12Reference);

    expect(result.valid12Accepted).toBe(true);
    expect(result.valid12).toHaveLength(13);
    expect(result.invalid12Length).toBe(false);
    expect(result.si00Max).toBe(true);
    expect(result.si00Overflow).toBe(false);
    expect(result.unknownModel).toBe(false);
});

test('model SI12 sprejme zahtevano dopolnjevanje z vodilnimi niclami', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const { Validator } = await import('/js/validator.js');
        const reference = '0000000123455';
        return {
            validPaddedReference: Validator.validateSI(`SI12${reference}`),
            builtReference: Validator.buildSIReference('12', '12345')
        };
    });

    expect(result).toEqual({
        validPaddedReference: true,
        builtReference: '0000000123455'
    });
});

test('modeli brez kontrolne stevilke ne ponujajo carobne palcke', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const { Validator } = await import('/js/validator.js');
        return {
            si00: Validator.canBuildSIReference('00'),
            si01: Validator.canBuildSIReference('01'),
            si99: Validator.canBuildSIReference('99'),
            si12: Validator.canBuildSIReference('12')
        };
    });

    expect(result).toEqual({ si00: false, si01: true, si99: false, si12: true });
});

test('kontrolna vsota IBAN in dolzina drzave se preverita skupaj', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const { Validator } = await import('/js/validator.js');
        return {
            gb: Validator.validateIBAN('GB82 WEST 1234 5698 7654 32'),
            nl: Validator.validateIBAN('NL91ABNA0417164300'),
            de: Validator.validateIBAN('DE89370400440532013000'),
            wrongGbLength: Validator.validateIBAN('GB82WEST1234569876543'),
            wrongChecksum: Validator.validateIBAN('GB82WEST12345698765431')
        };
    });

    expect(result).toEqual({
        gb: true,
        nl: true,
        de: true,
        wrongGbLength: false,
        wrongChecksum: false
    });
});

test('posebni modeli SI22, SI32 in SI58 so zavrnjeni v splosnem obrazcu', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const { Validator } = await import('/js/validator.js');
        const base = {
            payerName: 'ANA NOVAK', payerAddress: 'CESTA 1', payerCity: '1000 LJUBLJANA',
            recipientName: 'DRUSTVO', recipientAddress: 'ULICA 1', recipientCity: '1000 LJUBLJANA',
            recipientIban: 'GB82WEST12345698765432', amount: '12.34',
            purposeCode: 'GDSV', purpose: 'PLACILO'
        };
        return ['SI22', 'SI32', 'SI58'].map(model => ({
            model,
            errors: Validator.validateForm({ ...base, recipientRefCode: model, recipientRef: '12345' })
        }));
    });

    for (const { model, errors } of result) {
        expect(errors.some(error => error.field === 'recipientRefCode' && error.msg.includes(`Model ${model}`))).toBe(true);
    }
});

test('referenčne presledke in pomišljaje odstrani samo zapis QR', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const { Utils } = await import('/js/utils.js');
        return {
            si: Utils.formatReferenceForQr('SI00', ' 225268 - 32526 - 222 '),
            rf: Utils.formatReferenceForQr('RF', '45 SBO2-010')
        };
    });
    expect(result).toEqual({
        si: 'SI00225268-32526-222',
        rf: 'RF45SBO2010'
    });
});

test('preverjevalnik sprejme le kode namena iz sifranta ZBS', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const { PURPOSE_CODES } = await import('/js/purpose-codes.js');
        const { Validator } = await import('/js/validator.js');
        return {
            count: PURPOSE_CODES.length,
            charityAvailable: PURPOSE_CODES.some(({ code }) => code === 'CHAR'),
            commonGoodsAvailable: PURPOSE_CODES.some(({ code }) => code === 'GDSV'),
            inventedRejected: Validator.validateForm({ purposeCode: 'ZZZZ' }).some(error => error.field === 'purposeCode' && error.msg.includes('šifrantu ZBS'))
        };
    });
    expect(result).toEqual({ count: 293, charityAvailable: true, commonGoodsAvailable: true, inventedRejected: true });
});