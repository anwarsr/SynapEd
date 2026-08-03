/**
 * Memindahkan akun dari database SQLite Laravel ke database Nest.
 *
 * Hash bcrypt Laravel berawalan `$2y$`. Prefiks itu tidak diubah di sini —
 * PasswordService yang menormalkannya saat verifikasi, jadi sandi lama
 * tetap berfungsi tanpa perlu reset.
 *
 * Jalankan sekali: npx tsx prisma/migrate-laravel-users.ts
 */
import { PrismaClient } from '@prisma/client';
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const LARAVEL_DB = resolve(__dirname, '../../database/database.sqlite');
const prisma = new PrismaClient();

interface LaravelUser {
  id: number;
  name: string;
  email: string;
  password: string;
  email_verified_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

async function main() {
  if (!existsSync(LARAVEL_DB)) {
    console.log(`Database Laravel tidak ditemukan di ${LARAVEL_DB} — dilewati.`);
    return;
  }

  const source = new DatabaseSync(LARAVEL_DB, { readOnly: true });
  const rows = source
    .prepare('SELECT id, name, email, password, email_verified_at, created_at, updated_at FROM users')
    .all() as unknown as LaravelUser[];
  source.close();

  console.log(`Ditemukan ${rows.length} akun di database Laravel.`);

  let imported = 0;
  let skipped = 0;

  for (const u of rows) {
    const email = u.email.toLowerCase().trim();
    const exists = await prisma.user.findUnique({ where: { email } });

    if (exists) {
      console.log(`  lewati  ${email} (sudah ada)`);
      skipped++;
      continue;
    }

    await prisma.user.create({
      data: {
        name: u.name,
        email,
        password: u.password, // hash $2y$ dibiarkan apa adanya
        emailVerifiedAt: toDate(u.email_verified_at),
        createdAt: toDate(u.created_at) ?? new Date(),
      },
    });

    console.log(`  impor   ${email}`);
    imported++;
  }

  console.log(`\nSelesai: ${imported} diimpor, ${skipped} dilewati.`);
  console.log(`Total akun di DB Nest: ${await prisma.user.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
