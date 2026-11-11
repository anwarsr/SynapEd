/**
 * Fisika game "Bola Gabung" (gaya Suika/fruit merge, objeknya bola) - NETRAL: tanpa `server-only`, tanpa impor `@/`, murni
 * angka (dipakai kanvas klien dan skrip uji). Satuan dunia: piksel logis; sumbu y ke BAWAH.
 *
 * Aturan: bola dijatuhkan dari atas wadah; dua bola SATU tingkat yang bersentuhan lebur jadi satu bola tingkat berikutnya
 * (di titik tengah berbobot massa) dan menambah skor. Bola yang bertumpuk di atas garis batas terlalu lama = selesai.
 * Penyelesai tumbukan: lingkaran bermassa ~ r^2, koreksi posisi + impuls normal + sedikit gesekan, beberapa putaran per
 * langkah tetap supaya tumpukan stabil. Pengacak bersemai (mulberry32) membuat hasil bisa diuji ulang.
 */

export const LEBAR = 270;
export const TINGGI = 480;
/** Garis batas: bola yang puncaknya di atas garis ini (dan diam) terlalu lama = selesai. */
export const GARIS_Y = 100;
/** Tinggi tempat bola dijatuhkan (pusat bola). */
export const SPAWN_Y = 52;

export const G = 2000;
/** Pantulan antarbola / dinding / lantai. Pantulan HANYA bila tumbukannya cukup keras (> BATAS_PANTUL): bola yang sekadar bersandar tak bergetar. */
export const PANTUL = 0.32;
export const PANTUL_LANTAI = 0.38;
export const BATAS_PANTUL = 140;
/** Benturan sekeras ini (px/dtk) dicatat di `dentum` supaya bisa dibunyikan. */
export const BATAS_BUNYI = 90;
const DENTUM_MAKS = 24;
/** Gesekan antarbola: rendah supaya tiap bola licin dan tak saling lengket. */
/** Cengkeram lantai wadah (tinggi): bola menggelinding di lantai, tidak berseluncur. */
export const GESEKAN_LANTAI = 1.2;
/** Hambatan guling per detik di lantai: bola yang menggelinding pelan-pelan berhenti. */
export const HAMBATAN_GULING = 0.5;
/** Di bawah kecepatan ini (px/dtk) bola di lantai direm kuat. */
export const GULING_PELAN = 90;
export const HAMBATAN_PELAN = 7;
export const GESEKAN = 0.4;
const PUTARAN = 5;
const SUB = 4;
/** Bola baru tak dihitung melewati garis selama sekian detik (sedang jatuh). */
export const RASA_JATUH = 1.1;
export const BATAS_DIAM = 2.4;
export const JEDA_JATUH = 0.42;

/** Jari-jari, warna dasar, dan nilai skor per tingkat (tingkat 0..10). */
export const RADIUS: readonly number[] = [15, 20, 26, 32, 39, 48, 57, 68, 81, 94, 110];
export const WARNA: readonly string[] = ["#3FA9B8", "#F08A3A", "#F3F1EA", "#C9DA3A", "#F2EBDD", "#2C3E8F", "#F2C233", "#D9742B", "#F3F1EA", "#E0584D", "#3C7FC4"];
/** Jenis bola tiap tingkat (urutan sama dengan RADIUS): hanya tampilan, fisikanya tetap lingkaran. */
export const NAMA: readonly string[] = ["Kelereng", "Bola pingpong", "Bola golf", "Bola tenis", "Bola bisbol", "Bola bowling", "Bola voli", "Bola basket", "Bola sepak", "Bola pantai", "Bola dunia"];
export const NILAI: readonly number[] = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66];
export const TINGKAT_MAKS = RADIUS.length - 1;
/** Bola yang muncul di tangan hanya tingkat 0..4. */
export const TINGKAT_AWAL_MAKS = 4;

