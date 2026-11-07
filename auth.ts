import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithCredential,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

async function registerUser(u: { uid: string; displayName: string | null; email: string | null; photoURL: string | null }) {
  if (!db) return;
  try {
    const ref = doc(db, "users", u.uid);
    const snap = await getDoc(ref);
    await setDoc(
      ref,
      {
        uid: u.uid,
        name: u.displayName || "",
        email: u.email || "",
        photo: u.photoURL || "",
        lastLoginAt: Date.now(),
        ...(snap.exists() ? {} : { createdAt: Date.now() }),
      },
      { merge: true }
    );
    const pref = doc(db, "profiles", u.uid);
    if (!(await getDoc(pref)).exists()) {
      await setDoc(pref, { uid: u.uid, name: u.displayName || "", photo: u.photoURL || "", bio: "", updatedAt: Date.now() });
    }
  } catch {
    /* abaikan: pencatatan user tidak boleh memblokir login */
  }
}

// Pesan error login yang jelas (sebagian besar masalah login ada di pengaturan Firebase Console, bukan di kode)
function authErrorMessage(code?: string, fallback?: string) {
  const host = typeof location !== "undefined" ? location.hostname : "";
  switch (code) {
    case "auth/unauthorized-domain":
      return `Domain "${host}" belum diizinkan.\n\nFirebase Console > Authentication > Settings > Authorized domains > Add domain > isi: ${host}`;
    case "auth/operation-not-allowed":
      return "Login Google belum diaktifkan.\n\nFirebase Console > Authentication > Sign-in method > Google > Enable > Save.";
    case "auth/network-request-failed":
      return "Koneksi internet bermasalah. Coba lagi.";
    case "auth/internal-error":
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "Konfigurasi Firebase tidak valid (API key / authDomain). Periksa firebase.ts atau env VITE_FIREBASE_* di Vercel.";
    case "auth/web-storage-unsupported":
      return "Browser memblokir penyimpanan (cookie/storage). Matikan mode private atau izinkan cookie, lalu coba lagi.";
    default:
      return `Login gagal${code ? ` (${code})` : ""}: ${fallback || "coba lagi"}\n\nJika dibuka dari dalam aplikasi lain (Instagram, TikTok, dll), buka lewat Chrome / Safari.`;
  }
}

// Login Google native (di APK). WebView tidak mendukung popup/redirect Google, jadi pakai dialog akun bawaan Android.
const isNativeApp = () => Capacitor.isNativePlatform();
export const isNative = isNativeApp;
// "oauth" = login lewat browser (Custom Tab), paling andal. "credential" = dialog akun Google bawaan Android.
export type NativeMethod = "oauth" | "credential";

const CANCELLED = "Login dibatalkan.";
const CREDENTIAL_TIMEOUT_MS = 45_000;
const OAUTH_TIMEOUT_MS = 180_000;

// Jika onError diberikan, pesan ditampilkan di dalam aplikasi (modal). Jika tidak, pakai alert.
function report(msg: string, onError?: (m: string) => void) {
  if (!msg) return;
  if (onError) onError(msg);
  else if (msg !== CANCELLED) window.alert(msg);
}

function describeError(e: any) {
  try {
    return JSON.stringify({ code: e?.code, name: e?.name, message: e?.message ?? String(e) }).slice(0, 400);
  } catch {
    return String(e).slice(0, 400);
  }
}

function nativeErrorMessage(e: any, elapsedMs: number) {
  const msg = String(e?.message || e?.code || e || "");
  const code = typeof e?.code === "string" ? e.code : "";
  if (code.startsWith("auth/")) return authErrorMessage(code, e?.message); // gagal di sisi Firebase JS
  if (msg === "TIMEOUT") {
    return "Tidak ada respons dari Google.\n\nPastikan HP punya akun Google, Google Play Services aktif, dan koneksi internet normal. Lalu coba lagi.";
  }
  if (/invalid-cert-hash|app-not-authorized|SHA-?1|certificate/i.test(msg)) {
    return "SHA-1 aplikasi belum cocok dengan Firebase.\n\nFirebase Console > Project settings > app Android com.wilka.app > Add fingerprint (SHA-1 dari APK), unduh ulang google-services.json, lalu build ulang APK.\n\nDetail: " + msg;
  }
  if (/28444|developer console|\b10\b|12500|sha|client id|no credential|NoCredential/i.test(msg)) {
    return "Login Google belum cocok dengan pengaturan Firebase.\n\nPastikan SHA-1 keystore sudah ditambahkan di Firebase (app Android com.wilka.app), lalu unduh ulang google-services.json dan build ulang APK.\n\nDetail: " + msg;
  }
  if (/cancel|dismiss|12501|-5\b/i.test(msg)) {
    // Dialog yang menutup sendiri dalam hitungan detik biasanya BUKAN dibatalkan user,
    // melainkan konfigurasi SHA-1 / google-services.json belum cocok. Jangan diam saja.
    if (elapsedMs < 2000) {
      return "Dialog akun Google tertutup sendiri.\n\nBiasanya karena SHA-1 APK belum terdaftar di Firebase / google-services.json belum diperbarui, atau HP belum punya akun Google.\n\nDetail: " + msg;
    }
    return CANCELLED;
  }
  if (/network|timeout/i.test(msg)) return "Koneksi internet bermasalah. Coba lagi.";
  return "Login gagal: " + msg;
}

