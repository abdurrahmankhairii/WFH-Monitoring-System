# WFH Attendance (Photo Timestamp Verification), Leave Request & Export Flow

Sequence diagram covering **Live Camera / File Upload Timestamp Verification**, **Server-Side Clock-In & Clock-Out with Daily Work Logs**, **Leave/Sick/Attendance Correction Self-Service**, and **HRD Monitoring & Payroll Export (Excel/CSV/PDF)**.

```mermaid
sequenceDiagram
    actor Emp as Employee (EMPLOYEE)
    actor Admin as HR Admin (HR_ADMIN)
    participant FE as React Frontend (Canvas Watermark + Toast)
    participant GW as API Gateway (:3000)
    participant Storage as Photo Storage
    participant AttMS as Attendance Service (:3002)
    participant DB as MySQL Database

    Note over Emp,DB: 1. Clock-In with Live Camera Watermark / EXIF Timestamp Verification & Daily Plan
    Emp->>FE: Open WFH Attendance Page (Syncs Live Clock with Server Time)
    Emp->>FE: Capture Live Webcam Photo (or Upload File) + Write Daily Plan (work_notes)
    FE->>FE: HTML5 Canvas burns Timestamp Watermark (Server Time + NIP + Name + Capture Source)\n& extracts EXIF DateTimeOriginal / capture metadata
    FE->>GW: POST /api/attendances/clock-in (multipart/form-data + Bearer JWT)
    GW->>GW: Inspect Image Buffer EXIF / Metadata & Validate Format/Size
    GW->>Storage: Save Watermarked Proof Image
    Storage-->>GW: Return clock_in_photo_url
    GW->>AttMS: cmd: clock_in { employeeId, photoUrl, photoCapturedAt, captureSource, dailyPlan }
    AttMS->>AttMS: Generate Authoritative Server Timestamp (clock_in_time = new Date())\nVerify Photo Timestamp Window (is_timestamp_verified)\nCalculate Status (ON_TIME vs LATE based on 08:30 WIB cutoff)
    AttMS->>DB: INSERT INTO attendances
    AttMS-->>FE: Return Attendance Record
    FE-->>Emp: Green Toast (Bottom-Right): [WFH Attendance - Clock In] Recorded at {clock_in_time} ({status})

    Note over Emp,DB: 2. Clock-Out with Mandatory Daily Accomplishment & Automated Working Hours
    Emp->>FE: Capture/Upload Clock-Out Photo + Fill Mandatory Daily Accomplishment (clock_out_notes)
    FE->>FE: HTML5 Canvas burns Clock-Out Timestamp Watermark
    FE->>GW: POST /api/attendances/clock-out (multipart/form-data + Bearer JWT)
    GW->>Storage: Save Clock-Out Proof Image
    Storage-->>GW: Return clock_out_photo_url
    GW->>AttMS: cmd: clock_out { employeeId, photoUrl, photoCapturedAt, dailyAccomplishment }
    AttMS->>AttMS: Generate Server Timestamp (clock_out_time = new Date())\nCalculate work_duration_minutes = (clock_out - clock_in)\nDetermine Final Status (COMPLETED or HALF_DAY)
    AttMS->>DB: UPDATE attendances
    AttMS-->>FE: Return Updated Record & Duration
    FE-->>Emp: Green Toast (Bottom-Right): [WFH Attendance - Clock Out] Completed ({work_duration_minutes} mins worked)

    Note over Emp,DB: 3. Leave, Sick & Attendance Correction Request (Self-Service)
    Emp->>FE: Submit Leave / Sick / Time Correction Form + Proof Attachment
    FE->>GW: POST /api/attendance-requests (multipart/form-data)
    GW->>AttMS: cmd: create_attendance_request
    AttMS->>DB: INSERT INTO attendance_requests (status: PENDING)
    AttMS-->>FE: Request Created
    FE-->>Emp: Green Toast (Bottom-Right): [Attendance Request - Submit] Request submitted for HRD approval

    Admin->>FE: Review Request & Click Approve / Reject
    FE->>GW: PATCH /api/attendance-requests/:id/review (RolesGuard: HR_ADMIN)
    GW->>AttMS: cmd: review_attendance_request
    AttMS->>DB: UPDATE attendance_requests & Sync/Upsert attendances row for target_date
    AttMS-->>FE: Review Saved
    FE-->>Admin: Green Toast (Bottom-Right): [HRD Admin - Request Approval] Request approved & attendance synced

    Note over Admin,DB: 4. HRD Real-Time Monitoring Dashboard, Photo Audit & Excel/CSV Export
    Admin->>FE: Filter Attendance by Date Range, Department, Status, or Employee Name
    FE->>GW: GET /api/attendances?startDate=...&endDate=...&department=...
    GW->>AttMS: cmd: find_all_attendances (SQL JOIN + COUNT/GROUP BY summary)
    AttMS->>DB: Query attendances + employees + timestamp verification flags
    AttMS-->>FE: Return Paginated Logs + Summary Metrics
    FE-->>Admin: Blue Toast (Bottom-Right): [HRD Monitoring - Filter] Loaded {total} attendance records
    Admin->>FE: Click "Export Excel / CSV"
    FE->>GW: GET /api/attendances/export?format=xlsx&startDate=...
    GW-->>FE: Stream Payroll-Ready .xlsx / .csv File
    FE-->>Admin: Green Toast (Bottom-Right): [HRD Monitoring - Export] Attendance report downloaded successfully
```
