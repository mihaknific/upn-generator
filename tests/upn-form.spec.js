const { test, expect } = require('@playwright/test');
const ZXing = require('@zxing/library');

function decodeQrPixels({ width, height, luminances }) {
    const source = new ZXing.RGBLuminanceSource(Uint8Array.from(luminances), width, height);
    const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source));
    const reader = new ZXing.MultiFormatReader();
    reader.setHints(new Map([[ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]]]));
    return reader.decode(bitmap);
}

async function fillValidPayment(page) {
    await page.locator('[data-bind="payerName"]').fill('ANA NOVAK');
    await page.locator('[data-bind="payerAddress"]').fill('CESTA 1');
    await page.locator('[data-bind="payerCity"]').fill('1000 LJUBLJANA');
    await page.locator('[data-bind="recipientName"]').fill('DRUSTVO ZA PRIMER');
    await page.locator('[data-bind="recipientAddress"]').fill('GLAVNA ULICA 1');
    await page.locator('[data-bind="recipientCity"]').fill('1000 LJUBLJANA');
    await page.locator('[data-bind="recipientIban"]').fill('GB82 WEST 1234 5698 7654 32');
    await page.locator('[data-bind="amount"]').fill('12.34');
    await page.locator('[data-bind="purposeCode"]').selectOption('GDSV');
    await page.locator('[data-bind="purpose"]').fill('DONACIJA');
}

test('prazna EPC značkica je skrita in se prikaže šele ob veljavnem zapisu', async ({ page }) => {
    await page.goto('/');
    const pill = page.locator('#epc-pill-count');

    await expect(pill).toBeHidden();
    expect(await pill.evaluate(element => getComputedStyle(element).display)).toBe('none');

    await fillValidPayment(page);
    await expect(pill).toBeVisible();
    await expect(pill).toHaveText('11');
});

