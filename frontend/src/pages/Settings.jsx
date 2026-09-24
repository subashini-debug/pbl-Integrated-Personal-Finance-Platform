import { useEffect, useState } from "react";
import { api, getStoredGrokKey, setStoredGrokKey, getStoredGeminiKey, setStoredGeminiKey } from "../api.js";
import { Card, Eyebrow } from "../components/UI.jsx";

function LlmKeyCard({ title, keyLabel, keyPlaceholder, keyLink, keyLinkLabel, envVarName,
                      getKey, setKey: persistKey, fetchStatus, testKey }) {
  const [key, setKey] = useState("");
  const [status, setStatus] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setKey(getKey());
    fetchStatus().then(setStatus).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = () => {
    persistKey(key.trim());
    setTestResult(null);
    fetchStatus().then(setStatus).catch(() => {});
  };

  const clear = () => {
    setKey("");
    persistKey("");
    setTestResult(null);
    fetchStatus().then(setStatus).catch(() => {});
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testKey(key.trim()));
    } catch (e) {
      setTestResult({ ok: false, message: e.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-xl mb-2">{title}</h2>
      <p className="text-sm text-ink/60 mb-5 leading-relaxed">
        Used only to write the wording of your lessons and agent replies —
        every number on screen is computed locally and never touches an LLM.
        Stored in this browser's local storage, sent as a request header,
        never written to disk on the server. Leave this blank and the app
        still works, using the built-in rules-based writer.
      </p>

      {status && (
        <div className="mb-4 text-xs font-medium px-3 py-2 rounded-full inline-flex items-center gap-2 bg-ink/5 text-ink/60">
          <span className={`w-1.5 h-1.5 rounded-full ${status.configured ? "bg-accent" : "bg-ink/25"}`} />
          {status.configured
            ? status.using_server_default
              ? "Using server-wide default key"
              : "Your key is active"
            : `No ${keyLabel} key configured — using rules-based fallback`}
        </div>
      )}

      <label className="block text-sm mb-1.5 text-ink/50">API key</label>
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder={keyPlaceholder}
        className="w-full px-4 py-2.5 rounded-lg border border-ink/15 text-sm mb-4 focus:border-accent outline-none font-mono"
      />

      <div className="flex flex-wrap gap-3">
        <button
          onClick={save}
          className="px-4 py-2.5 rounded-full bg-ink text-paper text-sm font-semibold hover:bg-ink/85"
        >
          Save key
        </button>
        <button
          onClick={testConnection}
          disabled={!key || testing}
          className="px-4 py-2.5 rounded-full border border-ink/15 text-sm font-semibold hover:bg-ink/5 disabled:opacity-40"
        >
          {testing ? "Testing…" : "Test connection"}
        </button>
        <button
          onClick={clear}
          className="px-4 py-2.5 rounded-full text-sm font-semibold text-coral hover:bg-coral/5"
        >
          Remove key
        </button>
      </div>

      {testResult && (
        <p className={`mt-4 text-sm ${testResult.ok ? "text-accent" : "text-coral"}`}>
          {testResult.ok ? `Connected — ${keyLabel} replied successfully.` : testResult.message}
        </p>
      )}

      <p className="mt-6 text-xs text-ink/40 leading-relaxed">
        Get a key at{" "}
        <a href={keyLink} target="_blank" rel="noreferrer" className="underline">
          {keyLinkLabel}
        </a>
        . Alternatively, an operator running this app can set a shared{" "}
        <code className="bg-ink/5 px-1 rounded">{envVarName}</code> in the backend's{" "}
        <code className="bg-ink/5 px-1 rounded">.env</code> file (never committed to
        git) so the whole team demos on one key without anyone pasting one here.
      </p>
    </Card>
  );
}

export default function Settings() {
  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <Eyebrow>Your key, your browser only</Eyebrow>
        <h1 className="font-display text-3xl">Settings</h1>
      </div>

      <LlmKeyCard
        title="Gemini API key"
        keyLabel="Gemini"
        keyPlaceholder="AIza..."
        keyLink="https://aistudio.google.com/app/apikey"
        keyLinkLabel="aistudio.google.com"
        envVarName="GEMINI_API_KEY"
        getKey={getStoredGeminiKey}
        setKey={setStoredGeminiKey}
        fetchStatus={api.geminiStatus}
        testKey={api.testGeminiKey}
      />

      <LlmKeyCard
        title="Grok API key"
        keyLabel="Grok"
        keyPlaceholder="xai-..."
        keyLink="https://console.x.ai"
        keyLinkLabel="console.x.ai"
        envVarName="GROK_API_KEY"
        getKey={getStoredGrokKey}
        setKey={setStoredGrokKey}
        fetchStatus={api.grokStatus}
        testKey={api.testGrokKey}
      />

      <p className="text-xs text-ink/40 leading-relaxed">
        If both are configured, FinTrack tries Gemini first and falls back to
        Grok, then to the offline rules engine, so a working answer is never
        more than one provider away.
      </p>
    </div>
  );
}
