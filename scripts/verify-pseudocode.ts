/**
 * Menguji interpreter pseudocode Cambridge 9618 SynapLab — murni, tanpa dev
 * server & kredensial.
 *
 *   npx tsx scripts/verify-pseudocode.ts
 *
 * Yang dijaga:
 *   1. contoh siap pakai berjalan dan keluarannya benar;
 *   2. program bergaya panduan resmi 9618 (FOR bersarang, STEP negatif,
 *      REPEAT, CASE, SWAP BYREF, fungsi rekursif, array 2D, fungsi teks
 *      dengan contoh persis dari panduan) memberi hasil yang benar;
 *   3. galat (tipe, belum dideklarasi, indeks, masukan, rekursi, batas
 *      langkah, sintaks) muncul dengan jenis dan NOMOR BARIS yang benar;
 *   4. jejak: setiap langkah menunjuk baris yang sah, keluaran tidak pernah
 *      menyusut, batas rekaman ditandai;
 *   5. tidak ada masukan yang membuat interpreter melempar (uji acak), dan
 *      `__proto__` hanyalah nama variabel.
 */
import { check, finish } from "./checks";
import { jalankanPseudo, PSEUDO_MAKS_LANGKAH, pecahMasukan } from "../frontend/src/lib/lab/pseudo/pseudoJalan";
import { uraiPseudo } from "../frontend/src/lib/lab/pseudo/pseudoParser";
import { GalatPseudo } from "../frontend/src/lib/lab/pseudo/pseudoLexer";
import { CONTOH_PSEUDO } from "../frontend/src/lib/lab/pseudo/pseudoContoh";
import { mulberry32 } from "../frontend/src/lib/lab/labRandom";
import type { JejakKode } from "../frontend/src/lib/lab/kodeTypes";

// ── Penolong ────────────────────────────────────────────────────────────

/** Program ditulis dengan indentasi bebas di sini; baris pertama kosong dibuang. */
function prog(baris: string[]): string {
  return baris.join("\n");
}

function keluar(src: string, masukan = ""): string {
  const j = jalankanPseudo(src, masukan);
  return j.galat ? `GALAT[${j.galat.baris}] ${j.galat.jenis}: ${j.galat.pesan}` : j.keluaran;
}

function cekKeluaran(nama: string, src: string, harap: string, masukan = "") {
  const k = keluar(src, masukan);
  check(nama, k === harap, `dapat ${JSON.stringify(k)}${k === harap ? "" : `, harap ${JSON.stringify(harap)}`}`);
}

function cekGalat(nama: string, src: string, jenis: string, baris: number | null, pesanMemuat: string, masukan = "") {
  const j = jalankanPseudo(src, masukan);
  const g = j.galat;
  const ok = !!g && g.jenis === jenis && g.baris === baris && (g.pesan + " " + (g.saran ?? "")).includes(pesanMemuat);
  check(nama, ok, g ? `[${g.baris}] ${g.jenis}: ${g.pesan}${g.saran ? ` (saran: ${g.saran})` : ""}` : `tanpa galat, keluaran ${JSON.stringify(j.keluaran)}`);
}

/** Invarian jejak yang harus berlaku untuk SETIAP program. */
function masalahJejak(src: string, j: JejakKode): string | null {
  const jumlahBaris = src.split("\n").length;
  let sebelum = 0;
  for (let i = 0; i < j.langkah.length; i++) {
    const l = j.langkah[i];
    if (l.baris !== null && (l.baris < 1 || l.baris > jumlahBaris)) return `langkah ${i}: baris ${l.baris} di luar 1..${jumlahBaris}`;
    if (l.baris !== null) {
      const teks = src.split("\n")[l.baris - 1].trim();
      if (teks === "" || teks.startsWith("//")) return `langkah ${i}: baris ${l.baris} kosong/komentar`;
    }
    if (l.panjangKeluaran < sebelum) return `langkah ${i}: keluaran menyusut`;
    if (l.panjangKeluaran > j.keluaran.length) return `langkah ${i}: panjang keluaran melebihi keluaran akhir`;
    sebelum = l.panjangKeluaran;
    if (l.baris === null && i !== j.langkah.length - 1) return `langkah ${i}: baris null bukan di akhir`;
  }
  if (!j.galat && j.langkah.length > 0 && j.langkah[j.langkah.length - 1].baris !== null) return "program selesai tetapi langkah terakhir bukan null";
  return null;
}

// ── 1. Contoh siap pakai ────────────────────────────────────────────────

console.log("\n1. Contoh siap pakai");
const HARAP_CONTOH: Record<string, string> = {
  luas: "Luas = 20\n",
  genap: "7 adalah bilangan ganjil\n",
  jumlah: "Jumlah 1 sampai 5 = 15\n",
  predikat: "Predikat: A\n",
  terbesar: "Nilai terbesar: 31\n",
  tebak: "Masukkan angka 1 sampai 10\n".repeat(3) + "Terima kasih, Anda memilih 7\n",
  balik: "dEpanyS\n",
  faktorial: "5! = 120\n",
  tukar: "A = 8, B = 3\n",
};
check("setiap contoh punya keluaran harapan", CONTOH_PSEUDO.every((c) => c.id in HARAP_CONTOH), CONTOH_PSEUDO.map((c) => c.id).join(", "));
for (const c of CONTOH_PSEUDO) {
  cekKeluaran(`contoh "${c.nama}"`, c.kode, HARAP_CONTOH[c.id] ?? "?", c.masukan);
  const j = jalankanPseudo(c.kode, c.masukan);
  const m = masalahJejak(c.kode, j);
  check(`jejak contoh "${c.id}" sah`, m === null, m ?? `${j.langkah.length} langkah`);
}

