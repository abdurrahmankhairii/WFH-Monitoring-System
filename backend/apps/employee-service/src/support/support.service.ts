// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ActorPayload,
  ContactDeveloperPayload,
  IdActorPayload,
  StandardApiResponse,
  SupportTicket,
  SupportTicketStatus,
  User,
  UserRole,
  buildResponse,
  describeMailDispatch,
  throwRpcError,
} from '@app/common';
import { MailService } from '../mail/mail.service';

// Feature: Contact Developer Support via SMTP — Purpose: Implements the "Contact Developer / Need Help" feature.
// OOP: Injectable Domain Service (Business Logic Encapsulation) — Connected To: SupportController (@MessagePattern SUPPORT_PATTERNS) -> api-gateway SupportController (/api/support/*).
@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailService: MailService,
  ) {}

  // Feature: Contact Developer Support via SMTP — Purpose: Creates a support ticket and sends an SMTP email to the developer using the logged-in user's `users.email` as the sender.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: POST /api/support/contact-developer -> frontend/src/components/custom/ContactDeveloperModal.tsx.
  async contactDeveloper(payload: ContactDeveloperPayload): Promise<StandardApiResponse> {
    const where = 'Support - Contact Developer';
    const user = await this.userRepo.findOne({
      where: { id: payload.actor.userId },
      relations: ['employee'],
    });

    const senderEmail = user?.email ?? payload.actor.email;
    const senderName = user?.employee?.fullName ?? payload.actor.fullName ?? senderEmail;

    const ticket = this.ticketRepo.create({
      userId: payload.actor.userId,
      senderEmail,
      senderName,
      category: payload.dto.category,
      moduleLocation: payload.dto.moduleLocation,
      subject: payload.dto.subject,
      message: payload.dto.message,
      status: SupportTicketStatus.OPEN,
      emailDelivered: false,
    });
    const saved = await this.ticketRepo.save(ticket);

    // Resolve recipients: TO System Administrator(s), CC HR Admin(s) and sender themselves
    const sysAdmins = await this.userRepo.find({
      where: { role: UserRole.SYSTEM_ADMIN, isActive: true },
    });
    const toEmails = sysAdmins.map((u) => u.email).filter(Boolean);
    if (toEmails.length === 0) {
      toEmails.push('sysadmin@dexagroup.com');
    }

    const hrAdmins = await this.userRepo.find({
      where: { role: UserRole.HR_ADMIN, isActive: true },
    });
    const ccEmails = hrAdmins.map((u) => u.email).filter(Boolean);
    if (!ccEmails.includes(senderEmail)) {
      ccEmails.push(senderEmail);
    }

    const dispatch = await this.mailService.sendContactDeveloperEmail({
      senderEmail,
      senderName,
      senderRole: payload.actor.role,
      employeeCode: user?.employee?.employeeCode ?? null,
      category: payload.dto.category,
      moduleLocation: payload.dto.moduleLocation,
      subject: payload.dto.subject,
      message: payload.dto.message,
      ticketId: saved.id,
      toEmails,
      ccEmails,
    });

    const ticketLabel = `Ticket #${saved.id.slice(0, 8).toUpperCase()}`;
    if (!dispatch.delivered) {
      return buildResponse({
        type: 'info',
        where,
        what: 'Support ticket saved, email not delivered',
        why: `${ticketLabel} is saved in the ticket log. ${describeMailDispatch(dispatch)}`,
        data: saved,
      });
    }

    saved.emailDelivered = true;
    await this.ticketRepo.save(saved);

    return buildResponse({
      where,
      what: 'Support message sent to System Administrator & HR Admin',
      why: `${ticketLabel}: ${describeMailDispatch(dispatch)}`,
      data: saved,
    });
  }

  // Feature: Contact Developer Support via SMTP — Purpose: Lists support tickets (System Admin & HR Admin see all tickets; Employee sees only tickets sent from their own account).
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/support/tickets -> frontend Support / ContactDeveloperModal history tab.
  async findTickets(payload: ActorPayload): Promise<StandardApiResponse> {
    const where = 'Support - Ticket Log';
    const isAdmin = payload.actor.role === UserRole.HR_ADMIN || payload.actor.role === UserRole.SYSTEM_ADMIN;

    const tickets = await this.ticketRepo.find({
      where: isAdmin ? {} : { userId: payload.actor.userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return buildResponse({
      type: 'info',
      where,
      what: `Loaded ${tickets.length} support ticket(s)`,
      why: isAdmin ? 'Retrieved all developer support tickets across the organization.' : `Retrieved support tickets sent from ${payload.actor.email}.`,
      data: tickets,
    });
  }

  // Feature: Contact Developer Support via SMTP — Purpose: Allows HR Admin to mark an open support ticket as RESOLVED.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: PATCH /api/support/tickets/:id/resolve -> frontend HRD Admin view.
  async resolveTicket(payload: IdActorPayload): Promise<StandardApiResponse> {
    const where = 'Support - Resolve Ticket';
    const ticket = await this.ticketRepo.findOne({ where: { id: payload.id } });
    if (!ticket) {
      throwRpcError(404, where, 'Support ticket not found', `No support ticket exists with ID "${payload.id}".`);
    }

    ticket.status = SupportTicketStatus.RESOLVED;
    const saved = await this.ticketRepo.save(ticket);

    return buildResponse({
      where,
      what: `Ticket #${saved.id.slice(0, 8).toUpperCase()} marked RESOLVED`,
      why: `Resolved support request "${saved.subject}" submitted by ${saved.senderEmail}.`,
      data: saved,
    });
  }

  // Feature: SMTP Diagnostic Testing — Purpose: Dispatches an instant diagnostic email to verify SMTP gateway handshake and delivery.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Called by employee-service.controller.ts support.test_email.
  async testEmail(payload: { actor: any; targetEmail?: string }): Promise<StandardApiResponse> {
    const where = 'Support - SMTP Diagnostic Test';
    const target = payload.targetEmail || payload.actor.email;
    const result = await this.mailService.sendTestEmail(target);
    if (!result.success) {
      throwRpcError(400, where, 'Failed to send diagnostic email', result.message);
    }
    return buildResponse({
      where,
      what: 'Diagnostic email successfully dispatched',
      why: `Established authenticated TLS handshake and delivered test email to ${target}.`,
      data: {
        recipient: target,
        messageId: result.messageId,
      },
    });
  }
}
