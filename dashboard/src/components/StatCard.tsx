import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  accent?: "canopy" | "amber" | "sky" | "clay" | "white";
  trend?: string;
  progress?: number;
}

const ACCENT_MAP = {
  canopy: "bg-theme-cardGreen text-theme-textMain",
  amber: "bg-[#fff7ed] text-theme-textMain",
  sky: "bg-theme-cardBlue text-theme-textMain",
  clay: "bg-[#fef2f2] text-theme-textMain",
  white: "bg-white text-theme-textMain",
};

export default function StatCard({ label, value, unit, icon: Icon, accent = "white", progress }: StatCardProps) {
  return (
    <div className={clsx("panel p-6 flex flex-col justify-between min-h-[140px]", ACCENT_MAP[accent])}>
      <div className="flex items-start justify-between">
        <div>
          <span className="text-sm font-medium text-stone-800">{label}</span>
          <div className="text-[11px] text-stone-400 mt-0.5">Live reading</div>
        </div>
        
        {progress !== undefined ? (
          <div className="relative flex items-center justify-center w-12 h-12">
            <svg className="w-12 h-12 transform -rotate-90">
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="none" className="text-black/5" />
              <circle 
                cx="24" cy="24" r="20" 
                stroke="currentColor" 
                strokeWidth="4" 
                fill="none" 
                strokeDasharray="125" 
                strokeDashoffset={125 - (125 * progress) / 100}
                className="text-[#0fa44a] transition-all duration-1000 ease-out" 
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[10px] font-bold text-stone-700">{progress}%</span>
          </div>
        ) : (
          <div className="p-2 bg-white/50 rounded-full text-stone-500">
             <Icon size={20} />
          </div>
        )}
      </div>
      
      <div className="flex items-baseline gap-1.5 mt-4">
        <span className="font-display text-4xl font-bold tracking-tight text-stone-900">{value}</span>
        {unit && <span className="text-sm font-medium text-stone-500">{unit}</span>}
      </div>
    </div>
  );
}