// ── 2. Program bergaya panduan 9618 ─────────────────────────────────────

console.log("\n2. Bahasa sesuai panduan 9618");
cekKeluaran(
  "FOR bersarang + array 2D (panduan §7.1)",
  prog([
    "DECLARE Amount : ARRAY[1:2, 1:3] OF INTEGER",
    "DECLARE Row, Column, Total, RowTotal : INTEGER",
    "FOR Row ← 1 TO 2",
    "   FOR Column ← 1 TO 3",
    "      Amount[Row, Column] ← Row * 10 + Column",
    "   NEXT Column",
    "NEXT Row",
    "Total ← 0",
    "FOR Row ← 1 TO 2",
    "   RowTotal ← 0",
    "   FOR Column ← 1 TO 3",
    "      RowTotal ← RowTotal + Amount[Row, Column]",
    "   NEXT Column",
    '   OUTPUT "Total for Row ", Row, " is ", RowTotal',
    "   Total ← Total + RowTotal",
    "NEXT Row",
    'OUTPUT "The grand total is ", Total',
  ]),
  "Total for Row 1 is 36\nTotal for Row 2 is 66\nThe grand total is 102\n",
);
cekKeluaran("FOR dengan STEP negatif", prog(["DECLARE i : INTEGER", "FOR i ← 10 TO 1 STEP -3", "   OUTPUT i", "NEXT i"]), "10\n7\n4\n1\n");
cekKeluaran("FOR dengan STEP 2 berhenti saat melewati batas", prog(["DECLARE i : INTEGER", "FOR i ← 1 TO 6 STEP 2", "   OUTPUT i", "NEXT i"]), "1\n3\n5\n");
cekKeluaran("FOR awal > akhir tidak dijalankan", prog(["DECLARE i : INTEGER", "FOR i ← 5 TO 1", "   OUTPUT i", "NEXT i", 'OUTPUT "selesai"']), "selesai\n");
cekKeluaran("FOR awal = akhir dijalankan sekali", prog(["DECLARE i : INTEGER", "FOR i ← 3 TO 3", "   OUTPUT i", "NEXT i"]), "3\n");
cekKeluaran("NEXT tanpa nama diterima", prog(["DECLARE i : INTEGER", "FOR i ← 1 TO 2", "   OUTPUT i", "NEXT"]), "1\n2\n");
cekKeluaran(
  "REPEAT dijalankan minimal sekali (panduan §7.2)",
  prog(["DECLARE n : INTEGER", "n ← 100", "REPEAT", "   OUTPUT n", "   n ← n + 1", "UNTIL n > 5"]),
  "100\n",
);
cekKeluaran("WHILE tanpa DO (panduan §7.3)", prog(["DECLARE Number : INTEGER", "Number ← 30", "WHILE Number > 9", "   Number ← Number - 9", "ENDWHILE", "OUTPUT Number"]), "3\n");
cekKeluaran("WHILE dengan DO juga diterima", prog(["DECLARE n : INTEGER", "n ← 2", "WHILE n > 0 DO", "   n ← n - 1", "ENDWHILE", "OUTPUT n"]), "0\n");
cekKeluaran(
  "IF bersarang dengan THEN/ELSE di baris sendiri (panduan §6.1)",
  prog([
    "DECLARE A, B : INTEGER",
    "A ← 7",
    "B ← 3",
    "IF A > B",
    "  THEN",
    "    IF A > 5",
    "      THEN",
    '        OUTPUT "A besar"',
    "      ELSE",
    '        OUTPUT "A kecil"',
    "    ENDIF",
    "  ELSE",
    '    OUTPUT "B"',
    "ENDIF",
  ]),
  "A besar\n",
);
cekKeluaran("IF satu baris", prog(["DECLARE x : INTEGER", "x ← 1", 'IF x = 1 THEN OUTPUT "satu" ELSE OUTPUT "lain" ENDIF']), "satu\n");
const programCase = prog([
  "DECLARE Move : CHAR",
  "DECLARE Position : INTEGER",
  "Position ← 50",
  "INPUT Move",
  "CASE OF Move",
  "   ꞌWꞌ : Position ← Position − 10",
  "   ꞌSꞌ : Position ← Position + 10",
  "   'A', 'a' : Position ← Position - 1",
  "         OUTPUT \"kiri\"",
  "   'D' : Position ← Position + 1",
  '   OTHERWISE : OUTPUT "diam"',
  "ENDCASE",
  "OUTPUT Position",
]);
cekKeluaran("CASE: kutip ꞌ dan minus − dari PDF panduan", programCase, "40\n", "W");
cekKeluaran("CASE: daftar nilai + pernyataan lanjutan di baris berikut", programCase, "kiri\n49\n", "a");
cekKeluaran("CASE: OTHERWISE", programCase, "diam\n50\n", "X");
cekKeluaran(
  "CASE: rentang huruf & angka, hanya cabang pertama yang cocok",
  prog(["DECLARE c : CHAR", "c ← 'm'", "CASE OF c", "  'a' TO 'z' : OUTPUT \"kecil\"", "  'm' : OUTPUT \"m\"", "ENDCASE"]),
  "kecil\n",
);
cekKeluaran(
  "SWAP panduan §8.3: BYREF berlaku juga untuk Y",
  prog([
    "PROCEDURE SWAP(BYREF X : INTEGER, Y : INTEGER)",
    "   DECLARE Temp : INTEGER",
    "   Temp ← X",
    "   X ← Y",
    "   Y ← Temp",
    "ENDPROCEDURE",
    "DECLARE P, Q : INTEGER",
    "P ← 1",
    "Q ← 2",
    "CALL SWAP(P, Q)",
    'OUTPUT P, " ", Q',
  ]),
  "2 1\n",
);
cekKeluaran(
  "BYVAL setelah BYREF mengembalikan ke salinan",
  prog([
    "PROCEDURE Ubah(BYREF X : INTEGER, BYVAL Y : INTEGER)",
    "   X ← 100",
    "   Y ← 100",
    "ENDPROCEDURE",
    "DECLARE P, Q : INTEGER",
    "P ← 1",
    "Q ← 2",
    "CALL Ubah(P, Q)",
    'OUTPUT P, " ", Q',
  ]),
  "100 2\n",
);
cekKeluaran(
  "tanpa kata kunci = BYVAL (variabel pemanggil tidak berubah)",
  prog(["PROCEDURE Ubah(X : INTEGER)", "   X ← 99", "ENDPROCEDURE", "DECLARE P : INTEGER", "P ← 1", "CALL Ubah(P)", "OUTPUT P"]),
  "1\n",
);
cekKeluaran(
  "BYREF ke elemen array",
  prog(["PROCEDURE Naik(BYREF X : INTEGER)", "   X ← X + 1", "ENDPROCEDURE", "DECLARE A : ARRAY[1:3] OF INTEGER", "A[2] ← 5", "CALL Naik(A[2])", "OUTPUT A[2]"]),
  "6\n",
);
cekKeluaran(
  "array sebagai parameter BYREF diubah di tempat; BYVAL disalin",
  prog([
    "PROCEDURE Isi(BYREF Larik : ARRAY OF INTEGER)",
    "   Larik[1] ← 7",
    "ENDPROCEDURE",
    "PROCEDURE Coba(Larik : ARRAY OF INTEGER)",
    "   Larik[1] ← 9",
    "ENDPROCEDURE",
    "DECLARE A : ARRAY[1:2] OF INTEGER",
    "CALL Isi(A)",
    "CALL Coba(A)",
    "OUTPUT A[1]",
  ]),
  "7\n",
);
cekKeluaran(
  "prosedur tanpa parameter dengan () (panduan §8.1)",
  prog(["PROCEDURE Halo()", '   OUTPUT "halo"', "ENDPROCEDURE", "CALL Halo()", "CALL Halo"]),
  "halo\nhalo\n",
);
cekKeluaran(
  "FUNCTION Max panduan §8.2 dipakai di OUTPUT",
  prog([
    "FUNCTION Max(Number1 : INTEGER, Number2 : INTEGER) RETURNS INTEGER",
    "   IF Number1 > Number2",
    "      THEN",
    "         RETURN Number1",
    "      ELSE",
    "         RETURN Number2",
    "   ENDIF",
    "ENDFUNCTION",
    "DECLARE Distance : INTEGER",
    "Distance ← 8",
    'OUTPUT "Penalty Fine = ", Max(10, Distance*2)',
  ]),
  "Penalty Fine = 16\n",
);
cekKeluaran(
  "RETURN di tengah FOR langsung keluar",
  prog([
    "FUNCTION Cari(T : INTEGER) RETURNS INTEGER",
    "   DECLARE i : INTEGER",
    "   FOR i ← 1 TO 100",
    "      IF i * i >= T THEN RETURN i ENDIF",
    "   NEXT i",
    "   RETURN -1",
    "ENDFUNCTION",
    "OUTPUT Cari(50)",
  ]),
  "8\n",
);
cekKeluaran(
  "fungsi rekursif Fibonacci",
  prog([
    "FUNCTION Fib(N : INTEGER) RETURNS INTEGER",
    "   IF N < 2 THEN RETURN N ENDIF",
    "   RETURN Fib(N - 1) + Fib(N - 2)",
    "ENDFUNCTION",
    "OUTPUT Fib(10)",
  ]),
  "55\n",
);
cekKeluaran(
  "variabel global terlihat di dalam prosedur",
  prog(["DECLARE Skor : INTEGER", "PROCEDURE Tambah()", "   Skor ← Skor + 5", "ENDPROCEDURE", "Skor ← 1", "CALL Tambah()", "OUTPUT Skor"]),
  "6\n",
);
cekKeluaran(
  "fungsi teks dengan contoh persis panduan §5.5",
  prog([
    'OUTPUT RIGHT("ABCDEFGH", 3)',
    'OUTPUT LENGTH("Happy Days")',
    'OUTPUT MID("ABCDEFGH", 2, 3)',
    "OUTPUT LCASE(ꞌWꞌ), UCASE(ꞌhꞌ)",
    'OUTPUT "Summer" & " " & "Pudding"',
    'OUTPUT LEFT("ABCDEFGH", 2), TO_UPPER("abc"), TO_LOWER("XyZ")',
  ]),
  "FGH\n10\nBCD\nwH\nSummer Pudding\nABABCxyz\n",
);
cekKeluaran("INT panduan §5.6: INT(27.5415) = 27", "OUTPUT INT(27.5415), \" \", INT(-3.7)", "27 -3\n");
cekKeluaran(
  "operator aritmetika: / selalu REAL, DIV & MOD INTEGER",
  'OUTPUT 10 / 4, " ", 10 / 5, " ", 10 DIV 3, " ", 10 MOD 3, " ", -7 DIV 2, " ", MOD(17, 5), " ", DIV(17, 5)',
  "2.5 2.0 3 1 -3 2 3\n",
);
cekKeluaran("urutan operasi: * sebelum +, kurung", 'OUTPUT 2 + 3 * 4, " ", (2 + 3) * 4, " ", -2 * 3', "14 20 -6\n");
cekKeluaran("NOT mengikat lebih longgar dari perbandingan", "OUTPUT NOT 1 = 2, \" \", NOT TRUE AND FALSE", "TRUE FALSE\n");
cekKeluaran(
  "AND hubung-singkat: indeks di luar batas tidak dibaca",
  prog(["DECLARE A : ARRAY[1:3] OF INTEGER", "DECLARE i : INTEGER", "A[1] ← 1", "A[2] ← 2", "A[3] ← 3", "i ← 1", "WHILE i <= 3 AND A[i] > 0", "   i ← i + 1", "ENDWHILE", "OUTPUT i"]),
  "4\n",
);
cekKeluaran("perbandingan teks peka huruf besar-kecil; CHAR vs STRING", "OUTPUT \"a\" < \"b\", 'A' = \"A\", \"a\" = \"A\", 2 = 2.0", "TRUETRUEFALSETRUE\n");
cekKeluaran("konversi NUM_TO_STR / STR_TO_NUM / IS_NUM", 'OUTPUT NUM_TO_STR(5) & "!", STR_TO_NUM("3.5") + 1, IS_NUM("12"), IS_NUM("12a")', "5!4.5TRUEFALSE\n");
cekKeluaran("ASC & CHR", "OUTPUT ASC('A'), CHR(66)", "65B\n");
cekKeluaran("INTEGER boleh masuk REAL", prog(["DECLARE r : REAL", "r ← 3", "OUTPUT r"]), "3.0\n");
cekKeluaran("CHAR boleh masuk STRING, STRING 1 huruf boleh masuk CHAR", prog(["DECLARE s : STRING", "DECLARE c : CHAR", "s ← 'x'", 'c ← "y"', "OUTPUT s, c"]), "xy\n");
cekKeluaran("CONSTANT dengan literal (panduan §2.5)", prog(["CONSTANT HourlyRate = 6.50", "CONSTANT Batas = -3", "OUTPUT HourlyRate * 2, Batas"]), "13.0-3\n");
cekKeluaran("salin seluruh array (panduan §3.2)", prog(["DECLARE A, B : ARRAY[1:2] OF INTEGER", "A[1] ← 4", "A[2] ← 5", "B ← A", "A[1] ← 0", "OUTPUT B[1], B[2]"]), "45\n");
cekKeluaran("nama tidak membedakan besar-kecil (panduan §2.3)", prog(["DECLARE Counter : INTEGER", "counter ← 3", "OUTPUT COUNTER"]), "3\n");
cekKeluaran("<- dan <-- sama dengan ←", prog(["DECLARE x : INTEGER", "x <- 1", "x <-- x + 1", "OUTPUT x"]), "2\n");
cekKeluaran("komentar // diabaikan", prog(["// awal", "DECLARE x : INTEGER // nilai", "x ← 1 // satu", "OUTPUT x"]), "1\n");
cekKeluaran("DECLARE di dalam perulangan tidak dianggap ganda", prog(["DECLARE i : INTEGER", "FOR i ← 1 TO 3", "   DECLARE t : INTEGER", "   t ← i", "NEXT i", "OUTPUT t"]), "3\n");
cekKeluaran("INPUT membaca satu nilai per baris (CRLF juga)", prog(["DECLARE a : STRING", "DECLARE b : REAL", "DECLARE c : BOOLEAN", "INPUT a", "INPUT b", "INPUT c", "OUTPUT a, b, c"]), "halo dunia2.5TRUE\n", "halo dunia\r\n2.5\r\ntrue\r\n");
check("pecahMasukan: baris kosong terakhir tidak dihitung", JSON.stringify(pecahMasukan("1\n2\n")) === '["1","2"]' && JSON.stringify(pecahMasukan("")) === "[]" && JSON.stringify(pecahMasukan("\n")) === '[""]', JSON.stringify([pecahMasukan("1\n2\n"), pecahMasukan(""), pecahMasukan("\n")]));
{
  const r1 = keluar('OUTPUT RAND(10)');
  const r2 = keluar('OUTPUT RAND(10)');
  const r3 = jalankanPseudo('OUTPUT RAND(10)', "", { benih: 1 }).keluaran;
  const n = Number(r1);
  check("RAND berbenih: hasil sama tiap jalan, REAL dalam [0, x)", r1 === r2 && n >= 0 && n < 10 && r1 !== r3, `${r1.trim()} / ${r2.trim()} / benih lain ${r3.trim()}`);
}

