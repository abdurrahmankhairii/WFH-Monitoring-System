# UML Use Case Diagrams & Actor Interaction Specifications
## WFH Attendance & Employee Monitoring System — Dexa Group Fullstack Technical Assessment
**Author:** Abdurrahman Khairi | **License:** Proprietary — All Rights Reserved ([LICENSE](../../LICENSE))  
**Copyright:** © 2026 Abdurrahman Khairi. Unauthorized commercial use, modification, or distribution is prohibited.

---

## 1. Actor Hierarchy & Role Definitions

The system defines **4 distinct actors** with clear separation of duties and administrative boundaries:

```mermaid
flowchart TD
    subgraph Actors["System Actors & Role Hierarchy"]
        EmployeeActor["👤 EMPLOYEE (Staff Member)"]
        ManagerActor["👔 MANAGER (Department Lead)"]
        HrAdminActor["📋 HR_ADMIN (HR & People Operations)"]
        SysAdminActor["👑 SYSTEM_ADMIN (System Administrator)"]

        EmployeeActor -->|"Escalates Requests To"| ManagerActor
        ManagerActor -->|"Escalates Requests To"| HrAdminActor
        HrAdminActor -->|"Supervised & Managed By"| SysAdminActor
    end
```

1. **`EMPLOYEE` (Standard Staff):**
   - Workforce self-service user. Enrolls biometric face, submits daily WFH notice, performs live webcam clock-in/out, logs daily accomplishment plans, requests leave or attendance time correction, views personal analytics, and contacts developer support.
2. **`MANAGER` (Department Head):**
   - Head of department responsible for direct reports. Receives automated WFH notices, reviews and approves/rejects team leave and attendance correction requests via direct deep-link tokens, monitors department attendance, and escalates own WFH requests upward to HR Admin.
3. **`HR_ADMIN` (People Operations):**
   - Administrative authority over workforce compliance. Manages master employee directory (CRUD with soft delete), monitors organization-wide attendance audit logs, inspects photo proof and EXIF timestamps via Lightbox, approves company-wide leave requests, and generates payroll-ready Excel/CSV/PDF exports.
4. **`SYSTEM_ADMIN` (Supreme Authority):**
   - Full technical and administrative control. All HR_ADMIN and MANAGER capabilities, plus access to Relational Database Management Studio, company policy & working hour rules configuration, user credentials administration, and developer support ticket resolution.

---

## 2. Comprehensive Use Case Diagram

```mermaid
flowchart LR
    subgraph ActorsGroup["Actors"]
        Emp["👤 Employee"]
        Mgr["👔 Manager"]
        HR["📋 HR Admin"]
        Sys["👑 System Admin"]
    end

    subgraph AuthModule["1. Authentication & Security"]
        UC_Login(["Sign In with Email & Password"])
        UC_VerifyOtp(["Verify Account via Email OTP"])
        UC_ResetPass(["Forgot & Reset Password"])
        UC_FaceEnroll(["One-Time Biometric Face Setup"])
    end

    subgraph AttendanceModule["2. Daily WFH Attendance"]
        UC_WfhNotice(["Submit WFH Notice & Daily Plan"])
        UC_ClockIn(["Clock-In with Face & Canvas Watermark"])
        UC_ClockOut(["Clock-Out & Submit Daily Accomplishment"])
        UC_MyDashboard(["View Individual Attendance Analytics"])
    end

    subgraph WorkflowModule["3. Requests & Approvals"]
        UC_SubmitReq(["Submit Leave / Sick / Correction Request"])
        UC_DirectApprove(["Approve / Reject via Direct Link Token"])
        UC_EscalateWFH(["Upward WFH Notice Escalation"])
    end

    subgraph AdminModule["4. Administration & Auditing"]
        UC_AuditLog(["Inspect Real-Time Attendance & Lightbox"])
        UC_EmployeeCrud(["Manage Master Employees (CRUD & Soft Delete)"])
        UC_ExportPayroll(["Export Attendance to Excel / CSV / PDF"])
        UC_CompanyPolicy(["Configure Shift Hours & WFH Policies"])
        UC_DbStudio(["Execute SQL & Manage Relational Database"])
    end

    subgraph SupportModule["5. Help & Communication"]
        UC_ContactDev(["Submit Developer Support Ticket (SMTP)"])
    end

    %% Employee Connections
    Emp --> UC_Login
    Emp --> UC_VerifyOtp
    Emp --> UC_ResetPass
    Emp --> UC_FaceEnroll
    Emp --> UC_WfhNotice
    Emp --> UC_ClockIn
    Emp --> UC_ClockOut
    Emp --> UC_MyDashboard
    Emp --> UC_SubmitReq
    Emp --> UC_ContactDev

    %% Manager Connections
    Mgr --> UC_Login
    Mgr --> UC_FaceEnroll
    Mgr --> UC_WfhNotice
    Mgr --> UC_ClockIn
    Mgr --> UC_ClockOut
    Mgr --> UC_DirectApprove
    Mgr --> UC_EscalateWFH
    Mgr --> UC_AuditLog
    Mgr --> UC_ContactDev

    %% HR Admin Connections
    HR --> UC_Login
    HR --> UC_DirectApprove
    HR --> UC_AuditLog
    HR --> UC_EmployeeCrud
    HR --> UC_ExportPayroll
    HR --> UC_ContactDev

    %% System Admin Connections
    Sys --> UC_Login
    Sys --> UC_AuditLog
    Sys --> UC_EmployeeCrud
    Sys --> UC_ExportPayroll
    Sys --> UC_CompanyPolicy
    Sys --> UC_DbStudio
    Sys --> UC_ContactDev
```

