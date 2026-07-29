"""Application configuration, loaded from environment variables."""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # General
    app_name: str = "Smart Agriculture Backend"
    environment: str = os.getenv("ENVIRONMENT", "development")

    # Mock mode: generate synthetic data instead of requiring MQTT/InfluxDB.
    # Defaults to True so the backend runs standalone during development.
    mock_mode: bool = os.getenv("MOCK_MODE", "true").lower() == "true"

    # MQTT
    mqtt_host: str = os.getenv("MQTT_HOST", "localhost")
    mqtt_port: int = int(os.getenv("MQTT_PORT", "1883"))
    mqtt_topic_prefix: str = os.getenv("MQTT_TOPIC_PREFIX", "farm")

    # InfluxDB
    influx_url: str = os.getenv("INFLUX_URL", "http://localhost:8086")
    influx_token: str = os.getenv("INFLUX_TOKEN", "dev-token")
    influx_org: str = os.getenv("INFLUX_ORG", "smart-agriculture")
    influx_bucket: str = os.getenv("INFLUX_BUCKET", "sensors")

    # Auth
    secret_key: str = os.getenv("SECRET_KEY", "change-me-in-production")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
    algorithm: str = "HS256"

    # Default admin (dev only — change in production)
    default_admin_user: str = os.getenv("DEFAULT_ADMIN_USER", "admin")
    default_admin_password: str = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")

    # AI
    yolo_model_path: str = os.getenv("YOLO_MODEL_PATH", "ai/models/plant_disease.pt")
    camera_index: int = int(os.getenv("CAMERA_INDEX", "0"))

    class Config:
        env_file = ".env"


settings = Settings()
