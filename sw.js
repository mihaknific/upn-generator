const CACHE_NAME = 'upn-studio-v18';
const ASSETS = [
    './',
    './index.html',
    './assets/logo.svg',
    './manifest.json',
    './assets/icon-192.png',
    './assets/icon-512.png',
    './examples/primer-vec-nalogov.csv',
    './examples/primer-vec-nalogov.json',
    './fonts/inter.css',
    './fonts/inter/inter-latin-400-normal.woff2',
    './fonts/inter/inter-latin-500-normal.woff2',
    './fonts/inter/inter-latin-600-normal.woff2',
    './fonts/inter/inter-latin-700-normal.woff2',
    './fonts/inter/inter-latin-ext-400-normal.woff2',
    './fonts/inter/inter-latin-ext-500-normal.woff2',
    './fonts/inter/inter-latin-ext-600-normal.woff2',
    './fonts/inter/inter-latin-ext-700-normal.woff2',
    './css/style.css',
    './css/wiki.css',
    './js/app.js',
    './js/batch-import.js',
    './js/store.js',
    './js/render.js',
    './js/validator.js',
    './js/storage.js',
    './js/export.js',
    './js/qr.js',
    './js/epc-qr.js',
    './js/wiki.js',
    './js/wiki-data.js',
    './js/purpose-codes.js',
    './js/utils.js',
    './js/vendor/qrcodegen-nayuki-v1.8.0-es6.js',
    './js/vendor/modern-screenshot-4.6.8.min.js',
    './js/vendor/pdf-lib-1.17.1.min.js',
    './js/vendor/fontkit-1.1.1.umd.min.js',
    './myriad-pro-webfont/MYRIADPRO-SEMIBOLD.woff',
    './myriad-pro-webfont/Myriad Pro Semibold.ttf'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys
                .filter(key => key.startsWith('upn-studio-') && key !== CACHE_NAME)
                .map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    if (new URL(event.request.url).origin !== self.location.origin) return;

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;

            return fetch(event.request).then(response => {
                if (response.ok && response.type === 'basic') {
                    const responseToCache = response.clone();
                    event.waitUntil(
                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(event.request, responseToCache))
                    );
                }
                return response;
            });
        })
    );
});
