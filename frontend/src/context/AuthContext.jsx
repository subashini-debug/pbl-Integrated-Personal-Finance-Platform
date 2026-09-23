import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getAuthToken, setAuthToken } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadCurrentUser = useCallback(() => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => {
        setAuthToken("");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(loadCurrentUser, [loadCurrentUser]);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("fintrack:unauthorized", onUnauthorized);
    return () => window.removeEventListener("fintrack:unauthorized", onUnauthorized);
  }, []);

  const login = async (email, password) => {
    const res = await api.login({ email, password });
    setAuthToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const signup = async (name, email, password, monthlyIncome) => {
    const res = await api.signup({ name, email, password, monthly_income: monthlyIncome });
    setAuthToken(res.access_token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    setAuthToken("");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh: loadCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
