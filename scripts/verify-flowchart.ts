/**
 * Menguji logika flowchart SynapLab — murni, tanpa dev server & kredensial.
 *
 *   npx tsx scripts/verify-flowchart.ts
 *
 * Yang dijaga:
 *   1. bahasa ekspresi: urutan operator, jenis nilai, pesan galat, dan TIDAK
 *      ADA jalan ke prototipe/eval lewat teks flowchart;
 *   2. mesin jalan: contoh-contoh menghasilkan keluaran yang benar, input
 *      ditunggu, cabang & konektor diikuti, perulangan tak berujung dihentikan;
 *   3. pemeriksa aturan: setiap aturan menyala pada pelanggarannya dan diam
 *      pada contoh yang benar;
 *   4. geometri: setiap rute garis siku, ujungnya tepat di titik sambung;
 *   5. tautan & berkas: bolak-balik identik, masukan rusak/berbahaya → null.
 */
import { check, finish } from "./checks";
import {
  GalatEkspresi,
  evaluasi,
  evaluasiKondisi,
  jalankanPenugasan,
  nilaiMasukan,
  tampilNilai,
  uraiIo,
  type Variabel,
} from "../frontend/src/lib/lab/flowEkspresi";
import {
  FLOW_MAKS_LANGKAH,
  berikanMasukan,
  jalankanSampaiBerhenti,
  langkahJalan,
  mulaiJalan,
  type KeadaanJalan,
} from "../frontend/src/lib/lab/flowJalan";
import { periksaDiagram, saranGaya } from "../frontend/src/lib/lab/flowPeriksa";
import { CONTOH_FLOW } from "../frontend/src/lib/lab/flowContoh";
import { bentukSimpul, bungkusTeks, jepret, ruangGeser, ruteGaris, titikGaris, titikSisi, ujungGaris, type Titik } from "../frontend/src/lib/lab/flowGeometri";
import { berkasKeDiagram, decodeFlow, diagramKeBerkas, encodeFlow, FLOW_MAX_URL, sahkanDiagram } from "../frontend/src/lib/lab/flowUrl";
import { diagramKeSvg } from "../frontend/src/lib/lab/flowSvg";
import {
  FLOW_MAX_SIMPUL,
  FLOW_MAX_TEKS,
  JENIS_SIMPUL,
  SISI,
  type Diagram,
  type Simpul,
  type JenisSimpul,
  type Sisi,
} from "../frontend/src/lib/lab/flowTypes";
import { mulberry32 } from "../frontend/src/lib/lab/labRandom";
import { duplikat, hapus, pindahkan, sambung, tambahSimpul, ubahJenis, ubahTeks } from "../frontend/src/lib/lab/flowEdit";
import { canRedo, currentState, gantiPuncakHistory, initHistory, pushHistory, undoHistory } from "../frontend/src/lib/lab/labHistory";

// ── Penolong ────────────────────────────────────────────────────────────

const v = (pasangan: Record<string, number | string | boolean> = {}): Variabel => new Map(Object.entries(pasangan));

function hasil(src: string, vars: Variabel = v()): unknown {
  try {
    return evaluasi(src, vars);
  } catch (e) {
    return e instanceof GalatEkspresi ? `GALAT: ${e.message}` : `LEMPAR: ${String(e)}`;
  }
}

const galatEksp = (src: string, vars: Variabel = v()) => String(hasil(src, vars)).startsWith("GALAT");

/** Diagram kecil dari daftar simpul & garis; id = urutan (mulai 1). */
function dg(simpul: [JenisSimpul, string][], garis: [number, number, string?][]): Diagram {
  const s = simpul.map(([jenis, teks], i) => ({ id: i + 1, jenis, x: 100, y: 40 + i * 100, w: 160, h: 60, teks }));
  const g = garis.map(([a, b, label], i) => ({
    id: s.length + i + 1,
    dari: a,
    ke: b,
    dariSisi: "bawah" as Sisi,
    keSisi: "atas" as Sisi,
    label: label ?? "",
  }));
  return { simpul: s, garis: g, nextId: s.length + g.length + 1 };
}

function jalankan(d: Diagram, masukan = ""): KeadaanJalan {
  return jalankanSampaiBerhenti(d, mulaiJalan(d, masukan));
}

const kode = (d: Diagram) => periksaDiagram(d).map((t) => t.kode);

// ── 1. Ekspresi ─────────────────────────────────────────────────────────

// Laporan pemilik: Keputusan "x > mod 2 == 0?" memberi galat '"%" tidak boleh
// berada di sini' — siswa menulis "mod", dan pesannya tidak menunjuk ">" yang salah.
{
  const g = hasil("x > mod 2 == 0", v({ x: 3 }));
  check(
    "dua operator berurutan: pesan menyebut keduanya dengan ejaan siswa",
    typeof g === "string" && g.includes('">" lalu "mod"') && !g.includes('"%"'),
    String(g),
  );
  const awal = hasil("mod 2", v());
  check("operator tanpa nilai di kiri: ejaan siswa, beri contoh", typeof awal === "string" && awal.includes('"mod" butuh nilai') && awal.includes("x mod 2"), String(awal));
  const beda = hasil("x <> * 2", v({ x: 1 }));
  check("ejaan asli simbol juga dipertahankan (<> bukan !=)", typeof beda === "string" && beda.includes('"<>" lalu "*"'), String(beda));
  check("bentuk yang benar tetap jalan: x mod 2 == 0", hasil("x mod 2 == 0", v({ x: 3 })) === false && hasil("x mod 2 == 0", v({ x: 4 })) === true, "");
}

