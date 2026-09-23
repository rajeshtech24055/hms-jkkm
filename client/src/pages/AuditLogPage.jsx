import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuditLogPage() {
  const { api } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/audit-logs?limit=100')
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <div className="page-enter">
      <div className="section-header">
        <h2>🔐 Audit Logs</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Track system changes and user actions for accountability.
        </p>
      </div>

      <div className="card no-padding">
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(log.created_at).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{log.user_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>ID: {log.user_id || 'System'}</div>
                    </td>
                    <td>
                      <span className="badge badge-info">{log.user_role || 'System'}</span>
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      {log.entity} {log.entity_id && `#${log.entity_id}`}
                    </td>
                    <td style={{ maxWidth: 300, whiteSpace: 'normal', fontSize: 13, color: 'var(--text-muted)' }}>
                      {log.details}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {log.ip}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <div className="empty-icon">📂</div>
                        <p>No audit logs found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
