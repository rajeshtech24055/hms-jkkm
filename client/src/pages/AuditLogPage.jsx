import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuditLogPage() {
  const { api } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  useEffect(() => {
    fetchLogs(1);
  }, []);

  const fetchLogs = async (pageToFetch = page) => {
    setLoading(true);
    try {
      const skip = (pageToFetch - 1) * limit;
      const res = await api(`/api/audit-logs?skip=${skip}&limit=${limit}`);
      setLogs(res.data);
      setTotal(res.total);
      setPage(pageToFetch);
    } catch (e) {
      alert("Failed to fetch audit logs: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter">
      <div className="section-header">
        <div>
          <h2>🛡️ System Audit Logs</h2>
          <p style={{ color: 'var(--text-muted)' }}>Detailed tracking of system actions (Super Admin only)</p>
        </div>
        <button className="btn btn-secondary" onClick={() => fetchLogs(1)}>🔄 Refresh</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 20 }}>Loading logs...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No audit logs recorded yet.</td></tr>
            ) : (
              logs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleString()}</td>
                  <td style={{ fontWeight: 500 }}>{log.user_name}</td>
                  <td>
                    <span className={`badge`} style={{ 
                      background: log.action === 'DELETE' ? 'rgba(239,68,68,0.1)' : 'var(--surface-2)',
                      color: log.action === 'DELETE' ? 'var(--danger)' : 'var(--text)'
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td>{log.entity}</td>
                  <td style={{ maxWidth: 300, whiteSpace: 'normal' }}>{log.details}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{log.ip_address || 'N/A'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {!loading && total > 0 && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} logs
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" disabled={page === 1} onClick={() => fetchLogs(page - 1)}>
                Previous
              </button>
              <button className="btn btn-sm" disabled={page * limit >= total} onClick={() => fetchLogs(page + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
