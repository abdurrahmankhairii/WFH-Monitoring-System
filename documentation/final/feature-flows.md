# End-to-End Feature Flows in Mermaid
## WFH Attendance & Employee Monitoring System — Dexa Group Fullstack Technical Assessment
**Author:** Abdurrahman Khairi | **License:** Proprietary — All Rights Reserved ([LICENSE](../../LICENSE))  
**Copyright:** © 2026 Abdurrahman Khairi. Unauthorized commercial use, modification, or distribution is prohibited.

---

## Flow 1: Authentication, Role-Based Access Control & Email OTP

```mermaid
sequenceDiagram
    autonumber
    actor User as "Employee / Admin"
    participant React as "React Frontend (:5173)"
    participant Gateway as "API Gateway (:3000)"
    participant EmpSvc as "Employee Service (:3001)"
    participant DB as "MySQL Database (:3306)"
    participant SMTP as "Mailpit SMTP (:1025)"

    User->>React: Enters Email & Password
    React->>Gateway: POST /api/auth/login
    Gateway->>EmpSvc: TCP EMPLOYEE_PATTERNS.LOGIN
    EmpSvc->>DB: Query User & Employee profile
    DB-->>EmpSvc: Return user entity with password_hash & role
    
    alt Password invalid
        EmpSvc-->>Gateway: 401 Unauthorized
        Gateway-->>React: Toast error ("Invalid credentials")
    else User not verified (is_verified == false)
        EmpSvc->>SMTP: Dispatch 6-digit numeric OTP email
        EmpSvc-->>Gateway: 403 Forbidden ("Verification Required")
        Gateway-->>React: Redirect to /verify-account?email=...
        User->>React: Submits 6-digit OTP code
        React->>Gateway: POST /api/auth/verify-account
        Gateway->>EmpSvc: TCP EMPLOYEE_PATTERNS.VERIFY_ACCOUNT
        EmpSvc->>DB: Update is_verified = true
        EmpSvc-->>Gateway: 200 OK
        Gateway-->>React: Account activated!
    else Password valid & verified
        EmpSvc->>EmpSvc: Issue signed JWT (access + refresh) with role & department
        EmpSvc->>DB: Update last_login_at = NOW()
        EmpSvc-->>Gateway: Return tokens & user profile
        Gateway-->>React: 200 OK { accessToken, refreshToken, user }
        React->>React: Store tokens & route by role (Employee / HR / Admin)
    end
```

---

## Flow 2: Biometric Face Setup & 512-D ArcFace Enrollment

```mermaid
flowchart TD
    StartEnroll["User logs in without enrolled biometric face"] --> CheckEnroll{"Is face enrolled?"}
    CheckEnroll -->|"Yes"| DirectPortal["Proceed directly to WFH Attendance Portal"]
    CheckEnroll -->|"No"| RedirectSetup["Redirect to /enroll-face (One-Time Setup)"]

    RedirectSetup --> StartWebcam["Initialize front-facing webcam (MediaDevices API)"]
    StartWebcam --> FrameInspection["User positions face inside oval guide"]
    FrameInspection --> CaptureBtn["Click 'Capture & Register Face'"]
    CaptureBtn --> CanvasExtract["Draw frame on HTML5 Canvas & extract JPEG Blob"]
    CanvasExtract --> SubmitEnroll["POST /api/employees/me/enroll-face (multipart/form-data)"]

    SubmitEnroll --> GatewayStorage["Gateway saves photo to hierarchical storage:<br/>/uploads/YYYY/dept/role/name/month/avatar_name_date_time.jpg"]
    GatewayStorage --> FastApiReq["Gateway forwards image buffer to Biometric Service (:8000)"]
    
    FastApiReq --> ArcFaceExtract["InsightFace ArcFace extracts normalized 512-D float array"]
    ArcFaceExtract --> ValidateEmbed{"Is face detected & 512-D vector valid?"}
    ValidateEmbed -->|"No / Occluded"| ErrorReject["Return 400 'No clear face detected'"]
    ErrorReject --> RetakeUI["Display friendly toast & enable 'Retake'"]
    
    ValidateEmbed -->|"Yes"| SaveVector["Employee Service persists face_embedding JSON array & avatar_url in MySQL"]
    SaveVector --> RefreshCtx["Frontend refreshes AuthContext profile"]
    RefreshCtx --> UnlockAttendance["Attendance unlocked! Redirect to /employee/attendance"]
```

