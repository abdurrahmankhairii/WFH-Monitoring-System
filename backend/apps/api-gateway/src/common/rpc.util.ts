// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { HttpException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { isRpcErrorPayload } from '@app/common';

// Feature: TCP Microservice RPC Communication — Purpose: Sends a TCP command to a target NestJS microservice and unwraps any RpcErrorPayload into an HttpException so the gateway's.
// OOP: Functional Helper Module — Connected To: Used by every controller in backend/apps/api-gateway/src/**/*.controller.ts.
export async function sendRpc<T = unknown>(
  client: ClientProxy,
  pattern: { cmd: string },
  payload: unknown = {},
): Promise<T> {
  try {
    return await firstValueFrom(client.send<T>(pattern, payload).pipe(timeout(15000)));
  } catch (error: unknown) {
    if (isRpcErrorPayload(error)) {
      throw new HttpException(error, error.statusCode);
    }
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const inner = (error as { error: unknown }).error;
      if (isRpcErrorPayload(inner)) {
        throw new HttpException(inner, inner.statusCode);
      }
    }
    const message = error instanceof Error ? error.message : 'Microservice communication failure';
    throw new HttpException(
      {
        statusCode: 502,
        where: `API Gateway -> ${pattern.cmd}`,
        what: 'Microservice communication failed',
        why: message,
      },
      502,
    );
  }
}
