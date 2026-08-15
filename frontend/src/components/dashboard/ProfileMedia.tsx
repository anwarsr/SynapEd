"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { firebaseAuth } from "@/lib/firebase/client";
import { establishSession, authErrorMessage } from "@/lib/authActions";
import {
  fetchProfile,
  savePhone,
  uploadAvatar,
  validateAvatar,
  validatePhone,
} from "@/lib/profile";
import type { SessionUser } from "@/lib/firebase/session";
import { cn } from "@/lib/cn";

type Status = { kind: "idle" } | { kind: "ok"; msg: string } | { kind: "err"; msg: string };

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
    <div className="bg-paper-card border border-rule rounded-2xl p-7">
      <h2 className="t-h3 mb-1.5">Foto Profil</h2>
      <p className="t-body text-sm mb-6">Format gambar apa pun, maksimal 2 MB.</p>

      <div className="flex items-center gap-6">
        <span className="relative w-20 h-20 rounded-full overflow-hidden bg-blue-50 border border-rule flex items-center justify-center shrink-0">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="t-numeral text-xl text-blue-700">{initials(user.name)}</span>
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
              "inline-block cursor-pointer rounded-lg border border-rule px-5 py-2.5 text-sm font-medium",
              "transition-colors duration-200 ease-out-soft hover:border-blue-500 hover:text-blue-700",
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

export function PhoneForm({ user }: { user: SessionUser }) {
  const [phone, setPhone] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchProfile(user.uid)
      .then((p) => {
        if (!alive) return;
        setPhone(p.phone ?? "");
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [user.uid]);

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
      await savePhone(user.uid, phone);
      setStatus({
        kind: "ok",
        msg: phone.trim() === "" ? "Nomor HP dihapus." : "Nomor HP disimpan.",
      });
    } catch (err) {
      setStatus({ kind: "err", msg: authErrorMessage(err) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-paper-card border border-rule rounded-2xl p-7">
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
          disabled={!loaded}
          placeholder={loaded ? "0812-3456-7890" : "Memuat…"}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-rule bg-paper px-4 py-2.5 text-sm text-ink transition-colors duration-200 placeholder:text-ink-faint focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 disabled:opacity-60"
        />
      </div>

      <button
        type="submit"
        disabled={pending || !loaded}
        className="mt-6 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
      >
        {pending ? "Menyimpan…" : "Simpan Nomor"}
      </button>

      <Note status={status} />
    </form>
  );
}
