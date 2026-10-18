/**
 * Operasi penyuntingan diagram — semuanya murni: diagram lama masuk, diagram
 * BARU keluar (tidak pernah dimutasi), supaya riwayat undo/redo cukup
 * menyimpan objeknya dan React tahu kapan menggambar ulang.
 *
 * Operasi yang ditolak (batas jumlah, sambungan ke diri sendiri) mengembalikan
 * `{ ok: false, pesan }` dan diagram TIDAK berubah — pola yang sama dengan
 * reducer lab lain.
 *
 * Modul netral; diuji `verify-flowchart`.
 */
import { jepret, sisiOtomatis } from "./flowGeometri";
import {
  FLOW_BATAS_KOORDINAT,
  FLOW_MAX_GARIS,
  FLOW_MAX_LABEL,
  FLOW_MAX_SIMPUL,
  FLOW_MAX_TEKS,
  FLOW_MAX_UKURAN,
  FLOW_MIN_UKURAN,
  INFO_JENIS,
  artiLabel,
  type Diagram,
  type Garis,
  type JenisSimpul,
  type Simpul,
  type Sisi,
} from "./flowTypes";

export type HasilEdit = { ok: true; diagram: Diagram; baru: number[] } | { ok: false; pesan: string };

const jepit = (v: number, min: number, maks: number) => Math.min(maks, Math.max(min, v));
const koordinat = (v: number) => jepit(jepret(v), -FLOW_BATAS_KOORDINAT, FLOW_BATAS_KOORDINAT);
const ukuran = (v: number) => jepit(jepret(v), FLOW_MIN_UKURAN, FLOW_MAX_UKURAN);
/**
 * Tepi kiri/atas yang membuat TITIK TENGAH simbol jatuh di grid. Lebar bawaan
 * tiap jenis berbeda (140, 160, 170, …): kalau yang dijepret tepi kirinya,
 * tengah simbol selebar 170 meleset 5px dari simbol selebar 140 di atasnya,
 * dan garis penghubung keduanya berbelok kecil (bug yang dilaporkan pemilik).
 * Garis tersambung di TENGAH sisi, jadi tengahlah yang harus sejajar.
 */
const tepiDariPusat = (tepi: number, besar: number) =>
  jepit(koordinat(tepi + besar / 2) - besar / 2, -FLOW_BATAS_KOORDINAT, FLOW_BATAS_KOORDINAT);
const potongTeks = (s: string, maks: number) => [...s].slice(0, maks).join("");

/** Menambah simpul berpusat di (cx, cy). */
export function tambahSimpul(d: Diagram, jenis: JenisSimpul, cx: number, cy: number): HasilEdit {
  if (d.simpul.length >= FLOW_MAX_SIMPUL) return { ok: false, pesan: `Maksimal ${FLOW_MAX_SIMPUL} simbol per flowchart.` };
  const info = INFO_JENIS[jenis];
  const id = d.nextId;
  const s: Simpul = { id, jenis, x: tepiDariPusat(cx - info.w / 2, info.w), y: tepiDariPusat(cy - info.h / 2, info.h), w: info.w, h: info.h, teks: info.teks };
  return { ok: true, diagram: { ...d, simpul: [...d.simpul, s], nextId: id + 1 }, baru: [id] };
}

/** Menggeser simbol-simbol; titik tengahnya dijepret ke grid (lihat `tepiDariPusat`). */
export function pindahkan(d: Diagram, ids: ReadonlySet<number>, dx: number, dy: number): Diagram {
  if (ids.size === 0 || (dx === 0 && dy === 0)) return d;
  return {
    ...d,
    simpul: d.simpul.map((s) => (ids.has(s.id) ? { ...s, x: tepiDariPusat(s.x + dx, s.w), y: tepiDariPusat(s.y + dy, s.h) } : s)),
  };
}

export function ubahKotak(d: Diagram, id: number, kotak: { x: number; y: number; w: number; h: number }): Diagram {
  return {
    ...d,
    simpul: d.simpul.map((s) =>
      s.id === id ? { ...s, x: koordinat(kotak.x), y: koordinat(kotak.y), w: ukuran(kotak.w), h: ukuran(kotak.h) } : s,
    ),
  };
}

export function ubahTeks(d: Diagram, id: number, teks: string): Diagram {
  const t = potongTeks(teks, FLOW_MAX_TEKS);
  if (!d.simpul.some((s) => s.id === id && s.teks !== t)) return d;
  return { ...d, simpul: d.simpul.map((s) => (s.id === id ? { ...s, teks: t } : s)) };
}

/** Mengganti jenis simbol; teks dipertahankan kecuali masih teks bawaan jenis lama. */
export function ubahJenis(d: Diagram, id: number, jenis: JenisSimpul): Diagram {
  return {
    ...d,
    simpul: d.simpul.map((s) => {
      if (s.id !== id || s.jenis === jenis) return s;
      const teks = s.teks === INFO_JENIS[s.jenis].teks ? INFO_JENIS[jenis].teks : s.teks;
      return { ...s, jenis, teks };
    }),
  };
}

