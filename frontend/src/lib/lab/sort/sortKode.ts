/**
 * Pseudocode Cambridge 9618 yang tampil di samping visualisasi, beserta nomor
 * baris yang disorot setiap jenis langkah.
 *
 * Kode ini BUKAN hiasan: `verify-sorting` menjalankannya dengan interpreter
 * Lab 05 (`jalankanPseudo`) dan memeriksa hasilnya terurut. Kode yang dibaca
 * siswa di sini bisa ia salin ke Lab 05 dan jalankan sendiri.
 *
 * Kode menganggap `A : ARRAY[1:N] OF INTEGER` dan `N` sudah berisi data (begitu
 * pula soal ujian biasanya menuliskannya), sehingga yang tampil hanyalah
 * algoritmanya. Nomor baris dicari dari TEKS kodenya, bukan ditulis tangan —
 * menyunting kode tidak bisa membuat sorotan meleset diam-diam.
 *
 * Modul netral.
 */
import type { ArahSort } from "./sortTypes";

const PANAH = "←";

/** Operator perbandingan "harus ditukar" untuk bubble sort. */
const opBubble = (arah: ArahSort) => (arah === "naik" ? ">" : "<");
/** Operator "ambil dari kiri" untuk merge sort — seri ikut kiri, jadi stabil. */
const opMerge = (arah: ArahSort) => (arah === "naik" ? "<=" : ">=");

export function kodeBubble(arah: ArahSort): string {
  return `// Bubble sort - A[1:N] berisi data yang akan diurutkan
DECLARE Putaran, j, Temp : INTEGER
DECLARE Ditukar : BOOLEAN

Putaran ${PANAH} 1
REPEAT
   Ditukar ${PANAH} FALSE
   FOR j ${PANAH} 1 TO N - Putaran
      IF A[j] ${opBubble(arah)} A[j + 1]
         THEN
            Temp ${PANAH} A[j]
            A[j] ${PANAH} A[j + 1]
            A[j + 1] ${PANAH} Temp
            Ditukar ${PANAH} TRUE
      ENDIF
   NEXT j
   Putaran ${PANAH} Putaran + 1
UNTIL Ditukar = FALSE OR Putaran = N
`;
}

export function kodeMerge(arah: ArahSort): string {
  return `// Merge sort - A[1:N] berisi data, B adalah array bantu
DECLARE B : ARRAY[1:12] OF INTEGER

PROCEDURE MergeSort(Kiri : INTEGER, Kanan : INTEGER)
   DECLARE Tengah : INTEGER
   IF Kiri < Kanan
      THEN
         Tengah ${PANAH} (Kiri + Kanan) DIV 2
         CALL MergeSort(Kiri, Tengah)
         CALL MergeSort(Tengah + 1, Kanan)
         CALL Gabung(Kiri, Tengah, Kanan)
   ENDIF
ENDPROCEDURE

PROCEDURE Gabung(Kiri : INTEGER, Tengah : INTEGER, Kanan : INTEGER)
   DECLARE i, j, k : INTEGER
   i ${PANAH} Kiri
   j ${PANAH} Tengah + 1
   k ${PANAH} Kiri
   WHILE i <= Tengah AND j <= Kanan
      IF A[i] ${opMerge(arah)} A[j]
         THEN
            B[k] ${PANAH} A[i]
            i ${PANAH} i + 1
         ELSE
            B[k] ${PANAH} A[j]
            j ${PANAH} j + 1
      ENDIF
      k ${PANAH} k + 1
   ENDWHILE
   WHILE i <= Tengah
      B[k] ${PANAH} A[i]
      i ${PANAH} i + 1
      k ${PANAH} k + 1
   ENDWHILE
   WHILE j <= Kanan
      B[k] ${PANAH} A[j]
      j ${PANAH} j + 1
      k ${PANAH} k + 1
   ENDWHILE
   FOR k ${PANAH} Kiri TO Kanan
      A[k] ${PANAH} B[k]
   NEXT k
ENDPROCEDURE

CALL MergeSort(1, N)
`;
}

/** Insertion sort: geser selama A[j] "harus di kanan" kunci — `>` (naik) / `<` (turun); seri berhenti = stabil. */
export function kodeInsertion(arah: ArahSort): string {
  return `// Insertion sort - A[1:N] berisi data yang akan diurutkan
DECLARE i, j, Kunci : INTEGER

FOR i ${PANAH} 2 TO N
   Kunci ${PANAH} A[i]
   j ${PANAH} i - 1
   WHILE j >= 1 AND A[j] ${opBubble(arah)} Kunci
      A[j + 1] ${PANAH} A[j]
      j ${PANAH} j - 1
   ENDWHILE
   A[j + 1] ${PANAH} Kunci
NEXT i
`;
}

