/* Trippi service worker — offline-first shell, network-first updates */
var VERSION="trippi-v1";
var CORE=["./","index.html","manifest.webmanifest","icon-192.png","icon-512.png"];
/* runtime-cacheable third-party hosts (fonts, leaflet, jsQR) — never map tiles or live APIs */
var CDN=["fonts.googleapis.com","fonts.gstatic.com","cdnjs.cloudflare.com","cdn.jsdelivr.net"];

self.addEventListener("install",function(e){
  e.waitUntil(
    caches.open(VERSION)
      .then(function(c){return c.addAll(CORE);})
      .then(function(){return self.skipWaiting();})
  );
});

self.addEventListener("activate",function(e){
  e.waitUntil(
    caches.keys()
      .then(function(ks){return Promise.all(ks.filter(function(k){return k!==VERSION;}).map(function(k){return caches.delete(k);}));})
      .then(function(){return self.clients.claim();})
  );
});

self.addEventListener("fetch",function(e){
  var req=e.request;
  if(req.method!=="GET")return;
  var url;
  try{url=new URL(req.url);}catch(err){return;}

  /* app shell: always try the network first so updates land immediately,
     fall back to the cached copy when offline */
  if(req.mode==="navigate"){
    e.respondWith(
      fetch(req).then(function(r){
        var cp=r.clone();
        caches.open(VERSION).then(function(c){c.put("index.html",cp);});
        return r;
      }).catch(function(){
        return caches.match("index.html");
      })
    );
    return;
  }

  var sameOrigin=url.origin===self.location.origin;
  var cdn=CDN.indexOf(url.hostname)>=0;
  if(!sameOrigin&&!cdn)return; /* map tiles & live APIs go straight to the network */

  /* static assets: cache-first, refresh in the background */
  e.respondWith(
    caches.match(req).then(function(hit){
      var net=fetch(req).then(function(r){
        if(r&&(r.status===200||r.type==="opaque")){
          var cp=r.clone();
          caches.open(VERSION).then(function(c){c.put(req,cp);});
        }
        return r;
      }).catch(function(){return hit;});
      return hit||net;
    })
  );
});
