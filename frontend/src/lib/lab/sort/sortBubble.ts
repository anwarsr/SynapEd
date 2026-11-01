/**
 * Perekam bubble sort untuk Lab Sorting.
 *
 * Langkahnya mengikuti pseudocode 9618 di `sortKode.ts` PERSIS: putaran
 * REPEAT … UNTIL, perbandingan `A[j]` dengan `A[j + 1]`, pertukaran lewat
 * `Temp`, dan berhenti lebih awal begitu satu putaran berjalan tanpa
 * pertukaran. `verify-sorting` menjalankan pseudocode itu dan membandingkan
 * jumlah putarannya dengan rekaman ini.
 *
 * Indeks dalam narasi 1-based (A[1] … A[N]), sama dengan pseudocode.
 *
 * Modul netral.
 */
import { barisBubble } from "./sortKode";
import {
  TAHAN_MS,
  terbalik,
  type ArahSort,
  type Batang,
  type JenisLangkah,
  type LangkahBubble,
  type PeranBatang,
  type Rekaman,
} from "./sortTypes";

export function rekamBubble(nilai: readonly number[], arah: ArahSort): Rekaman<LangkahBubble> {
  const n = nilai.length;
  const urutan: Batang[] = nilai.map((v, id) => ({ id, nilai: v }));
  const B = barisBubble(arah);
  const langkah: LangkahBubble[] = [];
  let banding = 0;
  let pindah = 0;
  let batasTerurut = n;
  const besar = arah === "naik" ? "terbesar" : "terkecil";

  function catat(
    jenis: JenisLangkah,
    fase: string,
    narasi: string,
    baris: number,
    opsi: { sampai?: number; peran?: Record<number, PeranBatang>; label?: Record<number, string> } = {},
  ) {
    const peran: Record<number, PeranBatang> = {};
    for (let s = batasTerurut; s < n; s++) peran[urutan[s].id] = "terurut";
    Object.assign(peran, opsi.peran ?? {});
    langkah.push({
      fase,
      narasi,
      baris,
      sampai: opsi.sampai ?? baris,
      banding,
      pindah,
      jenis,
      tahanMs: TAHAN_MS[jenis],
      urutan: urutan.map((b) => ({ ...b })),
      peran,
      label: { ...(opsi.label ?? {}) },
      batasTerurut,
    });
  }

  catat(
    "info",
    "Mulai",
    `Bubble sort membandingkan dua nilai yang BERSEBELAHAN dan menukarnya bila urutannya terbalik. ` +
      `Setiap putaran, nilai ${besar} "menggelembung" ke ujung kanan.`,
    B.mulai,
  );

  for (let p = 1; p <= n - 1; p++) {
    const ujung = n - p; // indeks 0-based terakhir yang masih diperiksa + 1
    let ditukar = false;
    catat(
      "info",
      `Putaran ${p}`,
      `Putaran ${p}: periksa pasangan bertetangga dari A[1] sampai A[${ujung + 1}]. ` +
        `Ditukar diisi FALSE dulu - kalau sampai akhir putaran tetap FALSE, berarti data sudah urut.`,
      B.putaran,
    );

    for (let j = 0; j < ujung; j++) {
      const a = urutan[j];
      const b = urutan[j + 1];
      banding++;
      const salah = terbalik(a.nilai, b.nilai, arah);
      const simbol = a.nilai > b.nilai ? ">" : a.nilai < b.nilai ? "<" : "=";
      catat(
        "banding",
        `Putaran ${p}`,
        `Bandingkan A[${j + 1}] = ${a.nilai} dengan A[${j + 2}] = ${b.nilai}: ${a.nilai} ${simbol} ${b.nilai} - ` +
          (salah ? "urutannya terbalik, harus ditukar." : "sudah urut, biarkan."),
        B.banding,
        { peran: { [a.id]: "banding", [b.id]: "banding" }, label: { [a.id]: "j", [b.id]: "j+1" } },
      );
      if (salah) {
        urutan[j] = b;
        urutan[j + 1] = a;
        pindah++;
        ditukar = true;
        catat(
          "tukar",
          `Putaran ${p}`,
          `Tukar: ${b.nilai} pindah ke A[${j + 1}], ${a.nilai} pindah ke A[${j + 2}]. ` +
            `Temp menyimpan A[j] dulu supaya nilainya tidak hilang saat ditimpa. Ditukar menjadi TRUE.`,
          B.tukarDari,
          { sampai: B.tukarSampai, peran: { [a.id]: "tukar", [b.id]: "tukar" }, label: { [b.id]: "j", [a.id]: "j+1" } },
        );
      }
    }

    if (!ditukar) {
      batasTerurut = 0;
      catat(
        "info",
        `Putaran ${p}`,
        `Putaran ${p} selesai tanpa satu pun pertukaran (Ditukar = FALSE): semua pasangan sudah urut, ` +
          `jadi perulangan berhenti lebih awal - tidak perlu putaran lagi.`,
        B.akhirPutaran,
      );
      break;
    }
    batasTerurut = p === n - 1 ? 0 : ujung;
    catat(
      "info",
      `Putaran ${p}`,
      p === n - 1
        ? `Putaran ${p} selesai. Ini putaran terakhir (Putaran = N): A[1] otomatis sudah di tempatnya.`
        : `Putaran ${p} selesai: ${urutan[ujung].nilai} sudah di tempat akhirnya, A[${ujung + 1}]. ` +
            `Putaran berikutnya satu pasangan lebih pendek.`,
      B.akhirPutaran,
    );
  }

  batasTerurut = 0;
  catat(
    "selesai",
    "Selesai",
    `Selesai: ${urutan.map((b) => b.nilai).join(", ")}. Bubble sort memakai ${banding} perbandingan dan ${pindah} pertukaran. ` +
      `Kompleksitasnya O(n²): untuk data terbalik, hampir semua pasangan harus ditukar.`,
    B.akhirPutaran,
  );

  return { langkah, banding, pindah };
}
