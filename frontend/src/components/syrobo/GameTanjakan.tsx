"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import PanelSuara from "./PanelSuara";
import { SuaraGame, bacaPengaturan, simpanPengaturan, type PengaturanSuara } from "./suaraGame";
import {
  landai,
  ANTAR_RODA,
  BENSIN_AWAL,
  KEPALA,
  PEGAS_REHAT,
  RODA_R,
  RODA_Y,
  NOS_TANGKI_MAKS,
  RINTANGAN_JARAK,
  RINTANGAN_MULAI,
  RINTANGAN_SETENGAH,
  bensinDi,
  duniaBaru,
  koinDi,
  langkah,
  nosDi,
  rintanganDi,
  tanah,
  tanahDasar,
  type Dunia,
} from "@/lib/syrobo/game/tanjakanFisika";

/**
 * Game "Tanjakan Robo" (terinspirasi Hill Climb Racing): mobil kecil dengan pengendara robot menanjak bukit tanpa ujung.
 * Fisika di `tanjakanFisika.ts` (murni, diuji); berkas ini hanya menggambar (kanvas 2D bergaya stiker: garis tinta tebal,
 * warna datar hangat) dan membaca kendali:
 *  - Desktop: → / D / W / ↑ = GAS, ← / A / S / ↓ = REM (dan mundur), R = ulang, Esc/P = jeda.
 *  - Ponsel/tablet: dua pedal besar di sudut layar (multi-sentuh: gas & rem bisa ditekan bersamaan dengan dua jari).
 * Tidak memberi poin SyRobo (hanya hiburan), jadi rekor jarak hanya disimpan di perangkat ini.
 */

const INK = "#2B2233";
const KUNCI_REKOR = "synaped_syrobo_tanjakan_rekor";
const DT = 1 / 120;

const KEY_GAS = new Set(["ArrowRight", "d", "D", "ArrowUp", "w", "W"]);
const KEY_LONCAT = new Set([" ", "Spacebar"]);
const KEY_NOS = new Set(["Shift"]);
const KEY_REM = new Set(["ArrowLeft", "a", "A", "ArrowDown", "s", "S"]);

interface Partikel {
  x: number;
  y: number;
  vx: number;
  vy: number;
  umur: number;
  maks: number;
  r: number;
  warna: string;
}

