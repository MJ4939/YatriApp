import React from "react";

function fmtTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch (e) {
    return iso;
  }
}

function Stub({ label, value, wide, highlight }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <div className="mono text-[10px] uppercase tracking-widest text-slate-400">{label}</div>
      <div className={`mono text-xs truncate font-medium mt-0.5 ${highlight || "text-slate-100"}`}>
        {value}
      </div>
    </div>
  );
}

export default function ItineraryBoard({
  itineraries = [],
  selectedPaxId,
  onSelectPax,
  activeDisruptions = {},
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="mono text-[10px] uppercase tracking-widest text-sky-400 font-semibold">
            Trip Inventory & Active Bookings
          </span>
          <h2 className="text-base font-bold text-white mt-0.5">
            Active Traveller Profiles
          </h2>
        </div>
        <span className="mono text-xs text-slate-400 hidden sm:inline">
          Click any card to inspect journey & edit constraints
        </span>
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
              className={`relative rounded-xl border overflow-hidden cursor-pointer transition-all ${
                isSelected
                  ? "border-sky-500 bg-panel shadow-lg shadow-sky-500/10 ring-1 ring-sky-500"
                  : "border-line bg-panel/80 hover:border-lineLight hover:bg-panel"
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-dashed border-line bg-wash">
                <div className="flex items-center gap-2">
                  <span className="mono text-xs font-bold text-white">
                    {it.flight.carrier.toUpperCase()} {it.flight.flight_number}
                  </span>
                  {hasDisruption && (
                    <span className="mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-alert text-white font-bold animate-pulse">
                      Disrupted
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="mono text-[10px] text-slate-400">{it.pax_id}</span>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="px-4 py-3 grid grid-cols-2 gap-3 text-xs">
                <Stub label="Traveller" value={it.member_name} wide highlight="text-white font-bold" />
                <Stub label="Route" value={`${it.flight.origin} → ${it.flight.destination}`} highlight="text-sky-300 font-semibold" />
                <Stub label="Cabin" value={it.flight.cabin_class?.toUpperCase()} />
                <Stub label="Scheduled Departure" value={fmtTime(it.flight.departure)} wide />
                <Stub label="Hotel" value={it.hotel.name} wide />
                <Stub label="Car Rental" value={`${it.car.vendor} · ${it.car.class?.toUpperCase()}`} wide />
              </div>

              {/* Notes footer */}
              {it.notes && (
                <div className="px-4 py-2 bg-wash/60 border-t border-line text-[11px] text-slate-400 truncate">
                  <span className="mono text-slate-500 uppercase text-[9px] mr-1 font-semibold">Note:</span>
                  {it.notes}
                </div>
              )}

              {/* Perforation notch, boarding-pass style */}
              <div className="absolute -left-2 top-[34px] w-4 h-4 rounded-full bg-ink border border-line" />
              <div className="absolute -right-2 top-[34px] w-4 h-4 rounded-full bg-ink border border-line" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
