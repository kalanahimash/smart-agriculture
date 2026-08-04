#ifndef PROTOCOL_H
#define PROTOCOL_H

// ============================================================
//  RS485 Wire Protocol
//  Frame: [START][SLAVE_ID][CMD][LEN][PAYLOAD...][CRC8][END]
//  START = 0xAA, END = 0x55
//
//  CRC8 is computed over [SLAVE_ID][CMD][LEN][PAYLOAD] ONLY.
//  START and END bytes are NOT included in the CRC calculation.
//  This scope must match exactly on both ESP32 and Raspberry Pi.
// ============================================================

#define FRAME_START 0xAA
#define FRAME_END 0x55

// Commands: Gateway -> Node
#define CMD_POLL_DATA 0x01        // request latest sensor reading
#define CMD_SET_PUMP 0x02         // payload: 1 byte (0=off,1=on)
#define CMD_SET_MODE 0x03         // payload: 1 byte (0=manual,1=auto)
#define CMD_SET_THRESHOLDS 0x04   // payload: 2x float (low%, high%)
#define CMD_PING 0x05

// Commands: Node -> Gateway
#define CMD_DATA_REPORT 0x81      // payload: SensorPacket (JSON in payload)
#define CMD_ACK 0x82
#define CMD_NACK 0x83
#define CMD_PONG 0x84

// Max payload size for a single frame (protocol LEN field is uint8_t → max 255)
#define MAX_PAYLOAD_LEN 250

// CRC-8 (polynomial 0x07, init 0x00)
// Must be inline — this header is included from multiple translation units.
inline uint8_t crc8(const uint8_t *data, size_t len) {
    uint8_t crc = 0x00;
    for (size_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (uint8_t b = 0; b < 8; b++) {
            if (crc & 0x80) {
                crc = (crc << 1) ^ 0x07;
            } else {
                crc <<= 1;
            }
        }
    }
    return crc;
}

#endif // PROTOCOL_H
