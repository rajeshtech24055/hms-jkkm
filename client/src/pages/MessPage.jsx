import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['Grains', 'Pulses', 'Vegetables', 'Fruits', 'Dairy', 'Spices', 'Oil & Fat', 'Beverages', 'Bakery', 'Cleaning', 'General'];
const UNITS = ['kg', 'g', 'litre', 'ml', 'dozen', 'piece', 'packet', 'box', 'bottle', 'can'];

const EMPTY_FORM = {
  name: '', category: 'Grains', unit: 'kg',
  current_stock: '', reorder_level: '',
  supplier: '', unit_price: '', batch_no: '',
  mfg_date: '', exp_date: '',
  is_perishable: false   // toggle to show/hide date fields
};

function ExpiryBadge({ item }) {
  if (item.is_expired)    return <span className="badge badge-danger">⚠️ EXPIRED</span>;
  if (item.expires_soon)  return <span className="badge badge-warning">⏰ Expires Soon</span>;
  if (item.exp_date)      return <span className="badge badge-success">✅ OK</span>;
  return <span style={{ color:'var(--text-dim)', fontSize:11 }}>—</span>;
}

function daysUntilExpiry(exp_date) {
  if (!exp_date) return null;
  const diff = (new Date(exp_date) - new Date()) / 86400000;
  return Math.ceil(diff);
}

