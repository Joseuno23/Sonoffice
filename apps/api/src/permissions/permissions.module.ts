import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { PermissionsController } from './permissions.controller';
import { PermissionsRepository } from './permissions.repository';
import { PermissionsService } from './permissions.service';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionsRepository],
  exports: [PermissionsService],
})
export class PermissionsModule {}
