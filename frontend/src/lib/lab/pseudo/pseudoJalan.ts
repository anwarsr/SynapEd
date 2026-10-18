/**
 * Interpreter pseudocode 9618 — merekam program menjadi `JejakKode`.
 *
 * Ditulis sebagai GENERATOR: setiap pernyataan `yield` nomor barisnya SEBELUM
 * dijalankan, dan pengemudi di `jalankanPseudo` memotret keadaan di titik itu.
 * Pemanggilan fungsi di tengah ekspresi ikut ber-`yield` (lewat `yield*`),
 * jadi langkah di dalam fungsi rekursif terekam tanpa mesin terpisah.
 *
 * Aturan 9618 yang SENGAJA ditegakkan (inilah yang dinilai di ujian, dan yang
 * membedakannya dari "pseudocode bebas" flowchart):
 *  - variabel WAJIB dideklarasikan dengan tipe (panduan menyebutnya "praktik
 *    yang baik"; SynapLab mewajibkannya karena tanpa tipe tidak ada yang bisa
 *    diperiksa); menaruh REAL ke INTEGER,
 *    angka ke STRING, dsb. adalah galat — saran perbaikannya disebut;
 *  - `&` untuk menyambung teks (bukan `+`), `/` selalu menghasilkan REAL,
 *    `DIV`/`MOD` hanya untuk INTEGER;
 *  - indeks array diperiksa terhadap batas DECLARE-nya;
 *  - variabel yang belum diberi nilai tidak boleh dibaca.
 *
 * Variabel di `Map` berkunci nama HURUF BESAR (nama 9618 tidak membedakan
 * besar-kecil); `__proto__` hanyalah nama biasa. Tanpa `eval`.
 *
 * Modul netral; diuji `verify-pseudocode`.
 */
import { mulberry32 } from "../labRandom";
import { KODE_MAKS_REKAM, type GalatKode, type JejakKode, type LangkahKode, type VariabelKode } from "../kodeTypes";
import { GalatPseudo } from "./pseudoLexer";
import { FUNGSI_BAWAAN, uraiPseudo, type Ekspr, type Pernyataan, type Program, type Subrutin, type Target, type TipeDasar } from "./pseudoParser";

export type NilaiPs =
  | { t: "INTEGER"; v: number }
  | { t: "REAL"; v: number }
  | { t: "CHAR"; v: string }
  | { t: "STRING"; v: string }
  | { t: "BOOLEAN"; v: boolean };

export const PSEUDO_MAKS_LANGKAH = 10_000;
export const PSEUDO_MAKS_REKURSI = 200;
export const PSEUDO_MAKS_SEL_ARRAY = 10_000;
export const PSEUDO_MAKS_TEKS = 10_000;
export const PSEUDO_MAKS_KELUARAN = 50_000;
/** Benih RAND bawaan — jejak yang sama bisa diputar ulang dan dibagikan. */
export const PSEUDO_BENIH = 9618;
/** Batas variabel per potret; rekursi dalam × variabel lokal bisa membengkak. */
const MAKS_VARS_POTRET = 60;
const MAKS_BINGKAI_POTRET = 8;
const MAKS_TAMPIL = 160;

export const JENIS_GALAT = {
  sintaks: "Galat sintaks",
  tipe: "Galat tipe",
  nama: "Galat nama",
  nilai: "Galat nilai",
  indeks: "Galat indeks",
  masukan: "Galat masukan",
  hitung: "Galat hitung",
  rekursi: "Galat rekursi",
  batas: "Batas langkah",
} as const;

// ── Wadah variabel ──────────────────────────────────────────────────────

interface WadahArray {
  k: "array";
  tipe: TipeDasar;
  batas: [number, number][];
  isi: (NilaiPs | null)[];
}
type Wadah =
  | { k: "skalar"; tipe: TipeDasar; nilai: NilaiPs | null; konstan: boolean }
  | WadahArray
  /** BYREF ke satu elemen array. */
  | { k: "elemen"; arr: WadahArray; offset: number; label: string };

interface Entri {
  nama: string;
  w: Wadah;
  byref: boolean;
  /** Baris DECLARE/CONSTANT; null untuk parameter. */
  baris: number | null;
}

interface Bingkai {
  nama: string;
  vars: Map<string, Entri>;
}

type Gen<T> = Generator<number, T, void>;

// ── Penolong nilai ──────────────────────────────────────────────────────

const int = (v: number): NilaiPs => ({ t: "INTEGER", v });
const real = (v: number): NilaiPs => ({ t: "REAL", v });
const str = (v: string): NilaiPs => ({ t: "STRING", v });
const bool = (v: boolean): NilaiPs => ({ t: "BOOLEAN", v });
const panjang = (s: string) => Array.from(s).length;

function adalahAngka(n: NilaiPs): n is { t: "INTEGER" | "REAL"; v: number } {
  return n.t === "INTEGER" || n.t === "REAL";
}
function adalahTeks(n: NilaiPs): n is { t: "CHAR" | "STRING"; v: string } {
  return n.t === "CHAR" || n.t === "STRING";
}

/** REAL selalu bertitik (5.0) supaya tipenya terlihat — sama seperti Python. */
export function formatReal(v: number): string {
  if (Number.isInteger(v) && Math.abs(v) < 1e16) return v.toFixed(1);
  return String(v);
}

/** Bentuk nilai untuk OUTPUT. */
export function tampilKeluaran(n: NilaiPs): string {
  switch (n.t) {
    case "INTEGER": return String(n.v);
    case "REAL": return formatReal(n.v);
    case "BOOLEAN": return n.v ? "TRUE" : "FALSE";
    default: return n.v;
  }
}

/** Bentuk nilai untuk panel variabel: teks berkutip supaya "5" beda dari 5. */
function tampilLiteral(n: NilaiPs | null): string {
  if (n === null) return "-";
  if (n.t === "STRING") return `"${n.v}"`;
  if (n.t === "CHAR") return `'${n.v}'`;
  return tampilKeluaran(n);
}

function potong(s: string): string {
  return s.length > MAKS_TAMPIL ? s.slice(0, MAKS_TAMPIL - 1) + "…" : s;
}

const RE_INT = /^[+-]?\d+$/;
const RE_REAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

