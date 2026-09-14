/**
 * Menguji sistem royalti: pembagian hasil di dokumen kursus, lalu (langkah
 * berikutnya) pencatatan uangnya.
 *
 * Yang paling keras diuji di bagian kontributor:
 *   - jatah pemilik SELALU dihitung server — POST mentah "pemilik 100% +
 *     kontributor 50%" tidak pernah tersimpan;
 *   - hanya pemilik (atau admin) yang bisa mengusulkan pembagian;
 *   - pengajuan lama yang dibuat sebelum fitur ini, saat disetujui, TIDAK
 *     menghapus pembagian yang sudah ada.
 *
 * Butuh dev server berjalan (npm run dev).
 *
 *   npx tsx scripts/verify-royalty.ts [baseUrl]
 */
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { getFirestore } from "firebase-admin/firestore";
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
  signIn,
  type TestUser,
} from "./testSupport";
import { resolveProjectId, targetLabel } from "./project";

const db = getFirestore(app);

const NEW_ROUTE = "educator/courses/new";
const EDIT_ROUTE = "educator/courses/[slug]/edit";
const DECIDE_ROUTE = "admin/course-requests/[id]";

const slugs: string[] = [];
const users: string[] = [];

async function user(role: "admin" | "educator" | "user", tag: string, name?: string) {
  const u = await createTestUser(role, tag);
  users.push(u.uid);
  if (name) await auth.updateUser(u.uid, { displayName: name });
  return u;
}

function courseInput(overrides: Record<string, unknown> = {}) {
  return {
    title: `Kursus Uji Royalti ${randomUUID().slice(0, 4)}`,
    shortDesc: "Kursus contoh yang dibuat verify-royalty.",
    longDesc: "",
    level: "Pemula",
    category: "neuroscience",
    duration: "1 jam",
    price: 100000,
    passingGrade: 70,
    thumbnail: null,
    whatYouLearn: [],
    requirements: [],
    sections: [
      { title: "Bagian Awal", lessons: [{ title: "Satu", type: "reading", duration: "5 menit" }] },
    ],
    ...overrides,
  };
}

async function courseData(slug: string) {
  return (await db.collection("courses").doc(slug).get()).data() ?? {};
}

async function ownedSlugs(uid: string): Promise<string[]> {
  const q = await db.collection("courses").where("ownerUid", "==", uid).get();
  return q.docs.map((d) => d.id);
}

async function pendingRequest(slug: string) {
  const q = await db
    .collection("courseChangeRequests")
    .where("courseSlug", "==", slug)
    .get();
  return q.docs.find((d) => d.get("status") === "pending") ?? null;
}

const shares = (d: Record<string, unknown>) =>
  JSON.stringify((d.contributors as { uid: string; share: number }[] | undefined) ?? null);

