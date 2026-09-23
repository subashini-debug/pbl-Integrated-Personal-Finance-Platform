import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState(85000);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password needs to be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await signup(name.trim(), email.trim().toLowerCase(), password, Number(monthlyIncome) || 0);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Couldn't create your account. Try a different email.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="w-10 h-10 rounded-full bg-accent inline-flex items-center justify-center text-paper font-display text-xl mb-3">
            F
          </span>
          <h1 className="font-display text-3xl">Create your account</h1>
          <p className="text-ink/55 text-sm mt-1">
            Your data stays yours — spend patterns, lessons, and roadmap all start fresh.
          </p>
        </div>

        <form onSubmit={onSubmit} className="bg-white rounded-xl2 shadow-soft p-6 space-y-4">
          {error && (
            <div className="text-sm text-coral bg-coral/5 border border-coral/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <label className="block text-sm">
            <span className="block text-ink/50 mb-1.5">Name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-2.5 rounded-lg border border-ink/15 text-sm focus:border-accent outline-none"
            />
          </label>

          <label className="block text-sm">
            <span className="block text-ink/50 mb-1.5">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-lg border border-ink/15 text-sm focus:border-accent outline-none"
            />
          </label>

          <label className="block text-sm">
            <span className="block text-ink/50 mb-1.5">Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-4 py-2.5 rounded-lg border border-ink/15 text-sm focus:border-accent outline-none"
            />
          </label>

          <label className="block text-sm">
            <span className="block text-ink/50 mb-1.5">Monthly income (₹)</span>
            <input
              type="number"
              min={0}
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-ink/15 text-sm focus:border-accent outline-none"
            />
            <span className="block text-xs text-ink/40 mt-1">
              Used to infer your risk profile and monthly surplus. You can change this later.
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-full bg-ink text-paper text-sm font-semibold hover:bg-ink/85 disabled:opacity-50"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-ink/50 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-accent font-semibold tick-underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
