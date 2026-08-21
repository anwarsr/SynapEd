"use client";
import { formatDuration, parseDuration, unitsFor, type DurationScope } from "@/lib/duration";
import { inputClass } from "./fields";
import { cn } from "@/lib/cn";

/**
 * Angka + satuan, menggantikan kolom teks bebas.
 *
 * Nilai yang mengalir keluar tetap satu string (`"10 Hari"`), jadi pemanggilnya
 * tidak perlu tahu bentuk dalamnya. Yang berubah hanya cara mengisinya:
 * educator mengetik angka, satuannya dipilih.
 *
 * Nilai lama diurai saat dirender, bukan disimpan ulang. Dengan begitu kursus
 * yang durasinya masih "1 Tahun" atau "12" langsung tampil benar di form tanpa
 * menunggu migrasi apa pun berjalan.
 */
export default function DurationField({
  id,
  scope,
  value,
  onChange,
  className,
}: {
  id: string;
  scope: DurationScope;
  /** Bentuk simpanan, mis. "10 Hari". Boleh kosong. */
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  const parsed = parseDuration(value, scope);
  const units = unitsFor(scope);

  // Satuan lama yang sudah tidak ditawarkan (mis. "Tahun") sudah disetarakan
  // oleh parseDuration, jadi yang sampai di sini pasti ada di daftar.
  const unit = units.includes(parsed.unit) ? parsed.unit : units[0];

  // Lebarnya diatur oleh dua pembungkus, BUKAN oleh kelas tambahan pada input
  // dan select-nya sendiri.
  //
  // `inputClass` diawali `w-full`, dan cn() di proyek ini hanya menyambung
  // string — tanpa tailwind-merge. Jadi menulis cn(inputClass, "w-32") membuat
  // `w-full` dan `w-32` sama-sama terpasang, dan yang menang ditentukan urutan
  // di CSS, bukan urutan penulisan. Yang menang ternyata `w-full`: select-nya
  // melebar penuh, menolak menyusut karena shrink-0, dan kolom angkanya
  // tergencet sampai nyaris nol — angkanya tetap ada, hanya tidak muat terlihat.
  //
  // Dengan pembungkus, `w-full` justru berguna: masing-masing memenuhi kotak
  // yang lebarnya sudah ditentukan.
  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      <div className="flex-1 min-w-0">
        <input
          id={id}
          type="number"
          min={1}
          step="any"
          inputMode="numeric"
          value={parsed.value}
          onChange={(e) => onChange(formatDuration(e.target.value, unit))}
          placeholder="Angka"
          className={inputClass}
        />
      </div>

      <div className="w-32 shrink-0">
        <select
          aria-label="Satuan durasi"
          value={unit}
          onChange={(e) => onChange(formatDuration(parsed.value, e.target.value))}
          className={inputClass}
        >
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
