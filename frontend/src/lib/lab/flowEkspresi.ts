/**
 * Bahasa ekspresi kecil untuk menjalankan flowchart: penugasan di Proses,
 * kondisi di Keputusan, daftar keluaran di Output.
 *
 * Diurai sendiri (Pratt parser) — TIDAK PERNAH lewat `eval`/`Function`.
 * Flowchart bisa dibuka dari tautan siapa saja; `eval` atas teks di dalamnya
 * berarti menjalankan kode orang lain di browser pembuka tautan. Variabel
 * disimpan di `Map`, bukan objek biasa, supaya nama seperti `__proto__` atau
 * `constructor` hanyalah nama variabel, bukan pintu ke prototipe.
 *
 * Sintaks mengikuti pseudocode yang lazim di kelas:
 *  - penugasan: `x = 5`, `x ← x + 1`, `x <- 2`, `x := 3`, `x += 1`, `x++`
 *  - di Keputusan, `=` berarti SAMA DENGAN (`n mod 2 = 0`), sama seperti `==`
 *  - `mod`/`%` sisa bagi, `div` bagi bulat, `^` pangkat
 *  - `dan`/`and`/`&&`, `atau`/`or`/`||`, `tidak`/`not`/`!`
 *  - `benar`/`salah` (juga true/false), teks dalam "kutip"
 *  - fungsi: akar, abs, bulat, bawah, atas, min, max, panjang
 *
 * Modul netral; diuji `verify-flowchart`.
 */

export type Nilai = number | string | boolean;
export type Variabel = Map<string, Nilai>;

export class GalatEkspresi extends Error {
  constructor(pesan: string) {
    super(pesan);
    this.name = "GalatEkspresi";
  }
}

// ── Tokenizer ───────────────────────────────────────────────────────────

type Token =
  | { t: "angka"; v: number }
  | { t: "teks"; v: string }
  | { t: "nama"; v: string }
  | { t: "op"; v: string }
  | { t: "akhir" };

const KATA_OP: Record<string, string> = {
  mod: "%",
  div: "div",
  dan: "&&",
  and: "&&",
  atau: "||",
  or: "||",
  tidak: "!",
  not: "!",
};

const OP_SIMBOL = ["<=", ">=", "==", "!=", "<>", "&&", "||", "≤", "≥", "≠", "+", "-", "*", "/", "%", "^", "(", ")", ",", "=", "<", ">", "!", "×", "÷"];

