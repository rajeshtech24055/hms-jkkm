import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import StudentsPage from './pages/StudentsPage';
import GateScanner from './pages/GateScanner';
import LeavesPage from './pages/LeavesPage';
import OutsidePage from './pages/OutsidePage';
import MessPage from './pages/MessPage';
import MessAnalytics from './pages/MessAnalytics';
import RoomsPage from './pages/RoomsPage';
import InventoryPage from './pages/InventoryPage';
import MaintenancePage from './pages/MaintenancePage';
import NoticesPage from './pages/NoticesPage';
import MenuPage from './pages/MenuPage';
import MyCardPage from './pages/MyCardPage';
import MyLeavePage from './pages/MyLeavePage';
import ComplaintsPage from './pages/ComplaintsPage';
import VacatePage from './pages/VacatePage';
import DepartmentsPage from './pages/DepartmentsPage';
import AuditLogPage from './pages/AuditLogPage';
import LobbyDisplay from './pages/LobbyDisplay';
import UsersPage from './pages/UsersPage';
import ChatbotBubble from './components/ChatbotBubble';
import { io } from 'socket.io-client';

// All page metadata — label, icon, component
const PAGE_META = {
  dashboard:      { label: 'Dashboard',         icon: '📊', component: Dashboard },
  users:          { label: 'Staff & Users',      icon: '👥', component: UsersPage },
  lobby:          { label: 'TV Lobby Display',   icon: '📺', component: LobbyDisplay },
  students:       { label: 'Students',           icon: '👨‍🎓', component: StudentsPage },
  rooms:          { label: 'Rooms',              icon: '🚪', component: RoomsPage },
  departments:    { label: 'Departments',        icon: '🏛️', component: DepartmentsPage },
  leaves:         { label: 'Leave Approvals',    icon: '📋', component: LeavesPage },
  gate:           { label: 'Gate Scanner',       icon: '🔐', component: GateScanner },
  outside:        { label: 'Students Outside',   icon: '🌍', component: OutsidePage },
  mycard:         { label: 'My Hostel Card',     icon: '🪪', component: MyCardPage },
  myleave:        { label: 'My Leave',           icon: '✈️', component: MyLeavePage },
  mess:           { label: 'Mess Inventory',     icon: '🍽️', component: MessPage },
  mess_analytics: { label: 'Mess Analytics',    icon: '📈', component: MessAnalytics },
  menu:           { label: 'Weekly Menu',        icon: '🥗', component: MenuPage },
  inventory:      { label: 'Materials & Tools',  icon: '📦', component: InventoryPage },
  maintenance:    { label: 'Maintenance',        icon: '🔧', component: MaintenancePage },
  vacate:         { label: 'Vacate Requests',    icon: '🏠', component: VacatePage },
  notices:        { label: 'Notices',            icon: '📢', component: NoticesPage },
  complaints:     { label: 'Complaints',         icon: '⚠️', component: ComplaintsPage },
  audit:          { label: 'Audit Logs',         icon: '🔐', component: AuditLogPage },
};

// All accessible pages per role
const ROLE_PAGES = {
  SUPER_ADMIN:     ['dashboard','users','students','rooms','departments','leaves','vacate','gate','outside','mess','mess_analytics','menu','inventory','maintenance','notices','complaints','audit','lobby'],
  HOSTEL_ADMIN:    ['dashboard','students','rooms','departments','leaves','vacate','gate','outside','mess_analytics','notices','complaints'],
  WARDEN:          ['dashboard','students','rooms','leaves','vacate','outside','notices','complaints'],
  TUTOR:           ['dashboard','students','leaves','outside','notices'],
  HOD:             ['dashboard','students','leaves','outside','notices'],
  PRINCIPAL:       ['dashboard','students','leaves','vacate','outside','mess_analytics','notices'],
  STUDENT:         ['mycard','myleave','menu','notices','complaints'],
  FOOD_ADMIN:      ['dashboard','mess','mess_analytics','menu','notices'],
  MESS_WORKER:     ['mess','menu'],
  INVENTORY_ADMIN: ['inventory'],
  MAINTENANCE:     ['maintenance'],
  GATE_STAFF:      ['gate'],
};

