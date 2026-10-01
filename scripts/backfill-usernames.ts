/**
 * Membuatkan username untuk akun yang dibuat sebelum fitur username ada.
 *
 *   npx tsx scripts/backfill-usernames.ts           # hanya melaporkan (aman)
 *   npx tsx scripts/backfill-usernames.ts --apply   # benar-benar menulis
 *
 * Akun baru tidak membutuhkan skrip ini — username dibuat saat sesi dibuat
 * (app/api/auth/session). Skrip ini hanya untuk akun yang belum masuk lagi
 * sejak fitur itu dipasang.
 *
 * Klaimnya memakai `claimUsername` milik aplikasi, BUKAN salinan logikanya.
 * Dua implementasi keunikan username adalah dua kesempatan untuk memberi
 * nama yang sama kepada dua orang. Aman diulang: akun yang sudah punya
 * username dilewati.
 */
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { claimUsername } from "../frontend/src/lib/usernameCore";
import { usernameCandidates } from "../frontend/src/lib/usernameRules";
import { initAdmin, targetLabel } from "./project";

const apply = process.argv.includes("--apply");
const app = initAdmin();
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  console.log(`\nBackfill username terhadap ${targetLabel()} — ${apply ? "MENULIS" : "hanya laporan"}\n`);

  let total = 0;
  let sudah = 0;
  let dibuat = 0;
  let gagal = 0;
  let pageToken: string | undefined;

  do {
    const page = await auth.listUsers(1000, pageToken);
    pageToken = page.pageToken;

    for (const akun of page.users) {
      total++;
      const snap = await db.collection("users").doc(akun.uid).get();
      const ada = snap.get("username");

      if (typeof ada === "string" && ada) {
        const milik = await db.collection("usernames").doc(ada).get();
        if (milik.get("uid") === akun.uid) {
          sudah++;
          continue;
        }
      }

      if (!apply) {
        const calon = usernameCandidates(akun.email, akun.uid)[0];
        console.log(`  akan dibuat  ${akun.uid}  ~@${calon} (bila belum dipakai)`);
        dibuat++;
        continue;
      }

      try {
        const hasil = await claimUsername(db, akun.uid, akun.email);
        if (hasil.ok) {
          if (hasil.created) dibuat++;
          else sudah++;
          console.log(`  ${hasil.created ? "dibuat " : "dipulihkan"}  ${akun.uid}  @${hasil.username}`);
        } else {
          gagal++;
          console.log(`  GAGAL  ${akun.uid}  ${hasil.error}`);
        }
      } catch (err) {
        gagal++;
        console.log(`  GAGAL  ${akun.uid}  ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } while (pageToken);

  console.log(
    `\n${total} akun · ${sudah} sudah punya · ${dibuat} ${apply ? "dibuat" : "akan dibuat"} · ${gagal} gagal`,
  );
  if (!apply && dibuat > 0) console.log("Jalankan ulang dengan --apply untuk menulis.\n");
  process.exit(gagal === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
