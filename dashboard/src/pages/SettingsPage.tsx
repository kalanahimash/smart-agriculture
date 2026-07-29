import { useState, useEffect } from "react";
import { Sliders, Lock, ToggleLeft } from "lucide-react";
import { api } from "@/lib/api";

export default function SettingsPage({ node }: { node: string }) {
  const [lowPct, setLowPct] = useState(30);
  const [highPct, setHighPct] = useState(65);
  const [autoMode, setAutoMode] = useState(true);
  const [saved, setSaved] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(api.isAuthenticated());

  useEffect(() => {
    api.getControlStatus(node).then((s: any) => {
      setLowPct(s.thresholds.low_pct);
      setHighPct(s.thresholds.high_pct);
      setAutoMode(s.auto_mode);
    }).catch(() => {});
  }, [node]);

  async function saveThresholds() {
    await api.setThresholds(node, lowPct, highPct);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function toggleMode() {
    const next = !autoMode;
    await api.setMode(node, next);
    setAutoMode(next);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    try {
      await api.login(username, password);
      setLoggedIn(true);
    } catch {
      setLoginError("Invalid username or password");
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-semibold text-stone-800">Settings</h1>
        <p className="text-sm text-stone-500 mt-1">Irrigation thresholds, mode, and account access</p>
      </div>

      <div className="panel p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-stone-400 text-sm font-medium">
          <Sliders size={16} /> Irrigation Thresholds
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-stone-500 flex justify-between">
            <span>Start irrigation below</span>
            <span className="font-mono text-canopy-400">{lowPct}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={lowPct}
            onChange={(e) => setLowPct(Number(e.target.value))}
            className="accent-canopy-500"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-stone-500 flex justify-between">
            <span>Stop irrigation above</span>
            <span className="font-mono text-signal-sky">{highPct}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={highPct}
            onChange={(e) => setHighPct(Number(e.target.value))}
            className="accent-signal-sky"
          />
        </div>
        <button
          onClick={saveThresholds}
          className="self-start px-4 py-2 rounded-lg bg-[#5a9146] text-white text-sm font-medium hover:bg-[#437033] transition-colors"
        >
          {saved ? "Saved ✓" : "Save Thresholds"}
        </button>
      </div>

      <div className="panel p-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-stone-400 text-sm font-medium">
          <ToggleLeft size={16} /> Irrigation Mode
        </div>
        <button
          onClick={toggleMode}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
            autoMode ? "bg-signal-sky/15 text-signal-sky" : "bg-signal-amber/15 text-signal-amber"
          }`}
        >
          {autoMode ? "Automatic" : "Manual"}
        </button>
      </div>

      {!loggedIn ? (
        <div className="panel p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-stone-400 text-sm font-medium">
            <Lock size={16} /> Sign In
          </div>
          <p className="text-xs text-stone-500">
            Viewing is open to everyone. Sign in as admin/operator to control the pump or change
            thresholds.
          </p>
          <form onSubmit={handleLogin} className="flex flex-col gap-2">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700 outline-none focus:border-theme-primary"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700 outline-none focus:border-theme-primary"
            />
            {loginError && <p className="text-signal-clay text-xs">{loginError}</p>}
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#5a9146] text-white text-sm font-medium hover:bg-[#437033] transition-colors"
            >
              Sign In
            </button>
          </form>
        </div>
      ) : (
        <div className="panel p-5 flex items-center justify-between">
          <span className="text-sm text-stone-500 font-medium">Signed in</span>
          <button
            onClick={() => {
              api.logout();
              setLoggedIn(false);
            }}
            className="text-xs text-stone-500 hover:text-stone-700"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
