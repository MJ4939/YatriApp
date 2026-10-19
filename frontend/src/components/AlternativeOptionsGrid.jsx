import React from "react";

function formatTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch (e) {
    return iso;
  }
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch (e) {
    return iso;
  }
}

export default function AlternativeOptionsGrid({
  options = [],
  selectedFlightId,
  onSelectOption,
}) {
  if (!options || options.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="mono text-[10px] uppercase tracking-widest text-sky-400 font-semibold">
            Multi-Modal Graph Optimization
          </span>
          <h3 className="text-base font-bold text-white mt-0.5">
            Evaluated Recovery Alternatives ({options.length})
          </h3>
        </div>
        <span className="mono text-xs text-slate-400 hidden sm:inline">
          Dijkstra Multi-Path Ranking with Hard Constraints
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {options.map((opt, idx) => {
          const f = opt.flight;
          const isSelected = selectedFlightId === f.flight_id;
          const isFeasible = opt.is_feasible;
          const rank = idx + 1;

          return (
            <div
              key={f.flight_id || idx}
              onClick={() => onSelectOption && onSelectOption(opt)}
              className={`rounded-xl border p-4 transition-all cursor-pointer relative flex flex-col justify-between ${
                isSelected
                  ? "border-sky-500 bg-sky-950/30 shadow-md shadow-sky-500/10 ring-1 ring-sky-500"
                  : isFeasible
                  ? "border-line bg-panel hover:border-sky-500/50 hover:bg-wash"
                  : "border-alert/30 bg-panel/60 opacity-90 hover:border-alert/50"
              }`}
            >
              <div>
                {/* Header: Rank + Feasibility Badge */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="mono text-[11px] px-2 py-0.5 rounded bg-wash border border-line text-slate-300 font-medium">
                    Option #{rank}
                  </span>
                  {isFeasible ? (
                    <span
                      className={`mono text-[10px] px-2 py-0.5 rounded font-semibold ${
                        rank === 1
                          ? "bg-go/20 text-go border border-go/40"
                          : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                      }`}
                    >
                      {rank === 1 ? "Optimal Choice" : "Feasible"}
                    </span>
                  ) : (
                    <span className="mono text-[10px] px-2 py-0.5 rounded bg-alert/20 text-alert border border-alert/30 font-semibold">
                      Constraint Violated
                    </span>
                  )}
                </div>

                {/* Carrier & Flight Number */}
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-white">
                    {f.carrier} {f.flight_number}
                  </div>
                  <div className="mono text-xs font-semibold text-white">
                    ${f.fare?.toFixed(2)}{" "}
                    <span
                      className={`text-[11px] ${
                        opt.fare_delta > 0 ? "text-signal" : "text-go"
                      }`}
                    >
                      {opt.fare_delta > 0 ? `(+$${opt.fare_delta.toFixed(2)})` : "(+$0)"}
                    </span>
                  </div>
                </div>

                {/* Times & Route */}
                <div className="mt-2 text-xs text-slate-300 mono flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{formatTime(f.departure)}</div>
                    <div className="text-[10px] text-slate-400">{formatDate(f.departure)}</div>
                  </div>
                  <div className="text-center px-2">
                    <span className="text-[10px] text-slate-500 block">
                      +{opt.delay_minutes}m delay
                    </span>
                    <span className="text-sky-400">───────✈</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white">{formatTime(f.arrival)}</div>
                    <div className="text-[10px] text-slate-400">{formatDate(f.arrival)}</div>
                  </div>
                </div>

                {/* Cabin & Hotel/Car Info */}
                <div className="mt-3 pt-2.5 border-t border-line/60 text-[11px] text-slate-300 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="mono text-slate-500">Cabin</span>
                    <span className="mono text-slate-200 capitalize">{f.cabin_class}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="mono text-slate-500">Hotel Match</span>
                    <span className="truncate max-w-[150px] text-slate-300">
                      {opt.hotel?.name || "Original Hotel"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="mono text-slate-500">Car Rental</span>
                    <span className="text-slate-300">{opt.car?.vendor || "Original Rental"}</span>
                  </div>
                </div>

                {/* Infeasible Violations Notice */}
                {!isFeasible && opt.hard_violations && opt.hard_violations.length > 0 && (
                  <div className="mt-2.5 p-2 rounded bg-alert/10 border border-alert/20 text-[11px] text-alert space-y-0.5">
                    <div className="mono font-semibold uppercase text-[9px] tracking-wider">
                      Disqualification Reason:
                    </div>
                    {opt.hard_violations.map((v, i) => (
                      <div key={i} className="leading-tight">
                        • {v}
                      </div>
                    ))}
                  </div>
                )}

                {/* Feasible Selection Reasoning */}
                {isFeasible && opt.selection_reason && (
                  <div className="mt-2.5 p-2 rounded bg-go/10 border border-go/20 text-[11px] text-go leading-snug">
                    {opt.selection_reason}
                  </div>
                )}
              </div>

              {/* Bottom CTA */}
              <div className="mt-3 pt-2 border-t border-line/40 flex items-center justify-between text-xs">
                <span className="mono text-[10px] text-slate-500">
                  Weight: {opt.score ?? opt.total_weight}
                </span>
                <span
                  className={`mono text-[10px] uppercase font-semibold ${
                    isSelected ? "text-sky-400" : "text-slate-400"
                  }`}
                >
                  {isSelected ? "✓ Active Itinerary" : "Select Option →"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