check("urutan operator", hasil("2 + 3 * 4") === 14 && hasil("(2 + 3) * 4") === 20, String(hasil("2 + 3 * 4")));
check("pangkat asosiatif kanan, minus di luar pangkat", hasil("2 ^ 3 ^ 2") === 512 && hasil("-2 ^ 2") === -4, `${hasil("2^3^2")} ${hasil("-2^2")}`);
check(
  "mod, div, bagi",
  hasil("7 mod 3") === 1 && hasil("7 % 3") === 1 && hasil("7 div 2") === 3 && hasil("-7 div 2") === -3 && hasil("10 / 4") === 2.5,
  "aritmetika",
);
check("teks + angka digabung", hasil('"a" + 1') === "a1" && hasil('panjang("halo")') === 4, String(hasil('"a" + 1')));
check(
  "perbandingan: = sama dengan == di ekspresi",
  hasil("3 = 3") === true && hasil("3 == 3") === true && hasil("3 <> 4") === true && hasil("3 ≠ 3") === false,
  "=",
);
check(
  "dan / atau / tidak",
  hasil("2 <= 2 dan 3 > 1") === true && hasil("tidak (1 > 2)") === true && hasil("1 > 2 or 2 > 1") === true,
  "logika",
);
check("hubung-singkat: kanan tidak dihitung", hasil("1 < 2 atau x > 0") === true && hasil("1 > 2 dan x > 0") === false, "x belum ada");
check("fungsi", hasil("akar(16) + abs(-2) + bulat(2.6) + max(1, 9, 4)") === 4 + 2 + 3 + 9, String(hasil("akar(16) + abs(-2) + bulat(2.6) + max(1, 9, 4)")));
check("variabel belum diisi → galat yang menyebut namanya", String(hasil("x + 1")).includes('"x"'), String(hasil("x + 1")));
check("bagi nol → galat, bukan Infinity", String(hasil("1 / 0")).includes("nol") && String(hasil("5 mod 0")).includes("nol"), String(hasil("1/0")));
check(
  "masukan cacat ditolak dengan galat (tidak melempar mentah)",
  ['"a" * 2', "1 +", "(1", '"abc', "1 $ 2", "akar(-1)", "foo(1)", "2 3", "benar < salah", "1 < \"a\""].every((s) => galatEksp(s)),
  "semua GALAT",
);
check("ekspresi sangat bersarang ditolak, tidak membuat tumpukan meledak", galatEksp("(".repeat(500) + "1" + ")".repeat(500)), "kedalaman");
{
  const vars = v();
  jalankanPenugasan("__proto__ = 5", vars);
  jalankanPenugasan("constructor = 1", vars);
  const bersih = ({} as Record<string, unknown>).polluted === undefined && Object.getPrototypeOf({}) === Object.prototype;
  check(
    "nama __proto__/constructor hanyalah variabel biasa",
    vars.get("__proto__") === 5 && vars.get("constructor") === 1 && bersih && galatEksp("toString + 1"),
    "Map, bukan objek",
  );
  check("tidak ada eval: teks berisi kode JS tetap galat", galatEksp('alert("x")') && galatEksp("process.exit(1)") && galatEksp("x => x"), "parser sendiri");
}
check("kondisi: tanda tanya dibuang", evaluasiKondisi("x > 0?", v({ x: 1 })) === true, "?");
{
  let pesan = "";
  try {
    evaluasiKondisi("x + 1", v({ x: 1 }));
  } catch (e) {
    pesan = (e as Error).message;
  }
  check("kondisi yang bukan benar/salah ditolak", pesan.includes("benar/salah"), pesan);
}
{
  const vars = v();
  jalankanPenugasan("x = 5", vars);
  jalankanPenugasan("x ← x + 1", vars);
  jalankanPenugasan("x += 2", vars);
  jalankanPenugasan("x++", vars);
  jalankanPenugasan("y := x * 2", vars);
  jalankanPenugasan('s = "a"', vars);
  jalankanPenugasan('s += "b"', vars);
  jalankanPenugasan("z <- 3", vars);
  check(
    "penugasan: =, ←, +=, ++, :=, <-",
    vars.get("x") === 9 && vars.get("y") === 18 && vars.get("s") === "ab" && vars.get("z") === 3,
    JSON.stringify([...vars]),
  );
  let tolak = 0;
  for (const s of ["5 = x", "x == 3", "Hitung luas", "x +=", "y++"]) {
    try {
      jalankanPenugasan(s, v({ x: 1 }));
    } catch (e) {
      if (e instanceof GalatEkspresi) tolak++;
    }
  }
  check("bukan penugasan ditolak dengan galat", tolak === 5, `${tolak}/5`);
}
{
  const a = uraiIo("Baca a, b");
  const b = uraiIo("baca p dan q");
  const c = uraiIo('Tampilkan "Hasil:", x + 1');
  const d = uraiIo('Cetak "a, b"');
  check(
    "Input/Output dikenali",
    a.jenis === "input" && a.nama.join() === "a,b" && b.jenis === "input" && b.nama.join() === "p,q" && c.jenis === "output" && c.ekspresi.length === 2 && d.jenis === "output" && d.ekspresi.length === 1,
    "baca/tampilkan",
  );
  let tolak = false;
  try {
    uraiIo("Hitung x");
  } catch (e) {
    tolak = e instanceof GalatEkspresi;
  }
  check("I/O tanpa Baca/Tampilkan ditolak", tolak, "Hitung x");
}
check(
  "masukan pengguna: koma desimal, negatif, benar/salah, teks",
  nilaiMasukan("2,5") === 2.5 && nilaiMasukan("-3") === -3 && nilaiMasukan("benar") === true && nilaiMasukan("abc") === "abc",
  "nilaiMasukan",
);
check("angka ditampilkan tanpa sisa floating point", tampilNilai(0.1 + 0.2) === "0.3" && tampilNilai(true) === "benar", tampilNilai(0.1 + 0.2));

// ── 2. Mesin jalan ──────────────────────────────────────────────────────

