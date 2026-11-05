// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SupportCategory, SupportTicketStatus } from '../constants/enums';
import { DATETIME_COLUMN } from './column-types';
import { User } from './user.entity';

// Feature: Support Ticket Entity — Purpose: Persisted "Contact Developer" support tickets.
// OOP: Domain Entity (TypeORM Relational Model) — Connected To: employee-service support.service.ts (save + Nodemailer send with from/replyTo = user email), frontend.
@Entity('support_tickets')
@Index('IDX_support_status', ['status'])
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column({ name: 'sender_email', type: 'varchar', length: 150 })
  senderEmail: string;

  @Column({ name: 'sender_name', type: 'varchar', length: 150 })
  senderName: string;

  @Column({ type: 'enum', enum: SupportCategory })
  category: SupportCategory;

  @Column({ name: 'module_location', type: 'varchar', length: 150 })
  moduleLocation: string;

  @Column({ type: 'varchar', length: 200 })
  subject: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'enum', enum: SupportTicketStatus, default: SupportTicketStatus.OPEN })
  status: SupportTicketStatus;

  @Column({ name: 'email_delivered', type: 'boolean', default: false })
  emailDelivered: boolean;

  @CreateDateColumn({ name: 'created_at', type: DATETIME_COLUMN })
  createdAt: Date;
}
