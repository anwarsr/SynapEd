import "server-only";
import { adminAuth } from "@/lib/firebase/admin";
import { buildContributors, type Contributor } from "@/lib/contributors";
import { getUserCards } from "@/lib/userCards";
import { getUsernames } from "@/lib/usernames";

export type ResolveResult =
  | { ok: true; contributors: Contributor[] }
  | { ok: false; error: string };

/**
 * Memvalidasi kontributor kiriman editor menjadi daftar lengkap yang siap
 * disimpan.
 *
 * Yang dikirim pemanggil HANYA kontributor selain pemilik; jatah pemilik
 * dihitung ulang di `buildContributors`. Setiap uid dipastikan akun yang
 * benar-benar ada — lewat `getUsers`, bukan `getUserCards`, yang menelan
 * galat dan akan meloloskan uid karangan tanpa suara. Uid karangan yang lolos
 * berarti bagian uang yang dicatat untuk akun yang tidak pernah bisa masuk.
 */
export async function resolveContributors(
  ownerUid: string | null | undefined,
  others: unknown,
): Promise<ResolveResult> {
  if (!Array.isArray(others)) return { ok: false, error: "Daftar kontributor tidak valid." };

  if (!ownerUid) {
    // Kursus bawaan hasil migrasi: tidak ada pemilik yang bisa menerima sisa.
    if (others.length > 0) {
      return { ok: false, error: "Kursus tanpa pemilik tidak bisa memiliki kontributor." };
    }
    return { ok: true, contributors: [] };
  }

  const dibentuk = buildContributors(
    ownerUid,
    others.map((o) => {
      const r = (o ?? {}) as { uid?: unknown; share?: unknown };
      return { uid: r.uid, share: r.share };
    }),
  );
  if (!dibentuk.ok) return dibentuk;

  const lain = dibentuk.contributors.filter((c) => c.uid !== ownerUid);
  if (lain.length > 0) {
    const cek = await adminAuth().getUsers(lain.map((c) => ({ uid: c.uid })));
    if (cek.notFound.length > 0) {
      return { ok: false, error: "Ada kontributor yang akunnya tidak ditemukan." };
    }
  }

  return { ok: true, contributors: dibentuk.contributors };
}

/** Dua field yang selalu ditulis bersama — `contributorUids` untuk kueri array-contains. */
export function contributorFields(contributors: readonly Contributor[]) {
  return {
    contributors: contributors.map((c) => ({ uid: c.uid, share: c.share })),
    contributorUids: contributors.map((c) => c.uid),
  };
}

export interface ContributorPerson {
  uid: string;
  name: string;
  username: string | null;
  photoURL: string | null;
  share: number;
  role: "owner" | "contributor";
  /** false = akunnya sudah dihapus. */
  exists: boolean;
}

/**
 * Kontributor lengkap dengan nama tampilan & username, urutan tersimpan
 * (pemilik pertama). Akun yang sudah dihapus tetap tampil sebagai
 * "Akun terhapus" — pembagiannya masih tercatat dan admin perlu melihatnya.
 */
export async function contributorPeople(
  contributors: readonly Contributor[],
): Promise<ContributorPerson[]> {
  const uids = contributors.map((c) => c.uid);
  const [cards, usernames] = await Promise.all([getUserCards(uids), getUsernames(uids)]);

  return contributors.map((c, i) => ({
    uid: c.uid,
    name: cards.get(c.uid)?.name ?? "Akun terhapus",
    username: usernames.get(c.uid) ?? null,
    photoURL: cards.get(c.uid)?.photoURL ?? null,
    share: c.share,
    role: i === 0 ? "owner" : "contributor",
    exists: cards.has(c.uid),
  }));
}

/** "Nama (@username)" — untuk kalimat perubahan di halaman tinjauan admin. */
export function personLabel(p: Pick<ContributorPerson, "name" | "username">): string {
  return p.username ? `${p.name} (@${p.username})` : p.name;
}