const contoh = (id: string) => CONTOH_FLOW.find((c) => c.id === id)!.diagram;
{
  const k = jalankan(contoh("luas"), "4, 5");
  check("contoh luas: 4 × 5", k.status === "selesai" && k.keluaran.join("|") === "Luas = 20", `${k.status} ${k.keluaran.join("|")} ${k.galat ?? ""}`);
  const g1 = jalankan(contoh("genap"), "7");
  const g2 = jalankan(contoh("genap"), "10");
  check("contoh genap/ganjil: kedua cabang", g1.keluaran.join() === "7 ganjil" && g2.keluaran.join() === "10 genap", `${g1.keluaran} / ${g2.keluaran}`);
  const j5 = jalankan(contoh("jumlah"), "5");
  const j0 = jalankan(contoh("jumlah"), "0");
  check("contoh perulangan: 1+…+5 = 15, n = 0 → 0", j5.keluaran.join() === "Jumlah = 15" && j0.keluaran.join() === "Jumlah = 0", `${j5.keluaran} / ${j0.keluaran}`);
  // baca, persiapan, keputusan, 5 × (proses + keputusan), tampilkan, selesai = 15.
  check("perulangan berputar tepat 5 kali (15 langkah)", j5.langkah === 15, `${j5.langkah} langkah`);
}
{
  const d = contoh("genap");
  let k = jalankan(d, "");
  check("tanpa masukan di muka: berhenti menunggu N", k.status === "tunggu-input" && k.menunggu?.join() === "N", `${k.status} ${k.menunggu}`);
  k = berikanMasukan(k, "4");
  k = jalankanSampaiBerhenti(d, k);
  check("setelah diberi nilai: lanjut sampai selesai", k.status === "selesai" && k.keluaran.join() === "4 genap", `${k.status} ${k.keluaran}`);
}
{
  const d = contoh("jumlah");
  let k = mulaiJalan(d, "3");
  const narasiKosong: number[] = [];
  const naik: boolean[] = [];
  while (k.status === "jalan") {
    const b = langkahJalan(d, k);
    naik.push(b.langkah === k.langkah + 1);
    if (!b.narasi.trim()) narasiKosong.push(b.langkah);
    k = b;
  }
  check("setiap langkah bernarasi dan menaikkan hitungan", narasiKosong.length === 0 && naik.every(Boolean), `${narasiKosong.length} kosong`);
  check("garis yang dilewati dicatat", k.garisTerakhir !== null, String(k.garisTerakhir));
}
{
  const d = dg(
    [
      ["mulai", "Mulai"],
      ["proses", "x = 1"],
      ["keputusan", "x > 0?"],
      ["selesai", "Selesai"],
    ],
    [
      [1, 2],
      [2, 3],
      [3, 2, "Ya"],
      [3, 4, "Tidak"],
    ],
  );
  const k = jalankan(d);
  check(
    "perulangan tak berujung dihentikan",
    k.status === "galat" && (k.galat ?? "").includes("perulangan") && k.langkah === FLOW_MAKS_LANGKAH,
    `${k.status} ${k.langkah}`,
  );
}
{
  const tanpaLabel = dg(
    [
      ["mulai", "Mulai"],
      ["keputusan", "1 > 0?"],
      ["selesai", "A"],
      ["selesai", "B"],
    ],
    [
      [1, 2],
      [2, 3],
      [2, 4],
    ],
  );
  const k = jalankan(tanpaLabel);
  check("keputusan tanpa label Yes/No → galat yang menjelaskan", k.status === "galat" && (k.galat ?? "").includes('"Yes"'), k.galat ?? "");
  const cabang = dg(
    [
      ["mulai", "Mulai"],
      ["proses", "x = 1"],
      ["selesai", "A"],
      ["selesai", "B"],
    ],
    [
      [1, 2],
      [2, 3],
      [2, 4],
    ],
  );
  check("proses bercabang → galat", jalankan(cabang).status === "galat", jalankan(cabang).galat ?? "");
  const buntu = dg(
    [
      ["mulai", "Mulai"],
      ["proses", "x = 1"],
    ],
    [[1, 2]],
  );
  check("alur buntu → galat", (jalankan(buntu).galat ?? "").includes("buntu"), jalankan(buntu).galat ?? "");
  const salahEksp = dg(
    [
      ["mulai", "Mulai"],
      ["proses", "x = y + 1"],
      ["selesai", "Selesai"],
    ],
    [
      [1, 2],
      [2, 3],
    ],
  );
  const ks = jalankan(salahEksp);
  check("galat ekspresi menyorot simbolnya", ks.status === "galat" && ks.aktif === 2 && (ks.galat ?? "").includes('"y"'), `${ks.aktif} ${ks.galat}`);
  check("tanpa Mulai → galat sejak awal", mulaiJalan(dg([["proses", "x = 1"]], [])).status === "galat", "mulai");
}
{
  // Konektor A tanpa garis keluar melompat ke konektor A yang melanjutkan alur.
  const d = dg(
    [
      ["mulai", "Mulai"],
      ["proses", "x = 41 + 1"],
      ["konektor", "A"],
      ["konektor", "A"],
      ["io", "Tampilkan x"],
      ["selesai", "Selesai"],
    ],
    [
      [1, 2],
      [2, 3],
      [4, 5],
      [5, 6],
    ],
  );
  const k = jalankan(d);
  check("konektor melompat ke pasangannya", k.status === "selesai" && k.keluaran.join() === "42", `${k.status} ${k.keluaran} ${k.galat ?? ""}`);
  check("pemeriksa tidak menganggap lompatan konektor sebagai alur terputus", !kode(d).includes("tak-terjangkau") && !kode(d).includes("buntu"), kode(d).join());
}
{
  const d = dg(
    [
      ["mulai", "Mulai"],
      ["subproses", "Hitung luas"],
      ["dokumen", "Laporan"],
      ["selesai", "Selesai"],
    ],
    [
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  );
  const k = jalankan(d);
  check("subproses bernama & dokumen dilewati dengan jujur", k.status === "selesai", k.galat ?? k.status);
}

// ── 3. Pemeriksa aturan ─────────────────────────────────────────────────

for (const c of CONTOH_FLOW) {
  const galat = periksaDiagram(c.diagram).filter((t) => t.tingkat === "galat");
  check(`contoh "${c.nama}" lolos pemeriksa tanpa galat`, galat.length === 0, galat.map((t) => t.pesan).join(" | ") || "bersih");
}
check("diagram kosong → tanpa temuan", periksaDiagram({ simpul: [], garis: [], nextId: 1 }).length === 0, "kosong");
check("hanya catatan → tanpa temuan", periksaDiagram(dg([["catatan", "Catatan"]], [])).length === 0, "catatan tidak ikut alur");
{
  const k1 = kode(dg([["proses", "x = 1"]], []));
  check("tanpa Mulai & tanpa Selesai dilaporkan", k1.includes("tanpa-mulai") && k1.includes("tanpa-selesai"), k1.join());
  const k2 = kode(
    dg(
      [
        ["mulai", "M1"],
        ["mulai", "M2"],
        ["selesai", "S"],
      ],
      [
        [1, 3],
        [2, 3],
      ],
    ),
  );
  check("Mulai ganda dilaporkan", k2.includes("mulai-ganda"), k2.join());
  const k3 = kode(
    dg(
      [
        ["mulai", "M"],
        ["keputusan", "x > 0?"],
        ["selesai", "S"],
      ],
      [
        [1, 2],
        [2, 3, "Ya"],
      ],
    ),
  );
  check("keputusan satu cabang dilaporkan", k3.includes("cabang-keputusan"), k3.join());
  const k4 = kode(
    dg(
      [
        ["mulai", "M"],
        ["keputusan", "x > 0?"],
        ["selesai", "S1"],
        ["selesai", "S2"],
      ],
      [
        [1, 2],
        [2, 3, "Ya"],
        [2, 4, "Ya"],
      ],
    ),
  );
  check("label kembar dilaporkan", k4.includes("label-kembar"), k4.join());
  const k5 = kode(
    dg(
      [
        ["mulai", "M"],
        ["keputusan", "x > 0?"],
        ["selesai", "S1"],
        ["selesai", "S2"],
      ],
      [
        [1, 2],
        [2, 3, "oke"],
        [2, 4, "Tidak"],
      ],
    ),
  );
  check("label bukan Ya/Tidak dilaporkan", k5.includes("label-keputusan"), k5.join());
  const k6 = kode(
    dg(
      [
        ["mulai", "M"],
        ["proses", "x = 1"],
        ["selesai", "S1"],
        ["selesai", "S2"],
        ["proses", "y = 2"],
      ],
      [
        [1, 2],
        [2, 3],
        [2, 4],
        [3, 1],
      ],
    ),
  );
  check(
    "cabang tanpa keputusan, masuk ke Mulai, keluar dari Selesai, simbol menggantung",
    ["cabang-liar", "masuk-mulai", "keluar-selesai", "tak-terjangkau", "buntu"].every((x) => k6.includes(x)),
    k6.join(),
  );
  const k7 = kode(
    dg(
      [
        ["mulai", "M"],
        ["proses", "x = 1"],
        ["proses", "x = 2"],
        ["selesai", "S"],
      ],
      [
        [1, 2],
        [2, 3],
        [3, 2],
      ],
    ),
  );
  check("perulangan tanpa jalan keluar dilaporkan", k7.includes("tanpa-akhir"), k7.join());
  const k8 = kode(
    dg(
      [
        ["mulai", "M"],
        ["konektor", "Z"],
        ["selesai", "S"],
      ],
      [[1, 2]],
    ),
  );
  check("konektor tanpa pasangan dilaporkan", k8.includes("konektor-yatim"), k8.join());
  const t9 = periksaDiagram(
    dg(
      [
        ["mulai", "M"],
        ["proses", "Hitung luas"],
        ["selesai", "S"],
      ],
      [
        [1, 2],
        [2, 3],
      ],
    ),
  );
  check(
    "teks yang tak bisa dijalankan = SARAN, bukan galat",
    t9.some((t) => t.kode === "tak-bisa-dijalankan" && t.tingkat === "saran") && !t9.some((t) => t.tingkat === "galat"),
    t9.map((t) => `${t.tingkat}:${t.kode}`).join(),
  );
  const urut = periksaDiagram(dg([["proses", "Hitung"]], []));
  const pertamaSaran = urut.findIndex((t) => t.tingkat === "saran");
  check("galat selalu didahulukan dari saran", pertamaSaran === -1 || urut.slice(pertamaSaran).every((t) => t.tingkat === "saran"), urut.map((t) => t.tingkat).join());
}

// ── 4. Geometri ─────────────────────────────────────────────────────────

const siku = (t: Titik[]) => t.every((p, i) => i === 0 || p.x === t[i - 1].x || p.y === t[i - 1].y);
{
  let semua = 0;
  let salah = 0;
  for (const c of CONTOH_FLOW) {
    for (const g of c.diagram.garis) {
      const t = titikGaris(c.diagram, g)!;
      const dari = c.diagram.simpul.find((s) => s.id === g.dari)!;
      const ke = c.diagram.simpul.find((s) => s.id === g.ke)!;
      const a = titikSisi(dari, g.dariSisi);
      const b = titikSisi(ke, g.keSisi);
      semua++;
      if (!siku(t) || t[0].x !== a.x || t[0].y !== a.y || t.at(-1)!.x !== b.x || t.at(-1)!.y !== b.y) salah++;
    }
  }
  check("rute garis contoh: siku & tepat di titik sambung", salah === 0, `${semua - salah}/${semua}`);

  const acak = mulberry32(7);
  let gagal = 0;
  for (let i = 0; i < 3000; i++) {
    const a = { x: Math.round(acak() * 800), y: Math.round(acak() * 800) };
    const b = { x: Math.round(acak() * 800), y: Math.round(acak() * 800) };
    const sa = SISI[Math.floor(acak() * 4)];
    const sb = SISI[Math.floor(acak() * 4)];
    const t = ruteGaris(a, sa, b, sb);
    if (!siku(t) || t[0].x !== a.x || t[0].y !== a.y || t.at(-1)!.x !== b.x || t.at(-1)!.y !== b.y) gagal++;
  }
  check("3000 rute acak: semua siku, ujung tepat", gagal === 0, `${gagal} gagal`);
}
{
  const nan = JENIS_SIMPUL.filter((j) => {
    const b = bentukSimpul({ jenis: j, x: 10, y: 20, w: 120, h: 60 });
    return !b.d.startsWith("M") || /NaN|undefined/.test(b.d + (b.tambahan ?? ""));
  });
  check("setiap jenis simpul punya bentuk yang sah", nan.length === 0, nan.join() || `${JENIS_SIMPUL.length} jenis`);
  const b = bungkusTeks("satu dua tiga empat lima enam tujuh delapan sembilan sepuluh", 60, 3);
  check("teks dibungkus maksimal 3 baris dengan elipsis", b.length === 3 && b[2].endsWith("…"), JSON.stringify(b));
  check("baris baru eksplisit dihormati", bungkusTeks("a\nb", 200, 5).join("|") === "a|b", "\\n");
  check("kata sangat panjang dipenggal, tidak meluber", bungkusTeks("x".repeat(80), 60, 10).every((l) => l.length < 80), "penggal");
  check("jepret ke grid", jepret(13) === 10 && jepret(16) === 20 && jepret(-14) === -10, "grid 10");
}

// ── 5. Tautan, berkas, ekspor ───────────────────────────────────────────

function diagramAcak(acak: () => number, n: number): Diagram {
  const simpul = Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    jenis: JENIS_SIMPUL[Math.floor(acak() * JENIS_SIMPUL.length)],
    x: Math.round((acak() * 2000 - 1000) * 10) / 10,
    y: Math.round((acak() * 2000 - 1000) * 10) / 10,
    w: 40 + Math.round(acak() * 200),
    h: 40 + Math.round(acak() * 100),
    teks: Array.from({ length: Math.floor(acak() * 30) }, () => "aé😀 <>&\"'~,;\n"[Math.floor(acak() * 14)]).join(""),
  }));
  const garis = Array.from({ length: Math.floor(n * 1.3) }, (_, i) => ({
    id: n + i + 1,
    dari: 1 + Math.floor(acak() * n),
    ke: 1 + Math.floor(acak() * n),
    dariSisi: SISI[Math.floor(acak() * 4)],
    keSisi: SISI[Math.floor(acak() * 4)],
    label: ["", "Ya", "Tidak", "x"][Math.floor(acak() * 4)],
  }));
  return { simpul, garis, nextId: n * 3 + 1 };
}