async function readQrPixels(image) {
    return image.evaluate(async element => {
        await element.decode();
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const context = canvas.getContext('2d');
        context.drawImage(element, 0, 0, canvas.width, canvas.height);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        return {
            width: canvas.width,
            height: canvas.height,
            luminances: Array.from({ length: canvas.width * canvas.height }, (_, index) => {
                const offset = index * 4;
                return Math.round((data[offset] * 306 + data[offset + 1] * 601 + data[offset + 2] * 117) / 1024);
            })
        };
    });
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('vrsta naloga in nujnost sta pred podatki v locenih skupinah', async ({ page }) => {
    const structure = await page.locator('#upn-form').evaluate(form => {
        const modeSelector = form.querySelector('.transaction-selector');
        const firstFieldset = form.querySelector('fieldset');
        return {
            selectorIsFirst: form.firstElementChild === modeSelector,
            beforePayerFields: !!modeSelector && !!firstFieldset &&
                !!(modeSelector.compareDocumentPosition(firstFieldset) & Node.DOCUMENT_POSITION_FOLLOWING),
            modeGroup: modeSelector?.querySelector('[role="group"][aria-labelledby="transaction-type-label"]'),
            urgencyGroup: modeSelector?.querySelector('[role="group"][aria-labelledby="urgency-label"]'),
            modes: ['polog', 'dvig', 'humanitarno'].every(key => modeSelector?.querySelector(`[data-bind="${key}"]`)),
            urgencyIsGrouped: !!modeSelector?.querySelector('[data-bind="nujno"]') &&
                !form.querySelector('fieldset [data-bind="nujno"]'),
            urgencyHasOwnHelp: modeSelector?.querySelector('[popovertarget="pop-urgency"]')?.getAttribute('popovertarget')
        };
    });

    expect(structure.selectorIsFirst).toBe(true);
    expect(structure.beforePayerFields).toBe(true);
    expect(structure.modeGroup).toBeTruthy();
    expect(structure.urgencyGroup).toBeTruthy();
    expect(structure.modes).toBe(true);
    expect(structure.urgencyIsGrouped).toBe(true);
    expect(structure.urgencyHasOwnHelp).toBe('pop-urgency');
});

test('izbire vrste naloga in nujnosti so kompaktne in prilagodljive', async ({ page }) => {
    const desktop = await page.locator('.transaction-selector').evaluate(container => {
        const typeOptions = container.querySelector('.transaction-type-options');
        const group = typeOptions.querySelector('.check-group');
        const firstOption = group.querySelector('.check-label');
        const bounds = container.getBoundingClientRect();
        const typeBounds = typeOptions.getBoundingClientRect();
        const urgencyBounds = container.querySelector('.urgency-selector').getBoundingClientRect();
        return {
            groupWidth: group.getBoundingClientRect().width,
            optionWidth: firstOption.getBoundingClientRect().width,
            containerWidth: container.getBoundingClientRect().width,
            optionDirection: getComputedStyle(firstOption).flexDirection,
            hasOuterBorder: getComputedStyle(container).borderTopWidth !== '0px' ||
                getComputedStyle(container).borderLeftWidth !== '0px' ||
                getComputedStyle(container).borderRightWidth !== '0px',
            sameRow: Math.abs(typeBounds.top - urgencyBounds.top) < 1 &&
                Math.abs(bounds.top - typeBounds.top) < 1,
            urgencyAlignedRight: Math.abs(bounds.right - urgencyBounds.right) < 1,
            labelAndOptionsGap: group.getBoundingClientRect().left -
                typeOptions.querySelector('.label-row').getBoundingClientRect().right
        };
    });

    expect(desktop.groupWidth).toBeLessThan(desktop.containerWidth);
    expect(desktop.groupWidth).toBeGreaterThan(desktop.optionWidth);
    expect(desktop.optionDirection).toBe('row');
    expect(desktop.hasOuterBorder).toBe(false);
    expect(desktop.sameRow).toBe(true);
    expect(desktop.urgencyAlignedRight).toBe(true);
    expect(desktop.labelAndOptionsGap).toBeGreaterThanOrEqual(16);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.locator('.transaction-selector').evaluate(container => {
        const bounds = container.getBoundingClientRect();
        return {
            scrollWidth: container.scrollWidth,
            width: bounds.width,
            typeTop: container.querySelector('.transaction-type-options').getBoundingClientRect().top,
            optionsTop: container.querySelector('.transaction-type-options .check-group').getBoundingClientRect().top,
            urgencyTop: container.querySelector('.urgency-selector').getBoundingClientRect().top,
            typeLeft: container.querySelector('.transaction-type-options').getBoundingClientRect().left,
            urgencyLeft: container.querySelector('.urgency-selector').getBoundingClientRect().left
        };
    });

    expect(mobile.scrollWidth).toBeLessThanOrEqual(mobile.width);
    expect(mobile.optionsTop).toBeGreaterThan(mobile.typeTop);
    expect(mobile.urgencyTop).toBeGreaterThan(mobile.typeTop);
    expect(Math.abs(mobile.typeLeft - mobile.urgencyLeft)).toBeLessThan(1);
});

test('vrsta transakcije in nujnost se prelomita hkrati pod 500px', async ({ page }) => {
    for (const [width, expectedDirection] of [[500, 'row'], [499, 'column']]) {
        await page.setViewportSize({ width, height: 844 });
        const directions = await page.evaluate(() => ({
            transaction: getComputedStyle(document.querySelector('.transaction-type-options')).flexDirection,
            urgency: getComputedStyle(document.querySelector('.urgency-selector')).flexDirection
        }));
        expect(directions).toEqual({
            transaction: expectedDirection,
            urgency: expectedDirection
        });
    }
});

test('pojasnilo pri humanitarnem nalogu ne premakne nujnosti proti sredini', async ({ page }) => {
    for (const width of [1100, 1000, 960, 959, 840, 700, 500, 499, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.locator('[data-bind="humanitarno"]').evaluate(input => {
            if (!input.checked) input.click();
        });

        const layout = await page.locator('.transaction-selector').evaluate(parent => {
            const selector = parent.querySelector('.urgency-selector');
            const type = parent.querySelector('.transaction-type-options').getBoundingClientRect();
            const label = selector.querySelector('.label-row').getBoundingClientRect();
            const checkbox = selector.querySelector('.checkbox-row').getBoundingClientRect();
            const hint = selector.querySelector('.field-hint');
            const hintBounds = hint.getBoundingClientRect();
            const container = selector.getBoundingClientRect();
            const parentBounds = parent.getBoundingClientRect();
            return {
                typeTop: type.top,
                typeBottom: type.bottom,
                containerTop: container.top,
                containerLeft: container.left,
                containerRight: container.right,
                checkboxRight: checkbox.right,
                checkboxLeft: checkbox.left,
                hintRight: hintBounds.right,
                hintLeft: hintBounds.left,
                labelLeft: label.left,
                parentRight: parentBounds.right,
                parentLeft: parentBounds.left,
                hintVisible: getComputedStyle(hint).display !== 'none',
                urgentDisabled: selector.querySelector('[data-bind="nujno"]').disabled
            };
        });

        expect(layout.hintVisible).toBe(true);
        expect(layout.urgentDisabled).toBe(true);

        if (width >= 960) {
            expect(Math.abs(layout.containerTop - layout.typeTop)).toBeLessThan(1);
            expect(Math.abs(layout.checkboxRight - layout.containerRight)).toBeLessThan(1);
            expect(Math.abs(layout.hintRight - layout.containerRight)).toBeLessThan(1);
        } else {
            expect(layout.containerTop).toBeGreaterThanOrEqual(layout.typeBottom);
            expect(Math.abs(layout.containerLeft - layout.parentLeft)).toBeLessThan(1);
            expect(layout.containerRight).toBeLessThanOrEqual(layout.parentRight + 1);
            expect(Math.abs(layout.labelLeft - layout.containerLeft)).toBeLessThan(1);
            expect(Math.abs(layout.hintLeft - layout.containerLeft)).toBeLessThan(1);
            if (width < 500) {
                expect(Math.abs(layout.checkboxLeft - layout.containerLeft)).toBeLessThan(1);
            }
        }
    }
});

test('split gumbi ohranijo enovrsticni naslov in locen meni na desni', async ({ page }) => {
    for (const width of [840, 641, 640, 639, 638, 390]) {
        await page.setViewportSize({ width, height: 900 });
        const layouts = await page.locator('.split-button-group').evaluateAll(groups =>
            groups.map(group => {
                const main = group.querySelector('.split-main');
                const label = main.querySelector('span');
                const arrow = group.querySelector('.split-arrow');
                const icon = arrow.querySelector('svg');
                const groupBounds = group.getBoundingClientRect();
                const mainBounds = main.getBoundingClientRect();
                const labelBounds = label.getBoundingClientRect();
                const arrowBounds = arrow.getBoundingClientRect();
                const iconBounds = icon.getBoundingClientRect();
                const actionsBounds = group.closest('.actions').getBoundingClientRect();
                return {
                    whiteSpace: getComputedStyle(main).whiteSpace,
                    labelHeight: labelBounds.height,
                    groupHeight: groupBounds.height,
                    mainHeight: mainBounds.height,
                    arrowHeight: arrowBounds.height,
                    arrowWidth: arrowBounds.width,
                    arrowIconWidth: iconBounds.width,
                    arrowIconLeftInset: iconBounds.left - arrowBounds.left,
                    arrowIconRightInset: arrowBounds.right - iconBounds.right,
                    arrowIconStrokeWidth: getComputedStyle(icon).strokeWidth,
                    arrowIconColor: getComputedStyle(icon).color,
                    arrowOnRight: arrowBounds.right <= groupBounds.right &&
                        groupBounds.right - arrowBounds.right <= 1,
                    groupInsideActions: groupBounds.left >= actionsBounds.left - 1 &&
                        groupBounds.right <= actionsBounds.right + 1,
                    mainBeforeArrow: mainBounds.right <= arrowBounds.left
                };
            })
        );

        expect(layouts).toHaveLength(2);
        for (const layout of layouts) {
            expect(layout.whiteSpace).toBe('nowrap');
            expect(layout.labelHeight).toBeLessThan(20);
            expect(layout.mainHeight).toBe(layout.groupHeight - 2);
            expect(layout.arrowHeight).toBe(layout.mainHeight);
            expect(layout.arrowWidth).toBeGreaterThanOrEqual(42);
            expect(layout.arrowIconWidth).toBe(18);
            expect(layout.arrowIconLeftInset).toBeGreaterThanOrEqual(10);
            expect(layout.arrowIconRightInset).toBeGreaterThanOrEqual(10);
            expect(layout.arrowIconStrokeWidth).toBe('3px');
            expect(layout.arrowIconColor).not.toBe('rgba(0, 0, 0, 0)');
            expect(layout.arrowOnRight).toBe(true);
            expect(layout.groupInsideActions).toBe(true);
            expect(layout.mainBeforeArrow).toBe(true);
        }
    }
});

test('favicon uporablja priloženi logotip SVG', async ({ page }) => {
    const favicon = page.locator('link[rel="icon"]');
    await expect(favicon).toHaveAttribute('href', 'assets/logo.svg');

    const response = await page.request.get(new URL('assets/logo.svg', page.url()).toString());
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/svg+xml');
    expect(await response.text()).toContain('viewBox="0 0 640 640"');
});

test('favicon ohranja enotno mrežo kvadratnih modulov iz priloženega logotipa', async ({ page }) => {
    const icon = await page.request.get(new URL('assets/logo.svg', page.url()).toString());
    const source = await icon.text();

    expect(source).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"');
    expect(source).not.toContain('stroke=');
    const modules = [...source.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="#FFFFFF"\/>/g)]
        .slice(-11);
    expect(modules).toHaveLength(11);
    expect(modules.every(([, , , width, height]) => width === height && width === '34')).toBe(true);
});

test('ikone za namestitev ustrezajo formatu in velikosti iz manifesta', async ({ page }) => {
    const icons = await page.evaluate(async () => {
        const manifest = await fetch('manifest.json').then(response => response.json());
        return Promise.all(manifest.icons.map(async icon => {
            const iconUrl = new URL(icon.src, document.baseURI);
            const response = await fetch(iconUrl);
            const image = new Image();
            image.src = iconUrl;
            await image.decode();
            return {
                source: icon.src,
                declaredType: icon.type,
                contentType: response.headers.get('content-type'),
                declaredSize: icon.sizes,
                width: image.width,
                height: image.height
            };
        }));
    });

    expect(icons).toEqual([
        {
            source: 'assets/logo.svg',
            declaredType: 'image/svg+xml',
            contentType: 'image/svg+xml',
            declaredSize: '640x640',
            width: 640,
            height: 640
        },
        {
            source: 'assets/icon-192.png',
            declaredType: 'image/png',
            contentType: 'image/png',
            declaredSize: '192x192',
            width: 192,
            height: 192
        },
        {
            source: 'assets/icon-512.png',
            declaredType: 'image/png',
            contentType: 'image/png',
            declaredSize: '512x512',
            width: 512,
            height: 512
        }
    ]);
});

test('logotip glave uporablja isti priloženi SVG kot favicon', async ({ page }) => {
    const logo = page.locator('.header-badge img');
    await expect(logo).toHaveAttribute('src', 'assets/logo.svg');

    const dimensions = await logo.evaluate(image => ({
        width: image.getBoundingClientRect().width,
        height: image.getBoundingClientRect().height,
        loaded: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
        favicon: document.querySelector('link[rel="icon"]').href === image.src
    }));

    expect(dimensions).toEqual({
        width: 48,
        height: 48,
        loaded: true,
        favicon: true
    });
});

test('nujnost je dovoljena le pri obicajnem placilu', async ({ page }) => {
    await expect(page.locator('[data-bind="nujno"]')).toBeEnabled();
    await expect(page.locator('#urgency-mode-hint')).toBeHidden();
    await fillValidPayment(page);
    await page.locator('label.check-urgent').click({ force: true });
    await expect(page.locator('#qr-code img')).toHaveCount(1);
    await expect(page.locator('[data-field="nujno"]')).toHaveText('X');

    const urgencyErrors = await page.evaluate(async () => {
        const { Validator } = await import('/js/validator.js');
        const { Store } = await import('/js/store.js');
        return ['placilo', 'polog', 'dvig', 'humanitarno'].map(mode => {
            const state = {
                ...Store,
                polog: mode === 'polog',
                dvig: mode === 'dvig',
                humanitarno: mode === 'humanitarno',
                nujno: true
            };
            return [mode, Validator.validateForm(state)
                .filter(error => error.field === 'nujno')
                .map(error => error.msg)];
        });
    });
    expect(Object.fromEntries(urgencyErrors)).toEqual({
        placilo: [],
        polog: ['Nujno plačilo ni dovoljeno pri pologu ali dvigu.'],
        dvig: ['Nujno plačilo ni dovoljeno pri pologu ali dvigu.'],
        humanitarno: ['Nujno plačilo ni dovoljeno pri humanitarnem nalogu.']
    });
});

test('oznake polj, referenc in vrste naloga imajo enotno tipografijo', async ({ page }) => {
    const typography = await page.evaluate(() => {
        const selectors = [
            'label:has([data-bind="payerName"]) .label-row',
            '.ref-group .label-row',
            '.transaction-type-options .label-row',
            '.transaction-selector .check-label',
            '.urgency-selector .label-row',
            '.urgency-selector .check-label'
        ];
        return selectors.map(selector => {
            const element = document.querySelector(selector);
            const style = getComputedStyle(element);
            return { selector, fontSize: style.fontSize, fontWeight: style.fontWeight };
        });
    });

    expect(typography.map(({ fontSize, fontWeight }) => ({ fontSize, fontWeight }))).toEqual(
        Array.from({ length: 6 }, () => ({ fontSize: '13px', fontWeight: '500' }))
    );
});

test('razmik med oznako in vnosom je enoten za vsa polja', async ({ page }) => {
    const gaps = await page.evaluate(() => {
        const fields = [
            document.querySelector('#recipientName').closest('label'),
            document.querySelector('#recipientIban').closest('label'),
            document.querySelector('#recipientRefCode').closest('.ref-group'),
            document.querySelector('#payerRefCode').closest('.ref-group')
        ];

        return fields.map(field => {
            const label = field.querySelector(':scope > .label-row');
            const input = [...field.children].find(child => child !== label);
            return {
                configuredGap: getComputedStyle(field).rowGap,
                renderedGap: input.getBoundingClientRect().top - label.getBoundingClientRect().bottom
            };
        });
    });

    expect(gaps).toHaveLength(4);
    for (const gap of gaps) {
        expect(gap.configuredGap).toBe('6px');
        expect(gap.renderedGap).toBe(6);
    }
});

test('gumbi za čiščenje imajo razložljiv namig pri miški in tipkovnici', async ({ page }) => {
    const clearButtons = page.locator('.clear-fieldset-btn');
    await expect(clearButtons).toHaveCount(3);

    for (const [index, label] of [
        [0, 'Počisti plačnika'],
        [1, 'Počisti prejemnika'],
        [2, 'Počisti znesek in namen']
    ]) {
        const button = clearButtons.nth(index);
        await expect(button).toHaveAttribute('aria-label', label);
        await expect(button).toHaveAttribute('data-tooltip', label);
        await expect(button).not.toHaveAttribute('title');
        await button.hover();
        await expect(button).toHaveCSS('color', 'rgb(239, 68, 68)');
        expect(await button.evaluate(element =>
            getComputedStyle(element, '::after').visibility
        )).toBe('visible');
    }

    for (let tab = 0; tab < 40; tab += 1) {
        await page.keyboard.press('Tab');
        if (await clearButtons.first().evaluate(element => element === document.activeElement)) break;
    }
    await expect(clearButtons.first()).toBeFocused();
    expect(await clearButtons.first().evaluate(element =>
        getComputedStyle(element, '::after').visibility
    )).toBe('visible');
});

test('glava in nujnost se poravnata pravilno pri prehodnih širinah', async ({ page }) => {
    for (const width of [635, 700, 840]) {
        await page.setViewportSize({ width, height: 900 });
        const layout = await page.evaluate(() => {
            const header = document.querySelector('header');
            const [badge, title, actions] = header.children;
            const type = document.querySelector('.transaction-type-options').getBoundingClientRect();
            const urgency = document.querySelector('.urgency-selector').getBoundingClientRect();
            return {
                width: innerWidth,
                badge: badge.getBoundingClientRect().toJSON(),
                title: title.getBoundingClientRect().toJSON(),
                actions: actions.getBoundingClientRect().toJSON(),
                type: type.toJSON(),
                urgency: urgency.toJSON()
            };
        });

        expect(Math.abs(layout.badge.top + layout.badge.height / 2 -
            (layout.title.top + layout.title.height / 2))).toBeLessThan(2);

        if (width === 635) {
            expect(layout.title.left).toBeGreaterThanOrEqual(layout.badge.right);
            expect(layout.title.top).toBeLessThan(layout.badge.bottom);
            expect(layout.actions.top).toBeGreaterThan(layout.title.bottom);
        }

        if (width < 840 && layout.urgency.top > layout.type.top + 1) {
            expect(Math.abs(layout.urgency.left - layout.type.left)).toBeLessThan(2);
        }
    }
});

test('gumb Novi nalog ostane v eni vrstici, logotip se skrije pod 350px', async ({ page }) => {
    for (const width of [840, 640, 390, 350, 349]) {
        await page.setViewportSize({ width, height: 844 });
        const layout = await page.evaluate(() => {
            const button = document.querySelector('#reset-form');
            const text = button.querySelector('span').getBoundingClientRect();
            const badge = document.querySelector('.header-badge');
            return {
                textHeight: text.height,
                badgeDisplay: getComputedStyle(badge).display
            };
        });
        expect(layout.textHeight).toBeLessThan(20);
        expect(layout.badgeDisplay).toBe(width < 350 ? 'none' : 'flex');
    }
});

test('polji reference ostaneta v eni vrstici na ozkem zaslonu', async ({ page }) => {
    for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });

        for (const key of ['payerRef', 'recipientRef']) {
            const layout = await page.locator(`[data-bind="${key}"]`).evaluate(input => {
                const group = input.closest('.ref-inline');
                const code = group.querySelector('select');
                const inputBounds = input.getBoundingClientRect();
                const codeBounds = code.getBoundingClientRect();
                const groupBounds = group.getBoundingClientRect();
                return {
                    direction: getComputedStyle(group).flexDirection,
                    inputTop: inputBounds.top,
                    codeTop: codeBounds.top,
                    inputLeft: inputBounds.left,
                    codeRight: codeBounds.right,
                    groupLeft: groupBounds.left,
                    groupRight: groupBounds.right
                };
            });

            expect(layout.direction).toBe('row');
            expect(Math.abs(layout.inputTop - layout.codeTop)).toBeLessThan(1);
            expect(layout.inputLeft).toBeGreaterThanOrEqual(layout.codeRight - 1);
            expect(layout.groupLeft).toBeGreaterThanOrEqual(0);
            expect(layout.groupRight).toBeLessThanOrEqual(width);
        }
    }
});

