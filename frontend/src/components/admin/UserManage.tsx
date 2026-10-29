"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeUserRole, removeUserPhoto, replaceUserPhoto, setUserName, setUserPassword } from "@/lib/adminUserActions";
import { compressSquare } from "@/lib/profile";
import UserAvatar from "@/components/ui/UserAvatar";
import { Label, inputClass } from "@/components/educator/fields";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/cn";

const SANS = { fontFamily: "var(--font-sans)" } as const;
const TOMBOL = "bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
const TOMBOL_SEKUNDER = "bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/15 disabled:opacity-50";

/** Kotak sandi acak: tampil SEKALI + tombol salin. */
export function SandiSekali({ sandi }: { sandi: string }) {
  const [tersalin, setTersalin] = useState(false);
  return (
    <div className="mt-4 bg-white/[0.05] px-5 py-4 shadow-[inset_3px_0_0_var(--color-blue-500)]">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.26em] text-blue-300">Kata sandi baru (hanya tampil sekali)</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <code className="text-lg tracking-[0.12em] text-white" style={SANS}>
          {sandi}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(sandi);
              setTersalin(true);
              setTimeout(() => setTersalin(false), 2000);
            } catch {
              // pengguna bisa menyalin manual
            }
          }}
          className={TOMBOL_SEKUNDER}
        >
          {tersalin ? "Tersalin" : "Salin"}
        </button>
      </div>
      <p className="mt-2 text-xs leading-[1.6] text-ink-muted">
        Sampaikan kepada pemilik akun. Setelah halaman ini ditutup, sandi tidak bisa dilihat lagi.
      </p>
    </div>
  );
}

