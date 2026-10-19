import React from "react";

function formatTime(iso) {
  if (!iso) return "—";
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
    <div className="rounded-xl border border-line bg-panel overflow-hidden shadow-lg">
      <div className="px-5 py-3.5 border-b border-line bg-wash flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="mono text-[10px] uppercase tracking-widest text-sky-400 font-semibold">
            Itinerary Synchronization
          </span>
          <h3 className="text-base font-bold text-white mt-0.5">
            Original Itinerary vs. Revised Recovery Plan
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {hasFeasibleSolution ? (
            <span className="mono text-xs px-2.5 py-1 rounded-full bg-go/15 border border-go/40 text-go font-medium">
              Feasible Recovery Feasible
            </span>
          ) : (
            <span className="mono text-xs px-2.5 py-1 rounded-full bg-alert/15 border border-alert/40 text-alert font-medium">
              Constraint Waiver Required
            </span>
          )}
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Original Itinerary */}
        <div className="rounded-lg border border-line bg-wash/60 p-4 relative">
          <div className="flex items-center justify-between pb-3 border-b border-line mb-3">
            <span className="mono text-xs uppercase tracking-wider font-semibold text-slate-400">
              Original Schedule
            </span>
            <span className="mono text-xs px-2 py-0.5 rounded bg-alert/20 text-alert border border-alert/30">
              Disrupted
            </span>
          </div>

          <div className="space-y-4">
            {/* Flight */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="mono text-slate-400">Flight Leg</span>
                <span className="mono text-slate-300 font-medium">${origFlight.fare?.toFixed(2)}</span>
              </div>
              <div className="text-sm font-semibold text-white">
                {origFlight.carrier} {origFlight.flight_number}
              </div>
              <div className="mono text-xs text-slate-300 flex items-center gap-2">
                <span>{origFlight.origin} {formatTime(origFlight.departure)}</span>
                <span className="text-slate-500">→</span>
                <span>{origFlight.destination} {formatTime(origFlight.arrival)}</span>
              </div>
              <div className="mono text-[11px] text-slate-400">
                Cabin: {origFlight.cabin_class?.toUpperCase()} · Date: {formatDate(origFlight.departure)}
              </div>
            </div>

            {/* Hotel */}
            <div className="pt-3 border-t border-line/60 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="mono text-slate-400">Hotel Accommodation</span>
                <span className="mono text-slate-300 font-medium">${origHotel.rate_per_night?.toFixed(2)}/nt</span>
              </div>
              <div className="text-sm font-semibold text-white">{origHotel.name}</div>
              <div className="mono text-xs text-slate-300">
                Check-in: {formatTime(origHotel.check_in)} ({formatDate(origHotel.check_in)})
              </div>
            </div>

            {/* Car */}
            <div className="pt-3 border-t border-line/60 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="mono text-slate-400">Ground Transportation</span>
                <span className="mono text-slate-300 font-medium">{origCar.class?.toUpperCase()}</span>
              </div>
              <div className="text-sm font-semibold text-white">{origCar.vendor} Car Rental</div>
              <div className="mono text-xs text-slate-300">
                Pickup: {formatTime(origCar.pickup)} ({formatDate(origCar.pickup)})
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Revised Recovery Itinerary */}
        <div className="rounded-lg border border-sky-500/40 bg-gradient-to-b from-sky-950/20 via-panel to-panel p-4 relative shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-sky-500/30 mb-3">
            <span className="mono text-xs uppercase tracking-wider font-semibold text-sky-400">
              Revised Recovery Plan
            </span>
            <span className="mono text-xs px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
              Synchronized
            </span>
          </div>

          {revisedFlight ? (
            <div className="space-y-4">
              {/* Revised Flight */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="mono text-sky-300">Alternate Flight</span>
                  <span className="mono font-semibold text-white">
                    ${revisedFlight.fare?.toFixed(2)}{" "}
                    <span className="text-signal text-[11px]">
                      (+${fareDelta.toFixed(2)})
                    </span>
                  </span>
                </div>
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>{revisedFlight.carrier} {revisedFlight.flight_number}</span>
                  {revisedFlight.flight_number !== origFlight.flight_number && (
                    <span className="mono text-[10px] px-1.5 py-0.5 rounded bg-sky-900/60 text-sky-200 border border-sky-700">
                      Alternate
                    </span>
                  )}
                </div>
                <div className="mono text-xs text-slate-200 flex items-center gap-2">
                  <span>{revisedFlight.origin} {formatTime(revisedFlight.departure)}</span>
                  <span className="text-sky-400">→</span>
                  <span>{revisedFlight.destination} {formatTime(revisedFlight.arrival)}</span>
                </div>
                <div className="mono text-[11px] text-slate-400 flex items-center gap-2">
                  <span>Cabin: {revisedFlight.cabin_class?.toUpperCase()}</span>
                  <span>·</span>
                  <span className="text-signal font-medium">+{delayMinutes}m vs original</span>
                </div>
              </div>

              {/* Revised Hotel */}
              <div className="pt-3 border-t border-sky-900/40 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="mono text-sky-300">Synchronized Hotel</span>
                  <span className="mono text-slate-300 font-medium">
                    ${revisedHotel?.rate_per_night?.toFixed(2)}/nt
                  </span>
                </div>
                <div className="text-sm font-semibold text-white">{revisedHotel?.name}</div>
                <div className="mono text-xs text-sky-200">
                  Adjusted Check-in: {formatTime(revisedHotel?.check_in)} ({formatDate(revisedHotel?.check_in)})
                </div>
              </div>

              {/* Revised Car */}
              <div className="pt-3 border-t border-sky-900/40 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="mono text-sky-300">Synchronized Car Rental</span>
                  <span className="mono text-slate-300 font-medium">
                    {revisedCar?.class?.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm font-semibold text-white">{revisedCar?.vendor} Car Rental</div>
                <div className="mono text-xs text-sky-200">
                  Adjusted Pickup: {formatTime(revisedCar?.pickup)} ({formatDate(revisedCar?.pickup)})
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 mono text-xs text-slate-500">
              No recovery plan formulated yet.
            </div>
          )}
        </div>
      </div>

      {/* Delta Footer Banner */}
      {chosen && (
        <div className="px-5 py-3 bg-wash/90 border-t border-line flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <span className="mono text-slate-400 uppercase text-[10px] tracking-wider block">Additional Cost</span>
              <span className="mono font-semibold text-white">
                {fareDelta > 0 ? `+$${fareDelta.toFixed(2)}` : "$0.00"}
              </span>
            </div>
            <div className="w-px h-6 bg-line" />
            <div>
              <span className="mono text-slate-400 uppercase text-[10px] tracking-wider block">Touchdown Delay</span>
              <span className="mono font-semibold text-signal">+{delayMinutes} minutes</span>
            </div>
            <div className="w-px h-6 bg-line" />
            <div>
              <span className="mono text-slate-400 uppercase text-[10px] tracking-wider block">Revised Touchdown</span>
              <span className="mono font-semibold text-white">{formatTime(revisedFlight?.arrival)}</span>
            </div>
          </div>
          <div className="text-[11px] mono text-slate-400 italic">
            Simulated GDS inventory · All dependencies re-anchored
          </div>
        </div>
      )}
    </div>
  );
}
