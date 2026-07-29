import { useEffect, useState } from "react";
import { Droplet, Timer, Repeat } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import StatCard from "@/components/StatCard";
import { api, type IrrigationStat } from "@/lib/api";

export default function Analytics({ node }: { node: string }) {
  const [stats, setStats] = useState<IrrigationStat[]>([]);
  const [range, setRange] = useState<7 | 30>(7);

  useEffect(() => {
    api.getIrrigationStats(node, range).then((r) => setStats(r.stats)).catch(() => {});
  }, [node, range]);

  const totalWater = stats.reduce((sum, s) => sum + s.water_used_liters, 0);
  const totalRuntime = stats.reduce((sum, s) => sum + s.pump_runtime_minutes, 0);
  const totalCycles = stats.reduce((sum, s) => sum + s.irrigation_cycles, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Analytics</h1>
          <p className="text-sm text-stone-500 mt-1">Irrigation statistics and water usage reports</p>
        </div>
        <div className="flex gap-1 panel p-1">
          {[7, 30].map((d) => (
            <button
              key={d}
              onClick={() => setRange(d as 7 | 30)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                range === d ? "bg-canopy-500 text-soil-950" : "text-stone-400 hover:text-stone-200"
              }`}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Water Used" value={totalWater.toFixed(0)} unit="L" icon={Droplet} accent="sky" />
        <StatCard label="Pump Runtime" value={totalRuntime.toFixed(0)} unit="min" icon={Timer} accent="amber" />
        <StatCard label="Irrigation Cycles" value={totalCycles} icon={Repeat} accent="canopy" />
      </div>

      <div className="panel p-5">
        <h2 className="text-sm font-medium text-stone-500 mb-4">Daily Water Consumption</h2>
        {stats.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-stone-600 text-sm">
            No irrigation history yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#332921" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8a7d6f" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8a7d6f" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{ background: "#241c15", border: "1px solid #453830", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#8a7d6f" }}
              />
              <Bar dataKey="water_used_liters" fill="#4f9dc9" radius={[4, 4, 0, 0]} name="Liters" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="panel p-5 overflow-x-auto">
        <h2 className="text-sm font-medium text-stone-500 mb-4">Daily Breakdown</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 text-xs uppercase tracking-wide">
              <th className="pb-2 font-medium">Date</th>
              <th className="pb-2 font-medium">Runtime (min)</th>
              <th className="pb-2 font-medium">Water (L)</th>
              <th className="pb-2 font-medium">Cycles</th>
            </tr>
          </thead>
          <tbody className="font-mono text-stone-500">
            {stats.map((s) => (
              <tr key={s.date} className="border-t border-soil-800">
                <td className="py-2">{s.date}</td>
                <td className="py-2">{s.pump_runtime_minutes.toFixed(1)}</td>
                <td className="py-2">{s.water_used_liters.toFixed(1)}</td>
                <td className="py-2">{s.irrigation_cycles}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
