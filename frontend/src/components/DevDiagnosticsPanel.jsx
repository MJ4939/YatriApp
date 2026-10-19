import React, { useState } from "react";
import InjectorControls from "./InjectorControls.jsx";
import StatsPanel from "./StatsPanel.jsx";
import LiveFeed from "./LiveFeed.jsx";
import AuditLog from "./AuditLog.jsx";

export default function DevDiagnosticsPanel({
  itineraries,
  selectedPaxId,
  onSelectPax,
  onSimulate,
  onInjectStorm,
  onDemoScenario,
  onDemoReset,
  metrics,
  cases,
  onApprove,
  onDecline,
  auditEntries,
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-panel text-sm text-muted hover:text-white hover:bg-subtle transition-colors"
      >
        <span className="font-medium">Developer diagnostics</span>
        <span className="text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="p-4 space-y-6 bg-surface border-t border-border">
          <InjectorControls
            itineraries={itineraries}
            selectedPaxId={selectedPaxId}
            onSelectPax={onSelectPax}
            onSimulate={onSimulate}
            onInjectStorm={onInjectStorm}
            onDemoScenario={onDemoScenario}
            onDemoReset={onDemoReset}
          />

          <StatsPanel metrics={metrics} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LiveFeed cases={cases} onApprove={onApprove} onDecline={onDecline} />
            <AuditLog entries={auditEntries} />
          </div>
        </div>
      )}
    </div>
  );
}
