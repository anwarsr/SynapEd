/**
 * Menguji Lab 07 Searching (linear search & binary search) — murni, tanpa dev
 * server & kredensial.
 *
 *   npx tsx scripts/verify-searching.ts
 *
 * Yang dijaga:
 *   1. hasil: linear = kemunculan PERTAMA (`indexOf`); binary: ketemu ⇔ nilai
 *      ada, dan sel yang ditunjuk memang bernilai yang dicari;
 *   2. linear: perbandingan = posisi + 1 (atau n), sel yang diredupkan = sel
 *      yang sudah diperiksa;
 *   3. binary: data diurutkan dulu (stabil) bila perlu, Tengah = ⌊(Kiri+Kanan)/2⌋,
 *      Kiri ≤ Tengah ≤ Kanan, rentang menyempit, nilai yang dicari tidak pernah ada
 *      di bagian yang dibuang, perbandingan ≤ ⌊log₂ n⌋ + 1;
 *   3b. jump: lompatan ⌊√n⌋, kemunculan PERTAMA pada data urut, blok yang
 *      dilompati seluruhnya lebih kecil, perbandingan ≤ ⌈n/m⌉ − 1 + m;
 *   4. baris pseudocode yang disorot tepat;
 *   5. pseudocode yang TAMPIL dijalankan interpreter Lab 05 dan hasilnya sama
 *      dengan rekaman;
 *   6. urai data/nilai cari, tautan `?c=`, tempo.
 */
import { check, finish } from "./checks";
import { mulberry32 } from "../frontend/src/lib/lab/labRandom";
import { jalankanPseudo } from "../frontend/src/lib/lab/pseudo/pseudoJalan";
import { rekamLinear } from "../frontend/src/lib/lab/search/searchLinear";
import { rekamBinary } from "../frontend/src/lib/lab/search/searchBinary";
import { rekamJump } from "../frontend/src/lib/lab/search/searchJump";
import { barisBinary, barisJump, barisLinear, KODE_BINARY, KODE_JUMP, KODE_LINEAR } from "../frontend/src/lib/lab/search/searchKode";
import { CONTOH_CARI, dataAcak, uraiData, uraiDicari } from "../frontend/src/lib/lab/search/searchData";
import { decodeCari, encodeCari } from "../frontend/src/lib/lab/search/searchUrl";
import { CARI_MAX_DATA, TAHAN_MS, lompatan, maksBinary, maksJump, type LangkahCari } from "../frontend/src/lib/lab/search/searchTypes";

const sama = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const diSingkir = (l: LangkahCari, i: number) => l.tersingkir.some(([a, b]) => i >= a && i <= b);

// Kasus uji: contoh + acak (nilai kecil supaya banyak kembar; nilai cari ada / tidak ada).
const kasus: { nilai: number[]; dicari: number }[] = CONTOH_CARI.map((c) => ({ nilai: [...c.nilai], dicari: c.dicari }));
{
  const acak = mulberry32(7070);
  for (let t = 0; t < 400; t++) {
    const n = 2 + Math.floor(acak() * (CARI_MAX_DATA - 1));
    const maks = t % 3 === 0 ? 6 : 99;
    const nilai = Array.from({ length: n }, () => Math.floor(acak() * (maks + 1)));
    const dicari = acak() < 0.7 ? nilai[Math.floor(acak() * n)] : Math.floor(acak() * (maks + 2));
    kasus.push({ nilai, dicari });
  }
  // Data yang sudah urut (binary tidak boleh mengubahnya).
  for (let n = 2; n <= CARI_MAX_DATA; n += 5) kasus.push({ nilai: Array.from({ length: n }, (_, i) => i * 2), dicari: n });
}