function periksaInt(v: number, baris: number): NilaiPs {
  if (!Number.isSafeInteger(v)) throw new GalatPseudo("Hasil hitungan terlalu besar untuk INTEGER.", baris, JENIS_GALAT.hitung);
  return int(v);
}
function periksaReal(v: number, baris: number): NilaiPs {
  if (!Number.isFinite(v)) throw new GalatPseudo("Hasil hitungan REAL tidak terhingga atau tidak terdefinisi.", baris, JENIS_GALAT.hitung);
  return real(v);
}

function saranKonversi(dari: string, ke: TipeDasar): string | null {
  if (ke === "INTEGER" && dari === "REAL") return "Bulatkan dulu dengan INT(…), atau deklarasikan variabelnya sebagai REAL.";
  if ((ke === "INTEGER" || ke === "REAL") && (dari === "STRING" || dari === "CHAR")) return "Ubah teks menjadi angka dengan STR_TO_NUM(…).";
  if ((ke === "STRING" || ke === "CHAR") && (dari === "INTEGER" || dari === "REAL")) return "Ubah angka menjadi teks dengan NUM_TO_STR(…).";
  return null;
}

/**
 * Aturan penugasan 9618: INTEGER boleh masuk REAL (jadi REAL), CHAR boleh
 * masuk STRING, STRING sepanjang 1 boleh masuk CHAR. Selain itu galat tipe.
 */
function cocokkan(tipe: TipeDasar, n: NilaiPs, konteks: string, baris: number): NilaiPs {
  if (n.t === tipe) return n;
  if (tipe === "REAL" && n.t === "INTEGER") return real(n.v);
  if (tipe === "STRING" && n.t === "CHAR") return str(n.v);
  if (tipe === "CHAR" && n.t === "STRING" && panjang(n.v) === 1) return { t: "CHAR", v: n.v };
  if (tipe === "CHAR" && n.t === "STRING") {
    throw new GalatPseudo(`${konteks}: CHAR hanya berisi satu karakter, sedangkan "${potong(n.v)}" berisi ${panjang(n.v)}.`, baris, JENIS_GALAT.tipe, "Deklarasikan sebagai STRING untuk teks yang lebih panjang.");
  }
  throw new GalatPseudo(
    `${konteks}: nilai ${n.t} ${tampilLiteral(n)} tidak bisa disimpan sebagai ${tipe}.`,
    baris,
    JENIS_GALAT.tipe,
    saranKonversi(n.t, tipe),
  );
}

function tipeDari(n: NilaiPs): TipeDasar {
  return n.t;
}

// ── Mesin ───────────────────────────────────────────────────────────────

export interface OpsiJalan {
  /** false = hanya keluaran akhir (mode "Jalankan"); langkah tidak dipotret. */
  rekam?: boolean;
  maksLangkah?: number;
  maksRekam?: number;
  benih?: number;
}

class Mesin {
  readonly bingkai: Bingkai[] = [{ nama: "global", vars: new Map() }];
  keluaran = "";
  private posMasukan = 0;
  private acak: () => number;
  /** Baris pernyataan yang sedang berjalan — cadangan nomor baris galat. */
  baris = 1;

  constructor(
    private program: Program,
    private masukan: string[],
    benih: number,
  ) {
    this.acak = mulberry32(benih);
  }

  private get kini(): Bingkai {
    return this.bingkai[this.bingkai.length - 1];
  }

  private galat(pesan: string, jenis: string, saran: string | null = null, baris = this.baris): never {
    throw new GalatPseudo(pesan, baris, jenis, saran);
  }

  // ── Pencarian nama ───────────────────────────────────────────────

  private cariEntri(nama: string): Entri | null {
    const kunci = nama.toUpperCase();
    return this.kini.vars.get(kunci) ?? (this.bingkai.length > 1 ? this.bingkai[0].vars.get(kunci) ?? null : null);
  }

  private entriWajib(nama: string, baris: number, saranTipe: TipeDasar | null = null): Entri {
    const e = this.cariEntri(nama);
    if (e) return e;
    const besar = nama.toUpperCase();
    const sub = this.program.subrutin.get(besar);
    if (sub) {
      this.galat(
        sub.jenis === "function"
          ? `${sub.nama} adalah FUNCTION; panggil dengan kurung: ${sub.nama}(…).`
          : `${sub.nama} adalah PROCEDURE; jalankan dengan CALL ${sub.nama}.`,
        JENIS_GALAT.nama, null, baris,
      );
    }
    if (FUNGSI_BAWAAN.has(besar)) this.galat(`${besar} adalah fungsi bawaan; panggil dengan kurung: ${besar}(…).`, JENIS_GALAT.nama, null, baris);
    this.galat(
      `Variabel ${nama} belum dideklarasikan.`,
      JENIS_GALAT.nama,
      `Tambahkan sebelum baris ini: DECLARE ${nama} : ${saranTipe ?? "INTEGER"}${saranTipe ? "" : " (atau tipe yang sesuai)"}. SynapLab mewajibkan DECLARE supaya tipe setiap nilai bisa diperiksa.`,
      baris,
    );
  }

  // ── Array ────────────────────────────────────────────────────────

  private *offset(arr: WadahArray, nama: string, indeks: Ekspr[], baris: number): Gen<number> {
    if (indeks.length !== arr.batas.length) {
      this.galat(`${nama} adalah array ${arr.batas.length} dimensi; tulis ${arr.batas.length} indeks, mis. ${nama}[${arr.batas.map((b) => b[0]).join(", ")}].`, JENIS_GALAT.indeks, null, baris);
    }
    let off = 0;
    for (let d = 0; d < indeks.length; d++) {
      const n = yield* this.nilai(indeks[d]);
      if (n.t !== "INTEGER") this.galat(`Indeks array harus INTEGER, bukan ${n.t} ${tampilLiteral(n)}.`, JENIS_GALAT.tipe, n.t === "REAL" ? "Bulatkan dengan INT(…)." : null, baris);
      const [bawah, atas] = arr.batas[d];
      if (n.v < bawah || n.v > atas) {
        const teksBatas = arr.batas.map(([a, b]) => `${a}:${b}`).join(", ");
        this.galat(`Indeks ${n.v} di luar batas ${nama}[${teksBatas}].`, JENIS_GALAT.indeks, null, baris);
      }
      off = off * (atas - bawah + 1) + (n.v - bawah);
    }
    return off;
  }

