import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { api } from "../api.js";
import { Card, Eyebrow, Loading, ErrorBanner, formatINR } from "../components/UI.jsx";
import Scene from "../three/Scene.jsx";
import GrowthSculpture from "../three/GrowthSculpture.jsx";

const PALETTE = ["#1F6F5C", "#2E8B73", "#C9A24B", "#D9694F", "#7C9885", "#9A6B4F", "#4A6670", "#B5883E"];

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .getSummary()
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <Loading label="Pulling your latest numbers…" />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!summary) return null;

  const categoryData = Object.entries(summary.by_category)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  const balanceData = summary.daily_balance.slice(-45).map((d) => ({
    date: d.date.slice(5),
    balance: d.balance,
  }));

  const recent = summary.daily_balance.slice(-45);
  const balance3D = recent
    .filter((_, i) => i % 2 === 0)
    .map((d) => ({ value: d.balance }));

  return (
    <div className="space-y-8">
      <div>
        <Eyebrow>Last 90 days</Eyebrow>
        <h1 className="font-display text-3xl">Good to see you, Aditi.</h1>
        <p className="text-ink/60 mt-1">
          Here's what your money has been doing — and where the loop kicks in.
        </p>
      </div>

      {balance3D.length > 1 && (
        <Card>
          <Eyebrow>Your balance, as a ledger you can turn</Eyebrow>
          <h2 className="font-display text-xl mb-3">The last 45 days, in 3D</h2>
          <Scene height={280} ariaLabel="Rotatable 3D bar sculpture of your running balance">
            <GrowthSculpture points={balance3D} />
          </Scene>
          <p className="text-xs text-ink/45 mt-2">
            Drag to rotate. Green bars sat at or above your trailing average that day —
            coral bars dipped below it.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <Eyebrow>Total income</Eyebrow>
          <p className="font-display text-3xl">{formatINR(summary.total_income)}</p>
        </Card>
        <Card>
          <Eyebrow>Total spend</Eyebrow>
          <p className="font-display text-3xl text-coral">{formatINR(summary.total_spend)}</p>
        </Card>
        <Card>
          <Eyebrow>Net</Eyebrow>
          <p className="font-display text-3xl text-accent">{formatINR(summary.net)}</p>
        </Card>
      </div>

      <Card>
        <Eyebrow>Running balance</Eyebrow>
        <h2 className="font-display text-xl mb-4">The last 45 days, at a glance</h2>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={balanceData} margin={{ left: -10, right: 10 }}>
            <defs>
              <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1F6F5C" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#1F6F5C" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#0F1115AA" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#0F1115AA" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              width={50}
            />
            <Tooltip
              formatter={(v) => formatINR(v)}
              contentStyle={{ borderRadius: 12, border: "1px solid #0F111514", fontSize: 13 }}
            />
            <Area type="monotone" dataKey="balance" stroke="#1F6F5C" strokeWidth={2} fill="url(#balanceFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Eyebrow>Where it went</Eyebrow>
          <h2 className="font-display text-xl mb-4">Spend by category</h2>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="55%" height={220}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatINR(v)} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-2 text-sm flex-1">
              {categoryData.slice(0, 6).map((c, i) => (
                <li key={c.name} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: PALETTE[i % PALETTE.length] }}
                    />
                    {c.name}
                  </span>
                  <span className="text-ink/60">{formatINR(c.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div>
            <Eyebrow>Closing the loop</Eyebrow>
            <h2 className="font-display text-xl mb-2">Your money, teaching you back</h2>
            <p className="text-sm text-ink/60 leading-relaxed">
              Every transaction above is being watched for four patterns — overdraft
              risk, subscription stacking, impulse repeats, and large one-off spends.
              When one fires, you get a lesson tied to that exact moment, not a
              generic article.
            </p>
          </div>
          <a
            href="/learn"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent tick-underline w-fit"
          >
            See what it's found for you →
          </a>
        </Card>
      </div>
    </div>
  );
}
