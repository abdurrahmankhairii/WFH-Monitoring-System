# WFH Attendance & Employee Monitoring System — Dexa Group Fullstack Developer Skill Test

Enterprise-grade **Work From Home (WFH) Attendance & Employee Monitoring System** built with a **NestJS Microservices Monorepo**, **React 18 + Vite + TypeScript + Tailwind CSS**, and **MySQL 8.0** (configurable to PostgreSQL / MariaDB / SQL Server / Oracle via TypeORM).

Designed with a **Corporate Blue (`#1E40AF` / `#2563EB`) & Dexa Group Red (`#D32F2F`)** visual identity, featuring live webcam HTML5 Canvas timestamp watermarking, backend EXIF photo timestamp verification, authoritative server-side clock synchronization, master employee soft-delete CRUD, real-time SQL dashboard aggregations, self-service Leave/Sick/Correction workflows, payroll-ready Excel (`.xlsx`) & CSV export, dynamic-sender SMTP developer support, and a global bottom-right 3-part (`where`, `what`, `why`) toast notification system.

---

## 1. Fulfillment of Technical Assessment Objectives

| Assessment Requirement | Implementation in This Repository |
| :--- | :--- |
| **1.a Backend (TS + NestJS + MySQL)** | `backend/` — NestJS 11 TypeScript Monorepo with TypeORM & MySQL 8.0 (`users`, `employees`, `attendances`, `attendance_requests`, `access_requests`, `support_tickets`). |
| **1.b Frontend (React.js)** | `frontend/` — React 18 + Vite + TypeScript + Tailwind CSS. |
| **2.a.i Proper Database Structure** | 6 normalized 3NF relational tables with composite indexes (`UNIQUE(employee_id, attendance_date)`), soft-delete columns (`is_active`, `deleted_at`), and foreign keys. |
| **2.a.ii Connect to Any Database** | Dynamic `DatabaseConfigModule` (`backend/libs/common/src/database/database.module.ts`) supports switching between `mysql`, `postgres`, `mariadb`, `mssql`, and `oracle` via `DB_TYPE` in `.env`. |
| **2.a.iii API with Microservices Concept** | HTTP `api-gateway` (`:3000`) routing via NestJS TCP transport to `employee-service` (`:3001`) and `attendance-service` (`:3002`). |
| **2.a.iv Manipulate Data (CRUD) with API** | Full CRUD + Soft Delete (`DELETE /api/employees/:id`) + Restore (`PATCH /api/employees/:id/restore`) + Attendance Clock-In/Out + Request Approval. |
| **2.b.i Create Pages / Screens** | 10 interactive screens across Public Auth, Employee WFH Self-Service Portal, and HRD Admin Control Center. |
| **2.b.ii Call API from/to Backend** | Centralized Axios client (`frontend/src/api/client.ts`) with Bearer JWT injection, silent refresh token retry, and global error toast interceptors. |
| **2.b.iii Create Custom Components** | 10 custom React components (`CameraPhotoUpload`, `LiveServerClock`, `OtpInputGroup`, `InteractiveDataTable`, `PhotoLightboxModal`, `LeaveAndCorrectionModal`, `ContactDeveloperModal`, `ToastContainerBottomRight`, `DexaBrandLogo`, `CopyrightFooterWatermark`). |
| **3.1 Use Case 1: WFH Employee Attendance** | Login -> Synced Server Clock -> Live Webcam / File Upload with burned-in timestamp watermark -> Clock-In (`daily_plan`) & Clock-Out (`daily_accomplishment`). |
| **3.2 Use Case 2: HRD Employee Monitoring** | Master Employee CRUD (Add, Edit, Soft Delete, Restore, Resend OTP) + Real-Time Dashboard + View-Only Control of Submitted Attendance with Lightbox Proof Inspection & Excel/CSV Export. |

---

## 2. 9+1 Core System Modules

1. **RBAC & JWT Auth + Targeted 6-Digit Email OTP:**
   - Strict separation between `HR_ADMIN` (full control over all portals) and `EMPLOYEE` (self-service attendance, history, leave/correction requests, profile, support).
   - Daily login uses **Email + Password -> JWT**.
   - **6-Digit Email OTP** is used strictly for **New Account Verification** (`/verify-account`) and **Forgot Password** (`/forgot-password`).
2. **Live Camera Capture & Photo Proof Timestamp Verification:**
   - HTML5 `<canvas>` burns a visual watermark bar (`Timestamp WIB + NIP + Full Name + Capture Source + Copyright`) onto every Clock-In and Clock-Out photo.
   - Backend inspects EXIF metadata (`exif-parser`) and compares `photoCapturedAt` against the server clock (`isTimestampVerified`).
3. **Server-Side Real-Time Timestamp & Timezone Synchronization:**
   - `clock_in_time` and `clock_out_time` are strictly generated on the backend (`new Date()`) to prevent client clock spoofing.
