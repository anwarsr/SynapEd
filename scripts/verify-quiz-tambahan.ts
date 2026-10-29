/**
 * Menguji tambahan fitur quiz di Pantau: analisis soal, ekspor spreadsheet,
 * dan "peringatkan murid". Bagian murni (tanpa server) lebih dulu, lalu alur
 * lewat dev server (npm run dev) - penjaga akses, sasaran, jeda, masa tayang.
 *
 *   npx tsx scripts/verify-quiz-tambahan.ts [baseUrl]
 */
import { getFirestore } from "firebase-admin/firestore";
import { BASE, COOKIE, actionId, app, auth, callAction, check, createTestUser, finish, probe, probeText } from "./testSupport";
import { targetLabel } from "./project";
import {
  JEDA_PERINGATAN_DETIK,
  MASA_PERINGATAN_DETIK,
  alasanTakBisaEkspor,
  analisisSoal,
  barisEkspor,
  peringatanBerlaku,
  sisaJedaPeringatan,
  type PercobaanQuiz,
  type Quiz,
  type SoalQuiz,
} from "../frontend/src/lib/classQuizRules";
import { buatXlsx, crc32 } from "../frontend/src/lib/xlsxMini";
import { extractOfficeText } from "../frontend/src/lib/officeText";

const db = getFirestore(app);

const mcq = (id: string, points: number, benar = "a"): SoalQuiz => ({
  id, type: "mcq", text: `Soal ${id}`, points, options: ["a", "b", "c"].map((o) => ({ id: o, text: `Opsi ${o}` })), correct: benar,
});
const esai = (id: string, points: number): SoalQuiz => ({ id, type: "essay", text: `Esai ${id}`, points, options: [], correct: null });
const quizUji = (questions: SoalQuiz[]): Quiz => ({
  id: "q1", classId: "c1", authorUid: "o", title: "Uji", description: "", questions,
  settings: { shuffleQuestions: false, shuffleOptions: false, durationMin: null },
  published: true, bannerURL: null, opensAt: null, closed: false, extraMin: 0, createdAt: "", updatedAt: "",
});
const coba = (uid: string, answers: Record<string, string>, over: Partial<PercobaanQuiz> = {}): PercobaanQuiz => ({
  id: `c1_q1_${uid}`, classId: "c1", quizId: "q1", uid, startedAt: "2026-01-01T00:00:00.000Z",
  submittedAt: "2026-01-01T00:05:00.000Z", finalizedBy: "siswa", answers, order: { q: [], opt: {} }, extraSec: 0, essayScores: {}, ...over,
});

