import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function NoticesPage() {
  const { api, user } = useAuth();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newNotice, setNewNotice] = useState({ title: '', content: '', category: 'General' });

  const canPost = ['SUPER_ADMIN', 'HOSTEL_ADMIN', 'WARDEN', 'PRINCIPAL'].includes(user?.role);

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const data = await api('/api/notices');
      setNotices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api('/api/notices', { method: 'POST', body: JSON.stringify(newNotice) });
      setShowModal(false);
      fetchNotices();
      setNewNotice({ title: '', content: '', category: 'General' });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this notice?')) return;
    try {
      await api(`/api/notices/${id}`, { method: 'DELETE' });
      fetchNotices();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="page-enter">
      <div className="section-header">
        <h2>📢 Notice Board</h2>
        {canPost && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            ➕ Post Notice
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : notices.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-icon">📢</div>
            <p>No notices available.</p>
          </div>
        ) : (
          notices.map(notice => (
            <div key={notice.id} className="card" style={{ padding: '24px 32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{notice.title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-dim)' }}>
                    <span>Posted by {notice.author_name}</span>
                    <span>•</span>
                    <span>{new Date(notice.created_at).toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {canPost && (
                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)', padding: '4px 8px' }} onClick={() => handleDelete(notice.id)}>
                      🗑️ Delete
                    </button>
                  )}
                  <span className={`badge ${notice.category === 'Urgent' ? 'badge-danger' : notice.category === 'Event' ? 'badge-purple' : 'badge-info'}`}>
                    {notice.category}
                  </span>
                </div>
              </div>
              <p style={{ lineHeight: 1.6, color: 'var(--text-muted)' }}>
                {notice.content}
              </p>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Post New Notice</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input type="text" className="form-input" required value={newNotice.title} onChange={e => setNewNotice({...newNotice, title: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={newNotice.category} onChange={e => setNewNotice({...newNotice, category: e.target.value})}>
                  <option>General</option>
                  <option>Urgent</option>
                  <option>Event</option>
                  <option>Holiday</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Content</label>
                <textarea className="form-input" rows="6" required value={newNotice.content} onChange={e => setNewNotice({...newNotice, content: e.target.value})}></textarea>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Post Notice</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
