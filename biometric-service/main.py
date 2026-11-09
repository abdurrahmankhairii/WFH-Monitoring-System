# ============================================================================
# Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
# Created strictly for Technical Assessment evaluation.
# Unauthorized commercial use, modification, or distribution is prohibited.
# ============================================================================
import json
import logging
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from schemas import FaceExtractResponse, FaceVerifyResponse
from service import FaceBiometricService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("BiometricMain")

app = FastAPI(
    title="Dexa WFH Biometric Microservice",
    version="1.0.0",
    description="Python FastAPI Biometric Engine utilizing InsightFace Buffalo_L ArcFace for 512-dim face recognition.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Feature: Biometric Model Pre-Warming — Purpose: Loads InsightFace Buffalo_L ONNX models into memory on container startup to prevent cold-start request timeouts.
# OOP: Application Lifecycle Hook (Startup Event) — Connected To: FaceBiometricService singleton instance.
@app.on_event("startup")
async def startup_event():
    logger.info("Pre-warming InsightFace Buffalo_L model in memory on service startup...")
    try:
        FaceBiometricService.get_instance()
        logger.info("InsightFace Buffalo_L model pre-warmed and ready.")
    except Exception as e:
        logger.error(f"Failed to pre-warm InsightFace model: {e}")


# Feature: Service Health Monitoring — Purpose: Returns microservice status, active ONNX execution providers, and model metadata.
# OOP: Controller Route Handler — Connected To: Docker Compose healthcheck and NestJS BiometricClientService health ping.
@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    return {
        "status": "HEALTHY",
        "service": "dexa-wfh-biometric-service",
        "model": "insightface_buffalo_l",
        "embedding_dimensions": 512,
        "copyright": "Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.",
    }


# Feature: Biometric Feature Extraction — Purpose: Extracts normalized 512-dim ArcFace embedding from single frontal face photo.
# OOP: Controller Route Handler — Connected To: POST /extract-embedding -> NestJS POST /api/employees/me/enroll-face.
@app.post("/extract-embedding", response_model=FaceExtractResponse)
async def extract_embedding(file: UploadFile = File(...)):
    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        service = FaceBiometricService.get_instance()
        result = service.extract_embedding(content)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[EXTRACT_ERROR] {e}", exc_info=True)
        return FaceExtractResponse(
            status="ERROR",
            face_detected=False,
            face_count=0,
            message=f"Terjadi kesalahan saat mengekstraksi wajah: {str(e)}",
        )


# Feature: 1:1 Biometric Identity Verification — Purpose: Compares clock-in/out photo with enrolled employee embedding vector.
# OOP: Controller Route Handler — Connected To: POST /verify-face -> NestJS Clock-In and Clock-Out handlers.
@app.post("/verify-face", response_model=FaceVerifyResponse)
async def verify_face(
    file: UploadFile = File(...),
    reference_embedding: str = Form(...),
    threshold: float = Form(0.45),
):
    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        try:
            ref_vector = json.loads(reference_embedding)
            if not isinstance(ref_vector, list) or len(ref_vector) != 512:
                raise ValueError("Embedding must be a 512-element list of floats.")
        except Exception as parse_err:
            raise HTTPException(
                status_code=400,
                detail=f"Parameter reference_embedding tidak valid: {str(parse_err)}",
            )

        service = FaceBiometricService.get_instance()
        result = service.verify_face(
            image_bytes=content,
            reference_embedding=ref_vector,
            threshold=threshold,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[VERIFY_ERROR] {e}", exc_info=True)
        return FaceVerifyResponse(
            status="ERROR",
            face_detected=False,
            face_count=0,
            is_match=False,
            similarity=0.0,
            threshold=threshold,
            message=f"Terjadi kesalahan saat memverifikasi wajah: {str(e)}",
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