function murni() {
  console.log("\nAnalisis soal");
  const quiz = quizUji([mcq("s1", 40), mcq("s2", 40), esai("s3", 20)]);
  const daftar = [
    coba("a", { s1: "a", s2: "b", s3: "x" }, { essayScores: { s3: 20 } }),
    coba("b", { s1: "b", s2: "b", s3: "y" }, { essayScores: { s3: 10 } }),
    coba("c", { s1: "c" }, { essayScores: { s3: 0 } }),
    coba("d", { s1: "b", s2: "b" }, { submittedAt: null, finalizedBy: null }), // belum mengumpulkan: tak dihitung
  ];
  const a = analisisSoal(quiz, daftar);
  const s1 = a.find((x) => x.id === "s1")!;
  const s2 = a.find((x) => x.id === "s2")!;
  const s3 = a.find((x) => x.id === "s3")!;
  check("peserta = hanya yang mengumpulkan", s1.peserta === 3, String(s1.peserta));
  check("soal tersulit di atas", a[0].id === "s2", a.map((x) => x.id).join());
  check("s2: persen tidak benar 100", s2.persenSalah === 100 && s2.benar === 0, String(s2.persenSalah));
  check("s2: pilihan terbanyak = b (67%)", s2.terbanyakId === "b" && s2.opsi.find((o) => o.id === "b")?.persen === 67, JSON.stringify(s2.opsi));
  check("s2: yang tak menjawab dihitung kosong", s2.kosong === 1, String(s2.kosong));
  check(
    "s1: kunci a dipilih 33%, tidak benar 67%",
    s1.opsi.find((o) => o.id === "a")?.persen === 33 && s1.persenSalah === 67 && s1.opsi.find((o) => o.id === "a")?.benar === true,
    JSON.stringify(s1.opsi),
  );
  check("esai: rata-rata skor 50% dari poin", s3.rataSkorPersen === 50 && s3.dinilai === 3, String(s3.rataSkorPersen));
  check("tanpa peserta: tidak membagi nol", analisisSoal(quiz, []).every((x) => x.persenSalah === 0 && x.opsi.every((o) => o.persen === 0)), "aman");

  console.log("\nEkspor spreadsheet (aturan)");
  check("tak ada yang mengumpulkan → ditolak", alasanTakBisaEkspor(quiz, []) !== null, "kosong");
  check("esai belum dinilai → ditolak", (alasanTakBisaEkspor(quiz, [coba("a", { s1: "a" })]) ?? "").includes("esai belum dinilai"), "menunggu");
  check("semua dinilai → boleh", alasanTakBisaEkspor(quiz, [coba("a", { s1: "a" }, { essayScores: { s3: 5 } })]) === null, "boleh");
  const baris = barisEkspor(quiz, [
    { nama: "Budi", p: coba("b", { s1: "a", s2: "a" }, { essayScores: { s3: 20 } }) },
    { nama: "Ani", p: coba("a", { s1: "a" }, { essayScores: { s3: 0 } }) },
    { nama: "Cici", p: null },
  ]);
  check("judul kolom", baris[0].join("|") === "No|Nama|Poin|Status", baris[0].join("|"));
  check("urut poin tertinggi; poin berupa angka", baris[1][1] === "Budi" && baris[1][2] === 100 && baris[2][1] === "Ani" && baris[2][2] === 40, JSON.stringify(baris));
  check("belum mengerjakan: poin kosong (bukan 0), di bawah", baris[3][1] === "Cici" && baris[3][2] === null, JSON.stringify(baris[3]));

  console.log("\nBerkas xlsx");
  const nama = `Budi <&> "Ani" ${String.fromCharCode(7)}`;
  const buf = buatXlsx({ nama: "Nilai/uji:1", baris: [["No", "Nama", "Poin"], [1, nama, 88]] });
  check("berkas diawali tanda ZIP", buf.subarray(0, 2).toString() === "PK", buf.subarray(0, 4).toString("hex"));
  const teks = extractOfficeText(buf, "xlsx", 10_000) ?? "";
  check("dapat dibaca pembaca xlsx: nama & angka ada", teks.includes("Budi") && teks.includes("88"), teks.slice(0, 80));
  check("karakter XML & kontrol tidak merusak berkas", teks.includes("<&>") && !teks.includes(String.fromCharCode(7)), "ter-escape");
  check("crc32 sesuai nilai baku", crc32(Buffer.from("123456789")) === 0xcbf43926, crc32(Buffer.from("123456789")).toString(16));

  console.log("\nPeringatan (aturan)");
  const t0 = Date.parse("2026-02-01T10:00:00.000Z");
  const p = { quizId: "q1", at: new Date(t0).toISOString(), uids: ["u1"] };
  const terbuka = { published: true, closed: false, opensAt: null };
  check("sasaran, belum mulai, dalam masa → tampil", peringatanBerlaku(p, terbuka, "u1", false, t0 + 5000), "tampil");
  check("bukan sasaran → tidak", !peringatanBerlaku(p, terbuka, "u2", false, t0 + 5000), "uid lain");
  check("sudah mulai → tidak", !peringatanBerlaku(p, terbuka, "u1", true, t0 + 5000), "terjawab");
  check("lewat masa tayang → tidak", !peringatanBerlaku(p, terbuka, "u1", false, t0 + (MASA_PERINGATAN_DETIK + 1) * 1000), "kedaluwarsa");
  check("quiz ditutup → tidak", !peringatanBerlaku(p, { ...terbuka, closed: true }, "u1", false, t0 + 5000), "ditutup");
  check(
    "quiz belum dibuka → tidak",
    !peringatanBerlaku(p, { ...terbuka, opensAt: new Date(t0 + 3_600_000).toISOString() }, "u1", false, t0 + 5000),
    "terjadwal",
  );
  check(
    "quiz hilang/draf → tidak",
    !peringatanBerlaku(p, null, "u1", false, t0 + 5000) && !peringatanBerlaku(p, { ...terbuka, published: false }, "u1", false, t0 + 5000),
    "tak ada",
  );
  check("jam mundur (di masa depan) → tidak", !peringatanBerlaku(p, terbuka, "u1", false, t0 - 1000), "belum waktunya");
  check("jeda: baru dikirim → harus menunggu", sisaJedaPeringatan(p, t0 + 5000) === JEDA_PERINGATAN_DETIK - 5, String(sisaJedaPeringatan(p, t0 + 5000)));
  check("jeda: lewat → boleh; belum pernah → boleh", sisaJedaPeringatan(p, t0 + 30_000) === 0 && sisaJedaPeringatan(null, t0) === 0, "boleh");
}

