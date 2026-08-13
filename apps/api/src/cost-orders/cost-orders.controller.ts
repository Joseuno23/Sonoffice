import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser, RequestUser } from '../auth/auth-user.decorator';
import { CostOrdersService } from './cost-orders.service';
import { CostOrderCreatePayload, CostOrderListQuery } from './cost-orders.types';

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
}
