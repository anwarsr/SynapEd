import Link from "next/link";
import { Bullets, Clause, LegalPage } from "@/components/legal/LegalPage";
import { COMPANY } from "@/lib/company";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kebijakan Privasi – SynapEd",
  description:
    "Data apa yang dikumpulkan SynapEd, untuk apa dipakai, siapa yang memprosesnya, dan bagaimana cara menghapusnya.",
};

/**
 * Template Midtrans hanya memuat satu paragraf privasi ("data Anda aman
 * bersama kami"). Itu tidak cukup: UU 27/2022 tentang Pelindungan Data Pribadi
 * menuntut penyebutan data apa yang diambil, dasar pemrosesannya, kepada siapa
 * diteruskan, berapa lama disimpan, dan bagaimana hak subjek data dijalankan.
 *
 * Isi halaman ini disusun dari apa yang BENAR-BENAR dikumpulkan aplikasi —
 * bukan daftar umum. Menyebut data yang tidak pernah diambil sama buruknya
 * dengan menyembunyikan yang diambil.
 */
export default function KebijakanPrivasiPage() {
  return (
    <LegalPage
      title="Kebijakan Privasi"
      current="/kebijakan-privasi"
      intro="Halaman ini menjelaskan data pribadi apa yang kami kumpulkan saat Anda memakai SynapEd, untuk apa data itu dipakai, siapa saja yang memprosesnya, dan bagaimana Anda dapat mengendalikannya."
    >
      <Clause no={1} title="Siapa Kami">
        <p>
          Pengendali data pribadi dalam kebijakan ini adalah {COMPANY.name} ({COMPANY.legalName}),
          berkedudukan di {COMPANY.address}.
        </p>
      </Clause>

      <Clause no={2} title="Data yang Kami Kumpulkan">
        <p>Kami hanya mengumpulkan data yang diperlukan agar layanan berfungsi:</p>
        <Bullets
          items={[
            <>
              <strong>Data akun</strong> — nama, alamat email, dan kata sandi (tersimpan dalam bentuk
              teracak, tidak pernah dalam bentuk aslinya). Bila Anda masuk dengan Google, kami
              menerima nama, email, dan foto profil dari akun Google Anda.
            </>,
            <>
              <strong>Data profil opsional</strong> — nomor telepon dan foto profil, bila Anda
              mengisinya.
            </>,
            <>
              <strong>Data belajar</strong> — kursus yang Anda ikuti, pelajaran yang telah
              diselesaikan, nilai kuis, dan sertifikat yang diterbitkan.
            </>,
            <>
              <strong>Data transaksi</strong> — nomor pesanan, nama kursus, jumlah, status, dan
              metode pembayaran. <strong>Kami tidak pernah menerima atau menyimpan nomor kartu,
              PIN, atau kredensial perbankan Anda.</strong>
            </>,
            <>
              <strong>Data educator</strong> — bagi pengguna yang mengajukan diri menjadi educator,
              berikut materi yang diunggahnya.
            </>,
          ]}
        />
        <p>
          Kami tidak mengumpulkan data yang tidak Anda berikan sendiri, dan tidak melakukan
          pelacakan lintas situs untuk iklan.
        </p>
      </Clause>

      <Clause no={3} title="Untuk Apa Data Itu Dipakai">
        <Bullets
          items={[
            "membuat dan mengamankan akun Anda serta memverifikasi identitas saat masuk;",
            "membuka akses kursus yang Anda ikuti dan mencatat kemajuan belajar;",
            "memproses pembayaran serta menerbitkan bukti dan sertifikat;",
            "menanggapi pertanyaan dan keluhan yang Anda sampaikan;",
            "mengirim pemberitahuan penting terkait akun dan transaksi.",
          ]}
        />
      </Clause>

      <Clause no={4} title="Pihak Ketiga yang Memproses Data">
        <p>
          Kami tidak menjual data pribadi Anda kepada siapa pun. Data hanya diteruskan kepada
          penyedia layanan yang dibutuhkan agar SynapEd berjalan:
        </p>
        <Bullets
          items={[
            <>
              <strong>Google Firebase</strong> — autentikasi, basis data, dan penyimpanan berkas.
            </>,
            <>
              <strong>Midtrans</strong> — pemrosesan pembayaran. Data pembayaran Anda diserahkan
              langsung kepada Midtrans dan tunduk pada kebijakan privasi mereka.
            </>,
          ]}
        />
        <p>
          Educator dapat melihat daftar peserta pada kursusnya sendiri, terbatas pada nama dan
          kemajuan belajar. Educator tidak dapat melihat data pembayaran Anda.
        </p>
      </Clause>

      <Clause no={5} title="Cookie dan Sesi">
        <p>
          Kami menggunakan satu cookie sesi untuk menjaga Anda tetap masuk. Cookie ini bersifat
          httpOnly sehingga tidak dapat dibaca skrip di peramban, dan berlaku paling lama lima hari.
          Kami tidak memakai cookie iklan maupun pelacak pihak ketiga.
        </p>
      </Clause>

      <Clause no={6} title="Berapa Lama Data Disimpan">
        <Bullets
          items={[
            "Data akun dan riwayat belajar disimpan selama akun Anda aktif.",
            "Catatan transaksi disimpan lebih lama sesuai kebutuhan pembukuan dan penyelesaian sengketa.",
            "Berkas yang tidak lagi dirujuk — foto profil lama, materi yang diganti — dihapus otomatis dari penyimpanan kami.",
          ]}
        />
      </Clause>

      <Clause no={7} title="Hak Anda atas Data Pribadi">
        <p>Sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, Anda berhak:</p>
        <Bullets
          items={[
            "memperoleh informasi dan salinan data pribadi Anda;",
            "memperbaiki data yang keliru — nama, email, nomor telepon, dan foto dapat Anda ubah sendiri di halaman profil;",
            "menarik persetujuan dan menghapus akun beserta datanya melalui halaman profil;",
            "mengajukan keberatan atas pemrosesan data tertentu.",
          ]}
        />
        <p>
          Permintaan terkait data pribadi dapat dikirim ke{" "}
          <a href={`mailto:${COMPANY.privacyEmail}`} className="text-blue-700 hover:underline underline-offset-4">
            {COMPANY.privacyEmail}
          </a>
          . Kami menanggapi dalam waktu wajar sejak permintaan diterima dan diverifikasi.
        </p>
        <p>
          Perlu diketahui, menghapus akun juga menghapus akses kursus Anda dan tidak menimbulkan hak
          pengembalian dana — lihat{" "}
          <Link href="/pengembalian-dana" className="text-blue-700 hover:underline underline-offset-4">
            Pengembalian Dana
          </Link>
          .
        </p>
      </Clause>

      <Clause no={8} title="Keamanan">
        <p>
          Kata sandi disimpan teracak, sesi memakai cookie httpOnly, dan materi kursus hanya dapat
          diakses setelah hak akses diperiksa di sisi server. Tidak ada sistem yang sepenuhnya
          kebal; bila terjadi kebocoran data pribadi, kami akan memberitahukannya sesuai ketentuan
          yang berlaku.
        </p>
      </Clause>

      <Clause no={9} title="Anak di Bawah Umur">
        <p>
          SynapEd ditujukan untuk pengguna berusia 13 tahun ke atas. Pengguna di bawah 18 tahun
          sebaiknya menggunakan layanan ini dengan sepengetahuan orang tua atau wali, terutama untuk
          pembelian kursus berbayar.
        </p>
      </Clause>

      <Clause no={10} title="Perubahan Kebijakan">
        <p>
          Kebijakan ini dapat diperbarui sewaktu-waktu. Tanggal berlaku di bagian atas halaman
          menunjukkan versi terkini. Perubahan yang berdampak besar akan kami beritahukan melalui
          email atau pemberitahuan di dalam aplikasi.
        </p>
      </Clause>

      <Clause no={11} title="Menghubungi Kami">
        <p>
          Untuk urusan data pribadi:{" "}
          <a href={`mailto:${COMPANY.privacyEmail}`} className="text-blue-700 hover:underline underline-offset-4">
            {COMPANY.privacyEmail}
          </a>
          . Untuk pertanyaan lain, lihat halaman{" "}
          <Link href="/kontak" className="text-blue-700 hover:underline underline-offset-4">
            Kontak
          </Link>
          .
        </p>
      </Clause>
    </LegalPage>
  );
}
