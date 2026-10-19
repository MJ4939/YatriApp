# Yatri AI — Intelligent Travel Recovery

**Hackathon Problem Statement: PS 4.1 — AI Agent for Travel Disruption Recovery**

**Visual Identity: Yatri AI — Intelligent Travel Recovery**

Yatri AI is an autonomous, multi-modal travel disruption recovery engine designed for high-stress travel incidents. When a flight is cancelled or severely delayed, Yatri AI detects the disruption, evaluates the ripple effects across dependent hotel and car bookings, enforces strict traveller-configured hard constraints (budget ceilings, arrival deadlines, cabin class retention), and optimizes recovery options via a multi-modal directed graph.

Everything runs on deterministic graph optimization with optional LLM natural language explanations (Anthropic Claude or deterministic template fallback) and honest sandbox simulation data.

---

## Key Highlights

- **Multi-Modal Graph Optimization**: Formulates the journey as a directed graph (`START → Flight → Hotel → Car → END`). Uses NetworkX Dijkstra-style ranking (`shortest_simple_paths`) with dynamic weights for multi-objective optimization.
- **Hard Constraints vs. Soft Preferences**:
  - **Hard Constraints**: Non-negotiable limits—maximum additional budget cap, strict latest arrival deadline, maximum acceptable delay, and strict cabin class downgrade prohibitions. Infeasible options are disqualified and never silently booked.
  - **Soft Preferences**: Flexible trade-offs—priority weighting (`fastest_arrival`, `lowest_cost`, `least_disruption`, `balanced`), preferred hotel property, and preferred rental car vendor.
- **Transparent Decision Rationale**: Every proposed recovery plan explains *why* the winning alternative was selected and *why* specific rejected alternatives were disqualified.
- **No-Feasible-Option Safety**: When no alternative satisfies all hard constraints, Yatri AI explicitly flags the conflict, alerts the traveller, and surfaces the closest compromise options with red violation warnings instead of silently violating rules.
- **Multi-Modal Ripple Effect Engine**: Automatically shifts hotel check-in times and airport car rental pickup windows to line up with revised touchdown times.
- **Auditable & Honest Workflow**: Every action is immutably recorded to an audit trail (`/audit-log`). Escalated rebookings require explicit traveller approval. All mock inventories and simulated confirmations are clearly identified.

---

## System Architecture

```
Layer 1: Ingestion (Deterministic, Pydantic, Zero LLM)
   │  POST /webhook/disruption or POST /disruptions/simulate
   │  Pydantic validation → In-memory async pipeline queue
   ▼
Layer 2: Multi-Modal Graph Optimization (NetworkX)
   │  Constructs DAG: Flight alternatives → Hotel accommodations → Car rentals
   │  Edge weights dynamically tuned by Traveller Priority Preference:
   │    - fastest_arrival: 4.0x delay penalty, 0.1x fare weight
   │    - lowest_cost:     4.0x fare delta weight, 0.05x delay weight
   │    - least_disruption: 400.0 cabin penalty + property retention weight
   │    - balanced:        1.0x delay weight, 0.5x fare weight, 150.0 cabin penalty
   ▼
Layer 3: Constraint Enforcement & Policy Guardrails
   │  Hard check: Fare delta <= max_additional_cost
   │  Hard check: Arrival <= latest_arrival_time
   │  Hard check: Delay <= max_delay_minutes
   │  Hard check: Cabin downgrade prohibited if must_keep_cabin == True
   │  Ranks feasible alternatives first; disqualifies and explains violations
   ▼
Layer 4: Agentic Decision & Ripple Re-anchoring
   │  Evaluates automated execution policy vs. escalation for approval
   │  Calculates ripple shifts on dependent hotel check-in & car pickup
   │  Produces comprehensive natural language explanation (Claude or template)
   ▼
Layer 5: Communication & Audit Logging
   │  Member notification dispatch + Immutable audit entry (/audit-log)
   │  Interactive UI approval / decline workflow
```

---

## Deterministic Hackathon Demonstration Scenario

Yatri AI includes a pre-configured, 100% deterministic demonstration scenario matching **PS 4.1**:

