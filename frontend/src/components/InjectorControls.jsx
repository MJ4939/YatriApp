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

  const handleStorm = async () => {
    setBusy(true);
    try {
      if (onInjectStorm) await onInjectStorm(12);
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
    <div className="rounded-xl border border-line bg-panel p-5 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line mb-4">
        <div>
          <span className="mono text-[10px] uppercase tracking-widest text-sky-400 font-semibold">
            Simulation & Testing Suite
          </span>
          <h3 className="text-base font-bold text-white mt-0.5">
            Disruption Simulator & Hackathon Scenario Engine
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDemo}
            disabled={busy}
            className="mono text-xs font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 transition-all shadow-md shadow-sky-500/20 flex items-center gap-1.5"
          >
            <span>⚡</span> Run PS 4.1 Demo Scenario
          </button>
          <button
            onClick={handleReset}
            disabled={busy}
            className="mono text-xs px-3 py-1.5 rounded-lg bg-wash border border-line text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            ↺ Reset Demo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        {/* Traveller Selection */}
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">
            Target Traveller
          </label>
          <select
            value={paxId}
            onChange={(e) => handlePaxChange(e.target.value)}
            className="w-full text-xs mono bg-wash border border-line rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
          >
            {itineraries.map((it) => (
              <option key={it.pax_id} value={it.pax_id}>
                {it.pax_id} — {it.member_name} ({it.flight.origin}→{it.flight.destination})
              </option>
            ))}
          </select>
        </div>

        {/* Disruption Type */}
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">
            Disruption Scenario
          </label>
          <select
            value={disruptionStatus}
            onChange={(e) => setDisruptionStatus(e.target.value)}
            className="w-full text-xs mono bg-wash border border-line rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
          >
            <option value="cancelled">Flight Cancellation (Critical)</option>
            <option value="delayed">Severe Flight Delay (Major)</option>
            <option value="missed_connection">Missed Connection</option>
          </select>
        </div>

        {/* Delay Minutes or Custom Reason */}
        <div>
          {disruptionStatus === "delayed" ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Delay Duration
                </label>
                <span className="mono text-xs font-bold text-signal">
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
                className="w-full accent-signal cursor-pointer"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Root Cause Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Engine mechanical fault at SFO"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full text-xs mono bg-wash border border-line rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500 placeholder:text-slate-600"
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            disabled={busy}
            onClick={handleTrigger}
            className="flex-1 mono text-xs uppercase tracking-wider font-bold px-3 py-2 rounded-lg bg-alert/20 text-alert border border-alert/40 hover:bg-alert/30 disabled:opacity-40 transition-colors"
          >
            {busy ? "Injecting..." : "Simulate Disruption"}
          </button>
          <button
            disabled={busy}
            onClick={handleStorm}
            className="mono text-xs uppercase tracking-wider px-3 py-2 rounded-lg bg-wash border border-line text-slate-400 hover:text-white hover:border-lineLight disabled:opacity-40 transition-colors"
            title="Fire 12 consecutive disruptions to test pipeline concurrency"
          >
            Storm (12x)
          </button>
        </div>
      </div>
    </div>
  );
}
