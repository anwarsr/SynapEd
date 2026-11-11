import "server-only";
import { adminStorage } from "@/lib/firebase/admin";
import { bacaIsiBerkas, type IsiBerkas } from "@/lib/berkasAiCore";
import type { KelasBerkas } from "@/lib/classAssignmentRules";

export type { GambarAi, IsiBerkas } from "@/lib/berkasAiCore";

/**
 * Berkas kelas (lampiran, konteks AI, jawaban siswa) → isi untuk AI.
 *
 * Seluruh logikanya (teks, gambar di dalam dokumen, PDF hasil pindai,
 * peringatan bagian yang tak terbaca) ada di berkasAiCore.ts; berkas ini
 * hanya menyediakan cara mengambil isinya dari Storage. Tidak pernah melempar.
 */
export function bacaBerkasAi(files: readonly KelasBerkas[], opts: { maxChars: number; maxGambar: number }): Promise<IsiBerkas> {
  const bucket = adminStorage().bucket();
  return bacaIsiBerkas(
    files.map((f) => ({
      nama: f.name,
      mime: f.mime,
      ambil: async () => {
        const berkas = bucket.file(f.path);
        const [ada] = await berkas.exists();
        if (!ada) return null;
        return (await berkas.download())[0];
      },
    })),
    opts,
  );
}
