"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { MesinKode } from "./KodeWorkspace";
import { KODE_MAKS_REKAM, sahkanJejak, type JejakKode } from "@/lib/lab/kodeTypes";
import { KODE_PELACAK } from "@/lib/lab/python/pythonPelacak";
import { saranPython } from "@/lib/lab/python/pythonGalat";
import { PYODIDE_INDEX_URL, PYTHON_WORKER_URL } from "@/lib/lab/python/pythonVersi";

/** Batas waktu satu kali jalan, DIHITUNG setelah Python siap (unduhan pertama tidak ikut). */
export const PYTHON_BATAS_WAKTU_MS = 10_000;
/** Mode langkah: program dihentikan setelah sekian event baris (perulangan tak berujung jadi galat terekam). */
export const PYTHON_MAKS_LANGKAH = 100_000;
export const PYTHON_MAKS_KELUARAN = 100_000;

type Status = "belum" | "memuat" | "siap" | "gagal";
interface Potret {
  status: Status;
  pesan: string | null;
}

const PESAN_MEMUAT = "Menyiapkan Python… (unduhan pertama ±12 MB, berikutnya dari cache)";

/**
 * Satu Web Worker Pyodide untuk seluruh halaman, dikelola di luar React
 * (status dibaca lewat useSyncExternalStore — efek tidak boleh setState).
 *
 * Program yang tidak pernah berhenti tidak bisa diinterupsi dari dalam:
 * worker MATI (terminate) saat batas waktu atau tombol Stop, lalu worker baru
 * dibuat (Pyodide dari cache browser, beberapa detik). Keluaran yang sudah
 * dikabarkan worker sebelum mati tetap ditampilkan.
 */
class PengelolaPython {
  private potret: Potret = { status: "belum", pesan: null };
  private pendengar = new Set<() => void>();
  private worker: Worker | null = null;
  private siap: Promise<void> | null = null;
  private nomor = 0;
  private berjalan: { id: number; keluaran: string; selesai: (j: JejakKode) => void; timer: number } | null = null;

  dengar = (cb: () => void) => {
    this.pendengar.add(cb);
    return () => this.pendengar.delete(cb);
  };
  baca = () => this.potret;

  private ubah(status: Status, pesan: string | null) {
    this.potret = { status, pesan };
    for (const cb of this.pendengar) cb();
  }

  /** Mulai memuat (idempoten). Dipanggil saat lab Python pertama kali dibuka. */
  mulai() {
    if (this.worker) return;
    const w = new Worker(PYTHON_WORKER_URL);
    this.worker = w;
    this.ubah("memuat", PESAN_MEMUAT);
    this.siap = new Promise<void>((beres, tolak) => {
      w.onmessage = (e: MessageEvent) => {
        const d = e.data as { jenis?: unknown; id?: unknown; teks?: unknown; json?: unknown; pesan?: unknown };
        if (d?.jenis === "siap") {
          this.ubah("siap", null);
          beres();
        } else if (d?.jenis === "gagal-muat") {
          const pesan = `Python gagal dimuat: ${String(d.pesan ?? "")}. Periksa koneksi internet, lalu tekan Jalankan untuk mencoba lagi.`;
          this.buang();
          this.ubah("gagal", pesan);
          tolak(new Error(pesan));
        } else {
          this.terima(d);
        }
      };
      w.onerror = (e) => {
        e.preventDefault();
        const pesan = "Python gagal dimuat. Periksa koneksi internet, lalu tekan Jalankan untuk mencoba lagi.";
        this.buang();
        this.ubah("gagal", pesan);
        tolak(new Error(pesan));
      };
    });
    // Tolakan ditangani pemanggil jalankan(); tanpa ini menjadi "unhandled rejection".
    this.siap.catch(() => undefined);
    w.postMessage({ jenis: "muat", indexURL: PYODIDE_INDEX_URL, pelacak: KODE_PELACAK });
  }

  private buang() {
    this.worker?.terminate();
    this.worker = null;
    this.siap = null;
  }

