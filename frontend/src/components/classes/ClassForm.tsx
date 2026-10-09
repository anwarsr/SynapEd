"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label, inputClass } from "@/components/educator/fields";
import { createClass, updateClass } from "@/lib/classActions";
import { MAX_CLASS_DESC, MAX_CLASS_NAME } from "@/lib/classTypes";
import { cn } from "@/lib/cn";

/**
 * Satu formulir untuk membuat dan mengubah kelas.
 *
 * Dua formulir terpisah akan berbeda pelan-pelan — batas panjang di satu sisi
 * diubah, sisi lain tertinggal — dan yang tertinggal itulah yang menolak
 * masukan tanpa alasan yang terlihat.
 */
export default function ClassForm({
  kelas,
}: {
  kelas?: { id: string; name: string; description: string };
}) {
  const router = useRouter();
  const [name, setName] = useState(kelas?.name ?? "");
  const [description, setDescription] = useState(kelas?.description ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);

    startTransition(async () => {
      const res = kelas
        ? await updateClass(kelas.id, name, description)
        : await createClass(name, description);

      if (!res.ok) return setError(res.error);

      setDone(res.message);
      if (!kelas) {
        setName("");
        setDescription("");
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="bg-paper-card p-6">
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
          "mt-5 bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white",
          "transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5",
          "disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed",
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
