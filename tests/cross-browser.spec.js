const { test, expect } = require('@playwright/test');

test('obrazec in ustvarjanje UPN QR delujeta v brskalniku', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('UPN QR Studio');
    await expect(page.locator('#upn-form')).toBeVisible();
    await expect(page.locator('h1')).toHaveCSS('font-family', /Inter/);

    const fields = {
        payerName: 'ANA NOVAK',
        payerAddress: 'CESTA 1',
        payerCity: '1000 LJUBLJANA',
        recipientName: 'DRUSTVO ZA PRIMER',
        recipientAddress: 'GLAVNA ULICA 1',
        recipientCity: '1000 LJUBLJANA',
        recipientIban: 'GB82 WEST 1234 5698 7654 32',
        amount: '12.34',
        purpose: 'DONACIJA'
    };

    for (const [field, value] of Object.entries(fields)) {
        await page.locator(`[data-bind="${field}"]`).fill(value);
    }
    await page.locator('[data-bind="purposeCode"]').selectOption('GDSV');

    const qr = page.locator('#qr-code img');
    await expect(qr).toHaveAttribute('data-qr-version', '15');
    await expect(qr).toHaveAttribute('data-qr-eci', '4');

    await expect(page.locator('#epc-qr-code img')).toHaveCount(1);
});
