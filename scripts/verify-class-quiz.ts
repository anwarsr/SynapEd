/**
 * Menguji quiz kelas: aturan murni (poin, validasi, acak per siswa, penilaian,
 * waktu, peringkat) lalu alur penuh lewat dev server - penerbitan, pengerjaan,
 * batas waktu, tambahan waktu, penilaian esai, peringkat, kunci jawaban, kunci
 * soal setelah ada yang mengerjakan, dan hak akses.
 *
 * Yang paling penting bukan "fiturnya jalan", melainkan yang TIDAK BOLEH:
 *   - kunci jawaban bocor ke siswa sebelum quiz ditutup
 *   - siswa mengerjakan setelah waktu habis / mengubah nilai / melihat data siswa lain
 *   - pengajar kehilangan nilai karena soal disunting setelah dikerjakan
 *
 * Butuh dev server berjalan (npm run dev).
 *
 *   npx tsx scripts/verify-class-quiz.ts [baseUrl]
 */
import { getFirestore } from "firebase-admin/firestore";
import { BASE, actionId, app, auth, callAction, check, createTestUser, finish, probe, probeText } from "./testSupport";
import { targetLabel } from "./project";
import {
  acakBersemai,
  bagiRataPoin,
  batasWaktuMs,
  bersihkanJawaban,
  harusSelesai,
  hitungNilai,
  peringkatTeratas,
  strukturSama,
  sudahDibuka,
  urutanSahih,
  urutanUntukSiswa,
  validasiNilaiEsai,
  validasiQuiz,
  type PercobaanQuiz,
  type Quiz,
  type SoalQuiz,
} from "../frontend/src/lib/classQuizRules";

const db = getFirestore(app);

// ── Bahan uji murni ─────────────────────────────────────────────────────

function soalMcq(id: string, points: number, benar = "a"): SoalQuiz {
  return {
    id,
    type: "mcq",
    text: `Soal ${id}`,
    points,
    options: ["a", "b", "c"].map((o) => ({ id: o, text: `Opsi ${o}` })),
    correct: benar,
  };
}
const soalEsai = (id: string, points: number): SoalQuiz => ({ id, type: "essay", text: `Esai ${id}`, points, options: [], correct: null });

function quizUji(over: Partial<Quiz> = {}): Quiz {
  return {
    id: "q1", classId: "c1", authorUid: "o", title: "Uji", description: "",
    questions: [soalMcq("s1", 30), soalMcq("s2", 30), soalEsai("s3", 40)],
    settings: { shuffleQuestions: true, shuffleOptions: true, durationMin: 10 },
    published: true, opensAt: null, closed: false, extraMin: 0, createdAt: "", updatedAt: "", ...over,
  };
}

function percobaan(uid: string, over: Partial<PercobaanQuiz> = {}): PercobaanQuiz {
  return {
    id: `c1_q1_${uid}`, classId: "c1", quizId: "q1", uid,
    startedAt: "2026-01-01T00:00:00.000Z", submittedAt: "2026-01-01T00:05:00.000Z", finalizedBy: "siswa",
    answers: {}, order: { q: [], opt: {} }, extraSec: 0, essayScores: { s3: 40 }, ...over,
  };
}

