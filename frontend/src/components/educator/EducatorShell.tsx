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
 *
 * `duaPanel` (lg ke atas): halaman dikunci setinggi layar supaya panel di
 * dalamnya menggulir sendiri-sendiri, pola yang sama dengan SynapLab. Footer
 * disembunyikan karena tidak ada lagi gulir halaman yang bisa mencapainya.
 */
export default function EducatorShell({
  children,
  duaPanel = false,
}: {
  user?: SessionUser;
  children: React.ReactNode;
  duaPanel?: boolean;
}) {
  return (
    <>
      <Navbar />
      <main
        className={
          duaPanel
            ? "min-h-screen bg-paper pb-28 pt-36 lg:h-dvh lg:min-h-0 lg:overflow-hidden lg:pb-5 lg:pt-[100px]"
            : "min-h-screen bg-paper pb-28 pt-36"
        }
      >
        {children}
      </main>
      <div className={duaPanel ? "lg:hidden" : undefined}>
        <Footer />
      </div>
    </>
  );
}
