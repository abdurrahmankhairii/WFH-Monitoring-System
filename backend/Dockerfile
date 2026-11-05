# ============================================================================
# Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
# Created strictly for Technical Assessment evaluation.
# Unauthorized commercial use, modification, or distribution is prohibited.
# ============================================================================
# Multi-stage Dockerfile for NestJS Microservices Monorepo
# Builds `employee-service` (:3001), `attendance-service` (:3002), and `api-gateway` (:3000)

FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads

EXPOSE 3000 3001 3002
CMD ["node", "dist/apps/api-gateway/main.js"]
