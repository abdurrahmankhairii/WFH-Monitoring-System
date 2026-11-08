// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmployeeStatus } from '../constants/enums';
import { Attendance } from './attendance.entity';
import { DATETIME_COLUMN } from './column-types';
import { Department } from './department.entity';
import { User } from './user.entity';

const BIGINT_NUMBER_TRANSFORMER = {
  to: (value?: number | null) => (value !== undefined && value !== null ? Math.round(Number(value)) : 12000000),
  from: (value?: string | number | null) => (value !== undefined && value !== null ? Number(value) : 12000000),
};

// Feature: Master Employee & Profile Entity — Purpose: Master employee profile (NIP, department, position, baseSalary) linked with users and departments.
// OOP: Domain Entity (TypeORM Relational Model) — Connected To: employees.service.ts, attendance.service.ts, and employees table.
@Entity('employees')
@Index('IDX_employees_department', ['department'])
@Index('IDX_employees_status', ['status'])
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_employees_user_id', { unique: true })
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => User, (user) => user.employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Index('UQ_employees_code', { unique: true })
  @Column({ name: 'employee_code', type: 'varchar', length: 50 })
  employeeCode: string;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  @Index('UQ_employees_email', { unique: true })
  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Column({ type: 'varchar', length: 100 })
  department: string;

  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId: string | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  departmentRef?: Department | null;

  @Column({ type: 'varchar', length: 100 })
  position: string;

  @Column({
    name: 'base_salary',
    type: 'bigint',
    default: 12000000,
    transformer: BIGINT_NUMBER_TRANSFORMER,
  })
  baseSalary: number;

  @Column({ name: 'phone_number', type: 'varchar', length: 30, nullable: true })
  phoneNumber: string | null;

  @Column({ name: 'join_date', type: 'date' })
  joinDate: string;

  @Column({ type: 'enum', enum: EmployeeStatus, default: EmployeeStatus.ACTIVE })
  status: EmployeeStatus;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string | null;

  @OneToMany(() => Attendance, (attendance) => attendance.employee)
  attendances?: Attendance[];

  @CreateDateColumn({ name: 'created_at', type: DATETIME_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DATETIME_COLUMN })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: DATETIME_COLUMN, nullable: true })
  deletedAt: Date | null;
}
