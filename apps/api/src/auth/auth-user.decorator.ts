import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthTokenPayload } from './auth-token.service';

export type RequestUser = Pick<AuthTokenPayload, 'userId' | 'roleId'>;

export const AuthUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser | null => {
  const request = ctx.switchToHttp().getRequest<Request & { user?: RequestUser }>();
  return request.user ?? null;
});
