/**
 * Menguji fisika game "Tanjakan Robo" (murni, tanpa server): mobil diam stabil di tanah datar, gas menggerakkan, rem
 * menghentikan, bensin berkurang & habis, kepala menyentuh tanah = jatuh, koin & kaleng bensin terambil, tanah tak terlalu
 * curam, dan tidak pernah menghasilkan NaN walau dipukul masukan acak.
 *
 *   npx tsx scripts/verify-tanjakan.ts
 */
import { check, finish } from "./checks";
import {
  BENSIN_AWAL,
  KECEPATAN_MAKS,
  bensinDi,
  duniaBaru,
  koinDi,
  landai,
  langkah,
  tanah,
  type Dunia,
  type Masukan,
} from "../frontend/src/lib/syrobo/game/tanjakanFisika";

const DT = 1 / 120;
function jalan(d: Dunia, detik: number, m: Masukan | ((t: number) => Masukan)) {
  const n = Math.round(detik / DT);
  for (let i = 0; i < n && !d.selesai; i++) langkah(d, typeof m === "function" ? m(i * DT) : m, DT);
}
const sehat = (d: Dunia) => [d.x, d.y, d.a, d.vx, d.vy, d.w].every(Number.isFinite);

console.log("\nTanah");
let curam = 0;
for (let x = 0; x < 300000; x += 3) curam = Math.max(curam, Math.abs(landai(x)));
check("kemiringan tanah dibatasi (< 0,95 atau 43°) sejauh 300 km", curam < 0.95, curam.toFixed(2));
check("awal lintasan datar (x < 300)", Math.abs(landai(100)) < 1e-9 && Math.abs(tanah(50) - tanah(250)) < 1e-6, "datar");
check("deterministik (dua kali panggil sama)", tanah(12345.6) === tanah(12345.6), "sama");

console.log("\nKendaraan");
const diam = duniaBaru();
jalan(diam, 3, { gas: false, rem: false });
check("diam di tanah datar: stabil, tegak, tidak jatuh", !diam.selesai && Math.abs(diam.vy) < 8 && Math.abs(diam.a) < 0.12 && Math.abs(diam.vx) < 8 && sehat(diam), `a=${diam.a.toFixed(3)} vy=${diam.vy.toFixed(1)} vx=${diam.vx.toFixed(1)}`);
check("kedua roda menapak & pegas tertekan wajar", diam.roda.every((r) => r.kontak && r.komp > 1 && r.komp < 14), diam.roda.map((r) => r.komp.toFixed(1)).join("/"));

const maju = duniaBaru();
jalan(maju, 4, { gas: true, rem: false });
check("gas: maju > 250 px dalam 4 dtk, jarak tercatat", maju.x > 180 + 250 && maju.jarak > 5 && !maju.selesai, `x=${maju.x.toFixed(0)} jarak=${maju.jarak}`);
check("kecepatan tak melampaui batas", Math.hypot(maju.vx, maju.vy) < KECEPATAN_MAKS * 1.15, Math.hypot(maju.vx, maju.vy).toFixed(0));
const boros = duniaBaru();
jalan(boros, 2, { gas: true, rem: false });
check("bensin berkurang saat gas (±7 per dtk)", boros.bensin < BENSIN_AWAL - 10 && boros.bensin > BENSIN_AWAL - 18, boros.bensin.toFixed(1));

// Menanjak dari DIAM di kaki bukit yang landai-curam (mobil harus kuat, tidak melorot atau terguling)
let kaki = -1;
for (let x = 900; x < 40000 && kaki < 0; x += 5) {
  let rata = 0;
  for (let k = 0; k < 40; k++) rata += landai(x + k * 5);
  if (rata / 40 < -0.38 && landai(x - 20) > -0.15) kaki = x;
}
const tanjak = duniaBaru();
tanjak.x = kaki;
tanjak.y = tanah(kaki) - 55;
jalan(tanjak, 1.2, { gas: false, rem: false });
const x0 = tanjak.x;
jalan(tanjak, 4, { gas: true, rem: false });
check("menanjak dari diam di kaki bukit (rata-rata landai ≥ 0,38): maju > 140 px, tidak jatuh", kaki > 0 && tanjak.x - x0 > 140 && !tanjak.selesai, `kaki=${kaki} maju=${(tanjak.x - x0).toFixed(0)}`);
const datarCepat = duniaBaru();
jalan(datarCepat, 2.4, { gas: true, rem: false });
let vMaks = 0;
const lari = duniaBaru();
for (let i = 0; i < 120 * 12 && !lari.selesai; i++) {
  langkah(lari, { gas: true, rem: false }, DT);
  vMaks = Math.max(vMaks, Math.hypot(lari.vx, lari.vy));
}
check("kecepatan puncak 12 dtk gas penuh tetap wajar (< 620 px/dtk)", vMaks < 620, vMaks.toFixed(0));