  // ── Baca & tulis ─────────────────────────────────────────────────

  private bacaWadah(w: Wadah, nama: string, baris: number): NilaiPs {
    if (w.k === "array") this.galat(`${nama} adalah ARRAY; sebutkan elemennya, mis. ${nama}[${w.batas.map((b) => b[0]).join(", ")}].`, JENIS_GALAT.tipe, null, baris);
    const v = w.k === "skalar" ? w.nilai : w.arr.isi[w.offset];
    if (v === null) this.galat(`${nama} belum diberi nilai.`, JENIS_GALAT.nilai, `Beri nilai dulu dengan ${nama} ← … atau INPUT ${nama}.`, baris);
    return v;
  }

  private tulisWadah(w: Wadah, nama: string, v: NilaiPs, baris: number) {
    if (w.k === "array") this.galat(`Untuk mengisi array, sebutkan elemennya: ${nama}[…] ← nilai.`, JENIS_GALAT.tipe, null, baris);
    if (w.k === "skalar") {
      if (w.konstan) this.galat(`${nama} adalah konstanta; nilainya tidak bisa diubah.`, JENIS_GALAT.nama, null, baris);
      w.nilai = cocokkan(w.tipe, v, `Menyimpan ke ${nama}`, baris);
    } else {
      w.arr.isi[w.offset] = cocokkan(w.arr.tipe, v, `Menyimpan ke ${w.label}`, baris);
    }
  }

  /** Target penugasan/INPUT → wadah yang bisa ditulis (+ tipe & label untuk pesan). */
  private *wadahTarget(t: Target, saranTipe: TipeDasar | null): Gen<{ w: Wadah; label: string; tipe: TipeDasar }> {
    const e = this.entriWajib(t.nama, t.baris, saranTipe);
    if (t.k === "nama") {
      if (e.w.k === "array") return { w: e.w, label: e.nama, tipe: e.w.tipe };
      return { w: e.w, label: e.nama, tipe: e.w.k === "skalar" ? e.w.tipe : e.w.arr.tipe };
    }
    if (e.w.k !== "array") this.galat(`${e.nama} bukan array, jadi tidak bisa diberi indeks.`, JENIS_GALAT.tipe, null, t.baris);
    const off = yield* this.offset(e.w, e.nama, t.indeks, t.baris);
    return { w: { k: "elemen", arr: e.w, offset: off, label: `${e.nama}[…]` }, label: e.nama, tipe: e.w.tipe };
  }

  // ── Pernyataan ───────────────────────────────────────────────────

  *jalankan(): Gen<void> {
    yield* this.blok(this.program.utama);
  }

  private *blok(isi: Pernyataan[]): Gen<NilaiPs | null> {
    for (const p of isi) {
      const r = yield* this.pernyataan(p);
      if (r) return r;
    }
    return null;
  }

  private *berhenti(baris: number): Gen<void> {
    this.baris = baris;
    yield baris;
  }

