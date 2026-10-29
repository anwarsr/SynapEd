/**
 * Mesin jalan flowchart: mengeksekusi diagram SATU LANGKAH demi SATU LANGKAH.
 *
 * Fungsi murni — setiap langkah menerima keadaan lama dan mengembalikan
 * keadaan baru (variabel disalin, tidak dimutasi), jadi papan bisa mundur
 * dengan menyimpan riwayat keadaan, dan `verify-flowchart` bisa menjalankan
 * contoh-contoh sampai Selesai tanpa browser.
 *
 * "Aktif" = simpul yang BARU SAJA dijalankan. Narasi menjelaskan apa yang
 * terjadi di simpul itu (variabel yang berubah, cabang yang diambil), sama
 * seperti narasi langkah di lab array.
 *
 * Simbol yang tidak bisa dieksekusi dengan jujur (Dokumen, Data, Subproses
 * berisi nama prosedur) DILEWATI dengan narasi yang mengatakannya — bukan
 * pura-pura dijalankan.
 */
import {
  GalatEkspresi,
  adalahPenugasan,
  evaluasi,
  evaluasiKondisi,
  jalankanPenugasan,
  nilaiMasukan,
  pecahPernyataan,
  tampilNilai,
  uraiIo,
  type Nilai,
} from "./flowEkspresi";
import { INFO_JENIS, artiLabel, ikutAlur, type Diagram, type Garis, type Simpul } from "./flowTypes";

export type StatusJalan = "jalan" | "tunggu-input" | "selesai" | "galat";

export interface KeadaanJalan {
  status: StatusJalan;
  /** Simpul yang baru dijalankan (disorot di kanvas). */
  aktif: number | null;
  /** Garis yang baru dilewati menuju simpul aktif. */
  garisTerakhir: number | null;
  /** Hasil Keputusan terakhir — menentukan cabang yang diambil langkah berikutnya. */
  cabang: "ya" | "tidak" | null;
  vars: ReadonlyArray<readonly [string, Nilai]>;
  keluaran: readonly string[];
  langkah: number;
  narasi: string;
  galat: string | null;
  /** Nama variabel yang sedang ditunggu nilainya (status "tunggu-input"). */
  menunggu: readonly string[] | null;
  /** Nilai masukan yang sudah diberikan di muka dan belum terpakai. */
  antrean: readonly Nilai[];
}

/** Penjaga perulangan tak berujung. */
export const FLOW_MAKS_LANGKAH = 5000;
export const FLOW_MAKS_KELUARAN = 500;

function kutip(s: Simpul): string {
  const t = s.teks.replace(/\s+/g, " ").trim();
  return `“${t.length > 40 ? `${t.slice(0, 40)}…` : t || INFO_JENIS[s.jenis].nama}”`;
}

function galat(k: KeadaanJalan, pesan: string, aktif = k.aktif): KeadaanJalan {
  return { ...k, aktif, status: "galat", galat: pesan, narasi: pesan, menunggu: null };
}

/** Nilai-nilai masukan di muka: "5, 3" atau "5 3" atau satu per baris. Teks berkutip boleh berisi spasi. */
export function uraiAntrean(teks: string): Nilai[] {
  const out: Nilai[] = [];
  const re = /"([^"]*)"|'([^']*)'|([^\s,;]+)/g;
  for (const m of teks.matchAll(re)) out.push(m[1] ?? m[2] ?? nilaiMasukan(m[3]));
  return out;
}

export function mulaiJalan(d: Diagram, masukanAwal = ""): KeadaanJalan {
  const dasar: KeadaanJalan = {
    status: "jalan",
    aktif: null,
    garisTerakhir: null,
    cabang: null,
    vars: [],
    keluaran: [],
    langkah: 0,
    narasi: "",
    galat: null,
    menunggu: null,
    antrean: uraiAntrean(masukanAwal),
  };
  const mulai = d.simpul.filter((s) => s.jenis === "mulai");
  if (mulai.length === 0) return galat(dasar, "Tidak ada simbol Mulai - tambahkan satu sebagai titik awal.");
  if (mulai.length > 1) return galat(dasar, "Ada lebih dari satu simbol Mulai - alur harus punya tepat satu titik awal.");
  return { ...dasar, aktif: mulai[0].id, narasi: `Mulai ${kutip(mulai[0])}.` };
}

