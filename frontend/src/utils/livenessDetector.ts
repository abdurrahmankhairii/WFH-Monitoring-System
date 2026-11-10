// ============================================================================
// Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
// Created strictly for Technical Assessment evaluation.
// Unauthorized commercial use, modification, or distribution is prohibited.
// ============================================================================
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export interface Point3D {
  x: number;
  y: number;
  z?: number;
}

export type LivenessChallengeStep =
  | 'ALIGN'
  | 'IDENTIFYING'
  | 'RECOGNIZED'
  | 'BLINK'
  | 'TURN_LEFT'
  | 'TURN_RIGHT'
  | 'HOLD_FRONT'
  | 'COMPLETED';

export interface LivenessDetectionMetrics {
  earLeft: number;
  earRight: number;
  earAvg: number;
  yawDegrees: number;
  smileScore: number;
  blinkDetected: boolean;
  isFacingFront: boolean;
  isTurnedLeft: boolean;
  isTurnedRight: boolean;
  rawLandmarksCount: number;
  engine: 'MEDIAPIPE_GPU' | 'MEDIAPIPE_CPU' | 'CANVAS_FALLBACK';
}

// Eye Aspect Ratio landmark indices based on standard 468-point facial mesh
// EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
const LEFT_EYE_INDICES: [number, number, number, number, number, number] = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE_INDICES: [number, number, number, number, number, number] = [362, 385, 387, 263, 373, 380];

// Feature: Active Liveness Optical Geometry — Purpose: Computes 2D Euclidean distance between two facial landmark coordinates.
// OOP: Pure Mathematical Function — Connected To: computeEyeAspectRatio() helper for MediaPipe mesh points.
function computeDistance(p1: Point3D, p2: Point3D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Feature: Eye Aspect Ratio (EAR) Calculation — Purpose: Computes opening ratio of eye eyelids to detect genuine human blinks.
// OOP: Pure Mathematical Function — Connected To: Evaluates MediaPipe 3D landmark coordinates at 60 FPS.
export function computeEyeAspectRatio(
  landmarks: Point3D[],
  indices: [number, number, number, number, number, number],
): number {
  const [i1, i2, i3, i4, i5, i6] = indices;
  const p1 = landmarks[i1];
  const p2 = landmarks[i2];
  const p3 = landmarks[i3];
  const p4 = landmarks[i4];
  const p5 = landmarks[i5];
  const p6 = landmarks[i6];
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0.28;

  const dVertical1 = computeDistance(p2, p6);
  const dVertical2 = computeDistance(p3, p5);
  const dHorizontal = computeDistance(p1, p4);

  if (dHorizontal <= 0.0001) return 0.28;
  return (dVertical1 + dVertical2) / (2.0 * dHorizontal);
}

// Feature: Head Pose Yaw Estimation — Purpose: Computes head horizontal rotation (yaw angle) relative to camera plane.
// OOP: Pure Mathematical Function — Connected To: Uses nose tip (index 1) and bilateral facial tragus bounds (indices 234 & 454).
export function computeHeadYawDegrees(landmarks: Point3D[]): number {
  const nose = landmarks[1];
  const leftBound = landmarks[234];
  const rightBound = landmarks[454];
  if (!nose || !leftBound || !rightBound) return 0;

  const dLeft = Math.abs(nose.x - leftBound.x);
  const dRight = Math.abs(rightBound.x - nose.x);
  const total = dLeft + dRight;
  if (total <= 0.0001) return 0;

  // Mirrored video coordinate: turning user's head to their left causes nose to shift toward leftBound
  const ratio = (dRight - dLeft) / total;
  // Scale to approximate yaw angle (-60° to +60°)
  return Math.round(ratio * 55);
}

let landmarkerSingleton: FaceLandmarker | null = null;
let landmarkerPromise: Promise<FaceLandmarker | null> | null = null;

// Feature: MediaPipe FaceLandmarker WebGL Initializer — Purpose: Initializes local WASM & model runner without external CDN latency.
// OOP: Singleton Resource Manager — Connected To: /mediapipe/wasm and /mediapipe/models/face_landmarker.task.
export async function getLocalFaceLandmarker(): Promise<FaceLandmarker | null> {
  if (landmarkerSingleton) return landmarkerSingleton;
  if (landmarkerPromise) return landmarkerPromise;

  landmarkerPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
      try {
        landmarkerSingleton = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/mediapipe/models/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        return landmarkerSingleton;
      } catch (gpuError) {
        console.warn('MediaPipe GPU initialization failed, attempting CPU delegate fallback:', gpuError);
        landmarkerSingleton = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/mediapipe/models/face_landmarker.task',
            delegate: 'CPU',
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        return landmarkerSingleton;
      }
    } catch (globalError) {
      console.warn('MediaPipe local WASM unavailable, enabling Canvas optical fallback:', globalError);
      return null;
    } finally {
      landmarkerPromise = null;
    }
  })();

  return landmarkerPromise;
}

