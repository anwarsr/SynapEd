/**
 * Pengurai pseudocode 9618 → pohon sintaks bernomor baris.
 *
 * Cakupan (lihat panduan di lab): DECLARE/CONSTANT, ARRAY 1D & 2D, ←, INPUT,
 * OUTPUT, IF…THEN…ELSE…ENDIF, CASE OF…OTHERWISE…ENDCASE, FOR…TO…STEP…NEXT,
 * WHILE…ENDWHILE, REPEAT…UNTIL, PROCEDURE/CALL (BYVAL/BYREF),
 * FUNCTION…RETURNS…RETURN…ENDFUNCTION. Belum: TYPE, berkas, OOP.
 *
 * Kesalahan yang paling sering ditulis siswa (PRINT, `=` untuk penugasan,
 * ELSEIF, END IF, ENDFOR) dijawab dengan pesan yang menyebut bentuk 9618
 * yang benar — pengurai ini juga alat belajar, bukan sekadar penolak.
 *
 * Modul netral; diuji `verify-pseudocode`.
 */
import { GalatPseudo, tokenisasi, type Token } from "./pseudoLexer";

export type TipeDasar = "INTEGER" | "REAL" | "CHAR" | "STRING" | "BOOLEAN";
export const TIPE_DASAR: readonly TipeDasar[] = ["INTEGER", "REAL", "CHAR", "STRING", "BOOLEAN"];

export type Tipe =
  | { k: "dasar"; t: TipeDasar }
  /** `batas` null = parameter `ARRAY OF T` (batas mengikuti argumen). */
  | { k: "array"; t: TipeDasar; batas: [Ekspr, Ekspr][] | null };

export type Ekspr =
  | { k: "int"; v: number; baris: number }
  | { k: "real"; v: number; baris: number }
  | { k: "char"; v: string; baris: number }
  | { k: "string"; v: string; baris: number }
  | { k: "bool"; v: boolean; baris: number }
  | { k: "nama"; nama: string; baris: number }
  | { k: "indeks"; nama: string; indeks: Ekspr[]; baris: number }
  | { k: "panggil"; nama: string; arg: Ekspr[]; baris: number }
  | { k: "uner"; op: "-" | "NOT"; a: Ekspr; baris: number }
  | { k: "biner"; op: string; a: Ekspr; b: Ekspr; baris: number };

export type Target = { k: "nama"; nama: string; baris: number } | { k: "indeks"; nama: string; indeks: Ekspr[]; baris: number };

export interface LabelCase {
  dari: Ekspr;
  /** null = satu nilai; ada = rentang inklusif `dari TO sampai`. */
  sampai: Ekspr | null;
}

export type Pernyataan =
  | { k: "declare"; nama: string[]; tipe: Tipe; baris: number }
  | { k: "constant"; nama: string; nilai: Ekspr; baris: number }
  | { k: "assign"; target: Target; nilai: Ekspr; baris: number }
  | { k: "input"; target: Target; baris: number }
  | { k: "output"; isi: Ekspr[]; baris: number }
  | { k: "if"; kondisi: Ekspr; maka: Pernyataan[]; lain: Pernyataan[] | null; baris: number }
  | { k: "case"; subjek: Ekspr; cabang: { label: LabelCase[]; isi: Pernyataan[]; baris: number }[]; lain: Pernyataan[] | null; baris: number }
  | { k: "for"; nama: string; dari: Ekspr; sampai: Ekspr; langkah: Ekspr | null; isi: Pernyataan[]; baris: number; barisNext: number }
  | { k: "while"; kondisi: Ekspr; isi: Pernyataan[]; baris: number }
  | { k: "repeat"; isi: Pernyataan[]; kondisi: Ekspr; baris: number; barisUntil: number }
  | { k: "call"; nama: string; arg: Ekspr[]; baris: number }
  | { k: "return"; nilai: Ekspr; baris: number };

export interface Parameter {
  nama: string;
  tipe: Tipe;
  byref: boolean;
}

export interface Subrutin {
  jenis: "procedure" | "function";
  nama: string;
  param: Parameter[];
  /** Hanya FUNCTION. */
  hasil: TipeDasar | null;
  isi: Pernyataan[];
  baris: number;
  barisAkhir: number;
}

