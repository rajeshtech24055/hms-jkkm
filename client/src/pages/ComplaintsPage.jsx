import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  { value: 'ragging',        label: '🚨 Ragging',        color: '#ef4444' },
  { value: 'cleanliness',    label: '🧹 Cleanliness',     color: '#f59e0b' },
  { value: 'noise',          label: '🔊 Noise',           color: '#8b5cf6' },
  { value: 'facilities',     label: '🏗️ Facilities',      color: '#3b82f6' },
  { value: 'food',           label: '🍽️ Food Quality',    color: '#10b981' },
  { value: 'staff_behavior', label: '👤 Staff Behavior',  color: '#ec4899' },
  { value: 'other',          label: '📝 Other',           color: '#6b7280' },
];

const STATUS_BADGES = {
  open:        { label: 'Open',        cls: 'badge-danger'  },
  in_progress: { label: 'In Progress', cls: 'badge-warning' },
  resolved:    { label: 'Resolved',    cls: 'badge-success' },
  dismissed:   { label: 'Dismissed',   cls: 'badge-ghost'   },
};

const PRIORITY_COLORS = {
  low:      '#6b7280',
  medium:   '#f59e0b',
  high:     '#ef4444',
  critical: '#dc2626',
};

export default function ComplaintsPage() {
  const { api, user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats]           = useState({});
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [filterStatus, setFilterStatus]     = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [form, setForm] = useState({ category: '', subject: '', description: '', is_anonymous: false });
  const [adminAction, setAdminAction] = useState({ status: '', admin_remarks: '', priority: '' });

  const isStudent = user?.role === 'STUDENT';
  const isAdmin   = ['SUPER_ADMIN', 'HOSTEL_ADMIN', 'WARDEN'].includes(user?.role);

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchComplaints(); }, [filterStatus, filterCategory]);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      let url = '/api/complaints?';
      if (filterStatus)   url += `status=${filterStatus}&`;
      if (filterCategory) url += `category=${filterCategory}&`;
      const data = await api(url);
      setComplaints(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try { const data = await api('/api/complaints/stats'); setStats(data); }
    catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category || !form.subject || !form.description) return alert('Please fill all required fields');
    try {
      await api('/api/complaints', { method: 'POST', body: JSON.stringify(form) });
      alert('Complaint submitted successfully!');
      setForm({ category: '', subject: '', description: '', is_anonymous: false });
      setShowForm(false);
      fetchComplaints(); fetchStats();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleUpdate = async (id) => {
    try {
      await api(`/api/complaints/${id}`, { method: 'PUT', body: JSON.stringify(adminAction) });
      alert('Complaint updated!');
      setShowDetail(null);
      fetchComplaints(); fetchStats();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const getCat      = (val) => CATEGORIES.find(c => c.value === val) || CATEGORIES[6];
  const timeSince   = (d) => { const h = Math.floor((Date.now() - new Date(d)) / 3600000); return h < 1 ? 'Just now' : h < 24 ? `${h}h ago` : `${Math.floor(h/24)}d ago`; };

  return (
    <div className="page-enter">
      <div className="section-header">
        <div>
          <h2>⚠️ Complaints &amp; Grievances</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {isStudent ? 'Submit and track your complaints — anonymous option available' : 'Manage and resolve student grievances'}
          </p>
        </div>
        {isStudent && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>✍️ New Complaint</button>
        )}
      </div>

      {/* Stats (Admin) */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total',       value: stats.total      || 0, color: 'var(--text)' },
            { label: 'Open',        value: stats.open       || 0, color: '#ef4444' },
            { label: 'In Progress', value: stats.inProgress || 0, color: '#f59e0b' },
            { label: 'Resolved',    value: stats.resolved   || 0, color: '#10b981' },
            { label: 'Dismissed',   value: stats.dismissed  || 0, color: '#6b7280' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters (Admin) */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <select className="form-input" style={{ width: 'auto', minWidth: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="open">🔴 Open</option>
            <option value="in_progress">🟡 In Progress</option>
            <option value="resolved">🟢 Resolved</option>
            <option value="dismissed">⚫ Dismissed</option>
          </select>
          <select className="form-input" style={{ width: 'auto', minWidth: 160 }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilterStatus(''); setFilterCategory(''); }}>🔄 Reset</button>
        </div>
      )}

      {/* List */}
      <div style={{ display: 'grid', gap: 12 }}>
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : complaints.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>📭</div>
            <p style={{ color: 'var(--text-muted)' }}>No complaints found</p>
            {isStudent && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowForm(true)}>Submit Your First Complaint</button>}
          </div>
        ) : complaints.map(c => {
          const cat        = getCat(c.category);
          const statusInfo = STATUS_BADGES[c.status] || STATUS_BADGES.open;
          const priColor   = PRIORITY_COLORS[c.priority] || '#f59e0b';
          return (
            <div key={c.id} className="card"
              style={{ padding: '16px 20px', cursor: 'pointer', borderLeft: `4px solid ${cat.color}`, transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              onClick={() => { setShowDetail(c); setAdminAction({ status: c.status, admin_remarks: c.admin_remarks || '', priority: c.priority }); }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 6, background: cat.color + '22', color: cat.color, fontWeight: 700 }}>{cat.label}</span>
                    <span className={`badge ${statusInfo.cls}`}>{statusInfo.label}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: priColor + '22', color: priColor, fontWeight: 600 }}>
                      {c.priority === 'critical' ? '🚨 ' : ''}{c.priority?.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{c.subject}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                    {c.description.slice(0, 130)}{c.description.length > 130 ? '…' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap', minWidth: 80 }}>
                  <div>{timeSince(c.created_at)}</div>
                  <div style={{ marginTop: 4 }}>{c.is_anonymous ? '🕵️ Anonymous' : c.student_name}</div>
                  {c.room_no && <div style={{ marginTop: 2 }}>🏠 {c.room_no}</div>}
                </div>
              </div>
              {c.admin_remarks && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  <strong>Admin:</strong> {c.admin_remarks}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit Complaint Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <span className="modal-title">✍️ Submit a Complaint</span>
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-input" required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="">-- Select Category --</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              {form.category === 'ragging' && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', fontSize: 12, color: '#ef4444', marginBottom: 12 }}>
                  🚨 <strong>Ragging is a serious offence.</strong> This will be marked <strong>CRITICAL</strong> and immediately escalated to Admin and Warden.
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Subject *</label>
                <input className="form-input" required value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Brief title of your complaint" />
              </div>
              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea className="form-input" required rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the issue in detail — date, time, location, people involved…" />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={form.is_anonymous} onChange={e => setForm(f => ({ ...f, is_anonymous: e.target.checked }))} style={{ width: 16, height: 16 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>🕵️ Submit Anonymously</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Your name and room will be hidden from all staff</div>
                  </div>
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>📤 Submit Complaint</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail + Admin Actions Modal */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <span className="modal-title">📋 Complaint #{showDetail.id}</span>
              <button className="modal-close" onClick={() => setShowDetail(null)}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, background: getCat(showDetail.category).color + '22', color: getCat(showDetail.category).color, fontWeight: 700 }}>{getCat(showDetail.category).label}</span>
                <span className={`badge ${(STATUS_BADGES[showDetail.status] || STATUS_BADGES.open).cls}`}>{(STATUS_BADGES[showDetail.status] || STATUS_BADGES.open).label}</span>
                <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: (PRIORITY_COLORS[showDetail.priority] || '#f59e0b') + '22', color: PRIORITY_COLORS[showDetail.priority] || '#f59e0b', fontWeight: 600 }}>
                  {showDetail.priority?.toUpperCase()}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Subject</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{showDetail.subject}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Description</div>
                <div style={{ fontSize: 14, padding: '12px 14px', background: 'var(--bg-input)', borderRadius: 8, lineHeight: 1.7 }}>{showDetail.description}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>Submitted By</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>{showDetail.is_anonymous ? '🕵️ Anonymous' : showDetail.student_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>Room</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>{showDetail.room_no || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>Submitted</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>{new Date(showDetail.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>Last Updated</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>{showDetail.updated_at ? new Date(showDetail.updated_at).toLocaleString() : '—'}</div>
                </div>
              </div>
              {showDetail.admin_remarks && !isAdmin && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg-input)', fontSize: 13 }}>
                  <strong>Admin Response:</strong> {showDetail.admin_remarks}
                </div>
              )}
              {isAdmin && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>⚙️ Admin Actions</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Update Status</label>
                      <select className="form-input" value={adminAction.status} onChange={e => setAdminAction(a => ({ ...a, status: e.target.value }))}>
                        <option value="open">🔴 Open</option>
                        <option value="in_progress">🟡 In Progress</option>
                        <option value="resolved">🟢 Resolved</option>
                        <option value="dismissed">⚫ Dismissed</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Priority</label>
                      <select className="form-input" value={adminAction.priority} onChange={e => setAdminAction(a => ({ ...a, priority: e.target.value }))}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">🚨 Critical</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Remarks / Resolution Notes</label>
                    <textarea className="form-input" rows={3} value={adminAction.admin_remarks} onChange={e => setAdminAction(a => ({ ...a, admin_remarks: e.target.value }))} placeholder="Describe the action taken…" />
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleUpdate(showDetail.id)}>💾 Update Complaint</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