// ── 3. Galat & nomor baris ──────────────────────────────────────────────

console.log("\n3. Galat dengan nomor baris");
cekGalat("REAL ke INTEGER = galat tipe + saran INT", prog(["DECLARE x : INTEGER", "x ← 7 / 2"]), "Galat tipe", 2, "INT(");
cekGalat("STRING ke INTEGER = saran STR_TO_NUM", prog(["DECLARE x : INTEGER", 'x ← "5"']), "Galat tipe", 2, "STR_TO_NUM");
cekGalat("STRING panjang ke CHAR", prog(["DECLARE c : CHAR", 'c ← "ab"']), "Galat tipe", 2, "satu karakter");
cekGalat("belum dideklarasikan + saran tipe dari nilainya", prog(["", "Nama ← \"Budi\""]), "Galat nama", 2, "DECLARE Nama : STRING");
cekGalat("FOR tanpa DECLARE penghitung", prog(["FOR i ← 1 TO 3", "NEXT i"]), "Galat nama", 1, "DECLARE i : INTEGER");
cekGalat("penghitung FOR harus INTEGER", prog(["DECLARE r : REAL", "FOR r ← 1 TO 3", "NEXT r"]), "Galat tipe", 2, "INTEGER");
cekGalat("indeks di luar batas", prog(["DECLARE A : ARRAY[1:5] OF INTEGER", "DECLARE i : INTEGER", "FOR i ← 1 TO 6", "   A[i] ← i", "NEXT i"]), "Galat indeks", 4, "Indeks 6 di luar batas A[1:5]");
cekGalat("indeks di bawah batas bawah", prog(["DECLARE A : ARRAY[1:5] OF INTEGER", "A[0] ← 1"]), "Galat indeks", 2, "Indeks 0");
cekGalat("array 2D dengan satu indeks", prog(["DECLARE A : ARRAY[1:2, 1:2] OF INTEGER", "A[1] ← 1"]), "Galat indeks", 2, "2 indeks");
cekGalat("kolom 2D di luar batas", prog(["DECLARE A : ARRAY[1:2, 1:3] OF INTEGER", "A[2, 4] ← 1"]), "Galat indeks", 2, "Indeks 4");
cekGalat("membaca variabel yang belum diberi nilai", prog(["DECLARE x : INTEGER", "", "OUTPUT x + 1"]), "Galat nilai", 3, "belum diberi nilai");
cekGalat("membaca elemen array kosong", prog(["DECLARE A : ARRAY[1:3] OF INTEGER", "OUTPUT A[2]"]), "Galat nilai", 2, "belum diberi nilai");
cekGalat("INPUT kehabisan masukan", prog(["DECLARE a, b : INTEGER", "INPUT a", "INPUT b"]), "Galat masukan", 3, "Masukan habis", "5");
cekGalat("INPUT teks ke INTEGER", prog(["DECLARE a : INTEGER", "INPUT a"]), "Galat masukan", 2, "bukan INTEGER", "dua");
cekGalat("INPUT 2.5 ke INTEGER memberi saran REAL", prog(["DECLARE a : INTEGER", "INPUT a"]), "Galat masukan", 2, "REAL", "2.5");
cekGalat("pembagian dengan nol", prog(["DECLARE x : REAL", "x ← 1 / 0"]), "Galat hitung", 2, "nol");
cekGalat("MOD dengan nol", "OUTPUT 5 MOD 0", "Galat hitung", 1, "nol");
cekGalat("MOD pada REAL", "OUTPUT 5.5 MOD 2", "Galat tipe", 1, "INTEGER");
cekGalat("+ pada teks memberi saran &", 'OUTPUT "a" + "b"', "Galat tipe", 1, "pakai &");
cekGalat("& pada angka memberi saran NUM_TO_STR", 'OUTPUT "Nilai: " & 5', "Galat tipe", 1, "NUM_TO_STR");
cekGalat("membandingkan angka dengan teks", 'OUTPUT 5 = "5"', "Galat tipe", 1, "Tidak bisa membandingkan");
cekGalat("kondisi IF bukan BOOLEAN", prog(["DECLARE x : INTEGER", "x ← 1", "IF x THEN OUTPUT 1 ENDIF"]), "Galat tipe", 3, "BOOLEAN");
cekGalat("konstanta tidak bisa diubah", prog(["CONSTANT Pi = 3.14", "Pi ← 3"]), "Galat nama", 2, "konstanta");
cekGalat("DECLARE ganda", prog(["DECLARE x : INTEGER", "DECLARE x : REAL"]), "Galat nama", 2, "baris 1");
cekGalat(
  "rekursi tanpa kasus dasar",
  prog(["FUNCTION F(N : INTEGER) RETURNS INTEGER", "   RETURN F(N + 1)", "ENDFUNCTION", "OUTPUT F(1)"]),
  "Galat rekursi",
  2,
  "kasus dasar",
);
cekGalat("perulangan tak berujung dihentikan", prog(["DECLARE i : INTEGER", "i ← 0", "WHILE i >= 0", "   i ← i + 1", "ENDWHILE"]), "Batas langkah", 3, "perulangan");
cekGalat("FUNCTION tanpa RETURN", prog(["FUNCTION F() RETURNS INTEGER", '   OUTPUT "x"', "ENDFUNCTION", "OUTPUT F()"]), "Galat nilai", 3, "tanpa RETURN");
cekGalat("FUNCTION dipanggil dengan CALL", prog(["FUNCTION F() RETURNS INTEGER", "   RETURN 1", "ENDFUNCTION", "CALL F()"]), "Galat nama", 4, "bukan dengan CALL");
cekGalat("PROCEDURE di dalam ekspresi", prog(["PROCEDURE P()", "ENDPROCEDURE", "OUTPUT P()"]), "Galat nama", 3, "CALL P");
cekGalat("jumlah argumen salah", prog(["PROCEDURE P(A : INTEGER)", "ENDPROCEDURE", "CALL P(1, 2)"]), "Galat nama", 3, "perlu 1 argumen");
cekGalat("BYREF perlu variabel, bukan nilai", prog(["PROCEDURE P(BYREF A : INTEGER)", "ENDPROCEDURE", "CALL P(5)"]), "Galat tipe", 3, "harus sebuah variabel");
cekGalat("BYREF tipe harus sama persis", prog(["PROCEDURE P(BYREF A : REAL)", "ENDPROCEDURE", "DECLARE x : INTEGER", "x ← 1", "CALL P(x)"]), "Galat tipe", 5, "BYREF REAL");
cekGalat("prosedur tidak ditemukan", "CALL Hilang()", "Galat nama", 1, "tidak ditemukan");
cekGalat("MID melewati teks", 'OUTPUT MID("abc", 2, 5)', "Galat indeks", 1, "MID");
cekGalat("STR_TO_NUM bukan angka", 'OUTPUT STR_TO_NUM("x1")', "Galat nilai", 1, "IS_NUM");
cekGalat("galat di dalam fungsi menunjuk baris di dalam fungsi", prog(["FUNCTION Bagi(A : INTEGER) RETURNS REAL", "   RETURN 10 / A", "ENDFUNCTION", "OUTPUT Bagi(0)"]), "Galat hitung", 2, "nol");

