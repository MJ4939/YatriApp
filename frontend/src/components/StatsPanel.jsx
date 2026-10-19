import React from "react";

function Stat({ label, value, accent, subtext }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="text-xs text-muted font-medium truncate">{label}</div>
      <div className={`text-2xl font-bold mt-1.5 mono ${accent || "text-white"}`}>
        {value}
      </div>
      {subtext && (
        <div className="text-xs text-muted mt-0.5 truncate">{subtext}</div>
      )}
    </div>
  );
}

export default function StatsPanel({ metrics }) {
  if (!metrics) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Processing diagnostics</h2>
        <span className="text-xs text-muted">Live counters from this session</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat
          label="Disruptions received"
          value={metrics.disruptions_received ?? 0}
          subtext="Total events processed"
        />
        <Stat
          label="Auto-resolved"
          value={`${metrics.resolved_without_escalation_pct ?? 0}%`}
          accent="text-success"
          subtext="Within policy limits"
        />
        <Stat
          label="Escalated"
          value={metrics.escalated_count ?? 0}
          accent="text-warning"
          subtext="Required traveller approval"
        />
        <Stat
          label="Avg detect → action"
          value={`${metrics.avg_detection_to_action_ms ?? 0}ms`}
          accent="text-accent"
          subtext={`p95: ${metrics.p95_detection_to_action_ms ?? 0}ms`}
        />
        <Stat
          label="Avg notification"
          value={`${metrics.avg_notification_delivery_ms ?? 0}ms`}
          accent="text-slate-200"
          subtext="Dispatch latency"
        />
      </div>
    </div>
  );
}
