// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { config } from 'dotenv';
import { resolve } from 'path';

// Feature: Monorepo Environment Configuration — Purpose: Loads environment variables from backend/.env (or the monorepo root.env) BEFORE any entity/module is evaluated, so.
// OOP: Functional Helper Module — Connected To: Imported as the very first line of every apps/*/src/main.ts entry file.
function loadEnvironment(): void {
  const candidates = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')];
  for (const path of candidates) {
    config({ path, override: false });
  }
}

loadEnvironment();