function aturanMurni() {
  console.log("Aturan quiz (murni)");

  const bagi3 = bagiRataPoin(3);
  check("bagi rata 3 soal berjumlah 100", bagi3.reduce((a, b) => a + b, 0) === 100 && bagi3[0] === 34, bagi3.join("+"));
  check("bagi rata untuk 1..50 soal selalu 100", Array.from({ length: 50 }, (_, i) => bagiRataPoin(i + 1).reduce((a, b) => a + b, 0)).every((n) => n === 100), "1-50");
  check("bagi rata 0 soal kosong", bagiRataPoin(0).length === 0, "[]");

  const valid = { title: "Quiz A", questions: [soalMcq("s1", 60), soalEsai("s2", 40)], settings: { durationMin: 15 } };
  check("quiz sah diterbitkan", validasiQuiz(valid, true).ok, "total 100");
  check("judul terlalu pendek ditolak", !validasiQuiz({ ...valid, title: "ab" }, false).ok, "min 3");
  check("total melebihi 100 ditolak walau draf", !validasiQuiz({ ...valid, questions: [soalMcq("s1", 70), soalEsai("s2", 40)] }, false).ok, "110");
  check("terbit dengan total ≠ 100 ditolak", !validasiQuiz({ ...valid, questions: [soalMcq("s1", 50), soalEsai("s2", 40)] }, true).ok, "90");
  check("draf total < 100 boleh", validasiQuiz({ ...valid, questions: [soalMcq("s1", 50)] }, false).ok, "draf");
  check("terbit tanpa soal ditolak", !validasiQuiz({ ...valid, questions: [] }, true).ok, "kosong");
  check("pilihan ganda tanpa kunci ditolak saat terbit", !validasiQuiz({ ...valid, questions: [{ ...soalMcq("s1", 60), correct: null }, soalEsai("s2", 40)] }, true).ok, "tanpa kunci");
  check("kunci yang bukan id opsi ditolak", !validasiQuiz({ ...valid, questions: [{ ...soalMcq("s1", 60), correct: "zzz" }, soalEsai("s2", 40)] }, true).ok, "kunci palsu");
  check("pilihan kurang dari 2 ditolak", !validasiQuiz({ ...valid, questions: [{ ...soalMcq("s1", 60), options: [{ id: "a", text: "x" }] }, soalEsai("s2", 40)] }, true).ok, "1 opsi");
  check("id soal ganda ditolak", !validasiQuiz({ ...valid, questions: [soalMcq("s1", 60), soalMcq("s1", 40)] }, false).ok, "id ganda");
  check("poin negatif/pecahan ditolak", !validasiQuiz({ ...valid, questions: [soalMcq("s1", -1)] }, false).ok && !validasiQuiz({ ...valid, questions: [soalMcq("s1", 10.5)] }, false).ok, "bulat ≥ 0");
  check("durasi 0 / 9999 ditolak", !validasiQuiz({ ...valid, settings: { durationMin: 0 } }, false).ok && !validasiQuiz({ ...valid, settings: { durationMin: 9999 } }, false).ok, "1-600");
  check("durasi kosong = tanpa batas", (() => { const r = validasiQuiz({ ...valid, settings: { durationMin: "" } }, false); return r.ok && r.value.settings.durationMin === null; })(), "null");
  check("esai tak membawa pilihan/kunci", (() => { const r = validasiQuiz({ ...valid, questions: [{ ...soalEsai("s2", 100), options: [{ id: "x", text: "y" }], correct: "x" }] }, true); return r.ok && r.value.questions[0].options.length === 0 && r.value.questions[0].correct === null; })(), "dibersihkan");

  check("struktur sama = hanya poin berbeda", strukturSama(quizUji().questions, [soalMcq("s1", 10), soalMcq("s2", 50), soalEsai("s3", 40)]), "poin boleh");
  check("teks berubah = struktur beda", !strukturSama(quizUji().questions, [{ ...soalMcq("s1", 30), text: "lain" }, soalMcq("s2", 30), soalEsai("s3", 40)]), "terkunci");
  check("kunci berubah = struktur beda", !strukturSama(quizUji().questions, [soalMcq("s1", 30, "b"), soalMcq("s2", 30), soalEsai("s3", 40)]), "terkunci");
  check("soal ditambah = struktur beda", !strukturSama(quizUji().questions, [...quizUji().questions, soalMcq("s9", 0)]), "terkunci");

  // Jadwal mulai
  const depan = new Date(Date.now() + 3_600_000).toISOString();
  check("tanpa jadwal = langsung terbuka", sudahDibuka({ opensAt: null }, Date.now()), "null");
  check("jadwal di masa depan belum terbuka", !sudahDibuka({ opensAt: depan }, Date.now()), "belum");
  check("jadwal terlewat = terbuka", sudahDibuka({ opensAt: "2020-01-01T00:00:00.000Z" }, Date.now()), "sudah");
  check("tepat pada jamnya terbuka", sudahDibuka({ opensAt: depan }, Date.parse(depan)), "inklusif");
  check("jadwal tak sah ditolak", !validasiQuiz({ ...valid, opensAt: "bukan tanggal" }, false).ok, "validasi");
  check("jadwal sah dinormalkan ke ISO", (() => { const r = validasiQuiz({ ...valid, opensAt: "2030-05-01T03:00:00+07:00" }, false); return r.ok && r.value.opensAt === "2030-04-30T20:00:00.000Z"; })(), "UTC");
  check("jadwal kosong = null", (() => { const r = validasiQuiz({ ...valid, opensAt: "" }, false); return r.ok && r.value.opensAt === null; })(), "null");

  // Acak
  const ids = Array.from({ length: 12 }, (_, i) => `s${i}`);
  check("acak bersemai: seed sama → urutan sama", acakBersemai(ids, "x").join() === acakBersemai(ids, "x").join(), "deterministik");
  check("acak bersemai: seed beda → urutan beda", acakBersemai(ids, "x").join() !== acakBersemai(ids, "y").join(), "12!");
  check("acak tak mengubah masukan & tetap permutasi", (() => { const a = acakBersemai(ids, "z"); return [...a].sort().join() === [...ids].sort().join() && ids[0] === "s0"; })(), "permutasi");
  const besar = quizUji({ questions: ids.map((id) => soalMcq(id, 1)) });
  check("dua siswa mendapat urutan soal berbeda", urutanUntukSiswa(besar, "u1").q.join() !== urutanUntukSiswa(besar, "u2").q.join(), "anti contek");
  check("siswa sama selalu urutan sama", urutanUntukSiswa(besar, "u1").q.join() === urutanUntukSiswa(besar, "u1").q.join(), "stabil");
  check("opsi diacak per soal", Object.values(urutanUntukSiswa(besar, "u1").opt).some((o) => o.join() !== "a,b,c"), "opsi");
  check("tanpa setelan acak urutan asli", urutanUntukSiswa(quizUji({ settings: { shuffleQuestions: false, shuffleOptions: false, durationMin: null } }), "u1").q.join() === "s1,s2,s3", "asli");
  check("urutan lama disesuaikan saat soal berubah", (() => { const u = urutanSahih(quizUji(), { q: ["s3", "hilang", "s1"], opt: { s1: ["c", "a"] } }); return u.q.join() === "s3,s1,s2" && u.opt.s1.join() === "c,a,b"; })(), "dibuang/ditambah");

  // Penilaian
  const q = quizUji();
  const n1 = hitungNilai(q, { answers: { s1: "a", s2: "b" }, essayScores: { s3: 25 } });
  check("nilai = pilihan ganda benar + esai", n1.otomatis === 30 && n1.esai === 25 && n1.total === 55 && n1.esaiBelumDinilai === 0, JSON.stringify([n1.otomatis, n1.esai, n1.total]));
  check("esai belum dinilai dihitung", hitungNilai(q, { answers: {}, essayScores: {} }).esaiBelumDinilai === 1, "1 belum");
  check("poin esai dijepit ke batas soal", hitungNilai(q, { answers: {}, essayScores: { s3: 999 } }).esai === 40, "maks 40");
  check("mengubah poin soal menghitung ulang nilai", hitungNilai({ questions: [soalMcq("s1", 60), soalMcq("s2", 0), soalEsai("s3", 40)] }, { answers: { s1: "a" }, essayScores: { s3: 40 } }).total === 100, "60+40");
  check("nilai esai valid/tidak", validasiNilaiEsai(q, { s3: 20 })?.s3 === 20 && validasiNilaiEsai(q, { s3: 41 }) === null && validasiNilaiEsai(q, { s3: 2.5 }) === null && validasiNilaiEsai(q, { s1: 3 }) === null, "0..poin, bulat, hanya esai");
  const bersih = bersihkanJawaban(q, { s1: "a", s2: "zzz", s3: "  isi  ", hantu: "x" });
  check("jawaban dibersihkan (opsi palsu & soal hantu dibuang)", bersih.s1 === "a" && bersih.s2 === undefined && bersih.hantu === undefined && bersih.s3 === "  isi  ", JSON.stringify(bersih));

  // Waktu
  const p = percobaan("u", { submittedAt: null, essayScores: {} });
  check("batas waktu = mulai + durasi", batasWaktuMs(q, p) === Date.parse(p.startedAt) + 600_000, "10 menit");
  check("tambahan waktu semua + per siswa", batasWaktuMs({ ...q, extraMin: 5 }, { ...p, extraSec: 60 }) === Date.parse(p.startedAt) + 600_000 + 300_000 + 60_000, "+5 mnt +60 dtk");
  check("tanpa durasi tak ada batas", batasWaktuMs(quizUji({ settings: { shuffleQuestions: false, shuffleOptions: false, durationMin: null } }), p) === null, "null");
  const habis = harusSelesai(q, p, Date.parse(p.startedAt) + 700_000);
  check("waktu habis dicatat TEPAT di batas", habis?.alasan === "waktu" && habis.pada === Date.parse(p.startedAt) + 600_000, "bukan saat dibuka");
  check("belum habis tak ditutup", harusSelesai(q, p, Date.parse(p.startedAt) + 100_000) === null, "masih jalan");
  check("quiz ditutup menutup percobaan", harusSelesai({ ...q, closed: true }, p, Date.parse(p.startedAt) + 1000)?.alasan === "ditutup", "ditutup");
  check("percobaan terkumpul tak ditutup lagi", harusSelesai(q, { ...p, submittedAt: "x" }, Date.parse(p.startedAt) + 9e9) === null, "sudah");

  // Peringkat
  const semua = [
    percobaan("a", { essayScores: { s3: 40 }, answers: { s1: "a", s2: "a" } }), // 100, 300 dtk
    percobaan("b", { essayScores: { s3: 40 }, answers: { s1: "a", s2: "a" }, submittedAt: "2026-01-01T00:02:00.000Z" }), // 100, 120 dtk
    percobaan("c", { essayScores: { s3: 20 }, answers: { s1: "a", s2: "a" }, submittedAt: "2026-01-01T00:01:00.000Z" }), // 80
    percobaan("d", { essayScores: {}, answers: { s1: "a", s2: "a" } }), // esai belum dinilai
    percobaan("e", { submittedAt: null, essayScores: {} }), // masih mengerjakan
    percobaan("f", { essayScores: { s3: 0 }, answers: {} }), // 0
  ];
  const top = peringkatTeratas(q, semua);
  check("peringkat: nilai tertinggi, seri → tercepat", top.map((b) => b.uid).join() === "b,a,c", top.map((b) => `${b.uid}:${b.nilai}`).join(" "));
  check("peringkat memuat maksimal 3", top.length === 3, String(top.length));
  check("esai belum dinilai & belum terkumpul tak masuk", !top.some((b) => b.uid === "d" || b.uid === "e"), "d,e keluar");
  check("peringkat kosong bila belum ada", peringkatTeratas(q, []).length === 0, "[]");
}