  private terima(d: { jenis?: unknown; id?: unknown; teks?: unknown; json?: unknown }) {
    const b = this.berjalan;
    if (!b || d.id !== b.id) return;
    if (d.jenis === "keluaran" && typeof d.teks === "string") {
      // Potongan (delta), bukan seluruh keluaran — lihat pythonPelacak.ts.
      if (b.keluaran.length < PYTHON_MAKS_KELUARAN) b.keluaran = (b.keluaran + d.teks).slice(0, PYTHON_MAKS_KELUARAN);
    } else if (d.jenis === "hasil" && typeof d.json === "string") {
      let jejak: JejakKode | null = null;
      try {
        jejak = sahkanJejak(JSON.parse(d.json));
      } catch {
        jejak = null;
      }
      this.akhiri(
        jejak ?? { langkah: [], keluaran: b.keluaran, galat: { baris: null, jenis: "Galat internal", pesan: "Hasil dari Python tidak bisa dibaca.", saran: null }, terpotong: false },
      );
    }
  }

  private akhiri(j: JejakKode) {
    const b = this.berjalan;
    if (!b) return;
    window.clearTimeout(b.timer);
    this.berjalan = null;
    if (j.galat && j.galat.saran === null) j = { ...j, galat: { ...j.galat, saran: saranPython(j.galat) } };
    b.selesai(j);
  }

  async jalankan(kode: string, masukan: string, rekam: boolean): Promise<JejakKode> {
    if (this.berjalan) throw new Error("Program lain masih berjalan.");
    this.mulai();
    await this.siap;
    const w = this.worker;
    if (!w) throw new Error("Python belum siap.");
    const id = ++this.nomor;
    return new Promise<JejakKode>((selesai) => {
      const timer = window.setTimeout(() => this.paksaHenti("waktu"), PYTHON_BATAS_WAKTU_MS);
      this.berjalan = { id, keluaran: "", selesai, timer };
      w.postMessage({
        jenis: "jalankan",
        id,
        kode,
        masukan,
        rekam,
        maksRekam: KODE_MAKS_REKAM,
        maksLangkah: PYTHON_MAKS_LANGKAH,
        maksKeluaran: PYTHON_MAKS_KELUARAN,
      });
    });
  }

  hentikan = () => {
    if (this.berjalan) this.paksaHenti("stop");
  };

  /** Mematikan worker yang sedang sibuk lalu menyiapkan yang baru. */
  private paksaHenti(alasan: "waktu" | "stop") {
    const b = this.berjalan;
    if (!b) return;
    this.buang();
    this.akhiri({
      langkah: [{ baris: null, vars: [], panjangKeluaran: b.keluaran.length, tumpukan: [] }],
      keluaran: b.keluaran,
      galat:
        alasan === "waktu"
          ? { baris: null, jenis: "Batas waktu", pesan: `Program dihentikan setelah ${PYTHON_BATAS_WAKTU_MS / 1000} detik.`, saran: null }
          : { baris: null, jenis: "Dihentikan", pesan: "Program dihentikan dengan tombol Stop.", saran: null },
      terpotong: false,
    });
    this.mulai();
  }
}

let pengelola: PengelolaPython | null = null;
const ambil = () => (pengelola ??= new PengelolaPython());
const STATUS_SERVER: Potret = { status: "belum", pesan: null };

/**
 * Mesin Python untuk `KodeWorkspace`. Pyodide baru diunduh saat lab Python
 * benar-benar dibuka (`aktif`), bukan saat halaman /lab dimuat — pengunjung
 * lab array tidak perlu membayar 12 MB.
 */
export function usePythonMesin(aktif: boolean): MesinKode {
  const p = useSyncExternalStore(
    (cb) => ambil().dengar(cb),
    () => ambil().baca(),
    () => STATUS_SERVER,
  );
  useEffect(() => {
    if (aktif) ambil().mulai();
  }, [aktif]);
  return useMemo<MesinKode>(
    () => ({
      status: p.status === "siap" ? "siap" : p.status === "gagal" ? "gagal" : "memuat",
      pesan: p.pesan,
      jalankan: (kode, masukan, rekam) => ambil().jalankan(kode, masukan, rekam),
      hentikan: () => ambil().hentikan(),
    }),
    [p],
  );
}
