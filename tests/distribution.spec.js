const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const distributionRoot = path.resolve(__dirname, '..', 'dist');

function getFiles(directory, prefix = '') {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const relativePath = path.join(prefix, entry.name);
        const absolutePath = path.join(directory, entry.name);
        return entry.isDirectory()
            ? getFiles(absolutePath, relativePath)
            : [relativePath];
    });
}

test('distribucijski paket vsebuje celoten runtime brez razvojnih datotek', () => {
    const files = getFiles(distributionRoot);
    const serviceWorker = fs.readFileSync(path.join(distributionRoot, 'sw.js'), 'utf8');
    const precachedPaths = [...serviceWorker.matchAll(/'(\.\/[^']*)'/g)]
        .map(([, assetPath]) => assetPath)
        .filter(assetPath => assetPath !== './');
    const totalBytes = files.reduce(
        (total, relativePath) => total + fs.statSync(path.join(distributionRoot, relativePath)).size,
        0
    );

    expect(files).toContain('index.html');
    expect(files).toContain('.nojekyll');
    expect(files).toContain('manifest.json');
    expect(files).toContain(path.join('js', 'epc-qr.js'));
    expect(files).toContain(path.join('js', 'batch-import.js'));
    expect(files).toContain(path.join('examples', 'primer-vec-nalogov.csv'));
    expect(files).toContain(path.join('examples', 'primer-vec-nalogov.json'));
    expect(files).toContain(path.join('assets', 'logo.svg'));
    expect(files).toContain(path.join('assets', 'icon-192.png'));
    expect(files).toContain(path.join('assets', 'icon-512.png'));
    expect(files).toContain('LICENSE');
    expect(files.every(file => !/(^|[\\/])(tests|node_modules)([\\/]|$)/.test(file))).toBe(true);
    expect(files.every(file => !/(^|[\\/])\.local([\\/]|$)/.test(file))).toBe(true);
    expect(files.some(file => /(^|[\\/])(README|package-lock|playwright\.config|QR-ANALIZA)/i.test(file))).toBe(false);
    expect(totalBytes).toBeLessThan(3 * 1024 * 1024);

    for (const assetPath of precachedPaths) {
        expect(fs.existsSync(path.join(distributionRoot, assetPath))).toBe(true);
    }
});
