import { useEffect, useState } from "react";
import { Thermometer, Gauge } from "lucide-react";
import StatCard from "@/components/StatCard";
import TrendChart from "@/components/TrendChart";
import { useLiveSensors } from "@/hooks/useLiveSensors";
import { api, type HistoryPoint } from "@/lib/api";

export default function Environment({ node }: { node: string }) {
  const { reading } = useLiveSensors(node);
  const [tempHistory, setTempHistory] = useState<HistoryPoint[]>([]);
  const [pressureHistory, setPressureHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    api.getHistory(node, "air_temp_c", 24).then((r) => setTempHistory(r.points)).catch(() => {});
    api.getHistory(node, "pressure_hpa", 24).then((r) => setPressureHistory(r.points)).catch(() => {});
  }, [node, reading?.timestamp]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-800">Environment</h1>
        <p className="text-sm text-stone-500 mt-1">Ambient conditions from the BMP280 sensor</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Air Temperature"
          value={reading?.air_temp_c?.toFixed(1) ?? "—"}
          unit="°C"
          icon={Thermometer}
          accent="clay"
        />
        <StatCard
          label="Atmospheric Pressure"
          value={reading?.pressure_hpa?.toFixed(0) ?? "—"}
          unit="hPa"
          icon={Gauge}
          accent="amber"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="panel p-5">
          <h2 className="text-sm font-medium text-stone-500 mb-4">Temperature — 24h</h2>
          <TrendChart data={tempHistory} color="#c1633a" unit="°C" />
        </div>
        <div className="panel p-5">
          <h2 className="text-sm font-medium text-stone-500 mb-4">Pressure — 24h</h2>
          <TrendChart data={pressureHistory} color="#e8a33d" unit=" hPa" />
        </div>
      </div>
    </div>
  );
}
