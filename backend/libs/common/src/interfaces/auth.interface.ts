// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { UserRole } from '../constants/enums';

// Feature: Core System Architecture — Purpose: Shape of the signed JWT payload shared by the issuer (employee-service) and verifier (api-gateway guards).
// OOP: Structural Contract (Interface Definition) — Connected To: employee-service auth.service.ts (sign) -> api-gateway auth/jwt-auth.guard.ts (verify) -> @CurrentUser().
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  employeeId: string | null;
  fullName: string;
  tokenType: 'access' | 'refresh';
}

// Feature: and audit fields in Feature #4/#8 — Purpose: Minimal authenticated actor context forwarded from the gateway to microservices for authorization & auditing.
// OOP: Structural Contract (Interface Definition) — Connected To: Every gateway controller that forwards { actor } in TCP payloads; consumed by service methods.
export interface ActorContext {
  userId: string;
  email: string;
  role: UserRole;
  employeeId: string | null;
  fullName: string;
}
