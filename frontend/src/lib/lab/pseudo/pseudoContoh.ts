/**
 * Contoh pseudocode 9618 siap pakai — titik mulai bagi siswa, dan bahan uji
 * `verify-pseudocode` (setiap contoh WAJIB berjalan tanpa galat dan
 * menghasilkan keluaran yang diharapkan dengan masukan bawaannya).
 *
 * Gayanya mengikuti Pseudocode Guide for Teachers: indentasi tiga spasi,
 * `THEN`/`ELSE` di baris sendiri, `←`, nama PascalCase.
 *
 * Modul netral.
 */
import type { ContohKode } from "../kodeTypes";

export const CONTOH_PSEUDO: readonly ContohKode[] = [
  {
    id: "luas",
    nama: "Luas persegi panjang",
    ket: "DECLARE, INPUT, hitung, OUTPUT.",
    masukan: "4\n5",
    kode: `// Menghitung luas persegi panjang
DECLARE Panjang : INTEGER
DECLARE Lebar : INTEGER
DECLARE Luas : INTEGER

INPUT Panjang
INPUT Lebar
Luas ← Panjang * Lebar
OUTPUT "Luas = ", Luas
`,
  },
  {
    id: "genap",
    nama: "Genap atau ganjil",
    ket: "IF … THEN … ELSE … ENDIF dengan MOD.",
    masukan: "7",
    kode: `DECLARE Angka : INTEGER

INPUT Angka
IF Angka MOD 2 = 0
   THEN
      OUTPUT Angka, " adalah bilangan genap"
   ELSE
      OUTPUT Angka, " adalah bilangan ganjil"
ENDIF
`,
  },
  {
    id: "jumlah",
    nama: "Jumlah 1 sampai N",
    ket: "Perulangan FOR … TO … NEXT.",
    masukan: "5",
    kode: `DECLARE N : INTEGER
DECLARE Total : INTEGER
DECLARE i : INTEGER

INPUT N
Total ← 0
FOR i ← 1 TO N
   Total ← Total + i
NEXT i
OUTPUT "Jumlah 1 sampai ", N, " = ", Total
`,
  },
  {
    id: "predikat",
    nama: "Predikat nilai",
    ket: "CASE OF dengan rentang TO dan OTHERWISE.",
    masukan: "85",
    kode: `DECLARE Nilai : INTEGER
DECLARE Predikat : CHAR

INPUT Nilai
CASE OF Nilai
   80 TO 100 : Predikat ← 'A'
   70 TO 79  : Predikat ← 'B'
   60 TO 69  : Predikat ← 'C'
   OTHERWISE : Predikat ← 'D'
ENDCASE
OUTPUT "Predikat: ", Predikat
`,
  },
  {
    id: "terbesar",
    nama: "Nilai terbesar dalam array",
    ket: "ARRAY[1:5], mengisi dengan INPUT, lalu mencari maksimum.",
    masukan: "12\n7\n31\n4\n19",
    kode: `DECLARE Data : ARRAY[1:5] OF INTEGER
DECLARE i : INTEGER
DECLARE Terbesar : INTEGER

FOR i ← 1 TO 5
   INPUT Data[i]
NEXT i

Terbesar ← Data[1]
FOR i ← 2 TO 5
   IF Data[i] > Terbesar
      THEN
         Terbesar ← Data[i]
   ENDIF
NEXT i
OUTPUT "Nilai terbesar: ", Terbesar
`,
  },
  {
    id: "tebak",
    nama: "Validasi masukan",
    ket: "REPEAT … UNTIL: minta ulang sampai masukannya sah.",
    masukan: "0\n15\n7",
    kode: `DECLARE Pilihan : INTEGER

REPEAT
   OUTPUT "Masukkan angka 1 sampai 10"
   INPUT Pilihan
UNTIL Pilihan >= 1 AND Pilihan <= 10
OUTPUT "Terima kasih, Anda memilih ", Pilihan
`,
  },
  {
    id: "balik",
    nama: "Membalik kata",
    ket: "Fungsi teks LENGTH, MID, & dan FOR dengan STEP -1.",
    masukan: "SynapEd",
    kode: `DECLARE Kata : STRING
DECLARE Hasil : STRING
DECLARE i : INTEGER

INPUT Kata
Hasil ← ""
FOR i ← LENGTH(Kata) TO 1 STEP -1
   Hasil ← Hasil & MID(Kata, i, 1)
NEXT i
OUTPUT Hasil
`,
  },
  {
    id: "faktorial",
    nama: "Faktorial (rekursif)",
    ket: "FUNCTION yang memanggil dirinya sendiri.",
    masukan: "5",
    kode: `FUNCTION Faktorial(N : INTEGER) RETURNS INTEGER
   IF N <= 1
      THEN
         RETURN 1
      ELSE
         RETURN N * Faktorial(N - 1)
   ENDIF
ENDFUNCTION

DECLARE Angka : INTEGER
INPUT Angka
OUTPUT Angka, "! = ", Faktorial(Angka)
`,
  },
  {
    id: "tukar",
    nama: "Menukar dua nilai (BYREF)",
    ket: "PROCEDURE dengan parameter BYREF, seperti contoh SWAP di panduan.",
    masukan: "3\n8",
    kode: `PROCEDURE Tukar(BYREF X : INTEGER, Y : INTEGER)
   DECLARE Sementara : INTEGER
   Sementara ← X
   X ← Y
   Y ← Sementara
ENDPROCEDURE

DECLARE A : INTEGER
DECLARE B : INTEGER
INPUT A
INPUT B
CALL Tukar(A, B)
OUTPUT "A = ", A, ", B = ", B
`,
  },
];
