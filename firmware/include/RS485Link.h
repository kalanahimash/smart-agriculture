#ifndef RS485LINK_H
#define RS485LINK_H

#include <Arduino.h>
#include "config.h"
#include "protocol.h"

// Thin wrapper around HardwareSerial for a half-duplex RS485 transceiver
// (HW-0519 style module with a single DE/RE control pin).
class RS485Link {
public:
    RS485Link(HardwareSerial &serial, uint8_t dePin)
        : _serial(serial), _dePin(dePin) {}

    void begin(unsigned long baud, int8_t rxPin, int8_t txPin) {
        pinMode(_dePin, OUTPUT);
        setReceiveMode();
        _serial.begin(baud, SERIAL_8N1, rxPin, txPin);
    }

    // Blocks briefly while transmitting; RS485 is half-duplex so we must
    // disable the receiver while driving the line.
    void sendFrame(uint8_t cmd, const uint8_t *payload, uint8_t len) {
        uint8_t buf[8 + MAX_PAYLOAD_LEN];
        uint8_t idx = 0;
        buf[idx++] = FRAME_START;
        buf[idx++] = RS485_SLAVE_ID;
        buf[idx++] = cmd;
        buf[idx++] = len;
        for (uint8_t i = 0; i < len; i++) buf[idx++] = payload[i];
        uint8_t crc = crc8(buf, idx);
        buf[idx++] = crc;
        buf[idx++] = FRAME_END;

        setTransmitMode();
        delayMicroseconds(50);
        _serial.write(buf, idx);
        _serial.flush();
        delayMicroseconds(50);
        setReceiveMode();
    }

    // Non-blocking poll. Returns true if a complete, valid frame was parsed.
    bool pollFrame(uint8_t &cmd, uint8_t *payload, uint8_t &len) {
        while (_serial.available()) {
            uint8_t b = _serial.read();
            switch (_state) {
                case WAIT_START:
                    if (b == FRAME_START) {
                        _idx = 0;
                        _rxBuf[_idx++] = b;
                        _state = WAIT_SLAVE;
                    }
                    break;
                case WAIT_SLAVE:
                    _rxBuf[_idx++] = b;
                    _state = WAIT_CMD;
                    break;
                case WAIT_CMD:
                    _rxBuf[_idx++] = b;
                    _cmdByte = b;
                    _state = WAIT_LEN;
                    break;
                case WAIT_LEN:
                    _rxBuf[_idx++] = b;
                    _payloadLen = b;
                    _payloadCount = 0;
                    _state = (_payloadLen == 0) ? WAIT_CRC : WAIT_PAYLOAD;
                    break;
                case WAIT_PAYLOAD:
                    _rxBuf[_idx++] = b;
                    _payloadCount++;
                    if (_payloadCount >= _payloadLen) _state = WAIT_CRC;
                    break;
                case WAIT_CRC:
                    _rxCrc = b;
                    _state = WAIT_END;
                    break;
                case WAIT_END:
                    _state = WAIT_START;
                    if (b == FRAME_END) {
                        uint8_t calcCrc = crc8(_rxBuf, _idx);
                        if (calcCrc == _rxCrc) {
                            cmd = _cmdByte;
                            len = _payloadLen;
                            for (uint8_t i = 0; i < _payloadLen; i++) {
                                payload[i] = _rxBuf[4 + i];
                            }
                            return true;
                        }
                    }
                    break;
            }
        }
        return false;
    }

private:
    enum RxState { WAIT_START, WAIT_SLAVE, WAIT_CMD, WAIT_LEN, WAIT_PAYLOAD, WAIT_CRC, WAIT_END };

    void setTransmitMode() { digitalWrite(_dePin, HIGH); }
    void setReceiveMode() { digitalWrite(_dePin, LOW); }

    HardwareSerial &_serial;
    uint8_t _dePin;
    RxState _state = WAIT_START;
    uint8_t _rxBuf[8 + MAX_PAYLOAD_LEN];
    uint8_t _idx = 0;
    uint8_t _cmdByte = 0;
    uint8_t _payloadLen = 0;
    uint8_t _payloadCount = 0;
    uint8_t _rxCrc = 0;
};

#endif // RS485LINK_H
