import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthTokenService } from './auth-token.service';
import { RequestUser } from './auth-user.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authTokenService: AuthTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const token = this.getBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const payload = this.authTokenService.verify(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid bearer token');
    }

    request.user = { userId: payload.userId, roleId: payload.roleId };
    return true;
  }

  private getBearerToken(authorization: string | undefined): string | null {
    if (!authorization) return null;

    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) return null;

    return token;
  }
}
