# AI — Plant Disease Detection

This folder holds the YOLOv8-based plant disease/health detection pipeline.

## Files

- `detect.py` — standalone script for camera capture + inference, independent of the backend
- `models/` — place trained `.pt` weights here (e.g. `plant_disease.pt`)

## How the backend uses this

`backend/app/routers/ai_detection.py` loads a model from the path in
`YOLO_MODEL_PATH` (see `backend/.env.example`). If no weights file is
found, or `ultralytics` isn't installed, it automatically falls back to
a **mock detector** that returns plausible random detections so the
dashboard's AI panel is fully demoable without any trained model.

## Training your own model

1. Install Ultralytics: `pip install ultralytics`
2. Get a labeled dataset — good starting points:
   - PlantVillage (Kaggle)
   - PlantDoc
   - Roboflow Universe agricultural datasets
3. Format it as a YOLO detection/classification dataset (`data.yaml` + image/label folders)
4. Train:
   ```
   yolo train data=plant_disease.yaml model=yolov8n.pt epochs=100 imgsz=640
   ```
5. Copy the resulting `best.pt` to `ai/models/plant_disease.pt`
6. Restart the backend — it will auto-detect the weights and switch out of mock mode
   (confirm via `GET /api/ai/status`)

## Running detection standalone

```bash
# Single image
python detect.py --source path/to/leaf.jpg

# From the Pi camera, once
python detect.py --source camera

# From the Pi camera, every 5 minutes
python detect.py --source camera --interval 300
```