export interface Program {
  utama: Pernyataan[];
  /** Kunci = nama HURUF BESAR (nama 9618 tidak membedakan besar-kecil). */
  subrutin: Map<string, Subrutin>;
}

/** Fungsi bawaan — nama yang tidak boleh dipakai ulang untuk variabel/subrutin. */
export const FUNGSI_BAWAAN: ReadonlySet<string> = new Set([
  "LENGTH", "LEFT", "RIGHT", "MID", "TO_UPPER", "TO_LOWER", "UCASE", "LCASE",
  "NUM_TO_STR", "STR_TO_NUM", "IS_NUM", "ASC", "CHR", "INT", "RAND",
  "DAY", "MONTH", "YEAR", "DAYINDEX", "SETDATE", "TODAY", "EOF",
]);

const BELUM_DIDUKUNG: Record<string, string> = {
  TYPE: "Tipe bentukan (TYPE … ENDTYPE) belum didukung di SynapLab.",
  OPENFILE: "Operasi berkas belum didukung di SynapLab - pakai INPUT dan OUTPUT.",
  READFILE: "Operasi berkas belum didukung di SynapLab - pakai INPUT dan OUTPUT.",
  WRITEFILE: "Operasi berkas belum didukung di SynapLab - pakai INPUT dan OUTPUT.",
  CLOSEFILE: "Operasi berkas belum didukung di SynapLab - pakai INPUT dan OUTPUT.",
  SEEK: "Operasi berkas belum didukung di SynapLab.",
  GETRECORD: "Operasi berkas belum didukung di SynapLab.",
  PUTRECORD: "Operasi berkas belum didukung di SynapLab.",
  CLASS: "Kelas (OOP) belum didukung di SynapLab.",
};

/** Petunjuk untuk nama yang salah dipakai sebagai perintah di awal baris. */
const PETUNJUK_NAMA: Record<string, string> = {
  PRINT: "Untuk menampilkan, 9618 memakai OUTPUT, bukan PRINT.",
  WRITE: "Untuk menampilkan, 9618 memakai OUTPUT.",
  DISPLAY: "Untuk menampilkan, 9618 memakai OUTPUT.",
  READ: "Untuk membaca masukan, 9618 memakai INPUT.",
  GET: "Untuk membaca masukan, 9618 memakai INPUT.",
  ELSEIF: "9618 tidak punya ELSEIF. Tulis ELSE, lalu IF baru di dalamnya yang ditutup ENDIF sendiri.",
  ELIF: "9618 tidak punya ELIF. Tulis ELSE, lalu IF baru di dalamnya yang ditutup ENDIF sendiri.",
  END: "Penutup ditulis satu kata: ENDIF, ENDWHILE, ENDCASE, ENDPROCEDURE, ENDFUNCTION.",
  ENDFOR: "FOR ditutup dengan NEXT, mis. NEXT i.",
  WEND: "WHILE ditutup dengan ENDWHILE.",
  VAR: "Variabel dideklarasikan dengan DECLARE nama : TIPE.",
  LET: "Penugasan ditulis nama ← nilai (atau nama <- nilai), tanpa LET.",
  SET: "Penugasan ditulis nama ← nilai (atau nama <- nilai), tanpa SET.",
};

const AWAL_PERNYATAAN = new Set([
  "DECLARE", "CONSTANT", "INPUT", "OUTPUT", "IF", "CASE", "FOR", "WHILE", "REPEAT", "CALL", "RETURN", "PROCEDURE", "FUNCTION",
  ...Object.keys(BELUM_DIDUKUNG),
]);

const KEKUATAN: Record<string, number> = {
  OR: 1,
  AND: 2,
  "=": 4, "<>": 4, "<": 4, ">": 4, "<=": 4, ">=": 4,
  "+": 5, "-": 5, "&": 5,
  "*": 6, "/": 6, DIV: 6, MOD: 6,
};

const MAKS_KEDALAMAN = 100;

