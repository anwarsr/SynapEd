/**
 * Menguji pembayaran QRIS manual (Pedagang Bima) dari ujung ke ujung.
 *
 * Jalur ini tidak punya webhook bertanda tangan seperti Midtrans, jadi yang
 * membuka akses adalah keputusan admin. Karena itu yang paling keras diuji di
 * sini bukan "apakah bisa membeli", melainkan siapa yang TIDAK bisa:
 *
 *   - bukan admin tidak bisa membuka akses siapa pun
 *   - bukan pemilik pesanan tidak bisa menitipkan bukti ke pesanan orang lain
 *   - browser tidak bisa menentukan nominal
 *   - saklar mati berarti ditolak DI SERVER, bukan sekadar panelnya hilang
 *
 * Butuh dev server berjalan (npm run dev).
 *
 *   npx tsx scripts/verify-manual-payment.ts [baseUrl]
 */
import { randomUUID } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  BASE,
  actionId,
  app,
  auth,
  callAction,
  check,
  createTestUser,
  finish,
  probe,
  probeText,
  readEnv,
  type TestUser,
} from "./testSupport";
import { targetLabel } from "./project";

const db = getFirestore(app);
const bucket = getStorage(app).bucket(readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"));

const COURSE_ROUTE = "courses/[slug]";
const ADMIN_ROUTE = "admin/payments";
const HARGA = 150_000;

const QRIS_PATH = `payment-qris/verify-${randomUUID().slice(0, 8)}.png`;

/** PNG 1x1 — cukup untuk berkas yang keberadaannya saja yang diuji. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function courseDoc(slug: string, ownerUid: string, price: number) {
  const now = new Date().toISOString();
  return {
    slug,
    title: `Kursus Uji Bayar ${slug.slice(-6)}`,
    shortDesc: "Dibuat oleh verify-manual-payment, akan dihapus.",
    longDesc: "x",
    level: "Pemula",
    levelColor: "green",
    category: "neuroscience",
    icon: "reading",
    tint: "bg-blue-50",
    duration: "1 Jam",
    rating: 0,
    reviews: 0,
    ratingSum: 0,
    price,
    thumbnail: null,
    enrolledStudents: 0,
    lastUpdated: now,
    instructorName: "Uji Pemilik",
    instructorBio: "",
    whatYouLearn: [],
    requirements: [],
    visibility: "public",
    sections: [
      {
        title: "Bagian Awal",
        position: 0,
        lessons: [
          { slug: "satu", title: "Satu", type: "reading", duration: "5 Menit", position: 0 },
        ],
      },
    ],
    order: 9999,
    ownerUid,
    ownerName: "Uji Pemilik",
    createdAt: now,
  };
}

async function setSaklar(midtrans: boolean, manual: boolean, qris: string | null) {
  await db.collection("settings").doc("payments").set(
    {
      midtransEnabled: midtrans,
      manualQrisEnabled: manual,
      qrisImagePath: qris,
      qrisNote: "Uji otomatis.",
      updatedAt: new Date().toISOString(),
      updatedByUid: "verify",
    },
    { merge: true },
  );
}

async function orderOf(uid: string, slug: string) {
  const snap = await db
    .collection("orders")
    .where("uid", "==", uid)
    .where("courseSlug", "==", slug)
    .get();
  return snap.docs.map((d) => d.data());
}

async function run(owner: TestUser, pembeli: TestUser, lain: TestUser, admin: TestUser) {
  const slug = `verify-bayar-${randomUUID().slice(0, 8)}`;
  const gratis = `verify-gratis-${randomUUID().slice(0, 8)}`;

  await db.collection("courses").doc(slug).set(courseDoc(slug, owner.uid, HARGA));
  await db.collection("courses").doc(gratis).set(courseDoc(gratis, owner.uid, 0));
  await bucket.file(QRIS_PATH).save(PNG, { contentType: "image/png" });

  try {
    await probe(`/courses/${slug}`, pembeli.cookie);
    await probe("/admin/payments", admin.cookie);

    const path = `/courses/${slug}`;
    const buatId = await actionId(COURSE_ROUTE, "createManualOrder");
    const kirimId = await actionId(COURSE_ROUTE, "submitPaymentProof");
    const putusId = await actionId(ADMIN_ROUTE, "decideManualOrder");
    const setelanId = await actionId(ADMIN_ROUTE, "updatePaymentSettings");

    // ── Saklar mati: ditolak DI SERVER ─────────────────────────────
    {
      await setSaklar(true, false, QRIS_PATH);

      const mati = await callAction(path, buatId, [slug], pembeli.cookie);
      check(
        "saklar manual mati -> ditolak server, bukan sekadar panel disembunyikan",
        mati.includes("tidak tersedia"),
        "penjaga di createManualOrder",
      );

      const halaman = await probeText(`/courses/${slug}`, pembeli.cookie);
      check(
        "panel QRIS juga tidak dirender saat saklarnya mati",
        !halaman.html.includes("Bayar dengan QRIS"),
        "yang terlihat sejalan dengan penjaganya",
      );

      check("belum ada pesanan yang tercipta", (await orderOf(pembeli.uid, slug)).length === 0, "Firestore");
    }

    // ── Saklar menyala tapi tanpa gambar QRIS ──────────────────────
    {
      await setSaklar(true, true, null);
      const tanpaQr = await callAction(path, buatId, [slug], pembeli.cookie);
      check(
        "menyala tanpa gambar QRIS tetap ditolak — pembeli tidak disuruh bayar ke ketiadaan",
        tanpaQr.includes("tidak tersedia"),
        "manualQrisReady()",
      );
    }

    await setSaklar(true, true, QRIS_PATH);

    // ── Penjaga dasar pembuatan pesanan ────────────────────────────
    {
      const anon = await callAction(path, buatId, [slug]);
      check("anonim tidak bisa membuat pesanan", anon.includes("masuk terlebih dahulu"), "penjaga sesi");

      await probe(`/courses/${gratis}`, pembeli.cookie);
      const kursusGratis = await callAction(`/courses/${gratis}`, buatId, [gratis], pembeli.cookie);
      check(
        "kursus gratis ditolak dari jalur bayar",
        kursusGratis.includes("gratis"),
        "jalurnya enrollFree",
      );
    }

    // ── Pesanan dibuat, nominal dari server ────────────────────────
    let orderId = "";
    {
      const out = await callAction(path, buatId, [slug], pembeli.cookie);
      check("pesanan manual terbuat", out.includes("Pesanan dibuat"), "pesan hasil");

      const pesanan = await orderOf(pembeli.uid, slug);
      check("tepat satu dokumen pesanan", pesanan.length === 1, `${pesanan.length} dokumen`);

      const o = pesanan[0];
      orderId = o.orderId as string;

      check("nominal diambil dari dokumen kursus", o.amount === HARGA, `amount=${o.amount}`);
      check("metode ditandai manual", o.method === "manual", `method=${o.method}`);
      check("status menunggu pembayaran", o.status === "pending", `status=${o.status}`);

      // Dipanggil dua kali: pesanan yang masih hidup harus dipakai ulang.
      const lagi = await callAction(path, buatId, [slug], pembeli.cookie);
      check("panggilan kedua memakai ulang pesanan", lagi.includes("melanjutkan") || lagi.includes("Melanjutkan"), "pesan hasil");
      check(
        "tidak ada pesanan kedua yang tercipta",
        (await orderOf(pembeli.uid, slug)).length === 1,
        "cegah antrean admin dipenuhi duplikat",
      );
    }

    // ── Bukti bayar ────────────────────────────────────────────────
    const buktiPembeli = `payment-proofs/${pembeli.uid}/${orderId}-bukti.png`;
    const buktiLain = `payment-proofs/${lain.uid}/${orderId}-bukti.png`;
    await bucket.file(buktiPembeli).save(PNG, { contentType: "image/png" });
    await bucket.file(buktiLain).save(PNG, { contentType: "image/png" });

    {
      const olehLain = await callAction(path, kirimId, [orderId, buktiLain, "x"], lain.cookie);
      check(
        "orang lain tidak bisa mengirim bukti ke pesanan bukan miliknya",
        olehLain.includes("bukan pesanan Anda"),
        "penjaga kepemilikan",
      );

      // Pemilik pesanan, tapi menunjuk berkas di folder orang lain.
      const folderOrang = await callAction(path, kirimId, [orderId, buktiLain, "x"], pembeli.cookie);
      check(
        "bukti di folder orang lain ditolak walau pemanggilnya pemilik pesanan",
        folderOrang.includes("tidak sah"),
        "awalan path diperiksa ulang di server",
      );

      const ok = await callAction(
        path,
        kirimId,
        [orderId, buktiPembeli, "Transfer 14.05"],
        pembeli.cookie,
      );
      check("pemilik pesanan berhasil mengirim bukti", ok.includes("Menunggu konfirmasi"), "pesan hasil");

      const o = (await orderOf(pembeli.uid, slug))[0];
      check("status menjadi menunggu tinjauan", o.status === "awaiting_review", `status=${o.status}`);
      check("catatan pembeli tersimpan", o.payerNote === "Transfer 14.05", `payerNote=${o.payerNote}`);
      check(
        "AKSES BELUM TERBUKA hanya karena bukti diunggah",
        !(await db.collection("enrollments").doc(`${pembeli.uid}_${slug}`).get()).exists,
        "inilah inti jalur ini",
      );
    }

    // ── Bukti bayar tidak bocor ────────────────────────────────────
    {
      const url = `/api/payments/proof?orderId=${encodeURIComponent(orderId)}`;

      const anon = await probe(url);
      check("anonim tidak bisa mengambil bukti bayar", anon.status === 401, `HTTP ${anon.status}`);

      const pihakKetiga = await probe(url, lain.cookie);
      check("pihak ketiga ditolak", pihakKetiga.status === 403, `HTTP ${pihakKetiga.status}`);

      const olehAdmin = await probe(url, admin.cookie);
      check("admin bisa melihat bukti", olehAdmin.status === 200, `HTTP ${olehAdmin.status}`);

      const olehPemilik = await probe(url, pembeli.cookie);
      check("pembeli bisa melihat buktinya sendiri", olehPemilik.status === 200, `HTTP ${olehPemilik.status}`);
    }

    // ── Keputusan ──────────────────────────────────────────────────
    {
      const bukanAdmin = await callAction("/admin/payments", putusId, [orderId, "approve", ""], pembeli.cookie);
      check(
        "bukan admin tidak bisa membuka akses",
        bukanAdmin.includes("Hanya admin"),
        "penjaga peran",
      );
      check(
        "tidak ada enrollment yang tertulis",
        !(await db.collection("enrollments").doc(`${pembeli.uid}_${slug}`).get()).exists,
        "Firestore",
      );

      const tanpaAlasan = await callAction("/admin/payments", putusId, [orderId, "reject", "ok"], admin.cookie);
      check("menolak tanpa alasan ditolak", tanpaAlasan.includes("minimal 10 karakter"), "alasan wajib");

      const setuju = await callAction(
        "/admin/payments",
        putusId,
        [orderId, "approve", "Cocok dengan mutasi 14.05."],
        admin.cookie,
      );
      check("admin menyetujui pembayaran", setuju.includes("akses dibuka"), "pesan hasil");

      const e = (await db.collection("enrollments").doc(`${pembeli.uid}_${slug}`).get()).data();
      check("enrollment tertulis", Boolean(e), "Firestore");
      check("sumbernya paid", e?.source === "paid", `source=${e?.source}`);
      check("orderId tercatat di enrollment", e?.orderId === orderId, `orderId=${e?.orderId}`);
      check("pricePaid = harga kursus", e?.pricePaid === HARGA, `pricePaid=${e?.pricePaid}`);

      const o = (await orderOf(pembeli.uid, slug))[0];
      check("pesanan menjadi paid", o.status === "paid", `status=${o.status}`);

      const c = (await db.collection("courses").doc(slug).get()).data();
      check("jumlah peserta naik jadi 1", c?.enrolledStudents === 1, `enrolledStudents=${c?.enrolledStudents}`);
    }

    // ── Idempoten ──────────────────────────────────────────────────
    {
      for (let i = 0; i < 2; i++) {
        await callAction("/admin/payments", putusId, [orderId, "approve", "ulang"], admin.cookie);
      }
      const c = (await db.collection("courses").doc(slug).get()).data();
      check(
        "menyetujui berulang TIDAK menambah jumlah peserta",
        c?.enrolledStudents === 1,
        `enrolledStudents=${c?.enrolledStudents}`,
      );
    }

    // ── Penolakan tidak membuka akses ──────────────────────────────
    {
      const slug2 = `verify-tolak-${randomUUID().slice(0, 8)}`;
      await db.collection("courses").doc(slug2).set(courseDoc(slug2, owner.uid, HARGA));
      await probe(`/courses/${slug2}`, lain.cookie);

      await callAction(`/courses/${slug2}`, buatId, [slug2], lain.cookie);
      const o2 = (await orderOf(lain.uid, slug2))[0];
      const bukti2 = `payment-proofs/${lain.uid}/${o2.orderId}-b.png`;
      await bucket.file(bukti2).save(PNG, { contentType: "image/png" });
      await callAction(`/courses/${slug2}`, kirimId, [o2.orderId, bukti2, ""], lain.cookie);

      const tolak = await callAction(
        "/admin/payments",
        putusId,
        [o2.orderId, "reject", "Tidak ditemukan di mutasi."],
        admin.cookie,
      );
      check("admin menolak pembayaran", tolak.includes("ditolak"), "pesan hasil");

      check(
        "penolakan TIDAK membuka akses",
        !(await db.collection("enrollments").doc(`${lain.uid}_${slug2}`).get()).exists,
        "Firestore",
      );

      const setelah = (await orderOf(lain.uid, slug2))[0];
      check("pesanan menjadi failed", setelah.status === "failed", `status=${setelah.status}`);

      await db.collection("courses").doc(slug2).delete().catch(() => undefined);
      for (const d of (await db.collection("orders").where("courseSlug", "==", slug2).get()).docs) {
        await d.ref.delete().catch(() => undefined);
      }
    }

    // ── Setelan hanya boleh diubah admin ───────────────────────────
    {
      const olehPembeli = await callAction(
        "/admin/payments",
        setelanId,
        [{ midtransEnabled: false, manualQrisEnabled: true, qrisImagePath: QRIS_PATH, qrisNote: "" }],
        pembeli.cookie,
      );
      check(
        "bukan admin tidak bisa mengubah setelan pembayaran",
        olehPembeli.includes("Hanya admin"),
        "penjaga peran",
      );

      // Path di luar folder QRIS harus ditolak — kalau lolos, berkas apa pun
      // di bucket (termasuk bukti bayar orang) bisa disiarkan di halaman kursus.
      const pathNyasar = await callAction(
        "/admin/payments",
        setelanId,
        [
          {
            midtransEnabled: true,
            manualQrisEnabled: true,
            qrisImagePath: buktiPembeli,
            qrisNote: "",
          },
        ],
        admin.cookie,
      );
      check(
        "path QRIS di luar folder payment-qris ditolak",
        pathNyasar.includes("tidak sah"),
        "cegah bukti bayar disiarkan sebagai QRIS",
      );
    }

    // ── Kedua saklar mati ──────────────────────────────────────────
    {
      await setSaklar(false, false, QRIS_PATH);
      const slug3 = `verify-mati-${randomUUID().slice(0, 8)}`;
      await db.collection("courses").doc(slug3).set(courseDoc(slug3, owner.uid, HARGA));

      const halaman = await probeText(`/courses/${slug3}`, lain.cookie);
      check(
        "kedua metode mati -> halaman mengatakannya, bukan menyodorkan tombol buntu",
        halaman.html.includes("Pembayaran sedang tidak tersedia"),
        "keadaan kosong yang jujur",
      );

      await db.collection("courses").doc(slug3).delete().catch(() => undefined);
    }
  } finally {
    await setSaklar(true, false, null);
    for (const s of [slug, gratis]) {
      await db.collection("courses").doc(s).delete().catch(() => undefined);
      for (const c of ["orders", "enrollments"]) {
        const snap = await db.collection(c).where("courseSlug", "==", s).get();
        for (const d of snap.docs) await d.ref.delete().catch(() => undefined);
      }
    }
    await bucket.deleteFiles({ prefix: `payment-proofs/${pembeli.uid}/` }).catch(() => undefined);
    await bucket.deleteFiles({ prefix: `payment-proofs/${lain.uid}/` }).catch(() => undefined);
    await bucket.file(QRIS_PATH).delete().catch(() => undefined);
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const owner = await createTestUser("educator", "bayar-pemilik");
  const pembeli = await createTestUser("user", "bayar-pembeli");
  const lain = await createTestUser("user", "bayar-lain");
  const admin = await createTestUser("admin", "bayar-admin");

  console.log(`pemilik : ${owner.email}`);
  console.log(`pembeli : ${pembeli.email}`);
  console.log(`lain    : ${lain.email}`);
  console.log(`admin   : ${admin.email}\n`);

  try {
    await run(owner, pembeli, lain, admin);
  } finally {
    await auth.deleteUsers([owner.uid, pembeli.uid, lain.uid, admin.uid]);
    console.log("\nakun, kursus & berkas uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
