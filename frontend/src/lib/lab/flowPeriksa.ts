/**
 * Pemeriksa aturan flowchart (ANSI/ISO 5807 versi kelas).
 *
 * Hanya PERINGATAN — pengguna tetap boleh menggambar bebas seperti di draw.io.
 * Setiap temuan menyebut simbol/garis yang bersangkutan supaya kanvas bisa
 * menyorotnya. Urutan temuan stabil (urut aturan, lalu id) supaya daftar di
 * panel tidak melompat-lompat saat pengguna menggeser simbol.
 *
 * `galat` = alur tidak akan bisa dijalankan; `saran` = jalan, tetapi
 * menyalahi kebiasaan menggambar flowchart yang baik.
 *
 * Bentuk baku teks = gaya Cambridge (START/STOP, INPUT, OUTPUT, ←, Yes/No,
 * AND/OR/NOT, MOD, <>). Bentuk lain (Baca, Tampilkan, x = 1, Ya/Tidak, dan, …)
 * tetap BERJALAN; yang berbeda hanya dilaporkan sebagai saran "gaya-cambridge"
 * — satu temuan per simbol, berisi semua yang perlu diganti.
 */
import {
  adalahPenugasan,
  bersihkanKondisi,
  gayaEkspresi,
  pecahPernyataan,
  uraiEkspresi,
  uraiIo,
  GalatEkspresi,
} from "./flowEkspresi";
import { INFO_JENIS, artiLabel, ikutAlur, type Diagram, type Simpul } from "./flowTypes";

export type Tingkat = "galat" | "saran";

export interface Temuan {
  kode: string;
  tingkat: Tingkat;
  pesan: string;
  simpul: number[];
  garis: number[];
}

function nama(s: Simpul): string {
  const t = s.teks.replace(/\s+/g, " ").trim();
  return `${INFO_JENIS[s.jenis].nama} “${t.length > 30 ? `${t.slice(0, 30)}…` : t}”`;
}

