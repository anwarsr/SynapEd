import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { ACCESS_COOKIE, TokenService } from './token.service';

export interface AuthedRequest extends Request {
  user: { id: number; email: string };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    // Cookie adalah sumber utama. Header Bearer tetap diterima supaya
    // API bisa diuji lewat curl/Postman tanpa harus mengurus cookie.
    const fromCookie = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
    const fromHeader = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined;

    const token = fromCookie ?? fromHeader;
    if (!token) throw new UnauthorizedException('Belum masuk.');

    try {
      const payload = await this.tokens.verifyAccess(token);
      req.user = { id: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException('Sesi tidak valid atau sudah kedaluwarsa.');
    }
  }
}
