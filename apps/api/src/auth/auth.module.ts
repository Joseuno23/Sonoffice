import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { PasswordRecoveryEmailService } from './password-recovery-email.service';

@Module({
  imports: [DbModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, PasswordRecoveryEmailService],
})
export class AuthModule {}
