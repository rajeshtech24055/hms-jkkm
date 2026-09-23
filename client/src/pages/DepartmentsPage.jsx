import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function DepartmentsPage() {
  const { api } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterInst, setFilterInst] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // {id, name} for rename
  const [form, setForm] = useState({ name: '', institution_id: '' });

  useEffect(() => {
    Promise.all([
      api('/api/departments'),
      api('/api/institutions'),
    ]).then(([depts, insts]) => {
      setDepartments(depts);
      setInstitutions(insts);
      if (insts.length > 0 && !form.institution_id) {
        setForm(f => ({ ...f, institution_id: insts[0].id }));
      }
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fetchDepartments = async () => {
    const data = await api('/api/departments');
    setDepartments(data);
  };

  const openAdd = () => {
    setEditTarget(null);
    setForm({ name: '', institution_id: institutions[0]?.id || '' });
    setShowModal(true);
  };

  const openEdit = (dept) => {
    setEditTarget(dept);
    setForm({ name: dept.name, institution_id: dept.institution_id });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let result;
      if (editTarget) {
        result = await api(`/api/departments/${editTarget.id}`, {
          method: 'PUT', body: JSON.stringify({ name: form.name })
        });
      } else {
        result = await api('/api/departments', {
          method: 'POST', body: JSON.stringify({ name: form.name, institution_id: parseInt(form.institution_id) })
        });
      }
      alert(result.message);
      setShowModal(false);
      fetchDepartments();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDelete = async (dept) => {
    if (!window.confirm(`Delete department "${dept.name}"?\n\nThis cannot be undone. Students assigned to this department must be reassigned first.`)) return;
    try {
      const result = await api(`/api/departments/${dept.id}`, { method: 'DELETE' });
      alert(result.message);
      fetchDepartments();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const filtered = filterInst ? departments.filter(d => d.institution_id == filterInst) : departments;

  // Group by institution
  const grouped = filtered.reduce((acc, d) => {
    const key = d.institution_name || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  return (
    <div className="page-enter">
      <div className="section-header">
        <div>
          <h2>🏛️ Department Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Add, rename or remove departments across institutions
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>➕ Add Department</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: '14px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>{departments.length}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>Total Departments</div>
        </div>
        {institutions.map(inst => (
          <div key={inst.id} className="card" style={{ padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>
              {departments.filter(d => d.institution_id === inst.id).length}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>{inst.code}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <select className="form-input" style={{ width: 'auto', minWidth: 220 }} value={filterInst} onChange={e => setFilterInst(e.target.value)}>
          <option value="">All Institutions</option>
          {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <button className="btn btn-ghost" onClick={fetchDepartments}>🔄 Refresh</button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {Object.entries(grouped).map(([instName, depts]) => (
            <div key={instName}>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                🏫 {instName}
                <span style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>({depts.length} dept{depts.length !== 1 ? 's' : ''})</span>
              </div>
              <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Department Name</th>
                      <th>Active Students</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {depts.map((dept, idx) => (
                      <tr key={dept.id}>
                        <td style={{ color: 'var(--text-muted)', width: 40 }}>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>
                          <span style={{ marginRight: 8 }}>🏛️</span>{dept.name}
                        </td>
                        <td>
                          <span style={{
                            padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                            background: dept.student_count > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(156,163,175,0.15)',
                            color: dept.student_count > 0 ? '#10b981' : 'var(--text-muted)'
                          }}>
                            👤 {dept.student_count} student{dept.student_count !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => openEdit(dept)}>
                              ✏️ Rename
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ padding: '5px 12px', fontSize: 12, opacity: dept.student_count > 0 ? 0.5 : 1 }}
                              onClick={() => handleDelete(dept)}
                              title={dept.student_count > 0 ? 'Cannot delete: has active students' : 'Delete department'}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 48 }}>🏛️</div>
              <h3 style={{ marginTop: 12 }}>No Departments Found</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Add a department to get started.</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>➕ Add First Department</button>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editTarget ? '✏️ Rename Department' : '➕ Add New Department'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              {!editTarget && (
                <div className="form-group">
                  <label className="form-label">Institution *</label>
                  <select className="form-input" required value={form.institution_id} onChange={e => setForm(f => ({ ...f, institution_id: e.target.value }))}>
                    {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
              )}
              {editTarget && (
                <div style={{ marginBottom: 14, padding: '8px 14px', background: 'var(--bg-input)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                  🏫 {editTarget.institution_name}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Department Name *</label>
                <input
                  className="form-input"
                  required
                  autoFocus
                  placeholder="e.g., Civil Engineering, Biotechnology..."
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {editTarget ? '✅ Save Changes' : '➕ Add Department'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
