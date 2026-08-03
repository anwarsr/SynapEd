import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export const ACCESS_COOKIE = 'synaped_access';
export const REFRESH_COOKIE = 'synaped_refresh';

export interface AccessPayload {
  sub: number;
  email: string;
}

/**
 * `expiresIn` bertipe literal template dari paket `ms` ("15m", "7d", …),
 * bukan string bebas — jadi nilai dari .env perlu dipersempit ke tipe itu.
 */
type Ttl = NonNullable<JwtSignOptions['expiresIn']>;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private cookieBase(): CookieOptions {
    const secure = this.config.get<string>('COOKIE_SECURE') === 'true';
    const domain = this.config.get<string>('COOKIE_DOMAIN') || undefined;
    return {
      httpOnly: true, // JS di browser tidak bisa membacanya -> kebal XSS
      sameSite: 'lax',
      secure,
      domain,
      path: '/',
    };
  }

  signAccess(payload: AccessPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: (this.config.get<string>('JWT_ACCESS_TTL') ?? '15m') as Ttl,
    });
  }

  verifyAccess(token: string): Promise<AccessPayload> {
    return this.jwt.verifyAsync<AccessPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Refresh token adalah nilai acak (bukan JWT) dan yang disimpan di DB
   * hanya hash-nya. Kalau isi DB bocor, token di dalamnya tidak bisa
   * langsung dipakai. Ini juga yang membuat logout benar-benar mencabut
   * akses — sesuatu yang tidak bisa dilakukan JWT murni.
   */
  async issueRefresh(userId: number): Promise<string> {
    const raw = randomBytes(48).toString('hex');
    const ttlDays = Number(
      (this.config.get<string>('JWT_REFRESH_TTL') ?? '7d').replace(/\D/g, '') || 7,
    );

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(raw),
        userId,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });

    return raw;
  }

  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async revokeRefresh(raw: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: number): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  setCookies(res: Response, accessToken: string, refreshToken: string): void {
    const base = this.cookieBase();
    res.cookie(ACCESS_COOKIE, accessToken, { ...base, maxAge: 15 * 60 * 1000 });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...base,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      // Refresh hanya pernah dikirim ke endpoint refresh/logout,
      // jadi jangkauannya dipersempit.
      path: '/api/auth',
    });
  }

  clearCookies(res: Response): void {
    const base = this.cookieBase();
    res.clearCookie(ACCESS_COOKIE, base);
    res.clearCookie(REFRESH_COOKIE, { ...base, path: '/api/auth' });
  }
}
