"use server";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { toRole } from "@/lib/roles";
import { listMyEnrollments, progressFromSnapshot } from "@/lib/enrollments";
import { listCourses } from "@/lib/courses";
import { listOwnedCourses } from "@/lib/educatorCourses";
import { getBannerURL } from "@/lib/banner";
import { getCurrentUser } from "@/lib/firebase/session";
import type { MiniProfile } from "@/lib/miniProfileTypes";

const UID_RE = /^[A-Za-z0-9_-]{6,128}$/;

/** Penulis komentar publik, atau pemanggil yang sekelas / admin / dirinya sendiri. */
async function bolehLihat(uid: string): Promise<boolean> {
  const pernah = await adminDb().collection("reviews").where("uid", "==", uid).limit(1).get();
  if (!pernah.empty) return true;

  const pemanggil = await getCurrentUser();
  if (!pemanggil) return false;
  if (pemanggil.uid === uid || pemanggil.role === "admin") return true;
  return sekelas(pemanggil.uid, uid);
}

/** Dua akun berbagi sedikitnya satu kelas (sebagai pemilik atau anggota). */
async function sekelas(a: string, b: string): Promise<boolean> {
  const db = adminDb();
  const [milikA, anggotaA, milikB, anggotaB] = await Promise.all([
    db.collection("classes").where("ownerUid", "==", a).get(),
    db.collection("classMembers").where("uid", "==", a).get(),
    db.collection("classes").where("ownerUid", "==", b).get(),
    db.collection("classMembers").where("uid", "==", b).get(),
  ]);
  const kelasA = new Set([...milikA.docs.map((d) => d.id), ...anggotaA.docs.map((d) => String(d.get("classId")))]);
  return [...milikB.docs.map((d) => d.id), ...anggotaB.docs.map((d) => String(d.get("classId")))].some((id) => kelasA.has(id));
}

/**
 * Data kartu mini-profil penulis komentar. ENDPOINT PUBLIK (siapa pun, tanpa
 * masuk, bisa memanggilnya) - jadi dibatasi:
 *
 *   - hanya akun yang (a) pernah menulis ulasan publik (komentarnya tampil di
 *     beranda), atau (b) sekelas dengan PEMANGGIL yang sedang masuk (satu kelas:
 *     pemilik atau anggota), atau pemanggil adalah admin - bukan sembarang uid;
 *     tidak bisa dipakai menyisir semua akun;
 *   - kursus yang diikuti disaring ke katalog PUBLIK (kursus tersembunyi/draft
 *     tak pernah ikut);
 *   - akun admin tak mengembalikan data apa pun selain nama/foto;
 *   - tanpa email, nomor telepon, atau nilai kuis.
 *
 * Ini SENGAJA melonggarkan keputusan lama di publicProfile.ts (kursus yang
 * diikuti tidak ditampilkan di profil publik) atas permintaan pemilik, tetapi
 * hanya lewat kartu ini, dan hanya untuk penulis komentar publik.
 */
export async function getMiniProfile(uid: string): Promise<MiniProfile | null> {
  if (typeof uid !== "string" || !UID_RE.test(uid)) return null;

  if (!(await bolehLihat(uid))) return null;

  const akun = await adminAuth()
    .getUser(uid)
    .catch(() => null);
  if (!akun) return null;

  const role = toRole(akun.customClaims?.role);
  const name = akun.displayName?.trim() || akun.email?.split("@")[0] || "Pengguna";
  const photoURL = akun.photoURL ?? null;

  if (role === "admin") {
    return { name, photoURL, bannerURL: null, role, followed: [], created: [] };
  }

  const [bannerURL, enrollments, katalog, dimiliki] = await Promise.all([
    getBannerURL(uid).catch(() => null),
    listMyEnrollments(uid).catch(() => []),
    listCourses(),
    role === "educator" ? listOwnedCourses(uid, name) : Promise.resolve([]),
  ]);

  const publik = new Map(katalog.map((c) => [c.slug, c]));

  const followed = enrollments
    .filter((e) => publik.has(e.courseSlug))
    .sort((a, b) => b.lastAccessedAt.localeCompare(a.lastAccessedAt))
    .map((e) => {
      const p = progressFromSnapshot(e);
      const k = publik.get(e.courseSlug)!;
      return { slug: e.courseSlug, title: k.title, level: k.level, done: p.done, total: p.total, percent: p.percent };
    });

  const created = dimiliki
    .filter((c) => c.visibility === "public")
    .map((c) => ({ slug: c.slug, title: c.title, students: c.enrolledStudents }));

  return { name, photoURL, bannerURL, role, followed, created };
}
