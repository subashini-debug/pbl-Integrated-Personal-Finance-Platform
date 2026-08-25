const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const GROK_KEY_STORAGE = "fintrack_grok_key";
const AUTH_TOKEN_STORAGE = "fintrack_auth_token";

export function getStoredGrokKey() {
  return localStorage.getItem(GROK_KEY_STORAGE) || "";
}

export function setStoredGrokKey(key) {
  if (key) localStorage.setItem(GROK_KEY_STORAGE, key);
  else localStorage.removeItem(GROK_KEY_STORAGE);
}

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_STORAGE) || "";
}

export function setAuthToken(token) {
  if (token) localStorage.setItem(AUTH_TOKEN_STORAGE, token);
  else localStorage.removeItem(AUTH_TOKEN_STORAGE);
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const grokKey = getStoredGrokKey();
  const authToken = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(grokKey ? { "X-Grok-Key": grokKey } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401 && authToken) {
    // Session expired or invalid -- clear it and let AuthContext know so the
    // user is sent back to /login instead of seeing errors on every page.
    setAuthToken("");
    window.dispatchEvent(new Event("fintrack:unauthorized"));
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new ApiError(detail || `API error ${res.status}`, res.status);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => request("/api/health"),

  signup: (payload) => request("/api/auth/signup", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/api/auth/me"),

  getTransactions: () => request("/api/transactions"),
  getSummary: () => request("/api/transactions/summary"),
  getLessons: () => request("/api/lessons"),
  generateLessons: () => request("/api/lessons/generate", { method: "POST" }),
  getInvestmentProfile: () => request("/api/investments/profile"),
  getProjection: (payload) =>
    request("/api/investments/projection", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getAgentHistory: () => request("/api/agent/history"),
  agentChat: (message) => request("/api/agent/chat", { method: "POST", body: JSON.stringify({ message }) }),
  resetAgentHistory: () => request("/api/agent/history", { method: "DELETE" }),

  grokStatus: () => request("/api/settings/grok-status"),
  testGrokKey: (apiKey) =>
    request("/api/settings/test-grok-key", {
      method: "POST",
      body: JSON.stringify({ api_key: apiKey }),
    }),
};
