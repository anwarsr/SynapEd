"use client";
import KodeWorkspace, { type MesinKode } from "./KodeWorkspace";
import { PanduanPseudo } from "./Panduan";
import { jalankanPseudo } from "@/lib/lab/pseudo/pseudoJalan";
import { CONTOH_PSEUDO } from "@/lib/lab/pseudo/pseudoContoh";
import type { IsiKode } from "@/lib/lab/kodeUrl";

/**
 * Interpreter pseudocode berjalan di utas utama: ia murni TypeScript dan
 * berhenti sendiri di 10.000 langkah, jadi tidak perlu Web Worker seperti
 * Python. Tidak ada yang bisa dihentikan dari luar.
 */
const MESIN_PSEUDO: MesinKode = {
  status: "siap",
  pesan: null,
  jalankan: async (kode, masukan, rekam) => jalankanPseudo(kode, masukan, { rekam }),
  hentikan: () => undefined,
};

export default function PseudoWorkspace({ awal, judul, aktif }: { awal: IsiKode | null; judul: React.ReactNode; aktif: boolean }) {
  return (
    <KodeWorkspace
      bahasa="pseudocode"
      judul={judul}
      aktif={aktif}
      awal={awal}
      contoh={CONTOH_PSEUDO}
      mesin={MESIN_PSEUDO}
      panduan={<PanduanPseudo />}
      ekstensi=".txt"
    />
  );
}
