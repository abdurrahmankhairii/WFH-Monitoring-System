// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ActorContext, UserRole } from '@app/common';
import { ROLES_KEY } from './decorators';

// Feature: Role-Based Access Control (RBAC) Guard — Purpose: Enforces Role-Based Access Control (RBAC).
// OOP: Security Guard (implements CanActivate Strategy) — Connected To: Used alongside JwtAuthGuard on api-gateway controllers via @Roles(UserRole.HR_ADMIN).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  // Feature: Role-Based Access Control (RBAC) Guard — Purpose: Checks whether `req.user.role` satisfies the `@Roles()` metadata (HR_ADMIN is always permitted).
  // OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: NestJS guard pipeline.
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: ActorContext; method: string; originalUrl: string }>();
    const user = req.user;

    if (!user) {
      throw new HttpException(
        {
          statusCode: 401,
          where: 'RBAC Guard - Authorization',
          what: 'Unauthenticated request',
          why: 'User identity is missing from the request context.',
        },
        401,
      );
    }

    // SYSTEM_ADMIN and HR_ADMIN have elevated management permissions across the platform
    if (user.role === UserRole.SYSTEM_ADMIN || user.role === UserRole.HR_ADMIN || requiredRoles.includes(user.role)) {
      return true;
    }

    throw new HttpException(
      {
        statusCode: 403,
        where: `RBAC Guard [${req.method} ${req.originalUrl}]`,
        what: 'Access restricted to HRD Administrator',
        why: `Your current role (${user.role}) does not have permission to access this resource. Required role: ${requiredRoles.join(' or ')}.`,
      },
      403,
    );
  }
}
