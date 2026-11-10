// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';

export interface FaceExtractResult {
  status: 'SUCCESS' | 'NO_FACE' | 'MULTIPLE_FACES' | 'ERROR';
  face_detected: boolean;
  face_count: number;
  embedding?: number[];
  bbox?: [number, number, number, number];
  det_score?: number;
  image_hash?: string;
  image_phash?: string;
  message: string;
}

export interface FaceVerifyResult {
  status: 'SUCCESS' | 'NO_FACE' | 'MULTIPLE_FACES' | 'BIOMETRIC_MISMATCH' | 'ERROR';
  face_detected: boolean;
  face_count: number;
  is_match: boolean;
  similarity: number;
  threshold: number;
  bbox?: [number, number, number, number];
  det_score?: number;
  image_hash?: string;
  image_phash?: string;
  message: string;
}

// Feature: InsightFace Biometric Client Bridge — Purpose: Communicates via HTTP with the Python FastAPI Biometric microservice on port :8000.
// OOP: Encapsulated Gateway Client Adapter (Dependency Injection) — Connected To: EmployeesController and AttendanceController.
@Injectable()
export class BiometricClientService {
  private readonly logger = new Logger(BiometricClientService.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.BIOMETRIC_SERVICE_URL || 'http://127.0.0.1:8000';
    this.logger.log(`Initialized BiometricClientService with target URL: ${this.baseUrl}`);
  }

  // Feature: Biometric Feature Extraction — Purpose: Sends employee face photo to FastAPI to extract normalized 512-dim ArcFace embedding.
  // OOP: Client Adapter Method — Connected To: POST /api/employees/me/enroll-face.
  async extractEmbedding(buffer: Buffer, originalname: string = 'face.jpg'): Promise<FaceExtractResult> {
    try {
      const form = new FormData();
      form.append('file', buffer, { filename: originalname, contentType: 'image/jpeg' });

      const response = await axios.post<FaceExtractResult>(`${this.baseUrl}/extract-embedding`, form, {
        headers: form.getHeaders(),
        timeout: 30000,
      });

      return response.data;
    } catch (error: any) {
      this.logger.error(`Biometric extraction failed: ${error?.message}`, error?.stack);
      return {
        status: 'ERROR',
        face_detected: false,
        face_count: 0,
        message: error?.response?.data?.detail || error?.message || 'Biometric microservice unavailable.',
      };
    }
  }

  // Feature: 1:1 Face Verification — Purpose: Compares clock-in/out photo with registered employee embedding vector.
  // OOP: Client Adapter Method — Connected To: POST /api/attendances/clock-in and clock-out.
  async verifyFace(buffer: Buffer, referenceEmbedding: number[], threshold: number = 0.45): Promise<FaceVerifyResult> {
    try {
      const form = new FormData();
      form.append('file', buffer, { filename: 'verify.jpg', contentType: 'image/jpeg' });
      form.append('reference_embedding', JSON.stringify(referenceEmbedding));
      form.append('threshold', String(threshold));

      const response = await axios.post<FaceVerifyResult>(`${this.baseUrl}/verify-face`, form, {
        headers: form.getHeaders(),
        timeout: 30000,
      });

      return response.data;
    } catch (error: any) {
      this.logger.error(`Biometric verification failed: ${error?.message}`, error?.stack);
      return {
        status: 'ERROR',
        face_detected: false,
        face_count: 0,
        is_match: false,
        similarity: 0,
        threshold,
        message: error?.response?.data?.detail || error?.message || 'Biometric microservice unavailable.',
      };
    }
  }
}