test('valuta in znesek se na majhnem zaslonu zlozita v loceni vrstici', async ({ page }) => {
    const row = page.locator('[data-bind="amount"]').locator('xpath=ancestor::div[contains(@class, "row")]');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(row).toHaveCSS('flex-direction', 'column');
    const mobileLayout = await row.evaluate(element => {
        const currency = element.querySelector('.currency').getBoundingClientRect();
        const amount = element.querySelector('[data-bind="amount"]').closest('label').getBoundingClientRect();
        return { currencyBottom: currency.bottom, amountTop: amount.top };
    });
    expect(mobileLayout.amountTop).toBeGreaterThanOrEqual(mobileLayout.currencyBottom);

    await page.setViewportSize({ width: 840, height: 900 });
    await expect(row).toHaveCSS('flex-direction', 'row');
    const desktopLayout = await row.evaluate(element => {
        const currency = element.querySelector('.currency').getBoundingClientRect();
        const amount = element.querySelector('[data-bind="amount"]').closest('label').getBoundingClientRect();
        return { currencyRight: currency.right, amountLeft: amount.left };
    });
    expect(desktopLayout.amountLeft).toBeGreaterThanOrEqual(desktopLayout.currencyRight);
});

test('obrazec shrani spremembe po premoru in ob skritju strani', async ({ page }) => {
    await page.clock.install();
    await page.reload();

    await page.evaluate(async () => {
        const { Storage } = await import('/js/storage.js');
        Storage.save({ payerName: 'PREJSHNJE IME' });
    });

    const payerName = page.locator('[data-bind="payerName"]');
    await payerName.fill('ANA NOVAK');
    await expect.poll(() => page.evaluate(() => JSON.parse(
        localStorage.getItem('upn_studio_2026_data')
    ).payerName)).toBe('PREJSHNJE IME');

    await page.clock.fastForward(500);
    await expect.poll(() => page.evaluate(() => {
        const data = JSON.parse(localStorage.getItem('upn_studio_2026_data'));
        return data.payerName;
    })).toBe('ANA NOVAK');

    await payerName.fill('NOVA VREDNOST');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect.poll(() => page.evaluate(() => {
        const data = JSON.parse(localStorage.getItem('upn_studio_2026_data'));
        return data.payerName;
    })).toBe('NOVA VREDNOST');
});

test('prazen obrazec ne prikaze QR in pojasni stanje', async ({ page }) => {
    await expect(page.locator('#qr-code img')).toHaveCount(0);
    await expect(page.locator('#qr-code')).toContainText('QR ni veljaven');
});

test('vsi runtime viri se nalozijo z istega izvora', async ({ page }) => {
    const privacy = await page.evaluate(async () => {
        await document.fonts.ready;
        const policy = document.querySelector('meta[http-equiv="Content-Security-Policy"]').content;
        const externalResources = performance.getEntriesByType('resource')
            .map(resource => resource.name)
            .filter(url => new URL(url).origin !== location.origin);
        return { policy, externalResources };
    });

    expect(privacy.externalResources).toEqual([]);
    expect(privacy.policy).toContain("script-src 'self'");
    expect(privacy.policy).toContain("connect-src 'self'");
    expect(privacy.policy).not.toContain('https://');
});

test('lokalni strežnik nastavi varnostne glave', async ({ page }) => {
    const response = await page.request.get(page.url());
    const headers = response.headers();

    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
});

test('namesti aplikacijo se prikaže samo, ko brskalnik ponudi namestitev', async ({ page }) => {
    const installButton = page.locator('#install-app');
    await expect(installButton).toBeHidden();

    await page.evaluate(() => {
        window.installPromptCalls = 0;
        const event = new Event('beforeinstallprompt', { cancelable: true });
        event.prompt = () => { window.installPromptCalls += 1; };
        event.userChoice = Promise.resolve({ outcome: 'accepted' });
        window.dispatchEvent(event);
    });

    await expect(installButton).toBeVisible();
    await installButton.click();
    await expect(installButton).toBeHidden();
    expect(await page.evaluate(() => window.installPromptCalls)).toBe(1);
});