---

## Flow 3: Daily WFH Notice, Upward Escalation & Biometric Clock-In

```mermaid
sequenceDiagram
    autonumber
    actor Emp as "Employee / Manager"
    participant UI as "Attendance Portal UI"
    participant Canvas as "HTML5 Canvas Watermarker"
    participant Gateway as "API Gateway (:3000)"
    participant FastApi as "Biometric Engine (:8000)"
    participant AttSvc as "Attendance Service (:3002)"
    participant DB as "MySQL Database"
    participant Mail as "Mailpit SMTP"

    Note over Emp,UI: Step A: Daily WFH Notice Submission
    Emp->>UI: Submits WFH Notice & Morning Focus Plan
    UI->>Gateway: POST /api/attendances/wfh-notice
    Gateway->>AttSvc: TCP ATTENDANCE_PATTERNS.SUBMIT_WFH_NOTICE
    
    alt User is Employee
        AttSvc->>Mail: Send WFH Notice to Department Manager (CC: HR Admin & Employee)
    else User is Department Manager
        AttSvc->>Mail: Upward Escalation to HR Admin (CC: Employee)
    end
    AttSvc-->>Gateway: Notice acknowledged, Clock-In unlocked
    Gateway-->>UI: 200 OK (Notice Sent, Camera Ready)

    Note over Emp,UI: Step B: Biometric Verified Clock-In
    Emp->>UI: Clicks "Capture Live Photo"
    UI->>Canvas: Capture webcam frame
    Canvas->>Canvas: Burn permanent watermark bar (Server Time + NIP + Verification Badge)
    Emp->>UI: Clicks "Submit Verified Clock-In"
    UI->>Gateway: POST /api/attendances/clock-in (watermarked photo + work plan)
    
    Gateway->>FastApi: POST /extract-face (live capture buffer)
    FastApi-->>Gateway: Returns live 512-D embedding
    
    Gateway->>Gateway: Compare live embedding vs enrolled embedding (Cosine Similarity)
    alt Cosine Similarity < 0.55
        Gateway-->>UI: 400 Bad Request ("Facial identity mismatch. Score below 0.55 threshold")
    else Cosine Similarity >= 0.55
        Gateway->>Gateway: Save image into organized hierarchical directory
        Gateway->>AttSvc: TCP ATTENDANCE_PATTERNS.CLOCK_IN (server new Date(), similarity score)
        AttSvc->>DB: Insert record into attendances table
        AttSvc-->>Gateway: Attendance session created
        Gateway-->>UI: 201 Created (Clock-In Verified, Session Active)
    end
```

---

## Flow 4: Daily Clock-Out & Accomplishment Summary

```mermaid
flowchart TD
    ActiveSession["Employee completes workday with active Clock-In session"] --> OpenPortal["Open WFH Portal (Clock-Out Section)"]
    OpenPortal --> FillSummary["Fill mandatory Daily Accomplishment (clock_out_notes)"]
    FillSummary --> CaptureProof["Capture Live Webcam photo proof with server timestamp watermark"]
    CaptureProof --> SubmitClockOut["Click 'Submit Verified Clock-Out'"]

    SubmitClockOut --> GatewayVerify["API Gateway inspects image & stores in hierarchical storage"]
    GatewayVerify --> AttService["Attendance Service receives TCP command"]
    
    AttService --> ServerTime["Fetch server-side timestamp: clock_out_time = new Date()"]
    ServerTime --> CalcDuration["Calculate work_duration_minutes = clock_out_time - clock_in_time - 60m (break)"]
    
    CalcDuration --> CheckLate["Compute late_minutes if clock_in_time > 08:30 WIB"]
    CheckLate --> CheckOvertime{"Is clock_out_time > 17:30 WIB?"}
    
    CheckOvertime -->|"Yes"| ComputeOT["Calculate overtime_minutes and compensation pay:<br/>1.5x for 1st hour + 2.0x for subsequent hours"]
    CheckOvertime -->|"No"| ZeroOT["overtime_minutes = 0, overtime_pay_amount = 0"]

    ComputeOT --> TagStatus{"Is work_duration_minutes >= 480 (8 hours)?"}
    ZeroOT --> TagStatus

    TagStatus -->|"Yes"| TagCompleted["Status = COMPLETED (or LATE if late_minutes > 0)"]
    TagStatus -->|"No"| TagHalfDay["Status = HALF_DAY"]

    TagCompleted --> UpdateDB["Update attendances table in MySQL with final duration, pay, and notes"]
    TagHalfDay --> UpdateDB
    UpdateDB --> ReturnSummary["Return 200 OK with session summary dialog and personal analytics update"]
```

