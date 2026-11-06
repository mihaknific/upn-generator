const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const outputRoot = path.join(projectRoot, 'dist');
const runtimeFiles = [
    '.nojekyll',
    'index.html',
    'manifest.json',
    'sw.js',
    'assets/logo.svg',
    'assets/icon-192.png',
    'assets/icon-512.png',
    'examples/primer-vec-nalogov.csv',
    'examples/primer-vec-nalogov.json',
    'LICENSE',
    'css/style.css',
    'css/wiki.css',
    'fonts/inter.css',
    'fonts/inter/OFL.txt',
    'fonts/inter/inter-latin-400-normal.woff2',
    'fonts/inter/inter-latin-500-normal.woff2',
    'fonts/inter/inter-latin-600-normal.woff2',
    'fonts/inter/inter-latin-700-normal.woff2',
    'fonts/inter/inter-latin-ext-400-normal.woff2',
    'fonts/inter/inter-latin-ext-500-normal.woff2',
    'fonts/inter/inter-latin-ext-600-normal.woff2',
    'fonts/inter/inter-latin-ext-700-normal.woff2',
    'js/app.js',
    'js/batch-import.js',
    'js/store.js',
    'js/render.js',
    'js/validator.js',
    'js/storage.js',
    'js/export.js',
    'js/qr.js',
    'js/epc-qr.js',
    'js/wiki.js',
    'js/wiki-data.js',
    'js/purpose-codes.js',
    'js/utils.js',
    'js/vendor/THIRD-PARTY-NOTICES.txt',
    'js/vendor/LICENSE-modern-screenshot-MIT.txt',
    'js/vendor/LICENSE-pdf-lib-MIT.md',
    'js/vendor/qrcodegen-nayuki-v1.8.0-es6.js',
    'js/vendor/modern-screenshot-4.6.8.min.js',
    'js/vendor/pdf-lib-1.17.1.min.js',
    'js/vendor/fontkit-1.1.1.umd.min.js',
    'myriad-pro-webfont/MYRIADPRO-SEMIBOLD.woff',
    'myriad-pro-webfont/Myriad Pro Semibold.ttf'
];

if (outputRoot === projectRoot || !outputRoot.startsWith(`${projectRoot}${path.sep}`)) {
    throw new Error('Build output must remain inside the project dist directory.');
}

fs.rmSync(outputRoot, { recursive: true, force: true });

for (const relativePath of runtimeFiles) {
    const sourcePath = path.join(projectRoot, relativePath);
    const destinationPath = path.join(outputRoot, relativePath);

    if (!fs.statSync(sourcePath).isFile()) {
        throw new Error(`Required runtime file is not a file: ${relativePath}`);
    }

    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(sourcePath, destinationPath);
}

const totalBytes = runtimeFiles.reduce(
    (total, relativePath) => total + fs.statSync(path.join(outputRoot, relativePath)).size,
    0
);

console.log(`Built ${runtimeFiles.length} runtime files (${(totalBytes / 1024 / 1024).toFixed(2)} MiB) in dist/.`);
