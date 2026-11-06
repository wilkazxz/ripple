import { useCallback, useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export type Site = {
  name: string;
  icon?: string; // 192px PNG (tab browser, logo, apple-touch-icon)
  icon512?: string; // 512px (ikon aplikasi terpasang)
  iconMask?: string; // 512px maskable (Android)
  splash?: string; // layar pembuka aplikasi
  supportQr?: string; // QR donasi Support Dev
};
export type RegisteredUser = {
  uid: string;
  name: string;
  email: string;
  photo?: string;
  createdAt?: number;
  lastLoginAt?: number;
};

const DEFAULT: Site = { name: "WILKAXYZ" };
const CACHE_KEY = "wilkaxyz:site:v2";

/* ---------- store bersama: hanya 1 listener Firestore untuk seluruh aplikasi ---------- */
let current: Site = DEFAULT;
try {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) current = { ...DEFAULT, ...JSON.parse(cached) };
} catch {
  /* abaikan */
}
const listeners = new Set<(s: Site) => void>();
let started = false;
let manifestUrl: string | null = null;

function setLink(rel: string, href: string, type?: string) {
  let l = document.querySelector<HTMLLinkElement>(`link[rel='${rel}']`);
  if (!l) {
    l = document.createElement("link");
    l.rel = rel;
    document.head.appendChild(l);
  }
  if (type) l.type = type;
  l.href = href;
}

const mimeOf = (dataUrl: string) => dataUrl.slice(5, dataUrl.indexOf(";")) || "image/png";

// Manifest dinamis supaya ikon & nama yang diatur admin ikut terpakai saat aplikasi di-install
function applyManifest(s: Site) {
  if (!s.icon) return;
  try {
    const icons: Array<Record<string, string>> = [
      { src: s.icon, sizes: "192x192", type: mimeOf(s.icon), purpose: "any" },
    ];
    if (s.icon512) icons.push({ src: s.icon512, sizes: "512x512", type: mimeOf(s.icon512), purpose: "any" });
    if (s.iconMask) icons.push({ src: s.iconMask, sizes: "512x512", type: mimeOf(s.iconMask), purpose: "maskable" });
    const manifest = {
      id: "/",
      name: s.name,
      short_name: s.name.slice(0, 12),
      description: "Personal digital collection",
      start_url: `${location.origin}/`,
      scope: `${location.origin}/`,
      display: "standalone",
      orientation: "any",
      background_color: "#f4faff",
      theme_color: "#e3f3ff",
      icons,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
    setLink("manifest", url);
    if (manifestUrl) URL.revokeObjectURL(manifestUrl);
    manifestUrl = url;
  } catch {
    /* manifest bawaan tetap dipakai */
  }
}

function apply(s: Site) {
  document.title = s.name;
  const apt = document.querySelector<HTMLMetaElement>("meta[name='apple-mobile-web-app-title']");
  if (apt) apt.content = s.name;
  if (s.icon) {
    setLink("icon", s.icon, mimeOf(s.icon));
    setLink("apple-touch-icon", s.icon);
    applyManifest(s);
  } else {
    setLink("icon", "/icon-192.png", "image/png");
    setLink("apple-touch-icon", "/icon-192.png");
    setLink("manifest", "/manifest.webmanifest");
  }
}

function publish(next: Site) {
  current = next;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    /* kuota penuh: abaikan */
  }
  apply(next);
  listeners.forEach(fn => fn(next));
}

function start() {
  if (started) return;
  started = true;
  if (typeof document !== "undefined") apply(current);
  if (!db) return;
  onSnapshot(
    doc(db, "settings", "site"),
    snap => {
      const d = snap.data();
      publish({
        name: d?.name || DEFAULT.name,
        icon: d?.icon || undefined,
        icon512: d?.icon512 || undefined,
        iconMask: d?.iconMask || undefined,
        splash: d?.splash || undefined,
        supportQr: d?.supportQr || undefined,
      });
    },
    () => {}
  );
}

/* ---------- pengolah ikon ---------- */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => reject(new Error("File gambar tidak bisa dibaca"));
    img.src = url;
  });
}

function hasAlpha(img: HTMLImageElement): boolean {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, 64, 64);
    const d = ctx.getImageData(0, 0, 64, 64).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  } catch {
    /* abaikan */
  }
  return false;
}

