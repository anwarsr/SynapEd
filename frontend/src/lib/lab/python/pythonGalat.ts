/**
 * Saran ramah berbahasa Indonesia untuk galat Python yang paling sering
 * ditemui pemula. Pesan aslinya (traceback berbahasa Inggris) TETAP
 * ditampilkan — itu yang akan mereka cari di internet dan temui di Python
 * sungguhan; saran ini hanya jembatan.
 *
 * Dicocokkan dari jenis + teks pesan CPython 3.14. Pesan yang tidak dikenali
 * mendapat saran umum per jenis, atau null.
 *
 * Modul netral; diuji `verify-kode`.
 */
import type { GalatKode } from "../kodeTypes";

type Aturan = [pola: RegExp, saran: string | ((m: RegExpMatchArray) => string)];

const ATURAN: Record<string, Aturan[]> = {
  SyntaxError: [
    [/expected ':'/, "Tambahkan titik dua (:) di akhir baris if, elif, else, for, while, def, atau class."],
    [/Maybe you meant '==' or ':=' instead of '='/, "Untuk membandingkan, pakai == (dua sama dengan). Satu = dipakai untuk mengisi variabel."],
    [/unterminated (triple-quoted )?string literal/, "Tanda kutip teks belum ditutup. Pastikan teks diapit kutip yang sama, mis. \"halo\" atau 'halo'."],
    [/'(\(|\[|\{)' was never closed/, (m) => `Kurung ${m[1]} belum ditutup. Hitung pasangan kurung di baris ini (atau baris sebelumnya).`],
    [/unmatched '(\)|\]|\})'/, (m) => `Ada kurung tutup ${m[1]} tanpa pasangan pembukanya.`],
    [/invalid character '(.)'/, (m) => `Karakter ${m[1]} tidak dikenal Python - sering terbawa saat menyalin dari dokumen. Ganti kutip miring “ ” ‘ ’ dengan " atau ', dan tanda − dengan -.`],
    [/Missing parentheses in call to '(\w+)'/, (m) => `Di Python 3, ${m[1]} adalah fungsi: tulis ${m[1]}(…).`],
    [/invalid decimal literal/, "Nama variabel tidak boleh diawali angka, dan angka desimal memakai titik (3.5), bukan koma."],
    [/cannot assign to (expression|literal|function call)/, "Sisi kiri tanda = harus sebuah nama variabel, mis. total = a + b (bukan a + b = total)."],
    [/invalid syntax/, "Ada penulisan yang tidak dikenali Python di baris ini. Periksa tanda baca, kurung, dan titik dua."],
  ],
  IndentationError: [
    [/expected an indented block/, "Baris setelah titik dua (:) harus menjorok ke dalam - tekan Tab (4 spasi) di awal barisnya."],
    [/unexpected indent/, "Baris ini menjorok padahal tidak berada di dalam blok if/for/def. Hapus spasi di awal barisnya."],
    [/unindent does not match/, "Jorokan baris ini tidak sejajar dengan blok mana pun. Samakan jumlah spasinya dengan baris di atasnya."],
  ],
  TabError: [[/./, "Tab dan spasi tercampur untuk jorokan. Pakai salah satu saja (editor ini memakai 4 spasi untuk tombol Tab)."]],
  NameError: [
    [/name '(true|false)' is not defined/, (m) => `Di Python ditulis ${m[1] === "true" ? "True" : "False"} (huruf besar di depan).`],
    [/name '(null|none|nil)' is not defined/, () => "Nilai kosong di Python ditulis None."],
    [/name '(Print|PRINT|Input|INPUT)' is not defined/, (m) => `Python membedakan huruf besar-kecil: tulis ${m[1].toLowerCase()}(…).`],
    [/name '(\w+)' is not defined/, (m) => `${m[1]} belum dibuat sebelum dipakai. Periksa ejaannya (huruf besar-kecil berpengaruh) dan pastikan diberi nilai di baris sebelumnya. Kalau maksudnya teks, apit dengan kutip: "${m[1]}".`],
  ],
  UnboundLocalError: [[/./, "Variabel ini diubah di dalam fungsi sebelum diberi nilai di fungsi itu. Kalau maksudnya variabel di luar fungsi, tulis global nama di awal fungsi - atau lebih baik, kirim lewat parameter."]],
  TypeError: [
    [
      /can only concatenate str \(not "(\w+)"\) to str/,
      (m) =>
        `Teks (str) tidak bisa langsung dijumlahkan/disambung dengan ${m[1]}. Kalau teksnya hasil input() dan maksudnya berhitung, ubah dulu ke angka: int(input()) atau float(input()). Kalau maksudnya menyambung teks, pakai str(…) atau f-string: f"Nilai: {x}".`,
    ],
    [/unsupported operand type\(s\) for [^:]+: '(int|float)' and 'str'|unsupported operand type\(s\) for [^:]+: 'str' and '(int|float)'/, "Salah satu nilainya teks (str). Hasil input() selalu teks - ubah dengan int(input()) atau float(input())."],
    [/not supported between instances of '(str|int|float)' and '(str|int|float)'/, "Membandingkan teks dengan angka. Hasil input() selalu teks - ubah dengan int(…) atau float(…) dulu."],
    [/'(\w+)' object is not callable/, (m) => `Nilai bertipe ${m[1]} dipanggil seperti fungsi. Mungkin ada variabel yang menimpa nama fungsi (mis. print = 5), atau tanda * hilang: 2(x) → 2 * x.`],
    [/missing (\d+) required positional argument/, (m) => `Fungsi dipanggil dengan argumen yang kurang ${m[1]}. Samakan jumlah argumen dengan parameter di def.`],
    [/takes (\d+) positional arguments? but (\d+) (were|was) given/, (m) => `Fungsi menerima ${m[1]} argumen, tetapi diberi ${m[2]}.`],
    [/'(\w+)' object is not subscriptable/, (m) => `Nilai bertipe ${m[1]} tidak bisa diberi indeks [ ]. Indeks hanya untuk list, str, tuple, dict.`],
    [/'(\w+)' object is not iterable/, (m) => `Nilai bertipe ${m[1]} tidak bisa diulang dengan for. Untuk mengulang n kali, pakai for i in range(n).`],
    [/'str' object does not support item assignment/, "Teks (str) tidak bisa diubah per huruf. Buat teks baru, mis. s = s[:i] + 'x' + s[i+1:], atau ubah ke list dulu."],
    [/list indices must be integers or slices, not (\w+)/, (m) => `Indeks list harus bilangan bulat, bukan ${m[1]}. ${m[1] === "str" ? "Ubah dengan int(…)." : m[1] === "float" ? "Bulatkan dengan int(…) atau pakai //." : ""}`.trim()],
  ],
  ValueError: [
    [/invalid literal for int\(\) with base 10: '(.*)'/, (m) => `"${m[1]}" bukan bilangan bulat. Periksa kotak Masukan (satu nilai per baris)${/^\s*-?\d+[.,]\d+\s*$/.test(m[1]) ? ", atau pakai float(…) untuk angka berkoma" : ""}.`],
    [/could not convert string to float: '(.*)'/, (m) => `"${m[1]}" bukan angka. Angka desimal memakai titik (3.5), bukan koma.`],
    [/not enough values to unpack/, "Jumlah variabel di kiri = lebih banyak dari jumlah nilai di kanan."],
    [/too many values to unpack/, "Jumlah nilai di kanan = lebih banyak dari jumlah variabel di kiri."],
  ],
  ZeroDivisionError: [[/./, "Pembagian dengan nol. Periksa nilai pembaginya - misalnya dengan if pembagi != 0: sebelum membagi."]],
  IndexError: [
    [/list index out of range/, "Indeks melewati isi list. Indeks dimulai dari 0, dan indeks terakhir adalah len(list) - 1."],
    [/string index out of range/, "Indeks melewati panjang teks. Indeks dimulai dari 0, dan yang terakhir adalah len(teks) - 1."],
    [/pop from empty list/, "List sudah kosong saat pop() dipanggil. Periksa dengan if daftar: lebih dulu."],
  ],
  KeyError: [[/./, "Kunci itu tidak ada di dictionary. Periksa dengan if kunci in d:, atau pakai d.get(kunci)."]],
  EOFError: [[/./, "Masukan habis: input() dipanggil lebih banyak dari jumlah baris di kotak Masukan. Tambahkan satu nilai per baris."]],
  RecursionError: [[/./, "Fungsi memanggil dirinya sendiri terus-menerus. Pastikan ada kasus dasar yang menghentikan rekursi, dan argumennya mendekati kasus itu."]],
  AttributeError: [
    [/'list' object has no attribute 'push'/, "List Python memakai append(…), bukan push(…)."],
    [/'list' object has no attribute 'length'|'str' object has no attribute 'length'/, "Panjang di Python ditulis len(x), bukan x.length."],
    [/'(\w+)' object has no attribute '(\w+)'/, (m) => `Nilai bertipe ${m[1]} tidak punya ${m[2]}. Periksa ejaan dan tipe nilainya - mungkin variabelnya belum berisi yang Anda kira.`],
  ],
  ModuleNotFoundError: [
    [/tidak tersedia di SynapLab/, "Lab Python berjalan di browser tanpa akses ke halaman maupun jaringan; modul ini sengaja dimatikan."],
    [/./, "Hanya pustaka standar Python yang tersedia (math, random, …). Paket tambahan seperti numpy belum bisa dipasang di SynapLab."],
  ],
  ImportError: [
    [/tidak tersedia di SynapLab/, "Lab Python berjalan di browser tanpa akses ke halaman maupun jaringan; modul ini sengaja dimatikan."],
  ],
  "Batas langkah": [[/./, "Kemungkinan perulangan tidak pernah berhenti - periksa kondisinya dan apakah variabelnya berubah. Langkah yang terekam masih bisa diputar."]],
  "Batas waktu": [[/./, "Program berjalan lebih dari 10 detik lalu dihentikan - biasanya perulangan while yang kondisinya tidak pernah salah. Coba Langkah demi langkah untuk menelusurinya."]],
  "Batas keluaran": [[/./, "Ada perulangan yang terus mencetak. Periksa kondisi berhentinya."]],
};

/** Saran Indonesia untuk galat Python, atau null bila tidak ada yang cocok. */
export function saranPython(g: Pick<GalatKode, "jenis" | "pesan">): string | null {
  const aturan = ATURAN[g.jenis];
  if (!aturan) return null;
  for (const [pola, saran] of aturan) {
    const m = g.pesan.match(pola);
    if (m) return typeof saran === "string" ? saran : saran(m);
  }
  return null;
}
