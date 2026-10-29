"use client";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";

const HURUF_KECIL = "abcdefghijklmnopqrstuvwxyz";
const HURUF_BESAR = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ANGKA = "0123456789";

/** Pengganti acak SEJENIS (huruf kecil → kecil, dst.) supaya lebar baris nyaris tak berubah. */
function acak(c: string): string {
  const pilih = (set: string) => set[Math.floor(Math.random() * set.length)];
  if (/[a-z]/.test(c)) return pilih(HURUF_KECIL);
  if (/[A-Z]/.test(c)) return pilih(HURUF_BESAR);
  if (/[0-9]/.test(c)) return pilih(ANGKA);
  return c;
}

/**
 * Teks yang muncul sebagai huruf acak lalu "mengunci" dari kiri ke kanan.
 *
 * Dipasang ulang (lewat `key` di pemanggil) tiap keterangan baru dipilih.
 * Spasi dan tanda baca tidak diacak. Hemat gerak = langsung teks asli.
 * Setelah selesai komponen berhenti menjadwalkan bingkai.
 */
export default function TeksAcak({
  teks,
  tunda = 0,
  durasi = 700,
  className,
}: {
  teks: string;
  tunda?: number;
  durasi?: number;
  className?: string;
}) {
  const hemat = useReducedMotion();
  const [tampil, setTampil] = useState<string | null>(null);

  useEffect(() => {
    if (hemat) return;
    const mulai = performance.now();
    let raf = 0;
    let terakhirAcak = 0;
    let cadangan = "";

    const tik = (now: number) => {
      const t = now - mulai - tunda;
      if (t >= durasi) {
        setTampil(null);
        return;
      }
      if (t < 0) {
        // Masa tunggu: sudah tampil acak penuh supaya tak ada kedipan kosong.
        if (!cadangan) cadangan = Array.from(teks, acak).join("");
        setTampil(cadangan);
      } else if (now - terakhirAcak > 45) {
        terakhirAcak = now;
        const kunci = Math.floor((t / durasi) * teks.length);
        const huruf = Array.from(teks);
        setTampil(huruf.map((c, i) => (i < kunci ? c : acak(c))).join(""));
      }
      raf = requestAnimationFrame(tik);
    };
    raf = requestAnimationFrame(tik);
    return () => cancelAnimationFrame(raf);
  }, [teks, tunda, durasi, hemat]);

  // `null` = selesai/tanpa animasi → teks asli (juga yang dibaca pembaca layar).
  return (
    <p className={className} aria-label={teks}>
      <span aria-hidden={tampil !== null}>{tampil ?? teks}</span>
    </p>
  );
}
