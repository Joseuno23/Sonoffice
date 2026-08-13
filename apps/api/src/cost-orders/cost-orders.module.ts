import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { CostOrdersController } from './cost-orders.controller';
import { CostOrdersRepository } from './cost-orders.repository';
import { CostOrdersService } from './cost-orders.service';

@Module({
  imports: [AuthModule, DbModule, PermissionsModule],
  controllers: [CostOrdersController],
  providers: [CostOrdersService, CostOrdersRepository],
})
export class CostOrdersModule {}
