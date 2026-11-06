# WILKAXYZ

Vite + React + Firebase. Semua file di satu level (tanpa folder) supaya mudah di-upload lewat web GitHub.

## Upload ke GitHub
Add file > Upload files > tarik semua file > Commit. (Jangan upload node_modules / dist.)

## Deploy ke Vercel
Add New > Project > pilih repo. Framework Vite terdeteksi otomatis. Root Directory kosong. Deploy.

## Firebase (wajib sekali)
1. Authentication > Sign-in method > Google: aktifkan.
2. Authentication > Settings > Authorized domains: tambahkan domain xxx.vercel.app.
3. Firestore Database > Rules: tempel isi `firestore-rules.txt`, lalu Publish.
   (Tanpa ini, daftar user di /admin akan menampilkan "Akses ditolak".)

## Admin (/admin)
Login dengan email admin (lihat ADMIN_EMAILS di auth.ts dan firestore-rules.txt, harus sama).
Tab: Overview, Konten, User (daftar user terdaftar + cari + ekspor CSV), Ikon & nama.

## Install sebagai aplikasi
- Android (Chrome): tombol Install di aplikasi, atau menu ⋮ > Install app. Hasilnya WebAPK (terpasang seperti aplikasi biasa).
- iPhone: Safari > Share > Add to Home Screen.
- Komputer (Chrome/Edge): ikon install di address bar atau tombol Install di aplikasi.
- File .apk/.aab untuk Play Store: buka pwabuilder.com, masukkan URL Vercel, pilih Android.

## Notifikasi push (opsional)
1. Firebase Console > Project settings > Cloud Messaging > Web Push certificates > Generate key pair.
2. Vercel > Settings > Environment Variables:
   - `VITE_FIREBASE_VAPID_KEY` = key pair di atas.
   - `FIREBASE_SERVICE_ACCOUNT` = isi file JSON service account (Project settings > Service accounts > Generate new private key), boleh versi base64.
3. Fungsi server: file `notify.js` di sini hanya penyimpanan. Agar aktif, di GitHub buat file baru bernama `api/notify.js` (Add file > Create new file, ketik `api/notify.js`) lalu tempel isi `notify.js`. Vercel hanya mengenali fungsi di folder `api`.
4. Deploy ulang.
Tanpa langkah ini, menu notifikasi otomatis tersembunyi.

## Catatan teknis
- Like & komentar memakai transaksi Firestore, jadi tidak saling menimpa saat banyak orang berinteraksi bersamaan.
- Rules Firestore (`firestore-rules.txt`) membatasi user non-pemilik: hanya boleh like atas nama sendiri dan menambah komentar.
- Setelah mengubah rules, tempel ulang ke Firestore > Rules > Publish.