4. **Master Employee Management (CRUD & Soft Delete):**
   - Full CRUD for HRD Admin using soft delete (`is_active = false`, `status = 'INACTIVE'`, `deleted_at = NOW()`) so historical attendance foreign keys are never broken.
5. **HRD Real-Time Monitoring Dashboard & Audit Log:**
   - Live SQL aggregations (`COUNT`, `GROUP BY` department, 7-day trend), multi-criteria filters, and `<PhotoLightboxModal />` inspection.
6. **Daily Work Log / Task Summary:**
   - Captures `daily_plan` on Clock-In and mandatory `daily_accomplishment` (min 10 characters) on Clock-Out.
7. **Automated Working Hours & Status Calculation:**
   - Automatically tags `ON_TIME`, `LATE`, `HALF_DAY`, `MISSING_CLOCK_OUT`, `COMPLETED` and computes `work_duration_minutes`.
8. **Leave, Sick & Attendance Correction Request:**
   - Employee self-service submission with supporting attachment + HRD `Approve`/`Reject` workflow that automatically syncs `attendances`.
9. **Data Export & Payroll-Ready Reporting:**
   - One-click export of filtered attendance logs to **Excel (`.xlsx`)**, **CSV (`.csv`)**, and **Printable PDF View**.
10. **Contact Developer via SMTP (Dynamic User Sender):**
    - Dispatches support emails via Nodemailer where **`from`, `sender`, and `replyTo` strictly use the logged-in user's account email (`"${user.fullName}" <${user.email}>`)**.

---

## 3. Pre-Seeded Demo Accounts (Auto-Seeded on Startup)

| Role | Email | Password | NIP / Code | Scenario Ready to Test |
| :--- | :--- | :--- | :--- | :--- |
| **`HR_ADMIN`** | `admin.hrd@dexagroup.com` | `AdminDexa2026!` | `DEXA-2026-001` | Full access to HRD Dashboard, Attendance Audit & Export, Master Employee CRUD, and Employee Self-Service. |
| **`EMPLOYEE`** | `budi.santoso@dexagroup.com` | `EmployeeDexa2026!` | `DEXA-2026-002` | Ready to **Clock-In** today with live webcam or file upload. |
| **`EMPLOYEE`** | `siti.rahmawati@dexagroup.com` | `EmployeeDexa2026!` | `DEXA-2026-003` | Already Clocked-In today — ready to **Clock-Out** with mandatory daily accomplishment. |
| **`EMPLOYEE`** | `andi.pratama@dexagroup.com` | `EmployeeDexa2026!` | `DEXA-2026-004` | Includes historical logs + an unverified file-upload sample for HRD Lightbox inspection. |
| **`EMPLOYEE` (Unverified)** | `nadia.putri@dexagroup.com` | *(Set on `/verify-account`)* | `DEXA-2026-005` | Pre-seeded with 6-digit OTP **`123456`** to test **New Account Verification** immediately. |

---

## 4. Quick Start Guide

### Option A: Run Entire Stack with Docker Compose (Recommended)

```bash
# 1. Copy environment template (optional — docker-compose.yml includes working defaults)
cp .env.example .env

# 2. Build and start MySQL 8.0, Mailpit SMTP, 3 NestJS Microservices, and React Frontend
docker compose up --build -d
```

Once running, open:
- **React Web Application:** [http://localhost:5173](http://localhost:5173)
- **API Gateway & Swagger OpenAPI Docs:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **Mailpit SMTP Web Inbox (View OTP & Contact Developer Emails):** [http://localhost:8025](http://localhost:8025)

### Option B: Run Microservices & Frontend Locally

1. **Start MySQL 8.0 & Mailpit (via Docker or local installation):**
   ```bash
   docker compose up -d mysql mailpit
   ```
2. **Install & start the 3 NestJS Microservices (`backend/`):**
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npm run build

   # Start all 3 microservices (or run in separate terminals: start:employee, start:attendance, start:gateway)
   npm run start:all
   ```
3. **Install & start the React Frontend (`frontend/`):**
   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run dev
   ```

---

## 5. Architecture & Documentation Links
- **Product Requirements Document (PRD):** [documentation/PRD.md](./documentation/PRD.md)
- **System Architecture Diagram (Mermaid):** [documentation/system-architecture.md](./documentation/system-architecture.md)
- **Authentication, RBAC & SMTP Flow (Mermaid):** [documentation/authentication-flow.md](./documentation/authentication-flow.md)
- **WFH Attendance, Leave & Export Flow (Mermaid):** [documentation/attendance-flow.md](./documentation/attendance-flow.md)
- **Agentic Rules & Skills:** [AGENTS.md](./AGENTS.md) & [`skill/`](./skill/)

---

## 6. License & Copyright Notice (All Rights Reserved)

This repository and all associated source code, UI components, microservices architecture, and documentation are proprietary and protected under **All Rights Reserved** ([LICENSE](./LICENSE)). It is **NOT** licensed under MIT or any open-source license.

> **© 2026 Abdurrahman Khairi - Created strictly for Technical Assessment evaluation. Unauthorized commercial use is prohibited**
