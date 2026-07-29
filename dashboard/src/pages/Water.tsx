import { useEffect, useState } from "react";
import { Waves, Droplets } from "lucide-react";
import StatCard from "@/components/StatCard";
import TrendChart from "@/components/TrendChart";
import PumpControl from "@/components/PumpControl";
import { useLiveSensors } from "@/hooks/useLiveSensors";
import { api, type HistoryPoint } from "@/lib/api";

export default function Water({ node }: { node: string }) {
  const { reading } = useLiveSensors(node);
  const [tankHistory, setTankHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    api.getHistory(node, "tank_level_pct", 24).then((r) => setTankHistory(r.points)).catch(() => {});
  }, [node, reading?.timestamp]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-800">Water</h1>
        <p className="text-sm text-stone-500 mt-1">Tank level and irrigation status</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <StatCard
          label="Tank Level"
          value={reading?.tank_level_pct?.toFixed(0) ?? "—"}
          unit="%"
          icon={Waves}
          accent="sky"
        />
        <StatCard
          label="Pump State"
          value={reading?.pump_on ? "Running" : "Idle"}
          icon={Droplets}
          accent={reading?.pump_on ? "canopy" : "amber"}
        />
        <PumpControl node={node} pumpOn={reading?.pump_on ?? false} autoMode={reading?.auto_mode ?? true} />
      </div>

      <div className="panel p-5">
        <h2 className="text-sm font-medium text-stone-500 mb-4">Tank Level — 24h</h2>
        <TrendChart data={tankHistory} color="#4f9dc9" unit="%" />
      </div>
    </div>
  );
}
