// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailDispatchResult, OtpType, SmtpMailerService, SupportCategory } from '@app/common';

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

// Feature: Central SMTP Mail Composer — Purpose: Builds OTP, Contact Developer and diagnostic emails and hands them to the shared SMTP mailer.
// OOP: Injectable Domain Service (Composition over SmtpMailerService) — Connected To: auth.service.ts, employees.service.ts, support.service.ts and libs/common smtp-mailer.service.ts.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly developerEmail: string;
  private static readonly TEMPLATE_BODY_ANCHOR = '<div style="padding:26px;">';

  constructor(
    private readonly config: ConfigService,
    private readonly mailer: SmtpMailerService,
  ) {
    this.developerEmail = this.config.get<string>('DEVELOPER_SUPPORT_EMAIL', 'abdurrahman.khairi@dexagroup.com');
  }

  // Feature: SMTP Diagnostic Testing — Purpose: Sends an instant diagnostic test email from the system mailbox to verify the SMTP handshake and inbox delivery.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Called by support.service.ts testEmail() via TCP support.test_email.
  async sendTestEmail(targetEmail: string): Promise<{ success: boolean; message: string; messageId?: string }> {
    const { host, port, systemAddress, senderMode } = this.mailer.getDiagnostics();

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
          <tr><td style="padding:6px 0;color:#64748B;">System Sender:</td><td style="font-weight:600;">${systemAddress}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">Sender Mode:</td><td style="font-weight:600;">${senderMode === 'relay' ? 'relay (user emails are sent as the user through the company relay)' : 'system (user emails are sent from the system sender with Reply-To set to the user)'}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">Target Recipient:</td><td style="font-weight:600;">${targetEmail}</td></tr>
          <tr><td style="padding:6px 0;color:#64748B;">Server Timestamp:</td><td style="font-weight:600;">${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</td></tr>
        </table>
        <p style="margin:0;color:#64748B;font-size:12px;line-height:1.5;">
          All automatic OTP verifications, password reset links, hybrid WFH notices, and developer support tickets will now be delivered directly to your real Gmail or Outlook inbox.
        </p>
      `,
    );

    const result = await this.mailer.send({
      to: [targetEmail],
      subject: `[Dexa WFH] SMTP Gateway Diagnostic Handshake Verified (${new Date().toLocaleTimeString('id-ID')})`,
      html: testHtml,
      text: `SMTP diagnostic from ${systemAddress} through ${host}:${port} to ${targetEmail}.`,
      bannerAnchor: MailService.TEMPLATE_BODY_ANCHOR,
    });
    if (!result.delivered) {
      this.logger.error(`[SMTP_DIAGNOSTIC_ERROR] Handshake failed to ${targetEmail}: ${result.error}`);
      return { success: false, message: `SMTP connection failed: ${result.error}` };
    }
    this.logger.log(`[SMTP_DIAGNOSTIC_SUCCESS] Sent test email to ${result.to.join(', ')} (messageId: ${result.messageId})`);
    return {
      success: true,
      message: `Diagnostic email successfully delivered to ${result.to.join(', ')}`,
      messageId: result.messageId,
    };
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

    const text = [
      `Hello ${params.fullName}${params.employeeCode ? ` (${params.employeeCode})` : ''},`,
      '',
      `Your Dexa WFH ${isVerification ? 'account verification' : 'password reset'} code is ${params.otpCode}.`,
      'It is valid for 15 minutes and can be used once.',
      isVerification
        ? 'Enter it on the Verify Account screen to set your password and activate your account.'
        : 'Enter it on the Reset Password screen. If you did not ask for a reset, ignore this email.',
      '',
      '© 2026 Abdurrahman Khairi - Created strictly for Technical Assessment evaluation. Unauthorized commercial use is prohibited',
    ].join('\n');

    // OTP mail always leaves from the system mailbox (SMTP_USER), the same model as the Pertamina mailer.
    const result = await this.mailer.send({
      to: [params.toEmail],
      subject,
      text,
      html,
      bannerAnchor: MailService.TEMPLATE_BODY_ANCHOR,
    });
    const delivered = result.delivered;
    if (!delivered) {
      this.logger.warn(`[OTP_FALLBACK] Email not delivered. ${params.type} OTP for ${params.toEmail} is ${params.otpCode} (valid 15 minutes).`);
    }
    return delivered;
  }

  // Feature: Contact Developer via SMTP — Purpose: Sends the support ticket as the signed in user (relay mode) or from the system sender, To System Administrators and Cc HR Admins plus the sender.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: support.service.ts contactDeveloper() and SmtpMailerService.send().
  async sendContactDeveloperEmail(input: SupportMailInput): Promise<MailDispatchResult> {
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

    const text = [
      `Support ticket #${input.ticketId.slice(0, 8).toUpperCase()} from ${input.senderName} <${input.senderEmail}>`,
      `Role: ${input.senderRole}${input.employeeCode ? ` (${input.employeeCode})` : ''}`,
      `Category: ${input.category}`,
      `Module: ${input.moduleLocation}`,
      '',
      input.message,
    ].join('\n');

    return this.mailer.send({
      sender: { email: input.senderEmail, name: input.senderName },
      to: toRecipients,
      cc: ccRecipients,
      subject: `[WFH Support - ${input.category}] ${input.subject}`,
      html,
      text,
      bannerAnchor: MailService.TEMPLATE_BODY_ANCHOR,
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

}
