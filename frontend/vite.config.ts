// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Feature: Objective 2.b.i & 2.b.ii . — Purpose: Vite bundler & dev server configuration with `/api` and `/uploads` proxy to the NestJS API Gateway (:3000).
// OOP: Functional Helper Module — Connected To: frontend/src/* -> backend/apps/api-gateway (:3000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