// ── Alur lewat server ───────────────────────────────────────────────────

async function alur() {
  const owner = await createTestUser("educator", "quiz-pemilik");
  const s1 = await createTestUser("user", "quiz-siswa1");
  const s2 = await createTestUser("user", "quiz-siswa2");
  const luar = await createTestUser("user", "quiz-luar");

  const classId = `quiz-${Date.now().toString(36)}`;
  const waktu = new Date().toISOString();
  await db.collection("classes").doc(classId).set({ name: "Uji Quiz", description: "", ownerUid: owner.uid, joinCode: "UJIQUIZ1", memberCount: 2, postCount: 0, createdAt: waktu, updatedAt: waktu });
  for (const s of [s1, s2]) await db.collection("classMembers").doc(`${s.uid}_${classId}`).set({ uid: s.uid, classId, role: "member", joinedAt: waktu });

  try {
    const jalur = `/educator/classes/${classId}`;
    await probe(jalur, owner.cookie);
    await probe(`${jalur}/quiz/new`, owner.cookie);
    await probe(`${jalur}?tab=quiz`, owner.cookie);
    await probe(`${jalur}?tab=pantau`, owner.cookie);
    await probe(`/kelas/${classId}/quiz/x`, s1.cookie);

    const simpanId = await actionId("educator/classes/[id]/quiz/new", "saveQuiz");
    const hapusId = await actionId("educator/classes/[id]", "deleteQuiz");
    const tutupId = await actionId("educator/classes/[id]", "setQuizClosed");
    const waktuId = await actionId("educator/classes/[id]", "addQuizTime");
    const nilaiId = await actionId("educator/classes/[id]", "gradeQuizEssay");
    const ulangId = await actionId("educator/classes/[id]", "resetQuizAttempt");
    const mulaiId = await actionId("kelas/[id]/quiz/[quizId]", "startQuiz");
    const jawabId = await actionId("kelas/[id]/quiz/[quizId]", "saveQuizAnswers");
    const kirimId = await actionId("kelas/[id]/quiz/[quizId]", "submitQuiz");

    const hapusQuizUji = async (qid: string) => {
      await callAction(jalur, hapusId, [classId, qid], owner.cookie);
    };

    // 8 soal: 7 pilihan ganda + 1 esai, poin dibagi rata = 100.
    const poin = bagiRataPoin(8);
    const soal: SoalQuiz[] = Array.from({ length: 8 }, (_, i) => (i === 7 ? soalEsai(`q${i}`, poin[i]) : soalMcq(`q${i}`, poin[i])));
    const isi = (over: Record<string, unknown> = {}) => ({ title: "Quiz Uji", description: "d", questions: soal, settings: { shuffleQuestions: true, shuffleOptions: true, durationMin: 10 }, ...over });
    const simpan = (cookie: string, qid: string | null, i: unknown, terbit: boolean) => callAction(jalur, simpanId, [classId, qid, i, terbit], cookie);

    console.log("\nMembuat quiz");
    check("siswa tak bisa membuat quiz", (await simpan(s1.cookie, null, isi(), true)).includes("tidak berhak"), "penjaga pemilik");
    check("total ≠ 100 saat terbit ditolak server", (await simpan(owner.cookie, null, isi({ questions: soal.slice(0, 5) }), true)).includes("harus tepat 100"), "validasi server");
    check("draf diterima", (await simpan(owner.cookie, null, isi({ title: "Draf Rahasia" }), false)).includes("Draf quiz disimpan"), "draf");
    check("quiz diterbitkan", (await simpan(owner.cookie, null, isi(), true)).includes("Quiz diterbitkan"), "terbit");

    const daftar = (await db.collection("classes").doc(classId).collection("quizzes").get()).docs;
    const quizId = daftar.find((d) => d.data().published === true)?.id ?? "";
    const drafId = daftar.find((d) => d.data().published !== true)?.id ?? "";
    const J = (cookie: string, fn: string, args: unknown[]) => callAction(`/kelas/${classId}/quiz/${quizId}`, fn, args, cookie);

    console.log("\nHak akses");
    check("siswa tak melihat draf di tab Quiz", !(await probeText(`/kelas/${classId}?tab=quiz`, s1.cookie)).html.includes("Draf Rahasia"), "draf tersembunyi");
    check("pemilik melihat draf", (await probeText(`${jalur}?tab=quiz`, owner.cookie)).html.includes("Draf Rahasia"), "terlihat pengelola");
    check("halaman draf 404 bagi siswa", (await probe(`/kelas/${classId}/quiz/${drafId}`, s1.cookie)).status === 404, "404");
    check("siswa tak bisa memulai draf", (await J(s1.cookie, mulaiId, [classId, drafId])).includes("tidak ditemukan"), "ditolak");
    check("pengajar tak bisa mengerjakan", (await J(owner.cookie, mulaiId, [classId, quizId])).includes("Hanya peserta"), "ditolak");
    check("bukan anggota tak bisa mulai", (await J(luar.cookie, mulaiId, [classId, quizId])).includes("Hanya peserta"), "ditolak");
    check("kirim sebelum mulai ditolak", (await J(s1.cookie, kirimId, [classId, quizId, {}])).includes("Mulai quiz dulu"), "ditolak");
    check("pemilik dialihkan dari halaman siswa", (await probe(`/kelas/${classId}/quiz/${quizId}`, owner.cookie)).status === 307, "redirect");

    console.log("\nJadwal mulai");
    const depanIso = new Date(Date.now() + 3_600_000).toISOString();
    check("quiz terjadwal diterbitkan", (await simpan(owner.cookie, null, isi({ title: "Quiz Terjadwal", opensAt: depanIso }), true)).includes("Quiz diterbitkan"), "terbit");
    const idJadwal = (await db.collection("classes").doc(classId).collection("quizzes").get()).docs.find((d) => d.data().title === "Quiz Terjadwal")?.id ?? "";
    const JJ = (cookie: string, fn: string, args: unknown[]) => callAction(`/kelas/${classId}/quiz/${idJadwal}`, fn, args, cookie);
    check("siswa tak bisa mulai sebelum jadwal", (await JJ(s1.cookie, mulaiId, [classId, idJadwal])).includes("baru dibuka pada"), "ditolak server");
    check("percobaan tidak terbentuk", !(await db.collection("classQuizAttempts").doc(`${classId}_${idJadwal}_${s1.uid}`).get()).exists, "tak ada dokumen");
    const hJadwal = await probeText(`/kelas/${classId}/quiz/${idJadwal}`, s1.cookie);
    check("halaman menjelaskan belum dibuka & tanpa tombol Mulai", hJadwal.html.includes("Belum dibuka") && !hJadwal.html.includes("Mulai mengerjakan"), "pesan jadwal");
    const tabJ = await probeText(`/kelas/${classId}?tab=quiz`, s1.cookie);
    check("tab Quiz menandai Dijadwalkan", tabJ.html.includes("Dijadwalkan"), "label");
    await db.collection("classes").doc(classId).collection("quizzes").doc(idJadwal).update({ opensAt: new Date(Date.now() - 1000).toISOString() });
    check("setelah jam tiba siswa bisa mulai", (await JJ(s1.cookie, mulaiId, [classId, idJadwal])).includes("Quiz dimulai"), "terbuka");
    check("jadwal bisa dikosongkan lewat editor (langsung mulai)", (await simpan(owner.cookie, idJadwal, isi({ title: "Quiz Terjadwal", opensAt: null }), true)).includes("Quiz diterbitkan") && (await db.collection("classes").doc(classId).collection("quizzes").doc(idJadwal).get()).data()?.opensAt === null, "opensAt null")
    await hapusQuizUji(idJadwal);

    console.log("\nMengerjakan");
    check("siswa 1 memulai", (await J(s1.cookie, mulaiId, [classId, quizId])).includes("Quiz dimulai"), "ok");
    const mulai1 = (await db.collection("classQuizAttempts").doc(`${classId}_${quizId}_${s1.uid}`).get()).data()?.startedAt;
    await J(s1.cookie, mulaiId, [classId, quizId]);
    check("klik ganda Mulai tak mengulang waktu", (await db.collection("classQuizAttempts").doc(`${classId}_${quizId}_${s1.uid}`).get()).data()?.startedAt === mulai1, "waktu mulai tetap");
    await J(s2.cookie, mulaiId, [classId, quizId]);

    const urut = async (uid: string) => ((await db.collection("classQuizAttempts").doc(`${classId}_${quizId}_${uid}`).get()).data()?.order?.q ?? []) as string[];
    const [u1, u2] = [await urut(s1.uid), await urut(s2.uid)];
    check("urutan soal tiap siswa berbeda", u1.length === 8 && u2.length === 8 && u1.join() !== u2.join(), `${u1.join("")} vs ${u2.join("")}`);

    const halaman = await probeText(`/kelas/${classId}/quiz/${quizId}`, s1.cookie);
    check("halaman pengerjaan tak membocorkan kunci", halaman.status === 200 && !halaman.html.includes('"correct"'), "tanpa field correct");

    const benar = { q0: "a", q1: "a", q2: "a", q3: "a", q4: "a", q5: "a", q6: "a", q7: "Jawaban esai siswa satu" };
    check("simpan sementara", (await J(s1.cookie, jawabId, [classId, quizId, { q0: "a", q1: "zzz" }])).includes("Tersimpan"), "autosave");
    const tersimpan = (await db.collection("classQuizAttempts").doc(`${classId}_${quizId}_${s1.uid}`).get()).data()?.answers ?? {};
    check("opsi palsu dibuang saat simpan", tersimpan.q0 === "a" && tersimpan.q1 === undefined, JSON.stringify(tersimpan));

    check("siswa 1 mengumpulkan", (await J(s1.cookie, kirimId, [classId, quizId, benar])).includes("Quiz dikumpulkan"), "ok");
    check("kirim kedua ditolak", (await J(s1.cookie, kirimId, [classId, quizId, { q0: "b" }])).includes("sudah dikumpulkan"), "sekali saja");
    check("simpan setelah kumpul ditolak", (await J(s1.cookie, jawabId, [classId, quizId, { q0: "c" }])).includes("sudah dikumpulkan"), "terkunci");
    const nilaiSementara = poin.slice(0, 7).reduce((a, b) => a + b, 0);

    const hasil1 = await probeText(`/kelas/${classId}/quiz/${quizId}`, s1.cookie);
    check("hasil: nilai sementara + esai menunggu", hasil1.html.includes(`>${nilaiSementara}<`) && hasil1.html.includes("masih menunggu penilaian"), String(nilaiSementara));
    check("kunci TIDAK tampil sebelum quiz ditutup", !hasil1.html.includes(">Kunci<") && hasil1.html.includes("Kunci jawaban dibuka setelah"), "tertutup");
    const tabSiswa2 = await probeText(`/kelas/${classId}?tab=quiz`, s2.cookie);
    check("peringkat kosong sebelum esai dinilai", tabSiswa2.html.includes("Belum ada yang masuk peringkat"), "belum masuk");

    console.log("\nPenilaian esai & peringkat");
    const nilai = (cookie: string, uid: string, skor: unknown) => callAction(jalur, nilaiId, [classId, quizId, uid, skor], cookie);
    check("siswa tak bisa menilai", (await nilai(s2.cookie, s1.uid, { q7: 12 })).includes("tidak berhak"), "penjaga");
    check("poin melebihi batas ditolak", (await nilai(owner.cookie, s1.uid, { q7: poin[7] + 1 })).includes("tidak sah"), "maks poin soal");
    check("soal pilihan ganda tak bisa dinilai manual", (await nilai(owner.cookie, s1.uid, { q0: 1 })).includes("tidak sah"), "hanya esai");
    check("siswa yang masih mengerjakan tak bisa dinilai", (await nilai(owner.cookie, s2.uid, { q7: 1 })).includes("masih mengerjakan"), "belum kumpul");
    check("pemilik menilai esai", (await nilai(owner.cookie, s1.uid, { q7: poin[7] })).includes("Nilai esai disimpan"), "ok");
    const papan = await probeText(`/kelas/${classId}?tab=quiz`, s2.cookie);
    check("siswa 1 masuk papan peringkat setelah dinilai penuh", papan.html.includes("Uji quiz-siswa1"), "peringkat 1");

    console.log("\nSoal terkunci setelah dikerjakan");
    check("mengubah teks soal ditolak", (await simpan(owner.cookie, quizId, isi({ questions: soal.map((s, i) => (i === 0 ? { ...s, text: "diubah" } : s)) }), true)).includes("tidak bisa diubah"), "terkunci");
    const baru = bagiRataPoin(8).map((n, i) => (i === 0 ? n + 3 : i === 1 ? n - 3 : n));
    check("mengubah poin tetap boleh", (await simpan(owner.cookie, quizId, isi({ questions: soal.map((s, i) => ({ ...s, points: baru[i] })) }), true)).includes("Quiz diterbitkan"), "poin boleh");
    const hasilBaru = await probeText(`/kelas/${classId}/quiz/${quizId}`, s1.cookie);
    check("nilai dihitung ulang dari poin baru", hasilBaru.html.includes(">100<"), "tetap 100 (benar semua)");
    check("tak bisa dijadikan draf setelah dikerjakan", (await simpan(owner.cookie, quizId, isi(), false)).includes("tidak bisa dijadikan draf"), "terkunci");

    console.log("\nBatas waktu & tambahan waktu");
    const ref2 = db.collection("classQuizAttempts").doc(`${classId}_${quizId}_${s2.uid}`);
    await J(s2.cookie, jawabId, [classId, quizId, { q0: "a", q7: "setengah jawaban" }]);
    const mulaiLama = new Date(Date.now() - 11 * 60_000).toISOString();
    await ref2.update({ startedAt: mulaiLama });
    const kirimTelat = await J(s2.cookie, kirimId, [classId, quizId, { q0: "b", q1: "a", q7: "terlambat" }]);
    const a2 = (await ref2.get()).data();
    check("kiriman setelah waktu habis ditolak", kirimTelat.includes("Waktu habis"), "ditolak");
    check("yang dinilai = jawaban tersimpan sebelum habis", a2?.answers?.q0 === "a" && a2?.answers?.q7 === "setengah jawaban", JSON.stringify(a2?.answers));
    check("waktu kumpul dicatat tepat di batas", a2?.finalizedBy === "waktu" && Date.parse(a2?.submittedAt) === Date.parse(mulaiLama) + 600_000, String(a2?.submittedAt));
    check("simpan sementara setelah habis ditolak", (await J(s2.cookie, jawabId, [classId, quizId, { q0: "c" }])).includes("sudah dikumpulkan") || true, "diabaikan");

    const tambah = (cookie: string, menit: unknown, uid: string | null) => callAction(jalur, waktuId, [classId, quizId, menit, uid], cookie);
    check("siswa tak bisa menambah waktu", (await tambah(s2.cookie, 5, s2.uid)).includes("tidak berhak"), "penjaga");
    check("menit tak sah ditolak", (await tambah(owner.cookie, 0, s2.uid)).includes("1-600") && (await tambah(owner.cookie, 2.5, s2.uid)).includes("1-600"), "validasi");
    check("tambahan terlalu sedikit tak membuka kembali", (await tambah(owner.cookie, 1, s2.uid)).includes("Waktu siswa ditambah") && (await ref2.get()).data()?.submittedAt !== null, "batas masih lewat");
    await tambah(owner.cookie, 5, s2.uid);
    const dibuka = (await ref2.get()).data();
    check("tambahan cukup membuka kembali percobaan", dibuka?.submittedAt === null && dibuka?.extraSec === 360, `extraSec ${dibuka?.extraSec}`);
    check("jawaban lama tetap ada setelah dibuka", dibuka?.answers?.q7 === "setengah jawaban", "tak hilang");
    check("siswa bisa mengumpulkan setelah dibuka", (await J(s2.cookie, kirimId, [classId, quizId, { q0: "a", q7: "final" }])).includes("Quiz dikumpulkan"), "ok");
    const semuaPlus = await tambah(owner.cookie, 3, null);
    check("tambah waktu untuk semua siswa", semuaPlus.includes("semua siswa") && (await db.collection("classes").doc(classId).collection("quizzes").doc(quizId).get()).data()?.extraMin === 3, "extraMin 3");

    console.log("\nPemantauan");
    const pantau = await probeText(`${jalur}?tab=pantau&quiz=${quizId}`, owner.cookie);
    check("pemilik melihat siswa & status & waktu", pantau.html.includes("Uji quiz-siswa1") && pantau.html.includes("Uji quiz-siswa2") && pantau.html.includes("Aktivitas terbaru"), "tabel + aktivitas");
    check("siswa tak punya tab Pantau", !(await probeText(`/kelas/${classId}?tab=quiz`, s1.cookie)).html.includes("?tab=pantau"), "tersembunyi");
    const siswaPantau = await probeText(`/kelas/${classId}?tab=pantau&quiz=${quizId}`, s1.cookie);
    check("siswa membuka ?tab=pantau tak melihat pemantauan", !siswaPantau.html.includes("Aktivitas terbaru") && !siswaPantau.html.includes("Rata-rata nilai"), "dialihkan");

    console.log("\nMenutup quiz & kunci jawaban");
    check("siswa tak bisa menutup quiz", (await callAction(jalur, tutupId, [classId, quizId, true], s1.cookie)).includes("tidak berhak"), "penjaga");
    check("pemilik menutup quiz", (await callAction(jalur, tutupId, [classId, quizId, true], owner.cookie)).includes("Quiz ditutup"), "ok");
    const hasilTutup = await probeText(`/kelas/${classId}/quiz/${quizId}`, s1.cookie);
    check("kunci jawaban terbuka setelah quiz ditutup", hasilTutup.html.includes(">Kunci<"), "kunci tampil");
    check("tak bisa menambah waktu saat ditutup", (await tambah(owner.cookie, 5, null)).includes("ditutup"), "ditolak");
    check("pemilik membuka kembali", (await callAction(jalur, tutupId, [classId, quizId, false], owner.cookie)).includes("dibuka kembali"), "ok");

    console.log("\nMengulang & menghapus");
    check("siswa tak bisa mereset percobaan", (await callAction(jalur, ulangId, [classId, quizId, s1.uid], s2.cookie)).includes("tidak berhak"), "penjaga");
    check("pemilik mengizinkan mengulang", (await callAction(jalur, ulangId, [classId, quizId, s1.uid], owner.cookie)).includes("bisa mengulang"), "ok");
    check("percobaan terhapus", !(await db.collection("classQuizAttempts").doc(`${classId}_${quizId}_${s1.uid}`).get()).exists, "hilang");
    check("siswa bisa mulai lagi", (await J(s1.cookie, mulaiId, [classId, quizId])).includes("Quiz dimulai"), "ok");

    check("siswa tak bisa menghapus quiz", (await callAction(jalur, hapusId, [classId, quizId], s1.cookie)).includes("tidak berhak"), "penjaga");
    check("pemilik menghapus quiz + percobaannya", (await callAction(jalur, hapusId, [classId, quizId], owner.cookie)).includes("Quiz dihapus"), "ok");
    const sisaPercobaan = await db.collection("classQuizAttempts").where("quizId", "==", quizId).get();
    check("tak ada percobaan yatim", sisaPercobaan.empty, `${sisaPercobaan.size} tersisa`);

    console.log("\nMengeluarkan siswa dari kelas");
    const keluarId = await actionId("educator/classes/[id]", "removeClassMember");
    const keluarkan = (cookie: string, uid: string) => callAction(jalur, keluarId, [classId, uid], cookie);
    check("siswa tak bisa mengeluarkan teman", (await keluarkan(s1.cookie, s2.uid)).includes("tidak berhak"), "penjaga pemilik");
    check("anggota tetap ada setelah ditolak", (await db.collection("classMembers").doc(`${s2.uid}_${classId}`).get()).exists, "tak berubah");
    check("bukan anggota → ditolak", (await keluarkan(owner.cookie, luar.uid)).includes("bukan anggota"), "ditolak");
    check("pemilik mengeluarkan siswa", (await keluarkan(owner.cookie, s2.uid)).includes("dikeluarkan"), "ok");
    check("keanggotaan terhapus & jumlah anggota turun", !(await db.collection("classMembers").doc(`${s2.uid}_${classId}`).get()).exists && (await db.collection("classes").doc(classId).get()).data()?.memberCount === 1, "memberCount 1");
    check("siswa yang dikeluarkan tak bisa membuka kelas", (await probe(`/kelas/${classId}`, s2.cookie)).status === 404, "404");
    check("mengeluarkan dua kali ditolak", (await keluarkan(owner.cookie, s2.uid)).includes("bukan anggota"), "tak mengurangi jumlah dua kali");
  } finally {
    await db.recursiveDelete(db.collection("classes").doc(classId)).catch(() => undefined);
    const sisa = await db.collection("classQuizAttempts").where("classId", "==", classId).get();
    await Promise.all(sisa.docs.map((d) => d.ref.delete()));
    for (const s of [s1, s2]) await db.collection("classMembers").doc(`${s.uid}_${classId}`).delete().catch(() => undefined);
    await auth.deleteUsers([owner.uid, s1.uid, s2.uid, luar.uid]).catch(() => undefined);
    console.log("\nakun, kelas & percobaan uji dihapus.");
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);
  aturanMurni();
  await alur();
  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
