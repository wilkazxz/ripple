import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export type Profile = { uid: string; name?: string; photo?: string; bio?: string };
type Map = Record<string, Profile>;

let map: Map = {};
const subs = new Set<(m: Map) => void>();
let started = false;

function start() {
  if (started || !db) return;
  started = true;
  onSnapshot(
    collection(db, "profiles"),
    snap => {
      map = Object.fromEntries(snap.docs.map(d => [d.id, { uid: d.id, ...d.data() } as Profile]));
      subs.forEach(f => f(map));
    },
    () => {}
  );
}

export function useProfiles() {
  const [m, setM] = useState<Map>(map);
  useEffect(() => {
    start();
    setM(map);
    subs.add(setM);
    return () => { subs.delete(setM); };
  }, []);
  return m;
}

export async function saveProfile(uid: string, data: { name: string; bio: string; photo?: string | null }) {
  if (!db) throw new Error("Firebase belum aktif");
  if (data.photo && data.photo.length > 300_000) throw new Error("Foto terlalu besar, coba crop lebih kecil.");
  await setDoc(doc(db, "profiles", uid), { uid, ...data, updatedAt: Date.now() }, { merge: true });
}

// Hapus foto profil: simpan string kosong supaya foto Google tidak muncul kembali
export async function removeProfilePhoto(uid: string) {
  if (!db) throw new Error("Firebase belum aktif");
  await setDoc(doc(db, "profiles", uid), { uid, photo: "", updatedAt: Date.now() }, { merge: true });
}
