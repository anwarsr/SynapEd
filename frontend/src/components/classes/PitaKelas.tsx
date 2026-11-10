"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { nadaKelas } from "@/lib/classColor";
import { cn } from "@/lib/cn";

/**
 * Pita foto kelas di tepi kiri kartu, setinggi kartu, DAN pembungkus isi kartu di sebelahnya.
 *
 * Terbuka (bawaan) = foto penuh. Ditekan → kotak menyusut KE KIRI jadi kotak tipis (indikator) dan fotonya ikut
 * bergeser ke kiri bersama tepi kanan kotak (gambar menempel di sisi kanan kotak, bukan diam di tempat);
 * ditekan lagi → melebar dan fotonya keluar lagi. Isi kartu (flex-1) mengalir mengisi ruang yang dilepas.
 *
 * TINGGI kartu dikunci pada tinggi saat foto terbuka (keadaan paling sempit bagi isi, jadi paling tinggi), sehingga
 * kartu tak pernah menjalar ke bawah saat membuka/menutup. Kelas tanpa foto: tidak ada pita, hanya isi.
 * Pita TERPISAH dari tautan kartu supaya menekannya tidak membuka ruang kelas.
 */
const UKURAN = "w-[112px] sm:w-[224px]";
const GERAK_MS = 900;

export default function PitaKelas({
  nama,
  gambar,
  className,
  children,
}: {
  nama: string;
  gambar: string | null;
  /** Kelas untuk pembungkus isi (mis. `p-5`). */
  className?: string;
  children: ReactNode;
}) {
  const [foto, setFoto] = useState(true);
  const tombol = useRef<HTMLButtonElement>(null);
  const fotoRef = useRef(true);
  const bergerak = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nada = nadaKelas(nama);

  // Kunci tinggi kartu = tinggi terbukanya. Diukur ulang tiap ukuran kartu berubah (lebar layar, font selesai
  // dimuat) HANYA selagi terbuka dan tidak sedang bergerak; selagi tertutup nilai terakhir dipertahankan.
  useEffect(() => {
    const kartu = tombol.current?.parentElement;
    if (!kartu) return;
    const ukur = () => {
      if (!fotoRef.current || bergerak.current) return;
      kartu.style.minHeight = "";
      kartu.style.minHeight = `${kartu.offsetHeight}px`;
    };
    const ro = new ResizeObserver(ukur);
    ro.observe(kartu);
    return () => {
      ro.disconnect();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [gambar]);

  function ganti() {
    bergerak.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      bergerak.current = false;
    }, GERAK_MS + 60);
    fotoRef.current = !fotoRef.current;
    setFoto(fotoRef.current);
  }

  const isi = <div className={cn("min-w-0 flex-1", className)}>{children}</div>;

  if (!gambar) return isi;

  return (
    <>
      <button
        ref={tombol}
        type="button"
        aria-pressed={foto}
        aria-label={foto ? `Tutup foto kelas ${nama}` : `Tampilkan foto kelas ${nama}`}
        title={foto ? "Tutup foto" : "Tampilkan foto"}
        onClick={ganti}
        className={cn(
          "relative block shrink-0 cursor-pointer self-stretch overflow-hidden",
          "transition-[width] duration-[900ms] ease-[cubic-bezier(0.45,0,0.2,1)] motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500",
          foto ? UKURAN : "w-3",
          nada.tint,
        )}
      >
        {/* Menempel di sisi KANAN kotak: kotak menyusut ke kiri, fotonya terbawa ke kiri (tidak diam & terpotong). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gambar}
          alt=""
          className={cn(
            "absolute right-0 top-0 h-full max-w-none object-cover transition-opacity duration-[900ms] ease-in-out motion-reduce:transition-none",
            UKURAN,
            foto ? "opacity-100" : "opacity-0",
          )}
        />
      </button>
      {isi}
    </>
  );
}
