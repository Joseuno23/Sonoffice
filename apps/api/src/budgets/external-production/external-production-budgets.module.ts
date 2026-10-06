import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { DbModule } from '../../db/db.module';
import { FinancialTaxParametersModule } from '../../financial-parameters/financial-tax-parameters.module';
import { PermissionsModule } from '../../permissions/permissions.module';
import { ExternalProductionBudgetsController } from './external-production-budgets.controller';
import { ExternalProductionBudgetsRepository } from './external-production-budgets.repository';
import { ExternalProductionBudgetsService } from './external-production-budgets.service';

@Module({
  imports: [AuthModule, DbModule, FinancialTaxParametersModule, PermissionsModule],
  controllers: [ExternalProductionBudgetsController],
  providers: [ExternalProductionBudgetsService, ExternalProductionBudgetsRepository],
})
export class ExternalProductionBudgetsModule {}
