/**
 * Tipe & pembuat draft soal kuis — dipakai bersama oleh QuizEditor.tsx
 * (memuat/menyimpan kuis pelajaran yang sudah tersimpan) dan curriculumDraft.tsx
 * (draft kuis pelajaran yang BELUM tersimpan, diisi langsung di form buat
 * kursus). Lihat komentar di curriculumDraft.tsx untuk kenapa keduanya perlu
 * jalur terpisah.
 */

export interface DraftOption {
  id: string;
  text: string;
}

// Bentuk standalone, BUKAN diturunkan lewat `&` dari QuizQuestionInput —
// `options` di sana bertipe QuizOptionInput[] (id opsional), dan
// mengintersect-nya dengan tipe options yang id-nya wajib menghasilkan tipe
// gabungan aneh yang tidak bisa ditugaskan apa pun ("A[] & B[]" bukan "B[]").
export interface DraftQuestion {
  id: string;
  prompt: string;
  options: DraftOption[];
  correctOptionId: string;
  explanation: string;
  points: number;
}

export interface QuizDraftState {
  passingScore: number;
  maxAttempts: number;
  questions: DraftQuestion[];
}

export function newOption(): DraftOption {
  return { id: crypto.randomUUID().slice(0, 8), text: "" };
}

export function newQuestion(): DraftQuestion {
  const options = [newOption(), newOption()];
  return {
    id: crypto.randomUUID().slice(0, 8),
    prompt: "",
    options,
    correctOptionId: options[0].id,
    explanation: "",
    points: 10,
  };
}

export function emptyQuizDraft(): QuizDraftState {
  return { passingScore: 70, maxAttempts: 3, questions: [] };
}
