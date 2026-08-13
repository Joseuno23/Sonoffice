import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { SystemUsersController } from './system-users.controller';
import { SystemUsersRepository } from './system-users.repository';
import { SystemUsersService } from './system-users.service';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [SystemUsersController],
  providers: [SystemUsersRepository, SystemUsersService],
})
export class SystemUsersModule {}
