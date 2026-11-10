// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { HttpException } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join, resolve } from 'path';
import * as ExifParser from 'exif-parser';
import { ActorContext, PhotoCaptureSource, PhotoProofPayload, UserRole } from '@app/common';

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

// Feature: Photo Proof Watermark & EXIF Verification — Purpose: Ensures the root `uploads/` directory exists for file persistence.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Used by all file persistence operations in api-gateway.
export function getUploadsDirectory(): string {
  const dir = resolve(process.cwd(), 'uploads');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Feature: Hierarchical Storage Organization — Purpose: Converts arbitrary text into a clean filesystem- and URL-safe slug.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Used to format department and employee folder names.
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'general'
  );
}

// Feature: Hierarchical Storage Organization — Purpose: Determines whether an actor belongs to the `manager` or `employee` directory tier.
// OOP: Domain Policy Helper (Role Resolver) — Connected To: Maps UserRole enum to the directory tier specified in project rules.
export function resolveRoleFolder(role?: string): 'manager' | 'employee' {
  if (!role) return 'employee';
  const upper = role.toUpperCase();
  if (upper === UserRole.MANAGER || upper === UserRole.HR_ADMIN || upper === UserRole.SYSTEM_ADMIN) {
    return 'manager';
  }
  return 'employee';
}

// Feature: Hierarchical Storage Organization — Purpose: Builds and ensures the nested directory structure: tahun -> department -> employee/manager -> nama orang -> bulan.
// OOP: Factory Method Pattern (Path & Directory Generator) — Connected To: Called by persistPhotoProof(), persistAttachmentFile(), and persistAvatarFile().
export function buildOrganizedDirectory(params: {
  date: Date;
  department?: string;
  role?: string;
  fullName?: string;
}): { fullDirPath: string; relativeUrlPath: string; personSlug: string } {
  const year = String(params.date.getFullYear());
  const monthNumber = String(params.date.getMonth() + 1).padStart(2, '0');
  const monthName = params.date.toLocaleString('en-US', { month: 'long' }).toLowerCase();
  const monthFolder = `${monthNumber}-${monthName}`;

  const deptSlug = slugify(params.department || 'it-digital-innovation');
  const roleFolder = resolveRoleFolder(params.role);
  const personSlug = slugify(params.fullName || 'employee');

  // Relative path on disk (using path.join for OS compatibility)
  const relativeSubpath = join(year, deptSlug, roleFolder, personSlug, monthFolder);
  const fullDirPath = join(getUploadsDirectory(), relativeSubpath);

  if (!existsSync(fullDirPath)) {
    mkdirSync(fullDirPath, { recursive: true });
  }

  // URL uses forward slashes on all platforms (Windows / Linux)
  const relativeUrlPath = `/uploads/${year}/${deptSlug}/${roleFolder}/${personSlug}/${monthFolder}`;

  return { fullDirPath, relativeUrlPath, personSlug };
}

// Feature: Hierarchical Storage Organization — Purpose: Formats the file name to match the person name and readable timestamp (YYYY-MM-DD_HH-mm-ss).
// OOP: Formatter Function (Stateless String Generator) — Connected To: Used by all file persistence methods.
export function buildOrganizedFilename(params: {
  prefix: string;
  personSlug: string;
  date: Date;
  ext: string;
  targetDir: string;
}): string {
  const yyyy = params.date.getFullYear();
  const mm = String(params.date.getMonth() + 1).padStart(2, '0');
  const dd = String(params.date.getDate()).padStart(2, '0');
  const hh = String(params.date.getHours()).padStart(2, '0');
  const min = String(params.date.getMinutes()).padStart(2, '0');
  const ss = String(params.date.getSeconds()).padStart(2, '0');

  const dateStr = `${yyyy}-${mm}-${dd}`;
  const timeStr = `${hh}-${min}-${ss}`;
  let baseFilename = `${params.prefix}_${params.personSlug}_${dateStr}_${timeStr}${params.ext}`;

  // Collision prevention: If exact same second file exists, append unique suffix
  if (existsSync(join(params.targetDir, baseFilename))) {
    const salt = Math.floor(Math.random() * 900 + 100);
    baseFilename = `${params.prefix}_${params.personSlug}_${dateStr}_${timeStr}_${salt}${params.ext}`;
  }

  return baseFilename;
}

