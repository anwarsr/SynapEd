/**
 * Pemeriksaan murni untuk SynapLab: reducer keempat lab array (1D, 2D, 3D,
 * N-dimensi), serialisasi URL, dan riwayat.
 *
 * Tidak butuh dev server, Firestore, maupun kredensial — seluruh logika yang
 * diuji di sini berjalan di browser dan tidak pernah menyentuh jaringan. Karena
 * itu `check`/`finish` diimpor dari `./checks`, BUKAN dari `./testSupport` yang
 * menjalankan `initAdmin()` di level modul.
 *
 * Yang paling keras diuji dua hal. Pertama, invarian papan: penunjuk tidak
 * pernah keluar batas dan sorotan tidak pernah menunjuk elemen yang sudah
 * hilang — papan yang berbohong di tengah pelajaran lebih buruk daripada papan
 * kosong. Kedua, tautan berbagi: apa yang dikirim guru harus terbuka persis
 * sama di layar muridnya.
 *
 *   npx tsx scripts/verify-lab.ts
 */
import { check, finish } from "./checks";
import {
  applyArrayOp,
  arrayStateFromValues,
  assertArrayInvariants,
  emptyArrayState,
  type ArrayLabState,
  type ArrayOp,
} from "../frontend/src/lib/lab/arrayLab";
import {
  ARRAY_OP_CATALOG,
  buildArrayOp,
  type OpSpec,
} from "../frontend/src/lib/lab/arrayLabCatalog";
import {
  decodeLabSnapshot,
  encodeLabSnapshot,
  LAB_MAX_URL_STATE,
} from "../frontend/src/lib/lab/labUrl";
import {
  applyMatrixOp,
  assertMatrixInvariants,
  emptyMatrixState,
  matrixCols,
  MATRIX_MAX_COLS,
  MATRIX_MAX_NOTES,
  MATRIX_MAX_ROWS,
  MATRIX_MAX_STEPS,
  type MatrixLabState,
  type MatrixOp,
} from "../frontend/src/lib/lab/matrixLab";
import { buildMatrixOp, MATRIX_OP_CATALOG } from "../frontend/src/lib/lab/matrixLabCatalog";
import {
  applyNdOp,
  assertNdInvariants,
  emptyNdState,
  ndKoordinat,
  ndOffset,
  ndStrides,
  ndTotal,
  ND_MAX_DIMS,
  ND_MAX_ELEMENTS,
  ND_MAX_STEPS,
  parseNdBentuk,
  type NdLabState,
  type NdOp,
} from "../frontend/src/lib/lab/ndLab";
import { buildNdOp, ND_OP_CATALOG } from "../frontend/src/lib/lab/ndLabCatalog";
import {
  applyCubeOp,
  assertCubeInvariants,
  CUBE_MAX_SIDE,
  CUBE_MAX_STEPS,
  cubeDalamKotak,
  cubeKoord,
  cubeOffset,
  emptyCubeState,
  type CubeLabState,
  type CubeOp,
} from "../frontend/src/lib/lab/cubeLab";
import { buildCubeOp, CUBE_OP_CATALOG } from "../frontend/src/lib/lab/cubeLabCatalog";
import {
  canRedo,
  initHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type LabHistory,
} from "../frontend/src/lib/lab/labHistory";
import { mulberry32 } from "../frontend/src/lib/lab/labRandom";
import {
  LAB_MAX_HISTORY,
  LAB_MAX_ITEMS,
  LAB_MAX_KELOMPOK,
  LAB_MAX_STEPS,
  LAB_STEP_HOLD_MS,
  LAB_TONES,
} from "../frontend/src/lib/lab/labTypes";

// ── Penolong ─────────────────────────────────────────────────────────────

/** Nilai elemen saja — bentuk yang paling mudah dibaca saat sebuah uji gagal. */
const nilai = (s: ArrayLabState) => s.items.map((i) => i.value);

/**
 * JSON dengan urutan kunci dipatok.
 *
 * `JSON.stringify` apa adanya membandingkan urutan penulisan field, jadi dua
 * keadaan yang sama persis bisa dinyatakan berbeda hanya karena satu fungsi
 * menyusun objeknya dengan urutan lain — lulus/gagal palsu yang sulit dilacak.
 */
function kanonik(s: ArrayLabState): string {
  return JSON.stringify({
    items: s.items.map((i) => ({ id: i.id, value: i.value, note: i.note })),
    pointers: [...s.pointers]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ name: p.name, index: p.index, tone: p.tone })),
    ranges: [...s.ranges]
      .sort((a, b) => a.from - b.from || a.to - b.to)
      .map((r) => ({ from: r.from, to: r.to, tone: r.tone })),
    nextId: s.nextId,
  });
}

/** Menjalankan operasi dan melempar kalau gagal — untuk menyusun fixture. */
function jalan(state: ArrayLabState, op: ArrayOp): ArrayLabState {
  const h = applyArrayOp(state, op);
  if (!h.ok) throw new Error(`fixture gagal (${op.kind}): ${h.error}`);
  return h.steps[h.steps.length - 1].state;
}

/** Keadaan beku — mutasi tak sengaja di dalam reducer akan melempar. */
function beku(state: ArrayLabState): ArrayLabState {
  state.items.forEach((i) => Object.freeze(i));
  state.pointers.forEach((p) => Object.freeze(p));
  state.ranges.forEach((r) => Object.freeze(r));
  Object.freeze(state.items);
  Object.freeze(state.pointers);
  Object.freeze(state.ranges);
  return Object.freeze(state);
}

const LIMA = arrayStateFromValues(["1", "2", "3", "4", "5"]);
const HURUF = arrayStateFromValues(["a", "b", "c", "d", "e"]);

// ── 1. Katalog operasi ───────────────────────────────────────────────────
{
  const spesifikasi = Object.values(ARRAY_OP_CATALOG) as OpSpec[];
  let tidakDikenal = 0;
  let gagalContoh: string[] = [];

  // Papan contoh sengaja sudah punya penunjuk dan sorotan: operasi seperti
  // geserPenunjuk memang menuntut penunjuknya sudah ada, dan menjalankannya di
  // papan kosong hanya menguji pesan galatnya.
  const papanContoh = [
    { kind: "setPenunjuk", nama: "i", indeks: 1, tone: "utama" },
    { kind: "setPenunjuk", nama: "j", indeks: 3, tone: "kedua" },
    { kind: "sorotRentang", dari: 1, sampai: 2, tone: "sorot" },
  ].reduce((s, op) => jalan(s, op as ArrayOp), LIMA);

  for (const spec of spesifikasi) {
    const hasil = applyArrayOp(papanContoh, spec.contoh);
    if (!hasil.ok) gagalContoh.push(`${spec.kind}: ${hasil.error}`);
    if (!hasil.ok && /tidak dikenal/i.test(hasil.error)) tidakDikenal++;
  }

  check(
    "setiap operasi di katalog punya contoh yang benar-benar jalan",
    gagalContoh.length === 0 && tidakDikenal === 0,
    gagalContoh.length === 0 ? `${spesifikasi.length} operasi` : gagalContoh.join(" | "),
  );

  check(
    "katalog memuat seluruh operasi yang dikenal reducer",
    spesifikasi.length === 20,
    `${spesifikasi.length} operasi terdaftar`,
  );

  // buildArrayOp hanya memeriksa BENTUK; domain diperiksa applyArrayOp.
  const sah = buildArrayOp("setIndeks", { indeks: "2", nilai: "9" });
  const kosong = buildArrayOp("setIndeks", { indeks: "", nilai: "9" });
  const bukanAngka = buildArrayOp("setIndeks", { indeks: "dua", nilai: "9" });
  check(
    "buildArrayOp: form terisi jadi operasi, form kosong/bukan angka jadi null",
    sah !== null && kosong === null && bukanAngka === null,
    `sah=${JSON.stringify(sah)}, kosong=${kosong}, bukanAngka=${bukanAngka}`,
  );
}

// ── 2. Hasil yang diharapkan ─────────────────────────────────────────────
{
  const kasus: [string, ArrayOp, ArrayLabState, string[]][] = [
    ["push", { kind: "push", nilai: "9" }, LIMA, ["1", "2", "3", "4", "5", "9"]],
    ["pop", { kind: "pop" }, LIMA, ["1", "2", "3", "4"]],
    ["unshift", { kind: "unshift", nilai: "0" }, LIMA, ["0", "1", "2", "3", "4", "5"]],
    ["shift", { kind: "shift" }, LIMA, ["2", "3", "4", "5"]],
    ["sisip di tengah", { kind: "sisip", indeks: 2, nilai: "x" }, LIMA, ["1", "2", "x", "3", "4", "5"]],
    ["sisip di akhir", { kind: "sisip", indeks: 5, nilai: "x" }, LIMA, ["1", "2", "3", "4", "5", "x"]],
    ["hapus", { kind: "hapus", indeks: 0 }, LIMA, ["2", "3", "4", "5"]],
    ["tukar", { kind: "tukar", a: 0, b: 4 }, LIMA, ["5", "2", "3", "4", "1"]],
    ["balik", { kind: "balik" }, LIMA, ["5", "4", "3", "2", "1"]],
    ["slice inklusif", { kind: "slice", dari: 1, sampai: 3 }, HURUF, ["b", "c", "d"]],
    ["setIndeks", { kind: "setIndeks", indeks: 1, nilai: "9" }, LIMA, ["1", "9", "3", "4", "5"]],
  ];

  const meleset = kasus.filter(([, op, awal, harap]) => {
    const h = applyArrayOp(awal, op);
    return !h.ok || JSON.stringify(nilai(h.steps[h.steps.length - 1].state)) !== JSON.stringify(harap);
  });

  check(
    "operasi menghasilkan array yang diharapkan",
    meleset.length === 0,
    meleset.length === 0 ? `${kasus.length} kasus` : meleset.map(([n]) => n).join(", "),
  );

  // Jumlah langkah menangkap off-by-one di penghasil animasi: balik n elemen
  // adalah 1 langkah pembuka + floor(n/2) tukar + 1 penutup yang memulihkan
  // sorotan milik pengguna. Diuji pada dua panjang supaya yang terkunci adalah
  // rumusnya, bukan satu angka yang kebetulan cocok.
  const balikMeleset = [5, 8].filter((n) => {
    const h = applyArrayOp(arrayStateFromValues(Array.from({ length: n }, (_, i) => String(i + 1))), { kind: "balik" });
    return !h.ok || h.steps.length !== 2 + Math.floor(n / 2);
  });
  check(
    "balik menghasilkan satu langkah per tukar, tanpa langkah hantu",
    balikMeleset.length === 0,
    balikMeleset.length === 0 ? "n=5 jadi 4 langkah, n=8 jadi 6 langkah" : `meleset pada n=${balikMeleset.join(",")}`,
  );

  const baca = applyArrayOp(LIMA, { kind: "bacaIndeks", indeks: 2 });
  check(
    "bacaIndeks menyorot tanpa mengubah isi array",
    baca.ok && JSON.stringify(nilai(baca.steps[baca.steps.length - 1].state)) === JSON.stringify(nilai(LIMA)),
    baca.ok ? nilai(baca.steps[baca.steps.length - 1].state).join(",") : baca.error,
  );
}

// ── 3. Invarian di bawah operasi acak ────────────────────────────────────
{
  const rng = mulberry32(20261004);
  const pilih = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
  const bulat = (maks: number) => Math.floor(rng() * maks);

  let state = emptyArrayState();
  let kasus = 0;
  let rusak: string | null = null;
  let langkahBerlebih = 0;
  let narasiKosong = 0;
  let akhirMeleset = 0;
  let dilempar: string | null = null;

  for (let i = 0; i < 20000 && rusak === null; i++) {
    const n = state.items.length;
    const op: ArrayOp = pilih<ArrayOp>([
      { kind: "push", nilai: String(bulat(100)) },
      { kind: "pop" },
      { kind: "unshift", nilai: String(bulat(100)) },
      { kind: "shift" },
      { kind: "sisip", indeks: bulat(n + 1), nilai: String(bulat(100)) },
      { kind: "hapus", indeks: bulat(Math.max(n, 1)) },
      { kind: "tukar", a: bulat(Math.max(n, 1)), b: bulat(Math.max(n, 1)) },
      { kind: "balik" },
      { kind: "slice", dari: bulat(Math.max(n, 1)), sampai: bulat(Math.max(n, 1)) },
      { kind: "setIndeks", indeks: bulat(Math.max(n, 1)), nilai: String(bulat(100)) },
      { kind: "setPenunjuk", nama: pilih(["i", "j", "kiri", "kanan"]), indeks: bulat(n + 1), tone: pilih(["utama", "kedua"] as const) },
      { kind: "geserPenunjuk", nama: pilih(["i", "j"]), delta: pilih([-1, 1]) },
      { kind: "hapusPenunjuk", nama: pilih(["i", "j"]) },
      { kind: "sorotRentang", dari: bulat(Math.max(n, 1)), sampai: bulat(Math.max(n, 1)), tone: pilih(LAB_TONES) },
      { kind: "hapusSorotan" },
      { kind: "catat", indeks: bulat(Math.max(n, 1)), catatan: pilih(["pivot", "min", "cek"]) },
      { kind: "isiDariTeks", teks: Array.from({ length: bulat(8) + 1 }, () => String(bulat(100))).join(",") },
      { kind: "acak", panjang: bulat(LAB_MAX_ITEMS) + 1, maks: 99, benih: bulat(1000) },
      { kind: "kosongkan" },
    ]);

    let hasil;
    try {
      hasil = applyArrayOp(beku(state), op);
    } catch (e) {
      dilempar = `${op.kind}: ${e instanceof Error ? e.message : String(e)}`;
      break;
    }
    if (!hasil.ok) continue; // penolakan memang sah — yang diuji di blok 5

    kasus++;
    const akhir = hasil.steps[hasil.steps.length - 1].state;

    if (hasil.steps.length > LAB_MAX_STEPS) langkahBerlebih++;
    for (const s of hasil.steps) {
      if (s.narasi.trim() === "" || s.narasi !== s.narasi.trimEnd()) narasiKosong++;
      const masalah = assertArrayInvariants(s.state);
      if (masalah !== null && rusak === null) rusak = `${op.kind}: ${masalah}`;
    }
    if (kanonik(akhir) !== kanonik(hasil.steps[hasil.steps.length - 1].state)) akhirMeleset++;

    state = akhir;
  }

  check("reducer tidak pernah melempar untuk masukan pengguna", dilempar === null, dilempar ?? "tidak ada");
  check(
    "invarian papan utuh sesudah setiap langkah",
    rusak === null,
    rusak ?? `${kasus.toLocaleString("id-ID")} operasi berhasil diuji`,
  );
  check("jumlah langkah tidak pernah melewati batas", langkahBerlebih === 0, `${langkahBerlebih} melebihi ${LAB_MAX_STEPS}`);
  check("setiap langkah punya narasi yang rapi", narasiKosong === 0, `${narasiKosong} narasi bermasalah`);
  check("langkah terakhir adalah keadaan akhir operasi", akhirMeleset === 0, `${akhirMeleset} meleset`);
}

