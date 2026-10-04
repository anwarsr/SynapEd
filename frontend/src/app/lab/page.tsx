import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import LabShell from "@/components/lab/LabShell";
import { decodeLabSnapshot, LAB_URL_PARAM } from "@/lib/lab/labUrl";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SynapLab – SynapEd",
  description:
    "Papan coba-coba untuk memvisualisasikan array (1D, 2D, 3D, N-dimensi) dan linked list: isi, telusuri, urutkan, sisip, hapus, dan jalankan langkahnya satu per satu.",
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * SynapLab — papan sandbox untuk memahami materi sambil mencobanya.
 *
 * Halaman ini PUBLIK: tautan papan yang dibagikan guru harus terbuka di layar
 * siswa yang belum punya akun. Tidak ada data yang bisa bocor — lab tidak
 * menyimpan apa pun, seluruh keadaannya hidup di URL dan di browser.
 *
 * Tautan dibaca DI SERVER supaya papan hasil berbagi sudah benar pada cat
 * pertama. Kalau dibiarkan ke klien, penerima tautan melihat papan kosong
 * sekejap sebelum isinya muncul — persis di detik ia memotret layar untuk
 * kelasnya.
 *
 * Di layar lebar, halaman ini sebuah ruang kerja setinggi layar: `main`
 * dikunci setinggi viewport dan kedua panelnya menggulir sendiri. Navbar
 * melayang setinggi 84px, jadi ruang kerja dimulai sedikit di bawahnya.
 * Footer hanya dirender di layar sempit — di ruang kerja yang dikunci
 * setinggi layar, footer di bawahnya hanya bisa dicapai dengan guliran
 * halaman yang justru ingin dihilangkan.
 */
export default async function LabPage({ searchParams }: Props) {
  const mentah = (await searchParams)[LAB_URL_PARAM];
  const kode = typeof mentah === "string" ? mentah : null;
  const dibaca = kode ? decodeLabSnapshot(kode) : null;

  return (
    <>
      <Navbar />

      <main className="bg-paper pt-28 pb-20 lg:h-dvh lg:overflow-hidden lg:pt-[100px] lg:pb-5">
        <div className="container-page lg:h-full">
          <LabShell awal={dibaca} tautanRusak={kode !== null && dibaca === null} />
        </div>
      </main>

      <div className="lg:hidden">
        <Footer />
      </div>
    </>
  );
}