console.log("\n   Galat sintaks (sebelum program berjalan)");
cekGalat("kata kunci huruf kecil", prog(["DECLARE x : INTEGER", "if x > 0 THEN"]), "Galat sintaks", 2, "HURUF BESAR");
cekGalat("PRINT → OUTPUT", 'PRINT "halo"', "Galat sintaks", 1, "OUTPUT, bukan PRINT");
cekGalat("= untuk penugasan → ←", prog(["DECLARE x : INTEGER", "x = 5"]), "Galat sintaks", 2, "←");
cekGalat("ELSEIF tidak ada di 9618", prog(["DECLARE x : INTEGER", "IF x > 0 THEN", "   OUTPUT 1", "ELSEIF x < 0 THEN"]), "Galat sintaks", 4, "ELSEIF");
cekGalat("IF lupa ENDIF dilaporkan di WHILE penutupnya", prog(["DECLARE x : INTEGER", "WHILE x > 0", "   IF x = 1 THEN", "      x ← 0", "ENDWHILE"]), "Galat sintaks", 5, "IF di baris 3 belum ditutup ENDIF");
cekGalat("FOR lupa NEXT", prog(["DECLARE i : INTEGER", "FOR i ← 1 TO 3", "   OUTPUT i"]), "Galat sintaks", 3, "belum ditutup NEXT");
cekGalat("NEXT dengan nama berbeda", prog(["DECLARE i, j : INTEGER", "FOR i ← 1 TO 3", "NEXT j"]), "Galat sintaks", 3, "tidak cocok");
cekGalat("ENDFOR → NEXT", prog(["DECLARE i : INTEGER", "FOR i ← 1 TO 3", "ENDFOR"]), "Galat sintaks", 3, "NEXT");
cekGalat("ENDIF yatim", "ENDIF", "Galat sintaks", 1, "tanpa pembuka");
cekGalat("CHAR berisi lebih dari satu huruf", "OUTPUT 'ab'", "Galat sintaks", 1, "tepat satu karakter");
cekGalat("STRING tidak ditutup", 'OUTPUT "abc', "Galat sintaks", 1, "belum ditutup");
cekGalat("REAL tanpa angka di belakang titik", "OUTPUT 5.", "Galat sintaks", 1, "5.0");
cekGalat("pangkat ^ belum ada", "OUTPUT 2 ^ 3", "Galat sintaks", 1, "kalikan berulang");
cekGalat("BYREF pada FUNCTION dilarang (panduan §8.3)", prog(["FUNCTION F(BYREF A : INTEGER) RETURNS INTEGER", "   RETURN A", "ENDFUNCTION"]), "Galat sintaks", 1, "FUNCTION tidak dikirim BYREF");
cekGalat("CONSTANT harus literal (panduan §2.5)", prog(["CONSTANT A = 2", "CONSTANT B = A * 2"]), "Galat sintaks", 2, "literal");
cekGalat("RETURN di luar FUNCTION", prog(["PROCEDURE P()", "   RETURN 1", "ENDPROCEDURE"]), "Galat sintaks", 2, "RETURN hanya");
cekGalat("PROCEDURE di dalam blok", prog(["DECLARE x : INTEGER", "IF x > 0 THEN", "   PROCEDURE P()"]), "Galat sintaks", 3, "tingkat teratas");
cekGalat("tipe gaya bahasa lain (int)", "DECLARE x : int", "Galat sintaks", 1, "INTEGER");
cekGalat("nama fungsi bawaan sebagai variabel", "DECLARE LENGTH : INTEGER", "Galat sintaks", 1, "fungsi bawaan");
cekGalat("TYPE belum didukung", prog(["TYPE Siswa", "ENDTYPE"]), "Galat sintaks", 1, "belum didukung");
cekGalat("indeks 2D gaya [i][j]", prog(["DECLARE A : ARRAY[1:2, 1:2] OF INTEGER", "A[1][2] ← 3"]), "Galat sintaks", 2, "Nilai[baris, kolom]");
cekGalat("kurung yang tidak ditutup", "OUTPUT (1 + 2", "Galat sintaks", 1, ")");
cekGalat("subrutin bernama ganda", prog(["PROCEDURE P()", "ENDPROCEDURE", "PROCEDURE p()", "ENDPROCEDURE"]), "Galat sintaks", 3, "sudah ditulis di baris 1");

