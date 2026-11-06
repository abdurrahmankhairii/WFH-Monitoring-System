// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  ExportFileResult,
  ExportFormat,
  ExportPayload,
  StandardApiResponse,
  buildResponse,
  formatJakartaDateTime,
  toJakartaDateString,
} from '@app/common';
import { AttendanceService } from '../attendance/attendance.service';

// Feature: Data Export & Payroll Reporting — Purpose: Generates payroll-ready Excel (`.xlsx`) and CSV (`.csv`) attendance reports using `exceljs`.
// OOP: Injectable Domain Service (Business Logic Encapsulation) — Connected To: AttendanceServiceController (@MessagePattern ATTENDANCE_PATTERNS.EXPORT) -> api-gateway.
@Injectable()
export class ExportService {
  constructor(private readonly attendanceService: AttendanceService) {}

  // Feature: Data Export & Payroll Reporting — Purpose: Queries filtered attendance rows and formats them into a styled `.xlsx` or `.csv` file buffer encoded as base64 over TCP.
  // OOP: Domain Service Method (Encapsulated Business Operation) — Connected To: GET /api/attendances/export -> frontend AttendanceMonitoringPage.tsx export buttons.
  async exportAttendance(payload: ExportPayload): Promise<StandardApiResponse<ExportFileResult>> {
    const where = 'HRD Monitoring - Data Export';
    const { query } = payload;

    const rows = await this.attendanceService.buildFilteredQuery(query).take(5000).getMany();
    const dateStamp = toJakartaDateString();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Abdurrahman Khairi — Dexa Group WFH Monitoring System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('WFH Attendance Recap');

    sheet.columns = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'Date (WIB)', key: 'date', width: 14 },
      { header: 'Employee NIP', key: 'nip', width: 18 },
      { header: 'Full Name', key: 'fullName', width: 26 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Department', key: 'department', width: 24 },
      { header: 'Position', key: 'position', width: 24 },
      { header: 'Clock-In (WIB)', key: 'clockIn', width: 22 },
      { header: 'Clock-Out (WIB)', key: 'clockOut', width: 22 },
      { header: 'Duration (Mins)', key: 'durationMins', width: 16 },
      { header: 'Duration (Hrs)', key: 'durationHours', width: 15 },
      { header: 'Late (Mins)', key: 'lateMins', width: 13 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Photo Source', key: 'captureSource', width: 16 },
      { header: 'Timestamp Verified', key: 'verified', width: 18 },
      { header: 'Daily Plan (Clock-In Notes)', key: 'dailyPlan', width: 38 },
      { header: 'Daily Accomplishment (Clock-Out Notes)', key: 'dailyAccomplishment', width: 42 },
    ];

    // Style header row in Corporate Blue
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    rows.forEach((att, idx) => {
      const mins = att.workDurationMinutes ?? 0;
      const hrsFormatted = mins > 0 ? `${(mins / 60).toFixed(2)} hrs` : '-';
      sheet.addRow({
        no: idx + 1,
        date: att.attendanceDate,
        nip: att.employee?.employeeCode ?? '-',
        fullName: att.employee?.fullName ?? '-',
        email: att.employee?.email ?? '-',
        department: att.employee?.department ?? '-',
        position: att.employee?.position ?? '-',
        clockIn: formatJakartaDateTime(att.clockInTime),
        clockOut: formatJakartaDateTime(att.clockOutTime),
        durationMins: att.workDurationMinutes ?? 0,
        durationHours: hrsFormatted,
        lateMins: att.lateMinutes ?? 0,
        status: att.status,
        captureSource: att.photoCaptureSource ?? '-',
        verified: att.isTimestampVerified ? 'VERIFIED' : 'UNVERIFIED_WARNING',
        dailyPlan: att.dailyPlan ?? '-',
        dailyAccomplishment: att.dailyAccomplishment ?? '-',
      });
    });

    sheet.addRow({});
    sheet.addRow({
      date: '© 2026 Abdurrahman Khairi - Created strictly for Technical Assessment evaluation. Unauthorized commercial use is prohibited',
    });

    const isCsv = query.format === ExportFormat.CSV;
    const buffer = isCsv ? await workbook.csv.writeBuffer() : await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const ext = isCsv ? 'csv' : 'xlsx';
    const mimeType = isCsv
      ? 'text/csv; charset=utf-8'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const fileName = `Dexa_WFH_Attendance_Report_${dateStamp}.${ext}`;

    return buildResponse({
      where,
      what: `Exported ${rows.length} attendance record(s) to .${ext.toUpperCase()}`,
      why: `Generated payroll-ready ${ext.toUpperCase()} file (${fileName}) with working duration, status, and photo verification flags.`,
      data: {
        fileName,
        mimeType,
        base64,
        rowCount: rows.length,
      },
    });
  }
}
