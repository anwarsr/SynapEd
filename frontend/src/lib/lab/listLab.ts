/**
 * Lab linked list (singly): model simpul, reducer, dan penghasil langkah.
 *
 * Modul NETRAL — tanpa `"use client"`, tanpa `server-only`, tanpa impor `@/`.
 *
 * Yang diajarkan lab ini berbeda dari array, dan setiap langkah dirancang
 * untuk itu:
 * - simpul TERSEBAR di memori (setiap simpul punya alamat sendiri) dan
 *   disambung oleh pointer `next` — bukan berderet seperti array;
 * - tidak ada lompatan ke indeks: mencapai simpul ke-k berarti berjalan k kali
 *   dari `head` dengan variabel `cur`;
 * - URUTAN mengubah pointer itu penting. Saat menyisip, simpul baru disambung
 *   ke sisa list DULU, baru pendahulunya diarahkan ke simpul baru — urutan
 *   terbalik membuat sisa list tidak lagi ditunjuk siapa pun (hilang).
 *   `verify-lab` memeriksa bahwa di SETIAP langkah tidak ada simpul yang
 *   hilang: semuanya bisa dicapai dari `head` atau dari variabel penunjuk.
 *
 * Keadaan akhir setiap operasi selalu "rapi": semua simpul tercapai dari
 * `head`, tanpa siklus. Langkah di tengah boleh punya simpul yang lepas dari
 * rantai (simpul baru yang belum disambung, simpul yang akan dihapus), asal
 * masih dipegang variabel.
 */
import { mulberry32 } from "./labRandom";
import {
  cleanLabText,
  LAB_MAX_ITEM_CHARS,
  LAB_MOVE_HOLD_MS,
  LAB_STEP_HOLD_MS,
  LAB_VALUE_RE,
  LAB_VISIT_HOLD_MS,
  type LabOpResult,
  type LabPeran,
  type LabStep,
} from "./labTypes";

/** Lebih dari ini rantainya tidak lagi terbaca tanpa menggulir. */
export const LIST_MAX_NODES = 8;
export const LIST_MAX_STEPS = 60;
const LIST_MAX_RANDOM_VALUE = Math.pow(10, LAB_MAX_ITEM_CHARS) - 1;

export interface ListNode {
  /** Identitas stabil untuk animasi; juga dasar alamat memorinya. */
  id: number;
  value: string;
  /** Id simpul berikutnya, atau null di ujung list. */
  next: number | null;
}

export interface ListLabState {
  /** Urutan di larik ini TIDAK berarti apa-apa — urutan list ditentukan `head` & `next`. */
  nodes: ListNode[];
  head: number | null;
  nextId: number;
}

export type ListStep = LabStep<ListLabState>;
export type ListOpResult = LabOpResult<ListLabState>;

export type ListOp =
  | { kind: "isiDariTeks"; teks: string }
  | { kind: "acak"; panjang: number; maks: number; benih: number }
  | { kind: "kosongkan" }
  | { kind: "sisipDepan"; nilai: string }
  | { kind: "sisipBelakang"; nilai: string }
  | { kind: "sisipDiIndeks"; indeks: number; nilai: string }
  | { kind: "hapusDepan" }
  | { kind: "hapusBelakang" }
  | { kind: "hapusDiIndeks"; indeks: number }
  | { kind: "hapusNilai"; nilai: string }
  | { kind: "cariNilai"; nilai: string }
  | { kind: "bacaIndeks"; indeks: number }
  | { kind: "setIndeks"; indeks: number; nilai: string }
  | { kind: "telusuri" }
  | { kind: "balik" };

// ---------------------------------------------------------------------------
// Penolong yang dipakai papan juga
// ---------------------------------------------------------------------------

/**
 * Alamat memori tiruan sebuah simpul. Sengaja TIDAK berurutan (kelipatan
 * bilangan prima modulo bilangan prima, jadi unik untuk id < 8999): inti
 * pelajarannya justru bahwa simpul linked list tersebar di memori.
 */
