// Vercel Serverless Function: kirim push notification lewat Firebase Cloud Messaging.
// Env di Vercel: FIREBASE_SERVICE_ACCOUNT (isi file JSON service account, atau versi base64-nya)
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function init() {
  if (getApps().length) return;
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("NO_SERVICE_ACCOUNT");
  raw = raw.trim();
  if (!raw.startsWith("{")) raw = Buffer.from(raw, "base64").toString("utf8");
  const sa = JSON.parse(raw);
  initializeApp({
    credential: cert({
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey: String(sa.private_key).replace(/\\n/g, "\n"),
    }),
  });
}

const clip = (s, n) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

async function once(db, key) {
  try {
    await db.collection("notif_log").doc(key).create({ at: Date.now() });
    return true;
  } catch {
    return false; // sudah pernah dikirim
  }
}

async function send(db, tokenDocs, data) {
  const tokens = [...new Set(tokenDocs.map(d => d.id))];
  let sent = 0;
  const dead = [];
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const r = await getMessaging().sendEachForMulticast({
      tokens: chunk,
      data,
      webpush: { headers: { Urgency: "high", TTL: "86400" } },
    });
    sent += r.successCount;
    r.responses.forEach((x, k) => {
      const code = x.error && x.error.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") dead.push(chunk[k]);
    });
  }
  await Promise.all(dead.map(t => db.collection("push_tokens").doc(t).delete().catch(() => {})));
  return sent;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    init();
  } catch (e) {
    return res.status(500).json({
      error: e.message === "NO_SERVICE_ACCOUNT" ? "FIREBASE_SERVICE_ACCOUNT belum diisi di Vercel" : "FIREBASE_SERVICE_ACCOUNT tidak valid",
    });
  }

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken((req.headers.authorization || "").replace(/^Bearer /i, ""));
  } catch {
    return res.status(401).json({ error: "Tidak terautentikasi" });
  }
  const uid = decoded.uid;
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const { type, itemId } = body || {};
  const db = getFirestore();

  try {
    const prof = await db.collection("profiles").doc(uid).get();
    const actor = (prof.exists && prof.data().name) || decoded.name || (decoded.email || "").split("@")[0] || "Seseorang";

    if (type === "test") {
      const snap = await db.collection("push_tokens").where("uid", "==", uid).get();
      const sent = await send(db, snap.docs, { title: "Notifikasi aktif 🎉", body: "Ini notifikasi uji dari WILKAXYZ.", url: "/", tag: "test" });
      return res.status(200).json({ sent });
    }

    if (!["like", "comment", "post"].includes(type) || !itemId) return res.status(400).json({ error: "Permintaan tidak valid" });
    const itemSnap = await db.collection("media_items").doc(String(itemId)).get();
    if (!itemSnap.exists) return res.status(404).json({ error: "Post tidak ditemukan" });
    const item = itemSnap.data();
    const url = `/p/${itemId}`;
    const tag = `${type}-${itemId}`;

    if (type === "post") {
      if (item.ownerId !== uid || Date.now() - (item.createdAt || 0) > 5 * 60 * 1000) return res.status(200).json({ sent: 0 });
      if (!(await once(db, `post_${itemId}`))) return res.status(200).json({ sent: 0 });
      const snap = await db.collection("push_tokens").where("prefs.post", "==", true).get();
      const docs = snap.docs.filter(d => d.data().uid !== uid);
      const sent = await send(db, docs, { title: `${actor} memposting`, body: clip(item.text || item.subtitle || item.title, 100), url, tag });
      return res.status(200).json({ sent });
    }

    // like / komentar -> pemilik post
    const owner = item.ownerId;
    if (!owner || owner === uid) return res.status(200).json({ sent: 0 });
    let title, text;
    if (type === "like") {
      if (!(item.likedBy || []).includes(uid)) return res.status(200).json({ sent: 0 });
      if (!(await once(db, `like_${itemId}_${uid}`))) return res.status(200).json({ sent: 0 });
      title = `${actor} menyukai postinganmu`;
      text = clip(item.text || item.subtitle || item.title, 100);
    } else {
      const mine = (item.comments || []).filter(c => c.authorId === uid);
      const last = mine[mine.length - 1];
      if (!last) return res.status(200).json({ sent: 0 });
      if (!(await once(db, `comment_${itemId}_${last.id}`.replace(/[\/.]/g, "-")))) return res.status(200).json({ sent: 0 });
      title = `${actor} mengomentari postinganmu`;
      text = clip(last.text, 100);
    }
    const snap = await db.collection("push_tokens").where("uid", "==", owner).get();
    const docs = snap.docs.filter(d => (d.data().prefs || {})[type] !== false);
    const sent = await send(db, docs, { title, body: text, url, tag });
    return res.status(200).json({ sent });
  } catch (e) {
    return res.status(500).json({ error: "Gagal mengirim: " + clip(e && e.message, 120) });
  }
}
