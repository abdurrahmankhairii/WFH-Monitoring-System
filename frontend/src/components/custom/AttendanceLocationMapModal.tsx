// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useState } from 'react';
import {
  ExternalLink,
  Flag,
  Home,
  Layers,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Circle, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { AttendanceRecord } from '../../types';

interface AttendanceLocationMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
}

type ViewMode = 'CLOCK_IN' | 'CLOCK_OUT' | 'BOTH';

const clockInPinIcon = L.divIcon({
  className: 'custom-clockin-pin',
  html: `<div style="background-color:#0A2D62;color:#ffffff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(10,45,98,0.4);border:2px solid #ffffff;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
      <circle cx="12" cy="10" r="3"></circle>
    </svg>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

const clockOutPinIcon = L.divIcon({
  className: 'custom-clockout-pin',
  html: `<div style="background-color:#D97706;color:#ffffff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(217,119,6,0.4);border:2px solid #ffffff;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
      <line x1="4" y1="22" x2="4" y2="15"></line>
    </svg>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

const homePinIcon = L.divIcon({
  className: 'custom-home-pin',
  html: `<div style="background-color:#D32F2F;color:#ffffff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(211,47,47,0.4);border:2px solid #ffffff;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

// Feature: Geolocation Tagging & Interactive Map Visualization — Purpose: Displays interactive Leaflet OpenStreetMap modal showing employee clock-in pin, clock-out pin, registered home pin, and 100m geofence circle.
// OOP: Reusable Modal Presentation Component (Encapsulated Map View) — Connected To: Triggered from HRD AttendanceMonitoringPage.tsx.
export const AttendanceLocationMapModal: React.FC<AttendanceLocationMapModalProps> = ({
  isOpen,
  onClose,
  record,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('CLOCK_IN');

  if (!isOpen || !record) return null;

  const clockInLat = record.latitude ? Number(record.latitude) : null;
  const clockInLon = record.longitude ? Number(record.longitude) : null;
  const clockOutLat = record.clockOutLatitude ? Number(record.clockOutLatitude) : null;
  const clockOutLon = record.clockOutLongitude ? Number(record.clockOutLongitude) : null;
  const homeLat = record.employee?.homeLatitude ? Number(record.employee.homeLatitude) : null;
  const homeLon = record.employee?.homeLongitude ? Number(record.employee.homeLongitude) : null;

  const hasClockInCoords = clockInLat !== null && clockInLon !== null;
  const hasClockOutCoords = clockOutLat !== null && clockOutLon !== null;
  const hasHomeCoords = homeLat !== null && homeLon !== null;

  let centerLat = clockInLat ?? homeLat ?? -6.1925;
  let centerLon = clockInLon ?? homeLon ?? 106.7820;

  if (viewMode === 'CLOCK_OUT' && hasClockOutCoords) {
    centerLat = clockOutLat!;
    centerLon = clockOutLon!;
  }

  const isClockInWithinRadius =
    record.locationStatus === 'IN_HOME_RADIUS' ||
    (record.distanceFromHomeMeters !== null && record.distanceFromHomeMeters !== undefined && record.distanceFromHomeMeters <= 100);

  const isClockOutWithinRadius =
    record.clockOutLocationStatus === 'IN_HOME_RADIUS' ||
    (record.clockOutDistanceFromHomeMeters !== null && record.clockOutDistanceFromHomeMeters !== undefined && record.clockOutDistanceFromHomeMeters <= 100);

  const activeLat = viewMode === 'CLOCK_OUT' ? clockOutLat ?? clockInLat : clockInLat;
  const activeLon = viewMode === 'CLOCK_OUT' ? clockOutLon ?? clockInLon : clockInLon;

  const googleMapsUrl = activeLat !== null && activeLon !== null
    ? `https://www.google.com/maps?q=${activeLat},${activeLon}`
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-sans text-base font-semibold text-slate-900 dark:text-white">
                Geolocation &amp; Home Geofence Audit
              </h2>
              <span className="font-sans text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                • {record.attendanceDate}
              </span>
            </div>
            <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {record.employee?.fullName || 'Employee'} ({record.employee?.employeeCode || 'DEXA'}) • {record.employee?.department}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Mode Switcher: Clock-In vs Clock-Out vs Both */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-100/80 dark:bg-slate-950/70 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('CLOCK_IN')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'CLOCK_IN'
                  ? 'bg-[#0A2D62] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Clock-In Location</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('CLOCK_OUT')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'CLOCK_OUT'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Clock-Out Location</span>
              {!hasClockOutCoords && (
                <span className="text-[10px] opacity-75 font-normal">(pending)</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setViewMode('BOTH')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'BOTH'
                  ? 'bg-slate-800 dark:bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Both (Comparison)</span>
            </button>
          </div>

          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="taste-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Google Maps</span>
            </a>
          )}
        </div>

        {/* Geofence Status Ribbon */}
        <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-sans space-y-2">
          {viewMode === 'CLOCK_IN' && (
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-[#0A2D62] dark:text-blue-400 uppercase tracking-wide">
                  Clock-In Audit:
                </span>
                {isClockInWithinRadius ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800/60 tabular-nums">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    IN_HOME_RADIUS ({record.distanceFromHomeMeters ?? 0}m from registered home)
                  </span>
                ) : record.locationStatus === 'OUT_OF_HOME_RADIUS' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-semibold border border-rose-200 dark:border-rose-800/60 tabular-nums">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    OUT_OF_HOME_RADIUS ({record.distanceFromHomeMeters ?? 0}m from registered home)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700">
                    <Navigation className="w-3.5 h-3.5 text-slate-500" />
                    Location Unavailable (No Clock-In GPS submitted)
                  </span>
                )}
                <span className="text-slate-400 dark:text-slate-500 text-[11px]">
                  100-Meter WFH Geofence Limit
                </span>
              </div>
              <div className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed flex items-start gap-1.5 mt-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#0A2D62] dark:text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Clock-In Address:</strong>{' '}
                  {record.address || (hasClockInCoords ? `${clockInLat?.toFixed(6)}, ${clockInLon?.toFixed(6)}` : 'Not recorded')}
                </span>
              </div>
            </div>
          )}

          {viewMode === 'CLOCK_OUT' && (
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                  Clock-Out Audit:
                </span>
                {!record.clockOutTime ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-medium border border-amber-200 dark:border-amber-800/60">
                    <Flag className="w-3.5 h-3.5 text-amber-600" />
                    Shift in progress (Employee has not clocked out yet)
                  </span>
                ) : isClockOutWithinRadius ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800/60 tabular-nums">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    IN_HOME_RADIUS ({record.clockOutDistanceFromHomeMeters ?? 0}m from registered home)
                  </span>
                ) : record.clockOutLocationStatus === 'OUT_OF_HOME_RADIUS' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-semibold border border-rose-200 dark:border-rose-800/60 tabular-nums">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    OUT_OF_HOME_RADIUS ({record.clockOutDistanceFromHomeMeters ?? 0}m from registered home)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700">
                    <Navigation className="w-3.5 h-3.5 text-slate-500" />
                    Location Unavailable (No Clock-Out GPS recorded)
                  </span>
                )}
              </div>
              <div className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed flex items-start gap-1.5 mt-1.5">
                <Flag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Clock-Out Address:</strong>{' '}
                  {record.clockOutAddress || (hasClockOutCoords ? `${clockOutLat?.toFixed(6)}, ${clockOutLon?.toFixed(6)}` : record.address || 'Not recorded')}
                </span>
              </div>
            </div>
          )}

          {viewMode === 'BOTH' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-[#0A2D62] dark:text-blue-400">
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Clock-In Location Proof</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  {record.address || 'Address not recorded'}
                </div>
                <div className="text-[10px] text-slate-500 tabular-nums">
                  Distance: {record.distanceFromHomeMeters ?? 'N/A'}m • Status: {record.locationStatus || 'N/A'}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Clock-Out Location Proof</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  {record.clockOutAddress || (record.clockOutTime ? record.address || 'Same as Clock-In' : 'Shift still in progress')}
                </div>
                <div className="text-[10px] text-slate-500 tabular-nums">
                  Distance: {record.clockOutDistanceFromHomeMeters ?? record.distanceFromHomeMeters ?? 'N/A'}m • Status: {record.clockOutLocationStatus || 'N/A'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="flex-1 w-full min-h-[380px] sm:min-h-[460px] relative bg-slate-100 dark:bg-slate-950">
          {!hasClockInCoords && !hasClockOutCoords && !hasHomeCoords ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-2 text-slate-500 dark:text-slate-400">
              <Navigation className="w-10 h-10 text-slate-400 animate-pulse" />
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No GPS Coordinates Available
              </div>
              <p className="text-xs max-w-sm text-slate-500">
                This attendance session was logged without location coordinates or device permission was blocked.
              </p>
            </div>
          ) : (
            <MapContainer
              center={[centerLat, centerLon]}
              zoom={16}
              scrollWheelZoom={true}
              style={{ width: '100%', height: '100%', minHeight: '440px' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Registered Home Pin */}
              {hasHomeCoords && (
                <Marker position={[homeLat!, homeLon!]} icon={homePinIcon}>
                  <Popup>
                    <div className="p-1 space-y-1 font-sans text-xs">
                      <div className="font-bold text-[#D32F2F] flex items-center gap-1">
                        <Home className="w-3.5 h-3.5" />
                        <span>Registered Employee Home</span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {record.employee?.fullName} ({record.employee?.employeeCode})
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {homeLat?.toFixed(6)}, {homeLon?.toFixed(6)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* 100-Meter Geofence Radius Circle around Registered Home */}
              {hasHomeCoords && (
                <Circle
                  center={[homeLat!, homeLon!]}
                  radius={100}
                  pathOptions={{
                    color: isClockInWithinRadius ? '#10b981' : '#ef4444',
                    fillColor: isClockInWithinRadius ? '#10b981' : '#ef4444',
                    fillOpacity: 0.18,
                    dashArray: isClockInWithinRadius ? undefined : '6, 6',
                    weight: 2,
                  }}
                />
              )}

              {/* Employee Clock-In Pin (Shown in CLOCK_IN and BOTH modes) */}
              {hasClockInCoords && (viewMode === 'CLOCK_IN' || viewMode === 'BOTH') && (
                <Marker position={[clockInLat!, clockInLon!]} icon={clockInPinIcon}>
                  <Popup>
                    <div className="p-1 space-y-1.5 font-sans text-xs max-w-xs">
                      <div className="font-bold text-[#0A2D62] flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Clock-In Location Proof</span>
                      </div>
                      <div className="text-[11px] text-slate-700 font-medium">
                        {record.address || 'Reverse-geocoded address'}
                      </div>
                      <div className="text-[10px] text-slate-500 tabular-nums">
                        Coords: {clockInLat?.toFixed(6)}, {clockInLon?.toFixed(6)}
                      </div>
                      <div className="text-[10px] font-semibold text-blue-700">
                        Distance from home: {record.distanceFromHomeMeters ?? 'N/A'}m
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Employee Clock-Out Pin (Shown in CLOCK_OUT and BOTH modes) */}
              {hasClockOutCoords && (viewMode === 'CLOCK_OUT' || viewMode === 'BOTH') && (
                <Marker position={[clockOutLat!, clockOutLon!]} icon={clockOutPinIcon}>
                  <Popup>
                    <div className="p-1 space-y-1.5 font-sans text-xs max-w-xs">
                      <div className="font-bold text-amber-600 flex items-center gap-1">
                        <Flag className="w-3.5 h-3.5" />
                        <span>Clock-Out Location Proof</span>
                      </div>
                      <div className="text-[11px] text-slate-700 font-medium">
                        {record.clockOutAddress || record.address || 'Reverse-geocoded address'}
                      </div>
                      <div className="text-[10px] text-slate-500 tabular-nums">
                        Coords: {clockOutLat?.toFixed(6)}, {clockOutLon?.toFixed(6)}
                      </div>
                      <div className="text-[10px] font-semibold text-amber-700">
                        Distance from home: {record.clockOutDistanceFromHomeMeters ?? 'N/A'}m
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          )}

          {/* Map Legend Overlay */}
          <div className="absolute bottom-3 left-3 z-[1000] p-2.5 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200/90 dark:border-slate-800 shadow-md text-[11px] font-sans space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#0A2D62] inline-block shadow-sm" />
              <span className="text-slate-700 dark:text-slate-300 font-medium">Clock-In Location</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-600 inline-block shadow-sm" />
              <span className="text-slate-700 dark:text-slate-300 font-medium">Clock-Out Location</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#D32F2F] inline-block shadow-sm" />
              <span className="text-slate-700 dark:text-slate-300 font-medium">Registered Home</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border border-emerald-500 bg-emerald-500/20 inline-block" />
              <span className="text-slate-700 dark:text-slate-300 font-medium">100m Geofence Radius</span>
            </div>
          </div>
        </div>

        {/* Modal Footer Watermark */}
        <div className="px-6 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-[11px] text-slate-500 font-sans">
          <span>Dexa Group WFH Attendance • OpenStreetMap Nominatim &amp; Leaflet Engine</span>
          <span>© 2026 Abdurrahman Khairi - Created strictly for Technical Assessment evaluation. Unauthorized commercial use is prohibited</span>
        </div>
      </div>
    </div>
  );
};