export function alamatSimpul(id: number): number {
  return 1000 + ((id * 7919) % 8999);
}

export function labelAlamat(id: number | null): string {
  return id === null ? "null" : `@${alamatSimpul(id)}`;
}

/** Id simpul dalam urutan list, mengikuti `next` dari head (berhenti bila berputar). */
export function urutanList(state: ListLabState): number[] {
  const peta = new Map(state.nodes.map((n) => [n.id, n]));
  const hasil: number[] = [];
  const dilihat = new Set<number>();
  let cur = state.head;
  while (cur !== null && !dilihat.has(cur) && peta.has(cur)) {
    dilihat.add(cur);
    hasil.push(cur);
    cur = peta.get(cur)!.next;
  }
  return hasil;
}

export function nilaiList(state: ListLabState): string[] {
  const peta = new Map(state.nodes.map((n) => [n.id, n]));
  return urutanList(state).map((id) => peta.get(id)!.value);
}

export function emptyListState(): ListLabState {
  return { nodes: [], head: null, nextId: 0 };
}

/** List dari nilai yang SUDAH sah; id 0..n−1 berurutan. */
export function listStateFromValues(values: readonly string[]): ListLabState {
  const nodes = values.map((value, i) => ({ id: i, value, next: i + 1 < values.length ? i + 1 : null }));
  return { nodes, head: values.length > 0 ? 0 : null, nextId: values.length };
}

/** Pemeriksaan dasar yang berlaku di SETIAP langkah. */
function periksaDasar(state: ListLabState): string | null {
  if (state.nodes.length > LIST_MAX_NODES) return `Simpul ${state.nodes.length} melebihi ${LIST_MAX_NODES}.`;
  const ids = new Set<number>();
  for (const n of state.nodes) {
    if (!LAB_VALUE_RE.test(n.value)) return `Nilai "${n.value}" tidak sah.`;
    if (ids.has(n.id)) return `Id ${n.id} ganda.`;
    if (n.id >= state.nextId) return `Id ${n.id} tidak lebih kecil dari nextId.`;
    ids.add(n.id);
  }
  for (const n of state.nodes) if (n.next !== null && !ids.has(n.next)) return `next simpul ${n.id} menunjuk simpul yang tidak ada.`;
  if (state.head !== null && !ids.has(state.head)) return "head menunjuk simpul yang tidak ada.";
  const alamat = new Set(state.nodes.map((n) => alamatSimpul(n.id)));
  if (alamat.size !== state.nodes.length) return "Dua simpul berbagi alamat.";
  return null;
}

/**
 * Keadaan "rapi" — syarat keadaan akhir setiap operasi dan keadaan dari URL:
 * semua simpul tercapai dari head tepat sekali, berakhir di null.
 */
export function assertListInvariants(state: ListLabState): string | null {
  const dasar = periksaDasar(state);
  if (dasar) return dasar;
  if ((state.head === null) !== (state.nodes.length === 0)) return "head harus null tepat ketika list kosong.";
  const urut = urutanList(state);
  if (urut.length !== state.nodes.length) return "Ada simpul yang tidak tercapai dari head, atau rantainya berputar.";
  const ekor = state.nodes.find((n) => n.id === urut[urut.length - 1]);
  if (ekor && ekor.next !== null) return "Rantai berputar kembali.";
  return null;
}

/**
 * Pemeriksaan untuk langkah di TENGAH operasi: simpul boleh lepas dari rantai,
 * tapi tidak boleh hilang — setiap simpul harus bisa dicapai dari head atau
 * dari salah satu variabel penunjuk. Simpul yang tidak ditunjuk siapa pun
 * sudah tidak bisa diselamatkan; dalam program sungguhan itu kebocoran
 * memori atau data yang hilang.
 */
