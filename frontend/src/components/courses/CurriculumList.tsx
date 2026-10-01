import Link from "next/link";
import { CHECK_ICON, LOCK_ICON, lessonIcons } from "@/lib/courseUi";
import type { Section } from "@/lib/courses";
import { cn } from "@/lib/cn";

/** Anchor panel harga di halaman kursus — tujuan baris yang masih terkunci. */
export const ENROLL_ANCHOR = "daftar";

/**
 * Daftar bagian & pelajaran di halaman kursus, yang bisa dinavigasi.
 *
 * Dulu blok ini teks mati: judul dan durasi, tanpa satu pun tautan. Peserta
 * yang sudah terdaftar harus masuk ke halaman belajar dulu, lalu mencari
 * pelajarannya lewat rail — padahal daftarnya sudah terpampang di sini.
 *
 * Tiga keadaan baris, dan pemisahannya penting:
 *
 *   - `bisaBuka` datang dari HAK AKSES (`access.level === "full"`)
 *   - tanda selesai & penanda posisi datang dari ENROLLMENT
 *
 * Keduanya tidak sama. Educator pemilik dan admin punya akses penuh tanpa
 * pernah mendaftar, jadi mereka berhak atas tautannya tetapi tidak punya
 * progres apa pun — dan "belum selesai" pada kursus buatan sendiri hanya
 * menyesatkan.
 *
 * Tidak butuh JavaScript: baris terkunci memakai anchor biasa, dan halaman
 * ini sudah bergaya `scroll-behavior: smooth`.
 */
export default function CurriculumList({
  slug,
  sections,
  bisaBuka,
  completed,
  resumeSlug,
}: {
  slug: string;
  sections: readonly Section[];
  /** Hak membuka pelajaran. Bukan sama dengan "punya enrollment". */
  bisaBuka: boolean;
  /** Slug pelajaran yang sudah diselesaikan. Kosong untuk pemilik/admin. */
  completed: readonly string[];
  /** Pelajaran terakhir yang dibuka, kalau ada. */
  resumeSlug?: string | null;
}) {
  const selesai = new Set(completed);

  return (
    <div className="space-y-4">
      {sections.map((section, si) => (
        <div key={section.position} className="border border-rule rounded-2xl overflow-hidden">
          <div className="px-5 py-4 bg-paper-alt flex items-center gap-3">
            <span className="t-numeral-ghost text-xl text-ink-faint" aria-hidden="true">
              {String(si + 1).padStart(2, "0")}
            </span>
            <span className="text-sm font-medium text-ink">{section.title}</span>
            <span className="text-xs text-ink-muted ml-auto">
              {section.lessons.length} pelajaran
            </span>
          </div>

          <ul className="divide-y divide-rule">
            {section.lessons.map((lesson) => {
              const sudah = selesai.has(lesson.slug);
              const lanjut = bisaBuka && resumeSlug === lesson.slug;

              const isi = (
                <>
                  <span className="flex items-center gap-3 min-w-0">
                    <svg
                      className={cn(
                        "w-4 h-4 flex-shrink-0",
                        bisaBuka ? "text-blue-600" : "text-ink-faint",
                      )}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={
                          !bisaBuka
                            ? LOCK_ICON
                            : sudah
                              ? CHECK_ICON
                              : lessonIcons[lesson.type] ?? lessonIcons.reading
                        }
                      />
                    </svg>

                    <span
                      className={cn(
                        // Membungkus di ponsel, dipotong mulai sm.
                        //
                        // `truncate` menyisakan "Modul 1 : Apa itu N…" pada
                        // layar 390px — judulnya justru bagian yang paling
                        // dicari orang di daftar ini. Di layar lebar barulah
                        // memotong lebih baik daripada baris yang melompat.
                        "break-words sm:truncate",
                        bisaBuka ? "text-ink-body" : "text-ink-muted",
                        sudah && "text-ink-muted",
                      )}
                    >
                      {lesson.title}
                    </span>

                    {lanjut && (
                      <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                        Lanjut di sini
                      </span>
                    )}
                  </span>

                  <span className="text-xs text-ink-muted flex-shrink-0">{lesson.duration}</span>
                </>
              );

              const baris =
                "px-5 py-3 flex items-center justify-between gap-4 text-sm transition-colors duration-200";

              return (
                <li key={lesson.slug}>
                  {bisaBuka ? (
                    <Link
                      href={`/courses/${slug}/learn/${lesson.slug}`}
                      className={cn(baris, "hover:bg-blue-50/60")}
                    >
                      {isi}
                    </Link>
                  ) : (
                    // Anchor ke panel harga, bukan ke halaman pelajaran.
                    // Menautkannya ke pelajaran akan dialihkan balik ke
                    // halaman ini juga — klik, mental, klik, mental.
                    <a
                      href={`#${ENROLL_ANCHOR}`}
                      title="Daftar kursus ini untuk membuka pelajaran"
                      className={cn(baris, "hover:bg-paper-alt")}
                    >
                      {isi}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
