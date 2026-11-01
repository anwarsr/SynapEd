/**
 * Perekam jump search — persis pseudocode di `searchKode.ts`.
 *
 * Seperti binary search, jump search butuh data URUT, jadi data yang belum urut
 * diurutkan dulu (salinan stabil; kotak-kotak meluncur). Lalu dua tahap:
 *   1. LOMPAT per blok selebar ⌊√N⌋: periksa ujung blok (A[Akhir] < Dicari?);
 *      selama ujungnya masih lebih kecil, seluruh blok pasti lebih kecil dan
 *      dilompati;
 *   2. CARI LINEAR di dalam satu blok yang tersisa.
 *
 * Karena blok yang dilompati seluruhnya lebih kecil, kemunculan PERTAMA nilai
 * yang dicari selalu berada di blok terakhir — jump search menemukan yang
 * pertama, berbeda dari binary search.
 *
 * Modul netral.
 */
import { barisJump } from "./searchKode";
import {
  TAHAN_MS,
  lompatan,
  maksJump,
  urutkanSel,
  type JenisLangkahCari,
  type LangkahCari,
  type NamaPenunjuk,
  type RekamanCari,
  type SelCari,
} from "./searchTypes";

export function rekamJump(nilai: readonly number[], dicari: number): RekamanCari {
  const n = nilai.length;
  const { semula, urut, sudahUrut } = urutkanSel(nilai);
  const B = barisJump();
  const m = lompatan(n);
  const langkah: LangkahCari[] = [];
  let banding = 0;
  let sel: SelCari[] = semula;

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
      tersingkir: (opsi.tersingkir ?? []).filter(([a, b]) => a <= b).map((r) => [r[0], r[1]] as [number, number]),
      hasil: opsi.hasil ?? null,
    });
  }

  if (sudahUrut) {
    catat("info", "Data urut", "Jump search hanya bekerja pada data yang URUT. Data ini sudah urut, jadi bisa langsung dicari.", B.kepala);
  } else {
    catat(
      "info",
      "Data semula",
      "Jump search hanya bekerja pada data yang URUT, karena ia melompati satu blok sekaligus dengan hanya melihat ujungnya. " +
        "Data ini belum urut, jadi diurutkan dulu.",
      B.kepala,
    );
    sel = urut;
    catat("urutkan", "Urutkan", `Data sudah diurutkan: ${urut.map((s) => s.nilai).join(", ")}.`, B.kepala);
  }

  catat(
    "info",
    "Ukuran lompatan",
    `Lompatan = ⌊√N⌋ = ⌊√${n}⌋ = ${m}: data dibagi menjadi blok berisi ${m}. Karena 9618 tidak punya fungsi akar, ` +
      `Lompat dinaikkan dari 1 selama (Lompat + 1)² masih ≤ N.`,
    B.lompat,
  );

  let awal = 0;
  let akhir = m - 1;
  catat(
    "info",
    "Blok 1",
    `Blok pertama: Awal = 1, Akhir = ${m}. Cari ${dicari}.`,
    B.mulai,
    { penunjuk: { Awal: awal, Akhir: akhir } },
  );

  let blok = 1;
  let berhenti = false;
  while (akhir < n - 1) {
    banding++;
    const v = sel[akhir].nilai;
    const lewati = v < dicari;
    catat(
      "banding",
      `Blok ${blok}`,
      `Periksa UJUNG blok: A[${akhir + 1}] = ${v}. Apakah ${v} < ${dicari}? ` +
        (lewati
          ? "Ya - semua nilai di blok ini lebih kecil lagi, jadi blok ini bisa dilompati."
          : `Tidak - kalau ${dicari} ada, ia pasti di blok ini (A[${awal + 1}..${akhir + 1}]). Berhenti melompat.`),
      B.ujung,
      { penunjuk: { Awal: awal, Akhir: akhir }, aktif: akhir, tersingkir: [[0, awal - 1]] },
    );
    if (!lewati) {
      berhenti = true;
      break;
    }
    awal = akhir + 1;
    akhir += m;
    blok++;
    catat(
      "buang",
      `Blok ${blok}`,
      `Lompat ke blok berikutnya: Awal ← Akhir + 1 = ${awal + 1}, Akhir ← Akhir + Lompat = ${akhir + 1}.`,
      B.loncat,
      { penunjuk: { Awal: awal, ...(akhir < n ? { Akhir: akhir } : {}) }, tersingkir: [[0, awal - 1]] },
    );
  }

  if (!berhenti) {
    if (akhir > n - 1) {
      catat(
        "info",
        `Blok ${blok}`,
        `Akhir (${akhir + 1}) melewati N, jadi Akhir ← N = ${n}: blok terakhir lebih pendek.`,
        B.jepit,
        { penunjuk: { Awal: awal, Akhir: n - 1 }, tersingkir: [[0, awal - 1]] },
      );
      akhir = n - 1;
    } else {
      catat(
        "info",
        `Blok ${blok}`,
        `Akhir sudah sampai ujung data (Akhir = N), jadi tidak ada blok lagi untuk dilompati.`,
        B.ujung,
        { penunjuk: { Awal: awal, Akhir: akhir }, tersingkir: [[0, awal - 1]] },
      );
    }
  }

  const luarBlok: [number, number][] = [
    [0, awal - 1],
    [akhir + 1, n - 1],
  ];
  catat(
    "info",
    "Cari di blok",
    `Sekarang cari satu per satu (linear) di dalam blok A[${awal + 1}..${akhir + 1}] saja - paling banyak ${akhir - awal + 1} data.`,
    B.blok,
    { penunjuk: { Awal: awal, Akhir: akhir, i: awal }, tersingkir: luarBlok },
  );

  for (let i = awal; i <= akhir; i++) {
    banding++;
    const v = sel[i].nilai;
    const tersingkir: [number, number][] = [...luarBlok, [awal, i - 1]];
    if (v === dicari) {
      catat("banding", "Cari di blok", `A[${i + 1}] = ${v}. Apakah ${v} = ${dicari}? Ya!`, B.banding, {
        penunjuk: { Awal: awal, Akhir: akhir, i },
        aktif: i,
        tersingkir,
      });
      catat(
        "selesai",
        "Ditemukan",
        `Ditemukan di A[${i + 1}] setelah ${banding} perbandingan. Untuk ${n} data, jump search paling banyak butuh ` +
          `${maksJump(n)} perbandingan (sekitar 2√n) - lebih sedikit dari linear (${n}), lebih banyak dari binary search.`,
        B.keluarKetemu,
        { penunjuk: { i }, aktif: i, tersingkir: [[0, i - 1], [i + 1, n - 1]], hasil: { ketemu: true, indeks: i } },
      );
      return { langkah, banding, hasil: { ketemu: true, indeks: i } };
    }
    catat(
      "banding",
      "Cari di blok",
      `A[${i + 1}] = ${v}. Apakah ${v} = ${dicari}? Tidak` + (i < akhir ? ` - lanjut ke A[${i + 2}].` : " - dan ini data terakhir di blok."),
      B.banding,
      { penunjuk: { Awal: awal, Akhir: akhir, i }, aktif: i, tersingkir },
    );
  }

  catat(
    "selesai",
    "Tidak ditemukan",
    `Seluruh blok sudah diperiksa dan ${dicari} tidak ada. Karena blok lain sudah pasti tidak berisi ${dicari}, ` +
      `nilai itu tidak ada di data - cukup ${banding} perbandingan untuk ${n} data.`,
    B.keluarTidak,
    { tersingkir: n > 0 ? [[0, n - 1]] : [], hasil: { ketemu: false, indeks: null } },
  );
  return { langkah, banding, hasil: { ketemu: false, indeks: null } };
}
