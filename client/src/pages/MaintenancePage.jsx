import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function MaintenancePage() {
  const { api } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newReq, setNewReq] = useState({ category: 'Electrical', room_no: '', description: '', priority: 'Normal' });

  // Verification Scanner State
  const [scanReq, setScanReq] = useState(null);
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);

  const [staff, setStaff] = useState([]);

  useEffect(() => {
    fetchRequests();
    api('/api/users/staff').then(setStaff).catch(console.error);
  }, []);

  const handleAssign = async (id, staffId) => {
    try {
      await api(`/api/maintenance/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ assigned_to: staffId ? parseInt(staffId) : null })
      });
      fetchRequests();
    } catch (err) {
      alert(err.message);
    }
  };

  const getSLA = (createdAt, resolvedAt) => {
    if (!resolvedAt) {
      const hours = Math.floor((new Date() - new Date(createdAt)) / 3600000);
      if (hours > 48) return <span style={{ color: 'var(--danger)', fontWeight: 600 }}>SLA Breached ({hours}h)</span>;
      return <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{hours}h open</span>;
    }
    const hours = Math.floor((new Date(resolvedAt) - new Date(createdAt)) / 3600000);
    return <span style={{ color: 'var(--success)' }}>Resolved in {hours}h</span>;
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await api('/api/maintenance');
      setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api('/api/maintenance', { method: 'POST', body: JSON.stringify(newReq) });
      setShowModal(false);
      fetchRequests();
      setNewReq({ category: 'Electrical', room_no: '', description: '', priority: 'Normal' });
    } catch (err) {
      alert(err.message);
    }
  };

  const [activeTab, setActiveTab] = useState('ALL');

  const handleResolve = async (id) => {
    try {
      await api(`/api/maintenance/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed', remarks: 'Resolved manually by maintenance staff' })
      });
      fetchRequests();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleScanVerify = async (e) => {
    e.preventDefault();
    if (!scanInput.trim() || !scanReq) return;
    setScanning(true);
    try {
      const data = await api(`/api/maintenance/${scanReq.id}/verify-scan`, {
        method: 'POST',
        body: JSON.stringify({ code: scanInput.trim() })
      });
      if (data.success) {
        alert(data.message);
        setScanReq(null);
        setScanInput('');
        fetchRequests();
      }
    } catch (err) {
      alert(err.message || 'Verification failed. Student not found.');
    } finally {
      setScanning(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    if (activeTab === 'OPEN') return req.status !== 'completed' && req.status !== 'Resolved';
    if (activeTab === 'RESOLVED') return req.status === 'completed' || req.status === 'Resolved';
    return true;
  });
  return (
    <div className="page-enter">
      <div className="section-header">
        <div>
          <h2>🔧 Maintenance Requests & SLA</h2>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className={`btn btn-sm ${activeTab === 'ALL' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('ALL')}>
              All ({requests.length})
            </button>
            <button className={`btn btn-sm ${activeTab === 'OPEN' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('OPEN')}>
              Open ({requests.filter(r => r.status !== 'completed' && r.status !== 'Resolved').length})
            </button>
            <button className={`btn btn-sm ${activeTab === 'RESOLVED' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('RESOLVED')}>
              Resolved ({requests.filter(r => r.status === 'completed' || r.status === 'Resolved').length})
            </button>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          ➕ New Request
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Category</th>
                  <th>Room/Area</th>
                  <th>Issue Details</th>
                  <th>SLA / Status</th>
                  <th>Assigned To</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(req => {
                  const isDone = req.status === 'completed' || req.status === 'Resolved';
                  return (
                    <tr key={req.id}>
                      <td style={{ color: 'var(--text-dim)' }}>#{req.id}</td>
                      <td style={{ fontWeight: 600 }}>{req.category}</td>
                      <td>{req.room_no || 'General'}</td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{req.description}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>By {req.raised_by_name || 'Admin'}</div>
                        {req.verified_by_student_id && (
                          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--success)' }}>
                            ✅ Verified by {req.verified_by_name}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span className={`badge ${isDone ? 'badge-success' : req.status === 'In Progress' ? 'badge-warning' : 'badge-danger'}`}>
                            {req.status}
                          </span>
                          <span style={{ fontSize: 11 }}>{getSLA(req.created_at, req.resolved_at)}</span>
                        </div>
                      </td>
                      <td>
                        <select 
                          value={req.assigned_to || ''} 
                          onChange={(e) => handleAssign(req.id, e.target.value)}
                          disabled={isDone}
                          style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-input)' }}
                        >
                          <option value="">Unassigned</option>
                          {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                        </select>
                      </td>
                      <td>
                        {!isDone ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <button className="btn btn-sm btn-outline" style={{ color: 'var(--primary)', borderColor: 'var(--primary)', padding: '2px 8px', fontSize: 12 }} onClick={() => setScanReq(req)}>
                              📷 Scan Verify
                            </button>
                            <button className="btn btn-sm btn-ghost" style={{ color: 'var(--success)', padding: '2px 8px', fontSize: 12 }} onClick={() => handleResolve(req.id)}>
                              ✓ Mark Done
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Done</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredRequests.length === 0 && (
                  <tr>
                    <td colSpan="7" className="empty-state">
                      <div className="empty-icon">🛠️</div>
                      <p>No maintenance requests found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Request Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Report Issue</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={newReq.category} onChange={e => setNewReq({...newReq, category: e.target.value})}>
                  <option>Electrical</option>
                  <option>Plumbing</option>
                  <option>Carpentry</option>
                  <option>Cleaning</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-input" value={newReq.priority} onChange={e => setNewReq({...newReq, priority: e.target.value})}>
                  <option>Normal</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Room / Area (Optional)</label>
                <input type="text" className="form-input" placeholder="e.g., Room 101, Corridor" value={newReq.room_no} onChange={e => setNewReq({...newReq, room_no: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" rows="4" required placeholder="Describe the issue..." value={newReq.description} onChange={e => setNewReq({...newReq, description: e.target.value})}></textarea>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Submit Request</button>
            </form>
          </div>
        </div>
      )}

      {/* Verification Scanner Modal */}
      {scanReq && (
        <div className="modal-overlay" onClick={() => { setScanReq(null); setScanInput(''); }}>
          <div className="modal" style={{ maxWidth: 400, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ justifyContent: 'center' }}>
              <h3 className="modal-title">📷 Verify Repair</h3>
            </div>
            <div style={{ padding: '20px 0' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                Scan the student's <strong>Digital ID Card</strong> to confirm that the repair for <strong>{scanReq.category} ({scanReq.room_no || 'General'})</strong> was successfully completed in their presence.
              </p>
              <form onSubmit={handleScanVerify}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Scan QR or type Reg No..." 
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  autoFocus
                  style={{ textAlign: 'center', fontSize: 18, marginBottom: 12 }}
                />
                <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: 16 }} disabled={scanning || !scanInput.trim()}>
                  {scanning ? 'Verifying...' : 'Verify & Complete'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
