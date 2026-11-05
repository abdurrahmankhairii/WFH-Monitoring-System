// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ALL_ENTITIES } from '../entities';

type SupportedDbType = 'mysql' | 'mariadb' | 'postgres';

interface DatabaseModuleOptions {
  // Only one service (employee-service) owns schema synchronization to avoid concurrent DDL races.
  allowSchemaSync: boolean;
}

// Feature: TypeORM Relational Database Module — Purpose: Builds environment-driven TypeORM options.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: backend/.env (DB_*), apps/employee-service & apps/attendance-service root modules.
export function buildTypeOrmOptions(config: ConfigService, options: DatabaseModuleOptions): TypeOrmModuleOptions {
  const type = (config.get<string>('DB_TYPE') ?? 'mysql') as SupportedDbType;
  const isMySqlFamily = type === 'mysql' || type === 'mariadb';
  const base = {
    host: config.get<string>('DB_HOST', 'localhost'),
    port: Number(config.get<string>('DB_PORT', isMySqlFamily ? '3306' : '5432')),
    username: config.get<string>('DB_USERNAME', 'wfh_user'),
    password: config.get<string>('DB_PASSWORD', 'wfh_password'),
    database: config.get<string>('DB_DATABASE', 'wfh_monitoring'),
    entities: ALL_ENTITIES,
    synchronize: options.allowSchemaSync && config.get<string>('DB_SYNCHRONIZE', 'true') === 'true',
    logging: config.get<string>('DB_LOGGING', 'false') === 'true',
    retryAttempts: 15,
    retryDelay: 3000,
  };

  if (isMySqlFamily) {
    return { ...base, type, timezone: 'Z', charset: 'utf8mb4_unicode_ci' };
  }
  return { ...base, type: 'postgres' };
}

// Feature: TypeORM Relational Database Module — Purpose: Reusable NestJS module wiring TypeORM with the shared entity set for any microservice.
// OOP: Functional Helper Module — Connected To: employee-service.module.ts (allowSchemaSync: true) and attendance-service.module.ts (allowSchemaSync: false).
@Module({})
export class DatabaseModule {
  // Feature: TypeORM Relational Database Module — Purpose: Registers the TypeORM root connection using ConfigService-provided credentials.
  // OOP: Class Method (Encapsulated Member) — Connected To: buildTypeOrmOptions() above.
  static forRoot(options: DatabaseModuleOptions): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => buildTypeOrmOptions(config, options),
        }),
      ],
    };
  }
}
