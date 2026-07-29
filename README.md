# 🌱 Edge AI–Enabled Smart Agriculture Digital Twin
### Autonomous Irrigation, Plant Health Monitoring & Industrial IoT Analytics

Edge AI–Enabled Smart Agriculture Digital Twin is a full-stack Industrial IoT system combining
Embedded Systems, Edge AI, Industrial Communication, Computer Vision, Cloud Technologies, and
Data Analytics into a single intelligent agriculture platform.

It continuously monitors environmental conditions, automates irrigation, detects plant diseases
using AI, visualizes the farm through a Digital Twin, and provides a real-time dashboard.

---

## ⚠️ Status of this repository

This is a complete, runnable **software skeleton** — not a finished, field-tested product.

| Layer | Status |
|---|---|
| ESP32 firmware | Written against real Arduino/ESP32 libraries. **Not flashed or tested on physical hardware.** Calibrate `SOIL_MOISTURE_DRY/WET` and `TANK_HEIGHT_CM` for your sensors. |
| RS485 gateway | Real serial implementation + a `--mock` mode that fabricates sensor data so you can develop without hardware. |
| Backend (FastAPI) | Fully implemented, all Python files syntax-checked. Runs standalone in `MOCK_MODE=true` (default) with zero external dependencies besides `pip install`. |
| Dashboard (React) | Fully implemented. Needs `npm install` — not run/built in this environment (no network access when this was generated). |
| AI disease detection | Falls back to a mock detector automatically if no trained YOLOv8 weights are present — see `ai/README.md` to train a real model. |
| Docker Compose | Wires everything together; not run end-to-end here for the same reason. |

Everything here compiles/parses cleanly and follows the intended architecture, but **test it
locally before trusting it with real hardware** (especially the pump relay logic).

---

## Quick Start (software only, no hardware needed)

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env      # MOCK_MODE=true by default
uvicorn app.main:app --reload
```
Visit `http://localhost:8000/docs` for the interactive API docs. It will immediately start
generating synthetic sensor readings.

### Dashboard
```bash
cd dashboard
npm install
npm run dev
```
Visit `http://localhost:5173`. The Vite dev server proxies `/api` and `/ws` to `localhost:8000`.

### Everything via Docker Compose (real MQTT + InfluxDB + Grafana)
```bash
docker compose up -d --build
```
- Dashboard: http://localhost:5173
- Backend API docs: http://localhost:8000/docs
- Grafana: http://localhost:3001 (admin/admin)
- InfluxDB UI: http://localhost:8086

The `gateway` service runs in `--mock` mode by default. To use real ESP32 hardware, edit its
`command:` in `docker-compose.yml` to point at `/dev/ttyUSB0` and uncomment the `devices:` mapping.

### ESP32 Firmware
```bash
cd firmware
pio run -t upload      # PlatformIO CLI, or open the folder in VS Code + PlatformIO extension
```
See `hardware/WIRING.md` for pin assignments before flashing.

---

## System Architecture

```
                    Internet
                        │
               Remote Dashboard
                        │
                Cloudflare Tunnel (optional)
                        │
                 Raspberry Pi 3B
       ┌────────────────┼─────────────────┐
       │                │                 │
   FastAPI          InfluxDB          Grafana
       │                │
       │            Historical Data
       │
    MQTT Broker (Mosquitto)
       │
    RS485 Gateway (Python)
       │
   HW-0519 RS485
       │
    ESP32 WROOM
       │
 ┌─────┼──────────────┐
 │     │      │       │
BMP280 DS18B20 Soil HC-SR04
 │
Relay → Water Pump
```

---

## Key Features

**Embedded** — ESP32 sensor node, real-time acquisition, automatic irrigation, relay control,
OLED status display, RS485 communication with CRC8-checked framing.

**Edge AI** — Raspberry Pi camera capture, YOLOv8 plant/disease detection with a mock fallback
when no trained model is present.

**Industrial IoT** — RS485 field bus, MQTT messaging, gateway architecture, multi-node support.

**Dashboard** — Live sensor data over WebSocket, historical charts, pump control, AI detection
viewer, Digital Twin visualization, mobile-responsive layout, JWT-based auth for control actions.

**Analytics** — Temperature/moisture trends, water consumption estimates, pump runtime, daily
irrigation statistics.

---

## Hardware Components

| Category | Parts |
|---|---|
| Controller | ESP32 WROOM, Raspberry Pi 3B |
| Sensors | BMP280, DS18B20, capacitive soil moisture sensor, HC-SR04 |
| Actuators | Relay module, 5V water pump, SG90 servo (future) |
| Communication | HW-0519 RS485 ×2 |
| Display | SSD1306 OLED |
| Power | LM2596 buck converter, TP4056 charger, 18650 batteries |
| Vision | Raspberry Pi Camera |

See `hardware/WIRING.md` for full pin mapping.

---

## Software Stack

- **Embedded:** C++, Arduino framework (via PlatformIO), ArduinoJson, OneWire/DallasTemperature
- **Gateway:** Python, pyserial, paho-mqtt
- **Backend:** FastAPI, WebSockets, InfluxDB client, python-jose (JWT), passlib
- **AI:** Ultralytics YOLOv8, OpenCV, Pillow
- **Dashboard:** React 18, TypeScript, Tailwind CSS, Recharts, Vite
- **Database:** InfluxDB 2.x
- **Visualization:** Grafana
- **Messaging:** Mosquitto (MQTT)

---

## Folder Structure

```
smart-agriculture/
├── firmware/          ESP32 source (PlatformIO project)
├── gateway/            Raspberry Pi RS485-to-MQTT bridge
├── backend/            FastAPI server
├── dashboard/           React dashboard
├── ai/                  YOLO detection scripts + model weights folder
├── database/            InfluxDB setup + example Flux queries
├── docs/                 Documentation, images
├── hardware/             Wiring guide
├── docker/               Mosquitto + Grafana provisioning
└── docker-compose.yml    Full-stack orchestration
```

---

## Dashboard Modules

Home (live overview) · Environment · Soil · Water · AI (disease detection) · Analytics ·
Digital Twin · Settings (thresholds, mode, auth)

## API Overview

| Endpoint | Purpose |
|---|---|
| `GET /api/sensors/{node}/latest` | Latest reading for a node |
| `GET /api/sensors/{node}/history` | Historical time series |
| `POST /api/control/{node}/pump` | Manual pump on/off (auth required) |
| `POST /api/control/{node}/mode` | Auto/manual mode (auth required) |
| `POST /api/control/{node}/thresholds` | Set irrigation thresholds (auth required) |
| `GET /api/analytics/{node}/irrigation-stats` | Daily water usage stats |
| `GET /api/twin/{node}/state` | Digital Twin state |
| `POST /api/ai/detect` | Upload an image for disease detection |
| `POST /api/auth/login` | Get a JWT for control actions |
| `WS /ws/live` | Live sensor stream |

Default dev login: `admin` / `admin123` (change `SECRET_KEY` and this password before any real
deployment — see `backend/.env.example`).

---

## Future Improvements

- LoRa sensor nodes for longer range
- Solar-powered field stations
- Weather forecast API integration
- Mobile application
- Fertilizer recommendation engine
- Multi-farm support
- OTA firmware updates

---

## License

MIT License

## Author

Kalana Himash Hansan
Computer Systems Engineering Undergraduate
Embedded Systems • Industrial IoT • Edge AI • Robotics
