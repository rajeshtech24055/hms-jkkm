import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// ── Constants ──────────────────────────────────────────────────────────────────
const CATEGORIES = ['Furniture','Bedding','Electrical','Cleaning','Safety','Plumbing','Sports','Kitchen','Stationery','Other'];
const CONDITIONS = ['New','Good','Fair','Poor','Under Repair','Disposed'];
const UNITS      = ['nos','set','kg','litre','box','roll','pair','kit','metre','piece'];
const TX_TYPES   = ['Purchase','Issue','Return','Damage','Disposal','Adjustment'];
const PO_STATUS  = ['Pending','Approved','Ordered','Received','Cancelled'];

const COND_COLORS = {
  'New':          { bg:'rgba(16,185,129,0.12)',  color:'#10b981' },
  'Good':         { bg:'rgba(99,102,241,0.12)',   color:'#6366f1' },
  'Fair':         { bg:'rgba(245,158,11,0.12)',   color:'#f59e0b' },
  'Poor':         { bg:'rgba(239,68,68,0.12)',    color:'#ef4444' },
  'Under Repair': { bg:'rgba(249,115,22,0.12)',   color:'#f97316' },
  'Disposed':     { bg:'rgba(107,114,128,0.12)',  color:'#6b7280' },
};
const PO_COLORS = {
  'Pending':   '#f59e0b',
  'Approved':  '#6366f1',
  'Ordered':   '#3b82f6',
  'Received':  '#10b981',
  'Cancelled': '#6b7280',
};
const TX_COLORS = {
  'Purchase':   '#10b981',
  'Issue':      '#ef4444',
  'Return':     '#6366f1',
  'Damage':     '#f97316',
  'Disposal':   '#6b7280',
  'Adjustment': '#f59e0b',
};
const CAT_ICONS = {
  Furniture:'🪑',Bedding:'🛏️',Electrical:'⚡',Cleaning:'🧹',
  Safety:'🛡️',Plumbing:'🔧',Sports:'⚽',Kitchen:'🍳',Stationery:'📝',Other:'📦',
};

const fmt = n => `₹${(n||0).toLocaleString('en-IN')}`;
const fmtDate = s => s ? new Date(s).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';

const EMPTY_ITEM = { name:'',category:'',qty:'',min_qty:'5',unit:'nos',unit_price:'',vendor:'',purchase_date:'',location:'',condition_status:'Good',asset_code:'',serial_no:'',warranty_expiry:'',notes:'' };
const EMPTY_PO   = { item_name:'',category:'Other',requested_qty:'',unit_price:'',vendor:'',notes:'' };
const EMPTY_ASGN = { item_id:'',room_label:'',student_name:'',assigned_qty:'1',assigned_date:'',expected_return:'',notes:'' };

const TABS = [
  { id:'items',    label:'📦 Items' },
  { id:'tx',       label:'📋 Transactions' },
  { id:'assign',   label:'🏠 Assignments' },
  { id:'po',       label:'🛒 Purchase Orders' },
  { id:'reports',  label:'📊 Reports' },
];