export function periksaDiagram(d: Diagram): Temuan[] {
  const out: Temuan[] = [];
  const tambah = (kode: string, tingkat: Tingkat, pesan: string, simpul: number[] = [], garis: number[] = []) =>
    out.push({ kode, tingkat, pesan, simpul, garis });

  const alur = d.simpul.filter((s) => ikutAlur(s.jenis));
  if (alur.length === 0) return [];

  const keluar = new Map<number, typeof d.garis>();
  const masuk = new Map<number, typeof d.garis>();
  for (const s of d.simpul) {
    keluar.set(s.id, []);
    masuk.set(s.id, []);
  }
  for (const g of d.garis) {
    keluar.get(g.dari)?.push(g);
    masuk.get(g.ke)?.push(g);
  }

  // ── Titik awal & akhir ────────────────────────────────────────────
  const mulai = alur.filter((s) => s.jenis === "mulai");
  const selesai = alur.filter((s) => s.jenis === "selesai");
  if (mulai.length === 0) tambah("tanpa-mulai", "galat", "Belum ada simbol Mulai. Setiap flowchart punya tepat satu titik awal.");
  if (mulai.length > 1) tambah("mulai-ganda", "galat", `Ada ${mulai.length} simbol Mulai - seharusnya tepat satu.`, mulai.map((s) => s.id));
  if (selesai.length === 0) tambah("tanpa-selesai", "galat", "Belum ada simbol Selesai. Setiap alur harus berakhir.");

  // ── Garis per simbol ──────────────────────────────────────────────
  for (const g of d.garis) {
    if (g.dari === g.ke) tambah("garis-diri", "galat", "Garis menunjuk simbolnya sendiri.", [g.dari], [g.id]);
    const ke = d.simpul.find((s) => s.id === g.ke);
    const dari = d.simpul.find((s) => s.id === g.dari);
    if ((ke && !ikutAlur(ke.jenis)) || (dari && !ikutAlur(dari.jenis))) {
      tambah("garis-catatan", "saran", "Catatan sebaiknya tidak disambung dengan panah alur.", [], [g.id]);
    }
  }

  for (const s of alur) {
    const k = keluar.get(s.id) ?? [];
    const m = masuk.get(s.id) ?? [];
    const kId = k.map((g) => g.id);

    if (s.jenis === "mulai") {
      if (m.length > 0) tambah("masuk-mulai", "galat", `${nama(s)} tidak boleh punya garis masuk.`, [s.id], m.map((g) => g.id));
      if (k.length === 0) tambah("mulai-buntu", "galat", `${nama(s)} belum tersambung ke langkah pertama.`, [s.id]);
      if (k.length > 1) tambah("mulai-cabang", "galat", `${nama(s)} hanya boleh punya satu garis keluar.`, [s.id], kId);
      continue;
    }
    if (s.jenis === "selesai") {
      if (k.length > 0) tambah("keluar-selesai", "galat", `${nama(s)} tidak boleh punya garis keluar.`, [s.id], kId);
      if (m.length === 0) tambah("selesai-terputus", "saran", `${nama(s)} belum dituju garis mana pun.`, [s.id]);
      continue;
    }
    if (s.jenis === "keputusan") {
      if (k.length !== 2) {
        tambah("cabang-keputusan", "galat", `${nama(s)} harus punya tepat 2 garis keluar (Yes dan No); sekarang ${k.length}.`, [s.id], kId);
      } else {
        const arti = k.map((g) => artiLabel(g.label));
        if (arti.includes(null)) {
          tambah(
            "label-keputusan",
            "galat",
            `Garis keluar ${nama(s)} harus berlabel "Yes" dan "No".`,
            [s.id],
            k.filter((g) => artiLabel(g.label) === null).map((g) => g.id),
          );
        } else if (arti[0] === arti[1]) {
          tambah("label-kembar", "galat", `Kedua cabang ${nama(s)} berlabel sama - satu "Yes", satu "No".`, [s.id], kId);
        } else {
          // Ya/Tidak, Benar/Salah, Y/T tetap berjalan; bentuk baku Cambridge Yes/No (atau True/False).
          const takBaku = k.filter((g) => !/^(yes|no|true|false)$/i.test(g.label.trim()));
          if (takBaku.length > 0) {
            tambah(
              "gaya-cambridge",
              "saran",
              `${nama(s)}: label cabang baku Cambridge adalah Yes/No (atau True/False), bukan ${takBaku.map((g) => `"${g.label.trim()}"`).join(" dan ")}.`,
              [s.id],
              takBaku.map((g) => g.id),
            );
          }
        }
      }
    } else if (s.jenis === "konektor") {
      if (!s.teks.trim()) tambah("konektor-kosong", "galat", "Konektor harus berlabel (mis. A) supaya pasangannya jelas.", [s.id]);
      if (k.length === 0) {
        const pasangan = alur.filter(
          (x) => x.jenis === "konektor" && x.id !== s.id && x.teks.trim() === s.teks.trim() && (keluar.get(x.id) ?? []).length > 0,
        );
        if (pasangan.length === 0) tambah("konektor-yatim", "galat", `${nama(s)} tidak punya pasangan berlabel sama yang melanjutkan alur.`, [s.id]);
      }
      if (k.length > 1) tambah("konektor-cabang", "galat", `${nama(s)} hanya boleh punya satu garis keluar.`, [s.id], kId);
    } else {
      if (k.length === 0) tambah("buntu", "galat", `${nama(s)} belum punya garis keluar - alurnya berhenti di sini.`, [s.id]);
      if (k.length > 1) {
        tambah("cabang-liar", "galat", `${nama(s)} punya ${k.length} garis keluar. Untuk bercabang, pakai Keputusan.`, [s.id], kId);
      }
    }

    // Label pada garis bukan-keputusan biasanya salah tempel.
    if (s.jenis !== "keputusan") {
      const berlabel = k.filter((g) => artiLabel(g.label) !== null);
      if (berlabel.length > 0) tambah("label-salah", "saran", `Label Yes/No hanya untuk garis keluar Keputusan.`, [s.id], berlabel.map((g) => g.id));
    }
  }

  // ── Keterjangkauan ───────────────────────────────────────────────
  if (mulai.length === 1) {
    const terjangkau = jangkau(mulai[0].id, keluar, (id) => lompatKonektor(d, id, keluar));
    const tak = alur.filter((s) => !terjangkau.has(s.id) && s.jenis !== "mulai");
    if (tak.length > 0) {
      tambah("tak-terjangkau", "galat", `${tak.length} simbol tidak bisa dicapai dari Mulai.`, tak.map((s) => s.id));
    }

    // Dari setiap simbol yang terjangkau, harus ada jalan menuju Selesai.
    if (selesai.length > 0) {
      const balik = new Map<number, number[]>();
      for (const g of d.garis) balik.set(g.ke, [...(balik.get(g.ke) ?? []), g.dari]);
      // Lompatan konektor juga dihitung sebagai sambungan.
      for (const s of alur) {
        if (s.jenis !== "konektor" || (keluar.get(s.id) ?? []).length > 0) continue;
        for (const t of lompatKonektor(d, s.id, keluar)) balik.set(t, [...(balik.get(t) ?? []), s.id]);
      }
      const menujuAkhir = new Set<number>();
      const antre = selesai.map((s) => s.id);
      for (const id of antre) menujuAkhir.add(id);
      while (antre.length > 0) {
        const id = antre.shift()!;
        for (const p of balik.get(id) ?? []) {
          if (!menujuAkhir.has(p)) {
            menujuAkhir.add(p);
            antre.push(p);
          }
        }
      }
      const terkurung = alur.filter((s) => terjangkau.has(s.id) && !menujuAkhir.has(s.id));
      if (terkurung.length > 0) {
        tambah(
          "tanpa-akhir",
          "galat",
          `${terkurung.length} simbol tidak punya jalan menuju Selesai (perulangan tanpa jalan keluar atau alur buntu).`,
          terkurung.map((s) => s.id),
        );
      }
    }
  }

  // ── Isi teks ─────────────────────────────────────────────────────
  for (const s of alur) {
    const t = s.teks.trim();
    if (!t && s.jenis !== "mulai" && s.jenis !== "selesai") {
      tambah("teks-kosong", "saran", `${INFO_JENIS[s.jenis].nama} belum diberi teks.`, [s.id]);
      continue;
    }
    // Teks yang tidak akan bisa dijalankan — saran, karena flowchart juga sah sebagai gambar.
    const sebab = sebabTakJalan(s);
    if (sebab) tambah("tak-bisa-dijalankan", "saran", `${nama(s)}: ${sebab}`, [s.id]);
    else {
      const gaya = saranGaya(s);
      if (gaya.length > 0) tambah("gaya-cambridge", "saran", `${nama(s)}: bentuk baku Cambridge - ${gaya.join("; ")}.`, [s.id]);
    }
  }

  const urutan = (t: Temuan) => (t.tingkat === "galat" ? 0 : 1);
  return out
    .map((t, i) => ({ t, i }))
    .sort((a, b) => urutan(a.t) - urutan(b.t) || a.i - b.i)
    .map((x) => x.t);
}

