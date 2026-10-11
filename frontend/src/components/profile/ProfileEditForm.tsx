"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMyProfile } from "@/lib/profileActions";
import {
  JENJANG,
  MAX_BIO,
  MAX_EDUCATION,
  MAX_SKILLS,
  MAX_SKILL_LENGTH,
  MAX_YEAR,
  MIN_YEAR,
  type EducationEntry,
  type ProfileContent,
} from "@/lib/profileTypes";
import { cn } from "@/lib/cn";

const inputClass =
  "w-full bg-white/[0.06] px-4 py-3 text-sm text-white transition-[background-color,box-shadow] duration-200 placeholder:text-white/35 focus:bg-white/10 focus:shadow-[inset_0_-2px_0_var(--color-blue-500)] focus:outline-none";

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block t-label text-ink-muted mb-2">
      {children}
    </label>
  );
}

/** Kunci baris pendidikan — acak, tapi tidak pernah ikut render pertama SSR. */
function newKey(): string {
  return crypto.randomUUID().slice(0, 8);
}

function kosong(): EducationEntry {
  return { id: newKey(), institution: "", level: "S1", major: "", startYear: null, endYear: null };
}

export default function ProfileEditForm({ initial }: { initial: ProfileContent }) {
  const router = useRouter();

  const [bio, setBio] = useState(initial.bio);
  const [education, setEducation] = useState<EducationEntry[]>(initial.education);
  const [skills, setSkills] = useState<string[]>(initial.skills);
  const [skillDraft, setSkillDraft] = useState("");

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function updateEntry(id: string, patch: Partial<EducationEntry>) {
    setEducation((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function tambahSkill() {
    const v = skillDraft.trim().slice(0, MAX_SKILL_LENGTH);
    if (!v) return;

    // Duplikat diabaikan diam-diam. Menolak dengan pesan galat untuk hal
    // sesepele ini lebih mengganggu daripada menolong.
    setSkills((prev) => (prev.includes(v) || prev.length >= MAX_SKILLS ? prev : [...prev, v]));
    setSkillDraft("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);

    startTransition(async () => {
      const res = await updateMyProfile({ bio, education, skills });
      if (!res.ok) return setError(res.error);
      setDone(res.message);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <div role="alert" className="bg-[#E0795A]/15 px-4 py-3 text-sm text-error-text">
          {error}
        </div>
      )}
      {done && (
        <div role="status" className="bg-blue-500/15 px-4 py-3 text-sm text-blue-200">
          {done}
        </div>
      )}

      {/* ── Tentang saya ────────────────────────────────────── */}
      <section className="bg-paper-card p-7 sm:p-9">
        <h2 className="t-h3 text-lg mb-1.5">Tentang Saya</h2>
        <p className="t-body text-sm text-ink-muted mb-5">
          Satu paragraf perkenalan yang tampil di bawah nama Anda.
        </p>

        <Label htmlFor="bio">Perkenalan</Label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          maxLength={MAX_BIO}
          placeholder="Contoh: Mahasiswa Teknik Biomedik yang sedang mendalami pemrosesan sinyal EEG."
          className={cn(inputClass, "resize-y")}
        />
        <p className="mt-2 text-xs text-ink-muted">
          {bio.length}/{MAX_BIO} karakter.
        </p>
      </section>

      {/* ── Riwayat pendidikan ──────────────────────────────── */}
      <section className="bg-paper-card p-7 sm:p-9">
        <h2 className="t-h3 text-lg mb-1.5">Riwayat Pendidikan</h2>
        <p className="t-body text-sm text-ink-muted mb-5">
          Hanya nama institusi yang wajib diisi. Kosongkan tahun selesai kalau masih berjalan.
        </p>

        <div className="space-y-4">
          {education.map((e, i) => (
            <div key={e.id} className="bg-white/5 p-5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <span className="t-numeral-ghost text-xl text-ink-faint" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <button
                  type="button"
                  onClick={() => setEducation((prev) => prev.filter((x) => x.id !== e.id))}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-rust-700 transition-colors hover:bg-rust-100"
                >
                  Hapus
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor={`inst-${e.id}`}>Nama institusi</Label>
                  <input
                    id={`inst-${e.id}`}
                    value={e.institution}
                    onChange={(ev) => updateEntry(e.id, { institution: ev.target.value })}
                    placeholder="Universitas Sebelas Maret"
                    className={inputClass}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`jenjang-${e.id}`}>Jenjang</Label>
                    <select
                      id={`jenjang-${e.id}`}
                      value={e.level}
                      onChange={(ev) => updateEntry(e.id, { level: ev.target.value })}
                      className={inputClass}
                    >
                      {JENJANG.map((j) => (
                        <option key={j} value={j}>
                          {j}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor={`jurusan-${e.id}`}>Jurusan</Label>
                    <input
                      id={`jurusan-${e.id}`}
                      value={e.major}
                      onChange={(ev) => updateEntry(e.id, { major: ev.target.value })}
                      placeholder="Teknik Biomedik"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`mulai-${e.id}`}>Tahun mulai</Label>
                    <input
                      id={`mulai-${e.id}`}
                      type="number"
                      inputMode="numeric"
                      min={MIN_YEAR}
                      max={MAX_YEAR}
                      value={e.startYear ?? ""}
                      onChange={(ev) =>
                        updateEntry(e.id, {
                          startYear: ev.target.value === "" ? null : Number(ev.target.value),
                        })
                      }
                      placeholder="2019"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`selesai-${e.id}`}>Tahun selesai</Label>
                    <input
                      id={`selesai-${e.id}`}
                      type="number"
                      inputMode="numeric"
                      min={MIN_YEAR}
                      max={MAX_YEAR}
                      value={e.endYear ?? ""}
                      onChange={(ev) =>
                        updateEntry(e.id, {
                          endYear: ev.target.value === "" ? null : Number(ev.target.value),
                        })
                      }
                      placeholder="Kosongkan bila masih berjalan"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {education.length < MAX_EDUCATION && (
          <button
            type="button"
            onClick={() => setEducation((prev) => [...prev, kosong()])}
            className="mt-4 bg-white/10 px-5 py-2.5 text-sm font-medium text-ink-body transition-colors duration-200 hover:bg-white/15 hover:text-white"
          >
            + Tambah Pendidikan
          </button>
        )}
      </section>

      {/* ── Keahlian ────────────────────────────────────────── */}
      <section className="bg-paper-card p-7 sm:p-9">
        <h2 className="t-h3 text-lg mb-1.5">Keahlian &amp; Minat</h2>
        <p className="t-body text-sm text-ink-muted mb-5">
          Maksimal {MAX_SKILLS} kata kunci singkat, mis. Neuroscience, EEG, Python.
        </p>

        {skills.length > 0 && (
          <ul className="flex flex-wrap gap-2 mb-4">
            {skills.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => setSkills((prev) => prev.filter((x) => x !== s))}
                  aria-label={`Hapus keahlian ${s}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-rust-100 hover:text-rust-700"
                >
                  {s}
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-3">
          <input
            value={skillDraft}
            onChange={(e) => setSkillDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter menambah keahlian, BUKAN mengirim seluruh form —
              // tanpa ini profil tersimpan setengah jadi setiap kali orang
              // menekan Enter karena mengira itu cara menambah.
              if (e.key === "Enter") {
                e.preventDefault();
                tambahSkill();
              }
            }}
            maxLength={MAX_SKILL_LENGTH}
            disabled={skills.length >= MAX_SKILLS}
            placeholder={skills.length >= MAX_SKILLS ? "Sudah mencapai batas" : "Ketik lalu Enter"}
            className={cn(inputClass, "flex-1 min-w-[12rem]")}
          />
          <button
            type="button"
            onClick={tambahSkill}
            disabled={skills.length >= MAX_SKILLS}
            className="bg-white/10 px-5 py-2.5 text-sm font-medium text-ink-body transition-colors duration-200 hover:bg-white/15 hover:text-white disabled:opacity-60"
          >
            Tambah
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-600 px-7 py-3 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
        >
          {pending ? "Menyimpan…" : "Simpan Profil"}
        </button>
      </div>
    </form>
  );
}
