import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { DbModule } from '../../db/db.module';
import { FinancialTaxParametersModule } from '../../financial-parameters/financial-tax-parameters.module';
import { PermissionsModule } from '../../permissions/permissions.module';
import { InternalProductionBudgetsController } from './internal-production-budgets.controller';
import { InternalProductionBudgetsRepository } from './internal-production-budgets.repository';
import { InternalProductionBudgetsService } from './internal-production-budgets.service';

@Module({
  imports: [AuthModule, DbModule, FinancialTaxParametersModule, PermissionsModule],
  controllers: [InternalProductionBudgetsController],
  providers: [InternalProductionBudgetsService, InternalProductionBudgetsRepository],
})
export class InternalProductionBudgetsModule {}
