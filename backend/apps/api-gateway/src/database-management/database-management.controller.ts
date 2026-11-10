// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ActorContext,
  DATABASE_PATTERNS,
  EMPLOYEE_SERVICE,
  UserRole,
  buildResponse,
} from '@app/common';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { sendRpc } from '../common/rpc.util';

// Feature: System Administrator Database Studio — Purpose: Full-stack relational database administration controller with full CRUD capabilities across all 9 database tables.
// OOP: API Gateway Controller (HTTP Ingress Adapter) — Connected To: Exposes /api/system/database endpoints exclusively to SYSTEM_ADMIN; forwards TCP commands to employee-service.
@ApiTags('System Database Studio (SYSTEM_ADMIN)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SYSTEM_ADMIN)
@Controller('system/database')
export class DatabaseManagementController {
  constructor(
    @Inject(EMPLOYEE_SERVICE)
    private readonly employeeClient: ClientProxy,
  ) {}

  // Feature: Database Metadata Inspection — Purpose: Retrieves schemas, column definitions, and live row counts across all 9 relational tables.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: GET /api/system/database/tables -> SystemDatabaseManagementPage.tsx.
  @Get('tables')
  @ApiOperation({ summary: 'List all database tables with schema metadata and row counts (SYSTEM_ADMIN only)' })
  async getTables() {
    const data = await sendRpc<any[]>(this.employeeClient, DATABASE_PATTERNS.GET_TABLES, {});
    return buildResponse({
      type: 'info',
      where: 'Database Studio • Overview',
      what: 'Retrieved database schema metadata',
      why: `Inspected ${data?.length || 0} relational tables with real-time row counts.`,
      data,
    });
  }

  // Feature: Dynamic Paginated Data Query — Purpose: Queries paginated, searchable rows for a selected table.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: GET /api/system/database/:tableName -> SystemDatabaseManagementPage.tsx.
  @Get(':tableName')
  @ApiOperation({ summary: 'Query paginated rows from a specified table with search and sort (SYSTEM_ADMIN only)' })
  async getTableRows(
    @Param('tableName') tableName: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    const data = await sendRpc<any>(this.employeeClient, DATABASE_PATTERNS.GET_ROWS, {
      tableName,
      options: { page, limit, search, sortBy, sortOrder },
    });

    return buildResponse({
      type: 'info',
      where: `Database Studio • ${tableName}`,
      what: `Loaded ${data?.rows?.length || 0} rows from ${tableName}`,
      why: `Fetched page ${data?.meta?.page || 1} of ${data?.meta?.totalPages || 1} (Total: ${data?.meta?.total || 0} rows).`,
      data: data?.rows || [],
      meta: data?.meta,
    });
  }

  // Feature: Single Record Lookup — Purpose: Retrieves a single database row by its primary key.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: GET /api/system/database/:tableName/:id -> Record inspection modal.
  @Get(':tableName/:id')
  @ApiOperation({ summary: 'Get a specific database row by ID (SYSTEM_ADMIN only)' })
  async getTableRow(@Param('tableName') tableName: string, @Param('id') id: string) {
    const data = await sendRpc<any>(this.employeeClient, DATABASE_PATTERNS.GET_ROW, { tableName, id });
    return buildResponse({
      type: 'info',
      where: `Database Studio • ${tableName}`,
      what: `Retrieved record ${id}`,
      why: `Loaded full record payload from table ${tableName}.`,
      data,
    });
  }

  // Feature: Dynamic Row Insertion — Purpose: Inserts a newly created entity record into the specified database table.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: POST /api/system/database/:tableName -> Insert modal form.
  @Post(':tableName')
  @ApiOperation({ summary: 'Insert a new record into the specified table (SYSTEM_ADMIN only)' })
  async insertTableRow(
    @CurrentUser() actor: ActorContext,
    @Param('tableName') tableName: string,
    @Body() body: Record<string, any>,
  ) {
    const data = await sendRpc<any>(this.employeeClient, DATABASE_PATTERNS.INSERT_ROW, {
      tableName,
      data: body,
      actor,
    });

    return buildResponse({
      type: 'success',
      where: `Database Studio • ${tableName}`,
      what: `Inserted new record in ${tableName}`,
      why: `New row successfully written to MySQL database by ${actor.email}.`,
      data,
    });
  }

  // Feature: Dynamic Row Update — Purpose: Updates an existing entity record in the specified database table.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: PUT /api/system/database/:tableName/:id -> Edit modal form.
  @Put(':tableName/:id')
  @ApiOperation({ summary: 'Update an existing record by ID in the specified table (SYSTEM_ADMIN only)' })
  async updateTableRow(
    @CurrentUser() actor: ActorContext,
    @Param('tableName') tableName: string,
    @Param('id') id: string,
    @Body() body: Record<string, any>,
  ) {
    const data = await sendRpc<any>(this.employeeClient, DATABASE_PATTERNS.UPDATE_ROW, {
      tableName,
      id,
      data: body,
      actor,
    });

    return buildResponse({
      type: 'success',
      where: `Database Studio • ${tableName}`,
      what: `Updated record ${id}`,
      why: `Row fields in table ${tableName} successfully updated in MySQL database.`,
      data,
    });
  }

  // Feature: Dynamic Row Deletion — Purpose: Deletes a specific record by its primary key.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: DELETE /api/system/database/:tableName/:id -> Delete confirmation modal.
  @Delete(':tableName/:id')
  @ApiOperation({ summary: 'Delete a record by ID from the specified table (SYSTEM_ADMIN only)' })
  async deleteTableRow(
    @CurrentUser() actor: ActorContext,
    @Param('tableName') tableName: string,
    @Param('id') id: string,
  ) {
    const data = await sendRpc<any>(this.employeeClient, DATABASE_PATTERNS.DELETE_ROW, {
      tableName,
      id,
      actor,
    });

    return buildResponse({
      type: 'success',
      where: `Database Studio • ${tableName}`,
      what: `Deleted record ${id}`,
      why: `Row was permanently removed from table ${tableName} by ${actor.email}.`,
      data,
    });
  }
}
