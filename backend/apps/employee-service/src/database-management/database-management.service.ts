// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Injectable } from '@nestjs/common';
import { DataSource, EntityMetadata, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import {
  AccessRequest,
  Attendance,
  AttendanceRequest,
  Department,
  Employee,
  OtpCode,
  SupportTicket,
  SystemSetting,
  User,
  buildResponse,
  throwRpcError,
} from '@app/common';

export interface ColumnMetadataInfo {
  propertyName: string;
  databaseName: string;
  type: string;
  isPrimary: boolean;
  isNullable: boolean;
  isGenerated: boolean;
  default?: any;
  enum?: any[];
}

export interface TableMetadataInfo {
  tableName: string;
  entityName: string;
  displayName: string;
  description: string;
  primaryKey: string;
  rowCount: number;
  columns: ColumnMetadataInfo[];
}

// Feature: System Administrator Database Studio — Purpose: Manages direct schema inspection, querying, inserting, updating, and deleting rows across all 9 database tables.
// OOP: Domain Service (Repository & Entity Manager Wrapper) — Connected To: Injected into EmployeeServiceController for DATABASE_PATTERNS.
@Injectable()
export class DatabaseManagementService {
  private readonly entityMap: Record<string, { entity: any; displayName: string; description: string }> = {
    users: {
      entity: User,
      displayName: 'User Accounts',
      description: 'System login credentials, authentication states, RBAC roles, and verification flags.',
    },
    employees: {
      entity: Employee,
      displayName: 'Master Employees',
      description: 'Master employee profiles, department mapping, salary, and InsightFace ArcFace biometric embeddings.',
    },
    departments: {
      entity: Department,
      displayName: 'Departments',
      description: 'Corporate organizational divisions, manager routing, WFH quotas, and hybrid workflow rules.',
    },
    attendances: {
      entity: Attendance,
      displayName: 'Attendance Sessions',
      description: 'WFH & WFO clock-in/out records, server timestamps, EXIF proofs, geofencing, and overtime pay.',
    },
    attendance_requests: {
      entity: AttendanceRequest,
      displayName: 'Attendance Requests',
      description: 'Self-service employee submissions for WFH notice/approval, overtime, leave, and sick requests.',
    },
    access_requests: {
      entity: AccessRequest,
      displayName: 'Access Requests',
      description: 'Prospective employee onboarding registrations awaiting administrator review and approval.',
    },
    support_tickets: {
      entity: SupportTicket,
      displayName: 'Support Tickets',
      description: 'Direct inquiries, system issue logs, and developer support tickets with email routing.',
    },
    system_settings: {
      entity: SystemSetting,
      displayName: 'System Settings',
      description: 'Global system configuration singleton controlling WFH policy, work schedules, and overtime toggles.',
    },
    otp_codes: {
      entity: OtpCode,
      displayName: 'OTP Security Codes',
      description: 'One-time 6-digit security verification and password reset tokens with expiration timestamps.',
    },
  };

  constructor(private readonly dataSource: DataSource) {}

  // Feature: Database Metadata Inspection — Purpose: Inspects TypeORM metadata to return column schemas, types, and real-time row counts for all tables.
  // OOP: Domain Service Method (Schema Introspection) — Connected To: DATABASE_PATTERNS.GET_TABLES.
  async getTables(): Promise<TableMetadataInfo[]> {
    const results: TableMetadataInfo[] = [];

    for (const [tableName, config] of Object.entries(this.entityMap)) {
      const repo = this.dataSource.getRepository(config.entity);
      const meta: EntityMetadata = repo.metadata;
      const count = await repo.count();

      const columns: ColumnMetadataInfo[] = meta.columns.map((col) => ({
        propertyName: col.propertyName,
        databaseName: col.databaseName,
        type: typeof col.type === 'string' ? col.type : (col.type as any)?.name || 'unknown',
        isPrimary: col.isPrimary,
        isNullable: col.isNullable,
        isGenerated: col.isGenerated,
        default: col.default,
        enum: col.enum as any[] | undefined,
      }));

      const primaryCol = meta.primaryColumns[0]?.propertyName || 'id';

      results.push({
        tableName,
        entityName: meta.name,
        displayName: config.displayName,
        description: config.description,
        primaryKey: primaryCol,
        rowCount: count,
        columns,
      });
    }

    return results;
  }

  // Feature: Dynamic Paginated Data Query — Purpose: Executes paginated, searchable queries against any registered database table with full column filtering.
  // OOP: Domain Service Method (Encapsulated Query Construction) — Connected To: DATABASE_PATTERNS.GET_ROWS.
  async getTableRows(
    tableName: string,
    options: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: 'ASC' | 'DESC' },
  ) {
    const where = `Database Studio • ${tableName}`;
    const repo = this.resolveRepository(tableName, where);
    const meta: EntityMetadata = repo.metadata;

    const page = Math.max(1, Number(options.page || 1));
    const limit = Math.min(100, Math.max(1, Number(options.limit || 25)));
    const skip = (page - 1) * limit;

    const qb = repo.createQueryBuilder('tbl');

    if (options.search && options.search.trim()) {
      const term = `%${options.search.trim()}%`;
      const searchCols = meta.columns.filter(
        (col) =>
          typeof col.type === 'string' &&
          (col.type.includes('char') || col.type.includes('text') || col.type.includes('string')),
      );

      if (searchCols.length > 0) {
        searchCols.forEach((col, idx) => {
          const paramName = `searchParam_${idx}`;
          if (idx === 0) {
            qb.where(`tbl.${col.propertyName} LIKE :${paramName}`, { [paramName]: term });
          } else {
            qb.orWhere(`tbl.${col.propertyName} LIKE :${paramName}`, { [paramName]: term });
          }
        });
      }
    }

    const sortColumn = options.sortBy && meta.findColumnWithPropertyName(options.sortBy)
      ? options.sortBy
      : meta.primaryColumns[0]?.propertyName || 'id';
    const sortOrder = options.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(`tbl.${sortColumn}`, sortOrder);
    qb.skip(skip).take(limit);

    const [rawRows, total] = await qb.getManyAndCount();

    // Sanitize sensitive fields (e.g., mask password hashes)
    const rows = rawRows.map((row: any) => {
      const sanitized = { ...row };
      if ('passwordHash' in sanitized) {
        sanitized.passwordHash = '[PROTECTED_BCRYPT_HASH]';
      }
      return sanitized;
    });

    return {
      rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Feature: Single Record Lookup — Purpose: Retrieves a specific row from a designated table by primary key.
  // OOP: Domain Service Method (Persistence Retrieval) — Connected To: DATABASE_PATTERNS.GET_ROW.
  async getRow(tableName: string, id: string) {
    const where = `Database Studio • ${tableName}`;
    const repo = this.resolveRepository(tableName, where);
    const primaryKey = repo.metadata.primaryColumns[0]?.propertyName || 'id';

    const row = await repo.findOne({ where: { [primaryKey]: id } as any });
    if (!row) {
      throwRpcError(404, where, 'Record not found', `Row with ${primaryKey}="${id}" does not exist in table "${tableName}".`);
    }

    const sanitized = { ...(row as any) };
    if ('passwordHash' in sanitized) {
      sanitized.passwordHash = '[PROTECTED_BCRYPT_HASH]';
    }
    return sanitized;
  }

  // Feature: Dynamic Row Insertion — Purpose: Validates, formats, and persists a newly created entity row into the target table with automatic password hashing.
  // OOP: Domain Service Method (Entity Factory & Persistence) — Connected To: DATABASE_PATTERNS.INSERT_ROW.
  async insertRow(tableName: string, data: Record<string, any>) {
    const where = `Database Studio • ${tableName} • Insert`;
    const repo = this.resolveRepository(tableName, where);
    const meta: EntityMetadata = repo.metadata;

    const payload = { ...data };

    // Handle password hashing for User entity
    if (tableName === 'users' && payload.password) {
      payload.passwordHash = await bcrypt.hash(payload.password, 10);
      delete payload.password;
    }

    // Auto-generate UUID if primary key is empty
    const primaryCol = meta.primaryColumns[0];
    if (primaryCol && (!payload[primaryCol.propertyName] || payload[primaryCol.propertyName] === '')) {
      if (typeof primaryCol.type === 'string' && (primaryCol.type.includes('char') || primaryCol.type.includes('uuid'))) {
        payload[primaryCol.propertyName] = randomUUID();
      }
    }

    try {
      const entity = repo.create(payload);
      const saved = await repo.save(entity);
      return saved;
    } catch (err: any) {
      throwRpcError(400, where, 'Failed to insert database row', err.message || 'Validation or database constraint failure.');
    }
  }

  // Feature: Dynamic Row Update — Purpose: Updates existing row fields safely by primary key while protecting audit fields and hashing updated passwords.
  // OOP: Domain Service Method (State Mutation & Persistence) — Connected To: DATABASE_PATTERNS.UPDATE_ROW.
  async updateRow(tableName: string, id: string, data: Record<string, any>) {
    const where = `Database Studio • ${tableName} • Update`;
    const repo = this.resolveRepository(tableName, where);
    const primaryKey = repo.metadata.primaryColumns[0]?.propertyName || 'id';

    const existing = await repo.findOne({ where: { [primaryKey]: id } as any });
    if (!existing) {
      throwRpcError(404, where, 'Record not found', `Cannot update row because ${primaryKey}="${id}" does not exist in "${tableName}".`);
    }

    const payload = { ...data };

    // Prevent modifying primary key
    delete payload[primaryKey];

    // Handle password re-hashing for User entity
    if (tableName === 'users') {
      if (payload.password && payload.password.trim().length > 0) {
        payload.passwordHash = await bcrypt.hash(payload.password, 10);
      }
      delete payload.password;
      if (payload.passwordHash === '[PROTECTED_BCRYPT_HASH]') {
        delete payload.passwordHash;
      }
    }

    try {
      Object.assign(existing as any, payload);
      const updated = await repo.save(existing);
      return updated;
    } catch (err: any) {
      throwRpcError(400, where, 'Failed to update database row', err.message || 'Database update constraint error.');
    }
  }

  // Feature: Dynamic Row Deletion — Purpose: Deletes a specific row by primary key or safely handles foreign key conflicts.
  // OOP: Domain Service Method (Persistence Removal) — Connected To: DATABASE_PATTERNS.DELETE_ROW.
  async deleteRow(tableName: string, id: string) {
    const where = `Database Studio • ${tableName} • Delete`;
    const repo = this.resolveRepository(tableName, where);
    const primaryKey = repo.metadata.primaryColumns[0]?.propertyName || 'id';

    const existing = await repo.findOne({ where: { [primaryKey]: id } as any });
    if (!existing) {
      throwRpcError(404, where, 'Record not found', `Cannot delete row because ${primaryKey}="${id}" does not exist in "${tableName}".`);
    }

    try {
      await repo.delete({ [primaryKey]: id } as any);
      return { id, tableName, deleted: true };
    } catch (err: any) {
      throwRpcError(
        409,
        where,
        'Cannot delete database record',
        `Record with ${primaryKey}="${id}" in "${tableName}" is referenced by foreign key constraints in other tables. Delete or unlink dependent records first.`,
      );
    }
  }

  // Feature: Repository Whitelist Resolver — Purpose: Resolves TypeORM Repository safely from the permitted table whitelist to prevent arbitrary table access.
  // OOP: Encapsulated Helper Method (Access Control & Validation) — Connected To: Internal database management methods.
  private resolveRepository(tableName: string, where: string): Repository<any> {
    const config = this.entityMap[tableName];
    if (!config) {
      throwRpcError(
        400,
        where,
        'Invalid table name',
        `Table "${tableName}" is not managed by Database Studio. Permitted tables: ${Object.keys(this.entityMap).join(', ')}.`,
      );
    }
    return this.dataSource.getRepository(config.entity);
  }
}
