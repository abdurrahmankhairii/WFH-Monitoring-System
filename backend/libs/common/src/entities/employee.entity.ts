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

// Feature: Master Employee & Profile Entity — Purpose: Master employee profile (NIP, department, position, baseSalary, biometric face embedding, and geofencing home coordinates) linked with users.
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

  @Column({ name: 'face_embedding', type: 'json', nullable: true })
  faceEmbedding: number[] | null;

  @Column({ name: 'face_enrolled_at', type: DATETIME_COLUMN, nullable: true })
  faceEnrolledAt: Date | null;

  @Column({ name: 'face_enrolled_photo_url', type: 'text', nullable: true })
  faceEnrolledPhotoUrl: string | null;

  @Column({ name: 'home_latitude', type: 'decimal', precision: 10, scale: 8, nullable: true })
  homeLatitude: number | null;

  @Column({ name: 'home_longitude', type: 'decimal', precision: 11, scale: 8, nullable: true })
  homeLongitude: number | null;

  @Column({ name: 'home_address', type: 'text', nullable: true })
  homeAddress: string | null;

  @Column({ name: 'is_sibling_exempt', type: 'boolean', default: false })
  isSiblingExempt: boolean;

  @Column({ name: 'sibling_exempt_reason', type: 'text', nullable: true })
  siblingExemptReason: string | null;

  @Column({ name: 'sibling_exempt_approved_by', type: 'varchar', length: 150, nullable: true })
  siblingExemptApprovedBy: string | null;

  @OneToMany(() => Attendance, (attendance) => attendance.employee)
  attendances?: Attendance[];

  @CreateDateColumn({ name: 'created_at', type: DATETIME_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DATETIME_COLUMN })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: DATETIME_COLUMN, nullable: true })
  deletedAt: Date | null;
}
