// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  APP_TIMEZONE,
  ATTENDANCE_PATTERNS,
  ATTENDANCE_SERVICE,
  ActorContext,
  StandardApiResponse,
  UpdatePolicyDto,
  UserRole,
  buildResponse,
  formatJakartaDateTime,
  getWorkScheduleConfig,
  toJakartaDateString,
  toJakartaTimeString,
} from '@app/common';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { sendRpc } from '../common/rpc.util';

// Feature: Server-Synchronized Digital Clock & Company Policy Configuration — Purpose: Exposes public server-clock synchronization, health endpoints, and HR/Admin company policy configuration.
// OOP: API Gateway Controller (HTTP Ingress Adapter) — Connected To: GET /api/system/time, GET /api/system/policy, and PATCH /api/system/policy.
@ApiTags('System & Server Time')
@Controller('system')
export class SystemController {
  constructor(
    @Inject(ATTENDANCE_SERVICE)
    private readonly attendanceClient: ClientProxy,
  ) {}

  // Feature: Server-Synchronized Digital Clock — Purpose: Returns the current UTC ISO timestamp, Asia/Jakarta (WIB) date/time strings, and company work schedule parameters.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: Polled on load by frontend LiveServerClock.tsx.
  @Get('time')
  @ApiOperation({ summary: 'Get authoritative server timestamp (UTC & WIB) and work schedule configuration' })
  getServerTime(): StandardApiResponse {
    const now = new Date();
    const schedule = getWorkScheduleConfig();
    return buildResponse({
      type: 'info',
      where: 'System - Server Clock Sync',
      what: 'Synchronized with backend server clock',
      why: `Current authoritative server time is ${formatJakartaDateTime(now)} (${APP_TIMEZONE}).`,
      data: {
        serverTimeIso: now.toISOString(),
        serverEpochMs: now.getTime(),
        timezone: APP_TIMEZONE,
        dateWib: toJakartaDateString(now),
        timeWib: toJakartaTimeString(now),
        formattedWib: formatJakartaDateTime(now),
        schedule,
      },
    });
  }

  // Feature: Server-Synchronized Digital Clock — Purpose: Liveness & readiness health check for Docker Compose and load balancers.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: Docker healthcheck / monitoring probes.
  @Get('health')
  @ApiOperation({ summary: 'API Gateway health check' })
  getHealth(): StandardApiResponse {
    return buildResponse({
      type: 'info',
      where: 'System - Health Check',
      what: 'API Gateway is healthy',
      why: 'HTTP ingress and microservice TCP proxies are initialized.',
      data: { status: 'OK', uptimeSeconds: Math.round(process.uptime()) },
    });
  }

  // Feature: Company Policy & Workflow Configuration — Purpose: Retrieves the company WFH workflow mode (Strict Approval vs Notice Only), Overtime calculation toggle, and weekly quota.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: GET /api/system/policy -> frontend CompanyPolicyModal.tsx & EmployeeAttendancePage.tsx.
  @Get('policy')
  @ApiOperation({ summary: 'Get company WFH workflow mode and overtime calculation policy' })
  getPolicy() {
    return sendRpc(this.attendanceClient, ATTENDANCE_PATTERNS.GET_POLICY, {});
  }

  // Feature: Company Policy & Workflow Configuration — Purpose: Allows HR Admin and System Admin to toggle WFH workflow mode and Overtime Pay calculation.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: PATCH /api/system/policy -> frontend CompanyPolicyModal.tsx.
  @Patch('policy')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_ADMIN, UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Update company WFH workflow mode and overtime calculation policy (HR/System Admin only)' })
  updatePolicy(@CurrentUser() actor: ActorContext, @Body() dto: UpdatePolicyDto) {
    return sendRpc(this.attendanceClient, ATTENDANCE_PATTERNS.UPDATE_POLICY, { actor, dto });
  }
}
