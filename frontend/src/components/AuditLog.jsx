import React, { useState } from "react";

function formatTimestamp(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
  } catch (e) {
    return iso;
  }
}

export default function AuditLog({ entries = [] }) {
  const [expandedId, setExpandedId] = useState(null);

  const toggle = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Decision audit trail</h2>
        <span className="text-xs text-muted">
          {entries.length} record{entries.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-subtle border-b border-border text-muted text-left text-[11px]">
                <th className="px-3.5 py-2.5 font-medium">Time</th>
                <th className="px-3.5 py-2.5 font-medium">Flight / Pax</th>
                <th className="px-3.5 py-2.5 font-medium">Decision</th>
                <th className="px-3.5 py-2.5 font-medium">Status</th>
                <th className="px-3.5 py-2.5 font-medium">Summary</th>
                <th className="px-3.5 py-2.5 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted text-xs">
                    No decisions recorded yet.
                  </td>
                </tr>
              ) : (
                entries.map((e) => {
                  const isExp = expandedId === e.audit_id;
                  const inputEvent = e.input_event || {};
                  const chosenFlight = e.option_chosen?.flight;

                  return (
                    <React.Fragment key={e.audit_id}>
                      <tr className="hover:bg-subtle/60 transition-colors">
                        <td className="px-3.5 py-2.5 mono text-muted whitespace-nowrap">
                          {formatTimestamp(e.timestamp)}
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span className="font-semibold text-white">
                            {inputEvent.flight_id || "FL-000"}
                          </span>
                          <span className="text-muted text-[10px] block">{inputEvent.pax_id}</span>
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                              e.auto_executed
                                ? "text-success border-success/40 bg-success/10"
                                : "text-warning border-warning/40 bg-warning/10"
                            }`}
                          >
                            {e.auto_executed ? "Auto-resolved" : "Escalated"}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span
                            className={`text-[11px] font-medium capitalize ${
                              e.approval_status === "approved" ||
                              e.approval_status === "auto_approved"
                                ? "text-success"
                                : e.approval_status === "declined"
                                ? "text-danger"
                                : "text-muted"
                            }`}
                          >
                            {e.approval_status || "Pending"}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-muted max-w-sm truncate text-[11px]">
                          {e.reasoning}
                        </td>
                        <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => toggle(e.audit_id)}
                            className="text-[10px] text-accent hover:text-blue-300 font-medium"
                          >
                            {isExp ? "▲ Close" : "▼ View"}
                          </button>
                        </td>
                      </tr>

                      {isExp && (
                        <tr className="bg-subtle/80 border-t border-border">
                          <td colSpan={6} className="px-4 py-3 text-xs text-slate-300 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="rounded-lg bg-panel p-3 border border-border">
                                <span className="text-[10px] font-semibold text-accent block mb-2">
                                  Selected alternative
                                </span>
                                {chosenFlight ? (
                                  <div className="space-y-1 text-[11px]">
                                    <div className="font-semibold text-white">
                                      {chosenFlight.carrier} {chosenFlight.flight_number}
                                    </div>
                                    <div className="text-muted">
                                      Extra cost: +${e.option_chosen?.fare_delta?.toFixed(2)} · Delay: +{e.option_chosen?.delay_minutes}m
                                    </div>
                                    <div className="text-muted">
                                      Hotel: {e.option_chosen?.hotel?.name}
                                    </div>
                                    <div className="text-muted">
                                      Car: {e.option_chosen?.car?.vendor}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted">None</span>
                                )}
                              </div>

                              <div className="rounded-lg bg-panel p-3 border border-border">
                                <span className="text-[10px] font-semibold text-warning block mb-2">
                                  Preferences applied
                                </span>
                                <div className="space-y-1 text-[11px] text-muted">
                                  <div>Max extra cost: ${e.constraints_applied?.max_additional_cost ?? 150}</div>
                                  <div>
                                    Arrive by: {e.constraints_applied?.latest_arrival_time?.slice(11, 16) || "—"}
                                  </div>
                                  <div>Priority: {e.constraints_applied?.priority_preference || "balanced"}</div>
                                  <div>Keep cabin: {e.constraints_applied?.must_keep_cabin ? "Yes" : "No"}</div>
                                </div>
                              </div>

                              <div className="rounded-lg bg-panel p-3 border border-border">
                                <span className="text-[10px] font-semibold text-success block mb-2">
                                  Processing times
                                </span>
                                <div className="space-y-1 text-[11px] text-muted">
                                  <div>Detection → action: {e.timings?.detection_to_action_ms ?? 0}ms</div>
                                  <div>Notification: {e.timings?.notification_delivery_ms ?? 0}ms</div>
                                  <div className="text-[10px] text-muted/60 mt-1 break-all">
                                    ID: {e.audit_id}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-lg bg-panel p-3 border border-border text-[11px] leading-relaxed">
                              <span className="text-[10px] font-semibold text-muted block mb-1">
                                Full reasoning
                              </span>
                              {e.reasoning}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
