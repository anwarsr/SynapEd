/**
 * Perekam linear search: periksa A[1], A[2], … sampai nilai yang dicari
 * ketemu (kemunculan PERTAMA) atau data habis — persis pseudocode di
 * `searchKode.ts`.
 *
 * Satu langkah per perbandingan; kalimatnya sekaligus menyebut "lanjut ke
 * A[i+1]" (baris `i ← i + 1`) supaya 32 data tidak menjadi 64 langkah.
 *
 * Modul netral.
 */
import { barisLinear } from "./searchKode";
import { TAHAN_MS, type JenisLangkahCari, type LangkahCari, type RekamanCari, type SelCari } from "./searchTypes";

export function rekamLinear(nilai: readonly number[], dicari: number): RekamanCari {
  const n = nilai.length;
  const sel: SelCari[] = nilai.map((v, id) => ({ id, nilai: v }));
  const B = barisLinear();
  const langkah: LangkahCari[] = [];
  let banding = 0;

  function catat(
    jenis: JenisLangkahCari,
    fase: string,
    narasi: string,
    baris: number | [number, number],
    opsi: Partial<Pick<LangkahCari, "penunjuk" | "aktif" | "tersingkir" | "hasil">> = {},
  ) {
    const [dari, sampai] = typeof baris === "number" ? [baris, baris] : baris;
    langkah.push({
      fase,
      narasi,
      baris: dari,
      sampai,
      banding,
      jenis,
      tahanMs: TAHAN_MS[jenis],
      sel: sel.map((s) => ({ ...s })),
      penunjuk: { ...(opsi.penunjuk ?? {}) },
      aktif: opsi.aktif ?? null,
      tersingkir: (opsi.tersingkir ?? []).map((r) => [r[0], r[1]] as [number, number]),
      hasil: opsi.hasil ?? null,
    });
  }

  catat(
    "info",
    "Mulai",
    `Linear search memeriksa data SATU PER SATU dari depan: A[1], A[2], dan seterusnya, sampai ${dicari} ketemu atau data habis. ` +
      "Data tidak perlu urut.",
    B.mulai,
    { penunjuk: { i: 0 } },
  );

  for (let i = 0; i < n; i++) {
    banding++;
    const v = sel[i].nilai;
    const sama = v === dicari;
    const sudah: [number, number][] = i > 0 ? [[0, i - 1]] : [];
    catat(
      "banding",
      `Periksa A[${i + 1}]`,
      sama
        ? `A[${i + 1}] = ${v}. Apakah ${v} = ${dicari}? Ya!`
        : `A[${i + 1}] = ${v}. Apakah ${v} = ${dicari}? Tidak - ` +
            (i + 1 < n ? `lanjut ke A[${i + 2}] (i ← i + 1).` : "dan ini data terakhir."),
      // Hanya baris IF: rentang sampai `i ← i + 1` ikut menyorot `Ketemu ← TRUE`
      // yang justru TIDAK dijalankan saat nilainya berbeda.
      B.banding,
      { penunjuk: { i }, aktif: i, tersingkir: sudah },
    );
    if (sama) {
      catat(
        "selesai",
        "Ditemukan",
        `Ditemukan di A[${i + 1}] setelah ${banding} perbandingan. ` +
          (i === 0
            ? "Ini kasus TERBAIK linear search: nilai ada di posisi pertama, cukup 1 perbandingan."
            : `Kalau nilainya ada di posisi terakhir, linear search butuh ${n} perbandingan - sebanyak datanya.`),
        B.keluarKetemu,
        { penunjuk: { i }, aktif: i, tersingkir: sudah, hasil: { ketemu: true, indeks: i } },
      );
      return { langkah, banding, hasil: { ketemu: true, indeks: i } };
    }
  }

  catat(
    "selesai",
    "Tidak ditemukan",
    `Data habis: semua ${n} data sudah diperiksa dan tidak ada yang sama dengan ${dicari}. ` +
      `Ini kasus TERBURUK linear search: ${n} perbandingan, sebanyak datanya - O(n).`,
    B.keluarTidak,
    { tersingkir: n > 0 ? [[0, n - 1]] : [], hasil: { ketemu: false, indeks: null } },
  );
  return { langkah, banding, hasil: { ketemu: false, indeks: null } };
}
