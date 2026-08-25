# Contributing to FinTrack

Thanks for taking a look. This started as a hackathon prototype for the
*Integrated Data-Driven Personal Finance Platform* problem statement, so the
codebase favors clarity over cleverness — please keep it that way.

## Getting set up

See the **Running it** section in `README.md` for backend/frontend setup.
Short version:

```bash
# backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000

# frontend (separate terminal)
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Ground rules for changes

- **Money math stays in Python, never in a prompt.** Compound growth,
  allocation percentages, and opportunity-cost figures are computed
  deterministically in `services/`. LLM calls (Grok) only narrate numbers
  that were already computed — they never do the arithmetic themselves. Keep
  that boundary if you touch `lesson_engine.py`, `investment_engine.py`, or
  `agent.py`.
- **Every LLM-backed feature needs an offline fallback.** If Grok is
  unavailable, the app should still answer sensibly using a deterministic
  rules path (see `agent._fallback_reply` and `lesson_engine`'s rules
  branch) — this is what keeps the app demoable without a working internet
  connection.
- **3D scenes (`frontend/src/three/`) should read data, not just decorate.**
  If you add a new scene, prefer mapping it to something real (a metric, a
  loading state) over a purely ornamental animation, and make sure it
  respects `prefers-reduced-motion` via `usePrefersReducedMotion`.
- Match the existing editorial visual language (paper/ink/accent-green/gold,
  `Fraunces` display type) rather than introducing a new palette.

## Before opening a PR

- `python -m compileall app` in `backend/` should pass with no errors.
- `npm run build` in `frontend/` should complete cleanly.
- Keep PRs scoped — one feature or fix at a time is much easier to review.

## Reporting issues

Open a GitHub issue with what you expected, what happened instead, and
whether you were on the demo account or a fresh signup (a lot of bugs are
state-dependent between those two).
