from fastapi import APIRouter, Depends

from app.models.schemas import PumpCommand, ModeCommand, ThresholdCommand
from app.services.data_store import store
from app.services.mqtt_service import mqtt_service
from app.config import settings
from app.dependencies import require_role

router = APIRouter(prefix="/api/control", tags=["control"])


@router.post("/{node}/pump")
def set_pump(node: str, cmd: PumpCommand, user: dict = Depends(require_role("admin", "operator"))):
    store.pump_state[node] = cmd.on
    store.auto_mode[node] = False  # manual override, matches firmware behavior
    if not settings.mock_mode:
        mqtt_service.publish_pump(node, cmd.on)
    return {"node": node, "pump_on": cmd.on, "by": user["username"]}


@router.post("/{node}/mode")
def set_mode(node: str, cmd: ModeCommand, user: dict = Depends(require_role("admin", "operator"))):
    store.auto_mode[node] = cmd.auto
    if not settings.mock_mode:
        mqtt_service.publish_mode(node, cmd.auto)
    return {"node": node, "auto_mode": cmd.auto, "by": user["username"]}


@router.post("/{node}/thresholds")
def set_thresholds(node: str, cmd: ThresholdCommand, user: dict = Depends(require_role("admin", "operator"))):
    store.thresholds[node] = {"low_pct": cmd.low_pct, "high_pct": cmd.high_pct}
    if not settings.mock_mode:
        mqtt_service.publish_thresholds(node, cmd.low_pct, cmd.high_pct)
    return {"node": node, "thresholds": store.thresholds[node], "by": user["username"]}


@router.get("/{node}/status")
def get_control_status(node: str):
    return {
        "node": node,
        "pump_on": store.pump_state.get(node, False),
        "auto_mode": store.auto_mode.get(node, True),
        "thresholds": store.thresholds.get(node, {"low_pct": 30.0, "high_pct": 65.0}),
    }