/** Konektor tanpa garis keluar melompat ke konektor berlabel sama yang punya garis keluar. */
function lompatKonektor(d: Diagram, id: number, keluar: Map<number, Diagram["garis"]>): number[] {
  const s = d.simpul.find((x) => x.id === id);
  if (!s || s.jenis !== "konektor" || (keluar.get(id) ?? []).length > 0) return [];
  return d.simpul
    .filter((x) => x.jenis === "konektor" && x.id !== id && x.teks.trim() === s.teks.trim() && (keluar.get(x.id) ?? []).length > 0)
    .map((x) => x.id);
}

function jangkau(awal: number, keluar: Map<number, Diagram["garis"]>, lompat: (id: number) => number[]): Set<number> {
  const lihat = new Set<number>([awal]);
  const antre = [awal];
  while (antre.length > 0) {
    const id = antre.shift()!;
    for (const t of [...(keluar.get(id) ?? []).map((g) => g.ke), ...lompat(id)]) {
      if (!lihat.has(t)) {
        lihat.add(t);
        antre.push(t);
      }
    }
  }
  return lihat;
}

/** Penjelasan mengapa teks simbol tidak akan bisa dijalankan, atau null. */
export function sebabTakJalan(s: Simpul): string | null {
  try {
    switch (s.jenis) {
      case "proses":
      case "persiapan":
        for (const b of pecahPernyataan(s.teks)) {
          if (!adalahPenugasan(b)) return `"${b}" belum bisa dijalankan - tulis sebagai penugasan, mis. X ← X + 1.`;
          uraiEkspresi(b.replace(/^[^=←:+\-*/<]*(\+\+|--|\+=|-=|\*=|\/=|:=|←|<-|=)/, "").trim() || "0");
        }
        return null;
      case "io":
        uraiIo(s.teks);
        return null;
      case "keputusan":
        uraiEkspresi(bersihkanKondisi(s.teks));
        return null;
      default:
        return null;
    }
  } catch (e) {
    return e instanceof GalatEkspresi ? e.message : null;
  }
}

/** Operator penugasan selain `←` (dan `<-`, cara mengetiknya). */
const RE_TUGAS_TAK_BAKU = /^([A-Za-z_][A-Za-z0-9_]*)\s*(\+\+|--|\+=|-=|\*=|\/=|:=|=(?!=))/;

/**
 * Bagian teks simbol yang berbeda dari bentuk baku Cambridge. Hanya dipanggil
 * untuk teks yang SUDAH bisa dijalankan (galat sintaks dilaporkan lebih dulu).
 */
export function saranGaya(s: Simpul): string[] {
  const t = s.teks.trim();
  const out: string[] = [];
  switch (s.jenis) {
    case "mulai":
      if (t && !/^start$/i.test(t)) out.push(`tulis START, bukan "${t}"`);
      break;
    case "selesai":
      if (t && !/^stop$/i.test(t)) out.push(`tulis STOP, bukan "${t}"`);
      break;
    case "io": {
      const io = uraiIo(t);
      if (io.jenis === "input") {
        if (io.kata !== "INPUT") out.push(`tulis INPUT, bukan "${io.kata}"`);
        if (io.nama.length > 1) out.push("satu INPUT untuk satu variabel");
      } else {
        if (io.kata !== "OUTPUT") out.push(`tulis OUTPUT, bukan "${io.kata}"`);
        for (const e of io.ekspresi) out.push(...gayaEkspresi(e));
      }
      break;
    }
    case "proses":
    case "persiapan":
      for (const b of pecahPernyataan(t)) {
        const m = RE_TUGAS_TAK_BAKU.exec(b);
        if (m) out.push(`penugasan memakai ← (ketik <-), bukan "${m[2]}": ${m[1]} ← …`);
        const kanan = b.replace(/^[^=←:+\-*/<]*(\+\+|--|\+=|-=|\*=|\/=|:=|←|<-|=)/, "").trim();
        if (kanan) out.push(...gayaEkspresi(kanan));
      }
      break;
    case "keputusan":
      out.push(...gayaEkspresi(bersihkanKondisi(t)));
      break;
  }
  return [...new Set(out)];
}
