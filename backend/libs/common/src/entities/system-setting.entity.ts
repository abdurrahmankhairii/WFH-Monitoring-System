// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { WfhWorkflowMode } from '../constants/enums';
import { DATETIME_COLUMN } from './column-types';

// Feature: Company Policy & Workflow Configuration — Purpose: Stores enterprise WFH approval workflow mode (Strict Approval vs Notice Only) and Overtime Pay calculation toggle.
// OOP: Domain Entity (TypeORM Relational Model) — Connected To: SystemSettingRepository, AttendanceService, and GET/PATCH /api/system/policy.
@Entity('system_settings')
export class SystemSetting {
  @PrimaryColumn({ type: 'varchar', length: 50, default: 'DEFAULT' })
  id: string;

  @Column({
    name: 'wfh_workflow_mode',
    type: 'enum',
    enum: WfhWorkflowMode,
    default: WfhWorkflowMode.STRICT_APPROVAL,
  })
  wfhWorkflowMode: WfhWorkflowMode;

  @Column({ name: 'enable_overtime', type: 'boolean', default: true })
  enableOvertime: boolean;

  @Column({ name: 'max_wfh_days_per_week', type: 'int', default: 1 })
  maxWfhDaysPerWeek: number;

  @Column({ name: 'updated_by_email', type: 'varchar', length: 150, nullable: true })
  updatedByEmail: string | null;

  @CreateDateColumn({ name: 'created_at', type: DATETIME_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DATETIME_COLUMN })
  updatedAt: Date;
}
