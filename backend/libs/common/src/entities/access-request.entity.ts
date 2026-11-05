// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ApprovalStatus } from '../constants/enums';
import { DATETIME_COLUMN } from './column-types';
import { User } from './user.entity';

// Feature: Employee Onboarding Access Request Entity — Purpose: Public "Request Access" submissions from prospective employees awaiting HR Admin approval.
// OOP: Domain Entity (TypeORM Relational Model) — Connected To: employee-service access-requests.service.ts (approve -> provisions user + employee + verification OTP email).
@Entity('access_requests')
@Index('IDX_access_req_email_status', ['email', 'status'])
export class AccessRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Column({ name: 'employee_code', type: 'varchar', length: 50, nullable: true })
  employeeCode: string | null;

  @Column({ type: 'varchar', length: 100 })
  department: string;

  @Column({ type: 'varchar', length: 100 })
  position: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 30, nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

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
