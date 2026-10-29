"use client";
import { useRef, useState } from "react";
import Model3DStage from "@/components/classes/model3d/Model3DStage";
import GerbangModel3D from "@/components/classes/model3d/GerbangModel3D";
import type { TitikTambah } from "@/components/classes/model3d/Model3DScene";
import { MAX_CLASS_FILE_BYTES } from "@/lib/classAssignmentRules";
import {
  MAX_ANOTASI,
  MAX_JUDUL_ANOTASI,
  MAX_JUDUL_MODEL,
  judulDariNama,
  MAX_TEKS_ANOTASI,
  galatBerkasModel,
  idAnotasiBaru,
  type Anotasi3D,
  type BerkasModel3D,
} from "@/lib/model3dRules";
import { formatBytes } from "@/lib/videoEmbed";
import { cn } from "@/lib/cn";

/**
 * Isian objek 3D di formulir pengumuman.
 *
 * `file` = berkas baru yang belum diunggah (diunggah saat formulir dikirim,
 * seperti lampiran lain); `lama` = berkas yang sudah tersimpan di postingan
 * (hanya saat edit). Salah satunya terisi selama objek ada.
 */
export interface IsianModel3D {
  file: File | null;
  /** URL objek untuk `file` — dibuat saat dipilih, dilepas lewat `bebaskanModel`. */
  url: string | null;
  lama: BerkasModel3D | null;
  /** Judul gerbang yang dilihat murid. */
  title: string;
  annotations: Anotasi3D[];
}

/** Melepas memori berkas yang dipilih. Dipanggil saat dibuang/diganti/formulir direset. */
export function bebaskanModel(n: IsianModel3D | null): void {
  if (n?.url) URL.revokeObjectURL(n.url);
}

const KOLOM =
  "block w-full bg-white/[0.06] px-3 py-2 text-sm text-ink placeholder:text-ink-muted outline-none " +
  "shadow-[inset_0_-2px_0_transparent] focus:shadow-[inset_0_-2px_0_var(--color-blue-500)] disabled:opacity-60";

