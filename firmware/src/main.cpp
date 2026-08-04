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
#include <Adafruit_INA219.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>

#include "config.h"
#include "protocol.h"
#include "RS485Link.h"

#define TANK_SENSOR_INSTALLED false

// ---------- Peripherals ----------
Adafruit_BMP280 bmp;
Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
OneWire oneWire(ONEWIRE_PIN);
DallasTemperature soilTempSensor(&oneWire);
RS485Link rs485(Serial2);
Adafruit_INA219 ina219(INA219_ADDRESS);

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
    // Pump motor power monitoring (INA219)
    float pumpBusVoltage = NAN;
    float pumpLoadVoltage = NAN;
    float pumpCurrentMa = NAN;
    float pumpPowerMw = NAN;
} state;

float thresholdLowPct = SOIL_MOISTURE_LOW_PCT;
float thresholdHighPct = SOIL_MOISTURE_HIGH_PCT;

unsigned long lastSensorRead = 0;
unsigned long lastDataSend = 0;
unsigned long lastOledRefresh = 0;
uint8_t oledPage = 0;                 // 0=Environment, 1=Water, 2=Power
unsigned long lastPageFlip = 0;
// ---------- Forward declarations ----------
void readSensors();
void updateIrrigationLogic();
void setPump(bool on);
void updateOled();
void sendSensorReport();
void handleIncomingRS485();
void drawEnvironmentPage();
void drawWaterPage();
void drawPowerPage();
void readPumpPower();
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
    #if TANK_SENSOR_INSTALLED
    pinMode(HCSR04_TRIG_PIN, OUTPUT);
    pinMode(HCSR04_ECHO_PIN, INPUT);
    #endif
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
    soilTempSensor.setWaitForConversion(false);  // non-blocking DS18B20 reads

    if (!ina219.begin()) {
        Serial.println(F("[ERROR] INA219 not found - check wiring"));
    } else {
        Serial.println(F("[BOOT] INA219 initialized"));
    }

    // RS485
    rs485.begin(RS485_BAUD, RS485_RX_PIN, RS485_TX_PIN);

    // Hardware watchdog — resets ESP32 if loop() stalls
    esp_task_wdt_init(WATCHDOG_TIMEOUT_S, true);
    esp_task_wdt_add(NULL);

    Serial.println(F("[BOOT] Setup complete."));
}

void loop() {
    esp_task_wdt_reset();
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
    // Read BMP280 once — avoid double I2C transaction
    float airT = bmp.readTemperature();
    if (!isnan(airT)) {
        state.airTempC = airT;
        state.pressureHPa = bmp.readPressure() / 100.0f;
    }

    // DS18B20: requestTemperatures() returns immediately (non-blocking).
    // getTempCByIndex() returns the PREVIOUS conversion result.
    // Filter out 85.0 °C which is the DS18B20 power-on reset value.
    soilTempSensor.requestTemperatures();
    float t = soilTempSensor.getTempCByIndex(0);
    if (t != DEVICE_DISCONNECTED_C && t != 85.0f) {
        state.soilTempC = t;
    }

    state.soilMoisturePct = readSoilMoisturePercent();
    state.tankLevelPct = readTankLevelPercent();
    readPumpPower();
}

float readSoilMoisturePercent() {
    int raw = analogRead(SOIL_MOISTURE_PIN);
    raw = constrain(raw, SOIL_MOISTURE_WET, SOIL_MOISTURE_DRY);
    float pct = map(raw, SOIL_MOISTURE_DRY, SOIL_MOISTURE_WET, 0, 100);
    return constrain(pct, 0.0f, 100.0f);
}

void readPumpPower() {
    float shuntVoltage = ina219.getShuntVoltage_mV();
    state.pumpBusVoltage = ina219.getBusVoltage_V();
    state.pumpCurrentMa = ina219.getCurrent_mA();
    state.pumpPowerMw = ina219.getPower_mW();
    // Load voltage = bus voltage + shunt voltage drop, matching your original code
    state.pumpLoadVoltage = state.pumpBusVoltage + (shuntVoltage / 1000.0f);
}


float readTankLevelPercent() {
#if !TANK_SENSOR_INSTALLED
    return 100.0f;
#else
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
#endif
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
    unsigned long now = millis();
    if (now - lastPageFlip >= OLED_PAGE_INTERVAL_MS) {
        lastPageFlip = now;
        oledPage = (oledPage + 1) % 3;
    }

    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);

    switch (oledPage) {
        case 0: drawEnvironmentPage(); break;
        case 1: drawWaterPage();       break;
        case 2: drawPowerPage();       break;
    }

    display.display();
}

