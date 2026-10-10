import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import type { SessionUser } from "@/lib/firebase/session";

/**
 * Kerangka halaman kerja educator.
 *
 * Dulu punya bilah atas sendiri (logo kecil, tab, "Panel Educator", tombol
 * Keluar) yang tampil beda dari seluruh situs. Kini memakai Navbar & Footer
 * beranda - navbar itu sudah memuat "Kursus Saya", "Kelas Saya", dan Dashboard
 * untuk educator - sehingga halaman kerja terasa satu keluarga dengan halaman
 * lain. `pt-36` memberi ruang bagi navbar yang mengambang.
 *
 * `user` dipertahankan di tanda tangan agar pemanggil tak perlu diubah.
 */
export default function EducatorShell({
  children,
}: {
  user?: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-paper pb-28 pt-36">{children}</main>
      <Footer />
    </>
  );
}