function deskripsi(tok: Token): string {
  switch (tok.t) {
    case "baris": return "akhir baris";
    case "akhir": return "akhir program";
    case "string": return `"${tok.v}"`;
    case "char": return `'${tok.v}'`;
    case "int":
    case "real": return String(tok.v);
    default: return tok.v;
  }
}

class Pengurai {
  private i = 0;
  private dalam = 0;
  private subrutin = new Map<string, Subrutin>();
  /** Subrutin yang sedang diurai (untuk memeriksa RETURN). */
  private sekarang: Subrutin | null = null;

  constructor(private tok: Token[]) {}

  private lihat(geser = 0): Token {
    return this.tok[Math.min(this.i + geser, this.tok.length - 1)];
  }
  private maju(): Token {
    const t = this.tok[this.i];
    if (this.i < this.tok.length - 1) this.i++;
    return t;
  }
  private adalahKunci(v: string, geser = 0): boolean {
    const t = this.lihat(geser);
    return t.t === "kunci" && t.v === v;
  }
  private adalahOp(v: string, geser = 0): boolean {
    const t = this.lihat(geser);
    return t.t === "op" && t.v === v;
  }
  private galat(pesan: string, tok: Token = this.lihat()): never {
    throw new GalatPseudo(pesan, tok.baris);
  }
  private harapKunci(v: string, konteks: string): Token {
    if (this.adalahKunci(v)) return this.maju();
    const t = this.lihat();
    this.galat(`${konteks}: seharusnya ${v}, tertulis ${deskripsi(t)}.`, t);
  }
  private harapOp(v: string, konteks: string): Token {
    if (this.adalahOp(v)) return this.maju();
    const t = this.lihat();
    this.galat(`${konteks}: seharusnya "${v}", tertulis ${deskripsi(t)}.`, t);
  }
  private harapNama(konteks: string, namaBaru = false): string {
    const t = this.lihat();
    if (t.t === "nama") {
      if (namaBaru && FUNGSI_BAWAAN.has(t.v.toUpperCase())) this.galat(`${t.v} adalah nama fungsi bawaan; pilih nama lain.`, t);
      this.maju();
      return t.v;
    }
    if (t.t === "kunci") this.galat(`${konteks}: ${t.v} adalah kata kunci dan tidak bisa dipakai sebagai nama.`, t);
    this.galat(`${konteks}: seharusnya sebuah nama, tertulis ${deskripsi(t)}.`, t);
  }
  private lewatiBaris() {
    while (this.lihat().t === "baris") this.maju();
  }
  /** Setelah satu pernyataan: harus akhir baris, akhir program, atau penutup blok. */
  private akhiriPernyataan(penutup: ReadonlySet<string>) {
    const t = this.lihat();
    if (t.t === "baris" || t.t === "akhir") return;
    if (t.t === "kunci" && penutup.has(t.v)) return;
    this.galat(`Ada sisa teks setelah pernyataan: ${deskripsi(t)}. Satu pernyataan per baris.`, t);
  }

  urai(): Program {
    const utama = this.blok(new Set(), true);
    if (this.lihat().t !== "akhir") {
      const t = this.lihat();
      this.galat(`${deskripsi(t)} muncul tanpa pembuka yang cocok.`, t);
    }
    return { utama, subrutin: this.subrutin };
  }

  /** Membaca pernyataan sampai menemukan salah satu kata kunci `penutup` (tidak dikonsumsi). */
  private blok(penutup: ReadonlySet<string>, puncak = false): Pernyataan[] {
    const isi: Pernyataan[] = [];
    for (;;) {
      this.lewatiBaris();
      const t = this.lihat();
      if (t.t === "akhir") return isi;
      if (t.t === "kunci" && penutup.has(t.v)) return isi;
      if (t.t === "kunci" && (t.v === "PROCEDURE" || t.v === "FUNCTION")) {
        if (!puncak) this.galat(`${t.v} harus ditulis di tingkat teratas program, tidak di dalam blok atau subrutin lain.`, t);
        this.subrutinBaru();
        continue;
      }
      if (puncak && t.t === "kunci" && PENUTUP_YATIM.has(t.v)) {
        this.galat(`${t.v} muncul tanpa pembuka yang cocok.`, t);
      }
      isi.push(this.pernyataan(penutup));
      this.akhiriPernyataan(penutup);
    }
  }

