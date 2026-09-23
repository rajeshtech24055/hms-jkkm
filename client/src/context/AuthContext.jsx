import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

function parseJWT(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hms_user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('hms_token'));
  const [sessionExpired, setSessionExpired] = useState(false);

  // ── Auto-logout when JWT expires ──────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const payload = parseJWT(token);
    if (!payload?.exp) return;
    const msLeft = payload.exp * 1000 - Date.now();
    if (msLeft <= 0) {
      // Already expired
      setSessionExpired(true);
      setUser(null); setToken(null);
      localStorage.removeItem('hms_user');
      localStorage.removeItem('hms_token');
      return;
    }
    // Schedule auto-logout at exact expiry time
    const timer = setTimeout(() => {
      setSessionExpired(true);
      setUser(null); setToken(null);
      localStorage.removeItem('hms_user');
      localStorage.removeItem('hms_token');
    }, msLeft);
    return () => clearTimeout(timer);
  }, [token]);

  const login = useCallback((userData, tok) => {
    setUser(userData);
    setToken(tok);
    setSessionExpired(false);
    localStorage.setItem('hms_user', JSON.stringify(userData));
    localStorage.setItem('hms_token', tok);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setSessionExpired(false);
    localStorage.removeItem('hms_user');
    localStorage.removeItem('hms_token');
  }, []);

  const api = useCallback(async (path, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    };
    // Remove Content-Type for FormData (let browser set boundary)
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }
    const baseUrl = 'https://hms-jkkm-api.onrender.com';
    const fullPath = path.startsWith('http') ? path : `${baseUrl}${path}`;
    const res = await fetch(fullPath, { ...options, headers });
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      // Auto-logout on expired/invalid token (FastAPI returns {"detail": "..."})
      if (data.expired || (data.detail && data.detail.toLowerCase().includes('token')) || data.detail === 'Student user not found' || data.detail === 'User not found or inactive') {
        setSessionExpired(true);
        setUser(null); setToken(null);
        localStorage.removeItem('hms_user');
        localStorage.removeItem('hms_token');
      }
      throw new Error(data.detail || data.error || 'Unauthorized');
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || errData.error || 'API Error');
    }
    return res.json();
  }, [token]);

  // Token expiry time for UI countdown (optional)
  const tokenExpiresAt = token ? parseJWT(token)?.exp * 1000 : null;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, api, sessionExpired, tokenExpiresAt }}>
      {/* Session expired banner */}
      {sessionExpired && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#ef4444', color: '#fff', padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontWeight: 600, fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}>
          <span>⏰ Your session has expired. Please sign in again to continue.</span>
          <button onClick={() => setSessionExpired(false)}
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
            Sign In
          </button>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
