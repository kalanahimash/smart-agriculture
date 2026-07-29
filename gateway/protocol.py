"""
RS485 wire protocol (mirrors firmware/include/protocol.h)

Frame: [START][SLAVE_ID][CMD][LEN][PAYLOAD...][CRC8][END]
START = 0xAA, END = 0x55
"""
from dataclasses import dataclass

FRAME_START = 0xAA
FRAME_END = 0x55

# Gateway -> Node
CMD_POLL_DATA = 0x01
CMD_SET_PUMP = 0x02
CMD_SET_MODE = 0x03
CMD_SET_THRESHOLDS = 0x04
CMD_PING = 0x05

# Node -> Gateway
CMD_DATA_REPORT = 0x81
CMD_ACK = 0x82
CMD_NACK = 0x83
CMD_PONG = 0x84

MAX_PAYLOAD_LEN = 200


def crc8(data: bytes) -> int:
    crc = 0x00
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 0x80:
                crc = ((crc << 1) ^ 0x07) & 0xFF
            else:
                crc = (crc << 1) & 0xFF
    return crc


@dataclass
class Frame:
    slave_id: int
    cmd: int
    payload: bytes


def build_frame(slave_id: int, cmd: int, payload: bytes = b"") -> bytes:
    if len(payload) > MAX_PAYLOAD_LEN:
        raise ValueError("payload too large")
    body = bytes([slave_id, cmd, len(payload)]) + payload
    crc = crc8(body)
    return bytes([FRAME_START]) + body + bytes([crc, FRAME_END])


class FrameParser:
    """Incremental parser fed raw bytes from the serial port."""

    def __init__(self):
        self._buf = bytearray()

    def feed(self, data: bytes):
        self._buf.extend(data)

    def parse_all(self):
        """Yield every complete, CRC-valid frame currently buffered."""
        frames = []
        while True:
            start = self._buf.find(bytes([FRAME_START]))
            if start == -1:
                self._buf.clear()
                break
            if start > 0:
                del self._buf[:start]

            if len(self._buf) < 4:
                break  # need at least START, SLAVE, CMD, LEN

            slave_id = self._buf[1]
            cmd = self._buf[2]
            length = self._buf[3]
            frame_total_len = 4 + length + 2  # + CRC + END

            if len(self._buf) < frame_total_len:
                break  # wait for more bytes

            payload = bytes(self._buf[4:4 + length])
            crc_received = self._buf[4 + length]
            end_byte = self._buf[4 + length + 1]

            body = bytes(self._buf[1:4 + length])
            crc_calc = crc8(body)

            if end_byte == FRAME_END and crc_calc == crc_received:
                frames.append(Frame(slave_id=slave_id, cmd=cmd, payload=payload))
            # else: corrupted frame, drop it silently

            del self._buf[:frame_total_len]

        return frames
