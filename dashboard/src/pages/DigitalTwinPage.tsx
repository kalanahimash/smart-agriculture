import { useEffect, useState } from "react";
import { Sprout } from "lucide-react";
import { api, type TwinState } from "@/lib/api";
import { useLiveSensors } from "@/hooks/useLiveSensors";

export default function DigitalTwinPage({ node }: { node: string }) {
  const [twin, setTwin] = useState<TwinState | null>(null);
  const { reading } = useLiveSensors(node);

  useEffect(() => {
    api.getTwinState(node).then(setTwin).catch(() => {});
  }, [node, reading?.timestamp]);

  const tankLevel = twin?.tank_level_pct ?? 0;
  const pumpOn = twin?.pump_on ?? false;
  const plants = twin?.plants ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-800">Digital Twin</h1>
        <p className="text-sm text-stone-500 mt-1">Live visual model of the farm bed and irrigation system</p>
      </div>

      <div className="panel p-6">
        <svg viewBox="0 0 800 420" className="w-full h-auto">
          {/* Ground */}
          <rect x="0" y="260" width="800" height="160" fill="#241c15" />
          <rect x="0" y="255" width="800" height="6" fill="#332921" />

          {/* Water tank */}
          <g transform="translate(40, 40)">
            <rect x="0" y="0" width="90" height="180" rx="6" fill="#1a1410" stroke="#453830" strokeWidth="2" />
            <clipPath id="tankClip">
              <rect x="4" y="4" width="82" height="172" rx="4" />
            </clipPath>
            <rect
              x="4"
              y={4 + (172 * (100 - tankLevel)) / 100}
              width="82"
              height={(172 * tankLevel) / 100}
              fill="#4f9dc9"
              opacity="0.65"
              clipPath="url(#tankClip)"
            >
              <animate attributeName="opacity" values="0.55;0.7;0.55" dur="3s" repeatCount="indefinite" />
            </rect>
            <text x="45" y="200" textAnchor="middle" fontSize="12" fill="#8a7d6f" fontFamily="monospace">
              TANK {tankLevel.toFixed(0)}%
            </text>
          </g>

          {/* Pipe from tank to pump */}
          <path
            d="M 85 190 L 85 230 L 180 230"
            stroke={pumpOn ? "#4f9dc9" : "#453830"}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />

          {/* Pump */}
          <g transform="translate(180, 205)">
            <circle
              cx="0"
              cy="0"
              r="26"
              fill={pumpOn ? "#5a9146" : "#332921"}
              stroke={pumpOn ? "#7fb069" : "#453830"}
              strokeWidth="2"
            >
              {pumpOn && (
                <animate attributeName="r" values="26;29;26" dur="1.2s" repeatCount="indefinite" />
              )}
            </circle>
            <text x="0" y="45" textAnchor="middle" fontSize="12" fill="#8a7d6f" fontFamily="monospace">
              PUMP {pumpOn ? "ON" : "OFF"}
            </text>
          </g>

          {/* Main irrigation line */}
          <path
            d="M 206 230 L 720 230"
            stroke={pumpOn ? "#4f9dc9" : "#453830"}
            strokeWidth="5"
            fill="none"
            strokeDasharray={pumpOn ? "6 6" : "0"}
          >
            {pumpOn && (
              <animate attributeName="stroke-dashoffset" values="0;-24" dur="0.8s" repeatCount="indefinite" />
            )}
          </path>

          {/* Plants */}
          {plants.map((p) => {
            const px = 220 + p.x * 480;
            const py = 260 + p.y * 130;
            const healthy = p.health === "healthy";
            return (
              <g key={p.id} transform={`translate(${px}, ${py})`}>
                {/* drip line down to plant */}
                <line x1="0" y1="-30" x2="0" y2="0" stroke={pumpOn ? "#4f9dc9" : "#453830"} strokeWidth="3" />
                {pumpOn && (
                  <circle r="2.5" fill="#4f9dc9">
                    <animateMotion path="M0,-30 L0,0" dur="1s" repeatCount="indefinite" />
                  </circle>
                )}
                <Plant healthy={healthy} />
                <text x="0" y="34" textAnchor="middle" fontSize="10" fill="#8a7d6f" fontFamily="monospace">
                  {p.species}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {plants.map((p) => (
          <div key={p.id} className="panel p-3 flex items-center gap-2">
            <Sprout size={16} className={p.health === "healthy" ? "text-canopy-400" : "text-signal-clay"} />
            <div className="text-xs">
              <div className="text-stone-500 capitalize">{p.species}</div>
              <div className={p.health === "healthy" ? "text-canopy-400" : "text-signal-clay"}>{p.health}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Plant({ healthy }: { healthy: boolean }) {
  const color = healthy ? "#5a9146" : "#c1633a";
  return (
    <g>
      <ellipse cx="0" cy="0" rx="16" ry="10" fill={color} opacity="0.85" />
      <ellipse cx="-10" cy="-6" rx="10" ry="7" fill={color} opacity="0.7" />
      <ellipse cx="10" cy="-6" rx="10" ry="7" fill={color} opacity="0.7" />
      <line x1="0" y1="10" x2="0" y2="20" stroke="#453830" strokeWidth="3" />
    </g>
  );
}
