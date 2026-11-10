// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  CheckSquare,
  Camera,
  ChevronDown,
  ClipboardList,
  Database,
  History,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  ShieldCheck,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ContactDeveloperModal } from '../custom/ContactDeveloperModal';
import { CopyrightFooterWatermark } from '../custom/CopyrightFooterWatermark';
import { DexaBrandLogo } from '../custom/DexaBrandLogo';
import { LiveServerClock } from '../custom/LiveServerClock';
import { NotificationCenterDropdown } from '../custom/NotificationCenterDropdown';
import { ThemeToggle } from '../custom/ThemeToggle';

// Feature: Collapsible Window Sidebar & Top Headbar Shell — Purpose: Primary application shell featuring collapsible navy window sidebar and top headbar.
// OOP: Layout Composition Component (Structural Wrapper) — Connected To: Wraps all authenticated routes in frontend/src/App.tsx; consumes AuthContext and ThemeContext.
export const AppLayout: React.FC = () => {
  const { user, isAdmin, isManager, isSystemAdmin, logout } = useAuth();
  const location = useLocation();
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!user) return null;

  const managerLinks = [
    {
      to: '/manager/approvals',
      label: 'WFH & Leave Approvals',
      icon: CheckSquare,
    },
    {
      to: '/hrd/monitoring',
      label: 'Team Attendance',
      icon: ClipboardList,
    },
  ];

  const employeeLinks = [
    {
      to: '/employee/dashboard',
      label: 'My Analytics',
      icon: BarChart3,
    },
    {
      to: '/employee/attendance',
      label: 'Clock-In / Out',
      icon: Camera,
    },
    {
      to: '/employee/history',
      label: 'My Attendance & Leave',
      icon: History,
    },
  ];

  const adminLinks = isSystemAdmin
    ? [
        {
          to: '/system/database',
          label: 'Database Management',
          icon: Database,
        },
        {
          to: '/hrd/dashboard',
          label: 'HRD Dashboard',
          icon: LayoutDashboard,
        },
        {
          to: '/manager/approvals',
          label: 'WFH & Leave Approvals',
          icon: CheckSquare,
        },
        {
          to: '/hrd/monitoring',
          label: 'Attendance Audit & Export',
          icon: ClipboardList,
        },
        {
          to: '/hrd/employees',
          label: 'Master Employees',
          icon: Users,
        },
      ]
    : [
        {
          to: '/hrd/dashboard',
          label: 'HRD Dashboard',
          icon: LayoutDashboard,
        },
        {
          to: '/manager/approvals',
          label: 'WFH & Leave Approvals',
          icon: CheckSquare,
        },
        {
          to: '/hrd/monitoring',
          label: 'Attendance Audit & Export',
          icon: ClipboardList,
        },
        {
          to: '/hrd/employees',
          label: 'Master Employees',
          icon: Users,
        },
      ];

  const handleMobileNavClick = () => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden print:h-auto print:overflow-visible flex flex-col bg-[#f8f8f6] dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Top Corporate Brand Accent Line */}
      <div className="no-print h-1 bg-gradient-to-r from-[#D32F2F] via-[#0A2D62] to-blue-600 shrink-0" />

      {/* Top Headbar */}
      <header className="no-print z-40 h-16 shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-3 shadow-sm">
        {/* Left: Window Sidebar Toggle + Official Dexa Group Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            title={isSidebarOpen ? 'Collapse navigation sidebar' : 'Expand navigation sidebar'}
            aria-label="Toggle navigation sidebar"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 transition-colors"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <DexaBrandLogo variant="auto" size="md" showSubtitle />
        </div>

        {/* Right: Server Date/Time, Dark/Light Toggle, Notification Center, Support, and User Account */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden xl:block">
            <LiveServerClock compact />
          </div>

          <ThemeToggle />

          <NotificationCenterDropdown />

          {/* User Account Dropdown */}
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => setAccountMenuOpen((prev) => !prev)}
              aria-expanded={accountMenuOpen}
              className="taste-btn flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#0A2D62] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="text-left hidden md:block">
                <div className="text-xs font-semibold leading-tight text-slate-800 dark:text-slate-100 font-sans">
                  {user.fullName}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight font-sans">
                  {user.employeeCode || user.role}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {accountMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl py-2 z-50 divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                <div className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-sans text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {user.fullName}
                    </span>
                    <span className="font-sans text-[11px] font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/80 dark:border-blue-800/80 shrink-0">
                      {user.role === 'EMPLOYEE' ? 'Employee' : user.role === 'HR_ADMIN' ? 'HR Admin' : user.role === 'MANAGER' ? 'Manager' : 'System Admin'}
                    </span>
                  </div>
                  <div className="font-sans text-xs font-normal text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {user.email}
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
                    <div className="font-sans text-xs font-medium text-slate-700 dark:text-slate-200">
                      {user.position}
                    </div>
                    <div className="font-sans text-xs font-normal text-slate-500 dark:text-slate-400">
                      {user.department}
                    </div>
                  </div>
                </div>

                <div className="py-1">
                  <NavLink
                    to="/profile"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <UserCircle className="w-4 h-4 text-slate-400" />
                    <span>My Profile &amp; Security</span>
                  </NavLink>

                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setSupportModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <LifeBuoy className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <span>Contact Developer Support</span>
                  </button>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-1 mt-1 px-1.5 pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area with Static Viewport-Height Left Window Sidebar & Scrollable Body */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden print:overflow-visible">
        {/* Mobile Backdrop when Sidebar is open on small screens */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="no-print fixed inset-0 top-[4.25rem] z-20 bg-slate-950/50 backdrop-blur-xs lg:hidden"
          />
        )}

        {/* Left Collapsible Window Sidebar (Static Viewport Height, Never Scrolls With Body) */}
        <aside
          aria-label="Primary Navigation Sidebar"
          className={`no-print fixed top-[4.25rem] bottom-0 left-0 lg:static lg:h-full z-30 flex flex-col bg-gradient-to-b from-[#0A2D62] to-[#1a3d6e] dark:from-slate-900 dark:to-slate-950 text-white border-r border-blue-900/40 dark:border-slate-800 transition-all duration-300 ease-in-out overflow-hidden shrink-0 ${
            isSidebarOpen
              ? 'w-64 translate-x-0 shadow-2xl lg:shadow-none'
              : 'w-0 -translate-x-full lg:w-0 lg:translate-x-0 border-r-0'
          }`}
        >
          <div className="w-64 h-full flex flex-col justify-between p-4 overflow-hidden">
            <nav className="flex-1 min-h-0 overflow-y-auto space-y-5 pt-1 pr-0.5">
              {/* HRD Admin / System Admin Portal Section */}
              {isAdmin && (
                <div className="space-y-1">
                  <div className="px-3 pb-1.5 text-[11px] font-medium text-blue-200/75">
                    {isSystemAdmin ? 'System & HRD Administration' : 'HRD Administration'}
                  </div>
                  {adminLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={handleMobileNavClick}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-white text-[#0A2D62] shadow-sm font-semibold'
                              : 'text-blue-100/85 hover:bg-white/10 hover:text-white'
                          }`
                        }
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}

              {/* Department Manager Portal Section */}
              {isManager && (
                <div className="space-y-1">
                  <div className="px-3 pb-1.5 text-[11px] font-medium text-blue-200/75">
                    Department Management
                  </div>
                  {managerLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={handleMobileNavClick}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-white text-[#0A2D62] shadow-sm font-semibold'
                              : 'text-blue-100/85 hover:bg-white/10 hover:text-white'
                          }`
                        }
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}

              {/* Employee WFH Self-Service Section — Excluded for SYSTEM_ADMIN (Separation of Duties) */}
              {!isSystemAdmin && (
                <div className="space-y-1">
                  <div className="px-3 pb-1.5 text-[11px] font-medium text-blue-200/75">
                    {isManager ? 'My Self-Service' : 'Employee WFH Self-Service'}
                  </div>
                  {employeeLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={handleMobileNavClick}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-white text-[#0A2D62] shadow-sm font-semibold'
                              : 'text-blue-100/85 hover:bg-white/10 hover:text-white'
                          }`
                        }
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}

              {/* Account & Support Section */}
              <div className="space-y-1">
                <div className="px-3 pb-1.5 text-[11px] font-medium text-blue-200/75">
                  Account &amp; Help
                </div>
                <NavLink
                  to="/profile"
                  onClick={handleMobileNavClick}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-white text-[#0A2D62] shadow-sm font-semibold'
                        : 'text-blue-100/85 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <UserCircle className="w-4 h-4 shrink-0" />
                  <span>My Profile &amp; Security</span>
                </NavLink>

                <button
                  type="button"
                  onClick={() => {
                    handleMobileNavClick();
                    setSupportModalOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-blue-100/85 hover:bg-white/10 hover:text-white transition-all"
                >
                  <LifeBuoy className="w-4 h-4 shrink-0 text-rose-300" />
                  <span>Contact Developer</span>
                </button>
              </div>
            </nav>

            {/* Sidebar Bottom Actions (Pinned to Bottom of Viewport) */}
            <div className="pt-3 mt-2 border-t border-white/10 shrink-0 space-y-2">
              <div className="xl:hidden">
                <LiveServerClock compact />
              </div>
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-[#D32F2F] text-white text-xs font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Scrollable Body Viewport (Scrolls Independently of Sidebar & Headbar) */}
        <div
          ref={mainScrollRef}
          className="flex-1 min-w-0 h-full overflow-y-auto print:h-auto print:overflow-visible flex flex-col"
        >
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </main>

          <CopyrightFooterWatermark variant="default" />
        </div>
      </div>

      {/* Contact Developer Support Modal */}
      <ContactDeveloperModal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        defaultModuleLocation={`Route ${location.pathname}`}
      />
    </div>
  );
};
