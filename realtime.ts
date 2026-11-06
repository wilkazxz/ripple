import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export type MediaKind = "photo" | "video" | "project" | "website" | "document";
export type PostComment = { id: string; text: string; authorId?: string; authorName: string; createdAt: number };
export type MediaItem = {
  id: number; title: string; subtitle: string; category: string; kind: MediaKind; tags: string[];
  image?: string; images?: string[]; video?: string; date: string; size: string; sizeBytes?: number; favorite: boolean;
  ratio: "portrait" | "landscape" | "square"; link?: string; ownerId?: string; ownerName?: string; ownerEmail?: string;
  text?: string; repostOf?: number; likes?: number; likedBy?: string[]; comments?: PostComment[];
};

const COL = "media_items";
const STORAGE_KEY = "wilkaxyz:media-items:v1";
const FAV_KEY = "wilkaxyz:favorites:v1";
const CHANNEL_NAME = "wilkaxyz:realtime";
const MAX_IMAGE_CHARS = 950_000;

const fromDoc = (d: Record<string, any>): MediaItem => ({
  id: Number(d.id), title: d.title ?? "", subtitle: d.subtitle ?? "", category: d.category ?? "",
  kind: (d.kind ?? "photo") as MediaKind, tags: d.tags ?? [], image: d.image ?? undefined, images: d.images ?? undefined, video: d.video ?? undefined,
  text: d.text ?? undefined, repostOf: d.repostOf ?? undefined, date: d.date ?? "", size: d.size ?? "",
  sizeBytes: d.sizeBytes ?? undefined, favorite: false, ratio: d.ratio ?? "landscape", link: d.link ?? undefined,
  ownerId: d.ownerId ?? undefined, ownerName: d.ownerName ?? undefined, ownerEmail: d.ownerEmail ?? undefined,
  likes: d.likes ?? 0, likedBy: d.likedBy ?? [], comments: d.comments ?? [],
});
const today = () => new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
function shrink(src: string, max: number, quality: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale)); const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return resolve(src);
      ctx.drawImage(img, 0, 0, w, h);
      // gambar transparan (PNG/WebP hasil hapus background) TIDAK diberi latar putih
      let alpha = false;
      try { const d = ctx.getImageData(0, 0, w, h).data; for (let i = 3; i < d.length; i += 16) if (d[i] < 250) { alpha = true; break; } } catch { /* abaikan */ }
      if (alpha) {
        const webp = canvas.toDataURL("image/webp", quality);
        return resolve(webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png"));
      }
      const flat = document.createElement("canvas"); flat.width = w; flat.height = h;
      const fc = flat.getContext("2d"); if (!fc) return resolve(src);
      fc.fillStyle = "#fff"; fc.fillRect(0, 0, w, h); fc.drawImage(canvas, 0, 0);
      resolve(flat.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
// budget = batas karakter per gambar (dokumen Firestore maks ~1 MB untuk semua gambar sekaligus)
async function prepareImage(src: string | undefined, budget = MAX_IMAGE_CHARS) {
  if (!src || !src.startsWith("data:image")) return src;
  if (src.startsWith("data:image/gif") && src.length <= budget) return src; // GIF animasi dipertahankan
  for (const [max, q] of [[1100, .8], [900, .7], [720, .6], [560, .5], [420, .45], [300, .4]] as const) {
    const out = await shrink(src, max, q);
    if (out.length <= budget) return out;
  }
  throw new Error("Gambar terlalu besar, pakai foto yang lebih kecil atau kurangi jumlah foto.");
}
function readLocal(): MediaItem[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as MediaItem[]; } catch { return []; } }
function writeLocal(items: MediaItem[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
function readFavs(): number[] { try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch { return []; } }

export function useRealtimeItems() {
  const [raw, setRaw] = useState<MediaItem[]>(() => db || typeof window === "undefined" ? [] : readLocal());
  const [favs, setFavs] = useState<number[]>(() => typeof window === "undefined" ? [] : readFavs());
  const [connected, setConnected] = useState(!db);
  const channel = useMemo(() => !db && typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null, []);
  const cache = useRef(new Map<string, MediaItem>());
  useEffect(() => { if (db) return onSnapshot(query(collection(db, COL), orderBy("id", "desc")), snap => { const m = cache.current; snap.docChanges().forEach(ch => { if (ch.type === "removed") m.delete(ch.doc.id); else m.set(ch.doc.id, fromDoc(ch.doc.data())); }); setRaw(Array.from(m.values()).sort((a, b) => b.id - a.id)); setConnected(true); }, () => setConnected(false)); const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) setRaw(readLocal()); }; const onMessage = (e: MessageEvent<MediaItem[]>) => { if (Array.isArray(e.data)) setRaw(e.data); }; window.addEventListener("storage", onStorage); channel?.addEventListener("message", onMessage); return () => { window.removeEventListener("storage", onStorage); channel?.removeEventListener("message", onMessage); }; }, [channel]);
  const items = useMemo(() => { const f = new Set(favs); return raw.map(item => { const fav = f.has(item.id); return item.favorite === fav ? item : { ...item, favorite: fav }; }); }, [raw, favs]);
  const commitLocal = (next: MediaItem[]) => { setRaw(next); writeLocal(next); channel?.postMessage(next); };
  const addItem = useCallback(async (item: MediaItem) => { const stamped = { ...item, date: today(), likes: item.likes ?? 0, comments: item.comments ?? [] }; if (!db) return commitLocal([stamped, ...raw]); const user = auth?.currentUser; if (!user) throw new Error("Login Google dulu untuk upload."); const srcImages = stamped.images?.length ? stamped.images : stamped.image ? [stamped.image] : [];
      if (stamped.video && stamped.video.length > 700_000) throw new Error("Video terlalu besar. Batas video sekitar 500 KB (penyimpanan Firestore tidak mendukung video besar).");
      const budget = Math.floor((stamped.video ? 250_000 : 900_000) / Math.max(1, srcImages.length));
      const images = await Promise.all(srcImages.map(src => prepareImage(src, budget)));
      const payload: Record<string, unknown> = {
        id: stamped.id, title: stamped.title, subtitle: stamped.subtitle ?? "", category: stamped.category ?? "",
        kind: stamped.kind, tags: stamped.tags ?? [], date: stamped.date, size: stamped.size ?? "",
        sizeBytes: stamped.sizeBytes ?? 0, ratio: stamped.ratio ?? "landscape", images,
        likes: stamped.likes ?? 0, likedBy: stamped.likedBy ?? [], comments: stamped.comments ?? [],
        ownerId: user.uid, ownerName: user.displayName || user.email || "User", ownerEmail: user.email || "",
        createdAt: Date.now(),
      };
      if (images[0]) payload.image = images[0];
      if (stamped.video) payload.video = stamped.video;
      if (stamped.text) payload.text = stamped.text;
      if (stamped.repostOf) payload.repostOf = stamped.repostOf;
      if (stamped.link) payload.link = stamped.link;
      const safePayload = JSON.parse(JSON.stringify(payload));
      await setDoc(doc(db, COL, String(stamped.id)), safePayload); }, [raw, channel]);
  const updateItem = useCallback(async (id: number, patch: Partial<MediaItem>) => { if (!db) return commitLocal(raw.map(i => i.id === id ? { ...i, ...patch } : i)); await updateDoc(doc(db, COL, String(id)), patch); }, [raw, channel]);
  const deleteItem = useCallback(async (id: number) => { if (!db) return commitLocal(raw.filter(i => i.id !== id)); await deleteDoc(doc(db, COL, String(id))); }, [raw, channel]);
  const toggleFavorite = useCallback(async (id: number) => { setFavs(prev => { const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]; localStorage.setItem(FAV_KEY, JSON.stringify(next)); return next; }); }, []);
  // Like & komentar memakai transaksi supaya tidak saling menimpa saat banyak orang berinteraksi bersamaan
  const likeItem = useCallback(async (id: number, uid?: string) => {
    const key = uid || "guest";
    const toggle = (likedBy: string[] = []) => { const next = likedBy.includes(key) ? likedBy.filter(x => x !== key) : [...likedBy, key]; return { likedBy: next, likes: next.length }; };
    if (!db) { const item = raw.find(i => i.id === id); if (!item) return; const patch = toggle(item.likedBy); return commitLocal(raw.map(i => i.id === id ? { ...i, ...patch } : i)); }
    const ref = doc(db, COL, String(id));
    await runTransaction(db, async tx => { const snap = await tx.get(ref); if (!snap.exists()) return; tx.update(ref, toggle(snap.data().likedBy)); });
  }, [raw, channel]);
  const addComment = useCallback(async (id: number, text: string, author?: { id?: string; name?: string }) => {
    const clean = text.trim().slice(0, 1000); if (!clean) return;
    const comment: PostComment = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text: clean, authorId: author?.id, authorName: author?.name || "Pengguna", createdAt: Date.now() };
    if (!db) { const item = raw.find(i => i.id === id); if (!item) return; return commitLocal(raw.map(i => i.id === id ? { ...i, comments: [...(item.comments || []), comment] } : i)); }
    const ref = doc(db, COL, String(id));
    await runTransaction(db, async tx => { const snap = await tx.get(ref); if (!snap.exists()) return; tx.update(ref, { comments: [...(snap.data().comments || []), comment] }); });
  }, [raw, channel]);
  return { items, connected, addItem, updateItem, toggleFavorite, deleteItem, likeItem, addComment };
}
