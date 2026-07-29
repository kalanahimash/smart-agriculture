"""
Analytics endpoints: derives irrigation statistics, water consumption,
and pump runtime from the sensor history buffer.

In mock mode these are computed from the in-memory history deque.
In live mode, swap in an InfluxDB aggregate query for production scale.
"""
from datetime import datetime, timedelta, timezone
from collections import defaultdict

from fastapi import APIRouter, Query

from app.services.data_store import store

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# Rough pump flow rate for estimating water usage from runtime.
PUMP_FLOW_LPM = 2.0  # liters per minute, adjust to your actual pump spec


@router.get("/{node}/irrigation-stats")
def irrigation_stats(node: str, days: int = Query(7, ge=1, le=90)):
    history = list(store.history.get(node, []))
    if not history:
        return {"node": node, "days": days, "stats": []}

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    daily = defaultdict(lambda: {"pump_seconds": 0, "cycles": 0, "prev_state": False})

    prev_ts = None
    for reading in history:
        ts = reading.timestamp
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts < cutoff:
            continue

        day_key = ts.strftime("%Y-%m-%d")
        bucket = daily[day_key]

        if prev_ts is not None and reading.pump_on:
            delta = (ts - prev_ts).total_seconds()
            if 0 < delta < 3600:  # ignore gaps
                bucket["pump_seconds"] += delta

        if reading.pump_on and not bucket["prev_state"]:
            bucket["cycles"] += 1
        bucket["prev_state"] = reading.pump_on
        prev_ts = ts

    stats = []
    for day, bucket in sorted(daily.items()):
        minutes = bucket["pump_seconds"] / 60.0
        stats.append({
            "date": day,
            "pump_runtime_minutes": round(minutes, 1),
            "water_used_liters": round(minutes * PUMP_FLOW_LPM, 1),
            "irrigation_cycles": bucket["cycles"],
        })

    return {"node": node, "days": days, "stats": stats}


@router.get("/{node}/summary")
def summary(node: str):
    latest = store.get_latest(node)
    history = list(store.history.get(node, []))
    if not latest or not history:
        return {"node": node, "available": False}

    soil_values = [r.soil_moisture_pct for r in history if r.soil_moisture_pct is not None]
    temp_values = [r.air_temp_c for r in history if r.air_temp_c is not None]

    return {
        "node": node,
        "available": True,
        "current": latest.model_dump(mode="json"),
        "soil_moisture_avg_pct": round(sum(soil_values) / len(soil_values), 1) if soil_values else None,
        "soil_moisture_min_pct": round(min(soil_values), 1) if soil_values else None,
        "soil_moisture_max_pct": round(max(soil_values), 1) if soil_values else None,
        "air_temp_avg_c": round(sum(temp_values) / len(temp_values), 1) if temp_values else None,
        "sample_count": len(history),
    }
