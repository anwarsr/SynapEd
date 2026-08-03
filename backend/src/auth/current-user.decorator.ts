import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthedRequest } from './jwt-auth.guard';

/** Mengambil user yang sudah diverifikasi JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedRequest['user'] =>
    ctx.switchToHttp().getRequest<AuthedRequest>().user,
);