// Bottom nav pinned shortcuts (max 4 items)
const ROLE_BOTTOM_NAV = {
  SUPER_ADMIN:     ['dashboard','students','leaves','gate'],
  HOSTEL_ADMIN:    ['dashboard','students','leaves','rooms'],
  WARDEN:          ['dashboard','leaves','rooms','outside'],
  TUTOR:           ['dashboard','leaves','outside','notices'],
  HOD:             ['dashboard','leaves','outside','notices'],
  PRINCIPAL:       ['dashboard','leaves','vacate','mess_analytics'],
  STUDENT:         ['mycard','myleave','notices','complaints'],
  FOOD_ADMIN:      ['mess','mess_analytics','menu','notices'],
  MESS_WORKER:     ['mess','menu'],
  INVENTORY_ADMIN: ['inventory'],
  MAINTENANCE:     ['maintenance'],
  GATE_STAFF:      ['gate'],
};

// Full-screen More Drawer listing all pages in a grid
function MoreDrawer({ user, onNavigate, onClose, logout }) {
  const allPages = ROLE_PAGES[user?.role] || [];
  return (
    <div
      style={{ position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.5)',display:'flex',flexDirection:'column',justifyContent:'flex-end' }}
      onClick={onClose}
    >
      <div
        style={{ background:'var(--bg-card)',borderRadius:'20px 20px 0 0',maxHeight:'82vh',overflowY:'auto',paddingBottom:'env(safe-area-inset-bottom,16px)',boxShadow:'0 -8px 40px rgba(0,0,0,0.25)',animation:'slideUpDrawer 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={{ display:'flex',justifyContent:'center',padding:'12px 0 4px' }}>
          <div style={{ width:40,height:4,borderRadius:2,background:'var(--border)' }} />
        </div>

        {/* Header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 20px 16px' }}>
          <div>
            <div style={{ fontWeight:700,fontSize:16 }}>All Pages</div>
            <div style={{ fontSize:12,color:'var(--text-dim)',marginTop:2 }}>{user?.name} · {user?.role?.replace(/_/g,' ')}</div>
          </div>
          <button onClick={onClose} style={{ background:'var(--bg-card2)',border:'1px solid var(--border)',borderRadius:8,padding:'6px 14px',fontSize:18,cursor:'pointer',lineHeight:1 }}>×</button>
        </div>

        {/* 3-column grid of all pages */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,padding:'0 14px 20px' }}>
          {allPages.map(pageKey => {
            const meta = PAGE_META[pageKey];
            if (!meta) return null;
            return (
              <div
                key={pageKey}
                onClick={() => { onNavigate(pageKey); onClose(); }}
                style={{ background:'var(--bg-card2)',borderRadius:12,padding:'18px 8px 14px',display:'flex',flexDirection:'column',alignItems:'center',gap:8,cursor:'pointer',border:'1px solid var(--border)',WebkitTapHighlightColor:'transparent',userSelect:'none' }}
              >
                <span style={{ fontSize:30,lineHeight:1 }}>{meta.icon}</span>
                <span style={{ fontSize:11,fontWeight:600,textAlign:'center',color:'var(--text)',lineHeight:1.3 }}>{meta.label}</span>
              </div>
            );
          })}
        </div>

        {/* Sign out */}
        <div style={{ padding:'0 14px 20px' }}>
          <button
            onClick={() => { if(window.confirm('Logout from JKKM HMS?')) logout(); }}
            style={{ width:'100%',padding:14,borderRadius:12,background:'rgba(239,68,68,0.08)',color:'var(--danger)',border:'1px solid rgba(239,68,68,0.2)',fontWeight:700,fontSize:15,cursor:'pointer' }}
          >
            🚪 Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function MainLayout() {
  const { api, user, logout } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  React.useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const delay = setTimeout(() => {
      api(`/api/search?q=${encodeURIComponent(searchQuery)}`).then(setSearchResults).catch(console.error);
    }, 300);
    return () => clearTimeout(delay);
  }, [searchQuery, api]);

  React.useEffect(() => {
    if (!user) return;
    const baseUrl = 'https://hms-jkkm-api.onrender.com';
    const socketUrl = baseUrl || '/';
    const socket = io(socketUrl, { transports: ['polling', 'websocket'] });
    socket.emit('join', user.role);
    socket.on('notification', (msg) => {
      const newAlert = { id: Date.now(), msg };
      setLiveAlerts(prev => [...prev, newAlert]);
      setTimeout(() => setLiveAlerts(prev => prev.filter(a => a.id !== newAlert.id)), 5000);
    });
    return () => socket.disconnect();
  }, [user]);

  React.useEffect(() => {
    if (user?.role === 'GATE_STAFF') setActivePage('gate');
    else if (user?.role === 'MESS_WORKER') setActivePage('mess');
    else if (user?.role === 'MAINTENANCE') setActivePage('maintenance');
    else if (user?.role === 'STUDENT') setActivePage('mycard');
    else if (user?.role === 'INVENTORY_ADMIN') setActivePage('inventory');
    else setActivePage('dashboard');
  }, [user]);

  // ── Keep-alive: ping API every 14 min to prevent Render spin-down ──────────
  const [apiOnline, setApiOnline] = React.useState(true);
  React.useEffect(() => {
    const API_URL = 'https://hms-jkkm-api.onrender.com/ping';
    const doPing = () => {
      fetch(API_URL, { method: 'GET', cache: 'no-store' })
        .then(r => setApiOnline(r.ok))
        .catch(() => setApiOnline(false));
    };
    doPing(); // ping immediately on mount
    const timer = setInterval(doPing, 14 * 60 * 1000); // every 14 minutes
    return () => clearInterval(timer);
  }, []);
  // ───────────────────────────────────────────────────────────────────────────

  const navigate = (page) => { setActivePage(page); setSidebarOpen(false); setMoreDrawerOpen(false); };

  const fetchNotifications = () => { api('/api/notifications').then(setNotifications).catch(console.error); };

  const renderPage = () => {
    if (activePage === 'lobby') return <LobbyDisplay onExit={() => setActivePage('dashboard')} />;
    const meta = PAGE_META[activePage];
    if (!meta) return <Dashboard onNavigate={navigate} />;
    const Comp = meta.component;
    return activePage === 'dashboard' ? <Comp onNavigate={navigate} /> : <Comp />;
  };

  const pinnedKeys = ROLE_BOTTOM_NAV[user?.role] || [];
  const allRolePages = ROLE_PAGES[user?.role] || [];
  const hasMorePages = allRolePages.length > pinnedKeys.length;

  if (activePage === 'lobby') return <LobbyDisplay onExit={() => setActivePage('dashboard')} />;

  return (
    <div className="app-layout">
      <div className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />

      <Sidebar activePage={activePage} onNavigate={navigate} isOpen={sidebarOpen} />

      <main className="main-content">
        <header className="topbar">
          <div style={{ display:'flex',alignItems:'center',gap:16 }}>
            <button className="btn-icon mobile-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
            <h1 style={{ textTransform:'capitalize' }}>
              {PAGE_META[activePage]?.label || activePage}
            </h1>
          </div>
          <div className="topbar-actions">
            {/* API keep-alive status indicator */}
            <span
              title={apiOnline ? 'API Server: Online' : 'API Server: Offline or starting up…'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 600,
                color: apiOnline ? 'var(--success)' : 'var(--danger)',
                background: apiOnline ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${apiOnline ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: 20, padding: '3px 10px', cursor: 'default',
              }}
              className="hide-mobile"
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: apiOnline ? 'var(--success)' : 'var(--danger)', display: 'inline-block', animation: apiOnline ? 'pulse 2s infinite' : 'none' }} />
              {apiOnline ? 'API Live' : 'API Offline'}
            </span>
            <button className="btn btn-ghost btn-icon" style={{ position:'relative' }} onClick={() => { fetchNotifications(); setShowNotifModal(true); }} title="Notifications">
              🔔 <span className="notif-dot" style={{ position:'absolute',top:6,right:6 }} />
            </button>
            <button
              onClick={() => { if(window.confirm('Logout from JKKM HMS?')) logout(); }}
              style={{ display:'flex',alignItems:'center',gap:8,background:'none',border:'none',cursor:'pointer',padding:'4px 6px',borderRadius:8,color:'var(--text)' }}
            >
              <div style={{ width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,var(--primary),var(--secondary))',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'bold',fontSize:12,color:'white' }}>
                {user?.name?.[0]}
              </div>
              <span style={{ fontSize:12,fontWeight:600,maxWidth:80,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }} className="hide-mobile">
                {user?.name?.split(' ')[0]}
              </span>
            </button>
          </div>
        </header>

        <div className="page-content">{renderPage()}</div>
      </main>

      {/* ─── MOBILE BOTTOM NAV ─────────────────────────────────────────── */}
      <nav className="mobile-bottom-nav">
        {pinnedKeys.map(pageKey => {
          const meta = PAGE_META[pageKey];
          if (!meta) return null;
          
          // Determine short label for bottom nav
          let shortLabel = meta.label;
          if (pageKey === 'mycard') shortLabel = 'Card';
          if (pageKey === 'myleave') shortLabel = 'Leave';
          if (pageKey === 'dashboard') shortLabel = 'Home';
          
          return (
            <div
              key={pageKey}
              className={`mobile-bottom-nav-item ${activePage === pageKey ? 'active' : ''}`}
              onClick={() => navigate(pageKey)}
            >
              <span className="nav-icon">{meta.icon}</span>
              <span>{shortLabel}</span>
            </div>
          );
        })}
        {hasMorePages ? (
          <div
            className={`mobile-bottom-nav-item ${moreDrawerOpen ? 'active' : ''}`}
            onClick={() => setMoreDrawerOpen(true)}
          >
            <span className="nav-icon" style={{ fontSize:24,fontWeight:700 }}>⋯</span>
            <span>More</span>
          </div>
        ) : (
          <div
            className="mobile-bottom-nav-item logout-nav-item"
            onClick={() => { if(window.confirm('Logout?')) logout(); }}
          >
            <span className="nav-icon">🚪</span>
            <span>Logout</span>
          </div>
        )}
      </nav>

      {/* More Drawer */}
      {moreDrawerOpen && (
        <MoreDrawer user={user} onNavigate={navigate} onClose={() => setMoreDrawerOpen(false)} logout={logout} />
      )}

      {/* Notifications Modal */}
      {showNotifModal && (
        <div className="modal-overlay" onClick={() => setShowNotifModal(false)}>
          <div className="modal" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">🔔 System Notifications & Logs</span>
              <button className="modal-close" onClick={() => setShowNotifModal(false)}>×</button>
            </div>
            <div style={{ maxHeight:420,overflowY:'auto',display:'flex',flexDirection:'column',gap:10 }}>
              {notifications.length === 0 ? (
                <div className="empty-state"><p>No notifications yet.</p></div>
              ) : (
                notifications.map(n => {
                  const isAlert = ['LOW_STOCK','EXPIRED','EXPIRING_SOON'].includes(n.type);
                  return (
                    <div key={n.id} style={{ padding:12,borderRadius:8,background:isAlert?'rgba(245,158,11,0.05)':'var(--bg-card)',border:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:6 }}>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                        <span className={`badge ${n.type==='EMERGENCY_LEAVE'||n.type==='EXPIRED'?'badge-danger':n.type==='EXPIRING_SOON'||n.type==='LOW_STOCK'?'badge-warning':'badge-primary'}`}>
                          {n.type==='EMERGENCY_LEAVE'?'🚨 Emergency Leave':n.type==='EXPIRED'?'🛑 Expired':n.type==='EXPIRING_SOON'?'⚠️ Expiring Soon':n.type==='LOW_STOCK'?'📉 Low Stock':'📍 Gate Log'}
                        </span>
                        <span style={{ fontSize:11,color:'var(--text-dim)' }}>{new Date(n.sent_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                      </div>
                      {!isAlert && <div style={{ fontSize:13,fontWeight:600 }}>To: 📱 {n.recipient_phone} ({n.student_name})</div>}
                      <div style={{ fontSize:13,background:'var(--bg-input)',padding:10,borderRadius:6,lineHeight:1.4 }}>{isAlert?n.message:`"${n.message}"`}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Alert Toasts */}
      <div style={{ position:'fixed',bottom:80,right:16,display:'flex',flexDirection:'column',gap:10,zIndex:9999,pointerEvents:'none',maxWidth:'calc(100vw - 32px)' }}>
        {liveAlerts.map(alert => (
          <div key={alert.id} style={{ background:alert.msg.includes('SOS')?'var(--danger)':'var(--primary)',color:'white',padding:'12px 16px',borderRadius:8,boxShadow:'0 10px 25px rgba(0,0,0,0.2)',display:'flex',alignItems:'center',gap:10,animation:'slideIn 0.3s ease-out' }}>
            <span>{alert.msg.includes('SOS')?'🚨':'🔔'}</span>
            <div style={{ fontSize:13,fontWeight:600 }}>{alert.msg}</div>
          </div>
        ))}
      </div>

      {/* SOS Button (Student only) */}
      {user?.role === 'STUDENT' && (
        <button
          className="sos-floating-btn"
          onClick={async () => {
            if(window.confirm('⚠️ TRIGGER SOS EMERGENCY?\nThis will alert wardens immediately.')) {
              try { await api('/api/sos/trigger', { method: 'POST', body: JSON.stringify({ room_no: 'N/A' }) }); alert('🚨 SOS sent! Help is on the way.'); }
              catch(e) { alert(e.message); }
            }
          }}
          title="SOS Emergency"
        >
          <span className="sos-icon">🚨</span>
          <span className="sos-text">SOS</span>
        </button>
      )}

      {/* Chatbot (Student only) */}
      <ChatbotBubble />

      {/* Global Search (Ctrl+K) */}
      {searchOpen && (
        <div className="modal-overlay" onClick={() => setSearchOpen(false)} style={{ alignItems:'flex-start',paddingTop:'10vh' }}>
          <div className="modal" style={{ maxWidth:600,padding:0 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:20,marginRight:12 }}>🔍</span>
              <input autoFocus placeholder="Search students, rooms, notices..." style={{ flex:1,border:'none',background:'transparent',outline:'none',fontSize:18,color:'var(--text)' }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              <button className="badge" style={{ background:'var(--surface-2)',border:'none',cursor:'pointer' }} onClick={() => setSearchOpen(false)}>ESC</button>
            </div>
            <div style={{ maxHeight:400,overflowY:'auto' }}>
              {searchResults.length === 0 && searchQuery ? (
                <div style={{ padding:24,textAlign:'center',color:'var(--text-muted)' }}>No results found</div>
              ) : (
                searchResults.map(res => (
                  <div key={res.id+res.type} onClick={() => { setSearchOpen(false); setActivePage(res.page); }} style={{ padding:'12px 20px',borderBottom:'1px solid var(--border)',cursor:'pointer',display:'flex',alignItems:'center',gap:12 }} className="search-result-item">
                    <div style={{ background:'var(--surface-2)',width:36,height:36,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16 }}>{res.icon}</div>
                    <div>
                      <div style={{ fontSize:14,fontWeight:600 }}>{res.title}</div>
                      <div style={{ fontSize:12,color:'var(--text-muted)' }}>{res.subtitle}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const { user } = useAuth();
  return user ? <MainLayout /> : <LoginPage />;
}

export default function Root() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
