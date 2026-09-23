import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || "/";

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Couldn't log in. Check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = () => {
    setEmail("demo@fintrack.app");
    setPassword("fintrack-demo");
  };

  return (
    <div className="min-h-full flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="w-10 h-10 rounded-full bg-accent inline-flex items-center justify-center text-paper font-display text-xl mb-3">
            F
          </span>
          <h1 className="font-display text-3xl">Welcome back</h1>
          <p className="text-ink/55 text-sm mt-1">Track → Learn → Invest, picking up where you left off.</p>
        </div>

        <form onSubmit={onSubmit} className="bg-white rounded-xl2 shadow-soft p-6 space-y-4">
          {error && (
            <div className="text-sm text-coral bg-coral/5 border border-coral/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-lg border border-ink/15 text-sm focus:border-accent outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-full bg-ink text-paper text-sm font-semibold hover:bg-ink/85 disabled:opacity-50"
          >
            {submitting ? "Logging in…" : "Log in"}
          </button>

          <button
            type="button"
            onClick={fillDemo}
            className="w-full py-2.5 rounded-full border border-ink/15 text-sm font-semibold hover:bg-ink/5"
          >
            Use demo account
          </button>
        </form>

        <p className="text-center text-sm text-ink/50 mt-6">
          New here?{" "}
          <Link to="/signup" className="text-accent font-semibold tick-underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
