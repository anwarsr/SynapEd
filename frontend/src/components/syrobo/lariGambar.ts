/**
 * Gambar game "Lari Robo": kota di senja, jalan beraspal, rintangan, koin, dan robot pelari - dilukis tangan di kanvas 2D (bukan
 * ikon datar): langit bergradasi, cakrawala kota berlapis dengan kabut udara dan jendela menyala, satu sumber cahaya hangat dari
 * matahari rendah (tepi terang di sisi menghadap matahari, bayangan di sisi lain), garis tinta tipis hanya pada tokoh & rintangan.
 * Dipakai `GameLari` dan ikon kartu game (`IkonGame`). Hanya menggambar: fisika ada di lariFisika.ts.
 */
import { BERDIRI, H, TANAH, TUNDUK, type DuniaLari, type Rintangan } from "@/lib/syrobo/game/lariFisika";

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const INK = "#241B33";

function hash(i: number, s = 0): number {
  const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return v - Math.floor(v);
}
function tinta(ctx: Ctx, lw = 2.4) {
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
}
function kapsul(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ───────────────────────── latar ─────────────────────────
function cakrawala(ctx: Ctx, vw: number, jarak: number, faktor: number, dasar: number, tinggiMaks: number, warnaAtas: string, warnaBawah: string, lebarSel: number, seed: number, jendela: boolean, waktu: number) {
  const geser = jarak * faktor;
  const awal = Math.floor(geser / lebarSel) - 1;
  const akhir = awal + Math.ceil(vw / lebarSel) + 3;
  const g = ctx.createLinearGradient(0, dasar - tinggiMaks, 0, dasar);
  g.addColorStop(0, warnaAtas);
  g.addColorStop(1, warnaBawah);
  ctx.fillStyle = g;
  for (let i = awal; i <= akhir; i++) {
    const r1 = hash(i, seed);
    const r2 = hash(i, seed + 7);
    const w = lebarSel * (0.62 + r1 * 0.36);
    const h = tinggiMaks * (0.28 + r2 * 0.72);
    const x = i * lebarSel - geser + (lebarSel - w) * hash(i, seed + 3);
    ctx.fillRect(x, dasar - h, w, h + 2);
    // atap bertingkat / antena pada sebagian gedung
    if (r1 > 0.55) ctx.fillRect(x + w * 0.2, dasar - h - 6 - r2 * 6, w * 0.6, 7);
    if (r2 > 0.8) ctx.fillRect(x + w * 0.5 - 0.8, dasar - h - 20, 1.6, 15);
    if (jendela) {
      const kolom = Math.max(2, Math.floor(w / 9));
      const baris = Math.floor(h / 13);
      for (let b = 0; b < baris; b++) {
        for (let k = 0; k < kolom; k++) {
          const t = hash(i * 31 + b * 7 + k, seed + 11);
          if (t < 0.62) continue;
          const kedip = t > 0.97 ? 0.55 + 0.45 * Math.sin(waktu * 3 + i + b) : 1;
          ctx.fillStyle = `rgba(255,214,128,${(0.5 * kedip).toFixed(2)})`;
          ctx.fillRect(x + 4 + k * ((w - 8) / kolom), dasar - h + 8 + b * 13, Math.max(2, (w - 8) / kolom - 3.5), 5);
        }
      }
      ctx.fillStyle = g;
    }
  }
}

function tiangLampu(ctx: Ctx, x: number, waktu: number) {
  tinta(ctx, 1.8);
  ctx.fillStyle = "#3A2C4A";
  ctx.beginPath();
  ctx.roundRect(x - 2.5, TANAH - 118, 5, 118, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, TANAH - 116);
  ctx.quadraticCurveTo(x + 14, TANAH - 126, x + 26, TANAH - 116);
  ctx.stroke();
  // cahaya hangat dan kerucutnya ke bawah
  const kedip = 0.9 + 0.1 * Math.sin(waktu * 9 + x);
  const g = ctx.createRadialGradient(x + 26, TANAH - 112, 2, x + 26, TANAH - 112, 54);
  g.addColorStop(0, `rgba(255,206,120,${0.75 * kedip})`);
  g.addColorStop(1, "rgba(255,206,120,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x + 26, TANAH - 112, 54, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#FFE3A6";
  ctx.beginPath();
  ctx.ellipse(x + 26, TANAH - 114, 7, 3, 0, 0, TAU);
  ctx.fill();
  const kerucut = ctx.createLinearGradient(0, TANAH - 112, 0, TANAH);
  kerucut.addColorStop(0, "rgba(255,206,120,0.16)");
  kerucut.addColorStop(1, "rgba(255,206,120,0)");
  ctx.fillStyle = kerucut;
  ctx.beginPath();
  ctx.moveTo(x + 22, TANAH - 112);
  ctx.lineTo(x + 30, TANAH - 112);
  ctx.lineTo(x + 70, TANAH);
  ctx.lineTo(x - 18, TANAH);
  ctx.closePath();
  ctx.fill();
}

/** Latar lengkap sampai tanah. `vw` = lebar logis yang terlihat. */
export function latarLari(ctx: Ctx, vw: number, jarak: number, waktu: number): void {
  // langit senja
  const langit = ctx.createLinearGradient(0, -200, 0, TANAH);
  langit.addColorStop(0, "#1D1745");
  langit.addColorStop(0.5, "#4F2A6B");
  langit.addColorStop(0.72, "#B3436E");
  langit.addColorStop(0.9, "#EE8656");
  langit.addColorStop(1, "#FFC47C");
  ctx.fillStyle = langit;
  ctx.fillRect(-200, -200, vw + 400, TANAH + 200);
  // bintang samar di bagian atas
  for (let i = 0; i < 26; i++) {
    const x = hash(i, 1) * vw;
    const y = hash(i, 2) * TANAH * 0.42;
    ctx.fillStyle = `rgba(255,240,220,${(0.25 + 0.5 * hash(i, 3)) * (0.7 + 0.3 * Math.sin(waktu * 2 + i))})`;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
  // matahari rendah dengan silau
  const sx = vw * 0.7;
  const sy = TANAH - 64;
  const silau = ctx.createRadialGradient(sx, sy, 6, sx, sy, 190);
  silau.addColorStop(0, "rgba(255,226,160,0.8)");
  silau.addColorStop(0.35, "rgba(255,170,110,0.3)");
  silau.addColorStop(1, "rgba(255,150,100,0)");
  ctx.fillStyle = silau;
  ctx.fillRect(sx - 200, sy - 200, 400, 400);
  ctx.fillStyle = "#FFF1C9";
  ctx.beginPath();
  ctx.arc(sx, sy, 38, 0, TAU);
  ctx.fill();
  // awan tipis memanjang yang tertimpa cahaya jingga
  for (let i = 0; i < 4; i++) {
    const lebar = 150 + hash(i, 5) * 90;
    const x = ((((i * 270 - waktu * 5 - jarak * 0.03) % (vw + 300)) + vw + 300) % (vw + 300)) - 150;
    const y = 38 + hash(i, 6) * 80;
    const g = ctx.createLinearGradient(0, y - 6, 0, y + 8);
    g.addColorStop(0, "rgba(255,174,120,0)");
    g.addColorStop(0.5, "rgba(255,190,140,0.5)");
    g.addColorStop(1, "rgba(140,70,120,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, lebar / 2, 6, 0, 0, TAU);
    ctx.fill();
  }
  // cakrawala kota berlapis (makin jauh makin pucat dan berkabut)
  cakrawala(ctx, vw, jarak, 0.05, TANAH + 2, 118, "#8A4B7A", "#D2688C", 44, 1, false, waktu);
  cakrawala(ctx, vw, jarak, 0.11, TANAH + 2, 100, "#4A2A63", "#8B3E72", 50, 2, true, waktu);
  cakrawala(ctx, vw, jarak, 0.22, TANAH + 2, 70, "#271A3C", "#46264F", 58, 3, true, waktu);
  // kabut tipis di kaki kota
  const kabut = ctx.createLinearGradient(0, TANAH - 54, 0, TANAH);
  kabut.addColorStop(0, "rgba(255,180,130,0)");
  kabut.addColorStop(1, "rgba(255,176,128,0.38)");
  ctx.fillStyle = kabut;
  ctx.fillRect(-10, TANAH - 54, vw + 20, 56);
  // tiang lampu (dunia: bergulir sama cepat dengan tanah)
  for (let i = Math.floor(jarak / 560) - 1; i < Math.floor((jarak + vw) / 560) + 2; i++) tiangLampu(ctx, i * 560 + 140 - jarak, waktu);

  // jalan beraspal: tepi terang disinari matahari, bintik, marka putus-putus
  const aspal = ctx.createLinearGradient(0, TANAH, 0, H + 60);
  aspal.addColorStop(0, "#54405C");
  aspal.addColorStop(0.18, "#3A2B44");
  aspal.addColorStop(1, "#1F1628");
  ctx.fillStyle = aspal;
  ctx.fillRect(-10, TANAH, vw + 20, H - TANAH + 200);
  ctx.fillStyle = "rgba(255,176,122,0.75)";
  ctx.fillRect(-10, TANAH, vw + 20, 2);
  ctx.fillStyle = "rgba(255,176,122,0.18)";
  ctx.fillRect(-10, TANAH + 2, vw + 20, 6);
  const geser = jarak % 90;
  ctx.fillStyle = "rgba(255,232,196,0.55)";
  for (let i = -1; i < vw / 90 + 2; i++) ctx.fillRect(i * 90 - geser, TANAH + 38, 46, 3.4);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  for (let i = 0; i < vw / 22 + 3; i++) {
    const x = i * 22 - (jarak % 22);
    const idx = Math.floor((jarak - (jarak % 22)) / 22) + i;
    ctx.fillRect(x, TANAH + 14 + hash(idx, 9) * 28, 2 + hash(idx, 8) * 3, 1.6);
  }
}

// ───────────────────────── rintangan ─────────────────────────
function peti(ctx: Ctx, x: number, y: number, w: number, h: number, warna: string, gelap: string) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, warna);
  g.addColorStop(1, gelap);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // papan & serat
  ctx.strokeStyle = "rgba(60,32,16,0.45)";
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 3, y + (h / 4) * i);
    ctx.lineTo(x + w - 3, y + (h / 4) * i);
    ctx.stroke();
  }
  // bingkai logam di sudut + paku
  ctx.fillStyle = "#5F5470";
  const k = Math.min(10, w * 0.28);
  for (const [cx, cy] of [
    [x, y],
    [x + w - k, y],
    [x, y + h - k],
    [x + w - k, y + h - k],
  ]) ctx.fillRect(cx, cy, k, k);
  ctx.fillStyle = "#C8BFD8";
  for (const [cx, cy] of [
    [x + k / 2, y + k / 2],
    [x + w - k / 2, y + k / 2],
    [x + k / 2, y + h - k / 2],
    [x + w - k / 2, y + h - k / 2],
  ]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 1.3, 0, TAU);
    ctx.fill();
  }
  // tepi terang (sisi kiri menghadap matahari? matahari di kanan-belakang: tepi atas & kanan terang)
  ctx.fillStyle = "rgba(255,196,140,0.5)";
  ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(x, y + h - 3, w, 3);
  tinta(ctx, 2.2);
  ctx.strokeRect(x, y, w, h);
}

