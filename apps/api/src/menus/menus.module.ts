import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { MenusController, SystemMenusController } from './menus.controller';
import { MenusRepository } from './menus.repository';
import { MenusService } from './menus.service';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [MenusController, SystemMenusController],
  providers: [MenusService, MenusRepository],
})
export class MenusModule {}
