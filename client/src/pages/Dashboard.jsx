import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  LineChart, Line
} from 'recharts';

export default function Dashboard({ onNavigate }) {
  const { api, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [notices, setNotices] = useState([]);
  const [aiOccupancy, setAiOccupancy] = useState(null);
  const [aiMeals, setAiMeals] = useState(null);
  const [anomalies, setAnomalies] = useState(null);

  useEffect(() => {
    // Fetch full analytics overview & AI forecasts
    api('/api/analytics/overview').then(setStats).catch(() => {});
    api('/api/notices').then(setNotices).catch(() => {});
    api('/api/forecast/occupancy').then(setAiOccupancy).catch(() => {});
    api('/api/forecast/meals').then(setAiMeals).catch(() => {});
    api('/api/forecast/analytics/anomalies').then(setAnomalies).catch(() => {});
  }, [api]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#0ea5e9'];

  return (
    <div className="page-enter">
      <div className="section-header">
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>
            Welcome back, <span className="gradient-text">{user?.name?.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s+/i, '').split(' ')[0]}</span> ✨
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="stats-grid">
        {stats ? (<>
          <div className="stat-card indigo" onClick={() => onNavigate('students')} style={{ cursor: 'pointer' }}>
            <div className="stat-icon">👥</div>
            <div className="stat-value">{stats.totalStudents}</div>
            <div className="stat-label">{['TUTOR', 'HOD'].includes(user?.role) ? 'Class / Dept Students' : 'Total Students'}</div>
          </div>

          {['TUTOR', 'HOD'].includes(user?.role) ? (
            <div className="stat-card amber" onClick={() => onNavigate('leaves')} style={{ cursor: 'pointer' }}>
              <div className="stat-icon">📋</div>
              <div className="stat-value">{stats.pendingLeaves}</div>
              <div className="stat-label">Pending Leave Requests</div>
            </div>
          ) : (
            <div className="stat-card teal" onClick={() => onNavigate('rooms')} style={{ cursor: 'pointer' }}>
              <div className="stat-icon">🛏️</div>
              <div className="stat-value">{stats.occupancyPct}%</div>
              <div className="stat-label">Occupancy Rate</div>
            </div>
          )}

          <div className="stat-card teal" onClick={() => onNavigate('outside')} style={{ cursor: 'pointer' }}>
            <div className="stat-icon">🚶‍♂️</div>
            <div className="stat-value">{stats.studentsOutside}</div>
            <div className="stat-label">Students Outside Now</div>
          </div>

          <div className="stat-card rose" onClick={() => onNavigate(['TUTOR', 'HOD'].includes(user?.role) ? 'complaints' : 'mess')} style={{ cursor: 'pointer' }}>
            <div className="stat-icon">{['TUTOR', 'HOD'].includes(user?.role) ? '📝' : '⚠️'}</div>
            <div className="stat-value">{['TUTOR', 'HOD'].includes(user?.role) ? stats.openComplaints : stats.expiringItems}</div>
            <div className="stat-label">{['TUTOR', 'HOD'].includes(user?.role) ? 'Open Complaints' : 'Expiring Groceries (7d)'}</div>
          </div>
        </>) : (
          <div className="loading" style={{ gridColumn: '1/-1' }}><div className="spinner" /></div>
        )}
      </div>

      {/* 🤖 AI & Python Analytics Intelligence Row */}
      {(aiOccupancy || aiMeals || anomalies) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 20 }}>
          {aiOccupancy && (
            <div className="card" style={{ borderLeft: '4px solid var(--primary)', background: 'rgba(99,102,241,0.05)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>🤖 AI Occupancy Forecast</div>
              <div style={{ fontSize: 24, fontWeight: 800, margin: '6px 0 2px' }}>~{aiOccupancy.forecast_occupancy} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>/ {aiOccupancy.total_capacity} students</span></div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{aiOccupancy.insight}</div>
            </div>
          )}

          {aiMeals && (
            <div className="card" style={{ borderLeft: '4px solid #10b981', background: 'rgba(16,185,129,0.05)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.5 }}>🍽️ Meal Demand Prediction</div>
              <div style={{ fontSize: 13, fontWeight: 700, margin: '8px 0 4px', display: 'flex', gap: 12 }}>
                <span>B: {aiMeals.predictions?.breakfast}</span>
                <span>L: {aiMeals.predictions?.lunch}</span>
                <span>S: {aiMeals.predictions?.snacks}</span>
                <span>D: {aiMeals.predictions?.dinner}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{aiMeals.recommendation}</div>
            </div>
          )}

          {anomalies && (
            <div className="card" style={{ borderLeft: `4px solid ${anomalies.anomaly_count > 0 ? 'var(--danger)' : '#10b981'}`, background: anomalies.anomaly_count > 0 ? 'rgba(239,68,68,0.05)' : 'rgba(16,185,129,0.05)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: anomalies.anomaly_count > 0 ? 'var(--danger)' : '#10b981', textTransform: 'uppercase', letterSpacing: 0.5 }}>📊 Anomaly Detection (Z-Score)</div>
              <div style={{ fontSize: 24, fontWeight: 800, margin: '6px 0 2px' }}>{anomalies.anomaly_count} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>active anomalies</span></div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{anomalies.anomaly_count > 0 ? anomalies.anomalies[0]?.message : 'All operations operating within 2σ normal threshold.'}</div>
            </div>
          )}
        </div>
      )}

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20, marginTop: 20 }}>
          
          {/* Leave Trends (Line Chart) */}
          <div className="card">
            <div className="card-title">📅 Leave Trend (Last 30 Days)</div>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <LineChart data={stats.leaveTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{fontSize: 10}} tickFormatter={(tick) => tick.slice(5)} />
                  <YAxis tick={{fontSize: 10}} />
                  <RechartsTooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} dot={{r:3}} activeDot={{r:6}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Complaints by Category (Bar Chart) */}
          <div className="card">
            <div className="card-title">📝 Complaints Breakdown</div>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <BarChart data={stats.complaintsByCategory} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" tick={{fontSize: 10}} />
                  <YAxis dataKey="category" type="category" tick={{fontSize: 10}} />
                  <RechartsTooltip cursor={{fill: 'var(--surface-2)'}} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Institution or Year Demographics */}
          {['SUPER_ADMIN', 'HOSTEL_ADMIN', 'PRINCIPAL'].includes(user?.role) && (stats.byInstitution || []).length > 0 && (
            <div className="card">
              <div className="card-title">🏫 Students by Institution</div>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={stats.byInstitution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="count" nameKey="code" paddingAngle={5}>
                      {(stats.byInstitution || []).map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Room Occupancy by Block */}
          {!['TUTOR', 'HOD'].includes(user?.role) && (stats.roomsByBlock || []).length > 0 && (
            <div className="card">
              <div className="card-title">🏢 Occupancy by Block</div>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={stats.roomsByBlock}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="block" tick={{fontSize: 10}} />
                    <YAxis tick={{fontSize: 10}} />
                    <RechartsTooltip cursor={{fill: 'var(--surface-2)'}} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="occupied" name="Occupied Beds" stackId="a" fill="#10b981" />
                    <Bar dataKey="total_rooms" name="Total Capacity (Rooms * 4)" stackId="a" fill="#334155" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Notices & Quick Links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
        {/* Notices */}
        <div className="card">
          <div className="card-title">📢 Recent Notices</div>
          {notices.slice(0, 4).map(n => (
            <div key={n.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className={`badge ${n.category === 'Urgent' ? 'badge-danger' : 'badge-info'}`}>{n.category}</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{new Date(n.created_at).toLocaleDateString('en-IN')}</span>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{n.content.slice(0,80)}...</div>
            </div>
          ))}
          {notices.length === 0 && <div className="empty-state"><div className="empty-icon">📢</div><p>No notices</p></div>}
        </div>

        {/* Quick Links */}
        <div className="card">
          <div className="card-title">⚡ Quick Actions</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {[
              ...(['GATE_STAFF', 'SUPER_ADMIN', 'HOSTEL_ADMIN', 'WARDEN'].includes(user?.role) ? [{ label: '🚪 Open Gate Scanner', page: 'gate', color: '#6366f1' }] : []),
              { label: '📋 View Pending Leaves', page: 'leaves', color: '#f59e0b' },
              ...(!['TUTOR'].includes(user?.role) ? [{ label: '🏠 Room Occupancy', page: 'rooms', color: '#10b981' }] : []),
              { label: '🚶 Students Outside', page: 'outside', color: '#ef4444' },
              ...(['TUTOR', 'HOD'].includes(user?.role) ? [{ label: '👥 Class Students', page: 'students', color: '#6366f1' }, { label: '📝 View Complaints', page: 'complaints', color: '#a855f7' }] : [])
            ].map(q => (
              <div key={q.page + q.label} onClick={() => onNavigate(q.page)} style={{ padding: '10px 18px', background: q.color + '18', border: `1px solid ${q.color}44`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: q.color, cursor: 'pointer' }}>
                {q.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
