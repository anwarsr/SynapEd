/**
 * Latar game "Bola Gabung": empat suasana yang berganti (memudar silih berganti) seiring bola terbesar yang dicapai pemain -
 * kamar bermain dengan cahaya jendela sore, lapangan di siang hari, senja di tepi danau, lalu luar angkasa.
 *
 * Rujukannya pemandangan/foto sungguhan, bukan ikon: langit bergradasi halus, awan berlapis, perspektif udara (yang jauh lebih
 * pucat & kabur), tekstur (serat kayu, plester, rumput, derau nebula), cahaya yang jatuh dari satu sumber, dan bayangan lembut.
 * Bagian diam dilukis SEKALI per ukuran layar ke kanvas luar-layar (resolusi dikurangi lalu diperhalus: terasa seperti lukisan),
 * bagian bergerak (awan, debu cahaya, burung, bintang berkelip) digambar hidup di atasnya, ditutup vinyet dan butiran film tipis.
 * Koordinat layar, tanpa transformasi dunia.
 */

type Ctx = CanvasRenderingContext2D;
type V3 = [number, number, number];
const TAU = Math.PI * 2;

/** Tema yang tampil untuk bola terbesar tingkat `n` (0..10). */
export function temaUntuk(n: number): number {
  return n < 3 ? 0 : n < 6 ? 1 : n < 9 ? 2 : 3;
}
export const JUMLAH_TEMA = 4;

