import { redirect } from "next/navigation";

/**
 * `/dashboard` sudah digantikan `/profil` dan `/pengaturan`.
 *
 * Dialihkan, bukan dihapus: alamat ini tersebar di email, riwayat browser,
 * dan penanda halaman pengguna sejak awal aplikasi ini ada. Membiarkannya 404
 * berarti menghukum orang karena mengingat tautan yang dulu kita berikan.
 *
 * Halaman anaknya TIDAK ikut terpengaruh — `/dashboard/certificates/[id]`
 * tetap hidup di alamatnya sendiri, karena sertifikat yang sudah terbit
 * mencantumkan alamat itu di dalamnya.
 */
export default function DashboardPage() {
  redirect("/profil");
}