  private masuk(tok: Token) {
    if (++this.dalam > MAKS_KEDALAMAN) this.galat("Blok bersarang terlalu dalam.", tok);
  }

  private pernyataan(penutup: ReadonlySet<string>): Pernyataan {
    const t = this.lihat();
    const baris = t.baris;
    if (t.t === "nama") {
      const besar = t.v.toUpperCase();
      // `x = 5` atau `x(…)`: tebak maksudnya sebelum memberi galat umum.
      if (this.adalahOp("=", 1)) this.galat(`Penugasan ditulis ${t.v} ← nilai (atau ${t.v} <- nilai). Tanda = dipakai untuk membandingkan.`);
      if (PETUNJUK_NAMA[besar] && !this.adalahOp("←", 1) && !this.adalahOp("[", 1)) this.galat(PETUNJUK_NAMA[besar]);
      if (this.adalahOp("(", 1)) this.galat(`Untuk menjalankan prosedur tulis CALL ${t.v}(…). Fungsi dipakai di dalam ekspresi, mis. x ← ${t.v}(…).`);
      const target = this.target("Penugasan");
      if (!this.adalahOp("←")) {
        if (this.adalahOp("=")) this.galat(`Penugasan ditulis ${t.v} ← nilai (atau <-). Tanda = dipakai untuk membandingkan.`);
        this.galat(`Baris ini tidak dikenali. Penugasan ditulis ${t.v} ← nilai.`);
      }
      this.maju();
      return { k: "assign", target, nilai: this.ekspr(), baris };
    }
    if (t.t !== "kunci") this.galat(`Baris ini tidak dikenali: diawali ${deskripsi(t)}.`, t);
    if (BELUM_DIDUKUNG[t.v]) this.galat(BELUM_DIDUKUNG[t.v], t);

    switch (t.v) {
      case "DECLARE": {
        this.maju();
        const nama = [this.harapNama("DECLARE", true)];
        while (this.adalahOp(",")) {
          this.maju();
          nama.push(this.harapNama("DECLARE", true));
        }
        this.harapOp(":", "DECLARE nama : TIPE");
        return { k: "declare", nama, tipe: this.tipe(false), baris };
      }
      case "CONSTANT": {
        this.maju();
        const nama = this.harapNama("CONSTANT", true);
        if (this.adalahOp("=") || this.adalahOp("←")) this.maju();
        else this.galat(`Konstanta ditulis CONSTANT ${nama} = nilai.`);
        const nilai = this.ekspr();
        // Panduan 9618 §2.5: nilai konstanta HANYA literal — bukan variabel,
        // konstanta lain, atau ekspresi.
        const literal = (e: Ekspr): boolean =>
          e.k === "int" || e.k === "real" || e.k === "char" || e.k === "string" || e.k === "bool" ||
          (e.k === "uner" && e.op === "-" && (e.a.k === "int" || e.a.k === "real"));
        if (!literal(nilai)) this.galat(`Nilai CONSTANT harus literal, mis. CONSTANT ${nama} = 10 - bukan variabel atau hitungan.`, t);
        return { k: "constant", nama, nilai, baris };
      }
      case "INPUT": {
        this.maju();
        const target = this.target("INPUT");
        if (this.adalahOp(",")) this.galat("INPUT membaca satu variabel per pernyataan. Tulis INPUT di baris terpisah untuk tiap variabel.");
        return { k: "input", target, baris };
      }
      case "OUTPUT": {
        this.maju();
        const awal = this.lihat();
        if (awal.t === "baris" || awal.t === "akhir") this.galat("OUTPUT perlu nilai yang ditampilkan, mis. OUTPUT \"Halo\".");
        const isi = [this.ekspr()];
        while (this.adalahOp(",")) {
          this.maju();
          isi.push(this.ekspr());
        }
        return { k: "output", isi, baris };
      }
      case "IF": {
        this.maju();
        this.masuk(t);
        const kondisi = this.ekspr();
        this.lewatiBaris();
        this.harapKunci("THEN", `IF di baris ${baris}`);
        const maka = this.blok(new Set(["ELSE", "ENDIF", ...penutupLuar(penutup)]));
        let lain: Pernyataan[] | null = null;
        if (this.adalahKunci("ELSE")) {
          this.maju();
          lain = this.blok(new Set(["ENDIF", ...penutupLuar(penutup)]));
        }
        this.tutup("ENDIF", `IF di baris ${baris}`);
        this.dalam--;
        return { k: "if", kondisi, maka, lain, baris };
      }
      case "CASE": {
        this.maju();
        this.masuk(t);
        this.harapKunci("OF", "CASE OF nama");
        const subjek = this.ekspr();
        const cabang: { label: LabelCase[]; isi: Pernyataan[]; baris: number }[] = [];
        let lain: Pernyataan[] | null = null;
        for (;;) {
          this.lewatiBaris();
          const s = this.lihat();
          if (s.t === "akhir") break;
          if (s.t === "kunci" && s.v === "ENDCASE") break;
          if (s.t === "kunci" && s.v === "OTHERWISE") {
            this.maju();
            if (this.adalahOp(":")) this.maju();
            lain = this.isiCabang();
            if (!this.adalahKunci("ENDCASE")) this.galat(`OTHERWISE harus menjadi pilihan terakhir sebelum ENDCASE (CASE di baris ${baris}).`);
            break;
          }
          if (this.awalPernyataan()) {
            if (cabang.length === 0) this.galat("Setelah CASE OF tulis dulu pilihan nilainya, mis. 1 : OUTPUT \"satu\".");
            // Pernyataan lanjutan untuk pilihan sebelumnya di baris berikutnya.
            const terakhir = cabang[cabang.length - 1];
            terakhir.isi.push(...this.isiCabang());
            continue;
          }
          const label: LabelCase[] = [this.labelCase()];
          while (this.adalahOp(",")) {
            this.maju();
            label.push(this.labelCase());
          }
          this.harapOp(":", "Pilihan CASE ditulis nilai : pernyataan");
          cabang.push({ label, isi: this.isiCabang(), baris: s.baris });
        }
        this.tutup("ENDCASE", `CASE di baris ${baris}`);
        this.dalam--;
        return { k: "case", subjek, cabang, lain, baris };
      }
      case "FOR": {
        this.maju();
        this.masuk(t);
        const nama = this.harapNama("FOR");
        if (this.adalahOp("=")) this.galat(`Penghitung FOR diberi nilai dengan ←: FOR ${nama} ← 1 TO 10.`);
        this.harapOp("←", "FOR nama ← awal TO akhir");
        const dari = this.ekspr();
        this.harapKunci("TO", "FOR nama ← awal TO akhir");
        const sampai = this.ekspr();
        let langkah: Ekspr | null = null;
        if (this.adalahKunci("STEP")) {
          this.maju();
          langkah = this.ekspr();
        }
        const isi = this.blok(new Set(["NEXT", ...penutupLuar(penutup)]));
        const tNext = this.lihat();
        this.tutup("NEXT", `FOR di baris ${baris}`);
        if (this.lihat().t === "nama") {
          const n = this.maju() as Extract<Token, { t: "nama" }>;
          if (n.v.toUpperCase() !== nama.toUpperCase()) {
            this.galat(`NEXT ${n.v} tidak cocok dengan FOR ${nama} di baris ${baris}.`, n);
          }
        }
        this.dalam--;
        return { k: "for", nama, dari, sampai, langkah, isi, baris, barisNext: tNext.baris };
      }
      case "WHILE": {
        this.maju();
        this.masuk(t);
        const kondisi = this.ekspr();
        if (this.adalahKunci("DO")) this.maju();
        const isi = this.blok(new Set(["ENDWHILE", ...penutupLuar(penutup)]));
        this.tutup("ENDWHILE", `WHILE di baris ${baris}`);
        this.dalam--;
        return { k: "while", kondisi, isi, baris };
      }
      case "REPEAT": {
        this.maju();
        this.masuk(t);
        const isi = this.blok(new Set(["UNTIL", ...penutupLuar(penutup)]));
        const tUntil = this.lihat();
        this.tutup("UNTIL", `REPEAT di baris ${baris}`);
        const kondisi = this.ekspr();
        this.dalam--;
        return { k: "repeat", isi, kondisi, baris, barisUntil: tUntil.baris };
      }
      case "CALL": {
        this.maju();
        const nama = this.harapNama("CALL");
        let arg: Ekspr[] = [];
        if (this.adalahOp("(")) arg = this.argumen();
        return { k: "call", nama, arg, baris };
      }
      case "RETURN": {
        this.maju();
        if (!this.sekarang || this.sekarang.jenis !== "function") {
          this.galat("RETURN hanya dipakai di dalam FUNCTION. PROCEDURE berakhir sendiri di ENDPROCEDURE.", t);
        }
        return { k: "return", nilai: this.ekspr(), baris };
      }
      default:
        this.galat(`${t.v} tidak bisa mengawali pernyataan di sini.`, t);
    }
  }

