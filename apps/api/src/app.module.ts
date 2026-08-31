import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrdersModule } from './orders/orders.module';
import { UsersModule } from './users/users.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';
import { MenusModule } from './menus/menus.module';
import { RolesModule } from './roles/roles.module';
import { SystemUsersModule } from './system-users/system-users.module';
import { HelpdeskModule } from './helpdesk/helpdesk.module';
import { CostOrdersModule } from './cost-orders/cost-orders.module';
import { PermissionsModule } from './permissions/permissions.module';
import { ReportsModule } from './reports/reports.module';
import { HealthController } from './health.controller';
import databaseConfig from './config/database.config';
import emailConfig from './config/email.config';
import { DbModule } from './db/db.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      load: [databaseConfig, emailConfig],
    }),
    DbModule,
    OrdersModule,
    UsersModule,
    DashboardModule,
    AuthModule,
    MenusModule,
    RolesModule,
    SystemUsersModule,
    HelpdeskModule,
    CostOrdersModule,
    PermissionsModule,
    ReportsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
