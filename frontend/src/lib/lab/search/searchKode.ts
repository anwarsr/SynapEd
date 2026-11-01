/**
 * Pseudocode Cambridge 9618 Lab Searching beserta nomor baris yang disorot.
 *
 * Sama seperti Lab Sorting: kode menganggap `A : ARRAY[1:N] OF INTEGER`, `N`,
 * dan `Dicari` sudah terisi, dan `verify-searching` MENJALANKANNYA dengan
 * interpreter Lab 05 lalu mencocokkan keluarannya dengan rekaman. Nomor baris
 * dicari dari teksnya (`cariBaris`), bukan ditulis tangan.
 *
 * Modul netral.
 */
import { cariBaris } from "../sort/sortKode";

const PANAH = "←";

export const KODE_LINEAR = `// Linear search - A[1:N] berisi data, Dicari = nilai yang dicari
DECLARE i, Posisi : INTEGER
DECLARE Ketemu : BOOLEAN

Ketemu ${PANAH} FALSE
i ${PANAH} 1
WHILE i <= N AND Ketemu = FALSE
   IF A[i] = Dicari
      THEN
         Ketemu ${PANAH} TRUE
         Posisi ${PANAH} i
      ELSE
         i ${PANAH} i + 1
   ENDIF
ENDWHILE

IF Ketemu = TRUE
   THEN
      OUTPUT "Ditemukan di A[", Posisi, "]"
   ELSE
      OUTPUT "Tidak ditemukan"
ENDIF
`;

export const KODE_BINARY = `// Binary search - A[1:N] berisi data URUT, Dicari = nilai yang dicari
DECLARE Kiri, Kanan, Tengah : INTEGER
DECLARE Ketemu : BOOLEAN

Kiri ${PANAH} 1
Kanan ${PANAH} N
Ketemu ${PANAH} FALSE
WHILE Kiri <= Kanan AND Ketemu = FALSE
   Tengah ${PANAH} (Kiri + Kanan) DIV 2
   IF A[Tengah] = Dicari
      THEN
         Ketemu ${PANAH} TRUE
      ELSE
         IF A[Tengah] < Dicari
            THEN
               Kiri ${PANAH} Tengah + 1
            ELSE
               Kanan ${PANAH} Tengah - 1
         ENDIF
   ENDIF
ENDWHILE

IF Ketemu = TRUE
   THEN
      OUTPUT "Ditemukan di A[", Tengah, "]"
   ELSE
      OUTPUT "Tidak ditemukan"
ENDIF
`;

export interface BarisLinear {
  kepala: number;
  mulai: [number, number];
  banding: number;
  lanjut: number;
  ketemu: [number, number];
  keluarKetemu: number;
  keluarTidak: number;
}

export function barisLinear(): BarisLinear {
  const k = KODE_LINEAR;
  const mulai = cariBaris(k, `Ketemu ${PANAH} FALSE`);
  const ketemu = cariBaris(k, `Ketemu ${PANAH} TRUE`);
  const akhir = cariBaris(k, "IF Ketemu = TRUE");
  return {
    kepala: 1,
    mulai: [mulai, cariBaris(k, `i ${PANAH} 1`, mulai)],
    banding: cariBaris(k, "IF A[i] = Dicari"),
    lanjut: cariBaris(k, `i ${PANAH} i + 1`),
    ketemu: [ketemu, cariBaris(k, `Posisi ${PANAH} i`, ketemu)],
    keluarKetemu: cariBaris(k, 'OUTPUT "Ditemukan', akhir),
    keluarTidak: cariBaris(k, 'OUTPUT "Tidak', akhir),
  };
}

export interface BarisBinary {
  kepala: number;
  mulai: [number, number];
  ulang: number;
  tengah: number;
  banding: number;
  ketemu: number;
  geserKanan: number;
  geserKiri: number;
  keluarKetemu: number;
  keluarTidak: number;
}

export function barisBinary(): BarisBinary {
  const k = KODE_BINARY;
  const akhir = cariBaris(k, "IF Ketemu = TRUE");
  return {
    kepala: 1,
    mulai: [cariBaris(k, `Kiri ${PANAH} 1`), cariBaris(k, `Ketemu ${PANAH} FALSE`)],
    ulang: cariBaris(k, "WHILE Kiri <= Kanan"),
    tengah: cariBaris(k, `Tengah ${PANAH} (Kiri + Kanan) DIV 2`),
    banding: cariBaris(k, "IF A[Tengah] = Dicari"),
    ketemu: cariBaris(k, `Ketemu ${PANAH} TRUE`),
    geserKanan: cariBaris(k, `Kiri ${PANAH} Tengah + 1`),
    geserKiri: cariBaris(k, `Kanan ${PANAH} Tengah - 1`),
    keluarKetemu: cariBaris(k, 'OUTPUT "Ditemukan', akhir),
    keluarTidak: cariBaris(k, 'OUTPUT "Tidak', akhir),
  };
}
