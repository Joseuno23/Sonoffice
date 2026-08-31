import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CostOrdersCompensationReportQuery, CostOrdersReportQuery } from './reports.types';
import { ReportsService, ReportsValidationError } from './reports.service';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('cost-orders/options')
  getCostOrdersOptions() {
    return this.reportsService.getCostOrdersOptions();
  }

  @Get('cost-orders/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCostOrders(@Query() query: CostOrdersReportQuery, @Res() res: Response) {
    try {
      const report = await this.reportsService.exportCostOrders(query);
      res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
      res.send(report.content);
    } catch (error) {
      if (error instanceof ReportsValidationError) {
        res.status(400).json({ success: false, data: null, message: error.message });
        return;
      }
      res.status(500).json({ success: false, data: null, message: 'No se pudo generar el reporte de órdenes de costo' });
    }
  }

  @Get('cost-orders/compensation/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCostOrdersCompensation(@Query() query: CostOrdersCompensationReportQuery, @Res() res: Response) {
    try {
      const report = await this.reportsService.exportCostOrdersCompensation(query);
      res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
      res.send(report.content);
    } catch (error) {
      if (error instanceof ReportsValidationError) {
        res.status(400).json({ success: false, data: null, message: error.message });
        return;
      }
      res.status(500).json({ success: false, data: null, message: 'No se pudo generar el reporte de compensación de órdenes de costo' });
    }
  }
}
