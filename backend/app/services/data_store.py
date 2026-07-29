"""
Central in-process data store.

Holds the latest sensor state and a rolling history buffer per node.
In mock mode, a background task synthesizes plausible readings.
In live mode, the MQTT service pushes real readings in here via `ingest()`.

This keeps the REST/WebSocket routers simple: they just read/write
through this single object rather than talking to MQTT/InfluxDB directly.
"""
import asyncio
import random
import time
from collections import deque
from datetime import datetime, timezone
from typing import Deque, Dict, List, Optional

from app.models.schemas import SensorReading
from app.config import settings

HISTORY_MAXLEN = 2000  # ~ a few days at 5s resolution, trimmed for memory


class DataStore:
    def __init__(self):
        self.latest: Dict[str, SensorReading] = {}
        self.history: Dict[str, Deque[SensorReading]] = {}
        self.pump_state: Dict[str, bool] = {}
        self.auto_mode: Dict[str, bool] = {}
        self.thresholds: Dict[str, dict] = {}
        self._subscribers: List[asyncio.Queue] = []
        self._mock_soil = 45.0
        self._mock_tank = 80.0

    # ---------- Ingestion ----------
    def ingest(self, reading: SensorReading):
        node = reading.node
        self.latest[node] = reading
        self.history.setdefault(node, deque(maxlen=HISTORY_MAXLEN)).append(reading)
        self.pump_state[node] = reading.pump_on
        self.auto_mode[node] = reading.auto_mode
        self._broadcast(reading)

    def _broadcast(self, reading: SensorReading):
        payload = reading.model_dump(mode="json")
        for q in self._subscribers:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                pass

    # ---------- WebSocket subscription ----------
    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=50)
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        if q in self._subscribers:
            self._subscribers.remove(q)

    # ---------- Queries ----------
    def get_latest(self, node: str) -> Optional[SensorReading]:
        return self.latest.get(node)

    def get_history(self, node: str, field: str, hours: int) -> List[dict]:
        cutoff = time.time() - hours * 3600
        buf = self.history.get(node, [])
        out = []
        for r in buf:
            ts = r.timestamp.replace(tzinfo=timezone.utc).timestamp() if r.timestamp.tzinfo is None else r.timestamp.timestamp()
            if ts >= cutoff:
                value = getattr(r, field, None)
                out.append({"timestamp": r.timestamp.isoformat(), "value": value})
        return out

    # ---------- Mock generator ----------
    async def run_mock_loop(self, node: str = "esp32-node-01", interval: float = 3.0):
        while True:
            self._mock_soil = max(0, min(100, self._mock_soil + random.uniform(-1.5, 0.6)))
            pump_on = self.pump_state.get(node, False)
            auto = self.auto_mode.get(node, True)
            thresholds = self.thresholds.get(node, {"low_pct": 30.0, "high_pct": 65.0})

            if auto:
                if not pump_on and self._mock_soil < thresholds["low_pct"]:
                    pump_on = True
                elif pump_on and self._mock_soil > thresholds["high_pct"]:
                    pump_on = False

            if pump_on:
                self._mock_soil = min(100, self._mock_soil + 3)
                self._mock_tank = max(0, self._mock_tank - 0.4)

            reading = SensorReading(
                node=node,
                air_temp_c=round(24 + random.uniform(-2, 3), 1),
                pressure_hpa=round(1012 + random.uniform(-3, 3), 1),
                soil_temp_c=round(21 + random.uniform(-1, 1), 1),
                soil_moisture_pct=round(self._mock_soil, 1),
                tank_level_pct=round(self._mock_tank, 1),
                pump_on=pump_on,
                auto_mode=auto,
                timestamp=datetime.now(timezone.utc),
            )
            self.pump_state[node] = pump_on
            self.ingest(reading)
            await asyncio.sleep(interval)


# Singleton used across the app
store = DataStore()