export interface Bola {
  id: number;
  n: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Kecepatan sudut (rad/dtk, searah jarum jam di layar) dan sudut putar: bola betul-betul menggelinding. */
  w: number;
  sudut: number;
  r: number;
  /** Detik sejak dijatuhkan. */
  umur: number;
  /** Detik berturut-turut ia diam di atas garis batas. */
  diam: number;
}

export interface Efek {
  x: number;
  y: number;
  n: number;
}

export interface DuniaBola {
  bola: Bola[];
  skor: number;
  selesai: boolean;
  nextId: number;
  seed: number;
  /** Tingkat bola di tangan dan bola berikutnya. */
  sekarang: number;
  berikut: number;
  /** Sisa jeda sebelum boleh menjatuhkan lagi. */
  jeda: number;
  /** Penggabungan yang baru terjadi (dikosongkan pemakai setelah digambar/dibunyikan). */
  efek: Efek[];
  /** Kekuatan benturan (kecepatan normal, px/dtk) yang baru terjadi, untuk efek suara; dikosongkan pemakai. Dibatasi panjangnya. */
  dentum: number[];
  /** Jumlah penggabungan sepanjang permainan. */
  gabungan: number;
  /** Tingkat tertinggi yang pernah dicapai. */
  tertinggi: number;
}

