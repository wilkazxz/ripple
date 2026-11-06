import { useEffect, useRef, useState } from "react";

export function dataUrlToFile(d: string, name = "crop.jpg"): File {
  const [h, b] = d.split(",");
  const type = h.match(/:(.*?);/)?.[1] || "image/jpeg";
  const bin = atob(b);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const ext = type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  return new File([u], name.replace(/\.[a-z0-9]+$/i, "") + "." + ext, { type });
}

type P = { x: number; y: number };

export default function Cropper({
  file, aspect = 1, round = false, outW = 512, quality = 0.85, maxLen, onCancel, onDone,
}: {
  file: File; aspect?: number; round?: boolean; outW?: number; quality?: number; maxLen?: number;
  onCancel: () => void; onDone: (dataUrl: string) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [src, setSrc] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState<P>({ x: 0, y: 0 });
  const drag = useRef<P | null>(null);
  const W = Math.min(340, window.innerWidth - 72);
  const H = Math.round(W / aspect);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => { setImg(i); setSrc(u); };
    i.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const base = img ? Math.max(W / img.width, H / img.height) : 1;
  const s = base * zoom;
  const clamp = (p: P, z: number): P => {
    if (!img) return p;
    const mx = Math.max(0, (img.width * base * z - W) / 2);
    const my = Math.max(0, (img.height * base * z - H) / 2);
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  };
  const left = img ? W / 2 + pos.x - (img.width * s) / 2 : 0;
  const top = img ? H / 2 + pos.y - (img.height * s) / 2 : 0;

  // Render tanpa mengisi latar apa pun, jadi PNG/WebP transparan tetap transparan.
  const render = (w: number) => {
    if (!img) return "";
    const h = Math.round(w / aspect);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "";
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, -left / s, -top / s, W / s, H / s, 0, 0, w, h);
    // cek apakah ada piksel transparan
    let alpha = false;
    try {
      const d = ctx.getImageData(0, 0, w, h).data;
      for (let i = 3; i < d.length; i += 16) if (d[i] < 250) { alpha = true; break; }
    } catch { /* abaikan */ }
    if (!alpha) {
      // foto biasa: isi putih lalu JPEG (kecil)
      const j = document.createElement("canvas");
      j.width = w; j.height = h;
      const jc = j.getContext("2d");
      if (!jc) return "";
      jc.fillStyle = "#fff"; jc.fillRect(0, 0, w, h);
      jc.drawImage(c, 0, 0);
      return j.toDataURL("image/jpeg", quality);
    }
    const webp = c.toDataURL("image/webp", 0.92);
    return webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/png");
  };

  const done = () => {
    if (!img) return;
    let w = outW;
    let out = render(w);
    // perkecil bertahap bila melebihi batas ukuran Firestore
    while (maxLen && out.length > maxLen && w > 96) { w = Math.round(w * 0.8); out = render(w); }
    if (out) onDone(out);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="upload-panel crop-panel">
        <h2>Atur foto</h2>
        <p className="panel-intro">Geser untuk memilih bagian foto, gunakan slider untuk memperbesar.</p>
        <div
          className={`crop-frame ${round ? "is-round" : ""}`}
          style={{ width: W, height: H }}
          onPointerDown={e => { drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={e => {
            if (!drag.current) return;
            const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
            drag.current = { x: e.clientX, y: e.clientY };
            setPos(p => clamp({ x: p.x + dx, y: p.y + dy }, zoom));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          {img && <img src={src} alt="" draggable={false} style={{ left, top, width: img.width * s, height: img.height * s }} />}
        </div>
        <input
          type="range" min={1} max={3} step={0.01} value={zoom} aria-label="Perbesar"
          onChange={e => { const z = Number(e.target.value); setZoom(z); setPos(p => clamp(p, z)); }}
        />
        <div className="crop-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>Batal</button>
          <button className="primary-button" type="button" onClick={done} disabled={!img}>Pakai foto</button>
        </div>
      </div>
    </div>
  );
}
