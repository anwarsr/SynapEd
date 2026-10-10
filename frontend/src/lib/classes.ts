import "server-only";
import { randomBytes } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";
import { CROCKFORD, INVITE_CODE_LENGTH } from "@/lib/inviteCode";
import { getUserCards } from "@/lib/userCards";
import {
  stripJoinCode,
  type Kelas,
  type KelasMember,
  type KelasPost,
  type KelasPublik,
  type KelasReply,
} from "@/lib/classTypes";

// Diekspor ulang supaya modul server cukup mengimpor dari satu tempat.
export * from "@/lib/classTypes";

export const CLASSES = "classes";
export const CLASS_MEMBERS = "classMembers";
export const POSTS = "posts";
export const REPLIES = "replies";

// ── Normaliser ──────────────────────────────────────────────────────────
//
// Setiap field diberi nilai bawaan, tidak pernah `as Kelas`. Dokumen yang
// ditulis sebelum sebuah field ada akan bernilai undefined sementara tipenya
// mengaku sebaliknya — dan galatnya baru muncul jauh dari sini.

function toKelas(id: string, d: FirebaseFirestore.DocumentData): Kelas {
  return {
    id,
    name: (d.name as string | undefined) ?? "",
    description: (d.description as string | undefined) ?? "",
    ownerUid: (d.ownerUid as string | undefined) ?? "",
    imageURL: typeof d.imageURL === "string" && d.imageURL ? d.imageURL : null,
    joinCode: (d.joinCode as string | undefined) ?? "",
    memberCount: (d.memberCount as number | undefined) ?? 0,
    postCount: (d.postCount as number | undefined) ?? 0,
    createdAt: (d.createdAt as string | undefined) ?? "",
    updatedAt: (d.updatedAt as string | undefined) ?? "",
  };
}

function toMember(id: string, d: FirebaseFirestore.DocumentData): KelasMember {
  return {
    id,
    uid: (d.uid as string | undefined) ?? "",
    classId: (d.classId as string | undefined) ?? "",
    role: d.role === "owner" ? "owner" : "member",
    joinedAt: (d.joinedAt as string | undefined) ?? "",
  };
}

function toPost(id: string, d: FirebaseFirestore.DocumentData): KelasPost {
  return {
    id,
    classId: (d.classId as string | undefined) ?? "",
    authorUid: (d.authorUid as string | undefined) ?? "",
    body: (d.body as string | undefined) ?? "",
    replyCount: (d.replyCount as number | undefined) ?? 0,
    createdAt: (d.createdAt as string | undefined) ?? "",
    updatedAt: (d.updatedAt as string | undefined) ?? "",
  };
}

function toReply(id: string, d: FirebaseFirestore.DocumentData): KelasReply {
  return {
    id,
    postId: (d.postId as string | undefined) ?? "",
    classId: (d.classId as string | undefined) ?? "",
    authorUid: (d.authorUid as string | undefined) ?? "",
    body: (d.body as string | undefined) ?? "",
    createdAt: (d.createdAt as string | undefined) ?? "",
  };
}

// ── Referensi ───────────────────────────────────────────────────────────

export function classRef(id: string) {
  return adminDb().collection(CLASSES).doc(id);
}

/**
 * ID keanggotaan deterministik, seperti enrollmentId.
 *
 * Bergabung dua kali menimpa dokumen yang sama alih-alih membuat yang kedua,
 * jadi tombol yang tertekan berulang tidak menghasilkan anggota ganda.
 */
export function memberId(uid: string, classId: string): string {
  return `${uid}_${classId}`;
}

export function memberRef(uid: string, classId: string) {
  return adminDb().collection(CLASS_MEMBERS).doc(memberId(uid, classId));
}

export function postsRef(classId: string) {
  return classRef(classId).collection(POSTS);
}

export function repliesRef(classId: string, postId: string) {
  return postsRef(classId).doc(postId).collection(REPLIES);
}

// ── Kode undangan ───────────────────────────────────────────────────────

/** 256 % 32 === 0, jadi byte % 32 tidak bias ke simbol tertentu. */
function randomCode(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let code = "";
  for (const b of bytes) code += CROCKFORD[b % 32];
  return code;
}

/**
 * Kode undangan yang dipastikan belum terpakai.
 *
 * Tabrakan pada 32^8 praktis mustahil, tetapi percobaan ulang tetap ditulis:
 * tabrakan yang tidak diperiksa berarti dua kelas berbagi satu kode, dan
 * pendaftar akan masuk ke kelas yang salah tanpa satu pun pesan galat.
 */
export async function freshJoinCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = randomCode();
    if (!(await findClassByJoinCode(code))) return code;
  }
  throw new Error("Gagal membuat kode undangan yang unik.");
}

// ── Kueri ───────────────────────────────────────────────────────────────
//
// Seluruhnya kesamaan satu field lalu diurutkan DI MEMORI. Firestore
// menghilangkan dokumen yang tidak punya field yang dipakai orderBy, jadi
// kelas lama yang belum punya sebuah field akan diam-diam lenyap dari daftar.
// Mengurutkan sendiri juga membebaskan kita dari indeks komposit baru.

