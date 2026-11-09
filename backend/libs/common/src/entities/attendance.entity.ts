// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import {
  AttendanceStatus,
  LocationStatus,
  PhotoCaptureSource,
  VerificationMethod,
  VerificationStatus,
} from '../constants/enums';
import { DATETIME_COLUMN } from './column-types';
import { Employee } from './employee.entity';

const BIGINT_ZERO_TRANSFORMER = {
  to: (value?: number | null) => (value !== undefined && value !== null ? Math.round(Number(value)) : 0),
  from: (value?: string | number | null) => (value !== undefined && value !== null ? Number(value) : 0),
};

// Feature: WFH Attendance Session Entity — Purpose: One WFH attendance record per employee per WIB calendar day with AI biometric verification, anti-spoofing, perceptual hashing, and geolocation fields.
// OOP: Domain Entity (TypeORM Relational Model) — Connected To: attendance.service.ts, export.service.ts, and attendances table.
@Entity('attendances')
@Index('UQ_attendance_employee_date', ['employeeId', 'attendanceDate'], { unique: true })
@Index('IDX_attendance_date', ['attendanceDate'])
@Index('IDX_attendance_status', ['status'])
@Index('IDX_attendances_phash', ['employeeId', 'imagePhash'])
@Index('IDX_attendances_out_phash', ['employeeId', 'clockOutImagePhash'])
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

  @Column({ name: 'overtime_minutes', type: 'int', default: 0 })
  overtimeMinutes: number;

  @Column({ name: 'overtime_multiplier_hours', type: 'double', default: 0 })
  overtimeMultiplierHours: number;

  @Column({
    name: 'overtime_pay_amount',
    type: 'bigint',
    default: 0,
    transformer: BIGINT_ZERO_TRANSFORMER,
  })
  overtimePayAmount: number;

  @Column({ name: 'wfh_approved', type: 'boolean', default: false })
  wfhApproved: boolean;

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

  @Column({
    name: 'verification_method',
    type: 'enum',
    enum: VerificationMethod,
    default: VerificationMethod.LIVE_CAMERA_LIVENESS,
  })
  verificationMethod: VerificationMethod;

  @Column({
    name: 'verification_status',
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.VERIFIED_LIVE_BIOMETRIC,
  })
  verificationStatus: VerificationStatus;

  @Column({ name: 'liveness_score', type: 'double', nullable: true })
  livenessScore: number | null;

  @Column({ name: 'liveness_challenge_type', type: 'varchar', length: 50, nullable: true })
  livenessChallengeType: string | null;

  @Column({ name: 'similarity_score', type: 'double', nullable: true })
  similarityScore: number | null;

  @Column({ name: 'clock_out_similarity_score', type: 'double', nullable: true })
  clockOutSimilarityScore: number | null;

  @Column({ name: 'is_face_matched', type: 'boolean', default: false })
  isFaceMatched: boolean;

  @Column({ name: 'is_clock_out_face_matched', type: 'boolean', default: false })
  isClockOutFaceMatched: boolean;

  @Column({ name: 'image_hash', type: 'varchar', length: 64, nullable: true })
  imageHash: string | null;

  @Column({ name: 'image_phash', type: 'varchar', length: 64, nullable: true })
  imagePhash: string | null;

  @Column({ name: 'clock_out_image_hash', type: 'varchar', length: 64, nullable: true })
  clockOutImageHash: string | null;

  @Column({ name: 'clock_out_image_phash', type: 'varchar', length: 64, nullable: true })
  clockOutImagePhash: string | null;

  @Column({ name: 'exif_captured_at', type: DATETIME_COLUMN, nullable: true })
  exifCapturedAt: Date | null;

  @Column({ name: 'exif_metadata', type: 'json', nullable: true })
  exifMetadata: Record<string, any> | null;

  @Column({ name: 'fallback_reason', type: 'text', nullable: true })
  fallbackReason: string | null;

  @Column({ name: 'clock_out_fallback_reason', type: 'text', nullable: true })
  clockOutFallbackReason: string | null;

  @Column({ name: 'clock_out_latitude', type: 'decimal', precision: 10, scale: 8, nullable: true })
  clockOutLatitude: number | null;

  @Column({ name: 'clock_out_longitude', type: 'decimal', precision: 11, scale: 8, nullable: true })
  clockOutLongitude: number | null;

  @Column({ name: 'clock_out_address', type: 'text', nullable: true })
  clockOutAddress: string | null;

  @Column({ name: 'clock_out_distance_from_home_meters', type: 'int', nullable: true })
  clockOutDistanceFromHomeMeters: number | null;

  @Column({
    name: 'clock_out_location_status',
    type: 'enum',
    enum: LocationStatus,
    default: LocationStatus.LOCATION_UNAVAILABLE,
  })
  clockOutLocationStatus: LocationStatus;

  @Column({ name: 'latitude', type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number | null;

  @Column({ name: 'longitude', type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'distance_from_home_meters', type: 'int', nullable: true })
  distanceFromHomeMeters: number | null;

  @Column({
    name: 'location_status',
    type: 'enum',
    enum: LocationStatus,
    default: LocationStatus.LOCATION_UNAVAILABLE,
  })
  locationStatus: LocationStatus;

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
