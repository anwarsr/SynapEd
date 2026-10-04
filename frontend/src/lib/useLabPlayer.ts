"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * Pemutar langkah animasi.
 *
 * Memakai `requestAnimationFrame`, bukan `setTimeout`, karena dua alasan yang
 * keduanya terasa saat dipakai mengajar: rAF berhenti sendiri ketika tab
 * disembunyikan (setTimeout akan "mengejar" lalu melompati beberapa langkah
 * sekaligus saat tab kembali), dan `setState` yang dipanggil dari dalam
 * callback-nya tidak melanggar aturan lint `react-hooks/set-state-in-effect`.
 *
 * Saat pengguna meminta hemat gerak, pemutar tidak pernah berjalan: frame
 * langsung melompat ke langkah terakhir. Papan harus benar tanpa animasi —
 * animasi menjelaskan, ia tidak menyimpan informasi.
 */
export interface LabPlayer {
  frame: number;
  memutar: boolean;
  /** Mulai memutar rangkaian langkah yang baru saja dihasilkan. */
  mulai: (jumlahLangkah: number) => void;
  putar: () => void;
  jeda: () => void;
  keLangkah: (i: number) => void;
  maju: () => void;
  mundur: () => void;
  kecepatan: number;
  setKecepatan: (k: number) => void;
  hematGerak: boolean;
}

export function useLabPlayer(steps: readonly { tahanMs: number }[]): LabPlayer {
  const hematGerak = useReducedMotion();
  const [frame, setFrame] = useState(0);
  const [memutar, setMemutar] = useState(false);
  const [kecepatan, setKecepatan] = useState(1);
  const terakhir = Math.max(steps.length - 1, 0);

  /**
   * Dipanggil pemilik keadaan SETELAH operasi baru berhasil.
   *
   * Sengaja sebuah fungsi yang dipanggil dari event handler, bukan effect yang
   * mengintai perubahan `steps`: setState di dalam badan effect memicu render
   * berantai dan dilarang aturan lint `react-hooks/set-state-in-effect`.
   *
   * Saat hemat gerak menyala, frame langsung melompat ke langkah terakhir —
   * pengguna melihat hasil akhirnya, bukan papan yang diam di langkah pertama.
   */
  const mulai = useCallback(
    (jumlahLangkah: number) => {
      setFrame(hematGerak ? Math.max(jumlahLangkah - 1, 0) : 0);
      setMemutar(!hematGerak && jumlahLangkah > 1);
    },
    [hematGerak],
  );

  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!memutar || hematGerak) return;

    let sejak: number | null = null;
    const tick = (t: number) => {
      if (sejak === null) sejak = t;
      const tahan = (steps[frame]?.tahanMs ?? 600) / Math.max(kecepatan, 0.25);

      if (t - sejak >= tahan) {
        setFrame((f) => {
          const berikut = f + 1;
          if (berikut >= steps.length) {
            setMemutar(false);
            return terakhir;
          }
          return berikut;
        });
        sejak = t;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [memutar, hematGerak, frame, kecepatan, steps, terakhir]);

  const keLangkah = useCallback(
    (i: number) => {
      setMemutar(false);
      setFrame(Math.min(Math.max(i, 0), terakhir));
    },
    [terakhir],
  );

  return {
    frame: Math.min(frame, terakhir),
    memutar,
    mulai,
    putar: useCallback(() => setMemutar(true), []),
    jeda: useCallback(() => setMemutar(false), []),
    keLangkah,
    maju: useCallback(() => keLangkah(frame + 1), [keLangkah, frame]),
    mundur: useCallback(() => keLangkah(frame - 1), [keLangkah, frame]),
    kecepatan,
    setKecepatan,
    hematGerak,
  };
}