async function ujiTautan() {
  for (const c of CONTOH_FLOW) {
    const k = await encodeFlow(c.diagram);
    const balik = k ? await decodeFlow(k) : null;
    check(`tautan contoh "${c.nama}" bolak-balik identik`, JSON.stringify(balik) === JSON.stringify(c.diagram), `${k?.length ?? "null"} karakter`);
  }

  const acak = mulberry32(42);
  let beda = 0;
  let bentukSalah = 0;
  for (let i = 0; i < 150; i++) {
    const d = diagramAcak(acak, 1 + Math.floor(acak() * 25));
    const k = await encodeFlow(d);
    if (!k) continue;
    if (!/^1[A-Za-z0-9_-]+$/.test(k)) bentukSalah++;
    const balik = await decodeFlow(k);
    if (JSON.stringify(balik) !== JSON.stringify(d)) beda++;
    if (new URLSearchParams(`f=${k}`).get("f") !== k) bentukSalah++;
  }
  check("150 diagram acak (unicode, < > & \" ') bolak-balik lewat tautan", beda === 0, `${beda} beda`);
  check("kode tautan hanya karakter aman URL", bentukSalah === 0, `${bentukSalah}`);

  const rusak = ["", "1", "2abc", "1!!!", "1AAAA", "0" + "A".repeat(20), "1" + "A".repeat(FLOW_MAX_URL + 5)];
  const hasilRusak = await Promise.all(rusak.map((r) => decodeFlow(r)));
  check("kode rusak → null (tidak melempar)", hasilRusak.every((x) => x === null), `${hasilRusak.filter((x) => x === null).length}/${rusak.length}`);

  const sah = (await encodeFlow(CONTOH_FLOW[0].diagram))!;
  const potong = await decodeFlow(sah.slice(0, Math.floor(sah.length / 2)));
  check("kode terpotong → null", potong === null, "setengah");

  // Bom kompresi: JSON SAH sebesar 2 MB (diagram kosong + satu kunci berisi
  // 2 MB huruf) memampat jadi beberapa KB. Harus SAH — muatan rusak sudah
  // ditolak JSON.parse, dan uji ini tidak akan membuktikan batas ukurannya.
  const spasi = new TextEncoder().encode(JSON.stringify({ n: 1, s: [], g: [], x: "a".repeat(2 * 1024 * 1024) }));
  const cs = new CompressionStream("deflate-raw");
  const w = cs.writable.getWriter();
  void w.write(spasi).then(() => w.close());
  const padat = new Uint8Array(await new Response(cs.readable).arrayBuffer());
  let s = "";
  for (const b of padat) s += String.fromCharCode(b);
  const bom = "1" + btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  check("bom kompresi ditolak tanpa dibongkar penuh", bom.length < FLOW_MAX_URL && (await decodeFlow(bom)) === null, `${bom.length} karakter`);

  const besar = diagramAcak(mulberry32(3), FLOW_MAX_SIMPUL);
  for (const x of besar.simpul) x.teks = "kata acak ".repeat(20).slice(0, FLOW_MAX_TEKS);
  const kBesar = await encodeFlow(besar);
  check("diagram terlalu besar untuk tautan → null (pakai berkas)", kBesar === null || kBesar.length <= FLOW_MAX_URL, String(kBesar?.length ?? "null"));
}

