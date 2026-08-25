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

export default function Invest() {
  const [profile, setProfile] = useState(null);
  const [projection, setProjection] = useState([]);
  const [contribution, setContribution] = useState(10000);
  const [years, setYears] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await api.getInvestmentProfile();
      setProfile(p);
      setContribution(Math.max(1000, Math.round(p.monthly_surplus / 1000) * 1000 || 10000));
      const proj = await api.getProjection({ monthly_contribution: p.monthly_surplus > 0 ? p.monthly_surplus : 10000, years: 10 });
      setProjection(proj);
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
            <LineChart data={projection} margin={{ left: -10, right: 10 }}>
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
              <Line type="monotone" dataKey="invested" stroke="#0F111555" strokeWidth={2} dot={false} name="Invested" />
              <Line type="monotone" dataKey="projected_value" stroke="#1F6F5C" strokeWidth={2.5} dot={false} name="Projected value" />
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