void drawEnvironmentPage() {
    display.println(F("-- ENVIRONMENT --"));

    display.setCursor(0, 16);
    display.print(F("Air Temp: "));
    display.print(isnan(state.airTempC) ? 0 : state.airTempC, 1);
    display.println(F(" C"));

    display.setCursor(0, 28);
    display.print(F("Pressure: "));
    display.print(isnan(state.pressureHPa) ? 0 : state.pressureHPa, 0);
    display.println(F(" hPa"));

    display.setCursor(0, 40);
    display.print(F("Soil Moist: "));
    display.print(isnan(state.soilMoisturePct) ? 0 : state.soilMoisturePct, 0);
    display.println(F(" %"));

    display.setCursor(0, 52);
    display.print(F("Soil Temp: "));
    display.print(isnan(state.soilTempC) ? 0 : state.soilTempC, 1);
    display.println(F(" C"));
}

void drawWaterPage() {
    display.println(F("-- WATER --"));

    display.setCursor(0, 20);
    display.setTextSize(2);
    display.print(F("Tank:"));
    display.print(isnan(state.tankLevelPct) ? 0 : state.tankLevelPct, 0);
    display.println(F("%"));

    display.setTextSize(1);
    display.setCursor(0, 44);
    display.print(F("Pump: "));
    display.println(state.pumpOn ? F("ON") : F("OFF"));

    display.setCursor(0, 54);
    display.print(F("Mode: "));
    display.println(state.autoMode ? F("AUTO") : F("MANUAL"));
}

void drawPowerPage() {
    display.println(F("-- PUMP POWER --"));

    display.setCursor(0, 16);
    display.print(F("Bus : "));
    display.print(isnan(state.pumpBusVoltage) ? 0 : state.pumpBusVoltage, 2);
    display.println(F(" V"));

    display.setCursor(0, 28);
    display.print(F("Load: "));
    display.print(isnan(state.pumpLoadVoltage) ? 0 : state.pumpLoadVoltage, 2);
    display.println(F(" V"));

    display.setCursor(0, 40);
    display.print(F("Curr: "));
    display.print(isnan(state.pumpCurrentMa) ? 0 : state.pumpCurrentMa, 0);
    display.println(F(" mA"));

    display.setCursor(0, 52);
    display.print(F("Pwr : "));
    display.print(isnan(state.pumpPowerMw) ? 0 : state.pumpPowerMw, 0);
    display.println(F(" mW"));
}

void sendSensorReport() {
    // Shortened keys keep payload well under 250 bytes (protocol LEN is uint8_t).
    // Key map sent to gateway:
    //   id=node  at=air_temp_c  pr=pressure_hpa  st=soil_temp_c
    //   sm=soil_moisture_pct  tl=tank_level_pct  po=pump_on  am=auto_mode
    //   bv=pump_bus_voltage  lv=pump_load_voltage  cm=pump_current_ma
    //   pw=pump_power_mw  up=uptime_s
    StaticJsonDocument<384> doc;
    doc["id"] = NODE_ID;
    if (!isnan(state.airTempC))        doc["at"] = state.airTempC;
    if (!isnan(state.pressureHPa))     doc["pr"] = state.pressureHPa;
    if (!isnan(state.soilTempC))       doc["st"] = state.soilTempC;
    if (!isnan(state.soilMoisturePct)) doc["sm"] = state.soilMoisturePct;
    if (!isnan(state.tankLevelPct))    doc["tl"] = state.tankLevelPct;
    doc["po"] = state.pumpOn;
    doc["am"] = state.autoMode;
    if (!isnan(state.pumpBusVoltage))  doc["bv"] = state.pumpBusVoltage;
    if (!isnan(state.pumpLoadVoltage)) doc["lv"] = state.pumpLoadVoltage;
    if (!isnan(state.pumpCurrentMa))   doc["cm"] = state.pumpCurrentMa;
    if (!isnan(state.pumpPowerMw))     doc["pw"] = state.pumpPowerMw;
    doc["up"] = millis() / 1000;

    char buf[MAX_PAYLOAD_LEN];
    size_t len = serializeJson(doc, buf, sizeof(buf));

    if (len == 0 || len >= sizeof(buf)) {
        Serial.println(F("[RS485] ERROR: JSON too large or serialization failed"));
        return;
    }

    Serial.printf("[RS485] TX report: %u bytes\n", (unsigned)len);
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
                float newLow, newHigh;
                memcpy(&newLow, payload, sizeof(float));
                memcpy(&newHigh, payload + sizeof(float), sizeof(float));
                // Validate: sane percentages, low < high, no NaN/Inf
                if (!isnan(newLow) && !isnan(newHigh) &&
                    newLow >= 0.0f && newLow <= 100.0f &&
                    newHigh >= 0.0f && newHigh <= 100.0f &&
                    newLow < newHigh) {
                    thresholdLowPct = newLow;
                    thresholdHighPct = newHigh;
                    rs485.sendFrame(CMD_ACK, nullptr, 0);
                    Serial.printf("[RS485] Thresholds: low=%.1f high=%.1f\n", newLow, newHigh);
                } else {
                    rs485.sendFrame(CMD_NACK, nullptr, 0);
                    Serial.println(F("[RS485] Invalid threshold values, NACK"));
                }
            }
            break;
        }
        default:
            rs485.sendFrame(CMD_NACK, nullptr, 0);
            break;
    }
}
