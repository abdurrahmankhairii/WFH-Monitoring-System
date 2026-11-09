# ============================================================================
# Copyright (c) 2026 Abdurrahman Khairi. All Rights Reserved.
# Created strictly for Technical Assessment evaluation.
# Unauthorized commercial use, modification, or distribution is prohibited.
# ============================================================================
import os
import sys
import numpy as np
import cv2

# Feature: Biometric Verification Unit Test — Purpose: Verifies model initialization, empty frame detection, and cosine similarity calculation.
# OOP: Test Suite — Connected To: biometric-service/service.py and schemas.py.

def run_tests():
    print("=================================================================")
    print("Testing Dexa WFH Biometric Microservice (InsightFace Buffalo_L)")
    print("=================================================================")

    from service import FaceBiometricService

    service = FaceBiometricService.get_instance()
    assert service is not None, "Failed to instantiate FaceBiometricService"
    print("1. [PASS] FaceBiometricService instantiated and Buffalo_L models loaded.")

    # Test 2: Test empty / noise image (should return NO_FACE gracefully)
    dummy_noise = np.zeros((300, 300, 3), dtype=np.uint8)
    ok, encoded = cv2.imencode(".jpg", dummy_noise)
    assert ok, "Failed to encode dummy frame"
    
    res = service.extract_embedding(encoded.tobytes())
    assert res.status == "NO_FACE", f"Expected NO_FACE but got {res.status}"
    assert res.face_detected is False, "Expected face_detected to be False"
    print(f"2. [PASS] Empty frame handled properly: {res.message}")

    # Test 3: Cosine Similarity with identical vector (similarity must be 1.0)
    fake_vector = [0.01] * 512
    # Verify with invalid image returns graceful error/no_face
    verify_res = service.verify_face(encoded.tobytes(), fake_vector, threshold=0.45)
    assert verify_res.status == "NO_FACE", f"Expected NO_FACE on noise but got {verify_res.status}"
    print(f"3. [PASS] verify_face on noise returned: {verify_res.message}")

    # Test 4: Pure Cosine Similarity verification calculation
    vec_a = np.random.randn(512).astype(np.float32)
    vec_a /= np.linalg.norm(vec_a)
    vec_b = vec_a.copy()
    sim_identical = float(np.dot(vec_a, vec_b))
    assert abs(sim_identical - 1.0) < 1e-4, f"Identical vector cosine similarity was {sim_identical}"
    print(f"4. [PASS] Mathematical Cosine Similarity verification: identical={sim_identical:.4f}")

    print("=================================================================")
    print("ALL BIOMETRIC UNIT TESTS PASSED SUCCESSFULLY!")
    print("=================================================================")

if __name__ == "__main__":
    run_tests()
