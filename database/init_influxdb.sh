#!/usr/bin/env bash
# One-time InfluxDB setup for local (non-Docker) development.
# When using docker-compose, the influxdb service already auto-provisions
# the org/bucket/token via environment variables — this script is only
# needed if you're running InfluxDB yourself outside Docker.

set -e

INFLUX_URL="${INFLUX_URL:-http://localhost:8086}"
INFLUX_ORG="${INFLUX_ORG:-smart-agriculture}"
INFLUX_BUCKET="${INFLUX_BUCKET:-sensors}"
INFLUX_USER="${INFLUX_USER:-admin}"
INFLUX_PASSWORD="${INFLUX_PASSWORD:-admin12345}"
INFLUX_TOKEN="${INFLUX_TOKEN:-dev-token}"

echo "Setting up InfluxDB at $INFLUX_URL ..."

influx setup \
  --host "$INFLUX_URL" \
  --org "$INFLUX_ORG" \
  --bucket "$INFLUX_BUCKET" \
  --username "$INFLUX_USER" \
  --password "$INFLUX_PASSWORD" \
  --token "$INFLUX_TOKEN" \
  --force

echo "Done. Bucket '$INFLUX_BUCKET' ready in org '$INFLUX_ORG'."
echo "Set INFLUX_TOKEN=$INFLUX_TOKEN in backend/.env"
