// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

// Feature: SMTP Sender Policy — Purpose: Names the identity that signed an email so callers can report the real sender.
// OOP: Enum Value Object — Connected To: SmtpMailerService.send() and describeMailDispatch().
export enum MailSenderMode {
  USER_VIA_RELAY = 'USER_VIA_RELAY',
  SYSTEM_ON_BEHALF = 'SYSTEM_ON_BEHALF',
  SYSTEM = 'SYSTEM',
}

// Feature: SMTP Sender Policy — Purpose: Selects how user emails are sent, set per server with SMTP_SENDER_MODE in .env.
// OOP: Enum Value Object — Connected To: SmtpMailerService constructor and send().
export enum SmtpSenderPolicy {
  SYSTEM = 'system',
  RELAY = 'relay',
}

export interface MailPerson {
  email: string;
  name?: string | null;
}

export interface MailMessageInput {
  sender?: MailPerson | null;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  bannerAnchor?: string;
}

export interface MailRerouteEntry {
  original: string;
  deliveredTo: string;
  field: 'to' | 'cc';
}

export interface MailDispatchResult {
  delivered: boolean;
  mode: MailSenderMode;
  fromAddress: string;
  intendedSender: string | null;
  replyTo?: string;
  to: string[];
  cc: string[];
  accepted: string[];
  rejected: string[];
  rerouted: MailRerouteEntry[];
  fallbackReason?: string;
  error?: string;
  messageId?: string;
}

interface RoutedRecipients {
  to: string[];
  cc: string[];
  rerouted: MailRerouteEntry[];
}

const EMAIL_PATTERN = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

