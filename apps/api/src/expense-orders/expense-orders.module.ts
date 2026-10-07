import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ExpenseOrdersController } from './expense-orders.controller';
import { ExpenseOrdersRepository } from './expense-orders.repository';
import { ExpenseOrdersService } from './expense-orders.service';

@Module({
  imports: [AuthModule, DbModule, PermissionsModule],
  controllers: [ExpenseOrdersController],
  providers: [ExpenseOrdersService, ExpenseOrdersRepository],
})
export class ExpenseOrdersModule {}
