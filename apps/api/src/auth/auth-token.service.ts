import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface AuthTokenPayload {
  userId: number;
  roleId: number;
  exp: number;
}

@Injectable()
export class AuthTokenService {
  private readonly ttlSeconds = 8 * 60 * 60;
  private readonly fallbackSecret = randomBytes(32).toString('base64url');

  sign(user: { id: number; roleId: number }): string {
    const payload: AuthTokenPayload = {
      userId: user.id,
      roleId: user.roleId,
      exp: Math.floor(Date.now() / 1000) + this.ttlSeconds,
    };

    const header = this.encode({ alg: 'HS256', typ: 'SONOFFICE' });
    const body = this.encode(payload);
    const signature = this.signature(`${header}.${body}`);

    return `${header}.${body}.${signature}`;
  }

  verify(token: string): AuthTokenPayload | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSignature = this.signature(`${header}.${body}`);

    if (!this.safeEqual(signature, expectedSignature)) return null;

    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AuthTokenPayload;
      if (!Number.isInteger(payload.userId) || !Number.isInteger(payload.roleId)) return null;
      if (!Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;

      return payload;
    } catch {
      return null;
    }
  }

  private encode(value: unknown): string {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  }

  private signature(value: string): string {
    return createHmac('sha256', this.secret()).update(value).digest('base64url');
  }

  private safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private secret(): string {
    return process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET || this.fallbackSecret;
  }
}