---

## Flow 5: Leave, Sick & Attendance Correction Workflow with Direct Deep Links

```mermaid
sequenceDiagram
    autonumber
    actor Emp as "Employee"
    participant UI as "React Portal"
    participant Gateway as "API Gateway (:3000)"
    participant AttSvc as "Attendance Service (:3002)"
    participant DB as "MySQL Database"
    participant Mail as "Mailpit SMTP Server"
    actor Approver as "Department Manager / HR Admin"

    Emp->>UI: Submits Request (Leave / Sick / Time Correction) with attachment
    UI->>Gateway: POST /api/attendance-requests (multipart/form-data)
    Gateway->>Gateway: Save attachment to /uploads/.../request_name_date.pdf
    Gateway->>AttSvc: TCP ATTENDANCE_REQUEST_PATTERNS.CREATE
    AttSvc->>DB: Insert into attendance_requests (status = PENDING)
    
    AttSvc->>AttSvc: Generate signed review deep-link token
    AttSvc->>Mail: Dispatch HTML email to Manager with direct review link:<br/>https://portal.dexagroup.com/requests/review?token=XYZ
    AttSvc-->>Gateway: Request submitted
    Gateway-->>UI: 201 Created ("Request sent to manager for review")

    Approver->>Mail: Opens notification email in Mailpit / Inbox
    Approver->>UI: Clicks direct deep-link URL (token decoded)
    UI->>Gateway: GET /api/attendance-requests/review-by-token?token=XYZ
    Gateway->>AttSvc: Fetch request details & attached proof document
    AttSvc-->>Gateway: Return request payload
    Gateway-->>UI: Render Direct Approval Decision Modal
    
    Approver->>UI: Clicks "Approve" (or "Reject" with reason)
    UI->>Gateway: POST /api/attendance-requests/action-by-token
    Gateway->>AttSvc: TCP ATTENDANCE_REQUEST_PATTERNS.APPROVE
    AttSvc->>DB: Update attendance_requests status = APPROVED
    
    alt Request was Attendance Time Correction
        AttSvc->>DB: Automatically synchronize attendances table with approved times
    end
    
    AttSvc->>Mail: Send approval confirmation email to Employee
    AttSvc-->>Gateway: Decision recorded
    Gateway-->>UI: 200 OK ("Request approved successfully")
```

---

## Flow 6: Master Employee Management (CRUD & Soft Delete)

```mermaid
flowchart TD
    Admin["HR Admin / System Admin"] --> Navigate["Navigate to /hrd/employees"]
    Navigate --> Action{"Choose Action"}

    Action -->|"Create Employee"| FillForm["Fill Employee Form (NIP strictly mandatory, phone +62, empty dept/position)"]
    FillForm --> SubmitPost["POST /api/employees"]
    SubmitPost --> ValidateNip{"Is NIP unique & non-empty?"}
    ValidateNip -->|"No"| NipError["Return 400 'Employee Code / NIP is mandatory'"]
    ValidateNip -->|"Yes"| CreateUser["Create user account (bcrypt password) + employee record in MySQL"]
    CreateUser --> RefreshTable["Reload Master Employees Table with success toast"]

    Action -->|"Update Profile"| EditForm["Update employee department, position, salary, or quota"]
    EditForm --> SubmitPatch["PATCH /api/employees/:id"]
    SubmitPatch --> UpdateRow["Update employees row in MySQL"]
    UpdateRow --> RefreshTable

    Action -->|"Deactivate / Soft Delete"| ClickDelete["Click Deactivate Employee button"]
    ClickDelete --> ConfirmModal["Confirm soft-deletion modal dialog"]
    ConfirmModal --> SubmitDelete["DELETE /api/employees/:id"]
    SubmitDelete --> SoftDelete["Execute TypeORM soft-delete:<br/>is_active = false, deleted_at = NOW()"]
    SoftDelete --> PreserveFk["Historical attendance and request foreign keys preserved intact!"]
    PreserveFk --> RefreshTable
```

