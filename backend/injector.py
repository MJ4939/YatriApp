"""
Yatri AI — Disruption Injector & Demo CLI.

Fires simulated disruption events, runs the hackathon demo scenario,
or resets the system state from the terminal.

Usage:
    python injector.py demo
    python injector.py reset
    python injector.py single [--pax-id PAX-1001]
    python injector.py storm [--count 12]
"""
import argparse
import sys
import requests

BASE_URL = "http://localhost:8000"


def fire_demo():
    resp = requests.post(f"{BASE_URL}/demo/scenario")
    resp.raise_for_status()
    data = resp.json()
    print("==================================================")
    print("  Yatri AI — PS 4.1 Hackathon Scenario Triggered")
    print("==================================================")
    print(f"Traveller: {data['pax_id']} (Jordan Lee)")
    print(f"Status: {data['status'].upper()}")
    print(f"Feasible Solution: {data['has_feasible_solution']}")
    print(f"Recommended Flight: {data['chosen']['flight']['carrier']} {data['chosen']['flight']['flight_number']}")
    print(f"Reasoning: {data['reasoning']}")
    print(f"Affected Bookings: {len(data['affected_bookings'])} legs")
    print(f"Options Evaluated: {len(data['options_considered'])} options")
    print("==================================================")


def fire_reset():
    resp = requests.post(f"{BASE_URL}/demo/reset")
    resp.raise_for_status()
    print("Yatri AI state reset to pristine demo baseline.")


def fire_single(pax_id: str | None):
    resp = requests.post(
        f"{BASE_URL}/inject/single", params={"pax_id": pax_id} if pax_id else {}
    )
    resp.raise_for_status()
    print("Single disruption injected:", resp.json())


def fire_storm(count: int):
    resp = requests.post(f"{BASE_URL}/inject/storm", params={"count": count})
    resp.raise_for_status()
    data = resp.json()
    print(f"Storm fired: {data['fired']} disruption events processed.")


def main():
    parser = argparse.ArgumentParser(description="Yatri AI Disruption & Demo CLI")
    sub = parser.add_subparsers(dest="mode", required=True)

    sub.add_parser("demo", help="run the PS 4.1 canonical hackathon demonstration scenario")
    sub.add_parser("reset", help="reset Yatri AI demo state to pristine initial baseline")

    single = sub.add_parser("single", help="fire one disruption event")
    single.add_argument("--pax-id", default=None)

    storm = sub.add_parser("storm", help="fire many disruption events in quick succession")
    storm.add_argument("--count", type=int, default=12)

    args = parser.parse_args()
    if args.mode == "demo":
        fire_demo()
    elif args.mode == "reset":
        fire_reset()
    elif args.mode == "single":
        fire_single(args.pax_id)
    elif args.mode == "storm":
        fire_storm(args.count)


if __name__ == "__main__":
    main()