export default function MessPage() {
  const { api, user } = useAuth();

  const [tab, setTab] = useState('items'); // items | usage | alerts
  const [items, setItems] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [usageLogs, setUsageLogs] = useState([]);
  const [expiryAlerts, setExpiryAlerts] = useState({ expired: [], expiringSoon: [], lowStock: [] });
  const [dashStats, setDashStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal]     = useState(false);
  const [showEditModal, setShowEditModal]   = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showWastageModal, setShowWastageModal] = useState(false);
  const [selectedItem, setSelectedItem]     = useState(null);

  // Forms
  const [form, setForm]             = useState(EMPTY_FORM);
  const [restockForm, setRestockForm] = useState({ qty:'', batch_no:'', mfg_date:'', exp_date:'', unit_price:'' });
  const [usageForm, setUsageForm]   = useState({ item_id:'', qty:'' });

  const isFoodAdmin = ['FOOD_ADMIN','SUPER_ADMIN','HOSTEL_ADMIN', 'MESS_MANAGER'].includes(user?.role);
  const isMobileManager = user?.role === 'MESS_MANAGER';

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [itemsData, predData, usageData, alertData, dashData] = await Promise.all([
        api('/api/mess_inventory'),
        api('/api/mess_inventory/prediction'),
        api('/api/mess_inventory/usage'),
        api('/api/mess_inventory/expiry-alerts'),
        api('/api/dashboard')
      ]);
      setItems(itemsData);
      setPredictions(predData);
      setUsageLogs(usageData);
      setExpiryAlerts(alertData);
      setDashStats(dashData.stats);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Add Item ──────────────────────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api('/api/mess_inventory', { method:'POST', body: JSON.stringify(form) });
      setShowAddModal(false);
      setForm(EMPTY_FORM);
      fetchAll();
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ── Edit Item ─────────────────────────────────────────────────────────────────
  const openEdit = (item) => {
    setSelectedItem(item);
    setForm({ ...item, is_perishable: !!(item.mfg_date || item.exp_date || item.batch_no) });
    setShowEditModal(true);
  };
  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await api(`/api/mess_inventory/${selectedItem.id}`, { method:'PUT', body: JSON.stringify(form) });
      setShowEditModal(false);
      fetchAll();
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await api(`/api/mess_inventory/${id}`, { method:'DELETE' });
    fetchAll();
  };

  // ── Restock ───────────────────────────────────────────────────────────────────
  const openRestock = (item) => {
    setSelectedItem(item);
    setRestockForm({
      qty: '', batch_no:'', mfg_date:'', exp_date:'', unit_price:'', bill_image: '',
      is_perishable: !!(item.mfg_date || item.exp_date || item.batch_no)
    });
    setShowRestockModal(true);
  };

  
  const handleBillUploadRestock = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      setRestockForm(f => ({ ...f, bill_image: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    try {
      await api(`/api/mess_inventory/${selectedItem.id}/restock`, { method:'POST', body: JSON.stringify(restockForm) });
      setShowRestockModal(false);
      fetchAll();
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ── Log Usage ─────────────────────────────────────────────────────────────────
  const handleUsage = async (e) => {
    e.preventDefault();
    try {
      await api(`/api/mess_inventory/${usageForm.item_id}/use`, { method:'POST', body: JSON.stringify({ qty: parseFloat(usageForm.qty) }) });
      setShowUsageModal(false);
      setUsageForm({ item_id:'', qty:'' });
      fetchAll();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const presentStudents = predictions.length > 0 ? predictions[0].present_students : 0;
  const alertCount = (expiryAlerts.expired?.length || 0) + (expiryAlerts.expiringSoon?.length || 0) + (expiryAlerts.lowStock?.length || 0);

  
  // Flatten batches so they appear as separate rows
  const flattenedItems = [];
  if (items) {
    items.forEach(item => {
      if (item.batches && item.batches.length > 0) {
        item.batches.forEach((b, idx) => {
          flattenedItems.push({
            ...item,
            batch_id: b.id,
            current_stock: b.qty_remaining,
            batch_no: b.batch_no,
            mfg_date: b.mfg_date,
            exp_date: b.exp_date,
            unit_price: b.unit_price,
            is_expired: b.is_expired,
            expires_soon: b.expires_soon,
            is_first_batch: idx === 0,
            row_key: `${item.id}_${b.id}`,
            master_item: item
          });
        });
      } else {
        flattenedItems.push({
          ...item,
          is_first_batch: true,
          row_key: `${item.id}_none`,
          master_item: item
        });
      }
    });
  }

  return (
    <div className="page-enter">
      {isMobileManager ? (
        <div style={{ padding: '16px', maxWidth: 480, margin: '0 auto', paddingBottom: 100 }}>
          <h2 style={{ fontSize: 26, marginBottom: 8 }}>👨‍🍳 Kitchen Manager</h2>
          
          {/* Headcount Forecast */}
          <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: 'white', marginBottom: 24, border: 'none' }}>
            <div style={{ fontSize: 13, opacity: 0.9, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>AI Headcount Forecast</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <span style={{ fontSize: 48, fontWeight: 800, lineHeight: 1 }}>{presentStudents}</span>
              <span style={{ fontSize: 15, opacity: 0.9, paddingBottom: 6 }}>meals to prepare</span>
            </div>
            <p style={{ marginTop: 12, fontSize: 13, opacity: 0.8, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 12 }}>
              {dashStats ? `${dashStats.on_leave} on leave · ${dashStats.outside_now} currently outside` : 'Loading data...'}
            </p>
          </div>

          {/* Big Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <button className="btn btn-primary" style={{ padding: '24px', fontSize: 20, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 16, boxShadow: '0 8px 16px rgba(99,102,241,0.2)', border: 'none' }} onClick={() => setShowUsageModal(true)}>
              <span style={{ fontSize: 32 }}>📋</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700 }}>Log Daily Usage</div>
                <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.9 }}>Record items used today</div>
              </div>
            </button>

            <button className="btn" style={{ padding: '24px', fontSize: 20, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 16, background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }} onClick={() => { setForm(EMPTY_FORM); setShowAddModal(true); }}>
              <span style={{ fontSize: 32 }}>📦</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700 }}>Add New Stock</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>Received new delivery</div>
              </div>
            </button>

            <button className="btn" style={{ padding: '24px', fontSize: 20, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 16, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }} onClick={() => alert('AI Voice Logger coming in the next update!')}>
              <span style={{ fontSize: 32 }}>🎙️</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700 }}>Voice Logger (AI)</div>
                <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.8 }}>Hold to speak entry</div>
              </div>
            </button>
          </div>

          {/* Expiry / Alerts Mini Banner */}
          {alertCount > 0 && (
            <div style={{ marginTop: 24, background: 'var(--bg-card)', padding: '16px', borderRadius: 16, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }} onClick={() => { setTab('alerts'); }}>
              <span style={{ fontSize: 24 }}>🚨</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{alertCount} Attention Required</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Items expiring or low stock</div>
              </div>
              <button className="btn btn-sm btn-ghost">View</button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'contents' }}>
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="gradient-text" style={{ fontSize: 24, marginBottom: 4 }}>🍽️ Mess &amp; Grocery Management</h2>
          <p style={{ color:'var(--text-muted)', fontSize:14, fontWeight: 500 }}>Common Kitchen · {presentStudents} students to feed today</p>
        </div>
        {isFoodAdmin && (
          <div style={{ display:'flex', gap:12 }}>
            <button className="btn btn-ghost" style={{ background: 'var(--bg-card)' }} onClick={() => setShowUsageModal(true)}>📋 Log Usage</button>
            <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setShowAddModal(true); }}>➕ Add Mess Item</button>
          </div>
        )}
      </div>

      {/* Expiry Banner */}
      {alertCount > 0 && (
        <div className={`alert ${(expiryAlerts.expired?.length || 0) > 0 ? 'alert-danger' : 'alert-warning'}`} style={{ padding: '16px 20px', borderRadius: '16px', marginBottom: 24, boxShadow: 'var(--shadow)', border: 'none', background: (expiryAlerts.expired?.length || 0) > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)' }}>
          <span style={{ fontSize: 28 }}>{(expiryAlerts.expired?.length || 0) > 0 ? '🚨' : '⚠️'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: (expiryAlerts.expired?.length || 0) > 0 ? 'var(--danger)' : 'var(--warning)' }}>
              {(expiryAlerts.expired?.length || 0) > 0 ? `${(expiryAlerts.expired?.length || 0)} item(s) EXPIRED` : ''}
              {expiryAlerts.expired && (expiryAlerts.expired?.length || 0) > 0 && (expiryAlerts.expiringSoon?.length || 0) > 0 ? ' · ' : ''}
              {(expiryAlerts.expiringSoon?.length || 0) > 0 ? `${(expiryAlerts.expiringSoon?.length || 0)} item(s) expire within 7 days` : ''}
            </div>
            <div style={{ fontSize:13, opacity: 0.9, fontWeight: 500, color: 'var(--text)' }}>
              {[...expiryAlerts.expired, ...expiryAlerts.expiringSoon].map(i => i.name).join(', ')}
            </div>
          </div>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', border: 'none', color: 'inherit', fontWeight: 700, padding: '8px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }} onClick={() => setTab('alerts')}>View Alerts →</button>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" style={{ maxWidth: 480, marginBottom: 24, padding: 6, borderRadius: 12, background: 'var(--bg-card)', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
        {[['items','📦 Mess Items'],['usage','📋 Usage Log'],['alerts',`🚨 Alerts${(expiryAlerts.expired?.length || 0) + (expiryAlerts.expiringSoon?.length || 0) + (expiryAlerts.lowStock?.length || 0) > 0 ? ` (${alertCount})` : ''}`]].map(([key,label]) => (
          <div key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)} style={{ padding: '10px 16px', borderRadius: 8, transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: tab === key ? 700 : 500, userSelect: 'none' }}>
            {label}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <>
          {/* ── TAB: Items ─────────────────────────────────────────────────────── */}
          {tab === 'items' && (
            <div className="card" style={{ padding:0 }}>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item / Batch</th>
                      <th>Category</th>
                      <th>Stock</th>
                      <th>Mfg. Date</th>
                      <th>Exp. Date</th>
                      <th>Expiry Status</th>
                      <th>Supplier</th>
                      <th>Unit Price</th>
                      <th>Total Value</th>
                      {isFoodAdmin && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr><td colSpan={10} style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>No grocery items found. Click "Add Mess Item" to get started.</td></tr>
                      ) : flattenedItems.map(item => (
                        <tr key={item.row_key} style={{ background: item.is_expired ? 'rgba(239,68,68,0.06)' : item.expires_soon ? 'rgba(245,158,11,0.06)' : undefined, borderBottom: !item.is_first_batch ? '1px dashed var(--border)' : undefined }}>
                          <td>
                            <div style={{ fontWeight: item.is_first_batch ? 600 : 400, color: item.is_first_batch ? 'inherit' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {!item.is_first_batch && <span style={{ color: 'var(--border)' }}>↳</span>}
                              {item.name}
                            </div>
                            {item.batch_no && <div style={{ fontSize:11, color:'var(--text-dim)', marginLeft: item.is_first_batch ? 0 : 20 }}>Batch: {item.batch_no}</div>}
                          </td>
                          <td>{item.is_first_batch && <span className="badge badge-gray">{item.category}</span>}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight:800, fontSize: 14 }}>{item.current_stock}</span>
                              <span style={{ fontSize:11, fontWeight:600, color: 'var(--text-dim)', background: 'var(--bg-card2)', padding: '2px 6px', borderRadius: 6 }}>{item.unit}</span>
                            </div>
                            {item.is_first_batch && (
                              <>
                                <div style={{ fontSize:11, color:'var(--text-dim)', marginTop: 2 }}>Total overall: {item.master_item.current_stock} {item.unit}</div>
                                {item.master_item.current_stock <= item.reorder_level && (
                                  <div style={{ fontSize:11, color:'var(--danger)', fontWeight: 700, marginTop: 2 }}>
                                    ⚠️ Low Stock (&le; {item.reorder_level})
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                          <td style={{ fontSize:13 }}>{item.mfg_date || '—'}</td>
                          <td style={{ fontSize:13, fontWeight: item.is_expired||item.expires_soon ? 700 : 400, color: item.is_expired ? '#ef4444' : item.expires_soon ? '#f59e0b' : undefined }}>
                            {item.exp_date ? (
                              <>
                                {item.exp_date}
                                <div style={{ fontSize:11, color:'var(--text-dim)' }}>
                                  {daysUntilExpiry(item.exp_date) !== null ? (daysUntilExpiry(item.exp_date) < 0 ? `${Math.abs(daysUntilExpiry(item.exp_date))}d ago` : `in ${daysUntilExpiry(item.exp_date)}d`) : ''}
                                </div>
                              </>
                            ) : '—'}
                          </td>
                          <td><ExpiryBadge item={item} /></td>
                          <td style={{ fontSize:12 }}>{item.supplier || '—'}</td>
                          <td style={{ fontSize:13 }}>{item.unit_price ? `₹${item.unit_price}` : '—'}</td>
                          <td style={{ fontSize:13, fontWeight:600 }}>{item.unit_price && item.current_stock ? '₹' + (item.unit_price * item.current_stock).toLocaleString('en-IN', { maximumFractionDigits:2 }) : '—'}</td>
                          {isFoodAdmin && (
                            <td>
                              {item.is_first_batch && (
                                <div style={{ display:'flex', gap:6, flexWrap:'nowrap' }}>
                                  <button className="btn btn-icon btn-ghost" style={{ border: 'none', background: 'var(--bg-card2)', color: 'var(--success)' }} onClick={() => openRestock(item.master_item)} title="Restock">📦</button>
                                  <button className="btn btn-icon btn-ghost" style={{ border: 'none', background: 'var(--bg-card2)', color: 'var(--warning)' }} onClick={() => { setSelectedItem(item.master_item); setUsageForm(f => ({ ...f, item_id: item.master_item.id })); setShowUsageModal(true); }} title="Log Usage">📉</button>
                                  <button className="btn btn-icon btn-ghost" style={{ border: 'none', background: 'var(--bg-card2)' }} onClick={() => openEdit(item.master_item)} title="Edit Master Item">✏️</button>
                                  <button className="btn btn-icon btn-ghost" style={{ border: 'none', background: 'var(--bg-card2)', color: 'var(--danger)' }} onClick={() => handleDelete(item.master_item.id, item.master_item.name)} title="Delete All">🗑️</button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          {/* ── TAB: Usage Log ──────────────────────────────────────────────────── */}
          {tab === 'usage' && (
            <div className="card" style={{ padding:0 }}>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Item</th><th>Qty Used</th><th>Date</th><th>Logged By</th></tr></thead>
                  <tbody>
                    {usageLogs.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>No usage logs yet.</td></tr>
                    ) : usageLogs.map(log => (
                      <tr key={log.id}>
                        <td style={{ fontWeight:600 }}>{log.item_name}</td>
                        <td>{log.qty_used} {log.unit}</td>
                        <td>{log.date}</td>
                        <td>{log.logged_by_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB: Expiry Alerts ──────────────────────────────────────────────── */}
          {tab === 'alerts' && (
            <div style={{ display:'grid', gap:16 }}>
              {(!expiryAlerts.expired || (expiryAlerts.expired?.length || 0) === 0) && (!expiryAlerts.expiringSoon || (expiryAlerts.expiringSoon?.length || 0) === 0) && (!expiryAlerts.lowStock || expiryAlerts.lowStock.length === 0) ? (
                <div className="card" style={{ padding:40, textAlign:'center' }}>
                  <div style={{ fontSize:48 }}>✅</div>
                  <p style={{ color:'var(--text-muted)', marginTop:8 }}>No expiry alerts! All items are within date.</p>
                </div>
              ) : (
                <>
                  {expiryAlerts.expired && (expiryAlerts.expired?.length || 0) > 0 && (
                    <div>
                      <h3 style={{ color:'#ef4444', marginBottom:10 }}>🚨 Expired Items ({(expiryAlerts.expired?.length || 0)})</h3>
                      <div className="card" style={{ padding:0 }}>
                        <div className="table-wrap">
                          <table className="table">
                            <thead><tr><th>Item</th><th>Batch</th><th>Exp. Date</th><th>Days Overdue</th><th>Stock</th>{isFoodAdmin && <th>Action</th>}</tr></thead>
                            <tbody>
                              {(expiryAlerts.expired || []).map(item => (
                                <tr key={item.id} style={{ background:'rgba(239,68,68,0.06)' }}>
                                  <td style={{ fontWeight:600 }}>{item.name}</td>
                                  <td>{item.batch_no || '—'}</td>
                                  <td style={{ color:'#ef4444', fontWeight:700 }}>{item.exp_date}</td>
                                  <td style={{ color:'#ef4444' }}>{Math.abs(daysUntilExpiry(item.exp_date))} days</td>
                                  <td>{item.current_stock} {item.unit}</td>
                                  {isFoodAdmin && <td><button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id, item.name)}>🗑️ Remove</button></td>}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                                      {expiryAlerts.lowStock && expiryAlerts.lowStock.length > 0 && (
                      <div>
                        <h3 style={{ color:'var(--danger)', marginBottom:10 }}>📉 Low Stock Items ({expiryAlerts.lowStock.length})</h3>
                        <div className="card" style={{ padding:0 }}>
                          <div className="table-wrap">
                            <table className="table">
                              <thead><tr><th>Item</th><th>Category</th><th>Current Stock</th><th>Limit</th>{isFoodAdmin && <th>Action</th>}</tr></thead>
                              <tbody>
                                {expiryAlerts.lowStock.map(item => (
                                  <tr key={item.id} style={{ background:'rgba(239,68,68,0.06)' }}>
                                    <td style={{ fontWeight:600 }}>{item.name}</td>
                                    <td><span className="badge badge-gray">{item.category}</span></td>
                                    <td style={{ color:'var(--danger)', fontWeight:700 }}>{item.current_stock} {item.unit}</td>
                                    <td>{item.reorder_level} {item.unit}</td>
                                    {isFoodAdmin && <td><button className="btn btn-sm" style={{ background:'var(--surface-2)', color: 'var(--success)' }} onClick={() => openRestock(item)}>📦 Restock</button></td>}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                    {expiryAlerts.expiringSoon && (expiryAlerts.expiringSoon?.length || 0) > 0 && (
                    <div>
                      <h3 style={{ color:'#f59e0b', marginBottom:10 }}>⏰ Expiring Within 7 Days ({(expiryAlerts.expiringSoon?.length || 0)})</h3>
                      <div className="card" style={{ padding:0 }}>
                        <div className="table-wrap">
                          <table className="table">
                            <thead><tr><th>Item</th><th>Batch</th><th>Exp. Date</th><th>Days Left</th><th>Stock</th>{isFoodAdmin && <th>Action</th>}</tr></thead>
                            <tbody>
                              {(expiryAlerts.expiringSoon || []).map(item => (
                                <tr key={item.id} style={{ background:'rgba(245,158,11,0.06)' }}>
                                  <td style={{ fontWeight:600 }}>{item.name}</td>
                                  <td>{item.batch_no || '—'}</td>
                                  <td style={{ color:'#f59e0b', fontWeight:700 }}>{item.exp_date}</td>
                                  <td style={{ color:'#f59e0b' }}>{daysUntilExpiry(item.exp_date)} days</td>
                                  <td>{item.current_stock} {item.unit}</td>
                                  {isFoodAdmin && <td><button className="btn btn-sm" style={{ background:'var(--surface-2)' }} onClick={() => openEdit(item)}>✏️ Update</button></td>}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
      </div>
      )}

      {/* ════ ADD GROCERY MODAL ════ */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" style={{ maxWidth:560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">➕ Add Mess Item Item</span>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAdd}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label className="form-label">Item Name *</label>
                  <input className="form-input" required value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} placeholder="e.g. Rice (Ponni)" />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category:e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select className="form-input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit:e.target.value }))}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Current Stock</label>
                  <input type="number" step="0.1" className="form-input" value={form.current_stock} onChange={e => setForm(f => ({ ...f, current_stock:e.target.value }))} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Price (₹)</label>
                  <input type="number" step="0.01" className="form-input" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price:e.target.value }))} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label className="form-label">Low Stock Threshold ({form.unit || 'units'}) *</label>
                  <input type="number" step="0.1" className="form-input" value={form.reorder_level} onChange={e => setForm(f => ({ ...f, reorder_level:e.target.value }))} placeholder="e.g. 10 (triggers low stock warning)" />
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>⚠️ Triggers alert when stock &le; this level</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Default Restock Qty</label>
                  <input type="number" step="0.1" className="form-input" value={form.reorder_qty} onChange={e => setForm(f => ({ ...f, reorder_qty:e.target.value }))} placeholder="e.g. 50" />
                </div>
                {/* ── Perishable Toggle ── */}
                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none',
                    background: form.is_perishable ? 'rgba(99,102,241,0.08)' : 'var(--surface-2)',
                    border: `1px solid ${form.is_perishable ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius:8, padding:'10px 14px' }}>
                    <input type="checkbox" checked={form.is_perishable}
                      onChange={e => setForm(f => ({
                        ...f, is_perishable: e.target.checked,
                        // clear dates if unchecked
                        ...(!e.target.checked ? { batch_no:'', mfg_date:'', exp_date:'' } : {})
                      }))}
                      style={{ width:16, height:16, accentColor:'var(--primary)' }} />
                    <div>
                      <div style={{ fontWeight:600, fontSize:14 }}>📦 This item has Manufacturing &amp; Expiry dates</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>Enable for packaged goods, dairy, oil, spices, etc. Not needed for fresh vegetables, firewood, etc.</div>
                    </div>
                  </label>
                </div>

                {/* ── Date fields — only shown when perishable ── */}
                {form.is_perishable && (
                  <>
                    <div className="form-group" style={{ gridColumn:'1/-1' }}>
                      <label className="form-label">Batch / Lot No. <span style={{ color:'var(--text-dim)', fontWeight:400 }}>(optional)</span></label>
                      <input className="form-input" value={form.batch_no} onChange={e => setForm(f => ({ ...f, batch_no:e.target.value }))} placeholder="e.g. LOT-2026-08-A" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">🏭 Manufacturing Date <span style={{ color:'var(--text-dim)', fontWeight:400 }}>(optional)</span></label>
                      <input type="date" className="form-input" value={form.mfg_date} onChange={e => setForm(f => ({ ...f, mfg_date:e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">📅 Expiry Date <span style={{ color:'var(--text-dim)', fontWeight:400 }}>(optional)</span></label>
                      <input type="date" className="form-input" value={form.exp_date} onChange={e => setForm(f => ({ ...f, exp_date:e.target.value }))} />
                      {form.mfg_date && form.exp_date && new Date(form.exp_date) <= new Date(form.mfg_date) && (
                        <div style={{ color:'#ef4444', fontSize:11, marginTop:4 }}>⚠️ Expiry must be after manufacturing date</div>
                      )}
                    </div>
                  </>
                )}

                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label className="form-label">Supplier</label>
                  <input className="form-input" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier:e.target.value }))} placeholder="e.g. Sri Murugan Traders" />
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="submit" className="btn btn-primary" style={{ flex:1 }}>✅ Add Item</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ EDIT GROCERY MODAL ════ */}
      {showEditModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" style={{ maxWidth:560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">✏️ Edit: {selectedItem.name}</span>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label className="form-label">Item Name *</label>
                  <input className="form-input" required value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category:e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select className="form-input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit:e.target.value }))}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Current Stock</label>
                  <input type="number" step="0.1" className="form-input" value={form.current_stock} onChange={e => setForm(f => ({ ...f, current_stock:e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Price (₹)</label>
                  <input type="number" step="0.01" className="form-input" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price:e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Low Stock Threshold ({form.unit || 'units'}) *</label>
                  <input type="number" step="0.1" className="form-input" value={form.reorder_level} onChange={e => setForm(f => ({ ...f, reorder_level:e.target.value }))} placeholder="e.g. 10" />
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>⚠️ Triggers alert when stock &le; this level</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Default Restock Qty</label>
                  <input type="number" step="0.1" className="form-input" value={form.reorder_qty} onChange={e => setForm(f => ({ ...f, reorder_qty:e.target.value }))} />
                </div>
                {/* ── Perishable Toggle (Edit) ── */}
                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none',
                    background: form.is_perishable ? 'rgba(99,102,241,0.08)' : 'var(--surface-2)',
                    border: `1px solid ${form.is_perishable ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius:8, padding:'10px 14px' }}>
                    <input type="checkbox" checked={!!form.is_perishable}
                      onChange={e => setForm(f => ({
                        ...f, is_perishable: e.target.checked,
                        ...(!e.target.checked ? { batch_no:'', mfg_date:'', exp_date:'' } : {})
                      }))}
                      style={{ width:16, height:16, accentColor:'var(--primary)' }} />
                    <div>
                      <div style={{ fontWeight:600, fontSize:14 }}>📦 This item has Manufacturing &amp; Expiry dates</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>Enable for packaged goods, dairy, oil, spices, etc.</div>
                    </div>
                  </label>
                </div>

                {form.is_perishable && (
                  <>
                    <div className="form-group" style={{ gridColumn:'1/-1' }}>
                      <label className="form-label">Batch / Lot No. <span style={{ color:'var(--text-dim)', fontWeight:400 }}>(optional)</span></label>
                      <input className="form-input" value={form.batch_no||''} onChange={e => setForm(f => ({ ...f, batch_no:e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">🏭 Manufacturing Date <span style={{ color:'var(--text-dim)', fontWeight:400 }}>(optional)</span></label>
                      <input type="date" className="form-input" value={form.mfg_date||''} onChange={e => setForm(f => ({ ...f, mfg_date:e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">📅 Expiry Date <span style={{ color:'var(--text-dim)', fontWeight:400 }}>(optional)</span></label>
                      <input type="date" className="form-input" value={form.exp_date||''} onChange={e => setForm(f => ({ ...f, exp_date:e.target.value }))} />
                      {form.mfg_date && form.exp_date && new Date(form.exp_date) <= new Date(form.mfg_date) && (
                        <div style={{ color:'#ef4444', fontSize:11, marginTop:4 }}>⚠️ Expiry must be after manufacturing date</div>
                      )}
                    </div>
                  </>
                )}

                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label className="form-label">Supplier</label>
                  <input className="form-input" value={form.supplier||''} onChange={e => setForm(f => ({ ...f, supplier:e.target.value }))} />
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="submit" className="btn btn-primary" style={{ flex:1 }}>💾 Save Changes</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowEditModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ RESTOCK MODAL ════ */}
      {showRestockModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowRestockModal(false)}>
          <div className="modal" style={{ maxWidth:440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">📥 Restock: {selectedItem.name}</span>
              <button className="modal-close" onClick={() => setShowRestockModal(false)}>✕</button>
            </div>
            <div style={{ padding:'8px 0 16px', color:'var(--text-muted)', fontSize:13 }}>
              Current Stock: <strong>{selectedItem.current_stock} {selectedItem.unit}</strong>
            </div>
            <form onSubmit={handleRestock}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label className="form-label">Quantity to Add *</label>
                  <input type="number" step="0.1" className="form-input" required value={restockForm.qty} onChange={e => setRestockForm(f => ({ ...f, qty:e.target.value }))} placeholder={`in ${selectedItem.unit}`} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Price (₹)</label>
                  <input type="number" step="0.01" className="form-input" value={restockForm.unit_price} onChange={e => setRestockForm(f => ({ ...f, unit_price:e.target.value }))} placeholder="Per unit cost" />
                </div>
                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none',
                    background: restockForm.is_perishable ? 'rgba(99,102,241,0.08)' : 'var(--surface-2)',
                    border: `1px solid ${restockForm.is_perishable ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius:8, padding:'10px 14px' }}>
                    <input type="checkbox" checked={!!restockForm.is_perishable}
                      onChange={e => setRestockForm(f => ({
                        ...f, is_perishable: e.target.checked,
                        ...(!e.target.checked ? { batch_no:'', mfg_date:'', exp_date:'' } : {})
                      }))}
                      style={{ width:16, height:16, accentColor:'var(--primary)' }} />
                    <div>
                      <div style={{ fontWeight:600, fontSize:14 }}>📦 Update batch / expiry dates for this delivery</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>Check if the new stock has a different batch or expiry date</div>
                    </div>
                  </label>
                </div>

                {restockForm.is_perishable && (
                  <>
                    <div className="form-group" style={{ gridColumn:'1/-1' }}>
                      <label className="form-label">Batch / Lot No. <span style={{ color:'var(--text-dim)', fontWeight:400 }}>(optional)</span></label>
                      <input className="form-input" value={restockForm.batch_no} onChange={e => setRestockForm(f => ({ ...f, batch_no:e.target.value }))} placeholder="e.g. LOT-2026-09-B" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">🏭 Manufacturing Date <span style={{ color:'var(--text-dim)', fontWeight:400 }}>(optional)</span></label>
                      <input type="date" className="form-input" value={restockForm.mfg_date} onChange={e => setRestockForm(f => ({ ...f, mfg_date:e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">📅 Expiry Date <span style={{ color:'var(--text-dim)', fontWeight:400 }}>(optional)</span></label>
                      <input type="date" className="form-input" value={restockForm.exp_date} onChange={e => setRestockForm(f => ({ ...f, exp_date:e.target.value }))} />
                    </div>
                  </>
                )}
              </div>
              {restockForm.is_perishable && restockForm.mfg_date && restockForm.exp_date && new Date(restockForm.exp_date) <= new Date(restockForm.mfg_date) && (
                <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid #ef4444', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#ef4444', marginTop:8 }}>
                  ⚠️ Expiry date must be after manufacturing date!
                </div>
              )}

              {/* Bill Upload */}
              <div style={{ marginTop:16, padding:'14px 16px', background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:10 }}>
                <label className="form-label" style={{ fontWeight:600, marginBottom:8, display:'block' }}>📎 Upload Physical Bill / Invoice</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="form-input"
                  onChange={handleBillUploadRestock}
                />
                {restockForm.bill_image
                  ? <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ color:'#10b981', fontWeight:700, fontSize:13 }}>✅ Bill attached</span>
                      <a href={restockForm.bill_image} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'var(--primary)' }}>Preview</a>
                    </div>
                  : <small style={{ color:'var(--text-muted)', marginTop:6, display:'block' }}>Optional — attach the shop receipt/bill for this purchase</small>
                }
              </div>

              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="submit" className="btn btn-success" style={{ flex:1 }}>📥 Confirm Restock</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowRestockModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ LOG USAGE MODAL ════ */}
      {showUsageModal && (
        <div className="modal-overlay" onClick={() => setShowUsageModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">📋 Log Daily Usage</span>
              <button className="modal-close" onClick={() => setShowUsageModal(false)}>✕</button>
            </div>
            <form onSubmit={handleUsage}>
              <div className="form-group">
                <label className="form-label">Select Item *</label>
                <select className="form-input" required value={usageForm.item_id} onChange={e => setUsageForm(f => ({ ...f, item_id:e.target.value }))}>
                  <option value="">-- Select Item --</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.current_stock} {i.unit})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity Used *</label>
                <input type="number" step="0.1" className="form-input" required value={usageForm.qty} onChange={e => setUsageForm(f => ({ ...f, qty:e.target.value }))} placeholder="e.g. 15.5" />
              </div>
              <div style={{ display:'flex', gap:10, marginTop:20 }}>
                <button type="submit" className="btn btn-primary" style={{ flex:1 }}>💾 Save Usage</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowUsageModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
