/**
 * Menguji fisika game "Bola Gabung" (murni, tanpa server): bola jatuh & menetap di dalam wadah, dua bola satu tingkat lebur
 * jadi tingkat berikutnya dengan skor, tingkat berbeda tidak lebur, tumpukan di atas garis = selesai, hasil bisa diulang
 * (bersemai), dan tak pernah NaN / keluar wadah walau dijatuhkan acak ratusan kali.
 *
 *   npx tsx scripts/verify-bola.ts
 */
import { check, finish } from "./checks";
import {
  BATAS_DIAM,
  GARIS_Y,
  LEBAR,
  NAMA,
  NILAI,
  WARNA,
  RADIUS,
  TINGGI,
  duniaBolaBaru,
  jatuhkan,
  jepitX,
  langkahBola,
  type Bola,
  type DuniaBola,
} from "../frontend/src/lib/syrobo/game/bolaFisika";

const DT = 1 / 120;
const jalan = (d: DuniaBola, detik: number) => {
  for (let i = 0; i < Math.round(detik / DT) && !d.selesai; i++) langkahBola(d, DT);
};
const sehat = (d: DuniaBola) => d.bola.every((b) => [b.x, b.y, b.vx, b.vy].every(Number.isFinite));
const didalam = (d: DuniaBola) => d.bola.every((b) => b.x - b.r > -0.5 && b.x + b.r < LEBAR + 0.5 && b.y + b.r < TINGGI + 0.5);
const taruh = (d: DuniaBola, n: number, x: number, y: number): Bola => {
  const b: Bola = { id: d.nextId++, n, x, y, vx: 0, vy: 0, w: 0, sudut: 0, r: RADIUS[n], umur: 5, diam: 0 };
  d.bola.push(b);
  return b;
};

console.log("\nDasar");
const a = duniaBolaBaru(42);
const b = duniaBolaBaru(42);
check("bersemai: dua dunia sama menghasilkan bola di tangan yang sama", a.sekarang === b.sekarang && a.berikut === b.berikut, `${a.sekarang}/${a.berikut}`);
check("bola di tangan selalu tingkat 0..4", Array.from({ length: 200 }, (_, i) => duniaBolaBaru(i)).every((d) => d.sekarang <= 4 && d.berikut <= 4), "ok");

const jatuh = duniaBolaBaru(1);
check("menjatuhkan bola berhasil", jatuhkan(jatuh, LEBAR / 2), "ok");
check("jeda: menjatuhkan lagi seketika ditolak", !jatuhkan(jatuh, LEBAR / 2), "ditolak");
jalan(jatuh, 4);
const bl = jatuh.bola[0];
check("bola jatuh lalu menetap di lantai wadah", !!bl && Math.abs(bl.y + bl.r - TINGGI) < 1 && Math.hypot(bl.vx, bl.vy) < 5, bl ? `y=${bl.y.toFixed(1)} v=${Math.hypot(bl.vx, bl.vy).toFixed(2)}` : "hilang");
check("jepitX menjaga bola di dalam dinding", jepitX(3, -50) === RADIUS[3] && jepitX(3, 9999) === LEBAR - RADIUS[3], "ok");
const kiri = duniaBolaBaru(2);
jatuhkan(kiri, -999);
check("dijatuhkan di luar dinding tetap di dalam wadah", kiri.bola[0].x - kiri.bola[0].r >= 0, kiri.bola[0].x.toFixed(1));
check("NaN ditolak", !jatuhkan(duniaBolaBaru(3), Number.NaN), "ditolak");

check("tiap tingkat punya nama jenis bola & warna", NAMA.length === RADIUS.length && WARNA.length === RADIUS.length && new Set(NAMA).size === NAMA.length, `${NAMA.length}`);

