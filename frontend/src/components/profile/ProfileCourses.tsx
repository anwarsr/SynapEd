import Link from "next/link";
import Tag from "@/components/ui/Tag";
import { iconPaths, levelTone } from "@/lib/courseUi";
import { progressFromSnapshot, type Enrollment } from "@/lib/enrollments";
import type { EducatorCourseRow } from "@/lib/educatorCourses";
import { cn } from "@/lib/cn";
import type { KelasPublik } from "@/lib/classTypes";

export function Kosong({ pesan, aksi }: { pesan: string; aksi?: { href: string; label: string } }) {
  return (
    <div className="rounded-2xl border border-rule bg-paper-alt px-6 py-10 text-center">
      <p className="text-sm text-ink-muted">{pesan}</p>
      {aksi && (
        <Link
          href={aksi.href}
          className="mt-5 inline-flex rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors duration-200 ease-out-soft hover:bg-blue-700"
        >
          {aksi.label}
        </Link>
      )}
    </div>
  );
}

function Ikon({ icon, tint }: { icon: string; tint: string }) {
  return (
    <span className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", tint)}>
      <svg className="w-5 h-5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[icon] ?? iconPaths.reading} />
      </svg>
    </span>
  );
}

/**
 * Kursus yang sedang diikuti, beserta kemajuannya.
 *
 * Dipindahkan apa adanya dari halaman dashboard lama — termasuk tautan
 * sertifikat, yang merupakan SATU-SATUNYA jalan menuju halaman sertifikat.
 * Menghapusnya di sini akan membuat `/dashboard/certificates/[id]` menjadi
 * halaman yatim yang hanya bisa dicapai dengan mengetik alamatnya.
 */
export function EnrolledCourses({ enrollments }: { enrollments: readonly Enrollment[] }) {
  if (enrollments.length === 0) {
    return (
      <Kosong
        pesan="Belum mengikuti kursus. Pilih satu dari katalog untuk mulai belajar."
        aksi={{ href: "/courses", label: "Lihat Kursus" }}
      />
    );
  }

  return (
    <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
      {enrollments.map((e) => {
        const progress = progressFromSnapshot(e);

        return (
          <div
            key={e.courseSlug}
            className="group bg-paper-card border border-rule rounded-2xl px-[22px] py-5 transition-all duration-200 ease-out-soft hover:border-rule-strong hover:shadow-soft hover:-translate-y-0.5"
          >
            <Link
              href={`/courses/${e.courseSlug}/learn${e.lastLessonSlug ? `/${e.lastLessonSlug}` : ""}`}
              className="block"
            >
              <span className="flex items-center gap-4">
                <Ikon icon={e.courseIcon} tint={e.courseTint} />

                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-ink truncate">
                    {e.courseTitle}
                  </span>
                  <span className="block text-xs text-ink-muted mt-0.5">
                    {progress.done} dari {progress.total} pelajaran
                  </span>
                </span>

                <Tag tone={levelTone(e.courseLevelColor)}>{e.courseLevel}</Tag>
              </span>

              <span className="flex items-center gap-3 mt-4">
                <span className="flex-1 h-[5px] rounded-full bg-paper-alt overflow-hidden" role="presentation">
                  <span
                    className="block h-full rounded-full bg-blue-600 transition-all duration-500 ease-warm"
                    style={{ width: `${progress.percent}%` }}
                  />
                </span>
                <span className="t-numeral text-[12.5px] text-ink-muted tabular-nums shrink-0">
                  {progress.percent}%
                </span>
              </span>
            </Link>

            {e.certificateId && (
              <Link
                href={`/dashboard/certificates/${e.certificateId}`}
                className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline underline-offset-4"
              >
                Lihat Sertifikat →
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Kursus yang dibuat educator.
 *
 * Kursus tersembunyi ikut ditampilkan di profil SENDIRI dan ditandai, supaya
 * pemiliknya tahu draftnya masih ada. Saat profil dibuka orang lain nanti,
 * yang tersembunyi harus disaring lebih dulu oleh pemanggilnya.
 */
export function OwnedCourses({
  courses,
  /** Profil sendiri? Menentukan ajakan saat kosong — pengunjung tidak bisa
   *  membuatkan kursus untuk orang lain. */
  own = false,
}: {
  courses: readonly EducatorCourseRow[];
  own?: boolean;
}) {
  if (courses.length === 0) {
    return own ? (
      <Kosong
        pesan="Belum membuat kursus."
        aksi={{ href: "/educator/courses/new", label: "Buat Kursus" }}
      />
    ) : (
      <Kosong pesan="Belum ada kursus yang tayang." />
    );
  }

  return (
    <div className="grid gap-3.5">
      {courses.map((c) => (
        <Link
          key={c.slug}
          href={`/courses/${c.slug}`}
          className="group flex items-center gap-[18px] bg-paper-card border border-rule rounded-2xl px-[22px] py-5 transition-all duration-200 ease-out-soft hover:border-rule-strong hover:shadow-soft"
        >
          <span className="flex flex-1 min-w-0 items-center gap-[18px]">
            <Ikon icon={c.icon} tint={c.tint} />

            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-medium text-ink truncate group-hover:text-blue-700 transition-colors">
                {c.title}
              </span>
              <span className="block text-[12.5px] text-ink-muted mt-0.5">
                {c.enrolledStudents.toLocaleString("id-ID")} peserta
                {c.reviews > 0 && ` · ${c.rating.toFixed(1)} dari ${c.reviews} ulasan`}
              </span>
            </span>

            {c.visibility === "private" && <Tag tone="amber">Tersembunyi</Tag>}
          </span>
        </Link>
      ))}
    </div>
  );
}

/**
 * Kelas yang diikuti.
 *
 * Ditaruh di berkas ini, bukan berkas sendiri, supaya ia memakai `Kosong`
 * yang sama dengan dua bagian di atasnya — keadaan kosong yang berbeda-beda
 * di satu halaman terbaca seperti tiga halaman yang ditempel jadi satu.
 */
export function JoinedClasses({ kelas }: { kelas: readonly KelasPublik[] }) {
  if (kelas.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-rule px-5 py-6 text-center text-[13px] text-ink-muted">
        Belum mengikuti kelas. Masukkan kode undangan dari pengajar Anda.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {kelas.map((k) => (
        <li key={k.id}>
          <Link
            href={`/kelas/${k.id}`}
            className="block rounded-[14px] border border-rule bg-paper-card px-[18px] py-4 transition-all duration-200 ease-out-soft hover:border-rule-strong hover:shadow-soft"
          >
            <p className="text-sm font-medium text-ink break-words">{k.name}</p>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              {k.memberCount} anggota · {k.postCount} postingan
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