// ── 4. Penanda bertahan saat array menyusut ──────────────────────────────
{
  const dengan = (ops: ArrayOp[], awal = LIMA) => ops.reduce(jalan, awal);

  const setelahPop = dengan([
    { kind: "setPenunjuk", nama: "i", indeks: 4, tone: "utama" },
    { kind: "pop" },
  ]);
  check(
    "penunjuk di ujung mendarat di slot lepas sesudah pop",
    setelahPop.pointers[0]?.index === 4 && setelahPop.items.length === 4,
    `i=${setelahPop.pointers[0]?.index}, panjang=${setelahPop.items.length}`,
  );

  const setelahKosong = dengan([
    { kind: "setPenunjuk", nama: "i", indeks: 3, tone: "utama" },
    { kind: "kosongkan" },
  ]);
  check(
    "array dikosongkan: penunjuk kembali ke 0",
    setelahKosong.pointers.every((p) => p.index === 0),
    JSON.stringify(setelahKosong.pointers),
  );

  const setelahHapus = dengan([
    { kind: "sorotRentang", dari: 2, sampai: 4, tone: "sorot" },
    { kind: "hapus", indeks: 0 },
  ]);
  check(
    "sorotan bergeser saat elemen di depannya dihapus",
    setelahHapus.ranges[0]?.from === 1 && setelahHapus.ranges[0]?.to === 3,
    JSON.stringify(setelahHapus.ranges),
  );

  const setelahSlice = dengan([
    { kind: "sorotRentang", dari: 2, sampai: 4, tone: "sorot" },
    { kind: "slice", dari: 0, sampai: 1 },
  ]);
  check(
    "sorotan yang sudah tidak utuh dibuang, bukan dipotong setengah",
    setelahSlice.ranges.length === 0,
    JSON.stringify(setelahSlice.ranges),
  );
}

// ── 5. Masukan tidak sah ditolak ─────────────────────────────────────────
{
  const kosong = emptyArrayState();
  const penuh = arrayStateFromValues(Array.from({ length: LAB_MAX_ITEMS }, (_, i) => String(i)));
  const empatPenunjuk = (["i", "j", "k", "l"] as const).reduce(
    (s, nama) => jalan(s, { kind: "setPenunjuk", nama, indeks: 0, tone: "utama" }),
    LIMA,
  );

  const harusDitolak: [string, ArrayLabState, ArrayOp][] = [
    ["pop saat kosong", kosong, { kind: "pop" }],
    ["shift saat kosong", kosong, { kind: "shift" }],
    ["indeks -1", LIMA, { kind: "setIndeks", indeks: -1, nilai: "9" }],
    ["indeks n", LIMA, { kind: "setIndeks", indeks: 5, nilai: "9" }],
    ["indeks pecahan", LIMA, { kind: "setIndeks", indeks: 1.5, nilai: "9" }],
    ["indeks NaN", LIMA, { kind: "setIndeks", indeks: Number.NaN, nilai: "9" }],
    ["nilai kosong", LIMA, { kind: "push", nilai: "" }],
    ["nilai 7 karakter", LIMA, { kind: "push", nilai: "1234567" }],
    ["nilai memuat koma", LIMA, { kind: "push", nilai: "1,2" }],
    ["nilai memuat titik dua", LIMA, { kind: "push", nilai: "a:b" }],
    ["nilai memuat tilde", LIMA, { kind: "push", nilai: "a~b" }],
    ["push saat papan penuh", penuh, { kind: "push", nilai: "9" }],
    ["nama penunjuk kosong", LIMA, { kind: "setPenunjuk", nama: "", indeks: 0, tone: "utama" }],
    ["nama penunjuk 7 karakter", LIMA, { kind: "setPenunjuk", nama: "abcdefg", indeks: 0, tone: "utama" }],
    ["indeks penunjuk melewati n", LIMA, { kind: "setPenunjuk", nama: "i", indeks: 6, tone: "utama" }],
    ["penunjuk kelima", empatPenunjuk, { kind: "setPenunjuk", nama: "m", indeks: 0, tone: "utama" }],
    ["acak panjang 0", LIMA, { kind: "acak", panjang: 0, maks: 9, benih: 1 }],
    ["acak panjang 25", LIMA, { kind: "acak", panjang: 25, maks: 9, benih: 1 }],
    ["acak panjang pecahan", LIMA, { kind: "acak", panjang: 1.5, maks: 9, benih: 1 }],
    ["catatan 13 karakter", LIMA, { kind: "catat", indeks: 0, catatan: "1234567890123" }],
    ["rentang terbalik", LIMA, { kind: "sorotRentang", dari: 3, sampai: 1, tone: "sorot" }],
    ["isi teks lebih dari 24 elemen", LIMA, { kind: "isiDariTeks", teks: Array.from({ length: 25 }, (_, i) => i).join(",") }],
  ];

  const lolos = harusDitolak.filter(([, awal, op]) => applyArrayOp(awal, op).ok);
  check(
    "masukan tidak sah ditolak, bukan dihitung diam-diam",
    lolos.length === 0,
    lolos.length === 0 ? `${harusDitolak.length} kasus ditolak` : lolos.map(([n]) => n).join(", "),
  );

  // Keadaan tidak boleh ikut berubah saat operasi ditolak.
  const sebelum = kanonik(LIMA);
  applyArrayOp(LIMA, { kind: "push", nilai: "" });
  check("operasi yang ditolak tidak menyentuh keadaan", kanonik(LIMA) === sebelum, "papan utuh");

  // Huruf besar DINORMALKAN, bukan ditolak: mengetik "I" lalu disuguhi pesan
  // galat hanya menghukum pengguna untuk sesuatu yang bisa dibereskan sendiri.
  // Yang disimpan tetap huruf kecil, supaya nama tidak kembar di papan.
  const besar = applyArrayOp(LIMA, { kind: "setPenunjuk", nama: "I", indeks: 0, tone: "utama" });
  check(
    "nama penunjuk huruf besar dinormalkan menjadi huruf kecil",
    besar.ok && besar.steps[besar.steps.length - 1].state.pointers[0]?.name === "i",
    besar.ok ? JSON.stringify(besar.steps[besar.steps.length - 1].state.pointers) : besar.error,
  );

  const diri = applyArrayOp(LIMA, { kind: "tukar", a: 2, b: 2 });
  check(
    "tukar elemen dengan dirinya sendiri tetap berhasil",
    diri.ok && diri.steps.length >= 1,
    diri.ok ? diri.steps[diri.steps.length - 1].narasi : diri.error,
  );
}

