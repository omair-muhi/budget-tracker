const FILES_TO_CACHE = [
    "/",
    "/index.html",
    "/index.js",
    "/styles.css",
    "/icons/icon-192x192.png",
    "/icons/icon-512x512.png"
];
const CACHE_NAME = 'static-cache-v1';
const DATA_CACHE_NAME = 'data-cache-v1';

// install
self.addEventListener("install", function(evt) {
    // pre cache transaction data
    evt.waitUntil(
        caches.open(DATA_CACHE_NAME).then((cache) => cache.add("/api/transaction"))
    );

    // pre cache all static assets
    console.log("Pre-cache all static assets")
    evt.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
    );

    // tell the browser to activate this service worker immediately once it
    // has finished installing
    self.skipWaiting();
});

// activate
self.addEventListener("activate", function(evt) {
    evt.waitUntil(
        caches.keys().then(keyList => {
            return Promise.all(
                keyList.map(key => {
                    if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
                        console.log("Removing old cache data", key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );

    self.clients.claim();
});

// intercept network requests
self.addEventListener('fetch', function(evt) {
    if (evt.request.url.includes("/api/transaction")) {
        console.log("Service-Worker recv'd FETCH");
        if (evt.request.method == 'GET') {
            console.log("Service-Worker recv'd GET");
            evt.respondWith(
                caches.open(DATA_CACHE_NAME).then(cache => {
                    return fetch(evt.request)
                        .then(response => {
                            // If the response was good, clone it and store it in the cache.
                            if (response.status === 200) {
                                cache.put(evt.request.url, response.clone());
                            }

                            return response;
                        })
                        .catch(err => {
                            // Network request failed, try to get it from the cache.
                            console.log("Network request failed");
                            console.log(err);
                            return cache.match(evt.request);
                        });
                }).catch(err => {
                    console.log("Failed to open cache");
                    console.log(err);
                })
            );
            // } else if (evt.request.method == 'POST') {
            // console.log("Service-Worker recv'd POST");
        }
    } else {
        // serve static assets
        console.log("Service-Worker serving static assets");
        evt.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(evt.request).then(response => {
                    return response || fetch(evt.request);
                });
            })
        );
    }
});