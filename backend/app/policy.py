"""
Traveller Policy & Constraint Enforcement Engine.
Enforces hard constraints (budget, deadline, delay limit, cabin)
and identifies soft preferences and trade-offs.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Tuple, List

from .models import TravellerConstraints, PriorityPreference

DATE_FMT = "%Y-%m-%dT%H:%M:%S"


def _parse_dt(dt_str: str) -> datetime:
    return datetime.strptime(dt_str, DATE_FMT)


def _fmt_time(dt: datetime) -> str:
    return dt.strftime("%b %d, %I:%M %p").replace(" 0", " ")


@dataclass
class Policy:
    """Legacy/default policy structure for backwards compatibility."""
    max_fare_delta: float = 150.0       # dollars
    max_added_delay_minutes: int = 240  # 4 hours
    allow_cabin_downgrade: bool = False
    allow_cabin_upgrade: bool = True     # upgrades are fine, downgrades need approval


DEFAULT_POLICY = Policy()


def within_policy(option, original_cabin: str, policy: Policy = DEFAULT_POLICY) -> tuple[bool, list[str]]:
    """Returns (compliant, list_of_violations). Preserved for backwards compatibility."""
    violations = []
    if option.fare_delta > policy.max_fare_delta:
        violations.append(
            f"fare delta ${option.fare_delta:.2f} exceeds policy max ${policy.max_fare_delta:.2f}"
        )
    if option.delay_minutes > policy.max_added_delay_minutes:
        violations.append(
            f"added delay {option.delay_minutes}min exceeds policy max {policy.max_added_delay_minutes}min"
        )
    if not option.cabin_match:
        new_cabin = option.flight["cabin_class"]
        cabin_rank = {"economy": 0, "business": 1, "first": 2}
        is_upgrade = cabin_rank.get(new_cabin, 0) > cabin_rank.get(original_cabin, 0)
        if is_upgrade and not policy.allow_cabin_upgrade:
            violations.append("cabin upgrade not permitted by policy")
        if not is_upgrade and not policy.allow_cabin_downgrade:
            violations.append(f"cabin downgrade from {original_cabin} to {new_cabin} not permitted")
    return (len(violations) == 0, violations)


def evaluate_option_constraints(
    option,
    original_itinerary: dict,
    constraints: TravellerConstraints
) -> Tuple[bool, List[str], List[str]]:
    """
    Evaluates an option against traveller-configured hard constraints and soft trade-offs.
    
    Hard constraints (mandatory - violations disqualify an option from feasibility):
      1. Maximum additional budget: fare delta <= max_additional_cost
      2. Latest acceptable arrival time: arrival <= latest_arrival_time
      3. Maximum acceptable delay: delay_minutes <= max_delay_minutes
      4. Cabin downgrade: prohibited if must_keep_cabin is True
      5. Cabin upgrade: prohibited if allow_cabin_upgrade is False

    Soft trade-offs (informational preferences):
      - Rebooking vendor changes, hotel adjustments, added cost, added delay.

    Returns:
      (is_feasible, hard_violations, soft_tradeoffs)
    """
    hard_violations: List[str] = []
    soft_tradeoffs: List[str] = []

    # 1. Hard Budget Constraint
    if option.fare_delta > constraints.max_additional_cost:
        hard_violations.append(
            f"Hard budget exceeded: fare delta +${option.fare_delta:.2f} exceeds max additional budget of ${constraints.max_additional_cost:.2f}"
        )

    # 2. Hard Arrival Deadline Constraint
    if constraints.latest_arrival_time:
        try:
            deadline = _parse_dt(constraints.latest_arrival_time)
            new_arrival = _parse_dt(option.flight["arrival"])
            if new_arrival > deadline:
                diff_min = int((new_arrival - deadline).total_seconds() // 60)
                hard_violations.append(
                    f"Arrival deadline violated: arrives at {_fmt_time(new_arrival)} ({diff_min}m after strict {deadline.strftime('%I:%M %p')} deadline)"
                )
        except Exception:
            pass

    # 3. Hard Delay Minutes Constraint
    if constraints.max_delay_minutes is not None and option.delay_minutes > constraints.max_delay_minutes:
        hard_violations.append(
            f"Maximum delay exceeded: +{option.delay_minutes} min exceeds acceptable limit of {constraints.max_delay_minutes} min"
        )

    # 4. Cabin Class Constraints
    orig_cabin = original_itinerary["flight"]["cabin_class"]
    new_cabin = option.flight["cabin_class"]
    cabin_rank = {"economy": 0, "business": 1, "first": 2}
    orig_rank = cabin_rank.get(orig_cabin, 0)
    new_rank = cabin_rank.get(new_cabin, 0)

    if new_rank < orig_rank and constraints.must_keep_cabin:
        hard_violations.append(
            f"Cabin downgrade violation: requested {orig_cabin.title()} but alternative is {new_cabin.title()}"
        )
    if new_rank > orig_rank and not constraints.allow_cabin_upgrade:
        hard_violations.append(
            f"Cabin upgrade not permitted: alternative is {new_cabin.title()}"
        )

    # Soft Trade-offs
    if option.fare_delta > 0:
        soft_tradeoffs.append(f"+${option.fare_delta:.2f} fare delta")
    else:
        soft_tradeoffs.append("No additional fare")

    if option.delay_minutes > 0:
        soft_tradeoffs.append(f"+{option.delay_minutes}m delay vs original")
    else:
        soft_tradeoffs.append("On schedule")

    if option.hotel["hotel_id"] != original_itinerary["hotel"]["hotel_id"]:
        if constraints.must_keep_hotel:
            soft_tradeoffs.append(f"Soft trade-off: switches hotel from {original_itinerary['hotel']['name']} to {option.hotel['name']}")
        else:
            soft_tradeoffs.append(f"Alternative property: {option.hotel['name']}")

    if option.car["car_id"] != original_itinerary["car"]["car_id"]:
        if constraints.must_keep_car_vendor:
            soft_tradeoffs.append(f"Soft trade-off: switches rental from {original_itinerary['car']['vendor']} to {option.car['vendor']}")
        else:
            soft_tradeoffs.append(f"Alternative rental: {option.car['vendor']}")

    is_feasible = (len(hard_violations) == 0)
    return (is_feasible, hard_violations, soft_tradeoffs)
