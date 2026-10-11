"use client";
import { useState } from "react";
import { changeUsername } from "@/lib/usernameActions";
import {
  USERNAME_CHANGE_COOLDOWN_DAYS,
  USERNAME_MAX,
  normalizeUsernameInput,
  validateUsername,
} from "@/lib/usernameRules";
import { cn } from "@/lib/cn";

type Status = { kind: "idle" } | { kind: "ok"; msg: string } | { kind: "err"; msg: string };

/**
 * Username dipakai orang lain untuk menemukan akun ini — mis. educator yang
 * menambahkannya sebagai kontributor kursus.
 *
 * Validasi di sini hanya umpan balik; penjaga sebenarnya ada di server
 * (`changeUsernameFor`), termasuk jeda antarpenggantian.
 */
export default function UsernameForm({
  username,
  changedAt,
}: {
  username: string | null;
  /** null = masih buatan otomatis dari email. */
  changedAt: string | null;
}) {
  const [current, setCurrent] = useState(username);
  const [value, setValue] = useState(username ?? "");
  const [otomatis, setOtomatis] = useState(changedAt === null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  const normal = normalizeUsernameInput(value);
  const berubah = normal !== "" && normal !== current;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const invalid = validateUsername(normal);
    if (invalid) {
      setStatus({ kind: "err", msg: invalid });
      return;
    }

    setPending(true);
    setStatus({ kind: "idle" });
    try {
      const res = await changeUsername(normal);
      if (res.ok) {
        setCurrent(res.username);
        setValue(res.username);
        setOtomatis(false);
        setStatus({ kind: "ok", msg: res.message });
      } else {
        setStatus({ kind: "err", msg: res.error });
      }
    } catch {
      setStatus({ kind: "err", msg: "Gagal menyimpan. Periksa koneksi lalu coba lagi." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-paper-card p-7">
      <h2 className="t-h3 mb-1.5">Username</h2>
      <p className="t-body text-sm mb-6">
        Dipakai untuk menemukan akun Anda, misalnya saat educator menambahkan Anda sebagai
        kontributor kursus. Username bisa diganti sekali setiap {USERNAME_CHANGE_COOLDOWN_DAYS} hari.
      </p>

      {otomatis && current && (
        <p className="mb-6 bg-amber-100 px-4 py-3 text-sm text-amber-700">
          <strong className="font-semibold">@{current}</strong> dibuat otomatis dari alamat email Anda
          dan terlihat di profil publik. Ganti kalau Anda tidak ingin bagian email itu tampil.
        </p>
      )}

      <div className="max-w-md">
        <label htmlFor="username" className="block t-label text-ink-muted mb-2">
          Username
        </label>
        <div className="flex items-stretch bg-white/[0.06] shadow-[inset_0_-1px_0_var(--color-rule)] transition-colors duration-200 focus-within:shadow-[inset_0_-2px_0_var(--color-blue-400)]">
          <span aria-hidden="true" className="flex items-center pl-4 text-sm text-ink-faint">
            @
          </span>
          <input
            id="username"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={USERNAME_MAX + 1}
            value={value}
            placeholder="nama.anda"
            onChange={(e) => setValue(e.target.value)}
            className="w-full min-w-0 bg-transparent py-2.5 pl-1 pr-4 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Huruf kecil, angka, titik, dan garis bawah. 3–{USERNAME_MAX} karakter.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending || !berubah}
        className="mt-6  bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
      >
        {pending ? "Menyimpan…" : "Ganti Username"}
      </button>

      {status.kind !== "idle" && (
        <p
          role="status"
          className={cn(
            "mt-4  px-4 py-3 text-sm",
            status.kind === "ok"
              ? "bg-blue-50 text-blue-700 border border-blue-100"
              : "bg-rust-100 text-rust-700 border border-rust-700/25",
          )}
        >
          {status.msg}
        </p>
      )}
    </form>
  );
}