async function run() {
  const admin = await user("admin", "royalti-admin");
  const pemilik = await user("educator", "royalti-pemilik", "Andi Pemilik");
  const educatorLain = await user("educator", "royalti-lain");
  const kolaborator = await user("user", "royalti-kolab", "Budi Kolaborator");
  const kolaborator2 = await user("user", "royalti-kolab2", "Citra Kolaborator");

  await probe("/educator/courses/new", pemilik.cookie);
  const createId = await actionId(NEW_ROUTE, "createCourse");

  // ── Membuat kursus dengan kontributor ─────────────────────────────────
  let slug = "";
  {
    const out = await callAction(
      "/educator/courses/new",
      createId,
      [courseInput({ contributors: [{ uid: kolaborator.uid, share: 30 }] })],
      pemilik.cookie,
    );
    check("kursus dengan kontributor dibuat", out.includes("berhasil dibuat"), out.slice(0, 80));

    slug = (await ownedSlugs(pemilik.uid))[0] ?? "";
    slugs.push(slug);
    const d = await courseData(slug);
    check(
      "pembagian tersimpan, jatah pemilik = sisa",
      shares(d) === JSON.stringify([{ uid: pemilik.uid, share: 70 }, { uid: kolaborator.uid, share: 30 }]),
      shares(d),
    );
    check(
      "contributorUids ikut tersimpan untuk kueri dashboard",
      JSON.stringify(d.contributorUids) === JSON.stringify([pemilik.uid, kolaborator.uid]),
      JSON.stringify(d.contributorUids),
    );
  }

  // ── POST mentah yang harus ditolak ────────────────────────────────────
  {
    const sebelum = (await ownedSlugs(pemilik.uid)).length;
    const kasus: [string, unknown][] = [
      ["pemilik mencantumkan dirinya 100%", [{ uid: pemilik.uid, share: 100 }, { uid: kolaborator.uid, share: 50 }]],
      ["uid karangan", [{ uid: `tidak-ada-${randomUUID()}`, share: 10 }]],
      ["pemilik tersisa di bawah 10%", [{ uid: kolaborator.uid, share: 95 }]],
      ["persentase pecahan", [{ uid: kolaborator.uid, share: 12.5 }]],
      ["uid ganda", [{ uid: kolaborator.uid, share: 10 }, { uid: kolaborator.uid, share: 10 }]],
      ["bukan array", { uid: kolaborator.uid, share: 10 }],
    ];
    for (const [nama, contributors] of kasus) {
      const out = await callAction("/educator/courses/new", createId, [courseInput({ contributors })], pemilik.cookie);
      check(`membuat kursus ditolak: ${nama}`, !out.includes("berhasil dibuat"), out.match(/"error":"([^"]+)"/)?.[1] ?? out.slice(0, 60));
    }
    const sesudah = (await ownedSlugs(pemilik.uid)).length;
    check("tidak ada kursus tersimpan dari percobaan yang ditolak", sesudah === sebelum, `${sebelum} -> ${sesudah}`);
  }

  // ── Pengajuan sunting ─────────────────────────────────────────────────
  const editPath = `/educator/courses/${slug}/edit`;
  await probe(editPath, pemilik.cookie);
  const requestId = await actionId(EDIT_ROUTE, "requestCourseEdit");
  const d0 = await courseData(slug);
  const editInput = (contributors?: unknown) => ({
    title: d0.title,
    shortDesc: d0.shortDesc,
    longDesc: d0.longDesc,
    level: d0.level,
    category: d0.category,
    duration: d0.duration,
    price: d0.price,
    passingGrade: d0.passingGrade ?? 70,
    whatYouLearn: [],
    requirements: [],
    sections: d0.sections,
    ...(contributors === undefined ? {} : { contributors }),
  });

  {
    const out = await callAction(
      editPath,
      requestId,
      [slug, editInput([{ uid: educatorLain.uid, share: 90 }]), "Saya ingin mengambil bagian hasilnya."],
      educatorLain.cookie,
    );
    check(
      "educator lain tidak bisa mengusulkan pembagian kursus orang",
      out.includes("tidak berhak") && (await pendingRequest(slug)) === null,
      "ditolak, tanpa pengajuan",
    );
  }

  await probe("/admin/course-requests/kompilasi", admin.cookie);
  const decideId = await actionId(DECIDE_ROUTE, "decideCourseRequest");

  {
    const out = await callAction(
      editPath,
      requestId,
      [slug, editInput([{ uid: kolaborator.uid, share: 25 }, { uid: kolaborator2.uid, share: 15 }]), "Menambah Citra sebagai kontributor video."],
      pemilik.cookie,
    );
    const req = await pendingRequest(slug);
    const after = req?.get("after") as { contributors?: unknown } | undefined;
    check("pengajuan dengan kontributor terkirim", out.includes("Pengajuan terkirim") && Boolean(req), "pending");
    check(
      "usulan menyimpan daftar lengkap dengan jatah pemilik dihitung ulang",
      JSON.stringify(after?.contributors) ===
        JSON.stringify([{ uid: pemilik.uid, share: 60 }, { uid: kolaborator.uid, share: 25 }, { uid: kolaborator2.uid, share: 15 }]),
      JSON.stringify(after?.contributors),
    );
    check("kursus belum berubah sebelum disetujui", shares(await courseData(slug)).includes('"share":70'), shares(await courseData(slug)));

    const halaman = await probeText(`/admin/course-requests/${req?.id}`, admin.cookie);
    check(
      "halaman tinjauan admin menjelaskan perubahan pembagian dengan nama",
      halaman.html.includes("Bagian pemilik") && halaman.html.includes("Citra Kolaborator"),
      "diffCourse + labelOf",
    );

    const setuju = await callAction(`/admin/course-requests/${req?.id}`, decideId, [req?.id, "approve", ""], admin.cookie);
    const d = await courseData(slug);
    check(
      "setelah disetujui, pembagian kursus berubah",
      setuju.includes("disetujui") && shares(d).includes('"share":60') && (d.contributorUids as string[]).length === 3,
      shares(d),
    );
  }

  // ── Pengajuan LAMA tanpa field contributors ───────────────────────────
  {
    const sekarang = shares(await courseData(slug));
    const snap = await db.collection("courses").doc(slug).get();
    const s = snap.data() ?? {};
    const snapshotLama = {
      title: `${s.title} (disunting)`,
      shortDesc: s.shortDesc,
      longDesc: s.longDesc,
      level: s.level,
      levelColor: s.levelColor,
      category: s.category,
      duration: s.duration,
      price: s.price,
      passingGrade: s.passingGrade ?? 70,
      thumbnail: s.thumbnail ?? null,
      whatYouLearn: [],
      requirements: [],
      sections: s.sections,
    };
    const ref = db.collection("courseChangeRequests").doc();
    await ref.set({
      courseSlug: slug,
      courseTitle: s.title,
      type: "edit",
      reason: "Pengajuan dari sebelum fitur kontributor.",
      requestedByUid: pemilik.uid,
      requestedByName: "Andi Pemilik",
      status: "pending",
      before: { ...snapshotLama, title: s.title },
      after: snapshotLama,
      createdAt: new Date().toISOString(),
      decidedAt: null,
      decidedByUid: null,
      decidedByName: null,
      decisionNote: null,
    });

    const out = await callAction(`/admin/course-requests/${ref.id}`, decideId, [ref.id, "approve", ""], admin.cookie);
    const d = await courseData(slug);
    check(
      "pengajuan lama disetujui TANPA menghapus pembagian yang ada",
      out.includes("disetujui") && String(d.title).endsWith("(disunting)") && shares(d) === sekarang,
      shares(d),
    );
  }

  // ── Akun kontributor dihapus selama pengajuan menunggu ────────────────
  {
    const sementara = await user("user", "royalti-hilang");
    await callAction(
      editPath,
      requestId,
      [slug, editInput([{ uid: sementara.uid, share: 20 }]), "Menambah kontributor yang nanti dihapus."],
      pemilik.cookie,
    );
    const req = await pendingRequest(slug);
    await auth.deleteUser(sementara.uid);

    const sebelum = shares(await courseData(slug));
    const out = await callAction(`/admin/course-requests/${req?.id}`, decideId, [req?.id, "approve", ""], admin.cookie);
    check(
      "persetujuan ditolak bila akun kontributornya sudah tidak ada",
      out.includes("tidak ditemukan") && shares(await courseData(slug)) === sebelum && (await pendingRequest(slug)) !== null,
      "kursus utuh, pengajuan tetap menunggu",
    );
    if (req) await req.ref.delete();
  }

  // ── Admin menyunting langsung ─────────────────────────────────────────
  {
    const metaId = await actionId(EDIT_ROUTE, "updateCourseMeta");
    const meta = { ...editInput([{ uid: kolaborator.uid, share: 50 }]) };

    const olehPemilik = await callAction(editPath, metaId, [slug, meta], pemilik.cookie);
    check("educator tidak bisa menyunting pembagian secara langsung", olehPemilik.includes("persetujuan admin"), "harus lewat pengajuan");

    const olehAdmin = await callAction(editPath, metaId, [slug, meta], admin.cookie);
    const d = await courseData(slug);
    check(
      "admin menyunting pembagian langsung",
      olehAdmin.includes("tersimpan") &&
        shares(d) === JSON.stringify([{ uid: pemilik.uid, share: 50 }, { uid: kolaborator.uid, share: 50 }]),
      shares(d),
    );

    const tanpa = { ...editInput() };
    await callAction(editPath, metaId, [slug, { ...tanpa, title: `${d.title}!` }], admin.cookie);
    check("menyimpan info tanpa field kontributor tidak mengubah pembagian", shares(await courseData(slug)) === shares(d), "undefined = tidak diubah");
  }

  // ── Kredit publik ─────────────────────────────────────────────────────
  {
    await db.collection("courses").doc(slug).update({ visibility: "public" });
    const html = (await probeText(`/courses/${slug}`)).html;
    const kredit = html.slice(html.indexOf("Disusun oleh"), html.indexOf("Disusun oleh") + 1500);

    check("kredit penyusun tampil di halaman kursus", html.includes("Disusun oleh"), "lebih dari satu penyusun");
    check(
      "nama tampilan menaut ke profil, pemilik lebih dulu",
      kredit.indexOf(`/profil/${pemilik.uid}`) !== -1 &&
        kredit.indexOf(`/profil/${pemilik.uid}`) < kredit.indexOf(`/profil/${kolaborator.uid}`) &&
        kredit.includes("Budi Kolaborator"),
      "urutan tersimpan",
    );
    check("persentase tidak ditampilkan ke publik", !/Disusun oleh[^<]*\d+%/.test(kredit) && !kredit.includes("50%"), "tanpa angka bagi hasil");

    // Kursus satu penyusun: tanpa baris kredit.
    await db.collection("courses").doc(slug).update({
      contributors: [{ uid: pemilik.uid, share: 100 }],
      contributorUids: [pemilik.uid],
    });
    check("kursus satu penyusun tidak menampilkan baris kredit", !(await probeText(`/courses/${slug}`)).html.includes("Disusun oleh"), "cukup Diajarkan oleh");
  }

  await uang({ admin, pemilik, kolaborator });
}