// ── 6. Bolak-balik URL ───────────────────────────────────────────────────
{
  const rng = mulberry32(777);
  const bulat = (maks: number) => Math.floor(rng() * maks);
  const pilih = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

  let diuji = 0;
  let meleset: string | null = null;
  let tidakIdempoten = 0;
  let karakterAneh = 0;
  let lewatParams = 0;

  for (let i = 0; i < 500 && meleset === null; i++) {
    let s = arrayStateFromValues(Array.from({ length: bulat(LAB_MAX_ITEMS) + 1 }, () => String(bulat(1000))));
    const ops: ArrayOp[] = [
      { kind: "setPenunjuk", nama: pilih(["i", "j", "kiri"]), indeks: bulat(s.items.length + 1), tone: pilih(["utama", "kedua"] as const) },
      { kind: "sorotRentang", dari: 0, sampai: bulat(s.items.length), tone: pilih(LAB_TONES) },
      { kind: "catat", indeks: bulat(s.items.length), catatan: pilih(["pivot", "min", "a b"]) },
    ];
    for (const op of ops) {
      const h = applyArrayOp(s, op);
      if (h.ok) s = h.steps[h.steps.length - 1].state;
    }

    const kode = encodeLabSnapshot({ lab: "array1d", state: s });
    if (kode === null) {
      meleset = "encode mengembalikan null untuk keadaan yang sah";
      break;
    }
    diuji++;

    const kembali = decodeLabSnapshot(kode);
    if (!kembali || kembali.lab !== "array1d" || kanonik(kembali.state) !== kanonik(s)) {
      meleset = `bolak-balik meleset pada "${kode}"`;
      break;
    }
    if (encodeLabSnapshot({ lab: "array1d", state: kembali.state }) !== kode) tidakIdempoten++;
    if (!/^[A-Za-z0-9 .\-,:~]+$/.test(kode) || /[%&#+?]/.test(kode)) karakterAneh++;
    // Jebakan sungguhan: URLSearchParams mendekode "+" sebagai spasi.
    if (new URLSearchParams({ s: kode }).get("s") !== kode) lewatParams++;
  }

  check("keadaan sah bolak-balik lewat URL tanpa berubah", meleset === null, meleset ?? `${diuji} keadaan`);
  check("encode bersifat idempoten", tidakIdempoten === 0, `${tidakIdempoten} tidak idempoten`);
  check("kode hanya memakai karakter yang aman di URL", karakterAneh === 0, `${karakterAneh} memuat karakter terlarang`);
  check("kode selamat melewati URLSearchParams", lewatParams === 0, `${lewatParams} berubah`);

  // Papan terburuk: 24 elemen 6 karakter, 4 penunjuk, 4 sorotan, 24 catatan.
  let berat = arrayStateFromValues(Array.from({ length: LAB_MAX_ITEMS }, () => "abc123"));
  (["i", "j", "k", "l"] as const).forEach((nama, n) => {
    berat = jalan(berat, { kind: "setPenunjuk", nama, indeks: n, tone: "utama" });
  });
  LAB_TONES.forEach((tone, n) => {
    berat = jalan(berat, { kind: "sorotRentang", dari: n * 2, sampai: n * 2 + 1, tone });
  });
  for (let i = 0; i < LAB_MAX_ITEMS; i++) {
    berat = jalan(berat, { kind: "catat", indeks: i, catatan: "abcdefghijkl" });
  }
  const kodeBerat = encodeLabSnapshot({ lab: "array1d", state: berat });
  check(
    "papan paling berat pun muat di batas panjang URL",
    kodeBerat !== null && kodeBerat.length <= LAB_MAX_URL_STATE,
    `${kodeBerat?.length ?? "null"} dari ${LAB_MAX_URL_STATE} karakter`,
  );

  const rusak: [string, unknown][] = [
    ["undefined", undefined],
    ["kosong", ""],
    ["bukan string", 12],
    ["versi masa depan", "9a~1,2~~~"],
    ["lab tak dikenal", "1z~1,2~~~"],
    ["ruas kurang", "1a~1,2,3"],
    ["ruas berlebih", "1a~1~~~~~"],
    ["elemen berlebih", `1a~${Array.from({ length: 25 }, (_, i) => i).join(",")}~~~`],
    ["penunjuk di luar batas", "1a~1,2~i:9:utama~~"],
    ["nada tak dikenal", "1a~1,2~~0:1:ungu~"],
    ["indeks pecahan", "1a~1,2~i:1.5:utama~~"],
    ["nama penunjuk ganda", "1a~1,2~i:0:utama,i:1:kedua~~"],
    ["nilai 7 karakter", "1a~1234567~~~"],
    ["memuat karakter kendali", "1a~1,%00~~~"],
    ["terlalu panjang", `1a~${"1,".repeat(2000)}~~~`],
  ];
  const diterima = rusak.filter(([, raw]) => decodeLabSnapshot(raw) !== null);
  check(
    "tautan rusak ditolak seluruhnya, bukan diterima sebagian",
    diterima.length === 0,
    diterima.length === 0 ? `${rusak.length} kasus ditolak` : diterima.map(([n]) => n).join(", "),
  );

  check(
    "papan kosong tetap bisa dibagikan dan dibaca kembali",
    (() => {
      const k = encodeLabSnapshot({ lab: "array1d", state: emptyArrayState() });
      const b = k === null ? null : decodeLabSnapshot(k);
      return b !== null && b.lab === "array1d" && b.state.items.length === 0;
    })(),
    "papan kosong",
  );

  // Tautan 1D yang sudah beredar sebelum lab 2D/N-D ada harus tetap terbuka
  // sebagai lab 1D — huruf `a` di kepalanya tidak pernah berubah arti.
  const lama = decodeLabSnapshot("1a~7,3,12~i:0:utama~1:2:sorot~0:pivot");
  check(
    "tautan 1D lama (kepala 1a) tetap terbuka sebagai lab 1D",
    lama !== null && lama.lab === "array1d" && nilai(lama.state).join(",") === "7,3,12",
    lama === null ? "ditolak" : lama.lab,
  );
}

// ── 7. Riwayat ───────────────────────────────────────────────────────────
{
  const a = arrayStateFromValues(["1"]);
  const b = arrayStateFromValues(["1", "2"]);
  const c = arrayStateFromValues(["1", "2", "3"]);

  let h: LabHistory<ArrayLabState> = initHistory(a, "awal");
  h = pushHistory(h, b, "push 2");
  h = pushHistory(h, c, "push 3");

  const mundur = undoHistory(h);
  const maju = redoHistory(mundur);
  check(
    "undo kembali ke keadaan sebelumnya, redo memulihkannya",
    kanonik(mundur.entries[mundur.cursor].state) === kanonik(b) &&
      kanonik(maju.entries[maju.cursor].state) === kanonik(c),
    `undo=${nilai(mundur.entries[mundur.cursor].state).join(",")}, redo=${nilai(maju.entries[maju.cursor].state).join(",")}`,
  );

  const cabang = pushHistory(mundur, arrayStateFromValues(["9"]), "push 9");
  check(
    "operasi baru sesudah undo memotong ekor redo",
    !canRedo(cabang) && cabang.entries.length === mundur.cursor + 2,
    `${cabang.entries.length} entri, canRedo=${canRedo(cabang)}`,
  );

  let panjang: LabHistory<ArrayLabState> = initHistory(a, "awal");
  for (let i = 0; i < LAB_MAX_HISTORY + 20; i++) {
    panjang = pushHistory(panjang, arrayStateFromValues([String(i)]), `ke-${i}`);
  }
  check(
    "riwayat yang melewati batas membuang entri tertua, bukan terbaru",
    panjang.entries.length === LAB_MAX_HISTORY &&
      nilai(panjang.entries[panjang.cursor].state)[0] === String(LAB_MAX_HISTORY + 19),
    `${panjang.entries.length} entri, sekarang=${nilai(panjang.entries[panjang.cursor].state)[0]}`,
  );

  const diUjung = initHistory(a, "awal");
  check(
    "undo di awal dan redo di ujung mengembalikan objek yang sama",
    undoHistory(diUjung) === diUjung && redoHistory(h) === h,
    "tidak memicu render ulang",
  );
}

// ── 8. Lab 2D ────────────────────────────────────────────────────────────

/** Nilai kisi saja, baris demi baris. */
const kisi = (s: MatrixLabState) => s.rows.map((r) => r.map((c) => c.value));

/** JSON kanonik kisi; tanpa id untuk membandingkan hasil dekode URL (id tidak diserialisasi). */
function kanonik2(s: MatrixLabState, denganId = true): string {
  return JSON.stringify({
    rows: s.rows.map((r) => r.map((c) => (denganId ? [c.id, c.value, c.note] : [c.value, c.note]))),
    pointers: [...s.pointers].sort((a, b) => a.name.localeCompare(b.name)).map((p) => [p.name, p.row, p.col, p.tone]),
    ranges: [...s.ranges]
      .sort((a, b) => a.r1 - b.r1 || a.c1 - b.c1 || a.r2 - b.r2 || a.c2 - b.c2 || a.tone.localeCompare(b.tone))
      .map((r) => [r.r1, r.c1, r.r2, r.c2, r.tone]),
  });
}

function akhir2(state: MatrixLabState, op: MatrixOp): MatrixLabState {
  const h = applyMatrixOp(state, op);
  if (!h.ok) throw new Error(`fixture 2D gagal (${op.kind}): ${h.error}`);
  return h.steps[h.steps.length - 1].state;
}

function beku2(state: MatrixLabState): MatrixLabState {
  state.rows.forEach((r) => {
    r.forEach((c) => Object.freeze(c));
    Object.freeze(r);
  });
  state.pointers.forEach((p) => Object.freeze(p));
  state.ranges.forEach((r) => Object.freeze(r));
  Object.freeze(state.rows);
  Object.freeze(state.pointers);
  Object.freeze(state.ranges);
  return Object.freeze(state);
}

/** Id sel di bawah tiap penunjuk dan di dalam tiap sorotan — "apa yang ditandai", lepas dari posisinya. */
function yangDitandai(s: MatrixLabState): string {
  const penunjuk = [...s.pointers]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => `${p.name}=${s.rows[p.row][p.col].id}`);
  const sorotan = s.ranges
    .map((r) => {
      const ids: number[] = [];
      for (let i = r.r1; i <= r.r2; i++) for (let j = r.c1; j <= r.c2; j++) ids.push(s.rows[i][j].id);
      return `${r.tone}:${ids.sort((a, b) => a - b).join(".")}`;
    })
    .sort();
  return `${penunjuk.join(",")}|${sorotan.join(",")}`;
}

const DUA_TIGA = akhir2(emptyMatrixState(), { kind: "isiDariTeks", teks: "1 2 3; 4 5 6" });

{
  // ── Katalog 2D ──
  const papanContoh = [
    { kind: "setPenunjuk", nama: "p", baris: 0, kolom: 0, tone: "utama" },
    { kind: "sorotBaris", baris: 1, tone: "sorot" },
  ].reduce((s, op) => akhir2(s, op as MatrixOp), akhir2(emptyMatrixState(), { kind: "isiDariTeks", teks: "1 2 3; 4 5 6; 7 8 9" }));

  const spesifikasi = Object.values(MATRIX_OP_CATALOG);
  const gagalContoh = spesifikasi
    .map((spec) => [spec.kind, applyMatrixOp(papanContoh, spec.contoh)] as const)
    .filter(([, h]) => !h.ok)
    .map(([k, h]) => `${k}: ${h.ok ? "" : h.error}`);
  check(
    "2D: setiap operasi di katalog punya contoh yang benar-benar jalan",
    gagalContoh.length === 0 && spesifikasi.length === 24,
    gagalContoh.length === 0 ? `${spesifikasi.length} operasi` : gagalContoh.join(" | "),
  );

  const sah = buildMatrixOp("setSel", { baris: "1", kolom: "2", nilai: "9" });
  const kurang = buildMatrixOp("setSel", { baris: "1", kolom: "", nilai: "9" });
  check(
    "2D: buildMatrixOp menolak form yang belum lengkap",
    sah !== null && sah.kind === "setSel" && sah.kolom === 2 && kurang === null,
    `sah=${JSON.stringify(sah)}, kurang=${kurang}`,
  );

  // ── Hasil yang diharapkan ──
  const kasus: [string, MatrixOp, MatrixLabState, string[][]][] = [
    ["isi dari teks (baris baru)", { kind: "isiDariTeks", teks: "1,2,3\n4,5,6" }, emptyMatrixState(), [["1", "2", "3"], ["4", "5", "6"]]],
    ["transpose", { kind: "transpose" }, DUA_TIGA, [["1", "4"], ["2", "5"], ["3", "6"]]],
    ["putar 90°", { kind: "putar90" }, DUA_TIGA, [["4", "1"], ["5", "2"], ["6", "3"]]],
    ["balik tiap baris", { kind: "balikTiapBaris" }, DUA_TIGA, [["3", "2", "1"], ["6", "5", "4"]]],
    ["balik urutan baris", { kind: "balikUrutanBaris" }, DUA_TIGA, [["4", "5", "6"], ["1", "2", "3"]]],
    ["sisip baris di tengah", { kind: "tambahBaris", baris: 1, nilai: "0" }, DUA_TIGA, [["1", "2", "3"], ["0", "0", "0"], ["4", "5", "6"]]],
    ["hapus baris", { kind: "hapusBaris", baris: 0 }, DUA_TIGA, [["4", "5", "6"]]],
    ["sisip kolom di akhir", { kind: "tambahKolom", kolom: 3, nilai: "0" }, DUA_TIGA, [["1", "2", "3", "0"], ["4", "5", "6", "0"]]],
    ["hapus kolom", { kind: "hapusKolom", kolom: 1 }, DUA_TIGA, [["1", "3"], ["4", "6"]]],
    ["set sel", { kind: "setSel", baris: 1, kolom: 2, nilai: "9" }, DUA_TIGA, [["1", "2", "3"], ["4", "5", "9"]]],
    ["kolom pertama ke kisi kosong", { kind: "tambahKolom", kolom: 0, nilai: "7" }, emptyMatrixState(), [["7"]]],
  ];
  const meleset = kasus.filter(([, op, awal, harap]) => {
    const h = applyMatrixOp(awal, op);
    return !h.ok || JSON.stringify(kisi(h.steps[h.steps.length - 1].state)) !== JSON.stringify(harap);
  });
  check(
    "2D: operasi menghasilkan kisi yang diharapkan",
    meleset.length === 0,
    meleset.length === 0 ? `${kasus.length} kasus` : meleset.map(([n]) => n).join(", "),
  );

  // ── Urutan penelusuran ──
  // Yang dikunci adalah URUTAN kunjungan (fokus tiap langkah), karena itulah
  // inti pelajarannya: baris-major lawan kolom-major.
  const urutan = (op: MatrixOp, s = DUA_TIGA) => {
    const h = applyMatrixOp(s, op);
    if (!h.ok) return null;
    return { kunjungan: h.steps.flatMap((x) => x.fokus), akhir: h.steps[h.steps.length - 1].state };
  };
  const tb = urutan({ kind: "telusurBaris" });
  const tk = urutan({ kind: "telusurKolom" });
  const td = urutan({ kind: "telusurDiagonal" });
  check(
    "2D: telusur baris mengunjungi 0..5, telusur kolom 0,3,1,4,2,5, diagonal 0,4",
    tb?.kunjungan.join(",") === "0,1,2,3,4,5" && tk?.kunjungan.join(",") === "0,3,1,4,2,5" && td?.kunjungan.join(",") === "0,4",
    `baris=${tb?.kunjungan.join(",")}, kolom=${tk?.kunjungan.join(",")}, diagonal=${td?.kunjungan.join(",")}`,
  );

  const bertanda = [
    { kind: "setPenunjuk", nama: "i", baris: 1, kolom: 2, tone: "utama" },
    { kind: "sorotKolom", kolom: 0, tone: "banding" },
    { kind: "catat", baris: 0, kolom: 1, catatan: "pivot" },
  ].reduce((s, op) => akhir2(s, op as MatrixOp), DUA_TIGA);
  const tidakBerubah = (["telusurBaris", "telusurKolom", "telusurDiagonal"] as const).filter(
    (kind) => kanonik2(urutan({ kind }, bertanda)?.akhir ?? emptyMatrixState()) !== kanonik2(bertanda),
  );
  const baca = urutan({ kind: "bacaSel", baris: 1, kolom: 0 }, bertanda);
  check(
    "2D: penelusuran dan baca sel tidak mengubah papan, termasuk penanda pengguna",
    tidakBerubah.length === 0 && baca !== null && kanonik2(baca.akhir) === kanonik2(bertanda) && baca.kunjungan.join(",") === "3,3",
    tidakBerubah.length === 0 ? "papan utuh" : `berubah: ${tidakBerubah.join(", ")}`,
  );

  // ── Transformasi: identitas ──
  const ulang = (op: MatrixOp, n: number) => Array.from({ length: n }).reduce<MatrixLabState>((s) => akhir2(s, op), bertanda);
  check(
    "2D: transpose dua kali, putar 90° empat kali, dan balik dua kali kembali ke papan semula",
    kanonik2(ulang({ kind: "transpose" }, 2)) === kanonik2(bertanda) &&
      kanonik2(ulang({ kind: "putar90" }, 4)) === kanonik2(bertanda) &&
      kanonik2(ulang({ kind: "balikTiapBaris" }, 2)) === kanonik2(bertanda) &&
      kanonik2(ulang({ kind: "balikUrutanBaris" }, 2)) === kanonik2(bertanda),
    "id, catatan, penunjuk, dan sorotan kembali persis",
  );

  // ── Invarian di bawah operasi acak ──
  const rng = mulberry32(20261005);
  const bulat = (maks: number) => Math.floor(rng() * maks);
  const pilih = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
  const TRANSFORMASI = new Set(["transpose", "putar90", "balikTiapBaris", "balikUrutanBaris"]);

  let state = DUA_TIGA;
  let kasusAcak = 0;
  let rusak: string | null = null;
  let dilempar: string | null = null;
  let langkahBerlebih = 0;
  let narasiBuruk = 0;
  let tandaLepas: string | null = null;

  for (let i = 0; i < 20000 && rusak === null; i++) {
    const R = state.rows.length;
    const C = matrixCols(state);
    const r = () => bulat(Math.max(R, 1));
    const c = () => bulat(Math.max(C, 1));
    const v = () => String(bulat(100));
    const op: MatrixOp = pilih<MatrixOp>([
      { kind: "isiDariTeks", teks: Array.from({ length: bulat(4) + 1 }, () => Array.from({ length: 3 }, v).join(" ")).join(";") },
      { kind: "acak", jumlahBaris: bulat(MATRIX_MAX_ROWS) + 1, jumlahKolom: bulat(MATRIX_MAX_COLS) + 1, maks: 99, benih: bulat(1000) },
      { kind: "kosongkan" },
      { kind: "tambahBaris", baris: bulat(R + 1), nilai: v() },
      { kind: "hapusBaris", baris: r() },
      { kind: "tambahKolom", kolom: bulat(C + 1), nilai: v() },
      { kind: "hapusKolom", kolom: c() },
      { kind: "setSel", baris: r(), kolom: c(), nilai: v() },
      { kind: "bacaSel", baris: r(), kolom: c() },
      { kind: "catat", baris: r(), kolom: c(), catatan: pilih(["pivot", "min", "", "cek"]) },
      { kind: "setPenunjuk", nama: pilih(["i", "j", "k", "p", "q"]), baris: r(), kolom: c(), tone: pilih(["utama", "kedua"] as const) },
      { kind: "geserPenunjuk", nama: pilih(["i", "j"]), dBaris: pilih([-1, 0, 1]), dKolom: pilih([-1, 0, 1]) },
      { kind: "hapusPenunjuk", nama: pilih(["i", "j"]) },
      { kind: "sorotBaris", baris: r(), tone: pilih(LAB_TONES) },
      { kind: "sorotKolom", kolom: c(), tone: pilih(LAB_TONES) },
      { kind: "sorotSubKisi", dariBaris: r(), dariKolom: c(), sampaiBaris: r(), sampaiKolom: c(), tone: pilih(LAB_TONES) },
      { kind: "hapusSorotan" },
      { kind: "telusurBaris" },
      { kind: "telusurKolom" },
      { kind: "telusurDiagonal" },
      { kind: "transpose" },
      { kind: "balikTiapBaris" },
      { kind: "balikUrutanBaris" },
      { kind: "putar90" },
    ]);

    let hasil;
    try {
      hasil = applyMatrixOp(beku2(state), op);
    } catch (e) {
      dilempar = `${op.kind}: ${e instanceof Error ? e.message : String(e)}`;
      break;
    }
    if (!hasil.ok) continue;
    kasusAcak++;

    if (hasil.steps.length > MATRIX_MAX_STEPS) langkahBerlebih++;
    for (const st of hasil.steps) {
      if (st.narasi.trim() === "" || st.narasi !== st.narasi.trim()) narasiBuruk++;
      const masalah = assertMatrixInvariants(st.state);
      if (masalah !== null && rusak === null) rusak = `${op.kind}: ${masalah}`;
    }
    const akhir = hasil.steps[hasil.steps.length - 1].state;
    // Transformasi memindahkan sel; penunjuk dan sorotan harus ikut selnya —
    // bukan tertinggal di koordinat lama yang kini berisi sel lain.
    if (tandaLepas === null && TRANSFORMASI.has(op.kind) && yangDitandai(akhir) !== yangDitandai(state)) {
      tandaLepas = `${op.kind}: ${yangDitandai(state)} → ${yangDitandai(akhir)}`;
    }
    state = akhir;
  }

  check("2D: reducer tidak pernah melempar untuk masukan pengguna", dilempar === null, dilempar ?? "tidak ada");
  check("2D: invarian kisi utuh sesudah setiap langkah", rusak === null, rusak ?? `${kasusAcak.toLocaleString("id-ID")} operasi berhasil diuji`);
  check(
    "2D: jumlah langkah dan narasi dalam batas",
    langkahBerlebih === 0 && narasiBuruk === 0,
    `${langkahBerlebih} langkah berlebih, ${narasiBuruk} narasi bermasalah`,
  );
  check("2D: penunjuk dan sorotan ikut selnya saat kisi ditransformasi", tandaLepas === null, tandaLepas ?? "selalu ikut");

  // ── Penanda saat kisi menyusut ──
  const tanda = (ops: MatrixOp[], awal = DUA_TIGA) => ops.reduce(akhir2, awal);
  const geserBaris = tanda([{ kind: "sorotBaris", baris: 1, tone: "sorot" }, { kind: "hapusBaris", baris: 0 }]);
  const buangSub = tanda([
    { kind: "sorotSubKisi", dariBaris: 0, dariKolom: 0, sampaiBaris: 1, sampaiKolom: 1, tone: "hasil" },
    { kind: "hapusBaris", baris: 1 },
  ]);
  const jepit = tanda([{ kind: "setPenunjuk", nama: "i", baris: 1, kolom: 2, tone: "utama" }, { kind: "hapusKolom", kolom: 2 }]);
  const dikosongkan = tanda([{ kind: "setPenunjuk", nama: "i", baris: 1, kolom: 2, tone: "utama" }, { kind: "kosongkan" }]);
  check(
    "2D: sorotan bergeser atau dibuang utuh, penunjuk dijepit ke dalam kisi, kisi kosong tanpa penunjuk",
    JSON.stringify(geserBaris.ranges.map((r) => [r.r1, r.r2])) === "[[0,0]]" &&
      buangSub.ranges.length === 0 &&
      jepit.pointers[0]?.row === 1 &&
      jepit.pointers[0]?.col === 1 &&
      dikosongkan.pointers.length === 0,
    `geser=${JSON.stringify(geserBaris.ranges)}, sub=${buangSub.ranges.length}, jepit=${JSON.stringify(jepit.pointers)}, kosong=${dikosongkan.pointers.length}`,
  );

  // ── Masukan tidak sah ──
  const penuhBaris = akhir2(emptyMatrixState(), { kind: "acak", jumlahBaris: MATRIX_MAX_ROWS, jumlahKolom: 2, maks: 9, benih: 1 });
  const penuhKolom = akhir2(emptyMatrixState(), { kind: "acak", jumlahBaris: 2, jumlahKolom: MATRIX_MAX_COLS, maks: 9, benih: 1 });
  let penuhCatatan = akhir2(emptyMatrixState(), { kind: "acak", jumlahBaris: 4, jumlahKolom: 4, maks: 9, benih: 1 });
  for (let k = 0; k < MATRIX_MAX_NOTES; k++) {
    penuhCatatan = akhir2(penuhCatatan, { kind: "catat", baris: Math.floor(k / 4), kolom: k % 4, catatan: "n" });
  }
  const empatPenunjuk = (["a", "b", "c", "d"] as const).reduce(
    (s, nama) => akhir2(s, { kind: "setPenunjuk", nama, baris: 0, kolom: 0, tone: "utama" }),
    DUA_TIGA,
  );
  const harusDitolak: [string, MatrixLabState, MatrixOp][] = [
    ["baris tidak sama panjang", emptyMatrixState(), { kind: "isiDariTeks", teks: "1 2 3; 4 5" }],
    ["teks kosong", emptyMatrixState(), { kind: "isiDariTeks", teks: " ; " }],
    ["baris melebihi batas", emptyMatrixState(), { kind: "isiDariTeks", teks: Array.from({ length: MATRIX_MAX_ROWS + 1 }, () => "1").join(";") }],
    ["kolom melebihi batas", emptyMatrixState(), { kind: "isiDariTeks", teks: Array.from({ length: MATRIX_MAX_COLS + 1 }, () => "1").join(" ") }],
    ["nilai berisi titik dua", emptyMatrixState(), { kind: "isiDariTeks", teks: "1 a:b" }],
    ["acak 0 baris", emptyMatrixState(), { kind: "acak", jumlahBaris: 0, jumlahKolom: 2, maks: 9, benih: 1 }],
    ["acak kolom melebihi batas", emptyMatrixState(), { kind: "acak", jumlahBaris: 2, jumlahKolom: MATRIX_MAX_COLS + 1, maks: 9, benih: 1 }],
    ["baris melebihi batas lewat sisip", penuhBaris, { kind: "tambahBaris", baris: 0, nilai: "1" }],
    ["kolom melebihi batas lewat sisip", penuhKolom, { kind: "tambahKolom", kolom: 0, nilai: "1" }],
    ["sisip baris di luar 0..R", DUA_TIGA, { kind: "tambahBaris", baris: 3, nilai: "1" }],
    ["hapus baris yang tidak ada", DUA_TIGA, { kind: "hapusBaris", baris: 2 }],
    ["hapus kolom negatif", DUA_TIGA, { kind: "hapusKolom", kolom: -1 }],
    ["baca sel di luar kisi", DUA_TIGA, { kind: "bacaSel", baris: 0, kolom: 3 }],
    ["baca sel indeks pecahan", DUA_TIGA, { kind: "bacaSel", baris: 0.5, kolom: 0 }],
    ["set sel di kisi kosong", emptyMatrixState(), { kind: "setSel", baris: 0, kolom: 0, nilai: "1" }],
    ["nilai 7 karakter", DUA_TIGA, { kind: "setSel", baris: 0, kolom: 0, nilai: "1234567" }],
    ["catatan ke-13", penuhCatatan, { kind: "catat", baris: 3, kolom: 3, catatan: "x" }],
    ["penunjuk kelima", empatPenunjuk, { kind: "setPenunjuk", nama: "e", baris: 0, kolom: 0, tone: "utama" }],
    ["geser penunjuk keluar kisi", empatPenunjuk, { kind: "geserPenunjuk", nama: "a", dBaris: -1, dKolom: 0 }],
    ["geser penunjuk yang belum ada", DUA_TIGA, { kind: "geserPenunjuk", nama: "z", dBaris: 0, dKolom: 1 }],
    ["sub-kisi terbalik", DUA_TIGA, { kind: "sorotSubKisi", dariBaris: 1, dariKolom: 0, sampaiBaris: 0, sampaiKolom: 1, tone: "sorot" }],
    ["telusur kisi kosong", emptyMatrixState(), { kind: "telusurBaris" }],
  ];
  const lolos = harusDitolak.filter(([, awal, op]) => applyMatrixOp(awal, op).ok);
  check(
    "2D: masukan tidak sah ditolak",
    lolos.length === 0,
    lolos.length === 0 ? `${harusDitolak.length} kasus ditolak` : lolos.map(([n]) => n).join(", "),
  );

  // ── URL ──
  const rngUrl = mulberry32(4242);
  const b2 = (maks: number) => Math.floor(rngUrl() * maks);
  let diuji = 0;
  let urlMeleset: string | null = null;
  let tidakStabil = 0;
  for (let i = 0; i < 400 && urlMeleset === null; i++) {
    let s = akhir2(emptyMatrixState(), { kind: "acak", jumlahBaris: b2(MATRIX_MAX_ROWS) + 1, jumlahKolom: b2(MATRIX_MAX_COLS) + 1, maks: 999, benih: i });
    const R = s.rows.length;
    const C = matrixCols(s);
    const ops: MatrixOp[] = [
      { kind: "setPenunjuk", nama: "i", baris: b2(R), kolom: b2(C), tone: "utama" },
      { kind: "setPenunjuk", nama: "j", baris: b2(R), kolom: b2(C), tone: "kedua" },
      { kind: "sorotSubKisi", dariBaris: 0, dariKolom: 0, sampaiBaris: b2(R), sampaiKolom: b2(C), tone: LAB_TONES[b2(LAB_TONES.length)] },
      { kind: "catat", baris: b2(R), kolom: b2(C), catatan: "a b" },
      ...(b2(2) === 0 ? [{ kind: "transpose" } as MatrixOp] : []),
    ];
    for (const op of ops) {
      const h = applyMatrixOp(s, op);
      if (h.ok) s = h.steps[h.steps.length - 1].state;
    }
    const kode = encodeLabSnapshot({ lab: "array2d", state: s });
    if (kode === null) {
      urlMeleset = "encode mengembalikan null untuk kisi yang sah";
      break;
    }
    diuji++;
    const kembali = decodeLabSnapshot(kode);
    if (!kembali || kembali.lab !== "array2d" || kanonik2(kembali.state, false) !== kanonik2(s, false)) {
      urlMeleset = `bolak-balik meleset pada "${kode}"`;
      break;
    }
    if (encodeLabSnapshot({ lab: "array2d", state: kembali.state }) !== kode) tidakStabil++;
    // Jebakan sungguhan: URLSearchParams mendekode "+" sebagai spasi.
    if (new URLSearchParams({ s: kode }).get("s") !== kode) tidakStabil++;
  }
  check(
    "2D: kisi sah bolak-balik lewat URL tanpa berubah",
    urlMeleset === null && tidakStabil === 0,
    urlMeleset ?? `${diuji} kisi, ${tidakStabil} tidak stabil`,
  );

  let berat = akhir2(emptyMatrixState(), {
    kind: "isiDariTeks",
    teks: Array.from({ length: MATRIX_MAX_ROWS }, () => Array.from({ length: MATRIX_MAX_COLS }, () => "abc123").join(" ")).join(";"),
  });
  (["abcde1", "abcde2", "abcde3", "abcde4"] as const).forEach((nama, n) => {
    berat = akhir2(berat, { kind: "setPenunjuk", nama, baris: n, kolom: MATRIX_MAX_COLS - 1, tone: "kedua" });
  });
  LAB_TONES.forEach((tone, n) => {
    berat = akhir2(berat, { kind: "sorotSubKisi", dariBaris: n, dariKolom: n, sampaiBaris: MATRIX_MAX_ROWS - 1, sampaiKolom: MATRIX_MAX_COLS - 1, tone });
  });
  for (let k = 0; k < MATRIX_MAX_NOTES; k++) {
    berat = akhir2(berat, { kind: "catat", baris: Math.floor(k / 2), kolom: MATRIX_MAX_COLS - 2 + (k % 2), catatan: "abcdefghijkl" });
  }
  const kodeBerat = encodeLabSnapshot({ lab: "array2d", state: berat });
  check(
    "2D: kisi paling berat pun muat di batas panjang URL",
    kodeBerat !== null && kodeBerat.length <= LAB_MAX_URL_STATE,
    `${kodeBerat?.length ?? "null"} dari ${LAB_MAX_URL_STATE} karakter`,
  );

  const rusakUrl: [string, string][] = [
    ["baris tidak sama panjang", "1m~1,2;3~~~"],
    ["baris kosong di tengah", "1m~1,2;;3,4~~~"],
    ["baris melebihi batas", `1m~${Array.from({ length: MATRIX_MAX_ROWS + 1 }, () => "1").join(";")}~~~`],
    ["kolom melebihi batas", `1m~${Array.from({ length: MATRIX_MAX_COLS + 1 }, () => "1").join(",")}~~~`],
    ["penunjuk di luar kisi", "1m~1,2;3,4~p:2:0:utama~~"],
    ["penunjuk di kisi kosong", "1m~~p:0:0:utama~~"],
    ["indeks penunjuk kosong", "1m~1,2;3,4~p::0:utama~~"],
    ["nama penunjuk ganda", "1m~1,2;3,4~p:0:0:utama,p:1:1:kedua~~"],
    ["sorotan terbalik", "1m~1,2;3,4~~1:0:0:1:sorot~"],
    ["nada tak dikenal", "1m~1,2;3,4~~0:0:1:1:ungu~"],
    ["catatan ganda di satu sel", "1m~1,2;3,4~~~0:0:a,0:0:b"],
    ["catatan di luar kisi", "1m~1,2;3,4~~~2:0:a"],
    ["ruas kurang", "1m~1,2;3,4~~"],
  ];
  const diterima = rusakUrl.filter(([, raw]) => decodeLabSnapshot(raw) !== null);
  const kosongBaik = decodeLabSnapshot("1m~~~~");
  check(
    "2D: tautan rusak ditolak seluruhnya, kisi kosong tetap terbaca",
    diterima.length === 0 && kosongBaik !== null && kosongBaik.lab === "array2d" && kosongBaik.state.rows.length === 0,
    diterima.length === 0 ? `${rusakUrl.length} kasus ditolak` : diterima.map(([n]) => n).join(", "),
  );
}

// ── 9. Lab N-dimensi ─────────────────────────────────────────────────────

const nilaiNd = (s: NdLabState) => s.cells.map((c) => c.value);

function kanonikNd(s: NdLabState, denganId = true): string {
  return JSON.stringify({
    shape: s.shape,
    cells: s.cells.map((c) => (denganId ? [c.id, c.value] : c.value)),
    cursor: s.cursor,
    slices: [...s.slices].sort((a, b) => a.axis - b.axis || a.index - b.index).map((x) => [x.axis, x.index, x.tone]),
  });
}

function akhirNd(state: NdLabState, op: NdOp): NdLabState {
  const h = applyNdOp(state, op);
  if (!h.ok) throw new Error(`fixture N-D gagal (${op.kind}): ${h.error}`);
  return h.steps[h.steps.length - 1].state;
}

function bekuNd(state: NdLabState): NdLabState {
  state.cells.forEach((c) => Object.freeze(c));
  state.slices.forEach((x) => Object.freeze(x));
  Object.freeze(state.cells);
  Object.freeze(state.shape);
  Object.freeze(state.slices);
  if (state.cursor) Object.freeze(state.cursor);
  return Object.freeze(state);
}

const B234 = akhirNd(emptyNdState(), { kind: "buat", bentuk: "2, 3, 4" });

{
  // ── Katalog ──
  const spesifikasi = Object.values(ND_OP_CATALOG);
  const gagalContoh = spesifikasi
    .map((spec) => [spec.kind, applyNdOp(B234, spec.contoh)] as const)
    .filter(([, h]) => !h.ok)
    .map(([k, h]) => `${k}: ${h.ok ? "" : h.error}`);
  const sah = buildNdOp("bacaElemen", { indeks: "1, 2, 0" });
  check(
    "N-D: setiap operasi di katalog jalan, buildNdOp menolak form kosong",
    gagalContoh.length === 0 && spesifikasi.length === 13 && sah !== null && buildNdOp("bacaElemen", { indeks: " " }) === null,
    gagalContoh.length === 0 ? `${spesifikasi.length} operasi` : gagalContoh.join(" | "),
  );

  // ── Bentuk & alamat ──
  const bentukSama = ["2, 3, 4", "2x3x4", "[2][3][4]", "2 3 4", "2×3×4"].every(
    (raw) => JSON.stringify(parseNdBentuk(raw)) === "[2,3,4]",
  );
  check(
    "N-D: buat 2,3,4 berisi 0..23, dan bentuknya bisa ditulis dalam lima gaya",
    bentukSama && JSON.stringify(B234.shape) === "[2,3,4]" && nilaiNd(B234).join(",") === Array.from({ length: 24 }, (_, i) => i).join(","),
    `bentuk=${JSON.stringify(B234.shape)}, gaya=${bentukSama}`,
  );

  // Offset ↔ koordinat harus bijeksi untuk SETIAP bentuk, bukan hanya 3D.
  const bentukUji = [[5], [3, 4], [2, 3, 4], [2, 2, 2, 3], [1, 3, 1, 2], [2, 2, 2, 2, 2, 2]];
  const bukanBijeksi = bentukUji.filter((shape) => {
    for (let o = 0; o < ndTotal(shape); o++) {
      const k = ndKoordinat(o, shape);
      if (ndOffset(k, shape) !== o || k.some((v, i) => v < 0 || v >= shape[i])) return true;
    }
    return false;
  });
  check(
    "N-D: langkah alamat 2×3×4 = [12,4,1], dan offset ↔ koordinat bolak-balik di semua bentuk",
    JSON.stringify(ndStrides([2, 3, 4])) === "[12,4,1]" && bukanBijeksi.length === 0,
    bukanBijeksi.length === 0 ? `${bentukUji.length} bentuk, 1 sampai 6 dimensi` : `gagal: ${JSON.stringify(bukanBijeksi)}`,
  );

  const baca = applyNdOp(B234, { kind: "bacaElemen", indeks: "1, 2, 3" });
  check(
    "N-D: arr[1][2][3] dibaca di offset 23 lengkap dengan rumusnya, tanpa mengubah papan",
    baca.ok &&
      baca.steps[baca.steps.length - 1].fokus.join(",") === "23" &&
      baca.steps[baca.steps.length - 1].narasi.includes("1×12 + 2×4 + 3×1 = 23") &&
      baca.steps.every((st) => kanonikNd(st.state) === kanonikNd(B234)),
    baca.ok ? baca.steps[baca.steps.length - 1].narasi : baca.error,
  );

  // ── Reshape lawan tukar sumbu ──
  const berkursor = akhirNd(B234, { kind: "setKursor", indeks: "1, 2, 3" });
  const reshape = akhirNd(berkursor, { kind: "ubahBentuk", bentuk: "4, 6" });
  check(
    "N-D: reshape tidak memindahkan elemen di memori dan kursor ikut lewat offset-nya",
    nilaiNd(reshape).join(",") === nilaiNd(B234).join(",") &&
      JSON.stringify(reshape.shape) === "[4,6]" &&
      JSON.stringify(reshape.cursor) === "[3,5]",
    `bentuk=${JSON.stringify(reshape.shape)}, kursor=${JSON.stringify(reshape.cursor)}`,
  );

  const b23 = akhirNd(emptyNdState(), { kind: "buat", bentuk: "2, 3" });
  const tukar2d = akhirNd(b23, { kind: "tukarSumbu", sumbuA: 0, sumbuB: 1 });
  const transpose2d = akhir2(akhir2(emptyMatrixState(), { kind: "isiDariTeks", teks: "0 1 2; 3 4 5" }), { kind: "transpose" });
  check(
    "N-D: tukar sumbu pada array 2D sama dengan transpose di lab 2D",
    JSON.stringify(tukar2d.shape) === "[3,2]" && nilaiNd(tukar2d).join(",") === kisi(transpose2d).flat().join(","),
    `${nilaiNd(tukar2d).join(",")} vs ${kisi(transpose2d).flat().join(",")}`,
  );

  // Pada 3D: elemen di [i][j][k] harus mendarat di [k][j][i] saat sumbu 0 & 2 ditukar.
  const tukar3d = akhirNd(B234, { kind: "tukarSumbu", sumbuA: 0, sumbuB: 2 });
  let salahTempat = 0;
  for (let o = 0; o < 24; o++) {
    const [i, j, k] = ndKoordinat(o, B234.shape);
    if (tukar3d.cells[ndOffset([k, j, i], tukar3d.shape)].id !== B234.cells[o].id) salahTempat++;
  }
  check(
    "N-D: tukar sumbu 0 dan 2 memindahkan arr[i][j][k] ke arr[k][j][i]",
    JSON.stringify(tukar3d.shape) === "[4,3,2]" && salahTempat === 0,
    `${salahTempat} elemen salah tempat`,
  );

  // ── Penelusuran ──
  const telusur = applyNdOp(berkursor, { kind: "telusuri" });
  const kunjungan = telusur.ok ? telusur.steps.flatMap((x) => x.fokus) : [];
  const kursorBenar =
    telusur.ok &&
    telusur.steps.slice(1, -1).every((x, o) => JSON.stringify(x.state.cursor) === JSON.stringify(ndKoordinat(o, B234.shape)));
  check(
    "N-D: penelusuran mengunjungi offset 0..n−1 berurutan dan tidak mengubah papan",
    telusur.ok &&
      kunjungan.join(",") === Array.from({ length: 24 }, (_, i) => i).join(",") &&
      kursorBenar &&
      kanonikNd(telusur.steps[telusur.steps.length - 1].state) === kanonikNd(berkursor),
    telusur.ok ? `${kunjungan.length} kunjungan, kursor sesuai=${kursorBenar}` : telusur.error,
  );

  // ── Masukan tidak sah ──
  const harusDitolak: [string, NdLabState, NdOp][] = [
    ["7 dimensi", emptyNdState(), { kind: "buat", bentuk: "1,1,1,1,1,1,1" }],
    ["panjang dimensi 7", emptyNdState(), { kind: "buat", bentuk: "7" }],
    ["panjang dimensi 0", emptyNdState(), { kind: "buat", bentuk: "2, 0" }],
    ["lebih dari 120 elemen", emptyNdState(), { kind: "buat", bentuk: "6, 6, 6" }],
    ["bentuk bukan angka", emptyNdState(), { kind: "buat", bentuk: "2, dua" }],
    ["bentuk kosong", emptyNdState(), { kind: "buat", bentuk: " " }],
    ["indeks kurang satu", B234, { kind: "bacaElemen", indeks: "1, 2" }],
    ["indeks lebih satu", B234, { kind: "bacaElemen", indeks: "1, 2, 3, 0" }],
    ["indeks di luar sumbu", B234, { kind: "setKursor", indeks: "2, 0, 0" }],
    ["indeks pecahan", B234, { kind: "setElemen", indeks: "1, 1.5, 0", nilai: "9" }],
    ["nilai 7 karakter", B234, { kind: "setElemen", indeks: "0, 0, 0", nilai: "1234567" }],
    ["reshape mengubah jumlah elemen", B234, { kind: "ubahBentuk", bentuk: "5, 5" }],
    ["isi teks jumlahnya salah", B234, { kind: "isiDariTeks", teks: "1 2 3" }],
    ["sorot sumbu yang tidak ada", B234, { kind: "sorotIrisan", sumbu: 3, posisi: 0, tone: "sorot" }],
    ["sorot posisi di luar sumbu", B234, { kind: "sorotIrisan", sumbu: 1, posisi: 3, tone: "sorot" }],
    ["tukar sumbu yang tidak ada", B234, { kind: "tukarSumbu", sumbuA: 0, sumbuB: 3 }],
    ["telusuri array kosong", emptyNdState(), { kind: "telusuri" }],
    ["isi acak array kosong", emptyNdState(), { kind: "isiAcak", maks: 9, benih: 1 }],
  ];
  const lolos = harusDitolak.filter(([, awal, op]) => applyNdOp(awal, op).ok);
  const enamDimensi = applyNdOp(emptyNdState(), { kind: "buat", bentuk: "2,2,2,2,2,2" });
  check(
    "N-D: masukan tidak sah ditolak, sementara 6 dimensi tetap diterima",
    lolos.length === 0 && enamDimensi.ok && ND_MAX_DIMS === 6,
    lolos.length === 0 ? `${harusDitolak.length} kasus ditolak` : lolos.map(([n]) => n).join(", "),
  );

  // ── Invarian di bawah operasi acak ──
  const rng = mulberry32(20261006);
  const bulat = (maks: number) => Math.floor(rng() * maks);
  const pilih = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

  let state = B234;
  let kasusAcak = 0;
  let rusak: string | null = null;
  let dilempar: string | null = null;
  let langkahBerlebih = 0;
  let narasiBuruk = 0;
  let kursorLepas: string | null = null;

  for (let i = 0; i < 15000 && rusak === null; i++) {
    const shape = state.shape;
    const d = shape.length;
    const total = ndTotal(shape);
    const indeks = () => shape.map((n) => bulat(n)).join(", ");
    const bentukAcak = () => Array.from({ length: bulat(5) + 1 }, () => bulat(4) + 1).join(", ");
    const op: NdOp = pilih<NdOp>([
      { kind: "buat", bentuk: bentukAcak() },
      { kind: "isiAcak", maks: 99, benih: bulat(1000) },
      { kind: "isiDariTeks", teks: Array.from({ length: total + pilih([0, 0, 0, 1]) }, () => String(bulat(100))).join(" ") },
      { kind: "ubahBentuk", bentuk: pilih([String(total), [...shape].reverse().join(","), bentukAcak()]) },
      { kind: "kosongkan" },
      { kind: "bacaElemen", indeks: indeks() },
      { kind: "setElemen", indeks: indeks(), nilai: String(bulat(100)) },
      { kind: "setKursor", indeks: indeks() },
      { kind: "setKursor", indeks: indeks() },
      { kind: "hapusKursor" },
      { kind: "sorotIrisan", sumbu: bulat(Math.max(d, 1)), posisi: bulat(Math.max(...shape, 1)), tone: pilih(LAB_TONES) },
      { kind: "hapusSorotan" },
      { kind: "telusuri" },
      { kind: "tukarSumbu", sumbuA: bulat(Math.max(d, 1)), sumbuB: bulat(Math.max(d, 1)) },
      { kind: "tukarSumbu", sumbuA: bulat(Math.max(d, 1)), sumbuB: bulat(Math.max(d, 1)) },
    ]);

    let hasil;
    try {
      hasil = applyNdOp(bekuNd(state), op);
    } catch (e) {
      dilempar = `${op.kind}: ${e instanceof Error ? e.message : String(e)}`;
      break;
    }
    if (!hasil.ok) continue;
    kasusAcak++;

    if (hasil.steps.length > ND_MAX_STEPS) langkahBerlebih++;
    for (const st of hasil.steps) {
      if (st.narasi.trim() === "" || st.narasi !== st.narasi.trim()) narasiBuruk++;
      const masalah = assertNdInvariants(st.state);
      if (masalah !== null && rusak === null) rusak = `${op.kind}: ${masalah}`;
    }
    const akhir = hasil.steps[hasil.steps.length - 1].state;
    // Reshape & tukar sumbu mengubah alamat; kursor harus tetap di elemen yang sama.
    if (
      kursorLepas === null &&
      (op.kind === "ubahBentuk" || op.kind === "tukarSumbu") &&
      state.cursor !== null &&
      (akhir.cursor === null ||
        akhir.cells[ndOffset(akhir.cursor, akhir.shape)].id !== state.cells[ndOffset(state.cursor, shape)].id)
    ) {
      kursorLepas = `${op.kind}: ${JSON.stringify(state.cursor)} → ${JSON.stringify(akhir.cursor)}`;
    }
    state = akhir;
  }

  check("N-D: reducer tidak pernah melempar untuk masukan pengguna", dilempar === null, dilempar ?? "tidak ada");
  check("N-D: invarian array utuh sesudah setiap langkah", rusak === null, rusak ?? `${kasusAcak.toLocaleString("id-ID")} operasi berhasil diuji`);
  check(
    "N-D: jumlah langkah dan narasi dalam batas",
    langkahBerlebih === 0 && narasiBuruk === 0,
    `${langkahBerlebih} langkah berlebih, ${narasiBuruk} narasi bermasalah`,
  );
  check("N-D: kursor tetap di elemen yang sama saat reshape atau tukar sumbu", kursorLepas === null, kursorLepas ?? "selalu ikut");

  // ── URL ──
  const rngUrl = mulberry32(9090);
  const b = (maks: number) => Math.floor(rngUrl() * maks);
  let diuji = 0;
  let urlMeleset: string | null = null;
  let tidakStabil = 0;
  for (let i = 0; i < 400 && urlMeleset === null; i++) {
    // Panjang tiap dimensi diundi, lalu dipangkas ke 1 kalau jumlah elemennya
    // akan melewati batas — yang diuji codec-nya, bukan penolakan bentuk.
    const bentuk: number[] = [];
    for (let k = b(ND_MAX_DIMS) + 1; k > 0; k--) {
      const n = b(3) + 1;
      bentuk.push(ndTotal([...bentuk, n]) <= ND_MAX_ELEMENTS ? n : 1);
    }
    let s = akhirNd(emptyNdState(), { kind: "buat", bentuk: bentuk.join(",") });
    s = akhirNd(s, { kind: "isiAcak", maks: 999, benih: i });
    if (b(2) === 0) s = akhirNd(s, { kind: "setKursor", indeks: bentuk.map((n) => b(n)).join(",") });
    const sumbu = b(bentuk.length);
    s = akhirNd(s, { kind: "sorotIrisan", sumbu, posisi: b(bentuk[sumbu]), tone: LAB_TONES[b(LAB_TONES.length)] });

    const kode = encodeLabSnapshot({ lab: "arrayNd", state: s });
    if (kode === null) {
      urlMeleset = "encode mengembalikan null untuk array yang sah";
      break;
    }
    diuji++;
    const kembali = decodeLabSnapshot(kode);
    if (!kembali || kembali.lab !== "arrayNd" || kanonikNd(kembali.state, false) !== kanonikNd(s, false)) {
      urlMeleset = `bolak-balik meleset pada "${kode}"`;
      break;
    }
    if (encodeLabSnapshot({ lab: "arrayNd", state: kembali.state }) !== kode) tidakStabil++;
    if (new URLSearchParams({ s: kode }).get("s") !== kode) tidakStabil++;
  }
  check(
    "N-D: array sah bolak-balik lewat URL tanpa berubah",
    urlMeleset === null && tidakStabil === 0,
    urlMeleset ?? `${diuji} array, ${tidakStabil} tidak stabil`,
  );

  let berat = akhirNd(emptyNdState(), { kind: "buat", bentuk: "2, 2, 2, 3, 5, 1" });
  berat = akhirNd(berat, { kind: "isiDariTeks", teks: Array.from({ length: ND_MAX_ELEMENTS }, () => "abc123").join(" ") });
  berat = akhirNd(berat, { kind: "setKursor", indeks: "1, 1, 1, 2, 4, 0" });
  LAB_TONES.forEach((tone, n) => {
    berat = akhirNd(berat, { kind: "sorotIrisan", sumbu: 4, posisi: n, tone });
  });
  const kodeBerat = encodeLabSnapshot({ lab: "arrayNd", state: berat });
  check(
    "N-D: array paling berat (120 elemen, 6 dimensi) muat di batas panjang URL",
    kodeBerat !== null && kodeBerat.length <= LAB_MAX_URL_STATE,
    `${kodeBerat?.length ?? "null"} dari ${LAB_MAX_URL_STATE} karakter`,
  );

  const enam = "0,1,2,3,4,5";
  const rusakUrl: [string, string][] = [
    ["jumlah nilai tidak cocok", "1n~2x3~0,1,2,3,4~~"],
    ["panjang dimensi 7", "1n~7~0,1,2,3,4,5,6~~"],
    ["7 dimensi", "1n~1x1x1x1x1x1x1~0~~"],
    ["lebih dari 120 elemen", `1n~6x6x6~${Array.from({ length: 216 }, () => "1").join(",")}~~`],
    ["panjang dimensi 0", "1n~0~~~"],
    ["bagian bentuk kosong", "1n~2x~0,1~~"],
    ["kursor kurang sumbu", `1n~2x3~${enam}~1~`],
    ["kursor di luar sumbu", `1n~2x3~${enam}~2x0~`],
    ["sorotan sumbu tak ada", `1n~2x3~${enam}~~2:0:sorot`],
    ["sorotan posisi di luar", `1n~2x3~${enam}~~1:3:sorot`],
    ["nada tak dikenal", `1n~2x3~${enam}~~1:0:ungu`],
    ["nilai di array kosong", "1n~~1~~"],
  ];
  const diterima = rusakUrl.filter(([, raw]) => decodeLabSnapshot(raw) !== null);
  const kosongBaik = decodeLabSnapshot("1n~~~~");
  check(
    "N-D: tautan rusak ditolak seluruhnya, array kosong tetap terbaca",
    diterima.length === 0 && kosongBaik !== null && kosongBaik.lab === "arrayNd" && kosongBaik.state.shape.length === 0,
    diterima.length === 0 ? `${rusakUrl.length} kasus ditolak` : diterima.map(([n]) => n).join(", "),
  );
}

// ── 10. Lab 3D ───────────────────────────────────────────────────────────

const nilai3 = (s: CubeLabState) => s.cells.map((c) => c.value).join(",");

function kanonik3(s: CubeLabState, denganId = true): string {
  return JSON.stringify({
    shape: s.shape,
    cells: s.cells.map((c) => (denganId ? [c.id, c.value] : c.value)),
    pointers: [...s.pointers].sort((a, b) => a.name.localeCompare(b.name)).map((p) => [p.name, ...p.at, p.tone]),
    boxes: s.boxes.map((b) => [...b.from, ...b.to, b.tone].join(":")).sort(),
  });
}

function akhir3(state: CubeLabState, op: CubeOp): CubeLabState {
  const h = applyCubeOp(state, op);
  if (!h.ok) throw new Error(`fixture 3D gagal (${op.kind}): ${h.error}`);
  return h.steps[h.steps.length - 1].state;
}

function beku3(state: CubeLabState): CubeLabState {
  state.cells.forEach((c) => Object.freeze(c));
  state.pointers.forEach((p) => {
    Object.freeze(p.at);
    Object.freeze(p);
  });
  state.boxes.forEach((b) => {
    Object.freeze(b.from);
    Object.freeze(b.to);
    Object.freeze(b);
  });
  Object.freeze(state.shape);
  Object.freeze(state.cells);
  Object.freeze(state.pointers);
  Object.freeze(state.boxes);
  return Object.freeze(state);
}

/** Id sel di bawah tiap penunjuk dan di dalam tiap kotak sorotan — lepas dari koordinatnya. */
function yangDitandai3(s: CubeLabState): string {
  const penunjuk = [...s.pointers]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => `${p.name}=${s.cells[cubeOffset(p.at, s.shape)].id}`);
  const kotak = s.boxes
    .map((b) => {
      const ids: number[] = [];
      s.cells.forEach((c, o) => {
        if (cubeDalamKotak(cubeKoord(o, s.shape), b)) ids.push(c.id);
      });
      return `${b.tone}:${ids.sort((x, y) => x - y).join(".")}`;
    })
    .sort();
  return `${penunjuk.join(",")}|${kotak.join(",")}`;
}

