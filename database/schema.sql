-- ============================================================================
-- Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
-- Created strictly for Technical Assessment evaluation.
-- Unauthorized commercial use, modification, or distribution is prohibited.
-- ============================================================================
-- WFH Attendance & Employee Monitoring System — Database Schema (DDL)
-- Target DBMS: MySQL 8.0+
-- Collation: utf8mb4_0900_ai_ci
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `dexa_wfh_db` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_0900_ai_ci;

USE `dexa_wfh_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. Table: users
-- Core authentication and RBAC credential identity table
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` VARCHAR(36) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('SYSTEM_ADMIN','HR_ADMIN','MANAGER','EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
  `is_verified` TINYINT NOT NULL DEFAULT 0,
  `is_active` TINYINT NOT NULL DEFAULT 1,
  `last_login_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 2. Table: departments
-- Master organizational departments, managers, and WFH quotas
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `departments`;
CREATE TABLE `departments` (
  `id` VARCHAR(36) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `manager_name` VARCHAR(150) DEFAULT NULL,
  `manager_email` VARCHAR(150) DEFAULT NULL,
  `hr_pic_email` VARCHAR(150) DEFAULT 'admin.hrd@dexagroup.com',
  `max_wfh_days_per_week` INT NOT NULL DEFAULT 1,
  `is_active` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_departments_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 3. Table: employees
-- Master workforce records, 512-D ArcFace biometrics, salary, and geofence
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `employees`;
CREATE TABLE `employees` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) DEFAULT NULL,
  `department_id` VARCHAR(36) DEFAULT NULL,
  `employee_code` VARCHAR(50) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `department` VARCHAR(100) NOT NULL,
  `position` VARCHAR(100) NOT NULL,
  `phone_number` VARCHAR(30) DEFAULT NULL,
  `status` ENUM('ACTIVE','ON_LEAVE','SUSPENDED','TERMINATED') NOT NULL DEFAULT 'ACTIVE',
  `join_date` DATE NOT NULL,
  `face_photo_url` TEXT,
  `face_embedding` JSON DEFAULT NULL,
  `face_enrolled_at` DATETIME DEFAULT NULL,
  `base_salary` BIGINT DEFAULT 12000000,
  `home_latitude` DECIMAL(10,8) DEFAULT NULL,
  `home_longitude` DECIMAL(11,8) DEFAULT NULL,
  `home_address` TEXT,
  `is_active` TINYINT NOT NULL DEFAULT 1,
  `deleted_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_employees_code` (`employee_code`),
  UNIQUE KEY `UQ_employees_email` (`email`),
  UNIQUE KEY `UQ_employees_user_id` (`user_id`),
  KEY `IDX_employees_status` (`status`),
  KEY `IDX_employees_department` (`department`),
  KEY `FK_employees_department` (`department_id`),
  CONSTRAINT `FK_employees_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_employees_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 4. Table: attendances
-- Authoritative daily attendance sessions, biometric cosine similarity & overtime
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `attendances`;
CREATE TABLE `attendances` (
  `id` VARCHAR(36) NOT NULL,
  `employee_id` VARCHAR(36) NOT NULL,
  `attendance_date` DATE NOT NULL,
  `clock_in_time` DATETIME DEFAULT NULL,
  `clock_out_time` DATETIME DEFAULT NULL,
  `work_duration_minutes` INT DEFAULT NULL,
  `late_minutes` INT NOT NULL DEFAULT 0,
  `clock_in_photo_url` TEXT,
  `clock_out_photo_url` TEXT,
  `clock_in_photo_captured_at` DATETIME DEFAULT NULL,
  `clock_out_photo_captured_at` DATETIME DEFAULT NULL,
  `photo_capture_source` ENUM('LIVE_WEBCAM','FILE_UPLOAD') DEFAULT NULL,
  `clock_out_capture_source` ENUM('LIVE_WEBCAM','FILE_UPLOAD') DEFAULT NULL,
  `is_timestamp_verified` TINYINT NOT NULL DEFAULT 0,
  `is_clock_out_timestamp_verified` TINYINT DEFAULT NULL,
  `verification_method` ENUM('LIVE_CAMERA_LIVENESS','MANUAL_FILE_UPLOAD') NOT NULL DEFAULT 'LIVE_CAMERA_LIVENESS',
  `verification_status` ENUM('VERIFIED_LIVE_BIOMETRIC','MANUAL_FACE_MATCHED_PENDING_REVIEW','BIOMETRIC_FAILED_REJECTED') NOT NULL DEFAULT 'VERIFIED_LIVE_BIOMETRIC',
  `status` ENUM('ON_TIME','LATE','HALF_DAY','COMPLETED','MISSING_CLOCK_OUT','ON_LEAVE','SICK') NOT NULL DEFAULT 'ON_TIME',
  `daily_plan` TEXT,
  `clock_out_notes` TEXT,
  `device_issue_reason` TEXT,
  `wfh_approved` TINYINT NOT NULL DEFAULT 0,
  `similarity_score` DOUBLE DEFAULT NULL,
  `clock_out_similarity_score` DOUBLE DEFAULT NULL,
  `photo_sha256` VARCHAR(64) DEFAULT NULL,
  `photo_phash` VARCHAR(16) DEFAULT NULL,
  `overtime_minutes` INT NOT NULL DEFAULT 0,
  `overtime_pay_amount` BIGINT NOT NULL DEFAULT 0,
  `overtime_multiplier_hours` DOUBLE NOT NULL DEFAULT 0,
  `latitude` DECIMAL(10,8) DEFAULT NULL,
  `longitude` DECIMAL(11,8) DEFAULT NULL,
  `location_address` TEXT,
  `distance_from_home_meters` INT DEFAULT NULL,
  `location_status` ENUM('IN_HOME_RADIUS','OUT_OF_HOME_RADIUS','LOCATION_UNAVAILABLE') NOT NULL DEFAULT 'LOCATION_UNAVAILABLE',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_employee_attendance_date` (`employee_id`,`attendance_date`),
  KEY `IDX_attendances_date` (`attendance_date`),
  KEY `IDX_attendances_status` (`status`),
  CONSTRAINT `FK_attendances_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 5. Table: attendance_requests
-- Workflow requests (WFH Approval, Overtime, Leave, Sick, Correction)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `attendance_requests`;
CREATE TABLE `attendance_requests` (
  `id` VARCHAR(36) NOT NULL,
  `employee_id` VARCHAR(36) NOT NULL,
  `request_type` ENUM('WFH_APPROVAL','OVERTIME','LEAVE','SICK','CORRECTION') NOT NULL,
  `target_date` DATE NOT NULL,
  `requested_clock_in` DATETIME DEFAULT NULL,
  `requested_clock_out` DATETIME DEFAULT NULL,
  `reason` TEXT NOT NULL,
  `attachment_url` TEXT,
  `status` ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `reviewed_by` VARCHAR(36) DEFAULT NULL,
  `review_notes` TEXT,
  `reviewed_at` DATETIME DEFAULT NULL,
  `overtime_minutes` INT DEFAULT NULL,
  `estimated_overtime_pay` BIGINT DEFAULT NULL,
  `manager_email` VARCHAR(150) DEFAULT NULL,
  `cc_emails` VARCHAR(300) DEFAULT NULL,
  `email_dispatched` TINYINT NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_att_req_status` (`status`),
  KEY `IDX_att_req_employee_date` (`employee_id`,`target_date`),
  KEY `FK_att_req_reviewed_by` (`reviewed_by`),
  CONSTRAINT `FK_att_req_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `FK_att_req_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 6. Table: access_requests
-- Public employee onboarding requests awaiting HR approval
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `access_requests`;
CREATE TABLE `access_requests` (
  `id` VARCHAR(36) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `employee_code` VARCHAR(50) DEFAULT NULL,
  `department` VARCHAR(100) NOT NULL,
  `position` VARCHAR(100) NOT NULL,
  `phone_number` VARCHAR(30) DEFAULT NULL,
  `reason` TEXT,
  `status` ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `reviewed_by` VARCHAR(36) DEFAULT NULL,
  `review_notes` TEXT,
  `reviewed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_access_req_email_status` (`email`,`status`),
  KEY `FK_access_req_reviewed_by` (`reviewed_by`),
  CONSTRAINT `FK_access_req_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 7. Table: otp_codes
-- 6-digit email OTP codes for account verification & password reset
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `otp_codes`;
CREATE TABLE `otp_codes` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `code_hash` VARCHAR(255) NOT NULL,
  `type` ENUM('ACCOUNT_VERIFICATION','FORGOT_PASSWORD') NOT NULL,
  `attempts` INT NOT NULL DEFAULT 0,
  `expires_at` DATETIME NOT NULL,
  `used_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_otp_email_type` (`email`,`type`),
  KEY `FK_otp_user` (`user_id`),
  CONSTRAINT `FK_otp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 8. Table: support_tickets
-- Internal developer support tickets with targeted SMTP routing
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `support_tickets`;
CREATE TABLE `support_tickets` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) DEFAULT NULL,
  `sender_email` VARCHAR(150) NOT NULL,
  `sender_name` VARCHAR(150) NOT NULL,
  `category` ENUM('BUG','ACCOUNT_ACCESS','ATTENDANCE_ISSUE','OTHER') NOT NULL,
  `module_location` VARCHAR(150) NOT NULL,
  `subject` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `status` ENUM('OPEN','RESOLVED') NOT NULL DEFAULT 'OPEN',
  `email_delivered` TINYINT NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_support_status` (`status`),
  KEY `FK_support_user` (`user_id`),
  CONSTRAINT `FK_support_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- 9. Table: system_settings
-- Global singleton system configuration (WFH mode, Overtime toggle, Quotas)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `system_settings`;
CREATE TABLE `system_settings` (
  `id` VARCHAR(50) NOT NULL DEFAULT 'DEFAULT',
  `wfh_workflow_mode` ENUM('STRICT_APPROVAL','NOTICE_ONLY') NOT NULL DEFAULT 'STRICT_APPROVAL',
  `enable_overtime` TINYINT NOT NULL DEFAULT 1,
  `max_wfh_days_per_week` INT NOT NULL DEFAULT 1,
  `updated_by_email` VARCHAR(150) DEFAULT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
