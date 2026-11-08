// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ApprovalStatus, AttendanceRequestType } from '../constants/enums';
import { DATETIME_COLUMN } from './column-types';
import { Employee } from './employee.entity';
import { User } from './user.entity';

const BIGINT_NULLABLE_TRANSFORMER = {
  to: (value?: number | null) => (value !== undefined && value !== null ? Math.round(Number(value)) : null),
  from: (value?: string | number | null) => (value !== undefined && value !== null ? Number(value) : null),
};

// Feature: WFH Approval, Overtime, Leave & Correction Request Entity — Purpose: Self-service WFH Approval (1-day/week quota), Overtime, Leave, Sick & Correction requests with Manager & HR email routing.
// OOP: Domain Entity (TypeORM Relational Model) — Connected To: attendance-service attendance-requests.service.ts (create/review + attendance sync), frontend.
@Entity('attendance_requests')
@Index('IDX_att_req_employee_date', ['employeeId', 'targetDate'])
@Index('IDX_att_req_status', ['status'])
export class AttendanceRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Column({ name: 'request_type', type: 'enum', enum: AttendanceRequestType })
  requestType: AttendanceRequestType;

  @Column({ name: 'target_date', type: 'date' })
  targetDate: string;

  @Column({ name: 'requested_clock_in', type: DATETIME_COLUMN, nullable: true })
  requestedClockIn: Date | null;

  @Column({ name: 'requested_clock_out', type: DATETIME_COLUMN, nullable: true })
  requestedClockOut: Date | null;

  @Column({ name: 'overtime_minutes', type: 'int', nullable: true })
  overtimeMinutes: number | null;

  @Column({
    name: 'estimated_overtime_pay',
    type: 'bigint',
    nullable: true,
    transformer: BIGINT_NULLABLE_TRANSFORMER,
  })
  estimatedOvertimePay: number | null;

  @Column({ name: 'manager_email', type: 'varchar', length: 150, nullable: true })
  managerEmail: string | null;

  @Column({ name: 'cc_emails', type: 'varchar', length: 300, nullable: true })
  ccEmails: string | null;

  @Column({ name: 'email_dispatched', type: 'boolean', default: false })
  emailDispatched: boolean;

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'attachment_url', type: 'text', nullable: true })
  attachmentUrl: string | null;

  @Column({ type: 'enum', enum: ApprovalStatus, default: ApprovalStatus.PENDING })
  status: ApprovalStatus;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedBy?: User | null;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes: string | null;

  @Column({ name: 'reviewed_at', type: DATETIME_COLUMN, nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: DATETIME_COLUMN })
  createdAt: Date;
}
