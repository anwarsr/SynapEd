import Link from "next/link";
import { Bullets, Clause, LegalPage } from "@/components/legal/LegalPage";
import { COMPANY } from "@/lib/company";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan – SynapEd",
  description:
    "Ketentuan penggunaan platform SynapEd: lisensi materi, pembayaran, kewajiban educator, dan penghentian akses.",
};

/**
 * Disusun mengikuti Template #3 (Digital Goods) dari Midtrans, dengan tiga
 * penyesuaian yang menentukan:
 *
 * 1. SynapEd berdiri sebagai PENJUAL, bukan papan iklan — karena pembayaran
 *    diterima ke rekening SynapEd. Template Midtrans mengasumsikan penjual
 *    tunggal dan tidak menjawab pertanyaan siapa lawan janji pembeli.
 * 2. Ada pasal khusus untuk educator. Merekalah yang menjamin materinya bukan
 *    bajakan, dan sampai sekarang tidak ada dokumen yang mengikat mereka.
 * 3. Pasal pembayaran menunjuk ke halaman pengembalian dana, bukan mengulang
 *    isinya — dua salinan aturan uang pasti melenceng suatu saat.
 */
export default function SyaratKetentuanPage() {
  return (
    <LegalPage
      title="Syarat & Ketentuan"
      current="/syarat-ketentuan"
      intro={`Ketentuan ini mengatur penggunaan situs ${COMPANY.domain} dan seluruh layanan di dalamnya. Dengan menggunakan SynapEd, Anda menyatakan telah membaca dan menyetujuinya.`}
    >
      <Clause no={1} title="Ketentuan Penggunaan">
        <p>
          SynapEd ditawarkan kepada Anda dengan syarat Anda menerima seluruh ketentuan, syarat, dan
          pemberitahuan yang tercantum di sini, termasuk ketentuan tambahan yang berlaku pada
          halaman atau bagian tertentu dari Situs.
        </p>
        <p>
          Situs ini dimiliki dan dioperasikan oleh {COMPANY.name} ({COMPANY.legalName}), berkedudukan
          di {COMPANY.address}.
        </p>
      </Clause>

      <Clause no={2} title="Gambaran Umum">
        <p>
          Penggunaan Situs ini berarti Anda menyetujui seluruh ketentuan dan pemberitahuan di
          dalamnya. Mohon dibaca dengan saksama. Jika Anda tidak menyetujuinya, Anda harus berhenti
          menggunakan Situs ini dan tidak melanjutkan penggunaan informasi maupun produk apa pun
          dari Situs ini.
        </p>
      </Clause>

      <Clause no={3} title="Perubahan Situs dan Ketentuan Ini">
        <p>
          SynapEd berhak mengubah, memperbarui, atau menghentikan ketentuan, tautan, konten,
          informasi, harga, dan materi lain yang ditawarkan melalui Situs ini sewaktu-waktu tanpa
          pemberitahuan terlebih dahulu. Kami berhak menyesuaikan harga dari waktu ke waktu.
        </p>
        <p>
          Apabila terjadi kekeliruan penulisan harga, SynapEd berhak menolak pesanan tersebut.
          Perubahan ketentuan berlaku sejak tanggal berlaku yang tercantum di halaman ini, dan
          penggunaan Situs setelah tanggal tersebut berarti Anda terikat pada versi yang baru.
        </p>
      </Clause>

      <Clause no={4} title="Peran SynapEd sebagai Platform">
        <p>
          Materi kursus di SynapEd disusun oleh <strong>educator</strong>, yaitu pihak ketiga yang
          telah mendaftar dan <strong>diverifikasi oleh SynapEd</strong> sebelum kursusnya dapat
          tayang. SynapEd berperan sebagai platform penghubung antara educator dan peserta.
        </p>
        <p>
          Meskipun demikian, pembayaran atas kursus berbayar diterima oleh SynapEd. Karena itu,
          dalam hubungannya dengan Anda sebagai pembeli, <strong>SynapEd bertindak sebagai
          penjual</strong> dan menjadi pihak yang Anda hubungi atas segala persoalan pembelian.
        </p>
        <p>
          Verifikasi yang kami lakukan mencakup kelayakan dan kesesuaian materi dengan ketentuan
          ini. Verifikasi tersebut <strong>bukan jaminan atas akurasi, kelengkapan, atau hasil
          belajar</strong> yang akan Anda peroleh.
        </p>
      </Clause>

      <Clause no={5} title="Pemberian Lisensi">
        <p>
          Atas kursus yang Anda beli atau ikuti, SynapEd memberi Anda hak untuk mengakses dan
          mempelajari materinya untuk <strong>keperluan pribadi dan non-komersial</strong>. Hak ini
          bersifat non-eksklusif, tidak dapat dialihkan, dan berlaku selama akun Anda aktif.
        </p>
        <p>Anda tidak diperkenankan:</p>
        <Bullets
          items={[
            "menyalin, mengunduh untuk disebarkan, mengunggah ulang, atau mendistribusikan materi dalam bentuk apa pun;",
            "membagikan akun, kata sandi, atau tautan materi kepada orang lain;",
            "menjual kembali, menyewakan, atau menggunakan materi untuk pelatihan komersial;",
            "membuat karya turunan dari materi tanpa izin tertulis dari pemilik haknya.",
          ]}
        />
      </Clause>

      <Clause no={6} title="Hak Kepemilikan">
        <p>
          Seluruh materi, merek, logo, dan tanda layanan pada Situs ini adalah milik SynapEd atau
          educator yang bersangkutan, dan dilindungi undang-undang hak cipta yang berlaku di
          Indonesia. Membeli sebuah kursus memberi Anda hak akses sebagaimana Pasal 5, dan
          <strong> tidak mengalihkan kepemilikan apa pun</strong> atas materi tersebut.
        </p>
      </Clause>

      <Clause no={7} title="Pendaftaran Akun">
        <p>
          Untuk mengikuti kursus, Anda perlu mendaftar dengan alamat email yang sah atau melalui
          akun Google. Anda wajib memberikan data yang benar dan terkini.
        </p>
        <p>
          Anda sepenuhnya bertanggung jawab menjaga kerahasiaan kata sandi serta seluruh aktivitas
          yang terjadi di bawah akun Anda. Jangan menyalahgunakan atau membagikan kata sandi,
          memalsukan identitas, atau mengaku mewakili pihak lain.
        </p>
      </Clause>

      <Clause no={8} title="Harga dan Pembayaran">
        <p>
          Harga setiap kursus ditampilkan pada kartu katalog dan halaman detail kursus dalam Rupiah.
          Kursus bertanda &ldquo;Gratis&rdquo; dapat diikuti tanpa pembayaran.
        </p>
        <p>
          Pembayaran diproses melalui <strong>Midtrans</strong>, penyedia jasa pembayaran berizin.
          SynapEd tidak menyimpan nomor kartu maupun kredensial perbankan Anda. Akses kursus terbuka
          otomatis setelah pembayaran dikonfirmasi oleh penyedia pembayaran.
        </p>
        <p>
          Ketentuan pengembalian dana diatur terpisah pada halaman{" "}
          <Link href="/pengembalian-dana" className="text-blue-700 hover:underline underline-offset-4">
            Pengembalian Dana
          </Link>
          , yang merupakan bagian tidak terpisahkan dari ketentuan ini.
        </p>
      </Clause>

      <Clause no={9} title="Kewajiban Educator">
        <p>
          Ketentuan pada pasal ini berlaku bagi pengguna yang disetujui menjadi educator. Dengan
          mengunggah materi ke SynapEd, educator menyatakan dan menjamin bahwa:
        </p>
        <Bullets
          items={[
            "materi tersebut adalah karyanya sendiri atau ia memiliki izin sah untuk menggunakan dan mendistribusikannya;",
            "materi tidak melanggar hak cipta, merek, atau hak pihak lain mana pun;",
            "materi tidak memuat konten yang melanggar hukum, menyesatkan, memfitnah, mengandung kebencian, pornografi, atau perangkat berbahaya;",
            "deskripsi, harga, dan durasi kursus disajikan secara jujur dan tidak menyesatkan.",
          ]}
        />
        <p>
          Educator memberi SynapEd lisensi non-eksklusif untuk menayangkan dan mendistribusikan
          materinya kepada peserta melalui Situs ini. SynapEd berhak menolak, menunda, atau
          menurunkan materi yang tidak memenuhi ketentuan ini.
        </p>
        <p>
          Educator membebaskan SynapEd dari segala tuntutan pihak ketiga yang timbul dari materi
          yang diunggahnya.
        </p>
      </Clause>

      <Clause no={10} title="Dukungan">
        <p>
          Pertanyaan dan kendala dapat disampaikan melalui{" "}
          <a href={`mailto:${COMPANY.supportEmail}`} className="text-blue-700 hover:underline underline-offset-4">
            {COMPANY.supportEmail}
          </a>{" "}
          atau {COMPANY.phone}, pada {COMPANY.supportHours}. Pesan yang masuk di luar jam tersebut
          kami tanggapi pada hari kerja berikutnya.
        </p>
      </Clause>

      <Clause no={11} title="Penghentian Akses">
        <p>SynapEd dapat menangguhkan atau menghentikan akses Anda seketika apabila:</p>
        <Bullets
          items={[
            "Anda melanggar ketentuan ini, termasuk menyebarkan materi kursus;",
            "Anda membahayakan keamanan atau kelangsungan layanan;",
            "terdapat indikasi penyalahgunaan pembayaran atau pemalsuan identitas.",
          ]}
        />
        <p>
          Anda dapat menghentikan penggunaan kapan saja dengan menghapus akun melalui halaman
          profil. Penghapusan akun mengakhiri seluruh akses kursus Anda dan{" "}
          <strong>tidak menimbulkan hak pengembalian dana</strong>.
        </p>
      </Clause>

      <Clause no={12} title="Jaminan dan Batasan Tanggung Jawab">
        <p>
          SynapEd berupaya sewajarnya menyediakan layanan yang dapat diakses dan materi yang telah
          diverifikasi. Namun Situs dan materinya disediakan sebagaimana adanya. SynapEd tidak
          menjamin bahwa layanan akan bebas gangguan, atau bahwa mengikuti kursus tertentu akan
          menghasilkan capaian, kelulusan, atau pekerjaan tertentu.
        </p>
        <p>
          Sepanjang diizinkan hukum, tanggung jawab SynapEd atas suatu kursus dibatasi paling banyak
          sebesar jumlah yang Anda bayarkan untuk kursus tersebut.
        </p>
      </Clause>

      <Clause no={13} title="Komunikasi Elektronik">
        <p>
          Anda menyetujui SynapEd mengirimkan surat elektronik terkait akun, pembelian, dan
          perubahan layanan. Email transaksional seperti konfirmasi pembayaran dan pemulihan kata
          sandi tidak dapat dinonaktifkan selama akun Anda aktif.
        </p>
      </Clause>

      <Clause no={14} title="Keamanan">
        <p>
          SynapEd mengambil langkah yang wajar untuk mencegah pelanggaran keamanan pada sistemnya.
          Autentikasi dan penyimpanan data dijalankan di atas infrastruktur Google Firebase, dan
          materi kursus hanya dapat diakses melalui pemeriksaan hak akses di sisi server.
        </p>
      </Clause>

      <Clause no={15} title="Data Pribadi">
        <p>
          Pengumpulan dan pemrosesan data pribadi diatur dalam{" "}
          <Link href="/kebijakan-privasi" className="text-blue-700 hover:underline underline-offset-4">
            Kebijakan Privasi
          </Link>
          , yang merupakan bagian tidak terpisahkan dari ketentuan ini.
        </p>
      </Clause>

      <Clause no={16} title="Hukum yang Berlaku">
        <p>
          Ketentuan ini tunduk pada hukum yang berlaku di Republik Indonesia. Perselisihan yang
          timbul akan diselesaikan terlebih dahulu secara musyawarah.
        </p>
      </Clause>

      <Clause no={17} title="Pertanyaan dan Masukan">
        <p>
          Kami terbuka atas pertanyaan, komentar, maupun keberatan Anda terhadap ketentuan ini.
          Silakan hubungi kami melalui halaman{" "}
          <Link href="/kontak" className="text-blue-700 hover:underline underline-offset-4">
            Kontak
          </Link>
          .
        </p>
      </Clause>
    </LegalPage>
  );
}
