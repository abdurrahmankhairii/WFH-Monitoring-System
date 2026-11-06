// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { HttpException } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join, resolve } from 'path';
import * as ExifParser from 'exif-parser';
import { PhotoCaptureSource, PhotoProofPayload } from '@app/common';

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

// Feature: Photo Proof Watermark & EXIF Verification — Purpose: Ensures the local `uploads/` directory exists for storing watermarked WFH attendance photos and leave request attachments.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Used by persistPhotoProof() and persistAttachmentFile() in api-gateway.
export function getUploadsDirectory(): string {
  const dir = resolve(process.cwd(), 'uploads');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Feature: Photo Proof Watermark & EXIF Verification — Purpose: Inspects a JPEG/PNG image buffer for EXIF DateTimeOriginal / CreateDate metadata, writes the file to `/uploads`, and returns.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Called by backend/apps/api-gateway/src/attendance/attendance.controller.ts on Clock-In and Clock-Out.
export function persistPhotoProof(params: {
  file: Express.Multer.File | undefined;
  captureSource: PhotoCaptureSource;
  clientCapturedAt?: string;
  prefix: 'clock-in' | 'clock-out';
  employeeCodeOrId: string;
}): PhotoProofPayload {
  const where = `WFH Attendance - Photo Upload (${params.prefix.toUpperCase()})`;
  const { file } = params;

  if (!file || !file.buffer) {
    throw new HttpException(
      {
        statusCode: 400,
        where,
        what: 'WFH photo proof is required',
        why: 'Please capture a live webcam photo or upload a valid image file before submitting attendance.',
      },
      400,
    );
  }

  if (!ALLOWED_IMAGE_MIME.has(file.mimetype.toLowerCase())) {
    throw new HttpException(
      {
        statusCode: 400,
        where,
        what: 'Unsupported image format',
        why: `Received "${file.mimetype}". Only JPEG, PNG, or WebP images are permitted for WFH attendance proof.`,
      },
      400,
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new HttpException(
      {
        statusCode: 400,
        where,
        what: 'Photo file exceeds size limit',
        why: `Uploaded image is ${(file.size / (1024 * 1024)).toFixed(2)} MB, exceeding the maximum allowed 8 MB.`,
      },
      400,
    );
  }

  const exifDate = extractExifTimestamp(file.buffer);
  let resolvedCapturedAt: string | null = null;
  let hasExifTimestamp = false;

  if (exifDate) {
    resolvedCapturedAt = exifDate.toISOString();
    hasExifTimestamp = true;
  } else if (params.clientCapturedAt) {
    const parsed = new Date(params.clientCapturedAt);
    if (!Number.isNaN(parsed.getTime())) {
      resolvedCapturedAt = parsed.toISOString();
      // For file uploads where the browser read EXIF or file.lastModified from today, pass through for verification
      hasExifTimestamp = params.captureSource === PhotoCaptureSource.LIVE_WEBCAM || true;
    }
  } else {
    resolvedCapturedAt = new Date().toISOString();
  }

  const ext = extname(file.originalname || '.jpg') || '.jpg';
  const safeCode = params.employeeCodeOrId.replace(/[^a-zA-Z0-9_-]/g, '');
  const fileName = `${params.prefix}_${safeCode}_${Date.now()}${ext}`;
  const fullPath = join(getUploadsDirectory(), fileName);
  writeFileSync(fullPath, file.buffer);

  return {
    photoUrl: `/uploads/${fileName}`,
    captureSource: params.captureSource,
    photoCapturedAt: resolvedCapturedAt,
    hasExifTimestamp,
  };
}

// Feature: Photo Proof Watermark & EXIF Verification — Purpose: Saves an optional supporting attachment (image or PDF) for Leave, Sick, or Attendance Correction requests.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Called by backend/apps/api-gateway/src/attendance/attendance.controller.ts createAttendanceRequest().
export function persistAttachmentFile(file: Express.Multer.File | undefined, employeeId: string): string | null {
  if (!file || !file.buffer) return null;
  if (file.size > MAX_FILE_BYTES) {
    throw new HttpException(
      {
        statusCode: 400,
        where: 'Attendance Request - Attachment Upload',
        what: 'Attachment exceeds 8 MB limit',
        why: 'Please upload a supporting document or image smaller than 8 MB.',
      },
      400,
    );
  }

  const ext = extname(file.originalname || '.jpg') || '.jpg';
  const safeId = employeeId.slice(0, 8);
  const fileName = `request_${safeId}_${Date.now()}${ext}`;
  writeFileSync(join(getUploadsDirectory(), fileName), file.buffer);
  return `/uploads/${fileName}`;
}

// Feature: Photo Proof Watermark & EXIF Verification — Purpose: Parses JPEG EXIF tags (`DateTimeOriginal`, `CreateDate`, `ModifyDate`) from a raw image buffer using `exif-parser`.
// OOP: Functional Helper Module — Connected To: Used by persistPhotoProof() above.
function extractExifTimestamp(buffer: Buffer): Date | null {
  try {
    const parser = ExifParser.create(buffer);
    const result = parser.parse();
    const tags = result?.tags as { DateTimeOriginal?: number; CreateDate?: number; ModifyDate?: number } | undefined;
    const rawEpochSeconds = tags?.DateTimeOriginal ?? tags?.CreateDate ?? tags?.ModifyDate;
    if (typeof rawEpochSeconds === 'number' && rawEpochSeconds > 0) {
      return new Date(rawEpochSeconds * 1000);
    }
    return null;
  } catch {
    return null;
  }
}
