import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { ICON_192, ICON_512, ICON_MASKABLE } from "./pwa-icons";

// Manifest, service worker, dan ikon dibuat saat build (tanpa folder public/)
function pwa(): Plugin {
  const manifest = {
    id: "/",
    lang: "id",
    categories: ["productivity", "lifestyle"],
    name: "WILKAXYZ",
    short_name: "WILKAXYZ",
    description: "Personal digital collection",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4faff",
    theme_color: "#e3f3ff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  const sw = `const C="wilkaxyz-v4";
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.add("/")))});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET"||new URL(r.url).origin!==location.origin||new URL(r.url).pathname.startsWith("/api/"))return;
e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r).then(m=>m||caches.match("/"))))});
self.addEventListener("push",e=>{let d={};try{const j=e.data.json();d=j.data||j.notification||j}catch(_){}
e.waitUntil(self.registration.showNotification(d.title||"WILKAXYZ",{body:d.body||"",icon:"/icon-192.png",badge:"/icon-192.png",tag:d.tag||undefined,renotify:!!d.tag,data:{url:d.url||"/"}}))});
self.addEventListener("notificationclick",e=>{e.notification.close();const u=(e.notification.data&&e.notification.data.url)||"/";
e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{for(const c of cs){if("focus" in c){if("navigate" in c){c.navigate(u).catch(()=>{})}return c.focus()}}return self.clients.openWindow(u)}))});`;
  const files: Record<string, string | Buffer> = {
    "manifest.webmanifest": JSON.stringify(manifest),
    "sw.js": sw,
    "icon-192.png": Buffer.from(ICON_192, "base64"),
    "icon-512.png": Buffer.from(ICON_512, "base64"),
    "icon-maskable.png": Buffer.from(ICON_MASKABLE, "base64"),
  };
  return {
    name: "wilkaxyz-pwa",
    generateBundle() {
      for (const [fileName, source] of Object.entries(files)) {
        this.emitFile({ type: "asset", fileName, source });
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const key = (req.url || "").split("?")[0].slice(1);
        const f = files[key];
        if (!f) return next();
        res.setHeader("Content-Type", key.endsWith(".png") ? "image/png" : key === "sw.js" ? "text/javascript" : "application/manifest+json");
        res.end(f);
      });
    },
  };
}

export default defineConfig({ plugins: [react(), pwa()], build: { outDir: "dist" }, server: { host: true } });
