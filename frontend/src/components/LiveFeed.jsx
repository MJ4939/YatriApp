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

function statusColor(caseItem) {
  if (caseItem.approvalStatus === "approved") return "border-go/40 text-go";
  if (caseItem.approvalStatus === "declined") return "border-alert/40 text-alert";
  if (caseItem.escalated) return "border-signal/40 text-signal";
  if (caseItem.stage === "Notified") return "border-go/40 text-go";
  return "border-line text-slate-300";
}

function Stepper({ caseItem }) {
  const currentIdx = stepIndex(caseItem.stage);
  return (
    <div className="flex items-center gap-1.5 mt-2.5">
      {STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <div
            title={s}
            className={`w-2 h-2 rounded-full transition-all ${
              i < currentIdx
                ? "bg-go"
                : i === currentIdx
                ? caseItem.escalated && i === 4
                  ? "bg-signal pulse-dot"
                  : "bg-sky-400 pulse-dot"
                : "bg-line"
            }`}
          />
          {i < STEPS.length - 1 && (
            <div
              className={`w-3.5 h-px ${
                i < currentIdx ? "bg-go/60" : "bg-line"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function CaseRow({ caseItem, onApprove, onDecline }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`board-row rounded-xl border bg-panel p-4 transition-all shadow-sm ${statusColor(
        caseItem
      )}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="mono text-xs font-bold text-white">
              {caseItem.flight_id || "Flight"}
            </span>
            <span className="mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-wash border border-line text-slate-400">
              {caseItem.pax_id}
            </span>
            <span
              className={`mono text-[10px] uppercase px-1.5 py-0.5 rounded font-semibold ${
                caseItem.status === "cancelled"
                  ? "bg-alert/20 text-alert border border-alert/30"
                  : "bg-signal/20 text-signal border border-signal/30"
              }`}
            >
              {caseItem.status}
            </span>
          </div>

          <div className="mono text-xs font-semibold mt-1.5 flex items-center gap-2">
            <span className="text-white">{caseItem.stage}</span>
            {caseItem.approvalStatus && (
              <span className="text-[11px] font-normal text-slate-400">
                · {caseItem.approvalStatus}
              </span>
            )}
          </div>

          <Stepper caseItem={caseItem} />
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className="mono text-[10px] uppercase tracking-wider text-slate-400 hover:text-white px-2 py-1 rounded bg-wash border border-line shrink-0"
        >
          {open ? "Hide Details" : "Inspect →"}
        </button>
      </div>

      {open && (
        <div className="mt-3.5 pt-3.5 border-t border-line space-y-2.5 text-xs text-slate-300">
          {caseItem.reasoning && (
            <div className="p-2.5 rounded bg-wash border border-line leading-relaxed">
              <span className="mono text-[9px] uppercase tracking-wider text-sky-400 block mb-1 font-semibold">
                Agent Reasoning:
              </span>
              {caseItem.reasoning}
            </div>
          )}

          {caseItem.rippleEffects?.length > 0 && (
            <div>
              <div className="mono text-[10px] uppercase tracking-wider text-slate-400 mb-1 font-semibold">
                Ripple Adjustments ({caseItem.rippleEffects.length})
              </div>
              <ul className="space-y-1">
                {caseItem.rippleEffects.map((r, i) => (
                  <li key={i} className="text-[11px] text-slate-300 bg-wash/60 p-1.5 rounded border border-line/60">
                    <span className="text-sky-300 mono font-semibold">{r.leg}.{r.field}</span>:{" "}
                    {r.from} → {r.to}
                    <div className="text-[10px] text-slate-500 mt-0.5">{r.reason}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {caseItem.message && (
            <div className="text-[11px] text-slate-300 bg-wash rounded p-2.5 border border-line">
              <span className="mono text-[9px] uppercase tracking-wider text-go block mb-1 font-semibold">
                Traveller Alert Sent:
              </span>
              {caseItem.message}
            </div>
          )}

          {caseItem.stage === "Pending your approval" &&
            caseItem.approvalStatus === "pending" && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => onApprove && onApprove(caseItem.auditId)}
                  className="mono text-xs uppercase tracking-wider px-3 py-1.5 rounded bg-go text-slate-950 font-bold hover:bg-emerald-400"
                >
                  Approve Recovery Plan
                </button>
                <button
                  onClick={() => onDecline && onDecline(caseItem.auditId)}
                  className="mono text-xs uppercase tracking-wider px-3 py-1.5 rounded bg-alert/20 text-alert border border-alert/40 hover:bg-alert/30 font-semibold"
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
        <div>
          <span className="mono text-[10px] uppercase tracking-widest text-sky-400 font-semibold">
            Real-time Pipeline
          </span>
          <h2 className="text-base font-bold text-white mt-0.5">
            Autonomous Recovery Feed
          </h2>
        </div>
        <span className="mono text-[10px] text-slate-500 hidden sm:inline">
          Ingest → Impact → Rank → Ripple → Resolve → Notify
        </span>
      </div>

      <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
        {cases.length === 0 ? (
          <div className="mono text-xs text-slate-500 border border-dashed border-line rounded-xl p-8 text-center bg-panel/40">
            <div className="text-xl mb-1">📡</div>
            No disruptions currently active in the pipeline.
            <div className="text-[11px] text-slate-600 mt-1">
              Trigger a simulation above or click "Run PS 4.1 Demo Scenario".
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
