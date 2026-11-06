import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Config web Firebase bersifat publik (bukan rahasia). Keamanan data dijaga oleh
// firestore.rules dan daftar Authorized domains. Env VITE_FIREBASE_* (kalau diisi)
// akan menimpa nilai bawaan di bawah ini.
const env = import.meta.env;
const config = {
  apiKey: (env.VITE_FIREBASE_API_KEY as string) || "AIzaSyDZ4pmydWBKG6vFKbaTvefjdj-i_X-WBvw",
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN as string) || "wilkaxyz-86d8f.firebaseapp.com",
  projectId: (env.VITE_FIREBASE_PROJECT_ID as string) || "wilkaxyz-86d8f",
  storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET as string) || "wilkaxyz-86d8f.firebasestorage.app",
  messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || "438856552676",
  appId: (env.VITE_FIREBASE_APP_ID as string) || "1:438856552676:web:a6cc7b99e5dc27e1985cf1",
};

const app = initializeApp(config);

export const auth = getAuth(app);
export const db = getFirestore(app);
