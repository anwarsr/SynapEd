import { inisialKelas, nadaKelas } from "@/lib/classColor";
import { cn } from "@/lib/cn";

/**
 * Identitas visual satu kelas: inisialnya di atas warna yang diturunkan dari
 * namanya. Dua bentuk, satu sumber warna.
 *
 * `spine` — pita tegak di sisi kiri kartu daftar.
 * `plate` — kotak kaca di hero ruang kelas.
 *
 * Keduanya ada di satu berkas supaya warnanya mustahil berbeda antara daftar
 * dan ruang kelasnya. Dipisah dua berkas, satu sisi akan tertinggal saat
 * paletnya disesuaikan, dan kelas yang sama tampil dua warna.
 */

const DISPLAY_SPINE = {
  fontFamily: "var(--font-sans)",
} as const;

const DISPLAY_PLATE = {
  fontFamily: "var(--font-sans)",
} as const;

/**
 * `tebal` — pita berinisial, untuk kartu daftar peserta.
 * `tipis` — rail 14px tanpa inisial, untuk baris padat panel educator.
 *
 * Lebarnya dipilih lewat prop, BUKAN dengan menimpa className dari luar:
 * cn() di proyek ini penjoin string biasa, bukan tailwind-merge, jadi
 * `sm:w-[88px]` dan `sm:w-3.5` sama-sama mendarat dan urutan CSS yang
 * memutuskan — penimpaan yang tampak berhasil di satu tempat dan gagal di
 * tempat lain tanpa alasan yang terlihat.
 */
export function ClassSpine({
  nama,
  variant = "tebal",
  gambar = null,
  className,
}: {
  nama: string;
  variant?: "tebal" | "tipis";
  /** Foto profil kelas; bila ada, mengisi pita (varian tebal). */
  gambar?: string | null;
  className?: string;
}) {
  const nada = nadaKelas(nama);
  const tebal = variant === "tebal";

  return (
    <span
      aria-hidden="true"
      className={cn(
        // Selalu tipis di ponsel: 88px pita berwarna memakan lebar yang
        // dibutuhkan judulnya, dan inisial bukan informasi yang layak dibayar
        // semahal itu.
        "relative shrink-0 w-3.5 border-r flex items-center justify-center overflow-hidden",
        tebal && "sm:w-[88px]",
        nada.tint,
        nada.garis,
        className,
      )}
    >
      {tebal && gambar && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={gambar} alt="" className="absolute inset-0 hidden h-full w-full object-cover sm:block" />
      )}
      {tebal && !gambar && (
        <span
          className={cn("hidden sm:block text-[34px] leading-none", nada.deep)}
          style={DISPLAY_SPINE}
        >
          {inisialKelas(nama)}
        </span>
      )}
    </span>
  );
}

/**
 * Plat identitas kelas di hero: foto profil kelas bila ada, kalau tidak inisial.
 *
 * DIAM (permintaan pemilik): dulu mengambang (`drift`) dan bercincin holo yang
 * berputar. Kini kotak persegi polos tanpa gerak, bayangan, atau kaca buram.
 */
export function ClassPlate({
  nama,
  gambar = null,
  className,
}: {
  nama: string;
  gambar?: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex h-[104px] w-[104px] shrink-0 items-center justify-center overflow-hidden bg-white/10",
        className,
      )}
    >
      {gambar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={gambar} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="relative text-[38px] leading-none text-white" style={DISPLAY_PLATE}>
          {inisialKelas(nama)}
        </span>
      )}
    </span>
  );
}