function terbaruDiAtas(a: { createdAt: string }, b: { createdAt: string }): number {
  return b.createdAt.localeCompare(a.createdAt);
}

export async function getClass(id: string): Promise<Kelas | null> {
  const snap = await classRef(id).get();
  return snap.exists ? toKelas(snap.id, snap.data() ?? {}) : null;
}

export async function findClassByJoinCode(code: string): Promise<Kelas | null> {
  if (!code) return null;

  const snap = await adminDb()
    .collection(CLASSES)
    .where("joinCode", "==", code)
    .limit(1)
    .get();

  const doc = snap.docs[0];
  return doc ? toKelas(doc.id, doc.data()) : null;
}

export async function listOwnedClasses(ownerUid: string): Promise<Kelas[]> {
  const snap = await adminDb().collection(CLASSES).where("ownerUid", "==", ownerUid).get();
  return snap.docs.map((d) => toKelas(d.id, d.data())).sort(terbaruDiAtas);
}

export async function listAllClasses(): Promise<Kelas[]> {
  const snap = await adminDb().collection(CLASSES).get();
  return snap.docs.map((d) => toKelas(d.id, d.data())).sort(terbaruDiAtas);
}

export async function getMembership(uid: string, classId: string): Promise<KelasMember | null> {
  const snap = await memberRef(uid, classId).get();
  return snap.exists ? toMember(snap.id, snap.data() ?? {}) : null;
}

export async function listClassMembers(classId: string): Promise<KelasMember[]> {
  const snap = await adminDb()
    .collection(CLASS_MEMBERS)
    .where("classId", "==", classId)
    .get();

  return snap.docs
    .map((d) => toMember(d.id, d.data()))
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
}

/**
 * Kelas yang diikuti seseorang, LENGKAP dengan dokumen kelasnya.
 *
 * Keanggotaan tidak menyalin nama kelas, jadi setiap kelas dibaca ulang di
 * sini. Keanggotaan yang menunjuk kelas yang sudah dihapus dibuang diam-diam —
 * baris kosong di halaman "Kelas Saya" lebih membingungkan daripada tidak ada.
 */
export async function listMyClasses(uid: string): Promise<KelasPublik[]> {
  const snap = await adminDb().collection(CLASS_MEMBERS).where("uid", "==", uid).get();

  const ids = snap.docs.map((d) => toMember(d.id, d.data()).classId).filter(Boolean);
  if (ids.length === 0) return [];

  const kelas = await Promise.all(ids.map((id) => getClass(id)));

  return kelas
    .filter((k): k is Kelas => k !== null)
    .map(stripJoinCode)
    .sort(terbaruDiAtas);
}

export async function listPosts(classId: string): Promise<KelasPost[]> {
  const snap = await postsRef(classId).get();
  return snap.docs.map((d) => toPost(d.id, d.data())).sort(terbaruDiAtas);
}

export async function getPost(classId: string, postId: string): Promise<KelasPost | null> {
  const snap = await postsRef(classId).doc(postId).get();
  return snap.exists ? toPost(snap.id, snap.data() ?? {}) : null;
}

/** Balasan diurutkan TERLAMA di atas — percakapan dibaca dari awal. */
export async function listReplies(classId: string, postId: string): Promise<KelasReply[]> {
  const snap = await repliesRef(classId, postId).get();
  return snap.docs
    .map((d) => toReply(d.id, d.data()))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getReply(
  classId: string,
  postId: string,
  replyId: string,
): Promise<KelasReply | null> {
  const snap = await repliesRef(classId, postId).doc(replyId).get();
  return snap.exists ? toReply(snap.id, snap.data() ?? {}) : null;
}

// ── Pemuat umpan ────────────────────────────────────────────────────────

/**
 * Seluruh isi umpan satu kelas dalam satu tempat.
 *
 * Dipakai halaman educator DAN halaman siswa. Dua salinan pemuatan yang sama
 * akan melenceng — dan yang melenceng di sini berarti satu pihak melihat
 * balasan yang tidak dilihat pihak lain pada postingan yang sama.
 *
 * Nama dan foto penulis dibaca SEKALI untuk seluruh halaman lewat getUserCards,
 * bukan per postingan. Halaman peserta kursus sudah memakai pola yang sama.
 */
export async function loadClassFeed(classId: string) {
  const posts = await listPosts(classId);

  const repliesByPost = new Map<string, KelasReply[]>();
  await Promise.all(
    posts.map(async (p) => {
      repliesByPost.set(p.id, await listReplies(classId, p.id));
    }),
  );

  const uids = new Set<string>();
  for (const p of posts) uids.add(p.authorUid);
  for (const daftar of repliesByPost.values()) {
    for (const r of daftar) uids.add(r.authorUid);
  }

  const cards = await getUserCards([...uids]);

  return { posts, repliesByPost, cards };
}
