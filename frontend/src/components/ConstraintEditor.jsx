import React, { useState, useEffect } from "react";

function fmtTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}

export default function ConstraintEditor({
  constraints,
  paxId,
  onSave,
  onEvaluate,
  busy,
}) {
  const [open, setOpen] = useState(false);
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
    if (onSave) await onSave(form);
    if (onEvaluate) await onEvaluate(form);
    setOpen(false);
  };

  const priorityLabel = {
    fastest_arrival: "Fastest arrival",
    lowest_cost: "Lowest cost",
    least_disruption: "Least disruption",
    balanced: "Balanced",
  };

  const arriveBy = form.latest_arrival_time?.slice(11, 16) || "—";

  return (
    <div className="rounded-lg border border-border bg-panel">
      {/* Summary header — always visible */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Your preferences</h3>
          <p className="text-xs text-muted mt-0.5">
            These limits guide the recovery recommendations above.
          </p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs px-3 py-1.5 rounded-lg bg-subtle border border-border text-muted hover:text-white transition-colors"
        >
          {open ? "Cancel" : "Edit preferences"}
        </button>
      </div>

      {/* Inline constraint summary */}
      {!open && (
        <div className="px-4 pb-3 flex flex-wrap gap-3 text-xs text-muted border-t border-border pt-3">
          <span>
            <span className="text-white font-medium">\${form.max_additional_cost}</span> max extra cost
          </span>
          <span className="text-border">·</span>
          <span>
            Arrive by <span className="text-white font-medium">{arriveBy}</span>
          </span>
          <span className="text-border">·</span>
          <span>
            Priority: <span className="text-white font-medium">{priorityLabel[form.priority_preference] || form.priority_preference}</span>
          </span>
          {form.must_keep_cabin && (
            <>
              <span className="text-border">·</span>
              <span>Keep cabin class</span>
            </>
          )}
        </div>
      )}

      {/* Expanded editor */}
      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Max cost */}
            <div className="rounded-lg bg-subtle p-3 border border-border">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-200">
                  Max extra cost
                </label>
                <span className="text-xs font-semibold text-warning mono">
                  \${form.max_additional_cost}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="600"
                step="25"
                value={form.max_additional_cost}
                onChange={(e) => handleChange("max_additional_cost", parseFloat(e.target.value))}
                className="w-full accent-warning cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted mt-1">
                <span>$0 (strict)</span>
                <span>$300</span>
                <span>$600</span>
              </div>
              <p className="text-[11px] text-muted mt-1.5">
                Options that cost more than this are excluded.
              </p>
            </div>

            {/* Latest arrival */}
            <div className="rounded-lg bg-subtle p-3 border border-border">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-200">
                  Must arrive by
                </label>
                <span className="text-xs font-semibold text-accent mono">
                  {form.latest_arrival_time?.slice(11, 16) || "19:00"}
                </span>
              </div>
              <input
                type="datetime-local"
                value={form.latest_arrival_time?.slice(0, 16) || "2026-11-15T19:00"}
                onChange={(e) => handleChange("latest_arrival_time", e.target.value + ":00")}
                className="w-full text-xs bg-panel border border-border rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-accent"
              />
              <p className="text-[11px] text-muted mt-1.5">
                Flights arriving later are excluded.
              </p>
            </div>

            {/* Priority */}
            <div className="rounded-lg bg-subtle p-3 border border-border">
              <label className="text-xs font-medium text-slate-200 block mb-2">
                Prioritise
              </label>
              <select
                value={form.priority_preference}
                onChange={(e) => handleChange("priority_preference", e.target.value)}
                className="w-full text-xs bg-panel border border-border rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-accent"
              >
                <option value="fastest_arrival">Fastest arrival (minimise delay)</option>
                <option value="lowest_cost">Lowest cost (minimise fare increase)</option>
                <option value="least_disruption">Least disruption (keep hotel/car)</option>
                <option value="balanced">Balanced</option>
              </select>
              <p className="text-[11px] text-muted mt-1.5">
                Influences which option is ranked first.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.must_keep_cabin}
                onChange={(e) => handleChange("must_keep_cabin", e.target.checked)}
                className="rounded border-border bg-panel accent-accent"
              />
              <span>Don't downgrade cabin class</span>
            </label>

            <button
              onClick={handleApply}
              disabled={busy}
              className="text-xs px-4 py-2 rounded-lg bg-accent text-white font-semibold hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {busy ? "Evaluating…" : "Update & re-evaluate options"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
