/**
 * Fisika game "Tanjakan Robo" (mirip Hill Climb Racing, pengendaranya robot) - NETRAL: tanpa `server-only`, tanpa impor `@/`,
 * murni angka (dipakai kanvas klien dan skrip uji). Satuan: piksel dunia & detik; sumbu y ke BAWAH; sudut positif = searah jarum
 * jam di layar (jadi hidung mobil naik = sudut negatif).
 *
 * Model "kendaraan raycast" yang stabil: sasis = benda tegar tunggal; tiap roda tergantung pegas-peredam sepanjang sumbu
 * "bawah" sasis. Posisi roda dicari agar tepat menyentuh tanah (Newton pada jarak bertanda ke permukaan), gaya pegas dikenakan
 * ke sasis di titik gantungnya, dan gaya gerak/rem searah singgung tanah di titik kontak (itulah yang mengangkat hidung saat
 * gas penuh). Kepala pengendara = bola kecil: menyentuh tanah = game berakhir. Sudut badan lain ditahan tanah dengan dorongan
 * posisi + impuls, jadi mobil tak menembus bukit.
 */

export const G = 1500;
export const MASA = 1;
export const INERSIA = 1100;
export const ANTAR_RODA = 40;
export const RODA_Y = 16;
export const RODA_R = 17;
export const PEGAS_REHAT = 24;
export const PEGAS_JALAN = 14;
export const PEGAS_K = 125;
export const PEGAS_C = 16;
export const MESIN = 620;
export const REM = 820;
export const KECEPATAN_MAKS = 470;
/** Cengkeraman ban: gaya gerak tak boleh melebihi TRAKSI x gaya tekan roda (mencegah selip/melesat). */
export const TRAKSI = 1.1;
/**
 * Bantuan menanjak: di lereng naik mesin mengimbangi sebagian gravitasi searah lereng (`BANTU_TANJAK` x berat) dan ban lebih mencengkeram
 * (`TRAKSI_TANJAK` tambahan di lereng terjal), supaya mobil tidak melambat sampai nyaris berhenti di bukit seperti sebelumnya.
 */
export const BANTU_TANJAK = 0.4;
export const TRAKSI_TANJAK = 0.7;
export const KEPALA = { x: 4, y: -36, r: 10 } as const;
/** Titik badan yang ditahan tanah (koordinat lokal sasis). */
export const TITIK_BADAN: readonly [number, number][] = [
  [-54, 8],
  [54, 8],
  [50, -12],
  [-48, -12],
  [-8, -24],
  [22, -24],
];

/** Loncat: dorongan ke atas (px/dtk), jeda antar loncatan, dan toleransi setelah roda lepas dari tanah (dtk). */
export const LONCAT_DORONG = 520;
export const LONCAT_JEDA = 0.7;
export const LONCAT_TOLERANSI = 0.12;
/**
 * Nitro (NOS): tabung di jalan MENGISI tangki (`NOS_ISI`, maks `NOS_TANGKI_MAKS`); tangki hanya terpakai selagi tombol nitro
 * ditahan (`NOS_BOROS` per dtk). Selama menyala: tenaga mesin x`NOS_TENAGA` dan kecepatan maksimum `NOS_KECEPATAN_MAKS`
 * (+45% dari biasa: terasa nyata, tetapi tidak melesat tanpa kendali).
 */
export const NOS_TANGKI_MAKS = 100;
export const NOS_ISI = 60;
export const NOS_BOROS = 34;
export const NOS_TENAGA = 1.7;
export const NOS_KECEPATAN_MAKS = 680;
export const NOS_TRAKSI = 1.6;

export const BENSIN_AWAL = 100;
export const BENSIN_PER_DETIK_GAS = 7;
export const BENSIN_PER_DETIK_DIAM = 1.6;
export const BENSIN_KALENG = 45;
export const AWAL_X = 180;
export const PX_PER_METER = 40;

const jepit = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const halus = (t: number) => t * t * (3 - 2 * t);

