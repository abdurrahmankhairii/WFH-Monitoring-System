# System Architecture Diagram — WFH Attendance & Employee Monitoring System

Architecture diagram using **NestJS Monorepo Microservices (TCP Transport)**, **React.js (Vite + Tailwind CSS)**, **MySQL 8.0**, **Photo Storage with Timestamp Verification**, and **SMTP Mailer**.

```mermaid
flowchart LR
    subgraph Client["Frontend Web (React.js + TypeScript + Tailwind CSS)"]
        direction TB
        UI_Auth["Auth Pages\n(JWT Login, New Account OTP,\nForgot Password OTP, Request Access)"]
        UI_Emp["Employee Workspace (EMPLOYEE)\n(Individual Dashboard with 14-Day SVG Chart & KPIs,\nLive Webcam Timestamp Watermark Clock-In/Out,\nDaily Plan & Accomplishment, Leave/Correction)"]
        UI_Admin["System & HR Control (SYSTEM_ADMIN & HR_ADMIN)\n(Supreme Control: Master Employee CRUD & Soft Delete,\nReal-Time Monitoring, Leave Approval, Excel/CSV/PDF Export)"]
        UI_Support["Contact Developer Modal\n(Targeted SMTP: TO System Admin, CC HR Admin + Sender)"]
        UI_Notify["Headbar Notification Center & Bottom-Right Toasts\n(Bracket-Free: Where • What • Why\nGreen Success | Red Error | Blue Info)"]
        UI_Theme["Theme & Layout System\n(Collapsible Window Sidebar, Dexa Red/White Logos,\nDark/Light Mode Toggle, Live Server Clock)"]
    end

    subgraph Gateway["API Gateway Layer (NestJS HTTP :3000)"]
        GW["API Gateway\n- JWT Auth Guard & RolesGuard (SYSTEM_ADMIN, HR_ADMIN, EMPLOYEE)\n- Global Response & Exception Formatter (Bracket-Free)\n- Multer Photo Upload & EXIF Timestamp Inspector\n- ExcelJS / CSV Stream Exporter\n- Swagger OpenAPI (/api/docs)"]
    end

    subgraph Microservices["NestJS Internal Microservices (TCP Transport)"]
        MS_Emp["Employee & Auth Service (TCP :3001)\n- Bcrypt + JWT Token Issuance\n- 6-Digit OTP (Account Verification & Forgot Password)\n- Master Employee CRUD & Soft Delete (Mandatory NIP)\n- Access Request Approval\n- Targeted Support Routing (TO: SysAdmin, CC: HRD+Sender)"]
        MS_Att["Attendance Service (TCP :3002)\n- Server-Side Timestamp Clock-In & Clock-Out\n- Photo Timestamp & Anti-Spoofing Verification\n- Personal Dashboard Aggregation (14-Day Trend & KPIs)\n- Automated Status (ON_TIME, LATE, HALF_DAY, COMPLETED)\n- Daily Work Plan & Accomplishment Log\n- Leave, Sick & Attendance Correction Workflow\n- HRD Dashboard Aggregation & Audit Log"]
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
