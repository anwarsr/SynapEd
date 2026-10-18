/**
 * Penyorot sintaks untuk editor lab kode — Python dan pseudocode 9618.
 *
 * Sengaja TOLERAN: kode yang sedang diketik hampir selalu belum sah (kutip
 * belum ditutup, kurung menggantung), jadi penyorot tidak pernah melempar dan
 * tidak memakai pengurai interpreter. Ia hanya memberi warna; yang menentukan
 * benar-salahnya program tetap interpreter.
 *
 * Hasilnya per BARIS (satu larik token per baris) supaya editor bisa
 * menggambar nomor & sorotan baris tanpa memecah ulang teks.
 *
 * Modul netral; diuji `verify-kode`.
 */
import { KATA_KUNCI } from "./pseudo/pseudoLexer";
import { FUNGSI_BAWAAN, TIPE_DASAR } from "./pseudo/pseudoParser";
import type { BahasaKode } from "./kodeUrl";

export type JenisToken = "kunci" | "tipe" | "fungsi" | "teks" | "angka" | "komentar" | "biasa";
export interface TokenSorot {
  t: JenisToken;
  v: string;
}

const PY_KUNCI = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del",
  "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal",
  "not", "or", "pass", "raise", "return", "try", "while", "with", "yield", "match", "case",
]);
const PY_BAWAAN = new Set([
  "print", "input", "int", "float", "str", "bool", "len", "range", "list", "dict", "set", "tuple", "abs", "min",
  "max", "sum", "sorted", "reversed", "enumerate", "zip", "round", "type", "isinstance", "map", "filter", "any",
  "all", "chr", "ord", "pow", "divmod", "format", "open", "super", "object", "Exception", "ValueError", "TypeError",
]);
const PS_TIPE = new Set<string>([...TIPE_DASAR, "ARRAY", "DATE"]);

/**
 * Memecah kode menjadi token berwarna per baris. Penggabungan semua `v`
 * dalam satu baris = baris aslinya, PERSIS (diuji) — kalau tidak, teks
 * berwarna di belakang textarea bergeser dari teks yang diketik.
 */
export function sorotKode(src: string, bahasa: BahasaKode): TokenSorot[][] {
  const baris = src.split("\n");
  const hasil: TokenSorot[][] = [];
  // Python: string tiga-kutip yang masih terbuka dari baris sebelumnya.
  let terbuka: string | null = null;

  for (const b of baris) {
    const out: TokenSorot[] = [];
    const dorong = (t: JenisToken, v: string) => {
      if (!v) return;
      const akhir = out[out.length - 1];
      if (akhir && akhir.t === t) akhir.v += v;
      else out.push({ t, v });
    };
    let i = 0;

    if (terbuka) {
      const j = b.indexOf(terbuka);
      if (j === -1) {
        dorong("teks", b);
        hasil.push(out);
        continue;
      }
      dorong("teks", b.slice(0, j + 3));
      i = j + 3;
      terbuka = null;
    }

    while (i < b.length) {
      const c = b[i];
      const sisa = b.slice(i);
      // Komentar
      if ((bahasa === "python" && c === "#") || (bahasa === "pseudocode" && sisa.startsWith("//"))) {
        dorong("komentar", sisa);
        break;
      }
      // Teks
      if (bahasa === "python") {
        const m = /^([rRbBfFuU]{0,2})('''|"""|'|")/.exec(sisa);
        if (m && (m[1] === "" || /^[rRbBfFuU]{1,2}$/.test(m[1]))) {
          const kutip = m[2];
          const mulai = m[0].length;
          if (kutip.length === 3) {
            const j = sisa.indexOf(kutip, mulai);
            if (j === -1) {
              dorong("teks", sisa);
              terbuka = kutip;
              break;
            }
            dorong("teks", sisa.slice(0, j + 3));
            i += j + 3;
            continue;
          }
          let j = mulai;
          while (j < sisa.length && sisa[j] !== kutip) j += sisa[j] === "\\" ? 2 : 1;
          const panjang = Math.min(sisa.length, j + 1);
          dorong("teks", sisa.slice(0, panjang));
          i += panjang;
          continue;
        }
      } else if (c === '"' || c === "'" || c === "“" || c === "ꞌ" || c === "‘") {
        const tutup = c === '"' || c === "“" ? /["”“]/ : /['ꞌ’‘]/;
        let j = 1;
        while (j < sisa.length && !tutup.test(sisa[j])) j++;
        const panjang = Math.min(sisa.length, j + 1);
        dorong("teks", sisa.slice(0, panjang));
        i += panjang;
        continue;
      }
      // Angka (tanpa tanda; minus adalah operator)
      if (/[0-9]/.test(c)) {
        const m = /^(0[xXbBoO][0-9a-fA-F_]+|\d[\d_]*(\.\d*)?([eE][+-]?\d+)?j?)/.exec(sisa)!;
        dorong("angka", m[0]);
        i += m[0].length;
        continue;
      }
      // Nama / kata kunci
      if (/[A-Za-z_]/.test(c)) {
        const kata = /^[A-Za-z_][A-Za-z0-9_]*/.exec(sisa)![0];
        let t: JenisToken = "biasa";
        if (bahasa === "python") {
          if (PY_KUNCI.has(kata)) t = "kunci";
          else if (PY_BAWAAN.has(kata) && b[i + kata.length] === "(") t = "fungsi";
        } else if (PS_TIPE.has(kata)) t = "tipe";
        else if (KATA_KUNCI.has(kata)) t = "kunci";
        else if (FUNGSI_BAWAAN.has(kata.toUpperCase()) && /^\s*\(/.test(b.slice(i + kata.length))) t = "fungsi";
        dorong(t, kata);
        i += kata.length;
        continue;
      }
      // Panah penugasan pseudocode ikut berwarna kata kunci: ia penanda pernyataan.
      if (bahasa === "pseudocode" && (c === "←" || sisa.startsWith("<-"))) {
        const v = c === "←" ? "←" : sisa.startsWith("<--") ? "<--" : "<-";
        dorong("kunci", v);
        i += v.length;
        continue;
      }
      dorong("biasa", c);
      i++;
    }
    hasil.push(out);
  }
  return hasil;
}
