# System Architecture Diagram — WFH Attendance & Employee Monitoring System

Architecture diagram using **NestJS Monorepo Microservices (TCP Transport)**, **React.js (Vite + Tailwind CSS)**, **MySQL 8.0**, **Photo Storage with Timestamp Verification**, and **SMTP Mailer**.

```mermaid
flowchart LR
    subgraph Client["Frontend Web (React.js + TypeScript + Tailwind CSS)"]
        direction TB
        UI_Auth["Auth Pages\n(JWT Login, New Account OTP,\nForgot Password OTP, Request Access)"]
        UI_Emp["Employee Portal (EMPLOYEE)\n(Live Webcam Timestamp Watermark Clock-In/Out,\nDaily Plan & Accomplishment, Leave/Correction Request)"]
        UI_Admin["HRD Admin Portal (HR_ADMIN)\n(Full Control: Master Employee CRUD & Soft Delete,\nReal-Time Monitoring, Leave Approval, Excel/CSV/PDF Export)"]
        UI_Support["Contact Developer Modal\n(SMTP Support Ticket)"]
        UI_Toast["Bottom-Right Toast Notification\nGreen (Success) | Red (Error) | Blue (Info)\nFull Detail: Where, What, Why"]
    end

    subgraph Gateway["API Gateway Layer (NestJS HTTP :3000)"]
        GW["API Gateway\n- JWT Auth Guard & RolesGuard (RBAC)\n- Global Response & Exception Formatter\n- Multer Photo Upload & EXIF Timestamp Inspector\n- ExcelJS / CSV Stream Exporter\n- Swagger OpenAPI (/api/docs)"]
    end

    subgraph Microservices["NestJS Internal Microservices (TCP Transport)"]
        MS_Emp["Employee & Auth Service (TCP :3001)\n- Bcrypt + JWT Token Issuance\n- 6-Digit OTP (Account Verification & Forgot Password)\n- Master Employee CRUD & Soft Delete\n- Access Request Approval\n- Contact Developer (SMTP Sender = User Email)"]
        MS_Att["Attendance Service (TCP :3002)\n- Server-Side Timestamp Clock-In & Clock-Out\n- Photo Timestamp & Anti-Spoofing Verification\n- Automated Status (ON_TIME, LATE, HALF_DAY, COMPLETED)\n- Daily Work Plan & Accomplishment Log\n- Leave, Sick & Attendance Correction Workflow\n- HRD Dashboard Aggregation & Audit Log"]
    end

    subgraph Infrastructure["Database, Storage & Messaging Infrastructure"]
        DB[("MySQL 8.0 Database\n(users, employees, attendances,\nattendance_requests, otp_codes,\naccess_requests, support_tickets)")]
        Storage[("Photo Storage\n(Watermarked WFH Proofs &\nLeave Attachments)")]
        SMTP["SMTP Server (Nodemailer)\n(Mailpit Local :8025 / Gmail / Resend)"]
    end

    UI_Auth -->|REST API| GW
    UI_Emp -->|REST API + Bearer JWT| GW
    UI_Admin -->|REST API + Bearer JWT| GW
    UI_Support -->|POST /api/support/contact| GW
    GW -.->|Standardized JSON\n{success, type, where, what, why, data}| UI_Toast

    GW -->|TCP MessagePattern| MS_Emp
    GW -->|TCP MessagePattern| MS_Att
    GW -->|Store Watermarked Photo| Storage

    MS_Emp -->|TypeORM| DB
    MS_Att -->|TypeORM| DB
    MS_Emp -->|Send OTP & Support Email\n(From: user.email)| SMTP
```
