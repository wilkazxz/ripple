import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "./auth";
import { useSite, useUsers, type RegisteredUser } from "./site";
import { useRealtimeItems } from "./realtime";
import Cropper, { dataUrlToFile } from "./Cropper";
import { SpotlightAdmin } from "./Spotlight";
import { useSuccess } from "./UploadSuccess";
import {
  ArrowLeft,
  Download,
  FileArchive,
  FileCode2,
  FileImage,
  HardDrive,
  ImagePlus,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Pencil,
  Palette,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Video,
  Activity,
  Menu,
  X,
} from "lucide-react";

type Tab = "Overview" | "Content" | "Users" | "Spotlight" | "Branding";
const TABS: Array<{ id: Tab; label: string; Icon: typeof Users }> = [
  { id: "Overview", label: "Overview", Icon: LayoutDashboard },
  { id: "Content", label: "Konten", Icon: FileArchive },
  { id: "Users", label: "User", Icon: Users },
  { id: "Spotlight", label: "Spotlight", Icon: ImagePlus },
  { id: "Branding", label: "Ikon & nama", Icon: Palette },
];

const DAY = 24 * 60 * 60 * 1000;
const fmtDate = (t?: number) =>
  t ? new Date(t).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-";
const fmtMB = (bytes: number) => (bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : "0 B");

