"use server";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { cleanProfile, validatePhone, type ProfileContent } from "@/lib/profileTypes";

export type ProfileResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Menyimpan isi profil milik SENDIRI.
 *
 * Tidak menerima uid dari argumen — sengaja. Kalau uid datang dari browser,
 * satu panggilan POST langsung cukup untuk menulis ulang profil orang lain,
 * dan halaman profil publik nanti akan menampilkan karangan itu atas nama
 * mereka. Yang dipakai selalu uid dari session cookie.
 */
export async function updateMyProfile(input: ProfileContent): Promise<ProfileResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  const bersih = cleanProfile(input);

  // merge: dokumen `users/{uid}` juga menyimpan `phone`, yang diurus form lain.
  // Tanpa merge, menyimpan profil akan diam-diam menghapus nomor telepon.
  await adminDb().collection("users").doc(user.uid).set(
    {
      bio: bersih.bio,
      education: bersih.education,
      skills: bersih.skills,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  revalidatePath("/profil");
  revalidatePath("/profil/edit");

  return { ok: true, message: "Profil tersimpan." };
}

/**
 * Menyimpan (atau menghapus) nomor HP milik SENDIRI.
 *
 * Dulu ditulis langsung dari browser. Itu gagal diam-diam bagi siapa pun yang
 * dokumen `users/{uid}`-nya sudah memuat field lain (bio, username): pada
 * penulisan merge, rules memeriksa dokumen HASIL AKHIR, sehingga
 * `keys().hasOnly(['phone','updatedAt'])` menolak karena `bio` ikut terhitung.
 * Lewat Admin SDK, rules itu tidak lagi menjadi penghalang — dan validasinya
 * pindah ke sini, tempat yang tidak bisa dilewati.
 */
export async function updateMyPhone(raw: unknown): Promise<ProfileResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Silakan masuk terlebih dahulu." };

  if (typeof raw !== "string") return { ok: false, error: "Nomor tidak valid." };

  const invalid = validatePhone(raw);
  if (invalid) return { ok: false, error: invalid };

  const phone = raw.trim() === "" ? null : raw.trim();

  await adminDb()
    .collection("users")
    .doc(user.uid)
    .set({ phone, updatedAt: new Date().toISOString() }, { merge: true });

  revalidatePath("/pengaturan");

  return { ok: true, message: phone === null ? "Nomor HP dihapus." : "Nomor HP disimpan." };
}
