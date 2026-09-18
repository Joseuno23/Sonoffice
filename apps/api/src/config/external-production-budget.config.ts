import { registerAs } from '@nestjs/config';

const parseNumberList = (value: string | undefined, fallback: number[]): number[] => {
  if (!value) return fallback;
  const parsed = value.split(',').map((item) => Number.parseInt(item.trim(), 10)).filter((item) => Number.isFinite(item));
  return parsed.length ? parsed : fallback;
};

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export interface ExternalProductionBudgetConfig {
  type: number;
  tpoDoc: string;
  statuses: {
    active: number;
    printed: number;
    creditNote: number;
    cancelled: number;
  };
  excludedStatusLabels: string[];
  costOrderStatuses: {
    printed: number;
    finalized: number;
    canceled: number;
    pending: number;
  };
  externalServiceType: string;
  defaultIva: number;
  defaultSpa: number;
  defaultIvaSpa: number;
  specialSpaClientId: number;
  specialSpa: number;
  specialSpaServiceIds: number[];
  editableIncentiveCostServiceIds: number[];
}

export default registerAs(
  'externalProductionBudget',
  (): ExternalProductionBudgetConfig => ({
    type: parseNumber(process.env.EXTERNAL_PRODUCTION_BUDGET_TYPE, 6),
    tpoDoc: process.env.EXTERNAL_PRODUCTION_BUDGET_TPO_DOC || 'externa',
    statuses: {
      active: parseNumber(process.env.EXTERNAL_PRODUCTION_BUDGET_STATUS_ACTIVE, 1),
      printed: parseNumber(process.env.EXTERNAL_PRODUCTION_BUDGET_STATUS_PRINTED, 5),
      creditNote: parseNumber(process.env.EXTERNAL_PRODUCTION_BUDGET_STATUS_CREDIT_NOTE, 47),
      cancelled: parseNumber(process.env.EXTERNAL_PRODUCTION_BUDGET_STATUS_CANCELLED, 9999),
    },
    excludedStatusLabels: ['anulado facturado', 'enviada a cen'],
    costOrderStatuses: {
      printed: parseNumber(process.env.EXTERNAL_PRODUCTION_COST_ORDER_STATUS_PRINTED, 27),
      finalized: parseNumber(process.env.EXTERNAL_PRODUCTION_COST_ORDER_STATUS_FINALIZED, 8),
      canceled: parseNumber(process.env.EXTERNAL_PRODUCTION_COST_ORDER_STATUS_CANCELED, 4),
      pending: parseNumber(process.env.EXTERNAL_PRODUCTION_COST_ORDER_STATUS_PENDING, 25),
    },
    externalServiceType: process.env.EXTERNAL_PRODUCTION_BUDGET_SERVICE_TYPE || 'E',
    defaultIva: parseNumber(process.env.EXTERNAL_PRODUCTION_BUDGET_DEFAULT_IVA, 19),
    defaultSpa: parseNumber(process.env.EXTERNAL_PRODUCTION_BUDGET_DEFAULT_SPA, 10),
    defaultIvaSpa: parseNumber(process.env.EXTERNAL_PRODUCTION_BUDGET_DEFAULT_IVA_SPA, 19),
    specialSpaClientId: parseNumber(process.env.EXTERNAL_PRODUCTION_BUDGET_SPECIAL_SPA_CLIENT_ID, 1339),
    specialSpa: parseNumber(process.env.EXTERNAL_PRODUCTION_BUDGET_SPECIAL_SPA, 6),
    specialSpaServiceIds: parseNumberList(
      process.env.EXTERNAL_PRODUCTION_BUDGET_SPECIAL_SPA_SERVICE_IDS,
      [23, 24, 26, 27, 28, 30, 56, 57, 58, 59, 60, 61, 75, 76, 77, 103, 131, 139, 140, 141, 158],
    ),
    editableIncentiveCostServiceIds: parseNumberList(
      process.env.EXTERNAL_PRODUCTION_BUDGET_EDITABLE_INCENTIVE_COST_SERVICE_IDS,
      [160, 163, 170, 173],
    ),
  }),
);
