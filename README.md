# FinTrack — Track → Learn → Invest

A working prototype for the **Integrated Data-Driven Personal Finance Platform**
problem statement. Built to run standalone (no cloud account needed) with an
optional Grok API key for live AI reasoning.

## The gap this targets

The problem statement itself already identifies the macro-gap correctly:
budgeting apps (Monarch, YNAB), education platforms (Investopedia, Khan
Academy), and robo-advisors (Betterment, Wealthfront) are three disconnected
categories. Nobody closes the loop.

The sharper, still-unsolved gap inside that loop — and the one this build
targets — is **reactive, generic education vs. real-time, causal coaching**:

- Existing "connected" attempts (e.g. bank apps with a tips section) trigger
  content on a *category* ("you spent more on dining"), not on a *behavioral
  pattern* (repeat small spends, subscription stacking, an overdraft trendline).
  Category-level nudges are easy to ignore because they don't feel specific.
- Nobody ties the lesson to a **hard, computed opportunity-cost number** at the
  moment of the transaction — not a vague "save more," but "this exact amount,
  invested, becomes ₹X in 10 years."
- Nobody derives the **investment risk profile from actual cash-flow
  volatility** instead of a one-time onboarding quiz — so the roadmap goes
  stale the moment real behavior diverges from what the user *said* about
  themselves three months ago.

This prototype's distinct twist: a **behavioral trigger engine** watches every
transaction for four specific patterns (overdraft risk, subscription stacking,
impulse repeat-spend, large one-off discretionary spend), generates a
contextual micro-lesson with a real compound-interest opportunity-cost figure,
and continuously re-infers the user's risk appetite and investment allocation
from their trailing 90-day spending volatility — recalculated live, every time
they open the Invest tab.

**Important design choice:** Grok (or any LLM) is used *only* for narrative
reasoning — lesson copy and "why this allocation" explanations. All money math
(compound growth, allocation percentages, opportunity-cost figures) is computed
in plain Python and passed into the model as facts, so the numbers on screen
can never be an LLM hallucination. If no Grok key is configured, the app falls
back to a deterministic rules-based copy engine — the whole product still
works, offline, on stage, with judges' wifi.

## Architecture

```
fintrack-platform/
├── backend/            FastAPI + SQLite (swap for Postgres in prod)
│   └── app/
│       ├── models.py           SQLAlchemy models
│       ├── seed_data.py        90 days of realistic mock transactions
│       ├── services/
│       │   ├── categorizer.py      merchant → category (stand-in for Plaid enrich)
│       │   ├── triggers.py         behavioral pattern detection
│       │   ├── lesson_engine.py    facts → Grok (or rules fallback) → lesson
│       │   ├── investment_engine.py  risk inference + compound-growth math
│       │   ├── agent.py            facts → Grok (or rules fallback) → chat reply
│       │   └── grok_client.py      xAI Grok API wrapper
│       └── routers/            transactions, lessons, investments, settings, agent
└── frontend/           React (Vite) + Tailwind + Recharts + react-three-fiber
    └── src/
        ├── pages/       Dashboard, Ledger, Learn, Invest, Agent, Settings
        ├── three/       Scene.jsx + 3D visualizations (bar sculpture, coin
        │                stacks, agent seal) shared across pages
        └── api.js        talks to the backend, injects the Grok key header
```

## 3D UI/UX

Three pages carry a `react-three-fiber` scene, built to sit inside the
existing paper/ink/gold editorial design rather than look like a bolted-on
game HUD — same palette, same restraint, and every scene is either driven by
real data or gives real feedback about app state, not decoration for its own
sake:

- **Dashboard** — the last 45 days of your running balance rendered as a
  rotatable 3D bar cluster (`GrowthSculpture`). Bars are green on days your
  balance sat at or above its trailing average, coral when it dipped below —
  a literal "in the black / in the red" ledger you can turn in your hand.
- **Invest** — your recommended equity/debt/gold/cash split rendered as four
  physical 3D coin stacks (`AllocationSculpture`), height proportional to
  each asset class's share, instead of an abstract donut chart.
- **AI Agent** — a faceted "wax seal" orb (`AgentSeal`) that idles with a slow
  rotation and spins up with a visible pulse while the agent is composing a
  reply, giving a tactile sense of "it's thinking" beyond a text spinner.

All three respect `prefers-reduced-motion` (auto-rotation and pulsing are
disabled when the OS setting is on) and render on a transparent canvas so the
site's paper background shows through — they're meant to read as another
card on the page, not a separate visual language.

## AI Agent

A conversational financial coach at `/agent`, built on the same "facts
computed in Python, narrated by an LLM" discipline as the rest of the app:

- Every reply is grounded in a facts block built fresh from *your* real
  transactions, spend-by-category totals, subscription detection, and
  inferred risk/allocation profile — the model is instructed to use only
  those numbers and to say so, rather than invent one, if something isn't in
  the facts it was given.
