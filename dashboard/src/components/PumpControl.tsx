import { useState } from "react";
import { Power, Zap } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";

interface PumpControlProps {
  node: string;
  pumpOn: boolean;
  autoMode: boolean;
}

export default function PumpControl({ node, pumpOn, autoMode }: PumpControlProps) {
  const [busy, setBusy] = useState(false);
  const [localPumpOn, setLocalPumpOn] = useState(pumpOn);
  const [localAuto, setLocalAuto] = useState(autoMode);

  async function togglePump() {
    setBusy(true);
    try {
      const next = !localPumpOn;
      await api.setPump(node, next);
      setLocalPumpOn(next);
      setLocalAuto(false);
    } catch {
      // surfaced via disabled state / could add toast
    } finally {
      setBusy(false);
    }
  }

  async function toggleAuto() {
    setBusy(true);
    try {
      const next = !localAuto;
      await api.setMode(node, next);
      setLocalAuto(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-stone-800">Irrigation Pump</span>
        <span
          className={clsx(
            "text-[11px] px-2 py-0.5 rounded-full font-medium",
            localAuto ? "bg-theme-cardBlue text-sky-600" : "bg-orange-50 text-orange-600"
          )}
        >
          {localAuto ? "Auto" : "Manual"}
        </span>
      </div>

      <button
        onClick={togglePump}
        disabled={busy || localAuto}
        className={clsx(
          "w-full flex items-center justify-center gap-2 py-5 rounded-2xl font-medium transition-all",
          localPumpOn
            ? "bg-theme-primary text-stone-900 shadow-lg shadow-theme-primary/30"
            : "bg-stone-100 text-stone-500 hover:bg-stone-200",
          (busy || localAuto) && "opacity-60 cursor-not-allowed"
        )}
      >
        {localPumpOn ? <Zap size={18} /> : <Power size={18} />}
        {localPumpOn ? "Pump Running" : "Pump Off"}
      </button>

      <button
        onClick={toggleAuto}
        disabled={busy}
        className="text-xs text-stone-400 hover:text-stone-600 transition-colors self-center font-medium"
      >
        Switch to {localAuto ? "manual" : "automatic"} control
      </button>
    </div>
  );
}
