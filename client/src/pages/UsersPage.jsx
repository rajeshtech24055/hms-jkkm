import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function UsersPage() {
  const { api, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const [institutions, setInstitutions] = useState([]);
  const [departments, setDepartments] = useState([]);
  
  const defaultForm = { name: '', email: '', role: '', phone: '', gender: '', institution_id: '', dept_id: '', year: '' };
  const [form, setForm] = useState(defaultForm);

  const ROLES = ['SUPER_ADMIN', 'HOSTEL_ADMIN', 'WARDEN', 'TUTOR', 'HOD', 'PRINCIPAL', 'FOOD_ADMIN', 'MESS_WORKER', 'INVENTORY_ADMIN', 'MAINTENANCE', 'GATE_STAFF'];

  useEffect(() => {
    fetchUsers();
    fetchConfig();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api('/api/users');
      // Students are managed on the Students page — exclude them from Staff & Users
      setUsers(data.filter(u => u.role !== 'STUDENT'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchConfig = async () => {
    try {
      const [inst, dept] = await Promise.all([
        api('/api/institutions'),
        api('/api/departments')
      ]);
      setInstitutions(inst);
      setDepartments(dept);
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.role) return alert('Name, Email, and Role are required.');
    if (form.role === 'TUTOR' && (!form.dept_id || !form.year)) {
      return alert('Department and Year are strictly required for Class Tutors.');
    }
    if (form.role === 'HOD' && !form.dept_id) {
      return alert('Department is strictly required for HODs.');
    }

    try {
      const url = editId ? `/api/users/${editId}` : '/api/users';
      const method = editId ? 'PUT' : 'POST';
      const payload = {
        ...form,
        institution_id: form.institution_id ? parseInt(form.institution_id) : null,
        dept_id: form.dept_id ? parseInt(form.dept_id) : null,
        phone: form.phone || null,
        year: form.year || null,
        gender: form.gender || null
      };
      const res = await api(url, {
        method,
        body: JSON.stringify(payload)
      });
      alert(res.message);
      setShowForm(false);
      setEditId(null);
      setForm(defaultForm);
      fetchUsers();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const openEdit = (user) => {
    setForm({
      name: user.name || '',
      email: user.email || '',
      role: user.role || '',
      phone: user.phone || '',
      gender: user.gender || '',
      institution_id: user.institution_id || '',
      dept_id: user.dept_id || '',
      year: user.year || ''
    });
    setEditId(user.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to deactivate ${name}?`)) return;
    try {
      await api(`/api/users/${id}`, { method: 'DELETE' });
      alert('User deactivated successfully.');
      fetchUsers();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  if (user?.role !== 'SUPER_ADMIN') {
    return <div className="page-enter"><h3>Access Denied. Super Admin only.</h3></div>;
  }

  return (
    <div className="page-enter">
      <div className="section-header">
        <div>
          <h2>👥 Staff & User Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Create and assign staff roles, tutors, and wardens.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(defaultForm); setEditId(null); setShowForm(true); }}>+ Add New Staff</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', fontSize: 16 }}>{editId ? '✏️ Edit User' : 'Create New User'}</h3>
          <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="grid">
              <div className="form-group">
                <label>Full Name *</label>
                <input className="input" type="text" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Email Address *</label>
                <input className="input" type="email" pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$" title="Valid email address (e.g., name@example.com)" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} required />
              </div>
            </div>

            <div className="grid">
              <div className="form-group">
                <label>Role *</label>
                <select className="input" value={form.role} onChange={e=>setForm({...form, role: e.target.value})} required>
                  <option value="">Select Role...</option>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Phone Number *</label>
                <input className="input" type="text" required pattern="[0-9]{10}" title="10 digit mobile number" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} />
              </div>
            </div>


            {(form.role === 'WARDEN' || form.role === 'TUTOR') && (
              <div className="grid">
                {form.role === 'WARDEN' && (
                  <div className="form-group">
                    <label>Gender / Hostel Type *</label>
                    <select className="input" value={form.gender} onChange={e=>setForm({...form, gender: e.target.value})} required>
                      <option value="">Select Gender / Hostel</option>
                      <option value="Male">Male (Boys Hostel)</option>
                      <option value="Female">Female (Girls Hostel)</option>
                    </select>
                    <small style={{color:'var(--danger)', marginTop: 4, display: 'block'}}>Required for Wardens for data isolation.</small>
                  </div>
                )}

                {form.role === 'TUTOR' && (
                  <div className="form-group">
                    <label>Year Assignment (Class Tutor) *</label>
                    <select className="input" value={form.year} onChange={e=>setForm({...form, year: e.target.value})} required>
                      <option value="">Select Year...</option>
                      <option value="1st">1st Year</option>
                      <option value="2nd">2nd Year</option>
                      <option value="3rd">3rd Year</option>
                      <option value="4th">4th Year</option>
                    </select>
                    <small style={{color:'var(--danger)', marginTop: 4, display: 'block'}}>Required for Class Tutors for year data isolation.</small>
                  </div>
                )}
              </div>
            )}
            <div className="grid">
              <div className="form-group">
                <label>Institution Assignment *</label>
                <select className="input" required value={form.institution_id} onChange={e=>setForm({...form, institution_id: e.target.value})}>
                  <option value="">Select Institution</option>
                  {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Department Assignment</label>
                <select className="input" value={form.dept_id} onChange={e=>setForm({...form, dept_id: e.target.value})} required={['TUTOR','HOD'].includes(form.role)}>
                  <option value="">None / All</option>
                  {departments
                    .filter(d => !form.institution_id || d.institution_id.toString() === form.institution_id.toString())
                    .map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                  }
                </select>
                {['TUTOR', 'HOD'].includes(form.role) && <small style={{color:'var(--danger)', marginTop: 4, display: 'block'}}>Required for Tutors/HODs for data isolation.</small>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary">{editId ? '💾 Save Changes' : 'Create User'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="loading" style={{ padding: 40 }}><div className="spinner" /></div>
        ) : users.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>No staff users found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Email & Phone</th>
                  <th>Department & Year Isolation</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td>
                      <span className="badge badge-primary" style={{ fontSize: 10 }}>{u.role.replace('_', ' ')}</span>
                    </td>
                    <td>
                      <div>{u.email}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.phone || '-'}</div>
                    </td>
                    <td>
                      {u.dept_name ? (
                        <span style={{ fontSize: 12, color: 'var(--primary)' }}>
                          {u.institution_name} • {u.dept_name} {u.year ? <span className="badge badge-gray" style={{ marginLeft: 6, fontSize: 11 }}>{u.year} Year</span> : null}
                        </span>
                      ) : u.institution_name ? (
                        <span style={{ fontSize: 12, color: 'var(--primary)' }}>
                          {u.institution_name}
                          {u.gender ? <span style={{ marginLeft: 6, background: u.gender === 'Male' ? 'rgba(99,102,241,0.12)' : 'rgba(236,72,153,0.12)', color: u.gender === 'Male' ? '#6366f1' : '#ec4899', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{u.gender === 'Male' ? '♂ Boys' : '♀ Girls'}</span> : null}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Global Access</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-sm btn-ghost" style={{ padding: '4px 8px' }} onClick={() => openEdit(u)}>
                          ✏️ Edit
                        </button>
                        <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)', padding: '4px 8px' }} onClick={() => handleDelete(u.id, u.name)}>
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
