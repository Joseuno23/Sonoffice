import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrdersModule } from './orders/orders.module';
import { UsersModule } from './users/users.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