test('veljaven placilni nalog ustvari QR', async ({ page }) => {
    await fillValidPayment(page);
    const qrImage = page.locator('#qr-code img');
    await expect(qrImage).toHaveCount(1);
    const dimensions = await qrImage.evaluate(image => ({
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        width: image.getBoundingClientRect().width,
        height: image.getBoundingClientRect().height
    }));
    expect(dimensions.naturalWidth).toBeGreaterThan(0);
    expect(dimensions.naturalHeight).toBe(dimensions.naturalWidth);
    expect(dimensions.width).toBeGreaterThan(0);
    expect(Math.abs(dimensions.width - dimensions.height)).toBeLessThan(1);
    await expect(page.locator('#qr-code')).not.toContainText('QR ni veljaven');
});

test('neveljaven IBAN preprecuje QR in izvoz', async ({ page }) => {
    await fillValidPayment(page);
    await page.locator('[data-bind="recipientIban"]').fill('SI000');
    await expect(page.locator('#qr-code img')).toHaveCount(0);
    await expect(page.locator('#qr-code')).toContainText('QR ni veljaven');

    let downloaded = false;
    page.on('download', () => { downloaded = true; });
    await page.locator('#btn-qr-png').click();
    await expect(page.locator('#global-warning-box')).not.toHaveClass(/hidden/);
    expect(downloaded).toBe(false);
});

test('IBAN placnika je slovenski, IBAN prejemnika pa iz obmocja SEPA', async ({ page }) => {
    await fillValidPayment(page);
    await page.locator('[data-bind="recipientIban"]').fill('AE070331234567890123456');
    await expect(page.locator('#qr-code img')).toHaveCount(0);
    await expect(page.locator('#global-warning-list')).toContainText('SEPA');

    await page.locator('[data-bind="recipientIban"]').fill('GB82 WEST 1234 5698 7654 32');
    await page.locator('label.check-label').filter({ hasText: 'Dvig' }).click({ force: true });
    await page.locator('[data-bind="payerIban"]').fill('GB82 WEST 1234 5698 7654 32');
    await expect(page.locator('#qr-code img')).toHaveCount(0);
    await expect(page.locator('#global-warning-list')).toContainText('slovenski IBAN');

    await page.locator('[data-bind="payerIban"]').fill('SI56010000000000083');
    await expect(page.locator('#qr-code img')).toHaveCount(1);
});

    test('ime, naslov in kraj prejemnika so obvezni za placilni nalog', async ({ page }) => {
        await fillValidPayment(page);
        await page.locator('[data-bind="recipientAddress"]').fill('');
        await expect(page.locator('#qr-code img')).toHaveCount(0);
        await expect(page.locator('#global-warning-list')).toContainText('Naslov prejemnika je obvezen');

        await page.locator('[data-bind="recipientAddress"]').fill('GLAVNA ULICA 1');
        await page.locator('[data-bind="recipientCity"]').fill('');
        await expect(page.locator('#qr-code img')).toHaveCount(0);
        await expect(page.locator('#global-warning-list')).toContainText('Poštna številka in kraj prejemnika sta obvezna');
    });

    test('obvezni IBAN prejemnika prikaze napako pod poljem', async ({ page }) => {
        await fillValidPayment(page);
        await page.locator('[data-bind="recipientIban"]').fill('');

        await expect(page.locator('#qr-code img')).toHaveCount(0);
        await expect(page.locator('#global-warning-list')).toContainText('IBAN prejemnika je obvezen');
        await expect(page.locator('.input-wrapper:has([data-bind="recipientIban"]) + .error-msg'))
            .toHaveText(/IBAN prejemnika je obvezen/);
        await expect(page.locator('.input-wrapper:has([data-bind="recipientIban"]) + .error-msg'))
            .toBeVisible();
    });

    test('referenca je obvezna za racun javnih financ', async ({ page }) => {
        await fillValidPayment(page);
        await page.locator('[data-bind="recipientIban"]').fill('SI56010000000000083');
        await expect(page.locator('#qr-code img')).toHaveCount(0);
        await expect(page.locator('#global-warning-list')).toContainText('Referenca (model in sklic) je strogo obvezna za JFP');
        await expect(page.locator('#badge-recipient-ref')).toHaveText('obvezno');

        await page.locator('label.check-label').filter({ hasText: 'Polog' }).click({ force: true });
        await expect(page.locator('#qr-code img')).toHaveCount(0);
        await expect(page.locator('#global-warning-list')).toContainText('Referenca (model in sklic) je strogo obvezna za JFP');
        await expect(page.locator('#badge-recipient-ref')).toHaveText('obvezno');
    });

    test('negativen znesek blokira QR', async ({ page }) => {
        await fillValidPayment(page);
        await page.locator('[data-bind="amount"]').fill('-1.00');
        await expect(page.locator('#qr-code img')).toHaveCount(0);
        await expect(page.locator('#global-warning-list')).toContainText('Znesek ne sme biti negativen');
    });

    test('znesek uposteva centa, mejo in najvec dve decimalni mesti', async ({ page }) => {
        await fillValidPayment(page);
        await page.locator('[data-bind="amount"]').fill('999999999.99');
        await expect(page.locator('#qr-code img')).toHaveCount(1);

        await page.locator('[data-bind="amount"]').fill('1000000000.00');
        await expect(page.locator('#qr-code img')).toHaveCount(0);
        await expect(page.locator('#global-warning-list')).toContainText('999.999.999,99');

        await page.locator('[data-bind="amount"]').fill('1.999');
        await expect(page.locator('#qr-code img')).toHaveCount(0);
        await expect(page.locator('#global-warning-list')).toContainText('največ dvema decimalnima mestoma');
    });

    test('znesek je lahko prazen le v humanitarnem nacinu, valuta UPN je EUR', async ({ page }) => {
        await fillValidPayment(page);
        await page.locator('[data-bind="amount"]').fill('');
        await expect(page.locator('#qr-code img')).toHaveCount(0);

        await page.locator('label.check-humanitarian').click({ force: true });
        await expect(page.locator('[data-bind="amount"]')).toHaveValue('');
        await expect(page.locator('[data-bind="currency"]')).toBeDisabled();
        await expect(page.locator('[data-bind="currency"]')).toHaveValue('EUR');
    });

    test('neobstojec koledarski datum preprecuje QR', async ({ page }) => {
        await fillValidPayment(page);
        const result = await page.evaluate(async () => {
            const [{ Store }, { Validator }, { App }] = await Promise.all([
                import('/js/store.js'),
                import('/js/validator.js'),
                import('/js/app.js')
            ]);
            Store.paymentDate = '2026-02-30';
            const errors = Validator.validateForm(Store);
            App._validateUI();
            return errors;
        });
        expect(result).toContainEqual({ field: 'paymentDate', msg: 'Vnesen datum ne obstaja.' });
        await expect(page.locator('#qr-code img')).toHaveCount(0);
    });

test('ime prejemnika se ne odreze in meja 33 znakov je preverjena', async ({ page }) => {
    await fillValidPayment(page);
    await page.locator('[data-bind="recipientName"]').fill('A'.repeat(33));
    await expect(page.locator('#qr-code img')).toHaveCount(1);

    await page.locator('[data-bind="recipientName"]').fill('A'.repeat(34));
    await expect(page.locator('#qr-code img')).toHaveCount(0);
    await expect(page.locator('#qr-code')).toContainText('34/33');
    await expect(page.locator('[data-bind="recipientName"] + .error-msg')).toContainText('34/33');
});

test('namen placila ne sme presegati 42 znakov', async ({ page }) => {
    await fillValidPayment(page);
    await page.locator('[data-bind="purpose"]').fill('N'.repeat(43));
    await expect(page.locator('#qr-code img')).toHaveCount(0);
    await expect(page.locator('#qr-code')).toContainText('43/42');
});

test('predogled in PDF ohranita vseh 42 znakov namena placila', async ({ page }) => {
    await fillValidPayment(page);
    const purpose = 'N'.repeat(42);
    const payerName = 'P'.repeat(33);
    const recipientName = 'R'.repeat(33);
    await page.locator('[data-bind="purpose"]').fill(purpose);
    await expect(page.locator('.a44 .text-layer')).toContainText(purpose);

    const pdfText = await page.evaluate(async ({ fullPurpose, fullPayerName, fullRecipientName }) => {
        const [{ Export }, { Store }] = await Promise.all([
            import('/js/export.js'),
            import('/js/store.js')
        ]);
        const drawnText = [];
        const font = { widthOfTextAtSize: (text, size) => text.length * size * 0.6 };
        const pageMock = {
            drawLine() {},
            drawRectangle() {},
            drawText(text) { drawnText.push(text); }
        };
        window.PDFLib = { rgb: () => ({}) };
        Store.purpose = fullPurpose;
        Store.payerName = fullPayerName;
        Store.recipientName = fullRecipientName;
        await Export._drawUPN(pageMock, 0, 0, {
            myriad: font,
            courier: font,
            courierBold: font,
            helveticaBold: font
        }, 300, null);
        return drawnText;
    }, { fullPurpose: purpose, fullPayerName: payerName, fullRecipientName: recipientName });

    expect(pdfText).toContain(purpose);
    expect(pdfText.filter(text => text.includes('P'.repeat(10))).map(text => text.length)).toEqual([33, 33]);
    expect(pdfText.filter(text => text.includes('R'.repeat(10))).map(text => text.length)).toEqual([33, 33]);
});