---

## Flow 7: Real-Time Attendance Monitoring & Lightbox Inspection

```mermaid
sequenceDiagram
    autonumber
    actor HR as "HR Admin / System Admin"
    participant UI as "HRD Real-Time Dashboard"
    participant Gateway as "API Gateway (:3000)"
    participant AttSvc as "Attendance Service (:3002)"
    participant DB as "MySQL Database"
    participant Lightbox as "Photo Lightbox Modal"

    HR->>UI: Opens /hrd/attendance-audit
    UI->>Gateway: GET /api/attendances/audit-log?date=YYYY-MM-DD&department=...
    Gateway->>AttSvc: TCP ATTENDANCE_PATTERNS.GET_AUDIT_LOG
    AttSvc->>DB: SQL JOIN attendances + employees + departments
    DB-->>AttSvc: Paginated session records + KPI aggregations
    AttSvc-->>Gateway: Return records
    Gateway-->>UI: Render Interactive Data Table & KPI Metric Cards

    HR->>UI: Clicks on Clock-In / Clock-Out thumbnail photo
    UI->>Lightbox: Open full-resolution photo proof
    Lightbox->>Lightbox: Inspect Canvas Watermark bar (server WIB time + NIP)
    Lightbox->>Lightbox: Check EXIF verification badge & similarity score (e.g. 0.94)
    Lightbox-->>HR: Display verified authenticity breakdown
```

---

## Flow 8: Payroll Calculation & Multi-Format Data Export

```mermaid
flowchart TD
    User["HR Admin / System Admin"] --> FilterData["Apply date range, department, and status filters"]
    FilterData --> ChooseFormat{"Select Export Format"}

    ChooseFormat -->|"Excel (.xlsx)"| ReqExcel["GET /api/attendances/export/excel?params..."]
    ChooseFormat -->|"CSV (.csv)"| ReqCsv["GET /api/attendances/export/csv?params..."]
    ChooseFormat -->|"Printable PDF"| ReqPdf["Open Print-Optimized Layout View"]

    ReqExcel --> Gateway["API Gateway forwards TCP request to ExportService"]
    ReqCsv --> Gateway

    Gateway --> ExportService["ExportService processes dataset in attendance-service"]
    ExportService --> SQLQuery["Query attendances JOIN employees for filtered range"]
    SQLQuery --> FormulaCompute["Compute total working hours, late deductions, and overtime compensation"]
    
    FormulaCompute --> StreamExcel["Generate Excel workbook with styled headers via ExcelJS"]
    FormulaCompute --> StreamCsv["Serialize clean comma-separated values stream"]

    StreamExcel --> Download["Stream binary buffer with Content-Disposition attachment to browser"]
    StreamCsv --> Download
    ReqPdf --> PrintModal["Trigger window.print() with high-contrast corporate typography"]
```

---

## Flow 9: Hierarchical File Storage & EXIF Verification

```mermaid
flowchart TD
    FileIncoming["Incoming File Upload (Webcam Blob, Attachment, or Face Avatar)"] --> ExtractActor["Extract Actor Context: Date, Department, Role, Full Name"]
    
    ExtractActor --> BuildHierarchy["Execute buildOrganizedDirectory():<br/>uploads / YYYY / dept-slug / role / name-slug / MM-month /"]
    BuildHierarchy --> EnsureDirs["Ensure recursive directories exist on disk (mkdirSync recursive)"]
    
    EnsureDirs --> BuildName["Execute buildOrganizedFilename():<br/>prefix_nameslug_YYYY-MM-DD_HH-mm-ss.ext"]
    BuildName --> CheckCollision{"Does file exist?"}
    CheckCollision -->|"Yes"| AddCounter["Append numeric collision suffix _1, _2"]
    CheckCollision -->|"No"| WriteDisk["Write buffer to disk using writeFileSync"]
    AddCounter --> WriteDisk

    WriteDisk --> ParseExif{"Is file an uploaded JPEG?"}
    ParseExif -->|"Yes"| ExifParser["Parse DateTimeOriginal / CreateDate tags via exif-parser"]
    ExifParser --> CompareDate{"Is EXIF date from today within allowable window?"}
    CompareDate -->|"Yes"| MarkVerified["is_timestamp_verified = true"]
    CompareDate -->|"No"| MarkSuspicious["is_timestamp_verified = false (Flagged with warning badge)"]
    
    ParseExif -->|"No (Webcam Canvas)"| MarkWebcamVerified["is_timestamp_verified = true (Live server watermark burned)"]
    
    MarkVerified --> ReturnUrl["Return relative URL: /uploads/YYYY/dept/role/name/month/file.jpg"]
    MarkSuspicious --> ReturnUrl
    MarkWebcamVerified --> ReturnUrl
```

