import ArrayBoard from "./ArrayBoard";
import MatrixBoard, { type SelMatriks } from "./MatrixBoard";
import NdBoard from "./NdBoard";
import CubeBoard from "./CubeBoard";
import ListBoard from "./ListBoard";
import type { LabGroup, LabKit } from "./labKit";
import { applyArrayOp, emptyArrayState, type ArrayLabState, type ArrayOp } from "@/lib/lab/arrayLab";
import { ARRAY_OP_CATALOG, ARRAY_OP_GROUPS, buildArrayOp } from "@/lib/lab/arrayLabCatalog";
import { applyMatrixOp, emptyMatrixState, matrixCols, type MatrixLabState, type MatrixOp } from "@/lib/lab/matrixLab";
import { buildMatrixOp, MATRIX_OP_CATALOG, MATRIX_OP_GROUPS } from "@/lib/lab/matrixLabCatalog";
import { applyNdOp, emptyNdState, ndLabelIndeks, type NdLabState, type NdOp } from "@/lib/lab/ndLab";
import { buildNdOp, ND_OP_CATALOG, ND_OP_GROUPS } from "@/lib/lab/ndLabCatalog";
import { applyCubeOp, cubeDiDalam, cubeLabel, emptyCubeState, type CubeLabState, type CubeOp, type Koord3 } from "@/lib/lab/cubeLab";
import { buildCubeOp, CUBE_OP_CATALOG, CUBE_OP_GROUPS } from "@/lib/lab/cubeLabCatalog";
import { encodeLabSnapshot } from "@/lib/lab/labUrl";
import { applyListOp, emptyListState, urutanList, type ListLabState, type ListOp } from "@/lib/lab/listLab";
import { buildListOp, LIST_OP_CATALOG, LIST_OP_GROUPS } from "@/lib/lab/listLabCatalog";

/**
 * Empat lab array — 1D, 2D, 3D, dan N-dimensi — dalam bentuk yang dimengerti ruang
 * kerja generik (`LabWorkspace`).
 *
 * Masing-masing lab berdiri sendiri dengan kanvas, katalog operasi, dan
 * tautannya sendiri. Sengaja tidak digabung jadi satu papan serba bisa: tiap
 * dimensi mengajarkan hal yang berbeda (deret & penunjuk, kisi & penelusuran,
 * alamat memori & bentuk), dan papan yang mencoba melayani semuanya akan
 * mengajarkan ketiganya setengah-setengah.
 */

/** Path ikon Heroicons outline 24px, ditulis inline seperti sisa repo. */
const IKON = {
  sambung: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244",
  buang: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0",
  urut: "M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21L21 17.25",
  kubus: "M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9",
  kuas: "M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42",
  tambah: "M12 4.5v15m7.5-7.5h-15",
  ujung: "M3 12h18M15 6l6 6-6 6",
  pagar: "M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5",
  tukar: "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
  pin: "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z",
  kisi: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
  bidik: "M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59",
  jejak: "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12",
  putar: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99",
} as const;

function denganIkon<G extends string>(grup: readonly { id: G; label: string }[], ikon: Record<G, string>): LabGroup[] {
  return grup.map((g) => ({ id: g.id, label: g.label, ikon: ikon[g.id] }));
}

// ---------------------------------------------------------------------------
// 1D
// ---------------------------------------------------------------------------

const ISIAN_INDEKS_1D = /^(indeks|a|b|dari|sampai)$/;

export const KIT_ARRAY_1D: LabKit<ArrayLabState, ArrayOp, number> = {
  id: "array1d",
  nama: "1D",
  ringkas: "Satu deret elemen - indeks, penunjuk, dan susun ulang.",
  kosong: emptyArrayState,
  terapkan: applyArrayOp,
  katalog: Object.values(ARRAY_OP_CATALOG),
  grup: denganIkon(ARRAY_OP_GROUPS, {
    isi: IKON.tambah,
    ujung: IKON.ujung,
    indeks: IKON.pagar,
    susun: IKON.tukar,
    penanda: IKON.pin,
    urut: IKON.urut,
  }),
  bangun: buildArrayOp,
  namaOperasi: (op) => ARRAY_OP_CATALOG[op.kind].label,
  Papan: ArrayBoard,
  encode: (state) => encodeLabSnapshot({ lab: "array1d", state }),
  sahkanPilihan: (s, p) => (p !== null && p < s.items.length ? p : null),
  navigasi: (s, p, tombol) => {
    const n = s.items.length;
    if (n === 0) return undefined;
    switch (tombol) {
      case "ArrowLeft":
        return Math.max((p ?? 0) - 1, 0);
      case "ArrowRight":
        return Math.min((p ?? -1) + 1, n - 1);
      case "Home":
        return 0;
      case "End":
        return n - 1;
      default:
        return undefined;
    }
  },
  isianDariPilihan: (p, nama) => (ISIAN_INDEKS_1D.test(nama) ? String(p) : null),
  isianSel: ["indeks", "a", "b", "dari", "sampai"],
  labelPilihan: (p) => `sel ${p}`,
  tombolPilih: [
    ["← →", "pilih sel"],
    ["Home / End", "ujung array"],
  ],
};

