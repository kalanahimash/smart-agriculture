"""
InfluxDB persistence for historical sensor data.

In mock_mode, this is a no-op writer (the in-memory DataStore already
serves history for the dashboard). In live mode, every ingested reading
is also written to InfluxDB for durable long-term storage and Grafana.
"""
import logging
from datetime import datetime

from app.config import settings

log = logging.getLogger("influx_service")


class InfluxService:
    def __init__(self):
        self._client = None
        self._write_api = None
        if not settings.mock_mode:
            try:
                from influxdb_client import InfluxDBClient
                from influxdb_client.client.write_api import SYNCHRONOUS

                self._client = InfluxDBClient(
                    url=settings.influx_url, token=settings.influx_token, org=settings.influx_org
                )
                self._write_api = self._client.write_api(write_options=SYNCHRONOUS)
                log.info("Connected to InfluxDB at %s", settings.influx_url)
            except Exception as e:
                log.warning("InfluxDB unavailable (%s); historical writes disabled.", e)

    def write_reading(self, reading):
        if not self._write_api:
            return
        from influxdb_client import Point

        point = (
            Point("sensor_reading")
            .tag("node", reading.node)
            .field("air_temp_c", reading.air_temp_c or 0.0)
            .field("pressure_hpa", reading.pressure_hpa or 0.0)
            .field("soil_temp_c", reading.soil_temp_c or 0.0)
            .field("soil_moisture_pct", reading.soil_moisture_pct or 0.0)
            .field("tank_level_pct", reading.tank_level_pct or 0.0)
            .field("pump_on", int(reading.pump_on))
            .time(reading.timestamp)
        )
        try:
            self._write_api.write(bucket=settings.influx_bucket, record=point)
        except Exception as e:
            log.warning("InfluxDB write failed: %s", e)

    def query_range(self, node: str, field: str, hours: int):
        if not self._client:
            return []
        query = f'''
        from(bucket: "{settings.influx_bucket}")
          |> range(start: -{hours}h)
          |> filter(fn: (r) => r._measurement == "sensor_reading")
          |> filter(fn: (r) => r.node == "{node}")
          |> filter(fn: (r) => r._field == "{field}")
        '''
        try:
            query_api = self._client.query_api()
            tables = query_api.query(query, org=settings.influx_org)
            out = []
            for table in tables:
                for record in table.records:
                    out.append({"timestamp": record.get_time().isoformat(), "value": record.get_value()})
            return out
        except Exception as e:
            log.warning("InfluxDB query failed: %s", e)
            return []


influx_service = InfluxService()