  /** Penutup blok: kalau yang ditemukan penutup lain, sebutkan pembuka mana yang belum ditutup. */
  private tutup(v: string, pembuka: string) {
    if (this.adalahKunci(v)) {
      this.maju();
      return;
    }
    const t = this.lihat();
    const tertulis = t.t === "akhir" ? "program berakhir" : `tertulis ${deskripsi(t)}`;
    this.galat(`${pembuka} belum ditutup ${v} (${tertulis}).`, t);
  }

  private awalPernyataan(): boolean {
    const t = this.lihat();
    if (t.t === "kunci") return AWAL_PERNYATAAN.has(t.v);
    // `x = 5` ikut dianggap pernyataan supaya mendapat petunjuk "pakai ←",
    // bukan galat "pilihan CASE ditulis nilai : pernyataan".
    if (t.t === "nama") return this.adalahOp("←", 1) || this.adalahOp("[", 1) || this.adalahOp("=", 1);
    return false;
  }

  /** Isi satu pilihan CASE: pernyataan di baris yang sama (opsional), dan baris berikut sampai pilihan baru. */
  private isiCabang(): Pernyataan[] {
    const isi: Pernyataan[] = [];
    const penutup = new Set(["ENDCASE", "OTHERWISE"]);
    if (this.lihat().t !== "baris" && this.lihat().t !== "akhir") {
      isi.push(this.pernyataan(penutup));
      this.akhiriPernyataan(penutup);
    }
    for (;;) {
      this.lewatiBaris();
      if (!this.awalPernyataan()) return isi;
      isi.push(this.pernyataan(penutup));
      this.akhiriPernyataan(penutup);
    }
  }

