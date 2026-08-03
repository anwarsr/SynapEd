import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

const ROUNDS = 12;

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, ROUNDS);
  }

  /**
   * Laravel menulis hash dengan prefiks `$2y$`, sedangkan pustaka Node
   * memakai `$2a$`/`$2b$`. Algoritmanya identik — hanya penanda versinya
   * yang berbeda — jadi prefiksnya dinormalkan agar akun lama tetap bisa
   * login setelah migrasi.
   */
  compare(plain: string, hash: string): Promise<boolean> {
    const normalised = hash.startsWith('$2y$') ? `$2b$${hash.slice(4)}` : hash;
    return bcrypt.compare(plain, normalised);
  }
}
