import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { RequestUser } from './auth-user.decorator';

const ROOT_ROLE_ID = 1;

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();

    if (request.user?.roleId !== ROOT_ROLE_ID) {
      throw new ForbiddenException('Admin role required');
    }

    return true;
  }
}
