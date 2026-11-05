// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AttendanceStatus, PhotoCaptureSource } from '../constants/enums';
import { DATETIME_COLUMN } from './column-types';
import { Employee } from './employee.entity';

// Feature: WFH Attendance Session Entity — Purpose: One WFH attendance record per employee per WIB calendar day.
// OOP: Domain Entity (TypeORM Relational Model) — Connected To: attendance.service.ts, export.service.ts, and attendances table.
@Entity('attendances')
@Index('UQ_attendance_employee_date', ['employeeId', 'attendanceDate'], { unique: true })
@Index('IDX_attendance_date', ['attendanceDate'])
@Index('IDX_attendance_status', ['status'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, (employee) => employee.attendances, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate: string;

  @Column({ name: 'clock_in_time', type: DATETIME_COLUMN, nullable: true })
  clockInTime: Date | null;

  @Column({ name: 'clock_out_time', type: DATETIME_COLUMN, nullable: true })
  clockOutTime: Date | null;

  @Column({ name: 'work_duration_minutes', type: 'int', nullable: true })
  workDurationMinutes: number | null;

  @Column({ name: 'late_minutes', type: 'int', default: 0 })
  lateMinutes: number;

  @Column({ name: 'clock_in_photo_url', type: 'text', nullable: true })
  clockInPhotoUrl: string | null;

  @Column({ name: 'clock_out_photo_url', type: 'text', nullable: true })
  clockOutPhotoUrl: string | null;

  @Column({ name: 'clock_in_photo_captured_at', type: DATETIME_COLUMN, nullable: true })
  clockInPhotoCapturedAt: Date | null;

  @Column({ name: 'clock_out_photo_captured_at', type: DATETIME_COLUMN, nullable: true })
  clockOutPhotoCapturedAt: Date | null;

  @Column({ name: 'photo_capture_source', type: 'enum', enum: PhotoCaptureSource, nullable: true })
  photoCaptureSource: PhotoCaptureSource | null;

  @Column({ name: 'clock_out_capture_source', type: 'enum', enum: PhotoCaptureSource, nullable: true })
  clockOutCaptureSource: PhotoCaptureSource | null;

  @Column({ name: 'is_timestamp_verified', type: 'boolean', default: false })
  isTimestampVerified: boolean;

  @Column({ name: 'is_clock_out_timestamp_verified', type: 'boolean', nullable: true })
  isClockOutTimestampVerified: boolean | null;

  @Column({ name: 'daily_plan', type: 'text', nullable: true })
  dailyPlan: string | null;

  @Column({ name: 'daily_accomplishment', type: 'text', nullable: true })
  dailyAccomplishment: string | null;

  @Column({ type: 'enum', enum: AttendanceStatus })
  status: AttendanceStatus;

  @Column({ name: 'hr_note', type: 'text', nullable: true })
  hrNote: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'device_info', type: 'varchar', length: 255, nullable: true })
  deviceInfo: string | null;

  @CreateDateColumn({ name: 'created_at', type: DATETIME_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: DATETIME_COLUMN })
  updatedAt: Date;
}
