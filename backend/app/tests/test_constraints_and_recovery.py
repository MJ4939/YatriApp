import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.graph_engine import ItineraryGraph
from app.agent import decide, compute_affected_bookings, compute_ripple_effects
from app.models import TravellerConstraints, PriorityPreference, DisruptionStatus, SimulationRequest
from app.policy import evaluate_option_constraints
from fastapi.testclient import TestClient
from app.main import app

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures"
ITINERARIES = json.loads((FIXTURES_DIR / "itineraries.json").read_text())
INVENTORY = json.loads((FIXTURES_DIR / "inventory.json").read_text())

client = TestClient(app)


def test_hard_budget_constraint_rejects_expensive_options():
    itinerary = ITINERARIES["PAX-1001"]  # SFO-ORD
    graph = ItineraryGraph(itinerary, INVENTORY)
    
    # Fare deltas for SFO-ORD:
    # UA 814: $430 ($18 delta)
    # AA 220: $465 ($53 delta)
    # UA 902: $890 ($478 delta)
    # If budget is $30, only UA 814 ($18 delta) is feasible
    strict_budget = TravellerConstraints(
        max_additional_cost=30.0,
        must_keep_cabin=False,
    )
    ranked = graph.rank_options(top_k=5, constraints=strict_budget)
    
    feasible = [o for o in ranked if o.is_feasible]
    infeasible = [o for o in ranked if not o.is_feasible]
    
    assert len(feasible) == 1
    assert feasible[0].flight["flight_number"] == "UA 814"
    assert feasible[0].fare_delta == 18.0
    
    # Verify that expensive options have hard_violations explaining why
    assert any("Hard budget exceeded" in v for o in infeasible for v in o.hard_violations)


def test_arrival_deadline_hard_constraint():
    itinerary = ITINERARIES["PAX-1001"]
    graph = ItineraryGraph(itinerary, INVENTORY)
    
    # UA 814 arrives 17:05:00
    # AA 220 arrives 18:40:00
    # UA 902 arrives 20:10:00
    # Southwest arrives next day 14:05:00
    # Deadline: 18:00 (Nov 15, 2026) -> Only UA 814 arrives before 18:00
    deadline_constraints = TravellerConstraints(
        latest_arrival_time="2026-11-15T18:00:00",
        max_additional_cost=500.0,
    )
    ranked = graph.rank_options(top_k=5, constraints=deadline_constraints)
    
    feasible = [o for o in ranked if o.is_feasible]
    assert len(feasible) == 1
    assert feasible[0].flight["flight_number"] == "UA 814"
    
    infeasible = [o for o in ranked if not o.is_feasible]
    deadline_rejections = [
        o for o in infeasible if any("Arrival deadline violated" in v for v in o.hard_violations)
    ]
    assert len(deadline_rejections) >= 2


def test_no_feasible_option_surfaces_clear_warnings_and_does_not_silently_violate():
    itinerary = ITINERARIES["PAX-1001"]
    graph = ItineraryGraph(itinerary, INVENTORY)
    
    # Impossible budget ($5) and impossible deadline (16:00, original was 15:20)
    impossible_constraints = TravellerConstraints(
        max_additional_cost=5.0,
        latest_arrival_time="2026-11-15T16:00:00",
    )
    ranked = graph.rank_options(top_k=4, constraints=impossible_constraints)
    decision = decide(itinerary, ranked, constraints=impossible_constraints)
    
    assert decision["has_feasible_solution"] is False
    assert decision["auto_executed"] is False
    assert decision["escalated"] is True
    assert "NO FEASIBLE RECOVERY PLAN FOUND" in decision["reasoning"]
    assert decision["chosen"] is not None
    assert decision["chosen"]["is_compromise_fallback"] is True
    # Verify fallback has rejection reason clearly populated
    assert len(decision["chosen"]["hard_violations"]) > 0


def test_priority_preference_ranking_lowest_cost_vs_fastest_arrival():
    itinerary = ITINERARIES["PAX-1002"]  # JFK-ATL
    graph_fastest = ItineraryGraph(itinerary, INVENTORY)
    
    fastest_constraints = TravellerConstraints(
        max_additional_cost=200.0,
        priority_preference=PriorityPreference.fastest_arrival,
    )
    ranked_fastest = graph_fastest.rank_options(top_k=3, constraints=fastest_constraints)
    
    cost_constraints = TravellerConstraints(
        max_additional_cost=200.0,
        max_delay_minutes=400,
        priority_preference=PriorityPreference.lowest_cost,
    )
    graph_cost = ItineraryGraph(itinerary, INVENTORY)
    ranked_cost = graph_cost.rank_options(top_k=3, constraints=cost_constraints)
    
    # For JFK-ATL inventory:
    # DL 460 arrives 12:05 (fare 310) -> earlier arrival
    # B6 501 arrives 16:10 (fare 275) -> lowest fare ($275 < $298 orig fare)
    assert ranked_fastest[0].flight["flight_number"] == "DL 460"
    assert ranked_cost[0].flight["flight_number"] == "B6 501"


def test_affected_bookings_impact_analysis():
    itinerary = ITINERARIES["PAX-1001"]
    affected = compute_affected_bookings(
        itinerary,
        event_status="cancelled",
        reason="Mechanical malfunction on Boeing 737",
    )
    legs = [a["leg"] for a in affected]
    assert "flight" in legs
    assert "hotel" in legs
    assert "car" in legs
    
    flight_item = next(a for a in affected if a["leg"] == "flight")
    assert flight_item["severity"] == "critical"
    assert "Cancelled" in flight_item["status"]
    
    hotel_item = next(a for a in affected if a["leg"] == "hotel")
    assert "check-in" in hotel_item["impact_reason"].lower()


def test_demo_scenario_and_reset_endpoints():
    # 1. Reset first
    res_reset = client.post("/demo/reset")
    assert res_reset.status_code == 200
    assert res_reset.json()["status"] == "reset_successful"
    
    # 2. Trigger hackathon demo scenario
    res_demo = client.post("/demo/scenario")
    assert res_demo.status_code == 200
    data = res_demo.json()
    assert data["pax_id"] == "PAX-1001"
    assert data["status"] == "cancelled"
    assert data["has_feasible_solution"] is True
    assert data["chosen"]["flight"]["flight_number"] == "UA 814"
    assert len(data["affected_bookings"]) >= 3
    assert len(data["options_considered"]) >= 3
    
    # 3. Check active disruption endpoint
    res_active = client.get("/disruptions/active/PAX-1001")
    assert res_active.status_code == 200
    active_data = res_active.json()
    assert active_data["chosen"]["flight"]["flight_number"] == "UA 814"
