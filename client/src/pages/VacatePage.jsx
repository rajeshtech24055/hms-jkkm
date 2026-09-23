import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const STATUS_INFO = {
  PENDING_WARDEN:       { label: 'Awaiting Warden',    cls: 'badge-warning',  icon: '⏳' },
  PENDING_FINE_PAYMENT: { label: 'Fine Pending',        cls: 'badge-danger',   icon: '💰' },
  PENDING_PRINCIPAL:    { label: 'Awaiting Principal',  cls: 'badge-warning',  icon: '📋' },
  APPROVED:             { label: 'Approved & Vacated',  cls: 'badge-success',  icon: '✅' },
  REJECTED:             { label: 'Rejected',            cls: 'badge-danger',   icon: '❌' },
};

export default function VacatePage() {
  const { api, user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [wardenForm, setWardenForm] = useState({ has_damage: false, damage_description: '', fine_amount: '', warden_remarks: '' });
  const [principalRemarks, setPrincipalRemarks] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const isWarden  = ['WARDEN', 'SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(user?.role);
  const isPrincipal = ['PRINCIPAL', 'SUPER_ADMIN'].includes(user?.role);

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await api('/api/vacate');
      setRequests(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleWardenAction = async (id, hasDamage) => {
    try {
      const payload = {
        has_damage: hasDamage,
        damage_description: wardenForm.damage_description,
        fine_amount: hasDamage ? parseFloat(wardenForm.fine_amount) || 0 : 0,
        warden_remarks: wardenForm.warden_remarks,
      };
      const result = await api(`/api/vacate/${id}/warden`, { method: 'PUT', body: JSON.stringify(payload) });
      alert(result.message);
      setSelected(null);
      setWardenForm({ has_damage: false, damage_description: '', fine_amount: '', warden_remarks: '' });
      fetchRequests();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handlePayFine = async (id) => {
    if (!window.confirm('Confirm that the student has paid the damage fine and clear the payment?')) return;
    try {
      const result = await api(`/api/vacate/${id}/pay-fine`, { method: 'PUT', body: JSON.stringify({}) });
      alert(result.message);
      setSelected(null);
      fetchRequests();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handlePrincipalDecision = async (id, decision) => {
    const verb = decision === 'APPROVE' ? 'approve and permanently vacate' : 'reject';
    if (!window.confirm(`Are you sure you want to ${verb} this request?\n\n${decision === 'APPROVE' ? '⚠️ This will revoke the student\'s hostel access immediately.' : ''}`)) return;
    try {
      const result = await api(`/api/vacate/${id}/principal`, {
        method: 'PUT',
        body: JSON.stringify({ decision, principal_remarks: principalRemarks })
      });
      alert(result.message);
      setSelected(null);
      setPrincipalRemarks('');
      fetchRequests();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const filtered = filterStatus ? requests.filter(r => r.status === filterStatus) : requests;

  return (
    <div className="page-enter">
      <div className="section-header">
        <div>
          <h2>🏠 Hostel Vacate Requests</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Review student vacate applications, inspect for damages, and process final approval
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: requests.length, color: 'var(--text)' },
          { label: 'Warden Pending', value: requests.filter(r => r.status === 'PENDING_WARDEN').length, color: '#f59e0b' },
          { label: 'Fine Pending', value: requests.filter(r => r.status === 'PENDING_FINE_PAYMENT').length, color: '#ef4444' },
          { label: 'Principal Review', value: requests.filter(r => r.status === 'PENDING_PRINCIPAL').length, color: '#8b5cf6' },
          { label: 'Approved', value: requests.filter(r => r.status === 'APPROVED').length, color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <select className="form-input" style={{ width: 'auto', minWidth: 200 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_INFO).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        <button className="btn btn-ghost" onClick={fetchRequests}>🔄 Refresh</button>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>🏠</div>
          <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>No vacate requests found</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map(r => {
            const statusInfo = STATUS_INFO[r.status] || STATUS_INFO.PENDING_WARDEN;
            return (
              <div key={r.id} className="card" onClick={() => { setSelected(r); setWardenForm({ has_damage: false, damage_description: '', fine_amount: '', warden_remarks: '' }); setPrincipalRemarks(''); }}
                style={{ padding: '18px 22px', cursor: 'pointer', borderLeft: `4px solid ${r.status === 'APPROVED' ? '#10b981' : r.status === 'REJECTED' ? '#ef4444' : r.status === 'PENDING_FINE_PAYMENT' ? '#ef4444' : '#f59e0b'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{r.student_name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
                      {r.reg_no} · {r.dept_name} · {r.block}-{r.room_no}
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 6 }}>
                      📅 Vacate by: <strong>{r.vacate_date}</strong> &nbsp;|&nbsp; Applied: {new Date(r.created_at).toLocaleDateString('en-IN')}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text)' }}>
                      📝 {r.reason}
                    </div>
                    {r.has_damage === 1 && (
                      <div style={{ marginTop: 6, padding: '4px 10px', background: 'rgba(239,68,68,0.1)', borderRadius: 6, fontSize: 12, color: '#ef4444', display: 'inline-block' }}>
                        ⚠️ Damage Fine: ₹{r.fine_amount} — {r.fine_paid ? '✅ Paid' : '❌ Unpaid'}
                      </div>
                    )}
                  </div>
                  <span className={`badge ${statusInfo.cls}`}>{statusInfo.icon} {statusInfo.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail & Action Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">🏠 Vacate Request — {selected.student_name}</span>
              <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            </div>

            {/* Student Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Register No', value: selected.reg_no },
                { label: 'Department', value: selected.dept_name },
                { label: 'Room', value: `${selected.block}-${selected.room_no}` },
                { label: 'Vacate Date', value: selected.vacate_date },
                { label: 'Parent Phone', value: selected.parent_phone || 'N/A' },
                { label: 'Status', value: STATUS_INFO[selected.status]?.label },
              ].map(d => (
                <div key={d.label} style={{ background: 'var(--bg-input)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>{d.label}</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{d.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Reason for Vacating</div>
              <div style={{ background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 8, fontSize: 14 }}>{selected.reason}</div>
            </div>

            {selected.has_damage === 1 && (
              <div style={{ marginBottom: 14, padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10 }}>
                <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: 6 }}>⚠️ Damage Report</div>
                <div style={{ fontSize: 13 }}>{selected.damage_description}</div>
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  Fine Amount: <strong>₹{selected.fine_amount}</strong> &nbsp;|&nbsp; 
                  Status: <strong>{selected.fine_paid ? '✅ Cleared' : '❌ Pending'}</strong>
                </div>
              </div>
            )}

            {selected.warden_remarks && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Warden Remarks</div>
                <div style={{ background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>{selected.warden_remarks}</div>
              </div>
            )}

            {/* Warden Actions */}
            {isWarden && selected.status === 'PENDING_WARDEN' && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
                <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--primary)' }}>🔍 Room Inspection Result</div>
                <div className="form-group">
                  <label className="form-label">Warden Remarks</label>
                  <textarea className="form-input" rows={2} placeholder="Add inspection notes..." value={wardenForm.warden_remarks} onChange={e => setWardenForm(f => ({ ...f, warden_remarks: e.target.value }))} />
                </div>
                <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 10, color: '#ef4444' }}>⚠️ Damage Found?</div>
                  <div className="form-group">
                    <label className="form-label">Damage Description</label>
                    <input className="form-input" placeholder="e.g., Broken window pane, wall paint damage..." value={wardenForm.damage_description} onChange={e => setWardenForm(f => ({ ...f, damage_description: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fine Amount (₹)</label>
                    <input className="form-input" type="number" min="0" placeholder="0" value={wardenForm.fine_amount} onChange={e => setWardenForm(f => ({ ...f, fine_amount: e.target.value }))} />
                  </div>
                  <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => handleWardenAction(selected.id, true)} disabled={!wardenForm.damage_description || !wardenForm.fine_amount}>
                    ⚠️ Assign Damage Fine
                  </button>
                </div>
                <button className="btn btn-success" style={{ width: '100%' }} onClick={() => handleWardenAction(selected.id, false)}>
                  ✅ No Damage — Forward to Principal
                </button>
              </div>
            )}

            {/* Pay Fine (Warden/Cashier marks fine paid) */}
            {isWarden && selected.status === 'PENDING_FINE_PAYMENT' && !selected.fine_paid && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: '#ef4444' }}>💰 Fine Clearance</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
                  Once the student pays ₹{selected.fine_amount} to the cashier, mark it as cleared below.
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handlePayFine(selected.id)}>
                  ✅ Mark Fine as Paid & Forward to Principal
                </button>
              </div>
            )}

            {/* Principal Actions */}
            {isPrincipal && selected.status === 'PENDING_PRINCIPAL' && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
                <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--primary)' }}>👨‍💼 Principal Decision</div>
                <div className="form-group">
                  <label className="form-label">Remarks (Optional)</label>
                  <textarea className="form-input" rows={2} placeholder="Add your remarks..." value={principalRemarks} onChange={e => setPrincipalRemarks(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-success" style={{ flex: 1 }} onClick={() => handlePrincipalDecision(selected.id, 'APPROVE')}>
                    ✅ Approve Vacate
                  </button>
                  <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handlePrincipalDecision(selected.id, 'REJECT')}>
                    ❌ Reject Request
                  </button>
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: '#ef4444', textAlign: 'center' }}>
                  ⚠️ Approval will immediately revoke student access and free the room.
                </div>
              </div>
            )}

            {selected.principal_remarks && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Principal Decision</div>
                <div style={{ background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>{selected.principal_remarks}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
