import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";
import ProfileBanner from "@/components/profile/ProfileBanner";
import { roleLabel, type Role } from "@/lib/roles";
import { cn } from "@/lib/cn";

const PERAN_TEKS: Record<Role, string> = {
  user: "text-blue-300",
  educator: "text-warn-text",
  admin: "text-error-text",
};

export interface AksiProfil {
  label: string;
  href: string;
}

/**
 * Sampul navy + identitas yang menumpanginya.
 *
 * Avatarnya sengaja menembus batas sampul, bukan duduk rapi di dalam kartu:
 * itulah yang membuat halaman ini terbaca sebagai profil seseorang, bukan
 * sebagai satu kartu data lagi di antara kartu-kartu lain.
 */
export default function ProfileHeader({
  name,
  username = null,
  email,
  photoURL,
  bannerURL = null,
  bannerEditable = false,
  role,
  bio,
  skills,
  meta,
  utama,
  sekunder,
  showEmail = false,
}: {
  name: string;
  /** Tanpa "@". Null bila akun belum punya username. */
  username?: string | null;
  email: string;
  photoURL: string | null;
  /** Gambar sampul; null = hitam bawaan. */
  bannerURL?: string | null;
  /** Hanya profil sendiri: tampilkan tombol ganti banner. */
  bannerEditable?: boolean;
  role: Role;
  bio: string;
  skills: readonly string[];
  /** Baris kecil di bawah nama. Profil sendiri memuat email; publik tidak. */
  meta?: string;
  /** Tombol biru di kanan. */
  utama?: AksiProfil;
  /** Tombol bergaris di sebelahnya. */
  sekunder?: AksiProfil;
  /**
   * Email hanya ditampilkan pada profil sendiri.
   *
   * Dipertahankan sebagai prop terpisah, bukan disimpulkan dari `meta`:
   * kontraknya sudah dipakai halaman publik, dan menghapusnya berarti satu
   * kelalaian di sana membocorkan email tanpa satu pun galat tipe.
   */
  showEmail?: boolean;
}) {
  const emailTampil = showEmail && email ? email : "";
  const barisMeta = [username ? `@${username}` : "", emailTampil, meta].filter(Boolean).join(" · ");

  return (
    <header>
      {/* ── Sampul (banner; hitam bila belum diisi) ───────────────── */}
      <ProfileBanner bannerURL={bannerURL} editable={bannerEditable} />

      {/* ── Identitas, menumpang sampul ──────────────────────────── */}
      <div className="container-reading relative -mt-24">
        <span className="inline-block rounded-full bg-paper p-[7px]">
          <UserAvatar
            name={name}
            photoURL={photoURL}
            size="lg"
            className="w-[136px] h-[136px] text-[44px]"
          />
        </span>

        <div className="mt-[26px] flex flex-wrap items-end justify-between gap-7">
          <div className="min-w-0 flex-1 basis-[460px]">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="t-h1-profile">{name}</h1>
              <span className={cn("text-[12px] font-semibold uppercase tracking-[0.24em]", PERAN_TEKS[role])}>{roleLabel[role]}</span>
            </div>

            {barisMeta && <p className="mt-3 text-[13px] text-ink-muted">{barisMeta}</p>}

            <p
              className={cn(
                "mt-[18px] max-w-[58ch] text-[16.5px] leading-[1.7] whitespace-pre-line",
                bio ? "text-ink-body" : "italic text-ink-faint",
              )}
              style={{ textWrap: "pretty" }}
            >
              {bio || "Belum ada perkenalan."}
            </p>

            {skills.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {skills.map((s) => (
                  <li
                    key={s}
                    className="rounded-full bg-blue-50 px-[13px] py-1.5 text-[12.5px] font-medium text-blue-700"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {(utama || sekunder) && (
            <div className="flex flex-wrap gap-2.5 pb-1">
              {utama && (
                <Link
                  href={utama.href}
                  className="bg-blue-600 px-[26px] py-[13px] text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5"
                >
                  {utama.label}
                </Link>
              )}

              {sekunder && (
                <Link
                  href={sekunder.href}
                  className="bg-white/10 px-6 py-[13px] text-sm font-medium text-white transition-colors duration-200 ease-out-soft hover:bg-white/15"
                >
                  {sekunder.label}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
