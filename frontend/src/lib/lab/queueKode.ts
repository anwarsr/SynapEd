/**
 * Pseudocode Cambridge 9618 untuk Lab Queue: queue linear dan queue melingkar
 * berbasis array, plus penerapan antrean loket. Seperti `stackKode.ts`, teks
 * ini DIJALANKAN `verify-stack-queue` di mesin pseudocode Lab 05 dan hasilnya
 * dicocokkan dengan reducer.
 *
 * Bedanya hanya di Enqueue/Dequeue:
 * - linear: RearPointer berhenti di indeks terakhir ("penuh" walau slot depan
 *   sudah kosong) dan FrontPointer hanya maju;
 * - melingkar: kedua penunjuk kembali ke 0 setelah indeks terakhir, dan penuh
 *   diukur dari NumberInQueue.
 *
 * Modul NETRAL tanpa impor alias `@/`.
 */
import { barisKode, PANAH as P } from "./adtBersama";

export type JenisQueue = "linear" | "melingkar";

export function kodeQueue(jenis: JenisQueue, kap: number): string {
  const melingkar = jenis === "melingkar";
  const penuh = melingkar ? "IF NumberInQueue = MaxSize THEN" : "IF RearPointer = MaxSize - 1 THEN";
  const putarRear = melingkar
    ? `
        IF RearPointer = MaxSize THEN
            RearPointer ${P} 0
        ENDIF`
    : "";
  const putarFront = melingkar
    ? `
    IF FrontPointer = MaxSize THEN
        FrontPointer ${P} 0
    ENDIF`
    : "";
  return `DECLARE Queue : ARRAY[0:${kap - 1}] OF STRING
DECLARE FrontPointer : INTEGER
DECLARE RearPointer : INTEGER
DECLARE NumberInQueue : INTEGER
CONSTANT MaxSize = ${kap}
FrontPointer ${P} 0
RearPointer ${P} -1
NumberInQueue ${P} 0

PROCEDURE Enqueue(Item : STRING)
    ${penuh}
        OUTPUT "Queue penuh"
    ELSE
        RearPointer ${P} RearPointer + 1${putarRear}
        Queue[RearPointer] ${P} Item
        NumberInQueue ${P} NumberInQueue + 1
    ENDIF
ENDPROCEDURE

FUNCTION Dequeue() RETURNS STRING
    DECLARE Item : STRING
    IF NumberInQueue = 0 THEN
        OUTPUT "Queue kosong"
        RETURN ""
    ENDIF
    Item ${P} Queue[FrontPointer]
    FrontPointer ${P} FrontPointer + 1${putarFront}
    NumberInQueue ${P} NumberInQueue - 1
    RETURN Item
ENDFUNCTION

FUNCTION Peek() RETURNS STRING
    IF NumberInQueue = 0 THEN
        OUTPUT "Queue kosong"
        RETURN ""
    ENDIF
    RETURN Queue[FrontPointer]
ENDFUNCTION

FUNCTION IsEmpty() RETURNS BOOLEAN
    RETURN NumberInQueue = 0
ENDFUNCTION

FUNCTION IsFull() RETURNS BOOLEAN
    ${melingkar ? "RETURN NumberInQueue = MaxSize" : "RETURN RearPointer = MaxSize - 1"}
ENDFUNCTION
`;
}

export interface BarisQueue {
  kosongkan: number;
  kosongkanAkhir: number;
  enqCek: number;
  enqPenuh: number;
  enqNaik: number;
  /** Baris `RearPointer ← 0` (melingkar); 0 untuk linear. */
  enqPutar: number;
  enqTulis: number;
  enqTambah: number;
  deqCek: number;
  deqKosong: number;
  deqBaca: number;
  deqMaju: number;
  deqPutar: number;
  deqKurang: number;
  deqKembali: number;
  peekCek: number;
  peekKosong: number;
  peekKembali: number;
  isEmpty: number;
  isFull: number;
}

