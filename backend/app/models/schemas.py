"""Pydantic schemas shared across routers."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class SensorReading(BaseModel):
    node: str
    air_temp_c: Optional[float] = None
    pressure_hpa: Optional[float] = None
    soil_temp_c: Optional[float] = None
    soil_moisture_pct: Optional[float] = None
    tank_level_pct: Optional[float] = None
    pump_on: bool = False
    auto_mode: bool = True
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class PumpCommand(BaseModel):
    on: bool


class ModeCommand(BaseModel):
    auto: bool


class ThresholdCommand(BaseModel):
    low_pct: float = Field(ge=0, le=100)
    high_pct: float = Field(ge=0, le=100)


class HistoricalQuery(BaseModel):
    node: str = "esp32-node-01"
    field: str = "soil_moisture_pct"
    range_hours: int = 24


class DiseaseDetection(BaseModel):
    label: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2] normalized 0-1


class DetectionResult(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    image_url: Optional[str] = None
    detections: List[DiseaseDetection] = []
    healthy_count: int = 0
    diseased_count: int = 0


class IrrigationStats(BaseModel):
    date: str
    pump_runtime_minutes: float
    water_used_liters: float
    irrigation_cycles: int


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "viewer"  # "admin" | "operator" | "viewer"


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class DigitalTwinState(BaseModel):
    pump_on: bool
    tank_level_pct: float
    soil_moisture_pct: float
    flow_active: bool
    plants: List[dict] = []
