import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, authEnabled } from "./auth";
import { useInstall, detectPlatform } from "./pwa";
import { useSite } from "./site";
import { useProfiles, saveProfile, removeProfilePhoto } from "./profiles";
import { useSuccess } from "./UploadSuccess";
import { NotificationSettings } from "./Notifications";
import { sendNotify, unregisterPush } from "./push";
import Cropper from "./Cropper";
import { SpotlightCarousel } from "./Spotlight";
import type { LucideIcon } from "lucide-react";
import { useRealtimeItems, type MediaItem } from "./realtime";
import {
  Archive,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  FileArchive,
  FileCode2,
  FileText,
  FolderKanban,
  Grid2X2,
  Heart,
  Image as ImageIcon,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Smile,
  Music2,
  Play,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Upload,
  Video,
  X,
  Zap,
  LogOut,
  Download,
  Trash2,
  ExternalLink,
  Smartphone,
  Monitor,
  Share,
  ArrowUpDown,
  ShieldCheck,
  User,
  MessageCircle,
  Repeat2,
  Link2,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", icon: Compass },
  { label: "My Gallery", href: "/gallery", icon: Grid2X2 },
  { label: "My Photos", href: "/photos", icon: ImageIcon },
  { label: "My Videos", href: "/videos", icon: Video },
  { label: "My Projects", href: "/projects", icon: FolderKanban },
  { label: "My Websites", href: "/websites", icon: FileCode2 },
  { label: "Favorites", href: "/favorites", icon: Heart },
  { label: "Collections", href: "/collections", icon: Archive },
];

const FILTERS = ["All items", "Photos", "Videos", "Projects", "Websites", "Documents"];
const ID: Record<string, string> = { "All items": "Semua", Photos: "Foto", Videos: "Video", Projects: "Proyek", Websites: "Situs", Documents: "Dokumen" };
const SORTS = ["Terbaru", "Terlama", "Judul A–Z"] as const;
type SortMode = (typeof SORTS)[number];
const CATEGORY_ROUTE: Record<string, string> = {
  Photos: "/photos",
  Videos: "/videos",
  Projects: "/projects",
  Websites: "/websites",
};

const PAGE_META: Record<
  string,
  { eyebrow: string; title: string; description: string }
> = {
  "/": {
    eyebrow: "PERSONAL DIGITAL COLLECTION",
    title: "Your archive,\nin orbit.",
    description:
      "A calm place for the things you make, keep, and come back to.",
  },
  "/gallery": {
    eyebrow: "MY GALLERY",
    title: "Everything worth\nkeeping close.",
    description: "Browse every asset in one visual stream.",
  },
  "/photos": {
    eyebrow: "MY PHOTOS",
    title: "Still frames,\nsoftly collected.",
    description: "Your visual notes, references, and favorite moments.",
  },
  "/videos": {
    eyebrow: "MY VIDEOS",
    title: "Motion with\na memory.",
    description: "Short films, captures, and ideas in motion.",
  },
  "/projects": {
    eyebrow: "MY PROJECTS",
    title: "Builds in\nprogress.",
    description: "The work behind the work, kept beautifully organized.",
  },
  "/websites": {
    eyebrow: "MY WEBSITES",
    title: "Small sites,\nbig intent.",
    description: "Your web experiments and digital homes.",
  },
  "/favorites": {
    eyebrow: "FAVORITES",
    title: "The ones you\ncome back to.",
    description: "A focused shelf for the work that still sparks something.",
  },
  "/collections": {
    eyebrow: "COLLECTIONS",
    title: "Organized by\nfeeling.",
    description: "Make loose references feel like a point of view.",
  },
  "/search": {
    eyebrow: "SEARCH YOUR ARCHIVE",
    title: "Find the\nright signal.",
    description:
      "Search titles, tags, and descriptions across your collection.",
  },
  "/settings": {
    eyebrow: "SETTINGS",
    title: "Make it feel\nlike yours.",
    description: "Tune your profile, storage, and notification preferences.",
  },
};

const COLLECTIONS: Array<{
  title: string;
  count: string;
  image: string;
  tone: string;
}> = [];

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function Logo() {
  const { site } = useSite();
  return (
    <Link href="/" className="brand-lockup" aria-label={`${site.name} home`}>
      {site.icon ? (
        <img className="brand-icon" src={site.icon} alt="" />
      ) : (
        <span className="brand-orbit">
          <span />
        </span>
      )}
      <span className="brand-wordmark">{site.name.toUpperCase()}</span>
    </Link>
  );
}

function SupportDev({ qr, onClose }: { qr: string; onClose: () => void }) { return <div className="support-qr-backdrop" role="dialog" aria-modal="true" onClick={onClose}><div className="support-qr-card" onClick={e => e.stopPropagation()}><button className="icon-button" onClick={onClose} aria-label="Tutup"><X size={18} /></button><h2>Support Dev</h2><p>Scan QR ini untuk dukungan.</p><img src={qr} alt="QR pembayaran donasi" /></div></div>; }

