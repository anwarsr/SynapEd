/**
 * Menguji fisika game "Lari Robo" (murni, tanpa server): hasil bisa diulang (bersemai), loncat/tunduk/dash bekerja sesuai aturan,
 * tiap jenis rintangan BISA dilewati dengan aksi yang dimaksud (dan menabrak bila salah aksi), jeda dash, skor tak bisa
 * digelembungkan dash, jarak antarrintangan adil, dan tak pernah NaN. Pemain tiruan memakai simulasi ke depan untuk memilih aksi.
 *
 *   npx tsx scripts/verify-lari.ts
 */
import { check, finish } from "./checks";
import {
  BERDIRI,
  DASH_DURASI,
  DASH_JEDA,
  GRAV,
  LONCAT_V,
  JARAK_KOIN_RINTANGAN,
  PX,
  SKOR_PX,
  TANAH,
  V_AWAL,
  V_MAKS,
  duniaLariBaru,
  jarakKeKotak,
  kotakRobot,
  langkahLari,
  type DuniaLari,
  type MasukanLari,
  type TipeRintangan,
} from "../frontend/src/lib/syrobo/game/lariFisika";

const DT = 1 / 120;
const DIAM: MasukanLari = { loncat: false, tunduk: false, dash: false };
const salin = (d: DuniaLari): DuniaLari => ({ ...d, rintangan: d.rintangan.map((o) => ({ ...o })), koinList: [], bunyi: [] });
const jalan = (d: DuniaLari, detik: number, m: MasukanLari | ((d: DuniaLari) => MasukanLari) = DIAM) => {
  for (let i = 0; i < Math.round(detik / DT) && !d.selesai; i++) {
    langkahLari(d, typeof m === "function" ? m(d) : m, DT);
    d.bunyi.length = 0;
  }
};
const sehat = (d: DuniaLari) => [d.t, d.jarak, d.skor, d.y, d.vy, d.v].every(Number.isFinite);

/** Dunia berisi SATU rintangan jenis `tipe` tepat di depan robot (pola bawaan dibuang). */
function duniaSatu(tipe: TipeRintangan, jarakDepan = 420): DuniaLari {
  const d = duniaLariBaru(1);
  d.rintangan = [];
  d.koinList = [];
  d.ujung = 1e9; // tak membangkitkan pola lain
  const ukuran: Record<TipeRintangan, [number, number]> = { peti: [40, 40], tinggi: [40, 72], duri: [60, 24], drone: [50, 34], tembok: [18, 180] };
  const [w, h] = ukuran[tipe];
  const y = tipe === "drone" ? TANAH - 40 - 34 : TANAH - h;
  d.rintangan.push({ id: 1, tipe, x: PX + jarakDepan, y, w, h, hancur: false });
  return d;
}

console.log("\nDasar");
const a = duniaLariBaru(7);
const b = duniaLariBaru(7);
jalan(a, 20, DIAM);
jalan(b, 20, DIAM);
check("bersemai: dua dunia sama menghasilkan rintangan sama", JSON.stringify(a.rintangan) === JSON.stringify(b.rintangan) && a.jarak === b.jarak, `${a.rintangan.length}`);
const diam = duniaLariBaru(3);
jalan(diam, 12, DIAM);
check("tak berbuat apa-apa: robot menabrak rintangan pertama", diam.selesai === "tabrak", String(diam.selesai));
check("kecepatan dasar naik tiap detik tapi tak melewati batas", (() => {
  const d = duniaLariBaru(9);
  d.t = 1000;
  langkahLari(d, DIAM, DT);
  return d.vDasar === V_MAKS;
})(), String(V_MAKS));

