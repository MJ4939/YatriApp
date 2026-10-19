import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
import ItineraryBoard from "./components/ItineraryBoard.jsx";
import DisruptionAlertBanner from "./components/DisruptionAlertBanner.jsx";
import ItineraryComparison from "./components/ItineraryComparison.jsx";
import AlternativeOptionsGrid from "./components/AlternativeOptionsGrid.jsx";
import RecoveryActionHub from "./components/RecoveryActionHub.jsx";
import ConstraintEditor from "./components/ConstraintEditor.jsx";
import InjectorControls from "./components/InjectorControls.jsx";
import LiveFeed from "./components/LiveFeed.jsx";
import AuditLog from "./components/AuditLog.jsx";
import StatsPanel from "./components/StatsPanel.jsx";

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

  // Active chosen plan: custom chosen or disruption's chosen
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
    showToast("Traveller constraints updated successfully.");
  };

  const handleEvaluateRecovery = async (newConstraints) => {
    const currentStatus = currentDisruption?.status || "cancelled";
    const res = await api.simulate({
      pax_id: selectedPaxId,
      status: currentStatus,
      reason: "Traveller updated constraints; re-evaluating recovery alternatives",
      constraints: newConstraints,
    });
    setCustomChosenOption(null);
    setActiveDisruptions((prev) => ({
      ...prev,
      [selectedPaxId]: { ...res, active: true },
    }));
    showToast("Recovery plans re-evaluated under updated constraints.");
  };

  const handleDemoScenario = async () => {
    setSelectedPaxId("PAX-1001");
    const res = await api.demoScenario();
    setCustomChosenOption(null);
    setActiveDisruptions((prev) => ({
      ...prev,
      ["PAX-1001"]: { ...res, active: true },
    }));
    showToast("⚡ PS 4.1 Canonical Demo scenario triggered for Jordan Lee!");
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
    showToast("↺ Demonstration state cleanly reset to baseline.");
  };

  const cases = reduceFeedToCases(feedEvents);

  return (
    <div className="min-h-screen pb-16">
      {/* Top Navigation & Brand Header */}
      <header className="border-b border-line bg-panel/70 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-md shadow-sky-500/20 text-white font-extrabold text-xl tracking-tighter">
              Y
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-white">
                  Yatri AI
                </h1>
                <span className="mono text-[10px] uppercase px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 font-bold">
                  PS 4.1 Travel Recovery
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Intelligent Travel Disruption Recovery · Multi-Modal Agent Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Status pills */}
            <div className="flex items-center gap-1.5 mono text-[11px] px-2.5 py-1 rounded-full bg-wash border border-line text-slate-300">
              <span
                className={`w-2 h-2 rounded-full ${
                  backendOnline ? "bg-go animate-pulse" : "bg-alert"
                }`}
              />
              <span>{backendOnline ? "Engine Connected" : "Connecting..."}</span>
            </div>

            <div className="mono text-[11px] px-2.5 py-1 rounded-full bg-wash border border-line text-slate-400 hidden sm:inline">
              Simulated GDS Sandbox
            </div>

            {/* Quick Demo CTA */}
            <button
              onClick={handleDemoScenario}
              className="mono text-xs uppercase tracking-wider font-bold px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 text-slate-950 hover:from-sky-400 hover:to-blue-500 transition-all shadow-md shadow-sky-500/25 flex items-center gap-1.5"
            >
              <span>⚡</span> Run PS 4.1 Demo
            </button>
            <button
              onClick={handleDemoReset}
              className="mono text-xs px-2.5 py-1.5 rounded-lg bg-wash border border-line text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Reset state to clean baseline"
            >
              ↺ Reset
            </button>
          </div>
        </div>
      </header>

      {/* Action Notice Toast */}
      {actionNotice && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-slate-900 border border-sky-500/60 text-white px-4 py-3 shadow-xl text-xs mono flex items-center gap-2 animate-bounce">
          <span className="text-sky-400 font-bold">●</span>
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Main Dashboard Content */}
      <main className="px-4 sm:px-6 py-6 max-w-7xl mx-auto space-y-8">
        {/* Hackathon Problem Statement Overview Banner */}
        <div className="rounded-xl border border-sky-500/30 bg-gradient-to-r from-sky-950/40 via-panel to-panel p-4 text-xs text-slate-300 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-2.5">
            <span className="text-sky-400 text-base font-bold">ℹ</span>
            <div>
              <strong className="text-white">Demonstration Workflow: </strong>
              Select a traveller profile ➔ Trigger simulated flight cancellation or transport delay ➔
              Configure hard constraints (budget, deadline) & priority preferences ➔
              Yatri AI computes multi-modal graph alternatives, enforces hard policies, reschedules hotel/car, and routes for member approval.
            </div>
          </div>
          <div className="mono text-[11px] text-slate-400 whitespace-nowrap shrink-0">
            Hard Constraints: Never Silently Violated
          </div>
        </div>

        {/* 1. Disruption Simulator & Hackathon Scenario Engine */}
        <InjectorControls
          itineraries={itineraries}
          selectedPaxId={selectedPaxId}
          onSelectPax={setSelectedPaxId}
          onSimulate={handleSimulateDisruption}
          onInjectStorm={(count) => api.injectStorm(count)}
          onDemoScenario={handleDemoScenario}
          onDemoReset={handleDemoReset}
        />

        {/* 2. Real-Time Telemetry Stats Panel */}
        <StatsPanel metrics={metrics} />

        {/* 3. Traveller Profiles Board */}
        <ItineraryBoard
          itineraries={itineraries}
          selectedPaxId={selectedPaxId}
          onSelectPax={setSelectedPaxId}
          activeDisruptions={activeDisruptions}
        />

        {/* 4. Active Disruption Alert Banner */}
        {currentDisruption?.active && (
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
        )}

        {/* 5. Traveller Constraints & Policy Guardrails */}
        <ConstraintEditor
          paxId={selectedPaxId}
          constraints={currentConstraints}
          onSave={handleSaveConstraints}
          onEvaluate={handleEvaluateRecovery}
        />

        {/* 6. Original vs Revised Itinerary Comparison */}
        {currentDisruption?.active && (
          <ItineraryComparison
            original={currentItinerary}
            chosen={activeChosen}
            hasFeasibleSolution={currentDisruption.has_feasible_solution}
          />
        )}

        {/* 7. Evaluated Alternative Options Grid */}
        {currentDisruption?.active && currentDisruption.options_considered?.length > 0 && (
          <AlternativeOptionsGrid
            options={currentDisruption.options_considered}
            selectedFlightId={activeChosen?.flight?.flight_id}
            onSelectOption={(opt) => setCustomChosenOption(opt)}
          />
        )}

        {/* 8. Recovery Recommendation & Approval Hub */}
        {currentDisruption?.active && (
          <RecoveryActionHub
            disruption={currentDisruption}
            onApprove={handleApprove}
            onDecline={handleDecline}
          />
        )}

        {/* 9. Live Pipeline Stepper Feed & Audit Intelligence Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <LiveFeed
            cases={cases}
            onApprove={handleApprove}
            onDecline={handleDecline}
          />
          <AuditLog entries={auditEntries} />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-line py-8 px-6 text-center text-xs text-slate-500 mono">
        <div className="max-w-7xl mx-auto space-y-1">
          <div className="text-slate-400 font-semibold">
            Yatri AI — Intelligent Travel Recovery · Hackathon PS 4.1
          </div>
          <div>
            Built with React, Tailwind CSS, FastAPI, NetworkX Multi-Modal Graph Engine, and Agentic Decision Guardrails.
          </div>
          <div className="text-slate-600 text-[10px]">
            Notice: All airline inventories, fare deltas, hotel bookings, and vehicle reservations are synthetic fixtures for demonstration purposes.
          </div>
        </div>
      </footer>
    </div>
  );
}
