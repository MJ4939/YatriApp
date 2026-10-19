import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
import ItineraryBoard from "./components/ItineraryBoard.jsx";
import DisruptionAlertBanner from "./components/DisruptionAlertBanner.jsx";
import ItineraryComparison from "./components/ItineraryComparison.jsx";
import AlternativeOptionsGrid from "./components/AlternativeOptionsGrid.jsx";
import RecoveryActionHub from "./components/RecoveryActionHub.jsx";
import ConstraintEditor from "./components/ConstraintEditor.jsx";
import DevDiagnosticsPanel from "./components/DevDiagnosticsPanel.jsx";

const POLL_MS = 1200;

function reduceFeedToCases(feedEvents) {
  const byId = new Map();
  for (const ev of feedEvents) {
    if (!ev.event_id) continue;
    const existing = byId.get(ev.event_id) || {
      eventId: ev.event_id,
      flight_id: ev.flight_id,
      pax_id: ev.pax_id,
      status: ev.status,
      stage: ev.stage,
      escalated: false,
      approvalStatus: null,
      rippleEffects: [],
      reasoning: null,
      message: null,
      auditId: null,
    };
    existing.stage = ev.stage;
    if (ev.flight_id) existing.flight_id = ev.flight_id;
    if (ev.pax_id) existing.pax_id = ev.pax_id;
    if (ev.status) existing.status = ev.status;
    if (ev.ripple_effects) existing.rippleEffects = ev.ripple_effects;
    if (ev.reasoning) existing.reasoning = ev.reasoning;
    if (ev.escalated !== undefined) existing.escalated = ev.escalated;
    if (ev.message) existing.message = ev.message;
    if (ev.audit_id) existing.auditId = ev.audit_id;
    if (ev.stage === "Pending your approval" && !existing.approvalStatus) {
      existing.approvalStatus = "pending";
    }
    byId.set(ev.event_id, existing);
  }
  return Array.from(byId.values()).reverse();
}