/** 2 lapisan × 2 baris × 3 kolom berisi 1..12. */
const K223 = akhir3(emptyCubeState(), { kind: "isiDariTeks", teks: "1 2 3; 4 5 6 | 7 8 9; 10 11 12" });

{
  // ── Katalog ──
  const papanContoh = akhir3(akhir3(emptyCubeState(), { kind: "buat", jumlahLapisan: 3, jumlahBaris: 3, jumlahKolom: 4 }), {
    kind: "setPenunjuk",
    nama: "p",
    lapisan: 0,
    baris: 0,
    kolom: 0,
    tone: "utama",
  });
  const spesifikasi = Object.values(CUBE_OP_CATALOG);
  const gagalContoh = spesifikasi
    .map((spec) => [spec.kind, applyCubeOp(papanContoh, spec.contoh)] as const)
    .filter(([, h]) => !h.ok)
    .map(([k, h]) => `${k}: ${h.ok ? "" : h.error}`);
  const sah = buildCubeOp("bacaSel", { lapisan: "1", baris: "0", kolom: "2" });
  check(
    "3D: setiap operasi di katalog jalan, buildCubeOp menolak form yang belum lengkap",
    gagalContoh.length === 0 &&
      spesifikasi.length === 23 &&
      sah !== null &&
      buildCubeOp("bacaSel", { lapisan: "1", baris: "", kolom: "2" }) === null,
    gagalContoh.length === 0 ? `${spesifikasi.length} operasi` : gagalContoh.join(" | "),
  );

  // ── Hasil yang diharapkan ──
  const kasus: [string, CubeOp, CubeLabState, string, string][] = [
    ["isi dari teks", { kind: "isiDariTeks", teks: "1 2 3\n4 5 6\n\n7 8 9\n10 11 12" }, emptyCubeState(), "2,2,3", "1,2,3,4,5,6,7,8,9,10,11,12"],
    ["buat berurutan", { kind: "buat", jumlahLapisan: 2, jumlahBaris: 1, jumlahKolom: 2 }, emptyCubeState(), "2,1,2", "0,1,2,3"],
    ["transpose setiap lapisan", { kind: "transposeTiapLapisan" }, K223, "2,3,2", "1,4,2,5,3,6,7,10,8,11,9,12"],
    ["putar setiap lapisan", { kind: "putarTiapLapisan" }, K223, "2,3,2", "4,1,5,2,6,3,10,7,11,8,12,9"],
    ["balik urutan lapisan", { kind: "balikUrutanLapisan" }, K223, "2,2,3", "7,8,9,10,11,12,1,2,3,4,5,6"],
    ["tukar lapisan ↔ baris", { kind: "tukarSumbu", sumbuA: 0, sumbuB: 1 }, K223, "2,2,3", "1,2,3,7,8,9,4,5,6,10,11,12"],
    ["sisip lapisan di tengah", { kind: "tambahLapisan", lapisan: 1, nilai: "0" }, K223, "3,2,3", "1,2,3,4,5,6,0,0,0,0,0,0,7,8,9,10,11,12"],
    ["hapus lapisan", { kind: "hapusLapisan", lapisan: 0 }, K223, "1,2,3", "7,8,9,10,11,12"],
    ["ubah arr[1][0][2]", { kind: "setSel", lapisan: 1, baris: 0, kolom: 2, nilai: "x" }, K223, "2,2,3", "1,2,3,4,5,6,7,8,x,10,11,12"],
    ["lapisan pertama ke kubus kosong", { kind: "tambahLapisan", lapisan: 0, nilai: "7" }, emptyCubeState(), "1,1,1", "7"],
  ];
  const meleset = kasus.filter(([, op, awal, bentuk, harap]) => {
    const h = applyCubeOp(awal, op);
    if (!h.ok) return true;
    const akhir = h.steps[h.steps.length - 1].state;
    return akhir.shape.join(",") !== bentuk || nilai3(akhir) !== harap;
  });
  check(
    "3D: operasi menghasilkan kubus yang diharapkan",
    meleset.length === 0,
    meleset.length === 0 ? `${kasus.length} kasus` : meleset.map(([n]) => n).join(", "),
  );

  // Lab 3D dan lab N-D harus sepakat soal tukar sumbu — dua implementasi
  // berbeda dari konsep yang sama saling memeriksa.
  const ndSama = (
    [
      [0, 1],
      [0, 2],
      [1, 2],
    ] as const
  ).filter(([a, b]) => {
    const kubus = akhir3(K223, { kind: "tukarSumbu", sumbuA: a, sumbuB: b });
    const nd = akhirNd(akhirNd(akhirNd(emptyNdState(), { kind: "buat", bentuk: "2, 2, 3" }), { kind: "isiDariTeks", teks: nilai3(K223) }), {
      kind: "tukarSumbu",
      sumbuA: a,
      sumbuB: b,
    });
    return kubus.shape.join(",") !== nd.shape.join(",") || nilai3(kubus) !== nilaiNd(nd).join(",");
  });
  check(
    "3D: tukar sumbu menghasilkan susunan yang sama dengan lab N-D",
    ndSama.length === 0,
    ndSama.length === 0 ? "ketiga pasangan sumbu sepakat" : `berbeda: ${JSON.stringify(ndSama)}`,
  );

  // ── Penelusuran ──
  const urutan3 = (op: CubeOp, s = K223) => {
    const h = applyCubeOp(s, op);
    return h.ok ? { kunjungan: h.steps.flatMap((x) => x.fokus).join(","), akhir: h.steps[h.steps.length - 1].state } : null;
  };
  const tl = urutan3({ kind: "telusurLapisan" });
  const tp = urutan3({ kind: "telusurPilar" });
  const td = urutan3({ kind: "telusurDiagonal" });
  check(
    "3D: telusur lapisan = urutan memori 0..11, telusur pilar 0,6,1,7,…, diagonal ruang 0,10",
    tl?.kunjungan === "0,1,2,3,4,5,6,7,8,9,10,11" && tp?.kunjungan === "0,6,1,7,2,8,3,9,4,10,5,11" && td?.kunjungan === "0,10",
    `lapisan=${tl?.kunjungan}, pilar=${tp?.kunjungan}, diagonal=${td?.kunjungan}`,
  );

  const bertanda = [
    { kind: "setPenunjuk", nama: "i", lapisan: 1, baris: 0, kolom: 2, tone: "utama" },
    { kind: "sorotPilar", baris: 1, kolom: 0, tone: "banding" },
    { kind: "sorotLapisan", lapisan: 0, tone: "sorot" },
  ].reduce((s, op) => akhir3(s, op as CubeOp), K223);
  const berubah = (["telusurLapisan", "telusurPilar", "telusurDiagonal"] as const).filter(
    (kind) => kanonik3(urutan3({ kind }, bertanda)?.akhir ?? emptyCubeState()) !== kanonik3(bertanda),
  );
  const baca = applyCubeOp(bertanda, { kind: "bacaSel", lapisan: 1, baris: 0, kolom: 2 });
  check(
    "3D: penelusuran dan baca sel tidak mengubah papan; baca menyebut rumus offset-nya",
    berubah.length === 0 &&
      baca.ok &&
      baca.steps[baca.steps.length - 1].fokus.join(",") === "8" &&
      baca.steps[baca.steps.length - 1].narasi.includes("1×6 + 0×3 + 2 = 8") &&
      kanonik3(baca.steps[baca.steps.length - 1].state) === kanonik3(bertanda),
    berubah.length > 0 ? `berubah: ${berubah.join(", ")}` : baca.ok ? baca.steps[baca.steps.length - 1].narasi : baca.error,
  );

  // ── Transformasi: identitas ──
  const ulang = (op: CubeOp, n: number) => Array.from({ length: n }).reduce<CubeLabState>((s) => akhir3(s, op), bertanda);
  check(
    "3D: transpose ×2, putar ×4, balik ×2, dan tukar sumbu ×2 kembali ke kubus semula",
    kanonik3(ulang({ kind: "transposeTiapLapisan" }, 2)) === kanonik3(bertanda) &&
      kanonik3(ulang({ kind: "putarTiapLapisan" }, 4)) === kanonik3(bertanda) &&
      kanonik3(ulang({ kind: "balikUrutanLapisan" }, 2)) === kanonik3(bertanda) &&
      kanonik3(ulang({ kind: "tukarSumbu", sumbuA: 0, sumbuB: 2 }, 2)) === kanonik3(bertanda),
    "id, penunjuk, dan sorotan kembali persis",
  );

  // ── Invarian di bawah operasi acak ──
  const rng = mulberry32(20261007);
  const bulat = (maks: number) => Math.floor(rng() * maks);
  const pilih = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
  const TRANSFORMASI = new Set(["transposeTiapLapisan", "putarTiapLapisan", "balikUrutanLapisan", "tukarSumbu"]);

  let state = K223;
  let kasusAcak = 0;
  let rusak: string | null = null;
  let dilempar: string | null = null;
  let langkahBerlebih = 0;
  let narasiBuruk = 0;
  let tandaLepas: string | null = null;

  for (let i = 0; i < 15000 && rusak === null; i++) {
    const [D, R, C] = state.shape;
    const k = () => bulat(Math.max(D, 1));
    const r = () => bulat(Math.max(R, 1));
    const c = () => bulat(Math.max(C, 1));
    const sisi = () => bulat(CUBE_MAX_SIDE) + 1;
    const op: CubeOp = pilih<CubeOp>([
      { kind: "buat", jumlahLapisan: sisi(), jumlahBaris: sisi(), jumlahKolom: sisi() },
      { kind: "acak", jumlahLapisan: sisi(), jumlahBaris: sisi(), jumlahKolom: sisi(), maks: 99, benih: bulat(1000) },
      { kind: "isiDariTeks", teks: Array.from({ length: bulat(3) + 1 }, () => "1 2; 3 4").join(" | ") },
      { kind: "kosongkan" },
      { kind: "tambahLapisan", lapisan: bulat(D + 1), nilai: String(bulat(100)) },
      { kind: "hapusLapisan", lapisan: k() },
      { kind: "bacaSel", lapisan: k(), baris: r(), kolom: c() },
      { kind: "setSel", lapisan: k(), baris: r(), kolom: c(), nilai: String(bulat(100)) },
      { kind: "setPenunjuk", nama: pilih(["i", "j", "k", "p", "q"]), lapisan: k(), baris: r(), kolom: c(), tone: pilih(["utama", "kedua"] as const) },
      { kind: "geserPenunjuk", nama: pilih(["i", "j"]), dLapisan: pilih([-1, 0, 1]), dBaris: pilih([-1, 0, 1]), dKolom: pilih([-1, 0, 1]) },
      { kind: "hapusPenunjuk", nama: pilih(["i", "j"]) },
      { kind: "sorotLapisan", lapisan: k(), tone: pilih(LAB_TONES) },
      { kind: "sorotBaris", baris: r(), tone: pilih(LAB_TONES) },
      { kind: "sorotKolom", kolom: c(), tone: pilih(LAB_TONES) },
      { kind: "sorotPilar", baris: r(), kolom: c(), tone: pilih(LAB_TONES) },
      { kind: "hapusSorotan" },
      { kind: "telusurLapisan" },
      { kind: "telusurPilar" },
      { kind: "telusurDiagonal" },
      { kind: "transposeTiapLapisan" },
      { kind: "putarTiapLapisan" },
      { kind: "balikUrutanLapisan" },
      { kind: "tukarSumbu", sumbuA: bulat(3), sumbuB: bulat(3) },
    ]);

    let hasil;
    try {
      hasil = applyCubeOp(beku3(state), op);
    } catch (e) {
      dilempar = `${op.kind}: ${e instanceof Error ? e.message : String(e)}`;
      break;
    }
    if (!hasil.ok) continue;
    kasusAcak++;

    if (hasil.steps.length > CUBE_MAX_STEPS) langkahBerlebih++;
    for (const st of hasil.steps) {
      if (st.narasi.trim() === "" || st.narasi !== st.narasi.trim()) narasiBuruk++;
      const masalah = assertCubeInvariants(st.state);
      if (masalah !== null && rusak === null) rusak = `${op.kind}: ${masalah}`;
    }
    const akhir = hasil.steps[hasil.steps.length - 1].state;
    // Transformasi memindahkan sel; penunjuk dan sorotan harus ikut selnya.
    if (tandaLepas === null && TRANSFORMASI.has(op.kind) && yangDitandai3(akhir) !== yangDitandai3(state)) {
      tandaLepas = `${op.kind}: ${yangDitandai3(state)} → ${yangDitandai3(akhir)}`;
    }
    state = akhir;
  }

  check("3D: reducer tidak pernah melempar untuk masukan pengguna", dilempar === null, dilempar ?? "tidak ada");
  check("3D: invarian kubus utuh sesudah setiap langkah", rusak === null, rusak ?? `${kasusAcak.toLocaleString("id-ID")} operasi berhasil diuji`);
  check(
    "3D: jumlah langkah dan narasi dalam batas",
    langkahBerlebih === 0 && narasiBuruk === 0,
    `${langkahBerlebih} langkah berlebih, ${narasiBuruk} narasi bermasalah`,
  );
  check("3D: penunjuk dan sorotan ikut selnya saat kubus ditransformasi", tandaLepas === null, tandaLepas ?? "selalu ikut");

  // ── Penanda saat kubus menyusut ──
  const tanda = (ops: CubeOp[], awal = K223) => ops.reduce(akhir3, awal);
  const tiga = akhir3(K223, { kind: "tambahLapisan", lapisan: 2, nilai: "0" });
  const geser = tanda([{ kind: "sorotLapisan", lapisan: 1, tone: "sorot" }, { kind: "hapusLapisan", lapisan: 0 }]);
  const buang = tanda([{ kind: "sorotBaris", baris: 0, tone: "hasil" }, { kind: "hapusLapisan", lapisan: 1 }]);
  const jepit = tanda([{ kind: "setPenunjuk", nama: "i", lapisan: 2, baris: 1, kolom: 2, tone: "utama" }, { kind: "hapusLapisan", lapisan: 2 }], tiga);
  const kosong = tanda([{ kind: "setPenunjuk", nama: "i", lapisan: 1, baris: 1, kolom: 2, tone: "utama" }, { kind: "kosongkan" }]);
  check(
    "3D: sorotan bergeser atau dibuang utuh, penunjuk dijepit ke dalam kubus, kubus kosong tanpa penunjuk",
    JSON.stringify(geser.boxes.map((b) => [b.from[0], b.to[0]])) === "[[0,0]]" &&
      buang.boxes.length === 0 &&
      jepit.pointers[0]?.at.join(",") === "1,1,2" &&
      kosong.pointers.length === 0 &&
      kosong.shape.join(",") === "0,0,0",
    `geser=${JSON.stringify(geser.boxes)}, buang=${buang.boxes.length}, jepit=${jepit.pointers[0]?.at}, kosong=${kosong.pointers.length}`,
  );

  // ── Masukan tidak sah ──
  const penuh = akhir3(emptyCubeState(), { kind: "buat", jumlahLapisan: CUBE_MAX_SIDE, jumlahBaris: 1, jumlahKolom: 1 });
  const empatPenunjuk = (["a", "b", "c", "d"] as const).reduce(
    (s, nama) => akhir3(s, { kind: "setPenunjuk", nama, lapisan: 0, baris: 0, kolom: 0, tone: "utama" }),
    K223,
  );
  const lebihSisi = CUBE_MAX_SIDE + 1;
  const harusDitolak: [string, CubeLabState, CubeOp][] = [
    ["lapisan tidak sama ukuran", emptyCubeState(), { kind: "isiDariTeks", teks: "1 2; 3 4 | 5 6" }],
    ["baris tidak sama panjang", emptyCubeState(), { kind: "isiDariTeks", teks: "1 2; 3" }],
    ["teks kosong", emptyCubeState(), { kind: "isiDariTeks", teks: " | ; " }],
    ["lapisan melebihi batas", emptyCubeState(), { kind: "isiDariTeks", teks: Array.from({ length: lebihSisi }, () => "1").join("|") }],
    ["kolom melebihi batas", emptyCubeState(), { kind: "isiDariTeks", teks: Array.from({ length: lebihSisi }, () => "1").join(" ") }],
    ["nilai berisi titik dua", emptyCubeState(), { kind: "isiDariTeks", teks: "1 a:b" }],
    ["buat 0 lapisan", emptyCubeState(), { kind: "buat", jumlahLapisan: 0, jumlahBaris: 2, jumlahKolom: 2 }],
    ["acak baris melebihi batas", emptyCubeState(), { kind: "acak", jumlahLapisan: 2, jumlahBaris: lebihSisi, jumlahKolom: 2, maks: 9, benih: 1 }],
    ["buat ukuran pecahan", emptyCubeState(), { kind: "buat", jumlahLapisan: 1.5, jumlahBaris: 2, jumlahKolom: 2 }],
    ["lapisan melebihi batas lewat sisip", penuh, { kind: "tambahLapisan", lapisan: 0, nilai: "1" }],
    ["sisip lapisan di luar 0..D", K223, { kind: "tambahLapisan", lapisan: 3, nilai: "1" }],
    ["hapus lapisan yang tidak ada", K223, { kind: "hapusLapisan", lapisan: 2 }],
    ["baca di luar kubus", K223, { kind: "bacaSel", lapisan: 0, baris: 0, kolom: 3 }],
    ["baca indeks negatif", K223, { kind: "bacaSel", lapisan: -1, baris: 0, kolom: 0 }],
    ["ubah di kubus kosong", emptyCubeState(), { kind: "setSel", lapisan: 0, baris: 0, kolom: 0, nilai: "1" }],
    ["nilai 7 karakter", K223, { kind: "setSel", lapisan: 0, baris: 0, kolom: 0, nilai: "1234567" }],
    ["penunjuk kelima", empatPenunjuk, { kind: "setPenunjuk", nama: "e", lapisan: 0, baris: 0, kolom: 0, tone: "utama" }],
    ["geser penunjuk keluar kubus", empatPenunjuk, { kind: "geserPenunjuk", nama: "a", dLapisan: -1, dBaris: 0, dKolom: 0 }],
    ["geser penunjuk yang belum ada", K223, { kind: "geserPenunjuk", nama: "z", dLapisan: 1, dBaris: 0, dKolom: 0 }],
    ["sorot pilar di luar kubus", K223, { kind: "sorotPilar", baris: 2, kolom: 0, tone: "sorot" }],
    ["tukar sumbu 3", K223, { kind: "tukarSumbu", sumbuA: 0, sumbuB: 3 }],
    ["telusur kubus kosong", emptyCubeState(), { kind: "telusurPilar" }],
  ];
  const lolos = harusDitolak.filter(([, awal, op]) => applyCubeOp(awal, op).ok);
  check(
    "3D: masukan tidak sah ditolak",
    lolos.length === 0,
    lolos.length === 0 ? `${harusDitolak.length} kasus ditolak` : lolos.map(([n]) => n).join(", "),
  );

  // ── URL ──
  const rngUrl = mulberry32(3030);
  const b3 = (maks: number) => Math.floor(rngUrl() * maks);
  let diuji = 0;
  let urlMeleset: string | null = null;
  let tidakStabil = 0;
  for (let i = 0; i < 400 && urlMeleset === null; i++) {
    let s = akhir3(emptyCubeState(), {
      kind: "acak",
      jumlahLapisan: b3(CUBE_MAX_SIDE) + 1,
      jumlahBaris: b3(CUBE_MAX_SIDE) + 1,
      jumlahKolom: b3(CUBE_MAX_SIDE) + 1,
      maks: 999,
      benih: i,
    });
    const [D, R, C] = s.shape;
    const ops: CubeOp[] = [
      { kind: "setPenunjuk", nama: "i", lapisan: b3(D), baris: b3(R), kolom: b3(C), tone: "utama" },
      { kind: "setPenunjuk", nama: "j", lapisan: b3(D), baris: b3(R), kolom: b3(C), tone: "kedua" },
      { kind: "sorotPilar", baris: b3(R), kolom: b3(C), tone: LAB_TONES[b3(LAB_TONES.length)] },
      { kind: "sorotLapisan", lapisan: b3(D), tone: LAB_TONES[b3(LAB_TONES.length)] },
      ...(b3(2) === 0 ? [{ kind: "tukarSumbu", sumbuA: b3(3), sumbuB: b3(3) } as CubeOp] : []),
    ];
    for (const op of ops) {
      const h = applyCubeOp(s, op);
      if (h.ok) s = h.steps[h.steps.length - 1].state;
    }
    const kode = encodeLabSnapshot({ lab: "array3d", state: s });
    if (kode === null) {
      urlMeleset = "encode mengembalikan null untuk kubus yang sah";
      break;
    }
    diuji++;
    const kembali = decodeLabSnapshot(kode);
    if (!kembali || kembali.lab !== "array3d" || kanonik3(kembali.state, false) !== kanonik3(s, false)) {
      urlMeleset = `bolak-balik meleset pada "${kode}"`;
      break;
    }
    if (encodeLabSnapshot({ lab: "array3d", state: kembali.state }) !== kode) tidakStabil++;
    if (new URLSearchParams({ s: kode }).get("s") !== kode) tidakStabil++;
  }
  check(
    "3D: kubus sah bolak-balik lewat URL tanpa berubah",
    urlMeleset === null && tidakStabil === 0,
    urlMeleset ?? `${diuji} kubus, ${tidakStabil} tidak stabil`,
  );

  const m = CUBE_MAX_SIDE - 1;
  let berat = akhir3(emptyCubeState(), { kind: "buat", jumlahLapisan: CUBE_MAX_SIDE, jumlahBaris: CUBE_MAX_SIDE, jumlahKolom: CUBE_MAX_SIDE });
  berat = akhir3(berat, { kind: "isiDariTeks", teks: Array.from({ length: CUBE_MAX_SIDE }, () => Array.from({ length: CUBE_MAX_SIDE }, () => Array.from({ length: CUBE_MAX_SIDE }, () => "abc123").join(" ")).join(";")).join("|") });
  (["abcde1", "abcde2", "abcde3", "abcde4"] as const).forEach((nama) => {
    berat = akhir3(berat, { kind: "setPenunjuk", nama, lapisan: m, baris: m, kolom: m, tone: "kedua" });
  });
  LAB_TONES.forEach((tone, n) => {
    berat = akhir3(berat, n % 2 === 0 ? { kind: "sorotBaris", baris: n, tone } : { kind: "sorotKolom", kolom: n, tone });
  });
  const kodeBerat = encodeLabSnapshot({ lab: "array3d", state: berat });
  check(
    "3D: kubus paling berat (125 elemen) muat di batas panjang URL",
    kodeBerat !== null && kodeBerat.length <= LAB_MAX_URL_STATE,
    `${kodeBerat?.length ?? "null"} dari ${LAB_MAX_URL_STATE} karakter`,
  );

  const dua = "1,2,3,4,5,6,7,8";
  const rusakUrl: [string, string][] = [
    ["jumlah nilai tidak cocok", "1c~2x2x2~1,2,3~~"],
    ["bentuk dua angka", "1c~2x4~1,2,3,4,5,6,7,8~~"],
    ["sisi melebihi batas", `1c~${CUBE_MAX_SIDE + 1}x1x1~${Array.from({ length: CUBE_MAX_SIDE + 1 }, () => "1").join(",")}~~`],
    ["sisi 0", "1c~0x2x2~~~"],
    ["bagian bentuk kosong", "1c~2xx2~1,2,3,4~~"],
    ["penunjuk di luar kubus", `1c~2x2x2~${dua}~p:2:0:0:utama~`],
    ["penunjuk kurang koordinat", `1c~2x2x2~${dua}~p:1:0:utama~`],
    ["nada penunjuk tak dikenal", `1c~2x2x2~${dua}~p:1:0:0:ungu~`],
    ["nama penunjuk ganda", `1c~2x2x2~${dua}~p:0:0:0:utama,p:1:1:1:kedua~`],
    ["sorotan terbalik", `1c~2x2x2~${dua}~~1:0:0:0:1:1:sorot`],
    ["nada sorotan tak dikenal", `1c~2x2x2~${dua}~~0:0:0:1:1:1:ungu`],
    ["penunjuk di kubus kosong", "1c~~~p:0:0:0:utama~"],
    ["ruas kurang", `1c~2x2x2~${dua}~`],
  ];
  const diterima = rusakUrl.filter(([, raw]) => decodeLabSnapshot(raw) !== null);
  const kosongBaik = decodeLabSnapshot("1c~~~~");
  check(
    "3D: tautan rusak ditolak seluruhnya, kubus kosong tetap terbaca",
    diterima.length === 0 && kosongBaik !== null && kosongBaik.lab === "array3d" && kosongBaik.state.cells.length === 0,
    diterima.length === 0 ? `${rusakUrl.length} kasus ditolak` : diterima.map(([n]) => n).join(", "),
  );
}

