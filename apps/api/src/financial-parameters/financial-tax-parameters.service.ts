import { Injectable } from '@nestjs/common';
import { FinancialTaxDefaults, FinancialTaxParameterFallbacks } from './financial-tax-parameters.types';
import { FinancialTaxParametersRepository } from './financial-tax-parameters.repository';

@Injectable()
export class FinancialTaxParametersService {
  constructor(private readonly repository: FinancialTaxParametersRepository) {}

  async defaults(fallbacks: FinancialTaxParameterFallbacks): Promise<FinancialTaxDefaults> {
    const values = await this.repository.values();
    return {
      iva: values.iva ?? fallbacks.iva,
      spa: values.spa ?? fallbacks.spa,
      ivaSpa: values.ivaSpa ?? fallbacks.ivaSpa,
      specialSpa: values.specialSpa ?? fallbacks.specialSpa,
    };
  }
}
