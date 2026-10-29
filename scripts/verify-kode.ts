/**
 * Menguji bagian murni lab kode SynapLab (Lab 04 Python & Lab 05 Pseudocode)
 * — tanpa dev server & kredensial.
 *
 *   npx tsx scripts/verify-kode.ts
 *
 * Yang dijaga:
 *   1. pemadatan tautan (labKompres) bolak-balik, rusak → null, bom kompresi
 *      dengan muatan SAH ditolak;
 *   2. tautan `?py=`/`?ps=`, berkas `.py`/`.txt`, dan draf: semua-atau-tidak;
 *   3. penyorot sintaks: teks berwarna = teks asli per baris, tak pernah
 *      melempar, dan memberi jenis token yang benar;
 *   4. saran galat Python berbahasa Indonesia;
 *   5. `sahkanJejak`: hasil worker Python yang bentuknya salah ditolak;
 *   6. CSP worker Python TIDAK dilonggarkan (tanpa eval, tanpa 'self', hanya
 *      direktori Pyodide berversi) dan worker menghapus API jaringan;
 *   7. teks yang tampil ke pengguna tidak memakai em dash (aturan pemilik).
 *
 * Pyodide sendiri tidak berjalan di sini — perilakunya dijaga uji browser.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { check, finish } from "./checks";
import { bukaPadatan, padatkan } from "../frontend/src/lib/lab/labKompres";
import {
  berkasKeKode,
  decodeKode,
  drafKeTeks,
  encodeKode,
  KODE_MAX_URL,
  teksKeDraf,
} from "../frontend/src/lib/lab/kodeUrl";
import { KODE_MAKS_KARAKTER, KODE_MAKS_MASUKAN, sahkanJejak, type JejakKode } from "../frontend/src/lib/lab/kodeTypes";
import { sorotKode } from "../frontend/src/lib/lab/kodeSorot";
import { saranPython } from "../frontend/src/lib/lab/python/pythonGalat";
import { KODE_PELACAK } from "../frontend/src/lib/lab/python/pythonPelacak";
import { PYODIDE_INDEX_URL, PYTHON_WORKER_CSP } from "../frontend/src/lib/lab/python/pythonVersi";
import { CONTOH_PYTHON } from "../frontend/src/lib/lab/python/pythonContoh";
import { CONTOH_PSEUDO } from "../frontend/src/lib/lab/pseudo/pseudoContoh";
import { jalankanPseudo } from "../frontend/src/lib/lab/pseudo/pseudoJalan";
import { mulberry32 } from "../frontend/src/lib/lab/labRandom";

async function main() {
  // ── 1. Pemadatan ──────────────────────────────────────────────────────
  console.log("\n1. Pemadatan tautan");
  {
    const teks = 'DECLARE x : INTEGER\nx ← 1 // ✓ émoji 🎉 "kutip" & + = ~';
    const p = await padatkan(teks);
    check("padatkan → bukaPadatan bolak-balik (Unicode)", p !== null && (await bukaPadatan(p, 1e6)) === teks, p ?? "null");
    check("base64url: hanya [A-Za-z0-9_-]", !!p && /^[A-Za-z0-9_-]+$/.test(p), p ?? "");
    check("karakter di luar base64url → null", (await bukaPadatan("ab+c/d=", 1e6)) === null, "");
    check("padatan rusak → null", (await bukaPadatan("AAAAAAAAAAAAAAAA", 1e6)) === null, "");
    const besar = "a".repeat(2 * 1024 * 1024);
    const pb = (await padatkan(besar))!;
    check("2 MB teks sah memadat jadi kecil (prasyarat uji bom)", pb.length < 8000, `${pb.length} karakter`);
    check("bom kompresi: hasil > batas ditolak", (await bukaPadatan(pb, 256 * 1024)) === null, "");
    check("…dan diterima bila batasnya cukup (bukti muatannya sah)", (await bukaPadatan(pb, 3 * 1024 * 1024)) === besar, "");
  }

  // ── 2. Tautan, berkas, draf ───────────────────────────────────────────
  console.log("\n2. Tautan ?py= / ?ps=, berkas, draf");
  {
    const isi = { kode: 'print("halo + dunia & ~ ; :")\nx = 1\n', masukan: "4\n5\nteks dengan, koma" };
    const k = (await encodeKode(isi))!;
    check("encode → decode bolak-balik", JSON.stringify(await decodeKode(k)) === JSON.stringify(isi), k);
    check("tautan diawali digit versi", k.startsWith("1"), k.slice(0, 4));
    check("versi asing → null", (await decodeKode("9" + k.slice(1))) === null, "");
    check("tautan terpotong → null", (await decodeKode(k.slice(0, -6))) === null, "");
    check("tautan terlalu panjang → null", (await decodeKode("1" + "A".repeat(KODE_MAX_URL))) === null, "");
    for (const [nama, mentah] of [
      ["bukan objek", "[1,2]"],
      ["k bukan teks", '{"k":5,"m":""}'],
      ["m hilang", '{"k":"x"}'],
      ["kode terlalu panjang", JSON.stringify({ k: "x".repeat(KODE_MAKS_KARAKTER + 1), m: "" })],
      ["masukan terlalu panjang", JSON.stringify({ k: "x", m: "1".repeat(KODE_MAKS_MASUKAN + 1) })],
    ] as const) {
      check(`muatan salah bentuk ditolak: ${nama}`, (await decodeKode("1" + (await padatkan(mentah))!)) === null, "");
    }
    // Bom dengan JSON yang SAH dan lolos sahkanIsi: hanya batas dekompresi yang bisa menolaknya.
    const bom = '{"k":"x","m":""' + " ".repeat(400 * 1024) + "}";
    const kb = "1" + (await padatkan(bom))!;
    check("bom kompresi berisi JSON sah ditolak oleh batas dekompresi", kb.length <= KODE_MAX_URL && (await decodeKode(kb)) === null, `${kb.length} karakter`);
    check("kode di atas batas tidak bisa dijadikan tautan", (await encodeKode({ kode: "x".repeat(KODE_MAKS_KARAKTER + 1), masukan: "" })) === null, "");
    const acak = mulberry32(4);
    const tidakPadat = Array.from({ length: KODE_MAKS_KARAKTER }, () => String.fromCharCode(33 + Math.floor(acak() * 90))).join("");
    check("kode acak yang tak bisa dipadatkan di bawah 8000 → null (pakai berkas)", (await encodeKode({ kode: tidakPadat, masukan: "" })) === null, "");

    check("berkas: BOM & CRLF dinormalkan", berkasKeKode("\uFEFFa = 1\r\nprint(a)\r\n") === "a = 1\nprint(a)\n", JSON.stringify(berkasKeKode("\uFEFFa = 1\r\nprint(a)\r\n")));
    check("berkas: tab tetap", berkasKeKode("if x:\n\tpass\n") === "if x:\n\tpass\n", "");
    check("berkas biner (karakter kendali) ditolak", berkasKeKode("PNG\u0000\u0001data") === null, "");
    check("berkas terlalu panjang ditolak", berkasKeKode("x".repeat(KODE_MAKS_KARAKTER + 1)) === null, "");
    const d = drafKeTeks({ kode: "x", masukan: "1" });
    check("draf bolak-balik; draf rusak/kosong → null", JSON.stringify(teksKeDraf(d)) === '{"kode":"x","masukan":"1"}' && teksKeDraf("{rusak") === null && teksKeDraf(null) === null && teksKeDraf('{"k":1}') === null, d);
  }

  // ── 3. Penyorot ───────────────────────────────────────────────────────
  console.log("\n3. Penyorot sintaks");
  {
    const utuh = (src: string, b: "python" | "pseudocode") => {
      const hasil = sorotKode(src, b);
      const baris = src.split("\n");
      return hasil.length === baris.length && hasil.every((t, i) => t.map((x) => x.v).join("") === baris[i]);
    };
    check("contoh pseudocode: teks berwarna = teks asli", CONTOH_PSEUDO.every((c) => utuh(c.kode, "pseudocode")), "");
    check("contoh Python: teks berwarna = teks asli", CONTOH_PYTHON.every((c) => utuh(c.kode, "python")), "");
    const acak = mulberry32(9618);
    const huruf = ['"', "'", "“", "ꞌ", "#", "/", "(", ")", "\\", "a", "1", ".", " ", "\n", "\t", "<", "-", "←", "f", "r", "e", "_", "I", "F"];
    let rusak = "";
    for (let n = 0; n < 3000 && !rusak; n++) {
      const src = Array.from({ length: Math.floor(acak() * 80) }, () => huruf[Math.floor(acak() * huruf.length)]).join("");
      for (const b of ["python", "pseudocode"] as const) {
        try {
          if (!utuh(src, b)) rusak = `${b}: ${JSON.stringify(src)}`;
        } catch (e) {
          rusak = `${b} melempar ${String(e)}: ${JSON.stringify(src)}`;
        }
      }
    }
    check("3000 teks acak: tak pernah melempar, teks selalu utuh", rusak === "", rusak);

    const jenisDari = (src: string, b: "python" | "pseudocode") => sorotKode(src, b)[0].filter((t) => t.v.trim()).map((t) => `${t.t}:${t.v.trim()}`);
    const ps = jenisDari('IF Nilai >= 70 THEN OUTPUT LENGTH("ab"), \'c\' // catatan', "pseudocode");
    check(
      "pseudocode: kata kunci, fungsi bawaan, teks, CHAR, komentar",
      ["kunci:IF", "kunci:THEN", "kunci:OUTPUT", "fungsi:LENGTH", 'teks:"ab"', "teks:'c'", "komentar:// catatan"].every((x) => ps.includes(x)) && ps.includes("angka:70"),
      ps.join(" "),
    );
    check("pseudocode: tipe & panah", jenisDari("DECLARE x : INTEGER\nx ← 1", "pseudocode").includes("tipe:INTEGER") && jenisDari("x ← 1", "pseudocode").includes("kunci:←"), "");
    check("pseudocode: nama berhuruf kecil bukan kata kunci", !jenisDari("if = 1", "pseudocode").some((x) => x.startsWith("kunci:if")), "");
    const py = jenisDari("def f(x): return print(f'{x}') # c", "python");
    check("Python: def/return kata kunci, print( fungsi, f-string teks, komentar", ["kunci:def", "kunci:return", "fungsi:print", "teks:f'{x}'", "komentar:# c"].every((x) => py.includes(x)), py.join(" "));
    const tiga = sorotKode('s = """baris satu\n# bukan komentar\nakhir""" # komentar', "python");
    check("Python: string tiga-kutip lintas baris tetap teks", tiga[1].length === 1 && tiga[1][0].t === "teks" && tiga[2].some((t) => t.t === "komentar"), JSON.stringify(tiga[1]));
  }

  // ── 4. Saran galat Python ─────────────────────────────────────────────
  console.log("\n4. Saran galat Python");
  {
    const kasus: [string, string, string][] = [
      ["NameError", "NameError: name 'true' is not defined", "True"],
      ["NameError", "NameError: name 'totl' is not defined", "totl belum dibuat"],
      ["TypeError", 'TypeError: can only concatenate str (not "int") to str', "int(input())"],
      ["TypeError", "TypeError: unsupported operand type(s) for +: 'int' and 'str'", "int(input())"],
      ["TypeError", "TypeError: '>' not supported between instances of 'str' and 'int'", "int(…)"],
      ["ValueError", "ValueError: invalid literal for int() with base 10: 'tiga'", '"tiga" bukan bilangan bulat'],
      ["ValueError", "ValueError: invalid literal for int() with base 10: '2.5'", "float(…)"],
      ["SyntaxError", "SyntaxError: expected ':'", "titik dua"],
      ["SyntaxError", "SyntaxError: invalid syntax. Maybe you meant '==' or ':=' instead of '='?", "=="],
      ["SyntaxError", "SyntaxError: invalid character '“' (U+201C)", "kutip miring"],
      ["IndentationError", "IndentationError: expected an indented block after 'if' statement on line 1", "menjorok"],
      ["ZeroDivisionError", "ZeroDivisionError: division by zero", "nol"],
      ["IndexError", "IndexError: list index out of range", "len(list) - 1"],
      ["EOFError", "EOFError: EOF when reading a line", "Masukan habis"],
      ["AttributeError", "AttributeError: 'list' object has no attribute 'push'", "append"],
      ["ModuleNotFoundError", "ModuleNotFoundError: No module named 'numpy'", "numpy"],
      ["ImportError", "ImportError: Modul 'js' tidak tersedia di SynapLab (kode tidak boleh mengakses browser).", "sengaja dimatikan"],
      ["Batas waktu", "Program dihentikan setelah 10 detik.", "while"],
    ];
    for (const [jenis, pesan, harap] of kasus) {
      const s = saranPython({ jenis, pesan });
      check(`${jenis}: ${pesan.slice(0, 48)}`, !!s && s.includes(harap), s ?? "null");
    }
    check("galat tak dikenal → null", saranPython({ jenis: "FloatingPointError", pesan: "x" }) === null, "");
  }

  // ── 5. sahkanJejak ────────────────────────────────────────────────────
  console.log("\n5. Validasi hasil worker (sahkanJejak)");
  {
    const sah: JejakKode = {
      langkah: [
        { baris: 1, vars: [{ nama: "x", nilai: "1", jenis: "int", lingkup: "global" }], panjangKeluaran: 0, tumpukan: [] },
        { baris: null, vars: [], panjangKeluaran: 2, tumpukan: [] },
      ],
      keluaran: "1\n",
      galat: null,
      terpotong: false,
    };
    check("jejak sah diterima utuh", JSON.stringify(sahkanJejak(JSON.parse(JSON.stringify(sah)))) === JSON.stringify(sah), "");
    const rusak = (ubah: (j: Record<string, unknown>) => void) => {
      const j = JSON.parse(JSON.stringify(sah));
      ubah(j);
      return sahkanJejak(j);
    };
    const kasus: [string, (j: any) => void][] = [
      ["baris bukan angka", (j) => (j.langkah[0].baris = "1")],
      ["baris 0", (j) => (j.langkah[0].baris = 0)],
      ["panjangKeluaran melebihi keluaran", (j) => (j.langkah[1].panjangKeluaran = 99)],
      ["vars bukan larik", (j) => (j.langkah[0].vars = {})],
      ["nilai variabel terlalu panjang", (j) => (j.langkah[0].vars[0].nilai = "x".repeat(401))],
      ["galat bukan objek", (j) => (j.galat = "boom")],
      ["galat tanpa pesan", (j) => (j.galat = { baris: 1, jenis: "X", saran: null })],
      ["terpotong bukan boolean", (j) => (j.terpotong = "ya")],
      ["langkah terlalu banyak", (j) => (j.langkah = Array.from({ length: 2002 }, () => j.langkah[1]))],
      ["tumpukan berisi bukan teks", (j) => (j.langkah[0].tumpukan = [{}])],
    ];
    for (const [nama, f] of kasus) check(`ditolak: ${nama}`, rusak(f) === null, "");
    check("bukan objek → null", sahkanJejak("teks") === null && sahkanJejak(null) === null, "");
  }

  // ── 6. Sandbox worker Python ──────────────────────────────────────────
  console.log("\n6. Sandbox worker Python");
  {
    // next.config.ts tidak diimpor (memakai import.meta, ditolak typecheck skrip);
    // isi kebijakannya diuji dari konstantanya, pemasangannya dari teks berkas.
    const csp = PYTHON_WORKER_CSP;
    const konfig = readFileSync(resolve(__dirname, "../frontend/next.config.ts"), "utf8");
    check(
      "next.config.ts memasang PYTHON_WORKER_CSP pada PYTHON_WORKER_URL",
      /source: PYTHON_WORKER_URL,[\s\S]{0,120}key: "Content-Security-Policy", value: PYTHON_WORKER_CSP/.test(konfig),
      "",
    );
    const arahan = new Map(csp.split(";").map((s) => s.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
    check("CSP worker terpasang", csp !== "", csp);
    check("default-src 'none'", JSON.stringify(arahan.get("default-src")) === `["'none'"]`, String(arahan.get("default-src")));
    check(
      "script-src hanya direktori Pyodide berversi + wasm-unsafe-eval (tanpa eval, tanpa 'self')",
      JSON.stringify(arahan.get("script-src")) === JSON.stringify([PYODIDE_INDEX_URL, "'wasm-unsafe-eval'"]),
      String(arahan.get("script-src")),
    );
    check("connect-src hanya direktori Pyodide berversi", JSON.stringify(arahan.get("connect-src")) === JSON.stringify([PYODIDE_INDEX_URL]), String(arahan.get("connect-src")));
    check("worker-src 'none'", JSON.stringify(arahan.get("worker-src")) === `["'none'"]`, String(arahan.get("worker-src")));
    check("alamat Pyodide dikunci versi persis", /^https:\/\/cdn\.jsdelivr\.net\/pyodide\/v\d+\.\d+\.\d+\/full\/$/.test(PYODIDE_INDEX_URL), PYODIDE_INDEX_URL);
    const worker = readFileSync(resolve(__dirname, "../frontend/public/lab/python-worker.js"), "utf8");
    const terlarang = worker.match(/API_TERLARANG = \[([\s\S]*?)\]/)?.[1] ?? "";
    const wajib = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "WebTransport", "importScripts", "indexedDB", "caches", "Worker"];
    check("worker menghapus API jaringan & penyimpanan", wajib.every((n) => terlarang.includes(`"${n}"`)), wajib.filter((n) => !terlarang.includes(`"${n}"`)).join(", ") || "lengkap");
    check("penghapusan dipanggil setelah Pyodide siap", /kunciJaringan\(\);\s*self\.postMessage\(\{ jenis: "siap" \}\)/.test(worker), "");
    check("pelacak memasang penghalang impor js/pyodide", KODE_PELACAK.includes("sys.meta_path.insert(0, _SynPenghalang())") && /"js", "pyodide"/.test(KODE_PELACAK), "");
    check("pelacak memulihkan builtins setiap jalan", KODE_PELACAK.includes("builtins.__dict__.update(_SYN_BUILTINS)"), "");
  }

  // ── 7. Tanda pisah di teks tampilan ───────────────────────────────────
  console.log("\n7. Teks tampilan tanpa em dash");
  {
    const program = [
      "x ← 1",
      "DECLARE x : INTEGER\nx ← 2.5",
      "DECLARE A : ARRAY[1:2] OF INTEGER\nA[3] ← 1",
      'PRINT "x"',
      "DECLARE i : INTEGER\nWHILE TRUE\n  i ← 1\nENDWHILE",
      "OUTPUT 2 ^ 2",
      "FOR i ← 1 TO 3\nNEXT i",
      'OUTPUT "a" + 1',
      "DECLARE x : INTEGER\nINPUT x",
    ];
    const berdash = program
      .map((p) => jalankanPseudo(p, "").galat)
      .filter((g) => g && (g.pesan + (g.saran ?? "")).includes("—"));
    check("pesan & saran galat pseudocode tanpa —", berdash.length === 0, berdash.map((g) => g!.pesan).join(" | "));
    const sumber = ["pythonGalat.ts"].map((f) => readFileSync(resolve(__dirname, `../frontend/src/lib/lab/python/${f}`), "utf8"));
    const barisDash = sumber.flatMap((s) => s.split("\n")).filter((l) => l.includes("—") && !/^\s*(\*|\/\/|\/\*)/.test(l));
    check("saran galat Python tanpa —", barisDash.length === 0, barisDash.slice(0, 2).join(" | "));
  }

  finish();
}

void main();