function tokenisasi(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      const m = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(src.slice(i))!;
      out.push({ t: "angka", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (c === '"' || c === "'" || c === "“" || c === "”") {
      const tutup = c === "“" ? "”" : c;
      const j = src.indexOf(tutup, i + 1);
      if (j === -1) throw new GalatEkspresi("Tanda kutip teks belum ditutup.");
      out.push({ t: "teks", v: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      const kata = m[0];
      const op = KATA_OP[kata.toLowerCase()];
      out.push(op ? { t: "op", v: op } : { t: "nama", v: kata });
      i += kata.length;
      continue;
    }
    const sim = OP_SIMBOL.find((o) => src.startsWith(o, i));
    if (!sim) throw new GalatEkspresi(`Karakter "${c}" tidak dikenal.`);
    const normal: Record<string, string> = { "≤": "<=", "≥": ">=", "≠": "!=", "<>": "!=", "==": "=", "×": "*", "÷": "/" };
    out.push({ t: "op", v: normal[sim] ?? sim });
    i += sim.length;
  }
  out.push({ t: "akhir" });
  return out;
}

// ── Pohon ekspresi ──────────────────────────────────────────────────────

type Simpul =
  | { k: "nilai"; v: Nilai }
  | { k: "var"; nama: string }
  | { k: "uner"; op: string; a: Simpul }
  | { k: "biner"; op: string; a: Simpul; b: Simpul }
  | { k: "fungsi"; nama: string; arg: Simpul[] };

const KEKUATAN: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "=": 3,
  "!=": 3,
  "<": 4,
  ">": 4,
  "<=": 4,
  ">=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
  div: 6,
  "^": 8,
};

const MAKS_KEDALAMAN = 60;

class Pengurai {
  private p = 0;
  private dalam = 0;
  constructor(private readonly tk: Token[]) {}

  private lihat(): Token {
    return this.tk[this.p];
  }
  private ambil(): Token {
    return this.tk[this.p++];
  }
  private opIni(v: string): boolean {
    const t = this.lihat();
    return t.t === "op" && t.v === v;
  }

  urai(): Simpul {
    const s = this.ekspresi(0);
    const t = this.lihat();
    if (t.t !== "akhir") throw new GalatEkspresi(`Ada sisa yang tidak dipahami: "${tampilToken(t)}".`);
    return s;
  }

  private ekspresi(minKuat: number): Simpul {
    if (++this.dalam > MAKS_KEDALAMAN) throw new GalatEkspresi("Ekspresi terlalu bersarang.");
    let kiri = this.awalan();
    for (;;) {
      const t = this.lihat();
      if (t.t !== "op") break;
      const kuat = KEKUATAN[t.v];
      if (kuat === undefined || kuat < minKuat) break;
      this.ambil();
      // ^ asosiatif ke kanan; selebihnya ke kiri.
      const kanan = this.ekspresi(t.v === "^" ? kuat : kuat + 1);
      kiri = { k: "biner", op: t.v, a: kiri, b: kanan };
    }
    this.dalam--;
    return kiri;
  }

  private awalan(): Simpul {
    const t = this.ambil();
    if (t.t === "angka") return { k: "nilai", v: t.v };
    if (t.t === "teks") return { k: "nilai", v: t.v };
    if (t.t === "op" && (t.v === "-" || t.v === "+")) return { k: "uner", op: t.v, a: this.ekspresi(7) };
    if (t.t === "op" && t.v === "!") return { k: "uner", op: "!", a: this.ekspresi(3) };
    if (t.t === "op" && t.v === "(") {
      const s = this.ekspresi(0);
      if (!this.opIni(")")) throw new GalatEkspresi("Kurung tutup \")\" kurang.");
      this.ambil();
      return s;
    }
    if (t.t === "nama") {
      const kecil = t.v.toLowerCase();
      if (kecil === "benar" || kecil === "true") return { k: "nilai", v: true };
      if (kecil === "salah" || kecil === "false") return { k: "nilai", v: false };
      if (this.opIni("(")) {
        this.ambil();
        const arg: Simpul[] = [];
        if (!this.opIni(")")) {
          for (;;) {
            arg.push(this.ekspresi(0));
            if (this.opIni(",")) {
              this.ambil();
              continue;
            }
            break;
          }
        }
        if (!this.opIni(")")) throw new GalatEkspresi(`Kurung tutup fungsi ${t.v}( kurang.`);
        this.ambil();
        return { k: "fungsi", nama: kecil, arg };
      }
      return { k: "var", nama: t.v };
    }
    if (t.t === "akhir") throw new GalatEkspresi("Ekspresi tidak lengkap.");
    throw new GalatEkspresi(`"${tampilToken(t)}" tidak boleh berada di sini.`);
  }
}

function tampilToken(t: Token): string {
  return t.t === "akhir" ? "akhir" : String(t.v);
}

export function uraiEkspresi(src: string): Simpul {
  if (!src.trim()) throw new GalatEkspresi("Ekspresi kosong.");
  return new Pengurai(tokenisasi(src)).urai();
}

// ── Evaluasi ────────────────────────────────────────────────────────────

export function namaJenis(v: Nilai): string {
  return typeof v === "number" ? "angka" : typeof v === "string" ? "teks" : "benar/salah";
}

function angka(v: Nilai, op: string): number {
  if (typeof v !== "number") throw new GalatEkspresi(`Operasi "${op}" butuh angka, bukan ${namaJenis(v)}.`);
  return v;
}

function hasilAngka(n: number): number {
  if (!Number.isFinite(n)) throw new GalatEkspresi("Hasil perhitungan tidak terhingga atau bukan angka.");
  return n;
}

const FUNGSI: Record<string, (a: Nilai[]) => Nilai> = {
  akar: ([x]) => {
    const n = angka(x, "akar");
    if (n < 0) throw new GalatEkspresi("Akar dari bilangan negatif.");
    return Math.sqrt(n);
  },
  abs: ([x]) => Math.abs(angka(x, "abs")),
  bulat: ([x]) => Math.round(angka(x, "bulat")),
  bawah: ([x]) => Math.floor(angka(x, "bawah")),
  atas: ([x]) => Math.ceil(angka(x, "atas")),
  min: (a) => Math.min(...a.map((x) => angka(x, "min"))),
  max: (a) => Math.max(...a.map((x) => angka(x, "max"))),
  panjang: ([x]) => {
    if (typeof x !== "string") throw new GalatEkspresi("panjang() butuh teks.");
    return [...x].length;
  },
};
const ALIAS: Record<string, string> = { sqrt: "akar", mutlak: "abs", round: "bulat", floor: "bawah", ceil: "atas", len: "panjang" };
const JUMLAH_ARG: Record<string, [number, number]> = {
  akar: [1, 1],
  abs: [1, 1],
  bulat: [1, 1],
  bawah: [1, 1],
  atas: [1, 1],
  min: [1, 20],
  max: [1, 20],
  panjang: [1, 1],
};

function bandingkan(a: Nilai, b: Nilai, op: string): boolean {
  if (typeof a !== typeof b) {
    if (op === "=") return false;
    if (op === "!=") return true;
    throw new GalatEkspresi(`Tidak bisa membandingkan ${namaJenis(a)} dengan ${namaJenis(b)}.`);
  }
  if (typeof a === "boolean" && op !== "=" && op !== "!=") throw new GalatEkspresi("Benar/salah hanya bisa dibandingkan dengan = atau ≠.");
  switch (op) {
    case "=":
      return a === b;
    case "!=":
      return a !== b;
    case "<":
      return a < b;
    case ">":
      return a > b;
    case "<=":
      return a <= b;
    default:
      return a >= b;
  }
}

function hitung(s: Simpul, vars: Variabel): Nilai {
  switch (s.k) {
    case "nilai":
      return s.v;
    case "var": {
      if (!vars.has(s.nama)) throw new GalatEkspresi(`Variabel "${s.nama}" belum diberi nilai.`);
      return vars.get(s.nama)!;
    }
    case "uner": {
      const a = hitung(s.a, vars);
      if (s.op === "!") {
        if (typeof a !== "boolean") throw new GalatEkspresi(`"tidak" butuh benar/salah, bukan ${namaJenis(a)}.`);
        return !a;
      }
      const n = angka(a, s.op);
      return s.op === "-" ? -n : n;
    }
    case "fungsi": {
      const nama = ALIAS[s.nama] ?? s.nama;
      const f = FUNGSI[nama];
      if (!f) throw new GalatEkspresi(`Fungsi "${s.nama}" tidak dikenal.`);
      const [min, maks] = JUMLAH_ARG[nama];
      if (s.arg.length < min || s.arg.length > maks) throw new GalatEkspresi(`Jumlah isian fungsi ${s.nama}() tidak tepat.`);
      const hasil = f(s.arg.map((x) => hitung(x, vars)));
      return typeof hasil === "number" ? hasilAngka(hasil) : hasil;
    }
    case "biner": {
      // Hubung-singkat: kanan tidak dihitung bila kiri sudah menentukan.
      if (s.op === "&&" || s.op === "||") {
        const a = hitung(s.a, vars);
        if (typeof a !== "boolean") throw new GalatEkspresi(`"${s.op === "&&" ? "dan" : "atau"}" butuh benar/salah, bukan ${namaJenis(a)}.`);
        if (s.op === "&&" ? !a : a) return a;
        const b = hitung(s.b, vars);
        if (typeof b !== "boolean") throw new GalatEkspresi(`"${s.op === "&&" ? "dan" : "atau"}" butuh benar/salah, bukan ${namaJenis(b)}.`);
        return b;
      }
      const a = hitung(s.a, vars);
      const b = hitung(s.b, vars);
      if (["=", "!=", "<", ">", "<=", ">="].includes(s.op)) return bandingkan(a, b, s.op);
      if (s.op === "+" && (typeof a === "string" || typeof b === "string")) return `${tampilNilai(a)}${tampilNilai(b)}`;
      const x = angka(a, s.op);
      const y = angka(b, s.op);
      switch (s.op) {
        case "+":
          return hasilAngka(x + y);
        case "-":
          return hasilAngka(x - y);
        case "*":
          return hasilAngka(x * y);
        case "/":
          if (y === 0) throw new GalatEkspresi("Pembagian dengan nol.");
          return hasilAngka(x / y);
        case "%":
          if (y === 0) throw new GalatEkspresi("Sisa bagi (mod) dengan nol.");
          return hasilAngka(x % y);
        case "div":
          if (y === 0) throw new GalatEkspresi("Pembagian (div) dengan nol.");
          return hasilAngka(Math.trunc(x / y));
        case "^":
          return hasilAngka(x ** y);
      }
      throw new GalatEkspresi(`Operator "${s.op}" tidak dikenal.`);
    }
  }
}

export function evaluasi(src: string, vars: Variabel): Nilai {
  return hitung(uraiEkspresi(src), vars);
}

/** Kondisi Keputusan: tanda tanya di ujung dibuang; hasilnya WAJIB benar/salah. */
export function evaluasiKondisi(src: string, vars: Variabel): boolean {
  const bersih = src.trim().replace(/\?+\s*$/, "");
  const v = evaluasi(bersih, vars);
  if (typeof v !== "boolean") throw new GalatEkspresi(`Kondisi harus menghasilkan benar/salah, bukan ${namaJenis(v)}.`);
  return v;
}

// ── Pernyataan ──────────────────────────────────────────────────────────

const RE_TAMBAH = /^([A-Za-z_][A-Za-z0-9_]*)\s*(\+\+|--)$/;
const RE_TUGAS = /^([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\*=|\/=|:=|←|<-|=(?!=))\s*(.+)$/;

/** Teks Proses dipecah per baris atau `;`. Baris kosong diabaikan. */
export function pecahPernyataan(teks: string): string[] {
  return teks
    .split(/[\n;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Apakah teks sebuah pernyataan penugasan yang sah (untuk menentukan subproses bisa dijalankan). */
export function adalahPenugasan(baris: string): boolean {
  return RE_TAMBAH.test(baris) || RE_TUGAS.test(baris);
}

/**
 * Menjalankan satu pernyataan penugasan. Mengembalikan nama & nilai baru
 * supaya mesin jalan bisa menceritakannya.
 */
export function jalankanPenugasan(baris: string, vars: Variabel): { nama: string; nilai: Nilai } {
  const t = RE_TAMBAH.exec(baris);
  if (t) {
    const lama = vars.get(t[1]);
    if (lama === undefined) throw new GalatEkspresi(`Variabel "${t[1]}" belum diberi nilai.`);
    const n = hasilAngka(angka(lama, t[2]) + (t[2] === "++" ? 1 : -1));
    vars.set(t[1], n);
    return { nama: t[1], nilai: n };
  }
  const m = RE_TUGAS.exec(baris);
  if (!m) throw new GalatEkspresi(`"${baris}" bukan penugasan. Tulis seperti: x = x + 1`);
  const [, nama, op, kanan] = m;
  let nilai = evaluasi(kanan, vars);
  if (op.length === 2 && op.endsWith("=") && op !== ":=") {
    const lama = vars.get(nama);
    if (lama === undefined) throw new GalatEkspresi(`Variabel "${nama}" belum diberi nilai.`);
    const tanda = op[0];
    if (tanda === "+" && (typeof lama === "string" || typeof nilai === "string")) nilai = `${tampilNilai(lama)}${tampilNilai(nilai)}`;
    else {
      const a = angka(lama, tanda);
      const b = angka(nilai, tanda);
      if (tanda === "/" && b === 0) throw new GalatEkspresi("Pembagian dengan nol.");
      nilai = hasilAngka(tanda === "+" ? a + b : tanda === "-" ? a - b : tanda === "*" ? a * b : a / b);
    }
  }
  vars.set(nama, nilai);
  return { nama, nilai };
}

// ── Input / Output ──────────────────────────────────────────────────────

const RE_INPUT = /^(baca|input|masukkan|masukan|read|terima|ambil)\b\s*(.*)$/i;
const RE_OUTPUT = /^(tampilkan|cetak|tulis|output|print|keluarkan|display)\b\s*(.*)$/i;

export type PerintahIo = { jenis: "input"; nama: string[] } | { jenis: "output"; ekspresi: string[] };

/** Mengenali teks simbol Input/Output: "Baca a, b" atau "Tampilkan "Luas =", luas". */
export function uraiIo(teks: string): PerintahIo {
  const bersih = teks.trim().replace(/\s+/g, " ");
  const i = RE_INPUT.exec(bersih);
  if (i) {
    const nama = i[2].split(/\s*,\s*|\s+dan\s+|\s+/i).filter(Boolean);
    if (nama.length === 0) throw new GalatEkspresi("Sebutkan variabel yang dibaca, mis. Baca n");
    for (const n of nama) if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) throw new GalatEkspresi(`"${n}" bukan nama variabel yang sah.`);
    return { jenis: "input", nama };
  }
  const o = RE_OUTPUT.exec(bersih);
  if (o) {
    const ekspresi = pecahKoma(o[2]);
    if (ekspresi.length === 0) throw new GalatEkspresi("Sebutkan yang ditampilkan, mis. Tampilkan total");
    return { jenis: "output", ekspresi };
  }
  throw new GalatEkspresi('Awali dengan "Baca …" untuk input atau "Tampilkan …" untuk output.');
}

/** Memecah daftar di koma TINGKAT ATAS (koma di dalam kutip/kurung dibiarkan). */
function pecahKoma(s: string): string[] {
  const out: string[] = [];
  let dalamKurung = 0;
  let kutip: string | null = null;
  let awal = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (kutip) {
      if (c === kutip || (kutip === "“" && c === "”")) kutip = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "“") kutip = c;
    else if (c === "(") dalamKurung++;
    else if (c === ")") dalamKurung--;
    else if (c === "," && dalamKurung === 0) {
      out.push(s.slice(awal, i).trim());
      awal = i + 1;
    }
  }
  out.push(s.slice(awal).trim());
  return out.filter(Boolean);
}

/** Teks masukan pengguna → nilai: angka (titik ATAU koma desimal), benar/salah, atau teks. */
export function nilaiMasukan(teks: string): Nilai {
  const t = teks.trim();
  if (/^-?\d+([.,]\d+)?$/.test(t)) return Number(t.replace(",", "."));
  if (/^(benar|true)$/i.test(t)) return true;
  if (/^(salah|false)$/i.test(t)) return false;
  return t;
}

export function tampilNilai(v: Nilai): string {
  if (typeof v === "boolean") return v ? "benar" : "salah";
  if (typeof v === "number") return String(Number(v.toPrecision(12)));
  return v;
}