console.log("\nLoncat");
{
  const d = duniaLariBaru(1);
  d.ujung = 1e9;
  let puncak = 0;
  for (let i = 0; i < 100; i++) {
    langkahLari(d, { loncat: true, tunduk: false, dash: false }, DT);
    puncak = Math.max(puncak, TANAH - d.y);
  }
  const teoritis = (LONCAT_V * LONCAT_V) / (2 * GRAV);
  check("loncat ditahan: ketinggian ≈ v²/2g (±8%)", Math.abs(puncak - teoritis) < teoritis * 0.08, `${puncak.toFixed(1)} / ${teoritis.toFixed(1)}`);
  const e = duniaLariBaru(1);
  e.ujung = 1e9;
  let pendek = 0;
  for (let i = 0; i < 100; i++) {
    langkahLari(e, { loncat: i < 4, tunduk: false, dash: false }, DT);
    pendek = Math.max(pendek, TANAH - e.y);
  }
  check("loncat singkat (tombol cepat dilepas) lebih rendah dari loncat ditahan", pendek < puncak * 0.6 && pendek > 8, `${pendek.toFixed(1)}`);
  const f = duniaLariBaru(1);
  f.ujung = 1e9;
  jalan(f, 0.5, { loncat: true, tunduk: false, dash: false });
  check("tak bisa loncat ganda di udara (tombol ditekan lagi di puncak)", (() => {
    const g = duniaLariBaru(1);
    g.ujung = 1e9;
    jalan(g, 0.1, { loncat: true, tunduk: false, dash: false });
    jalan(g, 0.12, DIAM);
    const vSebelum = g.vy;
    langkahLari(g, { loncat: true, tunduk: false, dash: false }, DT);
    return g.vy > vSebelum - 1;
  })(), "ok");
  const t = duniaLariBaru(1);
  t.ujung = 1e9;
  jalan(t, 0.2, { loncat: true, tunduk: false, dash: false });
  jalan(t, 0.2, DIAM);
  const yAtas = t.y;
  jalan(t, 0.1, { loncat: false, tunduk: true, dash: false });
  const turunTunduk = t.y - yAtas;
  const u = duniaLariBaru(1);
  u.ujung = 1e9;
  jalan(u, 0.2, { loncat: true, tunduk: false, dash: false });
  jalan(u, 0.2, DIAM);
  const yAtas2 = u.y;
  jalan(u, 0.1, DIAM);
  check("tunduk di udara = jatuh lebih cepat", turunTunduk > (u.y - yAtas2) * 1.15, `${turunTunduk.toFixed(1)} vs ${(u.y - yAtas2).toFixed(1)}`);
}

console.log("\nTunduk & rintangan");
{
  const kotakBerdiri = kotakRobot(duniaLariBaru(1));
  const dt = duniaLariBaru(1);
  jalan(dt, 0.05, { loncat: false, tunduk: true, dash: false });
  check("tunduk di tanah memendekkan hitbox", kotakRobot(dt).h < kotakBerdiri.h && kotakBerdiri.h === BERDIRI.h, `${kotakRobot(dt).h}`);
  const L = (tipe: TipeRintangan, m: MasukanLari | ((d: DuniaLari) => MasukanLari), jarak = 420) => {
    const d = duniaSatu(tipe, jarak);
    jalan(d, 2.4, m);
    return d;
  };
  const lompat = (d: DuniaLari): MasukanLari => {
    const o = d.rintangan[0];
    if (!o) return DIAM;
    const dx = o.x - (kotakRobot(d).x + kotakRobot(d).w);
    return { loncat: d.tanah ? dx < d.v * 0.27 && dx > 0 : d.vy < 0 || d.y < TANAH - 6, tunduk: false, dash: false };
  };
  for (const tp of ["peti", "tinggi", "duri"] as const) {
    check(`${tp}: dilewati dengan loncat`, !L(tp, lompat).selesai, "selamat");
    check(`${tp}: menabrak bila tak berbuat apa-apa`, L(tp, DIAM).selesai === "tabrak", "tabrak");
  }
  const tundukMasa = (d: DuniaLari): MasukanLari => {
    const o = d.rintangan[0];
    if (!o) return DIAM;
    const dx = o.x - (kotakRobot(d).x + kotakRobot(d).w);
    return { loncat: false, tunduk: dx < d.v * 0.3 && dx > -o.w - 60, dash: false };
  };
  check("drone: dilewati dengan MENUNDUK", !L("drone", tundukMasa).selesai, "selamat");
  check("drone: menabrak bila berdiri", L("drone", DIAM).selesai === "tabrak", "tabrak");
  check("tembok energi: tak bisa dilompati", L("tembok", lompat).selesai === "tabrak", "tabrak");
  check("tembok energi: tak bisa disiasati dengan menunduk", L("tembok", tundukMasa).selesai === "tabrak", "tabrak");
  const dashTembok = (d: DuniaLari): MasukanLari => {
    const o = d.rintangan[0];
    if (!o) return DIAM;
    const dx = o.x - (kotakRobot(d).x + kotakRobot(d).w);
    return { loncat: false, tunduk: false, dash: dx < d.v * 0.14 };
  };
  const dh = L("tembok", dashTembok);
  check("tembok energi: ditembus dengan DASH dan dihancurkan", !dh.selesai && dh.hancurCount === 1, `hancur=${dh.hancurCount}`);
}