// ── 11. Tanda animasi: warna asal, jejak, akses bertahap ─────────────────
//
// Animasi menjelaskan, ia tidak menyimpan informasi — tapi penjelasan yang
// salah lebih buruk daripada tidak ada. Warna yang tidak ikut selnya akan
// mengajarkan transpose yang keliru; jejak yang melompati sel mengajarkan
// urutan penelusuran yang keliru.

interface LangkahBertanda {
  state: unknown;
  fokus: number[];
  kelompok?: { warna: Record<number, number>; label: string[] };
  jalur?: number[];
}

/** Masalah pertama pada tanda-tanda satu rangkaian langkah, atau null. */
function periksaTanda(steps: readonly LangkahBertanda[], idDi: (state: unknown) => number[]): string | null {
  let jalurSebelum: number[] | null = null;
  for (const [n, st] of steps.entries()) {
    const ids = new Set(idDi(st.state));
    if (st.kelompok) {
      const { warna, label } = st.kelompok;
      if (label.length > LAB_MAX_KELOMPOK) return `langkah ${n + 1}: ${label.length} warna melebihi ${LAB_MAX_KELOMPOK}`;
      for (const [id, w] of Object.entries(warna)) {
        if (!ids.has(Number(id))) return `langkah ${n + 1}: warna untuk id ${id} yang tidak ada di papan`;
        if (!Number.isInteger(w) || w < 0 || w >= label.length) return `langkah ${n + 1}: nomor warna ${w} tanpa label`;
      }
      if (Object.keys(warna).length !== ids.size) return `langkah ${n + 1}: ada sel tanpa warna asal`;
    }
    if (st.jalur) {
      if (new Set(st.jalur).size !== st.jalur.length) return `langkah ${n + 1}: jejak mengunjungi sel yang sama dua kali`;
      if (!st.jalur.every((id) => ids.has(id))) return `langkah ${n + 1}: jejak berisi sel yang tidak ada`;
      // Ujung jejak = sel yang SEDANG dikunjungi. Tanpa ini, jejak yang tidak
      // disalin per langkah (seluruh rute tampil sejak kunjungan pertama)
      // tetap lolos pemeriksaan "hanya bertambah" di bawah.
      if (st.fokus.length === 1 && st.jalur[st.jalur.length - 1] !== idDi(st.state)[st.fokus[0]]) {
        return `langkah ${n + 1}: ujung jejak bukan sel yang sedang dikunjungi`;
      }
      // Jejak hanya boleh bertambah: setiap langkah = jejak sebelumnya (+ satu sel).
      if (jalurSebelum !== null) {
        const tambah = st.jalur.length - jalurSebelum.length;
        if (tambah < 0 || tambah > 1 || !jalurSebelum.every((id, i) => st.jalur![i] === id)) {
          return `langkah ${n + 1}: jejak tidak meneruskan jejak sebelumnya`;
        }
      }
      jalurSebelum = st.jalur;
    }
  }
  // Langkah terakhir masuk riwayat dan tinggal di papan: harus bersih dari
  // warna asal, kalau tidak papannya tampak "masih di tengah transformasi".
  if (steps.length > 0 && steps[steps.length - 1].kelompok) return "langkah terakhir masih membawa warna asal";
  return null;
}