{
  const d = CONTOH_FLOW[2].diagram;
  check("berkas .json bolak-balik identik", JSON.stringify(berkasKeDiagram(diagramKeBerkas(d))) === JSON.stringify(d), "berkas");
  check(
    "berkas asing / rusak → null",
    berkasKeDiagram("{}") === null && berkasKeDiagram("bukan json") === null && berkasKeDiagram(JSON.stringify({ format: "lain", versi: 1, simpul: [], garis: [] })) === null,
    "format",
  );
  const dasar = { nextId: 9, simpul: [{ id: 1, jenis: "proses", x: 0, y: 0, w: 100, h: 50, teks: "x" }], garis: [] as unknown[] };
  const salah: unknown[] = [
    { ...dasar, simpul: [...dasar.simpul, { ...dasar.simpul[0] }] },
    { ...dasar, garis: [{ id: 2, dari: 1, ke: 99, dariSisi: "bawah", keSisi: "atas", label: "" }] },
    { ...dasar, simpul: [{ ...dasar.simpul[0], jenis: "roket" }] },
    { ...dasar, simpul: [{ ...dasar.simpul[0], x: NaN }] },
    { ...dasar, simpul: [{ ...dasar.simpul[0], x: 1e9 }] },
    { ...dasar, simpul: [{ ...dasar.simpul[0], w: 5 }] },
    { ...dasar, simpul: [{ ...dasar.simpul[0], teks: "x".repeat(FLOW_MAX_TEKS + 1) }] },
    { ...dasar, garis: [{ id: 1, dari: 1, ke: 1, dariSisi: "bawah", keSisi: "atas", label: "" }] },
    { ...dasar, garis: [{ id: 2, dari: 1, ke: 1, dariSisi: "serong", keSisi: "atas", label: "" }] },
    { ...dasar, simpul: Array.from({ length: FLOW_MAX_SIMPUL + 1 }, (_, i) => ({ ...dasar.simpul[0], id: i + 1 })) },
  ];
  const ditolak = salah.filter((x) => sahkanDiagram(x) === null).length;
  check("diagram cacat ditolak utuh (semua-atau-tidak)", ditolak === salah.length, `${ditolak}/${salah.length}`);
  const pulih = sahkanDiagram({ ...dasar, nextId: 0 });
  check("nextId rusak dipulihkan di atas id terbesar", pulih?.nextId === 2, String(pulih?.nextId));
}
{
  const svg = diagramKeSvg(CONTOH_FLOW[2].diagram) ?? "";
  const d = CONTOH_FLOW[2].diagram;
  check("ekspor SVG berisi semua simbol & garis", svg.startsWith("<svg") && (svg.match(/<path /g) ?? []).length >= d.simpul.length + d.garis.length, `${svg.length} byte`);
  const jahat = dg([["proses", '<script>alert(1)</script> & "x"']], []);
  const svgJahat = diagramKeSvg(jahat) ?? "";
  check("teks di-escape di SVG (tanpa tag liar)", !svgJahat.includes("<script>") && svgJahat.includes("&lt;script&gt;"), "escape");
  check("diagram kosong → tidak ada ekspor", diagramKeSvg({ simpul: [], garis: [], nextId: 1 }) === null, "null");
}

