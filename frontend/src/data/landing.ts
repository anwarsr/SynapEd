// Data untuk landing page — dikonversi dari HomeController.php

export interface Stat {
  value: string;
  label: string;
  icon: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface CourseCategory {
  slug: string;
  label: string;
}

export const courseCategories: CourseCategory[] = [
  { slug: 'semua', label: 'Semua Materi' },
  { slug: 'neuroscience', label: 'Neuroscience' },
  { slug: 'eeg', label: 'Teknologi EEG' },
  { slug: 'analisis', label: 'Analisis Data' },
];

export const faqs: FAQ[] = [
  {
    question: 'Siapa saja yang dapat menggunakan platform SynapEd?',
    answer: 'SynapEd terbuka untuk semua kalangan — pelajar SMA, SMK, mahasiswa, hingga profesional yang ingin memperdalam berbagai bidang ilmu. Tidak diperlukan latar belakang khusus untuk memulai.',
  },
  {
    question: 'Apakah saya perlu latar belakang tertentu untuk memulai?',
    answer: 'Tidak sama sekali. Kurikulum SynapEd dirancang mulai dari level pemula yang tidak mengasumsikan pengetahuan sebelumnya. Semua orang bisa belajar dari nol.',
  },
  {
    question: 'Bidang ilmu apa saja yang tersedia di SynapEd?',
    answer: 'SynapEd menyediakan berbagai bidang ilmu mulai dari Neuroscience, Teknologi, Data Science, Pemrograman, hingga bidang-bidang lainnya yang terus bertambah. Setiap materi disusun secara terstruktur dari dasar hingga mahir.',
  },
  {
    question: 'Berapa lama waktu yang dibutuhkan untuk menyelesaikan satu kursus?',
    answer: 'Tergantung pada kursus yang dipilih, rata-rata 2–6 minggu jika belajar 1–2 jam per hari. Semua kursus bersifat self-paced, sehingga Anda bisa mengatur waktu sesuai kenyamanan Anda sendiri.',
  },
  {
    question: 'Apakah ada sertifikat setelah menyelesaikan kursus?',
    answer: 'Ya, peserta yang menyelesaikan seluruh modul dan lulus evaluasi akan mendapatkan sertifikat digital dari SynapEd yang dapat dibagikan di LinkedIn atau portofolio Anda.',
  },
];

export const learningSteps = [
  { num: '01', title: 'Daftar', desc: 'Buat akun dan mulai akses seluruh kurikulum.', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
  { num: '02', title: 'Pilih Materi', desc: 'Jelajahi kurikulum dan pilih modul sesuai minat.', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { num: '03', title: 'Belajar', desc: 'Tonton video, modul PDF, dan selesaikan kuis.', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z' },
  { num: '04', title: 'Praktik', desc: 'Terapkan ilmu melalui studi kasus dan proyek nyata.', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
  { num: '05', title: 'Evaluasi', desc: 'Ikuti ujian akhir dan dapatkan sertifikat digital.', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
];

export const features = [
  { title: 'Kurikulum Terverifikasi', desc: 'Materi dikurasi oleh para ahli dan praktisi berpengalaman di bidangnya.' },
  { title: 'Video Berkualitas', desc: 'Video rekaman & animasi terstruktur yang sangat mudah dipahami.' },
  { title: 'Modul PDF Lengkap', desc: 'Ringkasan PDF yang dapat diunduh untuk mendukung belajar secara offline.' },
  { title: 'Studi Kasus Praktis', desc: 'Studi kasus nyata dan panduan praktik untuk melatih skill secara langsung.' },
  { title: 'Akses Fleksibel', desc: 'Responsif di laptop, tablet, atau smartphone. Belajar di mana saja.' },
  { title: 'Berbasis Riset', desc: 'Kurikulum disusun berdasarkan standar riset teknologi terbaru.' },
];
