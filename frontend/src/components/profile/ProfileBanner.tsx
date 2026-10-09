"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { firebaseAuth } from "@/lib/firebase/client";
import { compressBanner, uploadBanner } from "@/lib/profile";
import { updateMyBanner } from "@/lib/profileActions";
import { authErrorMessage } from "@/lib/authActions";

/**
 * Sampul profil. Tanpa gambar = hitam polos (sama dengan foto profil bawaan).
 * Pemilik profil mendapat tombol "Ganti banner" di pojok kanan atas; gambar
 * dikecilkan di browser (maks 1600px, JPEG) sebelum diunggah, jadi foto besar
 * dari ponsel pun lolos batas 2 MB di storage.rules.
 *
 * Banner yang sama tampil di kartu komentar pemiliknya di beranda.
 */
export default function ProfileBanner({
  bannerURL,
  editable = false,
}: {
  bannerURL: string | null;
  editable?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Berkas harus berupa gambar.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const current = firebaseAuth().currentUser;
      if (!current) throw new Error("Sesi berakhir. Silakan masuk kembali.");

      const blob = await compressBanner(file);
      const url = await uploadBanner(current, blob);
      const res = await updateMyBanner(url);
      if (!res.ok) throw new Error(res.error);

      router.refresh();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function onRemove() {
    setPending(true);
    setError(null);
    try {
      const res = await updateMyBanner(null);
      if (!res.ok) throw new Error(res.error);
      router.refresh();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative mt-24 h-[200px] overflow-hidden bg-banner sm:h-[250px]">
      {bannerURL && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bannerURL} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}

      {/* Peredam bawah supaya avatar yang menumpang tetap terbaca di atas foto */}
      {bannerURL && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/45 to-transparent" />
      )}

      {editable && (
        <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-6 sm:top-5">
          <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" id="banner-input" />
          <label
            htmlFor="banner-input"
            className={
              "cursor-pointer bg-black/55 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md transition-colors duration-200 hover:bg-black/75" +
              (pending ? " pointer-events-none opacity-60" : "")
            }
          >
            {pending ? "Memproses…" : bannerURL ? "Ganti banner" : "Tambah banner"}
          </label>

          {bannerURL && (
            <button
              type="button"
              onClick={onRemove}
              disabled={pending}
              className="bg-black/55 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-md transition-colors duration-200 hover:bg-black/75 hover:text-white disabled:opacity-60"
            >
              Hapus
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="status" className="absolute bottom-3 left-4 max-w-[80%] bg-black/70 px-3 py-1.5 text-xs text-white sm:left-6">
          {error}
        </p>
      )}
    </div>
  );
}