test('koda in namen sta v predogledu in PDF-ju pomaknjena za 0,2 mm navzdol', async ({ page }) => {
    await fillValidPayment(page);
    const previewOffsets = await page.evaluate(() => ['a43', 'a44'].map(className => {
        const transform = getComputedStyle(document.querySelector(`.${className} .text-layer`)).transform;
        return new DOMMatrixReadOnly(transform).m42;
    }));
    const expectedPreviewOffset = 0.2 * 96 / 25.4;
    for (const offset of previewOffsets) {
        expect(Math.abs(offset - expectedPreviewOffset)).toBeLessThan(0.01);
    }

    const drawnText = await page.evaluate(async () => {
        const [{ Export }, { Store }] = await Promise.all([
            import('/js/export.js'),
            import('/js/store.js')
        ]);
        const calls = [];
        const font = { widthOfTextAtSize: (text, size) => text.length * size * 0.6 };
        const pageMock = {
            drawLine() {},
            drawRectangle() {},
            drawText(text, options) { calls.push({ text, x: options.x, y: options.y }); }
        };
        window.PDFLib = { rgb: () => ({}) };
        Store.purposeCode = 'CHAR';
        Store.purpose = 'DONACIJA';
        await Export._drawUPN(pageMock, 0, 0, {
            myriad: font,
            courier: font,
            courierBold: font,
            helveticaBold: font
        }, 300, null);
        return {
            purposeCodeYs: calls
                .filter(({ text, x }) => ['C', 'H', 'A', 'R'].includes(text) && x > 63 * 2.83464566929 && x < 78.5 * 2.83464566929)
                .map(({ y }) => y),
            purposeY: calls.find(({ text, x }) => text === 'DONACIJA' && x > 80 * 2.83464566929 && x < 174 * 2.83464566929)?.y
        };
    });

    const expectedY = 300 - (49 + 2.5 + (10 * 0.3527 / 2.8) + 0.2) * 2.83464566929;
    expect(drawnText.purposeCodeYs).toHaveLength(4);
    expect(drawnText.purposeY).toBeDefined();
    for (const y of [...drawnText.purposeCodeYs, drawnText.purposeY]) {
        expect(Math.abs(y - expectedY)).toBeLessThan(0.01);
    }
});

test('vsa polja na desni so v predogledu pomaknjena za 0,2 mm', async ({ page }) => {
    await fillValidPayment(page);
    await page.locator('[data-bind="payerIban"]').fill('SI56010000000000083');
    await page.locator('[data-bind="payerRefCode"]').selectOption('SI00');
    await page.locator('[data-bind="payerRef"]').fill('123');
    await page.locator('[data-bind="recipientRefCode"]').selectOption('SI00');
    await page.locator('[data-bind="recipientRef"]').fill('456');
    await page.locator('[data-bind="paymentDate"]').fill('2026-10-15');
    await page.locator('[data-bind="dueDate"]').fill('2026-11-15');

    const selectors = [
        '.a22 .text-layer', '.a27 .text-layer', '.a28 .text-layer',
        '.a30 .field-text-value', '.a31', '.a32', '.a37 .text-layer', '.a38 .text-layer',
        '.a43 .text-layer', '.a44 .text-layer', '.a45 .text-layer',
        '.a47 .text-layer', '.a50 .text-layer', '.a51 .text-layer',
        '.a54 .field-text-value', '.a55', '.a56'
    ];
    const offsets = await page.evaluate(targets => targets.map(selector => {
        const element = document.querySelector(selector);
        return new DOMMatrixReadOnly(getComputedStyle(element).transform).m42;
    }), selectors);

    const expectedOffset = 0.2 * 96 / 25.4;
    expect(offsets).toHaveLength(17);
    for (const offset of offsets) {
        expect(Math.abs(offset - expectedOffset)).toBeLessThan(0.05);
    }
});

test('vsa polja na desni so v PDF-ju pomaknjena za 0,2 mm', async ({ page }) => {
    await fillValidPayment(page);
    const fields = {
        payerIban: 'SI56010000000000083', payerRefCode: 'SI00', payerRef: '123',
        payerName: 'ANA NOVAK', payerAddress: 'CESTA 1', payerCity: '1000 LJUBLJANA',
        amount: '12.34', paymentDate: '2026-10-15', purposeCode: 'CHAR', purpose: 'DONACIJA',
        dueDate: '2026-11-15', recipientIban: 'GB82WEST12345698765432',
        recipientRefCode: 'SI00', recipientRef: '456', recipientName: 'DRUSTVO ZA PRIMER',
        recipientAddress: 'GLAVNA ULICA 1', recipientCity: '1000 LJUBLJANA'
    };
    const drawnText = await page.evaluate(async paymentFields => {
        const [{ Export }, { Store }] = await Promise.all([
            import('/js/export.js'),
            import('/js/store.js')
        ]);
        Object.assign(Store, paymentFields);
        const calls = [];
        const font = { widthOfTextAtSize: (text, size) => text.length * size * 0.6 };
        const pageMock = {
            drawLine() {},
            drawRectangle() {},
            drawText(text, options) { calls.push({ text, x: options.x, y: options.y }); }
        };
        window.PDFLib = { rgb: () => ({}) };
        await Export._drawUPN(pageMock, 0, 0, {
            myriad: font,
            courier: font,
            courierBold: font,
            helveticaBold: font
        }, 300, null);
        return calls;
    }, fields);

    const rows = [
        [106.5, 177.75, 6], [106.5, 121.5, 14], [123.5, 206, 14],
        [106.5, 206, 22], [106.5, 206, 27], [106.5, 206, 32],
        [114.2, 155.45, 40.5], [161.2, 191.2, 40.5],
        [63.5, 78.5, 49], [80.5, 174.25, 49], [176.2, 205.95, 49],
        [63.5, 191, 58], [63.5, 78.5, 66], [80.5, 163, 66],
        [63.5, 163, 74], [63.5, 163, 79], [63.5, 163, 84]
    ];
    const pointPerMillimeter = 2.83464566929;
    const rightRows = rows.map(([left, right, top]) => {
        const expectedY = 300 - (top + 2.5 + (10 * 0.3527 / 2.8) + 0.2) * pointPerMillimeter;
        return drawnText.some(({ x, y }) => x > left * pointPerMillimeter &&
            x < right * pointPerMillimeter && Math.abs(y - expectedY) < 0.01);
    });

    expect(rightRows).toEqual(Array(17).fill(true));
});

for (const field of ['payerName', 'payerAddress', 'payerCity', 'recipientAddress', 'recipientCity']) {
    test(`${field} se ne odreze nad mejo 33 znakov`, async ({ page }) => {
        await fillValidPayment(page);
        await page.locator(`[data-bind="${field}"]`).fill('X'.repeat(33));
        await expect(page.locator('#qr-code img')).toHaveCount(1);

        await page.locator(`[data-bind="${field}"]`).fill('X'.repeat(34));
        await expect(page.locator('#qr-code img')).toHaveCount(0);
        await expect(page.locator('#qr-code')).toContainText('34/33');
    });
}

test('QR ne spreminja tiho imen s sumniki', async ({ page }) => {
    await fillValidPayment(page);
    await page.locator('[data-bind="recipientName"]').fill('DRUŠTVO ZA PRIMER');
    await expect(page.locator('#qr-code img')).toHaveCount(1);
    await expect(page.locator('#global-warning-list')).toBeEmpty();
});

test('nepodprt znak blokira QR namesto tihe odstranitve', async ({ page }) => {
    await fillValidPayment(page);
    await page.locator('[data-bind="recipientName"]').fill('DRUSTVO 🚀');
    await expect(page.locator('#qr-code img')).toHaveCount(0);
    await expect(page.locator('#qr-code')).toContainText('QR ni veljaven');
    await expect(page.locator('#global-warning-list')).toContainText('niso podprti v ISO-8859-2');
});

test('UPN QR uses ISO-8859-2 ECI and preserves Slovenian text when decoded', async ({ page }) => {
    await fillValidPayment(page);
    await page.locator('[data-bind="recipientName"]').fill('DRUŠTVO ČEBELICA');

    const qrPixels = await page.locator('#qr-code img').evaluate(async image => {
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        return {
            width: canvas.width,
            height: canvas.height,
            version: image.dataset.qrVersion,
            ecc: image.dataset.qrEcc,
            eci: image.dataset.qrEci,
            luminances: Array.from({ length: canvas.width * canvas.height }, (_, index) => {
                const offset = index * 4;
                return Math.round((data[offset] * 306 + data[offset + 1] * 601 + data[offset + 2] * 117) / 1024);
            })
        };
    });

    expect(qrPixels).toMatchObject({ version: '15', ecc: 'M', eci: '4' });
    expect(await page.evaluate(() => typeof window.qrcodegen.QrCode)).toBe('function');
    const decodedText = decodeQrPixels(qrPixels).getText();
    expect(decodedText).toContain('DRUŠTVO ČEBELICA');
    const checksum = await page.evaluate(async text => {
        const { Utils } = await import('/js/utils.js');
        const lines = text.split('\n');
        return {
            lineCount: lines.length,
            checksum: Utils.calculateQrChecksum(lines.slice(0, 19)),
            suppliedChecksum: lines[19]
        };
    }, decodedText);
    expect(checksum.lineCount).toBe(21);
    expect(checksum.suppliedChecksum).toBe(checksum.checksum);
});

