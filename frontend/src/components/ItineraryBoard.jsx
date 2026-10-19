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

export default function ItineraryBoard({
  itineraries = [],
  selectedPaxId,
  onSelectPax,
  activeDisruptions = {},
}) {
  if (!itineraries || itineraries.length === 0) {
    return (
      <div className="text-sm text-muted border border-dashed border-border rounded-lg p-6 text-center bg-panel/40">
        No traveller profiles loaded.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Traveller profiles</h2>
        <span className="text-xs text-muted">Click a card to select</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {itineraries.map((it) => {
          const isSelected = selectedPaxId === it.pax_id;
          const disruption = activeDisruptions[it.pax_id];
          const hasDisruption = disruption && disruption.active;

          return (
            <div
              key={it.pax_id}
              onClick={() => onSelectPax && onSelectPax(it.pax_id)}
              className={`relative rounded-lg border overflow-hidden cursor-pointer transition-all ${
                isSelected
                  ? "border-accent bg-panel ring-1 ring-accent"
                  : "border-border bg-panel hover:border-lineLight"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-subtle">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    {it.flight?.carrier} {it.flight?.flight_number}
                  </span>
                  {hasDisruption && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-danger text-white font-semibold animate-pulse">
                      Disrupted
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted">{it.pax_id}</span>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                </div>
              </div>

              {/* Body */}
              <div className="px-4 py-3 space-y-2 text-xs">
                <div>
                  <div className="text-muted text-[10px] uppercase tracking-wider">Traveller</div>
                  <div className="font-semibold text-white mt-0.5">{it.member_name}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-muted text-[10px] uppercase tracking-wider">Route</div>
                    <div className="text-accent font-medium mt-0.5">
                      {it.flight?.origin} → {it.flight?.destination}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted text-[10px] uppercase tracking-wider">Cabin</div>
                    <div className="text-slate-300 mt-0.5 capitalize">{it.flight?.cabin_class}</div>
                  </div>
                </div>

                <div>
                  <div className="text-muted text-[10px] uppercase tracking-wider">Departure</div>
                  <div className="text-slate-300 mt-0.5">
                    {fmtTime(it.flight?.departure)} · {fmtDate(it.flight?.departure)}
                  </div>
                </div>

                {it.hotel?.name && (
                  <div>
                    <div className="text-muted text-[10px] uppercase tracking-wider">Hotel</div>
                    <div className="text-slate-300 mt-0.5 truncate">{it.hotel.name}</div>
                  </div>
                )}
              </div>

              {/* Notes */}
              {it.notes && (
                <div className="px-4 py-2 bg-subtle border-t border-border text-[11px] text-muted truncate">
                  <span className="text-muted/60 mr-1">Note:</span>
                  {it.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
