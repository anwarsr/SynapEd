/**
 * Lab Queue (FIFO) berbasis array, linear dan melingkar: model, reducer, dan
 * penghasil langkah.
 *
 * Modul NETRAL — tanpa `"use client"`, tanpa `server-only`, tanpa impor `@/`.
 *
 * Model Cambridge 9618: `Queue[0 : MaxSize-1]`, `FrontPointer` (yang keluar
 * berikutnya), `RearPointer` (yang masuk terakhir, -1 di awal), dan
 * `NumberInQueue`. Setiap langkah mengikuti satu pernyataan di `queueKode.ts`
 * (`LabStep.kode`), dan `verify-stack-queue` menjalankan pseudocode itu untuk
 * membuktikan hasilnya sama.
 *
 * Pelajaran utamanya perbedaan dua jenisnya: queue LINEAR berhenti ketika
 * RearPointer mencapai indeks terakhir walau slot depan sudah kosong ("penuh
 * semu"), sedangkan queue MELINGKAR membawa penunjuk kembali ke 0 sehingga
 * slot itu terpakai lagi. Nilai yang sudah di-dequeue tetap tertinggal di
 * memori (pudar di papan) sampai ditimpa.
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
import { barisLoket, barisQueue, kodeIdQueue, type JenisQueue } from "./queueKode";

export type { JenisQueue };

export interface QueueLabState {
  jenis: JenisQueue;
  kapasitas: number;
  memori: (SelAdt | null)[];
  /** FrontPointer: indeks yang keluar berikutnya. */
  front: number;
  /** RearPointer: indeks yang masuk terakhir; -1 sebelum ada yang masuk. */
  rear: number;
  /** NumberInQueue. */
  jumlah: number;
  nextId: number;
  item: string | null;
  keluaran: string[];
  pita: PitaAdt | null;
  /**
   * Hanya di langkah TENGAH Enqueue/Dequeue: indeks yang digambar sebagai isi
   * antrean. Di antara "FrontPointer maju" dan "NumberInQueue berkurang" kedua
   * penunjuk sesaat tidak sepakat, dan menurunkan isi dari salah satunya akan
   * menggambar sel yang salah. Keadaan akhir tidak pernah membawanya.
   */
  dalam?: number[];
}

export type QueueStep = LabStep<QueueLabState>;
export type QueueOpResult = LabOpResult<QueueLabState>;

export type QueueOp =
  | { kind: "isiDariTeks"; teks: string }
  | { kind: "acak"; panjang: number; maks: number; benih: number }
  | { kind: "kosongkan" }
  | { kind: "kapasitas"; kapasitas: number }
  | { kind: "jenis"; jenis: JenisQueue }
  | { kind: "enqueue"; nilai: string }
  | { kind: "dequeue" }
  | { kind: "peek" }
  | { kind: "isEmpty" }
  | { kind: "isFull" }
  | { kind: "loket"; kejadian: string }
  | { kind: "penuhSemu" };

export const OUT_Q_PENUH = "Queue penuh";
export const OUT_Q_KOSONG = "Queue kosong";
export const OUT_LOKET_KOSONG = "Loket menunggu - antrean kosong";

export function emptyQueueState(jenis: JenisQueue = "melingkar", kapasitas = ADT_KAPASITAS_AWAL): QueueLabState {
  return { jenis, kapasitas, memori: Array.from({ length: kapasitas }, () => null), front: 0, rear: -1, jumlah: 0, nextId: 0, item: null, keluaran: [], pita: null };
}

/** Queue berisi `nilai` (depan → belakang) mulai indeks 0; id 0..n−1. */
export function queueStateFromValues(nilai: readonly string[], jenis: JenisQueue, kapasitas: number): QueueLabState {
  const memori = Array.from({ length: kapasitas }, (_, i) => (i < nilai.length ? { id: i, nilai: nilai[i] } : null));
  return { ...emptyQueueState(jenis, kapasitas), memori, rear: nilai.length - 1, jumlah: nilai.length, nextId: nilai.length };
}

