/**
 * Fisika game "Lari Robo" (endless runner) - NETRAL: tanpa `server-only`, tanpa impor `@/`, murni angka (dipakai kanvas klien dan
 * skrip uji). Satuan: piksel dunia & detik; sumbu y ke BAWAH. Layar logis W x H; robot berdiri di x tetap (`PX`) sementara dunia
 * bergulir ke kiri, makin cepat tiap detik.
 *
 * Kendali: LONCAT (tahan = lebih tinggi; lepas dini = pendek), TUNDUK (menunduk di tanah; di udara = jatuh lebih cepat), DASH
 * (lesatan singkat yang kebal dan menghancurkan rintangan; ada jeda pengisian). Rintangan: peti, peti tinggi, duri (loncat),
 * drone melayang (tunduk), dan tembok energi setinggi layar (hanya bisa ditembus dengan DASH). Skor naik menurut jarak dasar
 * (bukan kecepatan dash, supaya dash tak bisa dipakai menggelembungkan skor) + koin; tiap 100 skor = 1 bintang (diatur di klien).
 * Pembangkit rintangan bersemai (mulberry32) jadi hasil bisa diulang dan diuji.
 */

export const W = 800;
export const H = 360;
export const TANAH = 300;
/** Posisi x robot di layar (tengah kotaknya). */
export const PX = 130;

export const V_AWAL = 300;
export const V_MAKS = 660;
/** Tambahan kecepatan dasar per detik. */
export const PERCEPAT = 6;
export const SKOR_PX = 95;
export const SKOR_KOIN = 3;
export const SKOR_HANCUR = 4;

export const GRAV = 2300;
export const LONCAT_V = 720;
/** Melepas tombol loncat dini memotong kecepatan naik sampai segini (pecahan dari LONCAT_V). */
export const POTONG = 0.45;
export const GRAV_TUNDUK = 2.3;
export const COYOTE = 0.09;
export const BUFFER = 0.12;

export const BERDIRI = { w: 30, h: 56 } as const;
export const TUNDUK = { w: 38, h: 30 } as const;
/** Hitbox dikecilkan sedikit di tiap sisi supaya lolos tipis tak dianggap tabrakan. */
export const TOLERANSI = 4;

export const DASH_DURASI = 0.34;
export const DASH_JEDA = 2.2;
export const DASH_KALI = 1.9;

export type TipeRintangan = "peti" | "tinggi" | "duri" | "drone" | "tembok";
export interface Rintangan {
  id: number;
  tipe: TipeRintangan;
  /** Kiri kotak (koordinat dunia), puncak kotak (y layar), lebar, tinggi. */
  x: number;
  y: number;
  w: number;
  h: number;
  hancur: boolean;
}
export interface KoinLari {
  id: number;
  x: number;
  y: number;
  ambil: boolean;
}

export interface BunyiLari {
  n: "loncat" | "mendarat" | "dash" | "koin" | "hancur" | "mati" | "siap";
  /** Kekuatan (mendarat: kecepatan jatuh). */
  k: number;
}

export interface DuniaLari {
  seed: number;
  t: number;
  /** Jarak dunia yang sudah ditempuh (px). */
  jarak: number;
  skor: number;
  koin: number;
  /** Kecepatan dasar (tanpa dash) dan kecepatan sekarang. */
  vDasar: number;
  v: number;
  /** Kaki robot (y layar) dan kecepatan vertikal (px/dtk, + = turun). */
  y: number;
  vy: number;
  tanah: boolean;
  tunduk: boolean;
  sejakTanah: number;
  buffer: number;
  loncatPrev: boolean;
  dashPrev: boolean;
  dashSisa: number;
  dashJeda: number;
  rintangan: Rintangan[];
  koinList: KoinLari[];
  /** Posisi dunia tempat pola berikutnya dibangkitkan. */
  ujung: number;
  nextId: number;
  selesai: null | "tabrak";
  /** Peristiwa suara baru (dikosongkan pemakai; panjangnya dibatasi). */
  bunyi: BunyiLari[];
  /** Jumlah rintangan yang dihancurkan dash. */
  hancurCount: number;
  /** Posisi dunia tembok energi terakhir: tembok berikutnya harus cukup jauh supaya dash sempat terisi lagi. */
  tembokTerakhir: number;
}