// Feature: Real-Time Active Liveness Frame Processor — Purpose: Extracts EAR, yaw, and blendshape metrics from current video frame.
// OOP: Domain Logic Service (Anti-Spoofing Computer Vision) — Connected To: Executed inside requestAnimationFrame loop in CameraPhotoUpload.tsx.
export function analyzeVideoLivenessFrame(
  video: HTMLVideoElement,
  landmarker: FaceLandmarker | null,
  timestampMs: number,
  fallbackCanvasCtx: CanvasRenderingContext2D | null,
  previousFrameData: Uint8ClampedArray | null,
): LivenessDetectionMetrics {
  // 1. Try MediaPipe FaceLandmarker if available
  if (landmarker && video.videoWidth > 0 && video.videoHeight > 0) {
    try {
      const results = landmarker.detectForVideo(video, timestampMs);
      if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0] as Point3D[];
        const earLeft = computeEyeAspectRatio(landmarks, LEFT_EYE_INDICES);
        const earRight = computeEyeAspectRatio(landmarks, RIGHT_EYE_INDICES);
        const earAvg = Math.round(((earLeft + earRight) / 2.0) * 100) / 100;
        const yaw = computeHeadYawDegrees(landmarks);

        // Check blendshapes if available
        let smile = 0;
        let blendBlinkLeft = 0;
        let blendBlinkRight = 0;
        if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
          const shapes = results.faceBlendshapes[0].categories;
          for (const s of shapes) {
            if (s.categoryName === 'mouthSmileLeft' || s.categoryName === 'mouthSmileRight') {
              smile = Math.max(smile, s.score);
            }
            if (s.categoryName === 'eyeBlinkLeft') blendBlinkLeft = s.score;
            if (s.categoryName === 'eyeBlinkRight') blendBlinkRight = s.score;
          }
        }

        const blinkDetected = earAvg < 0.20 || (blendBlinkLeft > 0.45 && blendBlinkRight > 0.45);
        const isFacingFront = Math.abs(yaw) <= 10;
        const isTurnedLeft = yaw <= -10;
        const isTurnedRight = yaw >= 10;

        return {
          earLeft,
          earRight,
          earAvg,
          yawDegrees: yaw,
          smileScore: Math.round(smile * 100) / 100,
          blinkDetected,
          isFacingFront,
          isTurnedLeft,
          isTurnedRight,
          rawLandmarksCount: landmarks.length,
          engine: 'MEDIAPIPE_GPU',
        };
      }
    } catch {
      // Pass-through to fallback if detectForVideo throws transient frame sync error
    }
  }

  // 2. Resilient Canvas Optical Fallback (Pure HTML5 Canvas 2D)
  if (fallbackCanvasCtx && video.videoWidth > 0 && video.videoHeight > 0) {
    const width = 160;
    const height = 120;
    fallbackCanvasCtx.drawImage(video, 0, 0, width, height);
    const frame = fallbackCanvasCtx.getImageData(0, 0, width, height);
    const data = frame.data;

    let leftLuma = 0;
    let rightLuma = 0;
    let eyeLuma = 0;
    let totalDelta = 0;
    let pixelCount = 0;

    for (let y = 30; y < 90; y += 2) {
      for (let x = 30; x < 130; x += 2) {
        const idx = (y * width + x) * 4;
        const luma = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (x < 80) leftLuma += luma;
        else rightLuma += luma;

        if (y >= 35 && y <= 55) eyeLuma += luma;

        if (previousFrameData) {
          const prevLuma =
            0.299 * previousFrameData[idx] +
            0.587 * previousFrameData[idx + 1] +
            0.114 * previousFrameData[idx + 2];
          totalDelta += Math.abs(luma - prevLuma);
        }
        pixelCount++;
      }
    }

    const avgDelta = pixelCount > 0 ? totalDelta / pixelCount : 0;
    const lumaDiff = rightLuma - leftLuma;
    const approxYaw = Math.max(-45, Math.min(45, Math.round((lumaDiff / (leftLuma + rightLuma + 1)) * 90)));
    const approxEar = avgDelta > 1.8 ? 0.18 : 0.28;

    return {
      earLeft: approxEar,
      earRight: approxEar,
      earAvg: approxEar,
      yawDegrees: approxYaw,
      smileScore: 0.1,
      blinkDetected: approxEar < 0.2,
      isFacingFront: Math.abs(approxYaw) <= 10,
      isTurnedLeft: approxYaw <= -14,
      isTurnedRight: approxYaw >= 14,
      rawLandmarksCount: 0,
      engine: 'CANVAS_FALLBACK',
    };
  }

  return {
    earLeft: 0.28,
    earRight: 0.28,
    earAvg: 0.28,
    yawDegrees: 0,
    smileScore: 0,
    blinkDetected: false,
    isFacingFront: true,
    isTurnedLeft: false,
    isTurnedRight: false,
    rawLandmarksCount: 0,
    engine: 'CANVAS_FALLBACK',
  };
}