/** Indeks yang DIGAMBAR sebagai isi antrean (langkah tengah memakai `dalam`). */
export function indeksTampil(s: QueueLabState): number[] {
  return s.dalam ?? indeksQueue(s);
}

/** Indeks memori isi queue, dari depan ke belakang. */
export function indeksQueue(s: QueueLabState): number[] {
  return Array.from({ length: Math.max(0, s.jumlah) }, (_, k) => (s.jenis === "melingkar" ? (s.front + k) % s.kapasitas : s.front + k));
}

export function isiQueue(s: QueueLabState): SelAdt[] {
  return indeksQueue(s)
    .map((i) => s.memori[i])
    .filter((x): x is SelAdt => x !== null && x !== undefined);
}

export function assertQueueInvariants(s: QueueLabState): string | null {
  const kap = s.kapasitas;
  if (s.jenis !== "linear" && s.jenis !== "melingkar") return "Jenis queue tidak sah.";
  if (s.dalam !== undefined) return "Keadaan akhir masih membawa isi tampilan langkah tengah.";
  if (!Number.isInteger(kap) || kap < ADT_MIN_KAPASITAS || kap > ADT_MAX_KAPASITAS) return `Kapasitas ${kap} tidak sah.`;
  if (s.memori.length !== kap) return "Panjang memori tidak sama dengan kapasitas.";
  if (![s.front, s.rear, s.jumlah].every(Number.isInteger)) return "Penunjuk harus bilangan bulat.";
  if (s.rear < -1 || s.rear > kap - 1) return `RearPointer ${s.rear} di luar array.`;
  if (s.jumlah < 0 || s.jumlah > kap) return `NumberInQueue ${s.jumlah} tidak sah.`;
  if (s.jenis === "linear") {
    if (s.front < 0 || s.front > kap) return `FrontPointer ${s.front} di luar array.`;
    if (s.jumlah !== s.rear - s.front + 1) return "NumberInQueue tidak sama dengan RearPointer - FrontPointer + 1.";
  } else {
    if (s.front < 0 || s.front > kap - 1) return `FrontPointer ${s.front} di luar array.`;
    if (s.rear === -1) {
      if (s.front !== 0 || s.jumlah !== 0) return "RearPointer -1 hanya sah untuk queue yang belum pernah diisi.";
    } else if (s.rear !== (s.front + s.jumlah - 1 + kap) % kap) return "RearPointer tidak cocok dengan FrontPointer + NumberInQueue.";
  }
  const ids = new Set<number>();
  for (const c of s.memori) {
    if (c === null) continue;
    if (!ADT_NILAI_RE.test(c.nilai)) return `Nilai "${c.nilai}" tidak sah.`;
    if (ids.has(c.id) || c.id >= s.nextId) return `Id ${c.id} ganda atau tidak lebih kecil dari nextId.`;
    ids.add(c.id);
  }
  for (const i of indeksQueue(s)) if (s.memori[i] === null) return `Queue[${i}] kosong padahal di dalam antrean.`;
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

function langkah(state: QueueLabState, narasi: string, o: OpsiLangkah = {}): QueueStep {
  return {
    state,
    narasi,
    fokus: o.fokus ?? [],
    tahanMs: o.tahan ?? LAB_STEP_HOLD_MS,
    ...(o.peran ? { peran: o.peran } : {}),
    ...(o.kode ? { kode: { id: o.kode.id, dari: o.kode.dari, sampai: o.kode.sampai ?? o.kode.dari } } : {}),
  };
}

const ok = (steps: QueueStep[]): QueueOpResult => ({ ok: true, steps: steps.slice(0, ADT_MAX_LANGKAH) });
const gagal = (error: string): QueueOpResult => ({ ok: false, error });
const bersih = (s: QueueLabState): QueueLabState => ({ ...s, memori: [...s.memori], item: null, keluaran: [], pita: null, dalam: undefined });

export function queuePenuh(s: QueueLabState): boolean {
  return s.jenis === "melingkar" ? s.jumlah === s.kapasitas : s.rear === s.kapasitas - 1;
}

/** Isi dipindah ke awal array baru (jenis/kapasitas bisa berbeda); id tetap supaya selnya meluncur. */
function susunUlang(s: QueueLabState, jenis: JenisQueue, kap: number): QueueLabState {
  const isi = isiQueue(s);
  const memori = Array.from({ length: kap }, (_, i) => isi[i] ?? null);
  return { ...s, jenis, kapasitas: kap, memori, front: 0, rear: isi.length - 1, jumlah: isi.length };
}

interface Hasil {
  steps: QueueStep[];
  state: QueueLabState;
}

/**
 * ENQUEUE lengkap per pernyataan. `rinci` = false: satu langkah ringkas
 * (dipakai penerapan supaya antrean panjang tidak menjadi ratusan langkah).
 */
function enqueue(s: QueueLabState, v: string, id: string, rinci = true): Hasil {
  const kap = s.kapasitas;
  const B = barisQueue(s.jenis, kap);
  const melingkar = s.jenis === "melingkar";
  const steps: QueueStep[] = [];
  if (rinci) {
    steps.push(
      langkah(s, melingkar
        ? `ENQUEUE ${v}: periksa dulu apakah queue penuh - NumberInQueue = ${s.jumlah}, MaxSize = ${kap}.`
        : `ENQUEUE ${v}: periksa dulu apakah queue penuh - RearPointer = ${s.rear}, MaxSize - 1 = ${kap - 1}.`, { kode: { id, dari: B.enqCek } }),
    );
  }
  if (queuePenuh(s)) {
    const st = { ...s, keluaran: [...s.keluaran, OUT_Q_PENUH] };
    const semu = !melingkar && s.front > 0;
    steps.push(
      langkah(st, semu
        ? `Queue penuh: RearPointer sudah di indeks terakhir, padahal ${s.front} slot di depan (indeks 0${s.front > 1 ? `-${s.front - 1}` : ""}) sudah kosong. Queue LINEAR tidak bisa memakainya lagi - queue melingkar bisa.`
        : `Queue penuh: semua ${kap} slot terisi, jadi ${v} tidak bisa masuk.`, {
        kode: { id, dari: B.enqPenuh },
        fokus: semu ? Array.from({ length: s.front }, (_, i) => i) : [],
      }),
    );
    return { steps, state: st };
  }
  let r = s.rear + 1;
  const isiLama = indeksQueue(s);
  // Nilai kembalian Dequeue sebelumnya (dalam penerapan) tidak berlaku lagi untuk Enqueue ini.
  let st: QueueLabState = { ...s, item: null, rear: r, dalam: r < kap ? [...isiLama, r] : isiLama };
  if (rinci) {
    const lama = r < kap ? s.memori[r] : null;
    steps.push(
      langkah(st, `RearPointer ${"←"} RearPointer + 1 = ${r}.${melingkar && r === kap ? " Itu sudah melewati indeks terakhir." : lama ? ` Queue[${r}] masih berisi sisa ${lama.nilai} - akan ditimpa.` : ""}`, {
        kode: { id, dari: B.enqNaik },
        fokus: r < kap ? [r] : [],
        ...(lama && r < kap ? { peran: { [lama.id]: "luar" as LabPeran } } : {}),
      }),
    );
  }
  if (melingkar && r === kap) {
    r = 0;
    st = { ...st, rear: 0, dalam: [...isiLama, 0] };
    const lama = s.memori[0];
    steps.push(
      langkah(st, `RearPointer = MaxSize, jadi RearPointer ${"←"} 0: kembali ke AWAL array - inilah yang membuat queue "melingkar".${lama ? ` Queue[0] berisi sisa ${lama.nilai} - akan ditimpa.` : ""}`, {
        kode: { id, dari: B.enqPutar - 1, sampai: B.enqPutar },
        fokus: [0],
        tahan: LAB_MOVE_HOLD_MS,
        ...(lama ? { peran: { [lama.id]: "luar" as LabPeran } } : {}),
      }),
    );
  }
  const memori = [...st.memori];
  memori[r] = { id: st.nextId, nilai: v };
  st = { ...st, memori, nextId: st.nextId + 1, jumlah: st.jumlah + 1, dalam: undefined };
  steps.push(
    langkah(st, rinci
      ? `Queue[${r}] ${"←"} ${v}, lalu NumberInQueue naik menjadi ${st.jumlah}. ${v} berdiri paling belakang.`
      : `${v} masuk di Queue[${r}] (RearPointer = ${r}).`, {
      kode: rinci ? { id, dari: B.enqTulis, sampai: B.enqTambah } : undefined,
      fokus: [r],
      tahan: rinci ? LAB_MOVE_HOLD_MS : LAB_VISIT_HOLD_MS,
    }),
  );
  return { steps, state: st };
}

function dequeue(s: QueueLabState, id: string, rinci = true): Hasil & { nilai: string | null } {
  const kap = s.kapasitas;
  const B = barisQueue(s.jenis, kap);
  const melingkar = s.jenis === "melingkar";
  const steps: QueueStep[] = [];
  if (rinci) steps.push(langkah(s, `DEQUEUE: periksa dulu apakah queue kosong - NumberInQueue = ${s.jumlah}.`, { kode: { id, dari: B.deqCek } }));
  if (s.jumlah === 0) {
    const st = { ...s, keluaran: [...s.keluaran, OUT_Q_KOSONG], item: "" };
    steps.push(langkah(st, "Queue kosong (underflow): tidak ada yang bisa dikeluarkan; Dequeue mengembalikan teks kosong.", { kode: { id, dari: B.deqKosong, sampai: B.deqKosong + 1 } }));
    return { steps, state: st, nilai: null };
  }
  const f = s.front;
  const sel = s.memori[f]!;
  let st: QueueLabState = { ...s, item: sel.nilai };
  if (rinci) {
    steps.push(langkah(st, `Item ${"←"} Queue[${f}]: ${sel.nilai} paling depan, jadi ia yang keluar - yang pertama masuk, pertama keluar.`, {
      kode: { id, dari: B.deqBaca },
      fokus: [f],
      peran: { [sel.id]: "hapus" },
    }));
  }
  const sisaAntre = indeksQueue(s).slice(1);
  st = { ...st, front: f + 1, dalam: sisaAntre };
  if (rinci) {
    steps.push(langkah(st, `FrontPointer ${"←"} FrontPointer + 1 = ${f + 1}. ${sel.nilai} tertinggal di Queue[${f}] sebagai sisa, di luar antrean.${melingkar && f + 1 === kap ? " Itu melewati indeks terakhir." : ""}`, {
      kode: { id, dari: B.deqMaju },
      fokus: [f],
      tahan: LAB_MOVE_HOLD_MS,
    }));
  }
  if (melingkar && f + 1 === kap) {
    st = { ...st, front: 0, dalam: sisaAntre };
    if (rinci) steps.push(langkah(st, `FrontPointer = MaxSize, jadi FrontPointer ${"←"} 0: kembali ke awal array.`, { kode: { id, dari: B.deqPutar - 1, sampai: B.deqPutar }, tahan: LAB_MOVE_HOLD_MS }));
  }
  st = { ...st, jumlah: st.jumlah - 1, dalam: undefined };
  steps.push(
    langkah(st, rinci
      ? `NumberInQueue turun menjadi ${st.jumlah}; Dequeue mengembalikan ${sel.nilai}.`
      : `${sel.nilai} keluar dari depan (FrontPointer kini ${st.front}).`, {
      kode: rinci ? { id, dari: B.deqKurang, sampai: B.deqKembali } : undefined,
      fokus: rinci ? [] : [f],
      peran: rinci ? undefined : { [sel.id]: "hapus" },
      tahan: rinci ? LAB_STEP_HOLD_MS : LAB_VISIT_HOLD_MS,
    }),
  );
  return { steps, state: st, nilai: sel.nilai };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function applyQueueOp(s0: QueueLabState, op: QueueOp): QueueOpResult {
  const s = bersih(s0);
  const kap = s.kapasitas;
  const B = barisQueue(s.jenis, kap);
  const id = kodeIdQueue(s.jenis, kap);

  switch (op.kind) {
    case "isiDariTeks": {
      const nilai = pecahNilai(op.teks);
      if (nilai.length === 0) return gagal("Tulis minimal satu nilai.");
      if (nilai.length > kap) return gagal(`Queue berkapasitas ${kap}; ${nilai.length} nilai tidak muat. Perbesar kapasitasnya dulu.`);
      const salah = nilai.find((v) => nilaiSah(v) === null);
      if (salah !== undefined) return gagal(`Nilai "${salah}" tidak sah: 1-6 huruf, angka, titik, atau minus.`);
      const baru = queueStateFromValues(nilai, s.jenis, kap);
      return ok([langkah(baru, `Queue diisi ${nilai.length} nilai lewat ENQUEUE berturut-turut: ${nilai[0]} paling depan, ${nilai[nilai.length - 1]} paling belakang.`, { fokus: [0] })]);
    }

    case "acak": {
      if (!Number.isInteger(op.panjang) || op.panjang < 1 || op.panjang > kap) return gagal(`Panjang harus 1 sampai ${kap} (kapasitas queue).`);
      if (!Number.isInteger(op.maks) || op.maks < 1 || op.maks > 999) return gagal("Nilai terbesar harus 1 sampai 999.");
      if (!Number.isInteger(op.benih) || op.benih < 0) return gagal("Benih acak harus bilangan bulat 0 atau lebih.");
      const acak = mulberry32(op.benih);
      const nilai = Array.from({ length: op.panjang }, () => String(Math.floor(acak() * (op.maks + 1))));
      const baru = queueStateFromValues(nilai, s.jenis, kap);
      return ok([langkah(baru, `Queue diisi ${op.panjang} angka acak; ${nilai[0]} paling depan.`, { fokus: [0] })]);
    }

    case "kosongkan": {
      const baru = { ...s, front: 0, rear: -1, jumlah: 0 };
      return ok([
        langkah(baru, `FrontPointer ${"←"} 0, RearPointer ${"←"} -1, NumberInQueue ${"←"} 0: queue kosong.${s.jumlah > 0 ? " Nilai lama tetap tertinggal di memori sampai ditimpa." : ""}`, {
          kode: { id, dari: B.kosongkan, sampai: B.kosongkanAkhir },
        }),
      ]);
    }

    case "kapasitas": {
      const n = op.kapasitas;
      if (!Number.isInteger(n) || n < ADT_MIN_KAPASITAS || n > ADT_MAX_KAPASITAS) return gagal(`Kapasitas harus ${ADT_MIN_KAPASITAS} sampai ${ADT_MAX_KAPASITAS}.`);
      if (n < s.jumlah) return gagal(`Queue berisi ${s.jumlah} nilai; kapasitas tidak bisa lebih kecil dari itu.`);
      if (n === kap) return gagal(`Kapasitas sudah ${n}.`);
      const baru = susunUlang(s, s.jenis, n);
      return ok([
        langkah(baru, `Array baru Queue[0:${n - 1}] dibuat; isi antrean disalin berurutan mulai indeks 0 (FrontPointer = 0, RearPointer = ${baru.rear}).`, {
          kode: { id: kodeIdQueue(s.jenis, n), dari: 1, sampai: 5 },
          tahan: LAB_MOVE_HOLD_MS,
        }),
      ]);
    }

    case "jenis": {
      if (op.jenis !== "linear" && op.jenis !== "melingkar") return gagal("Jenis queue tidak dikenal.");
      if (op.jenis === s.jenis) return gagal(`Queue sudah ${op.jenis}.`);
      const baru = susunUlang(s, op.jenis, kap);
      return ok([
        langkah(baru, op.jenis === "melingkar"
          ? "Sekarang queue MELINGKAR: setelah indeks terakhir, RearPointer dan FrontPointer kembali ke 0, dan penuh diukur dari NumberInQueue. Isi antrean disalin mulai indeks 0."
          : "Sekarang queue LINEAR: RearPointer berhenti di indeks terakhir dan FrontPointer hanya maju. Isi antrean disalin mulai indeks 0.", {
          kode: { id: kodeIdQueue(op.jenis, kap), dari: barisQueue(op.jenis, kap).enqCek },
          tahan: LAB_MOVE_HOLD_MS,
        }),
      ]);
    }

    case "enqueue": {
      const v = nilaiSah(op.nilai);
      if (v === null) return gagal("Nilai tidak sah: 1-6 huruf, angka, titik, atau minus.");
      return ok(enqueue(s, v, id).steps);
    }

    case "dequeue":
      return ok(dequeue(s, id).steps);

    case "peek": {
      const steps: QueueStep[] = [langkah(s, `PEEK: periksa dulu apakah queue kosong - NumberInQueue = ${s.jumlah}.`, { kode: { id, dari: B.peekCek } })];
      if (s.jumlah === 0) {
        steps.push(langkah({ ...s, keluaran: [OUT_Q_KOSONG], item: "" }, "Queue kosong (underflow): tidak ada yang bisa dilihat.", { kode: { id, dari: B.peekKosong, sampai: B.peekKosong + 1 } }));
        return ok(steps);
      }
      const sel = s.memori[s.front]!;
      steps.push(langkah({ ...s, item: sel.nilai }, `Peek mengembalikan ${sel.nilai} (Queue[${s.front}]) tanpa mengubah penunjuk mana pun.`, {
        kode: { id, dari: B.peekKembali },
        fokus: [s.front],
        peran: { [sel.id]: "hasil" },
      }));
      return ok(steps);
    }

    case "isEmpty":
    case "isFull": {
      const kosong = op.kind === "isEmpty";
      const benar = kosong ? s.jumlah === 0 : queuePenuh(s);
      const syarat = kosong ? `NumberInQueue = ${s.jumlah}` : s.jenis === "melingkar" ? `NumberInQueue = ${s.jumlah}, MaxSize = ${kap}` : `RearPointer = ${s.rear}, MaxSize - 1 = ${kap - 1}`;
      const semu = !kosong && benar && s.jenis === "linear" && s.front > 0;
      return ok([
        langkah({ ...s, item: benar ? "TRUE" : "FALSE" }, `${kosong ? "IsEmpty" : "IsFull"}: ${syarat}, jadi hasilnya ${benar ? "TRUE" : "FALSE"}.${semu ? ` Padahal ${s.front} slot depan kosong - "penuh semu" queue linear.` : ""}`, {
          kode: { id, dari: kosong ? B.isEmpty : B.isFull },
        }),
      ]);
    }

    case "loket":
      return loket(s, op.kejadian);
    case "penuhSemu":
      return penuhSemu(s);

    default: {
      const _lengkap: never = op;
      return gagal(`Operasi tidak dikenal: ${String((_lengkap as { kind: string }).kind)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Penerapan
// ---------------------------------------------------------------------------

/** Kejadian dipisah spasi: `+Nama` = pelanggan datang (ENQUEUE), `-` = loket melayani (DEQUEUE). */
function loket(s0: QueueLabState, kejadianRaw: string): QueueOpResult {
  const token = (typeof kejadianRaw === "string" ? kejadianRaw : "").split(/\s+/).filter(Boolean);
  if (token.length === 0) return gagal("Tulis kejadian dipisah spasi: +Nama = datang, - = dilayani. Mis. +Ani +Budi - +Cici -");
  if (token.length > ADT_MAX_MASUKAN) return gagal(`Paling banyak ${ADT_MAX_MASUKAN} kejadian.`);
  const salah = token.find((t) => t !== "-" && !/^\+[A-Za-z0-9]{1,6}$/.test(t));
  if (salah !== undefined) return gagal(`"${salah}" tidak sah: +Nama (1-6 huruf/angka) atau - untuk melayani.`);
  const B = barisLoket();
  const id = "loket";
  let s: QueueLabState = { ...emptyQueueState(s0.jenis, s0.kapasitas), memori: [...s0.memori], nextId: s0.nextId, pita: { judul: "Antrean loket", token, posisi: -1, hasil: "", simpulan: null } };
  const steps: QueueStep[] = [langkah(s, "Loket buka dengan antrean kosong. Pelanggan yang datang ikut antre di belakang (ENQUEUE); loket selalu melayani yang paling depan (DEQUEUE).")];
  const dilayani: string[] = [];
  token.forEach((t, i) => {
    const pita = pitaKe(s.pita!, i, { hasil: dilayani.join(", ") });
    s = { ...s, pita };
    if (t.startsWith("+")) {
      const nama = t.slice(1);
      const h = enqueue(s, nama, id, false);
      const tolak = h.state.keluaran.length > s.keluaran.length;
      s = { ...h.state, pita };
      steps.push(langkah(s, tolak ? `${nama} datang, tetapi antrean penuh - ${nama} tidak bisa ikut antre.` : `${nama} datang dan antre di belakang (Queue[${s.rear}]).`, {
        kode: { id, dari: B.datang },
        fokus: tolak ? [] : [s.rear],
        tahan: LAB_MOVE_HOLD_MS,
      }));
      return;
    }
    if (s.jumlah === 0) {
      s = { ...s, keluaran: [...s.keluaran, OUT_LOKET_KOSONG] };
      steps.push(langkah(s, "Loket siap melayani, tetapi antrean kosong.", { kode: { id, dari: B.kosong } }));
      return;
    }
    const f = s.front;
    const keluar = s.memori[f]!.id;
    const h = dequeue(s, id, false);
    dilayani.push(h.nilai!);
    s = { ...h.state, keluaran: [...h.state.keluaran, `Dilayani: ${h.nilai}`], pita: pitaKe(pita, i, { hasil: dilayani.join(", ") }) };
    steps.push(langkah(s, `Loket melayani ${h.nilai} - yang paling lama menunggu di depan.`, {
      kode: { id, dari: B.ambil, sampai: B.lapor },
      fokus: [f],
      peran: { [keluar]: "hapus" },
      tahan: LAB_MOVE_HOLD_MS,
    }));
  });
  s = { ...s, pita: pitaKe(s.pita!, token.length, { hasil: dilayani.join(", "), simpulan: { baik: true, teks: dilayani.length > 0 ? `Urutan dilayani: ${dilayani.join(", ")}` : "Belum ada yang dilayani" } }) };
  steps.push(langkah(s, `Selesai. ${dilayani.length > 0 ? `Urutan dilayani ${dilayani.join(", ")} sama dengan urutan datang - FIFO.` : "Belum ada yang dilayani."}${s.jumlah > 0 ? ` Masih ${s.jumlah} orang menunggu.` : ""}`));
  return ok(steps);
}

/**
 * Peraga "mengapa queue linear bisa penuh padahal ada slot kosong": isi
 * penuh, keluarkan dua, lalu coba masukkan satu lagi - di jenis yang sedang
 * dipakai. Linear menolak; melingkar membawa RearPointer kembali ke 0.
 */
function penuhSemu(s0: QueueLabState): QueueOpResult {
  const kap = s0.kapasitas;
  const id = kodeIdQueue(s0.jenis, kap);
  let s: QueueLabState = { ...emptyQueueState(s0.jenis, kap), nextId: s0.nextId };
  const huruf = "ABCDEFGHIJ";
  const steps: QueueStep[] = [langkah(s, `Peraga queue ${s0.jenis}: isi sampai penuh, keluarkan dua, lalu coba masukkan X.`, { kode: { id, dari: barisQueue(s0.jenis, kap).kosongkan, sampai: barisQueue(s0.jenis, kap).kosongkanAkhir } })];
  for (let i = 0; i < kap; i++) {
    const h = enqueue(s, huruf[i], id, false);
    s = h.state;
    steps.push(...h.steps);
  }
  for (let i = 0; i < 2; i++) {
    const h = dequeue(s, id, false);
    s = h.state;
    steps.push(...h.steps);
  }
  steps.push(langkah(s, `Sekarang ada 2 slot kosong di depan (indeks 0 dan 1). Coba ENQUEUE X.`, { fokus: [0, 1] }));
  const h = enqueue(s, "X", id, true);
  steps.push(...h.steps);
  return ok(steps);
}
