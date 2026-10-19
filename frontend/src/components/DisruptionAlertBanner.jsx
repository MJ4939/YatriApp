import React from "react";

function fmtTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}

function extractCommitmentTime(commitmentStr) {
  if (!commitmentStr) return null;
  // Look for patterns like "19:30" or "7:30 PM"
  const match = commitmentStr.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return match[0];
  }
  return null;
}

function getTimeUntil(targetTimeStr, date) {
  if (!targetTimeStr || !date) return null;
  try {
    // targetTimeStr like "19:30"
    const [h, m] = targetTimeStr.split(":").map(Number);
    const target = new Date(date);
    target.setHours(h, m, 0, 0);
    const diffMs = target - Date.now();
    if (diffMs < 0) return null;
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
  } catch { return null; }
}

export default function DisruptionAlertBanner({ disruption, itinerary, onDismiss }) {
  if (!disruption || !disruption.active) return null;

  const event = disruption.event || {};
  const flight = itinerary?.flight || {};
  const isCancelled = event.status === "cancelled";
  const constraints = disruption.constraints || {};

  const commitmentStr = constraints.required_commitments || "";
  const commitmentTime = extractCommitmentTime(commitmentStr);
  const timeUntil = commitmentTime
    ? getTimeUntil(commitmentTime, flight.departure || new Date().toISOString())
    : null;

  const statusLabel = isCancelled ? "Flight cancelled" : "Flight delayed";
  const dotColor = isCancelled ? "bg-danger" : "bg-warning";

  return (
    <div className="rounded-lg border border-danger/50 bg-panel overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-danger/10 border-b border-danger/30">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${dotColor} animate-pulse shrink-0`} />
          <span className="text-sm font-semibold text-white">{statusLabel}</span>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs text-muted hover:text-white px-2.5 py-1 rounded bg-subtle border border-border transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Flight identity */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {flight.carrier || event.carrier || "—"} {flight.flight_number || "—"}
            </div>
            <div className="text-lg font-semibold text-muted mt-0.5">
              {flight.origin || "—"} → {flight.destination || "—"}
            </div>
          </div>

          <div className="text-right shrink-0">
            {flight.departure && (
              <div className="text-sm text-muted">
                Scheduled departure: <span className="text-white font-medium">{fmtTime(flight.departure)}</span>
              </div>
            )}
            {flight.arrival && (
              <div className="text-sm text-muted">
                Scheduled arrival: <span className="text-white font-medium">{fmtTime(flight.arrival)}</span>
              </div>
            )}
            {timeUntil && commitmentTime && (
              <div className="text-sm text-warning mt-1 font-medium">
                {commitmentTime} commitment in {timeUntil}
              </div>
            )}
          </div>
        </div>

        {/* Reason */}
        {event.reason && (
          <p className="text-sm text-slate-300 leading-relaxed">
            {event.reason}
          </p>
        )}

        {/* Affected bookings */}
        {disruption.affected_bookings?.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted mb-2 uppercase tracking-wider">
              What's affected
            </div>
            <ul className="space-y-1.5">
              {disruption.affected_bookings.map((item, idx) => {
                const icon = item.leg?.toLowerCase() === "hotel" ? "🏨"
                  : item.leg?.toLowerCase() === "car" ? "🚗"
                  : "✈️";
                const severityColor =
                  item.severity === "critical"
                    ? "text-danger"
                    : item.severity === "high" || item.status === "at risk"
                    ? "text-warning"
                    : "text-muted";
                return (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5">{icon}</span>
                    <span className="text-white font-medium">{item.title || item.leg}</span>
                    <span className="text-border">·</span>
                    <span className={severityColor}>{item.status}</span>
                    {item.impact_reason && (
                      <>
                        <span className="text-border">—</span>
                        <span className="text-muted">{item.impact_reason}</span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Traveller */}
        {itinerary?.member_name && (
          <div className="text-xs text-muted pt-1 border-t border-border">
            Traveller: <span className="text-white">{itinerary.member_name}</span>
            {disruption.pax_id && (
              <span className="ml-2 text-muted/60">({disruption.pax_id})</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