// ---------------------------------------------------------------------------
console.log("\n1-2. Linear search");
{
  let salah = "";
  let bandingSalah = "";
  let redupSalah = "";
  let bukanPenunjuk = "";
  for (const { nilai, dicari } of kasus) {
    const r = rekamLinear(nilai, dicari);
    const harap = nilai.indexOf(dicari);
    if (!salah && (r.hasil.ketemu !== harap >= 0 || (harap >= 0 && r.hasil.indeks !== harap))) salah = `[${nilai}] cari ${dicari} → ${JSON.stringify(r.hasil)}`;
    const harapBanding = harap >= 0 ? harap + 1 : nilai.length;
    if (!bandingSalah && r.banding !== harapBanding) bandingSalah = `[${nilai}] cari ${dicari}: ${r.banding} vs ${harapBanding}`;
    for (const l of r.langkah) {
      if (l.jenis !== "banding") continue;
      const i = l.aktif!;
      if (!bukanPenunjuk && (l.penunjuk.i !== i || l.sel[i].nilai !== nilai[i])) bukanPenunjuk = `[${nilai}] i=${l.penunjuk.i} aktif=${i}`;
      for (let x = 0; x < nilai.length; x++) {
        const harusRedup = x < i;
        if (!redupSalah && diSingkir(l, x) !== harusRedup) redupSalah = `[${nilai}] aktif ${i}, sel ${x}`;
      }
    }
    if (!salah && JSON.stringify(r.langkah.at(-1)!.hasil) !== JSON.stringify(r.hasil)) salah = "hasil langkah akhir beda";
  }
  check("linear: hasil = kemunculan pertama (indexOf)", !salah, salah || `${kasus.length} kasus`);
  check("linear: perbandingan = posisi + 1, atau n bila tidak ada", !bandingSalah, bandingSalah || "ok");
  check("linear: yang diredupkan = tepat sel yang sudah diperiksa", !redupSalah, redupSalah || "ok");
  check("linear: penunjuk i = sel yang dibandingkan", !bukanPenunjuk, bukanPenunjuk || "ok");
  check("linear: data [5,…] cari 5 = 1 perbandingan (kasus terbaik)", rekamLinear([5, 9, 2], 5).banding === 1, "ok");
}

// ---------------------------------------------------------------------------
console.log("\n3. Binary search");
{
  let salah = "";
  let tidakUrut = "";
  let urutBerubah = "";
  let midSalah = "";
  let tidakMenyempit = "";
  let dicariTerbuang = "";
  let bandingBanyak = "";
  for (const { nilai, dicari } of kasus) {
    const r = rekamBinary(nilai, dicari);
    const ada = nilai.includes(dicari);
    const akhir = r.langkah.at(-1)!;
    if (!salah && (r.hasil.ketemu !== ada || (ada && akhir.sel[r.hasil.indeks!].nilai !== dicari))) salah = `[${nilai}] cari ${dicari} → ${JSON.stringify(r.hasil)}`;

    // Data urut stabil sejak langkah pencarian pertama.
    const harapId = nilai.map((v, id) => ({ v, id })).sort((a, b) => a.v - b.v || a.id - b.id).map((x) => x.id);
    const mulai = r.langkah.findIndex((l) => l.fase === "Mulai");
    if (!tidakUrut && !sama(r.langkah[mulai].sel.map((s) => s.id), harapId)) tidakUrut = `[${nilai}]`;
    const sudahUrut = harapId.every((id, i) => id === i);
    if (!urutBerubah && sudahUrut && r.langkah.some((l) => l.jenis === "urutkan")) urutBerubah = `[${nilai}] punya langkah urutkan`;
    if (!urutBerubah && !sudahUrut && r.langkah.filter((l) => l.jenis === "urutkan").length !== 1) urutBerubah = `[${nilai}] tanpa langkah urutkan`;

    let lebarLalu = Infinity;
    for (const l of r.langkah) {
      const { Kiri, Tengah, Kanan } = l.penunjuk;
      if (l.jenis === "tengah") {
        if (!midSalah && (Kiri === undefined || Tengah === undefined || Kanan === undefined || Tengah !== Math.floor((Kiri + Kanan) / 2) || !(Kiri <= Tengah && Tengah <= Kanan)))
          midSalah = `[${nilai}] L=${Kiri} M=${Tengah} H=${Kanan}`;
        const lebar = Kanan! - Kiri!;
        if (!tidakMenyempit && lebar >= lebarLalu) tidakMenyempit = `[${nilai}] ${lebarLalu} → ${lebar}`;
        lebarLalu = lebar;
      }
      // Bagian yang dibuang tidak pernah berisi nilai yang dicari (kecuali langkah akhir "ketemu", yang meredupkan selain Tengah).
      if (l.jenis !== "selesai") {
        for (let x = 0; x < l.sel.length; x++) if (!dicariTerbuang && diSingkir(l, x) && l.sel[x].nilai === dicari) dicariTerbuang = `[${nilai}] cari ${dicari} di ${x}`;
      }
    }
    if (!bandingBanyak && r.banding > maksBinary(nilai.length)) bandingBanyak = `[${nilai}] ${r.banding} > ${maksBinary(nilai.length)}`;
  }
  check("binary: ketemu ⇔ nilai ada, dan sel yang ditunjuk bernilai yang dicari", !salah, salah || `${kasus.length} kasus`);
  check("binary: pencarian berjalan di atas data terurut stabil", !tidakUrut, tidakUrut || "ok");
  check("binary: langkah 'urutkan' tepat sekali bila perlu, tidak ada bila sudah urut", !urutBerubah, urutBerubah || "ok");
  check("binary: Tengah = ⌊(Kiri+Kanan)/2⌋ dan Kiri ≤ Tengah ≤ Kanan", !midSalah, midSalah || "ok");
  check("binary: rentang Kiri..Kanan menyempit setiap tebakan", !tidakMenyempit, tidakMenyempit || "ok");
  check("binary: nilai yang dicari tidak pernah ada di bagian yang dibuang", !dicariTerbuang, dicariTerbuang || "ok");
  check("binary: perbandingan ≤ ⌊log₂ n⌋ + 1", !bandingBanyak, bandingBanyak || "ok");
  check("binary: 32 data paling banyak 6 perbandingan", maksBinary(32) === 6, String(maksBinary(32)));
}

