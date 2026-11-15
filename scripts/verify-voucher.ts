/**
 * Menguji voucher dari ujung ke ujung terhadap server yang berjalan:
 *
 *   - hanya admin yang membuat/mengubah/menghapus voucher;
 *   - harga pesanan = harga normal - potongan, dihitung SERVER (kode dinilai
 *     ulang setiap pesanan dibuat; pratinjau browser bukan bukti);
 *   - cakupan (kursus / kategori / Premium), akun khusus, kuota, batas per
 *     akun - termasuk pesanan tertunda yang menahan kuota;
 *   - pemakaian dihitung TEPAT SEKALI saat lunas (QRIS disetujui admin,
 *     webhook Midtrans, diulang = tidak bertambah);
 *   - bagi hasil dihitung dari uang yang dibayar (potongan dibagi rata);
 *   - voucher 100% membuka kursus/Premium tanpa pembayaran, dua klik
 *     bersamaan tetap satu pemakaian.
 *
 * Butuh dev server berjalan (npm run dev) dengan MIDTRANS_SERVER_KEY yang sama.
 *
 *   npx tsx scripts/verify-voucher.ts [baseUrl]
 *
 * `settings/payments` disalin di awal dan dipulihkan PERSIS di akhir.
 */
import { createHash, randomUUID } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { BASE, actionId, app, auth, callAction, check, createTestUser, finish, probe, probeText, readEnv, type TestUser } from "./testSupport";
import { targetLabel } from "./project";
import { PREMIUM_MEMBERS, PREMIUM_PERIODS } from "../frontend/src/lib/premiumCore";
import { VOUCHERS, VOUCHER_REDEMPTIONS, type MasukanVoucher } from "../frontend/src/lib/voucherRules";

