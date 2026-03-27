"""
AI Service - Crack Detection API
Smart AI Engineering Platform - SPKBG

FastAPI service for YOLO-based crack detection in building images.
"""

import os
import io
import uuid
from typing import List, Optional
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import numpy as np
from PIL import Image
import uvicorn

# Try to import YOLO, fallback to mock if not available
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("Warning: YOLO not available. Running in mock mode.")

# ============================================================================
# CONFIGURATION
# ============================================================================

MODEL_PATH = os.getenv("MODEL_PATH", "./model/best.pt")
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.25"))
IOU_THRESHOLD = float(os.getenv("IOU_THRESHOLD", "0.45"))

# ============================================================================
# LOAD MODEL
# ============================================================================

model = None
if YOLO_AVAILABLE and Path(MODEL_PATH).exists():
    try:
        model = YOLO(MODEL_PATH)
        print(f"✅ Model loaded from {MODEL_PATH}")
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        model = None
else:
    print("⚠️  Running without model (mock mode)")

# ============================================================================
# FASTAPI APP
# ============================================================================

app = FastAPI(
    title="SPKBG AI Service",
    description="AI Crack Detection API for Building Assessment",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class DetectionBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    class_id: int
    class_name: str

class DetectionResult(BaseModel):
    id: str
    image_name: str
    detections: List[DetectionBox]
    total_cracks: int
    severity: str
    processing_time: float
    created_at: str

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    version: str
    timestamp: str

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def determine_severity(detections: List[DetectionBox]) -> str:
    """Determine severity based on number and size of cracks."""
    if not detections:
        return "none"
    
    count = len(detections)
    high_confidence = sum(1 for d in detections if d.confidence > 0.7)
    
    if count >= 5 or high_confidence >= 3:
        return "high"
    elif count >= 2 or high_confidence >= 1:
        return "medium"
    else:
        return "low"

def mock_detection(image: np.ndarray) -> List[DetectionBox]:
    """Mock detection for testing without model."""
    # Return random mock detections
    import random
    num_detections = random.randint(0, 3)
    detections = []
    
    for i in range(num_detections):
        x1 = random.uniform(0.1, 0.6) * image.shape[1]
        y1 = random.uniform(0.1, 0.6) * image.shape[0]
        w = random.uniform(50, 200)
        h = random.uniform(10, 50)
        
        detections.append(DetectionBox(
            x1=float(x1),
            y1=float(y1),
            x2=float(x1 + w),
            y2=float(y1 + h),
            confidence=random.uniform(0.3, 0.9),
            class_id=0,
            class_name="crack"
        ))
    
    return detections

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        model_loaded=model is not None,
        version="1.0.0",
        timestamp=datetime.now().isoformat()
    )

@app.post("/detect", response_model=DetectionResult)
async def detect_cracks(
    file: UploadFile = File(...),
    survey_id: Optional[str] = Form(None),
    component_id: Optional[str] = Form(None)
):
    """
    Detect cracks in uploaded image.
    
    - **file**: Image file to analyze
    - **survey_id**: Optional survey reference
    - **component_id**: Optional component reference
    """
    start_time = datetime.now()
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Read image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Convert to RGB if necessary
        if image.mode != "RGB":
            image = image.convert("RGB")
        
        image_np = np.array(image)
        
        # Run detection
        if model is not None and YOLO_AVAILABLE:
            # Real YOLO detection
            results = model(
                image_np,
                conf=CONFIDENCE_THRESHOLD,
                iou=IOU_THRESHOLD
            )[0]
            
            detections = []
            for box in results.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append(DetectionBox(
                    x1=float(x1),
                    y1=float(y1),
                    x2=float(x2),
                    y2=float(y2),
                    confidence=float(box.conf[0]),
                    class_id=int(box.cls[0]),
                    class_name="crack"  # Adjust based on your model classes
                ))
        else:
            # Mock detection
            detections = mock_detection(image_np)
        
        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # Create result
        result = DetectionResult(
            id=str(uuid.uuid4()),
            image_name=file.filename,
            detections=detections,
            total_cracks=len(detections),
            severity=determine_severity(detections),
            processing_time=processing_time,
            created_at=datetime.now().isoformat()
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

@app.post("/detect-batch")
async def detect_cracks_batch(files: List[UploadFile] = File(...)):
    """
    Detect cracks in multiple images.
    """
    results = []
    
    for file in files:
        try:
            result = await detect_cracks(file=file)
            results.append({
                "success": True,
                "result": result
            })
        except Exception as e:
            results.append({
                "success": False,
                "error": str(e),
                "filename": file.filename
            })
    
    return {
        "processed": len(results),
        "results": results
    }

@app.get("/model-info")
async def model_info():
    """Get model information."""
    return {
        "model_loaded": model is not None,
        "model_path": MODEL_PATH,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "iou_threshold": IOU_THRESHOLD,
        "yolo_available": YOLO_AVAILABLE
    }

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    print(f"🚀 Starting AI Service on {host}:{port}")
    print(f"📊 Model path: {MODEL_PATH}")
    print(f"🔧 Confidence threshold: {CONFIDENCE_THRESHOLD}")
    
    uvicorn.run(app, host=host, port=port, reload=True)
