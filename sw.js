const CACHE_NAME = "rasheed-platform-v1";
const STATIC_FILES=["./index.html","./manifest.webmanifest","./assets/logos/rasheed-platform-mark.png","./assets/icons/icon-192.png","./assets/icons/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(STATIC_FILES)));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;if(e.request.mode==="navigate"||u.pathname.endsWith(".html")){e.respondWith(fetch(e.request).catch(()=>caches.match("./index.html")));return;}e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
