"use client";
import { useEffect, useRef, useState } from "react";
import { firebaseAuth } from "@/lib/firebase/client";
import { IMAGE_ACCEPT, uploadCourseImage, validateImage } from "@/lib/courseUpload";
import { discardUpload } from "@/lib/uploadCleanupActions";
import { courseImageUrl } from "@/lib/videoEmbed";
import { Label } from "./fields";

/**
 * Memilih gambar latar kursus.
 *
 * Mengunggah langsung saat berkas dipilih, lalu melaporkan PATH-nya ke induk.
 * Path, bukan URL: itulah yang bisa diperiksa ulang server (harus berada di
 * folder milik pengunggah).
 *
 * `onChange(undefined)` berarti "tidak diubah" — penting saat menyunting
 * kursus lama yang gambarnya berupa URL, karena nilai itu tidak boleh
 * dikirim balik sebagai kalau-kalau path baru.
 */
export default function ThumbnailPicker({
  initial,
  prefix,
  onChange,
}: {
  /** Nilai `thumbnail` yang tersimpan — path Storage, URL, atau path lokal. */
  initial?: string | null;
  /** Pengelompokan berkas: slug kursus, atau id draft saat membuat baru. */
  prefix: string;
  onChange: (value: string | null | undefined) => void;
}) {
  const [preview, setPreview] = useState<string | null>(() => courseImageUrl(initial));
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Path yang diunggah DI HALAMAN INI, bukan yang sudah tersimpan di kursus.
  // Hanya berkas inilah yang boleh dibuang langsung: gambar yang sudah
  // tersimpan masih dipakai kursusnya sampai form ini benar-benar disimpan,
  // dan penghapusannya diurus server saat itu terjadi.
  const justUploaded = useRef<string | null>(null);

  function dropPrevious() {
    const stale = justUploaded.current;
    justUploaded.current = null;
    // Tidak ditunggu: ini kebersihan penyimpanan, bukan sesuatu yang perlu
    // menahan pemilihan gambar berikutnya.
    if (stale) void discardUpload(stale).catch(() => undefined);
  }

  // Pratinjau lokal memakai objek URL yang harus dilepas, kalau tidak
  // berkasnya tertahan di memori selama halaman terbuka.
  useEffect(() => {
    return () => {
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [localUrl]);

  async function onPick(file: File | null) {
    if (!file) return;

    const invalid = validateImage(file);
    if (invalid) {
      setError(invalid);
      return;
    }

    const uid = firebaseAuth().currentUser?.uid;
    if (!uid) {
      setError("Sesi berakhir. Silakan masuk kembali.");
      return;
    }

    setError(null);
    setUploading(true);

    const objectUrl = URL.createObjectURL(file);
    setLocalUrl(objectUrl);
    setPreview(objectUrl);

    try {
      const path = await uploadCourseImage(uid, prefix, file);
      dropPrevious();
      justUploaded.current = path;
      onChange(path);
    } catch {
      setError("Gagal mengunggah gambar. Coba lagi.");
      setPreview(courseImageUrl(initial));
      onChange(undefined);
    } finally {
      setUploading(false);
    }
  }

  function remove() {
    setPreview(null);
    setError(null);
    dropPrevious();
    onChange(null);
  }

  return (
    <div>
      <Label htmlFor="thumbnail">Gambar latar kursus</Label>

      <div className="flex flex-wrap items-start gap-5">
        <span className="w-44 h-28 rounded-xl overflow-hidden border border-rule bg-paper-alt flex items-center justify-center shrink-0">
          {preview ? (
            // Gambar bisa berasal dari Storage, URL luar, atau folder public —
            // <img> biasa menghindarkan daftar remotePatterns yang panjang.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-ink-faint px-3 text-center">Belum ada gambar</span>
          )}
        </span>

        <div>
          <input
            id="thumbnail"
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="thumbnail"
              className="cursor-pointer rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink transition-colors duration-200 ease-out-soft hover:border-blue-500 hover:text-blue-700"
            >
              {preview ? "Ganti Gambar" : "Pilih Gambar"}
            </label>
            {preview && (
              <button
                type="button"
                onClick={remove}
                className="text-sm text-rust-700 hover:underline underline-offset-4"
              >
                Hapus
              </button>
            )}
          </div>

          <p className="mt-2.5 text-xs text-ink-muted">
            JPG, PNG, atau WebP. Maksimal 5 MB. Kosong berarti memakai latar bawaan.
          </p>
          {uploading && <p className="mt-1.5 text-sm text-ink-muted">Mengunggah…</p>}
          {error && <p className="mt-1.5 text-sm text-rust-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}
