import Link from "next/link";
import EducatorShell from "@/components/educator/EducatorShell";
import CourseForm from "@/components/educator/CourseForm";
import { LEVELS } from "@/lib/educatorCourses";
import { listCategories } from "@/lib/categories";
import { requireEducator } from "@/lib/firebase/session";
import { getPaymentSettings } from "@/lib/paymentSettings";
import { getUsernameInfo } from "@/lib/usernames";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Buat Kursus – SynapEd" };

export const dynamic = "force-dynamic";

const SANS = { fontFamily: "var(--font-sans)" } as const;

/** Daftar bab di rel kiri; tautannya ke jangkar di CourseForm. */
const BAB = [
  { id: "tentang", no: "01", label: "Tentang kursus" },
  { id: "kontributor", no: "02", label: "Kontributor" },
  { id: "isi", no: "03", label: "Isi kursus" },
  { id: "terbit", no: "04", label: "Terbitkan" },
] as const;

/**
 * Tata letak editorial: judul dua baris yang menjorok, rel bab menempel di
 * kiri (layar lebar) berisi nomor tipis-besar yang menyala biru saat disorot,
 * dan formulir bertingkat per bab di kanan. Logika formulir tidak berubah.
 */
export default async function NewCoursePage() {
  const user = await requireEducator("/educator/courses/new");
  const [categories, settings, handle] = await Promise.all([
    listCategories(),
    getPaymentSettings(),
    getUsernameInfo(user.uid),
  ]);

  return (
    <EducatorShell user={user}>
      <div className="container-page">
        {/* Tautan kembali: garis penunjuk yang memanjang saat di-hover, bukan tombol berpanah */}
        <Link
          href="/educator/courses"
          className="group inline-flex items-center gap-3 text-[11.5px] font-semibold uppercase tracking-[0.3em] text-ink-muted transition-colors duration-300 hover:text-white"
        >
          <span aria-hidden="true" className="h-px w-7 bg-white/35 transition-all duration-500 ease-warm group-hover:w-12 group-hover:bg-white" />
          Kursus saya
        </Link>

        <h1
          className="mt-8 text-[clamp(2.8rem,8vw,6.5rem)] font-extrabold leading-[0.95] tracking-[-0.05em] text-white"
          style={SANS}
        >
          <span className="block">Buat kursus</span>
          <span className="block pl-[clamp(1.5rem,9vw,8rem)]">baru.</span>
        </h1>
        <p className="t-body mt-8 max-w-[52ch] text-ink-muted">
          Susun sendiri isinya: modul, video, dan penugasan, sebanyak dan seurut yang Anda mau.
        </p>

        <div className="mt-16 grid gap-12 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-20">
          <aside className="hidden lg:block">
            <nav aria-label="Bab formulir" className="sticky top-32">
              {/* Tiap baris = tiga kolom tetap [penanda 12px | nomor | label]; garis tegak
                  tepat di tengah kolom penanda (left 5.5px + 1px = pusat 6px) sehingga
                  kotak penanda selalu menumpuk persis di atas garis, tak melenceng. */}
              <ol
                className="relative"
                style={
                  {
                    // Warna PEJAL (dicampur dengan latar), bukan putih transparan: kalau
                    // transparan, garis tampak tembus di balik kotak penanda.
                    "--penanda": "color-mix(in srgb, var(--color-white) 30%, var(--color-paper))",
                    "--garis-rel": "color-mix(in srgb, var(--color-white) 12%, var(--color-paper))",
                  } as React.CSSProperties
                }
              >
                <span aria-hidden="true" className="absolute bottom-[1.6rem] left-[5.5px] top-[1.6rem] w-px bg-[var(--garis-rel)]" />
                {BAB.map((b) => (
                  <li key={b.id}>
                    <a
                      href={`#${b.id}`}
                      className="group grid grid-cols-[12px_2.4rem_minmax(0,1fr)] items-center gap-x-4 py-[1.05rem] text-ink-muted transition-colors duration-300 hover:text-white"
                    >
                      <span
                        aria-hidden="true"
                        className="relative z-10 h-[9px] w-[9px] justify-self-center bg-[var(--penanda)] transition-all duration-300 group-hover:scale-125 group-hover:bg-blue-500"
                      />
                      <span
                        className="text-[1.5rem] font-extralight leading-none tabular-nums tracking-[-0.04em] transition-colors duration-300 group-hover:text-blue-300"
                        style={SANS}
                      >
                        {b.no}
                      </span>
                      <span className="text-[13px] font-semibold leading-none">{b.label}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <div className="min-w-0 max-w-3xl">
            <CourseForm
              levels={LEVELS.map((l) => ({ value: l.value }))}
              categories={categories.map((c) => ({ value: c.slug, label: c.label }))}
              owner={{ uid: user.uid, name: user.name, username: handle.username, photoURL: user.photoURL }}
              feePercent={settings.platformFeePercent}
            />
          </div>
        </div>
      </div>
    </EducatorShell>
  );
}
