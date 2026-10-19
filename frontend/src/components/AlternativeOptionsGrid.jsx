import React from "react";

function fmtTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return iso; }
}

export default function AlternativeOptionsGrid({
  options = [],
  selectedFlightId,
  onSelectOption,
}) {
  if (!options || options.length === 0) return null;

  const feasibleCount = options.filter((o) => o.is_feasible).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-white">Recovery options</h2>
        <p className="text-sm text-muted mt-0.5">
          {options.length} alternative{options.length === 1 ? "" : "s"} evaluated.{" "}
          {feasibleCount === 0
            ? "None meet all your constraints."
            : feasibleCount === 1
            ? "1 meets all your constraints."
            : `${feasibleCount} meet all your constraints.`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {options.map((opt, idx) => {
          const f = opt.flight;
          if (!f) return null;
          const isSelected = selectedFlightId === f.flight_id;
          const isFeasible = opt.is_feasible;
          const isRecommended = isFeasible && idx === 0;

          let borderClass = "border-border";
          if (isSelected) borderClass = "border-accent ring-1 ring-accent";
          else if (!isFeasible) borderClass = "border-danger/30";

          let badge = null;
          if (isRecommended) {
            badge = (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/40 font-medium">
                Recommended
              </span>
            );
          } else if (isFeasible) {
            badge = (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/40 font-medium">
                Compromise
              </span>
            );
          } else {
            badge = (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-danger/15 text-danger border border-danger/40 font-medium">
                Not viable
              </span>
            );
          }

          return (
            <div
              key={f.flight_id || idx}
              className={`rounded-lg border bg-panel p-4 flex flex-col gap-3 transition-all cursor-pointer ${borderClass} hover:border-accent/50`}
              onClick={() => onSelectOption && onSelectOption(opt)}
            >
              {/* Badge + checkmark */}
              <div className="flex items-center justify-between">
                {badge}
                {isSelected && (
                  <span className="text-accent font-semibold text-sm">✓</span>
                )}
              </div>

              {/* Carrier + flight number */}
              <div>
                <div className="text-base font-bold text-white">
                  {f.carrier} {f.flight_number}
                </div>
                <div className="text-xs text-muted mt-0.5 capitalize">
                  {f.cabin_class} class
                </div>
              </div>

              {/* Times */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold text-white">{fmtTime(f.departure)}</div>
                  <div className="text-xs text-muted">{f.origin} · {fmtDate(f.departure)}</div>
                </div>
                <div className="flex-1 border-t border-dashed border-border mx-2" />
                <div className="text-right">
                  <div className="text-lg font-semibold text-white">{fmtTime(f.arrival)}</div>
                  <div className="text-xs text-muted">{f.destination}</div>
                </div>
              </div>

              {/* Key metrics */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex-1 text-center rounded bg-subtle border border-border px-2 py-1.5">
                  <div className="text-muted">Extra cost</div>
                  <div className={`font-semibold mt-0.5 ${opt.fare_delta > 0 ? "text-warning" : "text-success"}`}>
                    {opt.fare_delta > 0 ? `+$${opt.fare_delta.toFixed(2)}` : "$0"}
                  </div>
                </div>
                <div className="flex-1 text-center rounded bg-subtle border border-border px-2 py-1.5">
                  <div className="text-muted">Delay</div>
                  <div className="font-semibold text-warning mt-0.5">
                    +{opt.delay_minutes ?? 0}m
                  </div>
                </div>
                <div className="flex-1 text-center rounded bg-subtle border border-border px-2 py-1.5">
                  <div className="text-muted">Arrives</div>
                  <div className="font-semibold text-white mt-0.5">{fmtTime(f.arrival)}</div>
                </div>
              </div>

              {/* Hotel / car impact */}
              <div className="text-xs text-muted space-y-1 border-t border-border pt-2">
                {opt.hotel?.name && (
                  <div className="flex items-center gap-1.5">
                    <span>🏨</span>
                    <span className="text-slate-300">{opt.hotel.name}</span>
                    {opt.hotel.check_in && (
                      <span className="text-muted">· check-in {fmtTime(opt.hotel.check_in)}</span>
                    )}
                  </div>
                )}
                {opt.car?.vendor && (
                  <div className="flex items-center gap-1.5">
                    <span>🚗</span>
                    <span className="text-slate-300">{opt.car.vendor} {opt.car.class}</span>
                    {opt.car.pickup && (
                      <span className="text-muted">· pickup {fmtTime(opt.car.pickup)}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Violations or reason */}
              {!isFeasible && opt.hard_violations?.length > 0 && (
                <div className="p-2.5 rounded-lg bg-danger/10 border border-danger/20 text-xs text-danger space-y-0.5">
                  <div className="font-semibold mb-1">Why this option doesn't work</div>
                  {opt.hard_violations.map((v, i) => (
                    <div key={i}>• {v}</div>
                  ))}
                </div>
              )}

              {isFeasible && opt.selection_reason && (
                <div className="p-2.5 rounded-lg bg-success/10 border border-success/20 text-xs text-success leading-relaxed">
                  {opt.selection_reason}
                </div>
              )}

              {/* Select button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectOption && onSelectOption(opt);
                }}
                className={`w-full text-xs font-semibold py-2 rounded-lg transition-colors ${
                  isSelected
                    ? "bg-accent/20 text-accent border border-accent/40"
                    : isFeasible
                    ? "bg-subtle border border-border text-slate-300 hover:bg-accent/10 hover:text-accent hover:border-accent/30"
                    : "bg-subtle border border-border text-muted cursor-pointer"
                }`}
              >
                {isSelected ? "✓ Selected" : "Select this option"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
