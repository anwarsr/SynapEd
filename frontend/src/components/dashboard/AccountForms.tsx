"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import {
  authErrorMessage,
  establishSession,
  isRecentLoginRequired,
  reauthWithGoogle,
} from "@/lib/authActions";
import { purgeAvatarFiles } from "@/lib/uploadCleanupActions";
import type { SignInMethods } from "@/lib/accountProviders";
import type { SessionUser } from "@/lib/firebase/session";
import { cn } from "@/lib/cn";

type Status = { kind: "idle" } | { kind: "ok"; msg: string } | { kind: "err"; msg: string };

function currentUser(): User {
  const u = firebaseAuth().currentUser;
  if (!u) throw new Error("Sesi berakhir. Silakan masuk kembali.");
  return u;
}

/**
 * Firebase menolak operasi sensitif (ganti sandi/email, hapus akun) kalau
 * sesi sudah lama — inilah `auth/requires-recent-login`. Autentikasi ulang
 * menyelesaikannya, sekaligus berfungsi sebagai konfirmasi identitas.
 *
 * Caranya harus mengikuti metode masuk yang dimiliki akun. Akun yang masuk
 * lewat Google TIDAK punya kata sandi untuk dicocokkan, jadi memaksa mereka
 * mengetik kata sandi membuat seluruh pengaturan akun mustahil dipakai.
 */
async function reauth(password: string): Promise<User> {
  const user = currentUser();
  const credential = EmailAuthProvider.credential(user.email ?? "", password);
  await reauthenticateWithCredential(user, credential);
  return user;
}

async function reauthGoogle(): Promise<User> {
  const user = currentUser();
  await reauthWithGoogle(user);
  return user;
}

/**
 * Menjalankan operasi sensitif, dan baru memunculkan popup Google kalau
 * Firebase memang menuntut sesi yang lebih baru.
 *
 * Pengguna yang baru saja masuk tidak melihat popup sama sekali — memaksanya
 * muncul setiap kali hanya menambah langkah tanpa menambah keamanan, karena
 * batas kesegaran sesi itu justru yang menjadi penjaganya.
 */
