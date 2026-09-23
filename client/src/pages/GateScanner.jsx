import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';

export default function GateScanner() {
  const { api } = useAuth();
  const [scanInput, setScanInput] = useState('');
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");

  const inputRef = useRef();
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    api('/api/gate/log').then(setLogs).catch(console.error);
    inputRef.current?.focus();
  }, [api]);

  useEffect(() => {
    let isMounted = true;

    if (cameraOpen) {
      setCameraError(null);
      const timer = setTimeout(() => {
        if (!document.getElementById('reader')) return;

        try {
          const html5QrCode = new Html5Qrcode('reader');
          html5QrCodeRef.current = html5QrCode;

          const config = { fps: 10, qrbox: { width: 250, height: 250 } };

          const onScanSuccess = (decodedText) => {
            let parsedReg = decodedText;
            let parsedToken = null;
            try {
              const json = JSON.parse(decodedText);
              if (json.reg) parsedReg = json.reg;
              if (json.token) parsedToken = json.token;
            } catch (e) {
              // Raw string scanned
            }

            setScanInput(parsedReg);

            // Stop scanner cleanly
            if (html5QrCodeRef.current) {
              html5QrCodeRef.current.stop().then(() => {
                html5QrCodeRef.current = null;
                if (isMounted) setCameraOpen(false);
              }).catch(() => {
                html5QrCodeRef.current = null;
                if (isMounted) setCameraOpen(false);
              });
            }

            triggerAutoScan(parsedReg, parsedToken);
          };

          const onScanFailure = () => {
            // Frame failed to detect QR, ignore
          };

          html5QrCode.start({ facingMode }, config, onScanSuccess, onScanFailure)
            .catch((err) => {
              console.warn(`Camera start failed with facingMode ${facingMode}, trying fallback...`, err);
              // Fallback to user camera if environment camera is unavailable
              html5QrCode.start({ facingMode: "user" }, config, onScanSuccess, onScanFailure)
                .catch((err2) => {
                  console.error('Camera fallback failed:', err2);
                  if (isMounted) setCameraError('Unable to access camera. Please check browser camera permissions or select another camera.');
                });
            });
        } catch (err) {
          console.error('Camera init error:', err);
          if (isMounted) setCameraError('Failed to initialize camera.');
        }
      }, 150);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        if (html5QrCodeRef.current) {
          try {
            const state = html5QrCodeRef.current.getState();
            if (state === 2 || state === 3) {
              html5QrCodeRef.current.stop().catch(() => {});
            }
          } catch (e) {
            html5QrCodeRef.current.stop().catch(() => {});
          }
          html5QrCodeRef.current = null;
        }
      };
    }
  }, [cameraOpen, facingMode]);

  const triggerAutoScan = async (regToScan, scanToken = null) => {
    if (!regToScan || !regToScan.trim()) return;
    setScanning(true);
    try {
      const payload = { reg_no: regToScan.trim().toUpperCase() };
      if (scanToken) payload.token = scanToken;

      const data = await api('/api/gate/scan', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setResult(data);
      api('/api/gate/log').then(setLogs).catch(console.error);
      setTimeout(() => setResult(null), 5000);
    } catch (err) {
      setResult({ success: false, reason: err.message || 'Scan error occurred', student: null });
      setTimeout(() => setResult(null), 5000);
    } finally {
      setScanning(false);
      setScanInput('');
      inputRef.current?.focus();
    }
  };

  const handleScan = async (e) => {
    e?.preventDefault();
    if (!scanInput.trim()) return;

    let regToScan = scanInput.trim();
    let scanToken = null;

    try {
      const json = JSON.parse(regToScan);
      if (json.reg) regToScan = json.reg;
      if (json.token) scanToken = json.token;
    } catch (e) {
      // Input is plain reg_no
    }

    await triggerAutoScan(regToScan, scanToken);
  };

  const getStatusClass = () => {
    if (!result) return 'idle';
    return result.success ? 'success' : 'denied';
  };

  return (
    <div className="page-enter">
      <div className="section-header">
        <h2>🚪 Gate Scanner</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Gate Active</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Scanner Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className={`gate-display ${getStatusClass()}`}>
            {!result && (
              <>
                <div className="gate-icon">🚪</div>
                <div className="gate-status" style={{ color: 'var(--text-muted)' }}>Gate Ready</div>
                <div className="gate-msg">Scan card QR or enter register number below</div>
              </>
            )}
            {result?.success && (
              <>
                <div className="gate-icon">✅</div>
                <div className="gate-status" style={{ color: 'var(--success)' }}>
                  GATE {result.direction === 'OUT' ? 'OPENED — EXIT' : 'OPENED — ENTRY'}
                </div>
                <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{result.student?.name}</div>
                <div className="gate-msg">{result.student?.reg_no} · {result.student?.dept_name}</div>
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                  {result.direction === 'OUT' ? '👋 Have a safe journey!' : '👋 Welcome back!'}
                </div>
                {result.notificationSent && (
                  <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: result.notificationSent.isLate ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', border: `1px solid ${result.notificationSent.isLate ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`, fontSize: 12, color: result.notificationSent.isLate ? 'var(--danger)' : 'var(--success)', textAlign: 'left' }}>
                    {result.notificationSent.isLate ? (
                      <div>
                        <div style={{ fontWeight: 600 }}>🚨 LATE RETURN WARNING</div>
                        <div>Disciplinary fine of ₹{result.notificationSent.fine} imposed on {result.student?.name}.</div>
                        <div style={{ marginTop: 4 }}>📱 <strong>Parent SMS Alert Sent:</strong> {result.notificationSent.recipient}</div>
                      </div>
                    ) : (
                      <>📱 <strong>Parent SMS Alert Sent:</strong> {result.notificationSent.recipient}</>
                    )}
                  </div>
                )}
              </>
            )}
            {result && !result.success && (
              <>
                <div className="gate-icon">🔴</div>
                <div className="gate-status" style={{ color: 'var(--danger)' }}>ACCESS DENIED</div>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{result.student?.name || 'Unknown'}</div>
                <div className="gate-msg" style={{ color: 'var(--danger)' }}>{result.reason}</div>
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                  ⚠️ Warden has been notified
                </div>
              </>
            )}
          </div>

          <form onSubmit={handleScan} className="card">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📷 Scan Card / QR</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {cameraOpen && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setFacingMode(f => f === "environment" ? "user" : "environment")}
                    title="Switch Camera"
                  >
                    🔄 {facingMode === "environment" ? "Front Cam" : "Back Cam"}
                  </button>
                )}
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCameraOpen(!cameraOpen)}>
                  {cameraOpen ? '✖ Close Camera' : '📷 Open Camera'}
                </button>
              </div>
            </div>

            {cameraOpen && (
              <div style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>
                <style>{`#reader__dashboard_section_csr span, #reader__dashboard_section_csr a { display: none !important; }`}</style>
                <div id="reader" style={{ width: '100%', minHeight: 250, background: '#000' }}></div>
                {cameraError && (
                  <div style={{ padding: 16, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', fontSize: 13, textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                    ⚠️ {cameraError}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
              <input
                ref={inputRef}
                className="form-input"
                placeholder="Type Reg No or Scan QR..."
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                style={{ flex: 1, minWidth: 0 }}
                autoFocus
              />
              <button type="submit" className="btn btn-primary" disabled={scanning} style={{ flexShrink: 0 }}>
                {scanning ? '⏳' : '🔍 Scan'}
              </button>
            </div>
          </form>

          {/* Gate Status Indicator */}
          <div className="card">
            <div className="card-title">🔒 Gate Status</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1, background: result?.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${result?.success ? 'var(--success)' : 'var(--danger)'}`, borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 32 }}>{result?.success ? '🔓' : '🔐'}</div>
                <div style={{ fontWeight: 700, marginTop: 8, color: result?.success ? 'var(--success)' : 'var(--danger)' }}>
                  {result?.success ? 'UNLOCKED' : 'LOCKED'}
                </div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Today's Activity</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{logs.filter(l => l.created_at?.startsWith(new Date().toISOString().split('T')[0])).length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>scans today</div>
              </div>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="card no-padding">
          <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--border)' }}>
            <div className="card-title" style={{ marginBottom: 0 }}>📜 Entry / Exit Log</div>
          </div>
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {logs.length === 0 && <div className="empty-state"><div className="empty-icon">📋</div><p>No logs yet</p></div>}
            {logs.map(log => (
              <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: log.direction === 'OUT' ? (log.authorized ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)') : 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {log.flagged ? '🚨' : log.direction === 'OUT' ? '↗️' : '↙️'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    <span className={`badge badge-${log.institution_code === 'ENG' ? 'eng' : log.institution_code === 'AGRI' ? 'agri' : 'pharm'}`} style={{ padding: '1px 6px', fontSize: 10 }}>{log.institution_code}</span>
                    {' '}{log.reg_no}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: log.flagged ? 'var(--danger)' : log.direction === 'OUT' ? 'var(--warning)' : 'var(--success)' }}>
                    {log.flagged ? 'FLAGGED' : log.direction === 'OUT' ? 'EXIT' : 'ENTRY'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{new Date(log.created_at).toLocaleTimeString('en-IN')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