// ---------------------------------------------------------------------------
// 2D
// ---------------------------------------------------------------------------

export const KIT_ARRAY_2D: LabKit<MatrixLabState, MatrixOp, SelMatriks> = {
  id: "array2d",
  nama: "2D",
  ringkas: "Kisi baris × kolom - akses arr[i][j], penelusuran, dan transformasi.",
  kosong: emptyMatrixState,
  terapkan: applyMatrixOp,
  katalog: Object.values(MATRIX_OP_CATALOG),
  grup: denganIkon(MATRIX_OP_GROUPS, {
    bentuk: IKON.kisi,
    akses: IKON.bidik,
    penanda: IKON.pin,
    telusur: IKON.jejak,
    ubah: IKON.putar,
    urut: IKON.urut,
  }),
  bangun: buildMatrixOp,
  namaOperasi: (op) => MATRIX_OP_CATALOG[op.kind].label,
  Papan: MatrixBoard,
  encode: (state) => encodeLabSnapshot({ lab: "array2d", state }),
  sahkanPilihan: (s, p) => (p !== null && p.baris < s.rows.length && p.kolom < matrixCols(s) ? p : null),
  navigasi: (s, p, tombol) => {
    const R = s.rows.length;
    const C = matrixCols(s);
    if (R === 0 || C === 0) return undefined;
    // Belum ada pilihan: tombol panah apa pun mulai dari pojok kiri atas,
    // bukan langsung melompat satu sel dari tempat yang tidak terlihat.
    if (p === null) return tombol.startsWith("Arrow") || tombol === "Home" || tombol === "End" ? { baris: 0, kolom: 0 } : undefined;
    switch (tombol) {
      case "ArrowLeft":
        return { baris: p.baris, kolom: Math.max(p.kolom - 1, 0) };
      case "ArrowRight":
        return { baris: p.baris, kolom: Math.min(p.kolom + 1, C - 1) };
      case "ArrowUp":
        return { baris: Math.max(p.baris - 1, 0), kolom: p.kolom };
      case "ArrowDown":
        return { baris: Math.min(p.baris + 1, R - 1), kolom: p.kolom };
      case "Home":
        return { baris: p.baris, kolom: 0 };
      case "End":
        return { baris: p.baris, kolom: C - 1 };
      default:
        return undefined;
    }
  },
  isianDariPilihan: (p, nama) => {
    if (nama === "baris" || nama === "dariBaris" || nama === "sampaiBaris") return String(p.baris);
    if (nama === "kolom" || nama === "dariKolom" || nama === "sampaiKolom") return String(p.kolom);
    return null;
  },
  isianSel: ["baris", "kolom", "dariBaris", "dariKolom", "sampaiBaris", "sampaiKolom"],
  labelPilihan: (p) => `[${p.baris}][${p.kolom}]`,
  tombolPilih: [
    ["← →", "pindah kolom"],
    ["↑ ↓", "pindah baris"],
    ["Home / End", "ujung baris"],
  ],
};

// ---------------------------------------------------------------------------
// 3D
// ---------------------------------------------------------------------------

/** Tombol → [sumbu, arah]. Sumbu 0 lapisan, 1 baris, 2 kolom — arah yang sama dengan kanvasnya. */
const PANAH_3D: Record<string, readonly [0 | 1 | 2, number]> = {
  ArrowLeft: [2, -1],
  ArrowRight: [2, 1],
  ArrowUp: [1, -1],
  ArrowDown: [1, 1],
  PageUp: [0, -1],
  PageDown: [0, 1],
};

export const KIT_ARRAY_3D: LabKit<CubeLabState, CubeOp, Koord3> = {
  id: "array3d",
  nama: "3D",
  ringkas: "Tumpukan lapisan arr[k][i][j] - putar kubusnya, iris, telusuri, dan ubah sudut pandangnya.",
  kosong: emptyCubeState,
  terapkan: applyCubeOp,
  katalog: Object.values(CUBE_OP_CATALOG),
  grup: denganIkon(CUBE_OP_GROUPS, {
    bentuk: IKON.kubus,
    akses: IKON.bidik,
    sorot: IKON.kuas,
    telusur: IKON.jejak,
    ubah: IKON.putar,
    urut: IKON.urut,
  }),
  bangun: buildCubeOp,
  namaOperasi: (op) => CUBE_OP_CATALOG[op.kind].label,
  Papan: CubeBoard,
  encode: (state) => encodeLabSnapshot({ lab: "array3d", state }),
  sahkanPilihan: (s, p) => (p !== null && s.shape[0] > 0 && cubeDiDalam(p, s.shape) ? p : null),
  navigasi: (s, p, tombol) => {
    const arah = PANAH_3D[tombol];
    if (!arah || s.shape[0] === 0) return undefined;
    if (p === null) return [0, 0, 0];
    const [sumbu, d] = arah;
    const baru: [number, number, number] = [p[0], p[1], p[2]];
    baru[sumbu] = Math.min(Math.max(baru[sumbu] + d, 0), s.shape[sumbu] - 1);
    return baru;
  },
  isianDariPilihan: (p, nama) =>
    nama === "lapisan" ? String(p[0]) : nama === "baris" ? String(p[1]) : nama === "kolom" ? String(p[2]) : null,
  isianSel: ["lapisan", "baris", "kolom"],
  labelPilihan: (p) => cubeLabel(p),
  tombolPilih: [
    ["← →", "pindah kolom"],
    ["↑ ↓", "pindah baris"],
    ["PgUp / PgDn", "pindah lapisan"],
  ],
};

