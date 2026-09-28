import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function OutsidePage() {
  const { api, user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/gate/outside')
      .then(data => {
        data.sort((a, b) => {
           if (a.is_overdue && !b.is_overdue) return -1;
           if (!a.is_overdue && b.is_overdue) return 1;
           return new Date(b.exit_time) - new Date(a.exit_time);
        });
        setStudents(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [api, user]);

  return (
    <div className="page-enter">
      <div className="section-header">
        <h2>🌍 Students Currently Outside</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
           <span className="badge badge-warning" style={{ fontSize: 13, padding: '6px 12px' }}>{students.length} Outside</span>
        </div>
      </div>

      <div className="card no-padding">
        <div className="table-wrap">
          {loading ? (
             <div className="loading"><div className="spinner" /></div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Reg No</th>
                  <th>Institution / Dept</th>
                  <th>Room</th>
                  <th>Exit Time</th>
                  <th>Expected Return</th>
                  <th>Leave Type</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id} style={s.is_overdue ? { background: 'rgba(239, 68, 68, 0.05)', borderLeft: '4px solid var(--danger)' } : {}}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{s.mobile}</div>
                    </td>
                    <td><code style={{ color: 'var(--primary-light)', fontWeight: 700 }}>{s.reg_no}</code></td>
                    <td>
                       <span className={`badge badge-${s.institution_code === 'ENG' ? 'eng' : s.institution_code === 'AGRI' ? 'agri' : 'pharm'}`} style={{ marginRight: 6 }}>{s.institution_code}</span>
                       <span style={{ fontSize: 12 }}>{s.dept_name}</span>
                    </td>
                    <td>{s.room_no || 'N/A'}</td>
                    <td>
                      <div style={{ fontSize: 13, color: 'var(--warning)' }}>{new Date(s.exit_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{new Date(s.exit_time).toLocaleDateString('en-IN')}</div>
                    </td>
                    <td>
                      {s.to_dt ? (
                        <>
                          <div style={{ fontSize: 13 }}>{new Date(s.to_dt).toLocaleDateString('en-IN')}</div>
                          {new Date(s.to_dt) < new Date() && <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 700 }}>Overdue</div>}
                        </>
                      ) : (
                         <span style={{ color: 'var(--text-dim)' }}>Today Evening</span>
                      )}
                    </td>
                    <td>
                       {s.leave_type === 'emergency' && <span className="badge badge-danger">Emergency</span>}
                       {s.leave_type === 'regular' && <span className="badge badge-info">Regular</span>}
                       {s.leave_type === 'festival' && <span className="badge badge-purple">Festival</span>}
                       {!s.leave_type && <span className="badge badge-gray">Local Outing</span>}
                    </td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">🌍</div><p>All students are inside the hostel</p></div></td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