function acak(d: { seed: number }): number {
  d.seed = (d.seed + 0x6d2b79f5) >>> 0;
  let t = d.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function duniaLariBaru(seed = (Math.random() * 4294967296) >>> 0): DuniaLari {
  const d: DuniaLari = {
    seed: seed >>> 0,
    t: 0,
    jarak: 0,
    skor: 0,
    koin: 0,
    vDasar: V_AWAL,
    v: V_AWAL,
    y: TANAH,
    vy: 0,
    tanah: true,
    tunduk: false,
    sejakTanah: 0,
    buffer: 0,
    loncatPrev: false,
    dashPrev: false,
    dashSisa: 0,
    dashJeda: 0,
    rintangan: [],
    koinList: [],
    ujung: 760,
    nextId: 1,
    selesai: null,
    bunyi: [],
    hancurCount: 0,
    tembokTerakhir: -1e9,
  };
  return d;
}

export interface MasukanLari {
  loncat: boolean;
  tunduk: boolean;
  dash: boolean;
}

function catat(d: DuniaLari, n: BunyiLari["n"], k = 0) {
  if (d.bunyi.length < 16) d.bunyi.push({ n, k });
}

function tambahRintangan(d: DuniaLari, tipe: TipeRintangan, x: number): Rintangan {
  const ukuran: Record<TipeRintangan, [number, number, number]> = {
    peti: [40, 40, TANAH - 40],
    tinggi: [40, 72, TANAH - 72],
    duri: [60, 24, TANAH - 24],
    // drone: bagian bawahnya 40 px di atas tanah: berdiri (tinggi 56) menabraknya, menunduk (tinggi 30) lolos
    drone: [50, 34, TANAH - 40 - 34],
    tembok: [18, 180, TANAH - 180],
  };
  const [w, h, y] = ukuran[tipe];
  const r: Rintangan = { id: d.nextId++, tipe, x, y, w, h, hancur: false };
  d.rintangan.push(r);
  return r;
}

/** Jarak dari titik ke kotak rintangan (0 bila di dalamnya). */
export function jarakKeKotak(px: number, py: number, o: { x: number; y: number; w: number; h: number }): number {
  const dx = Math.max(o.x - px, 0, px - (o.x + o.w));
  const dy = Math.max(o.y - py, 0, py - (o.y + o.h));
  return Math.hypot(dx, dy);
}
/** Jarak minimum pusat koin ke rintangan mana pun: jari-jari koin (12) + celah kosong yang terlihat. Koin tak boleh menempel pada rintangan. */
export const JARAK_KOIN_RINTANGAN = 26;

function tambahKoin(d: DuniaLari, x: number, y: number) {
  for (const o of d.rintangan) if (jarakKeKotak(x, y, o) < JARAK_KOIN_RINTANGAN) return;
  d.koinList.push({ id: d.nextId++, x, y, ambil: false });
}
/** Busur koin mengikuti lintasan loncat: titik yang terlalu dekat rintangan dibuang (tinggal yang melayang jelas di atasnya). */
function busurKoin(d: DuniaLari, x0: number, x1: number, tinggi: number) {
  const n = 6;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    tambahKoin(d, x0 + (x1 - x0) * u, TANAH - 22 - Math.sin(u * Math.PI) * tinggi);
  }
}
function barisKoin(d: DuniaLari, x0: number, n: number, y: number) {
  for (let i = 0; i < n; i++) tambahKoin(d, x0 + i * 34, y);
}

/** Membangkitkan satu pola rintangan di `d.ujung` lalu memajukan `ujung`. Makin lama bermain, makin beragam. */
function bangkitkan(d: DuniaLari): void {
  const x = d.ujung;
  const v = d.vDasar;
  const r = acak(d);
  const lama = d.t;
  // bobot jenis pola menurut lama bermain (tembok & drone baru muncul setelah pemain terbiasa)
  const pilih: [string, number][] = [
    ["peti", 3],
    ["duri", 2.2],
    ["tinggi", lama > 8 ? 2 : 0],
    ["drone", lama > 14 ? 2.2 : 0],
    ["tembok", lama > 24 ? 1.3 : 0],
    ["ganda", lama > 12 ? 1.6 : 0],
  ];
  const total = pilih.reduce((a, [, b]) => a + b, 0);
  let u = r * total;
  let jenis = "peti";
  for (const [n, b] of pilih) {
    if ((u -= b) <= 0) {
      jenis = n;
      break;
    }
  }
  // Adil: tembok hanya bisa ditembus dash, jadi jaraknya dari tembok sebelumnya melebihi jeda isi ulang dash.
  if (jenis === "tembok" && x - d.tembokTerakhir < v * (DASH_JEDA + 1.2)) jenis = "peti";
  let lebarPola = 40;
  let ruang = v * (0.9 + acak(d) * 0.55);
  if (jenis === "peti" || jenis === "tinggi" || jenis === "duri") {
    const ob = tambahRintangan(d, jenis, x);
    lebarPola = ob.w;
    if (acak(d) < 0.55) busurKoin(d, x - 90, x + ob.w + 90, Math.max(78, ob.h + 62));
  } else if (jenis === "drone") {
    const ob = tambahRintangan(d, "drone", x);
    lebarPola = ob.w;
    // koin setinggi badan yang menunduk, SEBELUM dan SESUDAH drone (tidak di bawahnya: koin yang menempel pada rintangan dianggap bug)
    if (acak(d) < 0.6) {
      barisKoin(d, x - 150, 3, TANAH - 16);
      barisKoin(d, x + ob.w + 70, 3, TANAH - 16);
    }
  } else if (jenis === "tembok") {
    const ob = tambahRintangan(d, "tembok", x);
    d.tembokTerakhir = x;
    lebarPola = ob.w;
    ruang = v * (1.25 + acak(d) * 0.4);
    barisKoin(d, x + ob.w + 60, 3, TANAH - 90);
  } else {
    // ganda: dua rintangan rendah berdekatan, dilewati dengan satu loncatan panjang
    const a = tambahRintangan(d, acak(d) < 0.5 ? "peti" : "duri", x);
    const b = tambahRintangan(d, "peti", x + a.w + 60);
    lebarPola = a.w + 60 + b.w;
    busurKoin(d, x - 90, x + lebarPola + 90, 112);
  }
  d.ujung = x + lebarPola + Math.max(ruang, v * 0.78 + 40);
}

