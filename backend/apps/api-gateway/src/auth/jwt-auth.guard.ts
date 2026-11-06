// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ActorContext, JwtPayload } from '@app/common';

// Feature: JWT Authentication Guard — Purpose: Verifies the Bearer JWT access token on incoming HTTP requests and populates `req.user` with an ActorContext.
// OOP: Security Guard (implements CanActivate Strategy) — Connected To: Applied to protected endpoints across api-gateway controllers; tokens are issued by employee-service.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Feature: JWT Authentication Guard — Purpose: Extracts and validates the Authorization Bearer token.
  // OOP: Context Provider Pattern (State Abstraction & Dependency Injection) — Connected To: NestJS request pipeline.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: ActorContext }>();
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpException(
        {
          statusCode: 401,
          where: 'Auth Guard - JWT Verification',
          what: 'Authentication token missing',
          why: 'Please sign in first to obtain a valid Bearer JWT access token.',
        },
        401,
      );
    }

    const token = authHeader.slice(7).trim();
    try {
      const secret = this.config.get<string>('JWT_SECRET', 'dexa-wfh-secret-2026');
      const decoded = await this.jwtService.verifyAsync<JwtPayload>(token, { secret });
      if (decoded.tokenType !== 'access') {
        throw new Error('Invalid token type');
      }

      req.user = {
        userId: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        employeeId: decoded.employeeId,
        fullName: decoded.fullName,
      };
      return true;
    } catch {
      throw new HttpException(
        {
          statusCode: 401,
          where: 'Auth Guard - JWT Verification',
          what: 'Invalid or expired session token',
          why: 'Your JWT access token has expired or is invalid. Please refresh your session or sign in again.',
        },
        401,
      );
    }
  }
}
