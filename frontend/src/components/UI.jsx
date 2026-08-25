export function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl2 shadow-soft p-6 ${className}`}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }) {
  return (
    <p className="text-xs font-semibold tracking-widest uppercase text-accent mb-2">
      {children}
    </p>
  );
}

export function Loading({ label = "Loading…" }) {
  return (
    <div className="flex items-center gap-3 text-ink/50 py-12 justify-center">
      <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="border border-coral/30 bg-coral/5 text-coral rounded-xl2 p-5 text-sm flex items-center justify-between gap-4">
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 px-3 py-1.5 rounded-full bg-coral text-white text-xs font-semibold hover:bg-coral/90"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function formatINR(amount) {
  const sign = amount < 0 ? "-" : "";
  return `${sign}₹${Math.abs(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

export function EmptyState({ title, body }) {
  return (
    <div className="text-center py-16 border border-dashed border-ink/15 rounded-xl2">
      <p className="font-display text-lg mb-1">{title}</p>
      <p className="text-sm text-ink/50 max-w-sm mx-auto">{body}</p>
    </div>
  );
}