export function assertListLangkah(state: ListLabState, variabel: readonly { id: number | null }[] = []): string | null {
  const dasar = periksaDasar(state);
  if (dasar) return dasar;
  const peta = new Map(state.nodes.map((n) => [n.id, n]));
  const tercapai = new Set<number>();
  for (const awal of [state.head, ...variabel.map((v) => v.id)]) {
    let cur = awal;
    const jalan = new Set<number>();
    while (cur !== null && peta.has(cur)) {
      if (jalan.has(cur)) return "Rantai berputar.";
      jalan.add(cur);
      tercapai.add(cur);
      cur = peta.get(cur)!.next;
    }
  }
  const hilang = state.nodes.filter((n) => !tercapai.has(n.id));
  if (hilang.length > 0) return `Simpul ${hilang.map((n) => labelAlamat(n.id)).join(", ")} hilang: tidak ditunjuk head maupun variabel mana pun.`;
  return null;
}

// ---------------------------------------------------------------------------
// Penolong langkah
// ---------------------------------------------------------------------------

type Variabel = { nama: string; id: number | null }[];

interface OpsiLangkah {
  variabel?: Variabel;
  peran?: Record<number, LabPeran>;
  posisi?: Record<number, { kolom: number; baris: number }>;
  gerak?: boolean;
  jalur?: number[];
  tahan?: number;
}

function langkah(state: ListLabState, narasi: string, opsi: OpsiLangkah = {}): ListStep {
  const step: ListStep = {
    state,
    narasi,
    fokus: [],
    tahanMs: opsi.tahan ?? (opsi.gerak ? LAB_MOVE_HOLD_MS : LAB_STEP_HOLD_MS),
  };
  if (opsi.variabel) step.variabel = opsi.variabel;
  if (opsi.peran) step.peran = opsi.peran;
  if (opsi.posisi) step.posisiSimpul = opsi.posisi;
  if (opsi.jalur) step.jalur = opsi.jalur;
  return step;
}

function gagal(error: string): ListOpResult {
  return { ok: false, error };
}

function berhasil(steps: ListStep[]): ListOpResult {
  if (steps.length > LIST_MAX_STEPS) return { ok: true, steps: [...steps.slice(0, LIST_MAX_STEPS - 1), steps[steps.length - 1]] };
  return { ok: true, steps };
}

const GALAT_NILAI = `Nilai harus 1 sampai ${LAB_MAX_ITEM_CHARS} karakter berisi huruf, angka, spasi, titik, atau tanda minus.`;
const GALAT_KOSONG = "List masih kosong.";

function nilaiBersih(raw: string): string | null {
  const v = cleanLabText(raw);
  return LAB_VALUE_RE.test(v) ? v : null;
}

/** Mengubah satu simpul (next/nilai) tanpa menyentuh yang lain. */
function setSimpul(state: ListLabState, id: number, ubah: Partial<Pick<ListNode, "next" | "value">>): ListLabState {
  return { ...state, nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...ubah } : n)) };
}

function simpul(state: ListLabState, id: number): ListNode {
  return state.nodes.find((n) => n.id === id)!;
}

/** Letak rantai sekarang (kolom = indeks), ditambah simpul-simpul lepas di baris bawah. */
function tataRantai(ids: readonly number[], lepas: Record<number, { kolom: number; baris: number }> = {}) {
  const hasil: Record<number, { kolom: number; baris: number }> = {};
  ids.forEach((id, k) => (hasil[id] = { kolom: k, baris: 0 }));
  return { ...hasil, ...lepas };
}

const sebut = (state: ListLabState, id: number) => `${simpul(state, id).value} (${labelAlamat(id)})`;

/**
 * Langkah berjalan dengan `cur` dari head sejauh `hop` simpul. Mengembalikan
 * langkah-langkahnya; `cur` di akhir menunjuk `ids[hop]`.
 */
