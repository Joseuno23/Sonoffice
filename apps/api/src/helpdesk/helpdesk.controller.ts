import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser, RequestUser } from '../auth/auth-user.decorator';
import { HelpdeskService } from './helpdesk.service';
import { HelpdeskCreatePayload, HelpdeskRatePayload, HelpdeskResolvePayload } from './helpdesk.types';

const ATTACHMENT_MAX_SIZE = 5 * 1024 * 1024;

@Controller('helpdesk')
@UseGuards(AuthGuard)
export class HelpdeskController {
  constructor(private readonly helpdeskService: HelpdeskService) {}

  @Get()
  listTickets(@AuthUser() user: RequestUser) {
    return this.helpdeskService.listTickets(user);
  }

  @Get('metrics')
  getMetrics(@AuthUser() user: RequestUser) {
    return this.helpdeskService.getMetrics(user);
  }

  @Post()
  @UseInterceptors(FileInterceptor('attachment', { limits: { fileSize: ATTACHMENT_MAX_SIZE } }))
  createTicket(@AuthUser() user: RequestUser, @Body() payload: HelpdeskCreatePayload, @UploadedFile() attachment?: any) {
    return this.helpdeskService.createTicket(user, payload, attachment);
  }

  @Get('service-types')
  getServiceTypes() {
    return this.helpdeskService.getServiceTypes();
  }

  @Get('service-details')
  getServiceDetails(@Query('serviceType') serviceType: string) {
    return this.helpdeskService.getServiceDetails(serviceType);
  }

  @Patch(':id/resolve')
  @UseGuards(AdminRoleGuard)
  resolveTicket(@AuthUser() user: RequestUser, @Param('id') id: string, @Body() payload: HelpdeskResolvePayload) {
    return this.helpdeskService.resolveTicket(user, id, payload);
  }

  @Post(':id/rating')
  rateTicket(@AuthUser() user: RequestUser, @Param('id') id: string, @Body() payload: HelpdeskRatePayload) {
    return this.helpdeskService.rateTicket(user, id, payload);
  }
}
