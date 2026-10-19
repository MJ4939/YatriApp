import React, { useState } from "react";

export default function RecoveryActionHub({
  disruption,
  onApprove,
  onDecline,
}) {
  const [busy, setBusy] = useState(false);

  if (!disruption || !disruption.active) {
    return null;
  }

  const approvalStatus = disruption.approval_status || "pending";
  const auditId = disruption.audit_id;
  const autoExecuted = disruption.auto_executed;
  const hasFeasible = disruption.has_feasible_solution ?? true;
  const reasoning = disruption.reasoning || "";
  const rippleEffects = disruption.ripple_effects || [];

  const handleAction = async (actionFn) => {
    if (!auditId) return;
    setBusy(true);
    try {
      await actionFn(auditId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-panel p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-line mb-4">
        <div>
          <span className="mono text-[10px] uppercase tracking-widest text-sky-400 font-semibold">
            Agent Decision Intelligence
          </span>
          <h3 className="text-base font-bold text-white mt-0.5">
            Recovery Recommendation & Approval Hub
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {autoExecuted ? (
            <span className="mono text-xs px-2.5 py-1 rounded bg-go/20 text-go border border-go/40 font-medium">
              ✓ Auto-Resolved within Policy
            </span>
          ) : approvalStatus === "approved" ? (
            <span className="mono text-xs px-2.5 py-1 rounded bg-go/20 text-go border border-go/40 font-medium">
              ✓ Plan Approved by Traveller
            </span>
          ) : approvalStatus === "declined" ? (
            <span className="mono text-xs px-2.5 py-1 rounded bg-alert/20 text-alert border border-alert/40 font-medium">
              ✕ Plan Declined by Traveller
            </span>
          ) : (
            <span className="mono text-xs px-2.5 py-1 rounded bg-signal/20 text-signal border border-signal/40 font-medium animate-pulse">
              ● Awaiting Traveller Approval
            </span>
          )}
        </div>
      </div>

      {/* Decision Reasoning */}
      <div className="rounded-lg bg-wash p-4 border border-line">
        <div className="mono text-[11px] uppercase tracking-wider text-slate-400 mb-1 font-semibold flex items-center justify-between">
          <span>Yatri AI Agent Reasoning</span>
          <span className="text-[10px] text-slate-500 normal-case font-normal">
            Deterministic Evaluation + Multi-Objective Policy
          </span>
        </div>
        <p className="text-sm text-slate-200 leading-relaxed font-normal">
          {reasoning || "Analyzing alternatives and matching constraints..."}
        </p>

        {/* Ripple Effects Breakdown */}
        {rippleEffects.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line/60">
            <span className="mono text-[10px] uppercase tracking-wider text-sky-400 block mb-1.5 font-semibold">
              Dependent Booking Ripple Adjustments:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rippleEffects.map((r, i) => (
                <div
                  key={i}
                  className="rounded bg-panel/80 p-2 border border-line text-xs text-slate-300"
                >
                  <div className="mono text-[10px] font-semibold text-sky-300 capitalize">
                    {r.leg} {r.field}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{r.reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Approval Action Bar */}
      <div className="mt-4 pt-4 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-signal inline-block" />
          <span>
            <strong className="text-slate-300">Honest Sandbox Notice:</strong> Approval triggers
            simulated inventory ticket issuance. No live airline GDS or card charge occurs.
          </span>
        </div>

        {!autoExecuted && approvalStatus === "pending" && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => handleAction(onApprove)}
              disabled={busy}
              className="mono text-xs uppercase tracking-wider font-bold px-5 py-2.5 rounded-lg bg-go text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-all shadow-md shadow-go/20"
            >
              {busy ? "Processing..." : "Approve Recovery Plan"}
            </button>
            <button
              onClick={() => handleAction(onDecline)}
              disabled={busy}
              className="mono text-xs uppercase tracking-wider font-semibold px-4 py-2.5 rounded-lg bg-alert/20 text-alert border border-alert/40 hover:bg-alert/30 disabled:opacity-50 transition-colors"
            >
              Decline Plan
            </button>
          </div>
        )}

        {approvalStatus === "approved" && (
          <div className="mono text-xs text-go font-semibold flex items-center gap-2">
            <span>✓ Simulated Rebooking Confirmed (PNR: YATRI-{auditId?.slice(0, 6).toUpperCase()})</span>
          </div>
        )}

        {approvalStatus === "declined" && (
          <div className="mono text-xs text-alert font-semibold flex items-center gap-2">
            <span>✕ Traveller declined simulated alternative</span>
          </div>
        )}
      </div>
    </div>
  );
}
