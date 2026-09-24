import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

const GENDER_COLOR = { Male: '#6366f1', Female: '#ec4899' };
const GENDER_BG = { Male: 'rgba(99,102,241,0.10)', Female: 'rgba(236,72,153,0.10)' };

export default function RoomsPage() {
  const { api, user } = useAuth();

  // Data
  const [hostels, setHostels]       = useState([]);
  const [rooms, setRooms]           = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading]       = useState(true);

  // Navigation state
  const [selectedHostel, setSelectedHostel] = useState(null); // hostel object
  const [selectedBlock, setSelectedBlock]   = useState(null); // block string
  const [selectedFloor, setSelectedFloor]   = useState(null); // floor int
  const [selectedRoom, setSelectedRoom]     = useState(null); // room object
  const [roomStudents, setRoomStudents]     = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Modals
  const [showHostelModal, setShowHostelModal] = useState(false);
  const [editHostelId, setEditHostelId]       = useState(null);
  const [hostelForm, setHostelForm]           = useState({ name: '', gender: 'Male', description: '' });

  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editRoomId, setEditRoomId]       = useState(null);
  const defaultRoomForm = { room_no: '', block: '', floor: 1, capacity: 4, gender: 'Male', hostel_id: '', institution_id: '' };
  const [roomForm, setRoomForm]           = useState(defaultRoomForm);
  const [saving, setSaving] = useState(false);

  const canManage = ['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(user?.role);

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api('/api/hostels').catch(() => []),
      api('/api/rooms').catch(() => []),
      api('/api/institutions').catch(() => []),
    ]).then(([h, r, i]) => {
      setHostels(h);
      setRooms(r);
      setInstitutions(i);
    }).finally(() => setLoading(false));
  }, []);

  const refresh = async () => {
    const [h, r] = await Promise.all([
      api('/api/hostels').catch(() => []),
      api('/api/rooms').catch(() => []),
    ]);
    setHostels(h);
    setRooms(r);
  };

  // ── Derived navigation data ──────────────────────────────────────────────────
  const hostelRooms = useMemo(() =>
    selectedHostel ? rooms.filter(r => r.hostel_id === selectedHostel.id) : [],
    [rooms, selectedHostel]
  );

  const blocks = useMemo(() =>
    [...new Set(hostelRooms.map(r => r.block).filter(Boolean))].sort(),
    [hostelRooms]
  );

  const blockRooms = useMemo(() =>
    selectedBlock ? hostelRooms.filter(r => r.block === selectedBlock) : hostelRooms,
    [hostelRooms, selectedBlock]
  );

  const floors = useMemo(() =>
    [...new Set(blockRooms.map(r => r.floor).filter(f => f != null))].sort((a,b) => a-b),
    [blockRooms]
  );

  const visibleRooms = useMemo(() => {
    let filtered = blockRooms;
    if (selectedFloor != null) filtered = filtered.filter(r => r.floor === selectedFloor);
    return filtered;
  }, [blockRooms, selectedFloor]);

  // ── Global stats ─────────────────────────────────────────────────────────────
  const globalStats = useMemo(() => {
    const total_beds  = rooms.reduce((s, r) => s + (r.capacity || 0), 0);
    const occupied    = rooms.reduce((s, r) => s + (r.occupied || 0), 0);
    return { total_rooms: rooms.length, total_beds, occupied, available: total_beds - occupied };
  }, [rooms]);

  // ── Room click ───────────────────────────────────────────────────────────────
  const handleRoomClick = async (room) => {
    setSelectedRoom(room);
    setLoadingStudents(true);
    setRoomStudents([]);
    try {
      const students = await api(`/api/rooms/${room.id}/students`);
      setRoomStudents(students);
    } catch { /* ignore */ }
    finally { setLoadingStudents(false); }
  };

  // ── Hostel CRUD ───────────────────────────────────────────────────────────────
  const openAddHostel = () => {
    setHostelForm({ name: '', gender: 'Male', description: '' });
    setEditHostelId(null);
    setShowHostelModal(true);
  };
  const openEditHostel = (e, h) => {
    e.stopPropagation();
    setHostelForm({ name: h.name, gender: h.gender, description: h.description || '' });
    setEditHostelId(h.id);
    setShowHostelModal(true);
  };
  const handleHostelSubmit = async (e) => {
    e.preventDefault();
    if (!hostelForm.name) return alert('Hostel name is required.');
    setSaving(true);
    try {
      const url    = editHostelId ? `/api/hostels/${editHostelId}` : '/api/hostels';
      const method = editHostelId ? 'PUT' : 'POST';
      await api(url, { method, body: JSON.stringify(hostelForm) });
      setShowHostelModal(false);
      await refresh();
      // Keep navigation in sync
      if (editHostelId && selectedHostel?.id === editHostelId) {
        setSelectedHostel(h => ({ ...h, ...hostelForm }));
      }
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  };
  const handleDeleteHostel = async (h) => {
    if (!window.confirm(`Delete hostel "${h.name}"? All rooms will be unlinked.`)) return;
    try {
      await api(`/api/hostels/${h.id}`, { method: 'DELETE' });
      if (selectedHostel?.id === h.id) { setSelectedHostel(null); setSelectedBlock(null); setSelectedFloor(null); }
      await refresh();
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ── Room CRUD ────────────────────────────────────────────────────────────────
  const openAddRoom = () => {
    setRoomForm({
      ...defaultRoomForm,
      gender: selectedHostel?.gender || 'Male',
      hostel_id: selectedHostel?.id || '',
      block: selectedBlock || '',
      floor: selectedFloor || 1,
    });
    setEditRoomId(null);
    setShowRoomModal(true);
  };
  const openEditRoom = (e, room) => {
    e.stopPropagation();
    setRoomForm({
      room_no: room.room_no || '',
      block: room.block || '',
      floor: room.floor || 1,
      capacity: room.capacity || 4,
      gender: room.gender || 'Male',
      hostel_id: room.hostel_id || '',
      institution_id: room.institution_id || '',
    });
    setEditRoomId(room.id);
    setShowRoomModal(true);
  };
  const handleRoomSubmit = async (e) => {
    e.preventDefault();
    if (!roomForm.room_no || !roomForm.gender) return alert('Room No and Gender are required.');
    setSaving(true);
    try {
      const url    = editRoomId ? `/api/rooms/${editRoomId}` : '/api/rooms';
      const method = editRoomId ? 'PUT' : 'POST';
      const payload = {
        ...roomForm,
        floor: parseInt(roomForm.floor) || 1,
        capacity: parseInt(roomForm.capacity) || 4,
        hostel_id: roomForm.hostel_id ? parseInt(roomForm.hostel_id) : null,
        institution_id: roomForm.institution_id ? parseInt(roomForm.institution_id) : null,
      };
      await api(url, { method, body: JSON.stringify(payload) });
      setShowRoomModal(false);
      setEditRoomId(null);
      await refresh();
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  };
  const handleDeleteRoom = async (e, room) => {
    e.stopPropagation();
    if (!window.confirm(`Delete Room ${room.room_no}? Students will be unassigned.`)) return;
    try {
      await api(`/api/rooms/${room.id}`, { method: 'DELETE' });
      if (selectedRoom?.id === room.id) setSelectedRoom(null);
      await refresh();
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ── Render helpers ───────────────────────────────────────────────────────────
  const OccupancyBar = ({ occupied, capacity }) => {
    const pct  = capacity ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;
    const full  = occupied >= capacity;
    const color = full ? '#ef4444' : pct > 60 ? '#f59e0b' : '#22c55e';
    return (
      <div style={{ marginTop: 6 }}>
        <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 2, color: '#94a3b8' }}>
          <span>{occupied}/{capacity} beds</span>
          <span style={{ color }}>{full ? 'FULL' : pct === 0 ? 'EMPTY' : `${pct}%`}</span>
        </div>
      </div>
    );
  };

  const RoomCard = ({ room }) => {
    const full  = room.occupied >= room.capacity;
    const empty = room.occupied === 0;
    const borderColor = full ? '#ef4444' : empty ? '#22c55e' : '#6366f1';
    return (
      <div
        onClick={() => handleRoomClick(room)}
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: `1.5px solid ${borderColor}33`,
          borderTop: `3px solid ${borderColor}`,
          borderRadius: 10,
          padding: '12px 14px',
          cursor: 'pointer',
          transition: 'all .2s',
          position: 'relative',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>
              Room {room.room_no}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Floor {room.floor}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {canManage && (
              <>
                <button
                  onClick={e => openEditRoom(e, room)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: '2px 5px' }}
                  title="Edit"
                >✏️</button>
                <button
                  onClick={e => handleDeleteRoom(e, room)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, padding: '2px 5px' }}
                  title="Delete"
                >🗑️</button>
              </>
            )}
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
              background: full ? '#ef444422' : empty ? '#22c55e22' : '#6366f122',
              color: full ? '#ef4444' : empty ? '#22c55e' : '#6366f1'
            }}>
              {full ? 'FULL' : empty ? 'EMPTY' : 'OPEN'}
            </span>
          </div>
        </div>
        <OccupancyBar occupied={room.occupied} capacity={room.capacity} />
      </div>
    );
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🏠</div>
        <div>Loading hostels…</div>
      </div>
    </div>
  );

  return (
    <div className="page-enter" style={{ padding: '0 0 40px' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>🏠 Room Management</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
            Manage hostels, blocks, floors and rooms in a structured hierarchy
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={openAddHostel} style={{ whiteSpace: 'nowrap' }}>
            + Add Hostel
          </button>
        )}
      </div>

      {/* ── Global stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Rooms',  value: globalStats.total_rooms, icon: '🏠', color: '#6366f1' },
          { label: 'Total Beds',   value: globalStats.total_beds,  icon: '🛏️', color: '#06b6d4' },
          { label: 'Occupied',     value: globalStats.occupied,    icon: '👤', color: '#f59e0b' },
          { label: 'Available',    value: globalStats.available,   icon: '✅', color: '#22c55e' },
          { label: 'Boys Hostels', value: hostels.filter(h => h.gender === 'Male').length, icon: '♂', color: '#6366f1' },
          { label: 'Girls Hostels',value: hostels.filter(h => h.gender === 'Female').length, icon: '♀', color: '#ec4899' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '14px 16px', textAlign: 'center'
          }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{stat.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Main layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedRoom ? '260px 1fr 280px' : '260px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── LEFT: Hostel sidebar ── */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, overflow: 'hidden'
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: 12, fontWeight: 600, color: '#64748b', letterSpacing: 1, textTransform: 'uppercase' }}>
            Hostels
          </div>
          {hostels.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#475569', fontSize: 13 }}>
              No hostels yet.<br />Click "Add Hostel" to start.
            </div>
          ) : hostels.map(h => {
            const active = selectedHostel?.id === h.id;
            const gc = GENDER_COLOR[h.gender] || '#6366f1';
            return (
              <div
                key={h.id}
                onClick={() => {
                  setSelectedHostel(active ? null : h);
                  setSelectedBlock(null);
                  setSelectedFloor(null);
                  setSelectedRoom(null);
                }}
                style={{
                  padding: '12px 16px', cursor: 'pointer', borderLeft: active ? `3px solid ${gc}` : '3px solid transparent',
                  background: active ? `${gc}11` : 'transparent',
                  transition: 'all .2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: active ? gc : '#cbd5e1' }}>
                    {h.gender === 'Male' ? '♂' : '♀'} {h.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                    {h.total_rooms} rooms · {h.occupied}/{h.total_beds} beds
                  </div>
                </div>
                {canManage && (
                  <div style={{ display: 'flex', gap: 2, opacity: active ? 1 : 0 }} className="hostel-actions">
                    <button onClick={e => openEditHostel(e, h)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>✏️</button>
                    <button onClick={e => { e.stopPropagation(); handleDeleteHostel(h); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}>🗑️</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── CENTER: Block → Floor → Rooms ── */}
        <div>
          {!selectedHostel ? (
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: 40, textAlign: 'center', color: '#475569'
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#94a3b8' }}>Select a Hostel</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Choose a hostel from the left to view its blocks, floors and rooms.</div>
            </div>
          ) : (
            <>
              {/* Hostel header */}
              <div style={{
                background: `linear-gradient(135deg, ${GENDER_COLOR[selectedHostel.gender] || '#6366f1'}22, rgba(0,0,0,0.3))`,
                border: `1px solid ${GENDER_COLOR[selectedHostel.gender] || '#6366f1'}33`,
                borderRadius: 14, padding: '16px 20px', marginBottom: 16,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: '#f1f5f9' }}>
                    {selectedHostel.gender === 'Male' ? '♂' : '♀'} {selectedHostel.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                    {selectedHostel.description || `${selectedHostel.gender === 'Male' ? "Boys'" : "Girls'"} Hostel`}
                    {' · '}
                    <span style={{ color: '#22c55e' }}>{selectedHostel.available} available</span>
                    {' of '}
                    <span>{selectedHostel.total_beds} beds</span>
                  </div>
                </div>
                {canManage && (
                  <button className="btn btn-primary" onClick={openAddRoom} style={{ fontSize: 13 }}>
                    + Add Room
                  </button>
                )}
              </div>

              {/* Block tabs */}
              {blocks.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setSelectedBlock(null); setSelectedFloor(null); }}
                    style={{
                      padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: !selectedBlock ? '#6366f1' : 'rgba(255,255,255,0.07)',
                      color: !selectedBlock ? '#fff' : '#94a3b8'
                    }}
                  >All Blocks</button>
                  {blocks.map(b => (
                    <button
                      key={b}
                      onClick={() => { setSelectedBlock(b === selectedBlock ? null : b); setSelectedFloor(null); }}
                      style={{
                        padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        background: selectedBlock === b ? '#6366f1' : 'rgba(255,255,255,0.07)',
                        color: selectedBlock === b ? '#fff' : '#94a3b8'
                      }}
                    >Block {b}</button>
                  ))}
                </div>
              )}

              {/* Floor tabs */}
              {floors.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setSelectedFloor(null)}
                    style={{
                      padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: selectedFloor == null ? '#0ea5e9' : 'rgba(255,255,255,0.05)',
                      color: selectedFloor == null ? '#fff' : '#94a3b8'
                    }}
                  >All Floors</button>
                  {floors.map(f => (
                    <button
                      key={f}
                      onClick={() => setSelectedFloor(f === selectedFloor ? null : f)}
                      style={{
                        padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        background: selectedFloor === f ? '#0ea5e9' : 'rgba(255,255,255,0.05)',
                        color: selectedFloor === f ? '#fff' : '#94a3b8'
                      }}
                    >Floor {f}</button>
                  ))}
                </div>
              )}

              {/* Room grid */}
              {visibleRooms.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '40px 20px',
                  background: 'rgba(255,255,255,0.02)', borderRadius: 12,
                  color: '#475569', border: '1px dashed rgba(255,255,255,0.08)'
                }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🚪</div>
                  No rooms here yet.
                  {canManage && <div style={{ marginTop: 8 }}><button className="btn btn-primary" onClick={openAddRoom}>+ Add First Room</button></div>}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  {visibleRooms.map(room => <RoomCard key={room.id} room={room} />)}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── RIGHT: Room detail panel ── */}
        {selectedRoom && (
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, overflow: 'hidden', position: 'sticky', top: 80
          }}>
            <div style={{
              padding: '14px 16px', background: 'rgba(99,102,241,0.12)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>Room {selectedRoom.room_no}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  {selectedRoom.hostel_name} · Block {selectedRoom.block} · Floor {selectedRoom.floor}
                </div>
              </div>
              <button onClick={() => setSelectedRoom(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Capacity', value: selectedRoom.capacity },
                  { label: 'Occupied', value: selectedRoom.occupied },
                  { label: 'Available', value: selectedRoom.capacity - selectedRoom.occupied },
                  { label: 'Gender', value: selectedRoom.gender },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 6px' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#6366f1' }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                Students ({loadingStudents ? '…' : roomStudents.length})
              </div>
              {loadingStudents ? (
                <div style={{ textAlign: 'center', color: '#475569', padding: 20 }}>Loading…</div>
              ) : roomStudents.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#475569', padding: 16, fontSize: 13 }}>No students assigned</div>
              ) : roomStudents.map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: s.last_direction === 'OUT' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, flexShrink: 0
                  }}>
                    {s.last_direction === 'OUT' ? '🚶' : '🏠'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Bed {s.bed_no || '—'} · {s.dept_name || '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Hostel Modal ── */}
      {showHostelModal && (
        <div className="modal-overlay" onClick={() => setShowHostelModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <span className="modal-title">{editHostelId ? '✏️ Edit Hostel' : '🏠 Add New Hostel'}</span>
              <button className="modal-close" onClick={() => setShowHostelModal(false)}>×</button>
            </div>
            <form onSubmit={handleHostelSubmit} style={{ padding: '20px 24px' }}>
              <div className="form-group">
                <label>Hostel Name *</label>
                <input className="input" placeholder="e.g. Boys Hostel Block A" value={hostelForm.name}
                  onChange={e => setHostelForm({ ...hostelForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Gender *</label>
                <select className="input" value={hostelForm.gender} onChange={e => setHostelForm({ ...hostelForm, gender: e.target.value })}>
                  <option value="Male">♂ Boys (Male)</option>
                  <option value="Female">♀ Girls (Female)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input className="input" placeholder="Optional short description" value={hostelForm.description}
                  onChange={e => setHostelForm({ ...hostelForm, description: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowHostelModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editHostelId ? '💾 Save Changes' : '+ Create Hostel'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Room Modal ── */}
      {showRoomModal && (
        <div className="modal-overlay" onClick={() => setShowRoomModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <span className="modal-title">{editRoomId ? '✏️ Edit Room' : '🚪 Add New Room'}</span>
              <button className="modal-close" onClick={() => setShowRoomModal(false)}>×</button>
            </div>
            <form onSubmit={handleRoomSubmit} style={{ padding: '20px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label>Hostel *</label>
                  <select className="input" value={roomForm.hostel_id} onChange={e => {
                    const h = hostels.find(h => h.id === parseInt(e.target.value));
                    setRoomForm({ ...roomForm, hostel_id: e.target.value, gender: h?.gender || roomForm.gender });
                  }}>
                    <option value="">Select Hostel</option>
                    {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Room Number *</label>
                  <input className="input" placeholder="e.g. 101" value={roomForm.room_no}
                    onChange={e => setRoomForm({ ...roomForm, room_no: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Block</label>
                  <input className="input" placeholder="e.g. A" value={roomForm.block}
                    onChange={e => setRoomForm({ ...roomForm, block: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Floor</label>
                  <input className="input" type="number" min={1} max={20} value={roomForm.floor}
                    onChange={e => setRoomForm({ ...roomForm, floor: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Capacity (Beds)</label>
                  <input className="input" type="number" min={1} max={20} value={roomForm.capacity}
                    onChange={e => setRoomForm({ ...roomForm, capacity: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Gender *</label>
                  <select className="input" value={roomForm.gender} onChange={e => setRoomForm({ ...roomForm, gender: e.target.value })}>
                    <option value="Male">♂ Boys</option>
                    <option value="Female">♀ Girls</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label>Linked Institution <span style={{ color: '#475569', fontWeight: 400 }}>(optional)</span></label>
                  <select className="input" value={roomForm.institution_id} onChange={e => setRoomForm({ ...roomForm, institution_id: e.target.value })}>
                    <option value="">None (open to all)</option>
                    {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
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