  private labelCase(): LabelCase {
    const dari = this.ekspr();
    if (this.adalahKunci("TO")) {
      this.maju();
      return { dari, sampai: this.ekspr() };
    }
    return { dari, sampai: null };
  }

  private subrutinBaru() {
    const t = this.maju() as Extract<Token, { t: "kunci" }>;
    const jenis = t.v === "PROCEDURE" ? "procedure" : "function";
    const nama = this.harapNama(t.v);
    const besar = nama.toUpperCase();
    if (FUNGSI_BAWAAN.has(besar)) this.galat(`${nama} adalah nama fungsi bawaan; pilih nama lain.`, t);
    const lama = this.subrutin.get(besar);
    if (lama) this.galat(`Subrutin ${nama} sudah ditulis di baris ${lama.baris}.`, t);

    const param: Parameter[] = [];
    if (this.adalahOp("(")) {
      this.maju();
      let byref = false;
      if (!this.adalahOp(")")) {
        for (;;) {
          // BYREF/BYVAL berlaku untuk parameter ini DAN berikutnya sampai
          // diganti — seperti contoh panduan `SWAP(BYREF X : INTEGER, Y : INTEGER)`.
          if (this.adalahKunci("BYREF")) {
            if (jenis === "function") this.galat("Panduan 9618: parameter FUNCTION tidak dikirim BYREF. Pakai PROCEDURE bila variabel pemanggil perlu diubah.");
            this.maju();
            byref = true;
          } else if (this.adalahKunci("BYVAL")) {
            this.maju();
            byref = false;
          }
          const pn = this.harapNama(`Parameter ${nama}`, true);
          if (param.some((p) => p.nama.toUpperCase() === pn.toUpperCase())) this.galat(`Parameter ${pn} ditulis dua kali.`);
          this.harapOp(":", `Parameter ditulis nama : TIPE`);
          param.push({ nama: pn, tipe: this.tipe(true), byref });
          if (!this.adalahOp(",")) break;
          this.maju();
        }
      }
      this.harapOp(")", `Daftar parameter ${nama}`);
    }
    let hasil: TipeDasar | null = null;
    if (jenis === "function") {
      if (!this.adalahKunci("RETURNS")) this.galat(`FUNCTION perlu tipe hasil: FUNCTION ${nama}(…) RETURNS INTEGER.`);
      this.maju();
      const tp = this.tipe(false);
      if (tp.k !== "dasar") this.galat("FUNCTION mengembalikan satu nilai (INTEGER, REAL, CHAR, STRING, atau BOOLEAN), bukan ARRAY.");
      hasil = tp.t;
    }
    const sub: Subrutin = { jenis, nama, param, hasil, isi: [], baris: t.baris, barisAkhir: t.baris };
    const penutupSub = jenis === "procedure" ? "ENDPROCEDURE" : "ENDFUNCTION";
    this.sekarang = sub;
    this.subrutin.set(besar, sub);
    sub.isi = this.blok(new Set([penutupSub]));
    sub.barisAkhir = this.lihat().baris;
    this.tutup(penutupSub, `${t.v} ${nama} di baris ${t.baris}`);
    this.sekarang = null;
  }

