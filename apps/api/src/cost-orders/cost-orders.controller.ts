import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser, RequestUser } from '../auth/auth-user.decorator';
import { CostOrdersService } from './cost-orders.service';
import { CostOrderBudgetAttachPayload, CostOrderBudgetSearchQuery, CostOrderCompensatePayload, CostOrderCompensateQuery, CostOrderCompensateReversePayload, CostOrderCreatePayload, CostOrderDuplicatePayload, CostOrderFinalObservationPayload, CostOrderListQuery, CostOrderUpdatePayload } from './cost-orders.types';

@Controller('cost-orders')
@UseGuards(AuthGuard)
export class CostOrdersController {
  constructor(private readonly costOrdersService: CostOrdersService) {}

  @Get()
  listOrders(@AuthUser() user: RequestUser, @Query() query: CostOrderListQuery) {
    return this.costOrdersService.listOrders(user.roleId, query);
  }

  @Get('statuses')
  getStatuses() {
    return this.costOrdersService.getStatuses();
  }

  @Get('defaults')
  getDefaults() {
    return this.costOrdersService.getDefaults();
  }

  @Get('duplicate-candidates')
  getDuplicateCandidates(@AuthUser() user: RequestUser, @Query('search') search?: string) {
    return this.costOrdersService.getDuplicateCandidates(user.roleId, search);
  }

  @Post('duplicate')
  duplicateOrders(@AuthUser() user: RequestUser, @Body() payload: CostOrderDuplicatePayload) {
    return this.costOrdersService.duplicateOrders(user.userId, user.roleId, payload);
  }

  @Get('compensate')
  getCompensateContext(@AuthUser() user: RequestUser, @Query() query: CostOrderCompensateQuery) {
    return this.costOrdersService.getCompensateContext(user.roleId, query);
  }

  @Post('compensate/suggestions')
  suggestCompensation(@AuthUser() user: RequestUser, @Body() payload: CostOrderCompensatePayload) {
    return this.costOrdersService.suggestCompensation(user.roleId, payload);
  }

  @Post('compensate/associate')
  associateCompensation(@AuthUser() user: RequestUser, @Body() payload: CostOrderCompensatePayload) {
    return this.costOrdersService.associateCompensation(user.userId, user.roleId, payload);
  }

  @Post('compensate/association/reverse')
  reverseCompensationAssociation(@AuthUser() user: RequestUser, @Body() payload: CostOrderCompensateReversePayload) {
    return this.costOrdersService.reverseCompensationAssociation(user.userId, user.roleId, payload);
  }

  @Get('clients')
  getClients(@Query('search') search?: string) {
    return this.costOrdersService.getClients(search);
  }

  @Get('providers')
  getProviders(@Query('search') search?: string) {
    return this.costOrdersService.getProviders(search);
  }

  @Get('services')
  getServices(@Query('tipo') tipo?: string) {
    return this.costOrdersService.getServices(tipo);
  }

  @Get('campaigns')
  getCampaigns(@Query('clientId') clientId?: string) {
    return this.costOrdersService.getCampaigns(clientId);
  }

  @Get('products')
  getProducts(@Query('clientId') clientId?: string) {
    return this.costOrdersService.getProducts(clientId);
  }

  @Post()
  createOrder(@AuthUser() user: RequestUser, @Body() payload: CostOrderCreatePayload) {
    return this.costOrdersService.createOrder(user.userId, user.roleId, payload);
  }

  @Get('budget-lines')
  getBudgetLinesForCreate(@Query() query: CostOrderBudgetSearchQuery) {
    return this.costOrdersService.getBudgetLinesForCreate(query);
  }

  @Get(':id/budget-lines')
  getBudgetLines(@Param('id') id: string, @Query('tipo') tipo?: string, @Query('ppto') ppto?: string) {
    return this.costOrdersService.getBudgetLines(id, tipo, ppto);
  }

  @Post(':id/budget-lines')
  attachBudgetLine(@AuthUser() user: RequestUser, @Param('id') id: string, @Body() payload: CostOrderBudgetAttachPayload) {
    return this.costOrdersService.attachBudgetLine(user.userId, user.roleId, id, payload);
  }

  @Delete(':id/details/:detailId')
  deleteDetail(@AuthUser() user: RequestUser, @Param('id') id: string, @Param('detailId') detailId: string) {
    return this.costOrdersService.deleteDetail(user.userId, user.roleId, id, detailId);
  }

  @Post(':id/finalize')
  finalizeOrder(@AuthUser() user: RequestUser, @Param('id') id: string) {
    return this.costOrdersService.finalizeOrder(user.userId, user.roleId, id);
  }

  @Post(':id/anule')
  anuleOrder(@AuthUser() user: RequestUser, @Param('id') id: string) {
    return this.costOrdersService.anuleOrder(user.userId, user.roleId, id);
  }

  @Post(':id/replace')
  replaceOrder(@AuthUser() user: RequestUser, @Param('id') id: string) {
    return this.costOrdersService.replaceOrder(user.userId, user.roleId, id);
  }

  @Get(':id/final-observation')
  getFinalObservation(@AuthUser() user: RequestUser, @Param('id') id: string) {
    return this.costOrdersService.getFinalObservation(user.roleId, id);
  }

  @Post(':id/final-observation')
  addFinalObservation(@AuthUser() user: RequestUser, @Param('id') id: string, @Body() payload: CostOrderFinalObservationPayload) {
    return this.costOrdersService.addFinalObservation(user.userId, user.roleId, id, payload);
  }

  @Get(':id/print-data')
  getPrintData(@AuthUser() user: RequestUser, @Param('id') id: string) {
    return this.costOrdersService.getPrintData(id, user.roleId);
  }

  @Post(':id/print')
  printOrder(@AuthUser() user: RequestUser, @Param('id') id: string) {
    return this.costOrdersService.printOrder(user.userId, user.roleId, id);
  }

  // :id va al final para no capturar las rutas específicas (statuses, clients, etc.).
  @Get(':id')
  getOrder(@AuthUser() user: RequestUser, @Param('id') id: string) {
    return this.costOrdersService.getOrderForEdit(Number(id), user.roleId);
  }

  @Put(':id')
  updateOrder(@AuthUser() user: RequestUser, @Param('id') id: string, @Body() payload: CostOrderUpdatePayload) {
    return this.costOrdersService.updateOrder(user.userId, user.roleId, id, payload);
  }
}