  private *pernyataan(p: Pernyataan): Gen<NilaiPs | null> {
    yield* this.berhenti(p.baris);
    switch (p.k) {
      case "declare": {
        for (const nama of p.nama) {
          const kunci = nama.toUpperCase();
          const lama = this.kini.vars.get(kunci);
          if (lama) {
            // DECLARE di dalam perulangan dijalankan berkali-kali; deklarasi
            // bersifat statis, jadi baris yang SAMA cukup diabaikan.
            if (lama.baris === p.baris) continue;
            this.galat(`${nama} sudah dideklarasikan${lama.baris ? ` di baris ${lama.baris}` : " sebagai parameter"}.`, JENIS_GALAT.nama);
          }
          let w: Wadah;
          if (p.tipe.k === "dasar") {
            w = { k: "skalar", tipe: p.tipe.t, nilai: null, konstan: false };
          } else {
            const batas: [number, number][] = [];
            for (const [eb, ea] of p.tipe.batas ?? []) {
              const b = yield* this.nilai(eb);
              const a = yield* this.nilai(ea);
              if (b.t !== "INTEGER" || a.t !== "INTEGER") this.galat("Batas array harus INTEGER, mis. ARRAY[1:10].", JENIS_GALAT.tipe);
              if (b.v > a.v) this.galat(`Batas bawah array (${b.v}) lebih besar dari batas atas (${a.v}).`, JENIS_GALAT.indeks);
              batas.push([b.v, a.v]);
            }
            const sel = batas.reduce((n, [b, a]) => n * (a - b + 1), 1);
            if (sel > PSEUDO_MAKS_SEL_ARRAY) this.galat(`Array terlalu besar (${sel} elemen; maks ${PSEUDO_MAKS_SEL_ARRAY}).`, JENIS_GALAT.indeks);
            w = { k: "array", tipe: p.tipe.t, batas, isi: new Array<NilaiPs | null>(sel).fill(null) };
          }
          this.kini.vars.set(kunci, { nama, w, byref: false, baris: p.baris });
        }
        return null;
      }
      case "constant": {
        const kunci = p.nama.toUpperCase();
        const lama = this.kini.vars.get(kunci);
        if (lama) {
          if (lama.baris === p.baris) return null;
          this.galat(`${p.nama} sudah dideklarasikan${lama.baris ? ` di baris ${lama.baris}` : ""}.`, JENIS_GALAT.nama);
        }
        const v = yield* this.nilai(p.nilai);
        this.kini.vars.set(kunci, { nama: p.nama, w: { k: "skalar", tipe: tipeDari(v), nilai: v, konstan: true }, byref: false, baris: p.baris });
        return null;
      }
      case "assign": {
        // `A ← B` untuk seluruh array diperiksa SEBELUM sisi kanan dievaluasi —
        // membaca B sebagai nilai tunggal akan memberi galat "B adalah ARRAY".
        if (p.target.k === "nama") {
          const ke = this.cariEntri(p.target.nama);
          if (ke?.w.k === "array") {
            yield* this.salinArray(ke.w, ke.nama, p.nilai);
            return null;
          }
        }
        // Sisi kanan dulu: tipenya dipakai untuk menyarankan DECLARE bila
        // targetnya belum dideklarasikan.
        const v = yield* this.nilai(p.nilai);
        const t = yield* this.wadahTarget(p.target, tipeDari(v));
        this.tulisWadah(t.w, t.label, v, p.baris);
        return null;
      }
      case "input": {
        const t = yield* this.wadahTarget(p.target, null);
        if (t.w.k === "array") this.galat(`INPUT mengisi satu elemen: INPUT ${t.label}[…].`, JENIS_GALAT.tipe);
        if (this.posMasukan >= this.masukan.length) {
          this.galat("Masukan habis.", JENIS_GALAT.masukan, `Tambahkan satu baris lagi di kotak Masukan untuk INPUT ${t.label} (satu nilai per baris).`);
        }
        const ke = this.posMasukan + 1;
        const mentah = this.masukan[this.posMasukan++];
        this.tulisWadah(t.w, t.label, this.ubahMasukan(mentah, t.tipe, ke), p.baris);
        return null;
      }
      case "output": {
        let teks = "";
        for (const e of p.isi) teks += tampilKeluaran(yield* this.nilai(e));
        this.keluaran += teks + "\n";
        if (this.keluaran.length > PSEUDO_MAKS_KELUARAN) {
          this.keluaran = this.keluaran.slice(0, PSEUDO_MAKS_KELUARAN);
          this.galat(`Keluaran terlalu panjang (lebih dari ${PSEUDO_MAKS_KELUARAN} karakter).`, JENIS_GALAT.batas, "Periksa perulangan yang mungkin tidak berhenti.");
        }
        return null;
      }
      case "if": {
        const k = yield* this.kondisi(p.kondisi, "IF");
        if (k) return yield* this.blok(p.maka);
        if (p.lain) return yield* this.blok(p.lain);
        return null;
      }
      case "case": {
        const s = yield* this.nilai(p.subjek);
        for (const c of p.cabang) {
          for (const l of c.label) {
            const dari = yield* this.nilai(l.dari);
            const cocok = l.sampai
              ? this.banding("<=", dari, s, l.dari.baris) && this.banding("<=", s, yield* this.nilai(l.sampai), l.dari.baris)
              : this.banding("=", s, dari, l.dari.baris);
            if (cocok) return yield* this.blok(c.isi);
          }
        }
        if (p.lain) return yield* this.blok(p.lain);
        return null;
      }
      case "for": {
        const e = this.entriWajib(p.nama, p.baris, "INTEGER");
        if (e.w.k !== "skalar" || e.w.tipe !== "INTEGER") {
          this.galat(`Penghitung FOR ${e.nama} harus variabel INTEGER.`, JENIS_GALAT.tipe, `Deklarasikan: DECLARE ${e.nama} : INTEGER`);
        }
        const w = e.w;
        const dari = yield* this.nilai(p.dari);
        const sampai = yield* this.nilai(p.sampai);
        const langkah = p.langkah ? yield* this.nilai(p.langkah) : int(1);
        for (const [n, apa] of [[dari, "Nilai awal"], [sampai, "Nilai akhir"], [langkah, "STEP"]] as const) {
          if (n.t !== "INTEGER") this.galat(`${apa} FOR harus INTEGER, bukan ${n.t} ${tampilLiteral(n)}.`, JENIS_GALAT.tipe);
        }
        const s = langkah.v as number;
        if (s === 0) this.galat("STEP 0 membuat FOR tidak pernah berhenti.", JENIS_GALAT.nilai);
        this.tulisWadah(w, e.nama, dari, p.baris);
        for (;;) {
          const i = this.bacaWadah(w, e.nama, p.baris).v as number;
          if (s > 0 ? i > (sampai.v as number) : i < (sampai.v as number)) return null;
          const r = yield* this.blok(p.isi);
          if (r) return r;
          yield* this.berhenti(p.barisNext);
          const kini = this.bacaWadah(w, e.nama, p.barisNext).v as number;
          this.tulisWadah(w, e.nama, periksaInt(kini + s, p.barisNext), p.barisNext);
        }
      }
      case "while": {
        for (;;) {
          if (!(yield* this.kondisi(p.kondisi, "WHILE"))) return null;
          const r = yield* this.blok(p.isi);
          if (r) return r;
          yield* this.berhenti(p.baris);
        }
      }
      case "repeat": {
        for (;;) {
          const r = yield* this.blok(p.isi);
          if (r) return r;
          yield* this.berhenti(p.barisUntil);
          if (yield* this.kondisi(p.kondisi, "UNTIL")) return null;
        }
      }
      case "call": {
        const sub = this.program.subrutin.get(p.nama.toUpperCase());
        if (!sub) {
          if (FUNGSI_BAWAAN.has(p.nama.toUpperCase())) this.galat(`${p.nama.toUpperCase()} adalah fungsi bawaan; pakai di dalam ekspresi, mis. x ← ${p.nama.toUpperCase()}(…).`, JENIS_GALAT.nama);
          this.galat(`Prosedur ${p.nama} tidak ditemukan.`, JENIS_GALAT.nama, "Tulis PROCEDURE dengan nama itu, atau periksa ejaannya.");
        }
        if (sub.jenis === "function") {
          this.galat(`${sub.nama} adalah FUNCTION; hasilnya dipakai di ekspresi, mis. x ← ${sub.nama}(…), bukan dengan CALL.`, JENIS_GALAT.nama);
        }
        yield* this.panggil(sub, p.arg, p.baris);
        return null;
      }
      case "return":
        return yield* this.nilai(p.nilai);
    }
  }

  /** `A ← B` untuk dua array berbentuk & bertipe sama (diizinkan panduan 9618). */
  private *salinArray(ke: WadahArray, nama: string, e: Ekspr): Gen<void> {
    const asal = e.k === "nama" ? this.cariEntri(e.nama) : null;
    if (!asal || asal.w.k !== "array") this.galat(`Untuk mengisi array, sebutkan elemennya: ${nama}[…] ← nilai.`, JENIS_GALAT.tipe);
    const a = asal.w as WadahArray;
    const sama = a.tipe === ke.tipe && a.batas.length === ke.batas.length && a.batas.every(([b, t], d) => t - b === ke.batas[d][1] - ke.batas[d][0]);
    if (!sama) this.galat(`Array ${asal.nama} dan ${nama} berbeda tipe atau ukuran.`, JENIS_GALAT.tipe);
    ke.isi = [...a.isi];
  }

