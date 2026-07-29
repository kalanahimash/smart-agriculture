#ifndef CONFIG_H
#define CONFIG_H

// ============================================================
//  Edge AI Smart Agriculture - ESP32 Sensor Node Configuration
// ============================================================

// ---------- Node Identity ----------
#define NODE_ID "esp32-node-01"
#define FIRMWARE_VERSION "1.0.0"

// ---------- I2C Pins (BMP280 + OLED share the bus) ----------
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22
#define BMP280_ADDRESS 0x76
#define OLED_ADDRESS 0x3C
#define OLED_WIDTH 128
#define OLED_HEIGHT 64

// ---------- OneWire (DS18B20 soil/water temp) ----------
#define ONEWIRE_PIN 4

// ---------- Analog Sensors ----------
#define SOIL_MOISTURE_PIN 34   // ADC1_CH6
#define SOIL_MOISTURE_DRY 3000 // raw ADC value in dry air (calibrate on-site)
#define SOIL_MOISTURE_WET 1200 // raw ADC value fully submerged (calibrate on-site)

// ---------- Ultrasonic (water tank level) ----------
#define HCSR04_TRIG_PIN 5
#define HCSR04_ECHO_PIN 18
#define TANK_HEIGHT_CM 100.0f  // distance from sensor to bottom of tank
#define TANK_SENSOR_OFFSET_CM 5.0f

// ---------- Relay / Pump ----------
#define RELAY_PIN 26
#define RELAY_ACTIVE_LOW true  // most relay modules trigger on LOW

// ---------- RS485 (HW-0519 module) ----------
#define RS485_RX_PIN 16
#define RS485_TX_PIN 17
#define RS485_DE_RE_PIN 27     // driver enable / receiver enable, tied together
#define RS485_BAUD 9600
#define RS485_SLAVE_ID 0x01

// ---------- Timing ----------
#define SENSOR_READ_INTERVAL_MS 5000
#define DATA_SEND_INTERVAL_MS 5000
#define OLED_REFRESH_INTERVAL_MS 1000
#define WATCHDOG_TIMEOUT_S 30

// ---------- Irrigation Thresholds (defaults, overridable via RS485 config msg) ----------
#define SOIL_MOISTURE_LOW_PCT 30.0f   // below this -> irrigation starts
#define SOIL_MOISTURE_HIGH_PCT 65.0f  // above this -> irrigation stops
#define MAX_PUMP_RUNTIME_MS 120000UL  // 2 min safety cutoff per irrigation cycle
#define MIN_TANK_LEVEL_PCT 15.0f      // below this, pump is blocked (dry-run protection)

#endif // CONFIG_H
