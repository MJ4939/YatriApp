"""
Decision layer (agentic) for Yatri AI — Intelligent Travel Recovery.

Evaluates ranked multi-modal options against traveller constraints and policy guardrails.
Distinguishes hard constraints from soft trade-offs.
Computes ripple effects on dependent hotel and car bookings.
Generates comprehensive reasoning explaining why the winner was selected
and why alternative candidates were rejected.
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Optional, List, Dict, Any

from .graph_engine import RankedOption
from .models import TravellerConstraints
from .policy import DEFAULT_POLICY, Policy, within_policy

DATE_FMT = "%Y-%m-%dT%H:%M:%S"


def _parse(dt: str) -> datetime:
    return datetime.strptime(dt, DATE_FMT)


def _fmt(dt: datetime) -> str:
    return dt.strftime("%b %d, %I:%M %p").replace(" 0", " ")


def compute_affected_bookings(
    original: dict,
    event_status: str = "cancelled",
    delay_minutes: Optional[int] = None,
    reason: Optional[str] = None
) -> list[dict]:
    """Identifies all trip components affected by a primary disruption."""
    flight = original.get("flight", {})
    hotel = original.get("hotel", {})
    car = original.get("car", {})

    status_label = "Cancelled" if event_status == "cancelled" else f"Delayed by {delay_minutes or 0} min"
    flight_desc = f"{flight.get('carrier')} {flight.get('flight_number')} ({flight.get('origin')} → {flight.get('destination')})"

    affected = [
        {
            "leg": "flight",
            "booking_ref": flight.get("flight_id", "FL-000"),
            "title": flight_desc,
            "status": status_label,
            "severity": "critical" if event_status == "cancelled" else "major",
            "impact_reason": (
                f"Primary disruption: Flight {event_status}. "
                f"{reason or 'Aircraft unavailable or grounded'}. Travellers cannot depart on original schedule."
            ),
        },
        {
            "leg": "hotel",
            "booking_ref": hotel.get("hotel_id", "HT-000"),
            "title": f"{hotel.get('name')} ({hotel.get('city')})",
            "status": "Check-in At Risk",
            "severity": "major",
            "impact_reason": (
                f"Check-in was reserved for {_fmt(_parse(hotel['check_in']))}. "
                "Disrupted arrival will trigger automatic no-show room release unless check-in time is rescheduled."
            ),
        },
        {
            "leg": "car",
            "booking_ref": car.get("car_id", "CR-000"),
            "title": f"{car.get('vendor')} Rental Car ({car.get('class', 'midsize').title()})",
            "status": "Counter Hold Expiring",
            "severity": "major",
            "impact_reason": (
                f"Airport pickup was reserved for {_fmt(_parse(car['pickup']))}. "
                "Rental counters release vehicles 2 hours after flight arrival time unless pickup window is updated."
            ),
        },
    ]

    notes = original.get("notes")
    if notes:
        affected.append({
            "leg": "commitment",
            "booking_ref": "CMT-100",
            "title": "Onward Schedule / Commitment",
            "status": "Deadline Warning",
            "severity": "warning",
            "impact_reason": f"Traveller schedule note: '{notes}'. Strict arrival deadline enforced.",
        })

    return affected


def compute_ripple_effects(original: dict, chosen: RankedOption) -> list[dict]:
    """Explicit, transparent re-evaluation of dependent legs (hotel + car)."""
    ripples = []

    orig_hotel_checkin = _parse(original["hotel"]["check_in"])
    new_hotel_checkin = _parse(chosen.hotel["check_in"])
    if new_hotel_checkin != orig_hotel_checkin:
        ripples.append(
            {
                "leg": "hotel",
                "field": "check_in",
                "from": original["hotel"]["check_in"],
                "to": chosen.hotel["check_in"],
                "reason": f"Hotel check-in shifted from {_fmt(orig_hotel_checkin)} to {_fmt(new_hotel_checkin)} to match revised touchdown.",
            }
        )
    if chosen.hotel["hotel_id"] != original["hotel"]["hotel_id"]:
        ripples.append(
            {
                "leg": "hotel",
                "field": "property",
                "from": original["hotel"]["name"],
                "to": chosen.hotel["name"],
                "reason": "Original property unavailable at revised check-in time; rebooked to nearest equivalent property.",
            }
        )

    orig_car_pickup = _parse(original["car"]["pickup"])
    new_car_pickup = _parse(chosen.car["pickup"])
    if new_car_pickup != orig_car_pickup:
        ripples.append(
            {
                "leg": "car",
                "field": "pickup",
                "from": original["car"]["pickup"],
                "to": chosen.car["pickup"],
                "reason": f"Rental pickup shifted from {_fmt(orig_car_pickup)} to {_fmt(new_car_pickup)} matching delayed airport arrival.",
            }
        )
    if chosen.car["car_id"] != original["car"]["car_id"]:
        ripples.append(
            {
                "leg": "car",
                "field": "vendor",
                "from": original["car"]["vendor"],
                "to": chosen.car["vendor"],
                "reason": "Original rental counter unavailable; rebooked to nearest equivalent supplier.",
            }
        )
    return ripples


def _build_comprehensive_reasoning(
    chosen: Optional[RankedOption],
    ranked_options: list[RankedOption],
    constraints: Optional[TravellerConstraints],
    policy_violations: list[str],
    has_feasible: bool,
    escalated: bool,
) -> str:
    if not has_feasible or not chosen:
        rejection_summaries = []
        for opt in ranked_options:
            f = opt.flight
            reasons = opt.hard_violations or ["Violates traveller constraints"]
            rejection_summaries.append(f"{f['carrier']} {f['flight_number']}: {'; '.join(reasons)}")
        
        budget_str = f"${constraints.max_additional_cost:.2f}" if constraints else "budget"
        deadline_str = f"arrival deadline of {constraints.latest_arrival_time}" if constraints and constraints.latest_arrival_time else "deadline"

        return (
            f"NO FEASIBLE RECOVERY PLAN FOUND that satisfies all hard traveller constraints ({budget_str} cap, {deadline_str}). "
            f"Evaluated options were rejected: " + " | ".join(rejection_summaries) + ". "
            "Surfacing closest fallback alternatives with explicit violation warnings for manual review."
        )

    f = chosen.flight
    winner_str = (
        f"Selected {f['carrier']} {f['flight_number']} departing {_fmt(_parse(f['departure']))} "
        f"and arriving {_fmt(_parse(f['arrival']))}. "
        f"Adds only +${chosen.fare_delta:.2f} additional fare and {chosen.delay_minutes} min delay vs. original schedule. "
    )
    if constraints and constraints.latest_arrival_time:
        try:
            deadline = _parse(constraints.latest_arrival_time)
            winner_str += f"Meets strict arrival deadline of {_fmt(deadline)}. "
        except Exception:
            pass

    # Explain rejected alternatives
    rejected_opts = [o for o in ranked_options if not o.is_feasible or o != chosen]
    rejected_reasons = []
    for opt in rejected_opts[:2]:
        rf = opt.flight
        if not opt.is_feasible:
            rejected_reasons.append(f"{rf['carrier']} {rf['flight_number']} rejected ({'; '.join(opt.hard_violations)})")
        elif opt.total_weight > chosen.total_weight:
            rejected_reasons.append(f"{rf['carrier']} {rf['flight_number']} ranked lower (+${opt.fare_delta:.2f}, +{opt.delay_minutes}m delay)")

    if rejected_reasons:
        winner_str += "Alternatives evaluated: " + "; ".join(rejected_reasons) + ". "

    if escalated:
        winner_str += "Requires traveller approval before issuing simulated rebooking."
    else:
        winner_str += "All constraints met within automated policy; auto-recovery executed."

    return winner_str


def _llm_justification(
    option: RankedOption,
    violations: list[str],
    escalated: bool,
    constraints: Optional[TravellerConstraints] = None
) -> Optional[str]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import requests

        f = option.flight
        prompt = (
            "You are Yatri AI, an intelligent travel disruption recovery agent. "
            "In 2-3 clear sentences, explain this rebooking decision to the traveller. "
            f"New flight: {f['carrier']} {f['flight_number']} departing {f['departure']} arriving {f['arrival']}. "
            f"Added delay: {option.delay_minutes} minutes. Fare delta: ${option.fare_delta:.2f}. "
            f"Feasible: {option.is_feasible}. "
            f"Violations: {violations if violations else 'None'}. "
            f"Escalated for approval: {escalated}."
        )
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 220,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=8,
        )
        resp.raise_for_status()
        data = resp.json()
        text = "".join(
            block.get("text", "") for block in data.get("content", []) if block.get("type") == "text"
        )
        return text.strip() or None
    except Exception:
        return None


def decide(
    original_itinerary: dict,
    ranked_options: list[RankedOption],
    policy: Policy = DEFAULT_POLICY,
    constraints: Optional[TravellerConstraints] = None,
    event_status: str = "cancelled",
    delay_minutes: Optional[int] = None,
    reason: Optional[str] = None,
) -> dict:
    """
    Decides the recovery plan:
      1. Distinguishes hard constraints from soft preferences.
      2. Ranks feasible options first.
      3. Explains why the selected option won and why others were rejected.
      4. If no feasible option exists, explicitly flags the condition and presents closest alternatives.
      5. Computes ripple effects on hotel and car.
    """
    original_cabin = original_itinerary["flight"]["cabin_class"]
    affected_bookings = compute_affected_bookings(original_itinerary, event_status, delay_minutes, reason)

    if not ranked_options:
        return {
            "has_feasible_solution": False,
            "options_considered": [],
            "chosen": None,
            "auto_executed": False,
            "escalated": True,
            "reasoning": "No alternative inventory found for this route. Routed for manual operations review.",
            "ripple_effects": [],
            "affected_bookings": affected_bookings,
        }

    # Evaluate options against policy
    scored = []
    for opt in ranked_options:
        compliant, p_violations = within_policy(opt, original_cabin, policy)
        scored.append((opt, compliant, p_violations))

    feasible_options = [opt for opt in ranked_options if opt.is_feasible]

    if feasible_options:
        chosen = feasible_options[0]
        # Check if chosen option is also compliant with the automated policy
        _, p_compliant, p_violations = next((s for s in scored if s[0] == chosen), (chosen, True, []))

        # Auto-execute if within policy limits, otherwise escalate for traveller approval
        auto_executed = p_compliant
        escalated = not auto_executed

        ripples = compute_ripple_effects(original_itinerary, chosen)
        reasoning = (
            _llm_justification(chosen, p_violations, escalated=escalated, constraints=constraints)
            or _build_comprehensive_reasoning(chosen, ranked_options, constraints, p_violations, True, escalated)
        )

        chosen_dict = chosen.to_dict()
        chosen_dict["is_compromise_fallback"] = False

        return {
            "has_feasible_solution": True,
            "options_considered": [o.to_dict() for o in ranked_options],
            "chosen": chosen_dict,
            "auto_executed": auto_executed,
            "escalated": escalated,
            "reasoning": reasoning,
            "ripple_effects": ripples,
            "affected_bookings": affected_bookings,
        }

    # NO feasible options exist!
    # Explicitly highlight that no option satisfies all hard constraints.
    fallback_best = ranked_options[0]
    fallback_dict = fallback_best.to_dict()
    fallback_dict["is_compromise_fallback"] = True

    ripples = compute_ripple_effects(original_itinerary, fallback_best)
    reasoning = _build_comprehensive_reasoning(
        None, ranked_options, constraints, [], False, True
    )

    return {
        "has_feasible_solution": False,
        "options_considered": [o.to_dict() for o in ranked_options],
        "chosen": fallback_dict,
        "auto_executed": False,
        "escalated": True,
        "reasoning": reasoning,
        "ripple_effects": ripples,
        "affected_bookings": affected_bookings,
    }
