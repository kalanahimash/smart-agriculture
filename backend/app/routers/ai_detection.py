"""
Plant disease / health detection endpoint.

Loads a YOLOv8 model (ultralytics) if available and a weights file is
present at settings.yolo_model_path. If not, falls back to a mock
detector so the dashboard's AI panel is fully demoable without a
trained model or camera attached.

To use a real model: train/download YOLOv8 weights for plant disease
classification and place them at the configured path (see ai/README.md).
"""
import io
import logging
import random
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File
from PIL import Image

from app.config import settings
from app.models.schemas import DetectionResult, DiseaseDetection

router = APIRouter(prefix="/api/ai", tags=["ai"])
log = logging.getLogger("ai_detection")

_model = None
_model_load_attempted = False

MOCK_LABELS = ["healthy", "leaf_blight", "powdery_mildew", "healthy", "bacterial_spot"]


def _try_load_model():
    global _model, _model_load_attempted
    if _model_load_attempted:
        return
    _model_load_attempted = True
    try:
        from ultralytics import YOLO
        import os
        if os.path.exists(settings.yolo_model_path):
            _model = YOLO(settings.yolo_model_path)
            log.info("Loaded YOLO model from %s", settings.yolo_model_path)
        else:
            log.warning("YOLO weights not found at %s; using mock detections.", settings.yolo_model_path)
    except ImportError:
        log.warning("ultralytics not installed; using mock detections.")


@router.post("/detect", response_model=DetectionResult)
async def detect(image: UploadFile = File(...)):
    _try_load_model()
    contents = await image.read()

    if _model is not None:
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
        results = _model.predict(pil_image, verbose=False)
        detections = []
        healthy = diseased = 0
        for r in results:
            for box in r.boxes:
                label = _model.names[int(box.cls[0])]
                conf = float(box.conf[0])
                xyxy = box.xyxyn[0].tolist()  # normalized coords
                detections.append(DiseaseDetection(label=label, confidence=round(conf, 3), bbox=xyxy))
                if label == "healthy":
                    healthy += 1
                else:
                    diseased += 1
        return DetectionResult(detections=detections, healthy_count=healthy, diseased_count=diseased)

    # ---- Mock fallback ----
    n_detections = random.randint(1, 3)
    detections = []
    healthy = diseased = 0
    for _ in range(n_detections):
        label = random.choice(MOCK_LABELS)
        conf = round(random.uniform(0.72, 0.98), 3)
        x1, y1 = random.uniform(0, 0.6), random.uniform(0, 0.6)
        bbox = [x1, y1, x1 + random.uniform(0.1, 0.35), y1 + random.uniform(0.1, 0.35)]
        detections.append(DiseaseDetection(label=label, confidence=conf, bbox=bbox))
        if label == "healthy":
            healthy += 1
        else:
            diseased += 1

    return DetectionResult(
        timestamp=datetime.now(timezone.utc),
        detections=detections,
        healthy_count=healthy,
        diseased_count=diseased,
    )


@router.get("/status")
def ai_status():
    _try_load_model()
    return {
        "model_loaded": _model is not None,
        "mode": "real" if _model is not None else "mock",
        "model_path": settings.yolo_model_path,
    }
