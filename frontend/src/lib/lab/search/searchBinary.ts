/**
 * Perekam binary search — persis pseudocode di `searchKode.ts`.
 *
 * Binary search hanya benar pada data URUT. Keputusan pemilik: data yang
 * belum urut diurutkan dulu (salinan, stabil, naik) dan langkah pertamanya
 * menjelaskan mengapa. `id` setiap sel ikut terbawa, jadi papan bisa
 * memperlihatkan kotak-kotak meluncur ke tempat urutnya.
 *
 * Setiap iterasi = tiga langkah: hitung Tengah, bandingkan A[Tengah], buang separuh
 * (Kiri ← Tengah + 1 atau Kanan ← Tengah − 1). Bagian di luar Kiri..Kanan diredupkan.
 *
 * Modul netral.
 */
import { barisBinary } from "./searchKode";
import { TAHAN_MS, maksBinary, type JenisLangkahCari, type LangkahCari, type NamaPenunjuk, type RekamanCari, type SelCari } from "./searchTypes";

export function rekamBinary(nilai: readonly number[], dicari: number): RekamanCari {
  const n = nilai.length;
  const semula: SelCari[] = nilai.map((v, id) => ({ id, nilai: v }));
  const urut = [...semula].sort((a, b) => a.nilai - b.nilai || a.id - b.id);
  const sudahUrut = urut.every((s, i) => s.id === i);
  const B = barisBinary();
  const langkah: LangkahCari[] = [];
  let banding = 0;
  let sel = semula;

  /** Bagian di luar Kiri..Kanan (0-based) yang sudah dibuang. */
  const luar = (low: number, high: number): [number, number][] => {
    const r: [number, number][] = [];
    if (low > 0) r.push([0, Math.min(low, n) - 1]);
    if (high < n - 1) r.push([Math.max(high, -1) + 1, n - 1]);
    return r;
  };

  function catat(
    jenis: JenisLangkahCari,
    fase: string,
    narasi: string,
    baris: number | [number, number],
    opsi: { penunjuk?: Partial<Record<NamaPenunjuk, number>>; aktif?: number | null; tersingkir?: [number, number][]; hasil?: LangkahCari["hasil"] } = {},
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

  if (sudahUrut) {
    catat(
      "info",
      "Data urut",
      "Binary search hanya bekerja pada data yang URUT. Data ini sudah urut dari kecil ke besar, jadi bisa langsung dicari.",
      B.kepala,
    );
  } else {
    catat(
      "info",
      "Data semula",
      "Binary search hanya bekerja pada data yang URUT, karena ia menebak di tengah lalu membuang separuh data. " +
        "Data ini belum urut, jadi diurutkan dulu.",
      B.kepala,
    );
    sel = urut;
    catat(
      "urutkan",
      "Urutkan",
      `Data sudah diurutkan dari kecil ke besar: ${urut.map((s) => s.nilai).join(", ")}. Sekarang pencarian bisa dimulai.`,
      B.kepala,
    );
  }

  let low = 0;
  let high = n - 1;
  catat(
    "info",
    "Mulai",
    `Cari ${dicari}. Kiri = 1 (ujung kiri) dan Kanan = ${n} (ujung kanan) menandai bagian yang masih mungkin berisi nilai itu.`,
    B.mulai,
    { penunjuk: { Kiri: low, Kanan: high } },
  );

  let putaran = 0;
  while (low <= high) {
    putaran++;
    const mid = Math.floor((low + high) / 2);
    catat(
      "tengah",
      `Tebakan ${putaran}`,
      `Tebak di tengah: Tengah = (Kiri + Kanan) DIV 2 = (${low + 1} + ${high + 1}) DIV 2 = ${mid + 1}.`,
      B.tengah,
      { penunjuk: { Kiri: low, Tengah: mid, Kanan: high }, tersingkir: luar(low, high) },
    );

    banding++;
    const v = sel[mid].nilai;
    if (v === dicari) {
      catat(
        "banding",
        `Tebakan ${putaran}`,
        `A[${mid + 1}] = ${v}. Apakah ${v} = ${dicari}? Ya!`,
        [B.banding, B.ketemu],
        { penunjuk: { Kiri: low, Tengah: mid, Kanan: high }, aktif: mid, tersingkir: luar(low, high) },
      );
      catat(
        "selesai",
        "Ditemukan",
        `Ditemukan di A[${mid + 1}] setelah ${banding} perbandingan. Untuk ${n} data, binary search paling banyak butuh ` +
          `${maksBinary(n)} perbandingan, karena setiap tebakan membuang separuh sisa data - O(log n).`,
        B.keluarKetemu,
        { penunjuk: { Tengah: mid }, aktif: mid, tersingkir: luar(mid, mid), hasil: { ketemu: true, indeks: mid } },
      );
      return { langkah, banding, hasil: { ketemu: true, indeks: mid } };
    }

    const keKanan = v < dicari;
    catat(
      "banding",
      `Tebakan ${putaran}`,
      `A[${mid + 1}] = ${v}. Apakah ${v} = ${dicari}? Tidak - ${v} ${keKanan ? "<" : ">"} ${dicari}.`,
      B.banding,
      { penunjuk: { Kiri: low, Tengah: mid, Kanan: high }, aktif: mid, tersingkir: luar(low, high) },
    );
    if (keKanan) {
      low = mid + 1;
      catat(
        "buang",
        `Tebakan ${putaran}`,
        `Karena ${v} < ${dicari} dan data urut, ${dicari} pasti di sebelah KANAN A[Tengah]. Buang A[${mid + 1}] dan semua di kirinya: ` +
          `Kiri ← Tengah + 1 = ${low + 1}.`,
        B.geserKanan,
        { penunjuk: { Kiri: low, Kanan: high }, tersingkir: luar(low, high) },
      );
    } else {
      high = mid - 1;
      catat(
        "buang",
        `Tebakan ${putaran}`,
        `Karena ${v} > ${dicari} dan data urut, ${dicari} pasti di sebelah KIRI A[Tengah]. Buang A[${mid + 1}] dan semua di kanannya: ` +
          `Kanan ← Tengah - 1 = ${high + 1}.`,
        B.geserKiri,
        { penunjuk: { Kiri: low, Kanan: high }, tersingkir: luar(low, high) },
      );
    }
  }

  catat(
    "selesai",
    "Tidak ditemukan",
    `Kiri (${low + 1}) sudah melewati Kanan (${high + 1}): tidak ada data tersisa, jadi ${dicari} tidak ada. ` +
      `Cukup ${banding} perbandingan untuk ${n} data - linear search butuh ${n}.`,
    B.keluarTidak,
    { tersingkir: n > 0 ? [[0, n - 1]] : [], hasil: { ketemu: false, indeks: null } },
  );
  return { langkah, banding, hasil: { ketemu: false, indeks: null } };
}
