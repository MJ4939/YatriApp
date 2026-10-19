import React, { useState } from "react";

export default function InjectorControls({
  itineraries = [],
  selectedPaxId,
  onSelectPax,
  onSimulate,
  onInjectStorm,
  onDemoScenario,
  onDemoReset,
}) {
  const [paxId, setPaxId] = useState(selectedPaxId || "PAX-1001");
  const [disruptionStatus, setDisruptionStatus] = useState("cancelled");
  const [delayMinutes, setDelayMinutes] = useState(120);
  const [customReason, setCustomReason] = useState("");
  const [busy, setBusy] = useState(false);

  const handlePaxChange = (id) => {
    setPaxId(id);
    if (onSelectPax) onSelectPax(id);
  };

  const handleTrigger = async () => {
    setBusy(true);
    try {
      const defaultReason =
        disruptionStatus === "cancelled"
          ? "Inbound aircraft mechanical inspection failure at departure gate"
          : `Air traffic control ground hold: departure delayed by ${delayMinutes} minutes`;

      if (onSimulate) {
        await onSimulate({
          pax_id: paxId || itineraries[0]?.pax_id || "PAX-1001",
          status: disruptionStatus,
          delay_minutes: disruptionStatus === "delayed" ? delayMinutes : undefined,
          reason: customReason || defaultReason,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDemo = async () => {
    setBusy(true);
    try {
      if (onDemoScenario) await onDemoScenario();
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setBusy(true);
    try {
      if (onDemoReset) await onDemoReset();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Scenario simulator</h3>
          <p className="text-xs text-muted mt-0.5">Trigger simulated flight disruptions for testing.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDemo}
            disabled={busy}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            Run canonical scenario
          </button>
          <button
            onClick={handleReset}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-lg bg-subtle border border-border text-muted hover:text-white disabled:opacity-50 transition-colors"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        {/* Traveller selection */}
        <div>
          <label className="text-xs font-medium text-slate-300 block mb-1.5">
            Traveller
          </label>
          <select
            value={paxId}
            onChange={(e) => handlePaxChange(e.target.value)}
            className="w-full text-xs bg-subtle border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-accent"
          >
            {itineraries.map((it) => (
              <option key={it.pax_id} value={it.pax_id}>
                {it.pax_id} — {it.member_name}
              </option>
            ))}
          </select>
        </div>

        {/* Disruption type */}
        <div>
          <label className="text-xs font-medium text-slate-300 block mb-1.5">
            Disruption type
          </label>
          <select
            value={disruptionStatus}
            onChange={(e) => setDisruptionStatus(e.target.value)}
            className="w-full text-xs bg-subtle border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-accent"
          >
            <option value="cancelled">Flight cancellation</option>
            <option value="delayed">Severe delay</option>
            <option value="missed_connection">Missed connection</option>
          </select>
        </div>

        {/* Delay / reason */}
        <div>
          {disruptionStatus === "delayed" ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Delay duration
                </label>
                <span className="text-xs font-semibold text-warning mono">
                  {delayMinutes} min
                </span>
              </div>
              <input
                type="range"
                min="30"
                max="360"
                step="15"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(parseInt(e.target.value))}
                className="w-full accent-warning cursor-pointer"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                Root cause (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Engine fault at gate"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full text-xs bg-subtle border border-border rounded px-3 py-2 text-white focus:outline-none focus:border-accent placeholder:text-muted/50"
              />
            </div>
          )}
        </div>

        {/* Action */}
        <div>
          <button
            disabled={busy}
            onClick={handleTrigger}
            className="w-full text-xs font-semibold px-3 py-2 rounded-lg bg-danger/20 text-danger border border-danger/40 hover:bg-danger/30 disabled:opacity-40 transition-colors"
          >
            {busy ? "Running…" : "Run disruption scenario"}
          </button>
        </div>
      </div>
    </div>
  );
}
