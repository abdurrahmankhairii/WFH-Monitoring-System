// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { RpcException } from '@nestjs/microservices';

export type ToastType = 'success' | 'error' | 'info';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Feature: Standardized API Response & Exception Contract — Purpose: Unified envelope returned by every API Gateway endpoint so frontend renders consistent notification toasts.
// OOP: Structural Contract (Interface Definition) — Connected To: Built in microservices and gateway exception filter; consumed by frontend client.ts.
export interface StandardApiResponse<T = unknown> {
  success: boolean;
  type: ToastType;
  where: string;
  what: string;
  why: string;
  data?: T;
  meta?: PaginationMeta;
  timestamp: string;
}

// Feature: Standardized API Response & Exception Contract — Purpose: Error payload transported over TCP via RpcException and converted to an HttpException by the gateway.
// OOP: Structural Contract (Interface Definition) — Connected To: throwRpcError() in microservices -> backend/apps/api-gateway/src/common/rpc.util.ts (sendRpc).
export interface RpcErrorPayload {
  statusCode: number;
  where: string;
  what: string;
  why: string;
}

interface BuildResponseParams<T> {
  type?: ToastType;
  where: string;
  what: string;
  why: string;
  data?: T;
  meta?: PaginationMeta;
}

// Feature: Standardized API Response & Exception Contract — Purpose: Normalizes notification strings so no square brackets (`[...]`) appear in API responses or UI toasts.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Used by buildResponse(), throwRpcError(), and AllHttpExceptionsFilter.
export function cleanNotificationText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/^\[(.*?)\]$/, '$1')
    .replace(/\s*\[(.*?)\]/g, ' • $1')
    .replace(/[\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Feature: Standardized API Response & Exception Contract — Purpose: Creates a successful/informational StandardApiResponse with an ISO timestamp.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Every microservice service method (employee-service & attendance-service) returning data to the gateway.
export function buildResponse<T>(params: BuildResponseParams<T>): StandardApiResponse<T> {
  return {
    success: true,
    type: params.type ?? 'success',
    where: cleanNotificationText(params.where),
    what: cleanNotificationText(params.what),
    why: cleanNotificationText(params.why),
    data: params.data,
    meta: params.meta,
    timestamp: new Date().toISOString(),
  };
}

// Feature: Standardized API Response & Exception Contract — Purpose: Throws a typed RpcException that carries HTTP status + WHERE/WHAT/WHY across the TCP boundary.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: All microservice business validations; unwrapped by backend/apps/api-gateway/src/common/rpc.util.ts.
export function throwRpcError(statusCode: number, where: string, what: string, why: string): never {
  const payload: RpcErrorPayload = {
    statusCode,
    where: cleanNotificationText(where),
    what: cleanNotificationText(what),
    why: cleanNotificationText(why),
  };
  throw new RpcException(payload);
}

// Feature: Standardized API Response & Exception Contract — Purpose: Type guard that recognises an RpcErrorPayload received from a microservice.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: backend/apps/api-gateway/src/common/rpc.util.ts and all-exceptions.filter.ts.
export function isRpcErrorPayload(value: unknown): value is RpcErrorPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.statusCode === 'number' && typeof candidate.what === 'string' && typeof candidate.why === 'string';
}

// Feature: Standardized API Response & Exception Contract — Purpose: Normalises page/limit query values and computes pagination metadata.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Paginated list methods in employees.service.ts and attendance.service.ts.
export function resolvePagination(page?: number | string, limit?: number | string): { page: number; limit: number; skip: number } {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

// Feature: Standardized API Response & Exception Contract — Purpose: Builds the PaginationMeta block from the total row count.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Same paginated list methods as resolvePagination().
export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
