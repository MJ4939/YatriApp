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
        <div>
          <span className="mono text-[10px] uppercase tracking-widest text-sky-400 font-semibold">
            Compliance & Transparency
          </span>
          <h2 className="text-base font-bold text-white mt-0.5">
            Audit Trail & Decision Intelligence
          </h2>
        </div>
        <span className="mono text-xs text-slate-400">
          {entries.length} audited event{entries.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="border border-line rounded-xl overflow-hidden bg-panel shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-wash border-b border-line mono uppercase tracking-wider text-slate-400 text-left text-[11px]">
                <th className="px-3.5 py-2.5 font-semibold">Timestamp</th>
                <th className="px-3.5 py-2.5 font-semibold">Flight / Pax</th>
                <th className="px-3.5 py-2.5 font-semibold">Autonomous Decision</th>
                <th className="px-3.5 py-2.5 font-semibold">Approval Status</th>
                <th className="px-3.5 py-2.5 font-semibold">Reasoning Summary</th>
                <th className="px-3.5 py-2.5 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 mono text-xs">
                    No audited recovery actions recorded yet.
                  </td>
                </tr>
              ) : (
                entries.map((e) => {
                  const isExp = expandedId === e.audit_id;
                  const inputEvent = e.input_event || {};
                  const chosenFlight = e.option_chosen?.flight;

                  return (
                    <React.Fragment key={e.audit_id}>
                      <tr className="hover:bg-wash/60 transition-colors">
                        <td className="px-3.5 py-2.5 mono text-slate-400 whitespace-nowrap">
                          {formatTimestamp(e.timestamp)}
                        </td>
                        <td className="px-3.5 py-2.5 mono text-white whitespace-nowrap">
                          <span className="font-semibold">{inputEvent.flight_id || "FL-000"}</span>
                          <span className="text-slate-400 text-[10px] block">{inputEvent.pax_id}</span>
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span
                            className={`mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold border ${
                              e.auto_executed
                                ? "text-go border-go/40 bg-go/10"
                                : "text-signal border-signal/40 bg-signal/10"
                            }`}
                          >
                            {e.auto_executed ? "Auto-Resolved" : "Escalated"}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 mono whitespace-nowrap">
                          <span
                            className={`text-[11px] font-medium capitalize ${
                              e.approval_status === "approved" || e.approval_status === "auto_approved"
                                ? "text-go"
                                : e.approval_status === "declined"
                                ? "text-alert"
                                : "text-slate-400"
                            }`}
                          >
                            {e.approval_status || "Pending"}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-300 max-w-sm truncate text-[11px]">
                          {e.reasoning}
                        </td>
                        <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => toggle(e.audit_id)}
                            className="mono text-[10px] uppercase text-sky-400 hover:text-sky-300 font-semibold"
                          >
                            {isExp ? "▲ Close" : "▼ Audit"}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Audit Log Drawer */}
                      {isExp && (
                        <tr className="bg-wash/90 border-t border-line">
                          <td colSpan={6} className="px-4 py-3 text-xs text-slate-300 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {/* Chosen Plan */}
                              <div className="rounded bg-panel p-2.5 border border-line">
                                <span className="mono text-[10px] uppercase tracking-wider text-sky-400 font-semibold block mb-1">
                                  Selected Recovery Alternative
                                </span>
                                {chosenFlight ? (
                                  <div className="space-y-0.5 text-[11px]">
                                    <div className="font-semibold text-white">
                                      {chosenFlight.carrier} {chosenFlight.flight_number}
                                    </div>
                                    <div className="mono text-slate-300">
                                      Fare Delta: +${e.option_chosen?.fare_delta?.toFixed(2)} · Delay: +{e.option_chosen?.delay_minutes}m
                                    </div>
                                    <div className="mono text-slate-400">
                                      Hotel: {e.option_chosen?.hotel?.name}
                                    </div>
                                    <div className="mono text-slate-400">
                                      Car: {e.option_chosen?.car?.vendor}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-500">None</span>
                                )}
                              </div>

                              {/* Constraints Applied */}
                              <div className="rounded bg-panel p-2.5 border border-line">
                                <span className="mono text-[10px] uppercase tracking-wider text-signal font-semibold block mb-1">
                                  Traveller Constraints Applied
                                </span>
                                <div className="space-y-0.5 text-[11px] mono text-slate-300">
                                  <div>Max Budget: ${e.constraints_applied?.max_additional_cost ?? 150}</div>
                                  <div>
                                    Deadline: {e.constraints_applied?.latest_arrival_time?.slice(11, 16) || "None"}
                                  </div>
                                  <div>Priority: {e.constraints_applied?.priority_preference || "balanced"}</div>
                                  <div>Must Keep Cabin: {e.constraints_applied?.must_keep_cabin ? "Yes" : "No"}</div>
                                </div>
                              </div>

                              {/* Timings */}
                              <div className="rounded bg-panel p-2.5 border border-line">
                                <span className="mono text-[10px] uppercase tracking-wider text-go font-semibold block mb-1">
                                  Latency & Timings
                                </span>
                                <div className="space-y-0.5 text-[11px] mono text-slate-300">
                                  <div>Detection → Action: {e.timings?.detection_to_action_ms ?? 0}ms</div>
                                  <div>Notification Delivery: {e.timings?.notification_delivery_ms ?? 0}ms</div>
                                  <div className="text-[10px] text-slate-500 mt-1">
                                    Audit ID: {e.audit_id}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Full Reasoning Text */}
                            <div className="rounded bg-panel p-2.5 border border-line text-[11px] leading-relaxed">
                              <span className="mono text-[10px] uppercase tracking-wider text-slate-400 font-semibold block mb-0.5">
                                Complete Agent Rationale & Alternatives Summary:
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
