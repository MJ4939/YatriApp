"""
Pydantic schemas for Yatri AI — Intelligent Travel Recovery.
Deterministic ingestion, constraint modeling, and recovery simulation.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class DisruptionStatus(str, Enum):
    cancelled = "cancelled"
    delayed = "delayed"
    missed_connection = "missed_connection"


class DisruptionType(str, Enum):
    flight = "flight"
    hotel = "hotel"
    transport = "transport"
    weather = "weather"


class PriorityPreference(str, Enum):
    balanced = "balanced"
    lowest_cost = "lowest_cost"
    fastest_arrival = "fastest_arrival"
    least_disruption = "least_disruption"


class TravellerConstraints(BaseModel):
    """
    Traveller-configurable constraints distinguishing hard constraints
    from soft trade-off preferences.
    """
    # Hard constraints
    max_additional_cost: float = Field(
        default=150.0,
        ge=0.0,
        description="Hard ceiling on additional recovery fare/cost (USD)."
    )
    latest_arrival_time: Optional[str] = Field(
        default=None,
        description="Hard deadline ISO timestamp (e.g. '2026-11-15T19:00:00')."
    )
    max_delay_minutes: Optional[int] = Field(
        default=240,
        ge=0,
        description="Hard ceiling on acceptable minutes of arrival delay."
    )
    must_keep_cabin: bool = Field(
        default=True,
        description="Hard constraint: strictly prohibit cabin downgrade."
    )

    # Soft preferences
    allow_cabin_upgrade: bool = Field(
        default=True,
        description="Permit cabin upgrades if within additional budget."
    )
    priority_preference: PriorityPreference = Field(
        default=PriorityPreference.balanced,
        description="Ranking priority: balanced, lowest_cost, fastest_arrival, or least_disruption."
    )
    must_keep_hotel: bool = Field(
        default=False,
        description="Soft preference: strongly prefer original hotel property."
    )
    must_keep_car_vendor: bool = Field(
        default=False,
        description="Soft preference: strongly prefer original car vendor."
    )
    required_commitments: Optional[str] = Field(
        default=None,
        description="Human-readable context e.g. 'Keynote speech at 19:30'."
    )


class DisruptionEvent(BaseModel):
    """Shape of an inbound disruption webhook or simulation payload."""

    flight_id: str = Field(..., min_length=1)
    status: DisruptionStatus
    pax_id: str = Field(..., min_length=1)
    original_itinerary: str = Field(
        ..., description="Itinerary/booking reference this disruption applies to"
    )
    delay_minutes: Optional[int] = Field(
        default=None, ge=0, description="Required when status == 'delayed'"
    )
    disruption_type: DisruptionType = Field(default=DisruptionType.flight)
    severity: str = Field(default="critical", description="Severity: critical, major, moderate")
    reason: Optional[str] = Field(
        default=None,
        description="Root cause (e.g. 'Aircraft mechanical issue' or 'Severe thunderstorm warning')"
    )

    @field_validator("delay_minutes")
    @classmethod
    def delay_required_when_delayed(cls, v, info):
        status = info.data.get("status")
        if status == DisruptionStatus.delayed and v is None:
            raise ValueError("delay_minutes is required when status is 'delayed'")
        return v


class SimulationRequest(BaseModel):
    """Payload to trigger a simulated disruption with custom traveller constraints."""
    pax_id: str = Field(..., min_length=1)
    status: DisruptionStatus = Field(default=DisruptionStatus.cancelled)
    delay_minutes: Optional[int] = Field(default=None)
    reason: Optional[str] = Field(default="Carrier cancelled inbound equipment due to mechanical issue")
    constraints: Optional[TravellerConstraints] = None


class IngestResult(BaseModel):
    accepted: bool
    event_id: Optional[str] = None
    reason: Optional[str] = None
    received_at: datetime = Field(default_factory=datetime.utcnow)
