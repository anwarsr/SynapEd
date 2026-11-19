/**
 * Codec URL Lab Stack (`1s`) dan Lab Queue (`1q`). Empat ruas data:
 *
 *   1s~6~2~12,7,9,4,,~       kapasitas ~ TopPointer ~ isi memori per sel ~ (cadangan, WAJIB kosong)
 *   1q~m~6~1:3:3~12,7,9,4,,  jenis (l|m) ~ kapasitas ~ Front:Rear:Number ~ isi memori per sel
 *
 * Memori dibagikan UTUH, termasuk sisa nilai di luar struktur: itulah yang
 * dilihat siswa di papan, dan tautan harus memulihkan papan yang sama. Sel
 * yang belum pernah ditulis = bagian kosong. Pita penerapan, nilai kembalian,
 * dan OUTPUT tidak ikut - itu hasil operasi, bukan keadaan struktur.
 *
 * Semua-atau-tidak: satu bagian rusak = null. Modul NETRAL tanpa impor `@/`.
 */
import { ADT_MAX_KAPASITAS, ADT_MIN_KAPASITAS, ADT_NILAI_RE, type SelAdt } from "./adtBersama";
import { bagianInt } from "./labUrlBagian";
import { assertStackInvariants, emptyStackState, type StackLabState } from "./stackLab";
import { assertQueueInvariants, emptyQueueState, type QueueLabState } from "./queueLab";

function encodeMemori(memori: readonly (SelAdt | null)[]): string {
  return memori.map((c) => (c === null ? "" : c.nilai)).join(",");
}

/** Ruas memori → sel ber-id 0..n−1, atau null. Panjangnya HARUS sama dengan kapasitas. */
function decodeMemori(ruas: string, kap: number): (SelAdt | null)[] | null {
  const bagian = ruas.split(",");
  if (bagian.length !== kap) return null;
  const memori: (SelAdt | null)[] = [];
  for (let i = 0; i < kap; i++) {
    const v = bagian[i];
    if (v === "") memori.push(null);
    else if (ADT_NILAI_RE.test(v)) memori.push({ id: i, nilai: v });
    else return null;
  }
  return memori;
}

export function encodeStack(s: StackLabState): string[] | null {
  if (assertStackInvariants(s) !== null) return null;
  return [String(s.kapasitas), String(s.top), encodeMemori(s.memori), ""];
}

export function decodeStack(ruas: readonly string[]): StackLabState | null {
  if (ruas[3] !== "") return null;
  const kap = bagianInt(ruas[0], ADT_MIN_KAPASITAS, ADT_MAX_KAPASITAS);
  if (kap === null) return null;
  const top = bagianInt(ruas[1], -1, kap - 1);
  const memori = decodeMemori(ruas[2], kap);
  if (top === null || memori === null) return null;
  const s: StackLabState = { ...emptyStackState(kap), memori, top, nextId: kap };
  return assertStackInvariants(s) === null ? s : null;
}

export function encodeQueue(s: QueueLabState): string[] | null {
  if (assertQueueInvariants(s) !== null) return null;
  return [s.jenis === "linear" ? "l" : "m", String(s.kapasitas), `${s.front}:${s.rear}:${s.jumlah}`, encodeMemori(s.memori)];
}

export function decodeQueue(ruas: readonly string[]): QueueLabState | null {
  const jenis = ruas[0] === "l" ? "linear" : ruas[0] === "m" ? "melingkar" : null;
  if (jenis === null) return null;
  const kap = bagianInt(ruas[1], ADT_MIN_KAPASITAS, ADT_MAX_KAPASITAS);
  if (kap === null) return null;
  const p = ruas[2].split(":");
  if (p.length !== 3) return null;
  const front = bagianInt(p[0], 0, kap);
  const rear = bagianInt(p[1], -1, kap - 1);
  const jumlah = bagianInt(p[2], 0, kap);
  const memori = decodeMemori(ruas[3], kap);
  if (front === null || rear === null || jumlah === null || memori === null) return null;
  const s: QueueLabState = { ...emptyQueueState(jenis, kap), memori, front, rear, jumlah, nextId: kap };
  return assertQueueInvariants(s) === null ? s : null;
}
