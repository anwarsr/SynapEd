/**
 * Inti username: klaim otomatis dan penggantian.
 *
 * Sengaja TANPA `server-only` dan tanpa impor alias `@/`: `db` disuntikkan
 * pemanggil, supaya skrip backfill yang dijalankan tsx menjalankan kode yang
 * SAMA PERSIS dengan aplikasi. Skrip yang membawa salinan logikanya sendiri
 * akan melenceng — dan yang melenceng di sini adalah keunikan username.
 *
 * Modul ini tetap hanya boleh dipakai di server: ia menulis lewat Admin SDK.
 * Aplikasi memakainya melalui `usernames.ts`, yang ber-`server-only`.
 *
 * Penyimpanan:
 *   - `usernames/{username}` → `{ uid, createdAt }`. ID dokumen ADALAH
 *     username-nya, jadi keunikannya dijamin `create()` di dalam transaksi —
 *     bukan kueri "sudah dipakai belum?" yang bisa kalah balapan.
 *   - `users/{uid}.username` + `usernameChangedAt` (null = masih buatan
 *     otomatis, boleh langsung diganti).
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  USERNAME_CHANGE_COOLDOWN_DAYS,
  normalizeUsernameInput,
  usernameCandidates,
  validateUsername,
} from "./usernameRules";

export const USERNAMES = "usernames";
const USERS = "users";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ClaimResult =
  | { ok: true; username: string; created: boolean }
  | { ok: false; error: string };

/**
 * Memastikan akun punya username; membuatkannya kalau belum.
 *
 * Aman dipanggil berkali-kali dan bersamaan untuk akun yang sama. Setiap
 * percobaan membaca dokumen pengguna DI DALAM transaksi, jadi dua login yang
 * tiba bersamaan tidak menghasilkan dua reservasi: yang kalah diulang oleh
 * Firestore, lalu melihat username yang sudah diklaim pemenangnya.
 */
export async function claimUsername(
  db: Firestore,
  uid: string,
  email: string | null | undefined,
  random: () => number = Math.random,
): Promise<ClaimResult> {
  const userRef = db.collection(USERS).doc(uid);

  for (const calon of usernameCandidates(email, uid, random)) {
    const hasil = await db.runTransaction(async (tx) => {
      const [userSnap, calonSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(db.collection(USERNAMES).doc(calon)),
      ]);

      const sekarang = userSnap.get("username");
      if (typeof sekarang === "string" && sekarang) {
        const milik = await tx.get(db.collection(USERNAMES).doc(sekarang));
        if (milik.get("uid") === uid) {
          return { ok: true as const, username: sekarang, created: false };
        }
        // Salinan di dokumen pengguna tidak didukung reservasi (mis. disunting
        // lewat Console). Diperlakukan seperti belum punya — klaim ulang.
      }

      if (calonSnap.exists) {
        if (calonSnap.get("uid") !== uid) return null; // dipakai orang lain

        // Reservasinya sudah milik akun ini, hanya salinannya yang hilang.
        tx.set(userRef, { username: calon }, { merge: true });
        return { ok: true as const, username: calon, created: false };
      }

      const now = new Date().toISOString();
      tx.create(db.collection(USERNAMES).doc(calon), { uid, createdAt: now });
      tx.set(userRef, { username: calon, usernameChangedAt: null }, { merge: true });
      return { ok: true as const, username: calon, created: true };
    });

    if (hasil) return hasil;
  }

  return { ok: false, error: "Tidak ada calon username yang tersedia." };
}

export type ChangeResult =
  | { ok: true; username: string }
  | { ok: false; error: string };

/**
 * Mengganti username, dalam SATU transaksi:
 *   1. membuat reservasi baru (gagal kalau sudah dipakai),
 *   2. menghapus reservasi lama — hanya kalau memang milik akun ini,
 *   3. memperbarui salinan di `users/{uid}`.
 *
 * Tanpa transaksi, sepuluh orang yang mengganti ke nama yang sama secara
 * bersamaan bisa sama-sama membaca "belum dipakai" lalu sama-sama menulis.
 */
export async function changeUsernameFor(
  db: Firestore,
  uid: string,
  raw: unknown,
  now: Date = new Date(),
): Promise<ChangeResult> {
  const baru = normalizeUsernameInput(raw);
  const invalid = validateUsername(baru);
  if (invalid) return { ok: false, error: invalid };

  const userRef = db.collection(USERS).doc(uid);
  const baruRef = db.collection(USERNAMES).doc(baru);

  try {
    return await db.runTransaction(async (tx) => {
      const [userSnap, baruSnap] = await Promise.all([tx.get(userRef), tx.get(baruRef)]);

      const lama = userSnap.get("username");
      const lamaRef =
        typeof lama === "string" && lama ? db.collection(USERNAMES).doc(lama) : null;
      const lamaSnap = lamaRef ? await tx.get(lamaRef) : null;

      if (lama === baru && lamaSnap?.get("uid") === uid) {
        return { ok: false as const, error: "Itu sudah username Anda." };
      }

      const terakhir = userSnap.get("usernameChangedAt");
      if (typeof terakhir === "string" && terakhir) {
        const bolehLagi = new Date(terakhir).getTime() + USERNAME_CHANGE_COOLDOWN_DAYS * DAY_MS;
        if (Number.isFinite(bolehLagi) && now.getTime() < bolehLagi) {
          const tanggal = new Date(bolehLagi).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "Asia/Jakarta",
          });
          return {
            ok: false as const,
            error: `Username hanya bisa diganti sekali setiap ${USERNAME_CHANGE_COOLDOWN_DAYS} hari. Anda bisa menggantinya lagi pada ${tanggal}.`,
          };
        }
      }

      if (baruSnap.exists && baruSnap.get("uid") !== uid) {
        return { ok: false as const, error: "Username ini sudah dipakai." };
      }

      const iso = now.toISOString();
      if (!baruSnap.exists) tx.create(baruRef, { uid, createdAt: iso });
      if (lamaRef && lamaSnap?.get("uid") === uid && lama !== baru) tx.delete(lamaRef);
      tx.set(userRef, { username: baru, usernameChangedAt: iso }, { merge: true });

      return { ok: true as const, username: baru };
    });
  } catch (err) {
    // ALREADY_EXISTS: pemenang balapan menulis reservasi yang sama tepat di
    // antara baca dan komit transaksi ini.
    if ((err as { code?: unknown }).code === 6) {
      return { ok: false, error: "Username ini sudah dipakai." };
    }
    throw err;
  }
}