1. **Traveller Profile**: Jordan Lee (`PAX-1001`), traveling from San Francisco (`SFO`) to Chicago (`ORD`).
2. **Original Bookings**:
   - Primary Flight: United `UA 812` (Departs 09:15, Arrives 15:20, Fare $412.00, Economy)
   - Hotel: The Langham Chicago (Check-in 16:00, $289.00/night)
   - Rental Car: Hertz Midsize (Pickup 16:30)
   - Onward Schedule Commitment: Keynote address at Chicago Tech Summit at 19:30.
3. **Traveller Hard Constraints**:
   - Hard Budget Cap: **$100.00** additional cost max.
   - Strict Arrival Deadline: **19:00:00** (7:00 PM) hard deadline.
   - Priority Preference: **Fastest Arrival**.
4. **Primary Disruption**: `UA 812` is cancelled due to an aircraft mechanical issue.
5. **System Evaluation**:
   - Identifies affected bookings: Flight cancelled, Langham check-in at risk, Hertz pickup expiring.
   - Disqualifies United `UA 902` (+$478 fare delta > $100 budget; arrives 20:10 > 19:00 deadline).
   - Disqualifies Southwest `WN 310` (Departs next morning, arrives 14:05 next day).
   - Identifies feasible candidates: United `UA 814` (+$18 fare delta, arrives 17:05) and American `AA 220` (+$53 fare delta, arrives 18:40).
   - Ranks **`UA 814` as the optimal recovery plan**: arrives 1 hour 55 minutes prior to the 19:00 deadline with only $18.00 added fare.
   - Automatically synchronizes hotel check-in to 18:00 and rental car pickup to 17:45.
   - Surfaces recovery plan to dashboard for traveller inspection and approval.

---

## Repository Structure

```
├── backend/
│   ├── app/
│   │   ├── models.py           # Pydantic schemas (Disruptions, TravellerConstraints, Ingestion)
│   │   ├── graph_engine.py     # NetworkX multi-modal DAG & constraint ranking
│   │   ├── policy.py           # Hard constraints evaluation & soft trade-offs
│   │   ├── agent.py            # Decision logic, ripple effect computation, explanation
│   │   ├── communication.py   # Yatri AI traveller notification dispatch
│   │   ├── audit.py            # In-memory auditable decision store
│   │   ├── metrics.py          # Operational telemetry and latency tracker
│   │   ├── main.py             # FastAPI application & REST APIs
│   │   └── tests/              # Pytest test suite (12 tests)
│   │       ├── test_graph_engine.py
│   │       └── test_constraints_and_recovery.py
│   ├── fixtures/
│   │   ├── itineraries.json    # Seeded future itineraries (Nov 2026)
│   │   └── inventory.json      # Multi-modal flight, hotel, and car inventory
│   ├── injector.py             # CLI disruption injector & demo scenario runner
│   ├── requirements.txt        # Python backend dependencies
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Main dashboard layout & real-time polling
│   │   ├── api.js              # REST client for backend endpoints
│   │   ├── components/
│   │   │   ├── DisruptionAlertBanner.jsx   # Prominent disruption & cascade alert
│   │   │   ├── ItineraryComparison.jsx     # Side-by-side original vs revised plan
│   │   │   ├── AlternativeOptionsGrid.jsx  # Candidate options, feasibility & trade-offs
│   │   │   ├── ConstraintEditor.jsx        # Hard budget, deadline & priority editor
│   │   │   ├── RecoveryActionHub.jsx       # Reasoning & traveller approval controls
│   │   │   ├── ItineraryBoard.jsx          # Boarding pass traveller profile cards
│   │   │   ├── InjectorControls.jsx        # Simulation controls & storm mode
│   │   │   ├── LiveFeed.jsx                # 6-stage autonomous pipeline feed
│   │   │   ├── AuditLog.jsx                # Searchable audit trail table
│   │   │   └── StatsPanel.jsx              # Operational telemetry metrics
│   │   ├── index.css           # Styling with custom theme
│   │   └── main.jsx
│   ├── public/
│   │   └── favicon.svg         # Yatri AI brand icon
│   ├── index.html              # Branded entrypoint
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── Dockerfile
│
├── docker-compose.yml
└── README.md
```

---

## Quick Start Instructions

### Option A: Local Development (Recommended)

**Terminal 1 — Backend (FastAPI)**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend (Vite + React)**
```bash
cd frontend
npm install
npm run dev
```

Open your browser at **http://localhost:5173**.

