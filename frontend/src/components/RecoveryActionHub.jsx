import React, { useState } from "react";

function fmtTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}

function generateRef(auditId) {
  if (!auditId) return "YATRI-XXXXXX";
  return "YATRI-" + auditId.slice(0, 6).toUpperCase();
}

export default function RecoveryActionHub({ disruption, onApprove, onDecline }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!disruption || !disruption.active) return null;

  const approvalStatus = disruption.approval_status || "pending";
  const auditId = disruption.audit_id;
  const autoExecuted = disruption.auto_executed;
  const reasoning = disruption.reasoning || "";
  const rippleEffects = disruption.ripple_effects || [];

  const handleApprove = async () => {
    if (!auditId) return;
    setBusy(true);
    try {
      await onApprove(auditId);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const handleDecline = async () => {
    if (!auditId) return;
    setBusy(true);
    try {
      await onDecline(auditId);
    } finally {
      setBusy(false);
    }
  };

  // Section title based on state
  let sectionTitle = "Your action is needed";
  if (autoExecuted) sectionTitle = "Auto-resolved";
  else if (approvalStatus === "approved") sectionTitle = "Recovery approved";
  else if (approvalStatus === "declined") sectionTitle = "Recovery declined";

  return (
    <div className="rounded-lg border border-border bg-panel p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-white">{sectionTitle}</h2>
          {!autoExecuted && approvalStatus === "pending" && (
            <p className="text-sm text-muted mt-0.5">
              Review the plan below, then approve or decline.
            </p>
          )}
        </div>

        <div>
          {autoExecuted ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-success/15 border border-success/40 text-success font-medium">
              Auto-resolved within policy limits
            </span>
          ) : approvalStatus === "approved" ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-success/15 border border-success/40 text-success font-medium">
              ✓ Approved
            </span>
          ) : approvalStatus === "declined" ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-danger/15 border border-danger/40 text-danger font-medium">
              ✕ Declined
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full bg-warning/15 border border-warning/40 text-warning font-medium animate-pulse">
              Awaiting your approval
            </span>
          )}
        </div>
      </div>

      {/* AI Reasoning */}
      {reasoning && (
        <div className="rounded-lg bg-subtle border border-border p-4">
          <div className="text-xs font-semibold text-muted mb-2">
            Why this option was selected
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">
            {reasoning}
          </p>
        </div>
      )}

      {/* Ripple effects */}
      {rippleEffects.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted mb-2">
            Booking adjustments
          </div>
          <ul className="space-y-2">
            {rippleEffects.map((r, i) => {
              const fromLabel = r.from || "—";
              const toLabel = r.to || "—";
              const fieldLabel = r.field
                ? r.field.replace(/_/g, " ")
                : "updated";
              const legLabel = r.leg
                ? r.leg.charAt(0).toUpperCase() + r.leg.slice(1)
                : "";

              return (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="mt-0.5 text-base">
                    {r.leg?.toLowerCase() === "hotel" ? "🏨" : r.leg?.toLowerCase() === "car" ? "🚗" : "✈️"}
                  </span>
                  <span>
                    <span className="text-white font-medium">{legLabel} {fieldLabel}</span>{" "}
                    moved from{" "}
                    <span className="text-muted line-through">{fromLabel}</span>{" "}
                    to{" "}
                    <span className="text-white">{toLabel}</span>
                    {r.reason && (
                      <span className="text-muted"> — {r.reason}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Action bar */}
      <div className="border-t border-border pt-4 space-y-3">
        {/* Pending: show confirm flow */}
        {!autoExecuted && approvalStatus === "pending" && (
          <div className="space-y-3">
            {!confirming ? (
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setConfirming(true)}
                  disabled={busy}
                  className="px-5 py-2.5 rounded-lg bg-success text-slate-950 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  Approve recovery plan
                </button>
                <button
                  onClick={handleDecline}
                  disabled={busy}
                  className="px-4 py-2.5 rounded-lg bg-danger/20 text-danger border border-danger/40 text-sm font-semibold hover:bg-danger/30 disabled:opacity-50 transition-colors"
                >
                  Decline
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-success/40 bg-success/10 p-4 space-y-3">
                <p className="text-sm text-white font-medium">
                  Confirm approval of this recovery plan?
                </p>
                <p className="text-xs text-muted">
                  This will simulate ticket issuance. No real booking will be made.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleApprove}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg bg-success text-slate-950 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {busy ? "Processing…" : "Yes, approve"}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg bg-subtle border border-border text-sm text-muted hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Approved */}
        {approvalStatus === "approved" && (
          <div className="flex items-center gap-2 text-sm text-success font-medium">
            <span>✓</span>
            <span>
              Recovery plan approved (simulation) — Reference: {generateRef(auditId)}
            </span>
          </div>
        )}

        {/* Declined */}
        {approvalStatus === "declined" && (
          <div className="flex items-center gap-2 text-sm text-danger font-medium">
            <span>✕</span>
            <span>Recovery plan declined. No changes have been made.</span>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-muted/70">
          This is a simulation. No real flight, hotel, or car booking has been made.
        </p>
      </div>
    </div>
  );
}