function jalanKe(state: ListLabState, ids: readonly number[], hop: number, alasan: string, tambahan: Variabel = []): ListStep[] {
  const steps: ListStep[] = [
    langkah(state, `${alasan} Mulai dari head: cur = head (${sebut(state, ids[0])}).`, {
      variabel: [{ nama: "cur", id: ids[0] }, ...tambahan],
      peran: { [ids[0]]: "banding" },
      tahan: LAB_VISIT_HOLD_MS + 300,
    }),
  ];
  for (let k = 1; k <= hop; k++) {
    steps.push(
      langkah(state, `cur = cur.next → simpul ke-${k}, ${sebut(state, ids[k])}.`, {
        variabel: [{ nama: "cur", id: ids[k] }, ...tambahan],
        peran: { [ids[k]]: "banding" },
        jalur: ids.slice(0, k + 1),
        tahan: LAB_VISIT_HOLD_MS + 300,
      }),
    );
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Operasi penyusun
// ---------------------------------------------------------------------------

function sisip(state: ListLabState, indeks: number, nilai: string, jenis: "depan" | "belakang" | "indeks"): ListOpResult {
  const ids = urutanList(state);
  const n = ids.length;
  if (n >= LIST_MAX_NODES) return gagal(`List sudah ${LIST_MAX_NODES} simpul, tidak bisa ditambah lagi.`);
  const baru: ListNode = { id: state.nextId, value: nilai, next: null };
  const denganBaru: ListLabState = { ...state, nodes: [...state.nodes, baru], nextId: state.nextId + 1 };
  const steps: ListStep[] = [];

  if (indeks === 0) {
    const posisi = tataRantai(ids, { [baru.id]: { kolom: 0, baris: 1 } });
    steps.push(
      langkah(denganBaru, `Buat simpul baru berisi ${nilai} di alamat ${labelAlamat(baru.id)}; next-nya masih null.`, {
        variabel: [{ nama: "baru", id: baru.id }],
        posisi,
        peran: { [baru.id]: "kunci" },
      }),
    );
    let s = denganBaru;
    if (state.head !== null) {
      s = setSimpul(s, baru.id, { next: state.head });
      steps.push(
        langkah(s, `baru.next = head: simpul baru menunjuk simpul pertama, ${sebut(state, state.head)}.`, {
          variabel: [{ nama: "baru", id: baru.id }],
          posisi,
          peran: { [baru.id]: "kunci" },
          gerak: true,
        }),
      );
    }
    s = { ...s, head: baru.id };
    steps.push(
      langkah(s, `head = baru: simpul baru kini yang pertama, dan simpul lain bergeser satu ke kanan.`, {
        variabel: [{ nama: "baru", id: baru.id }],
        peran: { [baru.id]: "kunci" },
        gerak: true,
      }),
    );
    steps.push(
      langkah(
        s,
        jenis === "depan"
          ? `Selesai: sisip di depan cukup mengubah dua pointer, berapa pun panjang list-nya — O(1).`
          : `Selesai: panjang list kini ${n + 1}.`,
      ),
    );
    return berhasil(steps);
  }

  // Berjalan ke simpul SEBELUM posisi sisip.
  const alasan =
    jenis === "belakang"
      ? "Singly linked list hanya menyimpan head, jadi untuk sampai ke ekor kita harus berjalan."
      : `Untuk menyisip di indeks ${indeks}, kita perlu simpul SEBELUMNYA (indeks ${indeks - 1}).`;
  steps.push(...jalanKe(state, ids, indeks - 1, alasan));
  const cur = ids[indeks - 1];
  const sesudah = indeks < n ? ids[indeks] : null;
  const posisi = tataRantai(ids, { [baru.id]: { kolom: indeks, baris: 1 } });
  steps.push(
    langkah(
      denganBaru,
      `${jenis === "belakang" ? "cur.next == null, jadi cur adalah ekor. " : ""}Buat simpul baru berisi ${nilai} di alamat ${labelAlamat(baru.id)}.`,
      { variabel: [{ nama: "cur", id: cur }, { nama: "baru", id: baru.id }], posisi, peran: { [baru.id]: "kunci", [cur]: "banding" } },
    ),
  );
  let s = denganBaru;
  if (sesudah !== null) {
    s = setSimpul(s, baru.id, { next: sesudah });
    steps.push(
      langkah(
        s,
        `baru.next = cur.next: simpul baru menunjuk ${sebut(state, sesudah)} DULU. Kalau cur.next diubah lebih dulu, sisa list tidak lagi ditunjuk siapa pun dan hilang.`,
        { variabel: [{ nama: "cur", id: cur }, { nama: "baru", id: baru.id }], posisi, peran: { [baru.id]: "kunci", [cur]: "banding" }, gerak: true },
      ),
    );
  }
  s = setSimpul(s, cur, { next: baru.id });
  steps.push(
    langkah(s, `cur.next = baru: ${sebut(state, cur)} kini menunjuk simpul baru, dan simpul baru masuk ke rantai di indeks ${indeks}.`, {
      variabel: [{ nama: "cur", id: cur }, { nama: "baru", id: baru.id }],
      peran: { [baru.id]: "kunci" },
      gerak: true,
    }),
  );
  steps.push(
    langkah(
      s,
      jenis === "belakang"
        ? `Selesai — butuh ${indeks - 1} langkah berjalan untuk sampai ke ekor: sisip di belakang O(n) tanpa penunjuk tail.`
        : `Selesai — ${indeks - 1} langkah berjalan, lalu dua pointer diubah. Tidak ada elemen yang digeser seperti pada array.`,
    ),
  );
  return berhasil(steps);
}

/**
 * Menghapus simpul di `indeks`. `awal` = langkah pencarian yang sudah dibuat
 * pemanggil (hapus menurut nilai), dan `pendahulu` nama variabel yang
 * memegang simpul sebelumnya di langkah-langkah itu.
 */
function hapusDi(state: ListLabState, indeks: number, awal: ListStep[] = [], pendahulu = "cur"): ListOpResult {
  const ids = urutanList(state);
  const n = ids.length;
  const target = ids[indeks];
  const steps = [...awal];
  const tanpa: ListLabState = { ...state, nodes: state.nodes.filter((x) => x.id !== target) };

  if (indeks === 0) {
    steps.push(
      langkah(state, `Simpan simpul pertama di variabel "hapus" supaya alamatnya (${labelAlamat(target)}) tidak hilang.`, {
        variabel: [{ nama: "hapus", id: target }],
        peran: { [target]: "hapus" },
      }),
    );
    const s = { ...state, head: simpul(state, target).next };
    steps.push(
      langkah(s, `head = head.next: head kini menunjuk ${n > 1 ? sebut(state, ids[1]) : "null — list menjadi kosong"}. Simpul lama tidak lagi tercapai dari head.`, {
        variabel: [{ nama: "hapus", id: target }],
        peran: { [target]: "hapus" },
        posisi: tataRantai(ids.slice(1), { [target]: { kolom: 0, baris: 1 } }),
        gerak: true,
      }),
    );
    steps.push(langkah({ ...tanpa, head: s.head }, `Bebaskan memori simpul ${labelAlamat(target)}. Hapus di depan selalu O(1).`, { gerak: true }));
    return berhasil(steps);
  }

  const cur = ids[indeks - 1];
  const sesudah = indeks + 1 < n ? ids[indeks + 1] : null;
  if (awal.length === 0) {
    steps.push(
      ...jalanKe(
        state,
        ids,
        indeks - 1,
        indeks === n - 1
          ? "Untuk menghapus ekor, kita butuh simpul SEBELUM ekor — dan singly linked list tidak bisa berjalan mundur."
          : `Untuk menghapus simpul di indeks ${indeks}, kita perlu simpul sebelumnya (indeks ${indeks - 1}).`,
      ),
    );
  }
  steps.push(
    langkah(state, `Simpul yang dihapus: hapus = ${pendahulu}.next = ${sebut(state, target)}.`, {
      variabel: [{ nama: pendahulu, id: cur }, { nama: "hapus", id: target }],
      peran: { [cur]: "banding", [target]: "hapus" },
    }),
  );
  const s = setSimpul(state, cur, { next: sesudah });
  steps.push(
    langkah(s, `${pendahulu}.next = hapus.next: panah ${sebut(state, cur)} kini melompati simpul yang dihapus ke ${sesudah === null ? "null" : sebut(state, sesudah)}.`, {
      variabel: [{ nama: pendahulu, id: cur }, { nama: "hapus", id: target }],
      peran: { [target]: "hapus" },
      posisi: tataRantai(
        ids.filter((x) => x !== target),
        { [target]: { kolom: indeks, baris: 1 } },
      ),
      gerak: true,
    }),
  );
  steps.push(langkah(setSimpul(tanpa, cur, { next: sesudah }), `Bebaskan memori simpul ${labelAlamat(target)}. Panjang list kini ${n - 1}.`, { gerak: true }));
  return berhasil(steps);
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function applyListOp(state: ListLabState, op: ListOp): ListOpResult {
  const ids = urutanList(state);
  const n = ids.length;
  const galatIndeks = (i: number, maks: number) =>
    !Number.isInteger(i) || i < 0 || i > maks
      ? `Indeks ${i} tidak ada; ${maks < 0 ? "list masih kosong" : `yang bisa dipakai hanya 0 sampai ${maks}`}.`
      : null;

  switch (op.kind) {
    case "isiDariTeks": {
      const nilai = op.teks
        .split(/[,\s]+/)
        .map((v) => cleanLabText(v))
        .filter((v) => v.length > 0);
      if (nilai.length === 0) return gagal("Tulis minimal satu nilai, mis. 3, 8, 1.");
      if (nilai.length > LIST_MAX_NODES) return gagal(`Paling banyak ${LIST_MAX_NODES} simpul.`);
      for (const v of nilai) if (!LAB_VALUE_RE.test(v)) return gagal(`"${v}": ${GALAT_NILAI}`);
      const dasar = listStateFromValues(nilai);
      const geser = state.nextId;
      const akhir: ListLabState = {
        nodes: dasar.nodes.map((x) => ({ ...x, id: x.id + geser, next: x.next === null ? null : x.next + geser })),
        head: geser,
        nextId: geser + nilai.length,
      };
      return berhasil([langkah(akhir, `List diisi ulang: ${nilai.length} simpul, masing-masing di alamat yang tersebar di memori.`)]);
    }

    case "acak": {
      if (!Number.isInteger(op.panjang) || op.panjang < 1 || op.panjang > LIST_MAX_NODES) return gagal(`Panjang harus 1 sampai ${LIST_MAX_NODES}.`);
      if (!Number.isInteger(op.maks) || op.maks < 1 || op.maks > LIST_MAX_RANDOM_VALUE) return gagal(`Nilai terbesar harus 1 sampai ${LIST_MAX_RANDOM_VALUE}.`);
      if (!Number.isInteger(op.benih)) return gagal("Benih acak harus bilangan bulat.");
      const acak = mulberry32(op.benih);
      return applyListOp(state, { kind: "isiDariTeks", teks: Array.from({ length: op.panjang }, () => String(Math.floor(acak() * (op.maks + 1)))).join(" ") });
    }

    case "kosongkan":
      if (n === 0) return berhasil([langkah(state, "List sudah kosong.")]);
      return berhasil([langkah({ ...emptyListState(), nextId: state.nextId }, `Seluruh ${n} simpul dibebaskan; head = null.`)]);

    case "sisipDepan":
    case "sisipBelakang":
    case "sisipDiIndeks": {
      const nilai = nilaiBersih(op.nilai);
      if (nilai === null) return gagal(GALAT_NILAI);
      const indeks = op.kind === "sisipDepan" ? 0 : op.kind === "sisipBelakang" ? n : op.indeks;
      const g = galatIndeks(indeks, n);
      if (g) return gagal(g);
      return sisip(state, indeks, nilai, op.kind === "sisipDepan" ? "depan" : op.kind === "sisipBelakang" ? "belakang" : "indeks");
    }

    case "hapusDepan":
    case "hapusBelakang":
    case "hapusDiIndeks": {
      if (n === 0) return gagal(`${GALAT_KOSONG} Tidak ada yang bisa dihapus.`);
      const indeks = op.kind === "hapusDepan" ? 0 : op.kind === "hapusBelakang" ? n - 1 : op.indeks;
      const g = galatIndeks(indeks, n - 1);
      if (g) return gagal(g);
      return hapusDi(state, indeks);
    }

    case "hapusNilai":
    case "cariNilai": {
      const nilai = nilaiBersih(op.nilai);
      if (nilai === null) return gagal(GALAT_NILAI);
      if (n === 0) return gagal(`${GALAT_KOSONG} Tidak ada yang bisa dicari.`);
      const steps: ListStep[] = [];
      for (let k = 0; k < n; k++) {
        const id = ids[k];
        const sama = simpul(state, id).value === nilai;
        steps.push(
          langkah(
            state,
            `${k === 0 ? "cur = head. " : op.kind === "hapusNilai" ? "prev = cur, cur = cur.next. " : "cur = cur.next. "}Bandingkan cur.value = ${simpul(state, id).value} dengan ${nilai}: ${sama ? "sama — ketemu!" : "beda, lanjut."}`,
            {
              // Menghapus butuh simpul SEBELUM yang ketemu, jadi `prev` ikut berjalan.
              variabel: op.kind === "hapusNilai" ? [{ nama: "prev", id: k > 0 ? ids[k - 1] : null }, { nama: "cur", id }] : [{ nama: "cur", id }],
              peran: { [id]: sama ? "hasil" : "banding" },
              jalur: ids.slice(0, k + 1),
              tahan: LAB_VISIT_HOLD_MS + 300,
            },
          ),
        );
        if (sama) {
          if (op.kind === "cariNilai") {
            steps.push(
              langkah(state, `${nilai} ditemukan di indeks ${k} setelah ${k + 1} perbandingan. Pencarian di linked list selalu berjalan dari head — O(n).`, {
                peran: { [id]: "hasil" },
              }),
            );
            return berhasil(steps);
          }
          return hapusDi(state, k, steps, "prev");
        }
      }
      steps.push(
        langkah(state, `cur = cur.next = null: sudah melewati ekor. ${nilai} tidak ada di list (${n} perbandingan).`, {
          variabel: [{ nama: "cur", id: null }],
          jalur: ids,
        }),
      );
      steps.push(langkah(state, `Selesai: ${nilai} tidak ditemukan${op.kind === "hapusNilai" ? ", jadi tidak ada yang dihapus" : ""}.`));
      return berhasil(steps);
    }

    case "bacaIndeks":
    case "setIndeks": {
      if (n === 0) return gagal(GALAT_KOSONG);
      const g = galatIndeks(op.indeks, n - 1);
      if (g) return gagal(g);
      const nilai = op.kind === "setIndeks" ? nilaiBersih(op.nilai) : null;
      if (op.kind === "setIndeks" && nilai === null) return gagal(GALAT_NILAI);
      const id = ids[op.indeks];
      const steps = jalanKe(
        state,
        ids,
        op.indeks,
        `Linked list tidak bisa melompat langsung ke indeks ${op.indeks} seperti array — ia harus berjalan ${op.indeks} langkah.`,
      );
      if (op.kind === "bacaIndeks") {
        steps.push(
          langkah(state, `Indeks ${op.indeks} berisi ${simpul(state, id).value}, dicapai setelah ${op.indeks} langkah. Di array, ini cukup satu langkah.`, {
            peran: { [id]: "hasil" },
          }),
        );
      } else {
        const lama = simpul(state, id).value;
        const s = setSimpul(state, id, { value: nilai as string });
        steps.push(langkah(s, `cur.value = ${nilai}: simpul indeks ${op.indeks} diubah dari ${lama} menjadi ${nilai}.`, { variabel: [{ nama: "cur", id }], peran: { [id]: "hasil" } }));
        steps.push(langkah(s, `Selesai — mengubah nilai tidak menyentuh pointer apa pun.`));
      }
      return berhasil(steps);
    }

    case "telusuri": {
      if (n === 0) return gagal(`${GALAT_KOSONG} Tidak ada yang bisa ditelusuri.`);
      const steps: ListStep[] = [];
      for (let k = 0; k < n; k++) {
        steps.push(
          langkah(state, `${k === 0 ? "cur = head" : "cur = cur.next"} → ${sebut(state, ids[k])}. Nilai sejauh ini: ${ids.slice(0, k + 1).map((x) => simpul(state, x).value).join(" → ")}.`, {
            variabel: [{ nama: "cur", id: ids[k] }],
            peran: { [ids[k]]: "banding" },
            jalur: ids.slice(0, k + 1),
            tahan: LAB_VISIT_HOLD_MS + 300,
          }),
        );
      }
      steps.push(
        langkah(state, `cur = cur.next = null: perulangan berhenti. Isi list: ${nilaiList(state).join(" → ")} → null.`, {
          variabel: [{ nama: "cur", id: null }],
          jalur: ids,
        }),
      );
      steps.push(langkah(state, `Penelusuran selesai: ${n} simpul dikunjungi, mengikuti pointer next dari head sampai null.`));
      return berhasil(steps);
    }

    case "balik": {
      if (n < 2) return berhasil([langkah(state, `List berisi ${n} simpul, jadi membaliknya tidak mengubah apa pun.`)]);
      // Simpul DIAM di tempat semula selama pointer dibalik satu per satu;
      // baru di langkah terakhir semuanya meluncur ke urutan baru.
      const posisi = tataRantai(ids);
      const steps: ListStep[] = [
        langkah(state, "Membalik list memakai tiga variabel: prev, cur, dan next. Mulai prev = null, cur = head.", {
          variabel: [{ nama: "prev", id: null }, { nama: "cur", id: ids[0] }],
          posisi,
        }),
      ];
      let s = state;
      let prev: number | null = null;
      for (let k = 0; k < n; k++) {
        const cur = ids[k];
        const next = k + 1 < n ? ids[k + 1] : null;
        steps.push(
          langkah(s, `next = cur.next: simpan dulu simpul sesudah cur (${next === null ? "null" : sebut(state, next)}), supaya tidak hilang saat panah cur dibalik.`, {
            variabel: [{ nama: "prev", id: prev }, { nama: "cur", id: cur }, { nama: "next", id: next }],
            peran: { [cur]: "banding" },
            posisi,
          }),
        );
        s = setSimpul(s, cur, { next: prev });
        steps.push(
          langkah(s, `cur.next = prev: panah ${sebut(state, cur)} dibalik menunjuk ${prev === null ? "null" : sebut(state, prev)}.`, {
            variabel: [{ nama: "prev", id: prev }, { nama: "cur", id: cur }, { nama: "next", id: next }],
            peran: { [cur]: "banding" },
            posisi,
            gerak: true,
          }),
        );
        prev = cur;
        steps.push(
          langkah(s, `prev = cur, cur = next: keduanya maju satu simpul.`, {
            variabel: [{ nama: "prev", id: prev }, { nama: "cur", id: next }],
            posisi,
          }),
        );
      }
      s = { ...s, head: prev };
      steps.push(
        langkah(s, `cur == null: semua panah sudah dibalik. head = prev → simpul yang tadinya ekor.`, {
          variabel: [{ nama: "prev", id: prev }],
          posisi,
          gerak: true,
        }),
      );
      steps.push(langkah(s, `Selesai: simpul tidak berpindah di memori — hanya panahnya yang berbalik. Kini dibaca dari head: ${nilaiList(s).join(" → ")}.`, { gerak: true }));
      return berhasil(steps);
    }

    default: {
      const _lengkap: never = op;
      throw new Error(`applyListOp: operasi tidak dikenal (${JSON.stringify(_lengkap)}).`);
    }
  }
}