/** Ubah role + ganti kata sandi, di halaman detail akun. */
export default function UserManage({
  uid,
  role,
  isSelf,
  name,
  photoURL,
}: {
  uid: string;
  role: Role;
  isSelf: boolean;
  name: string;
  photoURL: string | null;
}) {
  const router = useRouter();
  const [nama, setNama] = useState(name);
  const [pesanProfil, setPesanProfil] = useState<{ ok: boolean; teks: string } | null>(null);
  const [pProfil, mulaiProfil] = useTransition();
  const berkasRef = useRef<HTMLInputElement>(null);
  const [peran, setPeran] = useState<Role>(role);
  const [sandi, setSandi] = useState("");
  const [pesanRole, setPesanRole] = useState<{ ok: boolean; teks: string } | null>(null);
  const [pesanSandi, setPesanSandi] = useState<{ ok: boolean; teks: string } | null>(null);
  const [acak, setAcak] = useState<string | null>(null);
  const [pRole, mulaiRole] = useTransition();
  const [pSandi, mulaiSandi] = useTransition();

  function jalankanProfil(kerja: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) {
    setPesanProfil(null);
    mulaiProfil(async () => {
      try {
        const r = await kerja();
        setPesanProfil(r.ok ? { ok: true, teks: r.message } : { ok: false, teks: r.error });
        if (r.ok) router.refresh();
      } catch (e) {
        setPesanProfil({ ok: false, teks: e instanceof Error ? e.message : "Permintaan gagal." });
      }
    });
  }

  function pilihFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    jalankanProfil(async () => {
      const blob = await compressSquare(file, 512);
      const dataUrl = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(new Error("Foto tidak bisa dibaca."));
        fr.readAsDataURL(blob);
      });
      return replaceUserPhoto(uid, dataUrl);
    });
  }

  function simpanRole() {
    setPesanRole(null);
    mulaiRole(async () => {
      const r = await changeUserRole(uid, peran);
      setPesanRole(r.ok ? { ok: true, teks: r.message } : { ok: false, teks: r.error });
      if (r.ok) router.refresh();
    });
  }

  function simpanSandi(buatAcak: boolean) {
    setPesanSandi(null);
    setAcak(null);
    mulaiSandi(async () => {
      const r = await setUserPassword(uid, sandi, buatAcak);
      if (!r.ok) return setPesanSandi({ ok: false, teks: r.error });
      setPesanSandi({ ok: true, teks: r.message });
      setSandi("");
      if (r.sandi) setAcak(r.sandi);
    });
  }

  return (
    <div className="mt-8 space-y-4">
      {/* ── Nama & foto (moderasi) ── */}
      <section className="bg-paper-card p-7 sm:p-9">
        <h2 className="mb-1.5 text-[1.25rem] font-bold tracking-[-0.02em] text-white" style={SANS}>
          Nama &amp; foto profil
        </h2>
        <p className="mb-6 max-w-[58ch] text-sm leading-[1.7] text-ink-muted">
          Untuk menertibkan nama atau foto yang tidak pantas. Perubahannya langsung tampil di komentar, kelas, dan profil akun ini.
        </p>
        <div className="flex flex-wrap items-center gap-5">
          <UserAvatar name={name} photoURL={photoURL} size="lg" />
          <div className="flex flex-wrap gap-3">
            <input ref={berkasRef} type="file" accept="image/*" className="hidden" onChange={pilihFoto} />
            <button type="button" onClick={() => berkasRef.current?.click()} disabled={pProfil} className={TOMBOL_SEKUNDER}>
              Ganti foto
            </button>
            <button
              type="button"
              onClick={() => jalankanProfil(() => removeUserPhoto(uid))}
              disabled={pProfil || !photoURL}
              className={TOMBOL_SEKUNDER}
            >
              Hapus foto
            </button>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <Label htmlFor="nama-akun">Nama</Label>
            <input id="nama-akun" type="text" value={nama} maxLength={60} onChange={(e) => setNama(e.target.value)} className={inputClass} />
          </div>
          <button
            type="button"
            onClick={() => jalankanProfil(() => setUserName(uid, nama))}
            disabled={pProfil || nama.trim().length < 2 || nama.trim() === name}
            className={TOMBOL}
          >
            {pProfil ? "Menyimpan…" : "Simpan nama"}
          </button>
        </div>
        {pesanProfil && (
          <p role={pesanProfil.ok ? "status" : "alert"} className={cn("mt-4 text-sm", pesanProfil.ok ? "text-blue-300" : "text-rust-700")}>
            {pesanProfil.teks}
          </p>
        )}
      </section>

      {/* ── Role ── */}
      <section className="bg-paper-card p-7 sm:p-9">
        <h2 className="mb-1.5 text-[1.25rem] font-bold tracking-[-0.02em] text-white" style={SANS}>
          Role akun
        </h2>
        <p className="mb-6 max-w-[58ch] text-sm leading-[1.7] text-ink-muted">
          Mengubah role mencabut sesi akun itu; ia perlu masuk ulang agar role baru berlaku.
          {isSelf && " Role akun Anda sendiri tidak bisa diubah dari sini."}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem]">
            <Label htmlFor="role-akun">Role</Label>
            <select id="role-akun" value={peran} onChange={(e) => setPeran(e.target.value as Role)} disabled={isSelf} className={cn(inputClass, "disabled:opacity-60")}>
              <option value="user">Pengguna</option>
              <option value="educator">Educator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="button" onClick={simpanRole} disabled={isSelf || pRole || peran === role} className={TOMBOL}>
            {pRole ? "Menyimpan…" : "Simpan role"}
          </button>
        </div>
        {pesanRole && (
          <p role={pesanRole.ok ? "status" : "alert"} className={cn("mt-4 text-sm", pesanRole.ok ? "text-blue-300" : "text-rust-700")}>
            {pesanRole.teks}
          </p>
        )}
      </section>

      {/* ── Kata sandi ── */}
      <section className="bg-paper-card p-7 sm:p-9">
        <h2 className="mb-6 text-[1.25rem] font-bold tracking-[-0.02em] text-white" style={SANS}>
          Kata sandi
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <Label htmlFor="sandi-baru">Kata sandi baru</Label>
            <input
              id="sandi-baru"
              type="text"
              autoComplete="off"
              value={sandi}
              onChange={(e) => setSandi(e.target.value)}
              placeholder="Minimal 6 karakter"
              className={inputClass}
            />
          </div>
          <button type="button" onClick={() => simpanSandi(false)} disabled={pSandi || sandi.length < 6} className={TOMBOL}>
            {pSandi ? "Menyimpan…" : "Ganti sandi"}
          </button>
          <button type="button" onClick={() => simpanSandi(true)} disabled={pSandi} className={TOMBOL_SEKUNDER}>
            Buat acak
          </button>
        </div>
        {pesanSandi && (
          <p role={pesanSandi.ok ? "status" : "alert"} className={cn("mt-4 text-sm", pesanSandi.ok ? "text-blue-300" : "text-rust-700")}>
            {pesanSandi.teks}
          </p>
        )}
        {acak && <SandiSekali sandi={acak} />}
      </section>
    </div>
  );
}
