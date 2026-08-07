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
        className="w-full rounded-lg border border-rule bg-paper px-4 py-2.5 text-sm text-ink transition-colors duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
      />
      {hint && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

const submitClass =
  "rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed";

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
      await u.getIdToken(true);
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
    <form onSubmit={onSubmit} className="bg-paper-card border border-rule rounded-2xl p-7">
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
        msg: `Tautan verifikasi dikirim ke ${newEmail.trim()}. Email baru berlaku setelah tautan itu diklik.`,
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
      <div className="bg-paper-card border border-rule rounded-2xl p-7">
        <h2 className="t-h3 mb-1.5">Alamat Email</h2>
        <p className="t-body text-sm">
          Saat ini <span className="text-ink font-medium">{user.email}</span>, mengikuti akun
          Google Anda. Untuk mengubahnya, buat kata sandi terlebih dahulu di bagian bawah —
          setelah itu alamat email dapat diubah dari sini.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="bg-paper-card border border-rule rounded-2xl p-7">
      <h2 className="t-h3 mb-1.5">Alamat Email</h2>
      <p className="t-body text-sm mb-6">
        Saat ini <span className="text-ink font-medium">{user.email}</span>. Perubahan harus
        diverifikasi lewat email baru sebelum berlaku.
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
          ? "Kata sandi dibuat. Mulai sekarang Anda bisa masuk dengan email dan kata sandi, atau tetap lewat Google."
          : "Kata sandi berhasil diperbarui.",
      });
    } catch (err) {
      setStatus({ kind: "err", msg: authErrorMessage(err) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-paper-card border border-rule rounded-2xl p-7">
      <h2 className="t-h3 mb-1.5">{creating ? "Buat Kata Sandi" : "Kata Sandi"}</h2>
      <p className="t-body text-sm mb-6">
        {creating
          ? "Akun ini sekarang hanya bisa masuk lewat Google. Buat kata sandi untuk menambahkan cara masuk kedua — Google tetap berfungsi."
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
          hint={
            creating
              ? "Minimal 6 karakter. Kalau sesi Anda sudah lama, Google akan meminta konfirmasi sekali."
              : undefined
          }
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
    <div className="bg-paper-card border border-rust-700/30 rounded-2xl p-7">
      <h2 className="t-h3 mb-1.5 text-rust-700">Hapus Akun</h2>
      <p className="t-body text-sm mb-6">
        Akun dihapus permanen dari Firebase Authentication. Tindakan ini tidak bisa dibatalkan.
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
          {viaGoogle ? (
            <p className="text-sm text-ink-body">
              Google akan meminta konfirmasi untuk akun ini, lalu akun dihapus permanen.
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
              className="rounded-lg bg-rust-700 px-6 py-2.5 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
