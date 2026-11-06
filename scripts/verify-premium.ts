/**
 * Menguji SynapEd Premium dari ujung ke ujung terhadap server yang berjalan.
 *
 * Yang paling keras diuji di sini adalah uang dan akses:
 *
 *   - siapa yang TIDAK boleh membuka/memberi premium (anonim, bukan admin,
 *     tanda tangan palsu, nominal dipalsukan);
 *   - premium diberikan TEPAT SEKALI per pesanan, menumpuk bila dibeli lagi;
 *   - akses berhenti saat premium dicabut tetapi kemajuan tetap;
 *   - bagi hasil sesuai pemakaian, Σ = uang yang dibayar, tepat sekali.
 *
 * Butuh dev server berjalan (npm run dev) dengan MIDTRANS_SERVER_KEY yang sama
 * dengan skrip ini (dibaca dari frontend/.env.local bila tidak di lingkungan).
 *
 *   npx tsx scripts/verify-premium.ts [baseUrl]
 *
 * Bagi hasil diuji lewat `bagiHasilPeriode` untuk periode uji SAJA - tombol
 * admin "Bagikan pendapatan" membagi SEMUA periode yang berakhir di proyek
 * (database asli), jadi di sini hanya penjaganya yang diuji.
 *
 * `settings/payments` disalin di awal dan dipulihkan PERSIS di akhir.
 */
import { createHash, randomUUID } from "node:crypto";
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
import {
  PREMIUM_MEMBERS,
  PREMIUM_PERIODS,
  PREMIUM_SETTLEMENTS,
  PREMIUM_USAGE,
  bagiHasilPeriode,
} from "../frontend/src/lib/premiumCore";
import { PREMIUM_HARI, PREMIUM_SLUG, makePremiumTerms } from "../frontend/src/lib/premiumRules";