test('EPC QR uses the EPC 002 payload and can be decoded independently of UPN validation', async ({ page }) => {
    await page.locator('[data-bind="recipientName"]').fill('Christ Church Freiburg ERKWB e.V.');
    await page.locator('[data-bind="recipientIban"]').fill('DE60520604100005045835');
    await page.locator('[data-bind="purpose"]').fill('Spende');
    await page.locator('[data-bind="epcBic"]').fill('GENODEF1EK1');
    const qr = page.locator('#epc-qr-code img');
    await expect(qr).toHaveAttribute('data-qr-ecc', 'M');
    await expect(qr).toHaveAttribute('data-qr-eci', '26');
    const qrPixels = await readQrPixels(qr);
    const payload = decodeQrPixels(qrPixels).getText();
    expect(payload).toBe([
        'BCD',
        '002',
        '1',
        'SCT',
        'GENODEF1EK1',
        'CHRIST CHURCH FREIBURG ERKWB E.V.',
        'DE60520604100005045835',
        '',
        '',
        'SPENDE',
        '',
        ''
    ].join('\n'));
});

test('EPC QR encodes Slovenian text as UTF-8', async ({ page }) => {
    await page.locator('[data-bind="recipientName"]').fill('DRUŠTVO ČEBELICA');
    await page.locator('[data-bind="recipientIban"]').fill('SI56021400015556761');
    await page.locator('[data-bind="purpose"]').fill('DONACIJA ZA ČEBELE');

    const qr = page.locator('#epc-qr-code img');
    await expect(qr).toHaveAttribute('data-qr-eci', '26');
    const payload = decodeQrPixels(await readQrPixels(qr)).getText();
    expect(payload).toContain('DRUŠTVO ČEBELICA');
    expect(payload).toContain('DONACIJA ZA ČEBELE');
});

test('EPC QR validates the optional BIC and exports a separate PNG', async ({ page }) => {
    await page.locator('[data-bind="recipientName"]').fill('AMNESTY INTERNATIONAL DE');
    await page.locator('[data-bind="recipientIban"]').fill('DE23370205000008090100');
    await page.locator('[data-bind="epcBic"]').fill('INVALID');
    await expect(page.locator('#epc-qr-code')).toContainText('BIC mora imeti 8 ali 11 veljavnih znakov');
    await expect(page.locator('#epc-qr-code img')).toHaveCount(0);

    await page.locator('[data-bind="epcBic"]').fill('BFSWDE33XXX');
    await expect(page.locator('#epc-qr-code img')).toHaveCount(1);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-epc-qr-png').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('epc-sepa-qr-koda.png');
});

test('EPC QR panel adapts to a narrow mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await page.locator('.epc-qr-section').evaluate(section => ({
        width: section.getBoundingClientRect().width,
        scrollWidth: section.scrollWidth,
        columns: getComputedStyle(section).gridTemplateColumns,
        previewWidth: document.querySelector('#epc-qr-code').getBoundingClientRect().width
    }));

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);
    expect(layout.columns.split(' ').length).toBe(1);
    expect(layout.previewWidth).toBeLessThanOrEqual(300);
});

test('humanitarni nalog pocisti podatke placnika in opozori na manjkajoco referenco ob izvozu', async ({ page }) => {
    await fillValidPayment(page);
    await page.locator('[data-bind="payerName"]').fill('PODATEK, KI SE MORA IZBRISATI');
    await page.locator('label.check-humanitarian').click({ force: true });

    await expect(page.locator('[data-bind="payerName"]')).toHaveValue('');
    await expect(page.locator('[data-bind="payerIban"]')).toBeDisabled();
    await expect(page.locator('[data-bind="paymentDate"]')).toBeDisabled();
    await expect(page.locator('[data-bind="purposeCode"]')).toHaveValue('CHAR');
    await expect(page.locator('[data-bind="recipientRefCode"]')).toHaveValue('');
    await expect(page.locator('[data-bind="payerRefCode"]')).toHaveValue('');
    await expect(page.locator('[data-bind="polog"]')).not.toBeChecked();
    await expect(page.locator('[data-bind="dvig"]')).not.toBeChecked();
    await expect(page.locator('#qr-code img')).toHaveCount(0);
    await expect(page.locator('#badge-recipient-ref')).toHaveText('obvezno');
    await expect(page.locator('#global-warning-box')).toBeHidden();

    await page.locator('#btn-qr-png').click();
    await expect(page.locator('#global-warning-box')).toBeVisible();
    await expect(page.locator('#global-warning-list')).toContainText('Referenca prejemnika');

    await page.locator('[data-bind="recipientRefCode"]').selectOption('SI00');
    await page.locator('[data-bind="recipientRef"]').fill('12345');
    await expect(page.locator('#qr-code img')).toHaveCount(1);
});

test('izbira humanitarnega nacina brez izbrane kode namena nastavi CHAR', async ({ page }) => {
    await page.locator('label.check-humanitarian').click({ force: true });
    await expect(page.locator('[data-bind="purposeCode"]')).toHaveValue('CHAR');
    await expect(page.locator('#payment-date-field')).toBeHidden();
    await expect(page.locator('[data-bind="paymentDate"]')).toBeDisabled();
    await expect(page.locator('[data-bind="dueDate"]')).toBeVisible();
    await expect(page.locator('[data-bind="dueDate"]')).toBeEnabled();
    await expect(page.locator('[data-bind="dueDate"]')).toHaveValue('');
    await expect(page.locator('[data-bind="purpose"]')).toHaveValue('DONACIJA');
    await expect(page.locator('[data-bind="polog"]')).not.toBeChecked();
    await expect(page.locator('[data-bind="dvig"]')).not.toBeChecked();
    await expect(page.locator('[data-bind="recipientRefCode"]')).toHaveValue('');

    await page.locator('label.check-humanitarian').click({ force: true });
    await expect(page.locator('#payment-date-field')).toBeVisible();
    await expect(page.locator('[data-bind="paymentDate"]')).toBeEnabled();
});

test('humanitarni nacin ne prepise ze vpisanega namena', async ({ page }) => {
    await page.locator('[data-bind="purpose"]').fill('POMOC DRUZINAM');
    await page.locator('label.check-humanitarian').click({ force: true });
    await expect(page.locator('[data-bind="purposeCode"]')).toHaveValue('CHAR');
    await expect(page.locator('[data-bind="purpose"]')).toHaveValue('POMOC DRUZINAM');
});

test('humanitarna referenca ima kratko pojasnilo in je ne izmisli aplikacija', async ({ page }) => {
    await expect(page.locator('#humanitarian-reference-hint')).toBeHidden();
    await page.locator('label.check-humanitarian').click({ force: true });

    await expect(page.locator('#humanitarian-reference-hint')).toBeVisible();
    await expect(page.locator('#humanitarian-reference-hint')).toHaveText(
        'Za prosto številčno vsebino (npr. 12345) izberite SI00. Vpišite sklic, ki ga je določil izdajatelj.'
    );
    await expect(page.locator('#pop-recipient-ref')).toContainText('registrirani izdajatelj');
    await expect(page.locator('#pop-recipient-ref')).toContainText('Ne uporabljajte naključnega ali tujega sklica');
    await expect(page.locator('[data-bind="recipientRefCode"]')).toHaveValue('');
    await expect(page.locator('[data-bind="recipientRef"]')).toHaveValue('');
});

test('obnovljen humanitarni nalog dobi privzeti namen in skrit datum', async ({ page }) => {
    await page.evaluate(async () => {
        const { Storage } = await import('/js/storage.js');
        Storage.flush();
        localStorage.setItem('upn_studio_2026_data', JSON.stringify({
            humanitarno: true,
            purposeCode: 'GDSV',
            purpose: ''
        }));
    });
    await page.reload();

    await expect(page.locator('[data-bind="purposeCode"]')).toHaveValue('CHAR');
    await expect(page.locator('[data-bind="purpose"]')).toHaveValue('DONACIJA');
    await expect(page.locator('#payment-date-field')).toBeHidden();
    await expect(page.locator('[data-bind="paymentDate"]')).toBeDisabled();
    await expect(page.locator('[data-bind="nujno"]')).toBeDisabled();
    await expect(page.locator('#urgency-mode-hint')).toHaveText(
        'Oznake »Nujno« po navodilih ZBS ni dovoljeno uporabiti pri humanitarnem nalogu.'
    );
});