// ---------------------------------------------------------------------------
console.log("\n4. Baris pseudocode yang disorot");
{
  const kl = KODE_LINEAR.split("\n");
  const kb = KODE_BINARY.split("\n");
  const t = (k: string[], n: number) => (k[n - 1] ?? "").trim();
  const L = barisLinear();
  const B = barisBinary();
  check("linear banding → IF A[i] = Dicari", t(kl, L.banding) === "IF A[i] = Dicari", t(kl, L.banding));
  check("linear lanjut → i ← i + 1", t(kl, L.lanjut) === "i ← i + 1", t(kl, L.lanjut));
  check("linear keluaran", t(kl, L.keluarKetemu).startsWith('OUTPUT "Ditemukan') && t(kl, L.keluarTidak) === 'OUTPUT "Tidak ditemukan"', `${L.keluarKetemu}/${L.keluarTidak}`);
  check("binary tengah → Tengah ← (Kiri + Kanan) DIV 2", t(kb, B.tengah) === "Tengah ← (Kiri + Kanan) DIV 2", t(kb, B.tengah));
  check("binary banding → IF A[Tengah] = Dicari", t(kb, B.banding) === "IF A[Tengah] = Dicari", t(kb, B.banding));
  check("binary buang → Kiri ← Tengah + 1 / Kanan ← Tengah - 1", t(kb, B.geserKanan) === "Kiri ← Tengah + 1" && t(kb, B.geserKiri) === "Kanan ← Tengah - 1", `${t(kb, B.geserKanan)} | ${t(kb, B.geserKiri)}`);
  let liar = "";
  for (const { nilai, dicari } of kasus.slice(0, 50)) {
    for (const [k, r] of [[kl, rekamLinear(nilai, dicari)], [kb, rekamBinary(nilai, dicari)]] as const)
      for (const l of r.langkah) if (l.baris < 1 || l.sampai < l.baris || l.sampai > k.length) liar = `${l.baris}-${l.sampai}`;
  }
  check("setiap sorotan menunjuk baris yang ada", !liar, liar || "ok");
  const buang = rekamBinary([1, 3, 5, 7, 9], 9).langkah.filter((l) => l.jenis === "buang");
  check("langkah buang menyorot baris Kiri ←", buang.length > 0 && buang.every((l) => l.baris === B.geserKanan), buang.map((l) => l.baris).join(","));
}

