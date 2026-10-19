"""
Graph engine for Yatri AI — Intelligent Travel Recovery.
No LLM calls in this module.

Models an itinerary as a multi-modal directed acyclic graph:
    START -> flight_alt_1 -> hotel_alt_1 -> car_alt_1 -> END
          -> flight_alt_2 -> hotel_alt_2 -> car_alt_2 -> END
          ...

Graph edge weights are dynamically tuned by traveller priority preference:
  - lowest_cost: heavy fare weighting (4.0x fare, 0.05x minutes)
  - fastest_arrival: heavy delay weighting (4.0x minutes, 0.1x fare)
  - least_disruption: heavy cabin & ripple penalty
  - balanced: balanced multi-objective weighting

Distinguishes hard constraints (budget, deadline, delay, cabin) from soft trade-offs.
Ranks feasible options first, followed by ranked closest fallbacks if infeasible.
Deduplicates alternatives by flight to provide distinct flight recovery paths.
"""
from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional, List, Dict

import networkx as nx

from .models import TravellerConstraints, PriorityPreference
from .policy import evaluate_option_constraints

DATE_FMT = "%Y-%m-%dT%H:%M:%S"


def _parse(dt: str) -> datetime:
    return datetime.strptime(dt, DATE_FMT)


def _fmt(dt: datetime) -> str:
    return dt.strftime("%b %d, %I:%M %p").replace(" 0", " ")


@dataclass
class RankedOption:
    flight: dict
    hotel: dict
    car: dict
    total_weight: float
    delay_minutes: int
    fare_delta: float
    cabin_match: bool
    is_feasible: bool = True
    hard_violations: list[str] = field(default_factory=list)
    soft_tradeoffs: list[str] = field(default_factory=list)
    rejection_reason: Optional[str] = None
    selection_reason: Optional[str] = None
    scoring_breakdown: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "flight": self.flight,
            "hotel": self.hotel,
            "car": self.car,
            "score": round(self.total_weight, 2),
            "delay_minutes": self.delay_minutes,
            "fare_delta": round(self.fare_delta, 2),
            "cabin_match": self.cabin_match,
            "is_feasible": self.is_feasible,
            "hard_violations": self.hard_violations,
            "soft_tradeoffs": self.soft_tradeoffs,
            "rejection_reason": self.rejection_reason,
            "selection_reason": self.selection_reason,
            "scoring_breakdown": self.scoring_breakdown,
        }


