// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { ColumnType } from 'typeorm';

// Feature: Relational Column Type Compatibility — Purpose: Resolves cross-database datetime column types (MySQL DATETIME vs PostgreSQL TIMESTAMP).
// OOP: Stateless Utility Function (Database Dialect Helper) — Connected To: Used across all TypeORM entity schemas in libs/common/src/entities.
export const DATETIME_COLUMN: ColumnType = process.env.DB_TYPE === 'postgres' ? 'timestamp' : 'datetime';
