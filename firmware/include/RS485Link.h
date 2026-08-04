#ifndef RS485LINK_H
#define RS485LINK_H

#include <Arduino.h>
#include "config.h"
#include "protocol.h"

// If no byte arrives for this many ms while the parser is mid-frame,
// reset to WAIT_START.  Prevents permanent desynchronization when
// a sender dies mid-transmission or bus noise injects a false START.
#define FRAME_TIMEOUT_MS 100

// ----------------------------------------------------------------
// Wrapper around HardwareSerial for an RS485 transceiver module with
// AUTOMATIC direction control (no DE/RE pin exposed — e.g. HW-0519
// variants that only break out VCC/GND/RXD/TXD/A+/B-).
//
// If your module DOES expose separate DE/RE pins, see the commented
// alternate implementation at the bottom of this file.
// ----------------------------------------------------------------
class RS485Link {
public:
    RS485Link(HardwareSerial &serial) : _serial(serial) {}

    void begin(unsigned long baud, int8_t rxPin, int8_t txPin) {
        _serial.begin(baud, SERIAL_8N1, rxPin, txPin);
    }

    // ----------------------------------------------------------
    //  Transmit a framed packet.
    //  CRC scope: [SLAVE_ID, CMD, LEN, PAYLOAD]  (excludes START)
    // ----------------------------------------------------------
    void sendFrame(uint8_t cmd, const uint8_t *payload, uint8_t len) {
        // Static buffer keeps ~256 bytes off the stack.  Safe because
        // sendFrame is never called from an ISR or re-entered.
        static uint8_t buf[6 + MAX_PAYLOAD_LEN];
        uint8_t idx = 0;

        buf[idx++] = FRAME_START;      // 0xAA
        buf[idx++] = RS485_SLAVE_ID;
        buf[idx++] = cmd;
        buf[idx++] = len;
        for (uint8_t i = 0; i < len; i++) buf[idx++] = payload[i];

        // CRC over SLAVE + CMD + LEN + PAYLOAD  (skip START at buf[0])
        uint8_t crc = crc8(buf + 1, idx - 1);
        buf[idx++] = crc;
        buf[idx++] = FRAME_END;        // 0x55

        _serial.write(buf, idx);
        _serial.flush();   // block until TX hardware FIFO is empty

        // Auto-direction HW-519 modules often echo transmitted bytes
        // back into the RX FIFO.  Give the module ~1.5 ms to switch
        // back to receive mode, then drain any echoed bytes so the
        // parser doesn't see our own frame as an incoming command.
        delayMicroseconds(1500);
        while (_serial.available()) _serial.read();

        txCount++;
    }

    // ----------------------------------------------------------
    //  Non-blocking receive.  Call from loop().
    //  Returns true when a complete, CRC-valid frame has been parsed.
    //
    //  Protections added:
    //    • Slave ID filtering  (only RS485_SLAVE_ID or broadcast 0xFF)
    //    • Payload length bounds check  (rejects LEN > MAX_PAYLOAD_LEN)
    //    • Inter-byte timeout  (resets state after FRAME_TIMEOUT_MS)
    //    • CRC scope matches sendFrame  (excludes START byte)
    // ----------------------------------------------------------
    bool pollFrame(uint8_t &cmd, uint8_t *payload, uint8_t &len) {
        // --- Timeout guard ---
        if (_state != WAIT_START) {
            unsigned long now = millis();
            if (now - _lastByteTime > FRAME_TIMEOUT_MS) {
                _state = WAIT_START;
                timeouts++;
            }
        }

        while (_serial.available()) {
            _lastByteTime = millis();
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
                    // Only accept frames addressed to us or broadcast
                    if (b == RS485_SLAVE_ID || b == 0xFF) {
                        _rxBuf[_idx++] = b;
                        _state = WAIT_CMD;
                    } else {
                        _state = WAIT_START;   // not for this node
                    }
                    break;

                case WAIT_CMD:
                    _rxBuf[_idx++] = b;
                    _cmdByte = b;
                    _state = WAIT_LEN;
                    break;

                case WAIT_LEN:
                    _rxBuf[_idx++] = b;
                    _payloadLen = b;
                    // Reject payloads that would overflow _rxBuf
                    if (_payloadLen > MAX_PAYLOAD_LEN) {
                        _state = WAIT_START;
                        break;
                    }
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
                    _state = WAIT_START;   // always reset, valid or not
                    if (b == FRAME_END) {
                        // CRC over SLAVE + CMD + LEN + PAYLOAD (skip START at [0])
                        uint8_t calcCrc = crc8(_rxBuf + 1, _idx - 1);
                        if (calcCrc == _rxCrc) {
                            cmd = _cmdByte;
                            len = _payloadLen;
                            for (uint8_t i = 0; i < _payloadLen; i++) {
                                payload[i] = _rxBuf[4 + i];
                            }
                            rxCount++;
                            return true;
                        } else {
                            crcErrors++;
                        }
                    }
                    break;
            }
        }
        return false;
    }

    // Diagnostic counters — read from main code for logging / OLED
    uint32_t txCount   = 0;
    uint32_t rxCount   = 0;
    uint32_t crcErrors = 0;
    uint32_t timeouts  = 0;

private:
    enum RxState {
        WAIT_START, WAIT_SLAVE, WAIT_CMD, WAIT_LEN,
        WAIT_PAYLOAD, WAIT_CRC, WAIT_END
    };

    HardwareSerial &_serial;
    RxState  _state        = WAIT_START;
    uint8_t  _rxBuf[6 + MAX_PAYLOAD_LEN];   // header(4) + payload + headroom
    uint8_t  _idx          = 0;
    uint8_t  _cmdByte      = 0;
    uint8_t  _payloadLen   = 0;
    uint8_t  _payloadCount = 0;
    uint8_t  _rxCrc        = 0;
    unsigned long _lastByteTime = 0;
};

#endif // RS485LINK_H

/*
 * ---- If your module DOES have DE/RE pins ----
 * Replace the constructor and sendFrame() with:
 *
 *   RS485Link(HardwareSerial &serial, uint8_t dePin) : _serial(serial), _dePin(dePin) {
 *       pinMode(_dePin, OUTPUT);
 *       digitalWrite(_dePin, LOW); // receive mode by default
 *   }
 *
 *   void sendFrame(...) {
 *       ...build buf as above...
 *       digitalWrite(_dePin, HIGH);   // transmit mode
 *       delayMicroseconds(50);
 *       _serial.write(buf, idx);
 *       _serial.flush();
 *       delayMicroseconds(50);
 *       digitalWrite(_dePin, LOW);    // back to receive mode
 *   }
 */