export default function LampiranModel3D({
  nilai,
  ubah,
  hrefLama,
  disabled,
}: {
  nilai: IsianModel3D | null;
  ubah: (n: IsianModel3D | null) => void;
  /** Alamat penyaji berkas tersimpan (untuk `lama`). */
  hrefLama?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [tab, setTab] = useState<"sunting" | "pratinjau">("sunting");
  const [terpilih, setTerpilih] = useState<string | null>(null);

  function pilihBerkas(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const salah = galatBerkasModel(f, MAX_CLASS_FILE_BYTES);
    if (salah) return setGalat(salah);

    if (nilai && nilai.annotations.length > 0) {
      const lanjut = window.confirm(
        "Mengganti berkas akan menghapus semua keterangan karena posisinya terikat pada model lama. Lanjutkan?",
      );
      if (!lanjut) return;
    }
    bebaskanModel(nilai);
    setGalat(null);
    setTerpilih(null);
    setTab("sunting");
    ubah({ file: f, url: URL.createObjectURL(f), lama: null, title: judulDariNama(f.name), annotations: [] });
  }

  function buang() {
    bebaskanModel(nilai);
    setGalat(null);
    setTerpilih(null);
    ubah(null);
  }

  function tambah(t: TitikTambah) {
    if (!nilai) return;
    if (nilai.annotations.length >= MAX_ANOTASI) {
      return setGalat(`Maksimal ${MAX_ANOTASI} keterangan per objek.`);
    }
    const sudah = nilai.annotations.find((a) => a.mesh === t.mesh);
    if (sudah) {
      setTerpilih(sudah.id);
      return setGalat("Komponen itu sudah punya keterangan. Sunting keterangannya di daftar di bawah.");
    }
    setGalat(null);
    const id = idAnotasiBaru(nilai.annotations.map((a) => a.id));
    // Judul awal = nama komponen, supaya keterangan baru langsung sah dan
    // pengajar tinggal menggantinya.
    const awal = (t.meshName || `Keterangan ${nilai.annotations.length + 1}`).replace(/[_]+/g, " ").trim().slice(0, MAX_JUDUL_ANOTASI);
    ubah({ ...nilai, annotations: [...nilai.annotations, { id, title: awal, text: "", ...t }] });
    setTerpilih(id);
  }

  function ubahAnotasi(id: string, patch: Partial<Pick<Anotasi3D, "title" | "text">>) {
    if (!nilai) return;
    ubah({ ...nilai, annotations: nilai.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  }

  function hapusAnotasi(id: string) {
    if (!nilai) return;
    ubah({ ...nilai, annotations: nilai.annotations.filter((a) => a.id !== id) });
    if (terpilih === id) setTerpilih(null);
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".glb,model/gltf-binary"
      className="hidden"
      onChange={(e) => {
        pilihBerkas(e.target.files);
        e.target.value = "";
      }}
    />
  );

  if (!nilai) {
    return (
      <div>
        {input}
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-body transition-colors duration-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
          Lampirkan objek 3D (.glb)
        </button>
        <span className="ml-3 text-xs text-ink-muted">Murid bisa memutar, zoom, dan membaca keterangan tiap komponen</span>
        {galat && (
          <p role="alert" className="mt-2 text-sm text-rust-700">
            {galat}
          </p>
        )}
      </div>
    );
  }

  const src = nilai.file ? nilai.url : (hrefLama ?? null);
  const nama = nilai.file?.name ?? nilai.lama?.name ?? "model.glb";
  const ukuran = nilai.file?.size ?? nilai.lama?.size ?? 0;

  return (
    <div className="bg-white/[0.04] p-4">
      {input}

      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-3">
        <span className="w-11 shrink-0 text-center text-[10px] font-bold uppercase tracking-wide text-blue-700">3D</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{nama}</span>
        {ukuran > 0 && <span className="shrink-0 text-xs text-ink-muted">{formatBytes(ukuran)}</span>}
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="shrink-0 text-xs font-medium text-ink-muted transition-colors hover:text-blue-700 disabled:opacity-50"
        >
          Ganti berkas
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={buang}
          className="shrink-0 text-xs font-medium text-ink-muted transition-colors hover:text-rust-700 disabled:opacity-50"
        >
          Buang objek 3D
        </button>
      </div>

      <div className="mb-4">
        <label htmlFor="judul-model3d" className="mb-1 block text-sm font-medium text-ink">
          Judul objek 3D
        </label>
        <input
          id="judul-model3d"
          value={nilai.title}
          onChange={(e) => ubah({ ...nilai, title: e.target.value })}
          maxLength={MAX_JUDUL_MODEL}
          disabled={disabled}
          placeholder="Mis. Anatomi mesin diesel"
          className={cn(KOLOM, "font-medium")}
        />
        <p className="mt-1 text-xs text-ink-muted">Murid mengeklik judul ini untuk membuka objeknya.</p>
      </div>

      <div role="tablist" aria-label="Mode objek 3D" className="mb-3 inline-flex bg-white/[0.06] p-1">
        {(
          [
            { id: "sunting", label: "Sunting keterangan" },
            { id: "pratinjau", label: "Pratinjau" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-1.5 text-sm font-semibold transition-colors duration-200",
              tab === t.id ? "bg-blue-600 text-white" : "text-ink-body hover:text-blue-700",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {src && tab === "sunting" && (
        <Model3DStage
          // Berkas berbeda = panggung baru (konteks WebGL & pilihan bersih).
          key={src}
          url={src}
          nama={nama}
          annotations={nilai.annotations}
          mode="sunting"
          selectedId={terpilih}
          onSelect={setTerpilih}
          onAdd={tambah}
        />
      )}

      {/* Pratinjau = gerbang yang sama persis dengan yang dilihat murid di umpan. */}
      {src && tab === "pratinjau" && (
        <GerbangModel3D
          key={src}
          url={src}
          nama={nama}
          judul={nilai.title.trim() || judulDariNama(nama)}
          annotations={nilai.annotations}
        />
      )}

      {tab === "pratinjau" && (
        <p className="mt-3 text-xs leading-[1.6] text-ink-muted">
          Ini tampilan yang dilihat murid: klik judul untuk membuka gerbang, lalu klik titik bercahaya atau komponen berketerangan untuk memunculkan hologramnya. Komponen tanpa keterangan tidak bisa disentuh murid.
          {nilai.annotations.length === 0 && " Belum ada keterangan - tambahkan di tab Sunting."}
        </p>
      )}

      {tab === "sunting" && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink">Keterangan komponen</p>
            <span className="text-xs text-ink-muted">
              {nilai.annotations.length}/{MAX_ANOTASI}
            </span>
          </div>

          {nilai.annotations.length === 0 ? (
            <p className="bg-white/[0.04] px-4 py-5 text-sm leading-[1.7] text-ink-muted">
              Putar objek lalu klik bagian yang ingin dijelaskan. Titik bercahaya akan muncul di sana, dan di sini Anda
              menulis judul serta penjelasannya.
            </p>
          ) : (
            <ul className="space-y-2">
              {nilai.annotations.map((a, i) => (
                <li
                  key={a.id}
                  className={cn(
                    "bg-white/[0.04] p-3 transition-colors",
                    a.id === terpilih && "bg-white/[0.09] shadow-[inset_3px_0_0_var(--color-blue-500)]",
                  )}
                  onClick={() => setTerpilih(a.id)}
                >
                  <div className="mb-2 flex min-w-0 items-center gap-3">
                    <span className="w-7 shrink-0 text-[11px] font-bold tracking-wider text-blue-700">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">
                      Komponen: {a.meshName || "tanpa nama"}
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        hapusAnotasi(a.id);
                      }}
                      className="shrink-0 text-xs font-medium text-ink-muted transition-colors hover:text-rust-700 disabled:opacity-50"
                    >
                      Hapus
                    </button>
                  </div>
                  <label className="sr-only" htmlFor={`an-j-${a.id}`}>
                    Judul keterangan {i + 1}
                  </label>
                  <input
                    id={`an-j-${a.id}`}
                    value={a.title}
                    onChange={(e) => ubahAnotasi(a.id, { title: e.target.value })}
                    maxLength={MAX_JUDUL_ANOTASI}
                    disabled={disabled}
                    placeholder="Judul (mis. Katup masuk)"
                    className={cn(KOLOM, "font-medium")}
                  />
                  <label className="sr-only" htmlFor={`an-t-${a.id}`}>
                    Penjelasan keterangan {i + 1}
                  </label>
                  <textarea
                    id={`an-t-${a.id}`}
                    value={a.text}
                    onChange={(e) => ubahAnotasi(a.id, { text: e.target.value })}
                    maxLength={MAX_TEKS_ANOTASI}
                    rows={2}
                    disabled={disabled}
                    placeholder="Penjelasan komponen ini (opsional)"
                    className={cn(KOLOM, "mt-2 resize-y leading-[1.6]")}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {galat && (
        <p role="alert" className="mt-3 text-sm text-rust-700">
          {galat}
        </p>
      )}
    </div>
  );
}
