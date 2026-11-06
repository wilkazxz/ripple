import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";
import { deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const VAPID = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
// Notifikasi baru aktif kalau kunci VAPID dipasang; tanpa itu fitur tersembunyi & tidak mengganggu
export const pushConfigured = !!VAPID;
const TOKEN_KEY = "wilkaxyz:push-token";
const PREFS_KEY = "wilkaxyz:push-prefs";

export type Prefs = { like: boolean; comment: boolean; post: boolean };
export const DEFAULT_PREFS: Prefs = { like: true, comment: true, post: false };

export type EnableResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "nokey" | "nologin" | "error"; message?: string };

export async function pushSupported(): Promise<boolean> {
  try {
    return (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "Notification" in window &&
      "PushManager" in window &&
      (await isSupported())
    );
  } catch {
    return false;
  }
}

export const permissionState = (): NotificationPermission | "unsupported" =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission;

export const hasToken = () => {
  try { return !!localStorage.getItem(TOKEN_KEY); } catch { return false; }
};

export function loadPrefs(): Prefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; } catch { return DEFAULT_PREFS; }
}
const savePrefsLocal = (p: Prefs) => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* abaikan */ } };

export async function enablePush(uid: string, prefs: Prefs): Promise<EnableResult> {
  if (!db || !auth?.currentUser) return { ok: false, reason: "nologin" };
  if (!(await pushSupported())) return { ok: false, reason: "unsupported" };
  if (!VAPID) return { ok: false, reason: "nokey" };
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, reason: "denied" };
    const reg = await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(), { vapidKey: VAPID, serviceWorkerRegistration: reg });
    if (!token) return { ok: false, reason: "error", message: "Token kosong" };
    await setDoc(doc(db, "push_tokens", token), {
      uid, token, prefs, ua: navigator.userAgent.slice(0, 200), updatedAt: Date.now(),
    });
    localStorage.setItem(TOKEN_KEY, token);
    savePrefsLocal(prefs);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: "error", message: e?.message || "Gagal mengaktifkan" };
  }
}

export async function updatePrefs(prefs: Prefs) {
  savePrefsLocal(prefs);
  const token = localStorage.getItem(TOKEN_KEY);
  if (db && token) await updateDoc(doc(db, "push_tokens", token), { prefs, updatedAt: Date.now() });
}

// Matikan notifikasi di perangkat ini (hapus token di server & di browser)
export async function disablePush() {
  const token = localStorage.getItem(TOKEN_KEY);
  try { if (db && token) await deleteDoc(doc(db, "push_tokens", token)); } catch { /* abaikan */ }
  try { await deleteToken(getMessaging()); } catch { /* abaikan */ }
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* abaikan */ }
}

// Dipanggil sebelum logout agar perangkat tidak menerima notifikasi akun lain
export async function unregisterPush() {
  if (hasToken()) await disablePush();
}

export type NotifyPayload = { type: "like" | "comment" | "post" | "test"; itemId?: number };
export async function sendNotify(payload: NotifyPayload): Promise<{ sent: number; error?: string }> {
  if (!VAPID) return { sent: 0 };
  try {
    const idToken = await auth?.currentUser?.getIdToken();
    if (!idToken) return { sent: 0, error: "Belum login" };
    const res = await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { sent: data.sent ?? 0, error: res.ok ? data.error : data.error || `Server ${res.status}` };
  } catch (e: any) {
    return { sent: 0, error: e?.message || "Gagal terhubung" };
  }
}
