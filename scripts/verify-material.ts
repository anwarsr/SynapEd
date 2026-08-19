/**
 * Menguji penyajian berkas materi: diunduh maupun dibaca langsung di halaman.
 *
 * Dua hal yang dijaga di sini:
 *   1. Route /asset MENGALIRKAN berkasnya sendiri. Versi lamanya mengalihkan
 *      ke signed URL, dan menandatangani menuntut kunci privat yang tidak
 *      dimiliki Application Default Credentials — jadi selalu 500 di komputer
 *      pengembang meski berjalan di produksi.
 *   2. Penjagaan aksesnya tetap sama ketatnya. Route ini membaca berkas dengan
 *      Admin SDK, yang melewati storage.rules sepenuhnya, jadi kalau
 *      pemeriksaannya bocor maka seluruh bucket ikut terbuka.
 *
 * Butuh dev server berjalan (npm run dev).
 *
 *   npx tsx scripts/verify-material.ts [baseUrl]
 */
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  BASE,
  COOKIE,
  app,
  auth,
  check,
  createTestUser,
  finish,
  readEnv,
  type TestUser,
} from "./testSupport";
import { targetLabel } from "./project";

const db = getFirestore(app);
const bucket = readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");

const SLUG = "kursus-uji-materi";
const PDF_TEXT = "%PDF-1.4\n% berkas uji materi\n";

/**
 * .docx paling sederhana yang masih sah: arsip zip berisi [Content_Types].xml,
 * _rels/.rels, dan word/document.xml. Dirakit tangan supaya tidak perlu
 * dependensi tambahan hanya untuk membuat satu berkas uji.
 */
function minimalDocx(paragraph: string): Buffer {
  const files: Array<{ name: string; content: string }> = [
    {
      name: "[Content_Types].xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        "</Types>",
    },
    {
      name: "_rels/.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        "</Relationships>",
    },
    {
      name: "word/document.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
        `<w:p><w:r><w:t>${paragraph}</w:t></w:r></w:p>` +
        "</w:body></w:document>",
    },
  ];

  // Zip tanpa kompresi (metode 0) — cukup untuk pengurai mana pun.
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const data = Buffer.from(f.content, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);

    chunks.push(local, name, data);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);

    central.push(dir, name);
    offset += local.length + name.length + data.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...chunks, centralBuf, end]);
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

async function get(path: string, cookie?: string) {
  return fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: cookie ? { cookie: `${COOKIE}=${cookie}` } : {},
  });
}

