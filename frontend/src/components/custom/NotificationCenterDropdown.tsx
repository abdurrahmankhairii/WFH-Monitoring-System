// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Calendar,
  CheckCheck,
  CheckCircle2,
  Clock,
  Info,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { ToastItem, useToast } from '../../context/ToastContext';

// Feature: Headbar Notification Center Dropdown — Purpose: Right-aligned enterprise notification dropdown panel displaying business events.
// OOP: Reusable UI Component (Encapsulated View & State) — Connected To: Mounted in AppLayout.tsx headbar, consumes ToastContext.
export const NotificationCenterDropdown: React.FC = () => {
  const { history, unreadCount, markAllHistoryAsRead, markItemAsRead, clearHistory } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'UNREAD'>('ALL');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Feature: Headbar Notification Center Dropdown — Purpose: Toggles dropdown open/close state.
  // OOP: UI Event Handler Method — Connected To: Notification bell button click event.
  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  // Feature: Headbar Notification Center Dropdown — Purpose: Formats epoch timestamps into human-friendly relative time strings.
  // OOP: Stateless Formatting Helper — Connected To: Item timestamp rendering.
  const formatTimeAgo = (createdAt: number) => {
    const diffSec = Math.max(1, Math.floor((Date.now() - createdAt) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(createdAt));
  };

  // Feature: Headbar Notification Center Dropdown — Purpose: Resolves semantic event icon based on notification type and domain.
  // OOP: Factory Method Pattern (Icon Mapper) — Connected To: Rendered beside each notification row.
  const getItemIcon = (item: ToastItem) => {
    if (item.type === 'error') {
      return <ShieldAlert className="w-4 h-4 text-[#D32F2F] dark:text-rose-400 shrink-0" />;
    }
    const lowerWhere = (item.where || '').toLowerCase();
    const lowerWhat = (item.what || '').toLowerCase();
    if (lowerWhere.includes('leave') || lowerWhat.includes('leave')) {
      return <Calendar className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />;
    }
    if (lowerWhere.includes('correction') || lowerWhat.includes('adjustment') || lowerWhat.includes('clock')) {
      return <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />;
    }
    if (item.type === 'success') {
      return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
    }
    return <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />;
  };

  const filteredHistory =
    filterTab === 'UNREAD' ? history.filter((item) => !item.read) : history;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        title="Notification Center"
        aria-label="Open Notification Center"
        className="taste-btn relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D32F2F] text-white text-[10px] font-semibold font-sans tabular-nums flex items-center justify-center shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <span className="font-sans text-sm font-semibold text-slate-900 dark:text-white">
                Notification Center
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {history.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={markAllHistoryAsRead}
                    title="Mark all as read"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={clearHistory}
                    title="Clear notification history"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-[#D32F2F] dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Filter Tabs (All / Unread) */}
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-xs bg-white dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setFilterTab('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterTab === 'ALL'
                  ? 'bg-[#0A2D62] dark:bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('UNREAD')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                filterTab === 'UNREAD'
                  ? 'bg-[#0A2D62] dark:bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold tabular-nums ${
                    filterTab === 'UNREAD'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {filteredHistory.length === 0 ? (
              <div className="py-10 px-4 text-center text-xs text-slate-400 dark:text-slate-500">
                {filterTab === 'UNREAD' ? 'No unread notifications.' : 'No notifications yet.'}
              </div>
            ) : (
              filteredHistory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => markItemAsRead(item.id)}
                  className={`p-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex items-start gap-3 cursor-pointer ${
                    !item.read ? 'bg-blue-50/25 dark:bg-blue-950/20' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{getItemIcon(item)}</div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-sans text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {item.what}
                      </span>
                      <span className="font-sans text-[11px] font-normal text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </div>
                    <p className="font-sans text-xs font-normal text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {item.why}
                    </p>
                  </div>
                  {!item.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
