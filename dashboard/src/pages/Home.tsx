import { useEffect, useState } from "react";
import { Thermometer, Droplets, Waves, Gauge } from "lucide-react";
import StatCard from "@/components/StatCard";
import PumpControl from "@/components/PumpControl";
import TrendChart from "@/components/TrendChart";
import { useLiveSensors } from "@/hooks/useLiveSensors";
import { api, type HistoryPoint } from "@/lib/api";



export default function Home({ node }: { node: string }) {
  const { reading } = useLiveSensors(node);
  const [soilHistory, setSoilHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    api.getHistory(node, "soil_moisture_pct", 12).then((res) => setSoilHistory(res.points)).catch(() => {});
  }, [node, reading?.timestamp]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      {/* LEFT COLUMN (2/3) */}
      <div className="xl:col-span-2 flex flex-col gap-8">
        
        {/* SUMMARY SECTION */}
        <div>
          <h2 className="text-sm font-semibold text-stone-500 mb-4">Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard
              label="Air Temperature"
              value={reading?.air_temp_c?.toFixed(1) ?? "—"}
              unit="°C"
              icon={Thermometer}
              accent="sky"
              progress={reading?.air_temp_c ? Math.min(100, (reading.air_temp_c / 50) * 100) : 0}
            />
            <StatCard
              label="Soil Moisture"
              value={reading?.soil_moisture_pct?.toFixed(0) ?? "—"}
              unit="%"
              icon={Droplets}
              accent="canopy"
              progress={reading?.soil_moisture_pct ?? 0}
            />
          </div>
        </div>

        {/* MANAGE YOUR FARM IMAGE */}
        <div>
          <h2 className="text-sm font-semibold text-stone-500 mb-4">Manage your farm</h2>
          <div className="w-full h-[280px] rounded-[1.5rem] overflow-hidden shadow-sm">
            <img src="/farm_cornfield.png" alt="Farm" className="w-full h-full object-cover" />
          </div>
        </div>

        {/* HISTORICAL DATA */}
        <div>
          <h2 className="text-sm font-semibold text-stone-500 mb-4">Historical analysis</h2>
          <div className="panel p-6">
            <h3 className="text-sm font-medium text-stone-800 mb-6">Soil Moisture — Last 12h</h3>
            <TrendChart data={soilHistory} color="#0fa44a" unit="%" />
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN (1/3) */}
      <div className="flex flex-col gap-8">
        
        <div>
          <h2 className="text-sm font-semibold text-stone-500 mb-4">System Controls</h2>
          <PumpControl
            node={node}
            pumpOn={reading?.pump_on ?? false}
            autoMode={reading?.auto_mode ?? true}
          />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-stone-500 mb-4">Secondary Metrics</h2>
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Tank Level"
              value={reading?.tank_level_pct?.toFixed(0) ?? "—"}
              unit="%"
              icon={Waves}
              accent="white"
            />
            <StatCard
              label="Pressure"
              value={reading?.pressure_hpa?.toFixed(0) ?? "—"}
              unit="hPa"
              icon={Gauge}
              accent="white"
            />
          </div>
        </div>
        
      </div>
    </div>
  );
}
