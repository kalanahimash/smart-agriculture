import { Routes, Route, NavLink } from "react-router-dom";
import {
  Sprout, Droplets, Thermometer, Camera, LineChart, Settings as SettingsIcon,
  LayoutGrid, Wifi, WifiOff, Search, LogOut
} from "lucide-react";
import clsx from "clsx";

import Home from "@/pages/Home";
import Environment from "@/pages/Environment";
import Soil from "@/pages/Soil";
import Water from "@/pages/Water";
import AiPage from "@/pages/AiPage";
import Analytics from "@/pages/Analytics";
import DigitalTwinPage from "@/pages/DigitalTwinPage";
import SettingsPage from "@/pages/SettingsPage";
import { useLiveSensors } from "@/hooks/useLiveSensors";

const NODE = "esp32-node-01";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "/analytics", label: "Analytics", icon: LineChart },
  { to: "/environment", label: "Environment", icon: Thermometer },
  { to: "/soil", label: "Fields", icon: Sprout },
  { to: "/water", label: "Harvesting", icon: Droplets },
  { to: "/twin", label: "Finances", icon: LayoutGrid },
  { to: "/ai", label: "Weather", icon: Camera },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function App() {
  const { status } = useLiveSensors(NODE);

  return (
    <div className="min-h-screen flex bg-theme-bg p-4 lg:p-8">
      <div className="flex w-full max-w-[1400px] mx-auto bg-white rounded-[2rem] overflow-hidden shadow-sm border border-stone-100">
        <aside className="w-64 shrink-0 bg-theme-sidebar p-6 flex flex-col gap-1">
          <div className="flex items-center mb-10 px-2 mt-2">
            <div className="font-display font-semibold text-white text-2xl tracking-tight flex items-center">
              agri<Sprout className="text-theme-primary mx-0.5" size={24} />cultur
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) => clsx("nav-link", isActive && "nav-link-active")}
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-4">
            <div className="px-4 py-2 flex items-center gap-2 text-xs text-stone-400">
              {status === "connected" ? (
                <Wifi size={14} className="text-theme-primary" />
              ) : (
                <WifiOff size={14} className="text-stone-500" />
              )}
              {status === "connected" ? "Live Data" : status === "connecting" ? "Connecting…" : "Offline"}
            </div>
            <button 
              onClick={() => {
                import("@/lib/api").then(({ api }) => {
                  api.logout();
                  window.location.reload();
                });
              }}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-stone-400 hover:text-white transition-colors"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-20 flex items-center justify-between px-10 bg-white">
            <div className="relative w-96 flex items-center">
              <Search className="absolute left-0 text-stone-400" size={18} />
              <input 
                type="text" 
                placeholder="Search any of content" 
                className="w-full pl-8 pr-4 py-2 bg-transparent outline-none text-sm placeholder:text-stone-400 text-stone-700" 
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 bg-stone-200 rounded-full overflow-hidden border-2 border-stone-100">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Avatar" />
              </div>
            </div>
          </header>
          <div className="flex-1 px-10 pb-10 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Home node={NODE} />} />
              <Route path="/environment" element={<Environment node={NODE} />} />
              <Route path="/soil" element={<Soil node={NODE} />} />
              <Route path="/water" element={<Water node={NODE} />} />
              <Route path="/ai" element={<AiPage node={NODE} />} />
              <Route path="/analytics" element={<Analytics node={NODE} />} />
              <Route path="/twin" element={<DigitalTwinPage node={NODE} />} />
              <Route path="/settings" element={<SettingsPage node={NODE} />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
