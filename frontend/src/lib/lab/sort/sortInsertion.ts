/**
 * Perekam insertion sort untuk Lab Sorting — persis pseudocode 9618 di
 * `sortKode.ts`: ambil Kunci ← A[i], geser setiap A[j] yang "harus di kanan"
 * kunci satu langkah ke kanan, lalu taruh kunci di A[j + 1].
 *
 * Secara visual, satu pergeseran = A[j] meluncur ke kanan sementara kunci
 * maju ke kiri (dua batang bertukar tempat). Itu setara dengan pseudocode:
 * di sana kunci disimpan di variabel `Kunci`, dan tempatnya baru ditulis di
 * akhir — tetapi untuk siswa, "kartu di tangan yang terus bergerak ke kiri"
 * lebih mudah diikuti daripada celah kosong yang berpindah.
 *
 * Seri TIDAK digeser (`>` naik, `<` turun), jadi insertion sort stabil.
 *
 * Modul netral.
 */
import { barisInsertion } from "./sortKode";
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

export function rekamInsertion(nilai: readonly number[], arah: ArahSort): Rekaman<LangkahBubble> {
  const n = nilai.length;
  const urutan: Batang[] = nilai.map((v, id) => ({ id, nilai: v }));
  const B = barisInsertion(arah);
  const langkah: LangkahBubble[] = [];
  let banding = 0;
  let pindah = 0;
  let batasKiri = Math.min(1, n);
  let batasTerurut = n;

  function catat(
    jenis: JenisLangkah,
    fase: string,
    narasi: string,
    baris: number | [number, number],
    opsi: { peran?: Record<number, PeranBatang>; label?: Record<number, string> } = {},
  ) {
    const [dari, sampai] = typeof baris === "number" ? [baris, baris] : baris;
    const peran: Record<number, PeranBatang> = {};
    for (let s = 0; s < batasKiri; s++) peran[urutan[s].id] = "urutKiri";
    for (let s = batasTerurut; s < n; s++) peran[urutan[s].id] = "terurut";
    Object.assign(peran, opsi.peran ?? {});
    langkah.push({
      fase,
      narasi,
      baris: dari,
      sampai,
      banding,
      pindah,
      jenis,
      tahanMs: TAHAN_MS[jenis],
      urutan: urutan.map((b) => ({ ...b })),
      peran,
      label: { ...(opsi.label ?? {}) },
      batasTerurut,
      batasKiri,
    });
  }

  const besar = arah === "naik" ? "lebih besar" : "lebih kecil";

  catat(
    "info",
    "Mulai",
    "Insertion sort bekerja seperti menyusun kartu di tangan: bagian KIRI dianggap sudah urut, lalu satu per satu nilai " +
      "dari kanan diambil dan disisipkan ke tempatnya di bagian kiri. A[1] sendirian sudah urut.",
    B.putaran,
  );

  for (let i = 1; i < n; i++) {
    const kunci = urutan[i];
    let pos = i;
    catat(
      "info",
      `Putaran ${i}`,
      `Ambil Kunci ← A[${i + 1}] = ${kunci.nilai}. Bagian A[1..${i}] di kirinya sudah urut; cari tempat ${kunci.nilai} di sana, ` +
        `mulai dari j = ${i}.`,
      B.ambil,
      { peran: { [kunci.id]: "kunci" }, label: { [kunci.id]: "Kunci" } },
    );

    let diUjung = true;
    while (pos > 0) {
      const a = urutan[pos - 1];
      banding++;
      const geser = terbalik(a.nilai, kunci.nilai, arah);
      catat(
        "banding",
        `Putaran ${i}`,
        `Bandingkan A[${pos}] = ${a.nilai} dengan Kunci = ${kunci.nilai}: ` +
          (geser
            ? `${a.nilai} ${besar}, jadi ${a.nilai} harus bergeser ke kanan.`
            : a.nilai === kunci.nilai
              ? `sama besar - berhenti di sini (nilai kembar tidak dilangkahi, jadi insertion sort stabil).`
              : `${a.nilai} tidak ${besar} - berhenti, tempat kunci tepat di sebelah kanannya.`),
        B.banding,
        { peran: { [a.id]: "banding", [kunci.id]: "kunci" }, label: { [a.id]: "j", [kunci.id]: "Kunci" } },
      );
      if (!geser) {
        diUjung = false;
        break;
      }
      urutan[pos - 1] = kunci;
      urutan[pos] = a;
      pos--;
      pindah++;
      catat(
        "tukar",
        `Putaran ${i}`,
        `Geser: A[${pos + 2}] ← A[${pos + 1}], jadi ${a.nilai} pindah satu ke kanan dan kunci maju ke A[${pos + 1}]; j ← j - 1 = ${pos}.`,
        B.geser,
        { peran: { [a.id]: "banding", [kunci.id]: "kunci" }, label: { [kunci.id]: "Kunci" } },
      );
    }

    batasKiri = i + 1;
    catat(
      "info",
      `Putaran ${i}`,
      (diUjung ? "j = 0: semua nilai di kiri sudah dilewati, kunci sampai di ujung kiri. " : "") +
        `A[j + 1] ← Kunci: ${kunci.nilai} ditaruh di A[${pos + 1}]. Sekarang A[1..${i + 1}] urut.`,
      B.sisip,
    );
  }

  batasTerurut = 0;
  batasKiri = n;
  catat(
    "selesai",
    "Selesai",
    `Selesai: ${urutan.map((b) => b.nilai).join(", ")}. Insertion sort memakai ${banding} perbandingan dan ${pindah} pergeseran. ` +
      "Kompleksitasnya O(n²), tetapi untuk data yang hampir urut sangat cepat: setiap kunci hanya bergeser sedikit.",
    B.akhir,
  );

  return { langkah, banding, pindah };
}
