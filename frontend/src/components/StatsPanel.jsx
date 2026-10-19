import React from "react";

function Stat({ label, value, accent, subtext }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4 shadow-sm hover:border-lineLight transition-colors">
      <div className="mono text-[10px] uppercase tracking-wider text-slate-400 font-semibold truncate">
        {label}
      </div>
      <div className={`mono text-2xl font-bold mt-1.5 ${accent || "text-white"}`}>
        {value}
      </div>
      {subtext && (
        <div className="text-[10px] mono text-slate-500 mt-0.5 truncate">
          {subtext}
        </div>
      )}
    </div>
  );
}

export default function StatsPanel({ metrics }) {
  if (!metrics) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="mono text-[10px] uppercase tracking-widest text-sky-400 font-semibold">
            Operational Telemetry
          </span>
          <h2 className="text-base font-bold text-white mt-0.5">
            Real-Time Engine Metrics
          </h2>
        </div>
        <span className="mono text-xs text-slate-400 hidden sm:inline">
          Continuous Live Latency & Compliance Tracking
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat
          label="Disruptions Ingested"
          value={metrics.disruptions_received}
          subtext="Total webhooks processed"
        />
        <Stat
          label="Auto-Resolved %"
          value={`${metrics.resolved_without_escalation_pct}%`}
          accent="text-go"
          subtext="Within policy guardrails"
        />
        <Stat
          label="Escalated for Approval"
          value={metrics.escalated_count}
          accent="text-signal"
          subtext="Traveller authorization"
        />
        <Stat
          label="Detect → Action Latency"
          value={`${metrics.avg_detection_to_action_ms}ms`}
          accent="text-sky-400"
          subtext={`p95: ${metrics.p95_detection_to_action_ms || 0}ms`}
        />
        <Stat
          label="Notification Latency"
          value={`${metrics.avg_notification_delivery_ms}ms`}
          accent="text-slate-200"
          subtext="Member dispatch time"
        />
      </div>
    </div>
  );
}
