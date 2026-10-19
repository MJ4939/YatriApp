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

export default function ItineraryComparison({ original, chosen, hasFeasibleSolution }) {
  if (!original) return null;

  const origFlight = original.flight || {};
  const origHotel = original.hotel || {};
  const origCar = original.car || {};

  const revisedFlight = chosen?.flight;
  const revisedHotel = chosen?.hotel;
  const revisedCar = chosen?.car;

  const fareDelta = chosen?.fare_delta ?? 0;
  const delayMinutes = chosen?.delay_minutes ?? 0;

  return (
    <div className="rounded-lg border border-border bg-panel overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-subtle flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">Original vs. recovery itinerary</h3>
        <div>
          {hasFeasibleSolution ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-success/15 border border-success/40 text-success font-medium">
              Feasible recovery found
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full bg-danger/15 border border-danger/40 text-danger font-medium">
              No fully compliant option
            </span>
          )}
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Original */}
        <div className="rounded-lg border border-border bg-subtle p-4">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Original schedule
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-danger/20 text-danger border border-danger/30 font-medium">
              Disrupted
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-muted mb-0.5">Flight</div>
              <div className="font-semibold text-white">
                {origFlight.carrier} {origFlight.flight_number}
              </div>
              <div className="text-slate-300">
                {origFlight.origin} {fmtTime(origFlight.departure)} → {origFlight.destination} {fmtTime(origFlight.arrival)}
              </div>
              <div className="text-xs text-muted">
                {fmtDate(origFlight.departure)} · {origFlight.cabin_class} · ${origFlight.fare?.toFixed(2)}
              </div>
            </div>

            <div className="pt-2 border-t border-border/60">
              <div className="text-xs text-muted mb-0.5">Hotel</div>
              <div className="font-medium text-white">{origHotel.name}</div>
              <div className="text-xs text-slate-300">
                Check-in: {fmtTime(origHotel.check_in)} · ${origHotel.rate_per_night?.toFixed(2)}/night
              </div>
            </div>

            <div className="pt-2 border-t border-border/60">
              <div className="text-xs text-muted mb-0.5">Car rental</div>
              <div className="font-medium text-white">{origCar.vendor}</div>
              <div className="text-xs text-slate-300">
                Pickup: {fmtTime(origCar.pickup)} · {origCar.class}
              </div>
            </div>
          </div>
        </div>

        {/* Recovery */}
        <div className="rounded-lg border border-accent/40 bg-panel p-4">
          <div className="flex items-center justify-between pb-3 border-b border-accent/30 mb-3">
            <span className="text-xs font-semibold text-accent uppercase tracking-wider">
              Recovery plan
            </span>
            {revisedFlight && (
              <span className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent border border-accent/30 font-medium">
                Adjusted
              </span>
            )}
          </div>

          {revisedFlight ? (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted mb-0.5">Alternate flight</div>
                <div className="font-semibold text-white">
                  {revisedFlight.carrier} {revisedFlight.flight_number}
                </div>
                <div className="text-slate-200">
                  {revisedFlight.origin} {fmtTime(revisedFlight.departure)} → {revisedFlight.destination} {fmtTime(revisedFlight.arrival)}
                </div>
                <div className="text-xs text-muted flex items-center gap-2">
                  <span>{fmtDate(revisedFlight.departure)} · {revisedFlight.cabin_class}</span>
                  <span>·</span>
                  <span className="text-warning">+{delayMinutes}m vs original</span>
                  {fareDelta > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-warning">+${fareDelta.toFixed(2)}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-accent/20">
                <div className="text-xs text-muted mb-0.5">Hotel</div>
                <div className="font-medium text-white">{revisedHotel?.name}</div>
                <div className="text-xs text-slate-300">
                  Adjusted check-in: {fmtTime(revisedHotel?.check_in)}
                </div>
              </div>

              <div className="pt-2 border-t border-accent/20">
                <div className="text-xs text-muted mb-0.5">Car rental</div>
                <div className="font-medium text-white">{revisedCar?.vendor}</div>
                <div className="text-xs text-slate-300">
                  Adjusted pickup: {fmtTime(revisedCar?.pickup)}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-sm text-muted">
              No recovery plan selected yet.
            </div>
          )}
        </div>
      </div>

      {/* Delta footer */}
      {chosen && (
        <div className="px-4 py-3 bg-subtle border-t border-border flex flex-wrap items-center gap-4 text-xs text-muted">
          <span>
            Additional cost:{" "}
            <span className={`font-semibold ${fareDelta > 0 ? "text-warning" : "text-success"}`}>
              {fareDelta > 0 ? `+$${fareDelta.toFixed(2)}` : "$0.00"}
            </span>
          </span>
          <span className="text-border">·</span>
          <span>
            Delay:{" "}
            <span className="font-semibold text-warning">+{delayMinutes} min</span>
          </span>
          <span className="text-border">·</span>
          <span>
            New arrival:{" "}
            <span className="font-semibold text-white">{fmtTime(revisedFlight?.arrival)}</span>
          </span>
          <span className="ml-auto italic text-muted/60">Simulation only</span>
        </div>
      )}
    </div>
  );
}
