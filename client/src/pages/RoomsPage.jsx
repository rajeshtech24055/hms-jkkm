import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function RoomsPage() {
  const { api, user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterBlock, setFilterBlock] = useState('ALL');
  const [filterGender, setFilterGender] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomStudents, setRoomStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [institutions, setInstitutions] = useState([]);
  const defaultForm = { room_no: '', block: '', floor: 1, capacity: 4, gender: 'Male', institution_id: '' };
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const canManage = ['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(user?.role);

  useEffect(() => {
    fetchRooms();
    api('/api/institutions').then(setInstitutions).catch(() => {});
  }, []);

  const fetchRooms = async () => {
    setLoading(true);
    try { const data = await api('/api/rooms'); setRooms(data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleRoomClick = async (room) => {
    setSelectedRoom(room); setLoadingStudents(true); setRoomStudents([]);
    try { const students = await api(`/api/rooms/${room.id}/students`); setRoomStudents(students); }
    catch (err) { console.error(err); }
    finally { setLoadingStudents(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.room_no || !form.block || !form.gender) return alert('Room No, Block and Gender are required.');
    setSaving(true);
    try {
      const url = editId ? `/api/rooms/${editId}` : '/api/rooms';
      const method = editId ? 'PUT' : 'POST';
      const payload = {
        ...form,
        floor: parseInt(form.floor) || 1,
        capacity: parseInt(form.capacity) || 4,
        institution_id: parseInt(form.institution_id)
      };
      if (isNaN(payload.institution_id)) {
        alert("Please select a valid institution.");
        setSaving(false);
        return;
      }
      await api(url, { method, body: JSON.stringify(payload) });
      setShowAddModal(false);
      setEditId(null);
      setForm(defaultForm);
      fetchRooms();
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  };

  const openEdit = (e, room) => {
    e.stopPropagation();
    setForm({
      room_no: room.room_no || '',
      block: room.block || '',
      floor: room.floor || 1,
      capacity: room.capacity || 4,
      gender: room.gender || 'Male',
      institution_id: room.institution_id || ''
    });
    setEditId(room.id);
    setShowAddModal(true);
  };
  const handleDeleteRoom = async (id, room_no) => {
    if (!window.confirm(`Delete Room ${room_no}? Students in this room will be unassigned.`)) return;
    try { await api(`/api/rooms/${id}`, { method: 'DELETE' }); fetchRooms(); }
    catch (err) { alert('Error: ' + err.message); }
  };

  const blocks = ['ALL', ...new Set(rooms.map(r => r.block).filter(Boolean))];
  const filteredRooms = rooms.filter(r => {
    if (filterBlock !== 'ALL' && r.block !== filterBlock) return false;
    if (filterGender !== 'ALL' && r.gender !== filterGender) return false;
    if (filterStatus === 'FULL' && r.occupied < r.capacity) return false;
    if (filterStatus === 'OPEN' && r.occupied >= r.capacity) return false;
    if (filterStatus === 'EMPTY' && r.occupied > 0) return false;
    return true;
  });

  const totalBeds = rooms.reduce((a, r) => a + r.capacity, 0);
  const occupiedBeds = rooms.reduce((a, r) => a + r.occupied, 0);
  const boysRooms = rooms.filter(r => r.gender === 'Male');
  const girlsRooms = rooms.filter(r => r.gender === 'Female');

  const getColor = (room) => {
    const pct = room.occupied / room.capacity;
    if (pct === 0) return '#10b981';
    if (pct < 0.5) return '#6366f1';
    if (pct < 1) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="page-enter">
      <div className="section-header">
        <div>
          <h2>🏠 Room Management</h2>
          <p style={{ color:'var(--text-muted)', fontSize:13, marginTop:4 }}>Manage hostel rooms, view occupancy and student allocations</p>
        </div>
        {canManage && <button className="btn btn-primary" onClick={() => { setForm(defaultForm); setEditId(null); setShowAddModal(true); }}>+ Add Room</button>}
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:14, marginBottom:24 }}>
        {[
          { label:'Total Rooms', value:rooms.length, icon:'🏠', color:'#6366f1' },
          { label:'Total Beds', value:totalBeds, icon:'🛏️', color:'#0ea5e9' },
          { label:'Occupied', value:occupiedBeds, icon:'👤', color:'#f59e0b' },
          { label:'Available', value:totalBeds - occupiedBeds, icon:'✅', color:'#10b981' },
          { label:'Boys Rooms', value:boysRooms.length, icon:'♂', color:'#6366f1' },
          { label:'Girls Rooms', value:girlsRooms.length, icon:'♀', color:'#ec4899' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding:'16px 20px', textAlign:'center' }}>
            <div style={{ fontSize:24, marginBottom:6 }}>{s.icon}</div>
            <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Occupancy Bar */}
      {totalBeds > 0 && (
        <div className="card" style={{ padding:'16px 20px', marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13 }}>
            <span style={{ fontWeight:600 }}>Overall Occupancy</span>
            <span style={{ color:'var(--text-muted)' }}>{occupiedBeds} / {totalBeds} beds ({Math.round(occupiedBeds/totalBeds*100)}%)</span>
          </div>
          <div style={{ background:'var(--surface-2)', borderRadius:8, height:10, overflow:'hidden' }}>
            <div style={{ width:`${Math.round(occupiedBeds/totalBeds*100)}%`, height:'100%', background:'linear-gradient(90deg,#6366f1,#0ea5e9)', borderRadius:8 }} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <select style={{ padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-input)', color:'var(--text)', fontSize:13 }} value={filterBlock} onChange={e => setFilterBlock(e.target.value)}>
          {blocks.map(b => <option key={b} value={b}>{b === 'ALL' ? 'All Blocks' : `Block ${b}`}</option>)}
        </select>
        <select style={{ padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-input)', color:'var(--text)', fontSize:13 }} value={filterGender} onChange={e => setFilterGender(e.target.value)}>
          <option value="ALL">Both Hostels</option>
          <option value="Male">♂ Boys Hostel</option>
          <option value="Female">♀ Girls Hostel</option>
        </select>
        <select style={{ padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-input)', color:'var(--text)', fontSize:13 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="ALL">All Status</option>
          <option value="OPEN">🟢 Has Space</option>
          <option value="FULL">🔴 Full</option>
          <option value="EMPTY">⚪ Empty</option>
        </select>
        <span style={{ marginLeft:'auto', fontSize:13, color:'var(--text-muted)' }}>Showing {filteredRooms.length} of {rooms.length} rooms</span>
        <button className="btn btn-sm" style={{ background:'var(--surface-2)' }} onClick={fetchRooms}>🔄 Refresh</button>
      </div>

      {/* Rooms Grid */}
      {loading ? <div className="loading"><div className="spinner" /></div>
      : filteredRooms.length === 0 ? (
        <div className="card" style={{ padding:60, textAlign:'center' }}>
          <div style={{ fontSize:56, marginBottom:16 }}>🏠</div>
          <h3>No Rooms Found</h3>
          <p style={{ color:'var(--text-muted)', marginTop:8 }}>{rooms.length === 0 ? 'Click "+ Add Room" to create your first room.' : 'No rooms match the selected filters.'}</p>
          {canManage && rooms.length === 0 && <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => setShowAddModal(true)}>+ Add First Room</button>}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(190px, 1fr))', gap:14 }}>
          {filteredRooms.map(room => {
            const pct = room.capacity > 0 ? room.occupied/room.capacity : 0;
            const color = getColor(room);
            const isFull = room.occupied >= room.capacity;
            const isEmpty = room.occupied === 0;
            return (
              <div key={room.id} onClick={() => handleRoomClick(room)}
                style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 18px', cursor:'pointer', transition:'all 0.2s', borderTop:`3px solid ${color}` }}
                onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform=''}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize:18, fontWeight:800 }}>Room {room.room_no}</div>
                      {canManage && <button className="btn btn-sm btn-ghost" style={{ padding: '2px 4px', fontSize: 10 }} onClick={(e) => openEdit(e, room)}>✏️ Edit</button>}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Block {room.block} · Floor {room.floor || 1}</div>
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20, background:isFull?'rgba(239,68,68,0.12)':isEmpty?'rgba(16,185,129,0.12)':'rgba(99,102,241,0.12)', color:isFull?'#ef4444':isEmpty?'#10b981':'#6366f1' }}>
                    {isFull ? 'FULL' : isEmpty ? 'EMPTY' : 'OPEN'}
                  </span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <span style={{ fontSize:13, color:room.gender==='Male'?'#6366f1':'#ec4899', fontWeight:600 }}>{room.gender==='Male'?'♂ Boys':'♀ Girls'}</span>
                  <span style={{ fontSize:13, fontWeight:700, color }}>{room.occupied}/{room.capacity}</span>
                </div>
                <div style={{ background:'var(--surface-2)', borderRadius:4, height:6, overflow:'hidden', marginBottom:10 }}>
                  <div style={{ width:`${pct*100}%`, height:'100%', background:color, borderRadius:4 }} />
                </div>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {Array.from({ length:room.capacity }).map((_,i) => (
                    <div key={i} style={{ width:14, height:14, borderRadius:3, background:i<room.occupied?color:'var(--surface-2)', border:`1px solid ${i<room.occupied?color:'var(--border)'}` }} />
                  ))}
                </div>
                {room.institution_code && <div style={{ marginTop:10, fontSize:11, color:'var(--text-dim)' }}>🏛 {room.institution_code}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT ROOM MODAL */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); setEditId(null); }}>
          <div className="modal" style={{ maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editId ? '✏️ Edit Room' : '🏠 Add New Room'}</span>
              <button className="modal-close" onClick={() => { setShowAddModal(false); setEditId(null); }}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding:'20px 24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">Institution *</label>
                <select className="form-input" value={form.institution_id} onChange={e => setForm(f => ({ ...f, institution_id:e.target.value }))} required>
                  <option value="">Select Institution</option>
                  {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Room Number *</label>
                <input className="form-input" placeholder="e.g. 101" value={form.room_no} onChange={e => setForm(f => ({ ...f, room_no:e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Block *</label>
                <input className="form-input" placeholder="e.g. A" value={form.block} onChange={e => setForm(f => ({ ...f, block:e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Floor *</label>
                <input type="number" className="form-input" min="1" max="20" required value={form.floor} onChange={e => setForm(f => ({ ...f, floor:e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Capacity (Beds) *</label>
                <input type="number" className="form-input" min="1" max="10" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity:e.target.value }))} required />
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">Hostel Type *</label>
                <div style={{ display:'flex', gap:10 }}>
                  {['Male','Female'].map(g => (
                    <label key={g} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 0', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:14, border:`2px solid ${form.gender===g?(g==='Male'?'#6366f1':'#ec4899'):'var(--border)'}`, background:form.gender===g?(g==='Male'?'rgba(99,102,241,0.1)':'rgba(236,72,153,0.1)'):'var(--bg-input)', color:form.gender===g?(g==='Male'?'#6366f1':'#ec4899'):'var(--text-muted)' }}>
                      <input type="radio" name="gender" value={g} checked={form.gender===g} onChange={() => setForm(f => ({ ...f, gender:g }))} style={{ display:'none' }} />
                      {g==='Male'?'♂ Boys Hostel':'♀ Girls Hostel'}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn:'1/-1', display:'flex', gap:10, marginTop:8 }}>
                <button type="submit" className="btn btn-primary" style={{ flex:1 }} disabled={saving}>{saving?'Saving...': (editId ? '💾 Save Changes' : '✅ Create Room')}</button>
                <button type="button" className="btn btn-ghost" onClick={() => { setShowAddModal(false); setEditId(null); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ROOM DETAIL MODAL */}
      {selectedRoom && (
        <div className="modal-overlay" onClick={() => setSelectedRoom(null)}>
          <div className="modal" style={{ maxWidth:540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">🛏️ Room {selectedRoom.room_no} — Block {selectedRoom.block}</span>
              <button className="modal-close" onClick={() => setSelectedRoom(null)}>×</button>
            </div>
            <div style={{ padding:'0 24px 24px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginTop:16, marginBottom:20 }}>
                {[
                  { label:'Hostel', value:selectedRoom.gender==='Male'?'♂ Boys':'♀ Girls', color:selectedRoom.gender==='Male'?'#6366f1':'#ec4899' },
                  { label:'Floor', value:selectedRoom.floor||1 },
                  { label:'Capacity', value:selectedRoom.capacity },
                  { label:'Occupied', value:selectedRoom.occupied },
                ].map(s => (
                  <div key={s.label} style={{ background:'var(--surface-2)', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
                    <div style={{ fontSize:16, fontWeight:800, color:s.color||'var(--text)' }}>{s.value}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text-muted)', marginBottom:10 }}>BED ALLOCATION</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
                {Array.from({ length:selectedRoom.capacity }).map((_,i) => {
                  const student = roomStudents[i];
                  return (
                    <div key={i} style={{ padding:'12px 14px', borderRadius:10, border:`1px solid ${student?'#6366f133':'var(--border)'}`, background:student?'rgba(99,102,241,0.05)':'var(--surface-2)' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--text-dim)', marginBottom:8, letterSpacing:'0.08em' }}>BED {i+1}</div>
                      {loadingStudents ? <div className="spinner" style={{ width:16, height:16, borderWidth:2 }} />
                      : student ? (
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:36, height:36, borderRadius:'50%', background:'#6366f1', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', flexShrink:0 }}>{student.name[0].toUpperCase()}</div>
                          <div>
                            <div style={{ fontSize:13, fontWeight:600 }}>{student.name}</div>
                            <div style={{ fontSize:11, color:'var(--text-dim)' }}>{student.reg_no}</div>
                            <div style={{ fontSize:10, color:'var(--text-dim)' }}>{student.dept_name} • {student.year}</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display:'flex', alignItems:'center', gap:8, color:'#10b981', fontSize:13, fontWeight:600 }}>
                          <div style={{ width:36, height:36, borderRadius:'50%', border:'2px dashed #10b981', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>+</div>
                          Available
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {canManage && (
                <div style={{ marginTop:20, display:'flex', gap:10 }}>
                  <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={() => setSelectedRoom(null)}>Close</button>
                  <button className="btn btn-danger btn-sm" onClick={() => { handleDeleteRoom(selectedRoom.id, selectedRoom.room_no); setSelectedRoom(null); }}>🗑️ Delete Room</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