  private ubahMasukan(mentah: string, tipe: TipeDasar, ke: number): NilaiPs {
    const t = mentah.trim();
    const tolak = (apa: string, saran: string | null = null): never =>
      this.galat(`Masukan baris ke-${ke} "${potong(mentah)}" bukan ${apa}.`, JENIS_GALAT.masukan, saran);
    switch (tipe) {
      case "INTEGER":
        if (!RE_INT.test(t)) tolak("INTEGER", RE_REAL.test(t) ? "Variabelnya INTEGER; ketik bilangan bulat, atau deklarasikan sebagai REAL." : null);
        if (!Number.isSafeInteger(Number(t))) tolak("INTEGER yang cukup kecil");
        return int(Number(t));
      case "REAL":
        if (!RE_REAL.test(t)) tolak("angka");
        return real(Number(t));
      case "BOOLEAN":
        if (t.toUpperCase() === "TRUE") return bool(true);
        if (t.toUpperCase() === "FALSE") return bool(false);
        return tolak("BOOLEAN (TRUE atau FALSE)");
      case "CHAR":
        if (panjang(mentah) !== 1) tolak("satu karakter (CHAR)");
        return { t: "CHAR", v: mentah };
      case "STRING":
        return str(mentah);
    }
  }

  private *kondisi(e: Ekspr, apa: string): Gen<boolean> {
    const n = yield* this.nilai(e);
    if (n.t !== "BOOLEAN") {
      this.galat(`Kondisi ${apa} harus bernilai BOOLEAN, bukan ${n.t} ${tampilLiteral(n)}.`, JENIS_GALAT.tipe, "Bandingkan dulu, mis. x > 0 atau x = 1.", e.baris);
    }
    return n.v;
  }

  // ── Subrutin ─────────────────────────────────────────────────────

  private *panggil(sub: Subrutin, arg: Ekspr[], baris: number): Gen<NilaiPs | null> {
    if (arg.length !== sub.param.length) {
      this.galat(`${sub.nama} perlu ${sub.param.length} argumen, diberi ${arg.length}.`, JENIS_GALAT.nama, null, baris);
    }
    if (this.bingkai.length > PSEUDO_MAKS_REKURSI) {
      this.galat(`Pemanggilan bersarang lebih dari ${PSEUDO_MAKS_REKURSI} tingkat.`, JENIS_GALAT.rekursi, "Periksa kondisi berhenti (kasus dasar) pada subrutin rekursif.", baris);
    }
    // Argumen dievaluasi di bingkai PEMANGGIL, sebelum bingkai baru dibuat.
    const vars = new Map<string, Entri>();
    for (let i = 0; i < arg.length; i++) {
      const prm = sub.param[i];
      const e = arg[i];
      const konteks = `Argumen ${i + 1} untuk ${sub.nama} (${prm.nama})`;
      let w: Wadah;
      if (prm.tipe.k === "array") {
        const asal = e.k === "nama" ? this.cariEntri(e.nama) : null;
        if (!asal || asal.w.k !== "array") this.galat(`${konteks} harus sebuah ARRAY.`, JENIS_GALAT.tipe, null, baris);
        const a = asal.w as WadahArray;
        if (a.tipe !== prm.tipe.t || (prm.tipe.batas && prm.tipe.batas.length !== a.batas.length)) {
          this.galat(`${konteks}: tipe array tidak cocok (perlu ARRAY OF ${prm.tipe.t}).`, JENIS_GALAT.tipe, null, baris);
        }
        w = prm.byref ? a : { k: "array", tipe: a.tipe, batas: a.batas.map(([b, t]) => [b, t] as [number, number]), isi: [...a.isi] };
      } else if (prm.byref) {
        if (e.k !== "nama" && e.k !== "indeks") this.galat(`${konteks} adalah BYREF, jadi harus sebuah variabel, bukan nilai.`, JENIS_GALAT.tipe, null, baris);
        const t = yield* this.wadahTarget(e, null);
        if (t.w.k === "array") this.galat(`${konteks} adalah ${prm.tipe.t}, bukan ARRAY.`, JENIS_GALAT.tipe, null, baris);
        if (t.w.k === "skalar" && t.w.konstan) this.galat(`${konteks}: konstanta ${t.label} tidak bisa dikirim BYREF.`, JENIS_GALAT.tipe, null, baris);
        // BYREF berbagi wadah yang sama — tipe harus PERSIS sama, karena
        // subrutin akan menulis ke variabel pemanggil.
        if (t.tipe !== prm.tipe.t) this.galat(`${konteks} adalah BYREF ${prm.tipe.t}, tetapi ${t.label} bertipe ${t.tipe}.`, JENIS_GALAT.tipe, null, baris);
        w = t.w;
      } else {
        const v = yield* this.nilai(e);
        w = { k: "skalar", tipe: prm.tipe.t, nilai: cocokkan(prm.tipe.t, v, konteks, baris), konstan: false };
      }
      vars.set(prm.nama.toUpperCase(), { nama: prm.nama, w, byref: prm.byref, baris: null });
    }
    this.bingkai.push({ nama: sub.nama, vars });
    const hasil = yield* this.blok(sub.isi);
    if (sub.jenis === "procedure") {
      // Satu langkah di ENDPROCEDURE supaya keadaan akhir variabel lokal
      // (dan efek BYREF) terlihat sebelum bingkainya hilang.
      yield* this.berhenti(sub.barisAkhir);
      this.bingkai.pop();
      this.baris = baris;
      return null;
    }
    if (!hasil) this.galat(`FUNCTION ${sub.nama} berakhir tanpa RETURN.`, JENIS_GALAT.nilai, "Setiap jalur di dalam FUNCTION harus sampai ke RETURN nilai.", sub.barisAkhir);
    const keluar = cocokkan(sub.hasil!, hasil, `Hasil ${sub.nama}`, this.baris);
    this.bingkai.pop();
    this.baris = baris;
    return keluar;
  }

  // ── Ekspresi ─────────────────────────────────────────────────────

