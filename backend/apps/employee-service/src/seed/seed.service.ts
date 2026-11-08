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
  Department,
  Employee,
  EmployeeStatus,
  OtpType,
  PhotoCaptureSource,
  SupportCategory,
  SupportTicket,
  SupportTicketStatus,
  User,
  UserRole,
  calculateOvertimeAndPay,
  jakartaDateTimeToUtc,
  shiftDateString,
  toJakartaDateString,
} from '@app/common';
import { OtpService } from '../auth/otp.service';

// Feature: Database Seeding & Default Demo Accounts — Purpose: Seeds initial departments (with manager emails & 1-day/week WFH quota), demo accounts, attendance, and overtime records.
// OOP: Injectable Domain Service (Business Logic Encapsulation) — Connected To: Runs automatically on employee-service startup.
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
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

  // Feature: Master Department & Salary Seeding — Purpose: Ensures the departments table has all Dexa Group departments with manager emails and links existing employees.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: Invoked during onApplicationBootstrap().
  private async ensureDepartmentsAndPayrollBackfill(): Promise<Map<string, Department>> {
    const defaultDepartments = [
      {
        code: 'DEPT-IT',
        name: 'IT & Digital Innovation',
        managerName: 'Ir. Hendra Wijaya, M.Kom',
        managerEmail: 'manager.it@dexagroup.com',
        hrPicEmail: 'admin.hrd@dexagroup.com',
        maxWfhDaysPerWeek: 1,
      },
      {
        code: 'DEPT-HRD',
        name: 'HRD & People Operations',
        managerName: 'Dr. Rina Kusuma, M.Psi',
        managerEmail: 'admin.hrd@dexagroup.com',
        hrPicEmail: 'admin.hrd@dexagroup.com',
        maxWfhDaysPerWeek: 1,
      },
      {
        code: 'DEPT-FIN',
        name: 'Finance & Accounting',
        managerName: 'Drs. Bambang Hartono, Ak., CA',
        managerEmail: 'manager.finance@dexagroup.com',
        hrPicEmail: 'admin.hrd@dexagroup.com',
        maxWfhDaysPerWeek: 1,
      },
      {
        code: 'DEPT-QA',
        name: 'Quality Assurance & R&D',
        managerName: 'apt. Ratna Dewi, M.Farm',
        managerEmail: 'manager.qa@dexagroup.com',
        hrPicEmail: 'admin.hrd@dexagroup.com',
        maxWfhDaysPerWeek: 1,
      },
      {
        code: 'DEPT-SCM',
        name: 'Supply Chain & Logistics',
        managerName: 'Ir. Gunawan Saputra, M.T.',
        managerEmail: 'manager.scm@dexagroup.com',
        hrPicEmail: 'admin.hrd@dexagroup.com',
        maxWfhDaysPerWeek: 1,
      },
    ];

    const deptMap = new Map<string, Department>();
    for (const d of defaultDepartments) {
      let existing = await this.departmentRepo.findOne({ where: { name: d.name } });
      if (!existing) {
        existing = await this.departmentRepo.save(this.departmentRepo.create({ ...d, isActive: true }));
      }
      deptMap.set(d.name, existing);
    }

    const salaryByCode: Record<string, number> = {
      'DEXA-SYS-001': 22000000,
      'DEXA-2026-001': 20000000,
      'DEXA-2026-002': 16500000,
      'DEXA-2026-003': 13500000,
      'DEXA-2026-004': 14500000,
      'DEXA-2026-005': 12500000,
    };

    const employees = await this.employeeRepo.find({ withDeleted: true });
    for (const emp of employees) {
      const matchedDept = deptMap.get(emp.department);
      const targetSalary = salaryByCode[emp.employeeCode] ?? emp.baseSalary ?? 12000000;
      if ((matchedDept && emp.departmentId !== matchedDept.id) || emp.baseSalary !== targetSalary) {
        emp.departmentId = matchedDept?.id ?? emp.departmentId;
        emp.baseSalary = targetSalary;
        await this.employeeRepo.save(emp);
      }
    }

    // Backfill sample overtime on Budi's completed session if overtimePayAmount is still 0
    const budi = employees.find((e) => e.employeeCode === 'DEXA-2026-002');
    if (budi) {
      const budiSessions = await this.attendanceRepo.find({ where: { employeeId: budi.id } });
      for (const att of budiSessions) {
        if (att.workDurationMinutes && att.workDurationMinutes >= 560 && att.overtimePayAmount === 0) {
          att.workDurationMinutes = 630; // 10.5h gross -> 90 mins overtime
          const ot = calculateOvertimeAndPay(90, budi.baseSalary);
          att.overtimeMinutes = ot.overtimeMinutes;
          att.overtimeMultiplierHours = ot.overtimeMultiplierHours;
          att.overtimePayAmount = ot.overtimePayAmount;
          att.wfhApproved = true;
          await this.attendanceRepo.save(att);
          break;
        }
      }

      const wfhReqCount = await this.attendanceReqRepo.count({
        where: { requestType: AttendanceRequestType.WFH_APPROVAL },
      });
      if (wfhReqCount === 0) {
        const today = toJakartaDateString();
        const itDept = deptMap.get('IT & Digital Innovation');
        const finDept = deptMap.get('Finance & Accounting');
        const siti = employees.find((e) => e.employeeCode === 'DEXA-2026-003');
        const budiOt = calculateOvertimeAndPay(90, budi.baseSalary);
        await this.attendanceReqRepo.save(
          this.attendanceReqRepo.create({
            employeeId: budi.id,
            requestType: AttendanceRequestType.WFH_APPROVAL,
            targetDate: shiftDateString(today, -8),
            reason: 'Weekly 1-day hybrid WFH quota for sprint backend microservice deployment and database optimization.',
            managerEmail: itDept?.managerEmail ?? 'manager.it@dexagroup.com',
            ccEmails: 'admin.hrd@dexagroup.com, budi.santoso@dexagroup.com',
            emailDispatched: true,
            status: ApprovalStatus.APPROVED,
            reviewNotes: 'Approved within 1-day/week department WFH quota by IT Manager & HRD.',
            reviewedAt: new Date(),
          }),
        );
        await this.attendanceReqRepo.save(
          this.attendanceReqRepo.create({
            employeeId: budi.id,
            requestType: AttendanceRequestType.OVERTIME,
            targetDate: shiftDateString(today, -1),
            overtimeMinutes: 90,
            estimatedOvertimePay: budiOt.overtimePayAmount,
            reason: 'Production deployment hotfix and post-release database indexing (17:30 - 19:00 WIB).',
            managerEmail: itDept?.managerEmail ?? 'manager.it@dexagroup.com',
            ccEmails: 'admin.hrd@dexagroup.com, budi.santoso@dexagroup.com',
            emailDispatched: true,
            status: ApprovalStatus.APPROVED,
            reviewNotes: 'Approved 90m overtime (2.5x multiplier hours = IDR 238,439) for payroll cycle.',
            reviewedAt: new Date(),
          }),
        );
        if (siti) {
          await this.attendanceReqRepo.save(
            this.attendanceReqRepo.create({
              employeeId: siti.id,
              requestType: AttendanceRequestType.WFH_APPROVAL,
              targetDate: today,
              reason: 'Weekly Hybrid WFH (1 Day/Week): Completing monthly tax reconciliation & Q4 audit ledger from home workstation.',
              managerEmail: finDept?.managerEmail ?? 'manager.finance@dexagroup.com',
              ccEmails: 'admin.hrd@dexagroup.com, siti.rahma@dexagroup.com',
              emailDispatched: true,
              status: ApprovalStatus.PENDING,
            }),
          );
        }
      }
    }

    return deptMap;
  }

  // Feature: Database Seeding & Default Demo Accounts — Purpose: Lifecycle hook invoked once TypeORM is connected; seeds data and ensures departments exist.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: NestJS application bootstrap in employee-service.
  async onApplicationBootstrap(): Promise<void> {
    const existingCount = await this.userRepo.count();
    if (existingCount > 0) {
      await this.ensureDepartmentsAndPayrollBackfill();
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
            email: 'sysadmin@dexagroup.com',
            department: 'IT & Digital Innovation',
            position: 'Lead System Administrator',
            baseSalary: 22000000,
            phoneNumber: '+62 811-0000-001',
            joinDate: '2020-01-01',
            status: EmployeeStatus.ACTIVE,
          }),
        );
        await this.ensureDepartmentsAndPayrollBackfill();
      } else {
        this.logger.log(`Database already contains ${existingCount} user(s), departments, and active System Administrator.`);
      }
      return;
    }

    this.logger.log('Seeding initial Dexa Group WFH Monitoring dataset...');
    const deptMap = await this.ensureDepartmentsAndPayrollBackfill();
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
        baseSalary: 22000000,
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
        baseSalary: 20000000,
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
        baseSalary: 16500000,
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
        baseSalary: 13500000,
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
        baseSalary: 14500000,
        phoneNumber: '+62 815-6600-304',
        joinDate: '2023-08-20',
      },
      {
        email: 'nadia.putri@dexagroup.com',
        passwordHash: empPasswordHash,
        role: UserRole.EMPLOYEE,
        isVerified: false,
        employeeCode: 'DEXA-2026-005',
        fullName: 'Nadia Putri Maharani',
        department: 'IT & Digital Innovation',
        position: 'UI/UX Product Designer',
        baseSalary: 12500000,
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

      const dept = deptMap.get(item.department);
      const employee = await this.employeeRepo.save(
        this.employeeRepo.create({
          userId: user.id,
          employeeCode: item.employeeCode,
          fullName: item.fullName,
          email: item.email,
          department: item.department,
          departmentId: dept?.id ?? null,
          position: item.position,
          baseSalary: item.baseSalary,
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

    await this.ensureDepartmentsAndPayrollBackfill();
    this.logger.log('Initial Dexa Group WFH Monitoring dataset seeded successfully.');
  }
}
