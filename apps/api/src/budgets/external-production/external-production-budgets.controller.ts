import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthGuard } from '../../auth/auth.guard';
import { AuthUser, RequestUser } from '../../auth/auth-user.decorator';
import { ExternalProductionBudgetsService } from './external-production-budgets.service';

@Controller('budgets/external-production')
@UseGuards(AuthGuard)
export class ExternalProductionBudgetsController {
  constructor(private readonly service: ExternalProductionBudgetsService) {}

  @Get() list(@AuthUser() user: RequestUser, @Query() query: any) { return this.service.list(query, user.roleId); }
  @Get('statuses') statuses() { return this.service.statuses(); }
  @Get('defaults') defaults(@Query('idCliente') idCliente?: string, @Query('idServicio') idServicio?: string) { return this.service.defaults(idCliente, idServicio); }
  @Get('options/:type') options(@Param('type') type: string, @Query('search') search?: string, @Query('clientId') clientId?: string) { return this.service.options(type, clientId ?? search); }
  @Get('incentives') incentives(@Query() query: any) { return this.service.incentives(query); }
  @Get('orders') orders() { return this.service.orders(); }
  @Post() create(@AuthUser() user: RequestUser, @Body() body: any) { return this.service.create(user.userId, body); }
  @Get(':id/print-data') printData(@Param('id') id: string) { return this.service.printData(id); }
  @Get(':id/support') support(@Param('id') id: string) { return this.service.support(id); }
  @Post(':id/support')
  @UseInterceptors(FileInterceptor('files', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadSupport(@Param('id') id: string, @UploadedFile() file?: any) { return this.service.uploadSupport(id, file); }
  @Get(':id/support/:filename') async downloadSupport(@Param('id') id: string, @Param('filename') filename: string, @Res({ passthrough: true }) res: Response) {
    const file = await this.service.downloadSupport(id, filename);
    if (file.ok === false) throw new NotFoundException(file.message);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
    return new StreamableFile(this.service.supportReadStream(file.path));
  }
  @Delete(':id/support/:filename') deleteSupport(@Param('id') id: string, @Param('filename') filename: string) { return this.service.deleteSupport(id, filename); }
  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }
  @Put(':id') update(@AuthUser() user: RequestUser, @Param('id') id: string, @Body() body: any) { return this.service.update(id, user.userId, body); }
  @Post(':id/details') addDetail(@Param('id') id: string, @Body() body: any) { return this.service.saveDetail(id, null, body); }
  @Put(':id/details/:detailId') updateDetail(@Param('id') id: string, @Param('detailId') detailId: string, @Body() body: any) { return this.service.saveDetail(id, detailId, body); }
  @Delete(':id/details/:detailId') deleteDetail(@AuthUser() user: RequestUser, @Param('id') id: string, @Param('detailId') detailId: string) { return this.service.deleteDetail(id, detailId, user.userId); }
  @Get(':id/cost-order-details') costOrderDetails(@Param('id') id: string, @Query('orderId') orderId?: string) { return this.service.costOrderDetails(id, orderId); }
  @Post(':id/cost-order-details') addCostOrderDetail(@AuthUser() user: RequestUser, @Param('id') id: string, @Body() body: any) { return this.service.addCostOrderDetail(id, user.userId, body); }
  @Post(':id/print') print(@Param('id') id: string) { return this.service.print(id); }
  @Post(':id/anule') anule(@AuthUser() user: RequestUser, @Param('id') id: string, @Body() body: any) { return this.service.anule(id, user.userId, body); }
  @Post(':id/duplicate') duplicate(@AuthUser() user: RequestUser, @Param('id') id: string) { return this.service.duplicate(id, user.userId); }
  @Post(':id/replace') replace(@AuthUser() user: RequestUser, @Param('id') id: string) { return this.service.replace(id, user.userId); }
  @Post(':id/order') addOrder(@Param('id') id: string, @Body() body: any) { return this.service.addOrder(id, body); }
  @Get(':id/orders') budgetOrders(@Param('id') id: string) { return this.service.orders(id); }
}