function irisan(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** Hitbox robot saat ini (koordinat dunia). */
export function kotakRobot(d: DuniaLari): { x: number; y: number; w: number; h: number } {
  const u = d.tunduk ? TUNDUK : BERDIRI;
  return { x: d.jarak + PX - u.w / 2, y: d.y - u.h, w: u.w, h: u.h };
}

/** Satu langkah fisika `dt` detik (disarankan <= 1/100). */
export function langkahLari(d: DuniaLari, m: MasukanLari, dt: number): void {
  if (d.selesai) return;
  d.t += dt;
  d.vDasar = Math.min(V_MAKS, V_AWAL + PERCEPAT * d.t);

  // dash: picu pada penekanan baru, kebal selama DASH_DURASI, lalu menunggu DASH_JEDA sejak dimulai
  const dashBaru = m.dash && !d.dashPrev;
  d.dashPrev = m.dash;
  if (dashBaru && d.dashJeda <= 0 && d.dashSisa <= 0) {
    d.dashSisa = DASH_DURASI;
    d.dashJeda = DASH_JEDA;
    catat(d, "dash");
  }
  d.dashSisa = Math.max(0, d.dashSisa - dt);
  d.dashJeda = Math.max(0, d.dashJeda - dt);
  d.v = d.vDasar * (d.dashSisa > 0 ? DASH_KALI : 1);

  // loncat: penekanan baru ditampung sebentar (buffer), boleh sesaat setelah meninggalkan tanah (coyote)
  const loncatBaru = m.loncat && !d.loncatPrev;
  d.loncatPrev = m.loncat;
  d.buffer = loncatBaru ? BUFFER : Math.max(0, d.buffer - dt);
  d.sejakTanah = d.tanah ? 0 : d.sejakTanah + dt;
  if (d.buffer > 0 && d.sejakTanah <= COYOTE) {
    d.vy = -LONCAT_V;
    d.tanah = false;
    d.sejakTanah = 1;
    d.buffer = 0;
    catat(d, "loncat");
  }
  if (!m.loncat && d.vy < -LONCAT_V * POTONG) d.vy = -LONCAT_V * POTONG;

  const g = GRAV * (m.tunduk && !d.tanah && d.vy > 0 ? GRAV_TUNDUK : 1);
  d.vy += g * dt;
  d.y += d.vy * dt;
  if (d.y >= TANAH) {
    if (!d.tanah && d.vy > 220) catat(d, "mendarat", d.vy);
    d.y = TANAH;
    d.vy = 0;
    d.tanah = true;
  } else d.tanah = false;
  d.tunduk = m.tunduk && d.tanah;

  d.jarak += d.v * dt;
  d.skor += (d.vDasar * dt) / SKOR_PX;

  while (d.ujung < d.jarak + W + 300) bangkitkan(d);

  // koin
  const k = kotakRobot(d);
  for (const c of d.koinList) {
    if (c.ambil) continue;
    if (c.x + 12 > k.x - 6 && c.x - 12 < k.x + k.w + 6 && c.y + 12 > k.y - 6 && c.y - 12 < k.y + k.h + 6) {
      c.ambil = true;
      d.koin += 1;
      d.skor += SKOR_KOIN;
      catat(d, "koin");
    }
  }

  // tabrakan (hitbox dikecilkan TOLERANSI); selama dash robot kebal dan menghancurkan yang tersentuh
  for (const o of d.rintangan) {
    if (o.hancur) continue;
    if (!irisan(k.x + TOLERANSI, k.y + TOLERANSI, k.w - TOLERANSI * 2, k.h - TOLERANSI * 2, o.x + TOLERANSI, o.y + TOLERANSI, o.w - TOLERANSI * 2, o.h - TOLERANSI * 2)) continue;
    if (d.dashSisa > 0) {
      o.hancur = true;
      d.hancurCount += 1;
      d.skor += SKOR_HANCUR;
      catat(d, "hancur");
    } else {
      d.selesai = "tabrak";
      catat(d, "mati");
      return;
    }
  }

  // bersihkan yang sudah jauh di belakang
  const batas = d.jarak - 200;
  if (d.rintangan.length && d.rintangan[0].x + d.rintangan[0].w < batas) d.rintangan = d.rintangan.filter((o) => o.x + o.w >= batas);
  if (d.koinList.length > 60) d.koinList = d.koinList.filter((c) => c.x >= batas && !c.ambil);
}

/** Skor bulat yang ditampilkan. */
export const skorBulat = (d: DuniaLari) => Math.floor(d.skor);
/** 100 skor = 1 bintang: jumlah koin game yang disetor (100 koin = 1 bintang di penukaran). */
export const SKOR_PER_BINTANG = 100;
