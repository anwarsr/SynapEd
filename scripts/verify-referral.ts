/**
 * Menguji kode referral: pembuatan kode, tautan bagikan, pemakaian saat
 * membeli, dan pencatatan komisinya.
 *
 * Yang paling keras diuji:
 *   - komisi DIAMBIL DARI potongan platform — bagian kontributor tidak
 *     berkurang satu rupiah pun;
 *   - kode sendiri tidak bisa dipakai untuk pembelian sendiri;
 *   - perujuk yang juga pemilik kursus menerima DUA pendapatan terpisah,
 *     tidak saling menimpa;
 *   - admin tidak bisa menyimpan referral yang lebih besar dari potongan.
 *
 * Butuh dev server berjalan (npm run dev).
 *
 *   npx tsx scripts/verify-referral.ts [baseUrl]
 */
import { createHash, randomUUID } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import {
  BASE,
  COOKIE,
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
const HARGA = 100_000;
const SERVER_KEY = readEnv("MIDTRANS_SERVER_KEY");

const users: string[] = [];
async function user(role: "admin" | "educator" | "user", tag: string, name?: string) {
  const u = await createTestUser(role, tag);
  users.push(u.uid);
  if (name) await auth.updateUser(u.uid, { displayName: name });
  return u;
}

function courseDoc(slug: string, ownerUid: string) {
  const now = new Date().toISOString();
  return {
    slug,
    title: "Kursus Uji Referral",
    shortDesc: "Dibuat verify-referral, akan dihapus.",
    longDesc: "x",
    level: "Pemula",
    levelColor: "green",
    category: "neuroscience",
    icon: "reading",
    tint: "bg-blue-50",
    duration: "1 Jam",
    rating: 0,
    reviews: 0,
    price: HARGA,
    passingGrade: 70,
    thumbnail: null,
    enrolledStudents: 0,
    lastUpdated: now,
    instructorName: "Uji Pemilik",
    instructorBio: "",
    whatYouLearn: [],
    requirements: [],
    visibility: "public",
    sections: [{ title: "Bagian", position: 0, lessons: [{ slug: "satu", title: "Satu", type: "reading", duration: "5 Menit", position: 0 }] }],
    order: 9999,
    ownerUid,
    ownerName: "Uji Pemilik",
    contributors: [{ uid: ownerUid, share: 100 }],
    contributorUids: [ownerUid],
    createdAt: now,
  };
}

async function ordersOf(uid: string, slug: string) {
  const q = await db.collection("orders").where("uid", "==", uid).get();
  return q.docs.filter((d) => d.get("courseSlug") === slug).sort((a, b) => String(b.get("createdAt")).localeCompare(String(a.get("createdAt"))));
}

async function earning(id: string) {
  const s = await db.collection("royaltyEarnings").doc(id).get();
  return { exists: s.exists, uid: s.get("uid"), amount: s.get("amount"), role: s.get("role"), updateTime: s.updateTime?.toMillis() ?? 0 };
}

function notification(orderId: string, status: string) {
  const gross = `${HARGA}.00`;
  return {
    order_id: orderId,
    status_code: "200",
    gross_amount: gross,
    transaction_status: status,
    payment_type: "qris",
    fraud_status: "accept",
    signature_key: createHash("sha512").update(`${orderId}200${gross}${SERVER_KEY}`).digest("hex"),
  };
}

async function run() {
  const acak = randomUUID().slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, "X");
  const admin = await user("admin", "ref-admin");
  const pemilik = await user("educator", "ref-pemilik", "Andi Pemilik");
  const perujuk = await user("user", "ref-perujuk", "Rina Perujuk");
  const pembeli = await user("user", "ref-pembeli", "Pembeli Rahasia");
  const pembeli2 = await user("user", "ref-pembeli2");

  const slug = `verify-referral-${randomUUID().slice(0, 6)}`;
  await db.collection("courses").doc(slug).set(courseDoc(slug, pemilik.uid));

  const setelanRef = db.collection("settings").doc("payments");
  const setelanAsli = await setelanRef.get();

  try {
    await setelanRef.set(
      { manualQrisEnabled: true, qrisImagePath: "payment-qris/verify-referral.png", platformFeePercent: 30, referralPercent: 10 },
      { merge: true },
    );

    // ── Membuat kode ────────────────────────────────────────────────────
    await probe("/dashboard", perujuk.cookie);
    const buatKodeId = await actionId("dashboard", "createMyReferralCode");
    const KODE = `RINA${acak}`;
    const KODE_PEMILIK = `ANDI${acak}`;

    {
      const anon = await callAction("/dashboard", buatKodeId, [KODE]);
      check("anonim tidak bisa membuat kode", anon.includes("masuk terlebih dahulu"), "penjaga sesi");

      for (const salah of ["ab", "RINA-1", "SYNAPED", "12345"]) {
        const out = await callAction("/dashboard", buatKodeId, [salah], perujuk.cookie);
        check(`kode tidak sah ditolak: "${salah}"`, !out.includes("aktif"), "validasi server");
      }

      const ok = await callAction("/dashboard", buatKodeId, [KODE.toLowerCase()], perujuk.cookie);
      const u = (await db.collection("users").doc(perujuk.uid).get()).get("referralCode");
      const r = (await db.collection("referralCodes").doc(KODE).get()).get("uid");
      check("kode dibuat, dinormalkan huruf besar", ok.includes("aktif") && u === KODE && r === perujuk.uid, `${u}`);

      const lagi = await callAction("/dashboard", buatKodeId, [`LAIN${acak}`], perujuk.cookie);
      check("kode bersifat permanen: tidak bisa membuat kode kedua", lagi.includes("tidak bisa diganti"), "satu kode per akun");

      const rebut = await callAction("/dashboard", buatKodeId, [KODE], pembeli2.cookie);
      check("kode milik orang lain tidak bisa diklaim", rebut.includes("sudah dipakai"), "unik");

      await callAction("/dashboard", buatKodeId, [KODE_PEMILIK], pemilik.cookie);
    }

    {
      const pelomba = await Promise.all(Array.from({ length: 6 }, (_, i) => user("user", `ref-lomba${i}`)));
      const rebutan = `REBUT${acak}`;
      const hasil = await Promise.all(pelomba.map((p) => callAction("/dashboard", buatKodeId, [rebutan], p.cookie)));
      const menang = hasil.filter((h) => h.includes("aktif")).length;
      const pemegang = (await Promise.all(pelomba.map(async (p) => (await db.collection("users").doc(p.uid).get()).get("referralCode") === rebutan))).filter(Boolean).length;
      check("6 akun membuat kode yang sama bersamaan: tepat satu berhasil", menang === 1 && pemegang === 1, `${menang} berhasil, ${pemegang} pemegang`);
    }

    // ── Tautan bagikan ──────────────────────────────────────────────────
    {
      const r = await probe(`/courses/${slug}?ref=${KODE.toLowerCase()}`);
      const setCookie = r.res.headers.get("set-cookie") ?? "";
      check("membuka tautan ?ref= menyimpan kode di cookie", setCookie.includes(`synaped_ref=${KODE}`), setCookie.slice(0, 60));

      const palsu = await probe(`/courses/${slug}?ref=bukan-kode!`);
      check("tautan dengan kode berbentuk salah tidak menyimpan cookie", !(palsu.res.headers.get("set-cookie") ?? "").includes("synaped_ref"), "divalidasi bentuknya");

      const halaman = (await probeText(`/courses/${slug}?ref=${KODE}`, pembeli.cookie)).html;
      check("pembeli dari tautan: kode otomatis diterapkan", halaman.includes(`<strong class="font-semibold">${KODE}</strong>`) && halaman.includes("Rina Perujuk"), "ReferralField");

      // Kode dari cookie (tanpa ?ref) juga terbaca.
      const lewatCookie = await fetch(`${BASE}/courses/${slug}`, { headers: { cookie: `${COOKIE}=${pembeli.cookie}; synaped_ref=${KODE}` } });
      check("kunjungan berikutnya tanpa ?ref tetap memakai kode dari cookie", (await lewatCookie.text()).includes(`>${KODE}</strong>`), "30 hari");

      const sendiri = (await probeText(`/courses/${slug}?ref=${KODE}`, perujuk.cookie)).html;
      check("perujuk membuka tautannya sendiri: kodenya TIDAK diterapkan", !sendiri.includes("diterapkan"), "kode sendiri");
      check("perujuk melihat tombol bagikan dengan kodenya", sendiri.includes("Bagikan dengan kode referral") && sendiri.includes(KODE), "ShareCourseButton");
    }

    // ── Pemeriksaan kode sebelum membeli ────────────────────────────────
    const cekId = await actionId("courses/[slug]", "checkReferralCode");
    {
      const ok = await callAction(`/courses/${slug}`, cekId, [KODE.toLowerCase()], pembeli.cookie);
      check("cek kode: nama perujuk tampil, tanpa uid/email", ok.includes("Rina Perujuk") && !ok.includes(perujuk.uid) && !ok.includes(perujuk.email), "privasi perujuk");
      const sendiri = await callAction(`/courses/${slug}`, cekId, [KODE], perujuk.cookie);
      check("cek kode sendiri ditolak", sendiri.includes("milik Anda sendiri"), "self-referral");
      const asing = await callAction(`/courses/${slug}`, cekId, [`TIDAKADA${acak}`], pembeli.cookie);
      check("kode yang tidak ada ditolak", asing.includes("tidak ditemukan"), "tidak ditemukan");
    }

    // ── Pesanan dengan referral ─────────────────────────────────────────
    await probe("/admin/payments", admin.cookie);
    const buatId = await actionId("courses/[slug]", "createManualOrder");
    const putusId = await actionId("admin/payments", "decideManualOrder");

    {
      const sendiri = await callAction(`/courses/${slug}`, buatId, [slug, KODE], perujuk.cookie);
      check("membeli dengan kode sendiri ditolak, tanpa pesanan", sendiri.includes("milik Anda sendiri") && (await ordersOf(perujuk.uid, slug)).length === 0, "self-referral");

      const asing = await callAction(`/courses/${slug}`, buatId, [slug, `TIDAKADA${acak}`], pembeli.cookie);
      check("membeli dengan kode tak dikenal ditolak, tanpa pesanan", asing.includes("tidak ditemukan") && (await ordersOf(pembeli.uid, slug)).length === 0, "tidak diam-diam diabaikan");
    }

    // Pesanan pertama TANPA kode, lalu pembeli menerapkan kode → pesanan diganti.
    await callAction(`/courses/${slug}`, buatId, [slug, ""], pembeli.cookie);
    await callAction(`/courses/${slug}`, buatId, [slug, KODE], pembeli.cookie);
    const semua = await ordersOf(pembeli.uid, slug);
    const aktif = semua[0];
    const syarat = aktif?.get("royalty") as { feePercent: number; referral: { uid: string; code: string; percent: number } | null } | undefined;
    check(
      "menerapkan kode setelah pesanan dibuat: pesanan lama dihanguskan, yang baru membawa kode",
      semua.length === 2 && semua[1].get("status") === "expired" && syarat?.referral?.code === KODE,
      `${semua.length} pesanan, lama=${semua[1]?.get("status")}`,
    );
    check(
      "syarat pesanan: potongan 30%, referral 10% untuk perujuk yang benar",
      syarat?.feePercent === 30 && syarat.referral?.percent === 10 && syarat.referral.uid === perujuk.uid,
      JSON.stringify(syarat?.referral),
    );

    {
      await callAction(`/courses/${slug}`, buatId, [slug, KODE], pembeli.cookie);
      check("kode yang sama: pesanan tertunda dipakai ulang", (await ordersOf(pembeli.uid, slug)).length === 2, "tidak menumpuk");
    }

    // Admin menyetujui.
    await aktif.ref.update({ status: "awaiting_review" });
    await Promise.all([0, 1].map(() => callAction("/admin/payments", putusId, [aktif.id, "approve", ""], admin.cookie)));
    {
      const sale = (await db.collection("royaltySales").doc(aktif.id).get()).data() ?? {};
      const ref = await earning(`${aktif.id}_referral`);
      const own = await earning(`${aktif.id}_${pemilik.uid}`);
      check(
        "komisi diambil dari potongan: perujuk 10.000, platform 20.000, kontributor TETAP 70.000",
        ref.amount === 10_000 && ref.uid === perujuk.uid && ref.role === "referral" &&
          sale.feeAmount === 30_000 && sale.platformAmount === 20_000 && own.amount === 70_000,
        `perujuk ${ref.amount}, platform ${sale.platformAmount}, pemilik ${own.amount}`,
      );
    }

    // ── Pemilik mempromosikan kursusnya sendiri ─────────────────────────
    await callAction(`/courses/${slug}`, buatId, [slug, KODE_PEMILIK], pembeli2.cookie);
    const p2 = (await ordersOf(pembeli2.uid, slug))[0];
    await p2.ref.update({ status: "awaiting_review" });
    await callAction("/admin/payments", putusId, [p2.id, "approve", ""], admin.cookie);
    {
      const own = await earning(`${p2.id}_${pemilik.uid}`);
      const ref = await earning(`${p2.id}_referral`);
      check(
        "pemilik yang juga perujuk: dua pendapatan terpisah (70.000 + 10.000), tidak saling menimpa",
        own.amount === 70_000 && own.role === "owner" && ref.amount === 10_000 && ref.uid === pemilik.uid,
        `pemilik ${own.amount}/${own.role}, referral ${ref.amount}`,
      );
    }

    // ── Webhook Midtrans: retry tidak menggandakan komisi ───────────────
    {
      const id = `SYN-ref-${randomUUID().slice(0, 8)}`;
      const now = new Date();
      await db.collection("orders").doc(id).set({
        orderId: id, uid: pembeli2.uid, userEmail: pembeli2.email, userName: "x", courseSlug: slug, courseTitle: "Kursus Uji Referral",
        amount: HARGA, currency: "IDR", status: "pending", method: "midtrans", paymentType: null, snapToken: "t",
        createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 1_800_000).toISOString(), paidAt: null, updatedAt: now.toISOString(), lastNotification: null,
        royalty: { feePercent: 30, ownerUid: pemilik.uid, contributors: [{ uid: pemilik.uid, share: 100 }], referral: { uid: perujuk.uid, code: KODE, percent: 10 }, capturedAt: now.toISOString() },
      });
      const post = () => fetch(`${BASE}/api/payments/midtrans/notification`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(notification(id, "settlement")) });
      await post();
      const pertama = await earning(`${id}_referral`);
      await Promise.all([post(), post(), post()]);
      const sesudah = await earning(`${id}_referral`);
      check("webhook berulang: komisi referral tercatat sekali, tidak ditulis ulang", pertama.amount === 10_000 && sesudah.updateTime === pertama.updateTime, `updateTime ${sesudah.updateTime === pertama.updateTime ? "sama" : "BERUBAH"}`);
    }

    // ── Setelan admin ───────────────────────────────────────────────────
    {
      const setId = await actionId("admin/payments", "updateRevenueSettings");
      const olehUser = await callAction("/admin/payments", setId, [{ platformFeePercent: 30, referralPercent: 30 }], pembeli.cookie);
      check("bukan admin tidak bisa mengubah persentase", olehUser.includes("Hanya admin"), "penjaga peran");

      const lebih = await callAction("/admin/payments", setId, [{ platformFeePercent: 15, referralPercent: 20 }], admin.cookie);
      const d = (await setelanRef.get()).data() ?? {};
      check(
        "referral lebih besar dari potongan ditolak, setelan tidak berubah",
        lebih.includes("tidak boleh lebih besar") && d.platformFeePercent === 30 && d.referralPercent === 10,
        `${d.platformFeePercent}/${d.referralPercent}`,
      );

      const ok = await callAction("/admin/payments", setId, [{ platformFeePercent: 25, referralPercent: 5 }], admin.cookie);
      const d2 = (await setelanRef.get()).data() ?? {};
      check("admin menyimpan pasangan yang sah", ok.includes("berlaku") && d2.platformFeePercent === 25 && d2.referralPercent === 5, `${d2.platformFeePercent}/${d2.referralPercent}`);
    }

    // ── Dashboard perujuk ───────────────────────────────────────────────
    {
      const html = (await probeText("/dashboard", perujuk.cookie)).html;
      check("dashboard perujuk: kode & total komisi tampil", html.includes(KODE) && html.includes("20.000") && html.includes("Referral"), "10.000 × 2");
      check(
        "dashboard perujuk tidak memuat data pembeli",
        !html.includes(pembeli.uid) && !html.includes(pembeli.email) && !html.includes("Pembeli Rahasia") && !html.includes(aktif.id),
        "tanpa email, nama, uid, orderId",
      );
      const baru = (await probeText("/dashboard", pembeli.cookie)).html;
      check("akun tanpa kode melihat formulir pembuatan kode", baru.includes("Buat Kode"), "ReferralCodeForm");
    }

    // ── Rules ───────────────────────────────────────────────────────────
    {
      const token = await signIn(perujuk.email, perujuk.password);
      const url = `https://firestore.googleapis.com/v1/projects/${resolveProjectId()}/databases/(default)/documents/referralCodes/${KODE}`;
      const baca = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const tulis = await fetch(`https://firestore.googleapis.com/v1/projects/${resolveProjectId()}/databases/(default)/documents/referralCodes/CURI${acak}?updateMask.fieldPaths=uid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fields: { uid: { stringValue: perujuk.uid } } }),
      });
      check("klien tidak bisa membaca atau mengklaim kode referral", baca.status === 403 && tulis.status === 403, `baca ${baca.status}, tulis ${tulis.status}`);
    }
  } finally {
    if (setelanAsli.exists) await setelanRef.set(setelanAsli.data() ?? {});
    else await setelanRef.delete();

    for (const c of ["orders", "enrollments", "royaltySales", "royaltyEarnings"]) {
      const snap = await db.collection(c).where("courseSlug", "==", slug).get();
      await Promise.allSettled(snap.docs.map((d) => d.ref.delete()));
    }
    await db.collection("courses").doc(slug).delete().catch(() => undefined);
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);
  try {
    await run();
  } finally {
    for (const uid of users) {
      const kode = await db.collection("referralCodes").where("uid", "==", uid).get();
      await Promise.allSettled([...kode.docs.map((d) => d.ref.delete()), db.collection("users").doc(uid).delete()]);
    }
    await auth.deleteUsers(users).catch(() => undefined);
    console.log("\nakun, kursus, kode, & pesanan uji dihapus.");
  }
  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