// ---------------------------------------------------------------------------
console.log("\n5. Pseudocode yang tampil berjalan di interpreter Lab 05");
{
  const bungkus = (kode: string) => `DECLARE A : ARRAY[1:32] OF INTEGER
DECLARE N, Dicari, Idx : INTEGER
INPUT N
FOR Idx ← 1 TO N
   INPUT A[Idx]
NEXT Idx
INPUT Dicari
${kode}`;
  const masukan = (nilai: number[], dicari: number) => [nilai.length, ...nilai, dicari].join("\n");
  const keluaranDari = (h: { ketemu: boolean; indeks: number | null }) => (h.ketemu ? `Ditemukan di A[${h.indeks! + 1}]` : "Tidak ditemukan");

  let galat = "";
  let beda = "";
  const sampel = kasus.slice(0, 80);
  for (const { nilai, dicari } of sampel) {
    const urut = [...nilai].sort((a, b) => a - b);
    for (const [nama, kode, data, r] of [
      ["linear", KODE_LINEAR, nilai, rekamLinear(nilai, dicari)],
      ["binary", KODE_BINARY, urut, rekamBinary(nilai, dicari)],
      ["jump", KODE_JUMP, urut, rekamJump(nilai, dicari)],
    ] as const) {
      const j = jalankanPseudo(bungkus(kode), masukan([...data], dicari), { rekam: false });
      if (j.galat) {
        galat ||= `${nama}: ${j.galat.pesan} (baris ${j.galat.baris})`;
        continue;
      }
      if (!beda && j.keluaran.trim() !== keluaranDari(r.hasil)) beda = `${nama} [${data}] cari ${dicari}: "${j.keluaran.trim()}" vs "${keluaranDari(r.hasil)}"`;
    }
  }
  check("pseudocode linear, binary & jump berjalan tanpa galat", !galat, galat || `${sampel.length * 3} program`);
  check("keluaran pseudocode = hasil rekaman (posisi sama persis)", !beda, beda || "ok");
}

