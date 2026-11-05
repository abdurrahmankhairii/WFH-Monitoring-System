// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================

// Feature: Core System Architecture — Purpose: Strict TypeScript declaration for the `exif-parser` module used to inspect uploaded JPEG EXIF timestamps.
// OOP: Structural Contract (Interface Definition) — Connected To: backend/apps/api-gateway/src/storage/photo-metadata.util.ts.
declare module 'exif-parser' {
  export interface ExifTags {
    DateTimeOriginal?: number;
    CreateDate?: number;
    ModifyDate?: number;
    Make?: string;
    Model?: string;
  }

  export interface ExifParseResult {
    tags?: ExifTags;
  }

  export interface ExifParserInstance {
    parse(): ExifParseResult;
  }

  export function create(buffer: Buffer): ExifParserInstance;
}
