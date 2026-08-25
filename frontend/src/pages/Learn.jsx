import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Card, Eyebrow, Loading, ErrorBanner, formatINR, EmptyState } from "../components/UI.jsx";

const TRIGGER_LABELS = {
  overdraft_risk: { label: "Overdraft risk", color: "bg-coral/10 text-coral" },
  subscription_stacking: { label: "Subscription stacking", color: "bg-gold/15 text-[#8a6a1f]" },
  impulse_repeat_spend: { label: "Impulse repeat", color: "bg-accent/10 text-accent" },
  large_discretionary_spend: { label: "Large purchase", color: "bg-ink/10 text-ink/70" },
};

export default function Learn() {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .getLessons()
      .then((data) => {
        setLessons(data);
        if (data.length === 0) return generate();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const generate = () => {
    setGenerating(true);
    setError(null);
    return api
      .generateLessons()
      .then(setLessons)
      .catch((e) => setError(e.message))
      .finally(() => setGenerating(false));
  };

  useEffect(load, []);

  if (loading) return <Loading label="Scanning your transactions for patterns…" />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Eyebrow>Triggered by your real spending</Eyebrow>
          <h1 className="font-display text-3xl">Learn</h1>
          <p className="text-ink/60 mt-1 max-w-lg">
            Not a course. Each lesson below exists because something specific happened
            in your ledger.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="px-4 py-2.5 rounded-full bg-ink text-paper text-sm font-semibold hover:bg-ink/85 disabled:opacity-50 shrink-0"
        >
          {generating ? "Scanning…" : "Rescan for new lessons"}
        </button>
      </div>

      {lessons.length === 0 ? (
        <EmptyState
          title="No patterns detected yet"
          body="Your spending looks steady — nothing has triggered a lesson. Check back after your next few transactions."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {lessons.map((l) => {
            const meta = TRIGGER_LABELS[l.trigger_type] || { label: l.trigger_type, color: "bg-ink/10 text-ink/70" };
            return (
              <Card key={l.id} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-ink/30 font-semibold">
                    {l.source === "grok" ? "AI-narrated" : "Rules-based"}
                  </span>
                </div>
                <h3 className="font-display text-lg leading-snug">{l.title}</h3>
                <p className="text-sm text-ink/65 leading-relaxed">{l.body}</p>
                {l.opportunity_cost && (
                  <div className="mt-1 pt-3 border-t border-ink/5 text-sm">
                    <span className="text-ink/50">Invested instead, 10 yrs: </span>
                    <span className="font-display text-accent text-base">{formatINR(l.opportunity_cost)}</span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
