/**
 * Lab Stack (LIFO) berbasis array: model, reducer, dan penghasil langkah.
 *
 * Modul NETRAL — tanpa `"use client"`, tanpa `server-only`, tanpa impor `@/`.
 *
 * Modelnya sama dengan silabus Cambridge 9618: array berukuran tetap
 * `Stack[0 : MaxSize-1]` dan satu penunjuk `TopPointer` (-1 = kosong). Setiap
 * langkah mengikuti SATU pernyataan pseudocode di `stackKode.ts` (baris yang
 * disorot dibawa `LabStep.kode`), dan `verify-stack-queue` menjalankan
 * pseudocode itu untuk membuktikan reducer ini menghasilkan hal yang sama.
 *
 * Yang sengaja diperlihatkan:
 * - PUSH menaikkan TopPointer DULU, baru menulis; POP membaca dulu, baru
 *   menurunkan TopPointer.
 * - Nilai yang di-pop TETAP tertinggal di sel memorinya (array sungguhan tidak
 *   menghapus apa pun) - papan menggambarnya pudar sebagai sisa di luar stack.
 * - Overflow & underflow bukan galat lab: itu pelajaran, jadi tetap dijalankan
 *   sebagai langkah dengan keluaran OUTPUT-nya.
 */
import { mulberry32 } from "./labRandom";
import { LAB_MOVE_HOLD_MS, LAB_STEP_HOLD_MS, LAB_VISIT_HOLD_MS, type LabOpResult, type LabPeran, type LabStep } from "./labTypes";
import {
  ADT_KAPASITAS_AWAL,
  ADT_MAX_KAPASITAS,
  ADT_MAX_LANGKAH,
  ADT_MAX_MASUKAN,
  ADT_MIN_KAPASITAS,
  ADT_NILAI_RE,
  nilaiSah,
  pecahNilai,
  pitaKe,
  type PitaAdt,
  type SelAdt,
} from "./adtBersama";
import { barisBalik, barisKurung, barisStack, barisUndo } from "./stackKode";

export interface StackLabState {
  kapasitas: number;
  /** Panjang = kapasitas. null = sel yang belum pernah ditulis. */
  memori: (SelAdt | null)[];
  /** TopPointer: indeks puncak, -1 = kosong. Isi stack = memori[0..top]. */
  top: number;
  nextId: number;
  /** Nilai yang terakhir dikembalikan (Pop/Peek/IsEmpty/IsFull); hanya untuk tampilan. */
  item: string | null;
  /** Baris OUTPUT pseudocode selama operasi terakhir (overflow, underflow, …). */
  keluaran: string[];
  /** Penerapan yang sedang dijalankan, atau null. */
  pita: PitaAdt | null;
}

export type StackStep = LabStep<StackLabState>;
export type StackOpResult = LabOpResult<StackLabState>;

export type StackOp =
  | { kind: "isiDariTeks"; teks: string }
  | { kind: "acak"; panjang: number; maks: number; benih: number }
  | { kind: "kosongkan" }
  | { kind: "kapasitas"; kapasitas: number }
  | { kind: "push"; nilai: string }
  | { kind: "pop" }
  | { kind: "peek" }
  | { kind: "isEmpty" }
  | { kind: "isFull" }
  | { kind: "cekKurung"; teks: string }
  | { kind: "balikKata"; kata: string }
  | { kind: "undo"; kejadian: string };

export const OUT_PENUH = "Stack penuh (overflow)";
export const OUT_KOSONG = "Stack kosong (underflow)";
export const OUT_TAK_ADA_UNDO = "Tidak ada yang bisa dibatalkan";

export function emptyStackState(kapasitas = ADT_KAPASITAS_AWAL): StackLabState {
  return { kapasitas, memori: Array.from({ length: kapasitas }, () => null), top: -1, nextId: 0, item: null, keluaran: [], pita: null };
}

