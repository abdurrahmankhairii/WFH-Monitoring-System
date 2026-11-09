# ============================================================================
# Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
# Created strictly for Technical Assessment evaluation.
# Unauthorized commercial use, modification, or distribution is prohibited.
# ============================================================================
import os
import cv2
import json
import hashlib
import logging
import numpy as np
from typing import List, Optional, Tuple, Dict, Any

import onnxruntime
from insightface.app import FaceAnalysis

from schemas import FaceExtractResponse, FaceVerifyResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("BiometricService")

# Feature: InsightFace Biometric Engine — Purpose: Encapsulates Buffalo_L ArcFace detection, 512-dim embedding extraction, and cosine similarity scoring.
# OOP: Domain Service (Singleton Factory & Strategy Pattern) — Connected To: biometric-service/main.py -> NestJS API Gateway & Attendance Service.
class FaceBiometricService:
    _instance: Optional["FaceBiometricService"] = None

    def __init__(self):
        # Select execution providers (TensorRT > CUDA > CPU)
        providers = ["CPUExecutionProvider"]
        if os.getenv("FORCE_GPU") == "1":
            available = onnxruntime.get_available_providers()
            if "CUDAExecutionProvider" in available:
                providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
                logger.info("[BIOMETRIC] CUDA Execution Provider detected and enabled.")
        logger.info(f"[BIOMETRIC] Active ONNX Execution Providers: {providers}")

        # Resolve model root path
        model_root = os.getenv("INSIGHTFACE_HOME", os.path.expanduser("~/.insightface"))
        logger.info(f"[BIOMETRIC] Loading InsightFace Buffalo_L from root: {model_root}")

        self.app = FaceAnalysis(name="buffalo_l", root=model_root, providers=providers)
        self.app.prepare(ctx_id=0, det_size=(320, 320), det_thresh=0.55)
        logger.info("[BIOMETRIC] Buffalo_L FaceAnalysis model prepared successfully.")

    @classmethod
    def get_instance(cls) -> "FaceBiometricService":
        if cls._instance is None:
            cls._instance = FaceBiometricService()
        return cls._instance

    # Feature: Image Normalization Pipeline — Purpose: Decodes binary buffer and normalizes memory alignment via JPEG round-trip.
    # OOP: Encapsulated Helper Method — Connected To: extract_embedding and verify_face pipelines.
    def _normalize_image_bytes(self, image_bytes: bytes) -> Optional[np.ndarray]:
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            frame_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame_bgr is None or frame_bgr.size == 0:
                return None

            # Buffer normalization round-trip (adapted from Pertamina reference project)
            ok, encoded = cv2.imencode(".jpg", frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])
            if not ok:
                return None
            clean_bgr = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
            return clean_bgr
        except Exception as e:
            logger.error(f"[BIOMETRIC] Image normalization failed: {e}")
            return None

    # Feature: Cryptographic & Perceptual Hashing — Purpose: Computes SHA-256 and 64-bit aHash perceptual hash to prevent duplicate/reused photo uploads.
    # OOP: Encapsulated Helper Method — Connected To: extract_embedding and verify_face pipelines.
    def _compute_hashes(self, image_bytes: bytes, frame_bgr: np.ndarray) -> Tuple[str, str]:
        sha256 = hashlib.sha256(image_bytes).hexdigest()
        try:
            gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
            resized = cv2.resize(gray, (8, 8), interpolation=cv2.INTER_AREA)
            avg = float(resized.mean())
            bits = (resized > avg).flatten()
            phash_int = int("".join(["1" if b else "0" for b in bits]), 2)
            phash_hex = f"{phash_int:016x}"
        except Exception:
            phash_hex = "0000000000000000"
        return sha256, phash_hex

    # Feature: Biometric Feature Extraction — Purpose: Extracts normalized 512-dim ArcFace embedding from single frontal face image.
    # OOP: Service Action Method — Connected To: POST /extract-embedding -> NestJS POST /api/employees/me/enroll-face.
    def extract_embedding(self, image_bytes: bytes) -> FaceExtractResponse:
        clean_bgr = self._normalize_image_bytes(image_bytes)
        if clean_bgr is None:
            return FaceExtractResponse(
                status="ERROR",
                face_detected=False,
                face_count=0,
                message="File gambar tidak valid atau gagal didecode oleh OpenCV.",
            )

        sha256_hash, phash_hex = self._compute_hashes(image_bytes, clean_bgr)
        rgb_frame = cv2.cvtColor(clean_bgr, cv2.COLOR_BGR2RGB)
        faces = self.app.get(rgb_frame)

        if len(faces) == 0:
            return FaceExtractResponse(
                status="NO_FACE",
                face_detected=False,
                face_count=0,
                image_hash=sha256_hash,
                image_phash=phash_hex,
                message="Tidak ada wajah terdeteksi. Posisikan wajah Anda tegak lurus di depan kamera.",
            )

        if len(faces) > 1:
            return FaceExtractResponse(
                status="MULTIPLE_FACES",
                face_detected=True,
                face_count=len(faces),
                image_hash=sha256_hash,
                image_phash=phash_hex,
                message=f"Terdeteksi {len(faces)} wajah. Pendaftaran biometrik harus dilakukan seorang diri.",
            )

        face = faces[0]
        raw_embedding = face.embedding.astype(np.float32)
        norm = np.linalg.norm(raw_embedding)
        normalized_embedding = (raw_embedding / norm).tolist() if norm > 0 else raw_embedding.tolist()

        bbox = [int(coord) for coord in face.bbox]
        det_score = round(float(face.det_score), 4)

        return FaceExtractResponse(
            status="SUCCESS",
            face_detected=True,
            face_count=1,
            embedding=normalized_embedding,
            bbox=bbox,
            det_score=det_score,
            image_hash=sha256_hash,
            image_phash=phash_hex,
            message="Ekstraksi embedding wajah biometrik 512-dimensi berhasil.",
        )

    # Feature: 1:1 Face Verification — Purpose: Compares probe image against enrolled reference vector using Cosine Similarity.
    # OOP: Service Action Method — Connected To: POST /verify-face -> NestJS POST /api/attendances/clock-in & clock-out.
    def verify_face(
        self,
        image_bytes: bytes,
        reference_embedding: List[float],
        threshold: float = 0.45,
    ) -> FaceVerifyResponse:
        if not reference_embedding or len(reference_embedding) != 512:
            return FaceVerifyResponse(
                status="ERROR",
                face_detected=False,
                face_count=0,
                is_match=False,
                similarity=0.0,
                threshold=threshold,
                message="Vektor embedding referensi tidak valid atau tidak berdimensi 512.",
            )

        clean_bgr = self._normalize_image_bytes(image_bytes)
        if clean_bgr is None:
            return FaceVerifyResponse(
                status="ERROR",
                face_detected=False,
                face_count=0,
                is_match=False,
                similarity=0.0,
                threshold=threshold,
                message="Gambar probe tidak dapat didecode.",
            )

        sha256_hash, phash_hex = self._compute_hashes(image_bytes, clean_bgr)
        rgb_frame = cv2.cvtColor(clean_bgr, cv2.COLOR_BGR2RGB)
        faces = self.app.get(rgb_frame)

        if len(faces) == 0:
            return FaceVerifyResponse(
                status="NO_FACE",
                face_detected=False,
                face_count=0,
                is_match=False,
                similarity=0.0,
                threshold=threshold,
                image_hash=sha256_hash,
                image_phash=phash_hex,
                message="Tidak ada wajah terdeteksi pada foto absensi.",
            )

        if len(faces) > 1:
            return FaceVerifyResponse(
                status="MULTIPLE_FACES",
                face_detected=True,
                face_count=len(faces),
                is_match=False,
                similarity=0.0,
                threshold=threshold,
                image_hash=sha256_hash,
                image_phash=phash_hex,
                message=f"Terdeteksi {len(faces)} wajah pada foto absensi. Absensi harus dilakukan sendiri.",
            )

        face = faces[0]
        probe_emb = face.embedding.astype(np.float32)
        ref_emb = np.array(reference_embedding, dtype=np.float32)

        # Cosine similarity calculation: (A . B) / (||A|| * ||B||)
        norm_probe = np.linalg.norm(probe_emb)
        norm_ref = np.linalg.norm(ref_emb)

        if norm_probe == 0 or norm_ref == 0:
            similarity = 0.0
        else:
            similarity = float(np.dot(probe_emb, ref_emb) / (norm_probe * norm_ref))

        similarity = round(max(0.0, min(1.0, similarity)), 4)
        is_match = bool(similarity >= threshold)
        bbox = [int(coord) for coord in face.bbox]
        det_score = round(float(face.det_score), 4)

        status_label = "SUCCESS" if is_match else "BIOMETRIC_MISMATCH"
        explanation = (
            f"Wajah terverifikasi cocok dengan karyawan terdaftar (skor kemiripan: {similarity:.4f} >= {threshold})."
            if is_match
            else f"Wajah tidak cocok dengan profil biometrik terdaftar (skor kemiripan: {similarity:.4f} < {threshold})."
        )

        return FaceVerifyResponse(
            status=status_label,
            face_detected=True,
            face_count=1,
            is_match=is_match,
            similarity=similarity,
            threshold=threshold,
            bbox=bbox,
            det_score=det_score,
            image_hash=sha256_hash,
            image_phash=phash_hex,
            message=explanation,
        )
