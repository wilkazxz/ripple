import { Link } from "wouter";

const wrap: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "48px 20px 80px",
  lineHeight: 1.7,
  fontSize: 15,
};

export default function Legal({ type }: { type: "privacy" | "terms" }) {
  const privacy = type === "privacy";
  return (
    <main style={wrap}>
      <Link href="/">← WILKAXYZ</Link>
      <h1 style={{ fontFamily: '"Space Grotesk", Inter, sans-serif' }}>
        {privacy ? "Privacy Policy" : "Terms of Service"}
      </h1>
      <p>Terakhir diperbarui: 4 November 2026</p>
      {privacy ? (
        <>
          <h2>Data yang kami kumpulkan</h2>
          <p>
            Saat Anda masuk dengan Google, kami menerima nama, alamat email, dan
            foto profil akun Google Anda. Kami juga menyimpan konten yang Anda
            unggah (judul, deskripsi, dan gambar).
          </p>
          <h2>Cara kami menggunakan data</h2>
          <p>
            Data login dipakai hanya untuk mengenali akun Anda, menentukan siapa
            pemilik unggahan, dan membatasi hak mengubah atau menghapus konten.
            Kami tidak menjual atau membagikan data Anda ke pihak ketiga.
          </p>
          <h2>Penyimpanan</h2>
          <p>
            Data disimpan di Firebase (Google). Konten yang Anda unggah dapat dilihat
            publik oleh pengunjung situs ini.
          </p>
          <h2>Hak Anda</h2>
          <p>
            Anda dapat menghapus unggahan Anda kapan saja. Untuk meminta
            penghapusan akun dan data, hubungi wilkaaffah@gmail.com.
          </p>
        </>
      ) : (
        <>
          <h2>Penggunaan</h2>
          <p>
            Dengan memakai WILKAXYZ, Anda setuju hanya mengunggah konten yang
            Anda miliki haknya dan tidak melanggar hukum, tidak mengandung
            kekerasan, pornografi, atau pelanggaran hak cipta.
          </p>
          <h2>Moderasi</h2>
          <p>
            Admin berhak menghapus konten atau membatasi akses tanpa pemberitahuan
            bila ada pelanggaran.
          </p>
          <h2>Tanpa jaminan</h2>
          <p>Layanan disediakan apa adanya, tanpa jaminan ketersediaan.</p>
          <h2>Kontak</h2>
          <p>wilkaaffah@gmail.com</p>
        </>
      )}
    </main>
  );
}