function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
}) {
  return (
    <div className="admin-metric">
      <div className="admin-metric__top">
        <span className="admin-icon">
          <Icon size={17} />
        </span>
      </div>
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function UserAvatar({ u }: { u: RegisteredUser }) {
  return (
    <span className="avatar avatar--lime">
      {u.photo ? (
        <img src={u.photo} alt="" referrerPolicy="no-referrer" />
      ) : (
        (u.name || u.email || "?").charAt(0).toUpperCase()
      )}
    </span>
  );
}

function downloadCsv(users: RegisteredUser[], uploads: (uid: string) => number) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [
    ["Nama", "Email", "Terdaftar", "Login terakhir", "Jumlah upload"],
    ...users.map(u => [u.name || "", u.email || "", fmtDate(u.createdAt), fmtDate(u.lastLoginAt), uploads(u.uid)]),
  ];
  const csv = "﻿" + rows.map(r => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "user-terdaftar.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Admin() {
  const { user, isAdmin, loading, signInWithGoogle, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("Overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { items, connected, deleteItem, updateItem } = useRealtimeItems();
  const { site, save: saveSite, removeAsset } = useSite();
  const { show: showOk, node: okNode } = useSuccess();
  const { users, error: usersError, loading: usersLoading, removeUser } = useUsers(isAdmin);
  const [userQuery, setUserQuery] = useState("");
  const [siteName, setSiteName] = useState<string | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconRaw, setIconRaw] = useState<File | null>(null);
  const [splashFile, setSplashFile] = useState<File | null>(null);
  const [supportQrFile, setSupportQrFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const iconPreview = useMemo(() => (iconFile ? URL.createObjectURL(iconFile) : ""), [iconFile]);
  const splashPreview = useMemo(() => (splashFile ? URL.createObjectURL(splashFile) : site.splash || ""), [splashFile, site.splash]);
  const supportQrPreview = useMemo(() => (supportQrFile ? URL.createObjectURL(supportQrFile) : site.supportQr || ""), [supportQrFile, site.supportQr]);
  const uploadsOf = (uid: string) => items.filter(i => i.ownerId === uid).length;

  const photos = items.filter(i => i.category === "Photos").length;
  const videos = items.filter(i => i.category === "Videos").length;
  const projects = items.filter(i => i.category === "Projects").length;
  const storageBytes = items.reduce((t, i) => t + (i.sizeBytes || 0), 0);
  const now = Date.now();
  const newUsers7d = users.filter(u => u.createdAt && now - u.createdAt < 7 * DAY).length;
  const active24h = users.filter(u => u.lastLoginAt && now - u.lastLoginAt < DAY).length;

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => `${u.name} ${u.email}`.toLowerCase().includes(q));
  }, [users, userQuery]);

  if (loading)
    return (
      <div className="admin-gate">
        <div className="admin-loader">
          <span className="status-dot" /> Memeriksa sesi…
        </div>
      </div>
    );

  if (!user || !isAdmin)
    return (
      <div className="admin-gate">
        <div className="admin-gate__card">
          <div className="admin-gate__mark">
            <LockKeyhole size={24} />
          </div>
          <span className="eyebrow">{site.name} / ADMIN</span>
          <h1>
            Area pribadi.
            <br />
            <span>Khusus admin.</span>
          </h1>
          <p>
            {user
              ? `${user.email} bukan akun admin. Keluar lalu masuk dengan akun Google admin.`
              : "Halaman ini hanya untuk admin. Masuk dengan akun Google admin untuk mengelola konten dan user."}
          </p>
          <button
            className="primary-button primary-button--full"
            onClick={() => (user ? void signOut() : void signInWithGoogle("/admin"))}
          >
            <LockKeyhole size={16} /> {user ? "Keluar & ganti akun" : "Masuk dengan Google"}
          </button>
          <Link href="/" className="back-link">
            <ArrowLeft size={15} /> Kembali ke beranda
          </Link>
        </div>
      </div>
    );

  const onSave = async () => {
    setSaving(true);
    setSavedMsg("");
    try {
      const what = iconFile ? "Ikon aplikasi" : splashFile ? "Splash screen" : supportQrFile ? "QR donasi" : "Nama aplikasi";
      await saveSite(siteName ?? site.name, iconFile, splashFile, supportQrFile);
      setIconFile(null);
      setSplashFile(null);
      setSupportQrFile(null);
      setSiteName(null);
      setSavedMsg("Tersimpan. Langsung berubah di semua perangkat.");
      showOk(`${what} berhasil terupload`);
    } catch (err: any) {
      setSavedMsg(`Gagal: ${err?.message || "coba lagi"}`);
    }
    setSaving(false);
  };

  const onDelete = async (what: "icon" | "splash" | "supportQr", label: string) => {
    if (!window.confirm(`Hapus ${label}?`)) return;
    setSaving(true);
    setSavedMsg("");
    try {
      await removeAsset(what);
      if (what === "icon") setIconFile(null);
      if (what === "splash") setSplashFile(null);
      if (what === "supportQr") setSupportQrFile(null);
      showOk(`${label} berhasil dihapus`, "del");
    } catch (err: any) {
      setSavedMsg(`Gagal: ${err?.message || "coba lagi"}`);
    }
    setSaving(false);
  };

  return (
    <div className="admin-shell">
      {okNode}
      <aside className={`admin-sidebar ${mobileMenuOpen ? "is-open" : ""}`}>
        <div className="admin-brand">
          {site.icon ? (
            <img className="brand-icon" src={site.icon} alt="" />
          ) : (
            <span className="brand-orbit">
              <span />
            </span>
          )}
          <strong>{site.name.toUpperCase()}</strong>
          <small>ADMIN CONSOLE</small>
        </div>
        <div className="admin-user">
          <div className="avatar avatar--lime">
            {user.avatar ? (
              <img src={user.avatar} alt="" referrerPolicy="no-referrer" />
            ) : (
              user.name?.charAt(0) || "W"
            )}
          </div>
          <div>
            <strong>{user.name || "Owner"}</strong>
            <span>Administrator</span>
          </div>
          <button className="icon-button" onClick={() => void signOut()} aria-label="Keluar">
            <LogOut size={14} />
          </button>
        </div>
        <span className="admin-nav-label">CONTROL ROOM</span>
        <nav className="admin-nav">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className={tab === id ? "is-active" : ""} onClick={() => { setTab(id); setMobileMenuOpen(false); }}>
              <Icon size={17} /> {label}
              {id === "Content" && <span>{items.length}</span>}
              {id === "Users" && <span>{users.length}</span>}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar__bottom">
          <Link href="/" className="back-link">
            <ArrowLeft size={15} /> Kembali ke beranda
          </Link>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="eyebrow">{site.name} / CONTROL ROOM</span>
            <h1>{TABS.find(t => t.id === tab)?.label}</h1>
          </div>
          <div className="admin-topbar__actions">
            <span className="admin-online"><span className="status-dot" /> {connected ? "Live sync aktif" : "Menyambungkan…"}</span>
            <button className="icon-button admin-menu-button" onClick={() => setMobileMenuOpen(v => !v)} aria-label="Buka menu admin">{mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}</button>
            <Link href="/" className="icon-button" aria-label="Kembali ke beranda">
              <ArrowLeft size={18} />
            </Link>
            <button className="icon-button admin-mobile-only" onClick={() => void signOut()} aria-label="Keluar">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <nav className="admin-tabs" aria-label="Menu admin">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className={tab === id ? "is-active" : ""} onClick={() => { setTab(id); setMobileMenuOpen(false); }}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        {tab === "Overview" && (
          <>
            <section className="admin-metrics">
              <Metric label="USER TERDAFTAR" value={String(users.length)} detail={`${newUsers7d} baru 7 hari terakhir`} icon={Users} />
              <Metric label="AKTIF 24 JAM" value={String(active24h)} detail="user yang login" icon={Activity} />
              <Metric label="TOTAL UPLOAD" value={String(items.length)} detail={items.length ? "Koleksi live" : "Belum ada file"} icon={FileArchive} />
              <Metric label="FOTO / VIDEO" value={`${photos} / ${videos}`} detail={`${projects} project`} icon={FileImage} />
              <Metric label="PENYIMPANAN" value={fmtMB(storageBytes)} detail="dari 10 GB" icon={HardDrive} />
            </section>
            <section className="admin-overview-grid">
              <div className="admin-panel">
                <div className="admin-panel__head">
                  <div>
                    <span className="eyebrow">USER TERBARU</span>
                    <h2>Baru login</h2>
                  </div>
                  <button className="text-button" onClick={() => setTab("Users")}>
                    Lihat semua
                  </button>
                </div>
                <div className="user-list">
                  {users.slice(0, 5).map(u => (
                    <div className="user-row" key={u.uid}>
                      <UserAvatar u={u} />
                      <div className="user-row__info">
                        <strong>{u.name || "(tanpa nama)"}</strong>
                        <span>{u.email}</span>
                      </div>
                      <div className="user-row__meta">
                        <small>{fmtDate(u.lastLoginAt)}</small>
                      </div>
                    </div>
                  ))}
                  {!users.length && (
                    <p className="muted-note">{usersError || "Belum ada user. Mereka muncul setelah login Google pertama."}</p>
                  )}
                </div>
              </div>
              <div className="admin-panel">
                <div className="admin-panel__head">
                  <div>
                    <span className="eyebrow">UPLOAD TERBARU</span>
                    <h2>Konten masuk</h2>
                  </div>
                  <button className="text-button" onClick={() => setTab("Content")}>
                    Kelola
                  </button>
                </div>
                <div className="user-list">
                  {items.slice(0, 5).map(i => (
                    <div className="user-row" key={i.id}>
                      <span className="file-icon">
                        {i.kind === "video" ? <Video size={15} /> : i.kind === "website" || i.kind === "project" ? <FileCode2 size={15} /> : <FileImage size={15} />}
                      </span>
                      <div className="user-row__info">
                        <strong>{i.title}</strong>
                        <span>
                          {i.category} · {i.ownerName || "-"}
                        </span>
                      </div>
                      <div className="user-row__meta">
                        <small>{i.date}</small>
                      </div>
                    </div>
                  ))}
                  {!items.length && <p className="muted-note">Belum ada upload.</p>}
                </div>
              </div>
            </section>
          </>
        )}

        {tab === "Content" && (
          <section className="admin-panel content-panel">
            <div className="admin-panel__head">
              <div>
                <span className="eyebrow">MANAJEMEN KONTEN</span>
                <h2>{items.length ? `${items.length} item` : "Belum ada konten"}</h2>
              </div>
              <div className="content-actions">
                <Link href="/upload" className="primary-button">
                  <Upload size={15} /> Upload baru
                </Link>
              </div>
            </div>
            <div className="content-table">
              {items.length ? (
                items.slice(0, 100).map(item => (
                  <div className="content-table__row" key={item.id}>
                    <span className="content-name">
                      <span className="file-icon">
                        <FileArchive size={15} />
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <span>
                          {item.category} · {item.date}
                        </span>
                      </span>
                    </span>
                    <span>{item.ownerName ? `oleh ${item.ownerName}` : item.subtitle}</span>
                    <span>{item.size}</span>
                    <span className="status-row__value">
                      <strong>Published</strong>
                    </span>
                    <span className="row-actions">
                      <button
                        className="table-more"
                        aria-label={`Ubah ${item.title}`}
                        onClick={() => {
                          const t = window.prompt("Ubah judul", item.title);
                          if (t && t.trim()) void updateItem(item.id, { title: t.trim() });
                        }}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="table-more"
                        aria-label={`Hapus ${item.title}`}
                        onClick={() => {
                          if (window.confirm(`Hapus "${item.title}"?`)) void deleteItem(item.id);
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </span>
                  </div>
                ))
              ) : (
                <div className="content-empty">
                  <FileArchive size={22} />
                  <p>File yang di-upload akan muncul di sini.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "Users" && (
          <section className="admin-panel content-panel">
            <div className="admin-panel__head">
              <div>
                <span className="eyebrow">USER TERDAFTAR</span>
                <h2>{users.length ? `${users.length} user` : usersLoading ? "Memuat…" : "Belum ada user"}</h2>
              </div>
              <div className="content-actions">
                <button
                  className="secondary-button"
                  disabled={!users.length}
                  onClick={() => downloadCsv(users, uploadsOf)}
                >
                  <Download size={15} /> Ekspor CSV
                </button>
              </div>
            </div>
            <div className="user-stats">
              <div>
                <UserPlus size={16} /> <strong>{newUsers7d}</strong> baru 7 hari
              </div>
              <div>
                <Activity size={16} /> <strong>{active24h}</strong> aktif 24 jam
              </div>
            </div>
            <div className="admin-search">
              <Search size={16} />
              <input value={userQuery} onChange={e => setUserQuery(e.target.value)} placeholder="Cari nama atau email" />
            </div>
            {usersError && <p className="error-note">{usersError}</p>}
            <div className="user-list">
              {filteredUsers.map(u => (
                <div className="user-row" key={u.uid}>
                  <UserAvatar u={u} />
                  <div className="user-row__info">
                    <strong>{u.name || "(tanpa nama)"}</strong>
                    <span>{u.email}</span>
                  </div>
                  <div className="user-row__meta">
                    <span>{uploadsOf(u.uid)} upload</span>
                    <small>Daftar {fmtDate(u.createdAt)}</small>
                    <small>Login {fmtDate(u.lastLoginAt)}</small>
                  </div>
                  <button
                    className="table-more"
                    aria-label={`Hapus data ${u.email}`}
                    onClick={() => {
                      if (window.confirm(`Hapus catatan user ${u.email}? (akun Google-nya tidak terhapus, dan akan tercatat lagi bila login)`))
                        void removeUser(u.uid);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {!filteredUsers.length && !usersError && (
                <p className="muted-note">
                  {users.length ? "Tidak ada user yang cocok." : "User akan muncul di sini setelah login Google pertama kali."}
                </p>
              )}
            </div>
          </section>
        )}

        {tab === "Spotlight" && <SpotlightAdmin />}
        {tab === "Branding" && (
          <section className="admin-panel content-panel">
            <div className="admin-panel__head">
              <div>
                <span className="eyebrow">IKON & NAMA</span>
                <h2>Ubah ikon aplikasi / web</h2>
              </div>
            </div>
            <div className="branding-form">
              <div className="branding-previews">
                <div className="branding-preview">
                  {iconPreview ? (
                    <img src={iconPreview} alt="Ikon baru" />
                  ) : site.icon ? (
                    <img src={site.icon} alt="Ikon saat ini" />
                  ) : (
                    <span>W</span>
                  )}
                </div>
                <div className="branding-preview branding-preview--round">
                  {iconPreview ? <img src={iconPreview} alt="" /> : site.icon ? <img src={site.icon} alt="" /> : <span>W</span>}
                </div>
              </div>
              <label>
                <span>Nama aplikasi / situs</span>
                <input
                  value={siteName ?? site.name}
                  onChange={e => setSiteName(e.target.value)}
                  placeholder="WILKAXYZ"
                  maxLength={40}
                />
              </label>
              {iconRaw && (
                <Cropper file={iconRaw} outW={512} onCancel={() => setIconRaw(null)} onDone={d => { setIconFile(dataUrlToFile(d, "ikon.jpg")); setIconRaw(null); }} />
              )}
              <label className="file-pick">
                <span>
                  <ImagePlus size={16} /> {iconFile ? iconFile.name : "Pilih gambar ikon (persegi lebih baik)"}
                </span>
                <input type="file" accept="image/*" onChange={e => { setIconRaw(e.target.files?.[0] || null); e.target.value = ""; }} />
              </label>
              <div className="splash-admin">
                <span className="eyebrow">SPLASH SCREEN</span>
                <strong>Foto pembuka aplikasi</strong>
                <small>Ditampilkan sekali saat aplikasi dibuka di perangkat.</small>
                {splashPreview && <img src={splashPreview} alt="Preview splash screen" />}
                <label className="file-pick"><span><ImagePlus size={16} /> {splashFile ? splashFile.name : "Pilih foto splash"}</span><input type="file" accept="image/*" onChange={e => { setSplashFile(e.target.files?.[0] || null); e.target.value = ""; }} /></label>
                {(site.splash || splashFile) && (
                  <button className="danger-button" type="button" disabled={saving} onClick={() => (splashFile && !site.splash ? setSplashFile(null) : void onDelete("splash", "splash screen"))}>
                    <Trash2 size={15} /> {splashFile && !site.splash ? "Batalkan pilihan" : "Hapus splash"}
                  </button>
                )}
              </div>
              <div className="support-dev-admin">
                <span className="eyebrow">SUPPORT DEV</span>
                <strong>QR donasi</strong>
                <small>Di web akan tampil sebagai tombol. Gambar QR baru muncul setelah tombol ditekan.</small>
                {supportQrPreview && <img src={supportQrPreview} alt="Preview QR donasi" />}
                <label className="file-pick"><span><ImagePlus size={16} /> {supportQrFile ? supportQrFile.name : "Pilih gambar QR pembayaran"}</span><input type="file" accept="image/*" onChange={e => { setSupportQrFile(e.target.files?.[0] || null); e.target.value = ""; }} /></label>
                {(site.supportQr || supportQrFile) && (
                  <button className="danger-button" type="button" disabled={saving} onClick={() => (supportQrFile && !site.supportQr ? setSupportQrFile(null) : void onDelete("supportQr", "QR donasi"))}>
                    <Trash2 size={15} /> {supportQrFile && !site.supportQr ? "Batalkan pilihan" : "Hapus QR donasi"}
                  </button>
                )}
              </div>
              <div className="form-actions">
                <button className="primary-button" disabled={saving} onClick={onSave}>
                  {saving ? "Menyimpan…" : "Simpan perubahan"}
                </button>
                {site.icon && (
                  <button className="danger-button" type="button" disabled={saving} onClick={() => void onDelete("icon", "ikon aplikasi")}>
                    <Trash2 size={15} /> Hapus ikon
                  </button>
                )}
              </div>
              {savedMsg && <p className="muted-note">{savedMsg}</p>}
              <p className="muted-note">
                Ikon dan nama langsung berubah di tab browser, logo, layar utama iPhone, dan aplikasi yang di-install pada
                kunjungan berikutnya. Android/Chrome memperbarui ikon aplikasi terpasang secara berkala (bisa 1–3 hari);
                untuk melihat langsung, hapus lalu install ulang aplikasinya.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
