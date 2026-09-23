import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';



// ── Step machine: 'login' | 'forgot' | 'otp' | 'reset' | 'success'
export default function LoginPage() {
  const { login } = useAuth();

  // Login state
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('admin123');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // Forgot password state
  const [step, setStep]           = useState('login'); // login | forgot | otp | reset | success
  const [fpEmail, setFpEmail]     = useState('');
  const [otp, setOtp]             = useState('');
  const [devOtp, setDevOtp]       = useState('');  // shown in dev mode
  const [newPwd, setNewPwd]       = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [fpError, setFpError]     = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('https://hms-jkkm-api.onrender.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      login(data.user, data.token);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1: Request OTP ────────────────────────────────────────────────────
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setFpError(''); setFpLoading(true);
    try {
      const res = await fetch('https://hms-jkkm-api.onrender.com/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fpEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDevOtp(data.otp_dev || ''); // shown only in dev mode
      setStep('otp');
    } catch (err) {
      setFpError(err.message);
    } finally {
      setFpLoading(false);
    }
  };

  // ── Step 2: Verify OTP + Reset Password ───────────────────────────────────
  const handleResetPwd = async (e) => {
    e.preventDefault();
    setFpError('');
    if (newPwd !== confirmPwd) return setFpError('Passwords do not match');
    if (newPwd.length < 6)    return setFpError('Password must be at least 6 characters');
    setFpLoading(true);
    try {
      const res = await fetch('https://hms-jkkm-api.onrender.com/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fpEmail, otp, new_password: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep('success');
    } catch (err) {
      setFpError(err.message);
    } finally {
      setFpLoading(false);
    }
  };

  const resetForgot = () => {
    setStep('login'); setFpEmail(''); setOtp(''); setDevOtp('');
    setNewPwd(''); setConfirmPwd(''); setFpError('');
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-overlay">
          <div className="login-left-content">
            <div style={{ fontSize: 64, marginBottom: 20 }}>🏫</div>
            <h1 style={{ fontSize: 42, fontWeight: 800, color: 'white', marginBottom: 16, lineHeight: 1.2 }}>
              JKKM Institutions
            </h1>
            <p style={{ fontSize: 20, color: 'rgba(255,255,255,0.8)', fontWeight: 500, maxWidth: 400 }}>
              Advanced Hostel Management System
            </p>
            <div style={{ marginTop: 40, display: 'flex', gap: 12 }}>
              <span className="badge badge-eng" style={{ background: 'rgba(37, 99, 235, 0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>Engineering</span>
              <span className="badge badge-agri" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>Agriculture</span>
              <span className="badge badge-pharm" style={{ background: 'rgba(245, 158, 11, 0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>Pharmacy</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="login-right">
        <div className="login-card">
          <div className="login-logo-mobile hide-desktop" style={{ textAlign: 'center', marginBottom: 24 }}>
            <div className="logo-icon" style={{ fontSize: 40, marginBottom: 8 }}>🏫</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary-dark)' }}>JKKM Institutions</h2>
            <p style={{ color: 'var(--text-muted)' }}>Hostel Management System</p>
          </div>

          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Welcome Back 👋</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Please sign in to your account.</p>
          </div>

        {/* ── LOGIN FORM ────────────────────────────────────────────────── */}
        {step === 'login' && (
          <>
            <form onSubmit={handleLogin}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>Email Address</label>
                <input type="email" className="form-input" placeholder="email@jkkm.edu" pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$" title="Valid email address (e.g., name@example.com)"
                  value={email} onChange={e => setEmail(e.target.value)} required 
                  style={{ padding: '14px 16px', fontSize: 15, background: 'var(--bg)', border: '1px solid var(--border-light)' }} />
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label" style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>Password</label>
                <input type="password" className="form-input" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required 
                  style={{ padding: '14px 16px', fontSize: 15, background: 'var(--bg)', border: '1px solid var(--border-light)' }} />
              </div>
              
              <div style={{ textAlign: 'right', marginBottom: 24 }}>
                <button type="button" onClick={() => { setStep('forgot'); setFpEmail(email || ''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Forgot Password?
                </button>
              </div>

              {error && <div className="alert alert-danger" style={{ marginBottom: 20 }}>⚠️ {error}</div>}
              
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', padding: '14px', fontSize: 16, fontWeight: 700, borderRadius: 12, boxShadow: '0 8px 16px rgba(37,99,235,0.2)' }} disabled={loading}>
                {loading ? '⏳ Signing in...' : 'Sign In'}
              </button>
            </form>


          </>
        )}

        {/* ── FORGOT PASSWORD & OTHER STEPS ─────────────────────────────── */}
        {/* ... keeping the logic mostly identical but adjusting spacing ... */}
        {step === 'forgot' && (
          <>
            <form onSubmit={handleRequestOtp}>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label">Registered Email Address</label>
                <input type="email" className="form-input" placeholder="email@jkkm.edu" pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$" title="Valid email address (e.g., name@example.com)"
                  value={fpEmail} onChange={e => setFpEmail(e.target.value)} required 
                  style={{ padding: '14px 16px', fontSize: 15 }} />
              </div>
              {fpError && <div className="alert alert-danger" style={{ marginBottom: 20 }}>⚠️ {fpError}</div>}
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', padding: '14px', borderRadius: 12 }} disabled={fpLoading}>
                {fpLoading ? '⏳ Sending...' : '📨 Send OTP'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button onClick={resetForgot}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
                ← Back to Login
              </button>
            </div>
          </>
        )}

        {step === 'otp' && (
          <>
            <div style={{ background: 'rgba(37,99,235,0.05)', padding: 16, borderRadius: 12, marginBottom: 24 }}>
              <p style={{ color: 'var(--primary-dark)', fontSize: 14, margin: 0, fontWeight: 500 }}>
                OTP sent to <strong>{fpEmail}</strong>. Valid for 10 minutes.
              </p>
              {devOtp && (
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  🔧 Dev OTP: <strong style={{ color: 'var(--primary)', letterSpacing: 2 }}>{devOtp}</strong>
                </div>
              )}
            </div>
            <form onSubmit={handleResetPwd}>
              <div className="form-group">
                <label className="form-label">6-Digit OTP</label>
                <input type="text" className="form-input" placeholder="000000" maxLength={6}
                  value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} required
                  style={{ letterSpacing: 8, fontSize: 24, textAlign: 'center', fontWeight: 700, padding: '12px' }} />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" className="form-input" placeholder="Min 6 characters"
                  value={newPwd} onChange={e => setNewPwd(e.target.value)} required 
                  style={{ padding: '12px' }} />
              </div>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label">Confirm New Password</label>
                <input type="password" className="form-input" placeholder="Repeat new password"
                  value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required 
                  style={{ padding: '12px' }} />
              </div>
              {fpError && <div className="alert alert-danger" style={{ marginBottom: 20 }}>⚠️ {fpError}</div>}
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', padding: '14px', borderRadius: 12 }} disabled={fpLoading}>
                {fpLoading ? '⏳ Resetting...' : '🔐 Reset Password'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button onClick={resetForgot} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
            </div>
          </>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h3 style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)', marginBottom: 8 }}>Success!</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Your password has been updated successfully.</p>
            <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 32, padding: '14px', borderRadius: 12 }} onClick={resetForgot}>
              Go to Login
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