console.log("\nDash");
{
  const d = duniaLariBaru(2);
  d.ujung = 1e9;
  jalan(d, 0.05, { loncat: false, tunduk: false, dash: true });
  check("dash: kecepatan melonjak selama dash", d.dashSisa > 0 && d.v > d.vDasar * 1.5, `${d.v.toFixed(0)}`);
  jalan(d, DASH_DURASI + 0.1, DIAM);
  check("dash berakhir sesudah durasinya", d.dashSisa === 0 && Math.abs(d.v - d.vDasar) < 1e-6, "ok");
  jalan(d, 0.05, { loncat: false, tunduk: false, dash: true });
  check("dash ulang ditolak selama jeda pengisian", d.dashSisa === 0, `jeda ${d.dashJeda.toFixed(2)}`);
  jalan(d, DASH_JEDA, DIAM);
  jalan(d, 0.05, { loncat: false, tunduk: false, dash: true });
  check("dash ulang diterima setelah jeda habis", d.dashSisa > 0, "ok");
  const e = duniaLariBaru(5);
  e.ujung = 1e9;
  const f = duniaLariBaru(5);
  f.ujung = 1e9;
  jalan(e, 6, DIAM);
  jalan(f, 0.4, { loncat: false, tunduk: false, dash: true });
  jalan(f, 5.6, DIAM);
  check("dash tak menggelembungkan skor (skor dihitung dari kecepatan dasar)", Math.abs(e.skor - f.skor) < 0.5, `${e.skor.toFixed(2)} vs ${f.skor.toFixed(2)}`);
  check("dash membuat jarak tempuh lebih jauh (hanya soal posisi)", f.jarak > e.jarak + 50, `${f.jarak.toFixed(0)} vs ${e.jarak.toFixed(0)}`);
}