- Conversation history persists per user (`AgentMessage` table), so it's a
  real multi-turn agent with memory, not a stateless Q&A box.
- If no Grok key is configured (or the API call fails for any reason), the
  agent falls back to a deterministic, keyword-routed rules engine that still
  answers from the same real numbers — so the "AI Agent" tab never goes blank
  on judges' wifi. Each reply is labeled `Grok` or `Offline rules engine` so
  it's always clear which path answered.
- Reuses the exact same Grok key resolution as the rest of the app (Settings
  page → `X-Grok-Key` header, or `GROK_API_KEY` in `backend/.env` as a
  server-wide default) — nothing new to configure.


## Accounts & login

The app now has real authentication: email + password signup, bcrypt-hashed
passwords, and JWT session tokens (`python-jose`). There's no third-party
auth provider to configure — it's self-contained.

- **New account:** go to `/signup`, and your account starts empty (no seeded
  transactions) — a realistic "just connected my bank" state.
- **Demo account:** click "Use demo account" on the login screen, or log in
  manually with `demo@fintrack.app` / `fintrack-demo`. This is the account
  that gets the 90 days of seeded transactions, so it's the fastest way to
  see the full track → learn → invest loop working end to end.
- Every API route except `/api/auth/*` and `/api/health` requires a valid
  `Authorization: Bearer <token>` header; the frontend attaches this
  automatically once you're logged in, and clears it (sending you back to
  `/login`) if a token expires or is rejected.
- Set `JWT_SECRET_KEY` in `backend/.env` for stable sessions across server
  restarts (generate one with `python -c "import secrets; print(secrets.token_hex(32))"`).
  If you don't set it, the backend generates a random one at startup so the
  demo still works — sessions just won't survive a restart.

This satisfies the "OAuth2/JWT for Review 2" note from the original tech
stack; swapping in a third-party OAuth provider (Google/GitHub login) later
is additive and doesn't require changing this token flow.

## Running it

### Option A — Docker Compose (recommended)

```bash
docker compose up --build
```

- Backend: http://localhost:8000 (docs at `/docs`)
- Frontend: http://localhost:4173

### Option B — Run locally (e.g. inside Antigravity / any IDE terminal)

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # optionally paste a GROK_API_KEY here as a server-wide default
uvicorn app.main:app --reload --port 8000
```

**Frontend** (separate terminal):
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Open http://localhost:5173.

The database auto-seeds a demo user ("Aditi Rao", `demo@fintrack.app` /
`fintrack-demo`) with 90 days of realistic transactions on first backend
startup — nothing to configure to see it working. Log in with those
credentials, or create your own account, which starts empty.

## Adding your Grok API key

Two ways, and they compose (per-request always wins):

1. **Per-user, no restart needed:** open the app → **Settings** → paste your
   `xai-...` key → Save. It's stored in the browser and sent as an
   `X-Grok-Key` header on every API call. Click "Test connection" to verify.
2. **Server-wide default:** put it in `backend/.env` as `GROK_API_KEY=...` so
   the whole team's demo runs on one shared key without every teammate needing
   their own.

Get a key at [console.x.ai](https://console.x.ai).

## Review-phase alignment

- **Review 1 (logic/foundation):** this repo *is* that milestone — seeded
  data, working categorizer, trigger detection, and one full vertical slice
  (transaction → lesson) already wired end to end and tested.
- **Review 2 (prototype/integration):** swap SQLite → Postgres in
  `DATABASE_URL`, wire a real Plaid sandbox connection in place of
  `seed_data.py`, and replace `categorizer.py`'s keyword table with the
  scikit-learn classifier the original PS calls for. The API surface and
  frontend don't need to change for either swap.

## Real (non-mocked) pieces already in this build

- Full FastAPI + SQLAlchemy backend with real endpoints, real SQL aggregation
  for spend summaries, real compound-interest math for projections.
- A genuine rule-based behavioral trigger system (not hardcoded per-transaction).
- A real Grok API integration with a tested fallback path, used for both the
  lesson engine and the AI Agent chat.
- A React frontend with a real react-three-fiber 3D layer. **Note:** this
  packaging environment had no network access, so `npm install` / `npm run
  build` could not be executed here — all new/changed files were checked for
  syntax errors with the TypeScript compiler in JSX mode, but you should run
  `npm install && npm run build` yourself before deploying, per the steps
  below.

## What's mocked, on purpose, for a hackathon prototype

- Bank data comes from `seed_data.py` instead of a live Plaid connection
  (Plaid requires an approved developer account and bank credentials that
  can't be provisioned for a demo package — swapping it in is a Review 2 task,
  noted above).
- Auth is email/password + JWT rather than a third-party OAuth provider —
  swapping in Google/GitHub login for Review 2 is additive on top of this.