function acak(d: DuniaBola): number {
  d.seed = (d.seed + 0x6d2b79f5) >>> 0;
  let t = d.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Bobot kemunculan tingkat 0..4: kecil lebih sering. */
function tingkatBaru(d: DuniaBola): number {
  const r = acak(d);
  if (r < 0.34) return 0;
  if (r < 0.62) return 1;
  if (r < 0.82) return 2;
  if (r < 0.94) return 3;
  return 4;
}

export function duniaBolaBaru(seed = (Math.random() * 4294967296) >>> 0): DuniaBola {
  const d: DuniaBola = { bola: [], skor: 0, selesai: false, nextId: 1, seed: seed >>> 0, sekarang: 0, berikut: 0, jeda: 0, efek: [], dentum: [], gabungan: 0, tertinggi: 0 };
  d.sekarang = tingkatBaru(d);
  d.berikut = tingkatBaru(d);
  return d;
}

/** Batas x yang sah untuk pusat bola tingkat n (tidak menembus dinding). */
export function jepitX(n: number, x: number): number {
  const r = RADIUS[n];
  return Math.min(LEBAR - r, Math.max(r, x));
}

/** Menjatuhkan bola di tangan di posisi x. Mengembalikan false bila belum boleh (jeda / selesai). */
export function jatuhkan(d: DuniaBola, x: number): boolean {
  if (d.selesai || d.jeda > 0 || !Number.isFinite(x)) return false;
  const n = d.sekarang;
  d.bola.push({ id: d.nextId++, n, x: jepitX(n, x), y: SPAWN_Y, vx: 0, vy: 0, w: 0, sudut: 0, r: RADIUS[n], umur: 0, diam: 0 });
  d.sekarang = d.berikut;
  d.berikut = tingkatBaru(d);
  d.jeda = JEDA_JATUH;
  return true;
}

const massa = (b: Bola) => b.r * b.r;
/** Momen inersia cakram pejal: 1/2 m r^2. Dipakai agar gesekan menggulirkan bola, bukan sekadar menahannya. */
const inersia = (b: Bola) => 0.5 * massa(b) * b.r * b.r;

/**
 * Gesekan Coulomb pada satu bola terhadap permukaan diam (lantai/dinding) dengan normal keluar (nx, ny). Kecepatan titik sentuh =
 * v + w*r (searah singgung), jadi gesekan menggerakkan bola DAN memutarnya sampai menggelinding tanpa selip (v = w*r).
 */
function gesekPermukaan(b: Bola, nx: number, ny: number, beban: number, mu: number): void {
  const tx = -ny;
  const ty = nx;
  const m = massa(b);
  const vs = b.vx * tx + b.vy * ty + b.w * b.r;
  const k = 1 / m + (b.r * b.r) / inersia(b);
  const batas = mu * beban;
  const j = Math.max(-batas, Math.min(batas, -vs / k));
  b.vx += (j * tx) / m;
  b.vy += (j * ty) / m;
  b.w += (b.r * j) / inersia(b);
}

/** Satu langkah fisika `dt` detik (disarankan <= 1/100), dipecah jadi sub-langkah: tumpukan jauh lebih stabil daripada satu langkah besar. */
export function langkahBola(d: DuniaBola, dt: number): void {
  for (let i = 0; i < SUB && !d.selesai; i++) subLangkah(d, dt / SUB);
}

function subLangkah(d: DuniaBola, dt: number): void {
  if (d.selesai) return;
  d.jeda = Math.max(0, d.jeda - dt);
  const bs = d.bola;

  for (const b of bs) {
    b.umur += dt;
    b.vy += G * dt;
    const redam = 1 - 0.25 * dt;
    b.vx *= redam;
    b.vy *= redam;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.sudut += b.w * dt;
  }

  const gabung: [Bola, Bola][] = [];
  for (let it = 0; it < PUTARAN; it++) {
    const terakhir = it === PUTARAN - 1;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      for (let j = i + 1; j < bs.length; j++) {
        const c = bs[j];
        const dx = c.x - a.x;
        const dy = c.y - a.y;
        const jarak2 = dx * dx + dy * dy;
        const min = a.r + c.r;
        if (jarak2 >= min * min) continue;
        if (a.n === c.n && a.n < TINGKAT_MAKS) {
          if (it === 0) gabung.push([a, c]);
          continue;
        }
        const jarak = Math.sqrt(jarak2) || 1e-6;
        const nx = dx / jarak;
        const ny = dy / jarak;
        const tembus = min - jarak;
        const ma = massa(a);
        const mc = massa(c);
        const total = ma + mc;
        // koreksi posisi: bola ringan bergeser lebih banyak
        const k = 0.9;
        a.x -= nx * tembus * (mc / total) * k;
        a.y -= ny * tembus * (mc / total) * k;
        c.x += nx * tembus * (ma / total) * k;
        c.y += ny * tembus * (ma / total) * k;
        // Impuls normal: pantul hanya bila benturannya keras; bersandar = tanpa pantul (tak bergetar).
        const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        const massaEfektif = 1 / (1 / ma + 1 / mc);
        let impuls = 0;
        if (vn < -BATAS_BUNYI && d.dentum.length < DENTUM_MAKS) d.dentum.push(-vn);
        if (vn < 0) {
          const e = -vn > BATAS_PANTUL ? PANTUL : 0;
          impuls = (-(1 + e) * vn) * massaEfektif;
          a.vx -= (impuls * nx) / ma;
          a.vy -= (impuls * ny) / ma;
          c.vx += (impuls * nx) / mc;
          c.vy += (impuls * ny) / mc;
        }
        // Gesekan singgung SELALU bekerja di titik sentuh (juga saat bersandar): beban = impuls tumbukan + berat yang ditopang.
        // Kecepatan titik sentuh memuat putaran kedua bola, jadi bola yang saling bersentuhan saling memutar (bergulir di atas satu sama lain).
        const tx = -ny;
        const ty = nx;
        const vt = (c.vx - a.vx) * tx + (c.vy - a.vy) * ty - c.w * c.r - a.w * a.r;
        const ia = inersia(a);
        const ic = inersia(c);
        const kt = 1 / ma + 1 / mc + (a.r * a.r) / ia + (c.r * c.r) / ic;
        const beban = impuls + massaEfektif * G * dt * Math.abs(ny) / PUTARAN;
        const batas = beban * GESEKAN;
        const gesek = Math.max(-batas, Math.min(batas, -vt / kt));
        a.vx -= (gesek * tx) / ma;
        a.vy -= (gesek * ty) / ma;
        c.vx += (gesek * tx) / mc;
        c.vy += (gesek * ty) / mc;
        a.w -= (a.r * gesek) / ia;
        c.w -= (c.r * gesek) / ic;
      }
    }
    // dinding & lantai
    for (const b of bs) {
      const m = massa(b);
      if (b.x - b.r <= 1e-6) {
        b.x = b.r;
        const masuk = Math.max(0, -b.vx);
        if (masuk > BATAS_BUNYI && d.dentum.length < DENTUM_MAKS) d.dentum.push(masuk);
        if (b.vx < 0) b.vx = -b.vx * (masuk > BATAS_PANTUL ? PANTUL : 0);
        if (terakhir) gesekPermukaan(b, -1, 0, m * masuk, GESEKAN);
      } else if (b.x + b.r >= LEBAR - 1e-6) {
        b.x = LEBAR - b.r;
        const masuk = Math.max(0, b.vx);
        if (masuk > BATAS_BUNYI && d.dentum.length < DENTUM_MAKS) d.dentum.push(masuk);
        if (b.vx > 0) b.vx = -b.vx * (masuk > BATAS_PANTUL ? PANTUL : 0);
        if (terakhir) gesekPermukaan(b, 1, 0, m * masuk, GESEKAN);
      }
      if (b.y + b.r >= TINGGI - 1e-6) {
        b.y = TINGGI - b.r;
        const masuk = Math.max(0, b.vy);
        if (masuk > BATAS_BUNYI && d.dentum.length < DENTUM_MAKS) d.dentum.push(masuk);
        if (b.vy > 0) b.vy = -b.vy * (masuk > BATAS_PANTUL ? PANTUL_LANTAI : 0);
        if (terakhir) {
          // lantai bergerigi: cengkeram kuat (menggelinding, bukan seluncur) + sedikit hambatan guling supaya akhirnya berhenti
          gesekPermukaan(b, 0, 1, m * (G * dt + masuk), GESEKAN_LANTAI);
          // cepat = menggelinding jauh; pelan = cepat diam (tumpukan tak merayap / terdorong melebar)
          const redamGuling = 1 - Math.min(1, (Math.abs(b.vx) < GULING_PELAN ? HAMBATAN_PELAN : HAMBATAN_GULING) * dt);
          b.vx *= redamGuling;
          b.w *= redamGuling;
        }
      }
    }
  }

  // penggabungan: tiap bola hanya sekali per langkah
  if (gabung.length > 0) {
    const pakai = new Set<number>();
    const mati = new Set<number>();
    const baru: Bola[] = [];
    for (const [a, c] of gabung) {
      if (pakai.has(a.id) || pakai.has(c.id)) continue;
      pakai.add(a.id);
      pakai.add(c.id);
      mati.add(a.id);
      mati.add(c.id);
      const n = a.n + 1;
      const ma = massa(a);
      const mc = massa(c);
      const total = ma + mc;
      const r = RADIUS[n];
      const x = (a.x * ma + c.x * mc) / total;
      const y = (a.y * ma + c.y * mc) / total;
      baru.push({
        id: d.nextId++,
        n,
        x: Math.min(LEBAR - r, Math.max(r, x)),
        y: Math.min(TINGGI - r, y),
        vx: (a.vx * ma + c.vx * mc) / total,
        vy: (a.vy * ma + c.vy * mc) / total,
        w: (a.w * ma + c.w * mc) / total,
        sudut: a.sudut,
        r,
        umur: Math.max(a.umur, c.umur),
        diam: 0,
      });
      d.skor += NILAI[n];
      d.gabungan += 1;
      d.tertinggi = Math.max(d.tertinggi, n);
      d.efek.push({ x, y, n });
    }
    d.bola = bs.filter((b) => !mati.has(b.id)).concat(baru);
  }

  // garis batas: diam di atas garis terlalu lama = selesai
  for (const b of d.bola) {
    const kecepatan = Math.hypot(b.vx, b.vy);
    if (b.umur > RASA_JATUH && b.y - b.r < GARIS_Y && kecepatan < 70) b.diam += dt;
    else b.diam = 0;
    if (b.diam > BATAS_DIAM) {
      d.selesai = true;
      return;
    }
  }
}
