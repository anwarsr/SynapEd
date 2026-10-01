import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";
import Tag from "@/components/ui/Tag";
import { roleLabel, type Role } from "@/lib/roles";
import { cn } from "@/lib/cn";

const TONE: Record<Role, "blue" | "amber" | "rust"> = {
  user: "blue",
  educator: "amber",
  admin: "rust",
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
      {/* ── Sampul ───────────────────────────────────────────────── */}
      <div className="bg-hero-navy relative mt-24 overflow-hidden pt-6 pb-[132px]">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(120% 100% at 15% 0%, rgba(255,255,255,.16), transparent 60%), radial-gradient(80% 80% at 100% 100%, color-mix(in srgb, var(--color-amber-500) 22%, transparent), transparent 65%)",
          }}
        />

        {/* Motif titik, dipotong miring supaya tidak terbaca sebagai kisi. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,.34) 1.15px, transparent 1.15px)",
            backgroundSize: "26px 26px",
            maskImage: "linear-gradient(100deg, transparent 8%, #000 45%, transparent 92%)",
            WebkitMaskImage: "linear-gradient(100deg, transparent 8%, #000 45%, transparent 92%)",
          }}
        />
      </div>

      {/* ── Identitas, menumpang sampul ──────────────────────────── */}
      <div className="container-reading relative -mt-24">
        <span className="inline-block rounded-full border border-rule bg-paper-card p-[7px] shadow-lift">
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
              <Tag tone={TONE[role]}>{roleLabel[role]}</Tag>
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
                  className="rounded-lg bg-blue-600 px-[26px] py-[13px] text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5"
                >
                  {utama.label}
                </Link>
              )}

              {sekunder && (
                <Link
                  href={sekunder.href}
                  className="rounded-lg border border-rule bg-paper-card px-6 py-[13px] text-sm font-medium text-ink transition-colors duration-200 ease-out-soft hover:border-blue-500 hover:text-blue-700"
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
