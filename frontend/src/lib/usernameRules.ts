/**
 * Aturan username.
 *
 * Modul ini NETRAL — tanpa `server-only`, tanpa `use client`, dan tanpa impor
 * alias `@/`. Tiga pemakai membutuhkannya: formulir di browser (validasi saat
 * mengetik), server (penjaga sebenarnya), dan skrip backfill yang dijalankan
 * tsx di luar Next. Impor alias akan membuat skrip itu gagal diurai, dan
 * skrip yang membawa salinan aturannya sendiri akan melenceng.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const USERNAME_CHANGE_COOLDOWN_DAYS = 14;

/**
 * Nama yang tidak boleh dipakai siapa pun.
 *
 * Dua golongan: nama rute (supaya `/@admin` atau tautan sejenis kelak tidak
 * bertabrakan dengan halaman sungguhan) dan kata yang dipakai untuk menyamar
 * sebagai pengelola situs.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "admin",
  "administrator",
  "synaped",
  "synap",
  "support",
  "bantuan",
  "help",
  "root",
  "system",
  "api",
  "dashboard",
  "profil",
  "profile",
  "pengaturan",
  "settings",
  "courses",
  "kursus",
  "kelas",
  "educator",
  "masuk",
  "daftar",
  "login",
  "logout",
  "register",
  "verify",
  "me",
  "null",
  "undefined",
  "official",
  "resmi",
  "moderator",
  "staff",
  "pengguna",
]);

/**
 * Menormalkan masukan: buang spasi di tepi dan `@` di depan, jadikan huruf
 * kecil. BUKAN validasi — hasilnya masih bisa tidak sah.
 */
export function normalizeUsernameInput(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Pesan galat berbahasa Indonesia, atau null bila sah. */
export function validateUsername(u: string): string | null {
  if (u.length < USERNAME_MIN) return `Username minimal ${USERNAME_MIN} karakter.`;
  if (u.length > USERNAME_MAX) return `Username maksimal ${USERNAME_MAX} karakter.`;
  if (!/^[a-z0-9._]+$/.test(u)) {
    return "Username hanya boleh berisi huruf kecil, angka, titik, dan garis bawah.";
  }
  if (!/[a-z]/.test(u)) return "Username harus memuat setidaknya satu huruf.";
  if (u.startsWith(".") || u.endsWith(".")) {
    return "Username tidak boleh diawali atau diakhiri titik.";
  }
  if (u.includes("..")) return "Username tidak boleh memuat dua titik berurutan.";
  if (RESERVED_USERNAMES.has(u)) return "Username ini tidak tersedia.";
  return null;
}

/** FNV-1a 32-bit — deterministik, tanpa ketergantungan node:crypto. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Bentuk dasar dari bagian lokal email, atau null bila tidak bisa dipakai. */
export function baseUsernameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;

  const lokal = email.split("@")[0] ?? "";

  const dasar = lokal
    .toLowerCase()
    .replace(/\+.*$/, "") // alias gmail: budi+kursus -> budi
    .replace(/-/g, "_")
    .replace(/[^a-z0-9._]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 24)
    .replace(/\.+$/g, "");

  return validateUsername(dasar) === null ? dasar : null;
}

/**
 * Calon username untuk satu akun, urut dari yang paling diinginkan.
 *
 * Deterministik untuk pasangan (email, uid) yang sama — kecuali cadangan acak
 * di ujung, yang hanya dipakai kalau seluruh calon lain sudah terisi. Dengan
 * begitu backfill yang dijalankan dua kali menawarkan nama yang sama, bukan
 * nama baru setiap kali.
 */
export function usernameCandidates(
  email: string | null | undefined,
  uid: string,
  random: () => number = Math.random,
): string[] {
  const dasar = baseUsernameFromEmail(email) ?? "pengguna";
  const hasil: string[] = [];

  const tambah = (u: string) => {
    const potong = u.slice(0, USERNAME_MAX);
    if (validateUsername(potong) === null && !hasil.includes(potong)) hasil.push(potong);
  };

  // "pengguna" sendiri ada di daftar terlarang, jadi akun tanpa email yang
  // layak langsung mendapat versi bersufiks.
  tambah(dasar);

  const h = fnv1a(uid);
  for (let k = 1; k <= 5; k++) {
    tambah(`${dasar}${1000 + ((h + k * 7919) % 9000)}`);
  }

  for (let k = 0; k < 5; k++) {
    tambah(`${dasar}${Math.floor(100000 + random() * 900000)}`);
  }

  return hasil;
}
