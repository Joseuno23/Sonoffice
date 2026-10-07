import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuthUser, RequestUser } from '../auth/auth-user.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { ExpenseOrdersService } from './expense-orders.service';
import { ExpenseOrderApproveBulkFile, ExpenseOrderListQuery, ExpenseOrderPayload, ExpenseOrderRecurrencePayload } from './expense-orders.types';

@Controller('expense-orders')
@UseGuards(AuthGuard)
export class ExpenseOrdersController {
  constructor(private readonly service: ExpenseOrdersService) {}

  @Get() list(@AuthUser() user: RequestUser, @Query() query: ExpenseOrderListQuery) { return this.service.listOrders(user.roleId, query); }
  @Get('statuses') statuses() { return this.service.getStatuses(); }
  @Get('providers') providers(@Query('search') search?: string) { return this.service.getProviders(search); }
  @Get('defaults') defaults() { return this.service.getDefaults(); }
  @Post('approve-bulk')
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: 10 * 1024 * 1024 } }))
  approveBulk(@AuthUser() user: RequestUser, @UploadedFiles() files?: ExpenseOrderApproveBulkFile[]) { return this.service.approveBulk(user.roleId, files); }
  @Post() create(@AuthUser() user: RequestUser, @Body() payload: ExpenseOrderPayload) { return this.service.createOrder(user.userId, user.roleId, payload); }
  @Get(':id/print-data') printData(@AuthUser() user: RequestUser, @Param('id') id: string) { return this.service.getPrintData(id, user.roleId); }
  @Post(':id/print') print(@AuthUser() user: RequestUser, @Param('id') id: string) { return this.service.printOrder(user.userId, user.roleId, id); }
  @Post(':id/approve') approve(@AuthUser() user: RequestUser, @Param('id') id: string) { return this.service.approveOrder(user.roleId, id); }
  @Post(':id/anule') anule(@AuthUser() user: RequestUser, @Param('id') id: string) { return this.service.anuleOrder(user.userId, user.roleId, id); }
  @Post(':id/recurrence') setRecurrence(@AuthUser() user: RequestUser, @Param('id') id: string, @Body() payload: ExpenseOrderRecurrencePayload) { return this.service.setRecurrence(user.roleId, id, payload); }
  @Delete(':id/recurrence') clearRecurrence(@AuthUser() user: RequestUser, @Param('id') id: string) { return this.service.clearRecurrence(user.roleId, id); }
  @Get(':id') get(@AuthUser() user: RequestUser, @Param('id') id: string) { return this.service.getOrder(id, user.roleId); }
  @Put(':id') update(@AuthUser() user: RequestUser, @Param('id') id: string, @Body() payload: ExpenseOrderPayload) { return this.service.updateOrder(user.userId, user.roleId, id, payload); }
}
