import { useEffect, useState } from "react";
import { Sprout, Thermometer } from "lucide-react";
import StatCard from "@/components/StatCard";
import TrendChart from "@/components/TrendChart";
import { useLiveSensors } from "@/hooks/useLiveSensors";
import { api, type HistoryPoint } from "@/lib/api";

export default function Soil({ node }: { node: string }) {
  const { reading } = useLiveSensors(node);
  const [moistureHistory, setMoistureHistory] = useState<HistoryPoint[]>([]);
  const [tempHistory, setTempHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    api.getHistory(node, "soil_moisture_pct", 24).then((r) => setMoistureHistory(r.points)).catch(() => {});
    api.getHistory(node, "soil_temp_c", 24).then((r) => setTempHistory(r.points)).catch(() => {});
  }, [node, reading?.timestamp]);

  const moisture = reading?.soil_moisture_pct ?? null;
  const status = moisture === null ? "—" : moisture < 30 ? "Dry" : moisture > 65 ? "Saturated" : "Optimal";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-800">Soil</h1>
        <p className="text-sm text-stone-500 mt-1">Capacitive moisture + DS18B20 soil temperature</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Soil Moisture" value={moisture?.toFixed(0) ?? "—"} unit="%" icon={Sprout} accent="canopy" />
        <StatCard
          label="Soil Temperature"
          value={reading?.soil_temp_c?.toFixed(1) ?? "—"}
          unit="°C"
          icon={Thermometer}
          accent="clay"
        />
        <StatCard label="Condition" value={status} icon={Sprout} accent="sky" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="panel p-5">
          <h2 className="text-sm font-medium text-stone-500 mb-4">Soil Moisture — 24h</h2>
          <TrendChart data={moistureHistory} color="#5a9146" unit="%" />
        </div>
        <div className="panel p-5">
          <h2 className="text-sm font-medium text-stone-500 mb-4">Soil Temperature — 24h</h2>
          <TrendChart data={tempHistory} color="#c1633a" unit="°C" />
        </div>
      </div>
    </div>
  );
}