export default function App() {
  const [itineraries, setItineraries] = useState([]);
  const [selectedPaxId, setSelectedPaxId] = useState("PAX-1001");
  const [activeDisruptions, setActiveDisruptions] = useState({});
  const [constraintsMap, setConstraintsMap] = useState({});
  const [feedEvents, setFeedEvents] = useState([]);
  const [auditEntries, setAuditEntries] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [backendOnline, setBackendOnline] = useState(true);
  const [customChosenOption, setCustomChosenOption] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);
  const sinceRef = useRef(0);

  // Initial load
  useEffect(() => {
    api
      .itineraries()
      .then((data) => {
        setItineraries(data);
        if (data.length > 0 && !selectedPaxId) {
          setSelectedPaxId(data[0].pax_id);
        }
      })
      .catch(() => setBackendOnline(false));
  }, []);

  // Fetch constraints for active traveller
  useEffect(() => {
    if (!selectedPaxId) return;
    api
      .getConstraints(selectedPaxId)
      .then((c) => {
        setConstraintsMap((prev) => ({ ...prev, [selectedPaxId]: c }));
      })
      .catch(() => {});

    api
      .activeDisruption(selectedPaxId)
      .then((d) => {
        if (d && d.event) {
          setActiveDisruptions((prev) => ({ ...prev, [selectedPaxId]: { ...d, active: true } }));
        }
      })
      .catch(() => {});
  }, [selectedPaxId]);

  // Polling loop
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const [feedRes, audit, m] = await Promise.all([
          api.feed(sinceRef.current),
          api.auditLog(),
          api.metrics(),
        ]);
        if (cancelled) return;
        setBackendOnline(true);
        if (feedRes.events.length) {
          setFeedEvents((prev) => [...prev, ...feedRes.events]);
        }
        sinceRef.current = feedRes.next_since;
        setAuditEntries(audit);
        setMetrics(m);

        // Keep active disruption status in sync if approved in audit log
        if (selectedPaxId) {
          const matchingAudit = audit.find(
            (a) => a.input_event?.pax_id === selectedPaxId
          );
          if (matchingAudit && matchingAudit.approval_status) {
            setActiveDisruptions((prev) => {
              const current = prev[selectedPaxId];
              if (current && current.approval_status !== matchingAudit.approval_status) {
                return {
                  ...prev,
                  [selectedPaxId]: {
                    ...current,
                    approval_status: matchingAudit.approval_status,
                  },
                };
              }
              return prev;
            });
          }
        }
      } catch (e) {
        setBackendOnline(false);
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selectedPaxId]);

  const currentItinerary = itineraries.find((it) => it.pax_id === selectedPaxId) || itineraries[0];
  const currentDisruption = activeDisruptions[selectedPaxId];
  const currentConstraints = constraintsMap[selectedPaxId];

  const activeChosen = customChosenOption || currentDisruption?.chosen;

  const showToast = (msg) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleApprove = async (auditId) => {
    await api.approve(auditId);
    showToast("✓ Recovery plan approved! Simulated ticket confirmed.");
    if (selectedPaxId && activeDisruptions[selectedPaxId]) {
      setActiveDisruptions((prev) => ({
        ...prev,
        [selectedPaxId]: {
          ...prev[selectedPaxId],
          approval_status: "approved",
        },
      }));
    }
  };

  const handleDecline = async (auditId) => {
    await api.decline(auditId);
    showToast("✕ Recovery plan declined by traveller.");
    if (selectedPaxId && activeDisruptions[selectedPaxId]) {
      setActiveDisruptions((prev) => ({
        ...prev,
        [selectedPaxId]: {
          ...prev[selectedPaxId],
          approval_status: "declined",
        },
      }));
    }
  };

  const handleSimulateDisruption = async (payload) => {
    const res = await api.simulate({
      ...payload,
      constraints: currentConstraints,
    });
    setCustomChosenOption(null);
    setActiveDisruptions((prev) => ({
      ...prev,
      [payload.pax_id]: { ...res, active: true },
    }));
    showToast(`Disruption simulation triggered for ${payload.pax_id}!`);
  };

  const handleSaveConstraints = async (newConstraints) => {
    await api.updateConstraints(selectedPaxId, newConstraints);
    setConstraintsMap((prev) => ({ ...prev, [selectedPaxId]: newConstraints }));
    showToast("Preferences updated.");
  };

  const handleEvaluateRecovery = async (newConstraints) => {
    const currentStatus = currentDisruption?.status || "cancelled";
    const res = await api.simulate({
      pax_id: selectedPaxId,
      status: currentStatus,
      reason: "Traveller updated preferences; re-evaluating recovery options",
      constraints: newConstraints,
    });
    setCustomChosenOption(null);
    setActiveDisruptions((prev) => ({
      ...prev,
      [selectedPaxId]: { ...res, active: true },
    }));
    showToast("Recovery options re-evaluated under updated preferences.");
  };

  const handleDemoScenario = async () => {
    setSelectedPaxId("PAX-1001");
    const res = await api.demoScenario();
    setCustomChosenOption(null);
    setActiveDisruptions((prev) => ({
      ...prev,
      ["PAX-1001"]: { ...res, active: true },
    }));
    showToast("Demo scenario triggered for Jordan Lee.");
  };

  const handleDemoReset = async () => {
    await api.demoReset();
    sinceRef.current = 0;
    setFeedEvents([]);
    setAuditEntries([]);
    setActiveDisruptions({});
    setCustomChosenOption(null);
    const itins = await api.itineraries();
    setItineraries(itins);
    showToast("State reset to baseline.");
  };

  const cases = reduceFeedToCases(feedEvents);
  const hasDisruption = currentDisruption?.active;

  return (
    <div className="min-h-screen bg-surface text-white">
      {/* ── Header ── */}
      <header className="border-b border-border bg-panel sticky top-0 z-40 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center font-bold text-white text-sm shrink-0">
              Y
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white">Yatri AI</h1>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-subtle border border-border text-muted font-medium">
                  Simulation mode
                </span>
              </div>
              <p className="text-xs text-muted">Intelligent travel disruption recovery</p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Backend status */}
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-subtle border border-border text-muted">
              <span
                className={`w-1.5 h-1.5 rounded-full ${backendOnline ? "bg-success animate-pulse" : "bg-danger"}`}
              />
              <span>{backendOnline ? "Connected" : "Offline"}</span>
            </div>

            {/* Traveller switcher */}
            {itineraries.length > 0 && (
              <select
                value={selectedPaxId}
                onChange={(e) => setSelectedPaxId(e.target.value)}
                className="text-xs bg-subtle border border-border rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-accent"
              >
                {itineraries.map((it) => (
                  <option key={it.pax_id} value={it.pax_id}>
                    {it.member_name} ({it.pax_id})
                  </option>
                ))}
              </select>
            )}

            {/* Run Demo */}
            <button
              onClick={handleDemoScenario}
              className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-accent text-white hover:bg-blue-500 transition-colors"
            >
              Run demo
            </button>

            {/* Reset */}
            <button
              onClick={handleDemoReset}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-subtle border border-border text-muted hover:text-white transition-colors"
              title="Reset to baseline"
            >
              ↺ Reset
            </button>
          </div>
        </div>
      </header>

      {/* ── Toast ── */}
      {actionNotice && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-panel border border-accent/60 text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2 board-row">
          <span className="text-accent">●</span>
          <span>{actionNotice}</span>
        </div>
      )}

      {/* ── Main ── */}
      <main className="px-4 sm:px-6 py-6 max-w-7xl mx-auto space-y-6">

        {/* ── DISRUPTION ACTIVE FLOW ── */}
        {hasDisruption ? (
          <>
            {/* 1. Disruption summary — first thing user sees */}
            <DisruptionAlertBanner
              disruption={currentDisruption}
              itinerary={currentItinerary}
              onDismiss={() => {
                setActiveDisruptions((prev) => ({
                  ...prev,
                  [selectedPaxId]: { ...prev[selectedPaxId], active: false },
                }));
              }}
            />

            {/* 2. Recovery options — visual center */}
            {currentDisruption.options_considered?.length > 0 && (
              <AlternativeOptionsGrid
                options={currentDisruption.options_considered}
                selectedFlightId={activeChosen?.flight?.flight_id}
                onSelectOption={(opt) => setCustomChosenOption(opt)}
              />
            )}

            {/* 3. Preferences (collapsed by default, below options) */}
            <ConstraintEditor
              paxId={selectedPaxId}
              constraints={currentConstraints}
              onSave={handleSaveConstraints}
              onEvaluate={handleEvaluateRecovery}
            />

            {/* 4. Recovery action hub */}
            <RecoveryActionHub
              disruption={currentDisruption}
              onApprove={handleApprove}
              onDecline={handleDecline}
            />

            {/* 5. Itinerary comparison */}
            <ItineraryComparison
              original={currentItinerary}
              chosen={activeChosen}
              hasFeasibleSolution={currentDisruption.has_feasible_solution}
            />
          </>
        ) : (
          <>
            {/* ── NO DISRUPTION: normal state ── */}
            <ItineraryBoard
              itineraries={itineraries}
              selectedPaxId={selectedPaxId}
              onSelectPax={setSelectedPaxId}
              activeDisruptions={activeDisruptions}
            />

            <ConstraintEditor
              paxId={selectedPaxId}
              constraints={currentConstraints}
              onSave={handleSaveConstraints}
              onEvaluate={handleEvaluateRecovery}
            />

            {/* Empty state prompt */}
            <div className="rounded-lg border border-dashed border-border bg-panel/40 p-8 text-center">
              <div className="text-2xl mb-2">✈️</div>
              <p className="text-sm font-medium text-white">No active disruptions</p>
              <p className="text-xs text-muted mt-1">
                Click{" "}
                <button
                  onClick={handleDemoScenario}
                  className="text-accent hover:underline"
                >
                  Run demo
                </button>{" "}
                in the header to simulate a flight cancellation scenario.
              </p>
            </div>
          </>
        )}

        {/* ── Developer diagnostics (always at bottom, collapsible) ── */}
        <DevDiagnosticsPanel
          itineraries={itineraries}
          selectedPaxId={selectedPaxId}
          onSelectPax={setSelectedPaxId}
          onSimulate={handleSimulateDisruption}
          onInjectStorm={(count) => api.injectStorm(count)}
          onDemoScenario={handleDemoScenario}
          onDemoReset={handleDemoReset}
          metrics={metrics}
          cases={cases}
          onApprove={handleApprove}
          onDecline={handleDecline}
          auditEntries={auditEntries}
        />
      </main>

      {/* ── Footer ── */}
      <footer className="mt-12 border-t border-border py-6 px-4 text-center text-xs text-muted">
        <div className="max-w-7xl mx-auto space-y-1">
          <div className="font-medium text-slate-400">Yatri AI — Intelligent Travel Recovery</div>
          <div>Built with React, Tailwind CSS, and FastAPI.</div>
          <div className="text-muted/60 text-[11px]">
            All airline inventories, fare deltas, hotel bookings, and vehicle reservations are
            synthetic fixtures for demonstration purposes only.
          </div>
        </div>
      </footer>
    </div>
  );
}