// ───────────────────────── alat bantu ─────────────────────────
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sm = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const hx = (s: string): V3 => {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const campur = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (c: V3, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function derau(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, oktaf = 4): number {
  let jum = 0;
  let amp = 0.5;
  let f = 1;
  let tot = 0;
  for (let i = 0; i < oktaf; i++) {
    jum += amp * derau(x * f + i * 17.3, y * f + i * 9.1);
    tot += amp;
    amp *= 0.5;
    f *= 2.02;
  }
  return jum / tot;
}
function acak(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Warna gradasi berhenti-ganda di posisi t (0..1). */
function grad(stops: [number, string][], t: number): V3 {
  if (t <= stops[0][0]) return hx(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const k = (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return campur(hx(stops[i - 1][1]), hx(stops[i][1]), k * k * (3 - 2 * k));
    }
  }
  return hx(stops[stops.length - 1][1]);
}
/** Mengisi baris y0..y1 piksel demi piksel; `dasar` = warna yang sudah ada di kanvas (untuk menumpuk di atas lukisan lain). */
function tulisPiksel(ctx: Ctx, cw: number, ch: number, y0: number, y1: number, fn: (x: number, y: number, dasar: V3) => V3) {
  const a = Math.max(0, Math.floor(y0));
  const b = Math.min(ch, Math.ceil(y1));
  if (b <= a) return;
  const img = ctx.getImageData(0, a, cw, b - a);
  for (let y = a; y < b; y++) {
    for (let x = 0; x < cw; x++) {
      const k = ((y - a) * cw + x) * 4;
      const c = fn(x, y, [img.data[k], img.data[k + 1], img.data[k + 2]]);
      img.data[k] = c[0];
      img.data[k + 1] = c[1];
      img.data[k + 2] = c[2];
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, a);
}
function kanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}
function blob(ctx: Ctx, x: number, y: number, r: number, warna: V3, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgb(warna, a));
  g.addColorStop(0.55, rgb(warna, a * 0.7));
  g.addColorStop(1, rgb(warna, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

// ───────────────────────── awan (sprite hidup) ─────────────────────────
function buatAwan(terang: V3, gelap: V3, seed: number): HTMLCanvasElement {
  const W = 260;
  const H = 110;
  const c = kanvas(W, H);
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const r = acak(seed);
  const gumpal: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 26; i++) {
    const t = r();
    const x = 40 + t * 180;
    const tinggi = Math.sin(t * Math.PI) * 38;
    gumpal.push({ x, y: H * 0.68 - tinggi * (0.35 + r() * 0.65), r: 16 + r() * 24 * (0.5 + Math.sin(t * Math.PI)) });
  }
  gumpal.sort((a, b) => b.y - a.y);
  for (const g of gumpal) {
    const k = clamp((g.y - 20) / 60);
    blob(ctx, g.x, g.y, g.r, campur(terang, gelap, k * 0.75), 0.85);
  }
  return c;
}

// ───────────────────────── tema 0: kamar bermain, sinar jendela sore ─────────────────────────
function lukisKamar(ctx: Ctx, cw: number, ch: number): void {
  const lantaiY = ch * 0.8;
  const ww = Math.min(cw * 0.34, ch * 0.3);
  const wh = ww * 1.3;
  const wx = cw * 0.08;
  const wy = ch * 0.08;
  const cahayaX = wx + ww * 0.5;
  const cahayaY = wy + wh * 0.7;

  // dinding cat krem: cahaya dari jendela + plester halus
  const dinding = hx("#E5C6AA");
  tulisPiksel(ctx, cw, ch, 0, lantaiY, (x, y) => {
    const d = Math.hypot((x - cahayaX) / (cw * 0.7), (y - cahayaY) / (ch * 0.6));
    const L = 0.74 + 0.4 * Math.exp(-d * d * 2.2) - 0.1 * (1 - y / lantaiY) - 0.06 * Math.abs(x / cw - 0.5);
    const tekstur = 0.97 + 0.06 * fbm(x * 0.11, y * 0.11, 3);
    return [dinding[0] * L * tekstur, dinding[1] * L * tekstur, dinding[2] * L * tekstur];
  });

  // lantai papan kayu: tiap papan lain nada, serat memanjang, celah gelap
  const rng = acak(11);
  const papan: number[] = [];
  let px = -rng() * cw * 0.05;
  while (px < cw) {
    papan.push(px);
    px += cw * (0.07 + rng() * 0.05);
  }
  papan.push(cw + 40);
  const kayu = hx("#B07C4C");
  tulisPiksel(ctx, cw, ch, lantaiY, ch, (x, y) => {
    let i = 0;
    while (i < papan.length - 2 && x >= papan[i + 1]) i++;
    const lokal = x - papan[i];
    const nada = 0.8 + hash2(i, 3) * 0.32;
    const serat = 0.88 + 0.22 * derau(x * 0.45 + i * 9, y * 0.035);
    const lebih = 0.9 + 0.1 * derau(x * 0.05, y * 0.4);
    const dalam = (y - lantaiY) / (ch - lantaiY);
    const redup = 1 - 0.28 * dalam;
    const celah = lokal < 1.6 ? 0.45 : 1;
    const f = nada * serat * lebih * redup * celah;
    return [kayu[0] * f, kayu[1] * f, kayu[2] * f];
  });
  // bayangan sambungan dinding-lantai
  const bayLantai = ctx.createLinearGradient(0, lantaiY, 0, lantaiY + ch * 0.07);
  bayLantai.addColorStop(0, "rgba(30,15,5,0.42)");
  bayLantai.addColorStop(1, "rgba(30,15,5,0)");
  ctx.fillStyle = bayLantai;
  ctx.fillRect(0, lantaiY, cw, ch * 0.07);

  // plint
  const ph = ch * 0.04;
  const plint = ctx.createLinearGradient(0, lantaiY - ph, 0, lantaiY);
  plint.addColorStop(0, "#F2E7D4");
  plint.addColorStop(0.08, "#E9DCC4");
  plint.addColorStop(1, "#CDBB9E");
  ctx.fillStyle = plint;
  ctx.fillRect(0, lantaiY - ph, cw, ph);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(0, lantaiY - ph, cw, 1.2);

  // jendela: bingkai, langit sore, siluet pohon jauh, palang
  ctx.save();
  ctx.shadowColor = "rgba(40,20,5,0.45)";
  ctx.shadowBlur = ww * 0.06;
  ctx.shadowOffsetY = ww * 0.025;
  ctx.fillStyle = "#EFE4D0";
  ctx.fillRect(wx - ww * 0.07, wy - ww * 0.07, ww * 1.14, wh + ww * 0.14);
  ctx.restore();
  const langit = ctx.createLinearGradient(0, wy, 0, wy + wh);
  langit.addColorStop(0, "#7FB5DE");
  langit.addColorStop(0.65, "#D6E8F0");
  langit.addColorStop(1, "#F4E2C2");
  ctx.fillStyle = langit;
  ctx.fillRect(wx, wy, ww, wh);
  ctx.save();
  ctx.beginPath();
  ctx.rect(wx, wy, ww, wh);
  ctx.clip();
  const r2 = acak(5);
  for (let i = 0; i < 22; i++) blob(ctx, wx + r2() * ww, wy + wh * (0.82 + r2() * 0.1), ww * (0.07 + r2() * 0.09), hx(i % 2 ? "#4F7A5B" : "#5E8A62"), 0.8);
  for (let i = 0; i < 3; i++) blob(ctx, wx + ww * (0.2 + i * 0.3), wy + wh * (0.25 + (i % 2) * 0.12), ww * 0.2, [255, 255, 255], 0.55);
  ctx.restore();
  ctx.fillStyle = "#F6EEDD";
  ctx.fillRect(wx + ww / 2 - ww * 0.02, wy, ww * 0.04, wh);
  ctx.fillRect(wx, wy + wh * 0.5 - ww * 0.02, ww, ww * 0.04);
  ctx.fillStyle = "rgba(60,40,20,0.25)";
  ctx.fillRect(wx + ww / 2 + ww * 0.02, wy, ww * 0.012, wh);
  ctx.fillRect(wx, wy + wh * 0.5 + ww * 0.02, ww, ww * 0.012);
  // ambang
  ctx.save();
  ctx.shadowColor = "rgba(40,20,5,0.4)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#F3EBDA";
  ctx.fillRect(wx - ww * 0.12, wy + wh + ww * 0.07, ww * 1.24, ww * 0.06);
  ctx.restore();

  // tirai berlipit
  const tirai = (x0: number, x1: number, rendah: number) => {
    const warna = hx("#A9473F");
    for (let x = x0; x < x1; x++) {
      const k = (x - x0) / (x1 - x0);
      const lipit = 0.72 + 0.28 * Math.sin(k * 14 + 0.6) * Math.sin(k * 5 + 1);
      const c = campur(warna, hx("#6E2A28"), 1 - lipit);
      ctx.fillStyle = rgb(c);
      ctx.fillRect(x, wy - ww * 0.12, 1.2, wh * rendah + ww * 0.12);
    }
  };
  tirai(wx - ww * 0.2, wx + ww * 0.2, 1.08);
  tirai(wx + ww * 0.82, wx + ww * 1.18, 1.08);
  ctx.fillStyle = "#6B4A2E";
  ctx.fillRect(wx - ww * 0.26, wy - ww * 0.14, ww * 1.52, ww * 0.035);

  // sinar jendela jatuh ke lantai
  const kuas = ctx.createLinearGradient(wx, wy + wh, wx + ww * 1.6, ch);
  kuas.addColorStop(0, "rgba(255,226,170,0.28)");
  kuas.addColorStop(1, "rgba(255,226,170,0)");
  ctx.fillStyle = kuas;
  ctx.beginPath();
  ctx.moveTo(wx, wy + wh);
  ctx.lineTo(wx + ww, wy + wh);
  ctx.lineTo(wx + ww * 2.4, ch);
  ctx.lineTo(wx + ww * 0.9, ch);
  ctx.closePath();
  ctx.fill();

  // rak buku di kanan
  const rx = cw * 0.62;
  const rw = cw * 0.34;
  const ry = ch * 0.36;
  const buku = ["#B5473A", "#3F6E8C", "#D9A441", "#5B7F4E", "#7A4E7E", "#C9743F", "#2F4C66", "#9E3B4C"];
  let bx = rx + rw * 0.04;
  const r3 = acak(21);
  let i = 0;
  while (bx < rx + rw * 0.8) {
    const bw = rw * (0.035 + r3() * 0.035);
    const bh = ch * (0.06 + r3() * 0.05);
    const c = hx(buku[i++ % buku.length]);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, rgb(campur(c, [255, 255, 255], 0.18)));
    g.addColorStop(0.5, rgb(c));
    g.addColorStop(1, rgb(campur(c, [0, 0, 0], 0.3)));
    ctx.fillStyle = g;
    ctx.fillRect(bx, ry - bh, bw, bh);
    ctx.fillStyle = "rgba(255,240,200,0.55)";
    ctx.fillRect(bx + bw * 0.15, ry - bh * 0.72, bw * 0.7, 1.4);
    bx += bw + 0.8;
  }
  // tanaman kecil di ujung rak
  const px0 = rx + rw * 0.9;
  ctx.fillStyle = "#B4623A";
  ctx.beginPath();
  ctx.moveTo(px0 - cw * 0.022, ry - ch * 0.04);
  ctx.lineTo(px0 + cw * 0.022, ry - ch * 0.04);
  ctx.lineTo(px0 + cw * 0.015, ry);
  ctx.lineTo(px0 - cw * 0.015, ry);
  ctx.closePath();
  ctx.fill();
  for (let k = 0; k < 7; k++) {
    ctx.save();
    ctx.translate(px0, ry - ch * 0.04);
    ctx.rotate(-1.2 + k * 0.4);
    ctx.fillStyle = k % 2 ? "#4C8A4A" : "#3E7A41";
    ctx.beginPath();
    ctx.ellipse(0, -ch * 0.03, cw * 0.012, ch * 0.032, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.shadowColor = "rgba(30,15,5,0.5)";
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 4;
  const papanRak = ctx.createLinearGradient(0, ry, 0, ry + ch * 0.014);
  papanRak.addColorStop(0, "#A8754A");
  papanRak.addColorStop(1, "#7E5430");
  ctx.fillStyle = papanRak;
  ctx.fillRect(rx, ry, rw, ch * 0.014);
  ctx.restore();
}

// ───────────────────────── tema 1: lapangan siang hari ─────────────────────────
function lukisLapangan(ctx: Ctx, cw: number, ch: number): void {
  const hor = ch * 0.47;
  const langit: [number, string][] = [
    [0, "#4F93D4"],
    [0.55, "#9CCBEA"],
    [1, "#E3F0F4"],
  ];
  tulisPiksel(ctx, cw, ch, 0, hor, (x, y) => {
    const t = y / hor;
    let c = grad(langit, t);
    const sirus = sm(0.52, 0.82, fbm(x * 0.008, y * 0.03 + 4, 4));
    c = campur(c, [255, 255, 255], sirus * 0.38 * (1 - t * 0.5));
    return c;
  });

  // pegunungan jauh berkabut, lalu perbukitan, lalu barisan pohon (perspektif udara)
  const lapis = (base: number, amp: number, skala: number, fas: number, warna: V3, alfa: number, tajam: boolean) => {
    ctx.beginPath();
    ctx.moveTo(0, hor + 2);
    for (let x = 0; x <= cw; x += 2) {
      let n = fbm(x * skala + fas, fas, 4);
      if (tajam) n = 1 - Math.abs(n * 2 - 1);
      ctx.lineTo(x, base - n * amp);
    }
    ctx.lineTo(cw, hor + 2);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, base - amp, 0, hor);
    g.addColorStop(0, rgb(warna, alfa));
    g.addColorStop(1, rgb(campur(warna, [225, 238, 240], 0.55), alfa));
    ctx.fillStyle = g;
    ctx.fill();
  };
  lapis(hor - ch * 0.02, ch * 0.13, 0.006, 3, hx("#86A8B8"), 0.85, true);
  lapis(hor - ch * 0.005, ch * 0.09, 0.009, 9, hx("#6D9A86"), 0.95, false);
  // pohon: banyak gumpalan daun beragam hijau
  const r = acak(7);
  for (let i = 0; i < 150; i++) {
    const x = r() * cw;
    const rad = ch * (0.018 + r() * 0.03);
    const y = hor - rad * (0.2 + r() * 0.6);
    const warna = campur(hx("#2F6A3C"), hx("#6FA04A"), r() * 0.8);
    blob(ctx, x, y, rad, campur(warna, [215, 232, 230], 0.18), 0.95);
  }
  const kabut = ctx.createLinearGradient(0, hor - ch * 0.05, 0, hor + ch * 0.03);
  kabut.addColorStop(0, "rgba(225,240,244,0)");
  kabut.addColorStop(0.7, "rgba(225,240,244,0.32)");
  kabut.addColorStop(1, "rgba(225,240,244,0)");
  ctx.fillStyle = kabut;
  ctx.fillRect(0, hor - ch * 0.05, cw, ch * 0.08);

  // rumput: perspektif, garis potongan, helai, kabut dekat cakrawala
  tulisPiksel(ctx, cw, ch, hor, ch, (x, y) => {
    const t = (y - hor) / (ch - hor);
    const z = 1 / (t + 0.06);
    const potong = Math.floor(z * 1.6) % 2 ? 1.07 : 0.94;
    const helai = 0.9 + 0.12 * derau(x * 1.3, y * 0.9) + 0.12 * derau(x * 0.4, y * 2.4);
    const bercak = 0.94 + 0.12 * fbm(x * 0.02, y * 0.05, 3);
    let c = campur(hx("#3F7D3C"), hx("#6EA845"), sm(0, 1, t) * 0.9);
    const f = potong * helai * bercak;
    c = [c[0] * f, c[1] * f, c[2] * f];
    return campur(c, [214, 232, 232], (1 - sm(0, 0.3, t)) * 0.5);
  });
  // garis kapur
  const gy = hor + (ch - hor) * 0.46;
  const tebal = (ch - hor) * 0.018;
  const kapur = ctx.createLinearGradient(0, gy - tebal, 0, gy + tebal);
  kapur.addColorStop(0, "rgba(255,255,255,0)");
  kapur.addColorStop(0.3, "rgba(250,252,246,0.78)");
  kapur.addColorStop(0.7, "rgba(250,252,246,0.78)");
  kapur.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = kapur;
  ctx.fillRect(0, gy - tebal, cw, tebal * 2);
  // lingkaran tengah (elips karena perspektif)
  ctx.strokeStyle = "rgba(250,252,246,0.7)";
  ctx.lineWidth = tebal * 1.1;
  ctx.beginPath();
  ctx.ellipse(cw * 0.5, ch * 1.06, cw * 0.46, (ch - hor) * 0.5, 0, Math.PI, TAU);
  ctx.stroke();
}

// ───────────────────────── tema 2: senja di tepi danau ─────────────────────────
function lukisSenja(ctx: Ctx, cw: number, ch: number): void {
  const hor = ch * 0.62;
  const sx = cw * 0.66;
  const sy = hor - ch * 0.025;
  const langit: [number, string][] = [
    [0, "#1F2556"],
    [0.3, "#4B3478"],
    [0.55, "#A94874"],
    [0.78, "#E67A58"],
    [1, "#FBC176"],
  ];
  tulisPiksel(ctx, cw, ch, 0, hor, (x, y) => {
    const t = y / hor;
    let c = grad(langit, t);
    const dm = Math.hypot((x - sx) / (cw * 0.55), (y - sy) / (ch * 0.5));
    c = campur(c, hx("#FFD59A"), Math.exp(-dm * dm * 4) * 0.55);
    // awan memanjang tertimpa cahaya: tepi bawah jingga, bagian atas keunguan
    const n = fbm(x * 0.007, y * 0.045 + 2, 5);
    const aw = sm(0.5, 0.74, n) * sm(0.05, 0.3, t) * (1 - sm(0.9, 1, t));
    const cahaya = campur(hx("#4E3470"), hx("#FFB27A"), clamp(t * 1.15 + (1 - dm) * 0.15));
    return campur(c, cahaya, aw * 0.8);
  });
  // matahari: cakram lembut + silau
  blob(ctx, sx, sy, cw * 0.4, [255, 205, 140], 0.5);
  blob(ctx, sx, sy, cw * 0.13, [255, 235, 190], 0.9);
  const cakram = ctx.createRadialGradient(sx, sy, 0, sx, sy, cw * 0.05);
  cakram.addColorStop(0, "#FFF6DC");
  cakram.addColorStop(0.85, "#FFE9B8");
  cakram.addColorStop(1, "rgba(255,225,170,0)");
  ctx.fillStyle = cakram;
  ctx.beginPath();
  ctx.arc(sx, sy, cw * 0.05, 0, TAU);
  ctx.fill();

  // pegunungan berlapis dengan kabut udara
  const gunung = (amp: number, skala: number, fas: number, warna: V3, kabutT: number) => {
    ctx.beginPath();
    ctx.moveTo(0, hor + 1);
    for (let x = 0; x <= cw; x += 2) {
      const n = 1 - Math.abs(fbm(x * skala + fas, fas, 5) * 2 - 1);
      ctx.lineTo(x, hor - Math.pow(n, 1.4) * amp);
    }
    ctx.lineTo(cw, hor + 1);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, hor - amp, 0, hor);
    g.addColorStop(0, rgb(warna));
    g.addColorStop(1, rgb(campur(warna, hx("#F2A67C"), kabutT)));
    ctx.fillStyle = g;
    ctx.fill();
  };
  gunung(ch * 0.2, 0.004, 2, hx("#8A5C86"), 0.55);
  gunung(ch * 0.13, 0.0065, 8, hx("#5A3A70"), 0.45);
  gunung(ch * 0.075, 0.011, 15, hx("#2D2044"), 0.3);

  // danau: pantulan langit, jalur kilau matahari, riak
  tulisPiksel(ctx, cw, ch, hor, ch, (x, y) => {
    const t = (y - hor) / (ch - hor);
    const dasar = grad(
      [
        [0, "#E78F63"],
        [0.18, "#B25C74"],
        [0.6, "#4A3170"],
        [1, "#1D1F4D"],
      ],
      t,
    );
    const riak = derau((x * 0.04) / (0.15 + t), y * 0.9);
    const lajur = Math.exp(-Math.pow((x - sx) / (cw * (0.05 + t * 0.12)), 2));
    const kilau = lajur * sm(0.58, 0.9, riak) * (1 - t * 0.55);
    const gelap = (riak - 0.5) * 0.12;
    const c: V3 = [dasar[0] * (1 + gelap), dasar[1] * (1 + gelap), dasar[2] * (1 + gelap)];
    return campur(c, hx("#FFE2A8"), kilau * 0.85);
  });
  const tepi = ctx.createLinearGradient(0, ch * 0.9, 0, ch);
  tepi.addColorStop(0, "rgba(10,8,26,0)");
  tepi.addColorStop(1, "rgba(10,8,26,0.45)");
  ctx.fillStyle = tepi;
  ctx.fillRect(0, ch * 0.9, cw, ch * 0.1);
}

// ───────────────────────── tema 3: luar angkasa ─────────────────────────
function lukisAngkasa(ctx: Ctx, cw: number, ch: number): void {
  const pusat = hx("#070824");
  const ungu = hx("#5B2A86");
  const tosca = hx("#1F6F8B");
  tulisPiksel(ctx, cw, ch, 0, ch, (x, y) => {
    const a = fbm(x * 0.0055 + 3, y * 0.0055, 5);
    const b = fbm(x * 0.0042 + 40, y * 0.0042 + 11, 5);
    const pita = Math.exp(-Math.pow((y / ch - 0.35 - (x / cw - 0.5) * 0.5) * 3.2, 2));
    const i1 = sm(0.46, 0.8, a) * (0.25 + pita * 0.75);
    const i2 = sm(0.5, 0.82, b) * 0.6;
    return [
      pusat[0] + ungu[0] * i1 * 0.55 + tosca[0] * i2 * 0.4 + 70 * pita * i1,
      pusat[1] + ungu[1] * i1 * 0.55 + tosca[1] * i2 * 0.4 + 25 * pita * i1,
      pusat[2] + ungu[2] * i1 * 0.55 + tosca[2] * i2 * 0.4 + 55 * pita * i1,
    ];
  });
  // bintang: bermacam suhu warna & ukuran, yang terang berpendar
  const r = acak(99);
  const suhu = [hx("#FFE9C8"), hx("#D5E4FF"), hx("#FFFFFF"), hx("#FFD0A6")];
  for (let i = 0; i < 420; i++) {
    const x = r() * cw;
    const y = r() * ch;
    const mag = Math.pow(r(), 3.2);
    const c = suhu[Math.floor(r() * suhu.length)];
    const rad = 0.4 + mag * 1.9;
    if (mag > 0.72) blob(ctx, x, y, rad * 3, c, 0.16);
    ctx.fillStyle = rgb(c, 0.5 + mag * 0.5);
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, TAU);
    ctx.fill();
  }

  // planet bercincin, terang dari kiri-atas, bergaris awan, lingkar atmosfer
  const pr = Math.min(cw * 0.18, ch * 0.1);
  const px = cw * 0.2;
  const py = ch * 0.27;
  const cincin = (depan: boolean) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.3);
    for (let k = 0; k < 7; k++) {
      const rr = pr * (1.5 + k * 0.1);
      ctx.strokeStyle = `rgba(${220 - k * 8},${190 - k * 9},${150 - k * 8},${(0.5 - k * 0.04).toFixed(2)})`;
      ctx.lineWidth = pr * 0.09;
      ctx.beginPath();
      ctx.ellipse(0, 0, rr, rr * 0.28, 0, depan ? 0 : Math.PI, depan ? Math.PI : TAU);
      ctx.stroke();
    }
    ctx.restore();
  };
  cincin(false);
  const bola = (rad: number, warnaPiksel: (u: number, v: number, z: number) => [number, number, number, number]) => {
    const ukur = Math.ceil(rad * 2 + 4);
    const sp = kanvas(ukur, ukur);
    const sc = sp.getContext("2d");
    if (!sc) return sp;
    const img = sc.createImageData(ukur, ukur);
    for (let j = 0; j < ukur; j++) {
      for (let i = 0; i < ukur; i++) {
        const u = ((i + 0.5) / ukur) * 2 - 1;
        const v = ((j + 0.5) / ukur) * 2 - 1;
        const d = Math.hypot(u, v);
        if (d >= 1) continue;
        const z = Math.sqrt(1 - d * d);
        const c = warnaPiksel(u, v, z);
        const k = (j * ukur + i) * 4;
        img.data[k] = c[0];
        img.data[k + 1] = c[1];
        img.data[k + 2] = c[2];
        img.data[k + 3] = c[3] * clamp((1 - d) * ukur * 0.5);
      }
    }
    sc.putImageData(img, 0, 0);
    return sp;
  };
  const planet = bola(pr, (u, v, z) => {
    const lam = clamp((u * -0.55 + v * -0.6 + z * 0.58) / 0.98);
    const pita = fbm(u * 0.6 + 5, v * 3.2 + fbm(u * 2, v * 2, 3) * 0.7, 4);
    const c = campur(hx("#C46A45"), hx("#EBB27E"), pita);
    const f = 0.12 + 0.95 * Math.pow(lam, 0.9);
    const rim = Math.pow(1 - z, 3) * 0.55;
    return [clamp(c[0] * f + 60 * rim, 0, 255), clamp(c[1] * f + 90 * rim, 0, 255), clamp(c[2] * f + 130 * rim, 0, 255), 255];
  });
  blob(ctx, px, py, pr * 1.5, [255, 170, 120], 0.12);
  ctx.drawImage(planet, px - planet.width / 2, py - planet.height / 2);
  cincin(true);

  // bulan berkawah, hanya sebagian terang
  const mr = Math.min(cw * 0.07, ch * 0.04);
  const mx = cw * 0.82;
  const my = ch * 0.17;
  const bulan = bola(mr, (u, v, z) => {
    const lam = clamp(u * 0.82 - v * 0.2 + z * 0.35);
    const kawah = fbm(u * 4 + 7, v * 4 + 3, 4);
    const c = campur(hx("#9B9A9E"), hx("#E6E2D6"), kawah);
    const f = 0.05 + 1.05 * Math.pow(lam, 0.8);
    return [c[0] * f, c[1] * f, c[2] * f * 0.97, 255];
  });
  blob(ctx, mx, my, mr * 3, [200, 210, 255], 0.1);
  ctx.drawImage(bulan, mx - bulan.width / 2, my - bulan.height / 2);
}