/** Garis keluar yang diambil dari simpul aktif, atau pesan galat. */
function garisBerikut(d: Diagram, s: Simpul, cabang: "ya" | "tidak" | null): Garis | string {
  const keluar = d.garis.filter((g) => g.dari === s.id);

  if (s.jenis === "keputusan") {
    const pilih = keluar.filter((g) => artiLabel(g.label) === cabang);
    if (pilih.length === 1) return pilih[0];
    if (pilih.length > 1) return `Keputusan ${kutip(s)} punya lebih dari satu cabang "${cabang === "ya" ? "Yes" : "No"}".`;
    return `Keputusan ${kutip(s)} tidak punya garis berlabel "${cabang === "ya" ? "Yes" : "No"}". Beri label pada garis keluarnya.`;
  }

  if (s.jenis === "konektor" && keluar.length === 0) {
    // Konektor tanpa garis keluar = "lompat ke konektor berlabel sama".
    const tujuan = d.simpul.filter(
      (x) => x.jenis === "konektor" && x.id !== s.id && x.teks.trim() === s.teks.trim() && d.garis.some((g) => g.dari === x.id),
    );
    if (tujuan.length === 1) return { id: -1, dari: s.id, ke: tujuan[0].id, dariSisi: "bawah", keSisi: "atas", label: "" };
    if (tujuan.length === 0) return `Konektor ${kutip(s)} tidak punya pasangan berlabel sama yang melanjutkan alur.`;
    return `Ada lebih dari satu konektor ${kutip(s)} yang melanjutkan alur - labelnya harus unik.`;
  }

  if (keluar.length === 1) return keluar[0];
  if (keluar.length === 0) return `Alur buntu di ${kutip(s)}: tidak ada garis keluar.`;
  return `${kutip(s)} punya ${keluar.length} garis keluar - hanya Keputusan yang boleh bercabang.`;
}

function salinVars(k: KeadaanJalan): Map<string, Nilai> {
  return new Map(k.vars);
}

function ringkasVars(m: Map<string, Nilai>): ReadonlyArray<readonly [string, Nilai]> {
  return [...m.entries()];
}

/** Menjalankan isi simpul `s` (yang baru dimasuki). */
function masuki(d: Diagram, k: KeadaanJalan, s: Simpul, viaGaris: number | null): KeadaanJalan {
  const dasar: KeadaanJalan = { ...k, aktif: s.id, garisTerakhir: viaGaris, cabang: null, langkah: k.langkah + 1 };
  const vars = salinVars(k);

  try {
    switch (s.jenis) {
      case "selesai":
        return { ...dasar, status: "selesai", narasi: `Selesai ${kutip(s)}. Alur berakhir setelah ${dasar.langkah} langkah.` };

      case "mulai":
        return galat(dasar, `Alur kembali ke Mulai ${kutip(s)} - garis tidak boleh masuk ke Mulai.`, s.id);

      case "proses":
      case "persiapan":
      case "subproses": {
        const baris = pecahPernyataan(s.teks);
        if (s.jenis === "subproses" && !baris.every(adalahPenugasan)) {
          return { ...dasar, narasi: `Subproses ${kutip(s)} dijelaskan terpisah, jadi dilewati di sini.` };
        }
        if (baris.length === 0) return { ...dasar, narasi: `${INFO_JENIS[s.jenis].nama} kosong, dilewati.` };
        const hasil = baris.map((b) => jalankanPenugasan(b, vars));
        const cerita = hasil.map((h) => `${h.nama} = ${tampilNilai(h.nilai)}`).join(", ");
        return { ...dasar, vars: ringkasVars(vars), narasi: `${INFO_JENIS[s.jenis].nama} ${kutip(s)} → ${cerita}.` };
      }

      case "io": {
        const io = uraiIo(s.teks);
        if (io.jenis === "output") {
          const teks = io.ekspresi.map((e) => tampilNilai(evaluasi(e, vars))).join(io.pemisah);
          const keluaran = [...k.keluaran, teks].slice(-FLOW_MAKS_KELUARAN);
          return { ...dasar, keluaran, narasi: `OUTPUT → ${teks}` };
        }
        // Input: ambil dari antrean masukan di muka; sisanya ditunggu dari pengguna.
        const antrean = [...k.antrean];
        const terisi: string[] = [];
        for (const nama of io.nama) {
          if (antrean.length === 0) break;
          const v = antrean.shift()!;
          vars.set(nama, v);
          terisi.push(`${nama} = ${tampilNilai(v)}`);
        }
        const sisa = io.nama.slice(terisi.length);
        if (sisa.length > 0) {
          return {
            ...dasar,
            vars: ringkasVars(vars),
            antrean,
            status: "tunggu-input",
            menunggu: sisa,
            narasi: `INPUT ${kutip(s)} - menunggu nilai ${sisa.join(", ")}.`,
          };
        }
        return { ...dasar, vars: ringkasVars(vars), antrean, narasi: `INPUT → ${terisi.join(", ")}.` };
      }

      case "keputusan": {
        const ya = evaluasiKondisi(s.teks, vars);
        return { ...dasar, cabang: ya ? "ya" : "tidak", narasi: `Keputusan ${kutip(s)} → ${ya ? "Yes (benar)" : "No (salah)"}.` };
      }

      case "konektor":
        return { ...dasar, narasi: `Konektor ${kutip(s)}.` };

      default:
        return { ...dasar, narasi: `${INFO_JENIS[s.jenis].nama} ${kutip(s)} tidak memengaruhi variabel, dilewati.` };
    }
  } catch (e) {
    if (e instanceof GalatEkspresi) return galat(dasar, `Di ${kutip(s)}: ${e.message}`, s.id);
    throw e;
  }
}

