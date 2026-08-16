/**
 * Menyapu berkas Storage yang sudah tidak dirujuk apa pun.
 *
 * Aplikasi kini membersihkan dirinya sendiri: materi yang diganti, gambar latar
 * yang ditukar, kursus yang dihapus, dan foto profil lama semuanya ikut terbuang
 * saat kejadiannya. Skrip ini untuk yang TERLANJUR menumpuk sebelum itu ada —
 * dan sebagai jaring pengaman untuk satu hal yang mustahil ditangani otomatis:
 * educator yang mengunggah berkas lalu menutup form tanpa menyimpan, sehingga
 * tidak ada catatan di mana pun bahwa berkas itu pernah dimaksudkan untuk apa.
 *
 *   npx tsx scripts/cleanup-storage.ts           # hanya melaporkan (aman)
 *   npx tsx scripts/cleanup-storage.ts --apply   # benar-benar menghapus
 *
 * Bawaannya SENGAJA hanya melapor. Penghapusan berkas tidak bisa dibatalkan,
 * dan daftar rujukan dibangun dari Firestore + Firebase Auth — kalau salah satu
 * gagal dibaca, "tidak dirujuk" akan berarti "semuanya".
 */
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { initAdmin, resolveStorageBucket, targetLabel } from "./project";

const apply = process.argv.includes("--apply");
const app = initAdmin();

/** Folder yang dikelola aplikasi. `lesson-assets/` sengaja tidak termasuk. */
const MANAGED = ["course-assets/", "course-thumbnails/", "avatars/"];

interface Attachment {
  path?: unknown;
}
interface Lesson {
  attachments?: Attachment[];
}
interface Section {
  lessons?: Lesson[];
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Path Storage di balik sebuah URL unduhan Firebase.
 *
 * Foto profil disimpan di Firebase Auth sebagai photoURL, bukan path. Bentuknya
 * `…/o/avatars%2F{uid}%2Favatar.png?alt=media&token=…`, jadi bagian setelah
 * `/o/` perlu didekode kembali menjadi path biasa.
 */
function pathFromDownloadUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/o\/([^?]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

async function referencedPaths(): Promise<Set<string>> {
  const referenced = new Set<string>();

  // ── Kursus: lampiran + gambar latar ──────────────────────────────────
  const courses = await getFirestore(app).collection("courses").get();

  for (const doc of courses.docs) {
    const data = doc.data();

    const thumbnail = data.thumbnail;
    if (typeof thumbnail === "string" && thumbnail) referenced.add(thumbnail);

    for (const section of (data.sections ?? []) as Section[]) {
      for (const lesson of section.lessons ?? []) {
        for (const attachment of lesson.attachments ?? []) {
          if (typeof attachment?.path === "string") referenced.add(attachment.path);
        }
      }
    }
  }

  console.log(`  ${courses.size} kursus dibaca`);

  // ── Foto profil: satu per akun yang masih ada ────────────────────────
  const auth = getAuth(app);
  let users = 0;
  let token: string | undefined;

  // Foto yang tersimpan di bucket TAPI URL-nya tidak terbaca adalah satu-satunya
  // cara skrip ini bisa menghapus berkas yang masih dipakai. Foto dari Google
  // (lh3.googleusercontent.com) memang bukan berkas kita dan wajar tidak terurai;
  // yang berbahaya adalah URL Firebase dengan bentuk tak terduga.
  const unparsed: string[] = [];

  do {
    const page = await auth.listUsers(1000, token);
    for (const user of page.users) {
      users++;
      const path = pathFromDownloadUrl(user.photoURL);
      if (path) referenced.add(path);
      else if (user.photoURL?.includes("firebasestorage")) unparsed.push(user.photoURL);
    }
    token = page.pageToken;
  } while (token);

  console.log(`  ${users} akun dibaca`);

  if (unparsed.length > 0) {
    console.log("\nBERHENTI: ada foto profil di Firebase Storage yang URL-nya tidak terurai.");
    unparsed.forEach((u) => console.log(`  ${u}`));
    console.log("Berkas itu akan dikira sampah. Perbaiki pengurainya dulu.\n");
    process.exit(1);
  }

  return referenced;
}

async function main() {
  console.log(`\nTarget: ${targetLabel()}`);
  console.log(`Bucket: ${resolveStorageBucket()}`);
  console.log(apply ? "Mode  : MENGHAPUS\n" : "Mode  : hanya melaporkan (tambahkan --apply untuk menghapus)\n");

  console.log("Membaca rujukan…");
  const referenced = await referencedPaths();
  console.log(`  ${referenced.size} berkas masih dirujuk\n`);

  // Pengaman: kalau daftar rujukan kosong padahal bucketnya berisi, hampir
  // pasti pembacaannya yang gagal — bukan benar-benar tidak ada yang dirujuk.
  // Melanjutkan berarti menghapus seluruh isi bucket.
  const bucket = getStorage(app).bucket();

  const orphans: { name: string; size: number }[] = [];
  let scanned = 0;
  let keptBytes = 0;

  for (const prefix of MANAGED) {
    const [files] = await bucket.getFiles({ prefix });
    for (const file of files) {
      scanned++;
      const size = Number(file.metadata.size ?? 0);

      if (referenced.has(file.name)) {
        keptBytes += size;
        continue;
      }
      orphans.push({ name: file.name, size });
    }
  }

  const orphanBytes = orphans.reduce((n, o) => n + o.size, 0);

  console.log(`Diperiksa : ${scanned} berkas`);
  console.log(`Terpakai  : ${scanned - orphans.length} berkas (${mb(keptBytes)})`);
  console.log(`Tak dipakai: ${orphans.length} berkas (${mb(orphanBytes)})\n`);

  if (orphans.length === 0) {
    console.log("Tidak ada yang perlu dibersihkan.\n");
    return;
  }

  orphans
    .sort((a, b) => b.size - a.size)
    .forEach((o) => console.log(`  ${mb(o.size).padStart(9)}  ${o.name}`));

  if (referenced.size === 0 && scanned > 0) {
    console.log(
      "\nBERHENTI: tidak ada satu pun berkas yang tercatat dirujuk, padahal bucket berisi.\n" +
        "Itu pertanda pembacaan Firestore/Auth gagal, bukan pertanda semuanya sampah.\n",
    );
    process.exit(1);
  }

  if (!apply) {
    console.log(`\nTidak ada yang dihapus. Jalankan ulang dengan --apply untuk membuang ${mb(orphanBytes)}.\n`);
    return;
  }

  console.log("\nMenghapus…");
  let deleted = 0;

  for (const orphan of orphans) {
    try {
      await bucket.file(orphan.name).delete({ ignoreNotFound: true });
      deleted++;
    } catch (e) {
      console.warn(`  gagal: ${orphan.name} — ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\n${deleted} dari ${orphans.length} berkas dihapus (${mb(orphanBytes)} dibebaskan).\n`);
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
