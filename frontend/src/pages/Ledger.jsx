import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { Card, Eyebrow, Loading, ErrorBanner, formatINR, EmptyState } from "../components/UI.jsx";

export default function Ledger() {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .getTransactions()
      .then(setTxns)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const categories = useMemo(
    () => ["All", ...new Set(txns.map((t) => t.category))].sort(),
    [txns]
  );

  const filtered = useMemo(
    () =>
      txns.filter(
        (t) =>
          (filter === "All" || t.category === filter) &&
          t.merchant.toLowerCase().includes(query.toLowerCase())
      ),
    [txns, filter, query]
  );

  if (loading) return <Loading label="Loading your ledger…" />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>Every transaction</Eyebrow>
        <h1 className="font-display text-3xl">Ledger</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search merchant…"
          className="w-full sm:w-64 px-4 py-2.5 rounded-full border border-ink/15 bg-white text-sm focus:border-accent outline-none"
        />
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === c ? "bg-ink text-paper" : "bg-white text-ink/60 hover:text-ink border border-ink/10"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No transactions match" body="Try a different search term or category filter." />
          </div>
        ) : (
          <div className="divide-y divide-ink/5">
            {filtered.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-ink/[0.02]">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{t.merchant}</p>
                  <p className="text-xs text-ink/45 mt-0.5">
                    {new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}
                    {t.category}
                    {t.is_subscription ? " · Subscription" : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-display text-lg ${
                    t.amount < 0 ? "text-ink" : "text-accent"
                  }`}
                >
                  {t.amount < 0 ? "" : "+"}
                  {formatINR(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
