/*
 * Edge AI-Enabled Smart Agriculture - ESP32 Sensor Node
 * ------------------------------------------------------
 * Reads environmental + soil sensors, drives the irrigation relay,
 * shows live status on an OLED, and reports over RS485 to the
 * Raspberry Pi gateway.
 *
 * NOTE: Written against real Arduino/ESP32 libraries but not yet
 * flashed/tested on physical hardware. Calibrate SOIL_MOISTURE_DRY/WET
 * and TANK_HEIGHT_CM for your actual sensors before deploying.
 *
 * Dependencies (install via Arduino Library Manager / PlatformIO):
 *   - Adafruit BMP280 Library
 *   - Adafruit SSD1306 + Adafruit GFX
 *   - OneWire
 *   - DallasTemperature
 *   - ArduinoJson
 */

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>

#include "config.h"
#include "protocol.h"
#include "RS485Link.h"

// ---------- Peripherals ----------
Adafruit_BMP280 bmp;
Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
OneWire oneWire(ONEWIRE_PIN);
DallasTemperature soilTempSensor(&oneWire);
RS485Link rs485(Serial2, RS485_DE_RE_PIN);

// ---------- State ----------
struct SensorState {
    float airTempC = NAN;
    float pressureHPa = NAN;
    float soilTempC = NAN;
    float soilMoisturePct = NAN;
    float tankLevelPct = NAN;
    bool pumpOn = false;
    bool autoMode = true;
    unsigned long pumpStartedAt = 0;
} state;

float thresholdLowPct = SOIL_MOISTURE_LOW_PCT;
float thresholdHighPct = SOIL_MOISTURE_HIGH_PCT;

unsigned long lastSensorRead = 0;
unsigned long lastDataSend = 0;
unsigned long lastOledRefresh = 0;

// ---------- Forward declarations ----------
void readSensors();
void updateIrrigationLogic();
void setPump(bool on);
void updateOled();
void sendSensorReport();
void handleIncomingRS485();
float readSoilMoisturePercent();
float readTankLevelPercent();

void setup() {
    Serial.begin(115200);
    delay(300);
    Serial.println(F("[BOOT] Smart Agriculture ESP32 Node starting..."));
    Serial.printf("[BOOT] Node ID: %s  FW: %s\n", NODE_ID, FIRMWARE_VERSION);

    // Relay
    pinMode(RELAY_PIN, OUTPUT);
    setPump(false);

    // Ultrasonic
    pinMode(HCSR04_TRIG_PIN, OUTPUT);
    pinMode(HCSR04_ECHO_PIN, INPUT);

    // I2C bus (BMP280 + OLED)
    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

    if (!bmp.begin(BMP280_ADDRESS)) {
        Serial.println(F("[ERROR] BMP280 not found - check wiring"));
    } else {
        bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                         Adafruit_BMP280::SAMPLING_X2,
                         Adafruit_BMP280::SAMPLING_X16,
                         Adafruit_BMP280::FILTER_X16,
                         Adafruit_BMP280::STANDBY_MS_500);
    }

    if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
        Serial.println(F("[ERROR] OLED not found - check wiring"));
    } else {
        display.clearDisplay();
        display.setTextSize(1);
        display.setTextColor(SSD1306_WHITE);
        display.setCursor(0, 0);
        display.println(F("Smart Agri Node"));
        display.println(F("Booting..."));
        display.display();
    }

    soilTempSensor.begin();

    // RS485
    rs485.begin(RS485_BAUD, RS485_RX_PIN, RS485_TX_PIN);

    Serial.println(F("[BOOT] Setup complete."));
}

void loop() {
    unsigned long now = millis();

    if (now - lastSensorRead >= SENSOR_READ_INTERVAL_MS) {
        lastSensorRead = now;
        readSensors();
        updateIrrigationLogic();
    }

    if (now - lastDataSend >= DATA_SEND_INTERVAL_MS) {
        lastDataSend = now;
        sendSensorReport();
    }

    if (now - lastOledRefresh >= OLED_REFRESH_INTERVAL_MS) {
        lastOledRefresh = now;
        updateOled();
    }

    // Safety cutoff: never let the pump run unattended past the max runtime
    if (state.pumpOn && (now - state.pumpStartedAt > MAX_PUMP_RUNTIME_MS)) {
        Serial.println(F("[SAFETY] Max pump runtime exceeded, forcing OFF"));
        setPump(false);
    }

    handleIncomingRS485();
}

void readSensors() {
    if (!isnan(bmp.readTemperature())) {
        state.airTempC = bmp.readTemperature();
        state.pressureHPa = bmp.readPressure() / 100.0f;
    }

    soilTempSensor.requestTemperatures();
    float t = soilTempSensor.getTempCByIndex(0);
    if (t != DEVICE_DISCONNECTED_C) {
        state.soilTempC = t;
    }

    state.soilMoisturePct = readSoilMoisturePercent();
    state.tankLevelPct = readTankLevelPercent();
}

