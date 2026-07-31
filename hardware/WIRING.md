# Hardware Wiring Guide

Pin assignments match `firmware/include/config.h` — change both together if you rewire.

## ESP32 WROOM Pinout

| Component              | ESP32 Pin | Notes |
|-------------------------|-----------|-------|
| BMP280 SDA              | GPIO 21   | I2C shared with OLED |
| BMP280 SCL              | GPIO 22   | I2C shared with OLED |
| BMP280 Address           | 0x76      | Some breakout boards default to 0x77 — check yours |
| OLED SDA                | GPIO 21   | Same I2C bus as BMP280 |
| OLED SCL                | GPIO 22   | Same I2C bus as BMP280 |
| OLED Address             | 0x3C      | |
| DS18B20 Data             | GPIO 4    | Needs a 4.7kΩ pull-up resistor to 3.3V |
| Soil Moisture (analog)  | GPIO 34   | ADC1 input-only pin, no pull-up needed |
| HC-SR04 Trig             | GPIO 5    | |
| HC-SR04 Echo             | GPIO 18   | Use a voltage divider (Echo is 5V, ESP32 is 3.3V-tolerant only!) |
| Relay Signal             | GPIO 26   | Active-LOW on most cheap relay boards — see `RELAY_ACTIVE_LOW` in config.h |
| RS485 module RXD          | GPIO 17   | Crossed: module's RXD listens to ESP32's TX2 |
| RS485 module TXD          | GPIO 16   | Crossed: module's TXD feeds ESP32's RX2 |

> **Note:** This project uses the auto-direction variant of the HW-0519 (only
> VCC/GND/RXD/TXD/A+/B- exposed — no separate DE/RE pins). The onboard chip
> switches transmit/receive automatically, so no extra GPIO or logic is needed
> for direction control. If you have a variant that *does* expose DE/RE pins,
> see the commented-out alternate implementation at the bottom of
> `firmware/include/RS485Link.h`.

## Power

- ESP32: 5V via USB or LM2596 buck converter from battery pack
- 18650 cells → TP4056 charger module → LM2596 → 5V rail
- Relay + pump: powered separately from the 5V pump supply rail, **not** directly off the ESP32's 3.3V regulator
- Common ground between ESP32, relay module, and pump supply is required

## RS485 Bus

- HW-0519 modules on both the ESP32 node and the Raspberry Pi gateway (via USB-RS485 adapter)
- Twisted pair (A/B) between all nodes, terminated with 120Ω resistors at each end of the bus for runs over ~10m
- Multiple ESP32 nodes can share the same RS485 bus — give each a unique `RS485_SLAVE_ID` in `config.h`

## Raspberry Pi 3B

- USB-RS485 adapter → `/dev/ttyUSB0` (confirm with `ls /dev/ttyUSB*`)
- Raspberry Pi Camera Module → CSI port, enable via `raspi-config` → Interface Options → Camera

## Safety Notes

- Never run the water pump directly off the ESP32's 3.3V/5V logic supply — always use the relay to switch a separate pump power rail
- Add a flyback diode across the relay coil if not already present on your relay module
- Keep the RS485 bus and mains-adjacent wiring (if any) physically separated
