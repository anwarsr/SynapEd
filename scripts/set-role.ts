/**
 * Menetapkan role sebuah akun.
 *
 *   npx tsx scripts/set-role.ts <email> <admin|user>
 *
 * Role disimpan sebagai CUSTOM CLAIM, bukan field Firestore. Alasannya:
 *   - claim ikut di dalam ID token dan session cookie, jadi bisa diverifikasi
 *     di server tanpa membaca database sama sekali;
 *   - klien tidak bisa mengubahnya — berbeda dengan dokumen Firestore yang,
 *     kalau aturannya keliru sedikit saja, bisa ditulis sendiri oleh pengguna
 *     untuk mengangkat dirinya jadi admin.
 *
 * PENTING: claim baru hanya muncul di token setelah token diperbarui.
 * Pengguna yang sedang login HARUS keluar lalu masuk lagi. Skrip ini
 * mencabut refresh token-nya supaya sesi lama tidak bisa dipakai lagi.
 */
import { getAuth } from "firebase-admin/auth";
import { initAdmin, targetLabel } from "./project";

const ROLES = ["admin", "user"] as const;
type Role = (typeof ROLES)[number];

async function main() {
  const [email, role] = process.argv.slice(2);

  if (!email || !role || !ROLES.includes(role as Role)) {
    console.error("Pemakaian: npx tsx scripts/set-role.ts <email> <admin|user>");
    process.exit(1);
  }

  const auth = getAuth(initAdmin());
  console.log(`Target: ${targetLabel()}\n`);

  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    console.error(`Akun "${email}" tidak ditemukan.`);
    process.exit(1);
  }

  const before = (user.customClaims?.role as string | undefined) ?? "user";

  // Pertahankan claim lain kalau suatu saat ada.
  await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role });

  // Tanpa ini, sesi lama tetap membawa role lama sampai token kedaluwarsa.
  await auth.revokeRefreshTokens(user.uid);

  console.log(`  ${email}`);
  console.log(`  role : ${before} -> ${role}`);
  console.log(`  uid  : ${user.uid}`);
  console.log("\nSesi lama dicabut — akun ini harus masuk ulang agar role barunya berlaku.");
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
