import UserAvatar from "@/components/ui/UserAvatar";
import Tag from "@/components/ui/Tag";
import type { Role } from "@/lib/roles";

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  educator: "Educator",
  user: "Peserta",
};

/**
 * Kepala halaman profil: foto, nama, peran, bio, dan keahlian.
 *
 * Dibuat menerima seluruh isinya lewat props, tanpa membaca sesi sendiri —
 * supaya komponen yang sama bisa dipakai apa adanya saat profil dibuka orang
 * lain nanti, cukup dengan mengoper data pemilik profilnya.
 */
export default function ProfileHeader({
  name,
  email,
  photoURL,
  role,
  bio,
  skills,
  /** Email hanya ditampilkan pada profil sendiri — lihat catatan di bawah. */
  showEmail = false,
}: {
  name: string;
  email: string;
  photoURL: string | null;
  role: Role;
  bio: string;
  skills: readonly string[];
  showEmail?: boolean;
}) {
  return (
    <header className="bg-paper-card border border-rule rounded-2xl p-7 sm:p-9">
      <div className="flex flex-col sm:flex-row sm:items-start gap-6">
        <UserAvatar name={name} photoURL={photoURL} size="lg" className="w-24 h-24 text-2xl" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="t-h2 break-words">{name}</h1>
            <Tag tone={role === "educator" ? "amber" : role === "admin" ? "rust" : "blue"}>
              {ROLE_LABEL[role]}
            </Tag>
          </div>

          {/* Email adalah alamat kontak pribadi, bukan bagian dari pajangan.
              Saat profil dibuka orang lain nanti, prop ini dibiarkan false. */}
          {showEmail && <p className="t-body text-sm text-ink-muted mt-1.5">{email}</p>}

          {bio ? (
            <p className="t-body mt-5 whitespace-pre-line break-words">{bio}</p>
          ) : (
            <p className="t-body text-sm text-ink-faint mt-5 italic">
              Belum ada perkenalan.
            </p>
          )}

          {skills.length > 0 && (
            <ul className="flex flex-wrap gap-2 mt-5">
              {skills.map((s) => (
                <li
                  key={s}
                  className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </header>
  );
}