  private tipe(bolehTanpaBatas: boolean): Tipe {
    const t = this.lihat();
    if (t.t === "kunci" && t.v === "ARRAY") {
      this.maju();
      let batas: [Ekspr, Ekspr][] | null = null;
      if (this.adalahOp("[")) {
        this.maju();
        batas = [];
        for (;;) {
          const bawah = this.ekspr();
          this.harapOp(":", "Batas array ditulis [bawah:atas], mis. ARRAY[1:10]");
          const atas = this.ekspr();
          batas.push([bawah, atas]);
          if (!this.adalahOp(",")) break;
          this.maju();
        }
        if (batas.length > 2) this.galat("SynapLab mendukung array 1 dan 2 dimensi.");
        this.harapOp("]", "Batas array");
      } else if (!bolehTanpaBatas) {
        this.galat("Array perlu batas: ARRAY[1:10] OF INTEGER.");
      }
      this.harapKunci("OF", "ARRAY[…] OF TIPE");
      const isi = this.tipe(false);
      if (isi.k !== "dasar") this.galat("Array dari array ditulis sebagai satu array 2D: ARRAY[1:3, 1:4] OF INTEGER.");
      return { k: "array", t: isi.t, batas };
    }
    if (t.t === "kunci" && (TIPE_DASAR as readonly string[]).includes(t.v)) {
      this.maju();
      return { k: "dasar", t: t.v as TipeDasar };
    }
    if (t.t === "kunci" && t.v === "DATE") this.galat("Tipe DATE belum didukung di SynapLab.");
    if (t.t === "nama") {
      const b = t.v.toUpperCase();
      const saran = b === "INT" ? "INTEGER" : b === "FLOAT" || b === "DOUBLE" ? "REAL" : b === "STR" || b === "TEXT" ? "STRING" : b === "BOOL" ? "BOOLEAN" : null;
      if (saran) this.galat(`Tipe 9618 ditulis ${saran}, bukan ${t.v}.`);
    }
    this.galat(`Tipe tidak dikenal: ${deskripsi(t)}. Pilih INTEGER, REAL, CHAR, STRING, BOOLEAN, atau ARRAY[…] OF …`);
  }

  private target(konteks: string): Target {
    const t = this.lihat();
    const nama = this.harapNama(konteks);
    if (this.adalahOp("[")) return { k: "indeks", nama, indeks: this.indeks(), baris: t.baris };
    return { k: "nama", nama, baris: t.baris };
  }

  private indeks(): Ekspr[] {
    this.maju();
    const isi = [this.ekspr()];
    while (this.adalahOp(",")) {
      this.maju();
      isi.push(this.ekspr());
    }
    this.harapOp("]", "Indeks array");
    if (this.adalahOp("[")) this.galat("Elemen array 2D ditulis dengan satu kurung: Nilai[baris, kolom].");
    return isi;
  }

