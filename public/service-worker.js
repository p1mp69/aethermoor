const CACHE='aethermoor-v5';const ASSETS=['/','/index.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));}));});
self.addEventListener('fetch',e=>{if(e.request.url.includes('/ws')||e.request.method!=='GET')return;e.respondWith(fetch(e.request).catch(function(){return caches.match(e.request);}));});