async function withRecentLogin(run: (user: User) => Promise<void>): Promise<User> {
  let user = currentUser();

  try {
    await run(user);
  } catch (err) {
    if (!isRecentLoginRequired(err)) throw err;
    user = await reauthGoogle();
    await run(user);
  }

  return user;
}

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

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  hint?: string;
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
        className="w-full bg-white/[0.06] px-4 py-3 text-sm text-white transition-[background-color,box-shadow] duration-200 placeholder:text-white/35 focus:bg-white/10 focus:shadow-[inset_0_-2px_0_var(--color-blue-500)] focus:outline-none"
      />
      {hint && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

const submitClass =
  "bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed";

// ── Nama tampilan ───────────────────────────────────────────────────────

export function ProfileForm({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus({ kind: "idle" });
    try {
      const u = currentUser();
      await updateProfile(u, { displayName: name.trim() });

      // Nama ikut tertanam di dalam session cookie, jadi cookie-nya harus
      // diterbitkan ulang — kalau tidak, navbar masih menampilkan nama lama.
      // establishSession sudah mengambil ulang token sebelum menukarnya.
      await establishSession(u);

      setStatus({ kind: "ok", msg: "Nama berhasil diperbarui." });
      router.refresh();
    } catch (err) {
      setStatus({ kind: "err", msg: authErrorMessage(err) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-paper-card p-7 sm:p-9">
      <h2 className="t-h3 mb-1.5">Profil</h2>
      <p className="t-body text-sm mb-6">Nama yang ditampilkan di seluruh aplikasi.</p>

      <div className="space-y-4 max-w-md">
        <Field id="p-name" label="Nama" value={name} onChange={setName} autoComplete="name" />
        <Field id="p-email" label="Email" value={user.email} onChange={() => {}} hint="Diubah lewat bagian di bawah." />
      </div>

      <button type="submit" disabled={pending} className={cn(submitClass, "mt-6")}>
        {pending ? "Menyimpan…" : "Simpan Nama"}
      </button>

      <Note status={status} />
    </form>
  );
}

// ── Ganti email ─────────────────────────────────────────────────────────

export function EmailForm({ user, methods }: { user: SessionUser; methods: SignInMethods }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus({ kind: "idle" });
    try {
      const u = await reauth(password);
      // Firebase sengaja tidak langsung mengganti email: tautan verifikasi
      // dikirim ke alamat BARU dan email baru berlaku setelah diklik.
      await verifyBeforeUpdateEmail(u, newEmail.trim());
      setPassword("");
      setStatus({
        kind: "ok",
        msg: `Tautan dikirim ke ${newEmail.trim()}. Klik tautan itu untuk menyelesaikan perubahan.`,
      });
    } catch (err) {
      setStatus({ kind: "err", msg: authErrorMessage(err) });
    } finally {
      setPending(false);
    }
  }

  // Untuk akun tanpa kata sandi, alamat email datang dari Google. Mengubahnya
  // di sini akan membuat email akun berbeda dari email Google-nya, sehingga
  // masuk lewat Google justru berhenti mengenali akun ini. Lebih jujur
  // mengatakannya daripada menyediakan tombol yang merusak.
  if (!methods.password) {
    return (
      <div className="bg-paper-card p-7 sm:p-9">
        <h2 className="t-h3 mb-1.5">Alamat Email</h2>
        <p className="t-body text-sm">
          Saat ini <span className="text-ink font-medium">{user.email}</span>, mengikuti akun
          Google Anda. Buat kata sandi di bawah kalau ingin mengubahnya.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="bg-paper-card p-7 sm:p-9">
      <h2 className="t-h3 mb-1.5">Alamat Email</h2>
      <p className="t-body text-sm mb-6">
        Saat ini <span className="text-ink font-medium">{user.email}</span>. Email baru berlaku
        setelah Anda klik tautan yang kami kirim ke sana.
      </p>

      <div className="space-y-4 max-w-md">
        <Field id="e-new" label="Email baru" type="email" value={newEmail} onChange={setNewEmail} autoComplete="email" />
        <Field
          id="e-password"
          label="Kata sandi saat ini"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
      </div>

      <button
        type="submit"
        disabled={pending || !newEmail || !password}
        className={cn(submitClass, "mt-6")}
      >
        {pending ? "Mengirim…" : "Kirim Tautan Verifikasi"}
      </button>

      <Note status={status} />
    </form>
  );
}

// ── Kata sandi ──────────────────────────────────────────────────────────

export function PasswordForm({ methods }: { methods: SignInMethods }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  // Akun yang hanya masuk lewat Google belum punya kata sandi untuk diganti —
  // yang bisa dilakukan adalah MEMBUATNYA, dan itu memulihkan masuk dengan
  // email + kata sandi.
  const creating = !methods.password;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus({ kind: "idle" });
    try {
      const u = creating
        ? await withRecentLogin((user) => updatePassword(user, newPassword))
        : await reauth(currentPassword).then(async (user) => {
            await updatePassword(user, newPassword);
            return user;
          });

      await establishSession(u);

      setCurrent("");
      setNew("");
      setStatus({
        kind: "ok",
        msg: creating
          ? "Kata sandi dibuat. Sekarang Anda bisa masuk dengan email atau Google."
          : "Kata sandi berhasil diperbarui.",
      });
    } catch (err) {
      setStatus({ kind: "err", msg: authErrorMessage(err) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-paper-card p-7 sm:p-9">
      <h2 className="t-h3 mb-1.5">{creating ? "Buat Kata Sandi" : "Kata Sandi"}</h2>
      <p className="t-body text-sm mb-6">
        {creating
          ? "Saat ini Anda hanya bisa masuk lewat Google. Buat kata sandi agar bisa masuk dengan email juga."
          : "Minimal 6 karakter."}
      </p>

      <div className="space-y-4 max-w-md">
        {!creating && (
          <Field
            id="pw-current"
            label="Kata sandi saat ini"
            type="password"
            value={currentPassword}
            onChange={setCurrent}
            autoComplete="current-password"
          />
        )}
        <Field
          id="pw-new"
          label={creating ? "Kata sandi baru" : "Kata sandi baru"}
          type="password"
          value={newPassword}
          onChange={setNew}
          autoComplete="new-password"
          hint={creating ? "Minimal 6 karakter." : undefined}
        />
      </div>

      <button
        type="submit"
        disabled={pending || !newPassword || (!creating && !currentPassword)}
        className={cn(submitClass, "mt-6")}
      >
        {pending ? "Menyimpan…" : creating ? "Buat Kata Sandi" : "Ganti Kata Sandi"}
      </button>

      <Note status={status} />
    </form>
  );
}

// ── Hapus akun ──────────────────────────────────────────────────────────

export function DeleteAccount({ methods }: { methods: SignInMethods }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  // Konfirmasi identitas tetap wajib, hanya caranya yang menyesuaikan.
  //
  // Berbeda dengan membuat kata sandi, di sini konfirmasi SELALU diminta dan
  // tidak menunggu Firebase menuntutnya: menghapus akun tidak bisa dibatalkan,
  // jadi tidak pantas berjalan hanya karena kebetulan sesinya masih segar.
  const viaGoogle = !methods.password;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus({ kind: "idle" });
    try {
      const u = viaGoogle ? await reauthGoogle() : await reauth(password);

      // Foto profil dibersihkan SEBELUM akunnya hilang. Setelah deleteUser,
      // cookie sesi tidak lagi mewakili siapa pun, sehingga Server Action
      // pembersih tidak punya cara mengetahui folder milik siapa yang boleh
      // disentuh — berkasnya akan tertinggal selamanya.
      await purgeAvatarFiles().catch(() => undefined);

      await deleteUser(u);

      // Akun sudah tidak ada — cookie sesi wajib ikut dibersihkan.
      await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
      await signOut(firebaseAuth()).catch(() => undefined);

      router.replace("/");
      router.refresh();
    } catch (err) {
      setStatus({ kind: "err", msg: authErrorMessage(err) });
      setPending(false);
    }
  }

  return (
    <div className="bg-[#E0795A]/10 p-7 sm:p-9">
      <h2 className="t-h3 mb-1.5 text-error-text">Hapus Akun</h2>
      <p className="t-body text-sm mb-6">
        Akun beserta datanya dihapus permanen. Tindakan ini tidak bisa dibatalkan.
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="bg-[#E0795A]/15 px-6 py-2.5 text-sm font-semibold text-error-text transition-colors duration-200 hover:bg-[#E0795A]/25"
        >
          Saya ingin menghapus akun
        </button>
      ) : (
        <form onSubmit={onSubmit} className="max-w-md">
          {viaGoogle ? (
            <p className="text-sm text-ink-body">
              Google akan meminta konfirmasi, lalu akun dihapus.
            </p>
          ) : (
            <Field
              id="del-password"
              label="Ketik kata sandi untuk konfirmasi"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
          )}
          <div className="flex gap-2.5 mt-5">
            <button
              type="submit"
              disabled={pending || (!viaGoogle && !password)}
              className="bg-rust-700 px-6 py-2.5 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "Menghapus…" : viaGoogle ? "Konfirmasi & Hapus" : "Hapus Permanen"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPassword("");
                setStatus({ kind: "idle" });
              }}
              className="bg-white/10 px-6 py-2.5 text-sm font-medium text-ink-body transition-colors duration-200 hover:bg-white/15 hover:text-white"
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