/**
 * Nomor baris (1-based) pertama yang — setelah dipangkas — DIAWALI `awal`,
 * dicari mulai setelah baris `setelah`. Melempar bila tidak ada: itu salah
 * pemrogram (teks kode berubah), dan harus ketahuan saat modul diuji.
 */
export function cariBaris(kode: string, awal: string, setelah = 0): number {
  const baris = kode.split("\n");
  for (let i = setelah; i < baris.length; i++) if (baris[i].trim().startsWith(awal)) return i + 1;
  throw new Error(`Baris "${awal}" tidak ada di pseudocode.`);
}

export interface BarisBubble {
  mulai: number;
  putaran: number;
  banding: number;
  tukarDari: number;
  tukarSampai: number;
  akhirPutaran: number;
}

export function barisBubble(arah: ArahSort): BarisBubble {
  const k = kodeBubble(arah);
  const tukarDari = cariBaris(k, `Temp ${PANAH}`);
  return {
    mulai: cariBaris(k, `Putaran ${PANAH} 1`),
    putaran: cariBaris(k, `Ditukar ${PANAH} FALSE`),
    banding: cariBaris(k, "IF A[j]"),
    tukarDari,
    tukarSampai: cariBaris(k, `Ditukar ${PANAH} TRUE`, tukarDari),
    akhirPutaran: cariBaris(k, "UNTIL"),
  };
}

export interface BarisMerge {
  mulai: number;
  daun: number;
  bagi: number;
  gabungDari: number;
  gabungSampai: number;
  banding: number;
  /** Penyalinan di perulangan utama: [dari, sampai]. */
  ambilKiri: [number, number];
  ambilKanan: [number, number];
  /** Perulangan sisa: baris WHILE dan baris penyalinannya. */
  sisaKiri: number;
  sisaKiriSalin: [number, number];
  sisaKanan: number;
  sisaKananSalin: [number, number];
  salinBalik: [number, number];
}

export function barisMerge(arah: ArahSort): BarisMerge {
  const k = kodeMerge(arah);
  const gabung = cariBaris(k, "PROCEDURE Gabung");
  const gabungDari = cariBaris(k, `i ${PANAH} Kiri`, gabung);
  const banding = cariBaris(k, "IF A[i]", gabung);
  const ambilKiri = cariBaris(k, `B[k] ${PANAH} A[i]`, banding);
  const ambilKanan = cariBaris(k, `B[k] ${PANAH} A[j]`, banding);
  // "WHILE i <= Tengah" juga awal baris perulangan utama ("… AND j <= Kanan"),
  // jadi perulangan sisa dicari SESUDAH ENDWHILE pertama.
  const endUtama = cariBaris(k, "ENDWHILE", banding);
  const sisaKiri = cariBaris(k, "WHILE i <= Tengah", endUtama);
  const sisaKanan = cariBaris(k, "WHILE j <= Kanan", sisaKiri);
  const salinBalik = cariBaris(k, `FOR k ${PANAH} Kiri`, sisaKanan);
  return {
    mulai: cariBaris(k, "CALL MergeSort(1"),
    daun: cariBaris(k, "IF Kiri < Kanan"),
    bagi: cariBaris(k, `Tengah ${PANAH}`),
    gabungDari,
    gabungSampai: cariBaris(k, `k ${PANAH} Kiri`, gabungDari),
    banding,
    ambilKiri: [ambilKiri, ambilKiri + 1],
    ambilKanan: [ambilKanan, ambilKanan + 1],
    sisaKiri,
    sisaKiriSalin: [sisaKiri + 1, sisaKiri + 3],
    sisaKanan,
    sisaKananSalin: [sisaKanan + 1, sisaKanan + 3],
    salinBalik: [salinBalik, salinBalik + 2],
  };
}

export interface BarisInsertion {
  putaran: number;
  ambil: [number, number];
  banding: number;
  geser: [number, number];
  sisip: number;
  akhir: number;
}

export function barisInsertion(arah: ArahSort): BarisInsertion {
  const k = kodeInsertion(arah);
  const ambil = cariBaris(k, `Kunci ${PANAH} A[i]`);
  const geser = cariBaris(k, `A[j + 1] ${PANAH} A[j]`);
  return {
    putaran: cariBaris(k, `FOR i ${PANAH} 2`),
    ambil: [ambil, cariBaris(k, `j ${PANAH} i - 1`, ambil)],
    banding: cariBaris(k, "WHILE j >= 1"),
    geser: [geser, cariBaris(k, `j ${PANAH} j - 1`, geser)],
    sisip: cariBaris(k, `A[j + 1] ${PANAH} Kunci`),
    akhir: cariBaris(k, "NEXT i"),
  };
}
