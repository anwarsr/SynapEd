"use server";
import { revalidatePath } from "next/cache";
import { FieldPath } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { USERNAMES, changeUsernameFor } from "@/lib/usernameCore";
import { USERNAME_MAX, normalizeUsernameInput } from "@/lib/usernameRules";

export type UsernameResult = { ok: true; username: string; message: string } | { ok: false; error: string };

/**
 * Mengganti username milik SENDIRI. uid selalu dari session cookie — tidak
 * pernah dari argumen, yang bisa dikarang siapa pun lewat POST mentah.
 */
export async function changeUsername(raw: unknown): Promise<UsernameResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const hasil = await changeUsernameFor(adminDb(), user.uid, raw);
  if (!hasil.ok) return hasil;

  revalidatePath("/pengaturan");
  revalidatePath("/profil");
  revalidatePath(`/profil/${user.uid}`);

  return { ok: true, username: hasil.username, message: `Username diganti menjadi @${hasil.username}.` };
}

export interface UsernameHit {
  uid: string;
  username: string;
  name: string;
  photoURL: string | null;
}

export type SearchResult = { ok: true; hits: UsernameHit[] } | { ok: false; error: string };

const MAX_HITS = 8;

// Jendela tetap per uid, in-memory — keterbatasannya sama dengan
// chatRateLimit. Pencarian ini membuka daftar akun satu awalan demi satu
// awalan; tanpa batas, seluruh daftar username bisa disedot dalam semenit.
const SEARCH_WINDOW_MS = 60_000;
const SEARCH_MAX = 30;
const searchBuckets = new Map<string, { count: number; resetAt: number }>();

function tooManySearches(uid: string): boolean {
  const saat = Date.now();
  const bucket = searchBuckets.get(uid);

  if (!bucket || bucket.resetAt <= saat) {
    searchBuckets.set(uid, { count: 1, resetAt: saat + SEARCH_WINDOW_MS });
    return false;
  }

  if (bucket.count >= SEARCH_MAX) return true;

  bucket.count++;
  return false;
}

/**
 * Mencari akun berdasarkan username, untuk menyusun daftar kontributor.
 *
 * Hanya educator & admin — merekalah yang menyusun daftar itu. Hasilnya
 * TIDAK memuat email: yang dicari adalah orangnya, bukan alamat kontaknya.
 *
 * Kecocokan persis diletakkan paling atas, lalu awalan. Awalan dicari lewat
 * rentang ID dokumen, jadi tidak butuh indeks tambahan.
 */
export async function searchUsernames(q: unknown): Promise<SearchResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };
  if (user.role !== "educator" && user.role !== "admin") {
    return { ok: false, error: "Hanya educator dan admin yang dapat mencari pengguna." };
  }
  if (tooManySearches(user.uid)) {
    return { ok: false, error: "Terlalu banyak pencarian. Tunggu sebentar lalu coba lagi." };
  }

  const kata = normalizeUsernameInput(q).slice(0, USERNAME_MAX);
  if (!kata || !/^[a-z0-9._]+$/.test(kata)) return { ok: true, hits: [] };

  const db = adminDb();
  const [persis, awalan] = await Promise.all([
    db.collection(USERNAMES).doc(kata).get(),
    db
      .collection(USERNAMES)
      .orderBy(FieldPath.documentId())
      .startAt(kata)
      .endAt(`${kata}`)
      .limit(MAX_HITS + 1)
      .get(),
  ]);

  const pasangan: { username: string; uid: string }[] = [];
  const tambah = (username: string, uid: unknown) => {
    if (typeof uid !== "string" || !uid) return;
    if (pasangan.some((p) => p.uid === uid || p.username === username)) return;
    pasangan.push({ username, uid });
  };

  if (persis.exists) tambah(persis.id, persis.get("uid"));
  for (const d of awalan.docs) tambah(d.id, d.get("uid"));

  const dipilih = pasangan.slice(0, MAX_HITS);
  if (dipilih.length === 0) return { ok: true, hits: [] };

  const akun = await adminAuth().getUsers(dipilih.map((p) => ({ uid: p.uid })));
  const byUid = new Map(akun.users.map((u) => [u.uid, u]));

  const hits: UsernameHit[] = [];
  for (const p of dipilih) {
    const a = byUid.get(p.uid);
    if (!a) continue; // akun sudah dihapus, reservasinya tertinggal
    hits.push({
      uid: p.uid,
      username: p.username,
      name: a.displayName?.trim() || p.username,
      photoURL: a.photoURL ?? null,
    });
  }

  return { ok: true, hits };
}