/** Tinggi tanah (y, ke bawah) tanpa rintangan. Datar di awal, makin bergelombang semakin jauh, tetapi kemiringannya dibatasi. */
export function tanahDasar(x: number): number {
  const f = halus(jepit((x - 320) / 800, 0, 1));
  const amp = 1 + Math.min(0.5, Math.max(0, x) / 16000);
  const h = 50 * Math.sin(x / 260) + 25 * Math.sin(x / 120 + 1.3) + 9 * Math.sin(x / 47 + 4.1);
  return 430 - f * amp * h;
}
export function landaiDasar(x: number): number {
  return (tanahDasar(x + 1) - tanahDasar(x - 1)) / 2;
}

/**
 * Rintangan (batu) ke-k: gundukan mulus di atas tanah yang harus dilompati. Setengah lebarnya 60 px dan tingginya 20-28 px,
 * jadi kemiringan maksimumnya ±0,75 (di bawah batas tanjakan biasa), tetapi menabraknya dengan cepat membuat mobil terpental.
 */
export const RINTANGAN_MULAI = 1300;
export const RINTANGAN_JARAK = 820;
export const RINTANGAN_SETENGAH = 60;
export function rintanganDi(k: number): { x: number; tinggi: number } {
  const x = RINTANGAN_MULAI + k * RINTANGAN_JARAK + acak(k + 33) * 320;
  // Di lereng curam batu ditiadakan (tinggi 0): gundukan di atas tanjakan terjal terlalu terjal untuk dilompati.
  return { x, tinggi: Math.abs(landaiDasar(x)) > 0.35 ? 0 : 20 + 8 * acak(k + 57) };
}
/** Tinggi gundukan rintangan di x (0 bila tak ada). */
export function tinggiRintangan(x: number): number {
  if (x < RINTANGAN_MULAI - RINTANGAN_SETENGAH) return 0;
  const k0 = Math.floor((x - RINTANGAN_MULAI) / RINTANGAN_JARAK);
  for (let k = Math.max(0, k0 - 1); k <= k0 + 1; k++) {
    const r = rintanganDi(k);
    const dx = Math.abs(x - r.x);
    if (dx < RINTANGAN_SETENGAH) {
      const c = Math.cos((Math.PI * dx) / (2 * RINTANGAN_SETENGAH));
      return r.tinggi * c * c;
    }
  }
  return 0;
}
export function tanah(x: number): number {
  return tanahDasar(x) - tinggiRintangan(x);
}
export function landai(x: number): number {
  return (tanah(x + 1) - tanah(x - 1)) / 2;
}

export interface Roda {
  /** Sudut putar tampilan (rad). */
  rot: number;
  /** Kecepatan putar (rad/dtk). */
  omega: number;
  /** Penekanan pegas (px), 0 = di udara. */
  komp: number;
  kompPrev: number;
  kontak: boolean;
}

export interface Dunia {
  x: number;
  y: number;
  a: number;
  vx: number;
  vy: number;
  w: number;
  roda: [Roda, Roda];
  bensin: number;
  koin: number;
  waktu: number;
  /** Jarak terjauh (m). */
  jarak: number;
  selesai: null | "jatuh" | "bensin";
  diam: number;
  /** Indeks koin / kaleng bensin yang sudah diambil. */
  koinAmbil: Set<number>;
  bensinAmbil: Set<number>;
  /** Isi tangki nitro (0..NOS_TANGKI_MAKS), apakah nitro sedang menyala, dan indeks tabung nitro yang sudah diambil. */
  nosTangki: number;
  nosAktif: boolean;
  nosAmbil: Set<number>;
  /** Jeda sampai boleh loncat lagi, dan waktu sejak roda terakhir menapak. */
  jedaLoncat: number;
  sejakKontak: number;
}

export interface Masukan {
  gas: boolean;
  rem: boolean;
  /** Loncat (spasi / tombol). Opsional supaya skrip uji lama tetap sah. */
  loncat?: boolean;
  /** Tombol nitro ditahan (Shift / tombol NOS). Hanya berefek bila tangki berisi. */
  nos?: boolean;
}

const rodaBaru = (): Roda => ({ rot: 0, omega: 0, komp: 0, kompPrev: 0, kontak: false });

