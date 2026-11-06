// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { StandardApiResponse, cleanNotificationText, isRpcErrorPayload } from '@app/common';

// Feature: Global HTTP Exception Handling — Purpose: Catches unhandled HTTP exceptions and formats structured StandardApiResponse.
// OOP: Polymorphic Exception Filter (implements ExceptionFilter) — Connected To: Registered globally in api-gateway main.ts; consumed by frontend client.ts.
@Catch()
export class AllHttpExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllHttpExceptionsFilter.name);

  // Feature: Global HTTP Exception Handling — Purpose: Formats any caught exception into the standardized JSON error envelope.
  // OOP: Filter Handler Method (Polymorphic Handler) — Connected To: Express HTTP response pipeline in api-gateway.
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let where = `API Gateway [${req.method} ${req.originalUrl}]`;
    let what = 'Request failed';
    let why = 'An unexpected server error occurred while processing your request.';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();

      if (isRpcErrorPayload(body)) {
        where = body.where;
        what = body.what;
        why = body.why;
      } else if (typeof body === 'object' && body !== null) {
        const record = body as Record<string, unknown>;
        if (typeof record.where === 'string') where = record.where;
        if (typeof record.what === 'string') what = record.what;
        if (typeof record.why === 'string') {
          why = record.why;
        } else if (Array.isArray(record.message)) {
          what = 'Input validation failed';
          why = record.message.join('; ');
        } else if (typeof record.message === 'string') {
          why = record.message;
        }
      } else if (typeof body === 'string') {
        why = body;
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled HTTP exception: ${exception.message}`, exception.stack);
      why = exception.message;
    }

    const payload: StandardApiResponse = {
      success: false,
      type: 'error',
      where: cleanNotificationText(where),
      what: cleanNotificationText(what),
      why: cleanNotificationText(why),
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(payload);
  }
}
