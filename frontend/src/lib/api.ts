/**
 * Klien API SynapEd.
 *
 * Katalog kursus kini datang dari NestJS + Prisma, bukan lagi konstanta
 * di src/data/courses.ts. Catatan Next 16: `fetch` TIDAK di-cache secara
 * default, jadi data selalu segar tanpa perlu `cache: 'no-store'`.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

// ── Tipe ────────────────────────────────────────────────────────────────

export interface CourseSummary {
  id: number;
  slug: string;
  title: string;
  shortDesc: string;
  level: string;
  levelColor: 'green' | 'yellow' | 'red' | string;
  category: string;
  icon: string;
  tint: string;
  duration: string;
  rating: number;
  reviews: number;
  lessonsCount: number;
}

export interface Lesson {
  id: number;
  slug: string;
  title: string;
  type: 'video' | 'reading' | 'quiz' | string;
  duration: string;
  free: boolean;
}

export interface Section {
  id: number;
  title: string;
  lessons: Lesson[];
}

export interface CourseDetail extends CourseSummary {
  longDesc: string;
  price: number;
  thumbnail: string | null;
  enrolledStudents: number;
  lastUpdated: string | null;
  instructorName: string;
  instructorBio: string;
  whatYouLearn: string[];
  requirements: string[];
  sections: Section[];
}

export interface Category {
  slug: string;
  label: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  emailVerifiedAt: string | null;
  createdAt: string;
}

// ── Inti ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    // Wajib: token ada di cookie httpOnly, bukan di header.
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  if (!res.ok) {
    let message = `Permintaan gagal (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) message = body.message.join(', ');
      else if (body.message) message = body.message;
    } catch {
      // biarkan pesan default
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── Kursus ──────────────────────────────────────────────────────────────

export const coursesApi = {
  list: (category?: string) =>
    request<CourseSummary[]>(
      `/courses${category && category !== 'semua' ? `?category=${encodeURIComponent(category)}` : ''}`,
    ),
  categories: () => request<Category[]>('/courses/categories'),
  detail: (slug: string) => request<CourseDetail>(`/courses/${encodeURIComponent(slug)}`),
};

// ── Auth ────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    request<AuthUser>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<AuthUser>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  me: () => request<AuthUser>('/auth/me'),
};
