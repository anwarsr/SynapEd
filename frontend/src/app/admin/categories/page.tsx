import AdminShell from "@/components/admin/AdminShell";
import CategoryManager, { type CategoryRow } from "@/components/admin/CategoryManager";
import { countCoursesInCategory, listCategories } from "@/lib/categories";
import { adminBadges } from "@/lib/adminBadges";
import { requireAdmin } from "@/lib/firebase/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kategori – Panel Admin SynapEd" };

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const admin = await requireAdmin("/admin/categories");

  const [categories, badges] = await Promise.all([listCategories(), adminBadges()]);

  // Jumlah kursus per kategori dipakai untuk menonaktifkan tombol hapus.
  // Kategorinya sedikit, jadi satu hitungan per kategori masih murah.
  const rows: CategoryRow[] = await Promise.all(
    categories.map(async (c) => ({
      slug: c.slug,
      label: c.label,
      courseCount: await countCoursesInCategory(c.slug),
    })),
  );

  return (
    <AdminShell user={admin} badges={badges}>
      <div className="container-reading">
        <h1 className="t-h2 mb-3">
          Kategori <span className="mark">kursus</span>
        </h1>
        <p className="t-body text-ink-muted mb-10">
          {rows.length} kategori. Educator memilih dari daftar ini saat membuat kursus.
        </p>

        <CategoryManager categories={rows} />
      </div>
    </AdminShell>
  );
}
