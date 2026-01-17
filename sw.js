const CACHE_NAME = 'collection-tracker-v8';
const ASSETS = [
    './',
    './offline_tracker.html',
    './index.html',
    './manifest.json',
    './icon.png',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});