function AutoVideo({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null); const [muted, setMuted] = useState(true);
  useEffect(() => { const el = ref.current; if (!el) return; const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { void el.play().catch(() => {}); } else { el.pause(); } }, { threshold: .55 }); observer.observe(el); return () => observer.disconnect(); }, []);
  return <div className="video-frame"><video ref={ref} src={src} title={title} muted={muted} loop playsInline preload="metadata" /><button className="video-sound" onClick={e => { e.stopPropagation(); setMuted(v => !v); }} aria-label={muted ? "Nyalakan suara" : "Matikan suara"}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button></div>;
}

// Teks panjang dipotong beberapa baris; tombol "Selengkapnya" membuka semuanya (tanpa membuka detail postingan)
function ExpandableText({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);
  return (
    <div className="post-text-wrap">
      <div ref={ref} className={`post-text ${open ? "" : "is-clamped"}`}>{text}</div>
      {(clamped || open) && (
        <button type="button" className="read-more" onClick={e => { e.stopPropagation(); setOpen(v => !v); }}>
          {open ? "Tutup" : "Selengkapnya"}
        </button>
      )}
    </div>
  );
}

const MediaCard = memo(function MediaCard({ item, onFavorite, onLike, onRepost, onOpen, onDelete, canDelete, currentUserId }: { item: MediaItem; onFavorite: (id: number) => void; onLike: (id: number) => void; onRepost: (item: MediaItem) => void; onOpen: (item: MediaItem) => void; onDelete: (id: number) => void; canDelete?: boolean; currentUserId?: string }) {
  const profiles = useProfiles();
  const prof = item.ownerId ? profiles[item.ownerId] : undefined;
  const ownerName = prof?.name || item.ownerName || "Pengguna";
  const liked = !!currentUserId && (item.likedBy || []).includes(currentUserId);
  const share = async (e: MouseEvent) => { e.stopPropagation(); const url = `${window.location.origin}/p/${item.id}`; try { if (navigator.share) await navigator.share({ title: item.title, text: item.text || item.subtitle, url }); else await navigator.clipboard.writeText(url); } catch { /* dibatalkan */ } };
  return <article className={`media-card media-card--${item.ratio}`} onClick={() => onOpen(item)}>
    {item.repostOf && <div className="repost-label"><Repeat2 size={14} /> Repost</div>}
    <div className="post-head"><Link href={item.ownerId ? `/u/${encodeURIComponent(ownerName)}` : "#"} onClick={e => e.stopPropagation()} className="avatar avatar--lime">{prof?.photo ? <img src={prof.photo} alt="" referrerPolicy="no-referrer" /> : ownerName.charAt(0).toUpperCase()}</Link><strong>{ownerName}</strong><span className="post-head__time">{item.date}</span></div>
    {(item.text || item.subtitle) && <ExpandableText text={item.text || item.subtitle} />}
    {(item.video || item.image || item.images?.length) && <div className="media-card__visual">{item.video ? <AutoVideo src={item.video} title={item.title} /> : <img src={item.image || item.images?.[0]} alt={item.title} loading="lazy" decoding="async" />}{item.images && item.images.length > 1 && <span className="carousel-count">1 / {item.images.length}</span>}<span className="media-card__kind">{ID[item.category] || item.category}</span></div>}
    {!item.image && !item.images?.length && !item.text && <div className="media-card__file-placeholder"><FileText size={32} /><span>{item.kind.toUpperCase()}</span></div>}
    <div className="media-card__body"><div className="media-card__copy"><h3>{item.title}</h3><p>{item.tags.map(t => `#${t}`).join(" ")}</p></div>{item.link && <a className="icon-button icon-button--small" href={item.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} aria-label={`Buka ${item.title}`}><ExternalLink size={16} /></a>}{canDelete && <button className="icon-button icon-button--small" onClick={e => { e.stopPropagation(); if (window.confirm(`Hapus "${item.title}"?`)) onDelete(item.id); }} aria-label={`Hapus ${item.title}`}><Trash2 size={16} /></button>}</div>
    <div className="post-actions"><button className={liked ? "is-liked" : ""} onClick={e => { e.stopPropagation(); onLike(item.id); }}><Heart size={17} fill={liked ? "currentColor" : "none"} /> {item.likes || 0}</button><button onClick={e => { e.stopPropagation(); onOpen(item); }}><MessageCircle size={17} /> {item.comments?.length || 0}</button><button onClick={e => { e.stopPropagation(); onRepost(item); }}><Repeat2 size={17} /></button><button onClick={share}><Link2 size={17} /></button><button className={item.favorite ? "is-saved" : ""} onClick={e => { e.stopPropagation(); onFavorite(item.id); }}><Star size={17} fill={item.favorite ? "currentColor" : "none"} /></button></div>
  </article>;
});

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const EMOJIS = ["😀","😂","🥹","😍","🥰","😎","🤩","😭","🙏","👍","👏","🔥","✨","💙","🩵","❄️","🎉","💯","🙌","🤝","😴","🤔","👀","🚀"];