async function alur() {
  const owner = await createTestUser("educator", "tambahan-pemilik");
  const s1 = await createTestUser("user", "tambahan-siswa1");
  const s2 = await createTestUser("user", "tambahan-siswa2");
  const s3 = await createTestUser("user", "tambahan-siswa3");
  const luar = await createTestUser("user", "tambahan-luar");

  const classId = `tambahan-${Date.now().toString(36)}`;
  const quizId = "qtambahan";
  const waktu = new Date().toISOString();
  const classRef = db.collection("classes").doc(classId);
  await classRef.set({ name: "Uji Tambahan", description: "", ownerUid: owner.uid, joinCode: "UJITAMB1", memberCount: 3, postCount: 0, createdAt: waktu, updatedAt: waktu });
  for (const s of [s1, s2, s3]) await db.collection("classMembers").doc(`${s.uid}_${classId}`).set({ uid: s.uid, classId, role: "member", joinedAt: waktu });
  const soal = [mcq("q0", 50), mcq("q1", 30), esai("q2", 20)];
  const quizRef = classRef.collection("quizzes").doc(quizId);
  await quizRef.set({
    classId, authorUid: owner.uid, title: "Quiz Tambahan", description: "", questions: soal,
    settings: { shuffleQuestions: false, shuffleOptions: false, durationMin: null },
    published: true, bannerURL: null, opensAt: null, closed: false, extraMin: 0, createdAt: waktu, updatedAt: waktu,
  });
  const idAttempt = (uid: string) => `${classId}_${quizId}_${uid}`;
  await db.collection("classQuizAttempts").doc(idAttempt(s1.uid)).set({
    classId, quizId, uid: s1.uid, startedAt: waktu, submittedAt: waktu, finalizedBy: "siswa",
    answers: { q0: "a", q1: "a", q2: "jawaban esai" }, order: { q: ["q0", "q1", "q2"], opt: {} }, extraSec: 0, essayScores: {},
  });

  const get = (path: string, cookie?: string) => fetch(`${BASE}${path}`, { headers: cookie ? { cookie: `${COOKIE}=${cookie}` } : {} });
  const poll = async (cookie?: string) => {
    const r = await get(`/api/classes/quiz-alert?class=${classId}`, cookie);
    return { status: r.status, body: (await r.json()) as { alert: { quizId: string; title: string } | null } };
  };

  try {
    const jalur = `/educator/classes/${classId}`;
    const pantau = await probeText(`${jalur}?tab=pantau&quiz=${quizId}`, owner.cookie);
    await probe(jalur, owner.cookie);
    const warnId = await actionId("educator/classes/[id]", "warnQuizStudents");

    console.log("\nHalaman Pantau");
    check("memuat panel analisis", pantau.status === 200 && pantau.html.includes("Analisis soal"), String(pantau.status));
    check("tombol Peringatkan murid ada", pantau.html.includes("Peringatkan murid"), "tombol");
    check(
      "ekspor dinonaktifkan selama esai belum dinilai",
      pantau.html.includes("Ekspor spreadsheet") && pantau.html.includes("esai belum dinilai") && !pantau.html.includes("/api/classes/quiz-export"),
      "alasan tampil, tanpa tautan",
    );

    console.log("\nEkspor spreadsheet (server)");
    const ekspor = `/api/classes/quiz-export?class=${classId}&quiz=${quizId}`;
    check("anonim → 401", (await get(ekspor)).status === 401, "401");
    check("siswa → 404", (await get(ekspor, s1.cookie)).status === 404, "404");
    check("pengajar lain (bukan pemilik) → 404", (await get(ekspor, luar.cookie)).status === 404, "404");
    const tertahan = await get(ekspor, owner.cookie);
    check("esai belum dinilai → 409", tertahan.status === 409 && ((await tertahan.json()) as { message: string }).message.includes("esai belum dinilai"), String(tertahan.status));

    await db.collection("classQuizAttempts").doc(idAttempt(s1.uid)).update({ essayScores: { q2: 20 } });
    const ok = await get(ekspor, owner.cookie);
    const bytes = Buffer.from(await ok.arrayBuffer());
    check(
      "sesudah dinilai → 200 berkas xlsx",
      ok.status === 200 && (ok.headers.get("content-type") ?? "").includes("spreadsheetml") && bytes.subarray(0, 2).toString() === "PK",
      String(ok.status),
    );
    check(
      "diunduh sebagai lampiran, tidak disniff",
      (ok.headers.get("content-disposition") ?? "").startsWith("attachment;") && ok.headers.get("x-content-type-options") === "nosniff",
      ok.headers.get("content-disposition") ?? "",
    );
    const isi = extractOfficeText(bytes, "xlsx", 10_000) ?? "";
    check("berisi nama & poin 100", isi.includes("Uji tambahan-siswa1") && isi.includes("100"), isi.slice(0, 120));
    check("peserta yang belum mengerjakan ikut tercatat", isi.includes("Uji tambahan-siswa2") && isi.includes("Belum mengerjakan"), "semua anggota");
    const pantau2 = await probeText(`${jalur}?tab=pantau&quiz=${quizId}`, owner.cookie);
    check("tombol ekspor aktif setelah penilaian selesai", pantau2.html.includes("/api/classes/quiz-export"), "tautan unduh");

    console.log("\nPeringatkan murid");
    check("anonim tak bisa memoll → 401", (await poll()).status === 401, "401");
    check("siswa tak bisa memperingatkan", (await callAction(jalur, warnId, [classId, quizId], s2.cookie)).includes("tidak berhak"), "penjaga");
    check("quiz tak ada ditolak", (await callAction(jalur, warnId, [classId, "tidak-ada"], owner.cookie)).includes("tidak ditemukan"), "ditolak");
    check("belum ada peringatan: siswa dapat null", (await poll(s2.cookie)).body.alert === null, "null");

    check("pemilik mengirim peringatan ke yang belum mengerjakan", (await callAction(jalur, warnId, [classId, quizId], owner.cookie)).includes("dikirim ke 2 siswa"), "2 sasaran (s2, s3)");
    const doc = (await classRef.collection("quizAlerts").doc(quizId).get()).data();
    check(
      "sasaran = anggota tanpa percobaan",
      Array.isArray(doc?.uids) && doc.uids.length === 2 && doc.uids.includes(s2.uid) && doc.uids.includes(s3.uid) && !doc.uids.includes(s1.uid),
      JSON.stringify(doc?.uids),
    );
    check("kirim ulang segera ditolak (jeda)", (await callAction(jalur, warnId, [classId, quizId], owner.cookie)).includes("Tunggu"), "jeda");

    const a2 = await poll(s2.cookie);
    check("siswa sasaran menerima peringatan", a2.body.alert?.quizId === quizId && a2.body.alert?.title === "Quiz Tambahan", JSON.stringify(a2.body));
    check("respons tak membocorkan daftar sasaran", !JSON.stringify(a2.body).includes(s3.uid), "tanpa uid lain");
    check("siswa yang sudah mengerjakan tidak ditegur", (await poll(s1.cookie)).body.alert === null, "s1 null");
    check("pemilik tak menerima", (await poll(owner.cookie)).body.alert === null, "owner null");
    check("bukan anggota tak menerima", (await poll(luar.cookie)).body.alert === null, "luar null");

    await db.collection("classQuizAttempts").doc(idAttempt(s2.uid)).set({
      classId, quizId, uid: s2.uid, startedAt: new Date().toISOString(), submittedAt: null, finalizedBy: null,
      answers: {}, order: { q: ["q0", "q1", "q2"], opt: {} }, extraSec: 0, essayScores: {},
    });
    check("begitu mulai mengerjakan, peringatan berhenti", (await poll(s2.cookie)).body.alert === null, "s2 null");

    await quizRef.update({ closed: true });
    check("quiz ditutup: peringatan lenyap", (await poll(s3.cookie)).body.alert === null, "s3 null");
    check("tak bisa memperingatkan quiz tertutup", (await callAction(jalur, warnId, [classId, quizId], owner.cookie)).includes("sudah ditutup"), "ditolak");
    await quizRef.update({ closed: false });
    check("dibuka lagi: peringatan kembali", (await poll(s3.cookie)).body.alert?.quizId === quizId, "s3 alert");
    await classRef.collection("quizAlerts").doc(quizId).update({ at: new Date(Date.now() - (MASA_PERINGATAN_DETIK + 30) * 1000).toISOString() });
    check("peringatan kedaluwarsa tidak tampil lagi", (await poll(s3.cookie)).body.alert === null, "kedaluwarsa");
    check("setelah jeda lewat, bisa dikirim lagi", (await callAction(jalur, warnId, [classId, quizId], owner.cookie)).includes("dikirim ke 1 siswa"), "tinggal s3");
  } finally {
    await db.recursiveDelete(classRef).catch(() => undefined);
    const sisa = await db.collection("classQuizAttempts").where("classId", "==", classId).get();
    await Promise.all(sisa.docs.map((d) => d.ref.delete()));
    for (const s of [s1, s2, s3]) await db.collection("classMembers").doc(`${s.uid}_${classId}`).delete().catch(() => undefined);
    await auth.deleteUsers([owner.uid, s1.uid, s2.uid, s3.uid, luar.uid]).catch(() => undefined);
    console.log("\nakun, kelas & percobaan uji dihapus.");
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);
  murni();
  await alur();
  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