// ── 6. Operasi penyuntingan ─────────────────────────────────────────────

function beku<T>(x: T): T {
  if (x && typeof x === "object") {
    Object.freeze(x);
    for (const v of Object.values(x)) beku(v);
  }
  return x;
}

{
  const kosong = beku({ simpul: [], garis: [], nextId: 1 } as Diagram);
  const t1 = tambahSimpul(kosong, "proses", 103, 207);
  check(
    "tambah simbol: id dari nextId, posisi dijepret, diagram lama utuh",
    t1.ok && t1.diagram.simpul[0].id === 1 && t1.diagram.nextId === 2 && t1.diagram.simpul[0].x % 10 === 0 && kosong.simpul.length === 0,
    t1.ok ? JSON.stringify(t1.diagram.simpul[0]) : t1.pesan,
  );

  const penuh = beku({
    simpul: Array.from({ length: FLOW_MAX_SIMPUL }, (_, i) => ({ id: i + 1, jenis: "proses" as JenisSimpul, x: 0, y: 0, w: 60, h: 40, teks: "" })),
    garis: [],
    nextId: FLOW_MAX_SIMPUL + 1,
  } as Diagram);
  check("batas jumlah simbol ditolak", !tambahSimpul(penuh, "proses", 0, 0).ok, "maks");

  const d = beku(
    dg(
      [
        ["mulai", "Mulai"],
        ["keputusan", "x > 0?"],
        ["proses", "a = 1"],
        ["proses", "b = 2"],
      ],
      [[1, 2]],
    ),
  );
  const p = pindahkan(d, new Set([3]), 33, -7);
  const s3 = p.simpul.find((s) => s.id === 3)!;
  check("pindah: hanya yang dipilih, dijepret", s3.x === 130 && s3.y === 230 && p.simpul.find((s) => s.id === 4)!.x === 100, `${s3.x},${s3.y}`);

  check("sambung ke diri sendiri ditolak", !sambung(d, 2, 2).ok, "diri");
  check("sambungan kembar ditolak", !sambung(d, 1, 2).ok, "kembar");
  const s1 = sambung(d, 2, 3);
  const s2 = s1.ok ? sambung(s1.diagram, 2, 4) : s1;
  const lbl = s2.ok ? s2.diagram.garis.filter((g) => g.dari === 2).map((g) => g.label) : [];
  check("cabang Keputusan otomatis berlabel Yes lalu No (Cambridge)", lbl.join() === "Yes,No", lbl.join());
  const sisi = s1.ok ? s1.diagram.garis.at(-1)! : null;
  check("sisi otomatis: tujuan di bawah → bawah ke atas", sisi?.dariSisi === "bawah" && sisi?.keSisi === "atas", `${sisi?.dariSisi}/${sisi?.keSisi}`);

  if (s2.ok) {
    const h = hapus(s2.diagram, new Set([2]), new Set());
    check("hapus simbol ikut membuang garisnya", !h.simpul.some((s) => s.id === 2) && h.garis.every((g) => g.dari !== 2 && g.ke !== 2), `${h.garis.length} garis`);
    const dup = duplikat(s2.diagram, new Set([2, 3]));
    if (dup.ok) {
      const ids = [...dup.diagram.simpul.map((s) => s.id), ...dup.diagram.garis.map((g) => g.id)];
      const garisBaru = dup.diagram.garis.filter((g) => dup.baru.includes(g.dari));
      check(
        "duplikat: id unik, garis di dalam pilihan ikut, ke luar tidak",
        new Set(ids).size === ids.length && garisBaru.length === 1 && dup.baru.every((id) => id >= s2.diagram.nextId),
        `${garisBaru.length} garis disalin`,
      );
    } else check("duplikat berhasil", false, dup.pesan);
  }

  const j = ubahJenis(ubahJenis(d, 3, "io"), 4, "io");
  check("ganti jenis: teks sendiri dipertahankan", j.simpul.find((s) => s.id === 3)!.teks === "a = 1", "teks");
  const def = ubahJenis(tambahSimpul(kosong, "proses", 0, 0).ok ? (tambahSimpul(kosong, "proses", 0, 0) as { diagram: Diagram }).diagram : kosong, 1, "io");
  check("ganti jenis: teks bawaan ikut berganti", def.simpul[0].teks === "INPUT X", def.simpul[0].teks);
  check("teks dipotong ke batas", [...ubahTeks(d, 3, "x".repeat(FLOW_MAX_TEKS + 50)).simpul.find((s) => s.id === 3)!.teks].length === FLOW_MAX_TEKS, "maks");
  check("ubah teks yang sama mengembalikan objek yang sama (tanpa entri riwayat)", ubahTeks(d, 3, "a = 1") === d, "===");
}

// ── 7. Riwayat untuk mengetik langsung (panel Properti) ─────────────────
// Teks simbol diterapkan per ketukan; satu sesi mengetik harus tetap SATU undo.
{
  // Seperti FlowWorkspace: ketukan PERTAMA sesi menambah entri, berikutnya mengganti.
  let h = initHistory("awal", "Awal");
  h = pushHistory(h, "sebelum", "Pindah");
  h = pushHistory(h, "x", "Ubah teks");
  for (const t of ["x =", "x = 1"]) h = gantiPuncakHistory(h, t, "Ubah teks");
  check("sesi mengetik mengganti entri teratas, bukan menambah", h.entries.length === 3 && currentState(h) === "x = 1", JSON.stringify(h.entries.map((e) => e.state)));
  check("satu undo mengembalikan keadaan sebelum mengetik", currentState(undoHistory(h)) === "sebelum", currentState(undoHistory(h)));

  const awal = gantiPuncakHistory(initHistory("awal", "Awal"), "a", "Ubah teks");
  check("di kursor 0 keadaan awal tidak tertimpa (entri baru)", awal.entries.length === 2 && currentState(undoHistory(awal)) === "awal", JSON.stringify(awal.entries.map((e) => e.state)));

  const ekor = undoHistory(pushHistory(pushHistory(initHistory("a", "Awal"), "b", "1"), "c", "2"));
  const g = gantiPuncakHistory(ekor, "b2", "Ubah teks");
  check("mengetik setelah undo memotong ekor redo", !canRedo(g) && currentState(g) === "b2" && g.entries.length === 2, JSON.stringify(g.entries.map((e) => e.state)));
}