float readSoilMoisturePercent() {
    int raw = analogRead(SOIL_MOISTURE_PIN);
    raw = constrain(raw, SOIL_MOISTURE_WET, SOIL_MOISTURE_DRY);
    float pct = map(raw, SOIL_MOISTURE_DRY, SOIL_MOISTURE_WET, 0, 100);
    return constrain(pct, 0.0f, 100.0f);
}

float readTankLevelPercent() {
    digitalWrite(HCSR04_TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(HCSR04_TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(HCSR04_TRIG_PIN, LOW);

    unsigned long duration = pulseIn(HCSR04_ECHO_PIN, HIGH, 30000UL); // 30ms timeout
    if (duration == 0) return NAN; // no echo received

    float distanceCm = (duration * 0.0343f) / 2.0f;
    float waterDepthCm = TANK_HEIGHT_CM - (distanceCm - TANK_SENSOR_OFFSET_CM);
    float pct = (waterDepthCm / TANK_HEIGHT_CM) * 100.0f;
    return constrain(pct, 0.0f, 100.0f);
}

void updateIrrigationLogic() {
    if (!state.autoMode) return; // manual mode: RS485 CMD_SET_PUMP controls it directly

    if (isnan(state.soilMoisturePct)) return;

    if (!state.pumpOn && state.soilMoisturePct < thresholdLowPct) {
        if (state.tankLevelPct < MIN_TANK_LEVEL_PCT) {
            Serial.println(F("[IRRIGATION] Skipped - tank level too low"));
            return;
        }
        Serial.println(F("[IRRIGATION] Soil dry - starting pump"));
        setPump(true);
    } else if (state.pumpOn && state.soilMoisturePct > thresholdHighPct) {
        Serial.println(F("[IRRIGATION] Soil sufficiently moist - stopping pump"));
        setPump(false);
    }
}

void setPump(bool on) {
    state.pumpOn = on;
    bool level = RELAY_ACTIVE_LOW ? !on : on;
    digitalWrite(RELAY_PIN, level ? HIGH : LOW);
    if (on) {
        state.pumpStartedAt = millis();
    }
}

void updateOled() {
    display.clearDisplay();
    display.setCursor(0, 0);
    display.setTextSize(1);
    display.println(F("Smart Agri Node"));
    display.print(F("Air: "));
    display.print(isnan(state.airTempC) ? -1 : state.airTempC, 1);
    display.println(F(" C"));
    display.print(F("Soil M: "));
    display.print(isnan(state.soilMoisturePct) ? -1 : state.soilMoisturePct, 0);
    display.println(F(" %"));
    display.print(F("Tank: "));
    display.print(isnan(state.tankLevelPct) ? -1 : state.tankLevelPct, 0);
    display.println(F(" %"));
    display.print(F("Pump: "));
    display.println(state.pumpOn ? F("ON") : F("OFF"));
    display.display();
}

void sendSensorReport() {
    StaticJsonDocument<192> doc;
    doc["node"] = NODE_ID;
    doc["air_temp_c"] = state.airTempC;
    doc["pressure_hpa"] = state.pressureHPa;
    doc["soil_temp_c"] = state.soilTempC;
    doc["soil_moisture_pct"] = state.soilMoisturePct;
    doc["tank_level_pct"] = state.tankLevelPct;
    doc["pump_on"] = state.pumpOn;
    doc["auto_mode"] = state.autoMode;
    doc["uptime_s"] = millis() / 1000;

    char buf[MAX_PAYLOAD_LEN];
    size_t len = serializeJson(doc, buf, sizeof(buf));

    rs485.sendFrame(CMD_DATA_REPORT, (const uint8_t *)buf, (uint8_t)len);
}

void handleIncomingRS485() {
    uint8_t cmd, payload[MAX_PAYLOAD_LEN], len;
    if (!rs485.pollFrame(cmd, payload, len)) return;

    switch (cmd) {
        case CMD_PING: {
            rs485.sendFrame(CMD_PONG, nullptr, 0);
            break;
        }
        case CMD_POLL_DATA: {
            sendSensorReport();
            break;
        }
        case CMD_SET_PUMP: {
            if (len >= 1) {
                bool on = payload[0] != 0;
                state.autoMode = false; // manual override
                setPump(on);
                rs485.sendFrame(CMD_ACK, nullptr, 0);
            }
            break;
        }
        case CMD_SET_MODE: {
            if (len >= 1) {
                state.autoMode = payload[0] != 0;
                rs485.sendFrame(CMD_ACK, nullptr, 0);
            }
            break;
        }
        case CMD_SET_THRESHOLDS: {
            if (len >= sizeof(float) * 2) {
                memcpy(&thresholdLowPct, payload, sizeof(float));
                memcpy(&thresholdHighPct, payload + sizeof(float), sizeof(float));
                rs485.sendFrame(CMD_ACK, nullptr, 0);
            }
            break;
        }
        default:
            rs485.sendFrame(CMD_NACK, nullptr, 0);
            break;
    }
}