// ---------------------------------------------------------------------------
// N-dimensi
// ---------------------------------------------------------------------------

export const KIT_ARRAY_ND: LabKit<NdLabState, NdOp, number[]> = {
  id: "arrayNd",
  nama: "N-D",
  ringkas: "Berapa pun dimensinya - alamat memori, langkah alamat, dan bentuk array.",
  kosong: emptyNdState,
  terapkan: applyNdOp,
  katalog: Object.values(ND_OP_CATALOG),
  grup: denganIkon(ND_OP_GROUPS, {
    bentuk: IKON.kisi,
    akses: IKON.bidik,
    telusur: IKON.jejak,
    ubah: IKON.tukar,
    urut: IKON.urut,
  }),
  bangun: buildNdOp,
  namaOperasi: (op) => ND_OP_CATALOG[op.kind].label,
  Papan: NdBoard,
  encode: (state) => encodeLabSnapshot({ lab: "arrayNd", state }),
  sahkanPilihan: (s, p) =>
    p !== null && p.length === s.shape.length && p.every((v, k) => v < s.shape[k]) ? p : null,
  navigasi: (s, p, tombol) => {
    const d = s.shape.length;
    if (d === 0) return undefined;
    // ←/→ menyusuri sumbu terakhir (sel dalam satu deret), ↑/↓ sumbu
    // sebelumnya (deret dalam satu kisi) — arah yang sama dengan kanvasnya.
    // Sumbu yang lebih luar dipilih lewat klik atau operasi "taruh kursor".
    const sumbu = tombol === "ArrowLeft" || tombol === "ArrowRight" ? d - 1 : tombol === "ArrowUp" || tombol === "ArrowDown" ? d - 2 : -1;
    if (sumbu < 0) return undefined;
    const dasar = p ?? s.shape.map(() => 0);
    if (p === null) return dasar;
    const arah = tombol === "ArrowLeft" || tombol === "ArrowUp" ? -1 : 1;
    const baru = [...dasar];
    baru[sumbu] = Math.min(Math.max(baru[sumbu] + arah, 0), s.shape[sumbu] - 1);
    return baru;
  },
  isianDariPilihan: (p, nama) => (nama === "indeks" ? p.join(", ") : null),
  isianSel: ["indeks"],
  labelPilihan: (p) => ndLabelIndeks(p),
  tombolPilih: [
    ["← →", "sumbu terakhir"],
    ["↑ ↓", "sumbu sebelumnya"],
  ],
};

// ---------------------------------------------------------------------------
// Linked list
// ---------------------------------------------------------------------------

export const KIT_LINKED_LIST: LabKit<ListLabState, ListOp, number> = {
  id: "linkedList",
  nama: "Linked list",
  ringkas: "Simpul-simpul tersebar di memori, disambung pointer next - sisip, hapus, cari, dan balik langkah demi langkah.",
  kosong: emptyListState,
  terapkan: applyListOp,
  katalog: Object.values(LIST_OP_CATALOG),
  grup: denganIkon(LIST_OP_GROUPS, {
    isi: IKON.tambah,
    sisip: IKON.sambung,
    hapus: IKON.buang,
    akses: IKON.bidik,
    susun: IKON.tukar,
  }),
  bangun: buildListOp,
  namaOperasi: (op) => LIST_OP_CATALOG[op.kind].label,
  Papan: ListBoard,
  encode: (state) => encodeLabSnapshot({ lab: "linkedList", state }),
  // Pilihan = INDEKS simpul di rantai (bukan id), supaya tombol "pakai simpul" mengisi isian indeks.
  sahkanPilihan: (s, p) => (p !== null && p < urutanList(s).length ? p : null),
  navigasi: (s, p, tombol) => {
    const n = urutanList(s).length;
    if (n === 0) return undefined;
    switch (tombol) {
      case "ArrowLeft":
        return Math.max((p ?? 0) - 1, 0);
      case "ArrowRight":
        return Math.min((p ?? -1) + 1, n - 1);
      case "Home":
        return 0;
      case "End":
        return n - 1;
      default:
        return undefined;
    }
  },
  isianDariPilihan: (p, nama) => (nama === "indeks" ? String(p) : null),
  isianSel: ["indeks"],
  labelPilihan: (p) => `simpul ${p}`,
  tombolPilih: [
    ["← →", "pindah simpul"],
    ["Home / End", "head / ekor"],
  ],
};
