/* FORGE / 8 PWA Service Worker v5.1 */
const VERSION='5.1',PREFIX='forge-standalone-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-',CACHE=PREFIX+VERSION;
const ASSETS=['index.html','manifest.webmanifest','assets/icon-192.png','assets/icon-512.png','assets/icon-maskable.png'];
const absolute=name=>new URL(name,self.registration.scope).href;

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    for(const name of ASSETS){
      try{
        const req=new Request(absolute(name)+'?v='+Date.now(),{cache:'reload',credentials:'same-origin'});
        const res=await fetch(req);
        if(res.ok) await cache.put(absolute(name),res);
      }catch(e){}
    }
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys()){
      if(key.startsWith(PREFIX)&&key!==CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE_UPDATE') self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin||url.searchParams.has('forge-check'))return;
  const shell=new URL(self.registration.scope).pathname;
  let asset=ASSETS.find(name=>new URL(absolute(name)).pathname===url.pathname);
  if(url.pathname===shell)asset='index.html';
  if(!asset)return;
  event.respondWith((async()=>{
    try{
      const netRes=await fetch(req);
      if(netRes&&netRes.ok){
        const cache=await caches.open(CACHE);
        cache.put(req,netRes.clone());
        return netRes;
      }
    }catch(e){}
    const cache=await caches.open(CACHE);
    const cached=await cache.match(absolute(asset));
    if(cached)return cached;
    return new Response('Потрібне з’єднання для першого відкриття.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
  })());
});
