"""Aggregates live state into the shape the Digital Twin visualization needs."""
from fastapi import APIRouter

from app.models.schemas import DigitalTwinState
from app.services.data_store import store

router = APIRouter(prefix="/api/twin", tags=["digital-twin"])

# Static plant layout for the demo farm bed. In a multi-node deployment
# each plant could map to its own soil sensor node.
DEFAULT_PLANT_LAYOUT = [
    {"id": "p1", "x": 0.15, "y": 0.3, "species": "tomato"},
    {"id": "p2", "x": 0.35, "y": 0.3, "species": "tomato"},
    {"id": "p3", "x": 0.55, "y": 0.3, "species": "pepper"},
    {"id": "p4", "x": 0.75, "y": 0.3, "species": "pepper"},
    {"id": "p5", "x": 0.15, "y": 0.7, "species": "lettuce"},
    {"id": "p6", "x": 0.35, "y": 0.7, "species": "lettuce"},
    {"id": "p7", "x": 0.55, "y": 0.7, "species": "basil"},
    {"id": "p8", "x": 0.75, "y": 0.7, "species": "basil"},
]


@router.get("/{node}/state", response_model=DigitalTwinState)
def get_twin_state(node: str):
    reading = store.get_latest(node)
    if not reading:
        return DigitalTwinState(
            pump_on=False, tank_level_pct=0, soil_moisture_pct=0,
            flow_active=False, plants=DEFAULT_PLANT_LAYOUT,
        )

    plants = []
    for p in DEFAULT_PLANT_LAYOUT:
        health = "healthy" if (reading.soil_moisture_pct or 0) > 30 else "stressed"
        plants.append({**p, "health": health})

    return DigitalTwinState(
        pump_on=reading.pump_on,
        tank_level_pct=reading.tank_level_pct or 0,
        soil_moisture_pct=reading.soil_moisture_pct or 0,
        flow_active=reading.pump_on,
        plants=plants,
    )
