const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    timeout: 60000,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: 'http://127.0.0.1:4173',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        serviceWorkers: 'block',
        ...devices['Desktop Chrome']
    },
    workers: 2,
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        {
            name: 'firefox',
            testMatch: '**/cross-browser.spec.js',
            use: { ...devices['Desktop Firefox'] }
        },
        {
            name: 'webkit',
            testMatch: '**/cross-browser.spec.js',
            use: { ...devices['Desktop Safari'] }
        }
    ],
    webServer: {
        command: 'node tests/server.cjs dist /upn-generator',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 10000
    }
});