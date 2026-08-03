"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, API_URL, type AuthUser } from "@/lib/api";
import { cn } from "@/lib/cn";

type Status = { kind: "idle" } | { kind: "ok"; msg: string } | { kind: "err"; msg: string };

async function send(path: string, method: string, body?: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `Gagal (${res.status})`;
    try {
      const j = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(j.message)) message = j.message.join(", ");
      else if (j.message) message = j.message;
    } catch {
      /* pakai pesan default */
    }
    throw new ApiError(message, res.status);
  }
}

function Note({ status }: { status: Status }) {
  if (status.kind === "idle") return null;
  return (
    <p
      role="status"
      className={cn(
        "mt-4 rounded-lg px-4 py-3 text-sm",
        status.kind === "ok"
          ? "bg-blue-50 text-blue-700 border border-blue-100"
          : "bg-rust-100 text-rust-700 border border-rust-700/25",
      )}
    >
      {status.msg}
    </p>
  );
}

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block t-label text-ink-muted mb-2">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-rule bg-paper px-4 py-2.5 text-sm text-ink transition-colors duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
      />
    </div>
  );
}

const submitClass =
  "rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed";

// ── Profil ──────────────────────────────────────────────────────────────

export function ProfileForm({ user }: { user: AuthUser }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus({ kind: "idle" });
    try {
      await send("/users/me", "PATCH", { name, email });
      setStatus({ kind: "ok", msg: "Profil berhasil diperbarui." });
      router.refresh();
    } catch (err) {
      setStatus({ kind: "err", msg: err instanceof ApiError ? err.message : "Terjadi kesalahan." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-paper-card border border-rule rounded-2xl p-7">
      <h2 className="t-h3 mb-1.5">Profil</h2>
      <p className="t-body text-sm mb-6">Ubah nama dan alamat email akun Anda.</p>

      <div className="space-y-4 max-w-md">
        <Field id="p-name" label="Nama" value={name} onChange={setName} autoComplete="name" />
        <Field id="p-email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        Mengganti email akan membatalkan status verifikasi.
      </p>

      <button type="submit" disabled={pending} className={cn(submitClass, "mt-6")}>
        {pending ? "Menyimpan…" : "Simpan Perubahan"}
      </button>

      <Note status={status} />
    </form>
  );
}

// ── Kata sandi ──────────────────────────────────────────────────────────

export function PasswordForm() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus({ kind: "idle" });
    try {
      await send("/users/me/password", "PUT", { currentPassword, newPassword });
      setCurrent("");
      setNew("");
      setStatus({
        kind: "ok",
        msg: "Kata sandi diperbarui. Semua sesi lain sudah dikeluarkan.",
      });
    } catch (err) {
      setStatus({ kind: "err", msg: err instanceof ApiError ? err.message : "Terjadi kesalahan." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-paper-card border border-rule rounded-2xl p-7">
      <h2 className="t-h3 mb-1.5">Kata Sandi</h2>
      <p className="t-body text-sm mb-6">
        Demi keamanan, mengganti kata sandi akan mengeluarkan Anda dari semua perangkat lain.
      </p>

      <div className="space-y-4 max-w-md">
        <Field
          id="pw-current"
          label="Kata sandi saat ini"
          type="password"
          value={currentPassword}
          onChange={setCurrent}
          autoComplete="current-password"
        />
        <Field
          id="pw-new"
          label="Kata sandi baru"
          type="password"
          value={newPassword}
          onChange={setNew}
          autoComplete="new-password"
        />
      </div>

      <button type="submit" disabled={pending} className={cn(submitClass, "mt-6")}>
        {pending ? "Menyimpan…" : "Ganti Kata Sandi"}
      </button>

      <Note status={status} />
    </form>
  );
}

// ── Hapus akun ──────────────────────────────────────────────────────────

export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus({ kind: "idle" });
    try {
      await send("/users/me", "DELETE", { password });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setStatus({ kind: "err", msg: err instanceof ApiError ? err.message : "Terjadi kesalahan." });
      setPending(false);
    }
  }

  return (
    <div className="bg-paper-card border border-rust-700/30 rounded-2xl p-7">
      <h2 className="t-h3 mb-1.5 text-rust-700">Hapus Akun</h2>
      <p className="t-body text-sm mb-6">
        Akun dan seluruh sesinya dihapus permanen. Tindakan ini tidak bisa dibatalkan.
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg border border-rust-700/40 px-6 py-2.5 text-sm font-semibold text-rust-700 transition-colors duration-200 hover:bg-rust-100"
        >
          Saya ingin menghapus akun
        </button>
      ) : (
        <form onSubmit={onSubmit} className="max-w-md">
          <Field
            id="del-password"
            label="Ketik kata sandi untuk konfirmasi"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          <div className="flex gap-2.5 mt-5">
            <button
              type="submit"
              disabled={pending || password.length === 0}
              className="rounded-lg bg-rust-700 px-6 py-2.5 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "Menghapus…" : "Hapus Permanen"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPassword("");
                setStatus({ kind: "idle" });
              }}
              className="rounded-lg border border-rule px-6 py-2.5 text-sm font-medium text-ink-body transition-colors duration-200 hover:border-blue-500 hover:text-blue-700"
            >
              Batal
            </button>
          </div>
          <Note status={status} />
        </form>
      )}
    </div>
  );
}
