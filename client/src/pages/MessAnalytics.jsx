import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

export default function MessAnalytics() {
  const { user, api } = useAuth();
  
  const [dateRange, setDateRange] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [todayData, setTodayData] = useState(null);
  const [consumption, setConsumption] = useState([]);
  const [trends, setTrends] = useState([]);
  const [stockStatus, setStockStatus] = useState([]);
  const [insights, setInsights] = useState([]);

  // Daily Mess Entry Modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [logForm, setLogForm] = useState({
    date: new Date().toISOString().split('T')[0],
    prepared_qty: '',
    consumed_qty: '',
    wasted_qty: '',
    unit: 'kg',
    reason: ''
  });

  const isFoodAdmin = ['SUPER_ADMIN', 'FOOD_ADMIN', 'HOSTEL_ADMIN', 'PRINCIPAL'].includes(user?.role);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      let start = '', end = '';
      const today = new Date().toISOString().split('T')[0];
      
      if (dateRange === 'today') {
        start = today;
        end = today;
      } else if (dateRange === 'week') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        start = d.toISOString().split('T')[0];
        end = today;
      } else if (dateRange === 'month') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        start = d.toISOString().split('T')[0];
        end = today;
      } else {
        start = customStart;
        end = customEnd;
      }
      
      if (dateRange !== 'custom' || !end) end = today;
      
      const pToday = api(`/api/mess_analytics/today?date=${end}`);
      const pCons = api(`/api/mess_analytics/consumption?startDate=${start}&endDate=${end}`);
      const pTrends = api(`/api/mess_analytics/trends?days=${dateRange === 'month' ? 30 : 7}`);
      const pStock = api(`/api/mess_analytics/stock-status`);
      const pInsights = api(`/api/mess_analytics/insights`);
      
      const [td, cs, tr, st, inS] = await Promise.all([pToday, pCons, pTrends, pStock, pInsights]);
      
      setTodayData(td);
      setConsumption(cs);
      setTrends(tr);
      setStockStatus(st);
      setInsights(inS);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openLogModal = async () => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const data = await api(`/api/mess_analytics/daily_log?date=${today}`);
      setLogForm({
        date: today,
        prepared_qty: data.prepared_qty || '',
        consumed_qty: data.consumed_qty || '',
        wasted_qty: data.wasted_qty || '',
        unit: data.unit || 'kg',
        reason: data.reason || ''
      });
    } catch (e) {
      console.error(e);
    }
    setShowLogModal(true);
  };

  const handleSaveLog = async (e) => {
    e.preventDefault();
    setSavingLog(true);
    try {
      await api('/api/mess_analytics/daily_log', {
        method: 'POST',
        body: JSON.stringify(logForm)
      });
      setShowLogModal(false);
      fetchData();
    } catch (err) {
      alert('Error saving daily log: ' + err.message);
    } finally {
      setSavingLog(false);
    }
  };

  useEffect(() => {
    if (dateRange !== 'custom' || (customStart && customEnd)) {
      fetchData();
    }
  }, [dateRange, customStart, customEnd]);

  if (loading && !todayData) return <div className="p-4">Loading analytics...</div>;
  if (error) return <div className="p-4 text-danger">Error: {error} <button className="btn btn-sm btn-primary ml-2" onClick={fetchData}>Retry</button></div>;

  const pieData = todayData ? [
    { name: 'Consumed', value: todayData.consumedQuantity },
    { name: 'Wasted', value: todayData.wastedQuantity }
  ] : [];

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div>
          <h1 className="page-title">📊 Mess Analytics</h1>
          <p className="page-subtitle">Track consumption, wastage, and costs</p>
        </div>
        
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {isFoodAdmin && (
            <button className="btn btn-primary" onClick={openLogModal} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              📝 Record Food Prep &amp; Wastage
            </button>
          )}

          <select className="form-input" value={dateRange} onChange={e => setDateRange(e.target.value)} style={{ width: 'auto' }}>
            <option value="today">Today</option>
            <option value="week">This Week (7 days)</option>
            <option value="month">This Month (30 days)</option>
            <option value="custom">Custom Range</option>
          </select>
          
          {dateRange === 'custom' && (
            <>
              <input type="date" className="form-input" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span>to</span>
              <input type="date" className="form-input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </>
          )}
        </div>
      </div>

      {todayData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Students Served (Hostel Total)</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{todayData.studentsServed.toLocaleString()}</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Meals Served (3 Meals/Day)</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{todayData.mealsServed.toLocaleString()}</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Food Cost</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>₹{todayData.totalFoodCost.toLocaleString()}</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cost / Student</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>₹{todayData.costPerStudent}</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cost / Meal</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>₹{todayData.costPerMeal}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 20 }}>
        
        {/* CONSUMPTION BAR CHART */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 16 }}>Ingredient Consumption</h3>
          {consumption.length > 0 ? (
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <BarChart data={consumption} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="itemName" type="category" width={80} fontSize={12} />
                  <RechartsTooltip formatter={(value, name, props) => [`${value} ${props.payload.unit}`, 'Qty']} />
                  <Bar dataKey="quantity" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No consumption data available for selected period.</p>
          )}
        </div>

        {/* FOOD WASTAGE */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 16 }}>Food Wastage (Selected Date)</h3>
          {todayData && todayData.preparedQuantity > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, height: 200 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      <Cell fill="#10b981" />
                      <Cell fill="#f43f5e" />
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Prepared</div>
                  <div style={{ fontWeight: 600 }}>{todayData.preparedQuantity} kg</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Consumed</div>
                  <div style={{ fontWeight: 600, color: '#10b981' }}>{todayData.consumedQuantity} kg</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Wasted</div>
                  <div style={{ fontWeight: 600, color: '#f43f5e' }}>{todayData.wastedQuantity} kg</div>
                </div>
                <div style={{ marginTop: 16, padding: '8px 12px', background: 'rgba(244,63,94,0.1)', borderRadius: 8, color: '#f43f5e', fontWeight: 700 }}>
                  Wastage Rate: {todayData.wastagePercentage}%
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No wastage records available.</p>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 20 }}>
        {/* TRENDS */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 16 }}>7-Day Trend</h3>
          {trends.length > 0 ? (
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <LineChart data={trends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={d => d.substring(5)} fontSize={12} />
                  <YAxis yAxisId="left" fontSize={12} width={50} />
                  <YAxis yAxisId="right" orientation="right" fontSize={12} width={40} />
                  <RechartsTooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="foodCost" name="Cost (₹)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="wastagePercentage" name="Wastage %" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No trend data available.</p>
          )}
        </div>

        {/* INSIGHTS & STOCK */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div className="card" style={{ padding: 20, flex: 1 }}>
            <h3 style={{ marginBottom: 16 }}>💡 Smart Mess Insights</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {insights.map((ins, idx) => (
                <li key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: ins.startsWith('⚠') ? '#f59e0b' : '#10b981', fontWeight: 'bold' }}>{ins.charAt(0)}</span>
                  <span style={{ fontSize: 14 }}>{ins.substring(1).trim()}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card" style={{ padding: 20, flex: 1 }}>
            <h3 style={{ marginBottom: 16 }}>Current Stock Status</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stockStatus.slice(0,4).map((s, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.itemName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.currentStock} {s.unit}</div>
                  </div>
                  <span className={`badge ${s.status === 'NORMAL' ? 'badge-success' : s.status === 'LOW' ? 'badge-warning' : 'badge-danger'}`}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>

      {/* ════ RECORD DAILY FOOD PREPARATION MODAL ════ */}
      {showLogModal && (
        <div className="modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">📝 Record Daily Food Preparation &amp; Wastage</span>
              <button className="modal-close" onClick={() => setShowLogModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveLog}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-input" required value={logForm.date} onChange={e => setLogForm(f => ({ ...f, date: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label className="form-label">Total Prepared (kg)</label>
                  <input type="number" step="0.1" className="form-input" value={logForm.prepared_qty} onChange={e => setLogForm(f => ({ ...f, prepared_qty: e.target.value }))} placeholder="e.g. 850" />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Wasted (kg)</label>
                  <input type="number" step="0.1" className="form-input" value={logForm.wasted_qty} onChange={e => setLogForm(f => ({ ...f, wasted_qty: e.target.value }))} placeholder="e.g. 15" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Consumed Quantity (kg)</label>
                  <input type="number" step="0.1" className="form-input" value={logForm.consumed_qty} onChange={e => setLogForm(f => ({ ...f, consumed_qty: e.target.value }))} placeholder="Auto-calculated if blank (Prepared - Wasted)" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Wastage Reason / Notes</label>
                  <input className="form-input" value={logForm.reason} onChange={e => setLogForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Excess curry / leftover rice" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={savingLog}>
                  {savingLog ? 'Saving...' : '✅ Save Daily Record'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowLogModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
