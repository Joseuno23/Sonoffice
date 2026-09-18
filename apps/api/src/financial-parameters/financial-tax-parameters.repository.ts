import { Injectable } from '@nestjs/common';
import { RowDataPacket } from 'mysql2';
import { DbService } from '../db/db.service';
import { FinancialTaxParameterName } from './financial-tax-parameters.types';

interface SysParameterColumnRow extends RowDataPacket { columnName: string; }
interface SysParameterRow extends RowDataPacket { parameterKey: string | null; parameterValue: string | number | null; }

interface SysParameterSchema {
  keyColumn: string;
  valueColumn: string;
}

// sys_parameter schema is legacy-dependent, so inspect known key/value column names
// and match known financial-tax parameter keys after accent/case/separator normalization.
const KEY_COLUMNS = ['par_nombre', 'par_name', 'parametro', 'parameter', 'nombre', 'name', 'clave', 'key', 'codigo', 'code'];
const VALUE_COLUMNS = ['par_valor', 'par_value', 'valor', 'value'];

const PARAMETER_KEYS: Record<FinancialTaxParameterName, string[]> = {
  iva: ['iva', 'default_iva', 'psex_iva', 'presupuesto_iva', 'presup_prode_iva'],
  spa: ['spa', 'default_spa', 'psex_spa', 'presupuesto_spa', 'presup_prode_spa'],
  ivaSpa: ['iva_spa', 'ivaspa', 'default_iva_spa', 'default_ivaspa', 'psex_ivaspa', 'presupuesto_iva_spa', 'presup_prode_ivaspa'],
  specialSpa: ['special_spa', 'spa_especial', 'psex_special_spa', 'psex_spa_especial', 'presupuesto_special_spa', 'presup_prode_special_spa'],
};

@Injectable()
export class FinancialTaxParametersRepository {
  private schemaPromise?: Promise<SysParameterSchema | null>;

  constructor(private readonly db: DbService) {}

  async values(): Promise<Partial<Record<FinancialTaxParameterName, number>>> {
    const schema = await this.schema();
    if (!schema) return {};

    try {
      const rows = await this.db.execute<SysParameterRow[]>(
        `SELECT ${this.identifier(schema.keyColumn)} AS parameterKey, ${this.identifier(schema.valueColumn)} AS parameterValue FROM sys_parameter`,
      );
      return this.mapRows(rows);
    } catch (error) {
      console.warn('Unable to load financial tax defaults from sys_parameter', error);
      return {};
    }
  }

  private async schema(): Promise<SysParameterSchema | null> {
    if (!this.schemaPromise) this.schemaPromise = this.loadSchema();
    return this.schemaPromise;
  }

  private async loadSchema(): Promise<SysParameterSchema | null> {
    try {
      const rows = await this.db.execute<SysParameterColumnRow[]>(
        `SELECT COLUMN_NAME AS columnName FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_parameter'`,
      );
      const columns = new Set(rows.map((row) => String(row.columnName).toLowerCase()));
      const keyColumn = KEY_COLUMNS.find((column) => columns.has(column));
      const valueColumn = VALUE_COLUMNS.find((column) => columns.has(column));
      return keyColumn && valueColumn ? { keyColumn, valueColumn } : null;
    } catch (error) {
      console.warn('Unable to inspect sys_parameter schema for financial tax defaults', error);
      return null;
    }
  }

  private mapRows(rows: SysParameterRow[]): Partial<Record<FinancialTaxParameterName, number>> {
    const values: Partial<Record<FinancialTaxParameterName, number>> = {};
    const lookup = new Map<string, FinancialTaxParameterName>();

    for (const [name, keys] of Object.entries(PARAMETER_KEYS) as [FinancialTaxParameterName, string[]][]) {
      for (const key of keys) lookup.set(this.normalizeKey(key), name);
    }

    for (const row of rows) {
      const name = lookup.get(this.normalizeKey(row.parameterKey));
      if (!name || values[name] !== undefined) continue;
      const value = Number(row.parameterValue);
      if (Number.isFinite(value)) values[name] = value;
    }

    return values;
  }

  private normalizeKey(value: unknown): string {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private identifier(value: string): string {
    return `\`${value.replace(/`/g, '``')}\``;
  }
}
