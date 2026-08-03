"""
Raspberry Pi Gateway
---------------------
Bridges the RS485 sensor network to MQTT.

- Reads frames from the ESP32 node(s) via a USB-RS485 adapter
- Publishes sensor reports to MQTT topics
- Subscribes to command topics and forwards them to nodes as RS485 frames
- Falls back to a mock data generator if no serial port is available
  (useful for developing the backend/dashboard without hardware)

Run:
    python gateway.py --port /dev/ttyUSB0 --mqtt-host localhost
    python gateway.py --mock                      # no hardware needed
"""
import argparse
import json
import logging
import time
import threading
import random
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

from protocol import (
    FrameParser, build_frame,
    CMD_DATA_REPORT, CMD_POLL_DATA, CMD_SET_PUMP, CMD_SET_MODE, CMD_SET_THRESHOLDS, CMD_PING,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("gateway")

MQTT_TOPIC_SENSOR = "farm/{node}/sensors"
MQTT_TOPIC_STATUS = "farm/{node}/status"
MQTT_TOPIC_CMD_PUMP = "farm/{node}/cmd/pump"
MQTT_TOPIC_CMD_MODE = "farm/{node}/cmd/mode"
MQTT_TOPIC_CMD_THRESHOLDS = "farm/{node}/cmd/thresholds"

DEFAULT_SLAVE_ID = 0x01

KEY_MAP = {
    "id": "node",
    "at": "air_temp_c",
    "pr": "pressure_hpa",
    "st": "soil_temp_c",
    "sm": "soil_moisture_pct",
    "tl": "tank_level_pct",
    "po": "pump_on",
    "am": "auto_mode",
    "bv": "pump_bus_voltage",
    "lv": "pump_load_voltage",
    "cm": "pump_current_ma",
    "pw": "pump_power_mw",
    "up": "uptime_s",
}


class SerialRS485Backend:
    """Real hardware backend using pyserial."""

    def __init__(self, port: str, baud: int = 9600):
        import serial  # imported lazily so --mock works without pyserial installed
        self._serial = serial.Serial(port, baudrate=baud, timeout=0.1)
        self._parser = FrameParser()
        log.info("Opened RS485 serial port %s @ %d baud", port, baud)

    def read_frames(self):
        data = self._serial.read(256)
        if data:
            self._parser.feed(data)
        return self._parser.parse_all()

    def send(self, raw: bytes):
        self._serial.write(raw)


class MockRS485Backend:
    """Simulated backend that fabricates plausible sensor reports."""

    def __init__(self):
        self._soil = 45.0
        self._tank = 80.0
        self._pump_on = False
        log.info("Using MOCK RS485 backend (no hardware required)")

    def read_frames(self):
        # Drift soil moisture down over time, tank drains slowly when pump runs
        self._soil = max(0, min(100, self._soil + random.uniform(-1.5, 0.5)))
        if self._pump_on:
            self._soil = min(100, self._soil + 3)
            self._tank = max(0, self._tank - 0.5)

        payload = json.dumps({
            "id": "esp32-node-01",
            "at": round(24 + random.uniform(-2, 3), 1),
            "pr": round(1012 + random.uniform(-3, 3), 1),
            "st": round(21 + random.uniform(-1, 1), 1),
            "sm": round(self._soil, 1),
            "tl": round(self._tank, 1),
            "po": self._pump_on,
            "am": True,
            "up": int(time.time()),
        }).encode()

        from protocol import Frame
        return [Frame(slave_id=DEFAULT_SLAVE_ID, cmd=CMD_DATA_REPORT, payload=payload)]

    def send(self, raw: bytes):
        # Peek at outgoing pump commands so the mock reflects them
        if len(raw) >= 5 and raw[2] == CMD_SET_PUMP and len(raw) >= 6:
            self._pump_on = bool(raw[4])
            log.info("[MOCK] pump set to %s", self._pump_on)


class Gateway:
    def __init__(self, backend, mqtt_host: str, mqtt_port: int, poll_interval: float):
        self.backend = backend
        self.poll_interval = poll_interval

        try:
            self.mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, client_id="smart-agri-gateway")
        except (AttributeError, TypeError):
            self.mqtt_client = mqtt.Client(client_id="smart-agri-gateway")

        self.mqtt_client.on_connect = self._on_connect
        self.mqtt_client.connect(mqtt_host, mqtt_port, keepalive=30)
        self.mqtt_client.loop_start()

        self._last_frame_time = 0.0
        self._is_online = False
        self._last_node = f"node-{DEFAULT_SLAVE_ID}"

    def _on_connect(self, client, userdata, flags, rc):
        log.info("Connected to MQTT broker (rc=%s)", rc)
        client.subscribe(MQTT_TOPIC_CMD_PUMP.format(node="+"))
        client.subscribe(MQTT_TOPIC_CMD_MODE.format(node="+"))
        client.subscribe(MQTT_TOPIC_CMD_THRESHOLDS.format(node="+"))
        client.on_message = self._on_mqtt_message

    def _on_mqtt_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
        except json.JSONDecodeError:
            log.warning("Bad MQTT command payload on %s", msg.topic)
            return

        if msg.topic.endswith("/cmd/pump"):
            on = 1 if payload.get("on") else 0
            frame = build_frame(DEFAULT_SLAVE_ID, CMD_SET_PUMP, bytes([on]))
            self.backend.send(frame)
            log.info("Forwarded pump command: on=%s", bool(on))

        elif msg.topic.endswith("/cmd/mode"):
            auto = 1 if payload.get("auto") else 0
            frame = build_frame(DEFAULT_SLAVE_ID, CMD_SET_MODE, bytes([auto]))
            self.backend.send(frame)
            log.info("Forwarded mode command: auto=%s", bool(auto))

        elif msg.topic.endswith("/cmd/thresholds"):
            import struct
            low = float(payload.get("low_pct", 30.0))
            high = float(payload.get("high_pct", 65.0))
            frame = build_frame(DEFAULT_SLAVE_ID, CMD_SET_THRESHOLDS, struct.pack("<ff", low, high))
            self.backend.send(frame)
            log.info("Forwarded thresholds: low=%.1f high=%.1f", low, high)

    def _check_connectivity(self):
        if self._is_online and (time.time() - self._last_frame_time >= 30.0):
            self._is_online = False
            topic = MQTT_TOPIC_STATUS.format(node=self._last_node)
            self.mqtt_client.publish(topic, json.dumps({"online": False}), qos=1)
            log.warning("Node %s is offline (no frame for 30s)", self._last_node)

    def run(self):
        log.info("Gateway running, polling every %.1fs", self.poll_interval)
        while True:
            self.backend.send(build_frame(DEFAULT_SLAVE_ID, CMD_POLL_DATA))
            for frame in self.backend.read_frames():
                self._handle_frame(frame)
            self._check_connectivity()
            time.sleep(self.poll_interval)

    def _handle_frame(self, frame):
        self._last_frame_time = time.time()

        if frame.cmd == CMD_DATA_REPORT:
            try:
                data = json.loads(frame.payload.decode())
            except (json.JSONDecodeError, UnicodeDecodeError):
                log.warning("Malformed sensor report, dropping")
                return

            expanded = {KEY_MAP.get(k, k): v for k, v in data.items()}
            node = expanded.get("node", f"node-{frame.slave_id}")
            self._last_node = node

            if not self._is_online:
                self._is_online = True
                status_topic = MQTT_TOPIC_STATUS.format(node=node)
                self.mqtt_client.publish(status_topic, json.dumps({"online": True}), qos=1)
                log.info("Node %s is online", node)

            expanded["timestamp"] = datetime.now(timezone.utc).isoformat()

            topic = MQTT_TOPIC_SENSOR.format(node=node)
            self.mqtt_client.publish(topic, json.dumps(expanded), qos=1)
            log.debug("Published to %s: %s", topic, expanded)
        else:
            node = f"node-{frame.slave_id}"
            self._last_node = node
            if not self._is_online:
                self._is_online = True
                status_topic = MQTT_TOPIC_STATUS.format(node=node)
                self.mqtt_client.publish(status_topic, json.dumps({"online": True}), qos=1)
                log.info("Node %s is online", node)
            log.debug("Received non-data frame cmd=0x%02X", frame.cmd)


def main():
    parser = argparse.ArgumentParser(description="Smart Agriculture RS485-to-MQTT Gateway")
    parser.add_argument("--port", default="/dev/ttyUSB0", help="Serial port for RS485 adapter")
    parser.add_argument("--baud", type=int, default=9600)
    parser.add_argument("--mqtt-host", default="localhost")
    parser.add_argument("--mqtt-port", type=int, default=1883)
    parser.add_argument("--poll-interval", type=float, default=0.2)
    parser.add_argument("--mock", action="store_true", help="Use simulated sensor data instead of real hardware")
    args = parser.parse_args()

    if args.mock:
        backend = MockRS485Backend()
    else:
        try:
            backend = SerialRS485Backend(args.port, args.baud)
        except Exception as e:
            log.error("Could not open serial port %s (%s). Falling back to --mock.", args.port, e)
            backend = MockRS485Backend()

    gw = Gateway(backend, args.mqtt_host, args.mqtt_port, args.poll_interval)
    try:
        gw.run()
    except KeyboardInterrupt:
        log.info("Shutting down gateway.")


if __name__ == "__main__":
    main()