/** Stack berisi `nilai` (bawah → atas) di array berkapasitas `kapasitas`; id 0..n−1. */
export function stackStateFromValues(nilai: readonly string[], kapasitas: number, sisa: readonly (string | null)[] = []): StackLabState {
  const memori: (SelAdt | null)[] = Array.from({ length: kapasitas }, (_, i) => {
    const v = i < nilai.length ? nilai[i] : (sisa[i] ?? null);
    return v === null ? null : { id: i, nilai: v };
  });
  return { kapasitas, memori, top: nilai.length - 1, nextId: kapasitas, item: null, keluaran: [], pita: null };
}

/** Isi stack dari bawah ke atas. */
export function isiStack(s: StackLabState): SelAdt[] {
  return s.memori.slice(0, s.top + 1).filter((x): x is SelAdt => x !== null);
}

export const kodeIdStack = (kap: number) => `stack:${kap}`;

/**
 * Keadaan "rapi": syarat keadaan akhir setiap operasi dan keadaan dari URL.
 * Langkah tengah PUSH boleh punya TopPointer yang menunjuk sel belum ditulis.
 */
export function assertStackInvariants(s: StackLabState): string | null {
  if (!Number.isInteger(s.kapasitas) || s.kapasitas < ADT_MIN_KAPASITAS || s.kapasitas > ADT_MAX_KAPASITAS) return `Kapasitas ${s.kapasitas} tidak sah.`;
  if (s.memori.length !== s.kapasitas) return "Panjang memori tidak sama dengan kapasitas.";
  if (!Number.isInteger(s.top) || s.top < -1 || s.top > s.kapasitas - 1) return `TopPointer ${s.top} di luar array.`;
  const ids = new Set<number>();
  for (let i = 0; i < s.memori.length; i++) {
    const c = s.memori[i];
    if (c === null) {
      if (i <= s.top) return `Stack[${i}] kosong padahal di bawah TopPointer.`;
      continue;
    }
    if (!ADT_NILAI_RE.test(c.nilai)) return `Nilai "${c.nilai}" tidak sah.`;
    if (ids.has(c.id) || c.id >= s.nextId) return `Id ${c.id} ganda atau tidak lebih kecil dari nextId.`;
    ids.add(c.id);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Penolong langkah
// ---------------------------------------------------------------------------

interface OpsiLangkah {
  fokus?: number[];
  kode?: { id: string; dari: number; sampai?: number };
  tahan?: number;
  peran?: Record<number, LabPeran>;
}

function langkah(state: StackLabState, narasi: string, o: OpsiLangkah = {}): StackStep {
  return {
    state,
    narasi,
    fokus: o.fokus ?? [],
    tahanMs: o.tahan ?? LAB_STEP_HOLD_MS,
    ...(o.peran ? { peran: o.peran } : {}),
    ...(o.kode ? { kode: { id: o.kode.id, dari: o.kode.dari, sampai: o.kode.sampai ?? o.kode.dari } } : {}),
  };
}

function ok(steps: StackStep[]): StackOpResult {
  return { ok: true, steps: steps.slice(0, ADT_MAX_LANGKAH) };
}

const gagal = (error: string): StackOpResult => ({ ok: false, error });

/** Keadaan awal operasi: hasil & pita operasi sebelumnya dibuang. */
const bersih = (s: StackLabState): StackLabState => ({ ...s, memori: [...s.memori], item: null, keluaran: [], pita: null });

/** Satu PUSH yang sah (tidak penuh) pada salinan; dikembalikan keadaan baru. */
function pushSatu(s: StackLabState, nilai: string): StackLabState {
  const memori = [...s.memori];
  memori[s.top + 1] = { id: s.nextId, nilai };
  return { ...s, memori, top: s.top + 1, nextId: s.nextId + 1 };
}

function popSatu(s: StackLabState): { state: StackLabState; nilai: string } {
  const nilai = s.memori[s.top]!.nilai;
  return { state: { ...s, top: s.top - 1, item: nilai }, nilai };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function applyStackOp(s0: StackLabState, op: StackOp): StackOpResult {
  const s = bersih(s0);
  const kap = s.kapasitas;
  const B = barisStack(kap);
  const id = kodeIdStack(kap);

  switch (op.kind) {
    case "isiDariTeks": {
      const nilai = pecahNilai(op.teks);
      if (nilai.length === 0) return gagal("Tulis minimal satu nilai.");
      if (nilai.length > kap) return gagal(`Stack berkapasitas ${kap}; ${nilai.length} nilai tidak muat. Perbesar kapasitasnya dulu.`);
      const salah = nilai.find((v) => nilaiSah(v) === null);
      if (salah !== undefined) return gagal(`Nilai "${salah}" tidak sah: 1-6 huruf, angka, titik, atau minus.`);
      const baru = stackStateFromValues(nilai, kap);
      return ok([
        langkah(baru, `Stack diisi ${nilai.length} nilai lewat PUSH berturut-turut: ${nilai[0]} paling bawah, ${nilai[nilai.length - 1]} di puncak (TopPointer = ${baru.top}).`, {
          fokus: [baru.top],
        }),
      ]);
    }

    case "acak": {
      if (!Number.isInteger(op.panjang) || op.panjang < 1 || op.panjang > kap) return gagal(`Panjang harus 1 sampai ${kap} (kapasitas stack).`);
      if (!Number.isInteger(op.maks) || op.maks < 1 || op.maks > 999) return gagal("Nilai terbesar harus 1 sampai 999.");
      if (!Number.isInteger(op.benih) || op.benih < 0) return gagal("Benih acak harus bilangan bulat 0 atau lebih.");
      const acak = mulberry32(op.benih);
      const nilai = Array.from({ length: op.panjang }, () => String(Math.floor(acak() * (op.maks + 1))));
      const baru = stackStateFromValues(nilai, kap);
      return ok([langkah(baru, `Stack diisi ${op.panjang} angka acak; ${nilai[nilai.length - 1]} di puncak.`, { fokus: [baru.top] })]);
    }

    case "kosongkan": {
      const baru = { ...s, top: -1 };
      const sisa = s.top >= 0;
      return ok([
        langkah(baru, `TopPointer ${"←"} -1: stack kosong.${sisa ? " Nilai lama tetap tertinggal di memori, tetapi sudah di luar stack dan akan ditimpa PUSH berikutnya." : ""}`, {
          kode: { id, dari: B.kosongkan },
        }),
      ]);
    }

    case "kapasitas": {
      const n = op.kapasitas;
      if (!Number.isInteger(n) || n < ADT_MIN_KAPASITAS || n > ADT_MAX_KAPASITAS) return gagal(`Kapasitas harus ${ADT_MIN_KAPASITAS} sampai ${ADT_MAX_KAPASITAS}.`);
      if (n < s.top + 1) return gagal(`Stack berisi ${s.top + 1} nilai; kapasitas tidak bisa lebih kecil dari itu.`);
      if (n === kap) return gagal(`Kapasitas sudah ${n}.`);
      const memori = Array.from({ length: n }, (_, i) => (i < kap ? s.memori[i] : null));
      const baru = { ...s, kapasitas: n, memori };
      return ok([
        langkah(baru, `Array dibuat ulang: Stack[0:${n - 1}], MaxSize = ${n}. Isi stack tetap di tempatnya (TopPointer = ${s.top}).`, {
          kode: { id: kodeIdStack(n), dari: 1, sampai: 3 },
        }),
      ]);
    }

    case "push": {
      const v = nilaiSah(op.nilai);
      if (v === null) return gagal("Nilai tidak sah: 1-6 huruf, angka, titik, atau minus.");
      const steps: StackStep[] = [
        langkah(s, `PUSH ${v}: periksa dulu apakah stack penuh - TopPointer = ${s.top}, MaxSize - 1 = ${kap - 1}.`, {
          fokus: s.top >= 0 ? [s.top] : [],
          kode: { id, dari: B.pushCek },
        }),
      ];
      if (s.top === kap - 1) {
        steps.push(
          langkah({ ...s, keluaran: [OUT_PENUH] }, `Stack penuh (overflow): TopPointer sudah di indeks terakhir, jadi ${v} tidak bisa masuk. Isi stack tidak berubah.`, {
            fokus: [s.top],
            kode: { id, dari: B.pushPenuh },
          }),
        );
        return ok(steps);
      }
      const t = s.top + 1;
      const lama = s.memori[t];
      const naik = { ...s, top: t };
      steps.push(
        langkah(naik, `TopPointer ${"←"} TopPointer + 1 = ${t}.${lama ? ` Stack[${t}] masih berisi sisa ${lama.nilai} - akan ditimpa.` : ""}`, {
          fokus: [t],
          kode: { id, dari: B.pushNaik },
          ...(lama ? { peran: { [lama.id]: "luar" as LabPeran } } : {}),
        }),
      );
      const akhir = pushSatu(s, v);
      steps.push(
        langkah(akhir, `Stack[${t}] ${"←"} ${v}: ${v} sekarang di puncak stack.`, { fokus: [t], kode: { id, dari: B.pushTulis }, tahan: LAB_MOVE_HOLD_MS }),
      );
      return ok(steps);
    }

    case "pop":
    case "peek": {
      const pop = op.kind === "pop";
      const nama = pop ? "POP" : "PEEK";
      const steps: StackStep[] = [
        langkah(s, `${nama}: periksa dulu apakah stack kosong - TopPointer = ${s.top}.`, {
          fokus: s.top >= 0 ? [s.top] : [],
          kode: { id, dari: pop ? B.popCek : B.peekCek },
        }),
      ];
      if (s.top === -1) {
        steps.push(
          langkah({ ...s, keluaran: [OUT_KOSONG], item: "" }, `Stack kosong (underflow): tidak ada yang bisa ${pop ? "diambil" : "dilihat"}; fungsi mengembalikan teks kosong.`, {
            kode: { id, dari: pop ? B.popKosong : B.peekKosong, sampai: (pop ? B.popKosong : B.peekKosong) + 1 },
          }),
        );
        return ok(steps);
      }
      const t = s.top;
      const sel = s.memori[t]!;
      if (!pop) {
        steps.push(
          langkah({ ...s, item: sel.nilai }, `Peek mengembalikan ${sel.nilai} tanpa mengubah TopPointer - ${sel.nilai} tetap di puncak.`, {
            fokus: [t],
            kode: { id, dari: B.peekKembali },
            peran: { [sel.id]: "hasil" },
          }),
        );
        return ok(steps);
      }
      steps.push(
        langkah({ ...s, item: sel.nilai }, `Item ${"←"} Stack[${t}]: ambil ${sel.nilai} dari puncak.`, {
          fokus: [t],
          kode: { id, dari: B.popBaca },
          peran: { [sel.id]: "hapus" },
        }),
      );
      const { state: turun } = popSatu(s);
      steps.push(
        langkah(turun, `TopPointer ${"←"} TopPointer - 1 = ${t - 1}. ${sel.nilai} keluar dari stack; nilainya masih tertinggal di Stack[${t}] sebagai sisa.`, {
          fokus: [t],
          kode: { id, dari: B.popTurun },
          tahan: LAB_MOVE_HOLD_MS,
        }),
      );
      steps.push(langkah(turun, `RETURN Item: Pop mengembalikan ${sel.nilai}.`, { kode: { id, dari: B.popKembali } }));
      return ok(steps);
    }

    case "isEmpty":
    case "isFull": {
      const kosong = op.kind === "isEmpty";
      const benar = kosong ? s.top === -1 : s.top === kap - 1;
      const syarat = kosong ? "TopPointer = -1" : `TopPointer = MaxSize - 1 (${kap - 1})`;
      return ok([
        langkah({ ...s, item: benar ? "TRUE" : "FALSE" }, `${kosong ? "IsEmpty" : "IsFull"}: TopPointer = ${s.top}, jadi ${syarat} bernilai ${benar ? "TRUE" : "FALSE"} - stack ${kosong ? (benar ? "kosong" : "tidak kosong") : benar ? "penuh" : "belum penuh"}.`, {
          fokus: s.top >= 0 ? [s.top] : [],
          kode: { id, dari: kosong ? B.isEmpty : B.isFull },
        }),
      ]);
    }

    case "cekKurung":
      return cekKurung(s, op.teks);
    case "balikKata":
      return balikKata(s, op.kata);
    case "undo":
      return riwayatUndo(s, op.kejadian);

    default: {
      const _lengkap: never = op;
      return gagal(`Operasi tidak dikenal: ${String((_lengkap as { kind: string }).kind)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Penerapan
// ---------------------------------------------------------------------------

const BUKA = "([{";
const TUTUP = ")]}";
const pasangan = (buka: string, tutup: string) => BUKA.indexOf(buka) >= 0 && BUKA.indexOf(buka) === TUTUP.indexOf(tutup);

function cekKurung(s0: StackLabState, teksRaw: string): StackOpResult {
  const teks = typeof teksRaw === "string" ? teksRaw.replace(/\s+/g, "") : "";
  if (teks.length === 0) return gagal("Tulis ekspresi berkurung, mis. {[()]}.");
  if (teks.length > ADT_MAX_MASUKAN) return gagal(`Paling panjang ${ADT_MAX_MASUKAN} karakter (tanpa spasi).`);
  if (/[,:~;%&#?]/.test(teks)) return gagal("Hanya huruf, angka, kurung, dan operator + - * / yang bisa diperiksa.");
  const B = barisKurung();
  const id = "kurung";
  let s: StackLabState = { ...s0, top: -1, pita: { judul: "Cek kurung seimbang", token: [...teks], posisi: -1, hasil: "", simpulan: null } };
  const steps: StackStep[] = [langkah(s, "Stack dikosongkan (TopPointer ← -1), lalu ekspresi dibaca karakter demi karakter dari kiri.", { kode: { id, dari: B.mulai } })];
  const pita = () => s.pita!;
  const selesai = (baik: boolean, teksHasil: string, narasi: string, dari: number, i: number) => {
    s = { ...s, pita: pitaKe(pita(), i, { simpulan: { baik, teks: teksHasil } }) };
    steps.push(langkah(s, narasi, { kode: { id, dari }, fokus: s.top >= 0 ? [s.top] : [] }));
    return ok(steps);
  };

  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    s = { ...s, pita: pitaKe(pita(), i) };
    if (BUKA.includes(c)) {
      if (s.top === s.kapasitas - 1) {
        s = { ...s, keluaran: [...s.keluaran, OUT_PENUH] };
        return selesai(false, "Stack penuh", `${c} adalah kurung buka, tetapi stack penuh (overflow) - kurungnya terlalu bersarang untuk kapasitas ${s.kapasitas}. Perbesar kapasitas lalu coba lagi.`, B.buka, i);
      }
      s = pushSatu(s, c);
      steps.push(langkah(s, `${c} kurung buka: PUSH - ia menunggu pasangannya di puncak stack.`, { fokus: [s.top], kode: { id, dari: B.buka }, tahan: LAB_MOVE_HOLD_MS }));
    } else if (TUTUP.includes(c)) {
      if (s.top === -1) {
        return selesai(false, "Tidak seimbang", `${c} kurung tutup, tetapi stack kosong - tidak ada kurung buka yang menunggu. TIDAK seimbang.`, B.gagalKosong, i);
      }
      const atas = s.memori[s.top]!;
      const { state } = popSatu(s);
      s = { ...state, pita: s.pita };
      steps.push(langkah(s, `${c} kurung tutup: POP mengambil ${atas.nilai} dari puncak.`, { fokus: [s.top + 1], kode: { id, dari: B.ambil }, peran: { [atas.id]: "hapus" }, tahan: LAB_MOVE_HOLD_MS }));
      if (!pasangan(atas.nilai, c)) {
        return selesai(false, "Tidak seimbang", `${atas.nilai} bukan pasangan ${c} - TIDAK seimbang.`, B.gagalCocok, i);
      }
      steps.push(langkah(s, `${atas.nilai} dan ${c} berpasangan - lanjut.`, { kode: { id, dari: B.cocok }, tahan: LAB_VISIT_HOLD_MS }));
    } else {
      steps.push(langkah(s, `${c} bukan kurung - dilewati.`, { kode: { id, dari: B.baca }, tahan: LAB_VISIT_HOLD_MS }));
    }
  }
  return s.top === -1
    ? selesai(true, "Seimbang", "Semua karakter terbaca dan stack kosong: setiap kurung buka mendapat pasangannya. SEIMBANG.", B.akhir, teks.length)
    : selesai(false, "Tidak seimbang", `Semua karakter terbaca, tetapi stack masih berisi ${s.top + 1} kurung buka tanpa pasangan. TIDAK seimbang.`, B.akhir, teks.length);
}

function balikKata(s0: StackLabState, kataRaw: string): StackOpResult {
  const kata = typeof kataRaw === "string" ? kataRaw.trim() : "";
  if (!/^[A-Za-z0-9]+$/.test(kata)) return gagal("Kata hanya boleh huruf dan angka, tanpa spasi.");
  if (kata.length > s0.kapasitas) return gagal(`Kata ${kata.length} huruf tidak muat di stack berkapasitas ${s0.kapasitas}. Perbesar kapasitas atau pendekkan kata.`);
  const B = barisBalik();
  const id = "balik";
  let s: StackLabState = { ...s0, top: -1, pita: { judul: "Balik kata", token: [...kata], posisi: -1, hasil: "", simpulan: null } };
  const steps: StackStep[] = [langkah(s, `Stack dikosongkan, lalu setiap huruf ${kata} di-PUSH dari kiri ke kanan.`, { kode: { id, dari: B.mulai } })];
  for (let i = 0; i < kata.length; i++) {
    s = pushSatu({ ...s, pita: pitaKe(s.pita!, i) }, kata[i]);
    steps.push(langkah(s, `PUSH ${kata[i]}.`, { fokus: [s.top], kode: { id, dari: B.push }, tahan: LAB_VISIT_HOLD_MS }));
  }
  s = { ...s, pita: pitaKe(s.pita!, kata.length) };
  steps.push(langkah(s, `Semua huruf masuk; ${kata[kata.length - 1]} - huruf TERAKHIR - kini di puncak. Sekarang POP sampai stack kosong.`, { kode: { id, dari: B.awalHasil } }));
  let hasil = "";
  while (s.top >= 0) {
    const atas = s.memori[s.top]!;
    const { state } = popSatu(s);
    hasil += atas.nilai;
    s = { ...state, pita: pitaKe(s.pita!, kata.length, { hasil }) };
    steps.push(langkah(s, `POP ${atas.nilai} → hasil "${hasil}".`, { fokus: [s.top + 1], kode: { id, dari: B.pop }, peran: { [atas.id]: "hapus" }, tahan: LAB_VISIT_HOLD_MS }));
  }
  s = { ...s, pita: pitaKe(s.pita!, kata.length, { simpulan: { baik: true, teks: hasil } }) };
  steps.push(langkah(s, `Stack kosong: ${kata} terbalik menjadi ${hasil}. Yang masuk terakhir keluar pertama (LIFO).`, { kode: { id, dari: B.akhir } }));
  return ok(steps);
}

/**
 * Riwayat ketikan dengan undo. Kejadian dipisah spasi: kata = ketik (PUSH),
 * `<` = batalkan (POP). Teks dokumen = isi stack dari bawah ke atas.
 */
function riwayatUndo(s0: StackLabState, kejadianRaw: string): StackOpResult {
  const token = (typeof kejadianRaw === "string" ? kejadianRaw : "").split(/\s+/).filter(Boolean);
  if (token.length === 0) return gagal("Tulis kejadian dipisah spasi: kata = ketik, < = batalkan. Mis. Saya suka kopi < teh");
  if (token.length > ADT_MAX_MASUKAN) return gagal(`Paling banyak ${ADT_MAX_MASUKAN} kejadian.`);
  const salah = token.find((t) => t !== "<" && !/^[A-Za-z0-9]{1,6}$/.test(t));
  if (salah !== undefined) return gagal(`"${salah}" tidak sah: kata 1-6 huruf/angka, atau < untuk batalkan.`);
  const B = barisUndo();
  const id = "undo";
  const dokumen = (x: StackLabState) => isiStack(x).map((c) => c.nilai).join(" ");
  let s: StackLabState = { ...s0, top: -1, pita: { judul: "Riwayat ketikan (undo)", token, posisi: -1, hasil: "", simpulan: null } };
  const steps: StackStep[] = [langkah(s, "Dokumen kosong dan stack riwayat kosong. Setiap kata yang diketik di-PUSH; tombol batalkan (<) mem-POP kata terakhir.")];
  token.forEach((t, i) => {
    s = { ...s, pita: pitaKe(s.pita!, i) };
    if (t !== "<") {
      if (s.top === s.kapasitas - 1) {
        s = { ...s, keluaran: [...s.keluaran, OUT_PENUH] };
        steps.push(langkah(s, `Ketik ${t}: stack riwayat penuh (overflow) - kata ini tidak tercatat.`, { fokus: [s.top], kode: { id, dari: B.ketik } }));
        return;
      }
      s = pushSatu(s, t);
      s = { ...s, pita: pitaKe(s.pita!, i, { hasil: dokumen(s) }) };
      steps.push(langkah(s, `Ketik ${t}: PUSH ke riwayat. Dokumen: "${dokumen(s)}".`, { fokus: [s.top], kode: { id, dari: B.ketik }, tahan: LAB_MOVE_HOLD_MS }));
      return;
    }
    if (s.top === -1) {
      s = { ...s, keluaran: [...s.keluaran, OUT_TAK_ADA_UNDO] };
      steps.push(langkah(s, "Batalkan: stack riwayat kosong - tidak ada yang bisa dibatalkan.", { kode: { id, dari: B.kosong } }));
      return;
    }
    const atas = s.memori[s.top]!;
    const { state } = popSatu(s);
    s = { ...state, keluaran: [...s.keluaran, `Dibatalkan: ${atas.nilai}`], pita: s.pita };
    s = { ...s, pita: pitaKe(s.pita!, i, { hasil: dokumen(s) }) };
    steps.push(langkah(s, `Batalkan: POP ${atas.nilai} - kata TERAKHIR yang diketik hilang lebih dulu. Dokumen: "${dokumen(s)}".`, {
      fokus: [s.top + 1],
      kode: { id, dari: B.ambil, sampai: B.lapor },
      peran: { [atas.id]: "hapus" },
      tahan: LAB_MOVE_HOLD_MS,
    }));
  });
  s = { ...s, pita: pitaKe(s.pita!, token.length, { simpulan: { baik: true, teks: dokumen(s) || "(kosong)" } }) };
  steps.push(langkah(s, `Selesai. Dokumen akhir: "${dokumen(s)}". Undo selalu membatalkan yang TERAKHIR dilakukan - itulah LIFO.`));
  return ok(steps);
}