console.log("\nPemain tiruan & keadilan");
{
  /** Pemain tiruan: aturan sederhana (loncat di jarak tertentu, tunduk di bawah drone, dash pada tembok), tanpa melihat masa depan. */
  const pemain = (d: DuniaLari): MasukanLari => {
    const k = kotakRobot(d);
    const depan = k.x + k.w;
    const o = d.rintangan.find((q) => !q.hancur && q.x + q.w > k.x - 5);
    if (!d.tanah) return { loncat: d.vy < 0 || d.y < TANAH - 8, tunduk: false, dash: false };
    if (!o) return DIAM;
    const dx = o.x - depan;
    if (o.tipe === "tembok") return { loncat: false, tunduk: false, dash: dx < d.v * 0.14 };
    if (o.tipe === "drone") return { loncat: false, tunduk: dx < d.v * 0.3 && dx > -(o.w + 70), dash: false };
    let ujung = o.x + o.w;
    for (const q of d.rintangan) if (!q.hancur && q.x > o.x && q.tipe !== "drone" && q.tipe !== "tembok" && q.x - ujung < 110) ujung = q.x + q.w;
    const lebar = ujung - o.x;
    const mulai = Math.max(6, (d.v * 0.55 - lebar - 30) / 2 + d.v * 0.06);
    return { loncat: dx < mulai, tunduk: false, dash: false };
  };
  const d = duniaLariBaru(11);
  const celah: number[] = [];
  let terakhirX = -1;
  let akhirTerakhir = 0;
  let t100 = -1;
  let langkahN = 0;
  const koinLihat = new Map<number, { x: number; y: number }>();
  const rintLihat = new Map<number, { x: number; y: number; w: number; h: number }>();
  while (d.t < 150 && !d.selesai) {
    langkahLari(d, pemain(d), DT);
    d.bunyi.length = 0;
    for (const c of d.koinList) if (!koinLihat.has(c.id)) koinLihat.set(c.id, { x: c.x, y: c.y });
    for (const o of d.rintangan) if (!rintLihat.has(o.id)) rintLihat.set(o.id, { x: o.x, y: o.y, w: o.w, h: o.h });
    if (t100 < 0 && d.skor >= 100) t100 = d.t;
    for (const o of d.rintangan) {
      if (o.x > terakhirX) {
        if (terakhirX >= 0) celah.push(o.x - terakhirX - akhirTerakhir);
        terakhirX = o.x;
        akhirTerakhir = o.w;
      }
    }
    langkahN++;
  }
  let koinMenempel = 0;
  const koinDilihat = koinLihat.size;
  for (const c of koinLihat.values()) for (const o of rintLihat.values()) if (jarakKeKotak(c.x, c.y, o) < JARAK_KOIN_RINTANGAN) koinMenempel++;
  check("koin tak pernah menempel pada rintangan (jarak >= JARAK_KOIN_RINTANGAN) di seluruh 150 dtk", koinMenempel === 0 && koinDilihat > 100, `menempel=${koinMenempel} dari ${koinDilihat}`);
  check("pemain tiruan bertahan 150 dtk melewati semua jenis rintangan (loncat, tunduk, dash)", !d.selesai && d.t >= 150, `t=${d.t.toFixed(0)} jarak=${d.jarak.toFixed(0)} selesai=${d.selesai}`);
  check("rintangan campuran muncul (dash menghancurkan tembok)", d.hancurCount > 0 && langkahN > 1000, `hancur=${d.hancurCount}`);
  check("skor 100 (= 1 bintang) tercapai antara 15 dan 60 dtk (tidak terlalu mudah)", t100 > 15 && t100 < 60, `${t100.toFixed(1)} dtk`);
  const luarGanda = celah.filter((c) => c > 100);
  check("jarak antarrintangan: pasangan 'ganda' (±60 px) atau cukup lega (> 220 px), tak ada yang menempel", celah.every((c) => c > 100 || (c > 50 && c < 70)) && Math.min(...luarGanda) > 220, `min lega=${Math.min(...luarGanda).toFixed(0)} px`);
  // beberapa semai lain: semuanya bisa diselesaikan (tak ada pola mustahil)
  let gagalSemai = 0;
  for (const sd of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const e = duniaLariBaru(sd * 977);
    while (e.t < 70 && !e.selesai) {
      langkahLari(e, pemain(e), DT);
      e.bunyi.length = 0;
    }
    if (e.selesai) gagalSemai++;
  }
  check("8 semai lain: pemain tiruan selamat 70 dtk (tak ada pola mustahil)", gagalSemai === 0, `${gagalSemai} gagal`);
}

console.log("\nKetahanan");
{
  let rusak = 0;
  for (let s = 0; s < 12; s++) {
    const d = duniaLariBaru(100 + s);
    for (let i = 0; i < 90 * 120 && !d.selesai; i++) {
      langkahLari(d, { loncat: Math.random() < 0.1, tunduk: Math.random() < 0.3, dash: Math.random() < 0.02 }, DT);
      d.bunyi.length = 0;
      if (!sehat(d)) {
        rusak++;
        break;
      }
    }
  }
  check("12 permainan dengan masukan acak: tak pernah NaN", rusak === 0, `${rusak} rusak`);
  const d = duniaLariBaru(5);
  for (let i = 0; i < 20; i++) langkahLari(d, { loncat: true, tunduk: false, dash: true }, DT);
  check("daftar peristiwa suara dibatasi", d.bunyi.length <= 16, `${d.bunyi.length}`);
  check("konstanta wajar: skor per detik awal ≈ V_AWAL / SKOR_PX", Math.abs(V_AWAL / SKOR_PX - 3.16) < 0.1, (V_AWAL / SKOR_PX).toFixed(2));
}

finish();
