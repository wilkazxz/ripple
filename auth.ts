import { useCallback, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
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

  // true = berhasil login (popup). false = batal / gagal / pindah halaman (redirect)
  const signInWithGoogle = useCallback(async (path?: string): Promise<boolean> => {
    if (!auth) return false;
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
      window.alert(`Login gagal: ${e?.message || "coba lagi"}`);
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (auth) await fbSignOut(auth);
  }, []);

  return { user, isAdmin, loading, signInWithGoogle, signOut };
}