---

## 3. Detailed Use Case Matrix

| Use Case ID | Feature / Use Case | Primary Actor | Pre-conditions | Post-conditions |
| :--- | :--- | :--- | :--- | :--- |
| **UC-01** | **Sign In & Issue JWT** | All Actors | Active account in `users` table | Receives signed JWT access & refresh token |
| **UC-02** | **Verify Account OTP** | All Actors | Newly created account (`is_verified = false`) | 6-digit OTP verified, account unlocked |
| **UC-03** | **Biometric Face Enrollment** | All Actors | Authenticated, no prior embedding enrolled | 512-D vector saved, full attendance unlocked |
| **UC-04** | **Submit WFH Notice** | Employee / Manager | Biometric enrolled, current day WFH quota valid | Email notice sent to Manager, Clock-In unlocked |
| **UC-05** | **Biometric Verified Clock-In** | Employee / Manager | WFH notice dispatched, camera active | Live frame verified against enrolled template ($\ge 0.55$), record saved with server time |
| **UC-06** | **Clock-Out & Work Summary** | Employee / Manager | Clocked in on current date | Work duration calculated, status auto-tagged (`COMPLETED` / `HALF_DAY`) |
| **UC-07** | **Submit Attendance Request** | Employee | Authenticated employee | Request record created with `PENDING` status, email alert sent to Manager |
| **UC-08** | **Direct Deep-Link Approval** | Manager / HR Admin | Valid cryptographic review token in email | Request status transitioned to `APPROVED`/`REJECTED`, attendance table updated |
| **UC-09** | **Real-Time Attendance Audit** | Manager / HR / Sys Admin | Role is `MANAGER`, `HR_ADMIN`, or `SYSTEM_ADMIN` | View paginated audit logs with search, department filters, and photo Lightbox |
| **UC-10** | **Master Employee CRUD** | HR / Sys Admin | Role is `HR_ADMIN` or `SYSTEM_ADMIN` | Employee profile created, updated, or soft-deleted preserving historical records |
| **UC-11** | **Export Payroll Data** | HR / Sys Admin | Role is `HR_ADMIN` or `SYSTEM_ADMIN` | Formatted `.xlsx`, `.csv`, or printable PDF document generated and downloaded |
| **UC-12** | **Relational Database Studio** | System Admin | Role is strictly `SYSTEM_ADMIN` | Raw SQL query execution and table inspection with security guardrails |
| **UC-13** | **Contact Developer SMTP** | All Actors | Authenticated user | Email dispatched to System Admin with CC to HR Admin and logged-in user |

---

## 4. Role-Based Access Control (RBAC) Permissions Matrix

| System Module / Capability | `EMPLOYEE` | `MANAGER` | `HR_ADMIN` | `SYSTEM_ADMIN` |
| :--- | :---: | :---: | :---: | :---: |
| **Self-Service Clock-In / Clock-Out** | ✅ | ✅ | ❌ | ❌ |
| **Personal Analytics Dashboard** | ✅ | ✅ | ❌ | ❌ |
| **Submit Leave / Time Correction** | ✅ | ✅ | ❌ | ❌ |
| **Direct Deep-Link Request Approval** | ❌ | ✅ (Department) | ✅ (All) | ✅ (All) |
| **Department Attendance Monitoring** | ❌ | ✅ (Department) | ✅ (All) | ✅ (All) |
| **Organization-Wide Audit & Lightbox** | ❌ | ❌ | ✅ | ✅ |
| **Master Employee CRUD & Soft Delete** | ❌ | ❌ | ✅ | ✅ |
| **Payroll Data Export (Excel/CSV/PDF)** | ❌ | ❌ | ✅ | ✅ |
| **Company Working Hours & Policy Config** | ❌ | ❌ | ❌ | ✅ |
| **Relational Database Management Studio**| ❌ | ❌ | ❌ | ✅ |
| **Developer Support Ticket Submission** | ✅ | ✅ | ✅ | ✅ |

---

> **© 2026 Abdurrahman Khairi - Created strictly for Technical Assessment evaluation. Unauthorized commercial use is prohibited**