function draw(img: HTMLImageElement, size: number, pad: number, bg?: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia");
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
  }
  const side = Math.min(img.width, img.height);
  const inner = size * (1 - pad * 2);
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, size * pad, size * pad, inner, inner);
  return canvas.toDataURL("image/png");
}

function toWebp(png: string, size: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      c.getContext("2d")?.drawImage(img, 0, 0, size, size);
      const out = c.toDataURL("image/webp", 0.9);
      resolve(out.startsWith("data:image/webp") ? out : png);
    };
    img.onerror = () => resolve(png);
    img.src = png;
  });
}

async function buildIcons(file: File) {
  const img = await loadImage(file);
  const icon = draw(img, 192, 0);
  const icon512 = await toWebp(draw(img, 512, 0), 512);
  // Ikon transparan dipakai apa adanya (tanpa latar). Versi maskable butuh latar,
  // jadi hanya dibuat untuk ikon yang tidak transparan.
  const iconMask = hasAlpha(img) ? null : await toWebp(draw(img, 512, 0.1, "#ffffff"), 512);
  return { icon, icon512, iconMask };
}

/* ---------- hooks ---------- */
export function useSite() {
  const [site, setSite] = useState<Site>(current);
  useEffect(() => {
    start();
    setSite(current);
    listeners.add(setSite);
    return () => {
      listeners.delete(setSite);
    };
  }, []);

  const save = useCallback(async (name: string, iconFile?: File | null, splashFile?: File | null, supportQrFile?: File | null) => {
    if (!db) throw new Error("Firebase belum aktif");
    const data: Record<string, unknown> = {
      name: name.trim() || DEFAULT.name,
      updatedAt: Date.now(),
    };
    if (iconFile) Object.assign(data, await buildIcons(iconFile));
    if (splashFile) { const reader = new FileReader(); const splash = await new Promise<string>((resolve, reject) => { reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(splashFile); }); if (splash.length > 900_000) throw new Error("Splash terlalu besar, pilih gambar yang lebih kecil."); data.splash = splash; }
    if (supportQrFile) { const reader = new FileReader(); const qr = await new Promise<string>((resolve, reject) => { reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(supportQrFile); }); if (qr.length > 700_000) throw new Error("QR terlalu besar, pilih gambar yang lebih kecil."); data.supportQr = qr; }
    const total = JSON.stringify(data).length;
    if (total > 900_000) throw new Error("Ikon terlalu besar, pakai gambar yang lebih sederhana.");
    await setDoc(doc(db, "settings", "site"), data, { merge: true });
  }, []);

  const resetIcon = useCallback(async () => {
    if (!db) throw new Error("Firebase belum aktif");
    await setDoc(
      doc(db, "settings", "site"),
      { icon: null, icon512: null, iconMask: null, updatedAt: Date.now() },
      { merge: true }
    );
  }, []);

  // Hapus satu aset kapan saja: ikon, splash, atau QR donasi
  const removeAsset = useCallback(async (what: "icon" | "splash" | "supportQr") => {
    if (!db) throw new Error("Firebase belum aktif");
    const patch: Record<string, unknown> =
      what === "icon"
        ? { icon: null, icon512: null, iconMask: null }
        : what === "splash"
        ? { splash: null }
        : { supportQr: null };
    await setDoc(doc(db, "settings", "site"), { ...patch, updatedAt: Date.now() }, { merge: true });
  }, []);

  return { site, save, resetIcon, removeAsset };
}

export function useUsers(enabled: boolean) {
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!db || !enabled) return;
    return onSnapshot(
      collection(db, "users"),
      snap => {
        const list = snap.docs.map(d => ({ uid: d.id, ...(d.data() as Omit<RegisteredUser, "uid">) }));
        list.sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0));
        setUsers(list);
        setError("");
        setLoading(false);
      },
      err => {
        setError(
          err?.code === "permission-denied"
            ? "Akses ditolak. Publish ulang isi firestore-rules.txt di Firebase > Firestore > Rules."
            : err?.message || "Gagal memuat user"
        );
        setLoading(false);
      }
    );
  }, [enabled]);
  const removeUser = useCallback(async (uid: string) => {
    if (!db) return;
    await deleteDoc(doc(db, "users", uid));
  }, []);
  return { users, error, loading, removeUser };
}
