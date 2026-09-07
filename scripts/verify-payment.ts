/**
 * Menguji alur pembayaran dari ujung ke ujung terhadap server yang berjalan.
 *
 * Kenapa notifikasinya dibuat sendiri, bukan menunggu Midtrans: Midtrans tidak
 * bisa menjangkau localhost, jadi webhook mustahil diuji dengan pembayaran
 * sungguhan saat pengembangan. Lebih penting lagi, kasus GAGAL — tanda tangan
 * palsu, nominal dipalsukan, notifikasi diulang — tidak bisa dipicu lewat
 * sandbox sama sekali. Padahal justru di situlah uang bisa hilang.
 *
 * Butuh dev server berjalan DENGAN kunci Midtrans yang sama dengan skrip ini:
 *
 *   $env:MIDTRANS_SERVER_KEY = "SB-Mid-server-UJI"
 *   $env:NEXT_PUBLIC_MIDTRANS_CLIENT_KEY = "SB-Mid-client-UJI"
 *   npm run dev
 *
 *   $env:MIDTRANS_SERVER_KEY = "SB-Mid-server-UJI"
 *   npx tsx scripts/verify-payment.ts http://localhost:3000
 *
 * Kunci palsu sudah cukup: verifikasi tanda tangan sepenuhnya lokal. Hanya
 * pemanggilan Snap yang butuh kunci sandbox sungguhan — jalankan bagian itu
 * dengan menambahkan:
 *
 *   $env:MIDTRANS_SANDBOX_REAL = "true"
 */
import { createHash, randomUUID } from "node:crypto";
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
  probeText,
  readEnv,
  type TestUser,
} from "./testSupport";
import { targetLabel } from "./project";

const db = getFirestore(app);
const DETAIL_ROUTE = "courses/[slug]";
const WEBHOOK = "/api/payments/midtrans/notification";

const SERVER_KEY = readEnv("MIDTRANS_SERVER_KEY");

/**
 * Apakah kuncinya benar-benar dari Midtrans, sehingga Snap boleh dipanggil?
 *
 * Ditanyakan lewat penanda eksplisit, BUKAN ditebak dari bentuk teks kuncinya.
 * Percobaan pertama menebak lewat awalan "SB-Mid-server-" dan langsung salah:
 * kunci uji palsu yang meniru bentuk itu ikut lolos, lalu suite-nya melaporkan
 * dua kegagalan padahal kodenya baik-baik saja. Bentuk sebuah kunci tidak
 * memberi tahu apakah kunci itu sah.
 */
const LIVE_KEY = process.env.MIDTRANS_SANDBOX_REAL === "true";

const PRICE = 150_000;

function courseDoc(slug: string, price: number) {
  const now = new Date().toISOString();
  return {
    slug,
    title: "Kursus Uji Pembayaran",
    shortDesc: "Dibuat verify-payment, akan dihapus.",
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
    instructorName: "Uji Pembayaran",
    instructorBio: "",
    whatYouLearn: [],
    requirements: [],
    sections: [
      {
        title: "Bagian Uji",
        position: 0,
        lessons: [
          { slug: "pelajaran-satu", title: "Pelajaran Satu", type: "reading", duration: "5 menit", position: 0 },
        ],
      },
    ],
    order: 9999,
    ownerUid: null,
    ownerName: null,
    createdAt: now,
  };
}

/** Notifikasi Midtrans lengkap dengan tanda tangan yang sah. */
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
    signature_key: createHash("sha512")
      .update(orderId + statusCode + grossAmount + key)
      .digest("hex"),
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

async function enrollmentExists(uid: string, slug: string): Promise<boolean> {
  return (await db.collection("enrollments").doc(`${uid}_${slug}`).get()).exists;
}

