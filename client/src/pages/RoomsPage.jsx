import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

export default function RoomsPage() {
  const { api, user } = useAuth();

  const [hostels, setHostels]         = useState([]);
  const [rooms, setRooms]             = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading]         = useState(true);

  // Navigation
  const [selectedHostel, setSelectedHostel] = useState(null);
  const [selectedBlock, setSelectedBlock]   = useState(null);
  const [selectedFloor, setSelectedFloor]   = useState(null);
  const [selectedRoom, setSelectedRoom]     = useState(null);
  const [roomStudents, setRoomStudents]     = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Hostel modal
  const [showHostelModal, setShowHostelModal] = useState(false);
  const [editHostelId, setEditHostelId]       = useState(null);
  const [hostelForm, setHostelForm]           = useState({ name: '', gender: 'Male', description: '' });

  // Room modal
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editRoomId, setEditRoomId]       = useState(null);
  const defaultRoomForm = { room_no: '', block: '', floor: 1, capacity: 4, gender: 'Male', hostel_id: '', institution_id: '' };
  const [roomForm, setRoomForm] = useState(defaultRoomForm);
  const [saving, setSaving]     = useState(false);

  const canManage = ['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(user?.role);

  // ─── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api('/api/hostels').catch(() => []),
      api('/api/rooms').catch(() => []),
      api('/api/institutions').catch(() => []),
    ]).then(([h, r, i]) => {
      setHostels(h); setRooms(r); setInstitutions(i);
    }).finally(() => setLoading(false));
  }, []);

  const refresh = async () => {
    const [h, r] = await Promise.all([
      api('/api/hostels').catch(() => []),
      api('/api/rooms').catch(() => []),
    ]);
    setHostels(h); setRooms(r);
  };

  // ─── Derived ───────────────────────────────────────────────────────────────
  const unassignedRooms = useMemo(() => rooms.filter(r => !r.hostel_id), [rooms]);

  const hostelRooms = useMemo(() => {
    if (!selectedHostel) return [];
    if (selectedHostel.id === 'unassigned') return unassignedRooms;
    return rooms.filter(r => r.hostel_id === selectedHostel.id);
  }, [rooms, selectedHostel, unassignedRooms]);

  const blocks = useMemo(() =>
    [...new Set(hostelRooms.map(r => r.block).filter(Boolean))].sort(),
    [hostelRooms]);

  const blockRooms = useMemo(() =>
    selectedBlock ? hostelRooms.filter(r => r.block === selectedBlock) : hostelRooms,
    [hostelRooms, selectedBlock]);

  const floors = useMemo(() =>
    [...new Set(blockRooms.map(r => r.floor).filter(f => f != null))].sort((a,b) => a-b),
    [blockRooms]);

  const visibleRooms = useMemo(() => {
    let f = blockRooms;
    if (selectedFloor != null) f = f.filter(r => r.floor === selectedFloor);
    return f;
  }, [blockRooms, selectedFloor]);

  const globalStats = useMemo(() => {
    const total_beds = rooms.reduce((s,r) => s + (r.capacity||0), 0);
    const occupied   = rooms.reduce((s,r) => s + (r.occupied||0), 0);
    return { total_rooms: rooms.length, total_beds, occupied, available: total_beds - occupied };
  }, [rooms]);

  // ─── Room click ────────────────────────────────────────────────────────────
  const handleRoomClick = async (room) => {
    setSelectedRoom(room); setLoadingStudents(true); setRoomStudents([]);
    try { setRoomStudents(await api(`/api/rooms/${room.id}/students`)); }
    catch { /* ignore */ } finally { setLoadingStudents(false); }
  };

  // ─── Hostel CRUD ───────────────────────────────────────────────────────────
  const openAddHostel = () => {
    setHostelForm({ name: '', gender: 'Male', description: '' });
    setEditHostelId(null); setShowHostelModal(true);
  };
  const openEditHostel = (e, h) => {
    e.stopPropagation();
    if (h.id === 'unassigned') return;
    setHostelForm({ name: h.name, gender: h.gender, description: h.description || '' });
    setEditHostelId(h.id); setShowHostelModal(true);
  };
  const handleHostelSubmit = async (e) => {
    e.preventDefault();
    if (!hostelForm.name) return alert('Hostel name is required.');
    setSaving(true);
    try {
      await api(editHostelId ? `/api/hostels/${editHostelId}` : '/api/hostels', {
        method: editHostelId ? 'PUT' : 'POST',
        body: JSON.stringify(hostelForm)
      });
      setShowHostelModal(false);
      await refresh();
    } catch(err) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  };
  const handleDeleteHostel = async (e, h) => {
    e.stopPropagation();
    if (h.id === 'unassigned') return;
    if (!window.confirm(`Delete "${h.name}"? Rooms will be unlinked.`)) return;
    try {
      await api(`/api/hostels/${h.id}`, { method: 'DELETE' });
      if (selectedHostel?.id === h.id) { setSelectedHostel(null); setSelectedBlock(null); setSelectedFloor(null); setSelectedRoom(null); }
      await refresh();
    } catch(err) { alert('Error: ' + err.message); }
  };

  // ─── Room CRUD ─────────────────────────────────────────────────────────────
  const openAddRoom = () => {
    setRoomForm({ ...defaultRoomForm, hostel_id: selectedHostel?.id === 'unassigned' ? '' : (selectedHostel?.id || ''), block: selectedBlock||'', floor: selectedFloor||1, gender: selectedHostel?.gender||'Male' });
    setEditRoomId(null); setShowRoomModal(true);
  };
  const openEditRoom = (e, room) => {
    e.stopPropagation();
    setRoomForm({ room_no: room.room_no||'', block: room.block||'', floor: room.floor||1, capacity: room.capacity||4, gender: room.gender||'Male', hostel_id: room.hostel_id||'', institution_id: room.institution_id||'' });
    setEditRoomId(room.id); setShowRoomModal(true);
  };
  const handleRoomSubmit = async (e) => {
    e.preventDefault();
    if (!roomForm.room_no || !roomForm.gender) return alert('Room No and Gender are required.');
    setSaving(true);
    try {
      await api(editRoomId ? `/api/rooms/${editRoomId}` : '/api/rooms', {
        method: editRoomId ? 'PUT' : 'POST',
        body: JSON.stringify({ ...roomForm, floor: parseInt(roomForm.floor)||1, capacity: parseInt(roomForm.capacity)||4, hostel_id: roomForm.hostel_id ? parseInt(roomForm.hostel_id) : null, institution_id: roomForm.institution_id ? parseInt(roomForm.institution_id) : null })
      });
      setShowRoomModal(false); setEditRoomId(null);
      await refresh();
    } catch(err) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  };
  const handleDeleteRoom = async (e, room) => {
    e.stopPropagation();
    if (!window.confirm(`Delete Room ${room.room_no}?`)) return;
    try {
      await api(`/api/rooms/${room.id}`, { method: 'DELETE' });
      if (selectedRoom?.id === room.id) setSelectedRoom(null);
      await refresh();
    } catch(err) { alert('Error: ' + err.message); }
  };

  // ─── Sub-components ────────────────────────────────────────────────────────
  const OccBar = ({ occ, cap }) => {
    const pct  = cap ? Math.min(100, Math.round(occ/cap*100)) : 0;
    const cls  = pct >= 100 ? 'full' : pct > 60 ? 'mid' : 'low';
    return (
      <div>
        <div className="room-bar" style={{ marginTop: 8 }}>
          <div className={`room-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginTop:4, color:'var(--text-dim)' }}>
          <span>{occ}/{cap} beds</span>
          <span style={{ fontWeight:700, color: pct>=100?'var(--danger)':pct===0?'var(--success)':'var(--warning)' }}>
            {pct>=100 ? 'FULL' : pct===0 ? 'EMPTY' : `${pct}%`}
          </span>
        </div>
      </div>
    );
  };

  const RoomCard = ({ room }) => {
    const full  = room.occupied >= room.capacity;
    const empty = room.occupied === 0;
    const accentColor = full ? 'var(--danger)' : empty ? 'var(--success)' : 'var(--primary)';
    const isSelected  = selectedRoom?.id === room.id;
    return (
      <div
        onClick={() => handleRoomClick(room)}
        className="room-card"
        style={{
          borderTop: `3px solid ${accentColor}`,
          borderColor: isSelected ? 'var(--primary)' : undefined,
          boxShadow: isSelected ? '0 0 0 2px var(--primary)' : undefined,
          textAlign: 'left',
          padding: '14px',
          position: 'relative',
        }}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
          <div>
            <div className="room-no" style={{ fontSize:17, marginBottom:2 }}>Room {room.room_no}</div>
            <div className="room-block" style={{ fontSize:10 }}>Floor {room.floor}</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
            <span className={`badge badge-${full?'danger':empty?'success':'info'}`} style={{ fontSize:9 }}>
              {full ? 'FULL' : empty ? 'EMPTY' : 'OPEN'}
            </span>
            {canManage && (
              <div style={{ display:'flex', gap:2 }}>
                <button onClick={e => openEditRoom(e, room)} title="Edit" style={{ background:'none', border:'none', fontSize:11, color:'var(--text-dim)', cursor:'pointer', padding:'2px 4px' }}>✏️</button>
                <button onClick={e => handleDeleteRoom(e, room)} title="Delete" style={{ background:'none', border:'none', fontSize:11, color:'var(--danger)', cursor:'pointer', padding:'2px 4px' }}>🗑️</button>
              </div>
            )}
          </div>
        </div>
        <OccBar occ={room.occupied} cap={room.capacity} />
      </div>
    );
  };

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:300, color:'var(--text-dim)' }}>
      <div style={{ fontSize:40, marginBottom:12 }}>🏠</div>
      <div style={{ fontWeight:600 }}>Loading Room Management…</div>
    </div>
  );

  // Add virtual Unassigned hostel if needed
  const displayHostels = [...hostels];
  if (unassignedRooms.length > 0) {
    displayHostels.push({
      id: 'unassigned',
      name: 'Unassigned Rooms',
      gender: 'Mixed',
      total_rooms: unassignedRooms.length,
      total_beds: unassignedRooms.reduce((s,r)=>s+(r.capacity||0),0),
      occupied: unassignedRooms.reduce((s,r)=>s+(r.occupied||0),0),
      available: unassignedRooms.reduce((s,r)=>s+((r.capacity||0)-(r.occupied||0)),0)
    });
  }

  return (
    <div className="page-enter">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, margin:0, color:'var(--text)' }}>🏠 Room Management</h2>
          <p style={{ margin:'4px 0 0', color:'var(--text-muted)', fontSize:13 }}>
            Manage hostels · blocks · floors · rooms in a structured hierarchy
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={openAddHostel}>+ Add Hostel</button>
        )}
      </div>

      {/* ── Global Stats ────────────────────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom:24, gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))' }}>
        {[
          { label:'Total Rooms',   value: globalStats.total_rooms,                              icon:'🚪', cls:'indigo' },
          { label:'Total Beds',    value: globalStats.total_beds,                               icon:'🛏️', cls:'teal'   },
          { label:'Occupied',      value: globalStats.occupied,                                  icon:'👤', cls:'amber'  },
          { label:'Available',     value: globalStats.available,                                 icon:'✅', cls:'green'  },
          { label:'Boys Hostels',  value: hostels.filter(h=>h.gender==='Male').length,          icon:'♂',  cls:'purple' },
          { label:'Girls Hostels', value: hostels.filter(h=>h.gender==='Female').length,        icon:'♀',  cls:'rose'   },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.cls}`}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Main 3-panel layout ─────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns: selectedRoom ? '240px 1fr 300px' : '240px 1fr', gap:16, alignItems:'start' }}>

        {/* ── LEFT: Hostel list ── */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-dim)' }}>Hostels</span>
            <span className="badge badge-gray">{displayHostels.length}</span>
          </div>
          {displayHostels.length === 0 ? (
            <div style={{ padding:'32px 20px', textAlign:'center', color:'var(--text-dim)' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🏗️</div>
              <div style={{ fontWeight:600, marginBottom:4 }}>No hostels yet</div>
              <div style={{ fontSize:12 }}>Click "+ Add Hostel" to begin setup</div>
            </div>
          ) : displayHostels.map(h => {
            const active = selectedHostel?.id === h.id;
            const isMale = h.gender === 'Male';
            const isVirtual = h.id === 'unassigned';
            const accentColor = isVirtual ? 'var(--warning)' : isMale ? 'var(--primary)' : '#ec4899';
            const pct = h.total_beds ? Math.round(h.occupied/h.total_beds*100) : 0;
            return (
              <div
                key={h.id}
                onClick={() => {
                  if (active) { setSelectedHostel(null); setSelectedBlock(null); setSelectedFloor(null); setSelectedRoom(null); }
                  else { setSelectedHostel(h); setSelectedBlock(null); setSelectedFloor(null); setSelectedRoom(null); }
                }}
                style={{
                  padding:'14px 18px',
                  cursor:'pointer',
                  borderLeft: active ? `3px solid ${accentColor}` : '3px solid transparent',
                  background: active ? (isVirtual ? 'rgba(245,158,11,0.07)' : `rgba(${isMale?'99,102,241':'236,72,153'},0.07)`) : 'transparent',
                  transition:'all .18s',
                  borderBottom:'1px solid var(--border)',
                }}
                onMouseEnter={e => { if(!active) e.currentTarget.style.background='var(--bg-card2)'; }}
                onMouseLeave={e => { if(!active) e.currentTarget.style.background='transparent'; }}
              >
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, color: active ? accentColor : 'var(--text)', display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ fontSize:16 }}>{isVirtual ? '⚠️' : isMale ? '♂' : '♀'}</span>
                      <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{h.name}</span>
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:3 }}>
                      {h.total_rooms} rooms · {h.total_beds} beds
                    </div>
                  </div>
                  {canManage && active && !isVirtual && (
                    <div style={{ display:'flex', gap:2, flexShrink:0, marginLeft:4 }}>
                      <button onClick={e => openEditHostel(e, h)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-dim)', fontSize:13, padding:'2px 4px' }}>✏️</button>
                      <button onClick={e => handleDeleteHostel(e, h)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--danger)', fontSize:13, padding:'2px 4px' }}>🗑️</button>
                    </div>
                  )}
                </div>
                {/* Mini progress */}
                <div style={{ height:4, background:'var(--border)', borderRadius:2 }}>
                  <div style={{ height:'100%', width:`${pct}%`, borderRadius:2, background: pct>=90?'var(--danger)':pct>60?'var(--warning)':'var(--success)', transition:'width .4s' }} />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:10, color:'var(--text-dim)' }}>
                  <span style={{ color:'var(--danger)', fontWeight:600 }}>{h.occupied} occupied</span>
                  <span style={{ color:'var(--success)', fontWeight:600 }}>{h.available} free</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── CENTER: Block → Floor → Rooms ── */}
        <div>
          {!selectedHostel ? (
            <div className="card" style={{ textAlign:'center', padding:'60px 40px' }}>
              <div style={{ fontSize:56, marginBottom:16 }}>🏠</div>
              <h3 style={{ fontWeight:700, marginBottom:8, color:'var(--text)' }}>Select a Hostel</h3>
              <p style={{ color:'var(--text-muted)', fontSize:14 }}>
                Choose a hostel from the left panel to explore its blocks, floors and rooms.
              </p>
              {canManage && hostels.length === 0 && (
                <button className="btn btn-primary" style={{ marginTop:20 }} onClick={openAddHostel}>
                  + Create First Hostel
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Hostel banner */}
              <div className="card" style={{
                marginBottom:16, padding:'18px 22px',
                background: selectedHostel.id === 'unassigned'
                  ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(251,191,36,0.04))'
                  : selectedHostel.gender === 'Male'
                    ? 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(99,102,241,0.04))'
                    : 'linear-gradient(135deg, rgba(236,72,153,0.08), rgba(251,207,232,0.04))',
                borderColor: selectedHostel.id === 'unassigned' ? 'rgba(245,158,11,0.2)' : selectedHostel.gender === 'Male' ? 'rgba(99,102,241,0.2)' : 'rgba(236,72,153,0.2)',
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                      <span style={{ fontSize:28 }}>{selectedHostel.id === 'unassigned' ? '⚠️' : selectedHostel.gender === 'Male' ? '♂' : '♀'}</span>
                      <div>
                        <div style={{ fontWeight:800, fontSize:18, color:'var(--text)' }}>{selectedHostel.name}</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                          {selectedHostel.id === 'unassigned' ? 'These rooms need to be assigned to a hostel.' : (selectedHostel.description || `${selectedHostel.gender === 'Male' ? "Boys'" : "Girls'"} Hostel`)}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:16, marginTop:8 }}>
                      <span style={{ fontSize:12, color:'var(--text-dim)' }}>🚪 {selectedHostel.total_rooms} rooms</span>
                      <span style={{ fontSize:12, color:'var(--text-dim)' }}>🛏️ {selectedHostel.total_beds} beds</span>
                      <span style={{ fontSize:12, color:'var(--success)', fontWeight:600 }}>✅ {selectedHostel.available} available</span>
                    </div>
                  </div>
                  {canManage && selectedHostel.id !== 'unassigned' && (
                    <button className="btn btn-primary btn-sm" onClick={openAddRoom}>+ Add Room</button>
                  )}
                </div>
              </div>

              {/* Block pills */}
              {blocks.length > 0 && (
                <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
                  <button
                    onClick={() => { setSelectedBlock(null); setSelectedFloor(null); }}
                    className={!selectedBlock ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                  >All Blocks</button>
                  {blocks.map(b => (
                    <button
                      key={b}
                      onClick={() => { setSelectedBlock(b === selectedBlock ? null : b); setSelectedFloor(null); }}
                      className={selectedBlock === b ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                    >Block {b}</button>
                  ))}
                </div>
              )}

              {/* Floor pills */}
              {floors.length > 0 && (
                <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
                  <button
                    onClick={() => setSelectedFloor(null)}
                    style={{ padding:'4px 14px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background: selectedFloor==null?'var(--secondary)':'var(--border)', color: selectedFloor==null?'#fff':'var(--text-muted)', transition:'all .15s' }}
                  >All Floors</button>
                  {floors.map(f => (
                    <button
                      key={f}
                      onClick={() => setSelectedFloor(f === selectedFloor ? null : f)}
                      style={{ padding:'4px 14px', borderRadius:20, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background: selectedFloor===f?'var(--secondary)':'var(--border)', color: selectedFloor===f?'#fff':'var(--text-muted)', transition:'all .15s' }}
                    >Floor {f}</button>
                  ))}
                </div>
              )}

              {/* Room grid */}
              {visibleRooms.length === 0 ? (
                <div className="card" style={{ textAlign:'center', padding:'40px 24px', borderStyle:'dashed' }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>🚪</div>
                  <div style={{ fontWeight:600, color:'var(--text-muted)', marginBottom:6 }}>No rooms here yet</div>
                  {canManage && <button className="btn btn-primary btn-sm" onClick={openAddRoom}>+ Add First Room</button>}
                </div>
              ) : (
                <div className="rooms-grid" style={{ gridTemplateColumns:'repeat(auto-fill, minmax(155px,1fr))' }}>
                  {visibleRooms.map(room => <RoomCard key={room.id} room={room} />)}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── RIGHT: Room detail panel ── */}
        {selectedRoom && (
          <div className="card" style={{ padding:0, overflow:'hidden', position:'sticky', top:80 }}>
            {/* Header */}
            <div style={{
              padding:'16px 18px',
              background: selectedRoom.gender==='Male'
                ? 'linear-gradient(135deg,rgba(37,99,235,0.1),rgba(99,102,241,0.04))'
                : 'linear-gradient(135deg,rgba(236,72,153,0.1),rgba(251,207,232,0.04))',
              borderBottom:'1px solid var(--border)',
              display:'flex', justifyContent:'space-between', alignItems:'flex-start'
            }}>
              <div>
                <div style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>Room {selectedRoom.room_no}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>
                  {selectedRoom.hostel_name || '—'} · {selectedRoom.block ? `Block ${selectedRoom.block}` : ''} · Floor {selectedRoom.floor}
                </div>
              </div>
              <button onClick={() => setSelectedRoom(null)} className="modal-close" style={{ flexShrink:0 }}>×</button>
            </div>

            {/* Stats grid */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1, background:'var(--border)', borderBottom:'1px solid var(--border)' }}>
              {[
                { label:'Capacity', value: selectedRoom.capacity, color:'var(--primary)' },
                { label:'Occupied', value: selectedRoom.occupied, color:'var(--warning)' },
                { label:'Free Beds', value: selectedRoom.capacity - selectedRoom.occupied, color:'var(--success)' },
                { label:'Gender', value: selectedRoom.gender, color: selectedRoom.gender==='Male'?'var(--primary)':'#ec4899' },
              ].map(s => (
                <div key={s.label} style={{ background:'var(--bg-card)', padding:'12px 14px', textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:10, fontWeight:600, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Occupancy bar */}
            <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)' }}>
              <OccBar occ={selectedRoom.occupied} cap={selectedRoom.capacity} />
            </div>

            {/* Student list */}
            <div style={{ padding:'12px 18px' }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-dim)', marginBottom:10 }}>
                Students ({loadingStudents ? '…' : roomStudents.length})
              </div>
              {loadingStudents ? (
                <div style={{ textAlign:'center', padding:20, color:'var(--text-dim)' }}>Loading…</div>
              ) : roomStudents.length === 0 ? (
                <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text-dim)', fontSize:13 }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>🛏️</div>
                  No students assigned yet
                </div>
              ) : (
                <div style={{ maxHeight:320, overflowY:'auto' }}>
                  {roomStudents.map(s => (
                    <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                      <div style={{
                        width:32, height:32, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700,
                        background: s.last_direction==='OUT' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                        color: s.last_direction==='OUT' ? 'var(--danger)' : 'var(--success)',
                      }}>
                        {s.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:13, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.name}</div>
                        <div style={{ fontSize:10, color:'var(--text-dim)' }}>Bed {s.bed_no||'—'} · {s.dept_name||'—'}</div>
                      </div>
                      <span className={`badge badge-${s.last_direction==='OUT'?'danger':'success'}`} style={{ fontSize:9, flexShrink:0 }}>
                        {s.last_direction==='OUT' ? 'OUT' : 'IN'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Hostel Modal ─────────────────────────────────────────────────── */}
      {showHostelModal && (
        <div className="modal-overlay" onClick={() => setShowHostelModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:440 }}>
            <div className="modal-header">
              <span className="modal-title">{editHostelId ? '✏️ Edit Hostel' : '🏠 Add New Hostel'}</span>
              <button className="modal-close" onClick={() => setShowHostelModal(false)}>×</button>
            </div>
            <form onSubmit={handleHostelSubmit}>
              <div className="form-group">
                <label className="form-label">Hostel Name *</label>
                <input className="form-input" placeholder="e.g. JKKM Boys Hostel" value={hostelForm.name}
                  onChange={e => setHostelForm({ ...hostelForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Gender *</label>
                <select className="form-input" value={hostelForm.gender} onChange={e => setHostelForm({ ...hostelForm, gender: e.target.value })}>
                  <option value="Male">♂ Boys (Male)</option>
                  <option value="Female">♀ Girls (Female)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description <span style={{ textTransform:'none', fontWeight:400, color:'var(--text-dim)' }}>(optional)</span></label>
                <input className="form-input" placeholder="Short description" value={hostelForm.description}
                  onChange={e => setHostelForm({ ...hostelForm, description: e.target.value })} />
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowHostelModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editHostelId ? '💾 Save Changes' : '+ Create Hostel'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Room Modal ───────────────────────────────────────────────────── */}
      {showRoomModal && (
        <div className="modal-overlay" onClick={() => setShowRoomModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:520 }}>
            <div className="modal-header">
              <span className="modal-title">{editRoomId ? '✏️ Edit Room' : '🚪 Add New Room'}</span>
              <button className="modal-close" onClick={() => setShowRoomModal(false)}>×</button>
            </div>
            <form onSubmit={handleRoomSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Gender *</label>
                  <select className="form-input" value={roomForm.gender} onChange={e => setRoomForm({ ...roomForm, gender: e.target.value, hostel_id: '' })} disabled={!!roomForm.hostel_id}>
                    <option value="Male">♂ Boys</option>
                    <option value="Female">♀ Girls</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Hostel *</label>
                  <select className="form-input" value={roomForm.hostel_id} onChange={e => {
                    const h = hostels.find(h => h.id === parseInt(e.target.value));
                    setRoomForm({ ...roomForm, hostel_id: e.target.value, gender: h?.gender || roomForm.gender });
                  }}>
                    <option value="">Select Hostel (Optional)</option>
                    {hostels.filter(h => h.gender === roomForm.gender).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Room Number *</label>
                  <input className="form-input" placeholder="e.g. 101" value={roomForm.room_no}
                    onChange={e => setRoomForm({ ...roomForm, room_no: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Block</label>
                  <input className="form-input" placeholder="e.g. A" value={roomForm.block}
                    onChange={e => setRoomForm({ ...roomForm, block: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Floor</label>
                  <input className="form-input" type="number" min={1} max={20} value={roomForm.floor}
                    onChange={e => setRoomForm({ ...roomForm, floor: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Capacity (Beds)</label>
                  <input className="form-input" type="number" min={1} max={20} value={roomForm.capacity}
                    onChange={e => setRoomForm({ ...roomForm, capacity: e.target.value })} />
                </div>
                <div className="form-group" style={{ gridColumn:'1/-1' }}>
                  <label className="form-label">Linked Institution <span style={{ textTransform:'none', fontWeight:400, color:'var(--text-dim)' }}>(optional)</span></label>
                  <select className="form-input" value={roomForm.institution_id} onChange={e => setRoomForm({ ...roomForm, institution_id: e.target.value })}>
                    <option value="">None (open to all)</option>
                    {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowRoomModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editRoomId ? '💾 Save Changes' : '+ Add Room'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