export function rintanganLari(ctx: Ctx, o: Rintangan, sx: number, waktu: number): void {
  const x = o.x - sx;
  if (o.tipe === "peti") peti(ctx, x, o.y, o.w, o.h, "#C58B48", "#8E5A2C");
  else if (o.tipe === "tinggi") {
    peti(ctx, x, o.y + o.h / 2, o.w, o.h / 2, "#B97E40", "#85532A");
    peti(ctx, x + 1, o.y, o.w - 2, o.h / 2, "#CC9453", "#96622F");
  } else if (o.tipe === "duri") {
    ctx.fillStyle = "#3A2F47";
    ctx.fillRect(x - 2, TANAH - 5, o.w + 4, 5);
    const n = 4;
    const lebar = o.w / n;
    for (let i = 0; i < n; i++) {
      const g = ctx.createLinearGradient(x + i * lebar, 0, x + (i + 1) * lebar, 0);
      g.addColorStop(0, "#D8DCEB");
      g.addColorStop(0.5, "#9AA0B8");
      g.addColorStop(1, "#5E637C");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + i * lebar + 0.5, TANAH - 4);
      ctx.lineTo(x + i * lebar + lebar / 2, o.y);
      ctx.lineTo(x + (i + 1) * lebar - 0.5, TANAH - 4);
      ctx.closePath();
      ctx.fill();
      tinta(ctx, 1.8);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath();
      ctx.arc(x + i * lebar + lebar / 2, o.y + 3, 1.2, 0, TAU);
      ctx.fill();
    }
  } else if (o.tipe === "drone") {
    const bob = Math.sin(waktu * 5.5 + o.id) * 3;
    const cx = x + o.w / 2;
    const cy = o.y + o.h / 2 + bob;
    // cahaya dorong ke bawah
    const dorong = ctx.createLinearGradient(0, cy + 10, 0, TANAH);
    dorong.addColorStop(0, "rgba(120,220,255,0.28)");
    dorong.addColorStop(1, "rgba(120,220,255,0)");
    ctx.fillStyle = dorong;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + 12);
    ctx.lineTo(cx + 12, cy + 12);
    ctx.lineTo(cx + 26, TANAH);
    ctx.lineTo(cx - 26, TANAH);
    ctx.closePath();
    ctx.fill();
    // baling-baling (kabur) di dua sisi
    ctx.fillStyle = "rgba(210,220,240,0.35)";
    for (const sisi of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + sisi * 22, cy - 11, 15, 2.6, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + sisi * 22, cy - 11);
      ctx.lineTo(cx + sisi * 14, cy - 3);
      ctx.stroke();
    }
    // badan logam gelap
    const g = ctx.createLinearGradient(cx - 24, cy - 14, cx + 24, cy + 14);
    g.addColorStop(0, "#6E6684");
    g.addColorStop(0.5, "#3F3852");
    g.addColorStop(1, "#262033");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 25, 14, 0, 0, TAU);
    ctx.fill();
    tinta(ctx, 2.2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy - 7, 14, 3.6, 0, 0, TAU);
    ctx.fill();
    // mata merah menyala
    const kedip = 0.8 + 0.2 * Math.sin(waktu * 8 + o.id);
    const mata = ctx.createRadialGradient(cx - 7, cy + 1, 1, cx - 7, cy + 1, 10);
    mata.addColorStop(0, `rgba(255,120,100,${kedip})`);
    mata.addColorStop(1, "rgba(255,60,60,0)");
    ctx.fillStyle = mata;
    ctx.beginPath();
    ctx.arc(cx - 7, cy + 1, 10, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#FF5A4A";
    ctx.beginPath();
    ctx.ellipse(cx - 7, cy + 1, 6, 4.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#FFE9C8";
    ctx.beginPath();
    ctx.arc(cx - 8.5, cy, 1.6, 0, TAU);
    ctx.fill();
  } else {
    // tembok energi: dua pemancar logam + medan plasma yang bergelombang
    const kedip = 0.8 + 0.2 * Math.sin(waktu * 14 + o.id);
    const g = ctx.createLinearGradient(x - 8, 0, x + o.w + 8, 0);
    g.addColorStop(0, "rgba(100,210,255,0)");
    g.addColorStop(0.25, `rgba(120,225,255,${0.45 * kedip})`);
    g.addColorStop(0.5, `rgba(225,250,255,${0.95 * kedip})`);
    g.addColorStop(0.75, `rgba(120,225,255,${0.45 * kedip})`);
    g.addColorStop(1, "rgba(100,210,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 10, o.y, o.w + 20, o.h);
    // pita gelombang yang naik
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 5; i++) {
      const yy = o.y + (((i * 38 + waktu * 90) % o.h) + o.h) % o.h;
      ctx.fillRect(x - 3 + Math.sin(yy * 0.1 + waktu * 6) * 2, yy, o.w + 6, 1.6);
    }
    tinta(ctx, 2);
    ctx.fillStyle = "#4A3F5C";
    for (const yy of [o.y - 7, o.y + o.h - 3]) {
      ctx.beginPath();
      ctx.roundRect(x - 7, yy, o.w + 14, 10, 3);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#6BE0FF";
    for (const yy of [o.y - 3, o.y + o.h + 1]) {
      ctx.beginPath();
      ctx.arc(x + o.w / 2, yy, 2.2, 0, TAU);
      ctx.fill();
    }
    // petunjuk: DASH
    ctx.fillStyle = "rgba(36,27,51,0.9)";
    ctx.beginPath();
    ctx.roundRect(x + o.w / 2 - 20, o.y - 28, 40, 16, 6);
    ctx.fill();
    ctx.fillStyle = "#9BEBFF";
    ctx.font = "800 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DASH", x + o.w / 2, o.y - 16);
  }
}