// ---------------------------------------------------------------------------
console.log("\n6. Data, tautan, tempo");
{
  const d = uraiData("38, 27;43 3");
  check("urai data", d.ok && sama(d.nilai, [38, 27, 43, 3]), JSON.stringify(d));
  const t33 = uraiData(Array.from({ length: 33 }, (_, i) => i).join(","));
  check("33 data ditolak", !t33.ok && t33.galat.includes("Maksimal 32"), t33.ok ? "diterima" : t33.galat);
  check("32 data diterima", uraiData(Array.from({ length: 32 }, (_, i) => i).join(",")).ok, "ok");
  const satu = uraiData("7");
  check("1 data ditolak dengan pesan 'dicari'", !satu.ok && satu.galat.includes("supaya ada yang dicari"), satu.ok ? "diterima" : satu.galat);
  for (const [t, ok] of [["43", true], [" 0 ", true], ["", false], ["-1", false], ["1000", false], ["4.5", false], ["x", false], ["1 2", false]] as const) {
    check(`nilai cari "${t}" ${ok ? "diterima" : "ditolak"}`, uraiDicari(t).ok === ok, JSON.stringify(uraiDicari(t)));
  }
  check("semua contoh kasus sah", CONTOH_CARI.every((c) => uraiData(c.nilai.join(",")).ok && uraiDicari(String(c.dicari)).ok), "ok");
  const tidak = CONTOH_CARI.find((c) => c.id === "tidak")!;
  const awal = CONTOH_CARI.find((c) => c.id === "awal")!;
  const panjang = CONTOH_CARI.find((c) => c.id === "panjang")!;
  check("contoh 'Tidak ada' memang tidak ada", !tidak.nilai.includes(tidak.dicari), "ok");
  check("contoh 'Di awal' memang di posisi pertama", awal.nilai[0] === awal.dicari, "ok");
  check("contoh '32 data' berisi 32 nilai berbeda", panjang.nilai.length === 32 && new Set(panjang.nilai).size === 32 && panjang.nilai.includes(panjang.dicari), "ok");
  const a = dataAcak(11);
  check("data acak berbenih: sah & tetap", sama(a.nilai, dataAcak(11).nilai) && uraiData(a.nilai.join(",")).ok, a.nilai.join(","));

  for (const isi of [
    { algo: "linear", dicari: 43, nilai: [38, 27, 43] },
    { algo: "binary", dicari: 0, nilai: Array.from({ length: 32 }, () => 999) },
    { algo: "jump", dicari: 7, nilai: [7, 1] },
  ] as const) {
    const kode = encodeCari({ ...isi, nilai: [...isi.nilai] });
    const b = decodeCari(kode);
    check(`tautan bolak-balik (${isi.algo}, ${isi.nilai.length} data)`, !!b && b.algo === isi.algo && b.dicari === isi.dicari && sama(b.nilai, isi.nilai), kode.slice(0, 30));
  }
  for (const rusak of ["", "1l~43~", "1x~43~1,2", "1l~~1,2", "1l~-4~1,2", "1l~1000~1,2", "1l~43~1", "1l~43~1,,2", "1l~43~1,2,", "2l~43~1,2", `1l~1~${Array(33).fill(1).join(",")}`]) {
    check(`tautan rusak ditolak "${rusak.slice(0, 22)}"`, decodeCari(rusak) === null, "null");
  }

  const minimum = { info: 2800, urutkan: 3000, tengah: 2200, banding: 1900, buang: 2600, selesai: 2800 } as const;
  const cepat = Object.entries(minimum).filter(([j, ms]) => TAHAN_MS[j as keyof typeof minimum] < ms);
  check("tempo tidak dipercepat diam-diam", cepat.length === 0, cepat.map(([j]) => j).join(",") || "ok");
  check("setiap langkah membawa tahanMs sesuai jenisnya", [...rekamLinear([3, 1], 1).langkah, ...rekamBinary([3, 1, 2], 2).langkah].every((l) => l.tahanMs === TAHAN_MS[l.jenis]), "ok");
}

