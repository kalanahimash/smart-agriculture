"""
MQTT client wiring for live (non-mock) mode.

Subscribes to `farm/+/sensors` and pushes readings into the DataStore.
Publishes outgoing pump/mode/threshold commands from the API layer.
"""
import json
import logging
import threading

import paho.mqtt.client as mqtt

from app.config import settings
from app.models.schemas import SensorReading
from app.services.data_store import store

log = logging.getLogger("mqtt_service")


class MqttService:
    def __init__(self):
        self.client = mqtt.Client(client_id="smart-agri-backend")
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self._connected = False

    def start(self):
        try:
            self.client.connect(settings.mqtt_host, settings.mqtt_port, keepalive=30)
            self.client.loop_start()
        except Exception as e:
            log.warning("Could not connect to MQTT broker (%s). Live data will not flow.", e)

    def stop(self):
        self.client.loop_stop()

    def _on_connect(self, client, userdata, flags, rc):
        self._connected = rc == 0
        log.info("MQTT connected: rc=%s", rc)
        client.subscribe(f"{settings.mqtt_topic_prefix}/+/sensors")

    def _on_message(self, client, userdata, msg):
        try:
            data = json.loads(msg.payload.decode())
            reading = SensorReading(**data)
            store.ingest(reading)
        except Exception as e:
            log.warning("Failed to process MQTT message on %s: %s", msg.topic, e)

    def publish_pump(self, node: str, on: bool):
        topic = f"{settings.mqtt_topic_prefix}/{node}/cmd/pump"
        self.client.publish(topic, json.dumps({"on": on}))

    def publish_mode(self, node: str, auto: bool):
        topic = f"{settings.mqtt_topic_prefix}/{node}/cmd/mode"
        self.client.publish(topic, json.dumps({"auto": auto}))

    def publish_thresholds(self, node: str, low_pct: float, high_pct: float):
        topic = f"{settings.mqtt_topic_prefix}/{node}/cmd/thresholds"
        self.client.publish(topic, json.dumps({"low_pct": low_pct, "high_pct": high_pct}))


mqtt_service = MqttService()