export function barisQueue(jenis: JenisQueue, kap: number): BarisQueue {
  const k = kodeQueue(jenis, kap);
  const melingkar = jenis === "melingkar";
  const enq = barisKode(k, "PROCEDURE Enqueue");
  const deq = barisKode(k, "FUNCTION Dequeue");
  const peek = barisKode(k, "FUNCTION Peek");
  return {
    kosongkan: barisKode(k, `FrontPointer ${P} 0`),
    kosongkanAkhir: barisKode(k, `NumberInQueue ${P} 0`),
    enqCek: barisKode(k, melingkar ? "IF NumberInQueue = MaxSize" : "IF RearPointer = MaxSize - 1", enq),
    enqPenuh: barisKode(k, 'OUTPUT "Queue penuh"', enq),
    enqNaik: barisKode(k, `RearPointer ${P} RearPointer + 1`, enq),
    enqPutar: melingkar ? barisKode(k, `RearPointer ${P} 0`, enq) : 0,
    enqTulis: barisKode(k, `Queue[RearPointer] ${P} Item`, enq),
    enqTambah: barisKode(k, `NumberInQueue ${P} NumberInQueue + 1`, enq),
    deqCek: barisKode(k, "IF NumberInQueue = 0", deq),
    deqKosong: barisKode(k, 'OUTPUT "Queue kosong"', deq),
    deqBaca: barisKode(k, `Item ${P} Queue[FrontPointer]`, deq),
    deqMaju: barisKode(k, `FrontPointer ${P} FrontPointer + 1`, deq),
    deqPutar: melingkar ? barisKode(k, `FrontPointer ${P} 0`, deq) : 0,
    deqKurang: barisKode(k, `NumberInQueue ${P} NumberInQueue - 1`, deq),
    deqKembali: barisKode(k, "RETURN Item", deq),
    peekCek: barisKode(k, "IF NumberInQueue = 0", peek),
    peekKosong: barisKode(k, 'OUTPUT "Queue kosong"', peek),
    peekKembali: barisKode(k, "RETURN Queue[FrontPointer]", peek),
    isEmpty: barisKode(k, "RETURN NumberInQueue = 0", barisKode(k, "FUNCTION IsEmpty")),
    isFull: barisKode(k, "RETURN", barisKode(k, "FUNCTION IsFull")),
  };
}

// ── Penerapan: antrean loket ─────────────────────────────────────────────

export const KODE_LOKET = `PROCEDURE Datang(Nama : STRING)
    CALL Enqueue(Nama)
ENDPROCEDURE

PROCEDURE Layani()
    DECLARE Pelanggan : STRING
    IF NumberInQueue = 0 THEN
        OUTPUT "Loket menunggu - antrean kosong"
    ELSE
        Pelanggan ${P} Dequeue()
        OUTPUT "Dilayani: ", Pelanggan
    ENDIF
ENDPROCEDURE
`;

export function barisLoket() {
  const k = KODE_LOKET;
  const layani = barisKode(k, "PROCEDURE Layani");
  return {
    datang: barisKode(k, "CALL Enqueue(Nama)"),
    cek: barisKode(k, "IF NumberInQueue = 0", layani),
    kosong: barisKode(k, 'OUTPUT "Loket menunggu', layani),
    ambil: barisKode(k, `Pelanggan ${P} Dequeue()`, layani),
    lapor: barisKode(k, 'OUTPUT "Dilayani', layani),
  };
}

export const kodeIdQueue = (jenis: JenisQueue, kap: number) => `queue:${jenis === "linear" ? "l" : "m"}:${kap}`;

export function kodeQueueDariId(id: string): string | null {
  const m = /^queue:([lm]):(\d+)$/.exec(id);
  if (m) return kodeQueue(m[1] === "l" ? "linear" : "melingkar", Number(m[2]));
  if (id === "loket") return KODE_LOKET;
  return null;
}