// ── 8. Garis lurus antar-simbol yang lebarnya berbeda ───────────────────
// Bug yang dilaporkan pemilik: Mulai (140) → Baca (170) → Keputusan (160)
// yang ditaruh di tengah yang sama tetap tersambung garis berbelok kecil.
{
  const lurus = (t: Titik[]) => t.length === 2 && (t[0].x === t[1].x || t[0].y === t[1].y);

  // a) Menaruh & menggeser: titik TENGAH yang dijepret, untuk setiap jenis.
  let d: Diagram = { simpul: [], garis: [], nextId: 1 };
  for (const j of JENIS_SIMPUL) {
    const h = tambahSimpul(d, j, 303, 207);
    if (h.ok) d = h.diagram;
  }
  const tengah = d.simpul.map((s) => [s.x + s.w / 2, s.y + s.h / 2]);
  check("setiap jenis yang ditaruh di titik yang sama punya tengah yang sama (di grid)", tengah.every(([x, y]) => x === 300 && y === 210), JSON.stringify(tengah));
  const p = pindahkan(d, new Set(d.simpul.map((s) => s.id)), 37, -12);
  const tengahP = p.simpul.map((s) => [s.x + s.w / 2, s.y + s.h / 2]);
  check("digeser bersama: tengahnya tetap sejajar & di grid", tengahP.every(([x, y]) => x === 340 && y === 200), JSON.stringify(tengahP.slice(0, 3)));

  // b) Diagram LAMA yang tepinya dijepret (tengah meleset 5px): garisnya diluruskan.
  const lama: Diagram = {
    simpul: [
      { id: 1, jenis: "mulai", x: 230, y: 40, w: 140, h: 50, teks: "Mulai" },
      { id: 2, jenis: "io", x: 220, y: 130, w: 170, h: 60, teks: "Baca x" },
      { id: 3, jenis: "keputusan", x: 220, y: 240, w: 160, h: 90, teks: "x > 0?" },
      { id: 4, jenis: "keputusan", x: 225, y: 380, w: 160, h: 90, teks: "y > 0?" },
      { id: 5, jenis: "proses", x: 400, y: 500, w: 160, h: 60, teks: "a = 1" },
      { id: 6, jenis: "proses", x: 300, y: 650, w: 160, h: 60, teks: "b = 2" },
    ],
    garis: [
      { id: 7, dari: 1, ke: 2, dariSisi: "bawah", keSisi: "atas", label: "" },
      { id: 8, dari: 2, ke: 3, dariSisi: "bawah", keSisi: "atas", label: "" },
      { id: 9, dari: 3, ke: 4, dariSisi: "bawah", keSisi: "atas", label: "Ya" },
      { id: 10, dari: 5, ke: 6, dariSisi: "bawah", keSisi: "atas", label: "" },
    ],
    nextId: 11,
  };
  const r = (id: number) => titikGaris(lama, lama.garis.find((g) => g.id === id)!)!;
  check("Mulai → Baca (meleset 5px): garis lurus", lurus(r(7)), JSON.stringify(r(7)));
  const r8 = r(8);
  const puncak = titikSisi(lama.simpul[2], "atas");
  check("Baca → Keputusan: lurus DAN tepat di puncak ketupat", lurus(r8) && r8[1].x === puncak.x && r8[1].y === puncak.y, JSON.stringify(r8));
  check("ketupat → ketupat (tanpa sisi datar): tetap ke tengah, berbelok", !lurus(r(9)), JSON.stringify(r(9)));
  check("selisih besar (100px) = belokan yang disengaja, tidak diluruskan", !lurus(r(10)), JSON.stringify(r(10)));
  const a1 = ujungGaris(lama.simpul[0], "bawah", lama.simpul[1], "atas");
  check("ujung asal tetap di tengah simbol asal; ujung tujuan yang bergeser", a1.a.x === 300 && a1.b.x === 300, JSON.stringify(a1));
  const naik = ujungGaris(lama.simpul[1], "bawah", lama.simpul[0], "atas");
  check("tidak berhadapan (tujuan di atas) → tidak diubah", naik.b.x === 300 && naik.a.x === 305, JSON.stringify(naik));

  // c) Acak: setiap ujung tetap DI sisi datar bentuknya, rute tetap siku.
  const acak = mulberry32(9618);
  let salah = "";
  for (let i = 0; i < 4000 && !salah; i++) {
    const buat = (id: number): Simpul => {
      const jenis = JENIS_SIMPUL[Math.floor(acak() * JENIS_SIMPUL.length)];
      return { id, jenis, x: Math.round(acak() * 60) * 5, y: Math.round(acak() * 60) * 5, w: 40 + Math.round(acak() * 30) * 5, h: 40 + Math.round(acak() * 16) * 5, teks: "" };
    };
    const s1 = buat(1);
    const s2 = buat(2);
    const sa = SISI[Math.floor(acak() * 4)];
    const sb = SISI[Math.floor(acak() * 4)];
    const { a, b } = ujungGaris(s1, sa, s2, sb);
    const pa = titikSisi(s1, sa);
    const pb = titikSisi(s2, sb);
    const diSisi = (u: Titik, p: Titik, s: Simpul, sisi: Sisi) =>
      sisi === "atas" || sisi === "bawah" ? u.y === p.y && Math.abs(u.x - p.x) <= ruangGeser(s, sisi) : u.x === p.x && Math.abs(u.y - p.y) <= ruangGeser(s, sisi);
    if (!diSisi(a, pa, s1, sa) || !diSisi(b, pb, s2, sb)) salah = JSON.stringify({ s1, s2, sa, sb, a, b });
    else if (!siku(ruteGaris(a, sa, b, sb))) salah = "tidak siku " + JSON.stringify({ s1, s2, sa, sb });
  }
  check("4000 pasangan acak: ujung selalu di bagian datar sisinya, rute siku", salah === "", salah);
}

