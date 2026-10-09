"use client";
import { useState } from "react";
import type { OpField, OpSpecOf } from "@/lib/lab/labForm";
import { LAB_POINTER_TONES, LAB_TONES, type LabTone } from "@/lib/lab/labTypes";
import { LAB_TONE_LABEL } from "./labTone";
import type { LabGroup } from "./labKit";
import { cn } from "@/lib/cn";

/**
 * Panel operasi terpandu — satu komponen untuk semua lab.
 *
 * Isinya digenerate dari katalog lab yang sedang dibuka: operasi baru di
 * katalog langsung muncul di sini lengkap dengan formnya. Kelompok tampil
 * sebagai tab — satu kelompok utuh, berpindah cukup satu klik tanpa
 * kehilangan posisi gulir di papan sebelah.
 */

const inputClass =
  "w-full bg-white/[0.06] px-3 py-2 text-sm text-white transition-[background-color,box-shadow] duration-200 placeholder:text-white/35 focus:bg-white/10 focus:shadow-[inset_0_-2px_0_var(--color-blue-500)] focus:outline-none focus:ring-2 focus:ring-blue-500/25";

interface Pemilihan {
  /** Nilai isian dari sel terpilih, atau null kalau isian itu tidak berkaitan. */
  isian: (namaIsian: string) => string | null;
  label: string;
}

