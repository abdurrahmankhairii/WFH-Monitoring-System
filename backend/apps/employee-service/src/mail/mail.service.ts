// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { OtpType, SupportCategory } from '@app/common';

interface SupportMailInput {
  senderEmail: string;
  senderName: string;
  senderRole: string;
  employeeCode: string | null;
  category: SupportCategory;
  moduleLocation: string;
  subject: string;
  message: string;
  ticketId: string;
  toEmails?: string[];
  ccEmails?: string[];
}

// Feature: Central SMTP Mail Dispatcher — Purpose: Dispatches system emails including OTP verification, password resets, and Contact Developer tickets.
// OOP: Injectable Domain Service (Business Logic Encapsulation) — Connected To: Used by auth.service.ts, employees.service.ts, access-requests.service.ts.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly systemFrom: string;
  private readonly developerEmail: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST', 'localhost');
    const port = Number(this.config.get<string>('SMTP_PORT', '1025'));
    const user = this.config.get<string>('SMTP_USER', '');
    const pass = this.config.get<string>('SMTP_PASS', '');
    const secure = this.config.get<string>('SMTP_SECURE', 'false') === 'true' || port === 465;

    this.systemFrom =
      this.config.get<string>('SMTP_FROM') ||
      (user ? `"Dexa Group WFH Monitoring" <${user}>` : '"Dexa Group WFH Monitoring" <noreply-wfh@dexagroup.com>');
    this.developerEmail = this.config.get<string>('DEVELOPER_SUPPORT_EMAIL', 'abdurrahman.khairi@dexagroup.com');

    const transportOptions: any = {
      host,
      port,
      secure,
      tls: {
        rejectUnauthorized: false,
      },
    };

    if (user && pass) {
      transportOptions.auth = { user, pass };
    }

    // Feature: Real SMTP Tuning — Purpose: Configures TLS handshake requirements for Google Gmail and Microsoft Outlook.
    // OOP: Strategy Adapter — Connected To: Google SMTP (smtp.gmail.com:587) and Microsoft Office 365 (smtp.office365.com:587).
    if (host.includes('gmail.com')) {
      transportOptions.requireTLS = true;
    } else if (host.includes('office365.com') || host.includes('outlook.com')) {
      transportOptions.requireTLS = true;
      transportOptions.tls = {
        ciphers: 'SSLv3',
        rejectUnauthorized: false,
      };
    }

    this.transporter = nodemailer.createTransport(transportOptions);
    this.logger.log(`Initialized MailService with SMTP: ${host}:${port} (secure: ${secure}, auth: ${Boolean(user && pass)})`);
  }

  // Feature: SMTP Diagnostic Testing — Purpose: Sends an instant diagnostic test email to verify SMTP gateway handshake and real-world inbox delivery.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Called by support.service.ts testEmail() via TCP support.test_email.
  async sendTestEmail(targetEmail: string): Promise<{ success: boolean; message: string; messageId?: string }> {
    const override = this.config.get<string>('SMTP_OVERRIDE_RECIPIENT');
    const actualRecipient = override || targetEmail;
    const host = this.config.get<string>('SMTP_HOST', 'localhost');
    const port = this.config.get<string>('SMTP_PORT', '1025');
    const user = this.config.get<string>('SMTP_USER', '');

    const testHtml = this.wrapEmailTemplate(
      'SMTP Gateway Diagnostic Test — Dexa WFH System',
      `
        <div style="background:#ECFDF5;border:1px solid #10B981;border-radius:10px;padding:16px;margin-bottom:16px;">
          <h3 style="color:#065F46;margin:0 0 6px;font-size:16px;">✅ Real-Time SMTP Gateway Verified</h3>
          <p style="color:#047857;margin:0;font-size:13px;line-height:1.5;">
            Your Dexa Group WFH Attendance &amp; Monitoring System has successfully established an authenticated TLS handshake with the external SMTP mail gateway.
          </p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#334155;margin-bottom:16px;">
          <tr><td style="padding:6px 0;width:150px;color:#64748B;">SMTP Host:</td><td style="font-weight:600;">${host}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">SMTP Port:</td><td style="font-weight:600;">${port}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">Authenticated Sender:</td><td style="font-weight:600;">${user || 'Anonymous / Local Mailpit'}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">Target Recipient:</td><td style="font-weight:600;">${actualRecipient}${override ? ` (Forwarded from ${targetEmail})` : ''}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">Server Timestamp:</td><td style="font-weight:600;">${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</td></tr>
        </table>
        <p style="margin:0;color:#64748B;font-size:12px;line-height:1.5;">
          All automatic OTP verifications, password reset links, hybrid WFH notices, and developer support tickets will now be delivered directly to your real Gmail or Outlook inbox.
        </p>
      `,
    );

    try {
      const info = await this.transporter.sendMail({
        from: this.systemFrom,
        to: actualRecipient,
        subject: `[Dexa WFH] SMTP Gateway Diagnostic Handshake Verified (${new Date().toLocaleTimeString('id-ID')})`,
        html: testHtml,
      });
      this.logger.log(`[SMTP_DIAGNOSTIC_SUCCESS] Sent test email to ${actualRecipient} (messageId: ${info.messageId})`);
      return {
        success: true,
        message: `Diagnostic email successfully delivered to ${actualRecipient}`,
        messageId: info.messageId,
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      this.logger.error(`[SMTP_DIAGNOSTIC_ERROR] Handshake failed to ${actualRecipient}: ${errMsg}`);
      return {
        success: false,
        message: `SMTP connection failed: ${errMsg}`,
      };
    }
  }

  // Feature: Core System Architecture — Purpose: Sends a 6-digit OTP email for either New Account Verification or Forgot Password.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Called by auth.service.ts, employees.service.ts, and access-requests.service.ts.
  async sendOtpEmail(params: {
    toEmail: string;
    fullName: string;
    otpCode: string;
    type: OtpType;
    employeeCode?: string;
  }): Promise<boolean> {
    const isVerification = params.type === OtpType.ACCOUNT_VERIFICATION;
    const subject = isVerification
      ? '[Dexa WFH System] Verify Your New Employee Account (6-Digit OTP)'
      : '[Dexa WFH System] Password Reset Verification Code (6-Digit OTP)';

    const html = this.wrapEmailTemplate(
      isVerification ? 'Activate Your WFH Monitoring Account' : 'Reset Your Account Password',
      `
        <p style="margin:0 0 12px;color:#334155;font-size:15px;">Hello <strong>${params.fullName}</strong>${params.employeeCode ? ` (${params.employeeCode})` : ''},</p>
        <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
          ${
            isVerification
              ? 'Your employee profile has been provisioned in the Dexa Group WFH Attendance & Monitoring System. Use the 6-digit OTP code below on the <strong>Verify Account</strong> screen to set your password and activate your account:'
              : 'We received a request to reset the password for your WFH Monitoring account. Enter the 6-digit OTP code below on the <strong>Reset Password</strong> screen:'
          }
        </p>
        <div style="background:#EFF6FF;border:2px dashed #2563EB;border-radius:12px;padding:18px;text-align:center;margin:20px 0;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#1E40AF;font-weight:700;margin-bottom:6px;">
            ${isVerification ? 'Account Verification OTP' : 'Password Reset OTP'}
          </div>
          <div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#0F172A;font-family:monospace;">
            ${params.otpCode}
          </div>
          <div style="font-size:12px;color:#64748B;margin-top:6px;">Valid for 15 minutes (single-use)</div>
        </div>
      `,
    );

    return this.safeSend({
      from: this.systemFrom,
      to: params.toEmail,
      subject,
      html,
    });
  }

  // Feature: Core System Architecture — Purpose: Sends a "Contact Developer / Need Help" email where: - TO: System Administrator accounts - CC: HR Admin accounts & sender.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Called by backend/apps/employee-service/src/support/support.service.ts contactDeveloper().
  async sendContactDeveloperEmail(input: SupportMailInput): Promise<boolean> {
    const formattedSender = `"${input.senderName} (Dexa WFH User)" <${input.senderEmail}>`;
    const toRecipients = input.toEmails && input.toEmails.length > 0 ? input.toEmails : [this.developerEmail];
    const ccRecipients = input.ccEmails && input.ccEmails.length > 0 ? input.ccEmails : [input.senderEmail];

    const html = this.wrapEmailTemplate(
      `Support Request [${input.category}] — ${input.subject}`,
      `
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px;">
          <tr><td style="padding:6px 0;color:#64748B;width:140px;">Ticket ID:</td><td style="padding:6px 0;color:#0F172A;font-weight:600;">#${input.ticketId.slice(0, 8).toUpperCase()}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">Sender Account:</td><td style="padding:6px 0;color:#1E40AF;font-weight:700;">${input.senderName} &lt;${input.senderEmail}&gt;</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">Role / NIP:</td><td style="padding:6px 0;color:#0F172A;">${input.senderRole}${input.employeeCode ? ` (${input.employeeCode})` : ''}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">Category:</td><td style="padding:6px 0;color:#D32F2F;font-weight:700;">${input.category}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">Module Location:</td><td style="padding:6px 0;color:#0F172A;">${input.moduleLocation}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">Assigned To:</td><td style="padding:6px 0;color:#7C3AED;font-weight:600;">System Administrator (${toRecipients.join(', ')})</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">CC Recipients:</td><td style="padding:6px 0;color:#0F172A;">HR Admin &amp; Sender (${ccRecipients.join(', ')})</td></tr>
        </table>
        <div style="background:#F8FAFC;border-left:4px solid #2563EB;padding:14px 16px;border-radius:8px;color:#1E293B;font-size:14px;line-height:1.6;white-space:pre-wrap;">${input.message}</div>
      `,
    );

    return this.safeSend({
      from: formattedSender,
      sender: input.senderEmail,
      replyTo: input.senderEmail,
      to: toRecipients,
      cc: ccRecipients,
      subject: `[WFH Support - ${input.category}] ${input.subject}`,
      html,
    });
  }

  // Feature: Visual Theme & Copyright Watermark Standard — Purpose: Wraps email body HTML with the Corporate Blue + Dexa Group Red brand frame and mandatory copyright footer.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Used by sendOtpEmail() and sendContactDeveloperEmail().
  private wrapEmailTemplate(title: string, bodyHtml: string): string {
    return `
      <div style="font-family:'Segoe UI',Inter,Arial,sans-serif;background:#F1F5F9;padding:28px 16px;">
        <div style="max-width:580px;margin:0 auto;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;">
          <div style="height:5px;background:linear-gradient(90deg,#D32F2F 0%,#2563EB 45%,#1E40AF 100%);"></div>
          <div style="padding:22px 26px;background:#0F172A;color:#FFFFFF;display:flex;align-items:center;justify-content:space-between;">
            <div>
              <span style="display:inline-block;background:#D32F2F;color:#FFFFFF;font-weight:800;font-size:12px;padding:3px 8px;border-radius:4px;letter-spacing:1px;margin-right:8px;">DEXA GROUP</span>
              <span style="font-size:15px;font-weight:700;color:#F8FAFC;">WFH Attendance &amp; Monitoring</span>
            </div>
          </div>
          <div style="padding:26px;">
            <h2 style="margin:0 0 14px;color:#0F172A;font-size:19px;">${title}</h2>
            ${bodyHtml}
          </div>
          <div style="padding:14px 26px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;text-align:center;">
            &copy; 2026 Abdurrahman Khairi - Created strictly for Technical Assessment evaluation. Unauthorized commercial use is prohibited
          </div>
        </div>
      </div>
    `;
  }

  // Feature: #10 resilience — Purpose: Sends mail via Nodemailer without crashing the microservice if a local developer environment has no SMTP server running.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: All MailService public methods.
  private async safeSend(options: nodemailer.SendMailOptions): Promise<boolean> {
    try {
      const smtpUser = this.config.get<string>('SMTP_USER', '');
      const overrideRecipient = this.config.get<string>('SMTP_OVERRIDE_RECIPIENT', '');

      let actualTo = options.to;
      let actualHtml = options.html;

      // Feature: Smart Recipient Routing for Demo Accounts — Delivers demo accounts to evaluation inbox.
      if (overrideRecipient) {
        const originalTo = Array.isArray(options.to) ? options.to.join(', ') : String(options.to);
        actualTo = overrideRecipient;
        if (typeof actualHtml === 'string') {
          actualHtml = actualHtml.replace(
            '<div style="padding:26px;">',
            `<div style="padding:26px;">
              <div style="background:#FEF3C7;border:1px solid #F59E0B;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:12px;color:#92400E;font-family:sans-serif;line-height:1.4;">
                <strong>ℹ️ WFH System Demonstration Routing:</strong><br/>
                Intended demo recipient: <code>${originalTo}</code><br/>
                Delivered directly to your evaluation inbox: <code>${overrideRecipient}</code>
              </div>`,
          );
        }
      }

      const mailOptions: nodemailer.SendMailOptions = {
        ...options,
        to: actualTo,
        html: actualHtml,
        from: this.config.get<string>('SMTP_FROM') || (smtpUser ? `"Dexa Group WFH" <${smtpUser}>` : options.from),
        replyTo: options.replyTo || options.from,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`[SMTP_SUCCESS] Dispatched email -> to=${String(mailOptions.to)} | from=${String(mailOptions.from)} | subject=${String(mailOptions.subject)} | id=${info.messageId}`);
      return true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[SMTP_ERROR] Failed to send email to ${String(options.to)}: ${errMsg}`, error instanceof Error ? error.stack : undefined);
      return false;
    }
  }
}
