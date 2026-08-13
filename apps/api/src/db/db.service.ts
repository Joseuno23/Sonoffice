import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ExecuteValues, QueryValues } from 'mysql2';
import { createPool, Pool, PoolConnection, QueryResult } from 'mysql2/promise';
import databaseConfig from '../config/database.config';

@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(
    @Inject(databaseConfig.KEY)
    private readonly config: ConfigType<typeof databaseConfig>,
  ) {
    this.pool = createPool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.name,
      user: this.config.user,
      password: this.config.password,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  async execute<T extends QueryResult = QueryResult>(
    sql: string,
    params: ExecuteValues[] = [],
  ): Promise<T> {
    const [result] = await this.pool.execute<T>(sql, params);
    return result;
  }

  async query<T extends QueryResult = QueryResult>(
    sql: string,
    params: QueryValues[] = [],
  ): Promise<T> {
    const [rows] = await this.pool.query<T>(sql, params);
    return rows;
  }

  async transaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
