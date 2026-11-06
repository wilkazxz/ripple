import { useEffect, useRef, useState } from "react";

export function dataUrlToFile(d: string, name = "crop.jpg"): File {
  const [h, b] = d.split(",");
  const type = h.match(/:(.*?);/)?.[1] || "image/jpeg";
  const bin = atob(b);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new File([u], name, { type });
}

type P = { x: number; y: number };

export default function Cropper({
  file, aspect = 1, round = false, outW = 512, quality = 0.85, onCancel, onDone,
}: {
  file: File; aspect?: number; round?: boolean; outW?: number; quality?: number;
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

  const done = () => {
    if (!img) return;
    const outH = Math.round(outW / aspect);
    const c = document.createElement("canvas");
    c.width = outW; c.height = outH;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(img, -left / s, -top / s, W / s, H / s, 0, 0, outW, outH);
    onDone(c.toDataURL("image/jpeg", quality));
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