test('polog in dvig se izkljucujeta, polja sledijo izbranemu nacinu', async ({ page }) => {
    await page.locator('label.check-label').filter({ hasText: 'Polog' }).click({ force: true });
    await expect(page.locator('[data-bind="payerIban"]')).toBeDisabled();
    await expect(page.locator('[data-bind="payerRefCode"]')).toBeDisabled();
    await expect(page.locator('[data-bind="payerRef"]')).toBeDisabled();
    await expect(page.locator('[data-bind="nujno"]')).toBeDisabled();
    await expect(page.locator('#urgency-mode-hint')).toHaveText(
        'Oznake »Nujno« po navodilih ZBS ni dovoljeno uporabiti pri pologu gotovine.'
    );
    await expect(page.locator('[data-bind="dueDate"]')).toBeDisabled();

    await page.locator('label.check-label').filter({ hasText: 'Dvig' }).click({ force: true });
    await expect(page.locator('[data-bind="polog"]')).not.toBeChecked();
    await expect(page.locator('[data-bind="dvig"]')).toBeChecked();
    await expect(page.locator('[data-bind="recipientIban"]')).toBeDisabled();
    await expect(page.locator('[data-bind="recipientName"]')).toBeEnabled();
    await expect(page.locator('[data-bind="recipientAddress"]')).toBeEnabled();
    await expect(page.locator('[data-bind="recipientCity"]')).toBeEnabled();
    await expect(page.locator('#badge-recipient-name')).toHaveText('neobvezno');
    await expect(page.locator('#badge-recipient-address')).toHaveText('neobvezno');
    await expect(page.locator('#badge-recipient-city')).toHaveText('neobvezno');
    await expect(page.locator('[data-bind="nujno"]')).toBeDisabled();
    await expect(page.locator('#urgency-mode-hint')).toHaveText(
        'Oznake »Nujno« po navodilih ZBS ni dovoljeno uporabiti pri dvigu gotovine.'
    );
    await expect(page.locator('[data-bind="payerRefCode"]')).toBeEnabled();
});

test('polog zahteva datum, dvig pa racun placnika in ne prejemnika', async ({ page }) => {
    await fillValidPayment(page);
    await page.locator('label.check-label').filter({ hasText: 'Polog' }).click({ force: true });
    await page.locator('[data-bind="paymentDate"]').fill('');
    await expect(page.locator('#qr-code img')).toHaveCount(0);
    await expect(page.locator('#global-warning-list')).toContainText('Datum plačila je obvezen');
    await page.locator('[data-bind="paymentDate"]').fill('2026-10-15');
    await expect(page.locator('#qr-code img')).toHaveCount(1);

    await page.locator('label.check-label').filter({ hasText: 'Dvig' }).click({ force: true });
    await page.locator('[data-bind="payerIban"]').fill('SI56010000000000083');
    await expect(page.locator('[data-bind="recipientIban"]')).toBeDisabled();
    await page.locator('[data-bind="recipientName"]').fill('');
    await page.locator('[data-bind="recipientAddress"]').fill('');
    await page.locator('[data-bind="recipientCity"]').fill('');
    await expect(page.locator('#qr-code img')).toHaveCount(1);
});

test('namen in koda namena sta oznacena kot obvezna', async ({ page }) => {
    await expect(page.locator('#badge-purpose')).toHaveText('obvezno');
    await expect(page.locator('#badge-purpose-code')).toHaveText('obvezno');
});

test('predogled potrdila prikaze vse tri vrstice prejemnika', async ({ page }) => {
    await fillValidPayment(page);
    const recipientName = 'R'.repeat(33);
    const recipientAddress = 'A'.repeat(33);
    const recipientCity = 'C'.repeat(33);
    await page.locator('[data-bind="recipientName"]').fill(recipientName);
    await page.locator('[data-bind="recipientAddress"]').fill(recipientAddress);
    await page.locator('[data-bind="recipientCity"]').fill(recipientCity);

    const recipientDetails = await page.locator('.a12').innerText();
    expect(recipientDetails).toContain(recipientName);
    expect(recipientDetails).toContain(recipientAddress);
    expect(recipientDetails).toContain(recipientCity);

    const layout = await page.locator('.a12').evaluate(element => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return {
            fieldWidth: element.getBoundingClientRect().width,
            lineWidths: Array.from(range.getClientRects(), rect => rect.width).filter(width => width > 0)
        };
    });
    expect(layout.lineWidths).toHaveLength(3);
    expect(layout.lineWidths.every(width => width <= layout.fieldWidth)).toBe(true);
});

test('mobilni UPN se lahko vodoravno pomakne do obeh robov', async ({ page }) => {
    const wrapper = page.locator('.upn-wrap');
    await expect(wrapper).toHaveAttribute('role', 'region');
    await expect(wrapper).toHaveAttribute('tabindex', '0');
    await page.setViewportSize({ width: 320, height: 900 });
    await wrapper.focus();
    await page.keyboard.press('ArrowRight');
    expect(await wrapper.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);

    for (const width of [320, 375, 430, 640, 800]) {
        await page.setViewportSize({ width, height: 900 });
        const layout = await wrapper.evaluate(element => {
            const slip = element.querySelector('.upn');
            const wrapperBounds = element.getBoundingClientRect();
            element.scrollLeft = 0;
            const left = slip.getBoundingClientRect();
            const maxScroll = element.scrollWidth - element.clientWidth;
            element.scrollLeft = maxScroll;
            const right = slip.getBoundingClientRect();
            return {
                wrapperLeft: wrapperBounds.left,
                wrapperRight: wrapperBounds.right,
                maxScroll,
                slipWidth: left.width,
                leftAtStart: left.left,
                rightAtEnd: right.right
            };
        });

        expect(layout.maxScroll).toBeGreaterThan(0);
        expect(layout.slipWidth).toBeCloseTo(210 * 96 / 25.4, 0);
        expect(layout.leftAtStart).toBeGreaterThanOrEqual(layout.wrapperLeft);
        expect(layout.rightAtEnd).toBeLessThanOrEqual(layout.wrapperRight);
    }

    await page.setViewportSize({ width: 1000, height: 900 });
    const fittedLayout = await wrapper.evaluate(element => {
        const slip = element.querySelector('.upn').getBoundingClientRect();
        const bounds = element.getBoundingClientRect();
        return {
            maxScroll: element.scrollWidth - element.clientWidth,
            leftGap: slip.left - bounds.left,
            rightGap: bounds.right - slip.right
        };
    });
    expect(fittedLayout.maxScroll).toBe(0);
    expect(Math.abs(fittedLayout.leftGap - fittedLayout.rightGap)).toBeLessThan(1);
});

test('SI99 pomeni izrecno brez sklica, v humanitarnem nacinu pa ne nadomesti obveznega sklica', async ({ page }) => {
    await fillValidPayment(page);
    await page.locator('[data-bind="recipientRefCode"]').selectOption('SI99');
    await expect(page.locator('[data-bind="recipientRef"]')).toBeDisabled();
    await expect(page.locator('#qr-code img')).toHaveCount(1);

    await page.locator('label.check-humanitarian').click({ force: true });
    await expect(page.locator('[data-bind="recipientRef"]')).toBeDisabled();
    await expect(page.locator('[data-bind="recipientRefCode"]')).toHaveValue('SI99');
    await expect(page.locator('#qr-code img')).toHaveCount(0);

    await expect(page.locator('#global-warning-box')).toBeHidden();
    await page.locator('#btn-qr-png').click();
    await expect(page.locator('#global-warning-list')).toContainText('Referenca prejemnika');
});

test('izbirnik prikaze modele SI01 in omeji modele za FURS ter sistem EZR', async ({ page }) => {
    await page.goto('/');
    const models = await page.evaluate(() => ['payerRefCode', 'recipientRefCode'].map(field => {
        const select = document.querySelector(`[data-bind="${field}"]`);
        return Object.fromEntries(['SI00', 'SI01', 'SI05', 'SI12', 'SI99', 'SI22', 'SI32', 'SI58'].map(value => {
            const option = select.querySelector(`option[value="${value}"]`);
            return [value, { exists: !!option, disabled: option?.disabled ?? null }];
        }));
    }));

    for (const select of models) {
        for (const model of ['SI00', 'SI01', 'SI05', 'SI12', 'SI99']) {
            expect(select[model]).toEqual({ exists: true, disabled: false });
        }
        for (const model of ['SI22', 'SI32', 'SI58']) {
            expect(select[model]).toEqual({ exists: true, disabled: true });
        }
    }
});

test('celotna prilepljena SI ali RF referenca samodejno nastavi svoj model', async ({ page }) => {
    await fillValidPayment(page);
    await page.locator('[data-bind="recipientRef"]').fill('SI00 225268-32526-222');
    await expect(page.locator('[data-bind="recipientRefCode"]')).toHaveValue('SI00');
    await expect(page.locator('[data-bind="recipientRef"]')).toHaveValue('225268-32526-222');
    await expect(page.locator('#qr-code img')).toHaveCount(1);

    await page.locator('[data-bind="recipientRef"]').fill('RF45 SBO2 010');
    await expect(page.locator('[data-bind="recipientRefCode"]')).toHaveValue('RF');
    await expect(page.locator('[data-bind="recipientRef"]')).toHaveValue('45 SBO2 010');
    await expect(page.locator('#qr-code img')).toHaveCount(1);
});

