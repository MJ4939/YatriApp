"""
Yatri AI — Intelligent Travel Recovery
Hackathon Problem Statement: PS 4.1 — AI Agent for Travel Disruption Recovery

FastAPI backend with deterministic ingestion, constraint engine, multi-modal graph ranking,
agentic decision/ripple evaluation, audit logging, and simulation APIs.
"""
from __future__ import annotations

import asyncio
import copy
import json
import random
import time
import uuid
from pathlib import Path
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from .agent import decide, compute_affected_bookings, compute_ripple_effects
from .audit import audit_log
from .communication import build_notification
from .graph_engine import ItineraryGraph
from .metrics import metrics
from .models import (
    DisruptionEvent,
    DisruptionStatus,
    DisruptionType,
    IngestResult,
    PriorityPreference,
    SimulationRequest,
    TravellerConstraints,
)

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    worker_task = asyncio.create_task(process_events())
    try:
        yield
    finally:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass

app = FastAPI(
    title="Yatri AI — Intelligent Travel Recovery",
    description="Multi-modal travel disruption recovery engine with hard constraint enforcement",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Initial Fixtures & Seed Constraints
# ---------------------------------------------------------------------------
INITIAL_ITINERARIES: dict = json.loads((FIXTURES_DIR / "itineraries.json").read_text())
INITIAL_INVENTORY: dict = json.loads((FIXTURES_DIR / "inventory.json").read_text())

ITINERARIES: dict = copy.deepcopy(INITIAL_ITINERARIES)
INVENTORY: dict = copy.deepcopy(INITIAL_INVENTORY)

def _init_default_constraints() -> Dict[str, TravellerConstraints]:
    return {
        "PAX-1001": TravellerConstraints(
            max_additional_cost=100.0,
            latest_arrival_time="2026-11-15T19:00:00",
            max_delay_minutes=240,
            must_keep_cabin=True,
            priority_preference=PriorityPreference.fastest_arrival,
            required_commitments="Keynote speech at Chicago Tech Summit at 19:30",
        ),
        "PAX-1002": TravellerConstraints(
            max_additional_cost=100.0,
            latest_arrival_time="2026-11-15T16:00:00",
            max_delay_minutes=180,
            must_keep_cabin=True,
            priority_preference=PriorityPreference.lowest_cost,
            required_commitments="Client onsite meeting in Atlanta",
        ),
        "PAX-1003": TravellerConstraints(
            max_additional_cost=300.0,
            latest_arrival_time="2026-11-15T22:00:00",
            max_delay_minutes=360,
            must_keep_cabin=True,
            priority_preference=PriorityPreference.least_disruption,
            required_commitments="Executive summit opening dinner",
        ),
    }

TRAVELLER_CONSTRAINTS: Dict[str, TravellerConstraints] = _init_default_constraints()
ACTIVE_DISRUPTIONS: Dict[str, dict] = {}

event_queue: "asyncio.Queue[dict]" = asyncio.Queue()
feed: list[dict] = []
notifications: list[dict] = []
rejected_events: list[dict] = []

MAX_FEED = 500


def _push_feed(item: dict):
    feed.append(item)
    if len(feed) > MAX_FEED:
        del feed[0 : len(feed) - MAX_FEED]


# ---------------------------------------------------------------------------
# Background Consumer: Decision -> Communication -> Audit
# ---------------------------------------------------------------------------
async def process_events():
    while True:
        job = await event_queue.get()
        try:
            await _process_one(job)
        except Exception as exc:
            _push_feed(
                {
                    "event_id": job.get("event_id"),
                    "stage": "Error",
                    "error": str(exc),
                    "timestamp": time.time(),
                }
            )
        finally:
            event_queue.task_done()


async def _process_one(job: dict):
    event_id = job["event_id"]
    event = job["event"]
    received_at = job["received_at"]
    custom_constraints = job.get("constraints")

    itinerary = ITINERARIES.get(event.pax_id)
    if not itinerary:
        _push_feed(
            {
                "event_id": event_id,
                "stage": "Error",
                "error": f"Unknown pax_id {event.pax_id}",
                "timestamp": time.time(),
            }
        )
        return

    constraints = custom_constraints or TRAVELLER_CONSTRAINTS.get(
        event.pax_id, TravellerConstraints()
    )

    action_start = time.monotonic()
    detection_to_action_ms = (action_start - received_at) * 1000

    # 1. Affected Bookings Stage
    affected_bookings = compute_affected_bookings(
        itinerary,
        event_status=event.status.value,
        delay_minutes=event.delay_minutes,
        reason=getattr(event, "reason", None),
    )
    _push_feed(
        {
            "event_id": event_id,
            "stage": "Impact analysis",
            "pax_id": event.pax_id,
            "affected_bookings": affected_bookings,
            "timestamp": time.time(),
        }
    )
    await asyncio.sleep(0.1)

    # 2. Graph Engine Ranking with Hard & Soft Constraints
    graph = ItineraryGraph(itinerary, INVENTORY)
    ranked = graph.rank_options(top_k=4, constraints=constraints)

    _push_feed(
        {
            "event_id": event_id,
            "stage": "Decision reasoning",
            "pax_id": event.pax_id,
            "options_considered": [o.to_dict() for o in ranked],
            "constraints_applied": constraints.model_dump(mode="json"),
            "timestamp": time.time(),
        }
    )
    await asyncio.sleep(0.12)

    # 3. Agent Decision & Ripple Effects
    decision = decide(
        original_itinerary=itinerary,
        ranked_options=ranked,
        constraints=constraints,
        event_status=event.status.value,
        delay_minutes=event.delay_minutes,
        reason=getattr(event, "reason", None),
    )

    _push_feed(
        {
            "event_id": event_id,
            "stage": "Ripple effects",
            "pax_id": event.pax_id,
            "ripple_effects": decision["ripple_effects"],
            "timestamp": time.time(),
        }
    )
    await asyncio.sleep(0.1)

    # 4. Resolution Stage (Auto-executed or Pending Traveller Approval)
    stage_label = "Rebooked" if decision["auto_executed"] else "Pending your approval"
    _push_feed(
        {
            "event_id": event_id,
            "stage": stage_label,
            "pax_id": event.pax_id,
            "chosen": decision["chosen"],
            "reasoning": decision["reasoning"],
            "auto_executed": decision["auto_executed"],
            "escalated": decision["escalated"],
            "has_feasible_solution": decision["has_feasible_solution"],
            "timestamp": time.time(),
        }
    )

    # 5. Communication & Notification
    decision_finalized_at = time.monotonic()
    notification = build_notification(
        event.pax_id, itinerary["member_name"], decision, event
    )
    notification["event_id"] = event_id
    notification_delivery_ms = (time.monotonic() - decision_finalized_at) * 1000

    # 6. Audit Trail Logging
    audit_entry = audit_log.record(
        input_event=event.model_dump(mode="json"),
        options_considered=[o.to_dict() for o in ranked],
        option_chosen=decision["chosen"],
        reasoning=decision["reasoning"],
        auto_executed=decision["auto_executed"],
        escalated=decision["escalated"],
        ripple_effects=decision["ripple_effects"],
        timings={
            "detection_to_action_ms": round(detection_to_action_ms, 1),
            "notification_delivery_ms": round(notification_delivery_ms, 1),
        },
        constraints_applied=constraints.model_dump(mode="json"),
        affected_bookings=decision["affected_bookings"],
    )

    if decision["escalated"]:
        audit_entry["approval_status"] = "pending"
    else:
        audit_entry["approval_status"] = "auto_approved"

    notification["audit_id"] = audit_entry["audit_id"]
    notifications.append(notification)

    # Store active disruption context for UI dashboard
    ACTIVE_DISRUPTIONS[event.pax_id] = {
        "event_id": event_id,
        "event": event.model_dump(mode="json"),
        "pax_id": event.pax_id,
        "affected_bookings": decision["affected_bookings"],
        "options_considered": [o.to_dict() for o in ranked],
        "chosen": decision["chosen"],
        "has_feasible_solution": decision["has_feasible_solution"],
        "auto_executed": decision["auto_executed"],
        "escalated": decision["escalated"],
        "reasoning": decision["reasoning"],
        "ripple_effects": decision["ripple_effects"],
        "constraints": constraints.model_dump(mode="json"),
        "audit_id": audit_entry["audit_id"],
        "approval_status": audit_entry.get("approval_status", "pending"),
        "timestamp": time.time(),
    }

    _push_feed(
        {
            "event_id": event_id,
            "stage": "Notified",
            "pax_id": event.pax_id,
            "message": notification["message"],
            "action_needed": notification["action_needed"],
            "audit_id": audit_entry["audit_id"],
            "timestamp": time.time(),
        }
    )

    metrics.record_pipeline_run(
        auto_executed=decision["auto_executed"],
        detection_to_action_ms=detection_to_action_ms,
        notification_delivery_ms=notification_delivery_ms,
    )



# ---------------------------------------------------------------------------
# Core Endpoints
# ---------------------------------------------------------------------------
@app.get("/")
async def root():
    return {
        "service": "Yatri AI — Intelligent Travel Recovery",
        "tagline": "Autonomous disruption recovery engine for modern travellers",
        "version": "1.0.0",
        "problem_statement": "PS 4.1 — AI Agent for Travel Disruption Recovery",
        "docs": "/docs",
        "endpoints": [
            "POST /webhook/disruption",
            "POST /disruptions/simulate",
            "GET /disruptions/active/{pax_id}",
            "GET /constraints/{pax_id}",
            "POST /constraints/{pax_id}",
            "POST /demo/scenario",
            "POST /demo/reset",
            "GET /itineraries",
            "GET /feed?since=0",
            "GET /notifications",
            "GET /audit-log",
            "GET /metrics",
            "POST /inject/single",
            "POST /inject/storm",
            "POST /audit-log/{id}/approve",
            "POST /audit-log/{id}/decline",
        ],
    }


@app.get("/itineraries")
async def get_itineraries():
    return list(ITINERARIES.values())


@app.get("/itineraries/{pax_id}")
async def get_itinerary(pax_id: str):
    itin = ITINERARIES.get(pax_id)
    if not itin:
        raise HTTPException(404, f"Itinerary for {pax_id} not found")
    return itin


@app.get("/constraints/{pax_id}")
async def get_constraints(pax_id: str):
    if pax_id not in ITINERARIES:
        raise HTTPException(404, f"Pax {pax_id} not found")
    return TRAVELLER_CONSTRAINTS.get(pax_id, TravellerConstraints()).model_dump(mode="json")


@app.post("/constraints/{pax_id}")
async def update_constraints(pax_id: str, constraints: TravellerConstraints):
    if pax_id not in ITINERARIES:
        raise HTTPException(404, f"Pax {pax_id} not found")
    TRAVELLER_CONSTRAINTS[pax_id] = constraints
    return {"pax_id": pax_id, "constraints": constraints.model_dump(mode="json")}


@app.get("/disruptions/active/{pax_id}")
async def get_active_disruption(pax_id: str):
    return ACTIVE_DISRUPTIONS.get(pax_id) or {"pax_id": pax_id, "active": False}


@app.post("/disruptions/simulate")
async def simulate_disruption(req: SimulationRequest):
    """
    Run an end-to-end disruption simulation with custom traveller constraints.
    Returns immediately after placing in queue and also synchronously runs recovery
    so the UI can instantly display the recovery solution without delay.
    """
    itinerary = ITINERARIES.get(req.pax_id)
    if not itinerary:
        raise HTTPException(404, f"Traveller {req.pax_id} not found")

    constraints = req.constraints or TRAVELLER_CONSTRAINTS.get(
        req.pax_id, TravellerConstraints()
    )
    TRAVELLER_CONSTRAINTS[req.pax_id] = constraints

    flight = itinerary["flight"]
    event = DisruptionEvent(
        flight_id=flight["flight_id"],
        status=req.status,
        pax_id=req.pax_id,
        original_itinerary=f"ITIN-{req.pax_id}",
        delay_minutes=req.delay_minutes,
        disruption_type=DisruptionType.flight,
        severity="critical" if req.status == DisruptionStatus.cancelled else "major",
        reason=req.reason,
    )

    event_id = str(uuid.uuid4())
    received_at = time.monotonic()

    # Push to queue for background processing & feed animation
    await event_queue.put({
        "event_id": event_id,
        "event": event,
        "received_at": received_at,
        "constraints": constraints,
    })

    _push_feed(
        {
            "event_id": event_id,
            "stage": "Detected",
            "flight_id": event.flight_id,
            "pax_id": event.pax_id,
            "status": event.status.value,
            "reason": req.reason,
            "timestamp": time.time(),
        }
    )

    # Also compute direct result synchronously so caller gets instant data
    graph = ItineraryGraph(itinerary, INVENTORY)
    ranked = graph.rank_options(top_k=4, constraints=constraints)
    decision = decide(
        original_itinerary=itinerary,
        ranked_options=ranked,
        constraints=constraints,
        event_status=req.status.value,
        delay_minutes=req.delay_minutes,
        reason=req.reason,
    )

    active_entry = {
        "event_id": event_id,
        "event": event.model_dump(mode="json"),
        "pax_id": req.pax_id,
        "affected_bookings": decision["affected_bookings"],
        "options_considered": [o.to_dict() for o in ranked],
        "chosen": decision["chosen"],
        "has_feasible_solution": decision["has_feasible_solution"],
        "auto_executed": decision["auto_executed"],
        "escalated": decision["escalated"],
        "reasoning": decision["reasoning"],
        "ripple_effects": decision["ripple_effects"],
        "constraints": constraints.model_dump(mode="json"),
        "audit_id": str(uuid.uuid4()),
        "approval_status": "pending" if decision["escalated"] else "auto_approved",
        "timestamp": time.time(),
    }
    ACTIVE_DISRUPTIONS[req.pax_id] = active_entry

    return {
        "event_id": event_id,
        "pax_id": req.pax_id,
        "status": req.status.value,
        "has_feasible_solution": decision["has_feasible_solution"],
        "affected_bookings": decision["affected_bookings"],
        "chosen": decision["chosen"],
        "options_considered": [o.to_dict() for o in ranked],
        "ripple_effects": decision["ripple_effects"],
        "reasoning": decision["reasoning"],
        "auto_executed": decision["auto_executed"],
        "escalated": decision["escalated"],
        "constraints": constraints.model_dump(mode="json"),
    }


@app.post("/webhook/disruption", response_model=IngestResult)
async def webhook_disruption(payload: dict):
    try:
        event = DisruptionEvent(**payload)
    except ValidationError as e:
        rejected_events.append({"payload": payload, "errors": e.errors()})
        return IngestResult(accepted=False, reason=str(e.errors()))

    event_id = str(uuid.uuid4())
    received_at = time.monotonic()
    _push_feed(
        {
            "event_id": event_id,
            "stage": "Detected",
            "flight_id": event.flight_id,
            "pax_id": event.pax_id,
            "status": event.status.value,
            "timestamp": time.time(),
        }
    )
    await event_queue.put({"event_id": event_id, "event": event, "received_at": received_at})
    return IngestResult(accepted=True, event_id=event_id)


# ---------------------------------------------------------------------------
# Hackathon Demonstration Scenario & State Reset
# ---------------------------------------------------------------------------
@app.post("/demo/scenario")
async def run_hackathon_demo():
    """
    Deterministic Hackathon Demo Scenario:
      Traveller: Jordan Lee (PAX-1001)
      Original Route: SFO -> ORD on United UA 812 (arriving 15:20)
      Hotel: The Langham Chicago (check-in 16:00)
      Car: Hertz midsize (pickup 16:30)
      Commitment: Keynote at Chicago Tech Summit at 19:30
      Traveller Constraints: Max Budget $100.00, Hard Deadline 19:00:00 (Nov 15, 2026)
      Disruption: Primary flight UA 812 cancelled due to mechanical failure.
      Recovery: Evaluates alternatives, disqualifies options violating budget or deadline,
      selects UA 814 (+$18 fare, arrives 17:05, satisfies all constraints),
      reschedules hotel check-in to 18:00 and Hertz car pickup to 17:45.
    """
    constraints = TravellerConstraints(
        max_additional_cost=100.0,
        latest_arrival_time="2026-11-15T19:00:00",
        max_delay_minutes=240,
        must_keep_cabin=True,
        priority_preference=PriorityPreference.fastest_arrival,
        required_commitments="Keynote speech at Chicago Tech Summit at 19:30",
    )
    sim_req = SimulationRequest(
        pax_id="PAX-1001",
        status=DisruptionStatus.cancelled,
        reason="Primary flight UA 812 cancelled: inbound aircraft engine malfunction at SFO gate",
        constraints=constraints,
    )
    return await simulate_disruption(sim_req)


@app.post("/demo/reset")
async def reset_demo_state():
    """Restores pristine initial demo state: clears feed, audit log, active disruptions, and metrics."""
    global ITINERARIES, INVENTORY, TRAVELLER_CONSTRAINTS, ACTIVE_DISRUPTIONS
    ITINERARIES = copy.deepcopy(INITIAL_ITINERARIES)
    INVENTORY = copy.deepcopy(INITIAL_INVENTORY)
    TRAVELLER_CONSTRAINTS = _init_default_constraints()
    ACTIVE_DISRUPTIONS.clear()
    feed.clear()
    notifications.clear()
    rejected_events.clear()
    audit_log.clear()
    metrics.reset()

    # Drain queue
    while not event_queue.empty():
        try:
            event_queue.get_nowait()
            event_queue.task_done()
        except Exception:
            pass

    return {
        "status": "reset_successful",
        "message": "Yatri AI demonstration state restored to baseline.",
        "itineraries_count": len(ITINERARIES),
        "audit_entries_count": len(audit_log.all()),
    }


# ---------------------------------------------------------------------------
# Read Endpoints for Polling & UI
# ---------------------------------------------------------------------------
@app.get("/feed")
async def get_feed(since: int = 0):
    return {"events": feed[since:], "next_since": len(feed)}


@app.get("/notifications")
async def get_notifications():
    return list(reversed(notifications))


@app.get("/audit-log")
async def get_audit_log():
    return audit_log.all()


@app.get("/metrics")
async def get_metrics():
    return metrics.snapshot()


@app.get("/rejected-events")
async def get_rejected_events():
    return rejected_events


# ---------------------------------------------------------------------------
# Escalation Approve / Decline Actions
# ---------------------------------------------------------------------------
@app.post("/audit-log/{audit_id}/approve")
async def approve(audit_id: str):
    entry = audit_log.update_status(audit_id, "approved")
    if not entry:
        raise HTTPException(404, "audit entry not found")

    pax_id = entry.get("input_event", {}).get("pax_id")
    if pax_id and pax_id in ACTIVE_DISRUPTIONS:
        ACTIVE_DISRUPTIONS[pax_id]["approval_status"] = "approved"

    _push_feed(
        {
            "stage": "Approved by member",
            "audit_id": audit_id,
            "pax_id": pax_id,
            "timestamp": time.time(),
        }
    )
    return entry


@app.post("/audit-log/{audit_id}/decline")
async def decline(audit_id: str):
    entry = audit_log.update_status(audit_id, "declined")
    if not entry:
        raise HTTPException(404, "audit entry not found")

    pax_id = entry.get("input_event", {}).get("pax_id")
    if pax_id and pax_id in ACTIVE_DISRUPTIONS:
        ACTIVE_DISRUPTIONS[pax_id]["approval_status"] = "declined"

    _push_feed(
        {
            "stage": "Declined by member",
            "audit_id": audit_id,
            "pax_id": pax_id,
            "timestamp": time.time(),
        }
    )
    return entry


# ---------------------------------------------------------------------------
# Injector Routes
# ---------------------------------------------------------------------------
SAMPLE_STATUSES = ["cancelled", "delayed", "missed_connection"]


def _random_event_for(pax_id: str) -> dict:
    itinerary = ITINERARIES[pax_id]
    status = random.choice(SAMPLE_STATUSES)
    payload = {
        "flight_id": itinerary["flight"]["flight_id"],
        "status": status,
        "pax_id": pax_id,
        "original_itinerary": f"ITIN-{pax_id}",
    }
    if status == "delayed":
        payload["delay_minutes"] = random.choice([45, 90, 150, 300])
    return payload


@app.post("/inject/single")
async def inject_single(pax_id: str | None = None):
    pax_id = pax_id or random.choice(list(ITINERARIES.keys()))
    payload = _random_event_for(pax_id)
    return await webhook_disruption(payload)


@app.post("/inject/storm")
async def inject_storm(count: int = 12):
    results = []
    pax_ids = list(ITINERARIES.keys())
    for i in range(count):
        pax_id = pax_ids[i % len(pax_ids)]
        payload = _random_event_for(pax_id)
        results.append(await webhook_disruption(payload))
        await asyncio.sleep(0.05)
    return {"fired": len(results), "results": results}