  private *nilai(e: Ekspr): Gen<NilaiPs> {
    switch (e.k) {
      case "int": return int(e.v);
      case "real": return real(e.v);
      case "char": return { t: "CHAR", v: e.v };
      case "string": return str(e.v);
      case "bool": return bool(e.v);
      case "nama": {
        const en = this.entriWajib(e.nama, e.baris);
        return this.bacaWadah(en.w, en.nama, e.baris);
      }
      case "indeks": {
        const en = this.entriWajib(e.nama, e.baris);
        if (en.w.k !== "array") this.galat(`${en.nama} bukan array, jadi tidak bisa diberi indeks.`, JENIS_GALAT.tipe, null, e.baris);
        const off = yield* this.offset(en.w, en.nama, e.indeks, e.baris);
        const v = en.w.isi[off];
        if (v === null) this.galat(`Elemen ${en.nama}[…] ini belum diberi nilai.`, JENIS_GALAT.nilai, null, e.baris);
        return v;
      }
      case "uner": {
        const a = yield* this.nilai(e.a);
        if (e.op === "NOT") {
          if (a.t !== "BOOLEAN") this.galat(`NOT hanya untuk BOOLEAN, bukan ${a.t}.`, JENIS_GALAT.tipe, null, e.baris);
          return bool(!a.v);
        }
        if (a.t === "INTEGER") return periksaInt(-a.v, e.baris);
        if (a.t === "REAL") return real(-a.v);
        this.galat(`Tanda minus hanya untuk angka, bukan ${a.t}.`, JENIS_GALAT.tipe, null, e.baris);
      }
      case "biner":
        return yield* this.biner(e as Extract<Ekspr, { k: "biner" }>);
      case "panggil":
        return yield* this.panggilFungsi(e);
    }
  }

  private *biner(e: Extract<Ekspr, { k: "biner" }>): Gen<NilaiPs> {
    const b = e.baris;
    if (e.op === "AND" || e.op === "OR") {
      // Hubung-singkat: `i <= 10 AND Nilai[i] <> 0` tidak membaca indeks 11.
      const a = yield* this.nilai(e.a);
      if (a.t !== "BOOLEAN") this.galat(`${e.op} hanya untuk BOOLEAN, bukan ${a.t} ${tampilLiteral(a)}.`, JENIS_GALAT.tipe, null, b);
      if (e.op === "AND" && !a.v) return bool(false);
      if (e.op === "OR" && a.v) return bool(true);
      const c = yield* this.nilai(e.b);
      if (c.t !== "BOOLEAN") this.galat(`${e.op} hanya untuk BOOLEAN, bukan ${c.t} ${tampilLiteral(c)}.`, JENIS_GALAT.tipe, null, b);
      return c;
    }
    const a = yield* this.nilai(e.a);
    const c = yield* this.nilai(e.b);
    switch (e.op) {
      case "=": case "<>": case "<": case ">": case "<=": case ">=":
        return bool(this.banding(e.op, a, c, b));
      case "&": {
        if (!adalahTeks(a) || !adalahTeks(c)) {
          const bukan = !adalahTeks(a) ? a : c;
          this.galat(`& menyambung CHAR/STRING, bukan ${bukan.t} ${tampilLiteral(bukan)}.`, JENIS_GALAT.tipe, adalahAngka(bukan) ? "Ubah angkanya dulu dengan NUM_TO_STR(…)." : null, b);
        }
        const hasil = a.v + c.v;
        if (hasil.length > PSEUDO_MAKS_TEKS) this.galat(`Teks terlalu panjang (lebih dari ${PSEUDO_MAKS_TEKS} karakter).`, JENIS_GALAT.batas, null, b);
        return str(hasil);
      }
    }
    if (!adalahAngka(a) || !adalahAngka(c)) {
      const bukan = !adalahAngka(a) ? a : c;
      const saran = e.op === "+" && adalahTeks(bukan) ? "Untuk menyambung teks pakai &, bukan +." : adalahTeks(bukan) ? "Ubah teks menjadi angka dengan STR_TO_NUM(…)." : null;
      this.galat(`${e.op} hanya untuk angka, bukan ${bukan.t} ${tampilLiteral(bukan)}.`, JENIS_GALAT.tipe, saran, b);
    }
    const bulat = a.t === "INTEGER" && c.t === "INTEGER";
    switch (e.op) {
      case "+": return bulat ? periksaInt(a.v + c.v, b) : periksaReal(a.v + c.v, b);
      case "-": return bulat ? periksaInt(a.v - c.v, b) : periksaReal(a.v - c.v, b);
      case "*": return bulat ? periksaInt(a.v * c.v, b) : periksaReal(a.v * c.v, b);
      case "/":
        if (c.v === 0) this.galat("Pembagian dengan nol.", JENIS_GALAT.hitung, null, b);
        return periksaReal(a.v / c.v, b);
      case "DIV":
      case "MOD": {
        if (!bulat) this.galat(`${e.op} hanya untuk INTEGER.`, JENIS_GALAT.tipe, "Bulatkan dulu dengan INT(…), atau pakai / untuk pembagian REAL.", b);
        if (c.v === 0) this.galat(`${e.op} dengan nol.`, JENIS_GALAT.hitung, null, b);
        return int(e.op === "DIV" ? Math.trunc(a.v / c.v) : a.v % c.v);
      }
    }
    this.galat(`Operator ${e.op} tidak dikenal.`, JENIS_GALAT.sintaks, null, b);
  }

  /** Perbandingan 9618: angka dengan angka, teks (CHAR/STRING) dengan teks, BOOLEAN hanya = / <>. */
  private banding(op: string, a: NilaiPs, c: NilaiPs, baris: number): boolean {
    let x: number | string | boolean;
    let y: number | string | boolean;
    if (adalahAngka(a) && adalahAngka(c)) [x, y] = [a.v, c.v];
    else if (adalahTeks(a) && adalahTeks(c)) [x, y] = [a.v, c.v];
    else if (a.t === "BOOLEAN" && c.t === "BOOLEAN") {
      if (op !== "=" && op !== "<>") this.galat(`BOOLEAN hanya bisa dibandingkan dengan = atau <>.`, JENIS_GALAT.tipe, null, baris);
      [x, y] = [a.v, c.v];
    } else {
      this.galat(
        `Tidak bisa membandingkan ${a.t} ${tampilLiteral(a)} dengan ${c.t} ${tampilLiteral(c)}.`,
        JENIS_GALAT.tipe,
        (adalahAngka(a) && adalahTeks(c)) || (adalahTeks(a) && adalahAngka(c)) ? "Samakan tipenya dengan STR_TO_NUM(…) atau NUM_TO_STR(…)." : null,
        baris,
      );
    }
    switch (op) {
      case "=": return x === y;
      case "<>": return x !== y;
      case "<": return x < y;
      case ">": return x > y;
      case "<=": return x <= y;
      default: return x >= y;
    }
  }

