import { useEffect, useRef, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { ImagePlus, Trash2 } from "lucide-react";
import { db } from "./firebase";
import Cropper from "./Cropper";
import { useSuccess } from "./UploadSuccess";

export type Slide = { id: string; image: string; title: string; caption: string; createdAt: number };

let slides: Slide[] = [];
const subs = new Set<(s: Slide[]) => void>();
let started = false;

function start() {
  if (started || !db) return;
  started = true;
  onSnapshot(
    query(collection(db, "spotlight"), orderBy("createdAt", "desc")),
    snap => {
      slides = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Slide, "id">) }));
      subs.forEach(f => f(slides));
    },
    () => {}
  );
}

function useSlides() {
  const [s, setS] = useState<Slide[]>(slides);
  useEffect(() => {
    start();
    setS(slides);
    subs.add(setS);
    return () => { subs.delete(setS); };
  }, []);
  return s;
}

export function SpotlightCarousel() {
  const list = useSlides();
  const n = list.length;
  const [i, setI] = useState(0);
  const x0 = useRef<number | null>(null);
  const paused = useRef(false);

  useEffect(() => {
    if (n < 2) return;
    const t = setInterval(() => { if (!paused.current) setI(v => (v + 1) % n); }, 5000);
    return () => clearInterval(t);
  }, [n]);
  useEffect(() => { if (i >= n) setI(0); }, [n, i]);
  if (!n) return null;

  const go = (d: number) => setI(v => (v + d + n) % n);
  const end = (x: number | null) => {
    if (x0.current !== null && x !== null) {
      const dx = x - x0.current;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    }
    x0.current = null;
    paused.current = false;
  };

  return (
    <section
      className="spot"
      aria-label="Spotlight"
      onPointerDown={e => { x0.current = e.clientX; paused.current = true; }}
      onPointerUp={e => end(e.clientX)}
      onPointerCancel={() => end(null)}
    >
      <div className="spot__track" style={{ transform: `translateX(-${i * 100}%)` }}>
        {list.map(s => (
          <div className="spot__slide" key={s.id}>
            <img src={s.image} alt={s.title} draggable={false} />
            {(s.title || s.caption) && (
              <div className="spot__text">
                {s.title && <h3>{s.title}</h3>}
                {s.caption && <p>{s.caption}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
      {n > 1 && (
        <div className="spot__dots">
          {list.map((s, k) => (
            <button key={s.id} className={k === i ? "is-active" : ""} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} />
          ))}
        </div>
      )}
    </section>
  );
}

export function SpotlightAdmin() {
  const list = useSlides();
  const [raw, setRaw] = useState<File | null>(null);
  const [img, setImg] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const { show: showOk, node: okNode } = useSuccess();

  const add = async () => {
    if (!db || !img) return;
    setBusy(true);
    setMsg("");
    try {
      if (img.length > 900_000) throw new Error("Gambar terlalu besar, pilih foto yang lebih sederhana.");
      const now = Date.now();
      await setDoc(doc(db, "spotlight", String(now)), { image: img, title: title.trim(), caption: caption.trim(), createdAt: now });
      setImg(""); setTitle(""); setCaption("");
      setMsg("Spotlight ditambahkan. Langsung tampil di beranda.");
      showOk("Spotlight berhasil terupload");
    } catch (e: any) {
      setMsg(`Gagal: ${e?.message || "coba lagi"}`);
    }
    setBusy(false);
  };

  return (
    <section className="admin-panel content-panel">
      {okNode}
      <div className="admin-panel__head">
        <div>
          <span className="eyebrow">SPOTLIGHT</span>
          <h2>Foto slide di bagian atas web</h2>
        </div>
      </div>
      <div className="branding-form">
        {img && <img className="spot-preview" src={img} alt="Pratinjau" />}
        <label className="file-pick">
          <span><ImagePlus size={16} /> {img ? "Ganti foto" : "Pilih foto (dipotong rasio 16:9)"}</span>
          <input type="file" accept="image/*" onChange={e => { setRaw(e.target.files?.[0] || null); e.target.value = ""; }} />
        </label>
        <label>
          <span>Judul</span>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={60} placeholder="Judul singkat" />
        </label>
        <label>
          <span>Teks yang dibaca pengunjung</span>
          <input value={caption} onChange={e => setCaption(e.target.value)} maxLength={160} placeholder="Deskripsi singkat" />
        </label>
        <div className="form-actions">
          <button className="primary-button" disabled={!img || busy} onClick={add}>
            {busy ? "Menyimpan…" : "Tambah ke spotlight"}
          </button>
        </div>
        {msg && <p className="muted-note">{msg}</p>}
      </div>
      <div className="user-list" style={{ marginTop: 20 }}>
        {list.map(s => (
          <div className="user-row" key={s.id}>
            <img className="spot-thumb" src={s.image} alt="" />
            <div className="user-row__info">
              <strong>{s.title || "Tanpa judul"}</strong>
              <span>{s.caption}</span>
            </div>
            <button
              className="table-more"
              aria-label="Hapus slide"
              onClick={async () => { if (db && window.confirm("Hapus slide ini?")) { await deleteDoc(doc(db, "spotlight", s.id)); showOk("Slide berhasil dihapus", "del"); } }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {!list.length && <p className="muted-note">Belum ada slide.</p>}
      </div>
      {raw && (
        <Cropper
          file={raw} aspect={16 / 9} outW={1280} quality={0.8}
          onCancel={() => setRaw(null)}
          onDone={d => { setImg(d); setRaw(null); }}
        />
      )}
    </section>
  );
}