async function run(educator: TestUser, orang: TestUser) {
  const pdfPath = `course-assets/${educator.uid}/${SLUG}/modul.pdf`;
  const docxPath = `course-assets/${educator.uid}/${SLUG}/modul.docx`;
  const rahasia = `course-assets/${educator.uid}/rahasia/bukan-lampiran.pdf`;

  const storage = getStorage(app).bucket(bucket);
  await storage.file(pdfPath).save(Buffer.from(PDF_TEXT), { contentType: "application/pdf" });
  await storage.file(docxPath).save(minimalDocx("Halo dari modul uji."), {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  await storage.file(rahasia).save(Buffer.from(PDF_TEXT), { contentType: "application/pdf" });

  await db.collection("courses").doc(SLUG).set({
    slug: SLUG,
    title: "Kursus Uji Materi",
    shortDesc: "Kursus untuk menguji penyajian berkas.",
    longDesc: "",
    level: "Pemula",
    levelColor: "green",
    category: "eeg",
    icon: "reading",
    tint: "bg-blue-50",
    duration: "1 jam",
    rating: 0,
    reviews: 0,
    price: 0,
    thumbnail: null,
    enrolledStudents: 0,
    instructorName: "Uji educator",
    instructorBio: "",
    whatYouLearn: [],
    requirements: [],
    order: 9999,
    ownerUid: educator.uid,
    ownerName: "Uji educator",
    createdAt: new Date().toISOString(),
    sections: [
      {
        title: "Materi",
        position: 0,
        lessons: [
          {
            slug: "modul-pdf",
            title: "Modul PDF",
            type: "reading",
            duration: "10 menit",
            position: 0,
            attachments: [{ name: "modul.pdf", path: pdfPath, size: PDF_TEXT.length, mime: "application/pdf" }],
          },
          {
            slug: "modul-word",
            title: "Modul Word Lama",
            type: "reading",
            duration: "10 menit",
            position: 1,
            attachments: [
              {
                name: "modul.docx",
                path: docxPath,
                size: 1,
                mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              },
            ],
          },
        ],
      },
    ],
  });

  const asset = (path: string, extra = "") =>
    `/api/courses/${SLUG}/asset?path=${encodeURIComponent(path)}${extra}`;

  // ── Inti perbaikan: tidak lagi 500 ────────────────────────────────
  {
    const res = await get(asset(pdfPath), educator.cookie);
    check("berkas PDF terkirim, bukan 500", res.status === 200, `HTTP ${res.status}`);
    check(
      "tipe kontennya benar",
      (res.headers.get("content-type") ?? "").includes("application/pdf"),
      String(res.headers.get("content-type")),
    );
    check(
      "ditampilkan di halaman, bukan dipaksa unduh",
      (res.headers.get("content-disposition") ?? "").startsWith("inline"),
      String(res.headers.get("content-disposition")),
    );
    check("isinya utuh", (await res.text()).startsWith("%PDF"), "byte pertama");
  }

  {
    const res = await get(asset(pdfPath, "&download=1"), educator.cookie);
    check(
      "tautan unduh memaksa simpan",
      res.status === 200 &&
        (res.headers.get("content-disposition") ?? "").startsWith("attachment"),
      String(res.headers.get("content-disposition")),
    );
  }

  // ── Lampiran Word lama tetap bisa diunduh ─────────────────────────
  //
  // Unggahan kini dibatasi PDF, tetapi lampiran .docx yang terlanjur
  // tersimpan tidak boleh jadi tidak terjangkau. Yang hilang hanya
  // penayangannya di halaman; berkasnya tetap utuh dan bisa diambil.
  {
    const res = await get(asset(docxPath, "&download=1"), educator.cookie);
    const body = Buffer.from(await res.arrayBuffer());

    check("lampiran Word lama tetap terkirim", res.status === 200, `HTTP ${res.status}`);
    check(
      "byte-nya utuh",
      body.subarray(0, 2).toString() === "PK" && body.includes("Halo dari modul uji"),
      `${body.length} byte`,
    );

    const belajar = await get(`/courses/${SLUG}/learn/modul-word`, educator.cookie);
    const html = await belajar.text();

    check(
      "halaman belajar menawarkan unduhan, bukan penayangan",
      belajar.status === 200 && html.includes("modul.docx"),
      "berkas tetap tercantum",
    );
    check(
      "keadaan kosongnya jujur soal alasannya",
      html.includes("tidak bisa ditampilkan"),
      "bukan berpura-pura materinya belum ada",
    );
  }

  // ── Penjagaan akses tetap ketat ───────────────────────────────────
  {
    const anon = await get(asset(pdfPath));
    check("anonim ditolak", anon.status === 401, `HTTP ${anon.status}`);

    // Yang diuji di sini: berkas yang BUKAN lampiran kursus ini. Ditolak 404
    // sebelum pemeriksaan akses sempat berjalan — jadi tetap berlaku sekarang
    // setelah pratinjau per-pelajaran dihapus.
    const bocor = await get(asset(rahasia), orang.cookie);
    check(
      "berkas di luar kursus ini ditolak",
      bocor.status === 404,
      `HTTP ${bocor.status} — bukan proxy bucket`,
    );

    const avatar = await get(asset(`avatars/${orang.uid}/avatar.png`), orang.cookie);
    check("path di luar folder kursus ditolak", avatar.status === 404, `HTTP ${avatar.status}`);
  }

  // ── Halaman belajar menampilkan pembacanya ────────────────────────
  {
    const res = await get(`/courses/${SLUG}/learn/modul-pdf`, educator.cookie);
    const html = await res.text();
    check(
      "halaman belajar PDF tidak bilang materi belum tersedia",
      res.status === 200 && !html.includes("Materi belum tersedia"),
      String(res.status),
    );
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const educator = await createTestUser("educator");
  const orang = await createTestUser("user", "peserta");

  console.log(`educator : ${educator.email}`);
  console.log(`peserta  : ${orang.email}\n`);

  try {
    await run(educator, orang);
  } finally {
    await auth.deleteUsers([educator.uid, orang.uid]);
    await db.recursiveDelete(db.collection("courses").doc(SLUG)).catch(() => undefined);
    await getStorage(app)
      .bucket(bucket)
      .deleteFiles({ prefix: `course-assets/${educator.uid}/` })
      .catch(() => undefined);
    console.log("\nakun, kursus, & berkas uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
