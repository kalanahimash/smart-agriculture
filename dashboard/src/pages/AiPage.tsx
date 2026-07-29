import { useRef, useState } from "react";
import { Camera, Upload, Leaf, AlertTriangle } from "lucide-react";
import StatCard from "@/components/StatCard";
import { api, type DetectionResult } from "@/lib/api";
import clsx from "clsx";

export default function AiPage({ node }: { node: string }) {
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    try {
      const res = await api.detectDisease(node, file);
      setResult(res);
    } catch (e) {
      setError("Detection failed — is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-800">Plant Health AI</h1>
        <p className="text-sm text-stone-500 mt-1">
          YOLOv8-based disease detection from the Raspberry Pi camera feed
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Healthy Detections"
          value={result?.healthy_count ?? "—"}
          icon={Leaf}
          accent="canopy"
        />
        <StatCard
          label="Diseased Detections"
          value={result?.diseased_count ?? "—"}
          icon={AlertTriangle}
          accent="clay"
        />
        <StatCard
          label="Last Scan"
          value={result ? new Date(result.timestamp).toLocaleTimeString() : "—"}
          icon={Camera}
          accent="sky"
        />
      </div>

      <div className="panel p-6 flex flex-col items-center gap-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {previewUrl ? (
          <div className="relative w-full max-w-xl rounded-lg overflow-hidden border border-soil-700">
            <img src={previewUrl} alt="Uploaded plant" className="w-full" />
            {result?.detections.map((d, i) => {
              const [x1, y1, x2, y2] = d.bbox;
              const isHealthy = d.label === "healthy";
              return (
                <div
                  key={i}
                  className={clsx(
                    "absolute border-2 rounded",
                    isHealthy ? "border-canopy-400" : "border-signal-clay"
                  )}
                  style={{
                    left: `${x1 * 100}%`,
                    top: `${y1 * 100}%`,
                    width: `${(x2 - x1) * 100}%`,
                    height: `${(y2 - y1) * 100}%`,
                  }}
                >
                  <span
                    className={clsx(
                      "absolute -top-5 left-0 text-[10px] px-1.5 py-0.5 rounded font-mono",
                      isHealthy ? "bg-canopy-400 text-soil-950" : "bg-signal-clay text-soil-950"
                    )}
                  >
                    {d.label} {(d.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="w-full max-w-xl h-64 rounded-lg border-2 border-dashed border-soil-700 flex items-center justify-center text-stone-600">
            <Camera size={32} />
          </div>
        )}

        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-canopy-500 text-soil-950 font-medium hover:bg-canopy-400 transition-colors disabled:opacity-60"
        >
          <Upload size={16} />
          {loading ? "Analyzing…" : "Upload Plant Image"}
        </button>

        {error && <p className="text-signal-clay text-sm">{error}</p>}
        <p className="text-xs text-stone-600 text-center max-w-md">
          No trained weights on this machine yet, this uses a mock detector so the UI is fully
          demoable. Drop real YOLOv8 weights at the path in the README to switch to live inference.
        </p>
      </div>
    </div>
  );
}
