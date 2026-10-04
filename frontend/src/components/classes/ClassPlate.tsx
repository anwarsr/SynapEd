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
  className,
}: {
  nama: string;
  variant?: "tebal" | "tipis";
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
        "shrink-0 w-3.5 border-r flex items-center justify-center",
        tebal && "sm:w-[88px]",
        nada.tint,
        nada.garis,
        className,
      )}
    >
      {tebal && (
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
 * Plat kaca di hero. Cincin holo-nya salinan perilaku .feature-card__holo yang
 * sudah ada — ikut mati sendiri saat prefers-reduced-motion, karena aturan itu
 * hidup di globals.css, bukan di sini.
 */
export function ClassPlate({ nama, className }: { nama: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "drift relative shrink-0 w-[92px] h-[92px] rounded-[20px] overflow-hidden",
        "flex items-center justify-center border border-blue-300/55 shadow-lift",
        className,
      )}
      style={{
        background:
          "linear-gradient(155deg, color-mix(in srgb, var(--color-blue-100) 55%, transparent), color-mix(in srgb, var(--color-blue-300) 30%, transparent))",
        backdropFilter: "blur(22px) saturate(180%)",
        boxShadow: "0 0 46px -18px color-mix(in srgb, var(--color-blue-500) 55%, transparent)",
      }}
    >
      <span className="feature-card__holo" />
      <span className="relative text-[36px] leading-none text-navy" style={DISPLAY_PLATE}>
        {inisialKelas(nama)}
      </span>
    </span>
  );
}