*Optional*: Export `ANTHROPIC_API_KEY` before launching the backend to generate Claude LLM recovery summaries. When omitted, Yatri AI automatically uses its comprehensive deterministic reasoning engine with zero external dependencies.

---

### Option B: Docker Compose (One Command)

```bash
docker-compose up --build
```

- **Frontend**: http://localhost:5173
- **Backend API Docs**: http://localhost:8000/docs

---

## CLI Disruption Injector

You can also trigger disruptions directly from your terminal:

```bash
cd backend

# Run the canonical PS 4.1 Hackathon Scenario (Jordan Lee flight cancellation):
python injector.py demo

# Fire a single random disruption:
python injector.py single

# Fire a specific disruption for a member:
python injector.py single --pax-id PAX-1001

# Fire a storm burst (12 rapid disruptions) to test concurrency:
python injector.py storm --count 12

# Reset demo state to clean baseline:
python injector.py reset
```

---

## Key API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/demo/scenario` | Executes canonical PS 4.1 Jordan Lee cancellation scenario |
| `POST` | `/demo/reset` | Resets all in-memory state, metrics, feed, and audit log |
| `POST` | `/disruptions/simulate` | Simulates disruption with custom traveller constraints |
| `GET` | `/disruptions/active/{pax_id}` | Retrieves active disruption and recovery package for a member |
| `GET` | `/constraints/{pax_id}` | Retrieves active hard constraints and soft preferences |
| `POST` | `/constraints/{pax_id}` | Updates traveller constraints |
| `GET` | `/itineraries` | Retrieves all seeded member itineraries |
| `GET` | `/feed?since=N` | Polls real-time pipeline stage transitions |
| `GET` | `/audit-log` | Retrieves complete immutable decision audit trail |
| `POST` | `/audit-log/{id}/approve` | Approves an escalated recovery plan |
| `POST` | `/audit-log/{id}/decline` | Declines an escalated recovery plan |
| `GET` | `/metrics` | Retrieves operational latency and auto-resolution telemetry |

---

## Running the Automated Test Suite

To verify backend graph algorithms, constraint enforcement, and API functionality:

```bash
cd backend
python -m pytest -v
```

### Verified Test Cases (12/12 Passing):

1. `test_hard_budget_constraint_rejects_expensive_options`: Validates that options exceeding additional budget are disqualified and rejected with explicit violation reasons.
2. `test_arrival_deadline_hard_constraint`: Validates that options landing after the strict cutoff are disqualified.
3. `test_no_feasible_option_surfaces_clear_warnings_and_does_not_silently_violate`: Validates that when no alternative satisfies all hard constraints, the system explicitly flags the condition, does not auto-execute, and presents closest alternatives with warnings.
4. `test_priority_preference_ranking_lowest_cost_vs_fastest_arrival`: Validates that tuning priority preference shifts graph ranking between lowest cost and earliest arrival.
5. `test_affected_bookings_impact_analysis`: Validates multi-modal impact cascade detection across flight, hotel, and car.
6. `test_demo_scenario_and_reset_endpoints`: Validates end-to-end `/demo/scenario` and `/demo/reset` API endpoints.
7. `test_ranks_alternatives_for_economy_itinerary`: Validates graph shortest path sorting.
8. `test_business_cabin_itinerary_prefers_cabin_match`: Validates cabin class preference retention.
9. `test_auto_execute_within_policy`: Validates auto-execution when all constraints and policies are met.
10. `test_escalation_when_no_option_is_compliant`: Validates escalation for member authorization.
11. `test_ripple_effects_present_when_hotel_or_car_shift`: Validates dependent hotel and car adjustment computation.
12. `test_malformed_status_rejected_by_schema`: Validates Pydantic ingestion validation.

---

## Honest Limitations & Hackathon Boundaries

- **Simulated GDS & Inventory**: All airline schedules, fares, hotel properties, and car rentals are drawn from local synthetic fixtures (`backend/fixtures/`).
- **Simulated Ticketing**: Approving a recovery plan updates the internal state, issues a simulated PNR code, and writes to the audit log. It does not communicate with live Sabre/Amadeus or process real credit cards.
- **In-Memory Pipeline**: Event queues, audit entries, and active disruptions are stored in process memory for maximum portability and zero setup overhead. For production scale, replace with PostgreSQL and Redis.
