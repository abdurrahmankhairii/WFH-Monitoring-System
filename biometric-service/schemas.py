# ============================================================================
# Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
# Created strictly for Technical Assessment evaluation.
# Unauthorized commercial use, modification, or distribution is prohibited.
# ============================================================================
from typing import List, Optional
from pydantic import BaseModel, Field

# Feature: Biometric Response Schemas — Purpose: Strongly typed Pydantic models for InsightFace extraction and 1:1 cosine similarity verification.
# OOP: Data Transfer Object (DTO Abstraction) — Connected To: biometric-service/main.py, service.py, and NestJS BiometricClientService.
class FaceExtractResponse(BaseModel):
    status: str = Field(..., description="Extraction status: SUCCESS, NO_FACE, MULTIPLE_FACES, or ERROR")
    face_detected: bool = Field(..., description="Whether at least one face was detected")
    face_count: int = Field(..., description="Total faces detected in the image")
    embedding: Optional[List[float]] = Field(None, description="Normalized 512-dimensional ArcFace embedding vector")
    bbox: Optional[List[int]] = Field(None, description="Bounding box [x1, y1, x2, y2]")
    det_score: Optional[float] = Field(None, description="Face detection confidence score")
    image_hash: Optional[str] = Field(None, description="SHA-256 cryptographic digest of image")
    image_phash: Optional[str] = Field(None, description="Perceptual hash (aHash 16-hex)")
    message: str = Field(..., description="Human-readable status summary")


# Feature: Biometric Response Schemas — Purpose: Strongly typed response model for 1:1 face matching against registered employee embedding.
# OOP: Data Transfer Object (DTO Abstraction) — Connected To: biometric-service/main.py, service.py, and NestJS BiometricClientService.
class FaceVerifyResponse(BaseModel):
    status: str = Field(..., description="Verification status: SUCCESS, NO_FACE, MULTIPLE_FACES, or ERROR")
    face_detected: bool = Field(..., description="Whether probe image contains a valid face")
    face_count: int = Field(..., description="Total faces detected in probe image")
    is_match: bool = Field(..., description="True if cosine similarity meets or exceeds threshold")
    similarity: float = Field(..., description="Cosine similarity score between probe and reference embedding")
    threshold: float = Field(..., description="Cosine similarity threshold used for matching")
    bbox: Optional[List[int]] = Field(None, description="Bounding box [x1, y1, x2, y2]")
    det_score: Optional[float] = Field(None, description="Face detection confidence score")
    image_hash: Optional[str] = Field(None, description="SHA-256 cryptographic digest of image")
    image_phash: Optional[str] = Field(None, description="Perceptual hash (aHash 16-hex)")
    message: str = Field(..., description="Detailed verification explanation")
