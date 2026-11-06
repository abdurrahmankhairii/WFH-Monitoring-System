// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import { ActorContext, UserRole } from '@app/common';

export const ROLES_KEY = 'rbac_roles';

// Feature: Authentication Context & RBAC Decorators — Purpose: Method/controller decorator specifying which UserRole(s) are allowed to invoke an endpoint.
// OOP: Stateless Utility Function (Functional Helper) — Connected To: Read by RolesGuard in backend/apps/api-gateway/src/auth/roles.guard.ts.
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// Feature: Authentication Context & RBAC Decorators — Purpose: Parameter decorator extracting the authenticated ActorContext attached by JwtAuthGuard onto `req.user`.
// OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: Used across all protected gateway controllers.
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): ActorContext => {
  const request = ctx.switchToHttp().getRequest<{ user: ActorContext }>();
  return request.user;
});