/** Satu langkah: keluar dari simpul aktif lewat garisnya, lalu jalankan simpul tujuan. */
export function langkahJalan(d: Diagram, k: KeadaanJalan): KeadaanJalan {
  if (k.status !== "jalan" || k.aktif === null) return k;
  if (k.langkah >= FLOW_MAKS_LANGKAH) {
    return galat(k, `Berhenti setelah ${FLOW_MAKS_LANGKAH} langkah - kemungkinan ada perulangan yang tidak pernah berakhir.`);
  }
  const s = d.simpul.find((x) => x.id === k.aktif);
  if (!s) return galat(k, "Simpul yang sedang dijalankan sudah dihapus.");

  const g = garisBerikut(d, s, k.cabang);
  if (typeof g === "string") return galat(k, g);
  const tujuan = d.simpul.find((x) => x.id === g.ke);
  if (!tujuan) return galat(k, "Garis menunjuk simpul yang sudah dihapus.");
  if (!ikutAlur(tujuan.jenis)) return galat(k, `Garis dari ${kutip(s)} masuk ke Catatan - catatan tidak ikut alur.`);
  return masuki(d, k, tujuan, g.id >= 0 ? g.id : null);
}

/** Memberi nilai untuk variabel yang ditunggu. `teks` boleh berisi beberapa nilai sekaligus. */
export function berikanMasukan(k: KeadaanJalan, teks: string): KeadaanJalan {
  if (k.status !== "tunggu-input" || !k.menunggu) return k;
  const nilai = uraiAntrean(teks);
  if (nilai.length === 0) return k;
  const vars = new Map(k.vars);
  const terisi: string[] = [];
  const sisa = [...k.menunggu];
  while (sisa.length > 0 && nilai.length > 0) {
    const nama = sisa.shift()!;
    const v = nilai.shift()!;
    vars.set(nama, v);
    terisi.push(`${nama} = ${tampilNilai(v)}`);
  }
  return {
    ...k,
    vars: ringkasVars(vars),
    status: sisa.length > 0 ? "tunggu-input" : "jalan",
    menunggu: sisa.length > 0 ? sisa : null,
    narasi: `INPUT → ${terisi.join(", ")}.${sisa.length > 0 ? ` Masih menunggu ${sisa.join(", ")}.` : ""}`,
  };
}

/** Menjalankan sampai berhenti (selesai, galat, atau menunggu input). Untuk uji & tombol "Langsung ke akhir". */
export function jalankanSampaiBerhenti(d: Diagram, k: KeadaanJalan): KeadaanJalan {
  let x = k;
  while (x.status === "jalan") x = langkahJalan(d, x);
  return x;
}