const idMatriks = (s: unknown) => (s as MatrixLabState).rows.flat().map((c) => c.id);
const idKubus = (s: unknown) => (s as CubeLabState).cells.map((c) => c.id);
const idNd = (s: unknown) => (s as NdLabState).cells.map((c) => c.id);

{
  // ── Tanda selalu sah, untuk SETIAP operasi di ketiga katalog ──
  const masalah: string[] = [];
  const papan2 = akhir2(emptyMatrixState(), { kind: "isiDariTeks", teks: "1 2 3; 4 5 6; 7 8 9" });
  for (const spec of Object.values(MATRIX_OP_CATALOG)) {
    const h = applyMatrixOp(akhir2(papan2, { kind: "setPenunjuk", nama: "p", baris: 0, kolom: 0, tone: "utama" }), spec.contoh);
    const m = h.ok ? periksaTanda(h.steps, idMatriks) : null;
    if (m) masalah.push(`2D ${spec.kind}: ${m}`);
  }
  const papan3 = akhir3(emptyCubeState(), { kind: "buat", jumlahLapisan: 3, jumlahBaris: 3, jumlahKolom: 4 });
  for (const spec of Object.values(CUBE_OP_CATALOG)) {
    const h = applyCubeOp(akhir3(papan3, { kind: "setPenunjuk", nama: "p", lapisan: 0, baris: 0, kolom: 0, tone: "utama" }), spec.contoh);
    const m = h.ok ? periksaTanda(h.steps, idKubus) : null;
    if (m) masalah.push(`3D ${spec.kind}: ${m}`);
  }
  for (const spec of Object.values(ND_OP_CATALOG)) {
    const h = applyNdOp(B234, spec.contoh);
    const m = h.ok ? periksaTanda(h.steps, idNd) : null;
    if (m) masalah.push(`N-D ${spec.kind}: ${m}`);
  }
  check(
    "animasi: warna asal & jejak selalu sah, dan langkah terakhir selalu bersih",
    masalah.length === 0,
    masalah.length === 0 ? "2D, 3D, N-D — semua operasi katalog" : masalah.slice(0, 3).join(" | "),
  );

  // ── Warna asal benar-benar ikut selnya ──
  // Transpose 2D: sel berwarna "baris k semula" harus berdiri di kolom k.
  const t2 = applyMatrixOp(DUA_TIGA, { kind: "transpose" });
  const gerak2 = t2.ok ? t2.steps.find((st) => st.kelompok && st.state.rows.length === 3) : undefined;
  const warna2Salah = gerak2
    ? gerak2.state.rows.flatMap((row) => row.filter((c, k) => gerak2.kelompok!.warna[c.id] !== k)).length
    : -1;
  // Tukar lapisan↔baris 3D: sel "lapisan x semula" harus berkumpul di baris x.
  const t3 = applyCubeOp(K223, { kind: "tukarSumbu", sumbuA: 0, sumbuB: 1 });
  const gerak3 = t3.ok ? t3.steps.find((st) => st.kelompok && st.state !== K223 && st.narasi.includes("meluncur")) : undefined;
  const warna3Salah = gerak3
    ? gerak3.state.cells.filter((c, o) => gerak3.kelompok!.warna[c.id] !== cubeKoord(o, gerak3.state.shape)[1]).length
    : -1;
  // Reshape N-D: memori tidak berubah, jadi warna di pita memori tetap berderet (tidak turun).
  const tr = applyNdOp(B234, { kind: "ubahBentuk", bentuk: "4, 6" });
  const gerakR = tr.ok ? tr.steps.find((st) => st.kelompok && st.state.shape.length === 2) : undefined;
  const urutWarna = gerakR ? gerakR.state.cells.map((c) => gerakR.kelompok!.warna[c.id]) : [];
  const berderet = urutWarna.length === 24 && urutWarna.every((w, i) => i === 0 || w >= urutWarna[i - 1]);
  check(
    "animasi: warna asal ikut selnya (transpose 2D → kolom, tukar sumbu 3D → baris, reshape N-D → tetap berderet)",
    warna2Salah === 0 && warna3Salah === 0 && berderet,
    `2D salah ${warna2Salah}, 3D salah ${warna3Salah}, reshape berderet=${berderet}`,
  );

  // ── Jejak = urutan kunjungan yang sebenarnya ──
  const tk = applyMatrixOp(DUA_TIGA, { kind: "telusurKolom" });
  const jejakAkhir = tk.ok ? tk.steps[tk.steps.length - 1].jalur ?? [] : [];
  const harapId = [0, 3, 1, 4, 2, 5].map((o) => DUA_TIGA.rows.flat()[o].id);
  const tn = applyNdOp(B234, { kind: "telusuri" });
  const jejakNd = tn.ok ? tn.steps[tn.steps.length - 1].jalur ?? [] : [];
  check(
    "animasi: jejak penelusuran mencatat urutan kunjungan sebenarnya dan tetap tampil di akhir",
    JSON.stringify(jejakAkhir) === JSON.stringify(harapId) && JSON.stringify(jejakNd) === JSON.stringify(B234.cells.map((c) => c.id)),
    `kolom=${jejakAkhir.join(",")} (harap ${harapId.join(",")}), N-D ${jejakNd.length} sel`,
  );

  // ── Akses bertahap: luar → dalam ──
  const b2 = applyMatrixOp(DUA_TIGA, { kind: "bacaSel", baris: 1, kolom: 2 });
  const b3 = applyCubeOp(K223, { kind: "bacaSel", lapisan: 1, baris: 0, kolom: 2 });
  const bn = applyNdOp(B234, { kind: "bacaElemen", indeks: "1, 2, 3" });
  const ukuranFokus = (h: { ok: boolean; steps?: { fokus: number[] }[] }) => (h.ok && h.steps ? h.steps.map((st) => st.fokus.length).join(",") : "gagal");
  const barisDulu = b2.ok && b2.steps[0].state.ranges.length === 1 && b2.steps[0].state.ranges[0].r1 === 1 && b2.steps[0].state.ranges[0].r2 === 1;
  const ndBerderet = bn.ok && bn.steps[0].fokus.join(",") === Array.from({ length: 12 }, (_, i) => 12 + i).join(",");
  check(
    "animasi: akses bertahap — 2D baris lalu sel, 3D 6→3→1 sel, N-D 12→4→1 elemen",
    barisDulu && ukuranFokus(b2) === "0,1,1" && ukuranFokus(b3) === "6,3,1" && ukuranFokus(bn) === "12,4,1" && ndBerderet,
    `2D ${ukuranFokus(b2)} (baris dulu=${barisDulu}), 3D ${ukuranFokus(b3)}, N-D ${ukuranFokus(bn)}`,
  );

  // ── Tempo: cukup lambat untuk dibaca ──
  const geser = t2.ok ? t2.steps.filter((st) => st.narasi.includes("meluncur")).map((st) => st.tahanMs) : [];
  check(
    "animasi: langkah biasa ≥ 1,5 detik, langkah yang menggeser sel ditahan lebih lama dari geraknya",
    LAB_STEP_HOLD_MS >= 1500 && geser.length > 0 && geser.every((ms) => ms >= 2000),
    `langkah ${LAB_STEP_HOLD_MS} ms, geser ${geser.join(",")} ms`,
  );
}

finish();
