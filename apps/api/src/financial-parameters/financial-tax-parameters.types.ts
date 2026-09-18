export interface FinancialTaxParameterFallbacks {
  iva: number;
  spa: number;
  ivaSpa: number;
  specialSpa: number;
}

export interface FinancialTaxDefaults {
  iva: number;
  spa: number;
  ivaSpa: number;
  specialSpa: number;
}

export type FinancialTaxParameterName = keyof FinancialTaxDefaults;