/**
 * Menyambung dua simbol. Garis dari Keputusan diberi label otomatis: "Yes"
 * untuk cabang pertama, "No" untuk yang kedua (bentuk Cambridge; Ya/Tidak tetap
 * diterima bila diketik) — kesalahan paling sering siswa adalah lupa melabeli cabang.
 */
export function sambung(d: Diagram, dari: number, ke: number, dariSisi?: Sisi, keSisi?: Sisi): HasilEdit {
  if (dari === ke) return { ok: false, pesan: "Garis tidak bisa menunjuk simbolnya sendiri." };
  const a = d.simpul.find((s) => s.id === dari);
  const b = d.simpul.find((s) => s.id === ke);
  if (!a || !b) return { ok: false, pesan: "Simbol tidak ditemukan." };
  if (d.garis.length >= FLOW_MAX_GARIS) return { ok: false, pesan: `Maksimal ${FLOW_MAX_GARIS} garis per flowchart.` };
  if (d.garis.some((g) => g.dari === dari && g.ke === ke)) return { ok: false, pesan: "Kedua simbol itu sudah tersambung ke arah ini." };

  const otomatis = sisiOtomatis(a, b);
  let label = "";
  if (a.jenis === "keputusan") {
    const ada = d.garis.filter((g) => g.dari === dari).map((g) => artiLabel(g.label));
    label = !ada.includes("ya") ? "Yes" : !ada.includes("tidak") ? "No" : "";
  }
  const id = d.nextId;
  const g: Garis = { id, dari, ke, dariSisi: dariSisi ?? otomatis.dariSisi, keSisi: keSisi ?? otomatis.keSisi, label };
  return { ok: true, diagram: { ...d, garis: [...d.garis, g], nextId: id + 1 }, baru: [id] };
}

export function ubahGaris(d: Diagram, id: number, ubah: Partial<Pick<Garis, "label" | "dariSisi" | "keSisi">>): Diagram {
  return {
    ...d,
    garis: d.garis.map((g) =>
      g.id === id ? { ...g, ...ubah, label: ubah.label === undefined ? g.label : potongTeks(ubah.label, FLOW_MAX_LABEL) } : g,
    ),
  };
}

/** Membalik arah garis (sisi ikut tertukar). */
export function balikGaris(d: Diagram, id: number): Diagram {
  return {
    ...d,
    garis: d.garis.map((g) => (g.id === id ? { ...g, dari: g.ke, ke: g.dari, dariSisi: g.keSisi, keSisi: g.dariSisi } : g)),
  };
}

/** Menghapus simbol & garis terpilih. Garis yang ujungnya ikut terhapus juga dibuang. */
export function hapus(d: Diagram, simpul: ReadonlySet<number>, garis: ReadonlySet<number>): Diagram {
  if (simpul.size === 0 && garis.size === 0) return d;
  return {
    ...d,
    simpul: d.simpul.filter((s) => !simpul.has(s.id)),
    garis: d.garis.filter((g) => !garis.has(g.id) && !simpul.has(g.dari) && !simpul.has(g.ke)),
  };
}

/**
 * Menggandakan simbol terpilih beserta garis DI ANTARA mereka (garis ke
 * simbol di luar pilihan tidak ikut — ujungnya tidak punya pasangan).
 */
export function duplikat(d: Diagram, ids: ReadonlySet<number>, geser = 30): HasilEdit {
  const asal = d.simpul.filter((s) => ids.has(s.id));
  if (asal.length === 0) return { ok: false, pesan: "Pilih simbol yang akan digandakan." };
  if (d.simpul.length + asal.length > FLOW_MAX_SIMPUL) return { ok: false, pesan: `Maksimal ${FLOW_MAX_SIMPUL} simbol per flowchart.` };
  const dalam = d.garis.filter((g) => ids.has(g.dari) && ids.has(g.ke));
  if (d.garis.length + dalam.length > FLOW_MAX_GARIS) return { ok: false, pesan: `Maksimal ${FLOW_MAX_GARIS} garis per flowchart.` };

  let next = d.nextId;
  const peta = new Map<number, number>();
  const simpulBaru = asal.map((s) => {
    const id = next++;
    peta.set(s.id, id);
    return { ...s, id, x: tepiDariPusat(s.x + geser, s.w), y: tepiDariPusat(s.y + geser, s.h) };
  });
  const garisBaru = dalam.map((g) => ({ ...g, id: next++, dari: peta.get(g.dari)!, ke: peta.get(g.ke)! }));
  return {
    ok: true,
    diagram: { simpul: [...d.simpul, ...simpulBaru], garis: [...d.garis, ...garisBaru], nextId: next },
    baru: simpulBaru.map((s) => s.id),
  };
}
