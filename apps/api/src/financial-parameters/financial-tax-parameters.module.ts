import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { FinancialTaxParametersRepository } from './financial-tax-parameters.repository';
import { FinancialTaxParametersService } from './financial-tax-parameters.service';

@Module({
  imports: [DbModule],
  providers: [FinancialTaxParametersRepository, FinancialTaxParametersService],
  exports: [FinancialTaxParametersService],
})
export class FinancialTaxParametersModule {}
