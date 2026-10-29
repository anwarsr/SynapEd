"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label, inputClass } from "@/components/educator/fields";
import { createClass, updateClass } from "@/lib/classActions";
import { MAX_CLASS_DESC, MAX_CLASS_NAME } from "@/lib/classTypes";
import { firebaseAuth } from "@/lib/firebase/client";
import { compressBanner, compressSquare, uploadClassImage } from "@/lib/profile";
import { authErrorMessage } from "@/lib/authActions";
import { inisialKelas } from "@/lib/classColor";
import { cn } from "@/lib/cn";

/**
 * Satu formulir untuk membuat dan mengubah kelas.
 *
 * Dua formulir terpisah akan berbeda pelan-pelan — batas panjang di satu sisi
 * diubah, sisi lain tertinggal — dan yang tertinggal itulah yang menolak
 * masukan tanpa alasan yang terlihat.
 *
 * Foto profil kelas: dipilih di sini, dipotong persegi & dikecilkan di browser,
 * diunggah SEBELUM kelasnya disimpan (kelas baru belum punya id), lalu URL-nya
 * dikirim ke server yang memeriksa bentuk path-nya.
 */
export default function ClassForm({
  kelas,
}: {
  kelas?: { id: string; name: string; description: string; imageURL?: string | null; bannerURL?: string | null };
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(kelas?.name ?? "");
  const [description, setDescription] = useState(kelas?.description ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(kelas?.imageURL ?? null);
  const [hapus, setHapus] = useState(false);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(kelas?.bannerURL ?? null);
  const [hapusBanner, setHapusBanner] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function pilih(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Berkas harus berupa gambar.");
      return;
    }
    setError(null);
    setFile(f);
    setHapus(false);
    setPreview((lama) => {
      if (lama?.startsWith("blob:")) URL.revokeObjectURL(lama);
      return URL.createObjectURL(f);
    });
  }

  function pilihBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Berkas harus berupa gambar.");
      return;
    }
    setError(null);
    setBannerFile(f);
    setHapusBanner(false);
    setBannerPreview((lama) => {
      if (lama?.startsWith("blob:")) URL.revokeObjectURL(lama);
      return URL.createObjectURL(f);
    });
  }

  function buangBanner() {
    setBannerPreview((lama) => {
      if (lama?.startsWith("blob:")) URL.revokeObjectURL(lama);
      return null;
    });
    setBannerFile(null);
    setHapusBanner(true);
  }

  function buang() {
    setPreview((lama) => {
      if (lama?.startsWith("blob:")) URL.revokeObjectURL(lama);
      return null;
    });
    setFile(null);
    setHapus(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);

    startTransition(async () => {
      try {
        // undefined = tak diubah, null = dihapus, string = foto baru
        let image: string | null | undefined = undefined;
        if (file) {
          const sesi = firebaseAuth().currentUser;
          if (!sesi) return setError("Sesi berakhir. Silakan masuk kembali.");
          image = await uploadClassImage(sesi, await compressSquare(file));
        } else if (hapus) {
          image = null;
        }

        // Banner: dikecilkan di browser (≤1600px, JPEG < 2 MB) lalu diunggah ke folder avatar yang sama.
        let banner: string | null | undefined = undefined;
        if (bannerFile) {
          const sesi = firebaseAuth().currentUser;
          if (!sesi) return setError("Sesi berakhir. Silakan masuk kembali.");
          banner = await uploadClassImage(sesi, await compressBanner(bannerFile));
        } else if (hapusBanner) {
          banner = null;
        }

        const res = kelas
          ? await updateClass(kelas.id, name, description, image, banner)
          : await createClass(name, description, image ?? null, banner ?? null);

        if (!res.ok) return setError(res.error);

        setDone(res.message);
        if (!kelas) {
          setName("");
          setDescription("");
          buang();
          setHapus(false);
          buangBanner();
          setHapusBanner(false);
        } else {
          setFile(null);
          setHapus(false);
          setBannerFile(null);
          setHapusBanner(false);
        }
        router.refresh();
      } catch (err) {
        setError(authErrorMessage(err));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="bg-paper-card p-6">
      {/* Foto profil kelas */}
      <div className="mb-5">
        <Label htmlFor="classimage">Foto kelas</Label>
        <div className="flex items-center gap-4">
          <span className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden bg-white/[0.08]">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span className="text-[30px] leading-none text-white/70" style={{ fontFamily: "var(--font-sans)" }}>
                {inisialKelas(name || "Kelas")}
              </span>
            )}
          </span>

          <div className="flex flex-col items-start gap-2">
            <input ref={inputRef} id="classimage" type="file" accept="image/*" onChange={pilih} className="hidden" />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="bg-white/10 px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-white/15"
            >
              {preview ? "Ganti foto" : "Pilih foto"}
            </button>
            {preview && (
              <button
                type="button"
                onClick={buang}
                className="px-1 text-[12.5px] font-semibold text-error-text underline-offset-4 hover:underline"
              >
                Hapus foto
              </button>
            )}
            <p className="text-xs text-ink-muted">Dipotong persegi dari tengah.</p>
          </div>
        </div>
      </div>

      {/* Banner kelas */}
      <div className="mb-5">
        <Label htmlFor="classbanner">Banner kelas</Label>
        <div className="relative flex h-[120px] w-full items-center justify-center overflow-hidden bg-white/[0.08] sm:h-[150px]">
          {bannerPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerPreview} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="px-4 text-center text-xs text-ink-muted">Belum ada banner. Gambar lebar tampil di kepala ruang kelas.</span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input ref={bannerRef} id="classbanner" type="file" accept="image/*" onChange={pilihBanner} className="hidden" />
          <button
            type="button"
            onClick={() => bannerRef.current?.click()}
            className="bg-white/10 px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-white/15"
          >
            {bannerPreview ? "Ganti banner" : "Pilih banner"}
          </button>
          {bannerPreview && (
            <button
              type="button"
              onClick={buangBanner}
              className="px-1 text-[12.5px] font-semibold text-error-text underline-offset-4 hover:underline"
            >
              Hapus banner
            </button>
          )}
          <p className="text-xs text-ink-muted">Dikecilkan otomatis (maks 1600 px). Dipotong mengikuti lebar layar.</p>
        </div>
      </div>

      <div className="mb-4">
        <Label htmlFor="classname">Nama kelas</Label>
        <input
          id="classname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_CLASS_NAME}
          placeholder="Contoh: Neurosains Terapan 2026"
          className={inputClass}
        />
      </div>

      <div>
        <Label htmlFor="classdesc">Deskripsi</Label>
        <textarea
          id="classdesc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={MAX_CLASS_DESC}
          rows={3}
          placeholder="Opsional. Untuk siapa kelas ini dan apa isinya."
          className={cn(inputClass, "resize-y")}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className={cn(
          "mt-5 bg-blue-600 px-6 py-3 text-sm font-semibold text-white",
          "transition-colors duration-200 ease-out-soft hover:bg-blue-700",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {pending ? "Menyimpan…" : kelas ? "Simpan Perubahan" : "Buat Kelas"}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-sm text-rust-700">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="mt-3 text-sm text-blue-700">
          {done}
        </p>
      )}
    </form>
  );
}