const db = getFirestore(app);
const bucket = getStorage(app).bucket(readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"));
const SERVER_KEY = readEnv("MIDTRANS_SERVER_KEY");

const WEBHOOK = "/api/payments/midtrans/notification";
const COURSE_ROUTE = "courses/[slug]";
const LEARN_ROUTE = "courses/[slug]/learn/[[...lesson]]";
const PREMIUM_ROUTE = "premium";
const ADMIN_PREMIUM = "admin/premium";
const ADMIN_PAYMENTS = "admin/payments";

const HARGA = 60_000;
const FEE = 30;
const REF_PERSEN = 10;
const HARI_MS = 86_400_000;
const QRIS_PATH = `payment-qris/verify-premium-${randomUUID().slice(0, 8)}.png`;
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function courseDoc(slug: string, price: number, owner: string | null, lain: { uid: string; share: number }[] = [], visibility = "public") {
  const now = new Date().toISOString();
  const contributors = owner ? [{ uid: owner, share: 100 - lain.reduce((n, c) => n + c.share, 0) }, ...lain] : [];
  return {
    slug,
    title: `Kursus Uji Premium ${slug.slice(-6)}`,
    shortDesc: "Dibuat verify-premium, akan dihapus.",
    longDesc: "x",
    level: "Pemula",
    levelColor: "green",
    category: "neuroscience",
    icon: "reading",
    tint: "bg-blue-50",
    duration: "1 jam",
    rating: 0,
    reviews: 0,
    price,
    thumbnail: null,
    enrolledStudents: 0,
    lastUpdated: now,
    instructorName: "Uji Premium",
    instructorBio: "",
    whatYouLearn: [],
    requirements: [],
    sections: [
      {
        title: "Bagian Uji",
        position: 0,
        lessons: ["satu", "dua", "tiga", "empat"].map((s, i) => ({
          slug: s,
          title: `Pelajaran ${s}`,
          type: "reading",
          duration: "5 menit",
          position: i,
        })),
      },
    ],
    order: 9999,
    visibility,
    ownerUid: owner,
    ownerName: owner ? "Uji Pemilik" : null,
    contributors,
    contributorUids: contributors.map((c) => c.uid),
    createdAt: now,
  };
}

/** Notifikasi Midtrans dengan tanda tangan sah (pola verify-payment). */
function notification(orderId: string, amount: number, status: string, key = SERVER_KEY) {
  const statusCode = "200";
  const grossAmount = `${amount}.00`;
  return {
    order_id: orderId,
    status_code: statusCode,
    gross_amount: grossAmount,
    transaction_status: status,
    payment_type: "qris",
    fraud_status: "accept",
    signature_key: createHash("sha512").update(orderId + statusCode + grossAmount + key).digest("hex"),
  };
}

async function postWebhook(body: unknown): Promise<number> {
  const res = await fetch(`${BASE}${WEBHOOK}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.status;
}

/** Pesanan premium Midtrans seperti yang ditulis createPremiumOrder. */
async function seedPremiumOrder(orderId: string, user: TestUser, amount: number, referral: { uid: string; code: string } | null) {
  const now = new Date();
  await db.collection("orders").doc(orderId).set({
    orderId,
    uid: user.uid,
    userEmail: user.email,
    userName: "Uji",
    kind: "premium",
    courseSlug: PREMIUM_SLUG,
    courseTitle: "SynapEd Premium 30 hari",
    amount,
    currency: "IDR",
    status: "pending",
    method: "midtrans",
    paymentType: null,
    snapToken: "token-uji",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
    paidAt: null,
    updatedAt: now.toISOString(),
    lastNotification: null,
    royalty: makePremiumTerms(FEE, referral ? { ...referral, percent: REF_PERSEN } : null, now.toISOString()),
  });
}

/** Pesanan kursus biasa (tanpa `kind`: dokumen lama harus tetap dibaca sebagai kursus). */
async function seedCourseOrder(orderId: string, user: TestUser, slug: string, amount: number) {
  const now = new Date();
  await db.collection("orders").doc(orderId).set({
    orderId,
    uid: user.uid,
    userEmail: user.email,
    userName: "Uji",
    courseSlug: slug,
    courseTitle: "Kursus Uji Premium",
    amount,
    currency: "IDR",
    status: "pending",
    paymentType: null,
    snapToken: "token-uji",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
    paidAt: null,
    updatedAt: now.toISOString(),
    lastNotification: null,
  });
}

const periodeMilik = async (uid: string) =>
  (await db.collection(PREMIUM_PERIODS).where("uid", "==", uid).get()).docs
    .map((d) => d.data())
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));
const anggota = async (uid: string) => (await db.collection(PREMIUM_MEMBERS).doc(uid).get()).data();
const daftar = async (uid: string, slug: string) => (await db.collection("enrollments").doc(`${uid}_${slug}`).get()).data();
const pemakaian = async (periodId: string, slug: string) => (await db.collection(PREMIUM_USAGE).doc(`${periodId}_${slug}`).get()).data();
const selisihHari = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / HARI_MS;
const dekat = (iso: unknown, ms = Date.now(), toleransi = 120_000) => typeof iso === "string" && Math.abs(new Date(iso).getTime() - ms) < toleransi;

interface Peran {
  admin: TestUser;
  pemilik: TestUser;
  kontributor: TestUser;
  pemilik2: TestUser;
  perujuk: TestUser;
  a: TestUser;
  b: TestUser;
  biasa: TestUser;
}

async function run(p: Peran, slugs: { c1: string; c2: string; gratis: string; privat: string }, kode: string) {
  const { c1, c2, gratis, privat } = slugs;

  // Rute dikompilasi dulu supaya manifest action-nya ada.
  await probe(`/courses/${c1}`, p.a.cookie);
  await probe(`/courses/${c1}/learn/satu`, p.a.cookie);
  await probe("/premium", p.b.cookie);
  await probe("/admin/premium", p.admin.cookie);
  await probe("/admin/payments", p.admin.cookie);

  const enrollId = await actionId(COURSE_ROUTE, "enrollPremium");
  const markId = await actionId(LEARN_ROUTE, "markLessonComplete");
  const manualId = await actionId(PREMIUM_ROUTE, "createManualPremiumOrder");
  const grantId = await actionId(ADMIN_PREMIUM, "grantPremiumAdmin");
  const revokeId = await actionId(ADMIN_PREMIUM, "revokePremiumAdmin");
  const settleId = await actionId(ADMIN_PREMIUM, "settlePremiumNow");
  const hargaId = await actionId(ADMIN_PREMIUM, "updatePremiumPrice");
  const putusId = await actionId(ADMIN_PAYMENTS, "decideManualOrder");

  const tandai = (u: TestUser, slug: string, lesson: string) => callAction(`/courses/${slug}/learn/${lesson}`, markId, [slug, lesson], u.cookie);
  const ikut = (u: TestUser | null, slug: string) => callAction(`/courses/${slug}`, enrollId, [slug], u?.cookie);

  // ── Penjaga: siapa yang TIDAK boleh ─────────────────────────────────
  {
    check("anonim tidak bisa enrollPremium", (await ikut(null, c1)).includes("masuk terlebih dahulu"), "penjaga sesi");
    check("non-premium tidak bisa enrollPremium", (await ikut(p.biasa, c1)).includes("Premium Anda tidak aktif"), "getPremium dari sesi");
    check("non-premium tidak mendapat pendaftaran", !(await daftar(p.biasa.uid, c1)), "Firestore");

    const g = await callAction("/admin/premium", grantId, [p.biasa.email, 30, "curang"], p.biasa.cookie);
    check("bukan admin tidak bisa memberi premium (termasuk ke dirinya)", g.includes("Hanya admin"), "grantPremiumAdmin");
    check("pemberian tertolak tidak menulis apa pun", !(await anggota(p.biasa.uid)), "premiumMembers kosong");
    const pe = await callAction("/admin/premium", grantId, [p.biasa.email, 30, ""], p.pemilik.cookie);
    check("educator juga bukan admin", pe.includes("Hanya admin"), "peran educator");
    check("bukan admin tidak bisa mencabut", (await callAction("/admin/premium", revokeId, [p.a.email, ""], p.biasa.cookie)).includes("Hanya admin"), "revokePremiumAdmin");
    check("bukan admin tidak bisa membagi hasil", (await callAction("/admin/premium", settleId, [], p.biasa.cookie)).includes("Hanya admin"), "settlePremiumNow");
    check("bukan admin tidak bisa mengubah harga", (await callAction("/admin/premium", hargaId, [{ premiumPrice: 10_000 }], p.biasa.cookie)).includes("Hanya admin"), "updatePremiumPrice");

    const nol = await callAction("/admin/premium", grantId, [p.biasa.email, 0, ""], p.admin.cookie);
    check("lama 0 hari ditolak", nol.includes("1 sampai"), "validasi hari");
    const banyak = await callAction("/admin/premium", grantId, [p.biasa.email, 9999, ""], p.admin.cookie);
    check("lama di atas batas ditolak", banyak.includes("1 sampai"), "PREMIUM_HARI_ADMIN_MAKS");
    const hantu = await callAction("/admin/premium", grantId, [`tidak-ada-${randomUUID().slice(0, 6)}@synaped.test`, 7, ""], p.admin.cookie);
    check("akun tak dikenal ditolak", hantu.includes("Akun tidak ditemukan"), "uidSasaran");
    check("pemberian salah tidak menulis apa pun", !(await anggota(p.biasa.uid)), "premiumMembers kosong");
  }

  // ── Harga dari setelan admin ────────────────────────────────────────
  {
    const murah = await callAction("/admin/premium", hargaId, [{ premiumPrice: 5_000 }], p.admin.cookie);
    check("harga di bawah minimum ditolak server", murah.includes("minimal"), "validasiHargaPremium");
    const pecahan = await callAction("/admin/premium", hargaId, [{ premiumPrice: 50_000.5 }], p.admin.cookie);
    check("harga pecahan ditolak", pecahan.includes("bilangan bulat"), "validasiHargaPremium");
    const ok = await callAction("/admin/premium", hargaId, [{ premiumPrice: HARGA }], p.admin.cookie);
    check("admin mengubah harga", ok.includes("berlaku untuk pembelian berikutnya"), "pesan hasil");
    const s = (await db.collection("settings").doc("payments").get()).data();
    check("harga tersimpan di settings/payments", s?.premiumPrice === HARGA, `premiumPrice=${s?.premiumPrice}`);
    const halaman = await probeText("/premium");
    check("/premium menampilkan harga dari setelan", halaman.html.includes("60.000"), "formatPrice(premiumPrice)");
    const biasa = await probeText(`/courses/${c1}`, p.biasa.cookie);
    check("kursus berbayar menawarkan Premium ke non-anggota", biasa.html.includes("semua kursus") && biasa.html.includes("60.000"), "tautan ke /premium");
    check("/premium untuk tamu mengajak masuk", halaman.html.includes("Masuk untuk Berlangganan"), "tanpa sesi");
  }

  // ── QRIS manual: nominal dari server, disetujui admin ───────────────
  let manualOrderId = "";
  {
    await bucket.file(QRIS_PATH).save(PNG, { contentType: "image/png" });
    await db.collection("settings").doc("payments").set({ manualQrisEnabled: true, qrisImagePath: QRIS_PATH }, { merge: true });

    const anon = await callAction("/premium", manualId, []);
    check("anonim tidak bisa memesan premium", anon.includes("masuk terlebih dahulu"), "penjaga sesi");

    // Angka dari browser diselipkan sebagai argumen tambahan: harus diabaikan.
    const out = await callAction("/premium", manualId, ["", 1], p.b.cookie);
    check("pesanan premium manual terbuat", out.includes("Pesanan dibuat"), "pesan hasil");
    const pesanan = (await db.collection("orders").where("uid", "==", p.b.uid).get()).docs.map((d) => d.data());
    check("tepat satu pesanan", pesanan.length === 1, `${pesanan.length} dokumen`);
    const o = pesanan[0] ?? {};
    manualOrderId = String(o.orderId ?? "");
    check("nominal = harga premium dari setelan", o.amount === HARGA, `amount=${o.amount}`);
    check("pesanan ditandai kind premium", o.kind === "premium" && o.courseSlug === PREMIUM_SLUG, `kind=${o.kind} slug=${o.courseSlug}`);
    check("syarat dibekukan di pesanan", typeof o.royalty?.feePercent === "number" && o.royalty?.referral === null, JSON.stringify(o.royalty));

    const lagi = await callAction("/premium", manualId, [""], p.b.cookie);
    check("panggilan kedua memakai ulang pesanan", lagi.includes("Melanjutkan"), "findPendingOrder(kind premium)");

    // Bukti bayar sudah diuji verify-manual-payment (jalurnya generik);
    // di sini pesanan langsung dibawa ke tahap tinjauan.
    await db.collection("orders").doc(manualOrderId).update({ status: "awaiting_review", proofPath: `payment-proofs/${p.b.uid}/uji.png` });

    const bukan = await callAction("/admin/payments", putusId, [manualOrderId, "approve", ""], p.b.cookie);
    check("pembeli tidak bisa menyetujui pesanannya sendiri", bukan.includes("Hanya admin"), "decideManualOrder");
    check("persetujuan tertolak tidak memberi premium", (await periodeMilik(p.b.uid)).length === 0, "premiumPeriods kosong");

    const setuju = await callAction("/admin/payments", putusId, [manualOrderId, "approve", ""], p.admin.cookie);
    check("admin menyetujui", setuju.includes("premium diaktifkan"), "pesan hasil");
    const per = await periodeMilik(p.b.uid);
    check("satu periode manual terbit", per.length === 1 && per[0].source === "manual" && per[0].gross === HARGA, JSON.stringify(per.map((x) => [x.source, x.gross])));
    check("periode = orderId (idempoten)", per[0]?.periodId === manualOrderId, String(per[0]?.periodId));
    check("periode manual 30 hari", per[0] ? Math.abs(selisihHari(per[0].start, per[0].end) - PREMIUM_HARI) < 1e-6 : false, "end - start");
    check("pesanan manual jadi paid", (await db.collection("orders").doc(manualOrderId).get()).data()?.status === "paid", "status");

    const ganda = await callAction("/admin/payments", putusId, [manualOrderId, "approve", ""], p.admin.cookie);
    check("persetujuan ganda ditolak", ganda.includes("tidak sedang menunggu"), "status bukan awaiting_review");
    check("persetujuan ganda tidak menambah periode", (await periodeMilik(p.b.uid)).length === 1, "tetap satu");
  }

  // ── Webhook Midtrans: periode tepat sekali, menumpuk, referral ──────
  const order1 = `SYN-uji-prem-${randomUUID().slice(0, 8)}`;
  const order2 = `SYN-uji-prem-${randomUUID().slice(0, 8)}`;
  {
    await seedPremiumOrder(order1, p.a, HARGA, { uid: p.perujuk.uid, code: kode });

    const palsu = await postWebhook({ ...notification(order1, HARGA, "settlement"), signature_key: "0".repeat(128) });
    check("tanda tangan palsu ditolak", palsu === 403, `HTTP ${palsu}`);
    const nominal = await postWebhook(notification(order1, 1_000, "settlement"));
    check("nominal yang tidak sama ditolak", nominal === 400, `HTTP ${nominal}`);
    check("keduanya tidak memberi premium", (await periodeMilik(p.a.uid)).length === 0, "premiumPeriods kosong");

    const ok = await postWebhook(notification(order1, HARGA, "settlement"));
    check("notifikasi lunas diterima", ok === 200, `HTTP ${ok}`);
    let per = await periodeMilik(p.a.uid);
    check("satu periode terbit", per.length === 1 && per[0].periodId === order1, `${per.length} periode`);
    const p1 = per[0] ?? {};
    check("periode 30 hari mulai sekarang", dekat(p1.start) && Math.abs(selisihHari(p1.start, p1.end) - PREMIUM_HARI) < 1e-6, `${p1.start} → ${p1.end}`);
    check("periode membawa nominal & syarat pesanan", p1.gross === HARGA && p1.terms?.feePercent === FEE && p1.settledAt === null, JSON.stringify({ g: p1.gross, t: p1.terms }));
    check("masa aktif anggota = akhir periode", (await anggota(p.a.uid))?.activeUntil === p1.end, "premiumMembers");
    check("pesanan jadi paid", (await db.collection("orders").doc(order1).get()).data()?.status === "paid", "applyNotification");

    const ref = (await db.collection("royaltyEarnings").doc(`${order1}_referral`).get()).data();
    const harapRef = Math.floor((HARGA * REF_PERSEN) / 100);
    check("bagian perujuk dicatat saat bayar", ref?.uid === p.perujuk.uid && ref?.amount === harapRef && ref?.source === "premium", JSON.stringify(ref));

    const ulang = await postWebhook(notification(order1, HARGA, "settlement"));
    check("notifikasi ganda dijawab 200", ulang === 200, `HTTP ${ulang}`);
    per = await periodeMilik(p.a.uid);
    check("notifikasi ganda tidak menggandakan periode", per.length === 1, `${per.length} periode`);
    check("masa aktif tidak bertambah oleh notifikasi ganda", (await anggota(p.a.uid))?.activeUntil === p1.end, "tetap");
    const refUlang = (await db.collection("royaltyEarnings").where("uid", "==", p.perujuk.uid).get()).size;
    check("bagian perujuk tidak tergandakan", refUlang === 1, `${refUlang} dokumen`);

    const gagal = await postWebhook(notification(order1, HARGA, "expire"));
    check("kabar gagal setelah lunas dijawab 200", gagal === 200, `HTTP ${gagal}`);
    check("kabar gagal setelah lunas tidak mencabut premium", (await anggota(p.a.uid))?.activeUntil === p1.end, "dicatat di postPaidStatus saja");

    // Pembelian kedua saat masih aktif: menumpuk di belakang tanggal berakhir.
    await seedPremiumOrder(order2, p.a, HARGA, null);
    check("pembelian kedua diterima", (await postWebhook(notification(order2, HARGA, "settlement"))) === 200, "HTTP 200");
    per = await periodeMilik(p.a.uid);
    const p2 = per.find((x) => x.periodId === order2);
    check("pembelian kedua menumpuk (mulai = akhir periode pertama)", p2?.start === p1.end, `${p2?.start} vs ${p1.end}`);
    check("masa aktif kini ±60 hari", Math.abs(selisihHari(new Date().toISOString(), String((await anggota(p.a.uid))?.activeUntil)) - 2 * PREMIUM_HARI) < 0.01, "activeUntil");
    check("pembelian tanpa referral tidak mencatat perujuk", !(await db.collection("royaltyEarnings").doc(`${order2}_referral`).get()).exists, "tanpa dokumen");
  }

  // ── Cakupan enrollPremium ───────────────────────────────────────────
  {
    check("kursus gratis tidak lewat Premium", (await ikut(p.a, gratis)).includes("gratis"), "jalurnya enrollFree");
    check("kursus privat tidak termasuk Premium", (await ikut(p.a, privat)).includes("tidak termasuk Premium"), "visibility private");
    check("kursus tak dikenal ditolak", (await ikut(p.a, `tidak-ada-${randomUUID().slice(0, 6)}`)).includes("tidak ditemukan"), "slug ngawur");

    const beri = await callAction("/admin/premium", grantId, [p.pemilik.email, 3, "uji"], p.admin.cookie);
    check("admin memberi premium (via email)", beri.includes("Premium diberikan 3 hari"), "pesan hasil");
    const beriPer = await periodeMilik(p.pemilik.uid);
    check("pemberian admin = periode gross 0", beriPer.length === 1 && beriPer[0].source === "admin" && beriPer[0].gross === 0, JSON.stringify(beriPer.map((x) => [x.source, x.gross])));
    check("kursus milik sendiri tidak lewat Premium", (await ikut(p.pemilik, c1)).includes("kursus Anda sendiri"), "ownerUid");
  }

  // ── Akses penuh + pemakaian dihitung sekali per pelajaran ───────────
  {
    check("halaman kursus menawarkan Pelajari dengan Premium", (await probeText(`/courses/${c1}`, p.a.cookie)).html.includes("Pelajari dengan Premium"), "premium aktif");
    const ok = await ikut(p.a, c1);
    check("anggota premium membuka kursus berbayar", ok.includes("Kursus terbuka lewat Premium"), "pesan hasil");
    const e = await daftar(p.a.uid, c1);
    const aktifSampai = (await anggota(p.a.uid))?.activeUntil;
    check("pendaftaran bersumber premium", e?.source === "premium" && e?.pricePaid === 0, `source=${e?.source}`);
    check("expiresAt pendaftaran = masa aktif premium", e?.expiresAt === aktifSampai, `${e?.expiresAt} vs ${aktifSampai}`);

    check("tandai pelajaran 1 berhasil", !(await tandai(p.a, c1, "satu")).includes("belum terdaftar"), "akses penuh");
    check("pemakaian tercatat di periode berjalan", (await pemakaian(order1, c1))?.lessons === 1, JSON.stringify(await pemakaian(order1, c1)));
    await tandai(p.a, c1, "satu");
    check("menandai ulang pelajaran yang sama tidak menambah pemakaian", (await pemakaian(order1, c1))?.lessons === 1, String((await pemakaian(order1, c1))?.lessons));
    await tandai(p.a, c1, "dua");
    check("pelajaran kedua menambah pemakaian", (await pemakaian(order1, c1))?.lessons === 2, String((await pemakaian(order1, c1))?.lessons));
    const u = await pemakaian(order1, c1);
    check("pemilik & kontributor dibekukan di pemakaian", u?.ownerUid === p.pemilik.uid && u?.contributors?.length === 2, JSON.stringify(u?.contributors));
    check("periode tumpukan (belum mulai) tidak menerima pemakaian", !(await pemakaian(order2, c1)), "hanya periode berjalan");

    check("kursus kedua juga terbuka", (await ikut(p.a, c2)).includes("Kursus terbuka lewat Premium"), "enrollPremium");
    await tandai(p.a, c2, "satu");
    check("pemakaian kursus kedua tercatat", (await pemakaian(order1, c2))?.lessons === 1, "lessons 1");

    const lagi = await ikut(p.a, c1);
    check("enrollPremium ulang aman", lagi.includes("dibuka kembali"), "pendaftaran premium disamakan");
  }

  // ── Cabut: akses berhenti, kemajuan tetap ───────────────────────────
  {
    const cabut = await callAction("/admin/premium", revokeId, [p.a.uid, "uji cabut"], p.admin.cookie);
    check("admin mencabut premium (via UID)", cabut.includes("Premium dicabut"), "pesan hasil");
    const m = await anggota(p.a.uid);
    check("masa aktif berakhir sekarang", dekat(m?.activeUntil), String(m?.activeUntil));
    const e = await daftar(p.a.uid, c1);
    check("pendaftaran premium ikut berakhir", e?.expiresAt === m?.activeUntil, `${e?.expiresAt}`);
    check("kemajuan tetap tersimpan", Array.isArray(e?.completedLessons) && e.completedLessons.length === 2, JSON.stringify(e?.completedLessons));
    check("setelah dicabut, pelajaran tidak bisa ditandai", (await tandai(p.a, c1, "tiga")).includes("belum terdaftar"), "isActive(expiresAt)");
    check("enrollPremium ditolak setelah dicabut", (await ikut(p.a, c1)).includes("tidak aktif"), "getPremium");
    const per = await periodeMilik(p.a.uid);
    const p1 = per.find((x) => x.periodId === order1);
    const p2 = per.find((x) => x.periodId === order2);
    check("periode berjalan dipotong di detik pencabutan", p1?.end === m?.activeUntil && p1?.revokedAt, `${p1?.end}`);
    check("periode yang belum mulai dipotong jadi nol", p2 !== undefined && p2.end === p2.start, `${p2?.start} → ${p2?.end}`);
    check("halaman kursus memberi tahu premium berakhir", (await probeText(`/courses/${c1}`, p.a.cookie)).html.includes("Premium Anda sudah berakhir"), "premiumBerakhir");
    const dua = await callAction("/admin/premium", revokeId, [p.a.uid, ""], p.admin.cookie);
    check("mencabut yang sudah tidak aktif ditolak", dua.includes("sedang tidak premium"), "cabutPremium false");
  }

  // ── Bagi hasil sesuai pemakaian ─────────────────────────────────────
  {
    const belum = await bagiHasilPeriode(db, order2, new Date(Date.now() - 1_000));
    check("periode yang belum berakhir tidak dibagi", belum.hasil === "belum-berakhir", belum.hasil);

    const r = await bagiHasilPeriode(db, order1, new Date());
    check("periode berakhir dibagi", r.hasil === "dibagi", r.hasil);
    const fee = Math.floor((HARGA * FEE) / 100); // 18.000
    const ref = Math.floor((HARGA * REF_PERSEN) / 100); // 6.000
    const pool = HARGA - fee; // 42.000 → 2:1 untuk c1:c2
    const harap = new Map([
      [p.pemilik.uid, Math.round((pool * 2) / 3 * 0.7)], // 19.600
      [p.kontributor.uid, Math.round((pool * 2) / 3 * 0.3)], // 8.400
      [p.pemilik2.uid, pool / 3], // 14.000
    ]);
    for (const [uid, jumlah] of harap) {
      const snap = await db.collection("royaltyEarnings").where("uid", "==", uid).get();
      const total = snap.docs.reduce((n, d) => n + Number(d.data().amount), 0);
      const semuaPremium = snap.docs.every((d) => d.data().source === "premium");
      check(`pendapatan ${uid === p.pemilik.uid ? "pemilik" : uid === p.kontributor.uid ? "kontributor" : "pemilik kursus 2"} = ${jumlah}`, total === jumlah && semuaPremium, `total=${total}`);
    }
    const s = (await db.collection(PREMIUM_SETTLEMENTS).doc(order1).get()).data();
    const educator = (s?.lines ?? []).reduce((n: number, l: { amount: number }) => n + l.amount, 0);
    check("ringkasan: perujuk dari potongan, sisa potongan ke platform", s?.referralAmount === ref && s?.platformAmount === fee - ref && s?.feeAmount === fee, JSON.stringify({ r: s?.referralAmount, p: s?.platformAmount }));
    check("Σ educator + perujuk + platform + belum teralokasi = dibayar", educator + s?.referralAmount + s?.platformAmount + s?.unallocatedAmount === HARGA, `Σ=${educator + s?.referralAmount + s?.platformAmount + s?.unallocatedAmount}`);
    check("periode ditandai settledAt", typeof (await db.collection(PREMIUM_PERIODS).doc(order1).get()).data()?.settledAt === "string", "settledAt");

    const ulang = await bagiHasilPeriode(db, order1, new Date());
    check("membagi ulang tidak membayar dua kali", ulang.hasil === "sudah", ulang.hasil);
    const n = (await db.collection("royaltyEarnings").where("uid", "==", p.pemilik.uid).get()).size;
    check("pendapatan pemilik tetap satu dokumen", n === 1, `${n} dokumen`);

    const pend = await probeText("/dashboard/pendapatan", p.pemilik.cookie);
    check("pendapatan premium tampil di halaman Pendapatan educator", pend.html.includes("19.600") && pend.html.includes("Premium"), "royaltyDashboard");
  }

  // ── Diberi lagi: akses kembali dari posisi terakhir ─────────────────
  {
    const beri = await callAction("/admin/premium", grantId, [p.a.email, 7, ""], p.admin.cookie);
    check("premium diberikan lagi", beri.includes("Premium diberikan 7 hari"), "pesan hasil");
    const m = await anggota(p.a.uid);
    check("masa aktif baru mulai sekarang (bukan menumpuk di periode terpotong)", Math.abs(selisihHari(new Date().toISOString(), String(m?.activeUntil)) - 7) < 0.01, String(m?.activeUntil));
    check("pendaftaran premium lama ikut disamakan", (await daftar(p.a.uid, c1))?.expiresAt === m?.activeUntil, "samakanPendaftaranPremium");
    check("bisa lanjut ke pelajaran berikutnya", !(await tandai(p.a, c1, "tiga")).includes("belum terdaftar"), "akses kembali");
    const e = await daftar(p.a.uid, c1);
    check("kemajuan lanjut dari posisi terakhir", e?.completedLessons?.length === 3, JSON.stringify(e?.completedLessons));
    const halaman = await probeText("/premium", p.a.cookie);
    check("/premium menampilkan status aktif", halaman.html.includes("Premium aktif"), "status anggota");
  }

  // ── Membeli kursus yang dipelajari lewat premium → naik ke paid ─────
  {
    const orderKursus = `SYN-uji-c2-${randomUUID().slice(0, 8)}`;
    await seedCourseOrder(orderKursus, p.a, c2, 120_000);
    check("pembayaran kursus diterima", (await postWebhook(notification(orderKursus, 120_000, "settlement"))) === 200, "HTTP 200");
    const e = await daftar(p.a.uid, c2);
    check("pendaftaran naik ke paid", e?.source === "paid" && e?.expiresAt === null && e?.orderId === orderKursus, `source=${e?.source} expiresAt=${e?.expiresAt}`);
    check("kemajuan dipertahankan saat naik ke paid", e?.completedLessons?.length === 1, JSON.stringify(e?.completedLessons));
    // Premium (pemberian admin) masih berjalan: pelajaran kursus yang sudah
    // DIBELI tidak boleh ikut dihitung ke periode itu.
    const berjalan = (await periodeMilik(p.a.uid)).find((x) => x.source === "admin");
    await tandai(p.a, c2, "dua");
    check("pelajaran kursus yang dibeli tidak dihitung premium", !!berjalan && !(await pemakaian(String(berjalan.periodId), c2)), String(berjalan?.periodId));
    const cabut = await callAction("/admin/premium", revokeId, [p.a.uid, ""], p.admin.cookie);
    check("pencabutan berikutnya", cabut.includes("Premium dicabut"), "pesan hasil");
    check("kursus yang dibeli TIDAK ikut terkunci saat premium dicabut", (await daftar(p.a.uid, c2))?.expiresAt === null, "source paid tak disentuh");
    check("kursus yang dibeli tetap bisa dipelajari", !(await tandai(p.a, c2, "tiga")).includes("belum terdaftar"), "akses paid");
  }

  // ── Halaman admin ───────────────────────────────────────────────────
  {
    const tamu = await probe("/admin/premium", p.biasa.cookie);
    check("/admin/premium tertutup untuk bukan admin", tamu.status >= 300 && tamu.status < 400, `HTTP ${tamu.status}`);
    const adm = await probeText("/admin/premium", p.admin.cookie);
    check("/admin/premium terbuka untuk admin", adm.status === 200 && adm.html.includes("Bagi hasil ke educator"), `HTTP ${adm.status}`);
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const settingsRef = db.collection("settings").doc("payments");
  const settingsAwal = await settingsRef.get();

  const peran: Peran = {
    admin: await createTestUser("admin", "prem-admin"),
    pemilik: await createTestUser("educator", "prem-pemilik"),
    kontributor: await createTestUser("educator", "prem-kontrib"),
    pemilik2: await createTestUser("educator", "prem-pemilik2"),
    perujuk: await createTestUser("user", "prem-perujuk"),
    a: await createTestUser("user", "prem-a"),
    b: await createTestUser("user", "prem-b"),
    biasa: await createTestUser("user", "prem-biasa"),
  };
  const uids = Object.values(peran).map((u) => u.uid);
  const id = randomUUID().slice(0, 8);
  const slugs = { c1: `verify-prem1-${id}`, c2: `verify-prem2-${id}`, gratis: `verify-premg-${id}`, privat: `verify-premp-${id}` };
  const kode = `VRF${id.toUpperCase().replace(/[^A-Z0-9]/g, "")}`.slice(0, 12);

  try {
    await settingsRef.set({ platformFeePercent: FEE, referralPercent: REF_PERSEN, midtransEnabled: true }, { merge: true });
    await db.collection("courses").doc(slugs.c1).set(courseDoc(slugs.c1, 150_000, peran.pemilik.uid, [{ uid: peran.kontributor.uid, share: 30 }]));
    await db.collection("courses").doc(slugs.c2).set(courseDoc(slugs.c2, 120_000, peran.pemilik2.uid));
    await db.collection("courses").doc(slugs.gratis).set(courseDoc(slugs.gratis, 0, peran.pemilik.uid));
    await db.collection("courses").doc(slugs.privat).set(courseDoc(slugs.privat, 90_000, peran.pemilik.uid, [], "private"));
    await db.collection("referralCodes").doc(kode).set({ uid: peran.perujuk.uid, createdAt: new Date().toISOString() });

    await run(peran, slugs, kode);
  } finally {
    // Setelan dipulihkan PERSIS - termasuk tidak ada dokumen bila awalnya tidak ada.
    if (settingsAwal.exists) await settingsRef.set(settingsAwal.data()!);
    else await settingsRef.delete();

    for (const s of Object.values(slugs)) {
      await db.collection("courses").doc(s).delete().catch(() => undefined);
      for (const c of ["orders", "enrollments", "royaltySales", "royaltyEarnings", "certificates"]) {
        const snap = await db.collection(c).where("courseSlug", "==", s).get();
        for (const d of snap.docs) await d.ref.delete().catch(() => undefined);
      }
    }
    for (const uid of uids) {
      for (const c of ["orders", "royaltyEarnings", PREMIUM_PERIODS, PREMIUM_USAGE, PREMIUM_SETTLEMENTS, "enrollments", "certificates"]) {
        const snap = await db.collection(c).where("uid", "==", uid).get();
        for (const d of snap.docs) await d.ref.delete().catch(() => undefined);
      }
      await db.collection(PREMIUM_MEMBERS).doc(uid).delete().catch(() => undefined);
      await db.collection("users").doc(uid).delete().catch(() => undefined);
    }
    await db.collection("referralCodes").doc(kode).delete().catch(() => undefined);
    await bucket.file(QRIS_PATH).delete().catch(() => undefined);
    await auth.deleteUsers(uids);
    console.log("\nakun, kursus, pesanan, periode & setelan uji dibersihkan.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