  private *panggilFungsi(e: Extract<Ekspr, { k: "panggil" }>): Gen<NilaiPs> {
    const besar = e.nama.toUpperCase();
    const sub = this.program.subrutin.get(besar);
    if (sub) {
      if (sub.jenis === "procedure") this.galat(`${sub.nama} adalah PROCEDURE dan tidak menghasilkan nilai; jalankan dengan CALL ${sub.nama}(…).`, JENIS_GALAT.nama, null, e.baris);
      return (yield* this.panggil(sub, e.arg, e.baris))!;
    }
    if (!FUNGSI_BAWAAN.has(besar)) {
      const v = this.cariEntri(e.nama);
      if (v?.w.k === "array") this.galat(`Elemen array ditulis dengan kurung siku: ${v.nama}[…].`, JENIS_GALAT.sintaks, null, e.baris);
      this.galat(`Fungsi ${e.nama} tidak ditemukan.`, JENIS_GALAT.nama, "Tulis FUNCTION dengan nama itu, atau periksa ejaannya.", e.baris);
    }
    const arg: NilaiPs[] = [];
    for (const a of e.arg) arg.push(yield* this.nilai(a));
    return this.bawaan(besar, arg, e.baris);
  }

  private bawaan(nama: string, arg: NilaiPs[], b: number): NilaiPs {
    const jumlah = (n: number) => {
      if (arg.length !== n) this.galat(`${nama} perlu ${n} argumen, diberi ${arg.length}.`, JENIS_GALAT.nama, null, b);
    };
    const teks = (i: number): string => {
      const n = arg[i];
      if (!adalahTeks(n)) this.galat(`Argumen ${i + 1} ${nama} harus STRING/CHAR, bukan ${n.t} ${tampilLiteral(n)}.`, JENIS_GALAT.tipe, adalahAngka(n) ? "Ubah dulu dengan NUM_TO_STR(…)." : null, b);
      return n.v;
    };
    const bulat = (i: number): number => {
      const n = arg[i];
      if (n.t !== "INTEGER") this.galat(`Argumen ${i + 1} ${nama} harus INTEGER, bukan ${n.t} ${tampilLiteral(n)}.`, JENIS_GALAT.tipe, null, b);
      return n.v;
    };
    const angka = (i: number): number => {
      const n = arg[i];
      if (!adalahAngka(n)) this.galat(`Argumen ${i + 1} ${nama} harus angka, bukan ${n.t} ${tampilLiteral(n)}.`, JENIS_GALAT.tipe, adalahTeks(n) ? "Ubah dulu dengan STR_TO_NUM(…)." : null, b);
      return n.v;
    };
    switch (nama) {
      case "LENGTH":
        jumlah(1);
        return int(panjang(teks(0)));
      case "LEFT":
      case "RIGHT": {
        jumlah(2);
        const s = Array.from(teks(0));
        const n = bulat(1);
        if (n < 0 || n > s.length) this.galat(`${nama}: jumlah ${n} di luar 0..${s.length} (panjang teks).`, JENIS_GALAT.indeks, null, b);
        return str((nama === "LEFT" ? s.slice(0, n) : s.slice(s.length - n)).join(""));
      }
      case "MID": {
        jumlah(3);
        const s = Array.from(teks(0));
        const x = bulat(1);
        const y = bulat(2);
        if (x < 1 || y < 0 || x + y - 1 > s.length) {
          this.galat(`MID: mulai ${x} sepanjang ${y} melewati teks sepanjang ${s.length}.`, JENIS_GALAT.indeks, "Posisi pertama adalah 1, dan mulai + panjang − 1 tidak boleh melebihi LENGTH.", b);
        }
        return str(s.slice(x - 1, x - 1 + y).join(""));
      }
      case "TO_UPPER":
      case "TO_LOWER":
      case "UCASE":
      case "LCASE": {
        jumlah(1);
        const s = teks(0);
        const besar = nama === "TO_UPPER" || nama === "UCASE";
        const hasil = besar ? s.toUpperCase() : s.toLowerCase();
        return arg[0].t === "CHAR" && panjang(hasil) === 1 ? { t: "CHAR", v: hasil } : str(hasil);
      }
      case "NUM_TO_STR":
        jumlah(1);
        angka(0);
        return str(tampilKeluaran(arg[0]));
      case "STR_TO_NUM": {
        jumlah(1);
        const s = teks(0).trim();
        if (RE_INT.test(s) && Number.isSafeInteger(Number(s))) return int(Number(s));
        if (RE_REAL.test(s)) return real(Number(s));
        this.galat(`STR_TO_NUM: "${potong(s)}" bukan angka.`, JENIS_GALAT.nilai, "Periksa dulu dengan IS_NUM(…).", b);
      }
      case "IS_NUM": {
        jumlah(1);
        const s = teks(0).trim();
        return bool(RE_REAL.test(s));
      }
      case "ASC": {
        jumlah(1);
        const s = teks(0);
        if (panjang(s) !== 1) this.galat(`ASC perlu satu karakter, bukan "${potong(s)}".`, JENIS_GALAT.tipe, null, b);
        return int(s.codePointAt(0)!);
      }
      case "CHR": {
        jumlah(1);
        const n = bulat(0);
        if (n < 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) this.galat(`CHR: ${n} bukan kode karakter yang sah.`, JENIS_GALAT.nilai, null, b);
        return { t: "CHAR", v: String.fromCodePoint(n) };
      }
      case "INT":
        jumlah(1);
        return periksaInt(Math.trunc(angka(0)), b);
      case "RAND": {
        jumlah(1);
        const x = angka(0);
        if (x <= 0) this.galat("RAND(x) perlu x lebih dari 0.", JENIS_GALAT.nilai, null, b);
        return real(this.acak() * x);
      }
      case "EOF":
        this.galat("Operasi berkas belum didukung di SynapLab.", JENIS_GALAT.nama, null, b);
      default:
        this.galat(`Fungsi tanggal (${nama}) belum didukung di SynapLab.`, JENIS_GALAT.nama, null, b);
    }
  }