// Feature: Sender Address Sanitization — Purpose: Returns the bare lowercase address from a value such as "Name" <user@gmail.com>, or an empty string when it is not an address.
// OOP: Pure Helper Function — Connected To: SmtpMailerService (SMTP_USER, SMTP_FROM, SMTP_OVERRIDE_RECIPIENT and every recipient list).
export function extractMailAddress(raw: string | null | undefined): string {
  if (!raw) return '';
  const match = String(raw).match(/<([^>]+)>/);
  const address = (match ? match[1] : String(raw)).replace(/["']/g, '').trim().toLowerCase();
  return EMAIL_PATTERN.test(address) ? address : '';
}

// Feature: Delivery Reporting — Purpose: Turns a dispatch result into plain sentences that name the real sender, the real recipients and any demo rerouting.
// OOP: Pure Helper Function — Connected To: attendance-requests.service.ts create()/review() and support.service.ts contactDeveloper().
export function describeMailDispatch(result: MailDispatchResult): string {
  if (!result.delivered) {
    const reason = result.error ?? 'no recipient was accepted';
    return `The SMTP server did not accept the email (${reason}).`;
  }
  const ccPart = result.cc.length > 0 ? ` with Cc ${result.cc.join(', ')}` : '';
  let senderPart: string;
  switch (result.mode) {
    case MailSenderMode.USER_VIA_RELAY:
      senderPart = `Sender: ${result.fromAddress}, the user's own account, through the company SMTP relay.`;
      break;
    case MailSenderMode.SYSTEM_ON_BEHALF:
      senderPart = `Sender: the system mailbox ${result.fromAddress} on behalf of ${result.intendedSender} (Reply-To ${result.replyTo ?? result.intendedSender})${result.fallbackReason ? `, because ${result.fallbackReason}` : ''}.`;
      break;
    default:
      senderPart = `Sender: the system mailbox ${result.fromAddress}.`;
  }
  const reroutedPart =
    result.rerouted.length > 0
      ? ` Demo addresses ${result.rerouted.map((entry) => entry.original).join(', ')} went to ${result.rerouted[0].deliveredTo}.`
      : '';
  const rejectedPart = result.rejected.length > 0 ? ` Rejected by the server: ${result.rejected.join(', ')}.` : '';
  return `Sent to ${result.to.join(', ')}${ccPart}. ${senderPart}${reroutedPart}${rejectedPart}`;
}

// Feature: Shared SMTP Mailer (System Sender and Company Relay) — Purpose: Sends OTP mail from the system sender and user actions either as the user (relay) or from the system sender on the user's behalf.
// OOP: Injectable Infrastructure Service (Strategy per Sender Policy) — Connected To: employee-service mail.service.ts and attendance-service attendance-requests.service.ts.
@Injectable()
export class SmtpMailerService {
  private readonly logger = new Logger(SmtpMailerService.name);
  private readonly host: string;
  private readonly port: number;
  private readonly secure: boolean;
  private readonly transport: Transporter;
  private readonly systemAddress: string;
  private readonly systemFrom: string;
  private readonly senderPolicy: SmtpSenderPolicy;
  private readonly relaySenderDomains: string[];
  private readonly overrideInbox: string;
  private readonly demoDomains: string[];

  constructor(private readonly config: ConfigService) {
    this.host = this.config.get<string>('SMTP_HOST', 'smtp.gmail.com').trim();
    this.port = Number(this.config.get<string>('SMTP_PORT', '587'));
    this.secure = this.config.get<string>('SMTP_SECURE', 'false') === 'true' || this.port === 465;

    const user = this.config.get<string>('SMTP_USER', '').trim();
    const pass = this.config.get<string>('SMTP_PASS', '');
    const fromSetting = this.config.get<string>('SMTP_FROM', '').trim();
    const authAddress = user && pass ? extractMailAddress(user) || extractMailAddress(fromSetting) : '';

    // The system sender is the signed in SMTP account; a relay without a login uses SMTP_FROM.
    this.systemAddress = authAddress || extractMailAddress(fromSetting) || 'noreply-wfh@dexagroup.com';
    this.systemFrom = authAddress || fromSetting || '"Dexa Group WFH Monitoring" <noreply-wfh@dexagroup.com>';
    this.transport = nodemailer.createTransport(this.buildTransportOptions(user && pass ? { user, pass } : undefined));

    const policy = this.config.get<string>('SMTP_SENDER_MODE', 'system').trim().toLowerCase();
    this.senderPolicy = policy === SmtpSenderPolicy.RELAY ? SmtpSenderPolicy.RELAY : SmtpSenderPolicy.SYSTEM;
    if (policy && policy !== SmtpSenderPolicy.RELAY && policy !== SmtpSenderPolicy.SYSTEM) {
      this.logger.warn(`Unknown SMTP_SENDER_MODE "${policy}". Falling back to "system".`);
    }
    this.relaySenderDomains = this.parseDomainList(this.config.get<string>('SMTP_RELAY_SENDER_DOMAINS', ''));
    this.overrideInbox = extractMailAddress(this.config.get<string>('SMTP_OVERRIDE_RECIPIENT', ''));
    this.demoDomains = this.parseDomainList(this.config.get<string>('SMTP_DEMO_DOMAINS', 'dexagroup.com,example.com'));

    this.logger.log(
      `SMTP mailer ready: ${this.host}:${this.port} (secure: ${this.secure}, auth: ${Boolean(user && pass)}) | sender mode=${this.senderPolicy} | system sender=${this.systemAddress} | relay sender domains=[${this.relaySenderDomains.join(', ') || 'all'}] | demo routing=${this.overrideInbox ? `[${this.demoDomains.join(', ')}] -> ${this.overrideInbox}` : 'off'}`,
    );
    if (this.senderPolicy === SmtpSenderPolicy.RELAY && /^smtp\.(gmail|office365)\.com$|^smtp-mail\.outlook\.com$/i.test(this.host)) {
      this.logger.warn(`SMTP_SENDER_MODE=relay with ${this.host}: this public server rewrites From to the signed in account. Point SMTP_HOST to the company relay (for example smtp-relay.gmail.com or an internal Exchange relay).`);
    }
  }

  // Feature: Shared SMTP Mailer — Purpose: Routes To/Cc per address, then sends as the user through the company relay or from the system sender on the user's behalf.
  // OOP: Strategy Selection with Fallback (Public Service Method) — Connected To: mail.service.ts (OTP, support ticket, diagnostic) and attendance-requests.service.ts (request and decision emails).
  async send(input: MailMessageInput): Promise<MailDispatchResult> {
    const routed = this.routeRecipients(input.to, input.cc ?? []);
    if (routed.to.length === 0) {
      routed.to = routed.cc;
      routed.cc = [];
    }

    const sender = input.sender ? extractMailAddress(input.sender.email) : '';
    const senderName = this.cleanDisplayName(input.sender?.name) || sender;

    if (routed.to.length === 0) {
      this.logger.error(`[SMTP_ERROR] No valid recipient for "${input.subject}" (to=${input.to.join(', ')} cc=${(input.cc ?? []).join(', ')})`);
      return this.emptyResult(MailSenderMode.SYSTEM, sender || null, routed, 'no valid recipient address');
    }

    const html = this.applyRoutingBanner(input.html, input.bannerAnchor, routed.rerouted);
    const text = routed.rerouted.length > 0 ? `${input.text}\n\n${this.routingNotice(routed.rerouted)}` : input.text;
    const base: nodemailer.SendMailOptions = { to: routed.to, cc: routed.cc.length > 0 ? routed.cc : undefined, subject: input.subject, html, text };

    // System emails such as OTP always come from the system sender.
    if (!sender) {
      return this.dispatch(MailSenderMode.SYSTEM, { ...base, from: this.systemFrom }, routed, null);
    }

    // Company relay: the relay accepts every address of the company domain, so the user is the real sender.
    let fallbackReason: string | undefined;
    if (this.senderPolicy === SmtpSenderPolicy.RELAY) {
      if (this.relayAllowsSender(sender)) {
        const relayed = await this.dispatch(MailSenderMode.USER_VIA_RELAY, { ...base, from: { name: senderName, address: sender } }, routed, sender);
        if (relayed.delivered) return relayed;
        fallbackReason = `the company relay refused ${sender} (${relayed.error ?? 'rejected'})`;
      } else {
        fallbackReason = `${sender} is outside SMTP_RELAY_SENDER_DOMAINS`;
      }
      this.logger.warn(`[SMTP_SENDER_FALLBACK] ${fallbackReason}. Sending from ${this.systemAddress} with Reply-To ${sender}.`);
    }

    // System sender mode: From is the system mailbox, the display name and Reply-To keep the user visible and reachable.
    const replyTo = this.isDemoAddress(sender) ? this.overrideInbox : sender;
    const onBehalf = await this.dispatch(
      MailSenderMode.SYSTEM_ON_BEHALF,
      { ...base, from: { name: `${senderName} via Dexa WFH`, address: this.systemAddress }, replyTo: { name: senderName, address: replyTo } },
      routed,
      sender,
    );
    return { ...onBehalf, replyTo, fallbackReason };
  }

  // Feature: SMTP Diagnostics — Purpose: Exposes the non secret SMTP settings used by the diagnostic email.
  // OOP: Read Only Accessor — Connected To: mail.service.ts sendTestEmail().
  getDiagnostics(): { host: string; port: number; systemAddress: string; senderMode: SmtpSenderPolicy } {
    return { host: this.host, port: this.port, systemAddress: this.systemAddress, senderMode: this.senderPolicy };
  }

  // Feature: SMTP Dispatch and Audit Log — Purpose: Sends one message and records the accepted and rejected recipients.
  // OOP: Private Template Method — Connected To: send() above.
  private async dispatch(
    mode: MailSenderMode,
    options: nodemailer.SendMailOptions,
    routed: RoutedRecipients,
    intendedSender: string | null,
  ): Promise<MailDispatchResult> {
    const fromAddress = typeof options.from === 'string' ? extractMailAddress(options.from) || options.from : (options.from as { address: string }).address;
    try {
      const info = await this.transport.sendMail(options);
      const accepted = this.toAddressList(info.accepted);
      const rejected = this.toAddressList(info.rejected);
      const delivered = accepted.length > 0;
      const line = `mode=${mode} | from=${fromAddress} | to=${routed.to.join(', ')} | cc=${routed.cc.join(', ') || '-'} | rerouted=${routed.rerouted.map((r) => r.original).join(', ') || '-'} | subject=${String(options.subject)} | id=${info.messageId}`;
      if (delivered) {
        this.logger.log(`[SMTP_SUCCESS] ${line}${rejected.length ? ` | rejected=${rejected.join(', ')}` : ''}`);
      } else {
        this.logger.error(`[SMTP_ERROR] No recipient accepted | ${line} | rejected=${rejected.join(', ')}`);
      }
      return {
        delivered,
        mode,
        fromAddress,
        intendedSender,
        to: routed.to,
        cc: routed.cc,
        accepted,
        rejected,
        rerouted: routed.rerouted,
        messageId: info.messageId,
        error: delivered ? undefined : 'every recipient was rejected',
      };
    } catch (error) {
      const rawMsg = error instanceof Error ? error.message : String(error);
      // SMTP servers return multi line replies; the first line carries the code and the reason.
      const errMsg = rawMsg.split(/\r?\n/)[0].replace(/\s*For more information.*$/i, '').trim() || rawMsg;
      this.logger.error(`[SMTP_ERROR] mode=${mode} | from=${fromAddress} | to=${routed.to.join(', ')} | ${errMsg}`);
      return { ...this.emptyResult(mode, intendedSender, routed, errMsg), fromAddress };
    }
  }

  // Feature: Smart Recipient Routing for Demo Accounts — Purpose: Rewrites only seeded demo domain addresses to SMTP_OVERRIDE_RECIPIENT and keeps every real To/Cc address untouched.
  // OOP: Private Pure Mapping Method — Connected To: send() above, SMTP_OVERRIDE_RECIPIENT and SMTP_DEMO_DOMAINS.
  private routeRecipients(to: string[], cc: string[]): RoutedRecipients {
    const rerouted: MailRerouteEntry[] = [];
    const mapList = (list: string[], field: 'to' | 'cc'): string[] =>
      list
        .map((raw) => extractMailAddress(raw))
        .filter(Boolean)
        .map((address) => {
          if (this.isDemoAddress(address)) {
            rerouted.push({ original: address, deliveredTo: this.overrideInbox, field });
            return this.overrideInbox;
          }
          return address;
        });
    const toList = Array.from(new Set(mapList(to, 'to')));
    const ccList = Array.from(new Set(mapList(cc, 'cc'))).filter((address) => !toList.includes(address));
    return { to: toList, cc: ccList, rerouted };
  }

  // Feature: Smart Recipient Routing for Demo Accounts — Purpose: Tells whether an address belongs to a seeded demo domain while an override inbox is set.
  // OOP: Private Predicate — Connected To: routeRecipients() and send() Reply-To handling.
  private isDemoAddress(address: string): boolean {
    if (!this.overrideInbox) return false;
    const domain = address.split('@')[1] ?? '';
    return this.demoDomains.some((demo) => demo === '*' || domain === demo || domain.endsWith(`.${demo}`));
  }

  // Feature: Company Relay Sending — Purpose: Tells whether the relay may send as this user; an empty SMTP_RELAY_SENDER_DOMAINS allows every user.
  // OOP: Private Predicate — Connected To: send() above and SMTP_RELAY_SENDER_DOMAINS.
  private relayAllowsSender(address: string): boolean {
    if (this.relaySenderDomains.length === 0) return true;
    const domain = address.split('@')[1] ?? '';
    return this.relaySenderDomains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
  }

  // Feature: Real SMTP Tuning — Purpose: Builds TLS and auth options for Gmail, Outlook and plain company relays.
  // OOP: Private Factory Method — Connected To: constructor.
  private buildTransportOptions(auth?: { user: string; pass: string }): Record<string, unknown> {
    const options: Record<string, unknown> = {
      host: this.host,
      port: this.port,
      secure: this.secure,
      tls: { rejectUnauthorized: false },
    };
    if (auth) options.auth = auth;
    if (this.host.includes('gmail.com')) {
      options.requireTLS = true;
    } else if (this.host.includes('office365.com') || this.host.includes('outlook.com')) {
      options.requireTLS = true;
      options.tls = { ciphers: 'SSLv3', rejectUnauthorized: false };
    }
    return options;
  }

  // Feature: Domain List Settings — Purpose: Parses comma separated domain settings such as SMTP_DEMO_DOMAINS and SMTP_RELAY_SENDER_DOMAINS.
  // OOP: Private Parser — Connected To: constructor.
  private parseDomainList(raw: string): string[] {
    return (raw ?? '')
      .split(/[,;\s]+/)
      .map((domain) => domain.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean);
  }

  // Feature: Sender Display Name Hygiene — Purpose: Strips quotes, brackets and embedded addresses from a display name so it never imitates another mailbox.
  // OOP: Private Pure Helper — Connected To: send() above.
  private cleanDisplayName(name: string | null | undefined): string {
    return String(name ?? '')
      .replace(/[\r\n"<>]/g, ' ')
      .replace(/\S+@\S+/g, ' ')
      .replace(/[()]\s*[()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Feature: Smart Recipient Routing for Demo Accounts — Purpose: Inserts a notice that names each rerouted demo address at the top of the email body.
  // OOP: Private Pure Helper — Connected To: send() above.
  private applyRoutingBanner(html: string, anchor: string | undefined, rerouted: MailRerouteEntry[]): string {
    if (rerouted.length === 0) return html;
    const banner = `<div style="background:#FEF3C7;border:1px solid #F59E0B;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:12px;color:#92400E;font-family:sans-serif;line-height:1.5;"><strong>Demo routing:</strong> ${this.routingNotice(rerouted)}</div>`;
    if (anchor && html.includes(anchor)) return html.replace(anchor, `${anchor}${banner}`);
    return `${banner}${html}`;
  }

  // Feature: Smart Recipient Routing for Demo Accounts — Purpose: Builds the plain text notice used in the banner and the text part.
  // OOP: Private Pure Helper — Connected To: applyRoutingBanner() and send().
  private routingNotice(rerouted: MailRerouteEntry[]): string {
    const list = rerouted.map((entry) => `${entry.original} (${entry.field === 'to' ? 'To' : 'Cc'})`).join(', ');
    return `${list} ${rerouted.length > 1 ? 'are seeded demo addresses' : 'is a seeded demo address'} with no real mailbox, so that copy went to ${this.overrideInbox}. Every other recipient received this email directly.`;
  }

  // Feature: SMTP Dispatch and Audit Log — Purpose: Normalizes nodemailer accepted and rejected lists into plain addresses.
  // OOP: Private Pure Helper — Connected To: dispatch() above.
  private toAddressList(list: unknown): string[] {
    if (!Array.isArray(list)) return [];
    return list.map((item) => (typeof item === 'string' ? item : String((item as { address?: string })?.address ?? ''))).filter(Boolean);
  }

  // Feature: SMTP Dispatch and Audit Log — Purpose: Builds a failed result that still carries the routed recipients for reporting.
  // OOP: Private Factory Helper — Connected To: send() and dispatch().
  private emptyResult(mode: MailSenderMode, intendedSender: string | null, routed: RoutedRecipients, error: string): MailDispatchResult {
    return {
      delivered: false,
      mode,
      fromAddress: this.systemAddress,
      intendedSender,
      to: routed.to,
      cc: routed.cc,
      accepted: [],
      rejected: [],
      rerouted: routed.rerouted,
      error,
    };
  }
}
