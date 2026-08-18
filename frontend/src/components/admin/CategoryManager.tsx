"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { createCategory, deleteCategory, renameCategory } from "@/lib/categoryActions";
import { inputClass } from "@/components/educator/fields";
import { cn } from "@/lib/cn";

export interface CategoryRow {
  slug: string;
  label: string;
  courseCount: number;
}

type Status = { kind: "idle" } | { kind: "ok"; msg: string } | { kind: "err"; msg: string };

export default function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [asking, setAsking] = useState<CategoryRow | null>(null);

  function run(action: () => Promise<{ ok: boolean } & Record<string, unknown>>) {
    setStatus({ kind: "idle" });
    startTransition(async () => {
      const result = await action();
      setStatus(
        result.ok
          ? { kind: "ok", msg: String(result.message) }
          : { kind: "err", msg: String(result.error) },
      );
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {status.kind !== "idle" && (
        <p
          role="status"
          className={cn(
            "rounded-lg px-4 py-3 text-sm border",
            status.kind === "ok"
              ? "bg-blue-50 text-blue-700 border-blue-100"
              : "bg-rust-100 text-rust-700 border-rust-700/25",
          )}
        >
          {status.msg}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          run(async () => {
            const r = await createCategory(name);
            if (r.ok) setName("");
            return r;
          });
        }}
        className="bg-paper-card border border-rule rounded-2xl p-6"
      >
        <h2 className="t-h3 text-base mb-1.5">Tambah kategori</h2>
        <p className="text-sm text-ink-muted mb-4">
          Langsung bisa dipilih educator saat membuat atau menyunting kursus.
        </p>

        <div className="flex flex-wrap gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kecerdasan Buatan"
            className={cn(inputClass, "max-w-sm")}
            required
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0"
          >
            Tambah
          </button>
        </div>
      </form>

      <div className="bg-paper-card border border-rule rounded-2xl overflow-hidden">
        <ul className="divide-y divide-rule">
          {categories.map((c) => (
            <li key={c.slug} className="flex flex-wrap items-center gap-4 px-6 py-4">
              {editing === c.slug ? (
                <>
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className={cn(inputClass, "max-w-xs")}
                    autoFocus
                  />
                  <button
                    onClick={() =>
                      run(async () => {
                        const r = await renameCategory(c.slug, editLabel);
                        if (r.ok) setEditing(null);
                        return r;
                      })
                    }
                    disabled={pending}
                    className="text-sm font-medium text-blue-700 hover:underline underline-offset-4"
                  >
                    Simpan
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="text-sm text-ink-muted hover:text-ink"
                  >
                    Batal
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 min-w-[10rem]">
                    <span className="block text-sm font-medium text-ink">{c.label}</span>
                    <span className="block text-xs text-ink-muted">
                      {c.slug} · {c.courseCount} kursus
                    </span>
                  </span>

                  <button
                    onClick={() => {
                      setEditing(c.slug);
                      setEditLabel(c.label);
                    }}
                    className="text-sm text-blue-700 hover:underline underline-offset-4"
                  >
                    Ubah nama
                  </button>

                  {/* Kategori yang masih dipakai tidak bisa dihapus — kursusnya
                      akan menyimpan kategori yang tidak ada lagi, hilang dari
                      filter, dan gagal setiap kali educator menyimpannya. */}
                  <button
                    onClick={() => setAsking(c)}
                    disabled={pending || c.courseCount > 0}
                    title={c.courseCount > 0 ? "Masih dipakai kursus" : undefined}
                    className="text-sm text-rust-700 hover:underline underline-offset-4 disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    Hapus
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      <ConfirmDialog
        open={asking !== null}
        title="Hapus kategori ini?"
        description={`"${asking?.label ?? ""}" akan hilang dari pilihan educator dan dari filter katalog.`}
        confirmLabel="Ya, Hapus"
        onConfirm={() => {
          const target = asking;
          setAsking(null);
          if (target) run(() => deleteCategory(target.slug));
        }}
        onCancel={() => setAsking(null)}
      />
    </div>
  );
}