  // ── Potret untuk jejak ───────────────────────────────────────────

  private tampilWadah(w: Wadah): string {
    if (w.k === "skalar") return tampilLiteral(w.nilai);
    if (w.k === "elemen") return tampilLiteral(w.arr.isi[w.offset]);
    let s: string;
    if (w.batas.length === 1) {
      s = `[${w.isi.slice(0, 40).map(tampilLiteral).join(", ")}${w.isi.length > 40 ? ", …" : ""}]`;
    } else {
      const kolom = w.batas[1][1] - w.batas[1][0] + 1;
      const baris: string[] = [];
      for (let i = 0; i < w.isi.length && baris.length < 12; i += kolom) {
        baris.push(`[${w.isi.slice(i, i + kolom).map(tampilLiteral).join(", ")}]`);
      }
      s = `[${baris.join(", ")}${w.isi.length > 12 * kolom ? ", …" : ""}]`;
    }
    return potong(s);
  }

  private jenisEntri(en: Entri): string {
    const w = en.w;
    if (w.k === "array") return `ARRAY[${w.batas.map(([b, a]) => `${b}:${a}`).join(", ")}] OF ${w.tipe}`;
    if (w.k === "elemen") return `${w.arr.tipe} · BYREF`;
    return w.tipe + (w.konstan ? " · konstanta" : "") + (en.byref ? " · BYREF" : "");
  }

  potret(baris: number | null): LangkahKode {
    const vars: VariabelKode[] = [];
    const n = this.bingkai.length;
    // Global + bingkai paling dalam saja: rekursi 200 tingkat × variabel lokal
    // dikali 2000 langkah terlalu besar untuk disimpan.
    const dipotret = n <= MAKS_BINGKAI_POTRET + 1 ? this.bingkai.map((_, i) => i) : [0, ...Array.from({ length: MAKS_BINGKAI_POTRET }, (_, i) => n - MAKS_BINGKAI_POTRET + i)];
    const hitung = new Map<string, number>();
    const label = this.bingkai.map((bk, i) => {
      if (i === 0) return "global";
      const k = (hitung.get(bk.nama) ?? 0) + 1;
      hitung.set(bk.nama, k);
      return k === 1 ? bk.nama : `${bk.nama} (${k})`;
    });
    outer: for (const i of dipotret) {
      for (const en of this.bingkai[i].vars.values()) {
        if (vars.length >= MAKS_VARS_POTRET) break outer;
        vars.push({ nama: en.nama, nilai: this.tampilWadah(en.w), jenis: this.jenisEntri(en), lingkup: label[i] });
      }
    }
    return { baris, vars, panjangKeluaran: this.keluaran.length, tumpukan: this.bingkai.slice(1).map((bk) => bk.nama) };
  }
}

// ── Pengemudi ───────────────────────────────────────────────────────────

/** Satu nilai per baris; baris kosong terakhir (sisa Enter) tidak dihitung. */
export function pecahMasukan(masukan: string): string[] {
  if (masukan === "") return [];
  const baris = masukan.replace(/\r\n?/g, "\n").split("\n");
  if (baris[baris.length - 1] === "") baris.pop();
  return baris;
}

function keGalatKode(e: unknown): GalatKode {
  if (e instanceof GalatPseudo) return { baris: e.baris, jenis: e.jenis, pesan: e.message, saran: e.saran };
  // Bukan galat bahasa = bug interpreter; tetap dilaporkan, bukan dilempar ke UI.
  return { baris: null, jenis: "Galat internal", pesan: e instanceof Error ? e.message : String(e), saran: null };
}

export function jalankanPseudo(src: string, masukan: string, opsi: OpsiJalan = {}): JejakKode {
  const rekam = opsi.rekam ?? true;
  const maksLangkah = opsi.maksLangkah ?? PSEUDO_MAKS_LANGKAH;
  const maksRekam = opsi.maksRekam ?? KODE_MAKS_REKAM;

  let program: Program;
  try {
    program = uraiPseudo(src);
  } catch (e) {
    return { langkah: [], keluaran: "", galat: keGalatKode(e), terpotong: false };
  }

  const mesin = new Mesin(program, pecahMasukan(masukan), opsi.benih ?? PSEUDO_BENIH);
  const langkah: LangkahKode[] = [];
  let terpotong = false;
  let galat: GalatKode | null = null;
  let n = 0;
  const gen = mesin.jalankan();
  try {
    for (;;) {
      const r = gen.next();
      if (r.done) break;
      if (++n > maksLangkah) {
        throw new GalatPseudo(
          `Program dihentikan setelah ${maksLangkah.toLocaleString("id-ID")} langkah.`,
          r.value,
          JENIS_GALAT.batas,
          "Kemungkinan perulangan tidak pernah berhenti - periksa kondisinya dan apakah variabelnya berubah.",
        );
      }
      if (!rekam) continue;
      if (langkah.length < maksRekam) langkah.push(mesin.potret(r.value));
      else terpotong = true;
    }
  } catch (e) {
    galat = keGalatKode(e);
  }
  // Langkah penutup: keadaan akhir (berhasil) atau keadaan saat galat di barisnya.
  if (galat) {
    // Langkah terakhir yang terekam adalah baris yang gagal itu sendiri
    // (dipotret SEBELUM dijalankan) — ganti dengan keadaan saat gagal supaya
    // tidak ada dua langkah untuk satu baris. Kalau rekaman sudah terpotong,
    // langkah terakhirnya dari masa lalu, jadi keadaan galat ditambahkan.
    const akhir = mesin.potret(galat.baris);
    if (rekam && !terpotong && langkah.length > 0) langkah[langkah.length - 1] = akhir;
    else langkah.push(akhir);
  } else {
    langkah.push(mesin.potret(null));
  }
  return { langkah, keluaran: mesin.keluaran, galat, terpotong };
}
