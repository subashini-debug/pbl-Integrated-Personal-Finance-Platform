import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { api } from "../api.js";
import { Card, Eyebrow, Loading, ErrorBanner, formatINR } from "../components/UI.jsx";
import Scene from "../three/Scene.jsx";
import AllocationSculpture from "../three/AllocationSculpture.jsx";

const ALLOC_COLORS = {
  equity_pct: "#1F6F5C",
  debt_pct: "#2E8B73",
  gold_pct: "#C9A24B",
  cash_pct: "#0F111533",
};
// Flat opacity-free variants for the 3D scene -- WebGL materials can't parse
// the 8-digit (alpha) hex used for the 2D "cash" swatch above.
const ALLOC_COLORS_3D = {
  equity_pct: "#1F6F5C",
  debt_pct: "#2E8B73",
  gold_pct: "#C9A24B",
  cash_pct: "#9A9EA6",
};
const ALLOC_LABELS = {
  equity_pct: "Equity",
  debt_pct: "Debt",
  gold_pct: "Gold",
  cash_pct: "Cash",
};

const GOAL_LINE_COLORS = ["#C9645C", "#3B6FA0", "#8A5FB0", "#B08A3B"];

export default function Invest() {
  const [profile, setProfile] = useState(null);
  const [projection, setProjection] = useState([]);
  const [contribution, setContribution] = useState(10000);
  const [years, setYears] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [goals, setGoals] = useState([]);
  const [goalName, setGoalName] = useState("");
  const [goalAmount, setGoalAmount] = useState(1000000);
  const [goalYears, setGoalYears] = useState(5);
  const [goalError, setGoalError] = useState(null);
  const [savingGoal, setSavingGoal] = useState(false);

  const loadGoals = async () => {
    try {
      setGoals(await api.getGoals());
    } catch (e) {
      setGoalError(e.message);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await api.getInvestmentProfile();
      setProfile(p);
      setContribution(Math.max(1000, Math.round(p.monthly_surplus / 1000) * 1000 || 10000));
      const proj = await api.getProjection({ monthly_contribution: p.monthly_surplus > 0 ? p.monthly_surplus : 10000, years: 10 });
      setProjection(proj);
      await loadGoals();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addGoal = async (e) => {
    e.preventDefault();
    setGoalError(null);
    if (!goalName.trim() || goalAmount <= 0 || goalYears <= 0) {
      setGoalError("Give the goal a name, a target amount, and a horizon in years.");
      return;
    }
    setSavingGoal(true);
    try {
      await api.createGoal({ name: goalName.trim(), target_amount: goalAmount, target_years: goalYears });
      setGoalName("");
      await loadGoals();
    } catch (e) {
      setGoalError(e.message);
    } finally {
      setSavingGoal(false);
    }
  };

  const removeGoal = async (id) => {
    try {
      await api.deleteGoal(id);
      await loadGoals();
    } catch (e) {
      setGoalError(e.message);
    }
  };

  // Merge the general SIP projection with each goal's own trajectory into
  // one array keyed by year, so recharts can draw them as extra lines on
  // the same chart without a second <LineChart>.
  const mergedChartData = (() => {
    const byYear = new Map();
    for (const point of projection) {
      byYear.set(point.year, { year: point.year, invested: point.invested, projected_value: point.projected_value });
    }
    goals.forEach((g, idx) => {
      for (const point of g.projection) {
        const row = byYear.get(point.year) || { year: point.year };
        row[`goal_${idx}`] = point.projected_value;
        byYear.set(point.year, row);
      }
    });
    return Array.from(byYear.values()).sort((a, b) => a.year - b.year);
  })();

  const updateProjection = async (newContribution, newYears) => {
    try {
      const proj = await api.getProjection({ monthly_contribution: newContribution, years: newYears });
      setProjection(proj);
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <Loading label="Inferring your risk profile from cash-flow volatility…" />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!profile) return null;

  const allocKeys = ["equity_pct", "debt_pct", "gold_pct", "cash_pct"];
  const lastPoint = projection[projection.length - 1];

  return (
    <div className="space-y-8">
      <div>
        <Eyebrow>Derived from your last 90 days, not a quiz</Eyebrow>
        <h1 className="font-display text-3xl">Invest</h1>
        <p className="text-ink/60 mt-1 max-w-lg">
          This roadmap re-calculates every time you open this tab, from your actual
          spending volatility and surplus — not a one-time onboarding answer.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <Eyebrow>Risk profile</Eyebrow>
          <h2 className="font-display text-2xl mb-1">{profile.risk_label}</h2>
          <p className="text-sm text-ink/50 mb-5">Score: {profile.risk_score}/100</p>

          <div className="h-3 rounded-full bg-ink/5 overflow-hidden flex mb-6">
            {allocKeys.map((k) => (
              <div
                key={k}
                style={{ width: `${profile[k]}%`, background: ALLOC_COLORS[k] }}
                title={`${ALLOC_LABELS[k]}: ${profile[k]}%`}
              />
            ))}
          </div>

          <ul className="space-y-2.5 text-sm">
            {allocKeys.map((k) => (
              <li key={k} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: ALLOC_COLORS[k] }} />
                  {ALLOC_LABELS[k]}
                </span>
                <span className="font-medium">{profile[k]}%</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 pt-5 border-t border-ink/5">
            <p className="text-xs text-ink/45 uppercase tracking-wide font-semibold mb-1">
              Est. monthly surplus
            </p>
            <p className="font-display text-2xl">{formatINR(profile.monthly_surplus)}</p>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <Eyebrow>Compound growth</Eyebrow>
          <h2 className="font-display text-xl mb-4">
            What your surplus could become
          </h2>

          <div className="flex flex-wrap gap-6 mb-5">
            <label className="text-sm">
              <span className="block text-ink/50 mb-1">Monthly SIP (₹)</span>
              <input
                type="number"
                value={contribution}
                min={500}
                step={500}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setContribution(v);
                  updateProjection(v, years);
                }}
                className="w-36 px-3 py-2 rounded-lg border border-ink/15 text-sm focus:border-accent outline-none"
              />
            </label>
            <label className="text-sm">
              <span className="block text-ink/50 mb-1">Years</span>
              <input
                type="number"
                value={years}
                min={1}
                max={30}
                onChange={(e) => {
                  const v = Number(e.target.value) || 1;
                  setYears(v);
                  updateProjection(contribution, v);
                }}
                className="w-24 px-3 py-2 rounded-lg border border-ink/15 text-sm focus:border-accent outline-none"
              />
            </label>
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={mergedChartData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid stroke="#0F111510" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#0F1115AA" }} axisLine={false} tickLine={false} unit="y" />
              <YAxis
                tick={{ fontSize: 11, fill: "#0F1115AA" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`}
                width={55}
              />
              <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ borderRadius: 12, border: "1px solid #0F111514", fontSize: 13 }} />
              <Line type="monotone" dataKey="invested" stroke="#0F111555" strokeWidth={2} dot={false} name="Invested" connectNulls />
              <Line type="monotone" dataKey="projected_value" stroke="#1F6F5C" strokeWidth={2.5} dot={false} name="Projected value" connectNulls />
              {goals.map((g, idx) => (
                <Line
                  key={g.id}
                  type="monotone"
                  dataKey={`goal_${idx}`}
                  stroke={GOAL_LINE_COLORS[idx % GOAL_LINE_COLORS.length]}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                  name={g.name}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {lastPoint && (
            <p className="text-sm text-ink/60 mt-3">
              After {years} years of ₹{contribution.toLocaleString("en-IN")}/month, projected value is{" "}
              <span className="font-semibold text-accent">{formatINR(lastPoint.projected_value)}</span> against{" "}
              {formatINR(lastPoint.invested)} invested.
            </p>
          )}
        </Card>
      </div>

      <Card>
        <Eyebrow>Tell us what you're saving for</Eyebrow>
        <h2 className="font-display text-xl mb-4">Goals</h2>

        <form onSubmit={addGoal} className="flex flex-wrap items-end gap-4 mb-6">
          <label className="text-sm">
            <span className="block text-ink/50 mb-1">Goal name</span>
            <input
              type="text"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="e.g. House down payment"
              className="w-56 px-3 py-2 rounded-lg border border-ink/15 text-sm focus:border-accent outline-none"
            />
          </label>
          <label className="text-sm">
            <span className="block text-ink/50 mb-1">Target amount (₹)</span>
            <input
              type="number"
              value={goalAmount}
              min={1000}
              step={1000}
              onChange={(e) => setGoalAmount(Number(e.target.value) || 0)}
              className="w-36 px-3 py-2 rounded-lg border border-ink/15 text-sm focus:border-accent outline-none"
            />
          </label>
          <label className="text-sm">
            <span className="block text-ink/50 mb-1">In years</span>
            <input
              type="number"
              value={goalYears}
              min={1}
              max={50}
              onChange={(e) => setGoalYears(Number(e.target.value) || 1)}
              className="w-24 px-3 py-2 rounded-lg border border-ink/15 text-sm focus:border-accent outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={savingGoal}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/90 disabled:opacity-50"
          >
            {savingGoal ? "Adding…" : "Add goal"}
          </button>
        </form>

        {goalError && <p className="text-sm text-coral mb-4">{goalError}</p>}

        {goals.length === 0 ? (
          <p className="text-sm text-ink/50">
            No goals yet — add one above and it'll show up as a dashed line on the chart.
          </p>
        ) : (
          <ul className="space-y-3">
            {goals.map((g, idx) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-4 p-3 rounded-lg border border-ink/10"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: GOAL_LINE_COLORS[idx % GOAL_LINE_COLORS.length] }}
                  />
                  <div>
                    <p className="font-medium text-sm">{g.name}</p>
                    <p className="text-xs text-ink/50">
                      {formatINR(g.target_amount)} in {g.target_years}y — needs{" "}
                      {formatINR(g.required_monthly_sip)}/mo
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      g.on_track ? "bg-accent/10 text-accent" : "bg-coral/10 text-coral"
                    }`}
                  >
                    {g.on_track ? "On track" : "Behind"}
                  </span>
                  <button
                    onClick={() => removeGoal(g.id)}
                    className="text-xs text-ink/40 hover:text-coral"
                    aria-label={`Remove goal ${g.name}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <Eyebrow>Same allocation, as physical coin stacks</Eyebrow>
        <h2 className="font-display text-xl mb-3">Where each rupee sits</h2>
        <Scene height={260} ariaLabel="Rotatable 3D coin stacks showing investment allocation">
          <AllocationSculpture
            segments={allocKeys.map((k) => ({
              key: k,
              label: ALLOC_LABELS[k],
              pct: profile[k],
              color: ALLOC_COLORS_3D[k],
            }))}
          />
        </Scene>
        <p className="text-xs text-ink/45 mt-2">
          Drag to rotate. Each stack's height is that asset class's share of your
          recommended allocation.
        </p>
      </Card>
    </div>
  );
}
