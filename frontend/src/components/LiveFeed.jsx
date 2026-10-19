import React, { useState } from "react";

const STEPS = [
  "Detected",
  "Impact analysis",
  "Decision reasoning",
  "Ripple effects",
  "Resolved",
  "Notified",
];

function stepIndex(stage) {
  if (stage === "Rebooked" || stage === "Pending your approval") return 4;
  if (stage === "Notified") return 5;
  const idx = STEPS.indexOf(stage);
  return idx >= 0 ? idx : 0;
}

function statusBorderColor(caseItem) {
  if (caseItem.approvalStatus === "approved") return "border-success/40";
  if (caseItem.approvalStatus === "declined") return "border-danger/40";
  if (caseItem.escalated) return "border-warning/40";
  if (caseItem.stage === "Notified") return "border-success/40";
  return "border-border";
}

function Stepper({ caseItem }) {
  const currentIdx = stepIndex(caseItem.stage);
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-1">
              <div
                title={s}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i < currentIdx
                    ? "bg-success"
                    : i === currentIdx
                    ? caseItem.escalated && i === 4
                      ? "bg-warning pulse-dot"
                      : "bg-accent pulse-dot"
                    : "bg-border"
                }`}
              />
              <span className="text-[9px] text-muted leading-none hidden sm:block whitespace-nowrap">
                {s}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-4 h-px mb-3 ${i < currentIdx ? "bg-success/60" : "bg-border"}`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function CaseRow({ caseItem, onApprove, onDecline }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`board-row rounded-lg border bg-panel p-4 transition-all ${statusBorderColor(caseItem)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">
              {caseItem.flight_id || "Flight"}
            </span>
            <span className="mono text-[10px] px-1.5 py-0.5 rounded bg-subtle border border-border text-muted">
              {caseItem.pax_id}
            </span>
            <span
              className={`mono text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${
                caseItem.status === "cancelled"
                  ? "bg-danger/20 text-danger border border-danger/30"
                  : "bg-warning/20 text-warning border border-warning/30"
              }`}
            >
              {caseItem.status}
            </span>
          </div>

          <div className="text-xs font-medium mt-1.5 flex items-center gap-2">
            <span className="text-white">{caseItem.stage}</span>
            {caseItem.approvalStatus && (
              <span className="text-muted">· {caseItem.approvalStatus}</span>
            )}
          </div>

          <Stepper caseItem={caseItem} />
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-muted hover:text-white px-2.5 py-1 rounded bg-subtle border border-border shrink-0 transition-colors"
        >
          {open ? "Hide" : "Details"}
        </button>
      </div>

      {open && (
        <div className="mt-4 pt-4 border-t border-border space-y-3 text-sm text-slate-300">
          {caseItem.reasoning && (
            <div className="p-3 rounded-lg bg-subtle border border-border leading-relaxed">
              <span className="text-xs font-semibold text-muted block mb-1">
                Agent reasoning
              </span>
              {caseItem.reasoning}
            </div>
          )}

          {caseItem.rippleEffects?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted mb-2">
                Booking adjustments ({caseItem.rippleEffects.length})
              </div>
              <ul className="space-y-1">
                {caseItem.rippleEffects.map((r, i) => (
                  <li key={i} className="text-xs text-slate-300 bg-subtle/60 p-2 rounded border border-border/60">
                    <span className="text-accent font-medium capitalize">
                      {r.leg} {r.field}:
                    </span>{" "}
                    {r.from} → {r.to}
                    {r.reason && (
                      <div className="text-muted mt-0.5">{r.reason}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {caseItem.message && (
            <div className="text-xs text-slate-300 bg-subtle rounded p-3 border border-border">
              <span className="font-semibold text-success block mb-1">
                Traveller notification sent
              </span>
              {caseItem.message}
            </div>
          )}

          {caseItem.stage === "Pending your approval" &&
            caseItem.approvalStatus === "pending" && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => onApprove && onApprove(caseItem.auditId)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-success text-slate-950 font-semibold hover:opacity-90 transition-opacity"
                >
                  Approve recovery plan
                </button>
                <button
                  onClick={() => onDecline && onDecline(caseItem.auditId)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-danger/20 text-danger border border-danger/40 hover:bg-danger/30 font-semibold transition-colors"
                >
                  Decline
                </button>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

export default function LiveFeed({ cases = [], onApprove, onDecline }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Event pipeline</h2>
        <span className="text-xs text-muted">{cases.length} event{cases.length === 1 ? "" : "s"}</span>
      </div>

      <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
        {cases.length === 0 ? (
          <div className="text-sm text-muted border border-dashed border-border rounded-lg p-8 text-center bg-panel/40">
            <div className="text-2xl mb-2">📡</div>
            No disruptions in the pipeline yet.
            <div className="text-xs text-muted/60 mt-1">
              Trigger a scenario below to see events here.
            </div>
          </div>
        ) : (
          cases.map((c) => (
            <CaseRow
              key={c.eventId}
              caseItem={c}
              onApprove={onApprove}
              onDecline={onDecline}
            />
          ))
        )}
      </div>
    </div>
  );
}
