import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { EmailModule } from '../email/email.module';
import { AuthController } from './auth.controller';
import { AdminRoleGuard } from './admin-role.guard';
import { AuthGuard } from './auth.guard';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { PasswordRecoveryEmailService } from './password-recovery-email.service';

@Module({
  imports: [DbModule, EmailModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, PasswordRecoveryEmailService, AuthTokenService, AuthGuard, AdminRoleGuard],
  exports: [AuthTokenService, AuthGuard, AdminRoleGuard],
})
export class AuthModule {}
