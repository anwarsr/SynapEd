"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createAccount } from "@/lib/adminUserActions";
import { SandiSekali } from "@/components/admin/UserManage";
import { Label, inputClass } from "@/components/educator/fields";
import { cn } from "@/lib/cn";

/** Formulir membuat akun baru oleh admin. */
export default function CreateAccountForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acak, setAcak] = useState(true);
  const [role, setRole] = useState("user");
  const [pending, mulai] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hasil, setHasil] = useState<{ uid: string; sandi?: string; nama: string } | null>(null);

  function kirim(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setHasil(null);
    mulai(async () => {
      const r = await createAccount({ name, email, password, acak, role });
      if (!r.ok) return setError(r.error);
      setHasil({ uid: r.uid ?? "", sandi: r.sandi, nama: name });
      setName("");
      setEmail("");
      setPassword("");
    });
  }

  return (
    <>
      <form onSubmit={kirim} className="space-y-5 bg-paper-card p-7 sm:p-9">
        <div>
          <Label htmlFor="akun-nama">Nama</Label>
          <input id="akun-nama" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputClass} required />
        </div>

        <div>
          <Label htmlFor="akun-email">Email</Label>
          <input id="akun-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
        </div>

        <div>
          <Label htmlFor="akun-role">Role</Label>
          <select id="akun-role" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
            <option value="user">Pengguna</option>
            <option value="educator">Educator</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div>
          <Label htmlFor="akun-sandi">Kata sandi</Label>
          <label className="mb-3 flex items-center gap-3 text-sm text-ink-body">
            <input type="checkbox" checked={acak} onChange={(e) => setAcak(e.target.checked)} className="h-4 w-4 accent-blue-600" />
            Buat kata sandi acak (ditampilkan sekali setelah akun dibuat)
          </label>
          {!acak && (
            <input
              id="akun-sandi"
              type="text"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className={inputClass}
            />
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className={cn("bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-700", "disabled:cursor-not-allowed disabled:opacity-60")}
        >
          {pending ? "Membuat…" : "Buat akun"}
        </button>

        {error && (
          <p role="alert" className="text-sm text-rust-700">
            {error}
          </p>
        )}
      </form>

      {hasil && (
        <div className="mt-4 bg-paper-card p-7 sm:p-9">
          <p className="text-sm text-blue-300" role="status">
            Akun {hasil.nama} berhasil dibuat.
          </p>
          {hasil.sandi && <SandiSekali sandi={hasil.sandi} />}
          {hasil.uid && (
            <Link href={`/admin/users/${hasil.uid}`} className="mt-5 inline-block text-[13px] font-semibold text-white underline decoration-white/30 underline-offset-[5px] hover:decoration-white">
              Buka detail akun →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
