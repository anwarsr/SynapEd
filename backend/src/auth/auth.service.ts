import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import type { LoginDto, RegisterDto } from './dto/auth.dto';

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

const publicSelect = {
  id: true,
  name: true,
  email: true,
  emailVerifiedAt: true,
  createdAt: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  private async establishSession(
    res: Response,
    user: { id: number; email: string },
  ): Promise<void> {
    const [access, refresh] = await Promise.all([
      this.tokens.signAccess({ sub: user.id, email: user.email }),
      this.tokens.issueRefresh(user.id),
    ]);
    this.tokens.setCookies(res, access, refresh);
  }

  async register(dto: RegisterDto, res: Response): Promise<PublicUser> {
    const email = dto.email.toLowerCase().trim();

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email ini sudah terdaftar.');

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        password: await this.passwords.hash(dto.password),
      },
      select: publicSelect,
    });

    await this.establishSession(res, user);
    return user;
  }

  async login(dto: LoginDto, res: Response): Promise<PublicUser> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Pesan yang sama untuk email tidak ada maupun sandi salah —
    // supaya tidak bisa dipakai menebak email mana yang terdaftar.
    const invalid = new UnauthorizedException('Email atau kata sandi salah.');
    if (!user) {
      // Tetap jalankan satu perbandingan agar waktu responsnya mirip.
      await this.passwords.compare(dto.password, '$2b$12$' + 'x'.repeat(53));
      throw invalid;
    }

    const ok = await this.passwords.compare(dto.password, user.password);
    if (!ok) throw invalid;

    await this.establishSession(res, user);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }

  async refresh(rawRefresh: string | undefined, res: Response): Promise<PublicUser> {
    if (!rawRefresh) throw new UnauthorizedException('Tidak ada sesi untuk diperbarui.');

    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.tokens.hashToken(rawRefresh) },
      include: { user: { select: publicSelect } },
    });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      this.tokens.clearCookies(res);
      throw new UnauthorizedException('Sesi sudah berakhir, silakan masuk lagi.');
    }

    // Rotasi: token lama langsung dicabut agar tidak bisa dipakai ulang.
    await this.tokens.revokeRefresh(rawRefresh);
    await this.establishSession(res, { id: record.user.id, email: record.user.email });

    return record.user;
  }

  async logout(rawRefresh: string | undefined, res: Response): Promise<void> {
    if (rawRefresh) await this.tokens.revokeRefresh(rawRefresh);
    this.tokens.clearCookies(res);
  }

  async me(userId: number): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicSelect,
    });
    if (!user) throw new UnauthorizedException('Akun tidak ditemukan.');
    return user;
  }
}
