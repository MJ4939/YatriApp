import React from "react";

function formatDateTime(iso) {
  if (!iso) return "";
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

export default function DisruptionAlertBanner({ disruption, itinerary, onDismiss }) {
  if (!disruption || !disruption.active) return null;

  const event = disruption.event || {};
  const flight = itinerary?.flight || {};
  const isCancelled = event.status === "cancelled";
  const severity = isCancelled ? "CRITICAL" : "MAJOR";

  return (
    <div className="rounded-xl border border-alert/40 bg-gradient-to-r from-alert/15 via-panel to-panel p-5 shadow-lg shadow-alert/5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-alert/20 border border-alert/40 flex items-center justify-center shrink-0 text-alert text-lg font-bold">
            !
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="mono text-xs font-semibold px-2 py-0.5 rounded bg-alert text-white">
                {severity} DISRUPTION DETECTED
              </span>
              <span className="mono text-xs text-slate-400">
                {formatDateTime(disruption.timestamp ? new Date(disruption.timestamp * 1000).toISOString() : new Date().toISOString())}
              </span>
              <span className="mono text-xs px-2 py-0.5 rounded bg-wash border border-line text-slate-300">
                {itinerary?.member_name} ({disruption.pax_id})
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              {flight.carrier} Flight {flight.flight_number} {event.status?.toUpperCase() || "DISRUPTED"}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {event.reason || "Carrier notification: Aircraft mechanical issue. Inbound aircraft grounded."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] mono uppercase tracking-wider text-slate-400">Affected Route</div>
            <div className="text-sm font-semibold text-white mono">{flight.origin} → {flight.destination}</div>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-slate-400 hover:text-white px-2.5 py-1 rounded bg-wash border border-line text-xs mono"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Affected Bookings Breakdown */}
      {disruption.affected_bookings && disruption.affected_bookings.length > 0 && (
        <div className="mt-4">
          <div className="mono text-[11px] uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span>Affected Journey Components ({disruption.affected_bookings.length})</span>
            <span className="text-slate-500 normal-case">Multi-modal impact cascade</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {disruption.affected_bookings.map((item, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-line bg-wash/80 p-3 hover:border-lineLight transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="mono text-[10px] uppercase tracking-wider font-semibold text-sky-400">
                    {item.leg}
                  </span>
                  <span
                    className={`mono text-[10px] px-1.5 py-0.5 rounded ${
                      item.severity === "critical"
                        ? "bg-alert/20 text-alert border border-alert/30"
                        : "bg-signal/20 text-signal border border-signal/30"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-200 truncate">{item.title}</div>
                <div className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {item.impact_reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
