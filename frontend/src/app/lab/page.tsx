import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import LabShell from "@/components/lab/LabShell";
import { decodeLabSnapshot, LAB_URL_PARAM } from "@/lib/lab/labUrl";
import { decodeFlow, FLOW_URL_PARAM } from "@/lib/lab/flowUrl";
import { decodeKode, KODE_URL_PARAM } from "@/lib/lab/kodeUrl";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SynapLab – SynapEd",
  description:
    "Papan coba-coba untuk memvisualisasikan array (1D, 2D, 3D, N-dimensi), linked list, flowchart, Python, dan pseudocode: isi, telusuri, urutkan, gambar alur, tulis kode, lalu jalankan langkahnya satu per satu.",
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
  const params = await searchParams;
  const mentah = params[LAB_URL_PARAM];
  const kode = typeof mentah === "string" ? mentah : null;
  const dibaca = kode ? decodeLabSnapshot(kode) : null;

  // Flowchart punya parameternya sendiri (`?f=`, dipadatkan) — lihat flowUrl.ts.
  const mentahFlow = params[FLOW_URL_PARAM];
  const kodeFlow = typeof mentahFlow === "string" ? mentahFlow : null;
  const flow = kodeFlow ? await decodeFlow(kodeFlow) : null;
  // Lab kode: `?py=` (Python) & `?ps=` (pseudocode). Kode dari tautan hanya
  // DITAMPILKAN di editor, tidak pernah dijalankan sampai pengguna menekan Jalankan.
  const mentahPy = params[KODE_URL_PARAM.python];
  const kodePy = typeof mentahPy === "string" ? mentahPy : null;
  const python = kodePy ? await decodeKode(kodePy) : null;
  const mentahPs = params[KODE_URL_PARAM.pseudocode];
  const kodePs = typeof mentahPs === "string" ? mentahPs : null;
  const pseudocode = kodePs ? await decodeKode(kodePs) : null;

  const rusak =
    (kode !== null && dibaca === null) ||
    (kodeFlow !== null && flow === null) ||
    (kodePy !== null && python === null) ||
    (kodePs !== null && pseudocode === null);

  return (
    <>
      <Navbar />

      <main className="bg-paper pt-28 pb-20 lg:h-dvh lg:overflow-hidden lg:pt-[100px] lg:pb-5">
        <div className="container-page lg:h-full">
          <LabShell awal={dibaca} awalFlow={flow} awalKode={{ python, pseudocode }} tautanRusak={rusak} />
        </div>
      </main>

      <div className="lg:hidden">
        <Footer />
      </div>
    </>
  );
}
