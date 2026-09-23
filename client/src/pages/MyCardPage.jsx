import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function MyCardPage() {
  const { user, api } = useAuth();
  const [studentDetails, setStudentDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState(null);
  const [liveTime, setLiveTime] = useState(new Date());

  useEffect(() => {
    if (user?.role === 'STUDENT' && user?.id) {
      fetchStudentDetails();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Live ticking clock to prevent screenshots
  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Periodic QR refresh every 15 seconds to keep dynamic token fresh
  useEffect(() => {
    if (!studentDetails?.id) return;
    const refreshQr = async () => {
      try {
        const qrData = await api(`/api/students/${studentDetails.id}/qr`);
        if (qrData && qrData.qr) {
          setQrCode(qrData.qr);
        }
      } catch (e) {
        console.error("Failed to refresh QR code", e);
      }
    };
    const interval = setInterval(refreshQr, 15000);
    return () => clearInterval(interval);
  }, [studentDetails?.id, api]);

  const fetchStudentDetails = async () => {
    try {
      // Fetch all students to find current user
      const data = await api('/api/students');
      const student = data.find(s => s.email === user.email);
      
      if (student) {
        // Fetch logs to determine IN/OUT status
        const logs = await api('/api/gate/log');
        const myLogs = logs.filter(l => l.student_id === student.id);
        const lastLog = myLogs.length > 0 ? myLogs[0] : null; // logs are ordered DESC
        const status = (!lastLog || lastLog.direction === 'IN') ? 'INSIDE' : 'OUTSIDE';
        
        student.current_status = status;
        setStudentDetails(student);

        // Fetch actual QR code
        try {
          const qrData = await api(`/api/students/${student.id}/qr`);
          if (qrData && qrData.qr) {
            setQrCode(qrData.qr);
          }
        } catch (e) {
          console.error("Failed to load QR code", e);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'STUDENT') {
    return (
      <div className="page-enter empty-state card">
        <div className="empty-icon">🛑</div>
        <p>This module is only accessible to Students.</p>
      </div>
    );
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  if (!studentDetails) {
    return (
      <div className="page-enter empty-state card">
        <div className="empty-icon">❓</div>
        <p>Student profile not found. Please contact administration.</p>
      </div>
    );
  }

  const instColors = { ENG: 'inst-eng', AGRI: 'inst-agri', PHARM: 'inst-pharm' };
  const instClass = instColors[studentDetails.institution_code] || 'inst-eng';

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 40, paddingBottom: 60 }}>
      <h2 style={{ marginBottom: 10, fontSize: 28, fontWeight: 800 }}>My Digital ID Card</h2>
      
      {/* Live Indicator Banner to prevent screenshots */}
      <div style={{ marginBottom: 30, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(16,185,129,0.1)', padding: '6px 16px', borderRadius: 20, color: '#10b981', fontWeight: 600 }}>
        <div className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'blink 1.5s infinite' }}></div>
        LIVE PASS • {liveTime.toLocaleTimeString()}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
        .secure-card {
          position: relative;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          transition: transform 0.3s;
        }
        .secure-card:active {
          transform: scale(0.98);
        }
        .hologram-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%);
          background-size: 200% 200%;
          animation: shimmer 3s infinite linear;
          pointer-events: none;
          z-index: 10;
        }
        @keyframes shimmer {
          0% { background-position: -100% -100%; }
          100% { background-position: 200% 200%; }
        }
      `}} />

      <div className="hostel-card secure-card" style={{ transform: 'scale(1.15)', transformOrigin: 'top center' }}>
        <div className="hologram-overlay"></div>
        <div className="hostel-card-header">
          <div>
            <div className={`hostel-card-inst ${instClass}`}>{studentDetails.institution_name}</div>
            <div className="hostel-card-title">Secure Hostel ID</div>
          </div>
          <div className="hostel-card-chip"></div>
        </div>
        
        <div className="hostel-card-photo-row">
          <div className="hostel-card-avatar" style={{ fontSize: 24, boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)' }}>
            {studentDetails.name.split(' ').map(n=>n[0]).join('')}
          </div>
          <div className="hostel-card-info">
            <h3>{studentDetails.name}</h3>
            <p>{studentDetails.dept_name || 'Department N/A'}</p>
            <div className="hostel-card-reg">{studentDetails.reg_no}</div>
          </div>
        </div>
        
        <div className="hostel-card-details">
          <div className="hostel-card-detail">
            <span>Room</span>
            <strong>{studentDetails.room_no || 'Not Assigned'}</strong>
          </div>
          <div className="hostel-card-detail">
            <span>Block</span>
            <strong>{studentDetails.block || 'N/A'}</strong>
          </div>
          <div className="hostel-card-detail">
            <span>Blood Group</span>
            <strong>{studentDetails.blood_group}</strong>
          </div>
          <div className="hostel-card-detail">
            <span>Mobile</span>
            <strong>{studentDetails.mobile || studentDetails.phone || 'N/A'}</strong>
          </div>
        </div>
        
        <div className="hostel-card-qr-row" style={{ alignItems: 'center', background: '#f8fafc', padding: 12, borderRadius: 12, marginTop: 20 }}>
          {qrCode ? (
            <img src={qrCode} alt="Security QR" style={{ width: 160, height: 160, borderRadius: 8, background: '#fff', padding: 4, border: '1px solid var(--border)' }} />
          ) : (
            <div style={{ width: 160, height: 160, background: '#e2e8f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, textAlign: 'center', padding: 4 }}>Loading QR...</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Current Status</div>
            <div className="hostel-card-status" style={{ 
              background: studentDetails.current_status === 'OUTSIDE' ? '#ef4444' : '#10b981',
              color: '#fff', padding: '6px 14px', borderRadius: 20, fontSize: 14, fontWeight: 800,
              boxShadow: `0 4px 12px ${studentDetails.current_status === 'OUTSIDE' ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`
            }}>
              {studentDetails.current_status === 'OUTSIDE' ? '🔴 OUTSIDE' : '🟢 INSIDE'}
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ marginTop: 60, padding: 20, background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 400, textAlign: 'center', border: '1px solid var(--border)' }}>
        <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Anti-Fraud Protection Active 🛡️</h4>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
          This digital ID contains a live ticking clock, holographic shimmer, and a scannable secure QR code. <strong>Screenshots are strictly prohibited and will be rejected at the gate.</strong>
        </p>
      </div>
    </div>
  );
}