export function koinLari(ctx: Ctx, x: number, y: number, waktu: number): void {
  const lebar = 10.5 * Math.abs(Math.cos(waktu * 4 + x * 0.05)) + 2.4;
  const halo = ctx.createRadialGradient(x, y, 2, x, y, 18);
  halo.addColorStop(0, "rgba(255,214,110,0.5)");
  halo.addColorStop(1, "rgba(255,214,110,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, TAU);
  ctx.fill();
  const g = ctx.createLinearGradient(x - lebar, y - 10, x + lebar, y + 10);
  g.addColorStop(0, "#FFE48A");
  g.addColorStop(0.55, "#F2B73F");
  g.addColorStop(1, "#C98516");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, lebar, 10.6, 0, 0, TAU);
  ctx.fill();
  tinta(ctx, 2);
  ctx.stroke();
  if (lebar > 6) {
    ctx.strokeStyle = "rgba(150,90,10,0.55)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(x, y, lebar * 0.55, 6.2, 0, 0, TAU);
    ctx.stroke();
  }
}

// ───────────────────────── robot ─────────────────────────
function anggota(ctx: Ctx, x: number, y: number, panjang: number, sudut: number, lebar: number, warna: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sudut);
  ctx.fillStyle = warna;
  kapsul(ctx, -lebar / 2, -lebar / 2, lebar, panjang + lebar, lebar / 2);
  ctx.fill();
  tinta(ctx, 2.2);
  ctx.stroke();
  ctx.restore();
}