// ───────────────────────── gudang & penggambar ─────────────────────────
const LUKIS = [lukisKamar, lukisLapangan, lukisSenja, lukisAngkasa];

interface Gudang {
  w: number;
  h: number;
  skala: number;
  tema: (HTMLCanvasElement | null)[];
  awanSiang: HTMLCanvasElement[];
  awanSenja: HTMLCanvasElement[];
  butir: HTMLCanvasElement | null;
}
let gudang: Gudang | null = null;

function pastikan(w: number, h: number): Gudang {
  const wr = Math.round(w);
  const hr = Math.round(h);
  if (!gudang || gudang.w !== wr || gudang.h !== hr) {
    gudang = { w: wr, h: hr, skala: Math.min(1, 620 / Math.max(wr, hr)), tema: [null, null, null, null], awanSiang: [], awanSenja: [], butir: null };
  }
  return gudang;
}

function bangunTema(g: Gudang, i: number): HTMLCanvasElement {
  let c = g.tema[i];
  if (c) return c;
  const cw = Math.max(40, Math.round(g.w * g.skala));
  const ch = Math.max(40, Math.round(g.h * g.skala));
  c = kanvas(cw, ch);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (ctx) LUKIS[i](ctx, cw, ch);
  g.tema[i] = c;
  return c;
}