test('carobna palcka za RF izracuna kontrolni del brez podvajanja predpone', async ({ page }) => {
    await fillValidPayment(page);
    await page.locator('[data-bind="recipientRefCode"]').selectOption('RF');
    await page.locator('[data-bind="recipientRef"]').fill('SBO2010');
    await expect(page.locator('#magic-wand-recipient')).toBeVisible();
    await page.locator('#magic-wand-recipient').click();

    await expect(page.locator('[data-bind="recipientRef"]')).toHaveValue('45SBO2010');
    await expect(page.locator('#qr-code img')).toHaveCount(1);
});

test('najvecja dolzina dovoljenih polj ustvari QR brez krajsanja', async ({ page }) => {
    await fillValidPayment(page);
    await page.locator('[data-bind="payerName"]').fill('A'.repeat(33));
    await page.locator('[data-bind="payerAddress"]').fill('P'.repeat(33));
    await page.locator('[data-bind="payerCity"]').fill('K'.repeat(33));
    await page.locator('[data-bind="recipientName"]').fill('R'.repeat(33));
    await page.locator('[data-bind="recipientAddress"]').fill('S'.repeat(33));
    await page.locator('[data-bind="recipientCity"]').fill('T'.repeat(33));
    await page.locator('[data-bind="purpose"]').fill('N'.repeat(42));

    await expect(page.locator('#qr-code img')).toHaveCount(1);
});

test('generator zavrne vsebino nad skupno omejitvijo 411 bajtov', async ({ page }) => {
    await fillValidPayment(page);
    const result = await page.evaluate(async () => {
        const [{ Store }, { QR }] = await Promise.all([
            import('/js/store.js'),
            import('/js/qr.js')
        ]);
        Store.payerRefCode = 'SI00';
        Store.payerRef = '1'.repeat(400);
        return QR.generate();
    });

    expect(result).toBe(false);
    await expect(page.locator('#qr-code img')).toHaveCount(0);
    await expect(page.locator('#qr-code')).toContainText('411 bajtov');
});

test('ime, naslov in kraj placnika so obvezni pri placilu', async ({ page }) => {
    await fillValidPayment(page);
    await page.locator('[data-bind="payerAddress"]').fill('');
    await expect(page.locator('#qr-code img')).toHaveCount(0);
    await expect(page.locator('#global-warning-list')).toContainText('Naslov plačnika je obvezen');

    await page.locator('[data-bind="payerAddress"]').fill('CESTA 1');
    await page.locator('[data-bind="payerCity"]').fill('');
    await expect(page.locator('#qr-code img')).toHaveCount(0);
    await expect(page.locator('#global-warning-list')).toContainText('Poštna številka in kraj plačnika sta obvezna');
});

test('koda namena se ne ugiba za navadno placilo, rok pa se ne izmisli', async ({ page }) => {
    await fillValidPayment(page);
    await expect(page.locator('[data-bind="dueDate"]')).toHaveValue('');
    await page.locator('[data-bind="purposeCode"]').selectOption('');
    await expect(page.locator('#qr-code img')).toHaveCount(0);
    await expect(page.locator('#global-warning-list')).toContainText('Koda namena je obvezna');
});

test('izbirnik vsebuje celoten javni sifrant ZBS in zavrne neznano kodo', async ({ page }) => {
    await fillValidPayment(page);
    const select = page.locator('[data-bind="purposeCode"]');
    await expect(select.locator('option')).toHaveCount(294);
    await expect(select.locator('option[value="ADCS"]')).toContainText('Don.');

    const result = await page.evaluate(async () => {
        const [{ Store }, { Validator }] = await Promise.all([
            import('/js/store.js'),
            import('/js/validator.js')
        ]);
        Store.purposeCode = 'ZZZZ';
        return Validator.validateForm(Store);
    });
    expect(result).toContainEqual({ field: 'purposeCode', msg: 'Izbrana koda namena ni na veljavnem šifrantu ZBS.' });
});

test('veljaven UPN QR je mogoce izvoziti kot PNG', async ({ page }) => {
    await fillValidPayment(page);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-qr-png').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('upn-qr-koda.png');
});

test('nicelni znesek blokira obicajno placilo', async ({ page }) => {
    await fillValidPayment(page);
    await page.locator('[data-bind="amount"]').fill('0');
    await expect(page.locator('#qr-code img')).toHaveCount(0);
    await expect(page.locator('#global-warning-list')).toContainText('Znesek mora biti večji od nič');
});

test('povezava v footerju odpre informacije o aplikaciji', async ({ page }) => {
    await page.locator('.app-footer a[href="#about-app"]').click();

    const about = page.locator('#about-app');
    await expect(about).toHaveAttribute('open', '');
    await expect(about).toContainText('Podatki plačil se ne pošiljajo strežniku');
    await expect(about).toContainText('UPN in EPC QR');
    await expect(about).toContainText('Nayuki QR Code generator 1.8.0');
    await expect(about).toContainText('pdf-lib 1.17.1');
    await expect(about).toContainText('Inter 5.3.0');
    await expect(about).toContainText('brezplačen dostop ni isto kot dovoljenje za komercialno uporabo');
    await expect(about).toContainText('ukinile brezplačno preverjanje');
    await expect(about).toContainText('31. 12. 2022');
    await expect(about.locator('a[href*="ukinjajo-storitev-brezplacnega-preverjanja"]')).toHaveAttribute(
        'href',
        'https://www.zbs-giz.si/banke-in-hranilnice-s-1-1-2023-ukinjajo-storitev-brezplacnega-preverjanja-pravilnosti-qr-kode-na-obrazcu-upnqr/'
    );

    const qrFormatInfo = page.locator('.wiki-details').filter({ hasText: 'Tehnična oblika kode UPNQR' });
    await qrFormatInfo.locator('summary').click();
    await expect(qrFormatInfo).toContainText('20 vrstic v določenem vrstnem redu');
    await expect(qrFormatInfo).toContainText('ločen EPC QR');
    await expect(qrFormatInfo).toContainText('podpora N26 ali druge banke ni zagotovljena');
});

test('velikost QR kode na obrazcu ustreza meram iz navodil ZBS', async ({ page }) => {
    const dimensions = await page.locator('.qr-placeholder').evaluate(element => {
        const style = getComputedStyle(element);
        return {
            width: parseFloat(style.width) * 25.4 / 96,
            height: parseFloat(style.height) * 25.4 / 96
        };
    });

    expect(dimensions.width).toBeCloseTo(35.98333, 2);
    expect(dimensions.height).toBeCloseTo(35.98333, 2);
});

test('pregledovalnika UPN in EPC omogocata preklop med tabelo in dobesednim surovim besedilom', async ({ page }) => {
    await fillValidPayment(page);

    // 1. Odpri UPN pregledovalnik
    await page.locator('#btn-qr-more').click();
    await page.locator('#btn-toggle-upn-inspect').click();
    const upnInspect = page.locator('#upn-qr-inspect');
    await expect(upnInspect).toBeVisible();

    // Privzeto je aktivna tabela
    await expect(upnInspect.locator('.qr-switch-btn[data-view="table"]')).toHaveClass(/active/);
    await expect(upnInspect.locator('#upn-qr-inspect-content')).toBeVisible();
    await expect(upnInspect.locator('#upn-qr-inspect-raw-wrap')).toBeHidden();

    // Preklopi na surovo besedilo
    await upnInspect.locator('.qr-switch-btn[data-view="raw"]').click();
    await expect(upnInspect.locator('#upn-qr-inspect-content')).toBeHidden();
    await expect(upnInspect.locator('#upn-qr-inspect-raw-wrap')).toBeVisible();

    // Preveri, da je čisto surovo besedilo (brez številk vrstic)
    const upnRawPre = upnInspect.locator('#upn-qr-inspect-raw-lines pre');
    await expect(upnRawPre).toBeVisible();
    await expect(upnRawPre).toContainText('UPNQR');

    // 2. Odpri EPC pregledovalnik
    await page.locator('#btn-toggle-epc-inspect').click();
    const epcInspect = page.locator('#epc-qr-inspect');
    await expect(epcInspect).toBeVisible();

    // Preklopi na surovo besedilo
    await epcInspect.locator('.qr-switch-btn[data-view="raw"]').click();
    await expect(epcInspect.locator('#epc-qr-inspect-content')).toBeHidden();
    await expect(epcInspect.locator('#epc-qr-inspect-raw-wrap')).toBeVisible();

    // Preveri, da je čisto surovo besedilo (BCD, 002, 1, SCT...)
    const epcRawPre = epcInspect.locator('#epc-qr-inspect-raw-lines pre');
    await expect(epcRawPre).toBeVisible();
    await expect(epcRawPre).toContainText('BCD');
    await expect(epcRawPre).toContainText('002');
    await expect(epcRawPre).toContainText('SCT');
});