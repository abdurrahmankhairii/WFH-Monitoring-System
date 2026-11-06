// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  APP_TIMEZONE,
  StandardApiResponse,
  buildResponse,
  formatJakartaDateTime,
  getWorkScheduleConfig,
  toJakartaDateString,
  toJakartaTimeString,
} from '@app/common';

// Feature: Server-Synchronized Digital Clock — Purpose: Exposes public server-clock synchronization and health endpoints so `<LiveServerClock />` and HTML5 Canvas watermarks always.
// OOP: API Gateway Controller (HTTP Ingress Adapter) — Connected To: GET /api/system/time -> frontend/src/components/custom/LiveServerClock.tsx & CameraPhotoUpload.tsx.
@ApiTags('System & Server Time')
@Controller('system')
export class SystemController {
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
}
