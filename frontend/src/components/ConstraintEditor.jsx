import React, { useState, useEffect } from "react";

export default function ConstraintEditor({
  constraints,
  paxId,
  onSave,
  onEvaluate,
  busy,
}) {
  const [form, setForm] = useState({
    max_additional_cost: 150,
    latest_arrival_time: "2026-11-15T19:00:00",
    max_delay_minutes: 240,
    must_keep_cabin: true,
    priority_preference: "fastest_arrival",
    required_commitments: "",
  });

  useEffect(() => {
    if (constraints) {
      setForm({
        max_additional_cost: constraints.max_additional_cost ?? 150,
        latest_arrival_time: constraints.latest_arrival_time ?? "2026-11-15T19:00:00",
        max_delay_minutes: constraints.max_delay_minutes ?? 240,
        must_keep_cabin: constraints.must_keep_cabin ?? true,
        priority_preference: constraints.priority_preference ?? "fastest_arrival",
        required_commitments: constraints.required_commitments ?? "",
      });
    }
  }, [constraints, paxId]);

  const handleChange = (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleApply = async () => {
    if (onSave) {
      await onSave(form);
    }
    if (onEvaluate) {
      await onEvaluate(form);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-panel p-5 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-line mb-4">
        <div>
          <span className="mono text-[10px] uppercase tracking-widest text-sky-400 font-semibold">
            Agent Guardrails & Policies
          </span>
          <h3 className="text-sm font-bold text-white mt-0.5">
            Traveller Constraints & Priority Engine
          </h3>
        </div>
        <span className="mono text-[11px] text-slate-400">
          Hard Constraints vs. Soft Trade-offs
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Hard Constraint: Max Budget */}
        <div className="rounded-lg bg-wash p-3 border border-line">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-200">
              Max Additional Budget
            </label>
            <span className="mono text-xs font-bold text-signal">
              ${form.max_additional_cost}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="600"
            step="25"
            value={form.max_additional_cost}
            onChange={(e) => handleChange("max_additional_cost", parseFloat(e.target.value))}
            className="w-full accent-signal cursor-pointer"
          />
          <div className="flex justify-between text-[10px] mono text-slate-500 mt-1">
            <span>$0 (Strict)</span>
            <span>$300</span>
            <span>$600</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            Hard Constraint: Rejects options exceeding this fare increase.
          </span>
        </div>

        {/* Hard Constraint: Arrival Deadline */}
        <div className="rounded-lg bg-wash p-3 border border-line">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-200">
              Latest Arrival Deadline
            </label>
            <span className="mono text-[11px] text-sky-400 font-semibold">
              {form.latest_arrival_time?.slice(11, 16) || "19:00"}
            </span>
          </div>
          <input
            type="datetime-local"
            value={form.latest_arrival_time?.slice(0, 16) || "2026-11-15T19:00"}
            onChange={(e) => handleChange("latest_arrival_time", e.target.value + ":00")}
            className="w-full text-xs mono bg-panel border border-line rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-sky-500"
          />
          <span className="text-[10px] text-slate-400 block mt-1.5">
            Hard Constraint: Rejects itineraries arriving after this cutoff.
          </span>
        </div>

        {/* Priority Preference */}
        <div className="rounded-lg bg-wash p-3 border border-line">
          <label className="text-xs font-semibold text-slate-200 block mb-1.5">
            Optimization Priority
          </label>
          <select
            value={form.priority_preference}
            onChange={(e) => handleChange("priority_preference", e.target.value)}
            className="w-full text-xs mono bg-panel border border-line rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-sky-500"
          >
            <option value="fastest_arrival">Fastest Arrival (Minimize Delays)</option>
            <option value="lowest_cost">Lowest Cost (Minimize Fare Delta)</option>
            <option value="least_disruption">Least Disruption (Preserve Hotel/Car)</option>
            <option value="balanced">Balanced Multi-Objective</option>
          </select>
          <span className="text-[10px] text-slate-400 block mt-1.5">
            Soft Preference: Tunes Dijkstra edge weights in the graph engine.
          </span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
            <input
              type="checkbox"
              checked={form.must_keep_cabin}
              onChange={(e) => handleChange("must_keep_cabin", e.target.checked)}
              className="rounded border-line bg-panel accent-sky-500 text-sky-500"
            />
            <span>Strict Cabin Class (Prohibit Downgrades)</span>
          </label>
          {form.required_commitments && (
            <span className="text-[11px] mono text-slate-400 hidden lg:inline">
              Note: {form.required_commitments}
            </span>
          )}
        </div>

        <button
          onClick={handleApply}
          disabled={busy}
          className="mono text-xs uppercase tracking-wider font-semibold px-4 py-2 rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 disabled:opacity-50 transition-colors shadow-sm shadow-sky-500/20"
        >
          {busy ? "Evaluating..." : "Apply Constraints & Rank Options"}
        </button>
      </div>
    </div>
  );
}
