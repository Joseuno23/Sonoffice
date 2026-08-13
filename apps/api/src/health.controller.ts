import { Controller, Get } from '@nestjs/common';
import { DbService } from './db/db.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DbService) {}

  @Get()
  health() {
    return { ok: true, service: 'sonoffice-erp', version: '3.0.0' };
  }

  @Get('db')
  async databaseHealth() {
    try {
      await this.db.execute('SELECT ? AS ok', [1]);

      return {
        success: true,
        data: { database: 'connected' },
        message: null,
      };
    } catch {
      return {
        success: false,
        data: null,
        message: 'No se pudo conectar con la base de datos',
        errorCode: 'DATABASE_CONNECTION_ERROR',
      };
    }
  }
}