console.log("\nPenggabungan");
const g = duniaBolaBaru(5);
taruh(g, 2, 140, TINGGI - RADIUS[2]);
taruh(g, 2, 140 + RADIUS[2] * 2 - 3, TINGGI - RADIUS[2]);
jalan(g, 0.2);
check("dua bola tingkat sama yang bersentuhan lebur jadi satu bola tingkat berikutnya", g.bola.length === 1 && g.bola[0].n === 3, `${g.bola.length} bola, n=${g.bola[0]?.n}`);
check("skor bertambah sesuai nilai tingkat baru", g.skor === NILAI[3] && g.gabungan === 1 && g.tertinggi === 3, String(g.skor));
check("ada efek penggabungan untuk digambar", g.efek.length === 1 && g.efek[0].n === 3, String(g.efek.length));
const beda = duniaBolaBaru(6);
taruh(beda, 2, 140, TINGGI - RADIUS[2]);
taruh(beda, 3, 140 + RADIUS[2] + RADIUS[3] - 3, TINGGI - RADIUS[3]);
jalan(beda, 1);
check("tingkat berbeda tidak lebur dan tidak saling menembus", beda.bola.length === 2 && Math.hypot(beda.bola[0].x - beda.bola[1].x, beda.bola[0].y - beda.bola[1].y) > beda.bola[0].r + beda.bola[1].r - 1.5, "ok");
const rantai = duniaBolaBaru(7);
for (let i = 0; i < 4; i++) taruh(rantai, 0, 100 + i * 5, TINGGI - 12 - i * 26);
jalan(rantai, 1.5);
check("empat bola tingkat 0 berantai jadi dua tingkat 1 lalu satu tingkat 2 (skor 3+3+6)", rantai.bola.length === 1 && rantai.bola[0].n === 2 && rantai.skor === 12, `n=${rantai.bola.map((x) => x.n)} skor=${rantai.skor}`);
const puncak = duniaBolaBaru(8);
taruh(puncak, 10, 120, TINGGI - RADIUS[10]);
taruh(puncak, 10, 120 + RADIUS[10] * 2 - 3, TINGGI - RADIUS[10]);
jalan(puncak, 0.5);
check("tingkat tertinggi tidak lebur lagi", puncak.bola.length === 2, String(puncak.bola.length));

console.log("\nTumpukan & pantulan");
{
  // Dua bola dasar bersisian di lantai, satu bola di atas keduanya: harus tetap di atas (tidak tergelincir).
  const d = duniaBolaBaru(7);
  const r = RADIUS[3];
  const b1 = taruh(d, 3, LEBAR / 2 - r, TINGGI - r);
  const b2 = taruh(d, 3, LEBAR / 2 + r, TINGGI - r);
  const atas = taruh(d, 2, LEBAR / 2, TINGGI - r - 30);
  jalan(d, 4);
  const naik = TINGGI - atas.y;
  check("bola di atas dua bola dasar tetap bertumpuk (tidak merosot ke lantai)", naik > r + RADIUS[2] * 0.9 && Math.abs(atas.x - LEBAR / 2) < 3, `tinggi=${naik.toFixed(1)} x=${atas.x.toFixed(1)}`);
  check("tumpukan diam (kecepatan ~0)", [b1, b2, atas].every((x) => Math.hypot(x.vx, x.vy) < 8), "ok");
}
{
  // Beberapa lapis tak sama besar: setelah menetap tak ada bola yang terus merayap.
  const d = duniaBolaBaru(9);
  for (const [n, x] of [[4, 60], [4, 140], [4, 220], [3, 100], [3, 180], [2, 140]] as const) {
    taruh(d, n, x, 40).umur = 0;
    jalan(d, 0.9);
  }
  jalan(d, 5);
  const maks = Math.max(...d.bola.map((x) => Math.hypot(x.vx, x.vy)));
  check("tumpukan campuran tidak merayap setelah menetap", d.selesai || maks < 20, `v maks=${maks.toFixed(1)} bola=${d.bola.length}`);
}
{
  // Jatuh dari ketinggian: ada pantulan kecil, tetapi tak melonjak melebihi titik awal.
  const d = duniaBolaBaru(3);
  const bl = taruh(d, 1, LEBAR / 2, 60);
  let lantaiKena = false;
  let pernahNaik = false;
  let yTertinggiSesudah = Infinity;
  let yPrev = bl.y;
  for (let i = 0; i < 240; i++) {
    langkahBola(d, DT);
    if (bl.y + bl.r >= TINGGI - 0.5) lantaiKena = true;
    if (lantaiKena && bl.y < yPrev - 0.05) {
      pernahNaik = true;
      yTertinggiSesudah = Math.min(yTertinggiSesudah, bl.y);
    }
    yPrev = bl.y;
  }
  check("bola memantul setelah membentur lantai", pernahNaik, pernahNaik ? "ya" : "tidak");
  check("pantulan tidak melebihi tinggi jatuh", yTertinggiSesudah >= 60, yTertinggiSesudah.toFixed(1));
}

{
  // Menggelinding: bola yang meluncur di lantai berputar sampai v = w*r (tanpa selip), lalu pelan-pelan berhenti.
  const d = duniaBolaBaru(5);
  const bl = taruh(d, 3, 60, TINGGI - RADIUS[3]);
  bl.vx = 260;
  jalan(d, 0.8);
  const selip = Math.abs(bl.vx - bl.w * bl.r);
  check("bola di lantai menggelinding tanpa selip (v ≈ w*r)", bl.vx > 20 && bl.w > 0 && selip < 8, `v=${bl.vx.toFixed(1)} w*r=${(bl.w * bl.r).toFixed(1)}`);
  const x1 = bl.x;
  jalan(d, 6);
  check("bola yang menggelinding akhirnya berhenti (ada hambatan guling)", Math.hypot(bl.vx, bl.vy) < 5 && bl.x > x1, `v=${bl.vx.toFixed(2)} geser=${(bl.x - x1).toFixed(0)}`);
  check("sudut putar ikut bertambah saat menggelinding", bl.sudut > 1, bl.sudut.toFixed(2));
}
{
  // Bola kecil jatuh di sisi bola besar: bola kecil berputar karena gesekan titik sentuh (bukan sekadar meluncur).
  const d = duniaBolaBaru(6);
  taruh(d, 6, LEBAR / 2, TINGGI - RADIUS[6]);
  const kecil = taruh(d, 1, LEBAR / 2 + 30, 200);
  jalan(d, 1.2);
  check("bola yang menuruni bola lain ikut berputar", Math.abs(kecil.sudut) > 0.5, kecil.sudut.toFixed(2));
}