/** Melukis suasana yang belum jadi lebih dulu (sekali per ukuran layar) supaya peralihan tak tersendat. */
export function siapkanLatar(w: number, h: number, i: number): void {
  if (!w || !h) return;
  bangunTema(pastikan(w, h), i);
}

function butirFilm(): HTMLCanvasElement {
  const c = kanvas(128, 128);
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) {
    const v = Math.random() * 255;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// bagian bergerak tiap suasana
function hidup(ctx: Ctx, g: Gudang, i: number, w: number, h: number, t: number): void {
  if (i === 0) {
    // debu melayang di dalam sinar jendela
    const ww = Math.min(w * 0.34, h * 0.3);
    const wx = w * 0.08;
    const wy = h * 0.08 + ww * 1.3;
    const r = acak(3);
    for (let k = 0; k < 18; k++) {
      const u = r();
      const v = r();
      const lambat = 0.4 + r();
      const fase = (v + t * 0.012 * lambat) % 1;
      const x = wx + ww * (0.1 + u * 1.9) + Math.sin(t * 0.4 + k) * 6;
      const y = wy + (h * 0.9 - wy) * fase * 0.95;
      const a = 0.35 * Math.sin(fase * Math.PI);
      ctx.fillStyle = `rgba(255,240,200,${Math.max(0, a).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.9 + r() * 1.3, 0, TAU);
      ctx.fill();
    }
  } else if (i === 1) {
    if (!g.awanSiang.length) g.awanSiang = [buatAwan(hx("#FFFFFF"), hx("#A9BCD2"), 1), buatAwan(hx("#FFFFFF"), hx("#B4C4D8"), 2), buatAwan(hx("#FDFEFF"), hx("#9FB3CC"), 3)];
    for (let k = 0; k < 3; k++) {
      const lebar = w * (0.26 + k * 0.06);
      const x = ((t * (4 + k * 2.2) + k * w * 0.45) % (w + lebar * 1.2)) - lebar * 0.6;
      ctx.globalAlpha = 0.88;
      ctx.drawImage(g.awanSiang[k], x, h * (0.02 + k * 0.09), lebar, lebar * 0.42);
    }
    ctx.globalAlpha = 1;
  } else if (i === 2) {
    if (!g.awanSenja.length) g.awanSenja = [buatAwan(hx("#FFC59B"), hx("#6E3F73"), 5), buatAwan(hx("#FFD2A8"), hx("#7C4678"), 6)];
    for (let k = 0; k < 2; k++) {
      const lebar = w * (0.55 + k * 0.15);
      const x = ((t * (3 + k * 2) + k * w * 0.6) % (w + lebar * 1.2)) - lebar * 0.6;
      ctx.globalAlpha = 0.6;
      ctx.drawImage(g.awanSenja[k], x, h * (0.16 + k * 0.1), lebar, lebar * 0.4);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(28,18,40,0.85)";
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    for (let k = 0; k < 5; k++) {
      const bx = ((t * (20 + k * 3) + k * 80) % (w + 80)) - 40;
      const by = h * 0.34 + k * 14 + Math.sin(t * 1.6 + k) * 6;
      const sayap = Math.sin(t * 8 + k * 2) * 3.5;
      ctx.beginPath();
      ctx.moveTo(bx - 9, by - sayap);
      ctx.quadraticCurveTo(bx - 3, by - 4, bx, by);
      ctx.quadraticCurveTo(bx + 3, by - 4, bx + 9, by - sayap);
      ctx.stroke();
    }
  } else {
    const r = acak(77);
    for (let k = 0; k < 45; k++) {
      const x = r() * w;
      const y = r() * h;
      const a = 0.3 + 0.7 * Math.abs(Math.sin(t * (0.8 + r() * 1.8) + k));
      ctx.fillStyle = `rgba(255,248,230,${a.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.7 + r() * 1.1, 0, TAU);
      ctx.fill();
      if (a > 0.9 && r() > 0.7) {
        ctx.strokeStyle = `rgba(255,248,230,${((a - 0.8) * 2).toFixed(2)})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x - 4, y);
        ctx.lineTo(x + 4, y);
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x, y + 4);
        ctx.stroke();
      }
    }
    const s = (t % 11) / 11;
    if (s < 0.1) {
      const k = s / 0.1;
      const x = w * 0.78 - k * w * 0.3;
      const y = h * 0.06 + k * h * 0.2;
      const gl = ctx.createLinearGradient(x, y, x + 70, y - 28);
      gl.addColorStop(0, `rgba(255,252,240,${(1 - k).toFixed(2)})`);
      gl.addColorStop(1, "rgba(255,252,240,0)");
      ctx.strokeStyle = gl;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 70, y - 28);
      ctx.stroke();
    }
  }
}

function gambarSatu(ctx: Ctx, g: Gudang, i: number, w: number, h: number, t: number): void {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bangunTema(g, i), 0, 0, w, h);
  hidup(ctx, g, i, w, h, t);
}

/** Tema `dari` penuh sebagai dasar; tema `ke` memudar masuk di atasnya dengan kemajuan `p` (0..1). */
export function gambarLatar(ctx: Ctx, w: number, h: number, dari: number, ke: number, p: number, t: number): void {
  const g = pastikan(w, h);
  gambarSatu(ctx, g, dari, w, h, t);
  if (ke !== dari && p > 0.004) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, p);
    gambarSatu(ctx, g, ke, w, h, t);
    ctx.restore();
  }
  // vinyet lembut + butiran film tipis: menyatukan semuanya seperti foto/lukisan
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(5,3,12,0.38)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  if (!g.butir) g.butir = butirFilm();
  const pola = ctx.createPattern(g.butir, "repeat");
  if (pola) {
    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = pola;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