// ── 4. Jejak ────────────────────────────────────────────────────────────

console.log("\n4. Jejak langkah demi langkah");
{
  const src = prog(["DECLARE i : INTEGER", "FOR i ← 1 TO 2", "   OUTPUT i", "NEXT i", 'OUTPUT "x"']);
  const j = jalankanPseudo(src, "");
  const baris = j.langkah.map((l) => l.baris);
  const harap = [1, 2, 3, 4, 3, 4, 5, null];
  check("urutan baris FOR: FOR, isi, NEXT, isi, NEXT, sesudahnya, akhir", JSON.stringify(baris) === JSON.stringify(harap), JSON.stringify(baris));
  const i = j.langkah.map((l) => l.vars.find((v) => v.nama === "i")?.nilai ?? "(tidak ada)");
  check("nilai i per langkah = keadaan SEBELUM barisnya", JSON.stringify(i) === JSON.stringify(["(tidak ada)", "-", "1", "1", "2", "2", "3", "3"]), JSON.stringify(i));
  const keluaran = j.langkah.map((l) => j.keluaran.slice(0, l.panjangKeluaran));
  check("keluaran tumbuh per langkah", JSON.stringify(keluaran) === JSON.stringify(["", "", "", "1\n", "1\n", "1\n2\n", "1\n2\n", "1\n2\nx\n"]), JSON.stringify(keluaran));
}
{
  const c = CONTOH_PSEUDO.find((x) => x.id === "faktorial")!;
  const j = jalankanPseudo(c.kode, c.masukan);
  const dalam = Math.max(...j.langkah.map((l) => l.tumpukan.length));
  const lingkup = new Set(j.langkah.flatMap((l) => l.vars.map((v) => v.lingkup)));
  check("faktorial: tumpukan mencapai 5 bingkai", dalam === 5, `kedalaman ${dalam}`);
  check("faktorial: bingkai rekursif diberi label berbeda", lingkup.has("Faktorial") && lingkup.has("Faktorial (5)"), [...lingkup].join(", "));
}
{
  const c = CONTOH_PSEUDO.find((x) => x.id === "tukar")!;
  const j = jalankanPseudo(c.kode, c.masukan);
  const endproc = j.langkah.find((l) => l.baris === 6);
  const y = endproc?.vars.find((v) => v.nama === "Y");
  check("BYREF: langkah ENDPROCEDURE terekam dengan variabel lokal", !!endproc && endproc.tumpukan.join() === "Tukar" && y?.jenis === "INTEGER · BYREF" && y.nilai === "3", JSON.stringify(endproc?.vars));
}
{
  const src = prog(["DECLARE i : INTEGER", "i ← 0", "WHILE i < 3000", "   i ← i + 1", "ENDWHILE", "OUTPUT i"]);
  const j = jalankanPseudo(src, "", { maksRekam: 100 });
  check("rekaman dipotong di batasnya, program tetap selesai", j.terpotong && !j.galat && j.keluaran === "3000\n" && j.langkah.length === 101 && j.langkah[100].baris === null, `${j.langkah.length} langkah, terpotong=${j.terpotong}, keluaran ${JSON.stringify(j.keluaran)}`);
  const m = masalahJejak(src, j);
  check("jejak terpotong tetap sah", m === null, m ?? "ok");
  const tanpa = jalankanPseudo(src, "", { rekam: false });
  check("mode Jalankan (rekam: false) hanya menyimpan keadaan akhir", tanpa.langkah.length === 1 && tanpa.keluaran === "3000\n", `${tanpa.langkah.length} langkah`);
}
{
  const src = prog(["DECLARE i : INTEGER", "i ← 0", "WHILE TRUE", "   i ← i + 1", "ENDWHILE"]);
  const t0 = Date.now();
  const j = jalankanPseudo(src, "");
  const ms = Date.now() - t0;
  check(`batas ${PSEUDO_MAKS_LANGKAH} langkah tercapai cepat`, j.galat?.jenis === "Batas langkah" && ms < 3000, `${ms} ms`);
  const akhir = j.langkah[j.langkah.length - 1];
  check("galat setelah rekaman terpotong ditambahkan sebagai langkah terakhir", j.terpotong && akhir.baris === j.galat?.baris, `baris akhir ${akhir.baris}, galat ${j.galat?.baris}`);
}
{
  // WHILE dan OUTPUT bergantian: 50 langkah = tepat 25 kali OUTPUT.
  const j = jalankanPseudo(prog(["WHILE TRUE", '   OUTPUT "x"', "ENDWHILE"]), "", { maksLangkah: 50, rekam: false });
  check("batas langkah tepat: 50 langkah = 25 OUTPUT", j.galat?.jenis === "Batas langkah" && j.keluaran === "x\n".repeat(25), `${j.keluaran.length / 2} OUTPUT`);
}
{
  const src = prog(["DECLARE A : ARRAY[1:3] OF INTEGER", "A[1] ← 5", "A[4] ← 1"]);
  const j = jalankanPseudo(src, "");
  const akhir = j.langkah[j.langkah.length - 1];
  const barisDuplikat = j.langkah.filter((l) => l.baris === 3).length;
  check("galat: langkah terakhir di baris galat, tanpa langkah ganda", akhir.baris === 3 && barisDuplikat === 1 && akhir.vars[0].nilai === "[5, -, -]", JSON.stringify(j.langkah.map((l) => l.baris)) + " " + akhir.vars[0].nilai);
}
{
  const j = jalankanPseudo("DECLARE x : INTEGER\nx ← ", "");
  check("galat sintaks: tanpa langkah", j.langkah.length === 0 && j.galat?.jenis === "Galat sintaks", JSON.stringify(j.galat));
}

