"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";
import Tag from "@/components/ui/Tag";
import { roleLabel, type Role } from "@/lib/roles";
import { cn } from "@/lib/cn";

export interface UserRowView {
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
  role: Role;
  phone: string | null;
  pendingApplication: boolean;
  /** Sudah diformat di server (adminUsers.ts server-only). */
  lastSignIn: string;
}

const roleTone = { admin: "amber", educator: "blue", user: "neutral" } as const;

const FILTER: { id: "semua" | Role; label: string }[] = [
  { id: "semua", label: "Semua" },
  { id: "admin", label: "Admin" },
  { id: "educator", label: "Educator" },
  { id: "user", label: "Pengguna" },
];

/**
 * Daftar akun dengan pencarian. Penyaringan terjadi di browser terhadap daftar
 * yang sudah dimuat server (maks 1000 akun): mencocokkan nama, email, nomor HP,
 * dan peran tanpa membedakan huruf besar-kecil. Chip peran menyempitkan lagi.
 */
export default function UserList({ users }: { users: UserRowView[] }) {
  const [q, setQ] = useState("");
  const [peran, setPeran] = useState<"semua" | Role>("semua");

  const hasil = useMemo(() => {
    const kata = q.trim().toLowerCase();
    return users.filter((u) => {
      if (peran !== "semua" && u.role !== peran) return false;
      if (!kata) return true;
      return `${u.name} ${u.email} ${u.phone ?? ""} ${roleLabel[u.role]}`.toLowerCase().includes(kata);
    });
  }, [users, q, peran]);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-3 bg-white/[0.06] px-5 py-1 shadow-[inset_0_-1px_0_var(--color-rule)] transition-[background-color,box-shadow] duration-300 focus-within:bg-white/[0.09] focus-within:shadow-[inset_0_-2px_0_var(--color-blue-400)]">
          <svg className="h-5 w-5 shrink-0 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
          </svg>
          <span className="sr-only">Cari akun</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, email, atau nomor HP…"
            className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/35 [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Hapus pencarian"
              className="flex h-8 w-8 shrink-0 items-center justify-center text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </label>

        <div className="flex flex-wrap gap-1" role="group" aria-label="Saring menurut peran">
          {FILTER.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setPeran(f.id)}
              aria-pressed={peran === f.id}
              className={cn(
                "px-4 py-3 text-[13px] font-semibold transition-colors duration-200",
                peran === f.id ? "bg-blue-600 text-white" : "bg-white/10 text-white/75 hover:bg-white/15 hover:text-white",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-xs text-ink-muted" aria-live="polite">
        {hasil.length === users.length ? `${users.length} akun` : `${hasil.length} dari ${users.length} akun`}
      </p>

      <div className="overflow-hidden bg-paper-card">
        {/* Kepala tabel hanya untuk layar lebar; di ponsel tiap baris
            berdiri sendiri sebagai kartu. */}
        <div className="hidden grid-cols-[1fr_auto_auto_auto] gap-6 border-b border-rule bg-paper-alt px-6 py-3.5 lg:grid">
          <span className="t-label text-ink-muted">Pengguna</span>
          <span className="t-label w-32 text-ink-muted">Nomor HP</span>
          <span className="t-label w-40 text-ink-muted">Role</span>
          <span className="t-label w-44 text-ink-muted">Terakhir masuk</span>
        </div>

        {hasil.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-ink-muted">Tidak ada akun yang cocok dengan pencarian ini.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {hasil.map((u) => (
              <li key={u.uid}>
                <Link
                  href={`/admin/users/${u.uid}`}
                  className="group grid items-center gap-4 px-6 py-4 transition-colors duration-200 hover:bg-blue-50/50 lg:grid-cols-[1fr_auto_auto_auto] lg:gap-6"
                >
                  <span className="flex min-w-0 items-center gap-3.5">
                    <span className="relative shrink-0">
                      <UserAvatar name={u.name} photoURL={u.photoURL} />
                      {/* Titik pada foto: penanda ada pengajuan yang menunggu. */}
                      {u.pendingApplication && (
                        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-paper-card bg-amber-500" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink transition-colors group-hover:text-blue-700">{u.name}</span>
                      <span className="block truncate text-xs text-ink-muted">{u.email}</span>
                    </span>
                  </span>

                  <span className="text-sm text-ink-body lg:w-32">{u.phone ?? <span className="text-ink-faint">-</span>}</span>

                  <span className="flex items-center gap-2 lg:w-40">
                    <Tag tone={roleTone[u.role]}>{roleLabel[u.role]}</Tag>
                    {u.pendingApplication && <Tag tone="amber">Mengajukan</Tag>}
                  </span>

                  <span className="text-xs text-ink-muted lg:w-44">{u.lastSignIn}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
