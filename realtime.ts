import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

export type MediaKind = "photo" | "video" | "project" | "website" | "document";

export type MediaItem = {
  id: number;
  title: string;
  subtitle: string;
  category: string;
  kind: MediaKind;
  tags: string[];
  image?: string;
  date: string;
  size: string;
  sizeBytes?: number;
  favorite: boolean;
  ratio: "portrait" | "landscape" | "square";
  link?: string;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
};

const COL = "media_items";
const STORAGE_KEY = "wilkaxyz:media-items:v1";
const FAV_KEY = "wilkaxyz:favorites:v1";
const CHANNEL_NAME = "wilkaxyz:realtime";
const MAX_IMAGE_CHARS = 950_000; // batas dokumen Firestore 1 MB

const fromDoc = (d: Record<string, any>): MediaItem => ({
  id: Number(d.id),
  title: d.title ?? "",
  subtitle: d.subtitle ?? "",
  category: d.category ?? "",
  kind: (d.kind ?? "photo") as MediaKind,
  tags: d.tags ?? [],
  image: d.image ?? undefined,
  date: d.date ?? "",
  size: d.size ?? "",
  sizeBytes: d.sizeBytes ?? undefined,
  favorite: false,
  ratio: d.ratio ?? "landscape",
  link: d.link ?? undefined,
  ownerId: d.ownerId ?? undefined,
  ownerName: d.ownerName ?? undefined,
  ownerEmail: d.ownerEmail ?? undefined,
});

const today = () =>
  new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

// Perkecil gambar supaya muat di Firestore (tanpa Firebase Storage / paket berbayar)
function shrink(src: string, max: number, quality: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(src);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
async function prepareImage(src?: string): Promise<string | undefined> {
  if (!src || !src.startsWith("data:image")) return src;
  let out = await shrink(src, 1100, 0.78);
  if (out.length > MAX_IMAGE_CHARS) out = await shrink(src, 800, 0.6);
  if (out.length > MAX_IMAGE_CHARS) throw new Error("Gambar terlalu besar, pakai foto yang lebih kecil.");
  return out;
}

function readLocal(): MediaItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as MediaItem[]) : [];
  } catch {
    return [];
  }
}
function writeLocal(items: MediaItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
function readFavs(): number[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
  } catch {
    return [];
  }
}

export function useRealtimeItems() {
  const [raw, setRaw] = useState<MediaItem[]>(() =>
    db || typeof window === "undefined" ? [] : readLocal()
  );
  const [favs, setFavs] = useState<number[]>(() =>
    typeof window === "undefined" ? [] : readFavs()
  );
  const [connected, setConnected] = useState(!db);
  const channel = useMemo(
    () =>
      !db && typeof window !== "undefined" && "BroadcastChannel" in window
        ? new BroadcastChannel(CHANNEL_NAME)
        : null,
    []
  );

  useEffect(() => {
    if (db) {
      return onSnapshot(
        query(collection(db, COL), orderBy("id", "desc")),
        snap => {
          setRaw(snap.docs.map(d => fromDoc(d.data())));
          setConnected(true);
        },
        () => setConnected(false)
      );
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setRaw(readLocal());
    };
    const onMessage = (e: MessageEvent<MediaItem[]>) => {
      if (Array.isArray(e.data)) setRaw(e.data);
    };
    window.addEventListener("storage", onStorage);
    channel?.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("storage", onStorage);
      channel?.removeEventListener("message", onMessage);
    };
  }, [channel]);

  // favorit = penanda pribadi per perangkat
  const items = useMemo(
    () => raw.map(item => ({ ...item, favorite: favs.includes(item.id) })),
    [raw, favs]
  );

  const commitLocal = (next: MediaItem[]) => {
    setRaw(next);
    writeLocal(next);
    channel?.postMessage(next);
  };

  const addItem = useCallback(
    async (item: MediaItem) => {
      const stamped = { ...item, date: today() };
      if (!db) return commitLocal([stamped, ...raw]);
      const user = auth?.currentUser;
      if (!user) throw new Error("Login Google dulu untuk upload.");
      const image = await prepareImage(stamped.image);
      await setDoc(doc(db, COL, String(stamped.id)), {
        id: stamped.id,
        title: stamped.title,
        subtitle: stamped.subtitle ?? "",
        category: stamped.category ?? "",
        kind: stamped.kind,
        tags: stamped.tags ?? [],
        image: image ?? null,
        date: stamped.date,
        size: stamped.size ?? "",
        sizeBytes: stamped.sizeBytes ?? null,
        ratio: stamped.ratio ?? "landscape",
        link: stamped.link ?? null,
        ownerId: user.uid,
        ownerName: user.displayName || user.email || "User",
        ownerEmail: user.email || "",
        createdAt: Date.now(),
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw, channel]
  );

  const updateItem = useCallback(
    async (
      id: number,
      patch: Partial<Pick<MediaItem, "title" | "subtitle" | "category" | "tags">>
    ) => {
      if (!db) return commitLocal(raw.map(i => (i.id === id ? { ...i, ...patch } : i)));
      await updateDoc(doc(db, COL, String(id)), patch);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw, channel]
  );

  const deleteItem = useCallback(
    async (id: number) => {
      if (!db) return commitLocal(raw.filter(i => i.id !== id));
      await deleteDoc(doc(db, COL, String(id)));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw, channel]
  );

  const toggleFavorite = useCallback(async (id: number) => {
    setFavs(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { items, connected, addItem, updateItem, toggleFavorite, deleteItem };
}