export function duniaBaru(): Dunia {
  return {
    x: AWAL_X,
    y: tanah(AWAL_X) - (RODA_Y + PEGAS_REHAT + RODA_R) + 4,
    a: 0,
    vx: 0,
    vy: 0,
    w: 0,
    roda: [rodaBaru(), rodaBaru()],
    bensin: BENSIN_AWAL,
    koin: 0,
    waktu: 0,
    jarak: 0,
    selesai: null,
    diam: 0,
    koinAmbil: new Set(),
    bensinAmbil: new Set(),
    nosTangki: 0,
    nosAktif: false,
    nosAmbil: new Set(),
    jedaLoncat: 0,
    sejakKontak: 0,
  };
}

/** Hash deterministik 0..1 dari bilangan bulat (penempatan koin/bensin sama tiap main). */
function acak(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Koin ke-i: kelompok busur berisi 5 koin, tiap kelompok ±900 px. */
export function koinDi(i: number): { x: number; y: number } {
  const grup = Math.floor(i / 5);
  const k = i % 5;
  const x = 760 + grup * 900 + acak(grup) * 260 + k * 46;
  return { x, y: tanah(x) - 56 - 26 * Math.sin((k / 4) * Math.PI) };
}
export function bensinDi(j: number): { x: number; y: number } {
  const x = 1500 + j * 1900 + acak(j + 91) * 500;
  return { x, y: tanah(x) - 46 };
}

/**
 * Item nitro ke-j: muncul sesekali (±2500 px sekali) dan diletakkan ±160 px SEBELUM tanjakan terdekat (dibaca dari tanah dasar),
 * supaya kecepatannya terpakai untuk naik. Tanpa tanjakan dalam 700 px, ditaruh di posisi dasarnya.
 */
const nosMemo = new Map<number, { x: number; y: number }>();
export function nosDi(j: number): { x: number; y: number } {
  const ada = nosMemo.get(j);
  if (ada) return ada;
  const dasar = 2400 + j * 2500 + acak(j + 177) * 600;
  let x = dasar;
  for (let c = dasar; c < dasar + 700; c += 10) {
    if (landaiDasar(c) < -0.22) {
      x = Math.max(dasar - 100, c - 160);
      break;
    }
  }
  const r = { x, y: tanah(x) - 46 };
  nosMemo.set(j, r);
  return r;
}

/** Jarak bertanda dari titik ke permukaan tanah (positif = di atas), beserta normal naiknya. */
function jarakTanah(px: number, py: number) {
  const sl = landai(px);
  const len = Math.sqrt(1 + sl * sl);
  return { sd: (tanah(px) - py) / len, nx: sl / len, ny: -1 / len, tx: 1 / len, ty: sl / len, sl, len };
}

/** Satu langkah fisika `dt` detik (disarankan ≤ 1/100). */
export function langkah(d: Dunia, m: Masukan, dt: number): void {
  if (d.selesai) return;
  const ada = d.bensin > 0;
  const gas = m.gas && ada;
  const rem = m.rem;
  const nos = !!m.nos && d.nosTangki > 0;
  d.nosAktif = nos;
  // Nitro mendorong walau gas dilepas (selama tidak mengerem) dan tidak memakai bensin tambahan.
  const dorong = gas || (nos && !rem);
  const vMaks = nos ? NOS_KECEPATAN_MAKS : KECEPATAN_MAKS;
  const traksi = nos ? NOS_TRAKSI : TRAKSI;
  const c = Math.cos(d.a);
  const s = Math.sin(d.a);
  const putar = (lx: number, ly: number): [number, number] => [c * lx - s * ly, s * lx + c * ly];
  const ux = -s;
  const uy = c;

  let ax = 0;
  let ay = G;
  let alfa = 0;
  let adaKontak = false;

  for (let i = 0; i < 2; i++) {
    const r = d.roda[i];
    const lx = i === 0 ? -ANTAR_RODA : ANTAR_RODA;
    const [rx, ry] = putar(lx, RODA_Y);
    const apx = d.x + rx;
    const apy = d.y + ry;
    const f = (L: number) => jarakTanah(apx + ux * L, apy + uy * L).sd - RODA_R;

    let L = PEGAS_REHAT;
    let fL = f(L);
    let komp = 0;
    if (fL < 0) {
      for (let k = 0; k < 5; k++) {
        const turunan = f(L + 1) - fL;
        if (Math.abs(turunan) < 1e-6) break;
        L = jepit(L - fL / turunan, PEGAS_REHAT - PEGAS_JALAN - 8, PEGAS_REHAT);
        fL = f(L);
        if (Math.abs(fL) < 0.05) break;
      }
      komp = Math.max(0, PEGAS_REHAT - L);
    }

    r.kontak = komp > 0;
    if (!r.kontak) {
      r.kompPrev = 0;
      r.komp = 0;
      // Di udara roda berputar bebas; gas memutarnya cepat, rem menahannya.
      r.omega = gas ? Math.min(40, r.omega + 90 * dt) : rem ? r.omega * Math.max(0, 1 - 9 * dt) : r.omega * (1 - 0.4 * dt);
      r.rot += r.omega * dt;
      continue;
    }
    adaKontak = true;

    const kompVel = (komp - r.kompPrev) / dt;
    r.kompPrev = komp;
    r.komp = komp;
    let F = PEGAS_K * komp + PEGAS_C * kompVel;
    if (komp > PEGAS_JALAN) F += PEGAS_K * 3 * (komp - PEGAS_JALAN);
    F = Math.max(0, F);
    const fx = -ux * F;
    const fy = -uy * F;
    ax += fx / MASA;
    ay += fy / MASA;
    alfa += (rx * fy - ry * fx) / INERSIA;

    // Gaya gerak / rem searah singgung tanah di titik kontak roda.
    const px = apx + ux * L;
    const py = apy + uy * L;
    const g = jarakTanah(px, py);
    const kx = px - g.nx * RODA_R;
    const ky = py - g.ny * RODA_R;
    const vpx = d.vx - d.w * ry;
    const vpy = d.vy + d.w * rx;
    const vt = vpx * g.tx + vpy * g.ty;
    const beban = jepit(F / 620, 0.4, 1.3);
    let ft = 0;
    // Torsi besar di putaran rendah (kuat menanjak dari diam), menurun mulus mendekati kecepatan maksimum; di atasnya mesin menahan.
    if (dorong) ft = vt > vMaks ? -(vt - vMaks) * 4 : MESIN * (nos ? NOS_TENAGA : 1) * beban * Math.pow(1 - Math.max(0, vt) / vMaks, 0.75);
    else if (rem) {
      if (vt > 25) ft = -REM * Math.min(1, beban + 0.2);
      else ft = -MESIN * 0.32 * beban * Math.max(0, 1 + Math.min(0, vt) / 320);
    } else ft = -vt * 0.9;
    // Menanjak (g.ty < 0): imbangi gravitasi searah lereng dan perbesar cengkeraman, hanya selagi gas/nitro menekan.
    const naik = Math.max(0, -g.ty);
    if (dorong && vt < vMaks) ft += (BANTU_TANJAK * G * naik) / 2;
    const traksiLereng = traksi * (1 + (dorong ? TRAKSI_TANJAK * Math.min(1, naik * 1.6) : 0));
    ft = jepit(ft, -traksiLereng * F * 1.6, traksiLereng * F);
    // Rem tak boleh membalik arah dalam satu langkah (menahan getar).
    if (rem && !gas && vt > 0 && -ft * dt > vt) ft = -vt / dt;
    const ftx = ft * g.tx;
    const fty = ft * g.ty;
    ax += ftx / MASA;
    ay += fty / MASA;
    alfa += ((kx - d.x) * fty - (ky - d.y) * ftx) / INERSIA;

    // Roda menggelinding mengikuti tanah (gas = sedikit tergelincir lebih cepat).
    const sasaran = vt / RODA_R + (gas ? 2 : 0);
    r.omega += (sasaran - r.omega) * Math.min(1, 14 * dt);
    r.rot += r.omega * dt;
  }

  // Loncat: hanya saat roda menapak (atau baru lepas), dengan jeda; dorongan searah "atas" sasis.
  d.sejakKontak = adaKontak ? 0 : d.sejakKontak + dt;
  d.jedaLoncat = Math.max(0, d.jedaLoncat - dt);
  if (m.loncat && d.jedaLoncat <= 0 && d.sejakKontak <= LONCAT_TOLERANSI) {
    d.vx += s * LONCAT_DORONG * 0.5;
    d.vy = Math.min(d.vy, 0) - c * LONCAT_DORONG;
    d.jedaLoncat = LONCAT_JEDA;
    d.sejakKontak = 1;
  }
  if (nos) d.nosTangki = Math.max(0, d.nosTangki - NOS_BOROS * dt);

  // Kendali di udara: gas = hidung naik, rem = hidung turun.
  if (!adaKontak) {
    if (gas) alfa -= 15;
    else if (rem) alfa += 15;
    d.w *= 1 - 0.35 * dt;
  } else {
    d.w *= 1 - 1.6 * dt;
  }
  d.w = jepit(d.w + alfa * dt, -7, 7);
  // hambatan udara ringan: mobil tak melesat tanpa batas saat menuruni bukit
  const hambat = 1 - 0.22 * dt;
  d.vx = (d.vx + ax * dt) * hambat;
  d.vy = (d.vy + ay * dt) * hambat;
  d.x += d.vx * dt;
  d.y += d.vy * dt;
  d.a += d.w * dt;

  // Badan & kepala vs tanah.
  const ca = Math.cos(d.a);
  const sa = Math.sin(d.a);
  for (const [lx, ly] of TITIK_BADAN) {
    const rx = ca * lx - sa * ly;
    const ry = sa * lx + ca * ly;
    const g = jarakTanah(d.x + rx, d.y + ry);
    if (g.sd >= 0) continue;
    const pen = -g.sd;
    d.x += g.nx * pen;
    d.y += g.ny * pen;
    const vpx = d.vx - d.w * ry;
    const vpy = d.vy + d.w * rx;
    const vn = vpx * g.nx + vpy * g.ny;
    if (vn < 0) {
      const rn = rx * g.ny - ry * g.nx;
      const j = (-(1 + 0.08) * vn) / (1 / MASA + (rn * rn) / INERSIA);
      d.vx += (j * g.nx) / MASA;
      d.vy += (j * g.ny) / MASA;
      d.w += (rx * (j * g.ny) - ry * (j * g.nx)) / INERSIA;
      // gesekan badan menyeret
      d.vx *= 1 - 0.12;
    }
  }
  const hx = d.x + ca * KEPALA.x - sa * KEPALA.y;
  const hy = d.y + sa * KEPALA.x + ca * KEPALA.y;
  if (jarakTanah(hx, hy).sd < KEPALA.r) {
    d.selesai = "jatuh";
    return;
  }

  // Koin & kaleng bensin.
  const awal = Math.floor((d.x - 300) / 900) * 5 - 5;
  for (let i = Math.max(0, awal); i < Math.max(0, awal) + 20; i++) {
    if (d.koinAmbil.has(i)) continue;
    const k = koinDi(i);
    if (Math.hypot(k.x - d.x, k.y - d.y) < 46) {
      d.koinAmbil.add(i);
      d.koin += 1;
    }
  }
  for (let j = Math.max(0, Math.floor((d.x - 1500) / 1900) - 1); j < Math.max(0, Math.floor((d.x - 1500) / 1900)) + 3; j++) {
    if (d.bensinAmbil.has(j)) continue;
    const b = bensinDi(j);
    if (Math.hypot(b.x - d.x, b.y - d.y) < 48) {
      d.bensinAmbil.add(j);
      d.bensin = Math.min(BENSIN_AWAL, d.bensin + BENSIN_KALENG);
    }
  }

  for (let j = Math.max(0, Math.floor((d.x - 2400) / 2500) - 1); j < Math.max(0, Math.floor((d.x - 2400) / 2500)) + 3; j++) {
    if (d.nosAmbil.has(j)) continue;
    const n = nosDi(j);
    if (Math.hypot(n.x - d.x, n.y - d.y) < 48) {
      d.nosAmbil.add(j);
      d.nosTangki = Math.min(NOS_TANGKI_MAKS, d.nosTangki + NOS_ISI);
    }
  }

  d.waktu += dt;
  d.bensin = Math.max(0, d.bensin - (gas ? BENSIN_PER_DETIK_GAS : BENSIN_PER_DETIK_DIAM) * dt);
  d.jarak = Math.max(d.jarak, Math.floor((d.x - AWAL_X) / PX_PER_METER));
  // Bensin habis lalu berhenti = selesai.
  if (d.bensin <= 0 && Math.hypot(d.vx, d.vy) < 14) {
    d.diam += dt;
    if (d.diam > 1.4) d.selesai = "bensin";
  } else d.diam = 0;
}
