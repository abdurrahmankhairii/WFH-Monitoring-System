// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import {
  AccessRequest,
  ApprovalStatus,
  Attendance,
  AttendanceRequest,
  AttendanceRequestType,
  AttendanceStatus,
  Employee,
  EmployeeStatus,
  OtpType,
  PhotoCaptureSource,
  SupportCategory,
  SupportTicket,
  SupportTicketStatus,
  User,
  UserRole,
  jakartaDateTimeToUtc,
  shiftDateString,
  toJakartaDateString,
} from '@app/common';
import { OtpService } from '../auth/otp.service';

// Feature: Database Seeding & Default Demo Accounts — Purpose: Seeds initial demo accounts (1 HR_ADMIN, 3 verified EMPLOYEE accounts, 1 unverified account with demo OTP 123456), multi-day.
// OOP: Injectable Domain Service (Business Logic Encapsulation) — Connected To: Runs automatically on employee-service startup when `users` table is empty.
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(AttendanceRequest)
    private readonly attendanceReqRepo: Repository<AttendanceRequest>,
    @InjectRepository(AccessRequest)
    private readonly accessReqRepo: Repository<AccessRequest>,
    @InjectRepository(SupportTicket)
    private readonly supportTicketRepo: Repository<SupportTicket>,
    private readonly otpService: OtpService,
  ) {}

  // Feature: Database Seeding & Default Demo Accounts — Purpose: Lifecycle hook invoked once TypeORM is connected; seeds data only if no users exist yet.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: NestJS application bootstrap in employee-service.
  async onApplicationBootstrap(): Promise<void> {
    const existingCount = await this.userRepo.count();
    if (existingCount > 0) {
      const existingSysAdmin = await this.userRepo.findOne({ where: { role: UserRole.SYSTEM_ADMIN } });
      if (!existingSysAdmin) {
        this.logger.log('Provisioning System Administrator account (Abdurrahman Khairi <sysadmin@dexagroup.com>)...');
        const adminPasswordHash = await bcrypt.hash('AdminDexa2026!', 10);
        const sysUser = await this.userRepo.save(
          this.userRepo.create({
            email: 'sysadmin@dexagroup.com',
            passwordHash: adminPasswordHash,
            role: UserRole.SYSTEM_ADMIN,
            isVerified: true,
            isActive: true,
          }),
        );
        await this.employeeRepo.save(
          this.employeeRepo.create({
            userId: sysUser.id,
            employeeCode: 'DEXA-SYS-001',
            fullName: 'Abdurrahman Khairi',
            department: 'IT & Digital Innovation',
            position: 'Lead System Administrator',
            phoneNumber: '+62 811-0000-001',
            joinDate: '2020-01-01',
            status: EmployeeStatus.ACTIVE,
          }),
        );
        this.logger.log('System Administrator account provisioned successfully.');
      } else {
        this.logger.log(`Database already contains ${existingCount} user(s) and active System Administrator.`);
      }
      return;
    }

    this.logger.log('Seeding initial Dexa Group WFH Monitoring dataset...');
    const adminPasswordHash = await bcrypt.hash('AdminDexa2026!', 10);
    const empPasswordHash = await bcrypt.hash('EmployeeDexa2026!', 10);

    const seedAccounts = [
      {
        email: 'sysadmin@dexagroup.com',
        passwordHash: adminPasswordHash,
        role: UserRole.SYSTEM_ADMIN,
        isVerified: true,
        employeeCode: 'DEXA-SYS-001',
        fullName: 'Abdurrahman Khairi',
        department: 'IT & Digital Innovation',
        position: 'Lead System Administrator',
        phoneNumber: '+62 811-0000-001',
        joinDate: '2020-01-01',
      },
      {
        email: 'admin.hrd@dexagroup.com',
        passwordHash: adminPasswordHash,
        role: UserRole.HR_ADMIN,
        isVerified: true,
        employeeCode: 'DEXA-2026-001',
        fullName: 'Dr. Rina Kusuma, M.Psi',
        department: 'HRD & People Operations',
        position: 'Head of People & Culture',
        phoneNumber: '+62 811-9001-001',
        joinDate: '2021-03-15',
      },
      {
        email: 'budi.santoso@dexagroup.com',
        passwordHash: empPasswordHash,
        role: UserRole.EMPLOYEE,
        isVerified: true,
        employeeCode: 'DEXA-2026-002',
        fullName: 'Budi Santoso, S.Kom',
        department: 'IT & Digital Innovation',
        position: 'Senior Fullstack Engineer',
        phoneNumber: '+62 812-8800-102',
        joinDate: '2022-07-01',
      },
      {
        email: 'siti.rahmawati@dexagroup.com',
        passwordHash: empPasswordHash,
        role: UserRole.EMPLOYEE,
        isVerified: true,
        employeeCode: 'DEXA-2026-003',
        fullName: 'Siti Rahmawati, S.E.',
        department: 'Finance & Accounting',
        position: 'Corporate Financial Analyst',
        phoneNumber: '+62 813-7700-203',
        joinDate: '2023-01-10',
      },
      {
        email: 'andi.pratama@dexagroup.com',
        passwordHash: empPasswordHash,
        role: UserRole.EMPLOYEE,
        isVerified: true,
        employeeCode: 'DEXA-2026-004',
        fullName: 'apt. Andi Pratama, S.Farm',
        department: 'Quality Assurance & R&D',
        position: 'Pharmaceutical QA Specialist',
        phoneNumber: '+62 815-6600-304',
        joinDate: '2023-08-20',
      },
      {
        email: 'nadia.putri@dexagroup.com',
        passwordHash: empPasswordHash,
        role: UserRole.EMPLOYEE,
        isVerified: false, // Unverified demo account with pre-seeded OTP 123456
        employeeCode: 'DEXA-2026-005',
        fullName: 'Nadia Putri Maharani',
        department: 'IT & Digital Innovation',
        position: 'UI/UX Product Designer',
        phoneNumber: '+62 816-5500-405',
        joinDate: '2026-10-01',
      },
    ];

    const createdEmployees: Employee[] = [];
    let adminUser: User | null = null;

    for (const item of seedAccounts) {
      const user = await this.userRepo.save(
        this.userRepo.create({
          email: item.email,
          passwordHash: item.passwordHash,
          role: item.role,
          isVerified: item.isVerified,
          isActive: true,
        }),
      );
      if (item.role === UserRole.HR_ADMIN) {
        adminUser = user;
      }

      const employee = await this.employeeRepo.save(
        this.employeeRepo.create({
          userId: user.id,
          employeeCode: item.employeeCode,
          fullName: item.fullName,
          email: item.email,
          department: item.department,
          position: item.position,
          phoneNumber: item.phoneNumber,
          joinDate: item.joinDate,
          status: EmployeeStatus.ACTIVE,
          isActive: true,
        }),
      );
      createdEmployees.push(employee);

      if (!item.isVerified) {
        await this.otpService.issueOtp({
          userId: user.id,
          email: user.email,
          type: OtpType.ACCOUNT_VERIFICATION,
          fixedCode: '123456',
        });
      }
    }

    const today = toJakartaDateString();
    const yesterday = shiftDateString(today, -1);
    const twoDaysAgo = shiftDateString(today, -2);
    const threeDaysAgo = shiftDateString(today, -3);

    const [adminEmp, budiEmp, sitiEmp, andiEmp] = createdEmployees;

    const attendanceSeeds: Array<Partial<Attendance>> = [
      // Yesterday records (completed & late examples)
      {
        employeeId: budiEmp.id,
        attendanceDate: yesterday,
        clockInTime: jakartaDateTimeToUtc(yesterday, '08:12'),
        clockOutTime: jakartaDateTimeToUtc(yesterday, '17:32'),
        workDurationMinutes: 560,
        lateMinutes: 0,
        clockInPhotoUrl: this.buildDemoPhotoDataUri(budiEmp.employeeCode, budiEmp.fullName, `${yesterday} 08:12:10 WIB`, 'CLOCK-IN | LIVE WEBCAM'),
        clockOutPhotoUrl: this.buildDemoPhotoDataUri(budiEmp.employeeCode, budiEmp.fullName, `${yesterday} 17:32:04 WIB`, 'CLOCK-OUT | LIVE WEBCAM'),
        clockInPhotoCapturedAt: jakartaDateTimeToUtc(yesterday, '08:12'),
        clockOutPhotoCapturedAt: jakartaDateTimeToUtc(yesterday, '17:32'),
        photoCaptureSource: PhotoCaptureSource.LIVE_WEBCAM,
        clockOutCaptureSource: PhotoCaptureSource.LIVE_WEBCAM,
        isTimestampVerified: true,
        isClockOutTimestampVerified: true,
        dailyPlan: 'Implement NestJS TCP microservice handlers and TypeORM MySQL entities for WFH attendance.',
        dailyAccomplishment: 'Completed API Gateway JWT/RBAC guards, EXIF timestamp parser, and unit-tested all endpoints.',
        status: AttendanceStatus.COMPLETED,
        ipAddress: '103.144.12.88',
        deviceInfo: 'Chrome 130 / Windows 11 (WFH Workstation)',
      },
      {
        employeeId: sitiEmp.id,
        attendanceDate: yesterday,
        clockInTime: jakartaDateTimeToUtc(yesterday, '08:54'),
        clockOutTime: jakartaDateTimeToUtc(yesterday, '17:45'),
        workDurationMinutes: 531,
        lateMinutes: 24,
        clockInPhotoUrl: this.buildDemoPhotoDataUri(sitiEmp.employeeCode, sitiEmp.fullName, `${yesterday} 08:54:18 WIB`, 'CLOCK-IN | LIVE WEBCAM'),
        clockOutPhotoUrl: this.buildDemoPhotoDataUri(sitiEmp.employeeCode, sitiEmp.fullName, `${yesterday} 17:45:09 WIB`, 'CLOCK-OUT | LIVE WEBCAM'),
        clockInPhotoCapturedAt: jakartaDateTimeToUtc(yesterday, '08:54'),
        clockOutPhotoCapturedAt: jakartaDateTimeToUtc(yesterday, '17:45'),
        photoCaptureSource: PhotoCaptureSource.LIVE_WEBCAM,
        clockOutCaptureSource: PhotoCaptureSource.LIVE_WEBCAM,
        isTimestampVerified: true,
        isClockOutTimestampVerified: true,
        dailyPlan: 'Reconcile Q4 pharmaceutical distribution invoices and prepare monthly payroll allowance recap.',
        dailyAccomplishment: 'Finalized 38 vendor reconciliations and exported verified WFH attendance sheet for payroll.',
        status: AttendanceStatus.LATE,
        ipAddress: '114.122.40.19',
        deviceInfo: 'Edge 130 / Windows 11',
      },
      {
        employeeId: andiEmp.id,
        attendanceDate: yesterday,
        clockInTime: jakartaDateTimeToUtc(yesterday, '08:20'),
        clockOutTime: jakartaDateTimeToUtc(yesterday, '17:15'),
        workDurationMinutes: 535,
        lateMinutes: 0,
        clockInPhotoUrl: this.buildDemoPhotoDataUri(andiEmp.employeeCode, andiEmp.fullName, `${yesterday} 08:20:00 WIB`, 'CLOCK-IN | FILE UPLOAD (OLD EXIF)', '#D32F2F'),
        clockOutPhotoUrl: this.buildDemoPhotoDataUri(andiEmp.employeeCode, andiEmp.fullName, `${yesterday} 17:15:30 WIB`, 'CLOCK-OUT | LIVE WEBCAM'),
        clockInPhotoCapturedAt: jakartaDateTimeToUtc(threeDaysAgo, '09:00'),
        clockOutPhotoCapturedAt: jakartaDateTimeToUtc(yesterday, '17:15'),
        photoCaptureSource: PhotoCaptureSource.FILE_UPLOAD,
        clockOutCaptureSource: PhotoCaptureSource.LIVE_WEBCAM,
        isTimestampVerified: false, // Demonstrates unverified old file upload warning for HRD audit
        isClockOutTimestampVerified: true,
        dailyPlan: 'Review batch stability documentation and Good Manufacturing Practice (GMP) SOP updates.',
        dailyAccomplishment: 'Completed audit review for 12 stability dossiers and submitted QA sign-off report.',
        status: AttendanceStatus.COMPLETED,
        ipAddress: '182.253.88.14',
        deviceInfo: 'Chrome 130 / macOS Sonoma',
      },
      // Two days ago records
      {
        employeeId: budiEmp.id,
        attendanceDate: twoDaysAgo,
        clockInTime: jakartaDateTimeToUtc(twoDaysAgo, '08:18'),
        clockOutTime: jakartaDateTimeToUtc(twoDaysAgo, '17:25'),
        workDurationMinutes: 547,
        lateMinutes: 0,
        clockInPhotoUrl: this.buildDemoPhotoDataUri(budiEmp.employeeCode, budiEmp.fullName, `${twoDaysAgo} 08:18:11 WIB`, 'CLOCK-IN | LIVE WEBCAM'),
        clockOutPhotoUrl: this.buildDemoPhotoDataUri(budiEmp.employeeCode, budiEmp.fullName, `${twoDaysAgo} 17:25:40 WIB`, 'CLOCK-OUT | LIVE WEBCAM'),
        clockInPhotoCapturedAt: jakartaDateTimeToUtc(twoDaysAgo, '08:18'),
        clockOutPhotoCapturedAt: jakartaDateTimeToUtc(twoDaysAgo, '17:25'),
        photoCaptureSource: PhotoCaptureSource.LIVE_WEBCAM,
        clockOutCaptureSource: PhotoCaptureSource.LIVE_WEBCAM,
        isTimestampVerified: true,
        isClockOutTimestampVerified: true,
        dailyPlan: 'Design database schema ERD and microservice TCP message contracts.',
        dailyAccomplishment: 'Delivered ERD, Mermaid sequence diagrams, and Docker Compose orchestration.',
        status: AttendanceStatus.COMPLETED,
        ipAddress: '103.144.12.88',
        deviceInfo: 'Chrome 130 / Windows 11',
      },
      {
        employeeId: sitiEmp.id,
        attendanceDate: twoDaysAgo,
        clockInTime: jakartaDateTimeToUtc(twoDaysAgo, '08:22'),
        clockOutTime: jakartaDateTimeToUtc(twoDaysAgo, '17:18'),
        workDurationMinutes: 536,
        lateMinutes: 0,
        clockInPhotoUrl: this.buildDemoPhotoDataUri(sitiEmp.employeeCode, sitiEmp.fullName, `${twoDaysAgo} 08:22:05 WIB`, 'CLOCK-IN | LIVE WEBCAM'),
        clockOutPhotoUrl: this.buildDemoPhotoDataUri(sitiEmp.employeeCode, sitiEmp.fullName, `${twoDaysAgo} 17:18:22 WIB`, 'CLOCK-OUT | LIVE WEBCAM'),
        clockInPhotoCapturedAt: jakartaDateTimeToUtc(twoDaysAgo, '08:22'),
        clockOutPhotoCapturedAt: jakartaDateTimeToUtc(twoDaysAgo, '17:18'),
        photoCaptureSource: PhotoCaptureSource.LIVE_WEBCAM,
        clockOutCaptureSource: PhotoCaptureSource.LIVE_WEBCAM,
        isTimestampVerified: true,
        isClockOutTimestampVerified: true,
        dailyPlan: 'Prepare monthly tax withholding report and audit travel reimbursement claims.',
        dailyAccomplishment: 'Completed tax recapitulation and approved 19 employee reimbursement vouchers.',
        status: AttendanceStatus.COMPLETED,
        ipAddress: '114.122.40.19',
        deviceInfo: 'Edge 130 / Windows 11',
      },
      // Today active Clock-In for Siti (so HRD sees live today activity immediately, while Budi is free to test live Clock-In!)
      {
        employeeId: sitiEmp.id,
        attendanceDate: today,
        clockInTime: jakartaDateTimeToUtc(today, '08:16'),
        clockOutTime: null,
        workDurationMinutes: null,
        lateMinutes: 0,
        clockInPhotoUrl: this.buildDemoPhotoDataUri(sitiEmp.employeeCode, sitiEmp.fullName, `${today} 08:16:33 WIB`, 'CLOCK-IN | LIVE WEBCAM'),
        clockOutPhotoUrl: null,
        clockInPhotoCapturedAt: jakartaDateTimeToUtc(today, '08:16'),
        clockOutPhotoCapturedAt: null,
        photoCaptureSource: PhotoCaptureSource.LIVE_WEBCAM,
        clockOutCaptureSource: null,
        isTimestampVerified: true,
        isClockOutTimestampVerified: null,
        dailyPlan: 'Verify November payroll attendance deductions and finalize budget variance presentation.',
        dailyAccomplishment: null,
        status: AttendanceStatus.ON_TIME,
        ipAddress: '114.122.40.19',
        deviceInfo: 'Edge 130 / Windows 11',
      },
    ];

    for (const att of attendanceSeeds) {
      await this.attendanceRepo.save(this.attendanceRepo.create(att));
    }

    // Seed sample Leave / Correction Requests (Feature #8)
    await this.attendanceReqRepo.save([
      this.attendanceReqRepo.create({
        employeeId: andiEmp.id,
        requestType: AttendanceRequestType.CORRECTION,
        targetDate: threeDaysAgo,
        requestedClockIn: jakartaDateTimeToUtc(threeDaysAgo, '08:20'),
        requestedClockOut: jakartaDateTimeToUtc(threeDaysAgo, '17:10'),
        reason: 'Home fiber optic outage between 08:00-09:15 WIB during storm; attached ISP disruption ticket.',
        attachmentUrl: null,
        status: ApprovalStatus.PENDING,
      }),
      this.attendanceReqRepo.create({
        employeeId: budiEmp.id,
        requestType: AttendanceRequestType.LEAVE,
        targetDate: shiftDateString(today, 3),
        requestedClockIn: null,
        requestedClockOut: null,
        reason: 'Scheduled family event and annual leave allocation (1 day).',
        attachmentUrl: null,
        status: ApprovalStatus.APPROVED,
        reviewedById: adminUser?.id ?? null,
        reviewNotes: 'Approved — task handover confirmed with IT team lead.',
        reviewedAt: new Date(),
      }),
    ]);

    // Seed sample Pending Access Request (Feature #1)
    await this.accessReqRepo.save(
      this.accessReqRepo.create({
        fullName: 'Dimas Arya Wijaya, S.T.',
        email: 'dimas.wijaya@dexagroup.com',
        employeeCode: 'DEXA-2026-006',
        department: 'Supply Chain & Logistics',
        position: 'Supply Chain Data Engineer',
        phoneNumber: '+62 817-4400-506',
        reason: 'New joiner in Supply Chain Digitalization team requiring WFH attendance access.',
        status: ApprovalStatus.PENDING,
      }),
    );

    // Seed sample Support Ticket (Feature #10)
    await this.supportTicketRepo.save(
      this.supportTicketRepo.create({
        userId: adminEmp ? budiEmp.userId : null,
        senderEmail: budiEmp.email,
        senderName: budiEmp.fullName,
        category: SupportCategory.ATTENDANCE_ISSUE,
        moduleLocation: 'WFH Attendance - Camera Permission',
        subject: 'Guide for enabling webcam permission on corporate Chrome browser',
        message: 'Could IT/Developer team share the quick steps if Chrome blocks camera access on first prompt?',
        status: SupportTicketStatus.OPEN,
        emailDelivered: true,
      }),
    );

    this.logger.log('Initial Dexa Group WFH Monitoring dataset seeded successfully.');
  }

  // Feature: Database Seeding & Default Demo Accounts — Purpose: Generates an inline SVG data URI with realistic employee workstation illustration and burned-in timestamp watermark bar so.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Used by onApplicationBootstrap() above -> Rendered in frontend PhotoLightboxModal.tsx.
  private buildDemoPhotoDataUri(nip: string, name: string, timestampText: string, badgeText: string, accent = '#2563EB'): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0F172A"/>
          <stop offset="55%" stop-color="#1E3A8A"/>
          <stop offset="100%" stop-color="#1E293B"/>
        </linearGradient>
      </defs>
      <rect width="800" height="520" fill="url(#bg)"/>
      <rect x="40" y="34" width="180" height="32" rx="6" fill="#D32F2F"/>
      <text x="130" y="55" text-anchor="middle" fill="#FFFFFF" font-family="Segoe UI, Arial" font-size="13" font-weight="800" letter-spacing="1.2">DEXA GROUP WFH</text>
      <circle cx="400" cy="185" r="68" fill="#3B82F6" opacity="0.25"/>
      <circle cx="400" cy="170" r="36" fill="#93C5FD"/>
      <path d="M325 270 C325 222, 475 222, 475 270 L495 320 L305 320 Z" fill="#60A5FA"/>
      <rect x="260" y="290" width="280" height="18" rx="4" fill="#334155"/>
      <rect x="330" y="245" width="140" height="52" rx="8" fill="#E2E8F0"/>
      <circle cx="400" cy="271" r="8" fill="#1E40AF"/>
      <text x="400" y="355" text-anchor="middle" fill="#F8FAFC" font-family="Segoe UI, Arial" font-size="20" font-weight="700">${name}</text>
      <text x="400" y="382" text-anchor="middle" fill="#93C5FD" font-family="monospace" font-size="14">${nip} • Verified WFH Session</text>
      <rect x="0" y="420" width="800" height="100" fill="#020617" opacity="0.92"/>
      <rect x="0" y="420" width="800" height="4" fill="${accent}"/>
      <text x="28" y="452" fill="#38BDF8" font-family="monospace" font-size="15" font-weight="700">${timestampText} (Server Synced)</text>
      <text x="28" y="478" fill="#F8FAFC" font-family="Segoe UI, Arial" font-size="14" font-weight="600">${nip} | ${name} | [${badgeText}]</text>
      <text x="28" y="502" fill="#94A3B8" font-family="Segoe UI, Arial" font-size="11">© 2026 Abdurrahman Khairi - Created strictly for Technical Assessment evaluation</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
}