export default function InventoryPage() {
  const { api } = useAuth();
  const [tab, setTab]           = useState('items');
  const [items, setItems]       = useState([]);
  const [stats, setStats]       = useState({});
  const [txs, setTxs]           = useState([]);
  const [assigns, setAssigns]   = useState([]);
  const [pos, setPos]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  // Items tab state
  const [search, setSearch]           = useState('');
  const [catFilter, setCatFilter]     = useState('');
  const [condFilter, setCondFilter]   = useState('');
  const [showItemForm, setShowItemForm] = useState(false);
  const [editItem, setEditItem]       = useState(null);
  const [showDetail, setShowDetail]   = useState(null);
  const [adjustItem, setAdjustItem]   = useState(null);
  const [adjustForm, setAdjustForm]   = useState({ change:'', direction:'+', type:'Purchase', reason:'', reference_no:'' });
  const [itemForm, setItemForm]       = useState(EMPTY_ITEM);

  // Transactions tab state
  const [txFilter, setTxFilter]       = useState({ item_id:'', type:'', from_date:'', to_date:'' });

  // Assignments tab state
  const [showAsgnForm, setShowAsgnForm] = useState(false);
  const [asgnForm, setAsgnForm]       = useState(EMPTY_ASGN);
  const [asgnStatusFilter, setAsgnStatusFilter] = useState('Active');
  const [returnModal, setReturnModal] = useState(null);
  const [returnCond, setReturnCond]   = useState('Good');

  // Purchase Orders tab state
  const [showPOForm, setShowPOForm]   = useState(false);
  const [poForm, setPoForm]           = useState(EMPTY_PO);
  const [poStatusFilter, setPoStatusFilter] = useState('');
  const [receiveModal, setReceiveModal] = useState(null);
  const [receiveQty, setReceiveQty]   = useState('');

  // Reports tab state
  const [reportDates, setReportDates] = useState({ from_date:'', to_date:'' });

  // ── Data fetching ────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    try {
      const data = await api('/api/materials_tools');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('fetchItems error:', e);
      setItems([]);
    }
  }, [api]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api('/api/materials_tools/stats');
      setStats(data || {});
    } catch (e) {
      console.error('fetchStats error:', e);
      setStats({});
    }
  }, [api]);

  const fetchTxs = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (txFilter.item_id)   q.set('item_id',   txFilter.item_id);
      if (txFilter.type)      q.set('type',       txFilter.type);
      if (txFilter.from_date) q.set('from_date',  txFilter.from_date);
      if (txFilter.to_date)   q.set('to_date',    txFilter.to_date);
      const data = await api('/api/materials_tools/transactions?' + q.toString());
      setTxs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('fetchTxs error:', e);
      setTxs([]);
    }
  }, [api, txFilter]);

  const fetchAssigns = useCallback(async () => {
    try {
      const q = asgnStatusFilter ? `?status=${asgnStatusFilter}` : '';
      const data = await api('/api/materials_tools/assignments' + q);
      setAssigns(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('fetchAssigns error:', e);
      setAssigns([]);
    }
  }, [api, asgnStatusFilter]);

  const fetchPOs = useCallback(async () => {
    try {
      const q = poStatusFilter ? `?status=${poStatusFilter}` : '';
      const data = await api('/api/purchase-orders' + q);
      setPos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('fetchPOs error:', e);
      setPos([]);
    }
  }, [api, poStatusFilter]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try { await Promise.all([fetchItems(), fetchStats()]); }
      catch(e){ console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  useEffect(() => { if (tab === 'tx')     fetchTxs();     }, [tab, txFilter]);
  useEffect(() => { if (tab === 'assign') fetchAssigns();  }, [tab, asgnStatusFilter]);
  useEffect(() => { if (tab === 'po')     fetchPOs();      }, [tab, poStatusFilter]);

  const refreshAll = () => { fetchItems(); fetchStats(); };

  // ── Items ────────────────────────────────────────────────────────────────────
  const filtered = (items || []).filter(i => {
    const mc = !catFilter  || i.category === catFilter;
    const md = !condFilter || i.condition_status === condFilter;
    const ms = !search     || i.name.toLowerCase().includes(search.toLowerCase())
                           || (i.vendor||'').toLowerCase().includes(search.toLowerCase())
                           || (i.location||'').toLowerCase().includes(search.toLowerCase())
                           || (i.asset_code||'').toLowerCase().includes(search.toLowerCase());
    return mc && md && ms;
  });
  const lowStockItems = (items || []).filter(i => i.qty <= i.min_qty);

  const openAdd = () => { setItemForm(EMPTY_ITEM); setEditItem(null); setShowItemForm(true); };
  const openEdit = item => {
    setItemForm({ name:item.name||'', category:item.category||'', qty:item.qty||'', min_qty:item.min_qty??5, unit:item.unit||'nos', unit_price:item.unit_price||'', vendor:item.vendor||'', purchase_date:item.purchase_date||'', location:item.location||'', condition_status:item.condition_status||'Good', asset_code:item.asset_code||'', serial_no:item.serial_no||'', warranty_expiry:item.warranty_expiry||'', notes:item.notes||'' });
    setEditItem(item); setShowItemForm(true); setShowDetail(null);
  };

  const handleSaveItem = async e => {
    e.preventDefault();
    if (!itemForm.name || !itemForm.category) return alert('Name and Category are required');
    setSaving(true);
    try {
      if (editItem) await api(`/api/materials_tools/${editItem.id}`, { method:'PUT', body:JSON.stringify(itemForm) });
      else          await api('/api/materials_tools',                 { method:'POST', body:JSON.stringify(itemForm) });
      setShowItemForm(false); refreshAll();
    } catch(e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleDeleteItem = async item => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try { await api(`/api/materials_tools/${item.id}`, { method:'DELETE' }); setShowDetail(null); refreshAll(); }
    catch(e) { alert('Error: ' + e.message); }
  };

  const handleAdjust = async () => {
    if (!adjustForm.change || isNaN(adjustForm.change)) return alert('Enter a valid quantity');
    const change = adjustForm.direction === '+' ? +adjustForm.change : -(+adjustForm.change);
    try {
      await api(`/api/materials_tools/${adjustItem.id}/adjust`, { method:'PATCH', body:JSON.stringify({ change, type:adjustForm.type, reason:adjustForm.reason, reference_no:adjustForm.reference_no }) });
      setAdjustItem(null); refreshAll(); fetchTxs();
    } catch(e) { alert('Error: ' + e.message); }
  };

  // ── Assignments ──────────────────────────────────────────────────────────────
  const handleAssign = async e => {
    e.preventDefault();
    if (!asgnForm.item_id || !asgnForm.assigned_qty) return alert('Item and Quantity required');
    setSaving(true);
    try {
      await api('/api/materials_tools/assign', { method:'POST', body:JSON.stringify(asgnForm) });
      setShowAsgnForm(false); setAsgnForm(EMPTY_ASGN); fetchAssigns(); refreshAll();
    } catch(e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleReturn = async () => {
    try {
      await api(`/api/materials_tools/assignments/${returnModal.id}/return`, { method:'PUT', body:JSON.stringify({ condition_on_return:returnCond }) });
      setReturnModal(null); fetchAssigns(); refreshAll();
    } catch(e) { alert('Error: ' + e.message); }
  };

  // ── Purchase Orders ──────────────────────────────────────────────────────────
  const handleCreatePO = async e => {
    e.preventDefault();
    if (!poForm.item_name || !poForm.requested_qty) return alert('Item name and quantity required');
    setSaving(true);
    try {
      const r = await api('/api/purchase-orders', { method:'POST', body:JSON.stringify(poForm) });
      alert(`PO Created: ${r.po_number}`);
      setShowPOForm(false); setPoForm(EMPTY_PO); fetchPOs();
    } catch(e) { alert('Error: ' + e.message); }
    finally { setSaving(false); }
  };

  const handlePOAction = async (po, status, extra = {}) => {
    try {
      await api(`/api/purchase-orders/${po.id}`, { method:'PUT', body:JSON.stringify({ status, ...extra }) });
      fetchPOs(); refreshAll();
    } catch(e) { alert('Error: ' + e.message); }
  };

  
  const handleBillUpload = (po, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      try {
        await api(`/api/purchase-orders/${po.id}`, { method:'PUT', body:JSON.stringify({ bill_image: base64 }) });
        alert('Bill uploaded successfully');
        fetchPOs(); refreshAll();
      } catch(err) { alert('Upload failed: ' + err.message); }
    };
    reader.readAsDataURL(file);
  };

  const handleReceive = async () => {
    if (!receiveQty || isNaN(receiveQty) || +receiveQty <= 0) return alert('Enter valid quantity');
    try {
      await api(`/api/purchase-orders/${receiveModal.id}`, { method:'PUT', body:JSON.stringify({ status:'Received', received_qty: +receiveQty }) });
      setReceiveModal(null); setReceiveQty(''); fetchPOs(); refreshAll();
    } catch(e) { alert('Error: ' + e.message); }
  };

  // ── CSV Download ─────────────────────────────────────────────────────────────
  const downloadCSV = (endpoint, filename) => {
    const token = localStorage.getItem('token');
    const q = new URLSearchParams();
    if (reportDates.from_date) q.set('from_date', reportDates.from_date);
    if (reportDates.to_date)   q.set('to_date',   reportDates.to_date);
    const url = `/api/${endpoint}?${q.toString()}`;
    fetch(url, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
      });
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="page-enter">
      {/* Header */}
      <div className="section-header">
        <div>
          <h2>📦 Materials and tools Management</h2>
          <p style={{ color:'var(--text-muted)', fontSize:13, marginTop:4 }}>
            Assets • Transactions • Assignments • Purchase Orders • Reports
          </p>
        </div>
        {tab === 'items' && <button className="btn btn-primary" onClick={openAdd}>＋ Add Item</button>}
        {tab === 'assign' && <button className="btn btn-primary" onClick={() => setShowAsgnForm(true)}>📤 Issue Item</button>}
        {tab === 'po'     && <button className="btn btn-primary" onClick={() => setShowPOForm(true)}>🛒 New PO</button>}
      </div>

      {/* Stats Row */}
      {!loading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:16 }}>
          <StatCard icon="📦" label="Total Items"     value={stats.total||0}          color="var(--primary-light)" />
          <StatCard icon="💰" label="Total Value"     value={fmt(stats.totalValue)}   color="#10b981" small />
          <StatCard icon="⚠️"  label="Low Stock"      value={stats.lowStock||0}        color="#ef4444" />
          <StatCard icon="🛒" label="Pending POs"     value={stats.pendingPOs||0}      color="#f59e0b" />
          <StatCard icon="📋" label="Transactions"    value={stats.totalTx||0}         color="#6366f1" />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'2px solid var(--border)', paddingBottom:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:'9px 18px', borderRadius:'8px 8px 0 0', border:'none', fontWeight:600, fontSize:13, cursor:'pointer', background: tab === t.id ? 'var(--primary)' : 'var(--bg-card)', color: tab === t.id ? '#fff' : 'var(--text-muted)', borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent', marginBottom:-2, transition:'all 0.2s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: ITEMS ── */}
      {tab === 'items' && (
        <>
          {lowStockItems.length > 0 && (
            <div className="card" style={{ marginBottom:16, background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.25)', padding:'14px 18px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                <span style={{ fontSize:22 }}>🚨</span>
                <div>
                  <strong style={{ color:'#ef4444' }}>{lowStockItems.length} item(s) at or below minimum stock!</strong>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                    {lowStockItems.map(i => (
                      <span key={i.id} onClick={() => setShowDetail(i)} style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:'rgba(239,68,68,0.15)', color:'#ef4444', fontWeight:600, cursor:'pointer' }}>
                        {i.name} ({i.qty}/{i.min_qty} {i.unit})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Category chips */}
          {!loading && (stats.byCategory||[]).length > 0 && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
              {(stats.byCategory||[]).map(c => (
                <div key={c.category} onClick={() => setCatFilter(catFilter === c.category ? '' : c.category)}
                  style={{ cursor:'pointer', padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:5, transition:'all 0.2s', background: catFilter===c.category ? 'var(--primary)' : 'var(--bg-card)', color: catFilter===c.category ? '#fff' : 'var(--text)', border:'1px solid var(--border)' }}>
                  {CAT_ICONS[c.category]||'📦'} {c.category} <span style={{ opacity:0.7 }}>({c.count})</span>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
            <div className="search-bar" style={{ flex:1, minWidth:200 }}>
              <span className="search-icon">🔍</span>
              <input className="form-input" placeholder="Search name, vendor, location, asset code…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-input" style={{ width:'auto', minWidth:140 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select className="form-input" style={{ width:'auto', minWidth:140 }} value={condFilter} onChange={e => setCondFilter(e.target.value)}>
              <option value="">All Conditions</option>
              {CONDITIONS.map(c => <option key={c}>{c}</option>)}
            </select>
            {(search||catFilter||condFilter) && <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setCatFilter(''); setCondFilter(''); }}>✕ Clear</button>}
          </div>

          {/* Items Table */}
          <div className="card" style={{ padding:0 }}>
            {loading ? <div className="loading"><div className="spinner"/></div>
            : filtered.length === 0 ? (
              <div style={{ padding:48, textAlign:'center' }}>
                <div style={{ fontSize:52, marginBottom:12 }}>📭</div>
                <p style={{ color:'var(--text-muted)' }}>No items found</p>
                <button className="btn btn-primary" style={{ marginTop:12 }} onClick={openAdd}>Add First Item</button>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th><th>Category</th><th>Qty / Min</th><th>Unit Price</th><th>Total Value</th>
                      <th>Vendor</th><th>Location</th><th>Condition</th><th>Asset Code</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(item => {
                      const isLow = item.qty <= item.min_qty;
                      const cond  = COND_COLORS[item.condition_status] || COND_COLORS['Good'];
                      return (
                        <tr key={item.id} style={{ cursor:'pointer' }} onClick={() => setShowDetail(item)}>
                          <td>
                            <div style={{ fontWeight:700 }}>{item.name}</div>
                            {item.serial_no && <div style={{ fontSize:10, color:'var(--text-dim)' }}>S/N: {item.serial_no}</div>}
                            {item.warranty_expiry && <div style={{ fontSize:10, color: new Date(item.warranty_expiry) < new Date() ? '#ef4444' : '#10b981' }}>Warranty: {fmtDate(item.warranty_expiry)}</div>}
                          </td>
                          <td><span style={{ fontSize:12 }}>{CAT_ICONS[item.category]||'📦'} {item.category}</span></td>
                          <td>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ fontWeight:700, fontSize:16, color:isLow?'#ef4444':'var(--text)' }}>{item.qty}</span>
                              <span style={{ fontSize:11, color:'var(--text-dim)' }}>{item.unit}</span>
                              {isLow && <span title="Below minimum!">⚠️</span>}
                            </div>
                            <div style={{ fontSize:10, color:'var(--text-dim)' }}>min: {item.min_qty}</div>
                          </td>
                          <td style={{ color:'var(--text-muted)' }}>{fmt(item.unit_price)}</td>
                          <td style={{ fontWeight:600, color:'#10b981' }}>{fmt(item.total_price)}</td>
                          <td style={{ fontSize:12, color:'var(--text-muted)' }}>{item.vendor||'—'}</td>
                          <td style={{ fontSize:12 }}>{item.location||'—'}</td>
                          <td><span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background:cond.bg, color:cond.color, fontWeight:600 }}>{item.condition_status}</span></td>
                          <td style={{ fontSize:11, color:'var(--text-dim)' }}>{item.asset_code||'—'}</td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display:'flex', gap:5 }}>
                              <button className="btn btn-sm btn-ghost" title="Adjust Qty" onClick={() => { setAdjustItem(item); setAdjustForm({ change:'', direction:'+', type:'Purchase', reason:'', reference_no:'' }); }}>±</button>
                              <button className="btn btn-sm btn-ghost" onClick={() => openEdit(item)}>✏️</button>
                              <button className="btn btn-sm" style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'none' }} onClick={() => handleDeleteItem(item)}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TAB: TRANSACTIONS ── */}
      {tab === 'tx' && (
        <>
          <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
            <select className="form-input" style={{ width:'auto', minWidth:140 }} value={txFilter.type} onChange={e => setTxFilter(f => ({ ...f, type:e.target.value }))}>
              <option value="">All Types</option>
              {TX_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <select className="form-input" style={{ width:'auto', minWidth:180 }} value={txFilter.item_id} onChange={e => setTxFilter(f => ({ ...f, item_id:e.target.value }))}>
              <option value="">All Items</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <input type="date" className="form-input" style={{ width:'auto' }} value={txFilter.from_date} onChange={e => setTxFilter(f => ({ ...f, from_date:e.target.value }))} />
            <span style={{ display:'flex', alignItems:'center', color:'var(--text-muted)', fontSize:13 }}>to</span>
            <input type="date" className="form-input" style={{ width:'auto' }} value={txFilter.to_date} onChange={e => setTxFilter(f => ({ ...f, to_date:e.target.value }))} />
            {(txFilter.type||txFilter.item_id||txFilter.from_date||txFilter.to_date) && <button className="btn btn-ghost btn-sm" onClick={() => setTxFilter({ item_id:'', type:'', from_date:'', to_date:'' })}>✕ Clear</button>}
          </div>
          <div className="card" style={{ padding:0 }}>
            {txs.length === 0 ? (
              <div style={{ padding:48, textAlign:'center' }}>
                <div style={{ fontSize:44, marginBottom:10 }}>📋</div>
                <p style={{ color:'var(--text-muted)' }}>No transactions found</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Qty Change</th><th>Reason</th><th>Reference</th><th>Done By</th></tr></thead>
                  <tbody>
                    {txs.map(t => (
                      <tr key={t.id}>
                        <td style={{ fontSize:11, color:'var(--text-dim)', whiteSpace:'nowrap' }}>{fmtDate(t.created_at)}</td>
                        <td>
                          <div style={{ fontWeight:600 }}>{t.item_name}</div>
                          <div style={{ fontSize:11, color:'var(--text-dim)' }}>{t.category}</div>
                        </td>
                        <td><span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background: `${TX_COLORS[t.type] || '#6b7280'}22`, color: TX_COLORS[t.type] || '#6b7280', fontWeight:700 }}>{t.type}</span></td>
                        <td><span style={{ fontWeight:700, fontSize:15, color: t.qty_change > 0 ? '#10b981' : '#ef4444' }}>{t.qty_change > 0 ? '+' : ''}{t.qty_change} {t.unit}</span></td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>{t.reason||'—'}</td>
                        <td style={{ fontSize:12, color:'var(--text-dim)' }}>{t.reference_no||'—'}</td>
                        <td style={{ fontSize:12 }}>{t.done_by||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TAB: ASSIGNMENTS ── */}
      {tab === 'assign' && (
        <>
          <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
            {['Active','Returned'].map(s => (
              <button key={s} className={`btn btn-sm ${asgnStatusFilter===s?'btn-primary':'btn-ghost'}`} onClick={() => setAsgnStatusFilter(s===asgnStatusFilter?'':s)}>{s}</button>
            ))}
          </div>
          <div className="card" style={{ padding:0 }}>
            {assigns.length === 0 ? (
              <div style={{ padding:48, textAlign:'center' }}>
                <div style={{ fontSize:44, marginBottom:10 }}>🏠</div>
                <p style={{ color:'var(--text-muted)' }}>No assignments found</p>
                <button className="btn btn-primary" style={{ marginTop:12 }} onClick={() => setShowAsgnForm(true)}>Issue First Item</button>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Item</th><th>Issued To</th><th>Qty</th><th>Issued Date</th><th>Expected Return</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {assigns.map(a => (
                      <tr key={a.id}>
                        <td><div style={{ fontWeight:600 }}>{a.item_name}</div><div style={{ fontSize:11, color:'var(--text-dim)' }}>{a.category}</div></td>
                        <td>
                          <div style={{ fontWeight:600 }}>{a.room_label||a.student_name||'—'}</div>
                          {a.student_name && <div style={{ fontSize:11, color:'var(--text-dim)' }}>{a.student_name}</div>}
                        </td>
                        <td><span style={{ fontWeight:700 }}>{a.assigned_qty} {a.unit}</span></td>
                        <td style={{ fontSize:11, color:'var(--text-dim)' }}>{fmtDate(a.assigned_date)}</td>
                        <td style={{ fontSize:11, color: a.expected_return && new Date(a.expected_return) < new Date() && a.status==='Active' ? '#ef4444' : 'var(--text-dim)' }}>{fmtDate(a.expected_return)}</td>
                        <td><span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background: a.status==='Active'?'rgba(99,102,241,0.12)':'rgba(16,185,129,0.12)', color: a.status==='Active'?'#6366f1':'#10b981', fontWeight:700 }}>{a.status}</span></td>
                        <td>
                          {a.status === 'Active' && (
                            <button className="btn btn-sm btn-ghost" onClick={() => { setReturnModal(a); setReturnCond('Good'); }}>🔄 Return</button>
                          )}
                          {a.condition_on_return && <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>Returned: {a.condition_on_return}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TAB: PURCHASE ORDERS ── */}
      {tab === 'po' && (
        <>
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
            <button className={`btn btn-sm ${!poStatusFilter?'btn-primary':'btn-ghost'}`} onClick={() => setPoStatusFilter('')}>All</button>
            {PO_STATUS.map(s => (
              <button key={s} className={`btn btn-sm ${poStatusFilter===s?'btn-primary':'btn-ghost'}`} onClick={() => setPoStatusFilter(s)}>{s}</button>
            ))}
          </div>
          <div style={{ display:'grid', gap:12 }}>
            {pos.length === 0 ? (
              <div className="card" style={{ padding:48, textAlign:'center' }}>
                <div style={{ fontSize:44, marginBottom:10 }}>🛒</div>
                <p style={{ color:'var(--text-muted)' }}>No purchase orders found</p>
                <button className="btn btn-primary" style={{ marginTop:12 }} onClick={() => setShowPOForm(true)}>Create First PO</button>
              </div>
            ) : pos.map(po => (
              <div key={po.id} className="card" style={{ padding:'18px 22px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                      <span style={{ fontWeight:800, fontSize:15 }}>{po.item_name}</span>
                      <span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background:`${PO_COLORS[po.status]}22`, color:PO_COLORS[po.status], fontWeight:700 }}>{po.status}</span>
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', display:'flex', flexWrap:'wrap', gap:16 }}>
                      <span>📋 {po.po_number}</span>
                      <span>🏷️ {po.category}</span>
                      <span>📦 Qty: {po.requested_qty} (received: {po.received_qty||0})</span>
                      <span>💰 {fmt(po.unit_price)}/unit = {fmt(po.total_amount)}</span>
                      {po.vendor && <span>🏪 {po.vendor}</span>}
                      <span>👤 {po.requested_by}</span>
                    </div>
                    {po.notes && <div style={{ fontSize:12, color:'var(--text-dim)', marginTop:4 }}>{po.notes}</div>}
                    {po.approved_by && <div style={{ fontSize:11, color:'#10b981', marginTop:4 }}>✅ Approved by {po.approved_by}</div>}
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {(user?.role === 'SUPER_ADMIN' || user?.role === 'HOSTEL_ADMIN') && po.status === 'Pending' && (
                      <>
                        <button className="btn btn-sm" style={{ background:'rgba(16,185,129,0.1)', color:'#10b981', border:'1px solid rgba(16,185,129,0.3)' }} onClick={() => handlePOAction(po, 'Approved', { approved_by: 'Principal' })}>✅ Approve</button>
                        <button className="btn btn-sm" style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'none' }} onClick={() => handlePOAction(po, 'Cancelled')}>✕ Reject</button>
                      </>
                    )}
                    {po.status === 'Approved' && (
                      <button className="btn btn-sm btn-ghost" onClick={() => handlePOAction(po, 'Ordered')}>📦 Mark Ordered</button>
                    )}
                    {po.status === 'Ordered' && (
                      <button className="btn btn-sm" style={{ background:'rgba(16,185,129,0.1)', color:'#10b981', border:'1px solid rgba(16,185,129,0.3)' }} onClick={() => { setReceiveModal(po); setReceiveQty(''); }}>📥 Receive Items</button>
                    )}
                    {(user?.role === 'SUPER_ADMIN' || user?.role === 'HOSTEL_ADMIN') && po.status === 'Pending' && (
                      <button className="btn btn-sm" style={{ background:'rgba(239,68,68,0.05)', color:'#ef4444', border:'none' }} onClick={() => handlePOAction(po, 'Cancelled')}>🗑️</button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:8 }}>Created: {fmtDate(po.created_at)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── TAB: REPORTS ── */}
      {tab === 'reports' && (
        <div style={{ display:'grid', gap:16 }}>
          <div className="card" style={{ padding:'20px 24px' }}>
            <h3 style={{ marginBottom:12 }}>📅 Date Range Filter</h3>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
              <div className="form-group" style={{ margin:0 }}>
                <label className="form-label">From Date</label>
                <input type="date" className="form-input" value={reportDates.from_date} onChange={e => setReportDates(d => ({ ...d, from_date:e.target.value }))} />
              </div>
              <div className="form-group" style={{ margin:0 }}>
                <label className="form-label">To Date</label>
                <input type="date" className="form-input" value={reportDates.to_date} onChange={e => setReportDates(d => ({ ...d, to_date:e.target.value }))} />
              </div>
              {(reportDates.from_date||reportDates.to_date) && <button className="btn btn-ghost btn-sm" style={{ alignSelf:'flex-end', marginBottom:2 }} onClick={() => setReportDates({ from_date:'', to_date:'' })}>✕ Clear</button>}
            </div>
          </div>

          {[
            { icon:'📦', title:'Full Inventory Report', desc:'All items with qty, price, vendor, condition, asset code, serial number', endpoint:'reports/inventory-csv', file:'inventory_report.csv', color:'#6366f1' },
            { icon:'⚠️', title:'Low Stock Report',       desc:'Items at or below minimum quantity — ready for purchase order',        endpoint:'reports/low-stock-csv',   file:'low_stock_report.csv',   color:'#ef4444' },
            { icon:'📋', title:'Transaction Log',        desc:'All stock movements — purchases, issues, returns, disposals',          endpoint:'reports/transactions-csv', file:'transactions_report.csv', color:'#10b981' },
            { icon:'🛒', title:'Purchase Orders Report', desc:'All POs with status, vendor, quantities and approval details',         endpoint:'reports/purchase-orders-csv', file:'purchase_orders_report.csv', color:'#f59e0b' },
          ].map(r => (
            <div key={r.endpoint} className="card" style={{ padding:'20px 24px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ fontSize:32 }}>{r.icon}</div>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, color:r.color }}>{r.title}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{r.desc}</div>
                  {(reportDates.from_date||reportDates.to_date) && r.endpoint.includes('transactions') && (
                    <div style={{ fontSize:11, color:'#6366f1', marginTop:2 }}>
                      📅 {reportDates.from_date||'Start'} → {reportDates.to_date||'Today'}
                    </div>
                  )}
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => downloadCSV(r.endpoint, r.file)}>
                ⬇️ Download CSV
              </button>
            </div>
          ))}

          <div className="card" style={{ padding:'18px 22px', background:'rgba(99,102,241,0.05)', border:'1px solid rgba(99,102,241,0.15)' }}>
            <div style={{ fontWeight:700, marginBottom:8 }}>💡 About CSV Reports</div>
            <ul style={{ fontSize:13, color:'var(--text-muted)', margin:0, paddingLeft:18, lineHeight:1.8 }}>
              <li>CSV files open directly in Microsoft Excel, Google Sheets, or LibreOffice Calc</li>
              <li>Inventory & Low Stock reports always include all current data (date filter ignored)</li>
              <li>Transaction & PO reports are filtered by the date range set above</li>
              <li>Files are named with the report type for easy filing</li>
            </ul>
          </div>
        </div>
      )}

      {/* ══ MODALS ══════════════════════════════════════════════════════════════ */}

      {/* Detail Drawer */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{CAT_ICONS[showDetail.category]||'📦'} {showDetail.name}</span>
              <button className="modal-close" onClick={() => setShowDetail(null)}>×</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <DetailRow label="Category"     value={`${CAT_ICONS[showDetail.category]||''} ${showDetail.category}`} />
              <DetailRow label="Condition"    value={showDetail.condition_status} />
              <DetailRow label="Quantity"     value={`${showDetail.qty} ${showDetail.unit||''}`} highlight={showDetail.qty<=showDetail.min_qty} />
              <DetailRow label="Min Quantity" value={`${showDetail.min_qty} ${showDetail.unit||''}`} />
              <DetailRow label="Unit Price"   value={fmt(showDetail.unit_price)} />
              <DetailRow label="Total Value"  value={fmt(showDetail.total_price)} />
              <DetailRow label="Vendor"       value={showDetail.vendor||'—'} />
              <DetailRow label="Location"     value={showDetail.location||'—'} />
              <DetailRow label="Asset Code"   value={showDetail.asset_code||'—'} />
              <DetailRow label="Serial No."   value={showDetail.serial_no||'—'} />
              <DetailRow label="Purchased"    value={fmtDate(showDetail.purchase_date)} />
              <DetailRow label="Warranty"     value={fmtDate(showDetail.warranty_expiry)} />
            </div>
            {showDetail.notes && <div style={{ marginTop:14, padding:'10px 12px', background:'var(--bg-input)', borderRadius:8, fontSize:13, color:'var(--text-muted)' }}><strong>Notes:</strong> {showDetail.notes}</div>}
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={() => openEdit(showDetail)}>✏️ Edit</button>
              <button className="btn btn-ghost" onClick={() => { setAdjustItem(showDetail); setAdjustForm({ change:'', direction:'+', type:'Purchase', reason:'', reference_no:'' }); setShowDetail(null); }}>± Adjust Qty</button>
              <button className="btn" style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'none' }} onClick={() => handleDeleteItem(showDetail)}>🗑️</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Item */}
      {showItemForm && (
        <div className="modal-overlay" onClick={() => setShowItemForm(false)}>
          <div className="modal" style={{ maxWidth:640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editItem ? '✏️ Edit Item' : '＋ Add Inventory Item'}</span>
              <button className="modal-close" onClick={() => setShowItemForm(false)}>×</button>
            </div>
            <form onSubmit={handleSaveItem}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group" style={{ gridColumn:'1 / -1' }}>
                  <label className="form-label">Item Name *</label>
                  <input className="form-input" required value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name:e.target.value }))} placeholder="e.g. Steel Cot, Ceiling Fan" />
                </div>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select className="form-input" required value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category:e.target.value }))}>
                    <option value="">-- Select --</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Condition</label>
                  <select className="form-input" value={itemForm.condition_status} onChange={e => setItemForm(f => ({ ...f, condition_status:e.target.value }))}>
                    {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input className="form-input" type="number" min="0" value={itemForm.qty} onChange={e => setItemForm(f => ({ ...f, qty:e.target.value }))} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Min Qty (Alert Threshold)</label>
                  <input className="form-input" type="number" min="0" value={itemForm.min_qty} onChange={e => setItemForm(f => ({ ...f, min_qty:e.target.value }))} placeholder="5" />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select className="form-input" value={itemForm.unit} onChange={e => setItemForm(f => ({ ...f, unit:e.target.value }))}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Price (₹)</label>
                  <input className="form-input" type="number" min="0" value={itemForm.unit_price} onChange={e => setItemForm(f => ({ ...f, unit_price:e.target.value }))} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Asset Code</label>
                  <input className="form-input" value={itemForm.asset_code} onChange={e => setItemForm(f => ({ ...f, asset_code:e.target.value }))} placeholder="e.g. JKKM-FURN-001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Serial Number</label>
                  <input className="form-input" value={itemForm.serial_no} onChange={e => setItemForm(f => ({ ...f, serial_no:e.target.value }))} placeholder="Manufacturer serial no." />
                </div>
                <div className="form-group" style={{ gridColumn:'1 / -1' }}>
                  <label className="form-label">Vendor / Supplier</label>
                  <input className="form-input" value={itemForm.vendor} onChange={e => setItemForm(f => ({ ...f, vendor:e.target.value }))} placeholder="e.g. Sri Velmurugan Furniture" />
                </div>
                <div className="form-group">
                  <label className="form-label">Purchase Date</label>
                  <input type="date" className="form-input" value={itemForm.purchase_date} onChange={e => setItemForm(f => ({ ...f, purchase_date:e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Warranty Expiry</label>
                  <input type="date" className="form-input" value={itemForm.warranty_expiry} onChange={e => setItemForm(f => ({ ...f, warranty_expiry:e.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn:'1 / -1' }}>
                  <label className="form-label">Location / Block</label>
                  <input className="form-input" value={itemForm.location} onChange={e => setItemForm(f => ({ ...f, location:e.target.value }))} placeholder="e.g. Boys Block A, Room 101, Common Area" />
                </div>
                <div className="form-group" style={{ gridColumn:'1 / -1' }}>
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" rows={2} value={itemForm.notes} onChange={e => setItemForm(f => ({ ...f, notes:e.target.value }))} placeholder="Any additional notes…" />
                </div>
              </div>
              {itemForm.qty && itemForm.unit_price && (
                <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', fontSize:13, marginBottom:8 }}>
                  💰 <strong>Total Value: {fmt(+itemForm.qty * +itemForm.unit_price)}</strong>
                </div>
              )}
              {(itemForm.condition_status === 'Poor' || itemForm.condition_status === 'Under Repair') && (
                <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.25)', fontSize:13, marginBottom:8 }}>
                  ⚠️ <strong>A maintenance request will be auto-created</strong> for this item.
                </div>
              )}
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button type="submit" className="btn btn-primary" style={{ flex:1 }} disabled={saving}>
                  {saving ? '⏳ Saving…' : editItem ? '💾 Update Item' : '＋ Add Item'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowItemForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quantity Adjust */}
      {adjustItem && (
        <div className="modal-overlay" onClick={() => setAdjustItem(null)}>
          <div className="modal" style={{ maxWidth:420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">± Stock Adjustment</span>
              <button className="modal-close" onClick={() => setAdjustItem(null)}>×</button>
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontWeight:700, fontSize:15 }}>{adjustItem.name}</div>
              <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>Current Stock: <strong>{adjustItem.qty} {adjustItem.unit}</strong></div>
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              {['+','-'].map(d => (
                <button key={d} className={`btn ${adjustForm.direction===d?'btn-primary':'btn-ghost'}`} style={{ flex:1, fontSize:20 }} onClick={() => setAdjustForm(f => ({ ...f, direction:d, type: d==='+'?'Purchase':'Issue' }))}>
                  {d === '+' ? '📥 Add Stock' : '📤 Remove Stock'}
                </button>
              ))}
            </div>
            <div className="form-group">
              <label className="form-label">Transaction Type</label>
              <select className="form-input" value={adjustForm.type} onChange={e => setAdjustForm(f => ({ ...f, type:e.target.value }))}>
                {TX_TYPES.filter(t => adjustForm.direction==='+' ? ['Purchase','Return','Adjustment'].includes(t) : ['Issue','Damage','Disposal','Adjustment'].includes(t)).map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity to {adjustForm.direction==='+'?'Add':'Remove'}</label>
              <input className="form-input" type="number" min="1" value={adjustForm.change} onChange={e => setAdjustForm(f => ({ ...f, change:e.target.value }))} placeholder="Enter amount" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Reason *</label>
              <input className="form-input" value={adjustForm.reason} onChange={e => setAdjustForm(f => ({ ...f, reason:e.target.value }))} placeholder="e.g. Received from vendor, Issued to Room 101" />
            </div>
            <div className="form-group">
              <label className="form-label">Reference No. (optional)</label>
              <input className="form-input" value={adjustForm.reference_no} onChange={e => setAdjustForm(f => ({ ...f, reference_no:e.target.value }))} placeholder="e.g. Invoice no., PO number" />
            </div>
            {adjustForm.change && (
              <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:10 }}>
                New stock will be: <strong style={{ color:'var(--primary-light)' }}>{Math.max(0, adjustItem.qty + (adjustForm.direction==='+'?+adjustForm.change:-+adjustForm.change))} {adjustItem.unit}</strong>
              </div>
            )}
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={handleAdjust}>✅ Confirm</button>
              <button className="btn btn-ghost" onClick={() => setAdjustItem(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Item (Assignment) Form */}
      {showAsgnForm && (
        <div className="modal-overlay" onClick={() => setShowAsgnForm(false)}>
          <div className="modal" style={{ maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">📤 Issue Item</span>
              <button className="modal-close" onClick={() => setShowAsgnForm(false)}>×</button>
            </div>
            <form onSubmit={handleAssign}>
              <div className="form-group">
                <label className="form-label">Select Item *</label>
                <select className="form-input" required value={asgnForm.item_id} onChange={e => setAsgnForm(f => ({ ...f, item_id:e.target.value }))}>
                  <option value="">-- Choose Item --</option>
                  {items.filter(i => i.qty > 0).map(i => <option key={i.id} value={i.id}>{i.name} (Available: {i.qty} {i.unit})</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label className="form-label">Room / Location</label>
                  <input className="form-input" value={asgnForm.room_label} onChange={e => setAsgnForm(f => ({ ...f, room_label:e.target.value }))} placeholder="e.g. Room 101, Block A" />
                </div>
                <div className="form-group">
                  <label className="form-label">Student Name (if applicable)</label>
                  <input className="form-input" value={asgnForm.student_name} onChange={e => setAsgnForm(f => ({ ...f, student_name:e.target.value }))} placeholder="Student name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input className="form-input" type="number" min="1" required value={asgnForm.assigned_qty} onChange={e => setAsgnForm(f => ({ ...f, assigned_qty:e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Issue Date</label>
                  <input type="date" className="form-input" value={asgnForm.assigned_date} onChange={e => setAsgnForm(f => ({ ...f, assigned_date:e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Expected Return Date</label>
                  <input type="date" className="form-input" value={asgnForm.expected_return} onChange={e => setAsgnForm(f => ({ ...f, expected_return:e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-input" value={asgnForm.notes} onChange={e => setAsgnForm(f => ({ ...f, notes:e.target.value }))} placeholder="Any remarks..." />
              </div>
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button type="submit" className="btn btn-primary" style={{ flex:1 }} disabled={saving}>{saving?'⏳ Issuing…':'📤 Issue Item'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAsgnForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Item Modal */}
      {returnModal && (
        <div className="modal-overlay" onClick={() => setReturnModal(null)}>
          <div className="modal" style={{ maxWidth:380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">🔄 Return Item</span>
              <button className="modal-close" onClick={() => setReturnModal(null)}>×</button>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontWeight:700 }}>{returnModal.item_name}</div>
              <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>Issued to: <strong>{returnModal.room_label||returnModal.student_name}</strong></div>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>Qty: <strong>{returnModal.assigned_qty} {returnModal.unit}</strong></div>
            </div>
            <div className="form-group">
              <label className="form-label">Condition on Return</label>
              <select className="form-input" value={returnCond} onChange={e => setReturnCond(e.target.value)}>
                {CONDITIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={handleReturn}>✅ Confirm Return</button>
              <button className="btn btn-ghost" onClick={() => setReturnModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* New Purchase Order Form */}
      {showPOForm && (
        <div className="modal-overlay" onClick={() => setShowPOForm(false)}>
          <div className="modal" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">🛒 Create Purchase Order</span>
              <button className="modal-close" onClick={() => setShowPOForm(false)}>×</button>
            </div>
            <form onSubmit={handleCreatePO}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group" style={{ gridColumn:'1 / -1' }}>
                  <label className="form-label">Item Name *</label>
                  <input className="form-input" required value={poForm.item_name} onChange={e => setPoForm(f => ({ ...f, item_name:e.target.value }))} placeholder="e.g. Steel Cot, Tube Light 36W" />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" value={poForm.category} onChange={e => setPoForm(f => ({ ...f, category:e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input className="form-input" type="number" min="1" required value={poForm.requested_qty} onChange={e => setPoForm(f => ({ ...f, requested_qty:e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Est. Unit Price (₹)</label>
                  <input className="form-input" type="number" min="0" value={poForm.unit_price} onChange={e => setPoForm(f => ({ ...f, unit_price:e.target.value }))} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Vendor / Supplier</label>
                  <input className="form-input" value={poForm.vendor} onChange={e => setPoForm(f => ({ ...f, vendor:e.target.value }))} placeholder="Vendor name" />
                </div>
                <div className="form-group" style={{ gridColumn:'1 / -1' }}>
                  <label className="form-label">Notes / Justification</label>
                  <textarea className="form-input" rows={2} value={poForm.notes} onChange={e => setPoForm(f => ({ ...f, notes:e.target.value }))} placeholder="Why is this needed? Any specific requirements?" />
                </div>
              </div>
              {poForm.requested_qty && poForm.unit_price && (
                <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', fontSize:13, marginBottom:8 }}>
                  💰 <strong>Estimated Total: {fmt(+poForm.requested_qty * +poForm.unit_price)}</strong>
                </div>
              )}
              <div style={{ display:'flex', gap:10, marginTop:16 }}>
                <button type="submit" className="btn btn-primary" style={{ flex:1 }} disabled={saving}>{saving?'⏳ Creating…':'🛒 Submit PO'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowPOForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Items Modal */}
      {receiveModal && (
        <div className="modal-overlay" onClick={() => setReceiveModal(null)}>
          <div className="modal" style={{ maxWidth:380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">📥 Receive Items</span>
              <button className="modal-close" onClick={() => setReceiveModal(null)}>×</button>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontWeight:700 }}>{receiveModal.item_name}</div>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>PO: {receiveModal.po_number} | Ordered: {receiveModal.requested_qty} nos</div>
              {receiveModal.vendor && <div style={{ fontSize:13, color:'var(--text-muted)' }}>Vendor: {receiveModal.vendor}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Quantity Received *</label>
              <input className="form-input" type="number" min="1" max={receiveModal.requested_qty} value={receiveQty} onChange={e => setReceiveQty(e.target.value)} placeholder={`Max: ${receiveModal.requested_qty}`} autoFocus />
            </div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12 }}>Items will be automatically added to inventory stock.</div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={handleReceive}>✅ Confirm Receipt</button>
              <button className="btn btn-ghost" onClick={() => setReceiveModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, small }) {
  return (
    <div className="card" style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
      <div style={{ fontSize:26 }}>{icon}</div>
      <div>
        <div style={{ fontSize:small?14:24, fontWeight:800, color, lineHeight:1.1 }}>{value}</div>
        <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', marginTop:2 }}>{label}</div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, highlight }) {
  return (
    <div>
      <div style={{ fontSize:10, color:'var(--text-dim)', fontWeight:700, textTransform:'uppercase', marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:600, color:highlight?'#ef4444':'var(--text)' }}>{value}</div>
    </div>
  );
}