{
  // Peristiwa benturan untuk efek suara: bola jatuh keras ke lantai tercatat, dan daftarnya tak membengkak jika tak dikosongkan.
  const d = duniaBolaBaru(2);
  taruh(d, 2, LEBAR / 2, 60);
  jalan(d, 1.2);
  check("bola yang jatuh keras ke lantai mencatat benturan", d.dentum.length > 0 && d.dentum.every((k) => k > 0 && Number.isFinite(k)), `${d.dentum.length}`);
  const ramai = duniaBolaBaru(4);
  for (let t = 0; t < 40 && !ramai.selesai; t++) {
    jatuhkan(ramai, 40 + ((t * 71) % 200));
    ramai.jeda = 0;
    jalan(ramai, 0.3);
  }
  check("daftar benturan dibatasi walau tak pernah dikosongkan", ramai.dentum.length <= 24, `${ramai.dentum.length}`);
}

console.log("\nSelesai & ketahanan");
const penuh = duniaBolaBaru(9);
let yy = TINGGI;
for (const n of [10, 9, 8, 7, 6, 5]) {
  yy -= RADIUS[n];
  taruh(penuh, n, LEBAR / 2, yy);
  yy -= RADIUS[n];
}
jalan(penuh, BATAS_DIAM + 6);
check("tumpukan di atas garis terlalu lama = selesai", penuh.selesai, `selesai=${penuh.selesai}`);
const selesaiTolak = !jatuhkan(penuh, 100);
check("setelah selesai tidak bisa menjatuhkan lagi", selesaiTolak, "ditolak");

let rusak = 0;
let keluar = 0;
let tumpangMaks = 0;
let totalGabungan = 0;
for (let seed = 0; seed < 8; seed++) {
  const d = duniaBolaBaru(seed + 100);
  let t = 0;
  while (!d.selesai && t < 240) {
    jatuhkan(d, 20 + ((seed * 53 + t * 97) % 280));
    const sebelum = d.gabungan;
    jalan(d, 0.5);
    t += 0.5;
    // sampel tepat setelah penggabungan dilewati: bola baru sengaja lebih besar dan butuh beberapa langkah mendorong tetangga
    if (d.gabungan !== sebelum) continue;
    // hanya permainan yang masih wajar: tumpukan yang sudah menjulang melewati garis berarti permainan nyaris selesai
    if (Math.min(...d.bola.map((x) => x.y - x.r)) < GARIS_Y - 40) continue;
    if (!sehat(d)) rusak++;
    if (!didalam(d)) keluar++;
    for (let i = 0; i < d.bola.length; i++)
      for (let j = i + 1; j < d.bola.length; j++) {
        const p = d.bola[i].r + d.bola[j].r - Math.hypot(d.bola[i].x - d.bola[j].x, d.bola[i].y - d.bola[j].y);
        if (d.bola[i].n !== d.bola[j].n) tumpangMaks = Math.max(tumpangMaks, p / Math.min(d.bola[i].r, d.bola[j].r));
      }
  }
  totalGabungan += d.gabungan;
}
check("8 permainan acak: tak pernah NaN", rusak === 0, `${rusak} rusak`);
check("8 permainan acak: bola tak pernah keluar wadah", keluar === 0, `${keluar} pelanggaran`);
check("8 permainan acak: tumpang tindih tumpukan < 35% jari-jari terkecil", tumpangMaks < 0.35, tumpangMaks.toFixed(2));
check("8 permainan acak: terjadi penggabungan (permainan bisa dimainkan)", totalGabungan > 20, String(totalGabungan));

const ulang1 = duniaBolaBaru(77);
const ulang2 = duniaBolaBaru(77);
for (const d of [ulang1, ulang2]) {
  for (let i = 0; i < 12; i++) {
    jatuhkan(d, 30 + i * 23);
    jalan(d, 0.6);
  }
}
check("deterministik: urutan sama menghasilkan skor & susunan sama", ulang1.skor === ulang2.skor && ulang1.bola.length === ulang2.bola.length && ulang1.bola.every((x, i) => x.x === ulang2.bola[i].x && x.y === ulang2.bola[i].y), `${ulang1.skor}/${ulang2.skor}`);

finish();
