"use client";
import { useCallback, useState } from "react";
import type { LabOpResult, LabStep } from "@/lib/lab/labTypes";
import {
  canRedo,
  canUndo,
  currentState,
  initHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type LabHistory,
} from "@/lib/lab/labHistory";

/**
 * Keadaan satu sesi lab di React: reducer murni + riwayat + langkah animasi.
 *
 * Generik untuk lab mana pun — 1D, 2D, maupun N-dimensi cukup memberikan
 * fungsi `terapkan`-nya. Yang masuk riwayat adalah HASIL AKHIR tiap operasi,
 * bukan tiap langkah: langkah itu animasi, dan dua belas kali tukar saat
 * membalik array bukan dua belas kali "batalkan" yang masuk akal.
 */
export interface LabSession<S, Op> {
  state: S;
  steps: LabStep<S>[];
  /** Operasi terakhir yang berhasil, untuk judul garis langkah. */
  label: string;
  error: string | null;
  bisaUndo: boolean;
  bisaRedo: boolean;
  /** Mengembalikan langkah animasi operasi ini, atau null kalau ditolak. */
  jalankan: (op: Op) => LabStep<S>[] | null;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

export function useLabSession<S, Op>(
  awal: S,
  terapkan: (s: S, op: Op) => LabOpResult<S>,
  namaOperasi: (op: Op) => string,
  kosong: () => S,
): LabSession<S, Op> {
  const [history, setHistory] = useState<LabHistory<S>>(() => initHistory(awal, "Keadaan awal"));
  const [steps, setSteps] = useState<LabStep<S>[]>([]);
  const [label, setLabel] = useState("Keadaan awal");
  const [error, setError] = useState<string | null>(null);

  const jalankan = useCallback(
    (op: Op): LabStep<S>[] | null => {
      const hasil = terapkan(currentState(history), op);
      if (!hasil.ok) {
        // Papan tidak disentuh sama sekali. Pesannya yang bekerja, bukan
        // perubahan diam-diam yang membuat pengguna menebak apa yang terjadi.
        setError(hasil.error);
        return null;
      }
      const akhir = hasil.steps[hasil.steps.length - 1].state;
      const nama = namaOperasi(op);
      setError(null);
      setSteps(hasil.steps);
      setLabel(nama);
      setHistory((h) => pushHistory(h, akhir, nama));
      return hasil.steps;
    },
    [history, terapkan, namaOperasi],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      const mundur = undoHistory(h);
      if (mundur !== h) {
        setSteps([]);
        setLabel("Dibatalkan");
        setError(null);
      }
      return mundur;
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      const maju = redoHistory(h);
      if (maju !== h) {
        setSteps([]);
        setLabel("Diulang");
        setError(null);
      }
      return maju;
    });
  }, []);

  const reset = useCallback(() => {
    setHistory(initHistory(kosong(), "Papan dikosongkan"));
    setSteps([]);
    setLabel("Papan dikosongkan");
    setError(null);
  }, [kosong]);

  return {
    state: currentState(history),
    steps,
    label,
    error,
    bisaUndo: canUndo(history),
    bisaRedo: canRedo(history),
    jalankan,
    undo,
    redo,
    reset,
  };
}
