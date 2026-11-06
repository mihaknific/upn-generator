const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'allow' });

test('service worker se aktivira in predpomni vsa navedena sredstva', async ({ page }) => {
    await page.goto('/');

    await expect.poll(async () => page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.active?.state || registration?.installing?.state || 'not registered';
    }), { timeout: 15000 }).toBe('activated');

    const cacheState = await page.evaluate(async () => {
        const cacheName = (await caches.keys()).find(key => key.startsWith('upn-studio-'));
        if (!cacheName) return null;
        const cache = await caches.open(cacheName);
        const serviceWorker = await fetch('./sw.js').then(response => response.text());
        const assets = [...serviceWorker.matchAll(/'(\.\/[^']*)'/g)]
            .map(([, asset]) => asset)
            .filter(asset => asset !== './');
        const cachedAssets = await Promise.all(assets.map(async asset => {
            const response = await cache.match(new URL(asset, location.href).href);
            return [asset, !!response];
        }));
        return { cacheName, cachedAssets };
    });

    expect(cacheState).not.toBeNull();
    expect(cacheState.cacheName).toBe('upn-studio-v18');
    expect(Object.fromEntries(cacheState.cachedAssets)).toMatchObject({
        './index.html': true,
        './css/style.css': true,
        './assets/logo.svg': true,
        './assets/icon-192.png': true,
        './assets/icon-512.png': true,
        './examples/primer-vec-nalogov.csv': true,
        './examples/primer-vec-nalogov.json': true,
        './js/vendor/qrcodegen-nayuki-v1.8.0-es6.js': true,
        './js/batch-import.js': true,
        './js/epc-qr.js': true
    });
    expect(cacheState.cachedAssets.every(([, cached]) => cached)).toBe(true);
});

test('naložena aplikacija se ponovno odpre brez omrežne povezave', async ({ page }) => {
    await page.goto('/');
    await expect.poll(() => page.evaluate(() =>
        navigator.serviceWorker.controller?.state || 'not controlled'
    ), { timeout: 15000 }).toBe('activated');

    await page.context().setOffline(true);
    await page.reload();

    await expect(page).toHaveTitle('UPN QR Studio');
    await expect(page.locator('#upn-form')).toBeVisible();
    await expect(page.locator('#btn-qr-png')).toBeVisible();
});

test('aktivacija nove različice odstrani stari predpomnilnik', async ({ page }) => {
    await page.goto('/');
    await expect.poll(() => page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.active?.state || registration?.installing?.state || 'not registered';
    }), { timeout: 15000 }).toBe('activated');

    await page.evaluate(async () => {
        await caches.open('upn-studio-v2');
        const registration = await navigator.serviceWorker.getRegistration();
        await registration.unregister();
    });
    const context = page.context();
    await page.close();

    const updatePage = await context.newPage();
    await updatePage.goto('/');
    await expect.poll(() => updatePage.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.active?.state || registration?.installing?.state || 'not registered';
    }), { timeout: 15000 }).toBe('activated');

    await expect.poll(() => updatePage.evaluate(() => caches.keys())).toEqual(['upn-studio-v18']);
});

test('PWA sredstva in servisni delavec delujejo pod projektno potjo GitHub Pages', async ({ page }) => {
    await page.goto('/upn-generator/');

    await expect.poll(() => page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.active?.state || registration?.installing?.state || 'not registered';
    }), { timeout: 15000 }).toBe('activated');

    const paths = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        const manifest = await fetch('./manifest.json').then(response => response.json());
        return {
            page: location.pathname,
            serviceWorker: new URL(registration.active.scriptURL).pathname,
            scope: new URL(registration.scope).pathname,
            startUrl: new URL(manifest.start_url, location.href).pathname,
            style: getComputedStyle(document.querySelector('h1')).fontFamily
        };
    });

    expect(paths.page).toBe('/upn-generator/');
    expect(paths.serviceWorker).toBe('/upn-generator/sw.js');
    expect(paths.scope).toBe('/upn-generator/');
    expect(paths.startUrl).toBe('/upn-generator/index.html');
    expect(paths.style).toContain('Inter');

    await page.context().setOffline(true);
    await page.reload();
    await expect(page).toHaveTitle('UPN QR Studio');
    await expect(page.locator('#upn-form')).toBeVisible();
});