class ItineraryGraph:
    """Builds and ranks a multi-modal itinerary graph with constraint awareness."""

    def __init__(self, original_itinerary: dict, inventory: dict):
        self.original = original_itinerary
        self.inventory = inventory
        self.graph = nx.DiGraph()

    def _route_key(self) -> str:
        f = self.original["flight"]
        return f"{f['origin']}-{f['destination']}"

    def _city(self) -> str:
        return self.original["flight"]["destination"]

    def _get_weights(self, priority: Optional[PriorityPreference]) -> tuple[float, float, float]:
        """Returns (minutes_weight, fare_weight, cabin_penalty)."""
        if priority == PriorityPreference.lowest_cost:
            return (0.05, 4.0, 150.0)
        elif priority == PriorityPreference.fastest_arrival:
            return (4.0, 0.1, 100.0)
        elif priority == PriorityPreference.least_disruption:
            return (1.0, 0.5, 400.0)
        return (1.0, 0.5, 150.0)  # balanced default

    def build(self, priority: Optional[PriorityPreference] = None) -> nx.DiGraph:
        g = self.graph
        g.clear()
        route = self._route_key()
        city = self._city()

        flights = self.inventory.get("flights_by_route", {}).get(route, [])
        hotels = self.inventory.get("hotels_by_city", {}).get(city, [])
        cars = self.inventory.get("cars_by_city", {}).get(city, [])

        g.add_node("START")
        g.add_node("END")

        original_arrival = _parse(self.original["flight"]["arrival"])
        original_fare = self.original["flight"]["fare"]
        original_cabin = self.original["flight"]["cabin_class"]

        minutes_weight, fare_weight, cabin_penalty = self._get_weights(priority)

        for i, f in enumerate(flights):
            fnode = ("flight", f["flight_id"])
            g.add_node(fnode, data=f)
            new_arrival = _parse(f["arrival"])
            delay_minutes = max(0, int((new_arrival - original_arrival).total_seconds() // 60))
            fare_delta = max(0.0, f["fare"] - original_fare)
            cabin_match = f["cabin_class"] == original_cabin

            weight = (
                delay_minutes * minutes_weight
                + fare_delta * fare_weight
                + (0 if cabin_match else cabin_penalty)
            )
            g.add_edge("START", fnode, weight=weight)

            for h in hotels:
                # Feasible only if hotel check-in is at or after flight arrival
                checkin = _parse(h["check_in"])
                if checkin < new_arrival:
                    continue
                hnode = ("hotel", h["hotel_id"], f["flight_id"])
                if hnode not in g:
                    g.add_node(hnode, data=h)
                hotel_wait_minutes = max(0, int((checkin - new_arrival).total_seconds() // 60))
                g.add_edge(fnode, hnode, weight=hotel_wait_minutes * 0.1)

                for c in cars:
                    pickup = _parse(c["pickup"])
                    # Feasible only if car can be picked up at/after flight lands
                    if pickup < new_arrival:
                        continue
                    cnode = ("car", c["car_id"], h["hotel_id"], f["flight_id"])
                    if cnode not in g:
                        g.add_node(cnode, data=c)
                    g.add_edge(hnode, cnode, weight=1.0)
                    g.add_edge(cnode, "END", weight=0.0)

        return g

    def rank_options(
        self,
        top_k: int = 5,
        constraints: Optional[TravellerConstraints] = None
    ) -> list[RankedOption]:
        priority = constraints.priority_preference if constraints else None
        g = self.build(priority=priority)
        if "START" not in g or "END" not in g or not g.has_node("END"):
            return []

        try:
            # Explore candidate paths through the multi-modal graph
            paths = list(
                itertools.islice(
                    nx.shortest_simple_paths(g, "START", "END", weight="weight"),
                    25,
                )
            )
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return []

        results: list[RankedOption] = []
        original_arrival = _parse(self.original["flight"]["arrival"])
        original_fare = self.original["flight"]["fare"]
        original_cabin = self.original["flight"]["cabin_class"]

        # Deduplicate by flight_id so each alternative represents a distinct flight path
        seen_flights = set()

        for path in paths:
            flight_node = next(n for n in path if isinstance(n, tuple) and n[0] == "flight")
            hotel_node = next(n for n in path if isinstance(n, tuple) and n[0] == "hotel")
            car_node = next(n for n in path if isinstance(n, tuple) and n[0] == "car")

            flight = g.nodes[flight_node]["data"]
            flight_id = flight["flight_id"]
            if flight_id in seen_flights:
                continue

            hotel = g.nodes[hotel_node]["data"]
            car = g.nodes[car_node]["data"]

            total_weight = sum(
                g[path[i]][path[i + 1]]["weight"] for i in range(len(path) - 1)
            )
            new_arrival = _parse(flight["arrival"])
            delay_minutes = max(0, int((new_arrival - original_arrival).total_seconds() // 60))
            fare_delta = max(0.0, flight["fare"] - original_fare)
            cabin_match = flight["cabin_class"] == original_cabin

            option = RankedOption(
                flight=flight,
                hotel=hotel,
                car=car,
                total_weight=total_weight,
                delay_minutes=delay_minutes,
                fare_delta=fare_delta,
                cabin_match=cabin_match,
                scoring_breakdown={
                    "delay_minutes": delay_minutes,
                    "fare_delta": round(fare_delta, 2),
                    "graph_weight": round(total_weight, 2),
                }
            )

            # Evaluate against traveller constraints if provided
            if constraints:
                is_feasible, hard_violations, soft_tradeoffs = evaluate_option_constraints(
                    option, self.original, constraints
                )
                option.is_feasible = is_feasible
                option.hard_violations = hard_violations
                option.soft_tradeoffs = soft_tradeoffs
                if not is_feasible:
                    option.rejection_reason = " | ".join(hard_violations)
            else:
                option.is_feasible = True

            results.append(option)
            seen_flights.add(flight_id)

        # Distinguish and rank feasible options before non-feasible options
        feasible_opts = [o for o in results if o.is_feasible]
        infeasible_opts = [o for o in results if not o.is_feasible]

        # Feasible options sorted by graph weight (ascending)
        feasible_opts.sort(key=lambda x: x.total_weight)

        # Infeasible options sorted by number of hard violations then weight
        infeasible_opts.sort(key=lambda x: (len(x.hard_violations), x.total_weight))

        # Assign selection reasoning to top feasible option
        if feasible_opts:
            winner = feasible_opts[0]
            f = winner.flight
            deadline_str = ""
            if constraints and constraints.latest_arrival_time:
                try:
                    dl = _parse(constraints.latest_arrival_time)
                    deadline_str = f", arriving safely before your {_fmt(dl)} deadline"
                except Exception:
                    pass
            winner.selection_reason = (
                f"Meets all hard constraints. Top recovery choice on {f['carrier']} {f['flight_number']} "
                f"adding only +${winner.fare_delta:.2f} and {winner.delay_minutes}m delay{deadline_str}."
            )

        # Return feasible options first, followed by fallbacks, limited to top_k
        combined = feasible_opts + infeasible_opts
        return combined[:top_k]


def _minutes(n: int):
    from datetime import timedelta
    return timedelta(minutes=n)