// Feature: Photo Proof Watermark & EXIF Verification — Purpose: Inspects an image buffer for EXIF metadata and stores it in the hierarchical directory.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Called by AttendanceController on Clock-In and Clock-Out.
export function persistPhotoProof(params: {
  file: Express.Multer.File | undefined;
  captureSource: PhotoCaptureSource;
  clientCapturedAt?: string;
  prefix: 'clock-in' | 'clock-out';
  actor?: ActorContext;
  employeeCodeOrId?: string;
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
  let fileDate = new Date();

  if (exifDate) {
    resolvedCapturedAt = exifDate.toISOString();
    hasExifTimestamp = true;
    fileDate = exifDate;
  } else if (params.clientCapturedAt) {
    const parsed = new Date(params.clientCapturedAt);
    if (!Number.isNaN(parsed.getTime())) {
      resolvedCapturedAt = parsed.toISOString();
      hasExifTimestamp = params.captureSource === PhotoCaptureSource.LIVE_WEBCAM || true;
      fileDate = parsed;
    }
  } else {
    resolvedCapturedAt = fileDate.toISOString();
  }

  const { fullDirPath, relativeUrlPath, personSlug } = buildOrganizedDirectory({
    date: fileDate,
    department: params.actor?.department,
    role: params.actor?.role,
    fullName: params.actor?.fullName,
  });

  const ext = extname(file.originalname || '.jpg') || '.jpg';
  const fileName = buildOrganizedFilename({
    prefix: params.prefix,
    personSlug,
    date: fileDate,
    ext,
    targetDir: fullDirPath,
  });

  const fullFilePath = join(fullDirPath, fileName);
  writeFileSync(fullFilePath, file.buffer);

  return {
    photoUrl: `${relativeUrlPath}/${fileName}`,
    captureSource: params.captureSource,
    photoCapturedAt: resolvedCapturedAt,
    hasExifTimestamp,
  };
}

// Feature: Photo Proof Watermark & EXIF Verification — Purpose: Saves a supporting attachment (document/image) into the organized directory structure.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Called by AttendanceController createRequest().
export function persistAttachmentFile(
  file: Express.Multer.File | undefined,
  actor?: ActorContext,
  _legacyEmployeeId?: string,
): string | null {
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

  const fileDate = new Date();
  const { fullDirPath, relativeUrlPath, personSlug } = buildOrganizedDirectory({
    date: fileDate,
    department: actor?.department,
    role: actor?.role,
    fullName: actor?.fullName,
  });

  const ext = extname(file.originalname || '.jpg') || '.jpg';
  const fileName = buildOrganizedFilename({
    prefix: 'request',
    personSlug,
    date: fileDate,
    ext,
    targetDir: fullDirPath,
  });

  writeFileSync(join(fullDirPath, fileName), file.buffer);
  return `${relativeUrlPath}/${fileName}`;
}

// Feature: Biometric Face Enrollment — Purpose: Saves an enrolled face avatar into the organized directory structure.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Called by EmployeesController enrollFace().
export function persistAvatarFile(file: Express.Multer.File | undefined, actor?: ActorContext): string {
  if (!file || !file.buffer) {
    throw new HttpException(
      {
        statusCode: 400,
        where: 'Biometric - Avatar Upload',
        what: 'Avatar photo proof is required',
        why: 'Please capture a clear webcam photo for biometric enrollment.',
      },
      400,
    );
  }

  const fileDate = new Date();
  const { fullDirPath, relativeUrlPath, personSlug } = buildOrganizedDirectory({
    date: fileDate,
    department: actor?.department,
    role: actor?.role,
    fullName: actor?.fullName,
  });

  const ext = extname(file.originalname || '.jpg') || '.jpg';
  const fileName = buildOrganizedFilename({
    prefix: 'avatar',
    personSlug,
    date: fileDate,
    ext,
    targetDir: fullDirPath,
  });

  writeFileSync(join(fullDirPath, fileName), file.buffer);
  return `${relativeUrlPath}/${fileName}`;
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
