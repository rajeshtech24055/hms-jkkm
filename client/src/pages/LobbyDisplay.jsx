import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LobbyDisplay({ onExit }) {
  const { api } = useAuth();
  const [time, setTime] = useState(new Date());
  const [notices, setNotices] = useState([]);
  const [menu, setMenu] = useState({});
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    // Clock
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Fetch data initially and every 10 minutes
    const fetchData = async () => {
      try {
        const [nData, mData] = await Promise.all([
          api('/api/notices'),
          api('/api/menu')
        ]);
        
        // Filter urgent or recent notices
        setNotices(nData.slice(0, 5));
        
        // Find today's menu
        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const todayStr = days[new Date().getDay()];
        const todayMenu = mData.find(m => m.day === todayStr) || {};
        setMenu(todayMenu);
      } catch (err) {
        console.error('Lobby fetch error', err);
      }
    };
    
    fetchData();
    const fetchTimer = setInterval(fetchData, 600000);
    return () => clearInterval(fetchTimer);
  }, [api]);

  useEffect(() => {
    // Rotate slides every 15 seconds
    const slideTimer = setInterval(() => {
      setActiveSlide(s => (s + 1) % 2); // 0 = Notices, 1 = Menu
    }, 15000);
    return () => clearInterval(slideTimer);
  }, []);

  const formatDate = (date) => {
    return date.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      background: '#0f172a', color: '#f8fafc', zIndex: 9999,
      display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px', background: '#1e293b', borderBottom: '2px solid #3b82f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 60, height: 60, background: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🎓</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>JKKM Institutions</h1>
            <div style={{ color: '#94a3b8', fontSize: 18 }}>Hostel Information Display</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 48, fontWeight: 800, fontFamily: 'monospace', color: '#60a5fa' }}>{formatTime(time)}</div>
          <div style={{ fontSize: 20, color: '#cbd5e1' }}>{formatDate(time)}</div>
        </div>
        
        {/* Hidden exit button for admins to close the lobby view */}
        <button 
          onClick={onExit} 
          style={{ position: 'absolute', top: 0, right: 0, opacity: 0, width: 100, height: 100, cursor: 'pointer' }}
          title="Exit TV Mode"
        />
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '48px', position: 'relative' }}>
        
        {/* Slide 0: Notices */}
        <div style={{
          position: 'absolute', top: 48, left: 48, right: 48, bottom: 48,
          opacity: activeSlide === 0 ? 1 : 0, transition: 'opacity 1s ease-in-out', pointerEvents: activeSlide === 0 ? 'auto' : 'none'
        }}>
          <h2 style={{ fontSize: 40, color: '#38bdf8', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
            <span>📢</span> Important Announcements
          </h2>
          <div style={{ display: 'grid', gap: 24 }}>
            {notices.length > 0 ? notices.map(n => (
              <div key={n.id} style={{ background: '#1e293b', padding: 32, borderRadius: 16, borderLeft: `8px solid ${n.category === 'Urgent' ? '#ef4444' : '#3b82f6'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 28 }}>{n.title}</h3>
                  <span style={{ background: n.category === 'Urgent' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)', color: n.category === 'Urgent' ? '#f87171' : '#60a5fa', padding: '8px 16px', borderRadius: 8, fontSize: 16, fontWeight: 'bold' }}>
                    {n.category}
                  </span>
                </div>
                <p style={{ fontSize: 22, color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>{n.content}</p>
              </div>
            )) : (
              <div style={{ fontSize: 28, color: '#64748b', textAlign: 'center', marginTop: 100 }}>No active notices at this time.</div>
            )}
          </div>
        </div>

        {/* Slide 1: Menu */}
        <div style={{
          position: 'absolute', top: 48, left: 48, right: 48, bottom: 48,
          opacity: activeSlide === 1 ? 1 : 0, transition: 'opacity 1s ease-in-out', pointerEvents: activeSlide === 1 ? 'auto' : 'none'
        }}>
          <h2 style={{ fontSize: 40, color: '#4ade80', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
            <span>🍽️</span> Today's Mess Menu
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, height: 'calc(100% - 100px)' }}>
            <div style={{ background: '#1e293b', borderRadius: 24, padding: 40, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ fontSize: 24, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2 }}>Breakfast <span style={{fontSize: 16}}>(7:30 - 9:00 AM)</span></div>
              <div style={{ fontSize: 32, fontWeight: 600, color: '#f8fafc' }}>{menu.breakfast || 'Not specified'}</div>
            </div>
            <div style={{ background: '#1e293b', borderRadius: 24, padding: 40, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ fontSize: 24, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2 }}>Lunch <span style={{fontSize: 16}}>(12:30 - 2:00 PM)</span></div>
              <div style={{ fontSize: 32, fontWeight: 600, color: '#f8fafc' }}>{menu.lunch || 'Not specified'}</div>
            </div>
            <div style={{ background: '#1e293b', borderRadius: 24, padding: 40, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ fontSize: 24, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2 }}>Snacks <span style={{fontSize: 16}}>(4:30 - 5:30 PM)</span></div>
              <div style={{ fontSize: 32, fontWeight: 600, color: '#f8fafc' }}>{menu.snacks || 'Not specified'}</div>
            </div>
            <div style={{ background: '#1e293b', borderRadius: 24, padding: 40, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ fontSize: 24, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 2 }}>Dinner <span style={{fontSize: 16}}>(7:30 - 9:00 PM)</span></div>
              <div style={{ fontSize: 32, fontWeight: 600, color: '#f8fafc' }}>{menu.dinner || 'Not specified'}</div>
            </div>
          </div>
        </div>

      </div>

      {/* Footer Ticker */}
      <div style={{ background: '#0f172a', padding: '16px 0', borderTop: '1px solid #334155', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-block', animation: 'ticker 20s linear infinite', fontSize: 20, color: '#94a3b8' }}>
          <style>
            {`
              @keyframes ticker {
                0% { transform: translateX(100vw); }
                100% { transform: translateX(-100%); }
              }
            `}
          </style>
          Welcome to JKKM Institutions! Please ensure you scan your ID card at the gate before exiting. For maintenance issues, use the student portal to log a ticket.
        </div>
      </div>
    </div>
  );
}