const rem = duniaBaru();
jalan(rem, 2.5, { gas: true, rem: false });
const sebelum = Math.hypot(rem.vx, rem.vy);
jalan(rem, 3, { gas: false, rem: true });
check("rem memperlambat tajam (dari ±" + sebelum.toFixed(0) + ")", !rem.selesai && Math.hypot(rem.vx, rem.vy) < sebelum * 0.4, Math.hypot(rem.vx, rem.vy).toFixed(0));

const mundur = duniaBaru();
jalan(mundur, 0.6, { gas: false, rem: false });
jalan(mundur, 2, { gas: false, rem: true });
check("rem dari diam = mundur pelan di tanah datar", mundur.vx < -5 || mundur.x < 180, `vx=${mundur.vx.toFixed(1)}`);

console.log("\nGagal & pengambilan");
const terbalik = duniaBaru();
terbalik.y -= 120;
terbalik.a = Math.PI;
jalan(terbalik, 3, { gas: false, rem: false });
check("jatuh terbalik: kepala menyentuh tanah = selesai 'jatuh'", terbalik.selesai === "jatuh", String(terbalik.selesai));

const kosong = duniaBaru();
kosong.bensin = 4;
jalan(kosong, 40, { gas: true, rem: false });
check("bensin habis lalu berhenti = selesai 'bensin' (atau jatuh di jalan)", kosong.selesai !== null && kosong.bensin === 0, `${kosong.selesai} bensin=${kosong.bensin.toFixed(2)}`);
const tanpaBensin = duniaBaru();
tanpaBensin.bensin = 0;
jalan(tanpaBensin, 1, { gas: true, rem: false });
check("tanpa bensin gas tak menggerakkan", Math.abs(tanpaBensin.vx) < 20, tanpaBensin.vx.toFixed(1));

const koin = duniaBaru();
const k0 = koinDi(0);
koin.x = k0.x;
koin.y = k0.y;
koin.vy = 0;
langkah(koin, { gas: false, rem: false }, DT);
check("koin di dekat mobil terambil sekali saja", koin.koin === 1 && (langkah(koin, { gas: false, rem: false }, DT), koin.koin === 1), String(koin.koin));
const kaleng = duniaBaru();
kaleng.bensin = 20;
const b0 = bensinDi(0);
kaleng.x = b0.x;
kaleng.y = b0.y;
langkah(kaleng, { gas: false, rem: false }, DT);
check("kaleng bensin menambah 45 (maks 100)", kaleng.bensin > 60 && kaleng.bensin <= 100, kaleng.bensin.toFixed(1));

console.log("\nKetahanan");
let rusak = 0;
for (let percobaan = 0; percobaan < 12; percobaan++) {
  const d = duniaBaru();
  const bibit = percobaan * 7.3 + 1;
  jalan(d, 60, (t) => ({ gas: Math.sin(t * 1.7 + bibit) > -0.3, rem: Math.sin(t * 0.9 + bibit * 2) > 0.7 }));
  if (!sehat(d)) rusak++;
}
check("12 putaran masukan acak 60 dtk: tak pernah NaN/tak terhingga", rusak === 0, `${rusak} rusak`);

const terus = duniaBaru();
jalan(terus, 90, { gas: true, rem: false });
check("gas terus 90 dtk: tetap sah dan menempuh jauh (selesai karena jatuh/bensin tidak masalah)", sehat(terus) && terus.x > 1500, `x=${terus.x.toFixed(0)} selesai=${terus.selesai}`);

finish();
