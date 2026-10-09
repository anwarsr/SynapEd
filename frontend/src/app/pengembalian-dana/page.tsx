import Link from "next/link";
import { Bullets, Clause, LegalPage } from "@/components/legal/LegalPage";
import { COMPANY } from "@/lib/company";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kebijakan Pengembalian Dana – SynapEd",
  description:
    "Kursus digital di SynapEd tidak dapat dikembalikan, dengan pengecualian untuk kegagalan akses dan pembayaran ganda.",
};

/**
 * Kebijakan dasarnya: tidak ada pengembalian dana — sesuai keputusan pemilik.
 *
 * Tapi pengecualian di Pasal 3 SENGAJA ada dan tidak boleh dihapus. Menolak
 * mengembalikan uang saat akses gagal terbuka bukan "kebijakan ketat", itu
 * menerima bayaran untuk sesuatu yang tidak pernah diserahkan — dan ujungnya
 * chargeback lewat bank, yang merusak reputasi merchant di mata Midtrans jauh
 * lebih dalam daripada mengembalikan dana secara sukarela.
 *
 * Kasusnya nyata pada aplikasi ini: notifikasi Midtrans bisa gagal sampai,
 * pesanan bisa tercatat lunas tanpa enrollment tertulis, dan educator bisa
 * menghapus kursusnya setelah ada yang membeli.
 */
export default function PengembalianDanaPage() {
  return (
    <LegalPage
      title="Kebijakan Pengembalian Dana"
      current="/pengembalian-dana"
      intro="Kursus di SynapEd adalah produk digital yang dapat diakses seketika setelah pembayaran. Karena itu pembelian bersifat final, dengan pengecualian terbatas yang dijelaskan di bawah."
    >
      <Clause no={1} title="Pembelian Bersifat Final">
        <p>
          Begitu pembayaran dikonfirmasi, akses kursus terbuka seketika dan seluruh materinya dapat
          Anda buka, baca, dan unduh. Sifat produk digital membuat pembelian{" "}
          <strong>tidak dapat dibatalkan dan tidak dapat dikembalikan</strong>.
        </p>
      </Clause>

      <Clause no={2} title="Yang Tidak Kami Kembalikan">
        <Bullets
          items={[
            "berubah pikiran setelah pembelian;",
            "materi ternyata tidak sesuai harapan, terlalu mudah, atau terlalu sulit;",
            "tidak sempat atau tidak jadi mempelajari kursus yang sudah dibeli;",
            "salah membeli kursus karena tidak membaca deskripsi yang tersedia;",
            "menghapus akun sendiri setelah membeli kursus;",
            "akses dihentikan karena Anda melanggar Syarat & Ketentuan.",
          ]}
        />
        <p>
          Deskripsi, jumlah modul, perkiraan durasi, tingkat kesulitan, dan harga tercantum pada
          halaman detail setiap kursus sebelum Anda membayar. Mohon dibaca lebih dahulu.
        </p>
      </Clause>

      <Clause no={3} title="Yang Kami Kembalikan">
        <p>
          Pengecualian berikut berlaku karena pada keadaan ini Anda membayar untuk sesuatu yang
          tidak Anda terima:
        </p>
        <Bullets
          items={[
            <>
              <strong>Pembayaran ganda</strong> - dana terpotong lebih dari sekali untuk kursus yang
              sama. Kelebihannya kami kembalikan seluruhnya.
            </>,
            <>
              <strong>Akses tidak terbuka</strong> - pembayaran berhasil, tetapi kursus tetap
              terkunci dan kendalanya tidak dapat kami selesaikan dalam 7 hari kerja sejak Anda
              melapor.
            </>,
            <>
              <strong>Kursus ditarik</strong> - kursus dihapus atau tidak lagi tersedia sebelum Anda
              sempat mengaksesnya sama sekali.
            </>,
            <>
              <strong>Materi tidak sesuai secara mendasar</strong> - isi kursus berbeda jauh dari
              yang dijanjikan pada halaman detail, misalnya modul yang dijanjikan tidak pernah ada.
            </>,
          ]}
        />
      </Clause>

      <Clause no={4} title="Cara Mengajukan">
        <p>
          Kirim email ke{" "}
          <a href={`mailto:${COMPANY.supportEmail}`} className="text-blue-700 hover:underline underline-offset-4">
            {COMPANY.supportEmail}
          </a>{" "}
          paling lambat <strong>7 hari kalender</strong> sejak pembayaran, dengan menyertakan:
        </p>
        <Bullets
          items={[
            "alamat email akun SynapEd Anda;",
            "nama kursus dan nomor pesanan (tercantum pada bukti pembayaran dari Midtrans);",
            "penjelasan singkat kendalanya, disertai tangkapan layar bila ada.",
          ]}
        />
        <p>
          Kami menanggapi pada {COMPANY.supportHours}. Permohonan ditinjau paling lambat 7 hari
          kerja sejak diterima lengkap.
        </p>
      </Clause>

      <Clause no={5} title="Proses Pengembalian">
        <p>
          Pengembalian dana yang disetujui dikirim ke <strong>metode pembayaran yang sama</strong>{" "}
          dengan yang Anda gunakan, melalui Midtrans. Lama dana kembali ke rekening atau dompet
          digital Anda bergantung pada bank atau penyedia dompet, umumnya 3–14 hari kerja setelah
          kami proses.
        </p>
        <p>
          Setelah pengembalian dana diproses, akses Anda atas kursus tersebut berakhir.
        </p>
      </Clause>

      <Clause no={6} title="Kursus Gratis">
        <p>
          Kursus bertanda &ldquo;Gratis&rdquo; tidak melibatkan pembayaran, sehingga tidak ada yang
          dapat dikembalikan. Anda dapat berhenti mengikutinya kapan saja.
        </p>
      </Clause>

      <Clause no={7} title="Hubungan dengan Ketentuan Lain">
        <p>
          Halaman ini merupakan bagian tidak terpisahkan dari{" "}
          <Link href="/syarat-ketentuan" className="text-blue-700 hover:underline underline-offset-4">
            Syarat &amp; Ketentuan
          </Link>{" "}
          SynapEd. Kebijakan ini tidak mengurangi hak Anda berdasarkan Undang-Undang Nomor 8 Tahun
          1999 tentang Perlindungan Konsumen.
        </p>
      </Clause>
    </LegalPage>
  );
}