function Field({
  id,
  field,
  value,
  pilihan,
  onChange,
}: {
  id: string;
  field: OpField;
  value: string;
  pilihan: Pemilihan | null;
  onChange: (v: string) => void;
}) {
  const labelKecil = "text-[11px] font-medium uppercase tracking-wider text-ink-muted";

  if (field.kind === "nada" || field.kind === "penunjukNada") {
    const opsi: readonly string[] = field.kind === "nada" ? LAB_TONES : LAB_POINTER_TONES;
    return (
      <label htmlFor={id} className="block">
        <span className={cn("mb-1 block", labelKecil)}>{field.label}</span>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          {opsi.map((p) => (
            <option key={p} value={p}>
              {field.kind === "nada" ? LAB_TONE_LABEL[p as LabTone] : p}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.kind === "pilihan") {
    return (
      <label htmlFor={id} className={cn("block", (field.opsi?.some((o) => o.label.length > 22) ?? false) && "col-span-full")}>
        <span className={cn("mb-1 block", labelKecil)}>{field.label}</span>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          {(field.opsi ?? []).map((o) => (
            <option key={o.nilai} value={o.nilai}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const dariSel = pilihan?.isian(field.name) ?? null;

  return (
    <label htmlFor={id} className={cn("block", field.kind === "teksBaris" && "col-span-full")}>
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className={labelKecil}>{field.label}</span>
        {dariSel !== null && (
          <button
            type="button"
            onClick={() => onChange(dariSel)}
            className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            title="Isi dari sel yang sedang dipilih di papan"
          >
            pakai {pilihan?.label}
          </button>
        )}
      </span>
      {field.kind === "teksBaris" ? (
        <textarea
          id={id}
          rows={3}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className={cn(inputClass, "resize-y font-mono text-[13px] leading-relaxed")}
        />
      ) : (
        <input
          id={id}
          type={field.kind === "angka" ? "number" : "text"}
          inputMode={field.kind === "angka" ? "numeric" : undefined}
          min={field.min}
          max={field.max}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          className={inputClass}
        />
      )}
    </label>
  );
}

/**
 * Nilai awal form. Isian angka yang tidak bisa diisi dari sel (jumlah, nilai
 * terbesar, benih, jarak geser) langsung diisi contohnya supaya operasinya
 * bisa dijalankan dengan satu klik. Isian yang BISA diisi dari sel dibiarkan
 * kosong: indeks bawaan 0 akan diam-diam menjalankan operasi di elemen
 * pertama tanpa pernah diminta — gantinya ada tombol "pakai sel".
 */
function nilaiAwal(fields: readonly OpField[], bisaDariSel: (nama: string) => boolean): Record<string, string> {
  const awal: Record<string, string> = {};
  for (const f of fields) {
    if (f.kind === "nada") awal[f.name] = LAB_TONES[0];
    else if (f.kind === "penunjukNada") awal[f.name] = LAB_POINTER_TONES[0];
    else if (f.kind === "pilihan") awal[f.name] = f.opsi?.[0]?.nilai ?? "";
    else if (f.kind === "angka" && !bisaDariSel(f.name)) awal[f.name] = f.placeholder ?? "";
    else awal[f.name] = "";
  }
  return awal;
}

function OperasiKartu<K extends string, Op>({
  spec,
  urutan,
  bangun,
  pilihan,
  bisaDariSel,
  onJalan,
}: {
  spec: OpSpecOf<K, string, Op>;
  urutan: number;
  bangun: (kind: K, nilai: Record<string, string>) => Op | null;
  pilihan: Pemilihan | null;
  bisaDariSel: (nama: string) => boolean;
  onJalan: (op: Op) => boolean;
}) {
  const [nilai, setNilai] = useState<Record<string, string>>(() => nilaiAwal(spec.fields, bisaDariSel));
  const [kurang, setKurang] = useState(false);
  const [berhasil, setBerhasil] = useState(0);

  function kirim(e: React.FormEvent) {
    e.preventDefault();
    const op = bangun(spec.kind, nilai);
    if (!op) {
      // Bentuknya belum lengkap (kolom kosong / bukan angka). Domainnya
      // diperiksa reducer, yang punya kalimat jauh lebih menjelaskan.
      setKurang(true);
      return;
    }
    setKurang(false);
    if (onJalan(op)) setBerhasil((b) => b + 1);
  }

  const tanpaIsian = spec.fields.length === 0;

  return (
    <form
      onSubmit={kirim}
      className={cn(
        "lab-fade-up bg-paper-card px-4 py-4",
        "transition-colors duration-200 ease-out-soft",
        "hover:bg-card-hover focus-within:bg-card-hover",
      )}
      style={{ "--d": `${urutan * 45}ms` } as React.CSSProperties}
    >
      <div className={cn("flex gap-3", tanpaIsian ? "items-center" : "items-start")}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{spec.label}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{spec.ringkas}</p>
        </div>
        {tanpaIsian && <JalankanTombol kunci={berhasil} />}
      </div>

      {!tanpaIsian && (
        <>
          <div className={cn("mt-3 grid gap-2.5", spec.fields.length > 1 && "grid-cols-2")}>
            {spec.fields.map((f) => (
              <Field
                key={f.name}
                id={`lab-${spec.kind}-${f.name}`}
                field={f}
                value={nilai[f.name] ?? ""}
                pilihan={pilihan}
                onChange={(v) => setNilai((n) => ({ ...n, [f.name]: v }))}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            {kurang ? <p className="text-xs text-rust-700">Lengkapi dulu isian di atas.</p> : <span />}
            <JalankanTombol kunci={berhasil} />
          </div>
        </>
      )}
    </form>
  );
}

/** Tombol jalankan yang ikonnya berdenyut sekali setiap operasinya berhasil. */
function JalankanTombol({ kunci }: { kunci: number }) {
  return (
    <button
      type="submit"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white",
        "transition-all duration-200 ease-out-soft hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-soft active:translate-y-0",
      )}
    >
      <svg key={kunci} className={cn("h-3.5 w-3.5", kunci > 0 && "lab-pop")} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.34-5.89a1.5 1.5 0 000-2.54L6.3 2.84z" />
      </svg>
      Jalankan
    </button>
  );
}

export default function LabControls<K extends string, Op>({
  katalog,
  grup,
  bangun,
  onJalan,
  pilihan,
  isianSel,
}: {
  katalog: readonly OpSpecOf<K, string, Op>[];
  grup: readonly LabGroup[];
  bangun: (kind: K, nilai: Record<string, string>) => Op | null;
  /** Mengembalikan true kalau operasinya diterima. */
  onJalan: (op: Op) => boolean;
  /** Sel terpilih di papan, untuk tombol "pakai …"; null kalau belum ada. */
  pilihan: Pemilihan | null;
  /** Nama isian yang bisa diisi dari sel terpilih (lihat `LabKit.isianSel`). */
  isianSel: readonly string[];
}) {
  const [aktif, setAktif] = useState(grup[0]?.id ?? "");
  const isi = katalog.filter((s) => s.grup === aktif);
  const judulGrup = grup.find((g) => g.id === aktif)?.label ?? "";

  // Isian mana yang bisa diisi dari sel ditentukan TANPA bergantung pada ada
  // tidaknya pilihan saat ini — kalau tidak, nilai awal form akan berubah
  // tergantung kapan kartunya pertama kali dipasang.
  const bisaDariSel = (nama: string) => isianSel.includes(nama);

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 -mx-1 bg-paper/90 px-1 pb-3 backdrop-blur-md">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="t-h3 text-xl">Operasi</h2>
          <span className="text-xs text-ink-muted">{katalog.length} operasi</span>
        </div>

        <div role="tablist" aria-label="Kelompok operasi" className="mt-3 flex flex-wrap gap-1.5">
          {grup.map((g) => {
            const dipilih = g.id === aktif;
            const jumlah = katalog.filter((s) => s.grup === g.id).length;
            return (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={dipilih}
                onClick={() => setAktif(g.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                  "transition-all duration-200 ease-out-soft",
                  dipilih
                    ? "bg-blue-600 text-white"
                    : "bg-white/10 text-white/80 hover:bg-white/15 hover:text-white",
                )}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={g.ikon} />
                </svg>
                {g.label}
                <span className={cn("tabular-nums", dipilih ? "text-white/70" : "text-ink-faint")}>{jumlah}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Kunci = kelompok: berganti tab memasang ulang daftarnya, jadi kartu
          muncul bertingkat lagi alih-alih berganti diam-diam. */}
      <div key={aktif} role="tabpanel" aria-label={judulGrup} className="space-y-2.5 pb-4">
        {isi.map((spec, i) => (
          <OperasiKartu
            key={spec.kind}
            spec={spec}
            urutan={i}
            bangun={bangun}
            pilihan={pilihan}
            bisaDariSel={bisaDariSel}
            onJalan={onJalan}
          />
        ))}
      </div>
    </div>
  );
}
