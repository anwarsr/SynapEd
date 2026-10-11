/**
 * Menjaga pengetahuan Asisten SynapEd tetap sejalan dengan situsnya.
 *
 * Asisten hanya tahu apa yang tertulis di `chatKnowledge.ts` dan hanya boleh
 * menaut halaman di `chatLinks.ts`. Keduanya ditulis tangan, jadi bisa
 * tertinggal diam-diam — dan pernah: berminggu-minggu asisten bersikeras
 * kursus berbayar belum bisa dibeli. Suite ini membuat ketertinggalan itu
 * gagal keras alih-alih menunggu dilaporkan pengguna:
 *
 *   1. setiap halaman yang ditautkan asisten benar-benar ada;
 *   2. setiap halaman situs DIPUTUSKAN — ditautkan, atau sengaja dikecualikan
 *      dengan alasan tertulis. Halaman baru tanpa keputusan = merah;
 *   3. setiap alamat yang disebut di teks pengetahuan termasuk yang boleh
 *      ditautkan (kalau tidak, model akan menautkannya juga);
 *   4. frasa yang sudah terbukti basi tidak muncul lagi.
 *
 * Murni: tanpa dev server dan tanpa kredensial.
 *
 *   npx tsx scripts/verify-chat-knowledge.ts
 */
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { check, finish } from "./checks";
import { CHAT_LINKS, CHAT_LINKS_DIKECUALIKAN } from "../frontend/src/lib/chatLinks";
import { PENGETAHUAN_SITUS } from "../frontend/src/lib/chatKnowledge";

const APP = resolve(__dirname, "../frontend/src/app");

/** `[slug]`, `[[...x]]`, `{slug}` → `*`; grup `(x)` dibuang. */
function normal(path: string): string {
  const bagian = path
    .split("/")
    .filter((s) => s !== "" && !/^\(.*\)$/.test(s))
    .map((s) => (/^\[.*\]$/.test(s) || /^\{.*\}$/.test(s) ? "*" : s));
  return `/${bagian.join("/")}`;
}

/** Seluruh halaman situs, dari folder yang memuat page.tsx. */
function daftarRute(dir: string, awalan = ""): string[] {
  const out: string[] = [];
  for (const nama of readdirSync(dir)) {
    const penuh = join(dir, nama);
    if (statSync(penuh).isDirectory()) {
      if (nama === "api") continue;
      out.push(...daftarRute(penuh, `${awalan}/${nama}`));
    } else if (/^page\.(tsx|ts|jsx|js)$/.test(nama)) {
      out.push(normal(awalan || "/"));
    }
  }
  return out;
}

/** Kunci berakhiran "/" = hanya turunannya; selain itu = halaman itu + turunannya. */
function tercakup(rute: string, kunci: string): boolean {
  const k = normal(kunci) + (kunci.endsWith("/") && kunci !== "/" ? "/" : "");
  if (k.endsWith("/") && k !== "/") return rute.startsWith(k);
  if (k === "/") return rute === "/";
  return rute === k || rute.startsWith(`${k}/`);
}

const rute = [...new Set(daftarRute(APP))].sort();
const tautan = CHAT_LINKS.map((l) => normal(l.path));
const kunciKecuali = Object.keys(CHAT_LINKS_DIKECUALIKAN);

check("halaman situs terbaca", rute.length >= 10 && rute.includes("/courses"), `${rute.length} halaman`);

// 1 ── Tautan asisten menunjuk halaman yang ada ─────────────────────────
{
  const mati = tautan.filter((t) => !rute.includes(t));
  check("setiap tautan asisten adalah halaman yang ada", mati.length === 0, mati.join(", ") || "semua ada");

  const ganda = tautan.filter((t, i) => tautan.indexOf(t) !== i);
  check("tidak ada tautan ganda", ganda.length === 0, ganda.join(", ") || "unik");

  const bertabrakan = tautan.filter((t) => kunciKecuali.some((k) => tercakup(t, k)));
  check(
    "tidak ada halaman yang sekaligus ditautkan DAN dikecualikan",
    bertabrakan.length === 0,
    bertabrakan.join(", ") || "terpisah",
  );
}

// 2 ── Setiap halaman sudah diputuskan ─────────────────────────────────
{
  const belum = rute.filter((r) => !tautan.includes(r) && !kunciKecuali.some((k) => tercakup(r, k)));
  check(
    "setiap halaman situs ditautkan atau sengaja dikecualikan",
    belum.length === 0,
    belum.length === 0
      ? "tidak ada yang terlewat"
      : `belum diputuskan: ${belum.join(", ")} — perbarui chatKnowledge.ts lalu daftarkan di chatLinks.ts`,
  );

  const kecualiMati = kunciKecuali.filter((k) => !rute.some((r) => tercakup(r, k)));
  check(
    "setiap pengecualian masih menunjuk halaman yang ada",
    kecualiMati.length === 0,
    kecualiMati.join(", ") || "semua hidup",
  );

  const tanpaAlasan = kunciKecuali.filter((k) => CHAT_LINKS_DIKECUALIKAN[k].trim().length < 10);
  check("setiap pengecualian punya alasan", tanpaAlasan.length === 0, tanpaAlasan.join(", ") || "lengkap");
}

// 3 ── Alamat di teks pengetahuan boleh ditautkan ──────────────────────
{
  // Garis miring yang didahului huruf/angka ("JPG/PNG") bukan alamat.
  const disebut = [...PENGETAHUAN_SITUS.matchAll(/(?<![\w.])\/[a-z][a-z0-9\-]*(?:\/[a-z0-9\-{}]+)*/g)].map((m) =>
    normal(m[0]),
  );
  const asing = [...new Set(disebut.filter((d) => !tautan.includes(d)))];
  check(
    "setiap alamat di chatKnowledge.ts ada di CHAT_LINKS",
    asing.length === 0,
    asing.join(", ") || `${new Set(disebut).size} alamat, semuanya terdaftar`,
  );
}

// 4 ── Frasa yang terbukti basi ────────────────────────────────────────
{
  const FRASA_BASI = ["belum bisa dibeli", "segera hadir", "direncanakan untuk fase berikutnya"];
  const muncul = FRASA_BASI.filter((f) => PENGETAHUAN_SITUS.toLowerCase().includes(f));
  check("frasa basi tidak muncul lagi", muncul.length === 0, muncul.join(", ") || "bersih");

  check(
    "pengetahuan tidak kosong & menyebut fitur utama",
    ["/courses", "/kelas", "/lab", "/dashboard", "referral", "Sertifikat"].every((k) => PENGETAHUAN_SITUS.includes(k)),
    `${PENGETAHUAN_SITUS.length} karakter`,
  );
}

finish();
