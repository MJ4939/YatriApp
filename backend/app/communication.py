"""
Communication layer (agentic) for Yatri AI — Intelligent Travel Recovery.
Generates concise, member-facing notification text and action directives.
"""
from __future__ import annotations

from datetime import datetime


def build_notification(pax_id: str, member_name: str, decision: dict, event) -> dict:
    flight_id = getattr(event, "flight_id", "Flight")
    status_str = getattr(event, "status", None)
    status_val = status_str.value if hasattr(status_str, "value") else str(status_str or "disrupted")

    has_feasible = decision.get("has_feasible_solution", True)

    if not has_feasible:
        message = (
            f"Yatri AI Alert: Hi {member_name}, your flight {flight_id} was {status_val}. "
            f"No alternative option satisfies all your constraints without a compromise: {decision['reasoning']} "
            f"Review closest alternatives and approve a waiver, or decline to arrange alternative travel."
        )
        action_needed = "approve_or_decline"
    elif decision["escalated"]:
        message = (
            f"Yatri AI Alert: Hi {member_name}, your flight {flight_id} was {status_val}. "
            f"We formulated a recovery plan matching your constraints: {decision['reasoning']} "
            f"Tap 'Approve' to confirm simulated rebooking, or 'Decline' to explore other options."
        )
        action_needed = "approve_or_decline"
    else:
        message = (
            f"Yatri AI Update: Hi {member_name}, your flight {flight_id} was {status_val}. "
            f"Autonomous recovery executed: {decision['reasoning']} "
            f"Your hotel and rental car reservations have been synchronized. No manual action required."
        )
        action_needed = "none"

    return {
        "pax_id": pax_id,
        "message": message,
        "action_needed": action_needed,
        "created_at": datetime.utcnow().isoformat(),
        "sender": "Yatri AI Concierge",
    }
