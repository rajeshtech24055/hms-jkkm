import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';

export default function MyLeavePage() {
  const { api, user } = useAuth();
  const [activeTab, setActiveTab] = useState('leaves');
  const [leaves, setLeaves] = useState([]);
  const [vacateRequests, setVacateRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showVacateModal, setShowVacateModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(null);
  const [newLeave, setNewLeave] = useState({ reason: '', from_dt: '', to_dt: '', type: 'Day Leave', place: '', is_emergency: false });
  const [newVacate, setNewVacate] = useState({ reason: '', vacate_date: '', parent_phone: '' });
  const [student, setStudent] = useState(null);

  useEffect(() => {
    if (user?.role === 'STUDENT') {
      fetchMyLeaves();
      fetchMyVacateRequests();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchMyLeaves = async () => {
    setLoading(true);
    try {
      const stData = await api('/api/students');
      const student = stData.find(s => s.email === user.email);
      if (student) {
        setStudent(student);
        const leaveData = await api('/api/leaves');
        const myLeaves = leaveData.filter(l => l.student_id === student.id);
        setLeaves(myLeaves);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyVacateRequests = async () => {
    try {
      const data = await api('/api/vacate');
      setVacateRequests(data);
    } catch (err) { console.error(err); }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    if (!student) return alert('Student profile not loaded correctly.');
    try {
      await api('/api/leaves', { method: 'POST', body: JSON.stringify({ student_id: student.id, ...newLeave }) });
      setShowModal(false);
      fetchMyLeaves();
      setNewLeave({ reason: '', from_dt: '', to_dt: '', type: 'Day Leave', place: '', is_emergency: false });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCancelLeave = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this leave application?')) return;
    try {
      await api(`/api/leaves/${id}/cancel`, { method: 'POST' });
      fetchMyLeaves();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleVacateSubmit = async (e) => {
    e.preventDefault();
    if (!newVacate.reason || !newVacate.vacate_date) return alert('Please fill all required fields.');
    try {
      const result = await api('/api/vacate', { method: 'POST', body: JSON.stringify(newVacate) });
      alert(result.message || 'Vacate request submitted successfully!');
      setShowVacateModal(false);
      fetchMyVacateRequests();
      setNewVacate({ reason: '', vacate_date: '', parent_phone: '' });
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const VACATE_STATUS = {
    PENDING_WARDEN:       { label: 'Awaiting Warden Inspection', cls: 'badge-warning',  icon: '⏳', desc: 'Your request is waiting for the Warden to inspect your room.' },
    PENDING_FINE_PAYMENT: { label: 'Fine Payment Required',      cls: 'badge-danger',   icon: '💰', desc: 'Room damage was found. Please pay the assigned fine to the cashier.' },
    PENDING_PRINCIPAL:    { label: 'Awaiting Principal Approval', cls: 'badge-warning',  icon: '📋', desc: 'Warden has cleared your room. Awaiting Principal\'s final approval.' },
    APPROVED:             { label: 'Vacate Approved',             cls: 'badge-success',  icon: '✅', desc: 'Your hostel vacate has been approved by the Principal.' },
    REJECTED:             { label: 'Request Rejected',            cls: 'badge-danger',   icon: '❌', desc: 'Your vacate request was rejected.' },
  };

  if (user?.role !== 'STUDENT') {
    return (
      <div className="page-enter empty-state card">
        <div className="empty-icon">🛑</div>
        <p>This module is only accessible to Students.</p>
      </div>
    );
  }

  const hasActiveVacate = vacateRequests.some(r => ['PENDING_WARDEN','PENDING_FINE_PAYMENT','PENDING_PRINCIPAL'].includes(r.status));

  return (
    <div className="page-enter">
      <div className="section-header">
        <h2>📋 My Applications</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          {activeTab === 'leaves' && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>➕ Apply Leave</button>
          )}
          {activeTab === 'vacate' && !hasActiveVacate && (
            <button className="btn btn-danger" onClick={() => setShowVacateModal(true)}>🏠 Apply for Vacate</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: 'var(--bg-card)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'leaves', label: '✈️ Leave Applications' },
          { key: 'vacate', label: '🏠 Hostel Vacate' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, transition: 'all 0.2s',
              background: activeTab === tab.key ? 'var(--primary)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* LEAVE APPLICATIONS TAB */}
      {activeTab === 'leaves' && (
        <div className="card">
          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date Applied</th>
                    <th>Leave Duration</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map(l => (
                    <tr key={l.id}>
                      <td style={{ color: 'var(--text-dim)' }}>{new Date(l.created_at).toLocaleDateString('en-IN')}</td>
                      <td style={{ fontWeight: 600 }}>
                        {new Date(l.from_dt).toLocaleDateString('en-IN')} — {new Date(l.to_dt).toLocaleDateString('en-IN')}
                      </td>
                      <td>{l.reason}</td>
                      <td>
                        <span className={`badge ${l.status === 'approved' ? 'badge-success' : l.status === 'rejected' ? 'badge-danger' : l.status === 'cancelled' ? 'badge-secondary' : 'badge-warning'}`}>
                          {l.status.toUpperCase()}
                        </span>
                        {l.is_emergency ? <span className="badge badge-danger" style={{marginLeft: 5}}>🚨</span> : null}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {l.status === 'approved' && (
                            <button className="btn btn-sm btn-success" onClick={() => setShowPassModal(l)}>🎫 Pass</button>
                          )}
                          {(l.status === 'pending' || l.status === 'approved') && (
                            <button className="btn btn-sm btn-danger" onClick={() => handleCancelLeave(l.id)}>✕</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {leaves.length === 0 && (
                    <tr><td colSpan="4" className="empty-state"><div className="empty-icon">✈️</div><p>No leave applications yet.</p></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VACATE TAB */}
      {activeTab === 'vacate' && (
        <div>
          {hasActiveVacate && (
            <div style={{ marginBottom: 16, padding: '12px 18px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 10 }}>
              <strong>ℹ️</strong> You have an active vacate request in progress. You cannot submit another until it is resolved.
            </div>
          )}

          {vacateRequests.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 56 }}>🏠</div>
              <h3 style={{ marginTop: 16 }}>No Vacate Requests</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                If you wish to leave the hostel permanently, click "Apply for Vacate" above.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {vacateRequests.map(r => {
                const statusInfo = VACATE_STATUS[r.status] || {};
                return (
                  <div key={r.id} className="card" style={{ padding: '20px 24px', borderLeft: `4px solid ${r.status === 'APPROVED' ? '#10b981' : r.status === 'REJECTED' ? '#ef4444' : r.status === 'PENDING_FINE_PAYMENT' ? '#ef4444' : '#f59e0b'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>Vacate Request</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                          Applied: {new Date(r.created_at).toLocaleDateString('en-IN')} &nbsp;|&nbsp; Intended Date: {r.vacate_date}
                        </div>
                      </div>
                      <span className={`badge ${statusInfo.cls}`}>{statusInfo.icon} {statusInfo.label}</span>
                    </div>
                    <div style={{ background: 'var(--bg-input)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 10 }}>
                      📝 {r.reason}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 12px', background: 'rgba(99,102,241,0.07)', borderRadius: 8 }}>
                      ℹ️ {statusInfo.desc}
                    </div>
                    {r.has_damage === 1 && (
                      <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 13 }}>
                        <strong style={{ color: '#ef4444' }}>⚠️ Damage Fine: ₹{r.fine_amount}</strong>
                        <br />{r.damage_description}
                        <br /><span style={{ color: r.fine_paid ? '#10b981' : '#ef4444' }}>{r.fine_paid ? '✅ Fine Cleared' : '❌ Please pay at the cashier office'}</span>
                      </div>
                    )}
                    {r.warden_remarks && (
                      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                        🔍 Warden: {r.warden_remarks}
                      </div>
                    )}
                    {r.principal_remarks && (
                      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                        👨‍💼 Principal: {r.principal_remarks}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Apply Leave Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Apply for Leave</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleApply}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">From (Date & Time)</label>
                  <input type="datetime-local" className="form-input" required value={newLeave.from_dt} onChange={e => setNewLeave({...newLeave, from_dt: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">To (Date & Time)</label>
                  <input type="datetime-local" className="form-input" required value={newLeave.to_dt} onChange={e => setNewLeave({...newLeave, to_dt: e.target.value})} />
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-input" value={newLeave.type} onChange={e => setNewLeave({...newLeave, type: e.target.value})}>
                    <option>Day Leave</option>
                    <option>Overnight Leave</option>
                    <option>Multi-day Leave</option>
                    <option>Weekend/Home Leave</option>
                    <option>Medical Leave</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Destination / Place</label>
                  <input type="text" className="form-input" required placeholder="e.g. Chennai / Hospital" value={newLeave.place} onChange={e => setNewLeave({...newLeave, place: e.target.value})} />
                </div>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="emergency" checked={newLeave.is_emergency} onChange={e => setNewLeave({...newLeave, is_emergency: e.target.checked})} />
                <label htmlFor="emergency" className="form-label" style={{ marginBottom: 0 }}>This is an emergency</label>
              </div>
              <div className="form-group">
                <label className="form-label">Reason for Leave</label>
                <textarea className="form-input" rows="3" required placeholder="Specify your reason clearly..." value={newLeave.reason} onChange={e => setNewLeave({...newLeave, reason: e.target.value})}></textarea>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Submit Application</button>
            </form>
          </div>
        </div>
      )}

      {/* Apply Hostel Vacate Modal */}
      {showVacateModal && (
        <div className="modal-overlay" onClick={() => setShowVacateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🏠 Apply for Hostel Vacate</h3>
              <button className="modal-close" onClick={() => setShowVacateModal(false)}>×</button>
            </div>
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 13 }}>
              ⚠️ <strong>Warning:</strong> This is a formal request to permanently leave the hostel. The Warden will inspect your room for damages, and the Principal must approve before your hostel access is terminated.
            </div>
            <form onSubmit={handleVacateSubmit}>
              <div className="form-group">
                <label className="form-label">Reason for Vacating *</label>
                <textarea className="form-input" rows="3" required placeholder="e.g., Course completed, family reason, shifted to home..." value={newVacate.reason} onChange={e => setNewVacate({...newVacate, reason: e.target.value})}></textarea>
              </div>
              <div className="form-group">
                <label className="form-label">Intended Vacate Date *</label>
                <input type="date" className="form-input" required min={new Date().toISOString().split('T')[0]} value={newVacate.vacate_date} onChange={e => setNewVacate({...newVacate, vacate_date: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Parent/Guardian Phone (for confirmation)</label>
                <input type="tel" className="form-input" placeholder="e.g., 9876543210" value={newVacate.parent_phone} onChange={e => setNewVacate({...newVacate, parent_phone: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-danger" style={{ flex: 1 }}>🏠 Submit Vacate Request</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowVacateModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Digital Pass Modal */}
      {showPassModal && student && (
        <div className="modal-overlay" onClick={() => setShowPassModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center' }}>
            <div className="modal-header">
              <h3 className="modal-title">🎫 Digital Leave Pass</h3>
              <button className="modal-close" onClick={() => setShowPassModal(null)}>×</button>
            </div>
            
            <div style={{ background: '#fff', border: '2px solid var(--primary)', borderRadius: 16, padding: 24, marginTop: 10, boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: 22 }}>{student.name}</h4>
                <div style={{ color: '#666', fontSize: 14 }}>{student.reg_no}</div>
              </div>
              
              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 8, marginBottom: 20, textAlign: 'left', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Type:</span> <strong>{showPassModal.type}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Destination:</span> <strong>{showPassModal.place}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Out:</span> <strong>{new Date(showPassModal.from_dt).toLocaleString('en-IN')}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>In:</span> <strong>{new Date(showPassModal.to_dt).toLocaleString('en-IN')}</strong>
                </div>
              </div>

              <div style={{ background: '#fff', padding: 10, display: 'inline-block', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <QRCodeSVG value={JSON.stringify({ reg: student.reg_no, token: student.qr_token || '' })} size={200} level="H" />
              </div>
              
              <div style={{ marginTop: 12, fontSize: 12, color: '#10b981', fontWeight: 'bold' }}>
                ✅ APPROVED PASS
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