const db = getFirestore(app);
const bucket = getStorage(app).bucket(readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"));
const SERVER_KEY = readEnv("MIDTRANS_SERVER_KEY");
const WEBHOOK = "/api/payments/midtrans/notification";
const FEE = 30;
const QRIS_PATH = `payment-qris/verify-voucher-${randomUUID().slice(0, 8)}.png`;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

function courseDoc(slug: string, price: number, owner: string, category: string) {
  const now = new Date().toISOString();
  return {
    slug,
    title: `Kursus Uji Voucher ${slug.slice(-6)}`,
    shortDesc: "Dibuat verify-voucher, akan dihapus.",
    longDesc: "x",
    level: "Pemula",
    levelColor: "green",
    category,
    icon: "reading",
    tint: "bg-blue-50",
    duration: "1 jam",
    rating: 0,
    reviews: 0,
    price,
    thumbnail: null,
    enrolledStudents: 0,
    lastUpdated: now,
    instructorName: "Uji Voucher",
    instructorBio: "",
    whatYouLearn: [],
    requirements: [],
    sections: [{ title: "Bagian", position: 0, lessons: [{ slug: "satu", title: "Satu", type: "reading", duration: "5 menit", position: 0 }] }],
    order: 9999,
    visibility: "public",
    ownerUid: owner,
    ownerName: "Uji Pemilik",
    contributors: [{ uid: owner, share: 100 }],
    contributorUids: [owner],
    createdAt: now,
  };
}

function notification(orderId: string, amount: number, status: string) {
  const statusCode = "200";
  const grossAmount = `${amount}.00`;
  return {
    order_id: orderId,
    status_code: statusCode,
    gross_amount: grossAmount,
    transaction_status: status,
    payment_type: "qris",
    fraud_status: "accept",
    signature_key: createHash("sha512").update(orderId + statusCode + grossAmount + SERVER_KEY).digest("hex"),
  };
}

const postWebhook = async (body: unknown) =>
  (await fetch(`${BASE}${WEBHOOK}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).status;

const voucherDoc = async (code: string) => (await db.collection(VOUCHERS).doc(code).get()).data();
const pemakaian = async (code: string) => (await db.collection(VOUCHER_REDEMPTIONS).where("code", "==", code).get()).docs.map((d) => d.data());
const pesananAkun = async (uid: string) => (await db.collection("orders").where("uid", "==", uid).get()).docs.map((d) => d.data());
const daftar = async (uid: string, slug: string) => (await db.collection("enrollments").doc(`${uid}_${slug}`).get()).data();

function masukan(code: string, x: Partial<MasukanVoucher> = {}): MasukanVoucher {
  return {
    code,
    note: "verify-voucher",
    active: true,
    jenis: "persen",
    nilai: 20,
    maksPotongan: null,
    premium: false,
    semuaKursus: false,
    kursus: [],
    kategori: [],
    mulai: null,
    berakhir: null,
    kuota: null,
    batasPerAkun: 1,
    minHarga: 0,
    khususEmail: [],
    pembelianPertama: false,
    ...x,
  };
}

interface Peran {
  admin: TestUser;
  pemilik: TestUser;
  a: TestUser;
  b: TestUser;
  c: TestUser;
  d: TestUser;
}

async function run(p: Peran, s: { c1: string; c2: string; c3: string; kat: string }, K: (n: string) => string) {
  const { c1, c2, c3, kat } = s;
  await probe(`/courses/${c1}`, p.a.cookie);
  await probe("/premium", p.a.cookie);
  await probe("/admin/vouchers/new", p.admin.cookie);
  await probe("/admin/payments", p.admin.cookie);

  const simpanId = await actionId("admin/vouchers/new", "simpanVoucher");
  const cekId = await actionId(`courses/[slug]`, "cekVoucher");
  const klaimId = await actionId(`courses/[slug]`, "klaimVoucherGratis");
  const manualId = await actionId(`courses/[slug]`, "createManualOrder");
  const buktiId = await actionId(`courses/[slug]`, "submitPaymentProof");
  const putusId = await actionId("admin/payments", "decideManualOrder");
  const premiumManualId = await actionId("premium", "createManualPremiumOrder");
  const klaimPremiumId = await actionId("premium", "klaimVoucherGratis");

  const simpan = (u: TestUser | null, m: MasukanVoucher, mode: "baru" | "ubah" = "baru") => callAction("/admin/vouchers/new", simpanId, [m, mode], u?.cookie);
  const cek = (u: TestUser | null, code: string, slug: string) => callAction(`/courses/${slug}`, cekId, [code, { kind: "course", slug }], u?.cookie);
  const pesan = (u: TestUser, slug: string, code: string) => callAction(`/courses/${slug}`, manualId, [slug, "", code], u.cookie);
  const klaim = (u: TestUser, code: string, slug: string) => callAction(`/courses/${slug}`, klaimId, [code, { kind: "course", slug }], u.cookie);

  const V1 = K("A"); // 20% untuk c1 + c2, sekali per akun, kuota 2
  const V2 = K("B"); // kategori kat (c3), 25.000
  const V3 = K("C"); // Premium 100%
  const V4 = K("D"); // 100% c3, khusus akun b
  const V5 = K("E"); // tak pernah dipakai, untuk dihapus
  const V6 = K("F"); // kuota 1 untuk menguji pesanan tertunda menahan kuota

  // ── Penjaga ────────────────────────────────────────────────────────
  {
    const r = await simpan(p.a, masukan(V1, { kursus: [c1, c2] }));
    check("bukan admin tidak bisa membuat voucher", r.includes("Hanya admin yang dapat mengelola voucher"), "simpanVoucher");
    check("educator juga tidak bisa", (await simpan(p.pemilik, masukan(V1, { kursus: [c1, c2] }))).includes("Hanya admin yang dapat mengelola voucher"), "educator");
    check("voucher tertolak tidak ditulis", !(await voucherDoc(V1)), "Firestore");
    check("anonim tidak bisa memeriksa voucher", (await cek(null, V1, c1)).includes("Silakan masuk terlebih dahulu."), "cekVoucher");
  }

  // ── Admin membuat voucher ──────────────────────────────────────────
  {
    const r = await simpan(p.admin, masukan(V1.toLowerCase(), { kursus: [c1, c2], kuota: 2 }));
    check("admin membuat voucher (kode dinormalkan huruf besar)", r.includes(`Voucher ${V1} dibuat.`) && (await voucherDoc(V1))?.dipakai === 0, r.slice(0, 160));
    check("kode ganda ditolak", (await simpan(p.admin, masukan(V1, { kursus: [c1] }))).includes("Kode itu sudah dipakai voucher lain."), "create code 6");
    check("masukan salah ditolak server", (await simpan(p.admin, masukan(K("X"), { nilai: 0, kursus: [c1] }))).includes("Potongan persen harus bilangan bulat 1 sampai 100."), "nilai 0");
    check("voucher salah tidak tertulis", !(await voucherDoc(K("X"))), "Firestore");
    const hantu = await simpan(p.admin, masukan(K("Y"), { kursus: [c1], khususEmail: [`tak-ada-${randomUUID().slice(0, 6)}@synaped.test`] }));
    check("email akun khusus yang tak ada ditolak", hantu.includes("Akun tidak ditemukan"), "getUsers");
    for (const [code, m] of [
      [V2, masukan(V2, { jenis: "nominal", nilai: 25_000, kategori: [kat] })],
      [V3, masukan(V3, { nilai: 100, premium: true })],
      [V4, masukan(V4, { nilai: 100, kursus: [c3], khususEmail: [p.b.email] })],
      [V5, masukan(V5, { kursus: [c1] })],
      [V6, masukan(V6, { kursus: [c1], kuota: 1 })],
    ] as const) {
      const out = await simpan(p.admin, m);
      if (!out.includes(`Voucher ${code} dibuat.`)) check(`buat ${code}`, false, out.slice(0, 200));
    }
    const v4 = await voucherDoc(V4);
    check("email akun khusus disimpan sebagai uid", Array.isArray(v4?.khususUid) && v4.khususUid[0] === p.b.uid, JSON.stringify(v4?.khususUid));
  }

  // ── Pratinjau ──────────────────────────────────────────────────────
  {
    const r = await cek(p.a, V1.toLowerCase(), c1);
    check("pratinjau: harga dari kursus, potongan 20%", r.includes('"akhir":80000') && r.includes('"potongan":20000'), r.slice(-160));
    check("kode tak dikenal", (await cek(p.d, K("ZZ"), c1)).includes("Kode voucher tidak dikenal."), "tak dikenal");
    check("kursus di luar cakupan", (await cek(p.d, V2, c1)).includes("Voucher ini tidak berlaku untuk kursus ini."), "kategori");
    check("kategori: berlaku untuk kursus di kategori itu", (await cek(p.a, V2, c3)).includes('"akhir":95000'), "c3 120.000 - 25.000");
  }

  // ── Pesanan QRIS dengan voucher: harga dihitung server ─────────────
  let orderA = "";
  {
    const r = await pesan(p.a, c1, V1);
    const live = (await pesananAkun(p.a.uid)).filter((o) => o.courseSlug === c1 && o.status === "pending");
    const o = live[0];
    orderA = o?.orderId ?? "";
    check("pesanan dibuat", r.includes("Pesanan dibuat.") && live.length === 1, r.slice(0, 120));
    check("nominal pesanan = harga - potongan (bukan dari browser)", o?.amount === 80_000, String(o?.amount));
    check("potongan dibekukan di pesanan", o?.voucher?.code === V1 && o.voucher.original === 100_000 && o.voucher.discount === 20_000 && o.voucherCode === V1, JSON.stringify(o?.voucher));
    check("pesanan tertunda BELUM menghitung pemakaian", (await voucherDoc(V1))?.dipakai === 0 && (await pemakaian(V1)).length === 0, "dipakai 0");

    const ulang = await pesan(p.a, c1, V1);
    check("voucher sama = pesanan lama dipakai ulang", ulang.includes("Melanjutkan pesanan") && (await pesananAkun(p.a.uid)).filter((x) => x.status === "pending").length === 1, "reuse");

    // Pesanan hidup untuk c1 menahan satu-satunya jatah akun ini.
    check("pesanan tertunda menahan jatah per akun (kursus lain)", (await cek(p.a, V1, c2)).includes("Anda sudah memakai voucher ini."), "reservasi");

    const tanpa = await pesan(p.a, c1, "");
    const semua = await pesananAkun(p.a.uid);
    const lama = semua.find((x) => x.orderId === orderA);
    const baru = semua.find((x) => x.status === "pending");
    check("voucher dihapus = pesanan lama hangus, nominal kembali normal", tanpa.includes("Pesanan dibuat.") && lama?.status === "expired" && baru?.amount === 100_000 && !baru.voucherCode, JSON.stringify({ l: lama?.status, b: baru?.amount }));
    const lagi = await pesan(p.a, c1, V1);
    const akhir = (await pesananAkun(p.a.uid)).filter((x) => x.status === "pending");
    orderA = akhir[0]?.orderId ?? "";
    check("voucher dipasang lagi = pesanan baru 80.000", lagi.includes("Pesanan dibuat.") && akhir.length === 1 && akhir[0].amount === 80_000, String(akhir[0]?.amount));
  }

  // ── QRIS disetujui: pemakaian & bagi hasil ─────────────────────────
  {
    const bukti = await callAction(`/courses/${c1}`, buktiId, [orderA, `payment-proofs/${p.a.uid}/${orderA}.png`, "jam 10.00"], p.a.cookie);
    check("bukti terkirim", bukti.includes("Bukti terkirim"), bukti.slice(0, 100));
    const setuju = await callAction("/admin/payments", putusId, [orderA, "approve", ""], p.admin.cookie);
    check("admin menyetujui", setuju.includes("Pembayaran disetujui dan akses dibuka."), setuju.slice(0, 150));
    const v = await voucherDoc(V1);
    const red = await pemakaian(V1);
    check("pemakaian dihitung sekali saat lunas", v?.dipakai === 1 && v.totalPotongan === 20_000 && red.length === 1 && red[0].orderId === orderA && red[0].paid === 80_000, JSON.stringify({ d: v?.dipakai, n: red.length }));
    const e = await daftar(p.a.uid, c1);
    check("akses terbuka dengan harga bayar 80.000", e?.source === "paid" && e.pricePaid === 80_000, JSON.stringify({ s: e?.source, p: e?.pricePaid }));
    const sale = (await db.collection("royaltySales").doc(orderA).get()).data();
    const earn = (await db.collection("royaltyEarnings").doc(`${orderA}_${p.pemilik.uid}`).get()).data();
    check("bagi hasil dari uang yang dibayar (dibagi rata)", sale?.gross === 80_000 && sale.feeAmount === 24_000 && earn?.amount === 56_000, JSON.stringify({ g: sale?.gross, f: sale?.feeAmount, e: earn?.amount }));
    await callAction("/admin/payments", putusId, [orderA, "approve", ""], p.admin.cookie);
    check("setujui ganda tidak menambah pemakaian", (await voucherDoc(V1))?.dipakai === 1 && (await pemakaian(V1)).length === 1, "idempoten");
    check("setelah lunas, akun ini sudah memakai jatahnya", (await cek(p.a, V1, c2)).includes("Anda sudah memakai voucher ini."), "batas per akun");
  }

  // ── Webhook Midtrans: pemakaian tepat sekali, kuota habis ──────────
  {
    const orderId = `SYN-vch-${p.b.uid.slice(0, 6)}-${Date.now().toString(36)}`;
    const now = new Date();
    await db.collection("orders").doc(orderId).set({
      orderId,
      uid: p.b.uid,
      userEmail: p.b.email,
      userName: "Uji b",
      kind: "course",
      courseSlug: c2,
      courseTitle: "Kursus Uji Voucher",
      amount: 64_000,
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
      royalty: { feePercent: FEE, ownerUid: p.pemilik.uid, contributors: [{ uid: p.pemilik.uid, share: 100 }], referral: null, capturedAt: now.toISOString() },
      voucher: { code: V1, original: 80_000, discount: 16_000 },
      voucherCode: V1,
    });
    check("cek kuota: pesanan Midtrans tertunda b ikut menahan kuota", (await cek(p.c, V1, c1)).includes("Kuota voucher ini sudah habis."), "1 lunas + 1 tertunda = 2");
    const st = await postWebhook(notification(orderId, 64_000, "settlement"));
    const st2 = await postWebhook(notification(orderId, 64_000, "settlement"));
    const v = await voucherDoc(V1);
    check("webhook lunas mencatat pemakaian", st === 200 && v?.dipakai === 2 && (await pemakaian(V1)).length === 2, `${st} dipakai=${v?.dipakai}`);
    check("notifikasi berulang tidak menambah", st2 === 200 && v?.totalPotongan === 36_000, String(v?.totalPotongan));
    check("kuota 2 habis untuk akun ketiga", (await cek(p.c, V1, c1)).includes("Kuota voucher ini sudah habis."), "kuota");
  }

  // ── Pesanan tertunda menahan kuota ─────────────────────────────────
  {
    const r = await pesan(p.b, c1, V6);
    check("b memesan dengan voucher kuota 1", r.includes("Pesanan dibuat."), r.slice(0, 100));
    check("akun lain tertahan selama pesanan b menunggu", (await cek(p.c, V6, c1)).includes("Kuota voucher ini sudah habis."), "reservasi kuota");
    const c = await pesan(p.c, c1, V6);
    check("pembuatan pesanan juga menolaknya (bukan hanya pratinjau)", c.includes("Kuota voucher ini sudah habis.") && !(await pesananAkun(p.c.uid)).some((o) => o.voucherCode === V6), "createManualOrder");
  }

  // ── Voucher 100%: kursus ───────────────────────────────────────────
  {
    check("akun di luar daftar khusus ditolak", (await cek(p.a, V4, c3)).includes("Voucher ini tidak berlaku untuk akun Anda."), "khususUid");
    check("voucher gratis tidak bisa lewat pesanan bayar", (await pesan(p.b, c3, V4)).includes("Voucher ini menggratiskan kursus - tekan tombol Ambil Gratis."), "akhir 0");
    check("klaim gratis dengan voucher persen 20 ditolak", (await klaim(p.d, V2, c3)).includes("Voucher ini tidak menggratiskan pembelian"), "bukan gratis");
    const [k1, k2] = await Promise.all([klaim(p.b, V4, c3), klaim(p.b, V4, c3)]);
    const e = await daftar(p.b.uid, c3);
    check("klaim gratis membuka kursus", (k1 + k2).includes("Kursus terbuka dengan voucher.") && e?.source === "paid" && e.pricePaid === 0, JSON.stringify({ s: e?.source, p: e?.pricePaid }));
    const red = await pemakaian(V4);
    check("dua klik bersamaan = satu pemakaian", red.length === 1 && (await voucherDoc(V4))?.dipakai === 1, `n=${red.length}`);
    const o = (await pesananAkun(p.b.uid)).filter((x) => x.voucherCode === V4);
    check("dicatat sebagai pesanan lunas Rp0 metode voucher", o.length === 1 && o[0].status === "paid" && o[0].amount === 0 && o[0].method === "voucher", JSON.stringify(o.map((x) => [x.status, x.amount, x.method])));
    check("voucher gratis tidak menulis penjualan Rp0", !(await db.collection("royaltySales").doc(o[0]?.orderId ?? "-").get()).exists, "royaltySales");
  }

  // ── Voucher 100%: Premium ──────────────────────────────────────────
  {
    const m = await callAction("/premium", premiumManualId, ["", V3], p.d.cookie);
    check("Premium gratis tidak bisa lewat QRIS", m.includes("Voucher ini menggratiskan Premium - tekan tombol Ambil Gratis."), m.slice(0, 120));
    const k = await callAction("/premium", klaimPremiumId, [V3, { kind: "premium" }], p.d.cookie);
    const member = (await db.collection(PREMIUM_MEMBERS).doc(p.d.uid).get()).data();
    const periode = (await db.collection(PREMIUM_PERIODS).where("uid", "==", p.d.uid).get()).docs.map((x) => x.data());
    check("Premium aktif dengan voucher", k.includes("Premium aktif dengan voucher.") && typeof member?.activeUntil === "string" && Date.parse(member.activeUntil) > Date.now(), k.slice(0, 120));
    check("periode Premium bersumber voucher, gross 0", periode.length === 1 && periode[0].source === "voucher" && periode[0].gross === 0, JSON.stringify(periode.map((x) => [x.source, x.gross])));
    // Kembaran klik yang tiba SEBELUM pemakaian pertama tercatat: dihitung ulang
    // dengan menghapus catatannya. ID pesanan deterministik harus membuatnya
    // jatuh ke pesanan & periode yang SAMA, bukan memberi Premium dua kali.
    const red = await db.collection(VOUCHER_REDEMPTIONS).where("code", "==", V3).get();
    for (const x of red.docs) await x.ref.delete();
    await db.collection(VOUCHERS).doc(V3).update({ dipakai: 0, totalPotongan: 0 });
    const kembar = await callAction("/premium", klaimPremiumId, [V3, { kind: "premium" }], p.d.cookie);
    const periode2 = (await db.collection(PREMIUM_PERIODS).where("uid", "==", p.d.uid).get()).size;
    const pesanan2 = (await pesananAkun(p.d.uid)).filter((x) => x.voucherCode === V3).length;
    check("klaim kembar sebelum pemakaian tercatat tidak menggandakan Premium", kembar.includes("Premium aktif dengan voucher.") && periode2 === 1 && pesanan2 === 1 && (await voucherDoc(V3))?.dipakai === 1, JSON.stringify({ periode2, pesanan2 }));
    const lagi = await callAction("/premium", klaimPremiumId, [V3, { kind: "premium" }], p.d.cookie);
    check("klaim kedua ditolak (sekali per akun)", lagi.includes("Anda sudah memakai voucher ini.") && (await db.collection(PREMIUM_PERIODS).where("uid", "==", p.d.uid).get()).size === 1, "batas");
    const kursusPakaiPremium = await cek(p.d, V3, c1);
    check("voucher Premium tidak berlaku untuk kursus", kursusPakaiPremium.includes("Voucher ini tidak berlaku untuk kursus ini."), "cakupan");
  }

  // ── Nonaktif, hapus, halaman admin ─────────────────────────────────
  {
    const aktifId = await (async () => {
      await probe(`/admin/vouchers/${V5}`, p.admin.cookie);
      return actionId("admin/vouchers/[kode]", "aturVoucherAktif");
    })();
    const hapusId = await actionId("admin/vouchers/[kode]", "hapusVoucher");
    check("bukan admin tidak bisa menonaktifkan", (await callAction(`/admin/vouchers/${V2}`, aktifId, [V2, false], p.a.cookie)).includes("Hanya admin yang dapat mengelola voucher"), "aturVoucherAktif");
    const off = await callAction(`/admin/vouchers/${V2}`, aktifId, [V2, false], p.admin.cookie);
    check("admin menonaktifkan", off.includes("Voucher dinonaktifkan.") && (await voucherDoc(V2))?.active === false, off.slice(0, 80));
    check("voucher nonaktif ditolak", (await cek(p.c, V2, c3)).includes("Voucher ini sedang tidak aktif."), "nonaktif");
    check("voucher yang sudah dipakai tidak bisa dihapus", (await callAction(`/admin/vouchers/${V1}`, hapusId, [V1], p.admin.cookie)).includes("Voucher ini sudah pernah dipakai - nonaktifkan saja.") && !!(await voucherDoc(V1)), "hapus V1");
    check("bukan admin tidak bisa menghapus", (await callAction(`/admin/vouchers/${V5}`, hapusId, [V5], p.a.cookie)).includes("Hanya admin") && !!(await voucherDoc(V5)), "hapus");
    const del = await callAction(`/admin/vouchers/${V5}`, hapusId, [V5], p.admin.cookie);
    check("voucher yang belum pernah dipakai bisa dihapus", del.includes(`Voucher ${V5} dihapus.`) && !(await voucherDoc(V5)), del.slice(0, 80));

    const ubah = await simpan(p.admin, masukan(V2, { jenis: "nominal", nilai: 30_000, kategori: [kat], active: true }), "ubah");
    const v2 = await voucherDoc(V2);
    check("menyunting voucher: nilai baru, hitungan pemakaian tetap", ubah.includes("Perubahan disimpan.") && v2?.nilai === 30_000 && v2.active === true && v2.dipakai === 0, JSON.stringify({ n: v2?.nilai, a: v2?.active }));

    const daftarAdmin = await probeText("/admin/vouchers", p.admin.cookie);
    check("daftar voucher admin memuat kode", daftarAdmin.status === 200 && daftarAdmin.html.includes(V1), String(daftarAdmin.status));
    const detail = await probeText(`/admin/vouchers/${V1}`, p.admin.cookie);
    check("detail admin memuat riwayat pemakaian", detail.status === 200 && detail.html.includes("Riwayat pemakaian") && detail.html.includes("Uji voucher-a"), String(detail.status));
    const bukanAdmin = await probe("/admin/vouchers", p.a.cookie);
    check("halaman voucher tertutup bagi non-admin", bukanAdmin.status !== 200, String(bukanAdmin.status));
  }

  // ── Halaman pembeli menampilkan kolom voucher ──────────────────────
  {
    const h = await probeText(`/courses/${c2}`, p.c.cookie);
    check("kolom voucher ada di halaman kursus berbayar", h.html.includes("Punya kode voucher?"), String(h.status));
    const pr = await probeText("/premium", p.c.cookie);
    check("kolom voucher ada di halaman Premium", pr.html.includes("Punya kode voucher?"), String(pr.status));
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);
  const settingsRef = db.collection("settings").doc("payments");
  const settingsAwal = await settingsRef.get();

  const peran: Peran = {
    admin: await createTestUser("admin", "voucher-admin"),
    pemilik: await createTestUser("educator", "voucher-pemilik"),
    a: await createTestUser("user", "voucher-a"),
    b: await createTestUser("user", "voucher-b"),
    c: await createTestUser("user", "voucher-c"),
    d: await createTestUser("user", "voucher-d"),
  };
  const uids = Object.values(peran).map((u) => u.uid);
  const id = randomUUID().slice(0, 6).replace(/[^a-z0-9]/g, "x");
  const s = { c1: `verify-vch1-${id}`, c2: `verify-vch2-${id}`, c3: `verify-vch3-${id}`, kat: `verify-vchkat-${id}` };
  const awalan = `VT${id.toUpperCase()}`;
  const K = (n: string) => `${awalan}${n}`;

  try {
    await bucket.file(QRIS_PATH).save(PNG, { contentType: "image/png" });
    await settingsRef.set({ platformFeePercent: FEE, referralPercent: 10, midtransEnabled: true, manualQrisEnabled: true, qrisImagePath: QRIS_PATH }, { merge: true });
    await db.collection("courses").doc(s.c1).set(courseDoc(s.c1, 100_000, peran.pemilik.uid, "neuroscience"));
    await db.collection("courses").doc(s.c2).set(courseDoc(s.c2, 80_000, peran.pemilik.uid, "neuroscience"));
    await db.collection("courses").doc(s.c3).set(courseDoc(s.c3, 120_000, peran.pemilik.uid, s.kat));
    await run(peran, s, K);
  } finally {
    if (settingsAwal.exists) await settingsRef.set(settingsAwal.data()!);
    else await settingsRef.delete();
    for (const slug of [s.c1, s.c2, s.c3]) {
      await db.collection("courses").doc(slug).delete().catch(() => undefined);
      for (const c of ["orders", "enrollments", "royaltySales", "royaltyEarnings"]) {
        const snap = await db.collection(c).where("courseSlug", "==", slug).get();
        for (const d of snap.docs) await d.ref.delete().catch(() => undefined);
      }
    }
    for (const uid of uids) {
      for (const c of ["orders", "royaltyEarnings", PREMIUM_PERIODS, "enrollments", VOUCHER_REDEMPTIONS]) {
        const snap = await db.collection(c).where("uid", "==", uid).get();
        for (const d of snap.docs) await d.ref.delete().catch(() => undefined);
      }
      await db.collection(PREMIUM_MEMBERS).doc(uid).delete().catch(() => undefined);
      await db.collection("users").doc(uid).delete().catch(() => undefined);
    }
    const vs = await db.collection(VOUCHERS).get();
    for (const d of vs.docs) if (d.id.startsWith(awalan)) await d.ref.delete().catch(() => undefined);
    await bucket.file(QRIS_PATH).delete().catch(() => undefined);
    await auth.deleteUsers(uids);
    console.log("\nakun, kursus, voucher, pesanan & setelan uji dibersihkan.");
  }
  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