// ── 5. Keamanan & ketahanan ─────────────────────────────────────────────

console.log("\n5. Keamanan & ketahanan");
cekKeluaran(
  "__proto__, constructor, toString hanyalah nama variabel",
  prog(["DECLARE __proto__ : INTEGER", "DECLARE constructor : STRING", "DECLARE toString : BOOLEAN", "__proto__ ← 1", 'constructor ← "c"', "toString ← TRUE", "OUTPUT __proto__, constructor, toString"]),
  "1cTRUE\n",
);
cekKeluaran("hasOwnProperty sebagai nama prosedur", prog(["PROCEDURE hasOwnProperty()", '   OUTPUT "aman"', "ENDPROCEDURE", "CALL hasOwnProperty()"]), "aman\n");
cekGalat("angka terlalu besar ditolak, bukan dibulatkan diam-diam", prog(["DECLARE x : INTEGER", "x ← 9007199254740991", "x ← x + 1"]), "Galat hitung", 3, "terlalu besar");
cekGalat("teks yang terus digandakan dihentikan", prog(["DECLARE s : STRING", 's ← "ab"', "WHILE TRUE", "   s ← s & s", "ENDWHILE"]), "Batas langkah", 4, "terlalu panjang");
cekGalat("array raksasa ditolak", "DECLARE A : ARRAY[1:1000, 1:1000] OF INTEGER", "Galat indeks", 1, "terlalu besar");
cekGalat("keluaran tak berujung dipotong", prog(["DECLARE i : INTEGER", "FOR i ← 1 TO 9999", '   OUTPUT "0123456789"', "NEXT i"]), "Batas langkah", 3, "Keluaran terlalu panjang");
{
  let galat = "";
  try {
    uraiPseudo("OUTPUT " + "(".repeat(5000) + "1" + ")".repeat(5000));
  } catch (e) {
    galat = e instanceof GalatPseudo ? e.message : `LEMPAR ${String(e)}`;
  }
  check("kurung bersarang 5000 tingkat ditolak dengan galat bahasa", galat.includes("terlalu dalam"), galat);
}
{
  // Uji acak: potongan contoh yang dirusak (baris dihapus/digandakan/ditukar,
  // karakter dibuang) TIDAK BOLEH membuat interpreter melempar atau jatuh ke
  // "Galat internal" — setiap kegagalan harus galat bahasa berbaris.
  const acak = mulberry32(9618);
  const pilih = <T,>(xs: readonly T[]) => xs[Math.floor(acak() * xs.length)];
  const kepingan = ["IF", "THEN", "ELSE", "ENDIF", "FOR", "NEXT", "←", "(", ")", "[", "]", ",", ":", "'", '"', "CASE OF", "OTHERWISE", "RETURN", "CALL", "-", "MOD", "&", "TO", "STEP", "\n"];
  let lempar = 0;
  let internal = 0;
  let jejakRusak = 0;
  let contohKasus = "";
  for (let n = 0; n < 1500; n++) {
    const c = pilih(CONTOH_PSEUDO);
    let baris = c.kode.split("\n");
    const ubah = 1 + Math.floor(acak() * 3);
    for (let k = 0; k < ubah; k++) {
      const i = Math.floor(acak() * baris.length);
      const r = acak();
      if (r < 0.25) baris.splice(i, 1);
      else if (r < 0.5) baris.splice(i, 0, baris[Math.floor(acak() * baris.length)] ?? "");
      else if (r < 0.75) {
        const s = baris[i] ?? "";
        const p = Math.floor(acak() * (s.length + 1));
        baris[i] = s.slice(0, p) + s.slice(p + 1 + Math.floor(acak() * 3));
      } else {
        const s = baris[i] ?? "";
        const p = Math.floor(acak() * (s.length + 1));
        baris[i] = s.slice(0, p) + " " + pilih(kepingan) + " " + s.slice(p);
      }
    }
    baris = baris.slice(0, 200);
    const src = baris.join("\n");
    try {
      const j = jalankanPseudo(src, c.masukan);
      if (j.galat?.jenis === "Galat internal") {
        internal++;
        contohKasus ||= `${j.galat.pesan} ← ${JSON.stringify(src)}`;
      }
      const m = masalahJejak(src, j);
      if (m) {
        jejakRusak++;
        contohKasus ||= `${m} ← ${JSON.stringify(src)}`;
      }
      if (j.galat && j.galat.baris !== null && (j.galat.baris < 1 || j.galat.baris > baris.length + 1)) {
        jejakRusak++;
        contohKasus ||= `baris galat ${j.galat.baris} ← ${JSON.stringify(src)}`;
      }
    } catch (e) {
      lempar++;
      contohKasus ||= `${String(e)} ← ${JSON.stringify(src)}`;
    }
  }
  check("1500 program rusak acak: tidak ada yang melempar", lempar === 0, lempar ? contohKasus : "0");
  check("1500 program rusak acak: tidak ada galat internal", internal === 0, internal ? contohKasus : "0");
  check("1500 program rusak acak: jejak & baris galat selalu sah", jejakRusak === 0, jejakRusak ? contohKasus : "0");
}

finish();
