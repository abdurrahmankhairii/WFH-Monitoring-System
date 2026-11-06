// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActorContext, ContactDeveloperDto, EMPLOYEE_SERVICE, SUPPORT_PATTERNS, UserRole } from '@app/common';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { sendRpc } from '../common/rpc.util';

// Feature: Contact Developer Support via SMTP — Purpose: HTTP Gateway controller for "Contact Developer / Need Help" support tickets via SMTP.
// OOP: API Gateway Controller (HTTP Ingress Adapter) — Connected To: Forwards TCP commands to `employee-service` (:3001) -> Consumed by frontend client portals.
@ApiTags('Support & Contact Developer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('support')
export class SupportController {
  constructor(
    @Inject(EMPLOYEE_SERVICE)
    private readonly employeeClient: ClientProxy,
  ) {}

  // Feature: Contact Developer Support via SMTP — Purpose: Sends a support ticket email to the developer with `from` & `replyTo` set to the logged-in user's account email.
  // OOP: Controller Action (HTTP Request Handler) — Connected To: POST /api/support/contact-developer -> ContactDeveloperModal.tsx.
  @Post('contact-developer')
  @ApiOperation({ summary: 'Send support email to developer using logged-in user account email as SMTP sender' })
  contactDeveloper(@CurrentUser() actor: ActorContext, @Body() dto: ContactDeveloperDto) {
    return sendRpc(this.employeeClient, SUPPORT_PATTERNS.CONTACT_DEVELOPER, { actor, dto });
  }

  // Feature: Contact Developer Support via SMTP — Purpose: Lists support tickets (all tickets for HR_ADMIN, personal tickets for EMPLOYEE).
  // OOP: Controller Action (HTTP Request Handler) — Connected To: GET /api/support/tickets -> ContactDeveloperModal.tsx & HRD Support log.
  @Get('tickets')
  @ApiOperation({ summary: 'List submitted developer support tickets' })
  findTickets(@CurrentUser() actor: ActorContext) {
    return sendRpc(this.employeeClient, SUPPORT_PATTERNS.FIND_TICKETS, { actor });
  }

  // Feature: Contact Developer Support via SMTP — Purpose: Marks a support ticket as RESOLVED (HR_ADMIN).
  // OOP: Controller Action (HTTP Request Handler) — Connected To: PATCH /api/support/tickets/:id/resolve -> HRD Admin view.
  @Patch('tickets/:id/resolve')
  @Roles(UserRole.HR_ADMIN)
  @ApiOperation({ summary: 'Mark a support ticket as resolved (HR_ADMIN)' })
  resolveTicket(@CurrentUser() actor: ActorContext, @Param('id') id: string) {
    return sendRpc(this.employeeClient, SUPPORT_PATTERNS.RESOLVE, { actor, id });
  }
}
