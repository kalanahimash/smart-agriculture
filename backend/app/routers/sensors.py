from fastapi import APIRouter, HTTPException, Query
from typing import List

from app.models.schemas import SensorReading, HistoricalQuery
from app.services.data_store import store
from app.services.influx_service import influx_service
from app.config import settings

router = APIRouter(prefix="/api/sensors", tags=["sensors"])


@router.get("/nodes", response_model=List[str])
def list_nodes():
    return list(store.latest.keys())


@router.get("/{node}/latest", response_model=SensorReading)
def get_latest(node: str):
    reading = store.get_latest(node)
    if not reading:
        raise HTTPException(status_code=404, detail=f"No data yet for node '{node}'")
    return reading


@router.get("/{node}/history")
def get_history(
    node: str,
    field: str = Query("soil_moisture_pct", description="Sensor field to chart"),
    hours: int = Query(24, ge=1, le=720),
):
    if settings.mock_mode:
        data = store.get_history(node, field, hours)
    else:
        data = influx_service.query_range(node, field, hours) or store.get_history(node, field, hours)

    return {"node": node, "field": field, "hours": hours, "points": data}