async function seedOrder(orderId: string, user: TestUser, slug: string, amount: number) {
  const now = new Date();
  await db.collection("orders").doc(orderId).set({
    orderId,
    uid: user.uid,
    userEmail: user.email,
    userName: "Uji",
    courseSlug: slug,
    courseTitle: "Kursus Uji Pembayaran",
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

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}`);
  console.log(`Kunci Midtrans: ${LIVE_KEY ? "sandbox sungguhan" : "palsu (uji tanda tangan saja)"}\n`);

  const buyer = await createTestUser("user", "pembeli");
  const paidSlug = `verify-bayar-${randomUUID().slice(0, 8)}`;
  const freeSlug = `verify-gratis-${randomUUID().slice(0, 8)}`;
  const orders: string[] = [];

  await db.collection("courses").doc(paidSlug).set(courseDoc(paidSlug, PRICE));
  await db.collection("courses").doc(freeSlug).set(courseDoc(freeSlug, 0));

  try {
    const createId = await actionId(DETAIL_ROUTE, "createOrder");

    // ── createOrder: yang harus ditolak sebelum menyentuh Midtrans ──────
    const anon = await callAction(`/courses/${paidSlug}`, createId, [paidSlug]);
    check("anonim tidak bisa memesan", anon.includes("masuk terlebih dahulu"), "tanpa cookie");

    const free = await callAction(`/courses/${freeSlug}`, createId, [freeSlug], buyer.cookie);
    check("kursus gratis ditolak dari jalur bayar", free.includes("gratis"), "arahkan ke enrollFree");

    const ghost = await callAction(`/courses/${paidSlug}`, createId, ["tidak-ada-kursus-ini"], buyer.cookie);
    check("kursus tak dikenal ditolak", ghost.includes("tidak ditemukan"), "slug ngawur");

    // ── Webhook: lapisan keamanan ───────────────────────────────────────
    const orderId = `SYN-uji-${randomUUID().slice(0, 8)}`;
    orders.push(orderId);
    await seedOrder(orderId, buyer, paidSlug, PRICE);

    const palsu = await postWebhook({
      ...notification(orderId, PRICE, "settlement"),
      signature_key: "0".repeat(128),
    });
    check("tanda tangan palsu ditolak", palsu === 403, `HTTP ${palsu}`);
    check(
      "tanda tangan palsu TIDAK memberi akses",
      !(await enrollmentExists(buyer.uid, paidSlug)),
      "tidak ada enrollment",
    );

    const kunciLain = await postWebhook(notification(orderId, PRICE, "settlement", "kunci-orang-lain"));
    check("tanda tangan dari kunci lain ditolak", kunciLain === 403, `HTTP ${kunciLain}`);

    // ── Uji notifikasi dari dashboard Midtrans ──────────────────────────
    //
    // Tombol "Test notification URL" mengirim pesanan tiruan yang tidak ada
    // di sini. Ia harus dijawab 200, kalau tidak dashboard melaporkan URL-nya
    // gagal — dan pemilik toko kehilangan satu-satunya alat untuk memastikan
    // URL-nya benar.
    {
      const ujiId = `payment_notif_test_G${randomUUID().slice(0, 8)}`;

      const sah = await postWebhook(notification(ujiId, PRICE, "capture"));
      check("uji notifikasi dashboard dijawab 200", sah === 200, `HTTP ${sah}`);

      check(
        "uji notifikasi tidak menulis pesanan apa pun",
        !(await db.collection("orders").doc(ujiId).get()).exists,
        "tidak ada dokumen baru",
      );

      // Yang terpenting: cabang ini ada DI BELAKANG pemeriksaan tanda tangan.
      // Kalau ia mendahului, siapa pun cukup menamai pesanannya
      // "payment_notif_test..." untuk melewati seluruh penjagaan.
      const tanpaTandaTangan = await postWebhook(
        notification(ujiId, PRICE, "capture", "kunci-orang-lain"),
      );
      check(
        "awalan uji BUKAN pintu belakang — tanda tangan tetap wajib",
        tanpaTandaTangan === 403,
        `HTTP ${tanpaTandaTangan}`,
      );
    }


    // Ditandatangani dengan benar TAPI nominalnya bukan harga kursus.
    const nominal = await postWebhook(notification(orderId, 1000, "settlement"));
    check("nominal dipalsukan ditolak", nominal === 400, `HTTP ${nominal}`);
    check(
      "nominal dipalsukan TIDAK memberi akses",
      !(await enrollmentExists(buyer.uid, paidSlug)),
      "tidak ada enrollment",
    );

    const asing = await postWebhook(notification("SYN-tidak-ada", PRICE, "settlement"));
    check("pesanan tak dikenal ditolak", asing === 404, `HTTP ${asing}`);
    // Sekaligus menjaga cabang uji dashboard tetap sempit: hanya nomor
    // berawalan payment_notif_test yang boleh lolos tanpa pesanan.

    // ── Webhook: pembayaran sah ─────────────────────────────────────────
    const sebelum = (await db.collection("courses").doc(paidSlug).get()).data()?.enrolledStudents;

    const lunas = await postWebhook(notification(orderId, PRICE, "settlement"));
    check("notifikasi sah diterima", lunas === 200, `HTTP ${lunas}`);

    const enr = (await db.collection("enrollments").doc(`${buyer.uid}_${paidSlug}`).get()).data();
    check("akses diberikan", Boolean(enr), "dokumen enrollment ada");
    check("ditandai sebagai pembelian", enr?.source === "paid", `source=${enr?.source}`);
    check("orderId tercatat di enrollment", enr?.orderId === orderId, `${enr?.orderId}`);
    check("harga tercatat apa adanya", enr?.pricePaid === PRICE, `${enr?.pricePaid}`);

    const order = (await db.collection("orders").doc(orderId).get()).data();
    check("pesanan ditandai lunas", order?.status === "paid", `status=${order?.status}`);
    check("metode bayar tercatat", order?.paymentType === "qris", `${order?.paymentType}`);

    // ── Webhook: pengiriman ulang ───────────────────────────────────────
    // Midtrans mengirim ulang saat retry. Ini yang membuktikan pengulangan
    // tidak menggandakan peserta maupun menimpa progres.
    await postWebhook(notification(orderId, PRICE, "settlement"));
    await postWebhook(notification(orderId, PRICE, "settlement"));

    const sesudah = (await db.collection("courses").doc(paidSlug).get()).data()?.enrolledStudents;
    check(
      "tiga notifikasi = satu peserta",
      sesudah === (sebelum ?? 0) + 1,
      `${sebelum} -> ${sesudah}`,
    );

    // ── createOrder setelah terdaftar ───────────────────────────────────
    const lagi = await callAction(`/courses/${paidSlug}`, createId, [paidSlug], buyer.cookie);
    check("sudah terdaftar tidak bisa memesan lagi", lagi.includes("sudah terdaftar"), "ditolak");

    // ── Halaman detail mengikuti keadaan ────────────────────────────────
    const html = await probeText(`/courses/${paidSlug}`, buyer.cookie);
    check(
      "halaman menawarkan lanjut belajar, bukan beli",
      html.html.includes("Lanjutkan Belajar"),
      "tombol berubah setelah lunas",
    );

    // ── Harga berubah saat pesanan lama masih hidup ─────────────────────
    //
    // Pesanan tertunda dipakai ulang supaya klik berulang tidak menumpuk
    // transaksi. Tapi harga kursus bisa berubah dalam 30 menit itu, dan
    // pesanan lama membawa nominal lamanya. Kalau ia tetap dipakai ulang,
    // pembeli melihat harga baru di halaman lalu membayar harga lama di
    // popup Midtrans — dan webhook meloloskannya, karena yang ia bandingkan
    // adalah nominal pesanan itu sendiri, bukan harga kursusnya.
    {
      const gantiHarga = await createTestUser("user", "ganti-harga");
      const lamaId = `SYN-harga-${randomUUID().slice(0, 8)}`;
      orders.push(lamaId);

      await seedOrder(lamaId, gantiHarga, paidSlug, PRICE);

      // Harga belum berubah: pesanan lama MEMANG harus dipakai ulang.
      const sama = await callAction(
        `/courses/${paidSlug}`, createId, [paidSlug], gantiHarga.cookie,
      );
      check(
        "pesanan tertunda dipakai ulang selama harganya sama",
        sama.includes("token-uji"),
        "klik berulang tidak menumpuk transaksi",
      );

      // Educator menaikkan harganya.
      const HARGA_BARU = PRICE + 50_000;
      await db.collection("courses").doc(paidSlug).update({ price: HARGA_BARU });

      const beda = await callAction(
        `/courses/${paidSlug}`, createId, [paidSlug], gantiHarga.cookie,
      );
      check(
        "token lama TIDAK dibagikan lagi setelah harganya berubah",
        !beda.includes("token-uji"),
        `harga ${PRICE} -> ${HARGA_BARU}`,
      );

      const lama = (await db.collection("orders").doc(lamaId).get()).data();
      check(
        "pesanan berharga lama ditandai kedaluwarsa",
        lama?.status === "expired",
        `status=${lama?.status}`,
      );

      if (LIVE_KEY) {
        const baru = await db
          .collection("orders")
          .where("uid", "==", gantiHarga.uid)
          .get();
        const pending = baru.docs
          .map((d) => d.data())
          .filter((o) => o.status === "pending");

        baru.docs.forEach((d) => orders.includes(d.id) || orders.push(d.id));
        check(
          "pesanan pengganti memakai harga yang baru",
          pending.length === 1 && pending[0]?.amount === HARGA_BARU,
          `${pending.length} pending, nominal ${pending[0]?.amount}`,
        );
      }

      await db.collection("courses").doc(paidSlug).update({ price: PRICE });
      await auth.deleteUser(gantiHarga.uid).catch(() => undefined);
    }

    // ── Notifikasi gagal & kedaluwarsa ──────────────────────────────────
    const orderGagal = `SYN-gagal-${randomUUID().slice(0, 8)}`;
    orders.push(orderGagal);
    const lain = await createTestUser("user", "gagal");

    await seedOrder(orderGagal, lain, paidSlug, PRICE);
    const kedaluwarsa = await postWebhook(notification(orderGagal, PRICE, "expire"));

    check("notifikasi kedaluwarsa diterima", kedaluwarsa === 200, `HTTP ${kedaluwarsa}`);
    check(
      "kedaluwarsa TIDAK memberi akses",
      !(await enrollmentExists(lain.uid, paidSlug)),
      "tidak ada enrollment",
    );
    const og = (await db.collection("orders").doc(orderGagal).get()).data();
    check("pesanan ditandai kedaluwarsa", og?.status === "expired", `status=${og?.status}`);

    await auth.deleteUser(lain.uid).catch(() => undefined);

    // ── Jalur Snap sungguhan (hanya dengan kunci sandbox asli) ──────────
    if (LIVE_KEY) {
      const segar = await createTestUser("user", "snap");
      const res = await callAction(`/courses/${paidSlug}`, createId, [paidSlug], segar.cookie);

      check("Snap menerbitkan token", !res.includes("tidak dapat dimulai"), "transaksi dibuat");

      const milik = await db.collection("orders").where("uid", "==", segar.uid).get();
      milik.docs.forEach((d) => orders.push(d.id));
      check("pesanan tercatat pending", milik.docs[0]?.data().status === "pending", `${milik.size} pesanan`);

      await auth.deleteUser(segar.uid).catch(() => undefined);
    } else {
      console.log(
        "\n  (dilewati) pemanggilan Snap sungguhan — setel MIDTRANS_SANDBOX_REAL=true" +
          " dengan kunci sandbox asli untuk mengujinya\n",
      );
    }
  } finally {
    await Promise.allSettled([
      db.collection("courses").doc(paidSlug).delete(),
      db.collection("courses").doc(freeSlug).delete(),
      db.collection("enrollments").doc(`${buyer.uid}_${paidSlug}`).delete(),
      ...orders.map((id) => db.collection("orders").doc(id).delete()),
      auth.deleteUser(buyer.uid),
    ]);
    console.log("\nakun, kursus, & pesanan uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
