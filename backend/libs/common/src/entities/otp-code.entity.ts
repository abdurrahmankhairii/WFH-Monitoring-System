// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OtpType } from '../constants/enums';
import { DATETIME_COLUMN } from './column-types';
import { User } from './user.entity';

// Feature: 6-Digit Email OTP Verification Entity — Purpose: Stores bcrypt-hashed 6-digit OTP codes (never plain text) with expiry, single-use marker and brute-force attempt counter.
// OOP: Domain Entity (TypeORM Relational Model) — Connected To: otp.service.ts, auth.service.ts, and otp_codes table.
@Entity('otp_codes')
@Index('IDX_otp_email_type', ['email', 'type'])
export class OtpCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Column({ name: 'code_hash', type: 'varchar', length: 255 })
  codeHash: string;

  @Column({ type: 'enum', enum: OtpType })
  type: OtpType;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'expires_at', type: DATETIME_COLUMN })
  expiresAt: Date;

  @Column({ name: 'used_at', type: DATETIME_COLUMN, nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: DATETIME_COLUMN })
  createdAt: Date;
}
