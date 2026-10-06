import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthGuard } from '../../auth/auth.guard';
import { AuthUser, RequestUser } from '../../auth/auth-user.decorator';
import { InternalProductionBudgetsService } from './internal-production-budgets.service';

@Controller('budgets/internal-production')
@UseGuards(AuthGuard)
export class InternalProductionBudgetsController {
  constructor(private readonly service: InternalProductionBudgetsService) {}

  @Get() list(@AuthUser() user: RequestUser, @Query() query: any) { return this.service.list(query, user.roleId); }
  @Get('statuses') statuses() { return this.service.statuses(); }
  @Get('defaults') defaults(@Query('idCliente') idCliente?: string, @Query('idServicio') idServicio?: string) { return this.service.defaults(idCliente, idServicio); }
  @Get('options/:type') options(@Param('type') type: string, @Query('search') search?: string, @Query('clientId') clientId?: string, @Query('departmentCode') departmentCode?: string) { return this.service.options(type, clientId ?? departmentCode ?? search); }
  @Get('incentives') incentives(@Query() query: any) { return this.service.incentives(query); }
  @Post() create(@AuthUser() user: RequestUser, @Body() body: any) { return this.service.create(user.userId, user.roleId, body); }
  @Get(':id/print-data') printData(@AuthUser() user: RequestUser, @Param('id') id: string) { return this.service.printData(id, user.roleId); }
  @Get(':id/support') support(@AuthUser() user: RequestUser, @Param('id') id: string) { return this.service.support(id, user.roleId); }
  @Post(':id/support')
  @UseInterceptors(FileInterceptor('files', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadSupport(@AuthUser() user: RequestUser, @Param('id') id: string, @UploadedFile() file?: any) { return this.service.uploadSupport(id, user.roleId, file); }
  @Get(':id/support/:filename') async downloadSupport(@AuthUser() user: RequestUser, @Param('id') id: string, @Param('filename') filename: string, @Res({ passthrough: true }) res: Response) {
    const file = await this.service.downloadSupport(id, filename, user.roleId);
    if (file.ok === false) throw new NotFoundException(file.message);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
    return new StreamableFile(this.service.supportReadStream(file.path));
  }
  @Get(':id') get(@AuthUser() user: RequestUser, @Param('id') id: string) { return this.service.get(id, user.roleId); }
  @Put(':id') update(@AuthUser() user: RequestUser, @Param('id') id: string, @Body() body: any) { return this.service.update(id, user.userId, user.roleId, body); }
  @Post(':id/details') addDetail(@AuthUser() user: RequestUser, @Param('id') id: string, @Body() body: any) { return this.service.saveDetail(id, null, user.roleId, body); }
  @Put(':id/details/:detailId') updateDetail(@AuthUser() user: RequestUser, @Param('id') id: string, @Param('detailId') detailId: string, @Body() body: any) { return this.service.saveDetail(id, detailId, user.roleId, body); }
  @Delete(':id/details/:detailId') deleteDetail(@AuthUser() user: RequestUser, @Param('id') id: string, @Param('detailId') detailId: string) { return this.service.deleteDetail(id, detailId, user.userId, user.roleId); }
  @Get(':id/cost-order-details') costOrderDetails(@AuthUser() user: RequestUser, @Param('id') id: string, @Query('orderId') orderId?: string) { return this.service.costOrderDetails(id, orderId, user.roleId); }
  @Post(':id/cost-order-details') addCostOrderDetail(@AuthUser() user: RequestUser, @Param('id') id: string, @Body() body: any) { return this.service.addCostOrderDetail(id, user.userId, user.roleId, body); }
  @Post(':id/print') print(@AuthUser() user: RequestUser, @Param('id') id: string) { return this.service.print(id, user.roleId); }
  @Post(':id/anule') anule(@AuthUser() user: RequestUser, @Param('id') id: string, @Body() body: any) { return this.service.anule(id, user.userId, user.roleId, body); }
  @Post(':id/duplicate') duplicate(@AuthUser() user: RequestUser, @Param('id') id: string) { return this.service.duplicate(id, user.userId, user.roleId); }
  @Post(':id/replace') replace(@AuthUser() user: RequestUser, @Param('id') id: string) { return this.service.replace(id, user.userId, user.roleId); }
  @Post(':id/order') addOrder(@AuthUser() user: RequestUser, @Param('id') id: string, @Body() body: any) { return this.service.addOrder(id, user.roleId, body); }
}
