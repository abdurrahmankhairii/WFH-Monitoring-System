# Entity-Relationship Diagram (ERD) & Database Specifications
## WFH Attendance & Employee Monitoring System — Dexa Group Fullstack Technical Assessment
**Author:** Abdurrahman Khairi | **License:** Proprietary — All Rights Reserved ([LICENSE](../../LICENSE))  
**Copyright:** © 2026 Abdurrahman Khairi. Unauthorized commercial use, modification, or distribution is prohibited.

---

## 1. Complete Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    users ||--o| employees : "has profile (1:1)"
    users ||--o{ support_tickets : "submits (1:N)"
    departments ||--o{ employees : "employs (1:N)"
    employees ||--o{ attendances : "logs daily (1:N)"
    employees ||--o{ attendance_requests : "submits (1:N)"

    users {
        uuid id PK
        varchar email UK "unique email"
        varchar password_hash "bcrypt 10 rounds"
        enum role "SYSTEM_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE"
        boolean is_verified "account activation status"
        datetime last_login_at "last authentication timestamp"
        datetime created_at
        datetime updated_at
    }

    employees {
        uuid id PK
        uuid user_id FK "UQ foreign key to users.id"
        varchar employee_code UK "NIP strictly mandatory"
        varchar full_name
        varchar email UK
        varchar department
        uuid department_id FK "nullable FK to departments.id"
        varchar position
        bigint base_salary "gross monthly salary in IDR"
        varchar phone_number "formatted +62"
        date join_date
        enum status "ACTIVE, PROBATION, CONTRACT, RESIGNED"
        boolean is_active "soft delete flag"
        text avatar_url "biometric profile picture"
        json face_embedding "normalized 512-D float vector"
        datetime face_enrolled_at "enrollment timestamp"
        text face_enrolled_photo_url
        decimal home_latitude "geofencing latitude"
        decimal home_longitude "geofencing longitude"
        text home_address
        datetime created_at
        datetime updated_at
        datetime deleted_at "soft deletion timestamp"
    }

    departments {
        uuid id PK
        varchar code UK "dept code e.g. IT, HRD"
        varchar name UK "full department name"
        varchar manager_name
        varchar manager_email "routing email for WFH notice"
        varchar hr_pic_email "HR escalation email"
        int max_wfh_days_per_week "default 1 day/week"
        enum wfh_workflow_mode "STRICT_APPROVAL, NOTICE_ONLY"
        boolean enable_overtime
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    attendances {
        uuid id PK
        uuid employee_id FK "foreign key to employees.id"
        date attendance_date "calendar date YYYY-MM-DD"
        datetime clock_in_time "server-authoritative WIB time"
        datetime clock_out_time "server-authoritative WIB time"
        int work_duration_minutes "total working time"
        int late_minutes "minutes late after 08:30 WIB"
        int overtime_minutes "minutes worked after 17:30 WIB"
        double overtime_multiplier_hours "effective OT multiplier"
        bigint overtime_pay_amount "calculated compensation in IDR"
        boolean wfh_approved "WFH notice approved status"
        text clock_in_photo_url "watermarked image path"
        text clock_out_photo_url "watermarked image path"
        datetime clock_in_photo_captured_at "client capture time"
        datetime clock_out_photo_captured_at
        enum photo_capture_source "LIVE_WEBCAM, FILE_UPLOAD"
        enum clock_out_capture_source
        boolean is_timestamp_verified "EXIF / Canvas validation"
        boolean is_clock_out_timestamp_verified
        enum verification_method "LIVE_CAMERA_LIVENESS, FILE_UPLOAD_EXIF"
        enum verification_status "VERIFIED_LIVE_BIOMETRIC, UNVERIFIED_SUSPICIOUS"
        double liveness_score "liveness confidence score"
        double similarity_score "ArcFace cosine score (threshold 0.55)"
        double clock_out_similarity_score
        boolean is_face_matched "1:1 match result"
        boolean is_clock_out_face_matched
        varchar image_hash "SHA-256 binary hash"
        varchar image_phash "perceptual dHash/pHash"
        varchar clock_out_image_hash
        varchar clock_out_image_phash
        datetime exif_captured_at "parsed from EXIF DateTimeOriginal"
        json exif_metadata "raw parsed tags"
        text fallback_reason
        text clock_out_fallback_reason
        decimal latitude
        decimal longitude
        enum location_status "WITHIN_GEOFENCE, OUTSIDE_GEOFENCE"
        text work_notes "morning WFH focus plan"
        text clock_out_notes "evening accomplishment summary"
        enum status "ON_TIME, LATE, HALF_DAY, MISSING_CLOCK_OUT, COMPLETED"
        datetime created_at
        datetime updated_at
    }

    attendance_requests {
        uuid id PK
        uuid employee_id FK "foreign key to employees.id"
        enum request_type "LEAVE, SICK, ATTENDANCE_CORRECTION, WFH_OVER_QUOTA"
        date start_date
        date end_date
        datetime requested_clock_in "for time correction"
        datetime requested_clock_out "for time correction"
        text reason "submission rationale"
        text attachmentUrl "doctor note or evidence document"
        enum status "PENDING, APPROVED, REJECTED, CANCELLED"
        varchar reviewed_by "manager or HR name"
        datetime reviewed_at
        text rejection_reason
        datetime created_at
        datetime updated_at
    }

    access_requests {
        uuid id PK
        varchar full_name
        varchar email UK
        varchar employee_code
        varchar department
        varchar position
        varchar phone
        text reason
        enum status "PENDING, APPROVED, REJECTED"
        varchar reviewed_by
        datetime reviewed_at
        text rejection_reason
        datetime created_at
        datetime updated_at
    }

    otp_codes {
        uuid id PK
        varchar email
        varchar code "6-digit numeric OTP"
        enum purpose "ACCOUNT_VERIFICATION, PASSWORD_RESET"
        boolean is_used "single-use protection"
        datetime expires_at "10-minute expiry"
        datetime created_at
    }

    support_tickets {
        uuid id PK
        uuid user_id FK "foreign key to users.id"
        varchar subject
        varchar category "BUG, FEATURE_REQUEST, ATTENDANCE_INQUIRY, OTHER"
        text message
        enum status "OPEN, IN_PROGRESS, RESOLVED, CLOSED"
        datetime created_at
        datetime updated_at
    }

    system_settings {
        uuid id PK
        varchar key UK "configuration key"
        text value "JSON or scalar value"
        text description
        datetime updated_at
    }
```

---

## 2. Table Specifications & Column Dictionaries

### 2.1. `users` Table
Stores authenticated user accounts and credentials.

| Column Name | SQL Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` (UUID) | Primary Key | Universally unique user identifier |
| `email` | `VARCHAR(150)` | UNIQUE, NOT NULL | Corporate email address used for login |
| `password_hash`| `VARCHAR(255)` | NOT NULL | Password hash generated via bcrypt (salt 10) |
| `role` | `ENUM` | NOT NULL, DEFAULT `'EMPLOYEE'` | `SYSTEM_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE` |
| `is_verified` | `BOOLEAN` | NOT NULL, DEFAULT `false` | True once email OTP verification succeeds |
| `last_login_at`| `DATETIME` | NULL | Timestamp of the most recent authentication session |
| `created_at` | `DATETIME` | NOT NULL | Record creation timestamp |
| `updated_at` | `DATETIME` | NOT NULL | Last record modification timestamp |

### 2.2. `employees` Table
Master employee profiles with soft-delete capability and biometric enrollment fields.

| Column Name | SQL Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` (UUID) | Primary Key | Unique employee identifier |
| `user_id` | `VARCHAR(36)` (UUID) | UNIQUE, NOT NULL, FK `users.id` | One-to-one relationship to `users` |
| `employee_code`| `VARCHAR(50)` | UNIQUE, NOT NULL | Official company NIP (strictly mandatory) |
| `full_name` | `VARCHAR(150)` | NOT NULL | Employee full legal name with degrees |
| `email` | `VARCHAR(150)` | UNIQUE, NOT NULL | Synchronized with `users.email` |
| `department` | `VARCHAR(100)` | NOT NULL, INDEX | Department name slug or string |
| `department_id`| `VARCHAR(36)` (UUID) | NULL, FK `departments.id` | Foreign key reference to department entity |
| `position` | `VARCHAR(100)` | NOT NULL | Official corporate job title |
| `base_salary` | `BIGINT` | NOT NULL, DEFAULT `12000000` | Base salary in IDR used for overtime calculation |
| `phone_number` | `VARCHAR(30)` | NULL | Contact phone number (defaults to `+62`) |
| `join_date` | `DATE` | NOT NULL | Employee start date |
| `status` | `ENUM` | NOT NULL, DEFAULT `'ACTIVE'` | `ACTIVE`, `PROBATION`, `CONTRACT`, `RESIGNED` |
| `is_active` | `BOOLEAN` | NOT NULL, DEFAULT `true` | Soft delete indicator |
| `avatar_url` | `TEXT` | NULL | Static URL path to enrolled face photo |
| `face_embedding`| `JSON` | NULL | 512-dimensional normalized float array from ArcFace |
| `face_enrolled_at`| `DATETIME` | NULL | Timestamp when biometric enrollment was completed |
| `home_latitude`| `DECIMAL(10,8)`| NULL | Geofencing latitude coordinate |
| `home_longitude`| `DECIMAL(11,8)`| NULL | Geofencing longitude coordinate |
| `deleted_at` | `DATETIME` | NULL | Soft deletion date; non-null indicates deleted employee |

### 2.3. `attendances` Table
Core transactional table recording daily WFH sessions, biometric scores, and overtime calculations.

| Column Name | SQL Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` (UUID) | Primary Key | Unique attendance session identifier |
| `employee_id` | `VARCHAR(36)` (UUID) | NOT NULL, FK `employees.id` | Target employee foreign key |
| `attendance_date`| `DATE` | NOT NULL, INDEX | Calendar date in `YYYY-MM-DD` |
| `clock_in_time` | `DATETIME` | NULL | Authoritative server timestamp at Clock-In |
| `clock_out_time`| `DATETIME` | NULL | Authoritative server timestamp at Clock-Out |
| `work_duration_minutes` | `INT` | NULL | Total minutes elapsed minus lunch break (60m) |
| `late_minutes` | `INT` | NOT NULL, DEFAULT `0` | Minutes after 08:30 WIB target threshold |
| `overtime_minutes`| `INT` | NOT NULL, DEFAULT `0` | Minutes worked after 17:30 WIB shift end |
| `overtime_multiplier_hours` | `DOUBLE` | DEFAULT `0` | Computed overtime multiplier (1.5x first hr, 2.0x after) |
| `overtime_pay_amount` | `BIGINT` | DEFAULT `0` | IDR overtime compensation ($HourlyRate \times Multiplier$) |
| `clock_in_photo_url` | `TEXT` | NULL | File path in hierarchical storage |
| `clock_out_photo_url` | `TEXT` | NULL | File path in hierarchical storage |
| `similarity_score` | `DOUBLE` | NULL | Cosine similarity score against enrolled template ($\ge 0.55$) |
| `is_face_matched` | `BOOLEAN` | NOT NULL, DEFAULT `false` | True if facial cosine similarity meets threshold |
| `status` | `ENUM` | NOT NULL, INDEX | `ON_TIME`, `LATE`, `HALF_DAY`, `MISSING_CLOCK_OUT`, `COMPLETED` |
| `work_notes` | `TEXT` | NULL | Morning daily work plan submitted during Clock-In |
| `clock_out_notes`| `TEXT` | NULL | Evening accomplishment notes submitted during Clock-Out |

---

## 3. Database Indexes & Query Optimizations

1. **Unique Attendance Index (`UQ_attendance_employee_date`):**
   `UNIQUE INDEX (employee_id, attendance_date)` ensures that an employee can record at most **one attendance session per calendar day**, preventing race-condition duplicate Clock-Ins.
2. **Department Filter Index (`IDX_employees_department` & `IDX_attendance_date`):**
   Powers high-speed aggregations in the HRD Monitoring Dashboard (`SELECT COUNT(*), status FROM attendances WHERE attendance_date = ? GROUP BY status`).
3. **Perceptual Image Hashing Index (`IDX_attendances_phash`):**
   Indexes perceptual hash fingerprints (`image_phash`) to detect fraudulent photo reuse within sub-millisecond query time.

---

> **© 2026 Abdurrahman Khairi - Created strictly for Technical Assessment evaluation. Unauthorized commercial use is prohibited**