  private argumen(): Ekspr[] {
    this.maju();
    const arg: Ekspr[] = [];
    if (!this.adalahOp(")")) {
      for (;;) {
        arg.push(this.ekspr());
        if (!this.adalahOp(",")) break;
        this.maju();
      }
    }
    this.harapOp(")", "Daftar argumen");
    return arg;
  }

  // ── Ekspresi (Pratt) ─────────────────────────────────────────────────

  ekspr(minimal = 0): Ekspr {
    const t0 = this.lihat();
    this.masuk(t0);
    let kiri = this.awalan();
    for (;;) {
      const t = this.lihat();
      const op = t.t === "op" || t.t === "kunci" ? t.v : null;
      const k = op !== null ? KEKUATAN[op] : undefined;
      if (k === undefined || k <= minimal) break;
      this.maju();
      const kanan = this.ekspr(k);
      kiri = { k: "biner", op: op!, a: kiri, b: kanan, baris: t.baris };
    }
    this.dalam--;
    return kiri;
  }

  private awalan(): Ekspr {
    const t = this.maju();
    switch (t.t) {
      case "int":
        return { k: "int", v: t.v, baris: t.baris };
      case "real":
        return { k: "real", v: t.v, baris: t.baris };
      case "char":
        return { k: "char", v: t.v, baris: t.baris };
      case "string":
        return { k: "string", v: t.v, baris: t.baris };
      case "nama":
        if (this.adalahOp("(")) return { k: "panggil", nama: t.v, arg: this.argumen(), baris: t.baris };
        if (this.adalahOp("[")) return { k: "indeks", nama: t.v, indeks: this.indeks(), baris: t.baris };
        return { k: "nama", nama: t.v, baris: t.baris };
      case "kunci":
        if (t.v === "TRUE" || t.v === "FALSE") return { k: "bool", v: t.v === "TRUE", baris: t.baris };
        // NOT mengikat lebih longgar dari perbandingan: NOT a = b → NOT (a = b).
        if (t.v === "NOT") return { k: "uner", op: "NOT", a: this.ekspr(3), baris: t.baris };
        if (t.v === "MOD" || t.v === "DIV") {
          // Bentuk fungsi lama MOD(a, b) / DIV(a, b) tetap diterima.
          if (this.adalahOp("(")) {
            const arg = this.argumen();
            if (arg.length !== 2) this.galat(`${t.v}(a, b) perlu dua argumen.`, t);
            return { k: "biner", op: t.v, a: arg[0], b: arg[1], baris: t.baris };
          }
        }
        break;
      case "op":
        if (t.v === "(") {
          const isi = this.ekspr();
          this.harapOp(")", "Kurung");
          return isi;
        }
        if (t.v === "-") return { k: "uner", op: "-", a: this.ekspr(6), baris: t.baris };
        if (t.v === "+") return this.ekspr(6);
        break;
    }
    if (t.t === "baris" || t.t === "akhir") this.galat("Ekspresi belum lengkap di akhir baris.", t);
    this.galat(`Tidak terduga di ekspresi: ${deskripsi(t)}.`, t);
  }
}

/** Penutup yang tidak punya pembuka di tingkat teratas. */
const PENUTUP_YATIM = new Set(["ENDIF", "ELSE", "THEN", "ENDCASE", "OTHERWISE", "NEXT", "ENDWHILE", "UNTIL", "ENDPROCEDURE", "ENDFUNCTION", "ENDTYPE", "ENDCLASS"]);

/**
 * Penutup blok luar tetap menghentikan blok dalam, supaya `IF` yang lupa
 * ditutup di dalam `WHILE` dilaporkan sebagai "IF belum ditutup ENDIF",
 * bukan galat membingungkan di ENDWHILE.
 */
function penutupLuar(penutup: ReadonlySet<string>): string[] {
  return [...penutup].filter((p) => p !== "ELSE" && p !== "OTHERWISE");
}

export function uraiPseudo(src: string): Program {
  return new Pengurai(tokenisasi(src)).urai();
}
