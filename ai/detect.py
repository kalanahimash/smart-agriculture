"""
Standalone plant disease detection script.

Runs independently of the FastAPI backend — useful for testing the
camera + model pipeline directly on the Raspberry Pi, or for a cron/
systemd job that periodically snapshots the crop and pushes results
to the backend's /api/ai/detect endpoint (or writes locally).

Usage:
    python detect.py --source camera --interval 300
    python detect.py --source image.jpg

Requires a trained YOLOv8 model. Train one with the Ultralytics CLI:
    yolo train data=plant_disease.yaml model=yolov8n.pt epochs=100

Public plant-disease datasets to start from (not included here):
    - PlantVillage (Kaggle)
    - PlantDoc
Roboflow Universe also hosts several pre-labeled agricultural datasets.
"""
import argparse
import json
import time
import sys
from pathlib import Path

MODEL_PATH = Path(__file__).parent / "models" / "plant_disease.pt"


def load_model():
    try:
        from ultralytics import YOLO
    except ImportError:
        print("ultralytics not installed. Run: pip install ultralytics", file=sys.stderr)
        sys.exit(1)

    if not MODEL_PATH.exists():
        print(
            f"No trained weights found at {MODEL_PATH}.\n"
            "Train a model with the Ultralytics CLI and place the .pt file there, "
            "or point --weights at a different path.",
            file=sys.stderr,
        )
        sys.exit(1)

    return YOLO(str(MODEL_PATH))


def detect_from_image(model, image_path: str):
    results = model.predict(image_path, verbose=False)
    detections = []
    for r in results:
        for box in r.boxes:
            detections.append({
                "label": model.names[int(box.cls[0])],
                "confidence": round(float(box.conf[0]), 3),
                "bbox": box.xyxyn[0].tolist(),
            })
    return detections


def capture_from_camera(camera_index: int = 0):
    try:
        import cv2
    except ImportError:
        print("opencv-python not installed. Run: pip install opencv-python", file=sys.stderr)
        sys.exit(1)

    cap = cv2.VideoCapture(camera_index)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise RuntimeError(f"Could not read from camera index {camera_index}")

    tmp_path = "/tmp/agri_capture.jpg"
    cv2.imwrite(tmp_path, frame)
    return tmp_path


def main():
    parser = argparse.ArgumentParser(description="Plant disease detection")
    parser.add_argument("--source", default="camera", help="'camera' or a path to an image file")
    parser.add_argument("--camera-index", type=int, default=0)
    parser.add_argument("--interval", type=int, default=0, help="Seconds between captures; 0 = run once")
    parser.add_argument("--weights", default=None, help="Override path to YOLO .pt weights")
    args = parser.parse_args()

    global MODEL_PATH
    if args.weights:
        MODEL_PATH = Path(args.weights)

    model = load_model()

    def run_once():
        image_path = capture_from_camera(args.camera_index) if args.source == "camera" else args.source
        detections = detect_from_image(model, image_path)
        print(json.dumps({"image": image_path, "detections": detections}, indent=2))

    if args.interval > 0:
        print(f"Running detection every {args.interval}s. Ctrl+C to stop.")
        while True:
            run_once()
            time.sleep(args.interval)
    else:
        run_once()


if __name__ == "__main__":
    main()