// ---------------------------------------------------------------------------
console.log("\n7. Jump search");
{
  let salah = "";
  let bukanPertama = "";
  let lompatSalah = "";
  let blokSalah = "";
  let pertamaTerbuang = "";
  let bandingBanyak = "";
  let tidakUrut = "";
  for (const { nilai, dicari } of kasus) {
    const r = rekamJump(nilai, dicari);
    const n = nilai.length;
    const m = lompatan(n);
    const akhir = r.langkah.at(-1)!;
    const urut = nilai.map((v, id) => ({ v, id })).sort((a, b) => a.v - b.v || a.id - b.id);
    const pertama = urut.findIndex((x) => x.v === dicari);
    if (!salah && (r.hasil.ketemu !== pertama >= 0 || (r.hasil.ketemu && akhir.sel[r.hasil.indeks!].nilai !== dicari)))
      salah = `[${nilai}] cari ${dicari} → ${JSON.stringify(r.hasil)}`;
    if (!bukanPertama && pertama >= 0 && r.hasil.indeks !== pertama) bukanPertama = `[${nilai}] cari ${dicari}: ${r.hasil.indeks} vs ${pertama}`;
    if (!bandingBanyak && r.banding > maksJump(n)) bandingBanyak = `[${nilai}] ${r.banding} > ${maksJump(n)}`;
    const mulai = r.langkah.findIndex((l) => l.fase === "Blok 1");
    if (!tidakUrut && !sama(r.langkah[mulai].sel.map((x) => x.id), urut.map((x) => x.id))) tidakUrut = `[${nilai}]`;

    for (const l of r.langkah) {
      const { Awal, Akhir } = l.penunjuk;
      // Setiap blok selebar m: Akhir − Awal + 1 = m kecuali blok terakhir yang dijepit ke N.
      if (!lompatSalah && Awal !== undefined && Akhir !== undefined && l.fase !== "Cari di blok") {
        const lebar = Akhir - Awal + 1;
        if (lebar !== m && !(Akhir === n - 1 && lebar <= m)) lompatSalah = `[${nilai}] blok ${Awal}..${Akhir}, m=${m}`;
      }
      if (!blokSalah && l.fase === "Cari di blok" && Awal !== undefined && Akhir !== undefined && Akhir - Awal + 1 > m) blokSalah = `[${nilai}] ${Awal}..${Akhir}`;
      // Bagian yang dilompati/dibuang tidak pernah memuat kemunculan PERTAMA (langkah akhir dikecualikan).
      if (!pertamaTerbuang && pertama >= 0 && l.jenis !== "selesai" && l.tersingkir.some(([a, b]) => pertama >= a && pertama <= b))
        pertamaTerbuang = `[${nilai}] cari ${dicari}, langkah "${l.fase}"`;
      // Semua yang dilompati lebih kecil dari yang dicari.
      if (!blokSalah && l.jenis === "buang" && l.sel.slice(0, Awal).some((x) => x.nilai >= dicari)) blokSalah = `[${nilai}] lompat melewati nilai ≥ ${dicari}`;
    }
  }
  check("jump: ketemu ⇔ nilai ada, dan sel yang ditunjuk bernilai yang dicari", !salah, salah || `${kasus.length} kasus`);
  check("jump: yang ditemukan = kemunculan PERTAMA pada data urut", !bukanPertama, bukanPertama || "ok");
  check("jump: pencarian berjalan di atas data terurut stabil", !tidakUrut, tidakUrut || "ok");
  check("jump: setiap blok selebar ⌊√n⌋ (blok terakhir dijepit ke N)", !lompatSalah, lompatSalah || "ok");
  check("jump: blok yang dilompati seluruhnya lebih kecil; blok terakhir ≤ m data", !blokSalah, blokSalah || "ok");
  check("jump: kemunculan pertama tidak pernah ada di bagian yang dibuang", !pertamaTerbuang, pertamaTerbuang || "ok");
  check("jump: perbandingan ≤ ⌈n/m⌉ − 1 + m", !bandingBanyak, bandingBanyak || "ok");
  check("jump: lompatan = ⌊√n⌋", [1, 3, 4, 8, 9, 15, 16, 32].every((n) => lompatan(n) === Math.floor(Math.sqrt(n))), [1, 3, 4, 8, 9, 15, 16, 32].map(lompatan).join(","));
  check("jump: 32 data paling banyak 11 perbandingan", maksJump(32) === 11, String(maksJump(32)));

  const kj = KODE_JUMP.split("\n");
  const t = (x: number) => (kj[x - 1] ?? "").trim();
  const J = barisJump();
  check("jump ujung blok → WHILE Akhir < N AND A[Akhir] < Dicari", t(J.ujung) === "WHILE Akhir < N AND A[Akhir] < Dicari", t(J.ujung));
  check("jump loncat → Awal ← Akhir + 1 … Akhir ← Akhir + Lompat", t(J.loncat[0]) === "Awal \u2190 Akhir + 1" && t(J.loncat[1]) === "Akhir \u2190 Akhir + Lompat", `${J.loncat}`);
  check("jump cari di blok → IF A[i] = Dicari", t(J.banding) === "IF A[i] = Dicari", t(J.banding));
  check("jump jepit → Akhir ← N", t(J.jepit) === "Akhir \u2190 N", t(J.jepit));
  const contoh = rekamJump(CONTOH_CARI.find((c) => c.id === "panjang")!.nilai, 35);
  const tepat = contoh.langkah.every(
    (l) => l.baris >= 1 && l.sampai <= kj.length && (l.jenis !== "buang" || l.baris === J.loncat[0]) && (l.jenis !== "banding" || l.baris === J.ujung || l.baris === J.banding),
  );
  check("setiap langkah jump menyorot baris yang tepat", tepat, "ok");
  check("jump: setiap langkah membawa tahanMs sesuai jenisnya", rekamJump([3, 1, 2], 2).langkah.every((l) => l.tahanMs === TAHAN_MS[l.jenis]), "ok");
}

finish();
