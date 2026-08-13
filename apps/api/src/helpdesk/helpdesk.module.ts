import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { EmailModule } from '../email/email.module';
import { HelpdeskController } from './helpdesk.controller';
import { HelpdeskEmailService } from './helpdesk-email.service';
import { HelpdeskRepository } from './helpdesk.repository';
import { HelpdeskService } from './helpdesk.service';

@Module({
  imports: [AuthModule, DbModule, EmailModule],
  controllers: [HelpdeskController],
  providers: [HelpdeskService, HelpdeskRepository, HelpdeskEmailService],
})
export class HelpdeskModule {}
