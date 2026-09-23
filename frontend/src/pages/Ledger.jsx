import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { Card, Eyebrow, Loading, ErrorBanner, formatINR, EmptyState } from "../components/UI.jsx";

function AddTransactionForm({ onAdded }) {
  const [form, setForm] = useState({ date: "", merchant: "", amount: "" });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.date || !form.merchant.trim() || !form.amount) {
      setError("Date, merchant, and amount are required.");
      return;
    }
    setSaving(true);
    try {
      await api.createTransaction({
        date: new Date(form.date).toISOString(),
        merchant: form.merchant.trim(),
        amount: Number(form.amount),
      });
      setForm({ date: "", merchant: "", amount: "" });
      onAdded();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCsv = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const summary = await api.importTransactions(file);
      if (summary.skipped > 0) {
        setError(`Imported ${summary.imported}, skipped ${summary.skipped}: ${summary.errors.join("; ")}`);
      }
      onAdded();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-ink/50 mb-1">Date</span>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="px-3 py-2 rounded-lg border border-ink/15 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="text-sm">
          <span className="block text-ink/50 mb-1">Merchant</span>
          <input
            type="text"
            value={form.merchant}
            onChange={(e) => setForm({ ...form, merchant: e.target.value })}
            className="w-44 px-3 py-2 rounded-lg border border-ink/15 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="text-sm">
          <span className="block text-ink/50 mb-1">Amount (₹, − for spend)</span>
          <input
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-36 px-3 py-2 rounded-lg border border-ink/15 text-sm outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/90 disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add"}
        </button>
        <label className="px-4 py-2 rounded-lg border border-ink/15 text-sm font-semibold cursor-pointer hover:border-accent">
          Import CSV
          <input type="file" accept=".csv" className="hidden" onChange={handleCsv} />
        </label>
      </form>
      {error && <p className="text-sm text-coral mt-3">{error}</p>}
    </Card>
  );
}

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

  const handleDelete = (id) => {
    api.deleteTransaction(id).then(load).catch((e) => setError(e.message));
  };

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

      <AddTransactionForm onAdded={load} />

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
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{t.merchant}</p>
                  <p className="text-xs text-ink/45 mt-0.5">
                    {new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}
                    {t.category}
                    {t.is_subscription ? " · Subscription" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span
                    className={`font-display text-lg ${
                      t.amount < 0 ? "text-ink" : "text-accent"
                    }`}
                  >
                    {t.amount < 0 ? "" : "+"}
                    {formatINR(t.amount)}
                  </span>
                  <button
                    onClick={() => handleDelete(t.id)}
                    title="Delete transaction"
                    className="w-7 h-7 rounded-full flex items-center justify-center text-ink/40 hover:text-coral hover:bg-coral/10 transition-colors text-base font-bold"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
