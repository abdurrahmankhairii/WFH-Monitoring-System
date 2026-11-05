# Authentication, RBAC, OTP Verification & Contact Developer Flow

Sequence diagram covering **JWT/SSO Login with RBAC**, **New Account OTP Verification**, **Forgot Password OTP**, **Access Request**, and **Contact Developer via SMTP** (where `from`/`sender` uses the logged-in user's account email).

```mermaid
sequenceDiagram
    actor User as Employee / HR Admin
    actor Admin as HR Admin (HR_ADMIN)
    participant FE as React Frontend ( + Bottom-Right Toast )
    participant GW as API Gateway (:3000)
    participant EmpMS as Employee & Auth Service (:3001)
    participant DB as MySQL Database
    participant SMTP as SMTP Server (Mailpit / Gmail)

    Note over User,SMTP: 1. Access Request & New Account Verification (with 6-Digit OTP)
    User->>FE: Submit Request Access Form (Name, Email, NIP, Dept, Position)
    FE->>GW: POST /api/auth/request-access
    GW->>EmpMS: cmd: create_access_request
    EmpMS->>DB: INSERT access_requests (status: PENDING)
    EmpMS-->>FE: Standardized Success Response
    FE-->>User: Green Toast (Bottom-Right): [Auth - Request Access] Request submitted for HRD review

    Admin->>FE: Review & Click Approve Access Request (or Create Employee in Master CRUD)
    FE->>GW: POST /api/admin/access-requests/:id/approve (RolesGuard: HR_ADMIN)
    GW->>EmpMS: cmd: approve_access_request
    EmpMS->>DB: INSERT users (email, role, is_verified: false) & employees + Generate 6-Digit OTP
    EmpMS->>SMTP: Send Welcome Email + 6-Digit Verification OTP
    EmpMS-->>FE: Standardized Success Response
    FE-->>Admin: Green Toast (Bottom-Right): [HRD Admin - Access Approval] Account created & OTP emailed

    User->>FE: Open Verify New Account Page (Input Email, 6-Digit OTP, & New Password)
    FE->>GW: POST /api/auth/verify-new-account
    GW->>EmpMS: cmd: verify_new_account
    EmpMS->>DB: Validate OTP -> Update users (is_verified: true, password_hash)
    EmpMS-->>FE: Account Verified
    FE-->>User: Green Toast (Bottom-Right): [Auth - Account Verification] Account activated successfully

    Note over User,SMTP: 2. Daily Login (Direct Bcrypt + JWT with RBAC Payload, No Daily OTP)
    User->>FE: Input Email & Password
    FE->>GW: POST /api/auth/login
    GW->>EmpMS: cmd: login_user
    EmpMS->>DB: Verify email, is_active, is_verified, & Bcrypt password_hash
    alt Valid Credentials
        EmpMS-->>FE: Return JWT { accessToken, refreshToken, user: { userId, email, role } }
        FE-->>User: Green Toast (Bottom-Right): [Auth - Login] Authenticated as {role}
    else Invalid Credentials or Inactive Account
        EmpMS-->>FE: Error 401/403 { where, what, why }
        FE-->>User: Red Toast (Bottom-Right): [Auth - Login] Login failed due to invalid credentials
    end

    Note over User,SMTP: 3. Forgot Password Flow (with 6-Digit OTP)
    User->>FE: Request Forgot Password with Email
    FE->>GW: POST /api/auth/forgot-password
    GW->>EmpMS: cmd: forgot_password
    EmpMS->>DB: Store hashed 6-digit OTP (type: FORGOT_PASSWORD)
    EmpMS->>SMTP: Send 6-Digit Password Reset OTP
    EmpMS-->>FE: Info Response
    FE-->>User: Blue Toast (Bottom-Right): [Auth - Forgot Password] 6-digit OTP sent to your email

    User->>FE: Submit 6-Digit OTP + New Password
    FE->>GW: POST /api/auth/reset-password
    GW->>EmpMS: cmd: reset_password
    EmpMS->>DB: Verify OTP -> Update password_hash (Bcrypt)
    EmpMS-->>FE: Success Response
    FE-->>User: Green Toast (Bottom-Right): [Auth - Reset Password] Password updated successfully

    Note over User,SMTP: 4. Contact Developer / Support Ticket (Sender = User's Account Email)
    User->>FE: Open Contact Developer Modal (Subject, Category, Module, Message)
    FE->>GW: POST /api/support/contact-developer (Bearer JWT)
    GW->>EmpMS: cmd: send_support_ticket { userId, userEmail, fullName, subject, message }
    EmpMS->>DB: INSERT INTO support_tickets (sender_email = user.email)
    EmpMS->>SMTP: Send Email to Developer\nFrom/Sender: "{fullName} <{user.email}>"\nReply-To: {user.email}
    EmpMS-->>FE: Success Response
    FE-->>User: Green Toast (Bottom-Right): [Support - Contact Developer] Support email sent from {user.email}
```
