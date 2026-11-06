import { useCallback, useEffect, useState } from "react";

// Event install ditangkap di level modul supaya tidak hilang saat pindah halaman
let deferred: any = null;
const subs = new Set<() => void>();
const notify = () => subs.forEach(fn => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferred = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);

export type Platform = "ios" | "android" | "desktop";
export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

export function useInstall() {
  const [, force] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    const fn = () => force(n => n + 1);
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  }, []);

  const installed = isStandalone();
  const install = useCallback(async () => {
    if (deferred) {
      deferred.prompt();
      try {
        await deferred.userChoice;
      } catch {
        /* abaikan */
      }
      deferred = null;
      notify();
    } else {
      setHelpOpen(true); // browser tidak menyediakan prompt: tampilkan panduan manual
    }
  }, []);

  return {
    canInstall: !installed,
    installed,
    nativePrompt: !!deferred,
    install,
    helpOpen,
    closeHelp: () => setHelpOpen(false),
  };
}
