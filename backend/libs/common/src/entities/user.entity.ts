// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Column, CreateDateColumn, Entity, Index, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { UserRole } from '../constants/enums';
import { DATETIME_COLUMN } from './column-types';
import { Employee } from './employee.entity';

// Feature: User Account & RBAC Entity — Purpose: Authentication identity table.
// OOP: Domain Entity (TypeORM Relational Model) — Connected To: employee-service auth.service.ts (login/OTP), employees.service.ts (account provisioning),.
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_users_email', { unique: true })
  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.EMPLOYEE })
  role: UserRole;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: DATETIME_COLUMN, nullable: true })
  lastLoginAt: Date | null;

  @OneToOne(() => Employee, (employee) => employee.user)
  employee?: Employee;

  @CreateDateColumn({ name: 'created_at', type: DATETIME_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DATETIME_COLUMN })
  updatedAt: Date;
}
