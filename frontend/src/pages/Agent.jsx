import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Card, Eyebrow, ErrorBanner } from "../components/UI.jsx";
import Scene from "../three/Scene.jsx";
import AgentSeal from "../three/AgentSeal.jsx";

const SUGGESTIONS = [
  "Where did most of my money go?",
  "Am I saving enough each month?",
  "What should my investment allocation look like?",
  "Do I have any subscription creep?",
];

const GREETING = {
  role: "assistant",
  source: "rules",
  content:
    "Hi, I'm your FinTrack agent. I answer from your real transactions, spend summary, " +
    "and investment profile -- not generic advice. Ask me anything about your money.",
  ephemeral: true,
};

export default function Agent() {
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .getAgentHistory()
      .then((history) => {
        setMessages(history.length ? history : [GREETING]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = async (text) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || sending) return;
    setError(null);
    setInput("");
    setMessages((prev) => [...prev.filter((m) => !m.ephemeral), { role: "user", content: trimmed }]);
    setSending(true);
    try {
      const res = await api.agentChat(trimmed);
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply, source: res.source }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const resetChat = async () => {
    setError(null);
    try {
      await api.resetAgentHistory();
      setMessages([GREETING]);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Eyebrow>Grounded in your real numbers, not a generic chatbot</Eyebrow>
          <h1 className="font-display text-3xl">AI Agent</h1>
          <p className="text-ink/60 mt-1 max-w-lg">
            Every answer below is built from your actual transactions and investment
            profile, narrated by Grok when a key is configured -- or by an offline
            rules engine that still reasons over the same numbers.
          </p>
        </div>
        <button
          onClick={resetChat}
          className="px-4 py-2.5 rounded-full border border-ink/15 text-sm font-semibold text-ink/70 hover:text-ink hover:border-ink/30 shrink-0"
        >
          New conversation
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-start">
        <Card className="flex flex-col overflow-hidden !p-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-3" style={{ height: 440 }}>
            {loading ? (
              <p className="text-sm text-ink/40 py-12 text-center">Loading your conversation…</p>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-ink text-paper rounded-br-sm"
                        : "bg-paper border border-ink/10 rounded-bl-sm"
                    }`}
                  >
                    {m.role === "assistant" && (
                      <span className="block text-[10px] uppercase tracking-wide font-semibold text-ink/35 mb-1">
                        {m.source === "grok" ? "Grok" : "Offline rules engine"}
                      </span>
                    )}
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-paper border border-ink/10 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-ink/40">
                  Thinking…
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-ink/10 p-4">
            <div className="flex flex-wrap gap-2 mb-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={sending}
                  className="text-xs px-3 py-1.5 rounded-full bg-ink/5 text-ink/60 hover:bg-ink/10 disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask about your spending, subscriptions, savings, or investments…"
                rows={2}
                className="flex-1 resize-none px-3.5 py-2.5 rounded-xl border border-ink/15 text-sm focus:border-accent outline-none"
              />
              <button
                onClick={() => send()}
                disabled={sending || !input.trim()}
                className="px-4 py-2.5 rounded-full bg-ink text-paper text-sm font-semibold hover:bg-ink/85 disabled:opacity-40 shrink-0"
              >
                Send
              </button>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col items-center text-center gap-3">
          <Scene height={200} cameraPosition={[0, 0.4, 4.2]} fov={40} ariaLabel="Animated agent seal">
            <AgentSeal thinking={sending} />
          </Scene>
          <p className="text-xs text-ink/50 leading-relaxed">
            The seal spins faster while the agent is composing a reply, and settles once
            it answers -- a quick visual cue for whether it's still working.
          </p>
        </Card>
      </div>
    </div>
  );
}
