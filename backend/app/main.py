import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.services.data_store import store
from app.services.mqtt_service import mqtt_service
from app.routers import sensors, control, auth, analytics, digital_twin, ai_detection, ws

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("main")

_background_tasks = set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.mock_mode:
        log.info("Starting in MOCK MODE - synthetic sensor data, no hardware required.")
        task = asyncio.create_task(store.run_mock_loop())
        _background_tasks.add(task)
    else:
        log.info("Starting in LIVE MODE - connecting to MQTT at %s:%s", settings.mqtt_host, settings.mqtt_port)
        mqtt_service.start()

    yield

    for task in _background_tasks:
        task.cancel()
    if not settings.mock_mode:
        mqtt_service.stop()


app = FastAPI(
    title=settings.app_name,
    description="Backend for the Edge AI-Enabled Smart Agriculture Digital Twin",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sensors.router)
app.include_router(control.router)
app.include_router(auth.router)
app.include_router(analytics.router)
app.include_router(digital_twin.router)
app.include_router(ai_detection.router)
app.include_router(ws.router)


@app.get("/")
def root():
    return {
        "name": settings.app_name,
        "status": "running",
        "mode": "mock" if settings.mock_mode else "live",
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}
