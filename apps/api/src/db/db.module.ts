import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import databaseConfig from '../config/database.config';
import { DbService } from './db.service';

@Module({
  imports: [ConfigModule.forFeature(databaseConfig)],
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {}