function UploadPanel({ onClose, onUpload, userName, userPhoto }: { onClose: () => void; onUpload: (item: MediaItem) => void; userName: string; userPhoto?: string }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const previews = useMemo(() => files.map(f => (f.type.startsWith("image/") ? URL.createObjectURL(f) : "")), [files]);
  useEffect(() => () => previews.forEach(u => u && URL.revokeObjectURL(u)), [previews]);

  const addImages = (list: FileList | null) => {
    const picked = Array.from(list || []).filter(f => f.type.startsWith("image/"));
    if (!picked.length) return;
    setFiles(prev => [...prev.filter(f => f.type.startsWith("image/")), ...picked].slice(0, 6));
  };
  const addVideo = (list: FileList | null) => {
    const v = list?.[0];
    if (v && v.type.startsWith("video/")) setFiles([v]);
  };
  const insert = (t: string) => {
    const el = area.current;
    if (!el) return setText(x => x + t);
    const st = el.selectionStart ?? text.length, en = el.selectionEnd ?? text.length;
    setText(text.slice(0, st) + t + text.slice(en));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(st + t.length, st + t.length); });
  };
  const reset = () => { setText(""); setFiles([]); setEmojiOpen(false); };
  const empty = !files.length && !text.trim();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (empty || sending) return;
    setSending(true);
    try {
      const images = await Promise.all(files.filter(f => f.type.startsWith("image/")).map(fileToDataUrl));
      const videoFile = files.find(f => f.type.startsWith("video/"));
      const video = videoFile ? await fileToDataUrl(videoFile) : undefined;
      const first = files[0];
      const tags = Array.from(new Set((text.match(/#([\p{L}\p{N}_]+)/gu) || []).map(t => t.slice(1).toLowerCase()))).slice(0, 10);
      onUpload({ id: Date.now(), title: text.trim() ? "Post baru" : video ? "Video baru" : "Post foto", subtitle: text.trim(), text: text.trim() || undefined, category: video ? "Videos" : "Photos", kind: video ? "video" : "photo", tags, image: images[0], images, video, date: "Baru saja", size: first ? formatBytes(first.size) : "", sizeBytes: first?.size ?? 0, favorite: false, ratio: "landscape" });
      reset();
      onClose();
    } catch (error) {
      window.alert(`Upload gagal: ${error instanceof Error ? error.message : "coba lagi"}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="new-thread-screen" role="dialog" aria-modal="true">
      <header className="new-thread-header">
        <button type="button" className="new-thread-close" onClick={onClose} aria-label="Tutup"><X size={30} strokeWidth={1.8} /></button>
        <strong>Postingan baru</strong>
        <button type="button" className="new-thread-more" onClick={() => { if (!empty && window.confirm("Bersihkan draft?")) reset(); }} aria-label="Bersihkan draft" title="Bersihkan draft"><Trash2 size={22} /></button>
      </header>
      <form className="new-thread-form" onSubmit={submit}>
        <div className="new-thread-identity">
          <div className="avatar avatar--lime">{userPhoto ? <img src={userPhoto} alt="" referrerPolicy="no-referrer" /> : userName.charAt(0).toUpperCase()}</div>
          <div className="new-thread-author"><strong>{userName}</strong><button type="button" className="thread-tag" onClick={() => insert(text && !/\s$/.test(text) ? " #" : "#")}>›&nbsp; Tag</button></div>
        </div>
        <textarea ref={area} autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="Ada yang baru?" aria-label="Isi postingan" />
        {files.length > 0 && (
          <div className="new-thread-previews">
            {files.map((file, i) => (
              <div className="new-thread-preview" key={`${file.name}-${file.lastModified}-${i}`}>
                {file.type.startsWith("video/") ? <Video size={24} /> : <img src={previews[i]} alt="Preview" />}
                <button type="button" className="preview-remove" onClick={() => setFiles(prev => prev.filter((_, k) => k !== i))} aria-label="Hapus lampiran"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="new-thread-tools">
          <label className="new-thread-tool" aria-label="Tambah foto" title="Foto"><ImageIcon size={27} /><input type="file" accept="image/*" multiple onChange={e => { addImages(e.target.files); e.target.value = ""; }} /></label>
          <label className="new-thread-tool" aria-label="Tambah video" title="Video (maks ±500 KB)"><Video size={27} /><input type="file" accept="video/*" onChange={e => { addVideo(e.target.files); e.target.value = ""; }} /></label>
          <label className="new-thread-tool" aria-label="Tambah GIF" title="GIF"><span className="gif-icon">GIF</span><input type="file" accept="image/gif" onChange={e => { addImages(e.target.files); e.target.value = ""; }} /></label>
          <button type="button" className="new-thread-tool" aria-label="Tambah emoji" onClick={() => setEmojiOpen(v => !v)}><Smile size={27} /></button>
        </div>
        {emojiOpen && <div className="emoji-grid">{EMOJIS.map(e => <button type="button" key={e} onClick={() => insert(e)}>{e}</button>)}</div>}
        <div className="new-thread-bottom">
          <span className="thread-selected">{files.length ? `${files.length} lampiran` : "Tanpa lampiran"}</span>
          <button className="new-thread-post" type="submit" disabled={empty || sending}>{sending ? "Memposting…" : "Posting"}</button>
        </div>
      </form>
    </div>
  );
}

async function doSignOut(signOut: () => Promise<void> | void) {
  await unregisterPush().catch(() => {});
  await signOut();
}

export default function Home() {
  const [location, navigate] = useLocation();
  const { items, connected, addItem, toggleFavorite, deleteItem, likeItem, addComment } =
    useRealtimeItems();
  const { user, isAdmin, loading: authLoading, signInWithGoogle, signOut } =
    useAuth();
  const { canInstall, install, helpOpen, closeHelp } = useInstall();
  const profiles = useProfiles();
  const { site } = useSite();
  const [supportOpen, setSupportOpen] = useState(false);
  const myPhoto = user ? (profiles[user.id]?.photo ?? user.avatar) : undefined;
  const { show: showOk, node: okNode } = useSuccess();
  const [sortMode, setSortMode] = useState<SortMode>("Terbaru");
  const [loginOpen, setLoginOpen] = useState(false);
  const canUpload = !authEnabled || !!user;
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All items");
  const [uploadOpen, setUploadOpen] = useState(location === "/upload");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [detail, setDetail] = useState<MediaItem | null>(null);
  const page = PAGE_META[location] || PAGE_META["/"];
  const photoCount = items.filter(item => item.category === "Photos").length;
  const videoCount = items.filter(item => item.category === "Videos").length;
  const projectCount = items.filter(
    item => item.category === "Projects"
  ).length;
  const websiteCount = items.filter(
    item => item.category === "Websites"
  ).length;
  const favoriteCount = items.filter(item => item.favorite).length;
  const storageBytes = items.reduce(
    (total, item) => total + (item.sizeBytes || 0),
    0
  );
  const storagePercent = Math.min(
    100,
    Math.round((storageBytes / (10 * 1024 * 1024 * 1024)) * 100)
  );

  useEffect(() => {
    setUploadOpen(location === "/upload");
    if (location === "/search") setActiveFilter("All items");
  }, [location]);

  const pageItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const routeFilter: Record<string, string | undefined> = {
      "/photos": "Photos",
      "/videos": "Videos",
      "/projects": "Projects",
      "/websites": "Websites",
      "/favorites": "Favorites",
    };
    const list = items.filter(item => {
      const profileMatch = location.startsWith("/u/") ? decodeURIComponent(location.slice(3)).toLowerCase() : "";
      const detailMatch = location.startsWith("/p/") ? Number(location.slice(3)) === item.id : true;
      const matchesRoute = location === "/favorites" ? item.favorite : (profileMatch ? (item.ownerName || "").toLowerCase() === profileMatch : (!routeFilter[location] || item.category === routeFilter[location]));
      const matchesFilter =
        activeFilter === "All items" || item.category === activeFilter;
      const matchesSearch =
        !normalizedSearch ||
        [item.title, item.subtitle, item.category, ...item.tags]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesRoute && detailMatch && matchesFilter && matchesSearch;
    });
    if (sortMode === "Terlama") return [...list].sort((a, b) => a.id - b.id);
    if (sortMode === "Judul A–Z") return [...list].sort((a, b) => a.title.localeCompare(b.title));
    return [...list].sort((a, b) => b.id - a.id);
  }, [activeFilter, items, location, search, sortMode]);

  useEffect(() => { setVisibleCount(20); }, [location]);
  useEffect(() => { const found = location.startsWith("/p/") ? items.find(i => i.id === Number(location.slice(3))) : null; setDetail(found || null); }, [location, items]);

  const collections = useMemo(() => {
    const map = new Map<string, MediaItem[]>();
    items.forEach(i => map.set(i.category, [...(map.get(i.category) || []), i]));
    return Array.from(map.entries()).map(([title, list]) => ({
      title,
      count: list.length,
      cover: list.find(i => i.image)?.image,
    }));
  }, [items]);

  const openCollection = (title: string) => {
    const route = CATEGORY_ROUTE[title];
    if (route) navigate(route);
    else {
      setActiveFilter(title);
      navigate("/gallery");
    }
  };

  const handleFavorite = (id: number) => {
    void toggleFavorite(id);
  };
  const handleDelete = (id: number) => { void deleteItem(id); };
  const handleLike = (id: number) => { if (authEnabled && !user) { setLoginOpen(true); return; } const was = !!user && !!items.find(i => i.id === id)?.likedBy?.includes(user.id); void likeItem(id, user?.id).then(() => { if (!was && user) void sendNotify({ type: "like", itemId: id }); }).catch(() => {}); };
  const handleRepost = (item: MediaItem) => { if (!canUpload) { setLoginOpen(true); return; } void addItem({ ...item, id: Date.now(), title: `Repost: ${item.title}`, repostOf: item.id, date: "Baru saja", ownerId: undefined, ownerName: undefined, ownerEmail: undefined, favorite: false }); };
  const handleOpen = (item: MediaItem) => { setDetail(item); navigate(`/p/${item.id}`); };
  const handleUpload = (item: MediaItem) => {
    addItem(item)
      .then(() => { showOk("Berhasil terupload"); void sendNotify({ type: "post", itemId: item.id }); })
      .catch(err => window.alert(`Upload gagal: ${err?.message || "coba lagi"}`));
  };
  // handler stabil supaya kartu (memo) tidak dirender ulang saat scroll / state lain berubah
  const hRef = useRef({ handleFavorite, handleLike, handleRepost, handleOpen, handleDelete });
  hRef.current = { handleFavorite, handleLike, handleRepost, handleOpen, handleDelete };
  const stable = useMemo(() => ({
    fav: (id: number) => hRef.current.handleFavorite(id),
    like: (id: number) => hRef.current.handleLike(id),
    repost: (i: MediaItem) => hRef.current.handleRepost(i),
    open: (i: MediaItem) => hRef.current.handleOpen(i),
    del: (id: number) => hRef.current.handleDelete(id),
  }), []);
  const openUpload = () => {
    setMobileNavOpen(false);
    if (!canUpload) {
      setLoginOpen(true);
      return;
    }
    setUploadOpen(true);
    navigate("/upload");
  };
  const closeUpload = () => {
    setUploadOpen(false);
    navigate("/");
  };
  const closeLogin = () => {
    setLoginOpen(false);
    setUploadOpen(false);
    if (location === "/upload") navigate("/");
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <div className="sidebar__head">
          <Logo />
          <button
            className="icon-button sidebar-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <div
          className="profile-mini"
          onClick={() => (user || !authEnabled ? undefined : setLoginOpen(true))}
        >
          <div className="avatar avatar--lime">
            {myPhoto ? (
              <img src={myPhoto} alt="" referrerPolicy="no-referrer" />
            ) : (
              (user?.name?.charAt(0) || (authEnabled ? "G" : "W")).toUpperCase()
            )}
          </div>
          <div>
            <strong>{user?.name || (authEnabled ? "Tamu" : "Wilka")}</strong>
            <span>
              {user
                ? isAdmin
                  ? "Admin"
                  : user.email
                : authEnabled
                  ? "Ketuk untuk masuk"
                  : "Personal space"}
            </span>
          </div>
          {user ? (
            <button
              className="icon-button"
              onClick={e => {
                e.stopPropagation();
                void doSignOut(signOut);
              }}
              aria-label="Sign out"
            >
              <LogOut size={15} />
            </button>
          ) : (
            <ChevronDown size={15} />
          )}
        </div>
        <div className="nav-section-label">SPACE</div>
        <nav className="main-nav">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileNavOpen(false)}
              className={`nav-link ${location === href ? "is-active" : ""}`}
            >
              <Icon size={17} strokeWidth={location === href ? 2.2 : 1.8} />
              <span>{label}</span>
              {href === "/favorites" && favoriteCount > 0 && (
                <span className="nav-count">{favoriteCount}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar__bottom">
          {isAdmin && (<Link href="/admin" className="nav-link nav-link--admin">
            <LayoutDashboard size={17} />
            <span>Admin dashboard</span>
            <ArrowUpRight size={14} />
          </Link>)}
          <Link
            href="/settings"
            className={`nav-link ${location === "/settings" ? "is-active" : ""}`}
          >
            <Settings size={17} />
            <span>Settings</span>
          </Link>
          {canInstall && (
            <button className="nav-link nav-link--install" onClick={install}>
              <Download size={17} />
              <span>Install aplikasi</span>
            </button>
          )}
        </div>
      </aside>

      <div className="mobile-topbar">
        <button
          className="icon-button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <Logo />
        {canInstall ? (
          <button className="install-button" onClick={install}>
            <Download size={15} /> Install
          </button>
        ) : (
          <span className="topbar-spacer" />
        )}
      </div>

      <main className="main-content">
        {location === "/" && <SpotlightCarousel />}
        <header className="topbar">
          <div className="topbar__crumb">
            <span>WILKAXYZ</span>
            <span className="crumb-dot">/</span>
            <strong>{page.eyebrow.toLowerCase()}</strong>
          </div>
          <div className="topbar__actions">
            <span className="round-status">
              <span className="status-dot" />{" "}
              {connected ? "Sinkron aktif" : "Menyambungkan…"}
            </span>
            {canInstall && (
              <button className="install-button" onClick={install}>
                <Download size={15} /> Install aplikasi
              </button>
            )}
            <div className="avatar avatar--dark">
              {myPhoto ? (
                <img src={myPhoto} alt="" referrerPolicy="no-referrer" />
              ) : (
                (user?.name?.charAt(0) || "W").toUpperCase()
              )}
            </div>
          </div>
        </header>

        {location !== "/settings" && location !== "/collections" && canUpload && !uploadOpen && <section className="compose-row" onClick={openUpload}><div className="avatar avatar--lime">{myPhoto ? <img src={myPhoto} alt="" referrerPolicy="no-referrer" /> : (user?.name?.charAt(0) || "W").toUpperCase()}</div><span className="compose-row__text">Ada yang ingin dibagikan?</span><button className="primary-button" type="button">Unggah</button></section>}
        {uploadOpen && canUpload && <UploadPanel onClose={closeUpload} onUpload={handleUpload} userName={user?.name || "Wilkaxyz"} userPhoto={myPhoto} />}

        {location === "/collections" ? (
          <section className="collections-grid">
            {collections.map(c => (
              <button key={c.title} className="collection-card" onClick={() => openCollection(c.title)}>
                {c.cover && <img src={c.cover} alt="" loading="lazy" />}
                <span className="collection-card__overlay" />
                <span className="collection-card__copy">
                  <h3>{c.title}</h3>
                  <span>{c.count} item</span>
                </span>
              </button>
            ))}
            {!collections.length && (
              <div className="empty-state empty-state--wide">
                <Archive size={24} />
                <h3>Koleksi masih kosong</h3>
                <p>Koleksi dibuat otomatis dari kategori setelah kamu upload file pertama.</p>
                <button className="primary-button" onClick={openUpload}>
                  <Upload size={16} /> Upload file pertama
                </button>
              </div>
            )}
            <button className="collection-card collection-card--new" onClick={openUpload}>
              <Plus size={24} />
              <strong>Tambah item</strong>
              <span>Koleksi terbentuk otomatis</span>
            </button>
          </section>
        ) : location === "/settings" ? (
          <SettingsPanel user={user} isAdmin={isAdmin} canSignIn={authEnabled} onSignIn={() => setLoginOpen(true)} onSignOut={() => void doSignOut(signOut)} onInstall={install} canInstall={canInstall} />
        ) : (
          <>
            <section className="library-toolbar">
              <div className="filter-tabs">
                {FILTERS.map(filter => (
                  <button
                    key={filter}
                    className={activeFilter === filter ? "is-active" : ""}
                    onClick={() => setActiveFilter(filter)}
                  >
                    {ID[filter] || filter}
                  </button>
                ))}
              </div>
              <div className="search-control">
                <Search size={17} />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Cari unggahan"
                />
              </div>
            </section>
            {location === "/" && (
              <section className="feature-strip feature-strip--empty">
                <div className="feature-strip__copy">
                  <span className="eyebrow">MULAI DI SINI</span>
                  <h2>
                    Belum ada
                    <br />
                    <span>unggahan.</span>
                  </h2>
                  <p>
                    Jadilah yang pertama membagikan sesuatu.
                  </p>
                  <button className="primary-button" onClick={openUpload}>
                    <Upload size={15} /> Unggah pertama
                  </button>
                </div>
                <div className="feature-strip__visual">
                  <div className="orbit-line orbit-line--one" />
                  <div className="orbit-line orbit-line--two" />
                  <div className="feature-orb feature-orb--empty">
                    <Plus size={22} />
                  </div>
                  <div className="feature-strip__caption">
                    <strong>EMPTY BY DESIGN</strong>
                    <span>Waiting for your content</span>
                  </div>
                </div>
              </section>
            )}
            <section className="section-heading">
              <div>
                <span className="eyebrow">
                  {location === "/" ? "TERBARU" : "UNGGAHAN"}
                </span>
                <h2>
                  {pageItems.length} unggahan
                </h2>
              </div>
              <button
                className="sort-button"
                onClick={() => setSortMode(SORTS[(SORTS.indexOf(sortMode) + 1) % SORTS.length])}
                aria-label="Ganti urutan"
              >
                <ArrowUpDown size={14} /> {sortMode}
              </button>
            </section>
            {pageItems.length ? (
              <div className="media-masonry">
                {pageItems.slice(0, visibleCount).map(item => (
                  <MediaCard key={item.id} item={item} onFavorite={stable.fav} onLike={stable.like} onRepost={stable.repost} onOpen={stable.open} onDelete={stable.del} canDelete={!authEnabled || isAdmin || item.ownerId === user?.id} currentUserId={user?.id} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Search size={24} />
                <h3>Belum ada hasil</h3>
                <p>Coba kata kunci lain atau unggah sesuatu yang baru.</p>
                <button className="primary-button" onClick={openUpload}>
                  <Upload size={16} /> Unggah
                </button>
              </div>
            )}
            {pageItems.length > visibleCount && <button className="secondary-button load-more" onClick={() => setVisibleCount(n => n + 20)}>Muat lagi</button>}
          </>
        )}
      </main>

      {okNode}
      {site.supportQr && <button className="support-dev-button" onClick={() => setSupportOpen(true)} aria-label="Support Dev">Support Dev</button>}
      {supportOpen && site.supportQr && <SupportDev qr={site.supportQr} onClose={() => setSupportOpen(false)} />}
      <nav className="mobile-dock" aria-label="Main">
        {[
          { href: "/", label: "Beranda", Icon: Compass },
          { href: "/search", label: "Cari", Icon: Search },
        ].map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-label={label} className={location === href ? "is-active" : ""}>
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
        <button className="dock-add" onClick={openUpload} aria-label="Unggah">
          <Plus size={22} />
        </button>
        {[
          { href: "/favorites", label: "Tersimpan", Icon: Heart },
          { href: "/settings", label: "Profil", Icon: User },
        ].map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-label={label} className={location === href ? "is-active" : ""}>
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      {helpOpen && <InstallHelp onClose={closeHelp} />}
      {detail && <PostDetail item={detail} onClose={() => { setDetail(null); navigate("/"); }} onComment={text => { if (authEnabled && !user) { setLoginOpen(true); return; } const pid = detail.id; void addComment(pid, text, { id: user?.id, name: user?.name }).then(() => { void sendNotify({ type: "comment", itemId: pid }); }).catch(() => {}); }} />}
      {(loginOpen || (uploadOpen && !canUpload && !authLoading)) && (
        <LoginModal
          onClose={closeLogin}
          onGoogle={async () => {
            const ok = await signInWithGoogle("/upload");
            if (ok) {
              setLoginOpen(false);
              setUploadOpen(true);
              navigate("/upload");
            }
          }}
        />
      )}
    </div>
  );
}

function PostDetail({ item, onClose, onComment }: { item: MediaItem; onClose: () => void; onComment: (text: string) => void }) {
  const [text, setText] = useState("");
  return <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}><div className="post-detail" onClick={e => e.stopPropagation()}><div className="panel-topline"><span className="eyebrow">DETAIL POST</span><button className="icon-button" onClick={onClose}><X size={18} /></button></div>{item.video ? <video className="post-detail__image" src={item.video} controls playsInline /> : (item.images?.length ? item.images : item.image ? [item.image] : []).map((src, i) => <img key={i} className="post-detail__image" src={src} alt={item.title} decoding="async" />)}<h2>{item.title}</h2>{item.text && <p className="post-detail__text">{item.text}</p>}<div className="post-detail__tags">{item.tags.map(t => <span key={t}>#{t}</span>)}</div><div className="comments"><strong>{item.comments?.length || 0} komentar</strong>{(item.comments || []).map(c => <div className="comment" key={c.id}><b>{c.authorName}</b><span>{c.text}</span></div>)}<form onSubmit={e => { e.preventDefault(); if (text.trim()) { onComment(text); setText(""); } }}><input value={text} onChange={e => setText(e.target.value)} placeholder="Tulis komentar..." /><button className="primary-button" type="submit"><Send size={15} /></button></form></div></div></div>;
}

function LoginModal({
  onClose,
  onGoogle,
}: {
  onClose: () => void;
  onGoogle: () => void;
}) {
  return (
    <div className="login-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="login-card" onClick={e => e.stopPropagation()}>
        <h2>Masuk untuk upload</h2>
        <p>
          Melihat koleksi tidak perlu login. Untuk upload, kamu perlu masuk
          dengan akun Google.
        </p>
        <button className="google-button" onClick={onGoogle}>
          <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
            <path fill="#4aa8ec" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#6cbcf2" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#8ccbf8" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#5ab3ee" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Lanjutkan dengan Google
        </button>
        <button className="login-skip" onClick={onClose}>
          Nanti saja
        </button>
      </div>
    </div>
  );
}

function InstallHelp({ onClose }: { onClose: () => void }) {
  const platform = detectPlatform();
  const Icon = platform === "desktop" ? Monitor : Smartphone;
  const steps =
    platform === "ios"
      ? ["Buka situs ini di Safari (bukan Chrome).", "Ketuk tombol Share (kotak dengan panah ke atas).", "Pilih \"Add to Home Screen\", lalu Add."]
      : platform === "android"
        ? ["Buka situs ini di Chrome.", "Ketuk menu ⋮ di pojok kanan atas.", "Pilih \"Install app\" atau \"Add to Home screen\"."]
        : ["Buka situs ini di Chrome atau Edge.", "Klik ikon install di kanan address bar (atau menu ⋮ > Cast, save, and share > Install page as app).", "Klik Install. Aplikasi muncul di Start Menu / Launchpad."];
  return (
    <div className="login-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="login-card install-card" onClick={e => e.stopPropagation()}>
        <div className="install-card__icon">
          <Icon size={26} />
        </div>
        <h2>Install aplikasi</h2>
        <p>
          Browser kamu belum menampilkan tombol install otomatis. Ikuti langkah manual ini
          ({platform === "ios" ? "iPhone/iPad" : platform === "android" ? "Android" : "Komputer"}):
        </p>
        <ol className="install-steps">
          {steps.map(t => (
            <li key={t}>{t}</li>
          ))}
        </ol>
        {platform === "ios" && (
          <p className="muted-note">
            <Share size={13} /> iPhone hanya mendukung install lewat Safari.
          </p>
        )}
        <button className="primary-button primary-button--full" onClick={onClose}>
          Mengerti
        </button>
      </div>
    </div>
  );
}

function SettingsPanel({
  user,
  isAdmin,
  canSignIn,
  onSignIn,
  onSignOut,
  onInstall,
  canInstall,
}: {
  user: { id: string; name: string; email: string; avatar?: string } | null;
  isAdmin: boolean;
  canSignIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onInstall: () => void;
  canInstall: boolean;
}) {
  const allProfiles = useProfiles();
  const shownPhoto = user ? (allProfiles[user.id]?.photo ?? user.avatar) : undefined;
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem("wilkaxyz:compact") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("is-compact", compact);
    try {
      localStorage.setItem("wilkaxyz:compact", compact ? "1" : "0");
    } catch {
      /* abaikan */
    }
  }, [compact]);
  return (
    <section className="settings-panel">
      <div className="settings-panel__intro">
        <div className="avatar avatar--lime avatar--large">
          {shownPhoto ? (
            <img src={shownPhoto} alt="" referrerPolicy="no-referrer" />
          ) : (
            (user?.name?.charAt(0) || "G").toUpperCase()
          )}
        </div>
        <div>
          <span className="eyebrow">AKUN</span>
          <h2>{user?.name || "Tamu"}</h2>
          <p>{user ? `${user.email}${isAdmin ? " · Admin" : ""}` : "Belum masuk"}</p>
        </div>
        {user ? (
          <button className="secondary-button" onClick={onSignOut}>
            <LogOut size={15} /> Keluar
          </button>
        ) : (
          canSignIn && (
            <button className="primary-button" onClick={onSignIn}>
              Masuk dengan Google
            </button>
          )
        )}
      </div>
      {user && <ProfileEditor user={user} />}
      {user && <NotificationSettings uid={user.id} />}
      <div className="settings-list">
        {canInstall && (
          <div>
            <div>
              <strong>Install aplikasi</strong>
              <span>Pasang di layar utama HP atau komputer, jalan layaknya aplikasi.</span>
            </div>
            <button className="primary-button" onClick={onInstall}>
              <Download size={15} /> Install
            </button>
          </div>
        )}
        <div>
          <div>
            <strong>Tampilan ringkas</strong>
            <span>Kartu lebih kecil agar lebih banyak item terlihat.</span>
          </div>
          <button
            className={`toggle ${compact ? "is-on" : ""}`}
            role="switch"
            aria-checked={compact}
            aria-label="Tampilan ringkas"
            onClick={() => setCompact(v => !v)}
          >
            <i />
          </button>
        </div>
        {isAdmin && (
          <div>
            <div>
              <strong>Dashboard admin</strong>
              <span>Lihat user terdaftar, kelola konten, ubah ikon dan nama.</span>
            </div>
            <Link href="/admin" className="secondary-button">
              <ShieldCheck size={15} /> Buka
            </Link>
          </div>
        )}
      </div>
      <div className="settings-note">
        <CircleHelp size={17} />
        <span>Melihat koleksi tidak perlu login. Login Google hanya diperlukan untuk upload.</span>
      </div>
    </section>
  );
}

function ProfileEditor({ user }: { user: { id: string; name: string; avatar?: string } }) {
  const profiles = useProfiles();
  const p = profiles[user.id];
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState("");
  const [photo, setPhoto] = useState<string | undefined>(user.avatar);
  const { show: showOk, node: okNode } = useSuccess();
  const [crop, setCrop] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!p) return;
    setName(p.name || user.name);
    setBio(p.bio || "");
    setPhoto(p.photo ?? user.avatar);
  }, [p?.name, p?.bio, p?.photo]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      await saveProfile(user.id, { name: name.trim() || user.name, bio: bio.trim(), photo: photo || "" });
      setMsg("Profil tersimpan. Foto dan nama baru tampil di semua unggahanmu.");
      showOk("Profil berhasil terupload");
    } catch (e: any) {
      setMsg(`Gagal: ${e?.message || "coba lagi"}`);
    }
    setBusy(false);
  };

  const deletePhoto = async () => {
    if (!window.confirm("Hapus foto profil?")) return;
    setBusy(true);
    setMsg("");
    try {
      await removeProfilePhoto(user.id);
      setPhoto("");
      showOk("Foto profil berhasil dihapus", "del");
    } catch (e: any) {
      setMsg(`Gagal: ${e?.message || "coba lagi"}`);
    }
    setBusy(false);
  };

  return (
    <div className="profile-edit">
      {okNode}
      <label className="profile-edit__photo">
        <span className="avatar avatar--lime avatar--large">
          {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : (name.charAt(0) || "W").toUpperCase()}
        </span>
        <span>{photo ? "Ganti foto" : "Upload foto"}</span>
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={e => { setCrop(e.target.files?.[0] || null); e.target.value = ""; }}
        />
        {photo && (
          <button type="button" className="danger-button danger-button--small" disabled={busy} onClick={e => { e.preventDefault(); e.stopPropagation(); void deletePhoto(); }}>
            <Trash2 size={13} /> Hapus foto
          </button>
        )}
      </label>
      <div className="profile-edit__fields">
        <label>
          <span>Nama pengguna</span>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={30} />
        </label>
        <label>
          <span>Bio</span>
          <input value={bio} onChange={e => setBio(e.target.value)} maxLength={80} placeholder="Tulis singkat tentang kamu" />
        </label>
        <button className="primary-button" onClick={save} disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan profil"}
        </button>
        {msg && <p className="muted-note">{msg}</p>}
      </div>
      {crop && <Cropper file={crop} round outW={400} maxLen={280000} onCancel={() => setCrop(null)} onDone={d => { setPhoto(d); setCrop(null); }} />}
    </div>
  );
}
