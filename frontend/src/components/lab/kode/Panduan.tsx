// Panduan singkat di panel kanan lab kode (Python & pseudocode).

const KODE = "font-mono text-[12px] text-ink";

function Contoh({ children }: { children: string }) {
  return <pre className="mt-1 overflow-x-auto bg-white/[0.06] px-3 py-2 font-mono text-[12px] leading-relaxed text-ink">{children}</pre>;
}

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{judul}</p>
      <div className="mt-1 text-sm leading-relaxed text-ink-body">{children}</div>
    </div>
  );
}

/** Ringkasan dialek yang didukung — mengikuti Pseudocode Guide for Teachers 9618. */
export function PanduanPseudo() {
  return (
    <div>
      <p className="text-sm leading-relaxed text-ink-body">
        Mengikuti <em>Pseudocode Guide for Teachers</em> Cambridge International AS &amp; A Level Computer Science 9618.
        Kata kunci ditulis HURUF BESAR; nama variabel tidak membedakan besar-kecil.
      </p>
      <Bagian judul="Variabel & tipe">
        Setiap variabel dideklarasikan dulu (SynapLab mewajibkannya agar tipe bisa diperiksa). Tipe:{" "}
        <span className={KODE}>INTEGER REAL CHAR STRING BOOLEAN</span>.
        <Contoh>{`DECLARE Nilai : INTEGER
DECLARE Data : ARRAY[1:10] OF REAL
DECLARE Papan : ARRAY[1:3, 1:3] OF CHAR
CONSTANT Pajak = 0.11
Nilai ← 5          // atau Nilai <- 5`}</Contoh>
        Literal: <span className={KODE}>12</span>, <span className={KODE}>3.0</span> (angka di kedua sisi titik),{" "}
        <span className={KODE}>&apos;A&apos;</span> (CHAR), <span className={KODE}>&quot;teks&quot;</span> (STRING),{" "}
        <span className={KODE}>TRUE</span>/<span className={KODE}>FALSE</span>.
      </Bagian>
      <Bagian judul="Masukan & keluaran">
        <Contoh>{`INPUT Nama
OUTPUT "Halo, ", Nama`}</Contoh>
        INPUT membaca baris berikutnya dari kotak Masukan dan mengubahnya ke tipe variabelnya.
      </Bagian>
      <Bagian judul="Operator">
        <span className={KODE}>+ - * /</span> (<span className={KODE}>/</span> selalu REAL), <span className={KODE}>DIV</span>{" "}
        (bagi bulat), <span className={KODE}>MOD</span> (sisa), <span className={KODE}>&amp;</span> (sambung teks),{" "}
        <span className={KODE}>= &lt;&gt; &lt; &gt; &lt;= &gt;=</span>, <span className={KODE}>AND OR NOT</span>.
      </Bagian>
      <Bagian judul="Percabangan">
        <Contoh>{`IF Nilai >= 70
   THEN
      OUTPUT "Lulus"
   ELSE
      OUTPUT "Belum lulus"
ENDIF

CASE OF Huruf
   'A' : OUTPUT "Pertama"
   'B' TO 'Y' : OUTPUT "Tengah"
   OTHERWISE : OUTPUT "Lainnya"
ENDCASE`}</Contoh>
        Tidak ada ELSEIF: tulis ELSE lalu IF baru dengan ENDIF-nya sendiri.
      </Bagian>
      <Bagian judul="Perulangan">
        <Contoh>{`FOR i ← 1 TO 10 STEP 2
   OUTPUT i
NEXT i

WHILE x > 0
   x ← x - 1
ENDWHILE

REPEAT
   INPUT Kata
UNTIL Kata = "selesai"`}</Contoh>
      </Bagian>
      <Bagian judul="Prosedur & fungsi">
        <Contoh>{`PROCEDURE Tukar(BYREF A : INTEGER, B : INTEGER)
   ...
ENDPROCEDURE
CALL Tukar(X, Y)

FUNCTION Kuadrat(N : INTEGER) RETURNS INTEGER
   RETURN N * N
ENDFUNCTION
OUTPUT Kuadrat(4)`}</Contoh>
        Parameter BYVAL secara bawaan; BYREF berlaku juga untuk parameter sesudahnya sampai diganti BYVAL. FUNCTION tidak memakai BYREF.
      </Bagian>
      <Bagian judul="Fungsi bawaan">
        <span className={KODE}>LENGTH(s) LEFT(s, n) RIGHT(s, n) MID(s, mulai, n) UCASE(c) LCASE(c) TO_UPPER(s) TO_LOWER(s) NUM_TO_STR(x) STR_TO_NUM(s) IS_NUM(s) ASC(c) CHR(n) INT(x) RAND(x)</span>
        . Posisi pertama teks adalah 1.
      </Bagian>
      <Bagian judul="Belum didukung">
        TYPE (record, enum, pointer, set), berkas (OPENFILE dkk.), kelas OOP, dan tipe DATE.
      </Bagian>
    </div>
  );
}

/** Ringkasan Python untuk pemula + batasan lab ini. */
export function PanduanPython() {
  return (
    <div>
      <p className="text-sm leading-relaxed text-ink-body">
        Python 3.14 sungguhan (CPython lewat Pyodide) yang berjalan di browser Anda - tanpa server dan tanpa akun. Pustaka standar
        tersedia (math, random, …); akses ke halaman dan jaringan sengaja dimatikan.
      </p>
      <Bagian judul="Masukan & keluaran">
        <Contoh>{`nama = input("Nama: ")        # selalu teks (str)
umur = int(input("Umur: "))   # ubah ke bilangan bulat
print("Halo,", nama)
print(f"Tahun depan {umur + 1} tahun")`}</Contoh>
        input() membaca baris berikutnya dari kotak Masukan, lalu nilainya ikut ditampilkan di keluaran seperti di terminal.
      </Bagian>
      <Bagian judul="Percabangan & perulangan">
        <Contoh>{`if nilai >= 70:
    print("Lulus")
elif nilai >= 60:
    print("Remedial")
else:
    print("Belum lulus")

for i in range(1, 6):     # 1, 2, 3, 4, 5
    print(i)

while x > 0:
    x = x - 1`}</Contoh>
        Isi blok setelah titik dua (:) menjorok 4 spasi - tombol Tab di editor menyisipkannya.
      </Bagian>
      <Bagian judul="List & dictionary">
        <Contoh>{`data = [3, 1, 2]
data.append(5)
print(len(data), data[0], data[-1])

umur = {"Ani": 16, "Budi": 17}
umur["Citra"] = 15`}</Contoh>
        Indeks dimulai dari 0.
      </Bagian>
      <Bagian judul="Fungsi">
        <Contoh>{`def kuadrat(n):
    return n * n

print(kuadrat(4))`}</Contoh>
      </Bagian>
      <Bagian judul="Batas lab">
        Satu kali jalan maksimal 10 detik; mode langkah merekam hingga 2.000 langkah dan menghentikan program setelah 100.000
        langkah. Paket tambahan (numpy, dll.) belum bisa dipasang. Perlu internet saat lab Python pertama kali dibuka.
      </Bagian>
    </div>
  );
}
