import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LeavesPage() {
  const { api, user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDecision, setBulkDecision] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterInst, setFilterInst] = useState('');
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [remark, setRemark] = useState('');

  const fetchLeaves = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.append('status', filterStatus);
    if (user.role === 'HOSTEL_ADMIN' || user.role === 'PRINCIPAL') {
      params.append('institution_id', user.institution_id);
    }
    // Simple filter simulation
    api(`/api/leaves?${params}`)
      .then(data => {
        // Filter based on role scope and level in a real app, here we do simple client filtering for demo
        let filtered = data;
        if (user.role === 'WARDEN') {
           filtered = filtered.filter(l => l.status === 'pending' && l.current_level === 1);
        } else if (user.role === 'TUTOR') {
           filtered = filtered.filter(l => l.status === 'pending' && l.current_level === 2);
        } else if (user.role === 'HOD') {
           filtered = filtered.filter(l => l.status === 'pending' && l.current_level === 3);
        } else if (user.role === 'PRINCIPAL') {
           filtered = filtered.filter(l => l.status === 'pending' && l.current_level === 4);
        }
        if (filterType) filtered = filtered.filter(l => l.type === filterType);
        if (filterInst) filtered = filtered.filter(l => l.institution_code === filterInst);
        
        // Show all if not pending filter
        if (filterStatus !== 'pending') {
            filtered = data.filter(l => l.status === filterStatus);
        }

        setLeaves(filtered);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeaves();
  }, [api, filterStatus, filterType, filterInst, user]);

  const handleApprove = async (id, decision, reason = '') => {
    try {
      await api(`/api/leaves/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decision, reason })
      });
      fetchLeaves();
      setSelectedIds(new Set());
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleBulkAction = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0) return;
    try {
      await api('/api/leaves/bulk-approve', {
        method: 'POST',
        body: JSON.stringify({ ids: Array.from(selectedIds), decision: bulkDecision, reason: bulkReason })
      });
      fetchLeaves();
      setShowBulkModal(false);
      setSelectedIds(new Set());
      setBulkReason('');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const toggleSelect = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === leaves.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leaves.map(l => l.id)));
    }
  };

  const canApprove = ['WARDEN', 'TUTOR', 'HOD', 'PRINCIPAL', 'HOSTEL_ADMIN'].includes(user?.role) && filterStatus === 'pending';

  return (
    <div className="page-enter">
      <div className="section-header">
        <h2>📋 Leave Approvals</h2>
        {canApprove && (
          <div className="leave-action-btns">
            <button className="btn btn-ghost leave-action-btn" onClick={selectAll}>
              {selectedIds.size === leaves.length && leaves.length > 0 ? '✖ Deselect All' : '☑️ Select All'}
            </button>
            <button 
              className="btn btn-primary leave-action-btn" 
              disabled={selectedIds.size === 0}
              onClick={() => { setBulkDecision('approve'); setShowBulkModal(true); }}
            >
              ✅ Accept ({selectedIds.size})
            </button>
            <button 
              className="btn btn-danger leave-action-btn" 
              disabled={selectedIds.size === 0}
              onClick={() => { setBulkDecision('reject'); setShowBulkModal(true); }}
            >
              ❌ Reject ({selectedIds.size})
            </button>
          </div>
        )}
      </div>

      <div className="filter-row">
        <select className="form-input" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="pending">Pending for Me</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
            <option value="used">Currently Out (Used)</option>
            <option value="completed">Completed</option>
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          <option value="Day Leave">Day Leave</option>
          <option value="Overnight Leave">Overnight Leave</option>
          <option value="Multi-day Leave">Multi-day Leave</option>
          <option value="Weekend/Home Leave">Weekend/Home Leave</option>
          <option value="Medical Leave">Medical Leave</option>
        </select>
        {user?.role === 'SUPER_ADMIN' && (
          <select className="form-input" style={{ width: 'auto' }} value={filterInst} onChange={e => setFilterInst(e.target.value)}>
             <option value="">All Institutions</option>
             <option value="ENG">ENG</option>
             <option value="AGRI">AGRI</option>
             <option value="PHARM">PHARM</option>
          </select>
        )}
      </div>

      <div className="card no-padding" style={{ marginTop: 12 }}>
        <div className="table-wrap">
          {loading ? (
             <div className="loading"><div className="spinner" /></div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  {canApprove && <th style={{ width: 40 }}></th>}
                  <th>Student</th>
                  <th>Dates</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Status</th>
                  {canApprove && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {leaves.map(l => (
                  <tr key={l.id} onClick={() => setSelectedLeave(l)} style={{ cursor: 'pointer' }}>
                    {canApprove && (
                      <td>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(l.id)} 
                          onChange={(e) => { e.stopPropagation(); toggleSelect(l.id); }}
                          onClick={e => e.stopPropagation()}
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                        />
                      </td>
                    )}
                    <td>
                      <div style={{ fontWeight: 600 }}>{l.student_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{l.institution_code} • {l.dept_name} • {l.year}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>{new Date(l.from_dt).toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>to {new Date(l.to_dt).toLocaleString('en-IN')}</div>
                    </td>
                    <td>
                       {l.type}
                       {l.is_emergency && <span className="badge badge-danger" style={{marginLeft: 6}}>🚨 EMERGENCY</span>}
                    </td>
                    <td>
                       <div style={{ fontSize: 13, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.reason}</div>
                       <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Place: {l.place}</div>
                    </td>
                    <td>
                      {l.status === 'pending' && <span className="badge badge-warning">L{l.current_level} Pending</span>}
                      {l.status === 'approved' && <span className="badge badge-success">Approved</span>}
                      {l.status === 'rejected' && <span className="badge badge-danger">Rejected</span>}
                      {l.status === 'cancelled' && <span className="badge badge-secondary">Cancelled</span>}
                      {l.status === 'used' && <span className="badge badge-info" style={{background: '#3b82f6', color: 'white'}}>OUT (Used)</span>}
                      {l.status === 'completed' && <span className="badge badge-secondary" style={{background: '#6b7280', color: 'white'}}>Completed</span>}
                    </td>
                    {canApprove && (
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm btn-info" onClick={(e) => { e.stopPropagation(); setSelectedLeave(l); }}>Review</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {leaves.length === 0 && (
                  <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">📋</div><p>No leaves found</p></div></td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Bulk {bulkDecision === 'approve' ? 'Accept' : 'Reject'} ({selectedIds.size} applications)</span>
              <button className="modal-close" onClick={() => setShowBulkModal(false)}>×</button>
            </div>
            <form onSubmit={handleBulkAction}>
              {bulkDecision === 'reject' ? (
                <div className="form-group">
                  <label className="form-label">Reason for Rejection *</label>
                  <textarea 
                    className="form-input" 
                    required 
                    value={bulkReason} 
                    onChange={e => setBulkReason(e.target.value)} 
                    rows={3} 
                    placeholder="Enter reason for rejecting these leaves..."
                  />
                </div>
              ) : (
                <>
                 <p style={{ marginBottom: 10, color: 'var(--text-muted)' }}>Are you sure you want to approve all {selectedIds.size} selected applications? They will be forwarded to the next level.</p>
                 <div className="form-group">
                  <label className="form-label">Remarks (Optional)</label>
                  <input type="text" className="form-input" value={bulkReason} onChange={e => setBulkReason(e.target.value)} placeholder="e.g. Approved conditionally..." />
                 </div>
                </>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className={`btn ${bulkDecision === 'approve' ? 'btn-success' : 'btn-danger'}`} style={{ flex: 1 }}>
                  Confirm {bulkDecision === 'approve' ? 'Accept' : 'Reject'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowBulkModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedLeave && (
        <div className="modal-overlay" onClick={() => { setSelectedLeave(null); setRemark(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                Leave Details 
                {selectedLeave.is_emergency && <span className="badge badge-danger" style={{marginLeft: 10}}>🚨 EMERGENCY</span>}
              </span>
              <button className="modal-close" onClick={() => { setSelectedLeave(null); setRemark(''); }}>×</button>
            </div>
            <div className="form-grid" style={{ marginBottom: 20 }}>
              <div><strong>Student:</strong> {selectedLeave.student_name}</div>
              <div><strong>Type:</strong> {selectedLeave.type}</div>
              <div><strong>From:</strong> {new Date(selectedLeave.from_dt).toLocaleString('en-IN')}</div>
              <div><strong>To:</strong> {new Date(selectedLeave.to_dt).toLocaleString('en-IN')}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Reason:</strong> {selectedLeave.reason}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Place:</strong> {selectedLeave.place}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Status:</strong> {selectedLeave.status.toUpperCase()} (Level {selectedLeave.current_level})</div>
            </div>
            {canApprove && selectedLeave.status === 'pending' && (
              <>
                <div className="form-group">
                  <label className="form-label">Approver Remarks</label>
                  <input type="text" className="form-input" value={remark} onChange={e => setRemark(e.target.value)} placeholder="Optional for approval, required for rejection" />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-success" style={{ flex: 1 }} onClick={() => { handleApprove(selectedLeave.id, 'approve', remark); setSelectedLeave(null); setRemark(''); }}>✅ Approve</button>
                  <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { 
                    if(!remark) { alert('Please provide a reason for rejection.'); return; }
                    handleApprove(selectedLeave.id, 'reject', remark); setSelectedLeave(null); setRemark(''); 
                  }}>❌ Reject</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