---

## Flow 10: Relational Database Management Studio (System Admin)

```mermaid
sequenceDiagram
    autonumber
    actor SysAdmin as "System Administrator"
    participant UI as "Database Management Studio UI"
    participant Gateway as "API Gateway (:3000)"
    participant Guard as "RolesGuard (SYSTEM_ADMIN)"
    participant EmpSvc as "Employee Service (:3001)"
    participant DB as "MySQL Database (:3306)"

    SysAdmin->>UI: Opens /system/database
    UI->>Gateway: GET /api/database-management/tables
    Gateway->>Guard: Verify JWT role == SYSTEM_ADMIN
    Guard-->>Gateway: Access granted
    Gateway->>EmpSvc: TCP DB_PATTERNS.GET_TABLE_LIST
    EmpSvc->>DB: Query information_schema.tables
    DB-->>EmpSvc: Return table names, row counts, and data sizes
    EmpSvc-->>Gateway: Table metadata list
    Gateway-->>UI: Render table selector & storage metrics

    SysAdmin->>UI: Selects table (e.g. users) or enters custom SQL query
    UI->>Gateway: POST /api/database-management/query
    Gateway->>EmpSvc: TCP DB_PATTERNS.EXECUTE_QUERY
    EmpSvc->>EmpSvc: Sanitize & validate query syntax
    EmpSvc->>DB: Execute query with timeout protection
    DB-->>EmpSvc: Raw rows & column definitions
    EmpSvc-->>Gateway: Formatted query results
    Gateway-->>UI: Render interactive table view with human-readable headers & ISO date formatting
```

---

## Flow 11: Developer Support & Ticket Routing (SMTP)

```mermaid
sequenceDiagram
    autonumber
    actor User as "Logged-in User"
    participant UI as "Contact Developer Modal"
    participant Gateway as "API Gateway (:3000)"
    participant EmpSvc as "Employee Service (:3001)"
    participant DB as "MySQL Database"
    participant SMTP as "Mailpit / Corporate SMTP"
    actor SysAdmin as "System Administrator (sysadmin@dexagroup.com)"
    actor HR as "HR Admin (admin.hrd@dexagroup.com)"

    User->>UI: Clicks "Support" in top headbar
    UI->>UI: Displays pre-filled modal with sender name, email, NIP & department
    User->>UI: Fills Category & Message and clicks "Send Message"
    UI->>Gateway: POST /api/support/tickets
    Gateway->>EmpSvc: TCP EMPLOYEE_PATTERNS.CREATE_SUPPORT_TICKET
    
    EmpSvc->>DB: Insert ticket record into support_tickets table
    EmpSvc->>DB: Query active SYSTEM_ADMIN and HR_ADMIN email addresses
    
    EmpSvc->>SMTP: Dispatch Nodemailer message with targeted routing:
    Note over EmpSvc,SMTP: To: sysadmin@dexagroup.com<br/>Cc: admin.hrd@dexagroup.com, user.email<br/>From/ReplyTo: "User Full Name" <user.email>
    
    SMTP-->>SysAdmin: Delivers support ticket email
    SMTP-->>HR: Delivers CC copy
    SMTP-->>User: Delivers confirmation copy
    
    EmpSvc-->>Gateway: Ticket created & dispatched
    Gateway-->>UI: 201 Created ("Support ticket delivered to system administrators")
    UI->>UI: Display success toast notification
```

---

> **© 2026 Abdurrahman Khairi - Created strictly for Technical Assessment evaluation. Unauthorized commercial use is prohibited**
