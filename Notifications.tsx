import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { detectPlatform, useInstall } from "./pwa";
import {
  DEFAULT_PREFS, disablePush, enablePush, hasToken, loadPrefs, permissionState,
  pushConfigured, pushSupported, sendNotify, updatePrefs, type Prefs,
} from "./push";
import { useSuccess } from "./UploadSuccess";

const ROWS: Array<{ key: keyof Prefs; title: string; desc: string }> = [
  { key: "like", title: "Like", desc: "Saat seseorang menyukai postinganmu." },
  { key: "comment", title: "Komentar", desc: "Saat seseorang berkomentar di postinganmu." },
  { key: "post", title: "Postingan baru", desc: "Saat ada orang lain yang memposting sesuatu." },
];

export function NotificationSettings({ uid }: { uid: string }) {
  const { installed } = useInstall();
  const { show, node } = useSuccess();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [on, setOn] = useState(() => hasToken() && permissionState() === "granted");
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs() ?? DEFAULT_PREFS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { void pushSupported().then(setSupported); }, []);

  const toggle = async () => {
    setBusy(true);
    setMsg("");
    if (on) {
      await disablePush();
      setOn(false);
      show("Notifikasi dimatikan", "del");
    } else {
      const r = await enablePush(uid, prefs);
      if (r.ok) {
        setOn(true);
        show("Notifikasi aktif");
      } else if (r.reason === "denied") {
        setMsg("Izin notifikasi ditolak. Aktifkan lewat pengaturan situs di browser (ikon gembok), lalu coba lagi.");
      } else if (r.reason === "nokey") {
        setMsg("Kunci VAPID belum dipasang. Isi VITE_FIREBASE_VAPID_KEY di Vercel, lalu deploy ulang.");
      } else if (r.reason === "unsupported") {
        setMsg("Browser ini belum mendukung notifikasi push.");
      } else if (r.reason === "nologin") {
        setMsg("Masuk dengan Google dulu.");
      } else {
        setMsg(`Gagal mengaktifkan: ${r.message || "coba lagi"}`);
      }
    }
    setBusy(false);
  };

  const change = async (key: keyof Prefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try { await updatePrefs(next); } catch { setMsg("Gagal menyimpan pilihan."); }
  };

  const test = async () => {
    setBusy(true);
    setMsg("");
    const r = await sendNotify({ type: "test" });
    if (r.sent > 0) show("Notifikasi uji terkirim");
    else setMsg(r.error ? `Gagal: ${r.error}` : "Tidak ada perangkat yang terdaftar.");
    setBusy(false);
  };

  const iosNeedsInstall = detectPlatform() === "ios" && !installed;

  if (!pushConfigured) return null;

  return (
    <div className="settings-list">
      {node}
      <div>
        <div>
          <strong><Bell size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Notifikasi</strong>
          <span>
            {supported === false
              ? "Browser ini belum mendukung notifikasi push."
              : iosNeedsInstall
              ? "Di iPhone: Share › Add to Home Screen dulu, lalu buka dari ikon aplikasi."
              : "Terima pemberitahuan walau aplikasi sudah ditutup."}
          </span>
        </div>
        <button
          className={`toggle ${on ? "is-on" : ""}`}
          role="switch"
          aria-checked={on}
          aria-label="Notifikasi"
          disabled={busy || supported === false}
          onClick={() => void toggle()}
        >
          <i />
        </button>
      </div>
      {on && ROWS.map(r => (
        <div key={r.key}>
          <div><strong>{r.title}</strong><span>{r.desc}</span></div>
          <button className={`toggle ${prefs[r.key] ? "is-on" : ""}`} role="switch" aria-checked={prefs[r.key]} aria-label={r.title} onClick={() => void change(r.key)}><i /></button>
        </div>
      ))}
      {on && (
        <div>
          <div><strong>Tes notifikasi</strong><span>Kirim satu notifikasi ke perangkat ini.</span></div>
          <button className="secondary-button" disabled={busy} onClick={() => void test()}>Kirim tes</button>
        </div>
      )}
      {msg && <p className="muted-note" style={{ padding: "0 4px" }}>{msg}</p>}
    </div>
  );
}
