// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, AlertCircle, RefreshCw, LogOut, UserCheck, ShieldAlert } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StandardApiResponse } from '../../types';
import { DexaBrandLogo } from '../../components/custom/DexaBrandLogo';
import { ThemeToggle } from '../../components/custom/ThemeToggle';
import { CopyrightFooterWatermark } from '../../components/custom/CopyrightFooterWatermark';

// Feature: Biometric Face Setup — Purpose: Focused enterprise onboarding view capturing live facial frame for ArcFace biometric enrollment.
// OOP: Presentation Page Component (View Layer Composition) — Connected To: POST /api/employees/me/enroll-face -> api-gateway & biometric-service.
export const FaceEnrollmentPage: React.FC = () => {
  const { user, refreshProfile, logout } = useAuth();
  const { showToast, notifyApiResponse } = useToast();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [conflictError, setConflictError] = useState<{ what: string; why: string } | null>(null);

  // Feature: Webcam Stream Initialization — Purpose: Requests front-facing webcam stream with error handling for hardware availability.
  // OOP: Encapsulated Lifecycle Hook — Connected To: HTML5 MediaDevices API.
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      const msg =
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : err.name === 'NotFoundError'
          ? 'No webcam device found on your computer.'
          : 'Failed to access webcam. Please verify device availability.';
      setCameraError(msg);
      showToast({
        type: 'error',
        where: 'Face Registration • Camera Access',
        what: 'Unable to open webcam',
        why: msg,
      });
    }
  }, [showToast, stream]);

  useEffect(() => {
    void startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Feature: Face Frame Capture — Purpose: Captures high-resolution frame from webcam onto hidden canvas and extracts JPEG Blob.
  // OOP: Presentation Helper Method — Connected To: HTML5 Canvas API.
  const handleCaptureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setIsCapturing(true);
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw raw camera frame
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        setIsCapturing(false);
        if (blob) {
          setCapturedBlob(blob);
          setPreviewUrl(URL.createObjectURL(blob));
        }
      },
      'image/jpeg',
      0.95,
    );
  };

  // Feature: Biometric Retake Handler — Purpose: Cleans up existing captured preview URL and reinitializes live camera feed.
  // OOP: Presentation Helper Method — Connected To: User interaction button.
  const handleRetake = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setCapturedBlob(null);
    setPreviewUrl(null);
    setConflictError(null);
    void startCamera();
  };

  // Feature: Biometric Enrollment Submission — Purpose: Dispatches captured JPEG photo to POST /api/employees/me/enroll-face for Buffalo_L ArcFace extraction.
  // OOP: Presentation Action Method — Connected To: api-gateway employees.controller.ts -> employee-service.
  const handleSubmitEnrollment = async () => {
    if (!capturedBlob) return;
    setIsSubmitting(true);
    setConflictError(null);
    try {
      const formData = new FormData();
      formData.append('photo', capturedBlob, `face_${user?.employeeCode || 'enrollment'}.jpg`);

      const res = await apiClient.post<StandardApiResponse<{ isFaceEnrolled: boolean; avatarUrl: string }>>(
        '/employees/me/enroll-face',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      );

      notifyApiResponse(res.data);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      await refreshProfile();
      navigate('/employee/attendance', { replace: true });
    } catch (err: any) {
      const errorData = err.response?.data;
      const what =
        errorData?.what ||
        (err.response?.status === 409
          ? 'Biometric Conflict Detected'
          : err.response?.status === 422
          ? 'Face Extraction Failed'
          : 'Face Registration Failed');
      const why =
        errorData?.why ||
        err.message ||
        'Terjadi kesalahan saat memproses biometrik wajah. Pastikan wajah terlihat jelas dan coba lagi.';
      setConflictError({ what, why });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f8f6] dark:bg-[#0b1120] flex flex-col justify-between p-4 sm:p-6 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Header — Aligned symmetrically with Main Column (max-w-lg) */}
      <header className="max-w-lg w-full mx-auto flex items-center justify-between pb-3 pt-1">
        <DexaBrandLogo size="md" showSubtitle={false} />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={logout}
            className="taste-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 bg-white dark:bg-slate-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 transition-colors shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container — Centered & Focused Column (max-w-lg) */}
      <main className="max-w-lg w-full mx-auto my-auto py-2">
        <div className="taste-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-xs space-y-4">
          {/* Centered Direct Title & Subtitle */}
          <div className="text-center space-y-1">
            <h1 className="font-sans text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              Biometric Face Registration
            </h1>
            <p className="font-sans text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Position your face inside the frame under even lighting without masks or glasses.
            </p>
          </div>

          {/* Account Context Strip */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 shrink-0">
              <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
              <span className="font-medium text-slate-700 dark:text-slate-200">
                One-Time Setup
              </span>
            </div>
            <div className="font-sans text-slate-500 dark:text-slate-400 tabular-nums text-right flex items-center justify-end gap-1.5 min-w-0">
              <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{user?.fullName || 'Employee'}</span>
              {user?.employeeCode && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                  ({user.employeeCode})
                </span>
              )}
            </div>
          </div>

          {/* Viewfinder Area (4:3 Ratio, Solusi 3) */}
          <div className="relative aspect-[4/3] max-w-[380px] mx-auto rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-inner flex items-center justify-center">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Captured Face Preview"
                className="w-full h-full object-cover transform -scale-x-100"
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
            )}

            {/* Camera Active Status Indicator Pill (Top-Left) */}
            {!previewUrl && !cameraError && (
              <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/65 backdrop-blur-sm text-[11px] font-medium text-white/95 pointer-events-none select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Camera Active</span>
              </div>
            )}

            {/* Precision Corner Brackets (Biometric Frame Accent) */}
            {!cameraError && (
              <>
                <div className="absolute top-3 right-3 w-3.5 h-3.5 border-t-2 border-r-2 border-white/40 pointer-events-none rounded-tr-sm" />
                <div className="absolute bottom-3 left-3 w-3.5 h-3.5 border-b-2 border-l-2 border-white/40 pointer-events-none rounded-bl-sm" />
                <div className="absolute bottom-3 right-3 w-3.5 h-3.5 border-b-2 border-r-2 border-white/40 pointer-events-none rounded-br-sm" />
              </>
            )}

            {/* Breathing Room Oval Guide (w-[52%] h-[78%] giving ~24px breathing space top/bottom) */}
            {!previewUrl && !cameraError && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[52%] h-[78%] border-2 border-white/80 rounded-[50%] shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]" />
              </div>
            )}

            {/* Camera Error Message */}
            {cameraError && (
              <div className="absolute inset-0 bg-slate-900/90 text-white p-6 flex flex-col items-center justify-center text-center space-y-3 z-20">
                <AlertCircle className="w-8 h-8 text-[#D32F2F]" />
                <div className="text-xs font-semibold text-rose-300">Camera Unavailable</div>
                <p className="text-[11px] text-slate-300 max-w-xs">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="taste-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-semibold"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera</span>
                </button>
              </div>
            )}
          </div>

          {/* Conflict Error Alert Card */}
          {conflictError && (
            <div className="w-full max-w-[380px] mx-auto p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs space-y-2 animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-[#D32F2F] dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-xs text-rose-900 dark:text-rose-100">
                    {conflictError.what}
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-800 dark:text-rose-300">
                    {conflictError.why}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Centered Action Button */}
          <div className="pt-1">
            {previewUrl ? (
              <div className="w-full max-w-[380px] mx-auto flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleRetake}
                  className="taste-btn w-1/3 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-sans text-xs font-medium shadow-xs transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleSubmitEnrollment()}
                  className="taste-btn w-2/3 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-sans text-xs font-semibold shadow-sm disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Registering Face...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Confirm &amp; Register Face</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={Boolean(cameraError) || isCapturing}
                onClick={handleCaptureFrame}
                className="taste-btn w-full max-w-[380px] mx-auto flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-[#0A2D62] hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-sans text-xs font-semibold shadow-sm disabled:opacity-50 transition-all"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Capture &amp; Register Face</span>
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Footer Watermark — Aligned symmetrically with Main Column */}
      <footer className="max-w-lg w-full mx-auto text-center pt-2 pb-1">
        <CopyrightFooterWatermark />
      </footer>
    </div>
  );
};