function bacaRekor(): number {
  try {
    const n = Number(localStorage.getItem(KUNCI_REKOR));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Garis tinta + isian. */
function isiGaris(ctx: CanvasRenderingContext2D, fill: string, lebar = 3.5) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lebar;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

/**
 * Lanskap "lukisan": tanpa garis tinta. Awan = sprite kanvas dari puluhan gumpalan bergradasi radial (dasar rata, sisi bawah
 * keabu-abuan, sisi atas diterangi matahari), dibuat SEKALI lalu digambar berulang; gunung berlapis dengan perspektif udara
 * (makin jauh makin pucat & kebiruan); matahari = cahaya menyebar, bukan lingkaran bergaris.
 */
let SPRITE_AWAN: HTMLCanvasElement[] | null = null;
function spriteAwan(): HTMLCanvasElement[] {
  if (SPRITE_AWAN) return SPRITE_AWAN;
  SPRITE_AWAN = [0, 1, 2, 3, 4].map((seed) => {
    const cv = document.createElement("canvas");
    cv.width = 420;
    cv.height = 190;
    const c = cv.getContext("2d")!;
    const gumpal: { x: number; y: number; r: number }[] = [];
    const n = 26 + (seed % 3) * 6;
    for (let i = 0; i < n; i++) {
      const u = hash(seed * 97 + i * 3 + 1);
      const x = 50 + u * 320;
      const tinggi = Math.sin(u * Math.PI);
      const r = 20 + hash(seed * 31 + i) * 30 * (0.5 + tinggi);
      const y = 132 - tinggi * (30 + hash(seed * 13 + i * 7) * 46) + hash(i + seed) * 10;
      gumpal.push({ x, y, r });
    }
    gumpal.sort((a, b) => a.y - b.y);
    for (const g of gumpal) {
      const rg = c.createRadialGradient(g.x - g.r * 0.25, g.y - g.r * 0.35, g.r * 0.1, g.x, g.y, g.r);
      rg.addColorStop(0, "rgba(255,255,255,0.98)");
      rg.addColorStop(0.55, "rgba(244,248,253,0.82)");
      rg.addColorStop(1, "rgba(226,234,245,0)");
      c.fillStyle = rg;
      c.beginPath();
      c.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      c.fill();
    }
    // sisi bawah teduh keabu-abuan + dasar awan yang rata
    c.globalCompositeOperation = "source-atop";
    const bayang = c.createLinearGradient(0, 70, 0, 150);
    bayang.addColorStop(0, "rgba(150,170,200,0)");
    bayang.addColorStop(1, "rgba(112,134,170,0.55)");
    c.fillStyle = bayang;
    c.fillRect(0, 0, 420, 190);
    c.globalCompositeOperation = "destination-out";
    const potong = c.createLinearGradient(0, 138, 0, 166);
    potong.addColorStop(0, "rgba(0,0,0,0)");
    potong.addColorStop(1, "rgba(0,0,0,1)");
    c.fillStyle = potong;
    c.fillRect(0, 138, 420, 52);
    c.globalCompositeOperation = "source-over";
    return cv;
  });
  return SPRITE_AWAN;
}

/** Sprite pohon (dibuat sekali): cemara bertingkat dan pohon berdaun lebat, tersinari dari kanan (arah matahari). */
let SPRITE_POHON: HTMLCanvasElement[] | null = null;
function spritePohon(): HTMLCanvasElement[] {
  if (SPRITE_POHON) return SPRITE_POHON;
  const hasil: HTMLCanvasElement[] = [];
  // cemara: 3 varian tinggi/kelangsingan
  [
    { tingkat: 4, lebar: 17, tinggi: 96 },
    { tingkat: 5, lebar: 14, tinggi: 112 },
    { tingkat: 3, lebar: 19, tinggi: 80 },
  ].forEach((v, seed) => {
    const cv = document.createElement("canvas");
    cv.width = 64;
    cv.height = 128;
    const c = cv.getContext("2d")!;
    const cx = 32;
    const dasar = 122;
    // batang
    c.fillStyle = "#4A3524";
    c.fillRect(cx - 2.5, dasar - 14, 5, 14);
    const tinggiTingkat = (v.tinggi - 12) / v.tingkat;
    for (let i = v.tingkat - 1; i >= 0; i--) {
      const yAtas = dasar - 10 - v.tinggi + 12 + i * tinggiTingkat * 0.82;
      const yBawah = yAtas + tinggiTingkat * 1.55;
      const w = v.lebar * (0.45 + (i + 1) / v.tingkat * 0.75);
      const g = c.createLinearGradient(cx - w, 0, cx + w, 0);
      g.addColorStop(0, "#23442F");
      g.addColorStop(0.55, "#356140");
      g.addColorStop(1, "#5A9560");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(cx, yAtas);
      // sisi kiri bergerigi (ranting), lalu dasar melengkung
      const x = cx - 1;
      const y = yAtas + 4;
      const langkah = 4;
      for (let k = 0; k < 4; k++) {
        c.lineTo(x - (w * (k + 1)) / 4 - hash(seed * 9 + i * 3 + k) * 2.5, y + tinggiTingkat * 0.3 * (k + 1) * 0.8);
        c.lineTo(x - (w * (k + 1)) / 4 + 2.5, y + tinggiTingkat * 0.3 * (k + 1) * 0.8 - langkah * 0.4);
      }
      c.lineTo(cx - w, yBawah);
      c.quadraticCurveTo(cx, yBawah + 4, cx + w, yBawah);
      for (let k = 3; k >= 0; k--) {
        c.lineTo(x + (w * (k + 1)) / 4 + hash(seed * 5 + i * 7 + k) * 2.5, y + tinggiTingkat * 0.3 * (k + 1) * 0.8);
        c.lineTo(x + (w * (k + 1)) / 4 - 2.5, y + tinggiTingkat * 0.3 * (k + 1) * 0.8 - langkah * 0.4);
      }
      c.closePath();
      c.fill();
      // bayangan di bawah tiap tingkat
      const bg = c.createLinearGradient(0, yBawah - tinggiTingkat * 0.5, 0, yBawah + 4);
      bg.addColorStop(0, "rgba(10,28,18,0)");
      bg.addColorStop(1, "rgba(10,28,18,0.35)");
      c.fillStyle = bg;
      c.fill();
    }
    hasil.push(cv);
  });
  // pohon berdaun lebat: gumpalan bergradasi
  [0, 1].forEach((seed) => {
    const cv = document.createElement("canvas");
    cv.width = 64;
    cv.height = 96;
    const c = cv.getContext("2d")!;
    c.fillStyle = "#4A3524";
    c.fillRect(29, 58, 6, 36);
    for (let i = 0; i < 9; i++) {
      const x = 32 + (hash(seed * 11 + i) - 0.5) * 34;
      const y = 34 + (hash(seed * 7 + i + 3) - 0.5) * 30;
      const r = 12 + hash(seed * 5 + i) * 9;
      const g = c.createRadialGradient(x + r * 0.3, y - r * 0.3, 1, x, y, r);
      g.addColorStop(0, seed ? "#8DBB5A" : "#7DB35E");
      g.addColorStop(0.6, seed ? "#4F8A3F" : "#437F4A");
      g.addColorStop(1, "#2C5A33");
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    hasil.push(cv);
  });
  SPRITE_POHON = hasil;
  return hasil;
}

/**
 * Punggung gunung berlapis. SEMUA pencuplikan memakai kisi DUNIA (kelipatan tetap), lalu digeser oleh paralaks - jadi bentuk,
 * pohon, dan salju bergulir mulus tanpa berkedip/berubah bentuk saat kamera bergerak (dulu kisi menempel di layar sehingga
 * pohon "berganti identitas" tiap bingkai). Bayangan sisi gunung = SATU poligon (punggung digeser ke kanan, tanpa jahitan/garis).
 */
function gambarLereng(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  camX: number,
  para: number,
  dasar: number,
  tinggi: number,
  warnaAtas: string,
  warnaBawah: string,
  bibit: number,
  hutan: number,
  salju: boolean,
) {
  const y = (wx: number) =>
    dasar -
    tinggi * (0.55 * Math.abs(Math.sin(wx / 420 + bibit)) + 0.3 * Math.abs(Math.sin(wx / 173 + bibit * 2.1)) + 0.15 * Math.sin(wx / 61 + bibit * 3.3) + 0.1);
  const geser = camX * para;
  const LANGKAH = 6;
  const n0 = Math.floor((geser - 40) / LANGKAH);
  const n1 = Math.ceil((geser + w + 40) / LANGKAH);
  const awal = n0 * LANGKAH - geser;
  const akhir = n1 * LANGKAH - geser;

  const jalur = (dx: number) => {
    ctx.beginPath();
    ctx.moveTo(awal + dx, h + 4);
    for (let n = n0; n <= n1; n++) ctx.lineTo(n * LANGKAH - geser + dx, y(n * LANGKAH));
    ctx.lineTo(akhir + dx, h + 4);
    ctx.closePath();
  };
  const g = ctx.createLinearGradient(0, dasar - tinggi, 0, dasar + 40);
  g.addColorStop(0, warnaAtas);
  g.addColorStop(1, warnaBawah);

  jalur(0);
  ctx.fillStyle = g;
  ctx.fill();

  // sisi membelakangi matahari: gelapkan seluruh punggung, lalu cat ulang bagian yang tertutup salinan yang digeser ke kanan
  ctx.save();
  jalur(0);
  ctx.clip();
  ctx.fillStyle = "rgba(28,44,72,0.2)";
  ctx.fillRect(0, 0, w, h);
  jalur(Math.max(10, tinggi * 0.09));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  if (salju) {
    const batas = dasar - tinggi * 0.76;
    ctx.fillStyle = "rgba(248,251,255,0.92)";
    let buka = false;
    const atas: [number, number][] = [];
    const bawah: [number, number][] = [];
    const tutup = () => {
      if (atas.length > 1) {
        ctx.beginPath();
        ctx.moveTo(atas[0][0], atas[0][1]);
        for (const p of atas) ctx.lineTo(p[0], p[1]);
        for (let i = bawah.length - 1; i >= 0; i--) ctx.lineTo(bawah[i][0], bawah[i][1]);
        ctx.closePath();
        ctx.fill();
      }
      atas.length = 0;
      bawah.length = 0;
      buka = false;
    };
    for (let n = n0; n <= n1; n++) {
      const wx = n * LANGKAH;
      const yy = y(wx);
      if (yy < batas) {
        buka = true;
        const sx = wx - geser;
        const dalam = (batas - yy) * 0.35 + 5 + hash(n) * 5;
        atas.push([sx, yy]);
        bawah.push([sx, yy + dalam]);
      } else if (buka) tutup();
    }
    if (buka) tutup();
  }

  if (hutan > 0) {
    const sp = spritePohon();
    const SP = 9;
    const m0 = Math.floor((geser - 40) / SP);
    const m1 = Math.ceil((geser + w + 40) / SP);
    for (let m = m0; m <= m1; m++) {
      const wx = m * SP + hash(m + bibit) * 5;
      // gerombolan: kerapatan naik-turun, ada celah padang
      const rapat = 0.5 + 0.5 * Math.sin(wx / 240 + bibit) * Math.sin(wx / 97 + bibit * 2);
      if (hash(m * 3.7 + bibit) > hutan * (0.35 + rapat * 0.75)) continue;
      const jenis = hash(m + bibit * 5) > 0.78 ? 3 + (m % 2) : ((m % 3) + 3) % 3;
      const skala = (0.32 + hash(m + 1.7) * 0.28) * (hutan > 0.8 ? 1.45 : 1);
      const lebar = 64 * skala;
      const tinggiP = (jenis > 2 ? 96 : 128) * skala;
      const yy = y(wx) + 4 + hash(m + 9) * 5;
      ctx.globalAlpha = hutan > 0.8 ? 1 : 0.82;
      ctx.drawImage(sp[jenis], wx - geser - lebar / 2, yy - tinggiP, lebar, tinggiP);
    }
    ctx.globalAlpha = 1;
  }
}

function langitRealistis(ctx: CanvasRenderingContext2D, w: number, h: number, camX: number, waktu: number) {
  // langit: biru pekat di atas → pucat kehangatan di cakrawala
  const langit = ctx.createLinearGradient(0, 0, 0, h * 0.78);
  langit.addColorStop(0, "#3F7DC0");
  langit.addColorStop(0.45, "#7FB1DC");
  langit.addColorStop(0.8, "#C9DDE6");
  langit.addColorStop(1, "#EDE6D2");
  ctx.fillStyle = langit;
  ctx.fillRect(0, 0, w, h);

  // matahari: cahaya menyebar (tanpa lingkaran bergaris)
  const sx = w * 0.8;
  const sy = h * 0.2;
  const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(w, h) * 0.62);
  halo.addColorStop(0, "rgba(255,252,236,1)");
  halo.addColorStop(0.035, "rgba(255,247,214,0.98)");
  halo.addColorStop(0.09, "rgba(255,231,168,0.6)");
  halo.addColorStop(0.28, "rgba(255,214,150,0.2)");
  halo.addColorStop(1, "rgba(255,214,150,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  // kilau lensa samar mengarah ke tengah layar
  ctx.globalAlpha = 0.1;
  for (let i = 1; i <= 4; i++) {
    const fx = sx + (w * 0.5 - sx) * (i * 0.33);
    const fy = sy + (h * 0.5 - sy) * (i * 0.33);
    const rg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 14 + i * 9);
    rg.addColorStop(0, "rgba(255,240,200,0.9)");
    rg.addColorStop(1, "rgba(255,240,200,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(fx, fy, 14 + i * 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // awan gumpal (sprite), melayang pelan dengan paralaks
  const sp = spriteAwan();
  for (let i = 0; i < 6; i++) {
    const skala = 0.55 + hash(i + 9) * 0.55;
    const lebar = 420 * skala;
    const para = 0.05 + hash(i + 3) * 0.05;
    const cx = ((((i * 360 + 80 - camX * para - waktu * (3 + hash(i) * 4)) % (w + lebar)) + (w + lebar)) % (w + lebar)) - lebar;
    const cy = h * (0.13 + hash(i + 17) * 0.24);
    ctx.globalAlpha = 0.92 - hash(i + 5) * 0.2;
    ctx.drawImage(sp[i % sp.length], cx, cy, lebar, 190 * skala);
  }
  ctx.globalAlpha = 1;

  // pegunungan berlapis: makin jauh makin pucat/biru (perspektif udara)
  gambarLereng(ctx, w, h, camX, 0.08, h * 0.6, h * 0.26, "#B7C8DA", "#D8DFE2", 1.3, 0, true);
  gambarLereng(ctx, w, h, camX, 0.18, h * 0.67, h * 0.21, "#8CA6BF", "#BACAD0", 4.1, 0, true);
  gambarLereng(ctx, w, h, camX, 0.32, h * 0.73, h * 0.15, "#5E7F7A", "#90A89C", 7.7, 0.7, false);
  gambarLereng(ctx, w, h, camX, 0.5, h * 0.8, h * 0.1, "#46695A", "#76916F", 11.2, 0.95, false);
  // kabut tipis di kaki bukit
  const kabut = ctx.createLinearGradient(0, h * 0.62, 0, h * 0.86);
  kabut.addColorStop(0, "rgba(236,232,214,0)");
  kabut.addColorStop(0.6, "rgba(236,232,214,0.32)");
  kabut.addColorStop(1, "rgba(236,232,214,0)");
  ctx.fillStyle = kabut;
  ctx.fillRect(0, h * 0.62, w, h * 0.24);
}

function gambarKoin(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, i: number) {
  const lebar = Math.max(0.18, Math.abs(Math.cos(t * 3.2 + i)));
  ctx.beginPath();
  ctx.ellipse(x, y, 11 * lebar, 11, 0, 0, Math.PI * 2);
  isiGaris(ctx, "#F2C14E", 3);
  if (lebar > 0.4) {
    ctx.beginPath();
    ctx.ellipse(x - 1, y, 5 * lebar, 6.5, 0, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#B8862B";
    ctx.stroke();
  }
}

function gambarKaleng(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const g = Math.sin(t * 3) * 2.5;
  ctx.save();
  ctx.translate(x, y + g);
  ctx.rotate(Math.sin(t * 2) * 0.05);
  ctx.beginPath();
  ctx.roundRect(-13, -17, 26, 32, 4);
  isiGaris(ctx, "#D9564A");
  ctx.beginPath();
  ctx.moveTo(-6, -17);
  ctx.lineTo(-6, -24);
  ctx.lineTo(7, -24);
  ctx.lineTo(7, -17);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = "#FBF1DA";
  ctx.font = "800 17px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("F", 0, 7);
  ctx.restore();
}

/**
 * Batu penghalang: siluetnya HARUS sama dengan gundukan fisika (`tanah`), jadi roda tampak menumpang di atas batu. Dilukis tanpa
 * garis tinta: dasar abu hangat bergradasi, bidang terang di sisi kiri (cahaya dari kiri-atas), bidang gelap di kanan, celah
 * lunak, bintik butiran, lumut di atas, dan kerikil lepas di kakinya.
 */
function gambarBatu(ctx: CanvasRenderingContext2D, xc: number, tinggi: number) {
  const W = RINTANGAN_SETENGAH;
  const x0 = xc - W;
  const x1 = xc + W;
  const puncak = tanah(xc);
  const dasar = tanahDasar(xc);
  const sd = Math.floor(xc);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, tanahDasar(x0) + 6);
  for (let x = x0; x <= x1; x += 3) ctx.lineTo(x, tanah(x) - 1);
  ctx.lineTo(x1, tanahDasar(x1) + 6);
  ctx.closePath();
  ctx.clip();

  const g = ctx.createLinearGradient(0, puncak, 0, dasar + 6);
  g.addColorStop(0, "#BDB7AC");
  g.addColorStop(0.55, "#948E84");
  g.addColorStop(1, "#6F6A63");
  ctx.fillStyle = g;
  ctx.fillRect(x0 - 2, puncak - 6, W * 2 + 4, tinggi + 16);

  const poli = (pts: [number, number][], warna: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = warna;
    ctx.fill();
  };
  // bidang terang (kiri-atas)
  poli([[xc - W * 0.95, dasar + 6], [xc - W * 0.6, puncak + tinggi * 0.3], [xc - W * 0.12, puncak - 2], [xc - W * 0.02, puncak + tinggi * 0.45], [xc - W * 0.4, dasar + 6]], "rgba(255,248,235,0.26)");
  // bidang gelap (kanan)
  poli([[xc + W * 0.12, puncak + tinggi * 0.22], [xc + W * 0.7, puncak + tinggi * 0.4], [xc + W * 1.05, dasar + 6], [xc + W * 0.1, dasar + 6]], "rgba(38,32,42,0.3)");
  // celah lunak antara dua bidang
  poli([[xc + W * 0.02, puncak + tinggi * 0.5], [xc + W * 0.2, puncak + tinggi * 0.85], [xc + W * 0.12, dasar + 6], [xc - W * 0.08, dasar + 6]], "rgba(30,25,35,0.22)");
  // lumut di sisi atas-kiri
  ctx.beginPath();
  ctx.ellipse(xc - W * 0.34, puncak + tinggi * 0.2, W * 0.3, tinggi * 0.2, -0.25, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(112,144,70,0.72)";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(xc - W * 0.1, puncak + tinggi * 0.12, W * 0.14, tinggi * 0.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(132,164,84,0.6)";
  ctx.fill();
  // butiran batu
  for (let i = 0; i < 16; i++) {
    const px = x0 + hash(sd + i * 3) * W * 2;
    const py = tanah(px) + 4 + hash(sd + i * 3 + 1) * (tinggi + 2);
    ctx.beginPath();
    ctx.arc(px, py, 0.8 + hash(sd + i * 3 + 2) * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? "rgba(58,52,48,0.35)" : "rgba(232,226,214,0.4)";
    ctx.fill();
  }
  ctx.restore();

  // kerikil lepas di kaki batu
  for (const [kx, kr] of [[x0 - 7, 5], [x1 + 9, 3.6]] as const) {
    const ky = tanah(kx) - kr * 0.4;
    const kg = ctx.createRadialGradient(kx - kr * 0.3, ky - kr * 0.4, 0.5, kx, ky, kr * 1.1);
    kg.addColorStop(0, "#BEB8AD");
    kg.addColorStop(1, "#7E786F");
    ctx.beginPath();
    ctx.ellipse(kx, ky, kr * 1.15, kr * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = kg;
    ctx.fill();
  }
}

/** Item nitro: tabung biru bertanda petir. */
function gambarNos(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const g = Math.sin(t * 3.4) * 3;
  ctx.save();
  ctx.translate(x, y + g);
  ctx.rotate(Math.sin(t * 2.2) * 0.06);
  ctx.beginPath();
  ctx.roundRect(-12, -18, 24, 36, 8);
  isiGaris(ctx, "#4A8FE0");
  ctx.beginPath();
  ctx.roundRect(-6, -25, 12, 8, 2);
  isiGaris(ctx, "#9AA3B0", 2.6);
  ctx.beginPath();
  ctx.moveTo(3, -12);
  ctx.lineTo(-6, 2);
  ctx.lineTo(0, 2);
  ctx.lineTo(-3, 13);
  ctx.lineTo(7, -3);
  ctx.lineTo(1, -3);
  ctx.closePath();
  ctx.fillStyle = "#FBE08A";
  ctx.fill();
  ctx.restore();
}

function gambarRoda(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // ban: lingkaran tinta + tapak bergerigi
  ctx.beginPath();
  ctx.arc(0, 0, RODA_R, 0, Math.PI * 2);
  isiGaris(ctx, INK, 3);
  ctx.fillStyle = "#4A4254";
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.fillRect(RODA_R - 4.5, -2.4, 5, 4.8);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
  isiGaris(ctx, "#F6E3C0", 2.8);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = INK;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.restore();
}

function gambarMobil(ctx: CanvasRenderingContext2D, d: Dunia, t: number, panik: boolean) {
  const c = Math.cos(d.a);
  const s = Math.sin(d.a);
  // roda + batang suspensi (di luar kerangka berputar: posisi sudah dihitung)
  const ux = -s;
  const uy = c;
  for (let i = 0; i < 2; i++) {
    const lx = i === 0 ? -ANTAR_RODA : ANTAR_RODA;
    const ax = d.x + c * lx - s * RODA_Y;
    const ay = d.y + s * lx + c * RODA_Y;
    const L = PEGAS_REHAT - d.roda[i].komp;
    const wx = ax + ux * L;
    const wy = ay + uy * L;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(wx, wy);
    ctx.lineWidth = 6;
    ctx.strokeStyle = INK;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = "#A9B3BF";
    ctx.stroke();
    gambarRoda(ctx, wx, wy, d.roda[i].rot);
  }

  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.a);

  // rangka belakang (roll bar) di belakang pengendara
  ctx.beginPath();
  ctx.moveTo(-30, -8);
  ctx.lineTo(-33, -34);
  ctx.lineTo(-12, -34);
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#A9B3BF";
  ctx.stroke();

  // tubuh robot: badan
  ctx.beginPath();
  ctx.roundRect(-9, -26, 20, 20, 5);
  isiGaris(ctx, "#F6E3C0", 3);
  ctx.beginPath();
  ctx.arc(1, -16, 3.4, 0, Math.PI * 2);
  ctx.fillStyle = "#E56B5D";
  ctx.fill();
  // lengan ke setir
  ctx.beginPath();
  ctx.moveTo(8, -20);
  ctx.lineTo(22, -17);
  ctx.lineWidth = 6.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#F6E3C0";
  ctx.stroke();

  // antena bergoyang
  const goyang = Math.sin(t * 9) * 3 + d.vy * -0.012;
  ctx.beginPath();
  ctx.moveTo(KEPALA.x, KEPALA.y - 11);
  ctx.quadraticCurveTo(KEPALA.x + goyang, KEPALA.y - 22, KEPALA.x + goyang * 1.8, KEPALA.y - 25);
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(KEPALA.x + goyang * 1.8, KEPALA.y - 26.5, 3.6, 0, Math.PI * 2);
  isiGaris(ctx, "#F2C14E", 2.4);

  // kepala
  ctx.beginPath();
  ctx.roundRect(KEPALA.x - 14, KEPALA.y - 11.5, 28, 23, 8);
  isiGaris(ctx, "#F6E3C0", 3.2);
  ctx.beginPath();
  ctx.roundRect(KEPALA.x - 10.5, KEPALA.y - 7.5, 21, 14, 5);
  ctx.fillStyle = "#1B3347";
  ctx.fill();
  // mata: biasa / panik (lebar) saat di udara atau miring
  ctx.fillStyle = "#8DD6FF";
  const ry = panik ? 4.6 : 3.2;
  ctx.beginPath();
  ctx.ellipse(KEPALA.x - 4.2, KEPALA.y - 0.5, 2.6, ry, 0, 0, Math.PI * 2);
  ctx.ellipse(KEPALA.x + 4.2, KEPALA.y - 0.5, 2.6, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  if (panik) {
    ctx.beginPath();
    ctx.ellipse(KEPALA.x, KEPALA.y + 4.4, 2.2, 2.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#8DD6FF";
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(KEPALA.x, KEPALA.y + 2.6, 3, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "#8DD6FF";
    ctx.stroke();
  }

  // badan mobil: bak rendah, kap depan miring
  ctx.beginPath();
  ctx.moveTo(-58, 10);
  ctx.lineTo(-58, -6);
  ctx.quadraticCurveTo(-58, -12, -50, -12);
  ctx.lineTo(-20, -12);
  ctx.lineTo(8, -10);
  ctx.lineTo(40, -9);
  ctx.quadraticCurveTo(58, -8, 60, 4);
  ctx.lineTo(60, 10);
  ctx.quadraticCurveTo(60, 14, 55, 14);
  ctx.lineTo(-52, 14);
  ctx.quadraticCurveTo(-58, 14, -58, 10);
  ctx.closePath();
  isiGaris(ctx, "#D9564A", 4);
  // lekuk pintu + gagang
  ctx.beginPath();
  ctx.moveTo(-26, -10);
  ctx.lineTo(-24, 11);
  ctx.moveTo(8, -9);
  ctx.lineTo(10, 11);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "#8F2F27";
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(-4, -4, 10, 3.2);
  // bemper & lampu
  ctx.beginPath();
  ctx.roundRect(54, 2, 11, 6, 3);
  isiGaris(ctx, "#A9B3BF", 2.6);
  ctx.beginPath();
  ctx.arc(52, -3, 4.6, 0, Math.PI * 2);
  isiGaris(ctx, "#FFE9A0", 2.6);
  // kaca depan
  ctx.beginPath();
  ctx.moveTo(30, -9);
  ctx.lineTo(23, -32);
  ctx.lineTo(28, -32);
  ctx.lineTo(37, -9);
  ctx.closePath();
  isiGaris(ctx, "rgba(191,231,245,0.75)", 3);
  // setir
  ctx.beginPath();
  ctx.moveTo(23, -16);
  ctx.lineTo(18, -14);
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // knalpot belakang
  ctx.beginPath();
  ctx.roundRect(-66, 5, 11, 5, 2);
  isiGaris(ctx, "#6B6575", 2.4);
  ctx.restore();
}

type Fase = "siap" | "main" | "jeda" | "selesai";
interface Hud {
  jarak: number;
  koin: number;
  bensin: number;
  fase: Fase;
  selesai: null | "jatuh" | "bensin";
  rekor: number;
  rekorBaru: boolean;
}

export default function GameTanjakan({ onKeluar, onSetor }: { onKeluar: () => void; onSetor?: (koin: number) => void }) {
  const kanvas = useRef<HTMLCanvasElement>(null);
  const dunia = useRef<Dunia>(duniaBaru());
  const kam = useRef({ x: 180, y: 380 });
  const partikel = useRef<Partikel[]>([]);
  const kendali = useRef({ gasTombol: false, remTombol: false, gasKey: false, remKey: false, loncatTombol: false, loncatKey: false, nosTombol: false, nosKey: false });
  const fase = useRef<Fase>("siap");
  const rekor = useRef(0);
  const suara = useRef<SuaraGame | null>(null);
  const ulangRef = useRef<() => void>(() => undefined);
  /** Koin run ini yang sudah dikirim ke akun (supaya tak terkirim dua kali). */
  const disetor = useRef(0);
  const setorRef = useRef<() => void>(() => undefined);
  const jedaRef = useRef<() => void>(() => undefined);

  const [hud, setHud] = useState<Hud>({ jarak: 0, koin: 0, bensin: BENSIN_AWAL, fase: "siap", selesai: null, rekor: 0, rekorBaru: false });
  const [gasOn, setGasOn] = useState(false);
  const [remOn, setRemOn] = useState(false);
  const [loncatOn, setLoncatOn] = useState(false);
  const [nosOn, setNosOn] = useState(false);
  const [nitroOn, setNitroOn] = useState(false);
  const [tangki, setTangki] = useState(0);
  const ubahMusik = useRef<() => void>(() => undefined);
  const ubahEfek = useRef<() => void>(() => undefined);
  const [peng, setPeng] = useState<PengaturanSuara>(() => bacaPengaturan());
  const [potret, setPotret] = useState(false);

  const setFase = useCallback((f: Fase) => {
    fase.current = f;
    setHud((h) => ({ ...h, fase: f }));
  }, []);

  const ulang = useCallback(() => {
    dunia.current = duniaBaru();
    disetor.current = 0;
    kam.current = { x: 180, y: 380 };
    partikel.current = [];
    setTangki(0);
    setNitroOn(false);
    setHud({ jarak: 0, koin: 0, bensin: BENSIN_AWAL, fase: "siap", selesai: null, rekor: rekor.current, rekorBaru: false });
    fase.current = "siap";
  }, []);

  useEffect(() => {
    setorRef.current = () => {
      const n = dunia.current.koin - disetor.current;
      if (n > 0) {
        disetor.current += n;
        onSetor?.(n);
      }
    };
    ulangRef.current = ulang;
    jedaRef.current = () => {
      if (fase.current === "main") setFase("jeda");
      else if (fase.current === "jeda") setFase("main");
    };
  }, [ulang, setFase, onSetor]);

  // Rekor, layar penuh & kunci orientasi (upaya terbaik; gagal = diabaikan), deteksi layar tegak.
  useEffect(() => {
    rekor.current = bacaRekor();
    setHud((h) => ({ ...h, rekor: rekor.current }));
    const el = document.documentElement;
    try {
      void el.requestFullscreen?.().catch(() => undefined);
    } catch {
      /* diabaikan */
    }
    try {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      void o.lock?.("landscape").catch(() => undefined);
    } catch {
      /* diabaikan */
    }
    const cek = () => setPotret(window.innerHeight > window.innerWidth * 1.1);
    cek();
    window.addEventListener("resize", cek);
    return () => {
      window.removeEventListener("resize", cek);
      try {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      } catch {
        /* diabaikan */
      }
      try {
        (screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock?.();
      } catch {
        /* diabaikan */
      }
    };
  }, []);

  // Papan ketik.
  useEffect(() => {
    const sasaran = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    };
    const turun = (e: KeyboardEvent) => {
      if (sasaran(e)) return;
      if (KEY_GAS.has(e.key) || KEY_REM.has(e.key) || KEY_LONCAT.has(e.key)) e.preventDefault();
      if (KEY_NOS.has(e.key)) {
        kendali.current.nosKey = true;
        setNosOn(true);
      } else if ((e.key === "m" || e.key === "M") && !e.repeat) ubahMusik.current();
      else if ((e.key === "n" || e.key === "N") && !e.repeat) ubahEfek.current();
      else if (KEY_LONCAT.has(e.key)) {
        kendali.current.loncatKey = true;
        setLoncatOn(true);
        if (fase.current === "siap") setFase("main");
      } else if (KEY_GAS.has(e.key)) kendali.current.gasKey = true;
      else if (KEY_REM.has(e.key)) kendali.current.remKey = true;
      else if ((e.key === "r" || e.key === "R") && !e.repeat) ulangRef.current();
      else if ((e.key === "Escape" || e.key === "p" || e.key === "P") && !e.repeat) jedaRef.current();
      if ((KEY_GAS.has(e.key) || KEY_REM.has(e.key)) && fase.current === "siap") setFase("main");
      setGasOn(kendali.current.gasKey || kendali.current.gasTombol);
      setRemOn(kendali.current.remKey || kendali.current.remTombol);
    };
    const naik = (e: KeyboardEvent) => {
      if (KEY_NOS.has(e.key)) {
        kendali.current.nosKey = false;
        setNosOn(kendali.current.nosTombol);
      } else if (KEY_LONCAT.has(e.key)) {
        kendali.current.loncatKey = false;
        setLoncatOn(kendali.current.loncatTombol);
      } else if (KEY_GAS.has(e.key)) kendali.current.gasKey = false;
      else if (KEY_REM.has(e.key)) kendali.current.remKey = false;
      setGasOn(kendali.current.gasKey || kendali.current.gasTombol);
      setRemOn(kendali.current.remKey || kendali.current.remTombol);
    };
    const lepasSemua = () => {
      kendali.current = { gasTombol: false, remTombol: false, gasKey: false, remKey: false, loncatTombol: false, loncatKey: false, nosTombol: false, nosKey: false };
      setLoncatOn(false);
      setNosOn(false);
      setGasOn(false);
      setRemOn(false);
      if (fase.current === "main") setFase("jeda");
    };
    window.addEventListener("keydown", turun);
    window.addEventListener("keyup", naik);
    window.addEventListener("blur", lepasSemua);
    return () => {
      window.removeEventListener("keydown", turun);
      window.removeEventListener("keyup", naik);
      window.removeEventListener("blur", lepasSemua);
    };
  }, [setFase]);

  // Suara (efek + musik) dibuat dengan WebAudio; pilihan hidup/mati disimpan di perangkat dan dipakai bersama Bola Gabung.
  const pasangMusik = useCallback((b: boolean) => {
    suara.current?.setMusik(b);
    setPeng((p) => {
      const n = { ...p, musik: b };
      simpanPengaturan(n);
      return n;
    });
  }, []);
  const pasangEfek = useCallback((b: boolean) => {
    suara.current?.setEfek(b);
    setPeng((p) => {
      const n = { ...p, efek: b };
      simpanPengaturan(n);
      return n;
    });
  }, []);
  useEffect(() => {
    ubahMusik.current = () => pasangMusik(!(suara.current?.pengaturan.musik ?? true));
    ubahEfek.current = () => pasangEfek(!(suara.current?.pengaturan.efek ?? true));
  }, [pasangMusik, pasangEfek]);
  useEffect(() => {
    suara.current = new SuaraGame("tanjakan", bacaPengaturan());
    const buka = () => suara.current?.buka();
    window.addEventListener("pointerdown", buka);
    window.addEventListener("keydown", buka);
    return () => {
      window.removeEventListener("pointerdown", buka);
      window.removeEventListener("keydown", buka);
      suara.current?.tutup();
      suara.current = null;
    };
  }, []);

  // Putaran utama: fisika langkah tetap + gambar.
  useEffect(() => {
    const cv = kanvas.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let id = 0;
    let akum = 0;
    let terakhir = performance.now();
    let hudT = 0;
    let waktu = 0;
    let koinSebelum = 0;
    let bensinSebelum = BENSIN_AWAL;
    let nosSebelum = 0;
    let jedaSebelum = 0;
    let udaraSebelum = 0;
    let vySebelum = 0;
    let selesaiBunyi = false;
    const hemat = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ukur = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.floor(cv.clientWidth * dpr);
      cv.height = Math.floor(cv.clientHeight * dpr);
    };
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(cv);

    const bingkai = (now: number) => {
      id = requestAnimationFrame(bingkai);
      const dt = Math.min(0.05, (now - terakhir) / 1000);
      terakhir = now;
      const d = dunia.current;
      const k = kendali.current;
      const gas = k.gasKey || k.gasTombol;
      const rem = k.remKey || k.remTombol;
      const loncat = k.loncatKey || k.loncatTombol;
      const nos = k.nosKey || k.nosTombol;

      if (!d.selesai) selesaiBunyi = false;
      if (fase.current === "main" && !d.selesai) {
        akum += dt;
        let n = 0;
        while (akum >= DT && n < 8) {
          langkah(d, { gas, rem, loncat, nos }, DT);
          akum -= DT;
          n++;
          if (d.selesai) break;
        }
        if (n >= 8) akum = 0;
        waktu += dt;
        // debu dari roda yang menapak saat gas, asap knalpot
        if (!hemat && gas && d.bensin > 0 && Math.random() < 0.55) {
          const c = Math.cos(d.a);
          const s = Math.sin(d.a);
          partikel.current.push({ x: d.x + c * -68 - s * 8, y: d.y + s * -68 + c * 8, vx: -40 - Math.random() * 40 - d.vx * 0.05, vy: -20 - Math.random() * 25, umur: 0, maks: 0.7, r: 4 + Math.random() * 3, warna: "#CFC7BB" });
        }
        // api nitro dari knalpot
        if (!hemat && d.nosAktif) {
          const c = Math.cos(d.a);
          const s = Math.sin(d.a);
          for (let n = 0; n < 2; n++) {
            partikel.current.push({ x: d.x + c * -70 - s * 7, y: d.y + s * -70 + c * 7, vx: -160 - Math.random() * 120 - d.vx * 0.1, vy: (Math.random() - 0.5) * 40, umur: 0, maks: 0.28, r: 4 + Math.random() * 4, warna: Math.random() < 0.5 ? "#FFB23E" : "#FF6B3D" });
          }
        }
        for (let i = 0; i < 2; i++) {
          const r = d.roda[i];
          if (!hemat && r.kontak && Math.abs(d.vx) > 120 && Math.random() < 0.25) {
            const c = Math.cos(d.a);
            const s = Math.sin(d.a);
            const lx = i === 0 ? -ANTAR_RODA : ANTAR_RODA;
            partikel.current.push({ x: d.x + c * lx - s * (RODA_Y + 38), y: d.y + s * lx + c * (RODA_Y + 38), vx: -d.vx * 0.12 + (Math.random() - 0.5) * 50, vy: -30 - Math.random() * 50, umur: 0, maks: 0.6, r: 3 + Math.random() * 3, warna: "#B89466" });
          }
        }
        if (d.koin > koinSebelum) {
          koinSebelum = d.koin;
          suara.current?.koin();
        }
        if (d.bensin > bensinSebelum + 8) suara.current?.bensin();
        bensinSebelum = d.bensin;
        if (d.nosAmbil.size > nosSebelum) suara.current?.ambilNitro();
        nosSebelum = d.nosAmbil.size;
        if (d.jedaLoncat > jedaSebelum + 0.3) suara.current?.loncat();
        jedaSebelum = d.jedaLoncat;
        // mendarat: roda menyentuh tanah lagi setelah sebentar di udara
        const menapak = d.roda[0].kontak || d.roda[1].kontak;
        if (menapak && udaraSebelum > 0.25) suara.current?.mendarat(Math.abs(vySebelum));
        udaraSebelum = menapak ? 0 : udaraSebelum + dt;
        vySebelum = d.vy;
        if (d.selesai) {
          const baru = d.jarak > rekor.current;
          if (baru) {
            rekor.current = d.jarak;
            try {
              localStorage.setItem(KUNCI_REKOR, String(d.jarak));
            } catch {
              /* diabaikan */
            }
          }
          fase.current = "selesai";
          if (!selesaiBunyi) {
            selesaiBunyi = true;
            if (d.selesai === "jatuh") suara.current?.tabrak();
            else suara.current?.habisBensin();
          }
          setorRef.current();
          setHud({ jarak: d.jarak, koin: d.koin, bensin: d.bensin, fase: "selesai", selesai: d.selesai, rekor: rekor.current, rekorBaru: baru });
        }
      }

      // suara mesin, desis nitro, dan musik mengikuti jalannya permainan
      const berjalan = fase.current === "main";
      suara.current?.mesin(Math.hypot(d.vx, d.vy), gas, berjalan);
      suara.current?.nitro(berjalan && d.nosAktif);
      suara.current?.atur(berjalan);

      // partikel
      for (const p of partikel.current) {
        p.umur += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy -= 30 * dt;
      }
      partikel.current = partikel.current.filter((p) => p.umur < p.maks);

      // HUD ±10x/dtk
      hudT += dt;
      if (hudT > 0.1 && fase.current === "main") {
        hudT = 0;
        setNitroOn(d.nosAktif);
        setTangki(Math.round(d.nosTangki));
        setHud((h) => (h.jarak === d.jarak && h.koin === d.koin && Math.round(h.bensin) === Math.round(d.bensin) ? h : { ...h, jarak: d.jarak, koin: d.koin, bensin: d.bensin }));
      }

      // ── gambar ──
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (!w || !h) return;
      const dpr = cv.width / w;
      const skala = Math.max(0.5, Math.min(1.5, h / 560));
      // kamera: mendahului arah gerak, y mengikuti halus
      // posisi kendaraan diekstrapolasi sebesar sisa waktu langkah fisika (akum) supaya gambar & kamera mulus walau langkah 120 Hz tak sejajar bingkai
      const dv = { ...d, x: d.x + d.vx * akum, y: d.y + d.vy * akum, a: d.a + d.w * akum };
      const sasaranX = dv.x + Math.max(-60, Math.min(260, d.vx * 0.32)) + 60;
      kam.current.x += (sasaranX - kam.current.x) * Math.min(1, dt * 5);
      kam.current.y += (dv.y - 20 - kam.current.y) * Math.min(1, dt * 3.2);
      const camX = kam.current.x;
      const camY = kam.current.y;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      langitRealistis(ctx, w, h, camX, now / 1000);

      // dunia
      ctx.setTransform(dpr * skala, 0, 0, dpr * skala, dpr * (w * 0.36 - camX * skala), dpr * (h * 0.56 - camY * skala));
      const xMin = camX - (w * 0.36) / skala - 30;
      const xMax = camX + (w * 0.64) / skala + 30;
      const yBawah = camY + (h * 0.44) / skala + 40;

      // tanah: lapisan tanah bergradasi, kerikil berbayang, tepi rumput tak beraturan (tanpa garis tinta)
      const tepi = (x: number) => tanah(x);
      ctx.beginPath();
      ctx.moveTo(xMin, yBawah);
      for (let x = Math.floor(xMin / 8) * 8; x <= xMax; x += 8) ctx.lineTo(x, tepi(x));
      ctx.lineTo(xMax, yBawah);
      ctx.closePath();
      const tanahG = ctx.createLinearGradient(0, camY - 120, 0, yBawah);
      tanahG.addColorStop(0, "#8C6040");
      tanahG.addColorStop(0.4, "#6E4A30");
      tanahG.addColorStop(1, "#46301F");
      ctx.fillStyle = tanahG;
      ctx.fill();
      // lapisan/guratan tanah mengikuti bentuk permukaan
      ctx.lineCap = "round";
      for (let lap = 1; lap <= 4; lap++) {
        ctx.beginPath();
        for (let x = Math.floor(xMin / 16) * 16; x <= xMax; x += 16) {
          const y = tepi(x) + lap * 34 + 6 * Math.sin(x / 70 + lap * 2);
          if (x === Math.floor(xMin / 16) * 16) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(40,26,16,${0.1 + lap * 0.035})`;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
      // kerikil & akar kecil (deterministik) dengan sisi terang dan bayangan
      for (let x = Math.floor(xMin / 56) * 56; x <= xMax; x += 56) {
        const n = Math.floor(x / 56);
        for (let j = 0; j < 3; j++) {
          const px = x + hash(n * 3 + j) * 54;
          const py = tepi(px) + 24 + hash(n * 7 + j) * 80;
          const rx = 3 + hash(n + j) * 5;
          const ry = 2 + hash(n + j + 2) * 3;
          ctx.beginPath();
          ctx.ellipse(px + 1.2, py + 1.4, rx, ry, hash(n) * 3, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(30,20,12,0.35)";
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(px, py, rx, ry, hash(n) * 3, 0, Math.PI * 2);
          ctx.fillStyle = j % 2 ? "#8A7A68" : "#B49A7C";
          ctx.fill();
        }
      }
      // pita rumput: bergradasi, tepi bawah bergerigi
      ctx.beginPath();
      for (let x = Math.floor(xMin / 6) * 6; x <= xMax; x += 6) {
        if (x === Math.floor(xMin / 6) * 6) ctx.moveTo(x, tepi(x));
        else ctx.lineTo(x, tepi(x));
      }
      for (let x = Math.floor(xMax / 6) * 6; x >= xMin; x -= 6) ctx.lineTo(x, tepi(x) + 11 + 5 * hash(Math.floor(x / 6)) + 2 * Math.sin(x / 9));
      ctx.closePath();
      const rumputG = ctx.createLinearGradient(0, camY - 140, 0, yBawah);
      rumputG.addColorStop(0, "#86B552");
      rumputG.addColorStop(1, "#4F7C30");
      ctx.fillStyle = rumputG;
      ctx.fill();
      // sorot tipis di tepi atas + bayangan jatuh di bawah rumput
      ctx.beginPath();
      for (let x = Math.floor(xMin / 6) * 6; x <= xMax; x += 6) {
        if (x === Math.floor(xMin / 6) * 6) ctx.moveTo(x, tepi(x) - 0.5);
        else ctx.lineTo(x, tepi(x) - 0.5);
      }
      ctx.strokeStyle = "rgba(220,240,170,0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
      // helai rumput: panjang, kemiringan, dan hijau beragam
      for (let x = Math.floor(xMin / 9) * 9; x <= xMax; x += 9) {
        const n = Math.floor(x / 9);
        const gx = x + hash(n) * 8;
        const gy = tepi(gx);
        const tinggi = 4 + hash(n + 5) * 9;
        const miring = (hash(n + 11) - 0.5) * 6 + landai(gx) * -2;
        ctx.beginPath();
        ctx.moveTo(gx, gy + 1);
        ctx.quadraticCurveTo(gx + miring * 0.3, gy - tinggi * 0.6, gx + miring, gy - tinggi);
        ctx.strokeStyle = hash(n + 2) > 0.5 ? "#6FA23F" : "#8DBB55";
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      // bunga liar kecil sesekali
      for (let x = Math.floor(xMin / 140) * 140; x <= xMax; x += 140) {
        const n = Math.floor(x / 140);
        const fx = x + hash(n + 70) * 120;
        ctx.beginPath();
        ctx.arc(fx, tepi(fx) - 4, 2.1, 0, Math.PI * 2);
        ctx.fillStyle = ["#F4E27A", "#F1F1F1", "#E8A0B4"][n % 3];
        ctx.fill();
      }

      // batu penghalang (bentuk tanahnya sudah ada di fisika; di sini hanya diberi rupa batu)
      for (let k = Math.max(0, Math.floor((xMin - RINTANGAN_MULAI - RINTANGAN_SETENGAH - 340) / RINTANGAN_JARAK)); k <= Math.ceil((xMax - RINTANGAN_MULAI) / RINTANGAN_JARAK); k++) {
        const r = rintanganDi(k);
        if (r.tinggi > 0 && r.x > xMin - RINTANGAN_SETENGAH && r.x < xMax + RINTANGAN_SETENGAH) gambarBatu(ctx, r.x, r.tinggi);
      }
      // item nitro
      for (let j = Math.max(0, Math.floor((xMin - 2400 - 700) / 2500)); j <= Math.max(0, Math.ceil((xMax - 2400) / 2500)); j++) {
        if (d.nosAmbil.has(j)) continue;
        const n = nosDi(j);
        if (n.x < xMin || n.x > xMax) continue;
        gambarNos(ctx, n.x, n.y, now / 1000);
      }

      // koin & kaleng
      const g0 = Math.max(0, Math.floor((xMin - 760 - 300) / 900));
      const g1 = Math.max(0, Math.ceil((xMax - 760) / 900));
      for (let i = g0 * 5; i < (g1 + 1) * 5; i++) {
        if (d.koinAmbil.has(i)) continue;
        const kp = koinDi(i);
        if (kp.x < xMin || kp.x > xMax) continue;
        gambarKoin(ctx, kp.x, kp.y, waktu + now / 1000, i);
      }
      for (let j = Math.max(0, Math.floor((xMin - 1500 - 500) / 1900)); j <= Math.max(0, Math.ceil((xMax - 1500) / 1900)); j++) {
        if (d.bensinAmbil.has(j)) continue;
        const b = bensinDi(j);
        if (b.x < xMin || b.x > xMax) continue;
        gambarKaleng(ctx, b.x, b.y, now / 1000);
      }

      // partikel di belakang mobil
      for (const p of partikel.current) {
        const a = 1 - p.umur / p.maks;
        ctx.globalAlpha = Math.max(0, a) * 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + (1 - a) * 0.8), 0, Math.PI * 2);
        ctx.fillStyle = p.warna;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const panik = !d.roda[0].kontak && !d.roda[1].kontak ? true : Math.abs(d.a) > 0.7;
      gambarMobil(ctx, dv, now / 1000, panik);
    };
    id = requestAnimationFrame(bingkai);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
    };
  }, []);

  /** Pedal sentuh/mouse: tahan = aktif; lepas / keluar / batal = mati. */
  function tekanPedal(jenis: "gas" | "rem", e: React.PointerEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (jenis === "gas") kendali.current.gasTombol = true;
    else kendali.current.remTombol = true;
    if (fase.current === "siap") setFase("main");
    if (jenis === "gas") setGasOn(true);
    else setRemOn(true);
  }
  function tekanLoncat(e: React.PointerEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    kendali.current.loncatTombol = true;
    if (fase.current === "siap") setFase("main");
    setLoncatOn(true);
  }
  function lepasLoncat() {
    kendali.current.loncatTombol = false;
    setLoncatOn(kendali.current.loncatKey);
  }
  function tekanNos(e: React.PointerEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    kendali.current.nosTombol = true;
    if (fase.current === "siap") setFase("main");
    setNosOn(true);
  }
  function lepasNos() {
    kendali.current.nosTombol = false;
    setNosOn(kendali.current.nosKey);
  }
  function lepasPedal(jenis: "gas" | "rem") {
    if (jenis === "gas") kendali.current.gasTombol = false;
    else kendali.current.remTombol = false;
    setGasOn(kendali.current.gasKey || kendali.current.gasTombol);
    setRemOn(kendali.current.remKey || kendali.current.remTombol);
  }

  /** Keluar: koin yang belum dikirim disetor dulu. */
  function keluar() {
    setorRef.current();
    onKeluar();
  }

  const persenBensin = Math.max(0, Math.min(100, (hud.bensin / BENSIN_AWAL) * 100));
  const STIKER = "border-[2.5px] border-[#2B2233] shadow-[3px_3px_0_#2B2233]";
  const TOMBOL = cn(
    "rounded-lg border-[2.5px] border-[#2B2233] bg-[#F6E3C0] px-3 py-1.5 text-sm font-extrabold text-[#2B2233] shadow-[2px_2px_0_#2B2233]",
    "transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  );

  return (
    <div className="keep-white fixed inset-0 z-[80] select-none overflow-hidden bg-[#7EC8E3] text-[#2B2233]" style={{ touchAction: "none" }}>
      <canvas ref={kanvas} className="absolute inset-0 h-full w-full" aria-label="Game Tanjakan Robo" role="img" />

      {/* HUD atas */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-3 sm:p-4 kecil:p-1.5">
        <div className={cn("pointer-events-auto -rotate-1 rounded-xl bg-[#FBF1DA] px-3.5 py-2 kecil:rounded-lg kecil:px-2 kecil:py-1", STIKER)}>
          <p className="text-[10px] kecil:text-[8px] font-extrabold uppercase tracking-[0.2em] text-[#2B2233]/60">Jarak</p>
          <p className="text-3xl font-extrabold leading-none tabular-nums kecil:text-xl">
            {hud.jarak}
            <span className="ml-1 text-base kecil:text-xs">m</span>
          </p>
          <p className="mt-1 text-[11px] kecil:mt-0.5 kecil:text-[9px] font-bold text-[#2B2233]/65">Rekor {Math.max(hud.rekor, hud.jarak)} m</p>
        </div>

        <div className="pointer-events-auto flex flex-col items-center gap-2 kecil:gap-1">
          <div className={cn("flex items-center gap-2 rounded-xl bg-[#FBF1DA] px-3 py-1.5 kecil:gap-1 kecil:rounded-lg kecil:px-2 kecil:py-0.5", STIKER)} aria-label={`Koin ${hud.koin}`}>
            <svg viewBox="0 0 24 24" className="h-6 w-6 kecil:h-4 kecil:w-4" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="#F2C14E" stroke={INK} strokeWidth="2.4" />
              <circle cx="11" cy="12" r="4.4" fill="none" stroke="#B8862B" strokeWidth="1.8" />
            </svg>
            <span className="text-xl font-extrabold tabular-nums kecil:text-sm">{hud.koin}</span>
          </div>
          <div className={cn("flex w-44 items-center gap-2 rounded-xl bg-[#FBF1DA] px-2.5 py-1.5 sm:w-56 kecil:w-28 kecil:gap-1 kecil:rounded-lg kecil:px-1.5 kecil:py-0.5", STIKER)}>
            <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 kecil:h-4 kecil:w-4" aria-hidden="true">
              <rect x="4" y="6" width="13" height="15" rx="2.4" fill="#D9564A" stroke={INK} strokeWidth="2.2" />
              <path d="M17 10l3 2v6" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
              <path d="M7 6V3h6v3" fill="none" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
            </svg>
            <div className="h-4 flex-1 overflow-hidden rounded-md kecil:h-2.5 border-2 border-[#2B2233] bg-[#FBF1DA]" role="progressbar" aria-label="Bensin" aria-valuenow={Math.round(persenBensin)} aria-valuemin={0} aria-valuemax={100}>
              <div className={cn("h-full border-r-2 border-[#2B2233] transition-[width] duration-150", persenBensin < 25 ? "bg-[#E0833B]" : "bg-[#6BA7D8]")} style={{ width: `${Math.max(3, persenBensin)}%` }} />
            </div>
          </div>
          {tangki > 0 && (
            <div className={cn("flex w-44 items-center gap-2 rounded-xl bg-[#FBF1DA] px-2.5 py-1 sm:w-56 kecil:w-28 kecil:gap-1 kecil:rounded-lg kecil:px-1.5 kecil:py-0.5", STIKER)} aria-label={`Tangki nitro ${tangki}%`}>
              <span className={cn("text-[11px] font-extrabold tracking-wider kecil:text-[8px]", nitroOn && "animate-pulse text-[#2A6FC4]")}>NOS</span>
              <div className="h-3 flex-1 overflow-hidden rounded-md border-2 border-[#2B2233] bg-[#FBF1DA] kecil:h-2" role="progressbar" aria-label="Tangki nitro" aria-valuenow={tangki} aria-valuemin={0} aria-valuemax={NOS_TANGKI_MAKS}>
                <div className="h-full border-r-2 border-[#2B2233] bg-[#4A8FE0] transition-[width] duration-100" style={{ width: `${Math.max(3, (tangki / NOS_TANGKI_MAKS) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex flex-col gap-2 kecil:gap-1">
          <button type="button" onClick={keluar} aria-label="Keluar dari game" className={cn(TOMBOL, "flex h-11 w-11 items-center justify-center p-0 pointer-fine:hidden kecil:h-8 kecil:w-8 kecil:px-0 kecil:py-0")}>
            <svg viewBox="0 0 16 16" className="h-6 w-6 kecil:h-4 kecil:w-4" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
            </svg>
          </button>
          <button type="button" onClick={() => jedaRef.current()} aria-label="Jeda" className={cn(TOMBOL, "flex h-11 w-11 items-center justify-center p-0 pointer-fine:hidden kecil:h-8 kecil:w-8 kecil:px-0 kecil:py-0")}>
            <svg viewBox="0 0 16 16" className="h-5 w-5 kecil:h-3.5 kecil:w-3.5" fill="currentColor" aria-hidden="true">
              <rect x="3" y="2.5" width="3.4" height="11" rx="1" />
              <rect x="9.6" y="2.5" width="3.4" height="11" rx="1" />
            </svg>
          </button>
          <PanelSuara
            peng={peng}
            onMusik={pasangMusik}
            onEfek={pasangEfek}
            tombolClass={cn(TOMBOL, "flex h-11 w-11 items-center justify-center p-0 kecil:h-8 kecil:w-8 kecil:px-0 kecil:py-0")}
          />
        </div>
      </div>

      {/* Pedal: kiri = rem/mundur, kanan = gas. Multi-sentuh (dua elemen terpisah). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3 sm:p-6 kecil:p-2">
        <div className="pointer-events-none flex flex-col items-start gap-2 pointer-fine:invisible kecil:gap-1.5">
          <button
            type="button"
            aria-label="Loncat"
            onPointerDown={tekanLoncat}
            onPointerUp={lepasLoncat}
            onPointerCancel={lepasLoncat}
            onContextMenu={(e) => e.preventDefault()}
            className={cn(
              "pointer-events-auto flex h-16 w-32 touch-none items-center justify-center gap-2 rounded-2xl text-base font-extrabold transition-[transform,box-shadow,background-color] duration-100 sm:h-20 sm:w-40 kecil:h-11 kecil:w-24 kecil:gap-1 kecil:rounded-xl kecil:text-xs",
              STIKER,
              loncatOn ? "translate-x-[3px] translate-y-[3px] bg-[#F2C14E] shadow-none" : "bg-[#FBF1DA]",
            )}
          >
            <svg viewBox="0 0 32 24" className="h-6 w-8 kecil:h-4 kecil:w-5" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="26" height="18" rx="5" fill="#F2C14E" />
              <path d="M16 17V8M11.500 12L16 7.500l4.500 4.500" />
            </svg>
            LONCAT
          </button>
        <button
          type="button"
          aria-label="Rem dan mundur"
          onPointerDown={(e) => tekanPedal("rem", e)}
          onPointerUp={() => lepasPedal("rem")}
          onPointerCancel={() => lepasPedal("rem")}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "pointer-events-auto flex h-24 w-32 touch-none flex-col items-center justify-center gap-1 rounded-2xl text-lg font-extrabold kecil:h-14 kecil:w-20 kecil:gap-0 kecil:rounded-xl kecil:text-xs transition-[transform,box-shadow,background-color] duration-100 sm:h-28 sm:w-40",
            STIKER,
            remOn ? "translate-x-[3px] translate-y-[3px] bg-[#E0833B] shadow-none" : "bg-[#FBF1DA]",
          )}
        >
          <svg viewBox="0 0 32 24" className="h-8 w-10 kecil:h-5 kecil:w-7" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="26" height="18" rx="5" fill="#D9564A" />
            <path d="M20 12H10M13.500 8L9.500 12l4 4" />
          </svg>
          REM
        </button>
        </div>
        <p className="mb-2 hidden rounded-lg bg-[#FBF1DA]/90 px-3 py-1 text-xs font-bold pointer-fine:block">← / A rem · → / D gas · Spasi loncat · Shift nitro · M musik · N efek · R ulang · Esc jeda</p>
        <div className="pointer-events-none flex flex-col items-end gap-2 pointer-fine:invisible kecil:gap-1.5">
          <button
            type="button"
            aria-label="Nitro"
            onPointerDown={tekanNos}
            onPointerUp={lepasNos}
            onPointerCancel={lepasNos}
            onContextMenu={(e) => e.preventDefault()}
            style={{ backgroundImage: `linear-gradient(to top, #4A8FE0 ${Math.round((tangki / NOS_TANGKI_MAKS) * 100)}%, #FBF1DA ${Math.round((tangki / NOS_TANGKI_MAKS) * 100)}%)` }}
            className={cn(
              "pointer-events-auto flex h-16 w-36 touch-none items-center justify-center gap-2 rounded-2xl text-base font-extrabold transition-[transform,box-shadow] duration-100 sm:h-20 sm:w-44 kecil:h-11 kecil:w-24 kecil:gap-1 kecil:rounded-xl kecil:text-xs",
              STIKER,
              nosOn && tangki > 0 && "translate-x-[3px] translate-y-[3px] shadow-none",
              tangki === 0 && "opacity-70",
            )}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 kecil:h-4 kecil:w-4" fill="#FBE08A" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
              <path d="M13 2L5 13h6l-1 9 9-12h-6z" />
            </svg>
            NOS
          </button>
        <button
          type="button"
          aria-label="Gas"
          onPointerDown={(e) => tekanPedal("gas", e)}
          onPointerUp={() => lepasPedal("gas")}
          onPointerCancel={() => lepasPedal("gas")}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "pointer-events-auto flex h-28 w-36 touch-none flex-col items-center justify-center gap-1 rounded-2xl text-lg font-extrabold kecil:h-16 kecil:w-24 kecil:gap-0 kecil:rounded-xl kecil:text-xs transition-[transform,box-shadow,background-color] duration-100 sm:h-32 sm:w-44",
            STIKER,
            gasOn ? "translate-x-[3px] translate-y-[3px] bg-[#6BA7D8] shadow-none" : "bg-[#FBF1DA]",
          )}
        >
          <svg viewBox="0 0 32 24" className="h-8 w-10 kecil:h-5 kecil:w-7" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="26" height="18" rx="5" fill="#7FB069" />
            <path d="M10 12h10M17 8l4 4-4 4" />
          </svg>
          GAS
        </button>
        </div>
      </div>

      {/* Layar tegak di ponsel: saran memutar */}
      {potret && hud.fase !== "selesai" && (
        <p className={cn("pointer-events-none absolute inset-x-6 top-[96px] mx-auto max-w-xs rounded-xl bg-[#FFF8E6] px-3 py-2 text-center text-xs font-bold kecil:top-[70px] kecil:max-w-[220px] kecil:px-2 kecil:py-1 kecil:text-[10px]", STIKER)}>Putar ponsel ke samping supaya jalannya lebih luas.</p>
      )}

      {/* Siap */}
      {hud.fase === "siap" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className={cn("max-w-sm rotate-1 rounded-2xl bg-[#FBF1DA] p-5 text-center kecil:max-w-[300px] kecil:rounded-xl kecil:p-3", STIKER)}>
            <h2 className="text-2xl font-extrabold kecil:text-lg">Tanjakan Robo</h2>
            <p className="mt-2 text-sm kecil:mt-1 kecil:text-[11px] font-semibold leading-relaxed text-[#2B2233]/80">
              Tahan <strong>GAS</strong> untuk menanjak, <strong>REM</strong> untuk menahan atau mundur. Di udara, gas mengangkat hidung dan rem menurunkannya. Tekan <strong>LONCAT</strong> (spasi di desktop) untuk melompati batu. Ambil koin, kaleng bensin, dan tabung <strong>nitro</strong> (biru) untuk mengisi tangki NOS, lalu tahan <strong>NOS</strong> (Shift di desktop) untuk melesat; jangan sampai kepala robot menyentuh tanah!
            </p>
            <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.2em] text-[#2B2233]/60 kecil:mt-1.5 kecil:text-[10px]">Tekan gas untuk mulai</p>
          </div>
        </div>
      )}

      {/* Jeda */}
      {hud.fase === "jeda" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#2B2233]/35 p-6 kecil:p-3">
          <div className={cn("w-full max-w-xs rounded-2xl bg-[#FBF1DA] p-5 text-center kecil:max-w-[240px] kecil:rounded-xl kecil:p-3", STIKER)}>
            <h2 className="text-2xl font-extrabold kecil:text-lg">Jeda</h2>
            <div className="mt-4 flex flex-col gap-2 kecil:mt-2 kecil:gap-1.5">
              <button type="button" onClick={() => setFase("main")} className={cn(TOMBOL, "bg-[#6BA7D8] py-2.5 text-base kecil:py-1.5 kecil:text-sm")}>
                Lanjut
              </button>
              <button type="button" onClick={() => ulang()} className={cn(TOMBOL, "py-2.5 text-base kecil:py-1.5 kecil:text-sm")}>
                Ulang dari awal
              </button>
              <button type="button" onClick={keluar} className={cn(TOMBOL, "py-2.5 text-base kecil:py-1.5 kecil:text-sm")}>
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selesai */}
      {hud.fase === "selesai" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#2B2233]/40 p-6 kecil:p-3">
          <div className={cn("w-full max-w-xs -rotate-1 rounded-2xl bg-[#FBF1DA] p-5 text-center kecil:max-w-[260px] kecil:rounded-xl kecil:p-3", STIKER)}>
            <h2 className="text-2xl font-extrabold kecil:text-base">{hud.selesai === "bensin" ? "Bensin habis!" : "Aduh, kepala robot terbentur!"}</h2>
            <p className="mt-3 text-4xl font-extrabold tabular-nums kecil:mt-1 kecil:text-2xl">
              {hud.jarak}
              <span className="ml-1 text-lg">m</span>
            </p>
            <p className="mt-1 text-sm font-bold text-[#2B2233]/70">{hud.koin} koin terkumpul</p>
            {onSetor && hud.koin > 0 && <p className="mt-2 text-xs font-bold text-[#2B2233]/70">Koin masuk ke akunmu. Tukar 100 koin = 1 bintang di menu Toko.</p>}
            {hud.rekorBaru ? <p className="mt-2 text-sm font-extrabold text-[#2F6F4A]">Rekor baru!</p> : <p className="mt-2 text-xs font-bold text-[#2B2233]/60">Rekor {hud.rekor} m</p>}
            <div className="mt-4 flex flex-col gap-2 kecil:mt-2 kecil:gap-1.5">
              <button type="button" onClick={() => ulang()} className={cn(TOMBOL, "bg-[#6BA7D8] py-2.5 text-base kecil:py-1.5 kecil:text-sm")}>
                Main lagi
              </button>
              <button type="button" onClick={keluar} className={cn(TOMBOL, "py-2.5 text-base kecil:py-1.5 kecil:text-sm")}>
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
