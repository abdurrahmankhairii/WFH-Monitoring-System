// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { ArgumentsHost, Catch, Logger, RpcExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import { QueryFailedError } from 'typeorm';
import { RpcErrorPayload, isRpcErrorPayload } from './standard-response';

// Feature: Microservice TCP Exception Normalization — Purpose: Global microservice exception filter.
// OOP: Polymorphic Exception Filter (implements RpcExceptionFilter) — Connected To: Registered in apps/employee-service/src/main.ts and apps/attendance-service/src/main.ts.
@Catch()
export class AllRpcExceptionsFilter implements RpcExceptionFilter<unknown> {
  private readonly logger = new Logger(AllRpcExceptionsFilter.name);

  // Feature: Microservice TCP Exception Normalization — Purpose: Converts the caught exception into an Observable error carrying an RpcErrorPayload.
  // OOP: Filter Handler Method (Polymorphic Handler) — Connected To: NestJS microservice exception pipeline.
  catch(exception: unknown, _host: ArgumentsHost): Observable<never> {
    if (exception instanceof RpcException) {
      const error = exception.getError();
      if (isRpcErrorPayload(error)) return throwError(() => error);
      return throwError(() => this.toPayload(500, 'Unexpected microservice error', String(error)));
    }

    if (exception instanceof QueryFailedError) {
      const driverError = exception.driverError as { code?: string; sqlMessage?: string; detail?: string } | undefined;
      const code = driverError?.code;
      if (code === 'ER_DUP_ENTRY' || code === '23505') {
        return throwError(() =>
          this.toPayload(409, 'Duplicate data detected', driverError?.sqlMessage ?? driverError?.detail ?? 'A unique field already exists in the database'),
        );
      }
      this.logger.error(`Database error: ${exception.message}`);
      return throwError(() => this.toPayload(500, 'Database operation failed', exception.message));
    }

    const message = exception instanceof Error ? exception.message : 'Unknown error';
    this.logger.error(`Unhandled microservice error: ${message}`, exception instanceof Error ? exception.stack : undefined);
    return throwError(() => this.toPayload(500, 'Unexpected microservice error', message));
  }

  // Feature: Microservice TCP Exception Normalization — Purpose: Builds a generic RpcErrorPayload for non-business failures.
  // OOP: Filter Handler Method (Polymorphic Handler) — Connected To: catch() above.
  private toPayload(statusCode: number, what: string, why: string): RpcErrorPayload {
    return { statusCode, where: 'Microservice - Internal', what, why };
  }
}