// ── 9. Bentuk baku Cambridge (IGCSE 0478 / O Level 2210) ────────────────
// Bawaan = gaya Cambridge; bentuk lama/Indonesia TETAP berjalan dan hanya
// mendapat saran "gaya-cambridge" di tab Periksa.
{
  const nilai = (src: string, vars = v({ X: 7, Nama: "ani", Selesai: false })) => hasil(src, vars);
  check("MOD/DIV operator & bentuk fungsi MOD(a, b), DIV(a, b)", nilai("X MOD 2") === 1 && nilai("MOD(X, 2)") === 1 && nilai("DIV(X, 2)") === 3 && nilai("X DIV 2") === 3, `${nilai("MOD(X, 2)")} ${nilai("DIV(X, 2)")}`);
  check("& menyambung teks", nilai('"Hai " & Nama') === "Hai ani", String(nilai('"Hai " & Nama')));
  check("AND/OR/NOT, <> dan = di kondisi", nilai("X > 5 AND NOT Selesai") === true && nilai("X <> 7 OR X = 7") === true, "");
  check("fungsi Cambridge: INT, ROUND(x, n), LENGTH, UCASE, LCASE", nilai("INT(7.9)") === 7 && nilai("INT(-7.9)") === -7 && nilai("ROUND(3.14159, 2)") === 3.14 && nilai("LENGTH(Nama)") === 3 && nilai("UCASE(Nama)") === "ANI" && nilai("LCASE(\"AB\")") === "ab", `${nilai("ROUND(3.14159, 2)")}`);
  const kondisi = (src: string) => {
    try {
      return evaluasiKondisi(src, v({ X: 7 }));
    } catch (e) {
      return `GALAT: ${(e as Error).message}`;
    }
  };
  check("Keputusan diawali Is / Apakah", kondisi("Is X > 5?") === true && kondisi("Apakah X < 5?") === false, `${kondisi("Is X > 5?")} ${kondisi("Apakah X < 5?")}`);
  const jalanBaku = jalankan(
    dg(
      [
        ["mulai", "START"],
        ["io", "INPUT Panjang"],
        ["io", "INPUT Lebar"],
        ["proses", "Luas ← Panjang * Lebar"],
        ["io", 'OUTPUT "Luas = ", Luas'],
        ["selesai", "STOP"],
      ],
      [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
    ),
    "4, 5",
  );
  check("flowchart gaya Cambridge berjalan; OUTPUT menyambung tanpa pemisah", jalanBaku.status === "selesai" && jalanBaku.keluaran.join("|") === "Luas = 20", `${jalanBaku.status} ${jalanBaku.keluaran} ${jalanBaku.galat ?? ""}`);
  const jalanLama = jalankan(
    dg(
      [
        ["mulai", "Mulai"],
        ["io", "Baca a, b"],
        ["proses", "c = a + b\nc += 1"],
        ["keputusan", "c == 10 dan a != 0?"],
        ["io", 'Tampilkan "c =", c'],
        ["io", "Tampilkan 0"],
        ["selesai", "Selesai"],
      ],
      [[1, 2], [2, 3], [3, 4], [4, 5, "Ya"], [4, 6, "Tidak"], [5, 7], [6, 7]],
    ),
    "4, 5",
  );
  check("flowchart gaya lama (Baca/Tampilkan/=/dan/Ya) TETAP berjalan, Tampilkan memakai spasi", jalanLama.status === "selesai" && jalanLama.keluaran.join("|") === "c = 10", `${jalanLama.status} ${jalanLama.keluaran} ${jalanLama.galat ?? ""}`);

  const gaya = (jenis: JenisSimpul, teks: string) => saranGaya({ id: 1, jenis, x: 0, y: 0, w: 160, h: 60, teks }).join(" | ");
  check("saran: Baca → INPUT", gaya("io", "Baca x").includes("tulis INPUT"), gaya("io", "Baca x"));
  check("saran: satu INPUT per variabel", gaya("io", "INPUT a, b").includes("satu INPUT"), gaya("io", "INPUT a, b"));
  check("saran: Tampilkan → OUTPUT", gaya("io", 'Tampilkan "x"').includes("tulis OUTPUT"), gaya("io", 'Tampilkan "x"'));
  check("saran: x = 1 → ←", gaya("proses", "x = 1").includes("←"), gaya("proses", "x = 1"));
  check("tanpa saran: x <- 1 (cara mengetik ←) dan X ← X + 1", gaya("proses", "x <- 1") === "" && gaya("proses", "X ← X + 1") === "", gaya("proses", "x <- 1"));
  const k = gaya("keputusan", "n mod 2 == 0 dan benar?");
  check("saran kondisi: mod → MOD, == → =, dan → AND, benar → TRUE", k.includes("→ MOD") && k.includes('"==" → =') && k.includes("→ AND") && k.includes("→ TRUE"), k);
  check("tanpa saran: kondisi baku", gaya("keputusan", "Is X MOD 2 = 0 AND NOT Selesai?") === "" && gaya("keputusan", "X <> 0?") === "", gaya("keputusan", "X <> 0?"));
  check("saran: Mulai/Selesai → START/STOP", gaya("mulai", "Mulai").includes("START") && gaya("selesai", "Selesai").includes("STOP") && gaya("mulai", "Start") === "", "");

  const label = periksaDiagram(
    dg(
      [
        ["mulai", "START"],
        ["keputusan", "X > 0?"],
        ["selesai", "STOP"],
        ["selesai", "STOP"],
      ],
      [[1, 2], [2, 3, "Ya"], [2, 4, "Tidak"]],
    ),
  ).filter((t) => t.kode === "gaya-cambridge");
  check("saran: label Ya/Tidak → Yes/No, menyorot kedua garis", label.length === 1 && label[0].garis.length === 2 && label[0].pesan.includes("Yes/No"), label.map((t) => t.pesan).join(" | "));
  const contohBaku = CONTOH_FLOW.flatMap((c) => periksaDiagram(c.diagram).filter((t) => t.tingkat === "saran" || t.tingkat === "galat").map((t) => `${c.id}: ${t.pesan}`));
  check("semua contoh siap pakai sudah baku Cambridge (tanpa saran/galat)", contohBaku.length === 0, contohBaku.join(" | "));
  const bawaan = JENIS_SIMPUL.filter((j) => j !== "catatan" && j !== "konektor").flatMap((j) => {
    const d = tambahSimpul({ simpul: [], garis: [], nextId: 1 }, j, 0, 0);
    return d.ok ? saranGaya(d.diagram.simpul[0]).map((x) => `${j}: ${x}`) : [];
  });
  check("teks bawaan setiap simbol sudah baku", bawaan.length === 0, bawaan.join(" | "));
}

ujiTautan().then(finish);
