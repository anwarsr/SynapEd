/**
 * Pemecah token pseudocode Cambridge International AS & A Level (9618).
 *
 * Mengikuti "Pseudocode Guide for Teachers" & lembar sisipan ujian 9618:
 *  - kata kunci HURUF BESAR (`IF`, `ENDWHILE`, …) dan TIDAK boleh dipakai
 *    sebagai nama. `if`/`If` sengaja DITOLAK dengan pesan yang menjelaskan,
 *    bukan diterima diam-diam — kebiasaan menulis huruf besar itu dinilai di
 *    ujian, dan nama `step`/`next` yang lolos akan membingungkan di baris lain;
 *  - penugasan `←` (juga `<-` / `<--` karena panah sulit diketik);
 *  - `//` komentar sampai akhir baris;
 *  - tanda minus `−`/`–` dan kutip `ꞌ` dari PDF panduan diterima: siswa sering
 *    menyalin contoh langsung dari sana, dan galat "karakter tidak dikenal"
 *    untuk tanda yang terlihat sama persis hanya membingungkan;
 *  - literal INTEGER `12`, REAL `3.5` (angka di kedua sisi titik),
 *    CHAR `'A'` (tepat satu karakter), STRING `"teks"`, BOOLEAN `TRUE`/`FALSE`.
 *
 * Baris baru menjadi token tersendiri: pseudocode 9618 berbasis baris.
 *
 * Modul netral; diuji `verify-pseudocode`.
 */

export class GalatPseudo extends Error {
  constructor(
    pesan: string,
    public baris: number | null,
    public jenis: string = "Galat sintaks",
    public saran: string | null = null,
  ) {
    super(pesan);
    this.name = "GalatPseudo";
  }
}

export type Token =
  | { t: "kunci"; v: string; baris: number }
  | { t: "nama"; v: string; baris: number }
  | { t: "int"; v: number; baris: number }
  | { t: "real"; v: number; baris: number }
  | { t: "char"; v: string; baris: number }
  | { t: "string"; v: string; baris: number }
  | { t: "op"; v: string; baris: number }
  | { t: "baris"; baris: number }
  | { t: "akhir"; baris: number };

export const KATA_KUNCI: ReadonlySet<string> = new Set([
  "DECLARE", "CONSTANT", "ARRAY", "OF",
  "INTEGER", "REAL", "CHAR", "STRING", "BOOLEAN", "DATE",
  "INPUT", "OUTPUT",
  "IF", "THEN", "ELSE", "ENDIF",
  "CASE", "OTHERWISE", "ENDCASE",
  "FOR", "TO", "STEP", "NEXT",
  "WHILE", "DO", "ENDWHILE",
  "REPEAT", "UNTIL",
  "PROCEDURE", "ENDPROCEDURE", "FUNCTION", "ENDFUNCTION", "RETURNS", "RETURN",
  "CALL", "BYVAL", "BYREF",
  "AND", "OR", "NOT", "MOD", "DIV", "TRUE", "FALSE",
  // Bagian panduan yang belum didukung — tetap kata kunci supaya pesan
  // galatnya jelas ("belum didukung"), bukan "nama tidak dikenal".
  "TYPE", "ENDTYPE", "OPENFILE", "READFILE", "WRITEFILE", "CLOSEFILE",
  "SEEK", "GETRECORD", "PUTRECORD", "CLASS", "ENDCLASS",
]);

const SIMBOL = ["<--", "<-", "<=", ">=", "<>", "←", "≤", "≥", "≠", "=", "<", ">", "+", "-", "−", "–", "*", "/", "&", "(", ")", "[", "]", ",", ":", "."];
const NORMAL: Record<string, string> = { "<--": "←", "<-": "←", "≤": "<=", "≥": ">=", "≠": "<>", "−": "-", "–": "-" };
const KUTIP_CHAR = new Set(["'", "‘", "’", "ꞌ"]);

export function tokenisasi(src: string): Token[] {
  const out: Token[] = [];
  let baris = 1;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") {
      out.push({ t: "baris", baris });
      baris++;
      i++;
      continue;
    }
    if (c === "\r" || c === " " || c === "\t" || c === " " || c === "\f" || c === "\v") {
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (/[0-9]/.test(c)) {
      const m = /^\d+(\.\d+)?/.exec(src.slice(i, i + 40))!;
      if (m[1]) out.push({ t: "real", v: Number(m[0]), baris });
      else if (!Number.isSafeInteger(Number(m[0]))) throw new GalatPseudo(`Angka ${m[0]} terlalu besar.`, baris);
      else out.push({ t: "int", v: Number(m[0]), baris });
      i += m[0].length;
      if (/[A-Za-z_]/.test(src[i] ?? "")) {
        throw new GalatPseudo(`"${m[0]}${src[i]}…" bukan angka atau nama yang sah - nama harus diawali huruf.`, baris);
      }
      if (src[i] === "." && !/[0-9]/.test(src[i + 1] ?? "")) {
        throw new GalatPseudo(`Angka REAL ditulis dengan angka di kedua sisi titik, mis. ${m[0]}.0`, baris);
      }
      continue;
    }
    if (c === '"' || c === "“" || c === "”") {
      let j = i + 1;
      while (j < src.length && src[j] !== "\n" && src[j] !== '"' && src[j] !== "”" && src[j] !== "“") j++;
      if (j >= src.length || src[j] === "\n") throw new GalatPseudo('Tanda kutip STRING ("…") belum ditutup di baris ini.', baris);
      out.push({ t: "string", v: src.slice(i + 1, j), baris });
      i = j + 1;
      continue;
    }
    if (KUTIP_CHAR.has(c)) {
      let j = i + 1;
      while (j < src.length && src[j] !== "\n" && !KUTIP_CHAR.has(src[j])) j++;
      if (j >= src.length || src[j] === "\n") throw new GalatPseudo("Tanda kutip CHAR ('…') belum ditutup di baris ini.", baris);
      const isi = src.slice(i + 1, j);
      if ([...isi].length !== 1) {
        throw new GalatPseudo(
          `CHAR berisi tepat satu karakter. '${isi}' berisi ${[...isi].length} - untuk teks pakai tanda kutip ganda: "${isi}"`,
          baris,
        );
      }
      out.push({ t: "char", v: isi, baris });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i, i + 200))!;
      const kata = m[0];
      if (kata.length > 64) throw new GalatPseudo("Nama terlalu panjang (maks 64 karakter).", baris);
      const besar = kata.toUpperCase();
      if (KATA_KUNCI.has(besar)) {
        if (kata !== besar) {
          throw new GalatPseudo(
            `"${kata}" adalah kata kunci ${besar}. Kata kunci ditulis HURUF BESAR dan tidak boleh dipakai sebagai nama.`,
            baris,
          );
        }
        out.push({ t: "kunci", v: kata, baris });
      } else {
        out.push({ t: "nama", v: kata, baris });
      }
      i += kata.length;
      continue;
    }
    const sim = SIMBOL.find((s) => src.startsWith(s, i));
    if (!sim) {
      const saran =
        c === "^" ? " Pangkat belum ada di 9618 - kalikan berulang, mis. x * x." :
        c === "%" ? " Sisa bagi ditulis MOD, mis. n MOD 2." :
        c === "!" ? " Gunakan NOT atau <>." : "";
      throw new GalatPseudo(`Karakter "${c}" tidak dikenal.${saran}`, baris);
    }
    out.push({ t: "op", v: NORMAL[sim] ?? sim, baris });
    i += sim.length;
  }
  out.push({ t: "akhir", baris });
  return out;
}
