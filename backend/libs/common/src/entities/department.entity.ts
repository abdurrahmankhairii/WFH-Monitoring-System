// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { WfhWorkflowMode } from '../constants/enums';
import { DATETIME_COLUMN } from './column-types';

// Feature: Department Master & Manager Email Routing Entity — Purpose: Stores department master records including manager email and weekly WFH quota limit.
// OOP: Domain Entity (TypeORM Relational Model) — Connected To: employees.service.ts, attendance-requests.service.ts, seed.service.ts, and departments table.
@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_departments_code', { unique: true })
  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Index('UQ_departments_name', { unique: true })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'manager_name', type: 'varchar', length: 150 })
  managerName: string;

  @Column({ name: 'manager_email', type: 'varchar', length: 150 })
  managerEmail: string;

  @Column({ name: 'hr_pic_email', type: 'varchar', length: 150, default: 'admin.hrd@dexagroup.com' })
  hrPicEmail: string;

  @Column({ name: 'max_wfh_days_per_week', type: 'int', default: 1 })
  maxWfhDaysPerWeek: number;

  @Column({
    name: 'wfh_workflow_mode',
    type: 'enum',
    enum: WfhWorkflowMode,
    default: WfhWorkflowMode.STRICT_APPROVAL,
  })
  wfhWorkflowMode: WfhWorkflowMode;

  @Column({ name: 'enable_overtime', type: 'boolean', default: true })
  enableOvertime: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: DATETIME_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DATETIME_COLUMN })
  updatedAt: Date;
}
