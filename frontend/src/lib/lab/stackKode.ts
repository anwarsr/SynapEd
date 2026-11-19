/**
 * Pseudocode Cambridge 9618 untuk Lab Stack: stack berbasis array dan tiga
 * penerapannya. Teks inilah yang tampil di panel kode, dan `verify-stack-queue`
 * MENJALANKANNYA di mesin pseudocode Lab 05 lalu mencocokkan hasilnya dengan
 * reducer - kode di layar terbukti benar, bukan sekadar hiasan.
 *
 * Nomor baris yang disorot dicari dari TEKS (`barisKode`), bukan ditulis
 * tangan, supaya menyunting kode tidak diam-diam menggeser sorotan.
 *
 * Modul NETRAL tanpa impor alias `@/`.
 */
import { barisKode, PANAH as P } from "./adtBersama";

/** Stack array berkapasitas `kap`: deklarasi, Push, Pop, Peek, IsEmpty, IsFull. */
export function kodeStack(kap: number): string {
  return `DECLARE Stack : ARRAY[0:${kap - 1}] OF STRING
DECLARE TopPointer : INTEGER
CONSTANT MaxSize = ${kap}
TopPointer ${P} -1

PROCEDURE Push(Item : STRING)
    IF TopPointer = MaxSize - 1 THEN
        OUTPUT "Stack penuh (overflow)"
    ELSE
        TopPointer ${P} TopPointer + 1
        Stack[TopPointer] ${P} Item
    ENDIF
ENDPROCEDURE

FUNCTION Pop() RETURNS STRING
    DECLARE Item : STRING
    IF TopPointer = -1 THEN
        OUTPUT "Stack kosong (underflow)"
        RETURN ""
    ENDIF
    Item ${P} Stack[TopPointer]
    TopPointer ${P} TopPointer - 1
    RETURN Item
ENDFUNCTION

FUNCTION Peek() RETURNS STRING
    IF TopPointer = -1 THEN
        OUTPUT "Stack kosong (underflow)"
        RETURN ""
    ENDIF
    RETURN Stack[TopPointer]
ENDFUNCTION

FUNCTION IsEmpty() RETURNS BOOLEAN
    RETURN TopPointer = -1
ENDFUNCTION

FUNCTION IsFull() RETURNS BOOLEAN
    RETURN TopPointer = MaxSize - 1
ENDFUNCTION
`;
}

export interface BarisStack {
  kosongkan: number;
  pushCek: number;
  pushPenuh: number;
  pushNaik: number;
  pushTulis: number;
  popCek: number;
  popKosong: number;
  popBaca: number;
  popTurun: number;
  popKembali: number;
  peekCek: number;
  peekKosong: number;
  peekKembali: number;
  isEmpty: number;
  isFull: number;
}

/** Nomor baris (1-based) tiap pernyataan yang disorot. Sama untuk kapasitas berapa pun. */
export function barisStack(kap: number): BarisStack {
  const k = kodeStack(kap);
  const push = barisKode(k, "PROCEDURE Push");
  const pop = barisKode(k, "FUNCTION Pop");
  const peek = barisKode(k, "FUNCTION Peek");
  return {
    kosongkan: barisKode(k, `TopPointer ${P} -1`),
    pushCek: barisKode(k, "IF TopPointer = MaxSize - 1", push),
    pushPenuh: barisKode(k, 'OUTPUT "Stack penuh', push),
    pushNaik: barisKode(k, `TopPointer ${P} TopPointer + 1`, push),
    pushTulis: barisKode(k, `Stack[TopPointer] ${P} Item`, push),
    popCek: barisKode(k, "IF TopPointer = -1", pop),
    popKosong: barisKode(k, 'OUTPUT "Stack kosong', pop),
    popBaca: barisKode(k, `Item ${P} Stack[TopPointer]`, pop),
    popTurun: barisKode(k, `TopPointer ${P} TopPointer - 1`, pop),
    popKembali: barisKode(k, "RETURN Item", pop),
    peekCek: barisKode(k, "IF TopPointer = -1", peek),
    peekKosong: barisKode(k, 'OUTPUT "Stack kosong', peek),
    peekKembali: barisKode(k, "RETURN Stack[TopPointer]", peek),
    isEmpty: barisKode(k, "RETURN TopPointer = -1", barisKode(k, "FUNCTION IsEmpty")),
    isFull: barisKode(k, "RETURN TopPointer = MaxSize - 1", barisKode(k, "FUNCTION IsFull")),
  };
}

// ── Penerapan ────────────────────────────────────────────────────────────
// Hanya fungsi penerapannya yang ditampilkan: Push/Pop-nya sama dengan kode
// stack di atas (uji menjalankan keduanya bersama).

