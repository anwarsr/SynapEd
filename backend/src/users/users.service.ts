import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import type { ChangePasswordDto, DeleteAccountDto, UpdateProfileDto } from './dto/users.dto';

const publicSelect = {
  id: true,
  name: true,
  email: true,
  emailVerifiedAt: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  private async requireUser(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Akun tidak ditemukan.');
    return user;
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.requireUser(userId);
    const email = dto.email?.toLowerCase().trim();

    if (email && email !== user.email) {
      const taken = await this.prisma.user.findUnique({ where: { email } });
      if (taken) throw new ConflictException('Email ini sudah dipakai akun lain.');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name?.trim() ?? undefined,
        email: email ?? undefined,
        // Sama seperti Laravel: ganti email membatalkan status verifikasi.
        emailVerifiedAt: email && email !== user.email ? null : undefined,
      },
      select: publicSelect,
    });
  }

  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
    const user = await this.requireUser(userId);

    const ok = await this.passwords.compare(dto.currentPassword, user.password);
    if (!ok) throw new UnauthorizedException('Kata sandi saat ini salah.');

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: await this.passwords.hash(dto.newPassword) },
    });

    // Ganti sandi = cabut semua sesi lain. Inilah gunanya menyimpan
    // refresh token di DB; JWT murni tidak bisa melakukan ini.
    await this.tokens.revokeAllForUser(userId);
  }

  async deleteAccount(userId: number, dto: DeleteAccountDto, res: Response): Promise<void> {
    const user = await this.requireUser(userId);

    const ok = await this.passwords.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Kata sandi salah.');

    // Cascade pada relasi ikut menghapus refresh token miliknya.
    await this.prisma.user.delete({ where: { id: userId } });
    this.tokens.clearCookies(res);
  }
}
