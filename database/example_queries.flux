// Example Flux queries against the `sensors` bucket.
// Run these in the InfluxDB UI (Data Explorer) or Grafana panels.

// 1. Latest soil moisture per node, last 1h
from(bucket: "sensors")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "sensor_reading")
  |> filter(fn: (r) => r._field == "soil_moisture_pct")
  |> last()

// 2. Air temperature trend, last 24h
from(bucket: "sensors")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "sensor_reading")
  |> filter(fn: (r) => r._field == "air_temp_c")

// 3. Pump runtime per day (sum of "on" samples * sample interval as a rough estimate)
from(bucket: "sensors")
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "sensor_reading")
  |> filter(fn: (r) => r._field == "pump_on")
  |> aggregateWindow(every: 1d, fn: sum, createEmpty: false)

// 4. Tank level, last 7 days, hourly mean
from(bucket: "sensors")
  |> range(start: -7d)
  |> filter(fn: (r) => r._measurement == "sensor_reading")
  |> filter(fn: (r) => r._field == "tank_level_pct")
  |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
