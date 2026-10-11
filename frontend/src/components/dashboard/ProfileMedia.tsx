"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { firebaseAuth } from "@/lib/firebase/client";
import { establishSession, authErrorMessage } from "@/lib/authActions";
import { uploadAvatar, validateAvatar } from "@/lib/profile";
import { updateMyPhone } from "@/lib/profileActions";
import { validatePhone } from "@/lib/profileTypes";
import type { SessionUser } from "@/lib/firebase/session";
import { cn } from "@/lib/cn";

type Status = { kind: "idle" } | { kind: "ok"; msg: string } | { kind: "err"; msg: string };

function Note({ status }: { status: Status }) {
  if (status.kind === "idle") return null;
  return (
    <p
      role="status"
      className={cn(
        "mt-4 px-4 py-3 text-sm",
        status.kind === "ok"
          ? "bg-blue-500/15 text-blue-200"
          : "bg-[#E0795A]/15 text-error-text",
      )}
    >
      {status.msg}
    </p>
  );
}

/** Inisial sebagai cadangan saat belum ada foto. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Foto profil ─────────────────────────────────────────────────────────

export function AvatarForm({ user }: { user: SessionUser }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(user.photoURL);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Divalidasi juga di storage.rules — pemeriksaan di sini hanya agar
    // pesan galatnya cepat dan jelas, bukan sebagai pengaman.
    const invalid = validateAvatar(file);
    if (invalid) {
      setStatus({ kind: "err", msg: invalid });
      e.target.value = "";
      return;
    }

    setPending(true);
    setStatus({ kind: "idle" });

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    try {
      const current = firebaseAuth().currentUser;
      if (!current) throw new Error("Sesi berakhir. Silakan masuk kembali.");

      const url = await uploadAvatar(current, file);
      setPreview(url);

      // photoURL ikut tertanam di session cookie, jadi cookie-nya harus
      // diterbitkan ulang supaya server melihat foto yang baru.
      await establishSession(current);

      setStatus({ kind: "ok", msg: "Foto profil diperbarui." });
      router.refresh();
    } catch (err) {
      setPreview(user.photoURL);
      setStatus({ kind: "err", msg: authErrorMessage(err) });
    } finally {
      URL.revokeObjectURL(localUrl);
      setPending(false);
      e.target.value = "";
    }
  }

  return (
    <div className="bg-paper-card p-7 sm:p-9">
      <h2 className="t-h3 mb-1.5">Foto Profil</h2>
      <p className="t-body text-sm mb-6">Format gambar apa pun, maksimal 2 MB.</p>

      <div className="flex items-center gap-6">
        <span className="relative w-20 h-20 rounded-full overflow-hidden bg-black flex items-center justify-center shrink-0">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="t-numeral text-xl text-white">{initials(user.name)}</span>
          )}
        </span>

        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={onPick}
            className="hidden"
            id="avatar-input"
          />
          <label
            htmlFor="avatar-input"
            className={cn(
              "inline-block cursor-pointer bg-white/10 px-5 py-2.5 text-sm font-medium",
              "transition-colors duration-200 ease-out-soft hover:bg-white/15 hover:text-white",
              pending && "opacity-60 pointer-events-none",
            )}
          >
            {pending ? "Mengunggah…" : preview ? "Ganti Foto" : "Pilih Foto"}
          </label>
        </div>
      </div>

      <Note status={status} />
    </div>
  );
}

// ── Nomor HP ────────────────────────────────────────────────────────────

/**
 * Nomornya dibaca server lalu diteruskan sebagai `initialPhone`, dan disimpan
 * lewat Server Action. Browser tidak lagi membaca maupun menulis `users/{uid}`.
 */
export function PhoneForm({ initialPhone }: { initialPhone: string }) {
  const [phone, setPhone] = useState(initialPhone);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const invalid = validatePhone(phone);
    if (invalid) {
      setStatus({ kind: "err", msg: invalid });
      return;
    }

    setPending(true);
    setStatus({ kind: "idle" });
    try {
      const res = await updateMyPhone(phone);
      setStatus(res.ok ? { kind: "ok", msg: res.message } : { kind: "err", msg: res.error });
    } catch {
      setStatus({ kind: "err", msg: "Gagal menyimpan. Periksa koneksi lalu coba lagi." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-paper-card p-7 sm:p-9">
      <h2 className="t-h3 mb-1.5">Nomor HP</h2>
      <p className="t-body text-sm mb-6">
        Opsional. Kosongkan lalu simpan untuk menghapusnya.
      </p>

      <div className="max-w-md">
        <label htmlFor="phone" className="block t-label text-ink-muted mb-2">
          Nomor
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          placeholder="0812-3456-7890"
          onChange={(e) => setPhone(e.target.value)}
          className="w-full bg-white/[0.06] px-4 py-3 text-sm text-white transition-[background-color,box-shadow] duration-200 placeholder:text-white/35 focus:bg-white/10 focus:shadow-[inset_0_-2px_0_var(--color-blue-500)] focus:outline-none disabled:opacity-60"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
      >
        {pending ? "Menyimpan…" : "Simpan Nomor"}
      </button>

      <Note status={status} />
    </form>
  );
}