// Harus sama dengan email di firestore.rules
export const ADMIN_EMAILS = ["wilkaaffah@gmail.com"];

export const authEnabled = !!auth;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
};

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(authEnabled);

  useEffect(() => {
    if (!auth) return;
    if (!isNativeApp()) {
      getRedirectResult(auth).catch(e => window.alert(authErrorMessage(e?.code, e?.message)));
    }
    return onAuthStateChanged(auth, u => {
      if (!u) {
        setUser(null);
        setIsAdmin(false);
      } else {
        setUser({
          id: u.uid,
          name: u.displayName || u.email || "User",
          email: u.email || "",
          avatar: u.photoURL || undefined,
        });
        void registerUser(u);
        setIsAdmin(
          !!u.email && u.emailVerified && ADMIN_EMAILS.includes(u.email.toLowerCase())
        );
      }
      setLoading(false);
    });
  }, []);

  // true = berhasil login. false = batal / gagal / pindah halaman (redirect)
  // onError (opsional): terima pesan error untuk ditampilkan di UI; tanpa itu dipakai window.alert
  const signInWithGoogle = useCallback(async (path?: string, onError?: (msg: string) => void, onLog?: (msg: string) => void, method: NativeMethod = "oauth"): Promise<boolean> => {
    if (!auth) return false;
    if (isNativeApp()) {
      const started = Date.now();
      const log = (m: string) => {
        try { onLog?.(`${((Date.now() - started) / 1000).toFixed(1)}s  ${m}`); } catch { /* abaikan */ }
      };
      const timeoutMs = method === "oauth" ? OAUTH_TIMEOUT_MS : CREDENTIAL_TIMEOUT_MS;
      log(`platform=${Capacitor.getPlatform()}, plugin tersedia=${Capacitor.isPluginAvailable("FirebaseAuthentication")}, cara=${method}`);
      log(method === "oauth" ? "membuka halaman login Google (browser)..." : "memanggil dialog akun Google...");
      const slow = window.setTimeout(() => log(`belum ada respons >8 detik (${method === "oauth" ? "browser tidak terbuka?" : "dialog Google tidak muncul?"})`), 8000);
      try {
        const call =
          method === "oauth"
            ? FirebaseAuthentication.signInWithOAuth({
                providerId: "google.com",
                skipNativeAuth: true,
                customParameters: [{ key: "prompt", value: "select_account" }],
              } as any)
            : FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
        const res = await Promise.race([
          call,
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs)),
        ]);
        const idToken = res.credential?.idToken;
        const accessToken = res.credential?.accessToken;
        log(`Google merespons: idToken=${!!idToken}, accessToken=${!!accessToken}`);
        if (!idToken && !accessToken) throw new Error("Token Google kosong");
        await signInWithCredential(auth, GoogleAuthProvider.credential(idToken ?? null, accessToken ?? null));
        log("login Firebase berhasil");
        return true;
      } catch (e: any) {
        console.error("[login] native google gagal", e);
        log("ERROR " + describeError(e));
        report(nativeErrorMessage(e, Date.now() - started), onError);
        return false;
      } finally {
        window.clearTimeout(slow);
      }
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
      return true;
    } catch (e: any) {
      const code = e?.code as string | undefined;
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        if (path) window.history.replaceState(null, "", path);
        await signInWithRedirect(auth, provider);
        return false;
      }
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return false;
      }
      report(authErrorMessage(code, e?.message), onError);
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (auth) await fbSignOut(auth);
  }, []);

  return { user, isAdmin, loading, signInWithGoogle, signOut };
}