// ═════════════════════════════════════════════════════════════════════════
// Uang: syarat dibekukan, buku royalti, idempotensi
// ═════════════════════════════════════════════════════════════════════════

const WEBHOOK = "/api/payments/midtrans/notification";
const SERVER_KEY = readEnv("MIDTRANS_SERVER_KEY");
const HARGA = 100_000;

function notification(orderId: string, amount: number, status: string) {
  const grossAmount = `${amount}.00`;
  return {
    order_id: orderId,
    status_code: "200",
    gross_amount: grossAmount,
    transaction_status: status,
    payment_type: "qris",
    fraud_status: "accept",
    signature_key: createHash("sha512").update(`${orderId}200${grossAmount}${SERVER_KEY}`).digest("hex"),
  };
}

async function webhook(body: unknown): Promise<number> {
  const res = await fetch(`${BASE}${WEBHOOK}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.status;
}

async function seedOrder(orderId: string, buyer: TestUser, slug: string, royalty: unknown, status = "pending") {
  const now = new Date();
  await db.collection("orders").doc(orderId).set({
    orderId,
    uid: buyer.uid,
    userEmail: buyer.email,
    userName: "Pembeli Rahasia",
    courseSlug: slug,
    courseTitle: "Kursus Uji Royalti",
    amount: HARGA,
    currency: "IDR",
    status,
    method: status === "awaiting_review" ? "manual" : "midtrans",
    paymentType: null,
    snapToken: null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
    paidAt: null,
    updatedAt: now.toISOString(),
    lastNotification: null,
    ...(royalty === undefined ? {} : { royalty }),
  });
}

async function saleOf(orderId: string) {
  const s = await db.collection("royaltySales").doc(orderId).get();
  const e = await db.collection("royaltyEarnings").where("courseSlug", "==", s.get("courseSlug") ?? "-").get();
  const milik = e.docs.filter((d) => d.id.startsWith(`${orderId}_`));
  return {
    exists: s.exists,
    data: s.data() ?? {},
    updateTime: s.updateTime?.toMillis() ?? 0,
    earnings: Object.fromEntries(milik.map((d) => [d.get("uid") as string, d.get("amount") as number])),
    earningCount: milik.length,
  };
}

async function uang(p: { admin: TestUser; pemilik: TestUser; kolaborator: TestUser }) {
  const { admin, pemilik, kolaborator } = p;
  const pembeli = await user("user", "royalti-pembeli");
  const pembeli2 = await user("user", "royalti-pembeli2");

  const slug = `verify-royalti-uang-${randomUUID().slice(0, 6)}`;
  const slugHilang = `verify-royalti-hilang-${randomUUID().slice(0, 6)}`;
  slugs.push(slug, slugHilang);

  const kursus = (contributors: { uid: string; share: number }[]) => ({
    ...courseInput(),
    slug,
    title: "Kursus Uji Royalti",
    levelColor: "green",
    icon: "reading",
    tint: "bg-blue-50",
    rating: 0,
    reviews: 0,
    enrolledStudents: 0,
    visibility: "public",
    lastUpdated: new Date().toISOString(),
    instructorName: "Andi Pemilik",
    instructorBio: "",
    order: 9999,
    ownerUid: pemilik.uid,
    ownerName: "Andi Pemilik",
    contributors,
    contributorUids: contributors.map((c) => c.uid),
    createdAt: new Date().toISOString(),
  });
  const TUJUH_TIGA = [{ uid: pemilik.uid, share: 70 }, { uid: kolaborator.uid, share: 30 }];
  const SETENGAH = [{ uid: pemilik.uid, share: 50 }, { uid: kolaborator.uid, share: 50 }];

  await db.collection("courses").doc(slug).set(kursus(TUJUH_TIGA));

  // Setelan pembayaran proyek ASLI: disalin utuh, dipulihkan persis.
  const setelanRef = db.collection("settings").doc("payments");
  const setelanAsli = await setelanRef.get();

  try {
    await setelanRef.set(
      { manualQrisEnabled: true, qrisImagePath: "payment-qris/verify-royalti.png", platformFeePercent: 20 },
      { merge: true },
    );

    await probe(`/courses/${slug}`, pembeli.cookie);
    await probe("/admin/payments", admin.cookie);
    const buatId = await actionId("courses/[slug]", "createManualOrder");
    const putusId = await actionId("admin/payments", "decideManualOrder");

    // ── Syarat dibekukan saat pesanan dibuat ────────────────────────────
    await callAction(`/courses/${slug}`, buatId, [slug], pembeli.cookie);
    const pesanan1 = (await db.collection("orders").where("uid", "==", pembeli.uid).get()).docs[0];
    const syarat1 = pesanan1?.get("royalty") as { feePercent: number; contributors: unknown } | undefined;
    check(
      "pesanan membawa syarat bagi hasil saat dibuat",
      syarat1?.feePercent === 20 && JSON.stringify(syarat1.contributors) === JSON.stringify(TUJUH_TIGA),
      JSON.stringify(syarat1),
    );

    // Pembagian & potongan berubah SELAGI pesanan menunggu tinjauan.
    await db.collection("courses").doc(slug).update({ contributors: SETENGAH, contributorUids: SETENGAH.map((c) => c.uid) });
    await setelanRef.set({ platformFeePercent: 10 }, { merge: true });
    await pesanan1.ref.update({ status: "awaiting_review" });

    // ── Setuju ganda, bersamaan ─────────────────────────────────────────
    const hasil = await Promise.all(
      [0, 1, 2].map(() => callAction("/admin/payments", putusId, [pesanan1.id, "approve", ""], admin.cookie)),
    );
    const s1 = await saleOf(pesanan1.id);
    check(
      "tiga klik setujui bersamaan = satu penjualan, dua pendapatan",
      s1.exists && s1.earningCount === 2 && hasil.some((h) => h.includes("disetujui")),
      `${s1.earningCount} pendapatan`,
    );
    check(
      "penjualan memakai syarat SAAT DIPESAN, bukan pembagian terbaru",
      s1.data.feeAmount === 20_000 && s1.earnings[pemilik.uid] === 56_000 && s1.earnings[kolaborator.uid] === 24_000,
      `fee ${s1.data.feeAmount}, pemilik ${s1.earnings[pemilik.uid]}, kolab ${s1.earnings[kolaborator.uid]}`,
    );
    check("asal syarat tercatat 'order', sumber 'manual'", s1.data.termsOrigin === "order" && s1.data.source === "manual", `${s1.data.termsOrigin}/${s1.data.source}`);

    // ── Pesanan SETELAH perubahan memakai syarat baru ───────────────────
    await callAction(`/courses/${slug}`, buatId, [slug], pembeli2.cookie);
    const pesanan2 = (await db.collection("orders").where("uid", "==", pembeli2.uid).get()).docs[0];
    await pesanan2.ref.update({ status: "awaiting_review" });
    await callAction("/admin/payments", putusId, [pesanan2.id, "approve", ""], admin.cookie);
    const s2 = await saleOf(pesanan2.id);
    check(
      "pesanan baru memakai potongan & pembagian terbaru",
      s2.data.feeAmount === 10_000 && s2.earnings[pemilik.uid] === 45_000 && s2.earnings[kolaborator.uid] === 45_000,
      `fee ${s2.data.feeAmount}, pemilik ${s2.earnings[pemilik.uid]}, kolab ${s2.earnings[kolaborator.uid]}`,
    );
    check(
      "penjualan lama tidak berubah oleh perubahan itu",
      (await saleOf(pesanan1.id)).updateTime === s1.updateTime && (await saleOf(pesanan1.id)).earnings[pemilik.uid] === 56_000,
      "tidak ditulis ulang",
    );

    // ── Webhook: retry berurutan & bersamaan ────────────────────────────
    const terms = { feePercent: 20, ownerUid: pemilik.uid, contributors: TUJUH_TIGA, capturedAt: new Date().toISOString() };
    const idA = `SYN-royalti-a-${randomUUID().slice(0, 8)}`;
    await seedOrder(idA, pembeli, slug, terms);

    const pertama = await webhook(notification(idA, HARGA, "settlement"));
    const sA = await saleOf(idA);
    for (let i = 0; i < 2; i++) await webhook(notification(idA, HARGA, "settlement"));
    await Promise.all(Array.from({ length: 5 }, () => webhook(notification(idA, HARGA, "settlement"))));
    const sA2 = await saleOf(idA);
    check("settlement pertama dijawab 200 dan tercatat", pertama === 200 && sA.exists, `HTTP ${pertama}`);
    check(
      "3 berurutan + 5 bersamaan: satu penjualan, dua pendapatan, tidak ditulis ulang",
      sA2.earningCount === 2 && sA2.updateTime === sA.updateTime,
      `${sA2.earningCount} pendapatan, updateTime ${sA2.updateTime === sA.updateTime ? "sama" : "BERUBAH"}`,
    );

    // ── Webhook: notifikasi terlambat tidak menyentuh pendapatan ────────
    for (const s of ["expire", "cancel", "deny"]) await webhook(notification(idA, HARGA, s));
    const orderA = (await db.collection("orders").doc(idA).get()).data();
    const sA3 = await saleOf(idA);
    check(
      "setelah expire/cancel/deny: status tetap lunas, pendapatan utuh",
      orderA?.status === "paid" && sA3.earningCount === 2 && sA3.earnings[pemilik.uid] === 56_000 && sA3.updateTime === sA.updateTime,
      `status=${orderA?.status}, pemilik ${sA3.earnings[pemilik.uid]}`,
    );

    // ── Pesanan warisan tanpa syarat ────────────────────────────────────
    const idLama = `SYN-royalti-lama-${randomUUID().slice(0, 8)}`;
    await seedOrder(idLama, pembeli2, slug, undefined);
    await webhook(notification(idLama, HARGA, "settlement"));
    const sLama = await saleOf(idLama);
    check(
      "pesanan dari sebelum fitur royalti: 100% pemilik, tanpa potongan",
      sLama.data.termsOrigin === "legacy" && sLama.data.feeAmount === 0 && sLama.earnings[pemilik.uid] === HARGA && sLama.earningCount === 1,
      `${sLama.data.termsOrigin}, fee ${sLama.data.feeAmount}, pemilik ${sLama.earnings[pemilik.uid]}`,
    );

    // ── Syarat rusak: belum teralokasi, tidak ditebak ───────────────────
    const idRusak = `SYN-royalti-rusak-${randomUUID().slice(0, 8)}`;
    await seedOrder(idRusak, pembeli2, slug, { feePercent: 150, ownerUid: pemilik.uid, contributors: [] });
    await webhook(notification(idRusak, HARGA, "settlement"));
    const sRusak = await saleOf(idRusak);
    check(
      "syarat rusak: seluruhnya belum teralokasi untuk diperiksa admin",
      sRusak.data.termsOrigin === "invalid" && sRusak.data.unallocatedAmount === HARGA && sRusak.earningCount === 0,
      `${sRusak.data.termsOrigin}, belum teralokasi ${sRusak.data.unallocatedAmount}`,
    );

    // ── Kursus dihapus setelah dibeli ───────────────────────────────────
    const idHilang = `SYN-royalti-hilang-${randomUUID().slice(0, 8)}`;
    await seedOrder(idHilang, pembeli, slugHilang, terms);
    const hilang = await webhook(notification(idHilang, HARGA, "settlement"));
    const sHilang = await saleOf(idHilang);
    check(
      "kursus sudah dihapus: penjualan tetap tercatat dengan syarat yang dibekukan",
      hilang === 200 && sHilang.earnings[kolaborator.uid] === 24_000 && sHilang.data.termsOrigin === "order",
      `HTTP ${hilang}, kolab ${sHilang.earnings[kolaborator.uid]}`,
    );

    // ── Backfill penjualan lama ─────────────────────────────────────────
    {
      // Pesanan lama yang uangnya masuk, tapi statusnya terlanjur tertimpa
      // notifikasi terlambat sebelum bug itu diperbaiki: hanya paidAt yang tersisa.
      const idTertimpa = `SYN-royalti-tertimpa-${randomUUID().slice(0, 8)}`;
      await seedOrder(idTertimpa, pembeli2, slug, undefined, "expired");
      await db.collection("orders").doc(idTertimpa).update({ paidAt: "2026-01-02T03:04:05.000Z" });

      const jalankan = () =>
        execFileSync("npx", ["tsx", "scripts/realise-sales.ts", "--apply", "--order", idTertimpa], {
          cwd: resolve(__dirname, ".."),
          encoding: "utf8",
          shell: true,
        });

      const pertama = jalankan();
      const b1 = await saleOf(idTertimpa);
      const kedua = jalankan();
      const b2 = await saleOf(idTertimpa);

      check(
        "backfill mencatat pesanan ber-paidAt walau statusnya tertimpa: 100% pemilik, tanpa potongan",
        pertama.includes("1 dicatat") && b1.data.source === "backfill" && b1.data.termsOrigin === "legacy" &&
          b1.earnings[pemilik.uid] === HARGA && b1.data.saleAt === "2026-01-02T03:04:05.000Z",
        `${b1.data.termsOrigin}, pemilik ${b1.earnings[pemilik.uid]}`,
      );
      check(
        "backfill dijalankan kedua kalinya tidak menambah atau menulis ulang apa pun",
        kedua.includes("1 sudah tercatat") && kedua.includes("0 dicatat") && b2.updateTime === b1.updateTime && b2.earningCount === 1,
        kedua.match(/\d+ pesanan lunas[^\n]*/)?.[0] ?? "",
      );
    }

    // ── Tanpa data pembeli di buku royalti ──────────────────────────────
    {
      const docs = [
        ...(await db.collection("royaltySales").where("courseSlug", "==", slug).get()).docs,
        ...(await db.collection("royaltyEarnings").where("courseSlug", "==", slug).get()).docs,
      ];
      const teks = JSON.stringify(docs.map((d) => d.data()));
      check(
        "buku royalti tidak memuat email, nama, maupun uid pembeli",
        docs.length > 0 && !teks.includes(pembeli.uid) && !teks.includes(pembeli.email) && !teks.includes("Pembeli Rahasia"),
        `${docs.length} dokumen diperiksa`,
      );
    }

    // ── Rules: tertutup dari klien ──────────────────────────────────────
    {
      const token = await signIn(kolaborator.email, kolaborator.password);
      const base = `https://firestore.googleapis.com/v1/projects/${resolveProjectId()}/databases/(default)/documents`;
      const baca = await fetch(`${base}/royaltyEarnings/${idA}_${kolaborator.uid}`, { headers: { Authorization: `Bearer ${token}` } });
      const tulis = await fetch(`${base}/royaltyEarnings/palsu_${kolaborator.uid}?updateMask.fieldPaths=amount`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fields: { amount: { integerValue: "999999999" } } }),
      });
      const jual = await fetch(`${base}/royaltySales/${idA}`, { headers: { Authorization: `Bearer ${token}` } });
      check(
        "klien tidak bisa membaca/menulis buku royalti, termasuk pendapatannya sendiri",
        baca.status === 403 && tulis.status === 403 && jual.status === 403,
        `baca ${baca.status}, tulis ${tulis.status}, penjualan ${jual.status}`,
      );
    }
    // ── Dashboard per peran ─────────────────────────────────────────────
    {
      const kolab = (await probeText("/dashboard", kolaborator.cookie)).html;
      check(
        "akun biasa melihat pendapatan royaltinya (Rp117.000 dari 4 penjualan)",
        kolab.includes("Pendapatan Royalti") && kolab.includes("117.000"),
        "24.000 + 45.000 + 24.000 + 24.000",
      );
      check(
        "akun biasa melihat kursus tempat ia berkontribusi beserta persentase saat ini",
        kolab.includes("Kursus Uji Royalti") && kolab.includes("50%"),
        "getMyContributions",
      );
      check("akun biasa TIDAK melihat bagian penjualan educator", !kolab.includes("Penjualan Kursus Saya"), "per peran");
      check(
        "dashboard kontributor tidak memuat data pembeli maupun nomor pesanan",
        !kolab.includes(pembeli.uid) && !kolab.includes(pembeli.email) && !kolab.includes("Pembeli Rahasia") &&
          !kolab.includes("SYN-royalti") && !kolab.includes(pembeli.uid.slice(0, 6)),
        "tanpa email, nama, uid, orderId",
      );

      const pem = (await probeText("/dashboard", pemilik.cookie)).html;
      check(
        "educator melihat pendapatan DAN penjualan kursusnya",
        pem.includes("Pendapatan Royalti") && pem.includes("Penjualan Kursus Saya") && pem.includes("Dibagikan ke kontributor"),
        "dua bagian",
      );

      const adm = (await probeText("/admin/payments", admin.cookie)).html;
      check(
        "admin melihat penjualan belum teralokasi dan kabar gagal setelah lunas",
        adm.includes("Penjualan belum teralokasi") && adm.includes(idRusak) && adm.includes("Kabar gagal setelah lunas") && adm.includes(idA),
        "daftar tindak lanjut",
      );
    }
  } finally {
    if (setelanAsli.exists) await setelanRef.set(setelanAsli.data() ?? {});
    else await setelanRef.delete();

    for (const s of [slug, slugHilang]) {
      for (const c of ["orders", "enrollments", "royaltySales", "royaltyEarnings"]) {
        const snap = await db.collection(c).where("courseSlug", "==", s).get();
        await Promise.allSettled(snap.docs.map((d) => d.ref.delete()));
      }
    }
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);
  try {
    await run();
  } finally {
    for (const s of slugs.filter(Boolean)) {
      const reqs = await db.collection("courseChangeRequests").where("courseSlug", "==", s).get();
      await Promise.allSettled([...reqs.docs.map((d) => d.ref.delete()), db.recursiveDelete(db.collection("courses").doc(s))]);
    }
    await Promise.allSettled(users.map((u) => db.collection("users").doc(u).delete()));
    await auth.deleteUsers(users).catch(() => undefined);
    console.log("\nakun, kursus, & pengajuan uji dihapus.");
  }
  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