export const KODE_KURUNG = `FUNCTION Pasangan(Buka : STRING, Tutup : STRING) RETURNS BOOLEAN
    RETURN (Buka = "(" AND Tutup = ")") OR (Buka = "[" AND Tutup = "]") OR (Buka = "{" AND Tutup = "}")
ENDFUNCTION

FUNCTION Seimbang(Teks : STRING) RETURNS BOOLEAN
    DECLARE i : INTEGER
    DECLARE c : STRING
    DECLARE Atas : STRING
    TopPointer ${P} -1
    FOR i ${P} 1 TO LENGTH(Teks)
        c ${P} MID(Teks, i, 1)
        IF c = "(" OR c = "[" OR c = "{" THEN
            CALL Push(c)
        ENDIF
        IF c = ")" OR c = "]" OR c = "}" THEN
            IF TopPointer = -1 THEN
                RETURN FALSE
            ENDIF
            Atas ${P} Pop()
            IF NOT Pasangan(Atas, c) THEN
                RETURN FALSE
            ENDIF
        ENDIF
    NEXT i
    RETURN TopPointer = -1
ENDFUNCTION
`;

export function barisKurung() {
  const k = KODE_KURUNG;
  const fungsi = barisKode(k, "FUNCTION Seimbang");
  const tutup = barisKode(k, 'IF c = ")"', fungsi);
  const kosong = barisKode(k, "IF TopPointer = -1", tutup);
  const ambil = barisKode(k, `Atas ${P} Pop()`, tutup);
  return {
    mulai: barisKode(k, `TopPointer ${P} -1`, fungsi),
    baca: barisKode(k, `c ${P} MID`, fungsi),
    buka: barisKode(k, "CALL Push(c)", fungsi),
    tutup,
    kosong,
    gagalKosong: barisKode(k, "RETURN FALSE", kosong),
    ambil,
    cocok: barisKode(k, "IF NOT Pasangan", ambil),
    gagalCocok: barisKode(k, "RETURN FALSE", ambil),
    akhir: barisKode(k, "RETURN TopPointer = -1", fungsi),
  };
}

export const KODE_BALIK = `FUNCTION BalikKata(Kata : STRING) RETURNS STRING
    DECLARE i : INTEGER
    DECLARE Hasil : STRING
    TopPointer ${P} -1
    FOR i ${P} 1 TO LENGTH(Kata)
        CALL Push(MID(Kata, i, 1))
    NEXT i
    Hasil ${P} ""
    WHILE TopPointer <> -1
        Hasil ${P} Hasil & Pop()
    ENDWHILE
    RETURN Hasil
ENDFUNCTION
`;

export function barisBalik() {
  const k = KODE_BALIK;
  return {
    mulai: barisKode(k, `TopPointer ${P} -1`),
    push: barisKode(k, "CALL Push"),
    awalHasil: barisKode(k, `Hasil ${P} ""`),
    ulang: barisKode(k, "WHILE"),
    pop: barisKode(k, `Hasil ${P} Hasil & Pop()`),
    akhir: barisKode(k, "RETURN Hasil"),
  };
}

export const KODE_UNDO = `PROCEDURE Ketik(Kata : STRING)
    CALL Push(Kata)
ENDPROCEDURE

PROCEDURE Batalkan()
    DECLARE Dibuang : STRING
    IF TopPointer = -1 THEN
        OUTPUT "Tidak ada yang bisa dibatalkan"
    ELSE
        Dibuang ${P} Pop()
        OUTPUT "Dibatalkan: ", Dibuang
    ENDIF
ENDPROCEDURE
`;

export function barisUndo() {
  const k = KODE_UNDO;
  const batal = barisKode(k, "PROCEDURE Batalkan");
  return {
    ketik: barisKode(k, "CALL Push(Kata)"),
    cek: barisKode(k, "IF TopPointer = -1", batal),
    kosong: barisKode(k, 'OUTPUT "Tidak ada', batal),
    ambil: barisKode(k, `Dibuang ${P} Pop()`, batal),
    lapor: barisKode(k, 'OUTPUT "Dibatalkan', batal),
  };
}

/** Id kode untuk `LabStep.kode` → teksnya (dipakai `KIT_STACK.kodeSumber`). */
export function kodeStackDariId(id: string): string | null {
  const m = /^stack:(\d+)$/.exec(id);
  if (m) return kodeStack(Number(m[1]));
  if (id === "kurung") return KODE_KURUNG;
  if (id === "balik") return KODE_BALIK;
  if (id === "undo") return KODE_UNDO;
  return null;
}