/** Robot pelari di (x, kaki). Pose dari keadaan dunia: berlari, melompat, menunduk, dash, tertabrak. */
export function robotLari(ctx: Ctx, x: number, kaki: number, d: DuniaLari, waktu: number): void {
  const dash = d.dashSisa > 0;
  const tunduk = d.tunduk;
  const udara = !d.tanah;
  const mati = d.selesai !== null;
  const fase = d.jarak * 0.058;
  const s = mati ? 0 : Math.sin(fase);
  const c = mati ? 0 : Math.cos(fase);
  const tinggiLoncat = Math.max(0, TANAH - d.y);

  // bayangan lembut di jalan, mengecil dan memudar saat melompat
  ctx.fillStyle = `rgba(0,0,0,${(0.34 - Math.min(0.2, tinggiLoncat / 400)).toFixed(2)})`;
  ctx.beginPath();
  ctx.ellipse(x + 3, TANAH + 3, 19 - Math.min(10, tinggiLoncat / 9), 4, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(x, kaki);

  // jejak dash: bayangan sisa berpendar dan garis kecepatan
  if (dash) {
    for (let i = 4; i >= 1; i--) {
      ctx.globalAlpha = 0.16 * (5 - i) / 4;
      const g = ctx.createLinearGradient(-i * 17 - 14, 0, -i * 17 + 14, 0);
      g.addColorStop(0, "rgba(110,225,255,0)");
      g.addColorStop(1, "rgba(150,235,255,1)");
      ctx.fillStyle = g;
      ctx.fillRect(-i * 17 - 14, -BERDIRI.h, 28, BERDIRI.h);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const yy = -8 - i * 11;
      ctx.beginPath();
      ctx.moveTo(-22 - i * 4, yy);
      ctx.lineTo(-74 - ((i * 13) % 20), yy);
      ctx.stroke();
    }
  }

  // kemiringan badan: condong ke depan saat berlari cepat, dash, dan menunduk
  const condong = dash ? 0.32 : tunduk ? 0.42 : udara ? 0.1 : 0.12 + 0.03 * s;
  const pinggul = tunduk ? -13 : -19 - (udara || mati ? 0 : Math.abs(s) * 1.8);
  // posisi sambungan
  const panggulX = 0;
  const panggulY = pinggul;

  const kulit = "#EEE7D6";
  const kulitGelap = "#CFC4AE";
  const aksen = "#4E93AA";

  // kaki belakang & depan: paha + betis (lutut menekuk saat melangkah ke depan)
  const kaki2 = (sisi: number) => {
    const ph = sisi > 0 ? 0 : Math.PI;
    let paha: number;
    let betis: number;
    if (udara) {
      paha = sisi > 0 ? 0.9 : -0.35;
      betis = sisi > 0 ? 1.3 : 0.6;
    } else if (tunduk) {
      paha = sisi > 0 ? 1.15 : 0.7;
      betis = -1.05;
    } else if (mati) {
      paha = sisi * 0.4;
      betis = 0.2;
    } else {
      paha = Math.sin(fase + ph) * 0.95;
      betis = Math.max(0, -Math.sin(fase + ph + 0.9)) * 1.25 + 0.12;
    }
    const pj = 10.5;
    anggota(ctx, panggulX, panggulY, pj, paha, 7.2, sisi > 0 ? kulit : kulitGelap);
    const kx = panggulX - Math.sin(paha) * pj;
    const ky = panggulY + Math.cos(paha) * pj;
    anggota(ctx, kx, ky, pj - 1, paha + betis * (paha > 0 || udara ? -1 : -1), 6.6, aksen);
    // sepatu
    const ax = kx - Math.sin(paha - betis) * (pj - 1);
    const ay = ky + Math.cos(paha - betis) * (pj - 1);
    ctx.fillStyle = "#2D2A44";
    ctx.beginPath();
    ctx.ellipse(ax + 2.4, Math.min(ay + 3.2, 1.5), 5.4, 3.1, 0, 0, TAU);
    ctx.fill();
    tinta(ctx, 1.8);
    ctx.stroke();
  };
  // lengan belakang
  const lengan = (sisi: number) => {
    const bahu = [-1.5, panggulY - 17 * (tunduk ? 0.7 : 1)] as const;
    const a = dash ? 1.9 : udara ? (sisi > 0 ? 2.6 : -0.4) : tunduk ? sisi * 0.5 + 1.1 : Math.sin(fase + (sisi > 0 ? Math.PI : 0)) * 1.05;
    anggota(ctx, bahu[0], bahu[1], 10, a, 5.6, sisi > 0 ? aksen : "#3A7A90");
    const tx = bahu[0] - Math.sin(a) * 10;
    const ty = bahu[1] + Math.cos(a) * 10;
    ctx.fillStyle = kulit;
    ctx.beginPath();
    ctx.arc(tx, ty, 3.6, 0, TAU);
    ctx.fill();
    tinta(ctx, 1.8);
    ctx.stroke();
  };
  ctx.save();
  ctx.translate(0, 0);
  kaki2(-1);
  lengan(-1);

  // syal merah: ujungnya berkibar menurut kecepatan
  const syal = () => {
    const leher: [number, number] = [-4, panggulY - 21 * (tunduk ? 0.8 : 1)];
    ctx.fillStyle = "#D8503F";
    ctx.beginPath();
    ctx.moveTo(leher[0] + 2, leher[1] - 2);
    const kib = (dash ? 26 : 14) + (udara ? 4 : 0);
    const gel = Math.sin(waktu * 14 + c) * 3;
    ctx.bezierCurveTo(leher[0] - kib * 0.4, leher[1] + gel, leher[0] - kib * 0.8, leher[1] - 4 - gel, leher[0] - kib, leher[1] + 3 + gel * 0.5);
    ctx.bezierCurveTo(leher[0] - kib * 0.7, leher[1] + 8, leher[0] - kib * 0.3, leher[1] + 5 - gel, leher[0] + 2, leher[1] + 4);
    ctx.closePath();
    ctx.fill();
    tinta(ctx, 1.8);
    ctx.stroke();
  };

  // badan + kepala diputar sedikit ke depan di sekitar panggul
  ctx.save();
  ctx.translate(panggulX, panggulY);
  ctx.rotate(condong);
  ctx.translate(-panggulX, -panggulY);
  // pendorong di punggung saat dash
  if (dash) {
    const api = ctx.createLinearGradient(-10, 0, -34, 0);
    api.addColorStop(0, "rgba(255,230,160,0.95)");
    api.addColorStop(0.5, "rgba(255,140,70,0.8)");
    api.addColorStop(1, "rgba(255,80,60,0)");
    ctx.fillStyle = api;
    ctx.beginPath();
    ctx.moveTo(-9, panggulY - 20);
    ctx.quadraticCurveTo(-24, panggulY - 26 + Math.sin(waktu * 40) * 2, -38, panggulY - 18);
    ctx.quadraticCurveTo(-24, panggulY - 12, -9, panggulY - 12);
    ctx.closePath();
    ctx.fill();
  }
  // badan: gradien logam, panel dada bercahaya, ransel
  const tb = tunduk ? 16 : 19;
  const bg = ctx.createLinearGradient(-10, 0, 10, 0);
  bg.addColorStop(0, "#F6F0E1");
  bg.addColorStop(1, "#CBBFA6");
  ctx.fillStyle = "#3A7A90";
  ctx.beginPath();
  ctx.roundRect(-14, panggulY - tb - 2, 7, tb - 2, 3);
  ctx.fill();
  tinta(ctx, 2);
  ctx.stroke();
  ctx.fillStyle = bg;
  kapsul(ctx, -9, panggulY - tb - 3, 19, tb + 3, 6);
  ctx.fill();
  tinta(ctx, 2.4);
  ctx.stroke();
  ctx.fillStyle = "#1D2742";
  ctx.beginPath();
  ctx.roundRect(-3, panggulY - tb + 1, 10, 7, 2.5);
  ctx.fill();
  const jantung = ctx.createRadialGradient(2, panggulY - tb + 4.5, 0.5, 2, panggulY - tb + 4.5, 7);
  jantung.addColorStop(0, "rgba(255,130,110,0.95)");
  jantung.addColorStop(1, "rgba(255,90,80,0)");
  ctx.fillStyle = jantung;
  ctx.beginPath();
  ctx.arc(2, panggulY - tb + 4.5, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#FF8F7F";
  ctx.beginPath();
  ctx.arc(2, panggulY - tb + 4.5, 2.1, 0, TAU);
  ctx.fill();

  // kepala
  const hy = panggulY - tb - 17;
  const kg = ctx.createLinearGradient(-13, hy, 15, hy + 18);
  kg.addColorStop(0, "#F7F2E4");
  kg.addColorStop(1, "#CDC1A8");
  ctx.fillStyle = kg;
  kapsul(ctx, -13, hy, 28, 20, 7);
  ctx.fill();
  tinta(ctx, 2.5);
  ctx.stroke();
  // visor gelap dengan mata menyala
  ctx.fillStyle = "#1B2340";
  ctx.beginPath();
  ctx.roundRect(-10.5, hy + 3.5, 23, 12.5, 4);
  ctx.fill();
  if (mati) {
    ctx.strokeStyle = "#FF6B5A";
    ctx.lineWidth = 2;
    for (const ex of [-3.5, 6.5]) {
      ctx.beginPath();
      ctx.moveTo(ex - 2.4, hy + 7.5);
      ctx.lineTo(ex + 2.4, hy + 12.5);
      ctx.moveTo(ex + 2.4, hy + 7.5);
      ctx.lineTo(ex - 2.4, hy + 12.5);
      ctx.stroke();
    }
  } else {
    const kedip = Math.sin(waktu * 1.3) > 0.985 ? 0.2 : 1;
    const tinggiMata = (dash ? 2.4 : 4.4) * kedip;
    for (const ex of [-3.5, 6.5]) {
      const glow = ctx.createRadialGradient(ex, hy + 10, 0.5, ex, hy + 10, 7);
      glow.addColorStop(0, "rgba(130,235,255,0.8)");
      glow.addColorStop(1, "rgba(130,235,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ex, hy + 10, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#B9F3FF";
      ctx.beginPath();
      ctx.ellipse(ex + 1, hy + 10, 2.9, tinggiMata, 0, 0, TAU);
      ctx.fill();
    }
  }
  // sorot di kepala + antena
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.ellipse(-5, hy + 2.2, 5, 1.2, -0.1, 0, TAU);
  ctx.fill();
  const an = Math.sin(waktu * 9 + fase) * 3 - (dash ? 8 : 0) - (udara ? 2 : 0);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(1, hy);
  ctx.lineTo(1 + an, hy - 8);
  ctx.stroke();
  ctx.fillStyle = "#F2C14E";
  ctx.beginPath();
  ctx.arc(1 + an, hy - 9.5, 3.2, 0, TAU);
  ctx.fill();
  tinta(ctx, 1.8);
  ctx.stroke();
  syal();
  ctx.restore();

  kaki2(1);
  lengan(1);
  ctx.restore();
  ctx.restore();
  void TUNDUK;
}

// ───────────────────────── ikon kartu game ─────────────────────────
/** Ikon Lari Robo untuk kartu menu: potongan adegan (langit senja, kota, jalan) dengan robot berlari dan debu. Ukuran persegi `u`. */
export function ikonLari(ctx: Ctx, u: number, waktu = 0): void {
  const skala = u / 120;
  ctx.save();
  ctx.scale(skala, skala);
  ctx.beginPath();
  ctx.roundRect(0, 0, 120, 120, 18);
  ctx.clip();
  // dunia 120x120: tanah di y=92
  const langit = ctx.createLinearGradient(0, 0, 0, 92);
  langit.addColorStop(0, "#2B1F55");
  langit.addColorStop(0.55, "#A13F6E");
  langit.addColorStop(0.85, "#F0894F");
  langit.addColorStop(1, "#FFC47C");
  ctx.fillStyle = langit;
  ctx.fillRect(0, 0, 120, 120);
  ctx.fillStyle = "#FFF1C9";
  ctx.beginPath();
  ctx.arc(86, 70, 17, 0, TAU);
  ctx.fill();
  for (const [x, w, h, col] of [
    [4, 14, 36, "#6E3A70"],
    [20, 12, 50, "#5A3068"],
    [34, 18, 30, "#6E3A70"],
    [78, 14, 44, "#5A3068"],
    [94, 16, 32, "#6E3A70"],
  ] as const) {
    ctx.fillStyle = col;
    ctx.fillRect(x, 92 - h, w, h);
  }
  ctx.fillStyle = "rgba(255,214,128,0.7)";
  for (const [x, y] of [
    [24, 54],
    [28, 62],
    [38, 70],
    [82, 58],
    [98, 68],
  ] as const) ctx.fillRect(x, y, 3, 3);
  const asp = ctx.createLinearGradient(0, 92, 0, 120);
  asp.addColorStop(0, "#54405C");
  asp.addColorStop(1, "#231A2D");
  ctx.fillStyle = asp;
  ctx.fillRect(0, 92, 120, 28);
  ctx.fillStyle = "rgba(255,176,122,0.8)";
  ctx.fillRect(0, 92, 120, 2);
  ctx.fillStyle = "rgba(255,232,196,0.5)";
  ctx.fillRect(6, 106, 22, 3);
  ctx.fillRect(48, 106, 22, 3);
  ctx.fillRect(90, 106, 22, 3);
  // garis kecepatan
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (const [y, a, b] of [
    [58, 4, 28],
    [68, 2, 34],
    [78, 8, 30],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(a, y);
    ctx.lineTo(b, y);
    ctx.stroke();
  }
  // robot besar berlari (dunia ikon: kaki di y=92, tinggi 56 -> skala 1,25)
  const d = {
    dashSisa: 0.2,
    tunduk: false,
    tanah: true,
    selesai: null,
    jarak: 210 + waktu * 30,
    y: TANAH,
  } as unknown as DuniaLari;
  ctx.save();
  ctx.translate(0, 92);
  ctx.scale(1.1, 1.1);
  ctx.translate(58 / 1.1, 0);
  // robotLari memakai TANAH untuk bayangan: geser ke y=0 lokal
  ctx.translate(0, -TANAH);
  robotLari(ctx, 0, TANAH, d, waktu);
  ctx.restore();
  ctx.restore();
}
