import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { exportStudentsPDF, exportStudentsExcel } from '../utils/exportUtils';


function generateAvatarDataUrl(name, dept, gender) {
  const canvas = document.createElement('canvas');
  canvas.width = 200; canvas.height = 200;
  const ctx = canvas.getContext('2d');
  const COLORS = {
    'Computer Science': '#6366f1', 'Mechanical Engineering': '#0ea5e9',
    'Electrical Engineering': '#f59e0b', 'Agricultural Science': '#10b981',
    'Horticulture': '#34d399', 'Pharmaceutical Science': '#a855f7',
    'Pharmaceutical Chemistry': '#ec4899',
  };
  const bgColor = COLORS[dept] || (gender === 'Female' ? '#ec4899' : '#6366f1');
  const gradient = ctx.createLinearGradient(0, 0, 200, 200);
  gradient.addColorStop(0, bgColor);
  gradient.addColorStop(1, bgColor + '88');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 200, 200);

  // Draw concentric circles for visual depth
  ctx.beginPath(); ctx.arc(100, 100, 90, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(100, 100, 70, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2; ctx.stroke();

  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = 'bold 72px Inter, Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(initials, 100, 100);
  return canvas.toDataURL('image/png');
}

function HostelCard({ student, qrData }) {
  const instBadgeColor = { ENG: '#6366f1', AGRI: '#10b981', PHARM: '#f59e0b' };
  const color = instBadgeColor[student.institution_code] || '#6366f1';
  const avatarUrl = generateAvatarDataUrl(student.name, student.dept_name, student.gender);

  const handlePrint = () => {
    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <html><head><title>Hostel Card - ${student.name}</title>
      <style>
        body { margin: 0; background: #0f0f1a; font-family: Inter, Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .card { width: 360px; background: linear-gradient(135deg, #1a1a2e, #16213e); border-radius: 20px; padding: 24px; color: white; border: 1px solid #2a2a45; box-shadow: 0 20px 60px rgba(0,0,0,0.8); }
        .header { display: flex; justify-content: space-between; margin-bottom: 16px; }
        .inst { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: ${color}; }
        .title { font-size: 11px; color: #94a3b8; margin-top: 2px; }
        .chip { width: 36px; height: 28px; background: linear-gradient(135deg,#fbbf24,#f59e0b); border-radius: 6px; opacity: 0.8; }
        .photo-row { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; }
        .avatar { width: 80px; height: 80px; border-radius: 14px; border: 2px solid rgba(255,255,255,0.15); }
        .name { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
        .reg { font-size: 14px; font-weight: 700; color: ${color}; font-family: monospace; letter-spacing: 0.08em; }
        .dept { font-size: 12px; color: #94a3b8; margin-top: 2px; }
        .details { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
        .detail { background: rgba(255,255,255,0.04); border-radius: 8px; padding: 8px; }
        .detail span { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; display: block; }
        .detail strong { font-size: 12px; color: white; }
        .qr-row { display: flex; justify-content: space-between; align-items: flex-end; }
        .barcode { font-size: 28px; letter-spacing: -1px; color: rgba(255,255,255,0.7); font-family: monospace; }
        .status { background: rgba(16,185,129,0.2); color: #34d399; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head><body>
      <div class="card">
        <div class="header">
          <div><div class="inst">JKKM ${student.institution_code} — HOSTEL</div><div class="title">Student Identity Card</div></div>
          <div class="chip"></div>
        </div>
        <div class="photo-row">
          <img src="${avatarUrl}" class="avatar" />
          <div>
            <div class="name">${student.name}</div>
            <div class="reg">${student.reg_no}</div>
            <div class="dept">${student.dept_name}</div>
          </div>
        </div>
        <div class="details">
          <div class="detail"><span>Year</span><strong>${student.year}</strong></div>
          <div class="detail"><span>Room</span><strong>${student.room_no || 'N/A'}</strong></div>
          <div class="detail"><span>Block</span><strong>${student.block || 'N/A'}</strong></div>
          <div class="detail"><span>Blood Group</span><strong>${student.blood_group || 'N/A'}</strong></div>
        </div>
        <div class="qr-row">
          ${qrData ? `<img src="${qrData}" style="width:150px;height:150px;border-radius:8px;background:white;padding:4px;" />` : '<div></div>'}
          <div>
            <div class="barcode">||||| ||||| |||||</div>
            <div style="font-size:10px;color:#64748b;text-align:center;letter-spacing:0.05em;">${student.reg_no}</div>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;">
          <div class="status">● ACTIVE</div>
          <div style="font-size:9px;color:#475569;">JKKM Institutions · 2026</div>
        </div>
      </div></body></html>`);
    printWin.document.close();
    setTimeout(() => printWin.print(), 500);
  };

  return (
    <div>
      <div className="hostel-card" style={{ '--card-color': color }}>
        {/* Decorative element */}
        <div style={{ position: 'absolute', bottom: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle, ${color}22, transparent)`, pointerEvents: 'none' }} />

        <div className="hostel-card-header">
          <div>
            <div className="hostel-card-inst" style={{ color }}>JKKM {student.institution_code} — HOSTEL</div>
            <div className="hostel-card-title">Student Identity Card</div>
          </div>
          <div className="hostel-card-chip" />
        </div>

        <div className="hostel-card-photo-row">
          <div className="hostel-card-avatar" style={{ background: `linear-gradient(135deg, ${color}33, ${color}11)` }}>
            <img src={avatarUrl} alt={student.name} style={{ width: '100%', height: '100%', borderRadius: 12, objectFit: 'cover' }} />
          </div>
          <div className="hostel-card-info">
            <h3>{student.name}</h3>
            <div className="hostel-card-reg">{student.reg_no}</div>
            <p>{student.dept_name}</p>
          </div>
        </div>

        <div className="hostel-card-details">
          {[
            { label: 'Year', value: student.year },
            { label: 'Room', value: student.room_no || 'N/A' },
            { label: 'Block', value: student.block || 'N/A' },
            { label: 'Blood Group', value: student.blood_group || 'N/A' },
          ].map(d => (
            <div key={d.label} className="hostel-card-detail">
              <span>{d.label}</span>
              <strong>{d.value}</strong>
            </div>
          ))}
        </div>

        <div className="hostel-card-qr-row">
          {qrData
            ? <img src={qrData} alt="QR" style={{ width: 150, height: 150, background: 'white', borderRadius: 10, padding: 4 }} />
            : <div style={{ width: 150, height: 150, background: 'var(--bg-input)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>⏳</div>
          }
          <div style={{ textAlign: 'right' }}>
            <div className="hostel-card-barcode">|||||||||||||</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, fontFamily: 'monospace', letterSpacing: '0.06em' }}>{student.reg_no}</div>
            <div className="hostel-card-status" style={{ marginTop: 8 }}>
              <span>●</span> ACTIVE
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, textAlign: 'right', fontSize: 9, color: 'var(--text-dim)' }}>
          JKKM Institutions · {new Date().getFullYear()}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={handlePrint}>🖨️ Print Card</button>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const { api, user } = useAuth();
  const canManage = ['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(user?.role);
  const [students, setStudents] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [assigningStudent, setAssigningStudent] = useState(null);
  const [assignRoomId, setAssignRoomId] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterInst, setFilterInst] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterActive, setFilterActive] = useState('active');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promoteForm, setPromoteForm] = useState({ batch: '', from_year: '', to_year: '' });
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const defaultForm = { reg_no:'', name:'', gender:'Male', institution_id:'', dept_id:'', year:'1st', batch:'2024-2028', room_id:'', guardian_name:'', guardian_phone:'', guardian_email:'', blood_group:'O+', mobile:'', email:'', dob:'' };
  const [form, setForm] = useState(defaultForm);

  const fetchStudents = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterInst) params.append('institution_id', filterInst);
    if (filterDept) params.append('dept_id', filterDept);
    if (filterYear) params.append('year', filterYear);
    if (filterGender) params.append('gender', filterGender);
    if (filterActive) params.append('active', filterActive);
    api(`/api/students?${params}`).then(setStudents).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    api('/api/institutions').then(setInstitutions);
    api('/api/departments').then(setDepartments);
    api('/api/rooms').then(setRooms);
  }, [api]);

  useEffect(() => { fetchStudents(); }, [api, filterInst, filterDept, filterYear, filterGender, filterActive]);

  const openCard = async (student) => {
    setSelectedStudent(student);
    setQrData(null);
    try {
      const { qr } = await api(`/api/students/${student.id}/qr`);
      setQrData(qr);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editId ? `/api/students/${editId}` : '/api/students';
      const method = editId ? 'PUT' : 'POST';
      const payload = {
        ...form,
        institution_id: parseInt(form.institution_id),
        dept_id: parseInt(form.dept_id),
        room_id: form.room_id ? parseInt(form.room_id) : null,
        bed_no: parseInt(form.bed_no) || 1
      };
      if (isNaN(payload.institution_id) || isNaN(payload.dept_id)) {
         return alert("Please select a valid institution and department.");
      }
      const result = await api(url, { method, body: JSON.stringify(payload) });
      const msg = result?.message || (editId ? 'Student updated successfully!' : 'Student added successfully!');
      alert(msg);
      setShowAdd(false);
      setEditId(null);
      setForm(defaultForm);
      fetchStudents();
    } catch (err) {
      alert(`Error ${editId ? 'updating' : 'adding'} student: ` + err.message);
    }
  };

  const openEdit = (s) => {
    setForm({
      reg_no: s.reg_no || '',
      name: s.name || '',
      gender: s.gender || 'Male',
      institution_id: s.institution_id || '',
      dept_id: s.dept_id || '',
      year: s.year || '1st',
      batch: s.batch || '2024-2028',
      room_id: s.room_id || '',
      guardian_name: s.guardian_name || '',
      guardian_phone: s.guardian_phone || '',
      guardian_email: s.guardian_email || '',
      blood_group: s.blood_group || 'O+',
      mobile: s.mobile || '',
      email: s.email || '',
      dob: s.dob || ''
    });
    setEditId(s.id);
    setShowAdd(true);
  };


  const openAssignRoom = (student) => {
    setAssigningStudent(student);
    setAssignRoomId(student.room_id || '');
    setShowRoomModal(true);
  };

  const handleAssignRoom = async (e) => {
    e.preventDefault();
    setAssignSaving(true);
    try {
      await api(`/api/students/${assigningStudent.id}/room`, {
        method: 'PUT',
        body: JSON.stringify({ room_id: assignRoomId ? parseInt(assignRoomId) : null })
      });
      setShowRoomModal(false);
      fetchStudents();
    } catch (err) { alert('Error: ' + err.message); }
    finally { setAssignSaving(false); }
  };

  const handleVacate = async (student) => {
    if (!window.confirm(`Are you sure you want to vacate ${student.name} (${student.reg_no}) from the hostel? This will unassign Room ${student.room_no || 'N/A'} and mark them as Vacated.`)) {
      return;
    }
    try {
      await api(`/api/students/${student.id}/vacate`, { method: 'POST' });
      fetchStudents();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleReadmit = async (student) => {
    if (!window.confirm(`Re-admit ${student.name} back to active hostel status?`)) {
      return;
    }
    try {
      await api(`/api/students/${student.id}/reactivate`, { method: 'POST' });
      fetchStudents();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ── Photo Upload ──────────────────────────────────────────────────────────
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef(null);

  const handlePhotoUpload = async (student, file) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return alert('Photo must be under 3MB');
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await fetch(`/api/students/${student.id}/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('hms_token')}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Update student in local list
      setStudents(prev => prev.map(s => s.id === student.id ? { ...s, photo_url: data.photo_url } : s));
      if (selectedStudent?.id === student.id) setSelectedStudent(s => ({ ...s, photo_url: data.photo_url }));
      alert('Photo uploaded successfully!');
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setPhotoUploading(false);
    }
  };


  const handlePromoteSubmit = async (e) => {
    e.preventDefault();
    if (!['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(user?.role)) {
      return alert('You do not have permission to perform this action.');
    }
    if (!promoteForm.to_year) return alert('Please select the next year to promote to.');
    
    const msg = `⚠️ WARNING: ACADEMIC YEAR PROMOTION ⚠️\n\nThis will promote students from ${promoteForm.from_year || 'ALL YEARS'} to ${promoteForm.to_year} for batch ${promoteForm.batch || 'ALL BATCHES'}.\n\nAre you sure you want to proceed? This action cannot be undone easily.`;
    if (!window.confirm(msg)) return;
    
    try {
      const res = await api('/api/students/promote', { method: 'POST', body: JSON.stringify(promoteForm) });
      alert(res.message);
      setShowPromoteModal(false);
      fetchStudents();
    } catch (err) {
      alert('Error promoting students: ' + err.message);
    }
  };

  const INST_BADGE = { ENG: 'badge-eng', AGRI: 'badge-agri', PHARM: 'badge-pharm' };
  const GENDER_ICON = { Male: '👨', Female: '👩' };

  const filteredStudents = students.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.reg_no?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-enter">
      <div className="section-header">
        <h2>👥 Students Management</h2>
        <div style={{ display:'flex', gap:8 }}>
          {canManage && (
            <button className="btn btn-ghost" style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }} onClick={() => setShowPromoteModal(true)}>🎓 Bulk Promote Year</button>
          )}
          <button className="btn btn-ghost" onClick={() => exportStudentsPDF(filteredStudents)} title="Export PDF">📄 PDF</button>
          <button className="btn btn-ghost" onClick={() => exportStudentsExcel(filteredStudents)} title="Export Excel">📊 Excel</button>
          {canManage && <button className="btn btn-primary" onClick={() => { setForm(defaultForm); setEditId(null); setShowAdd(true); }}>+ Add Student</button>}
        </div>
      </div>


      <div className="filter-row">
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-icon">🔍</span>
          <input className="form-input" placeholder="Search name or reg no..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input" style={{ width: 'auto' }} value={filterActive} onChange={e => setFilterActive(e.target.value)}>
          <option value="active">Active Hostelers</option>
          <option value="vacated">Vacated Hostelers</option>
          <option value="all">All Statuses</option>
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filterInst} onChange={e => setFilterInst(e.target.value)}>
          <option value="">All Institutions</option>
          {institutions.map(i => <option key={i.id} value={i.id}>{i.code}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="">All Departments</option>
          {departments.filter(d => !filterInst || d.institution_id == filterInst).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          <option value="">All Years</option>
          {['1st','2nd','3rd','4th'].map(y => <option key={y} value={y}>{y} Year</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto' }} value={filterGender} onChange={e => setFilterGender(e.target.value)}>
          <option value="">Both</option>
          <option value="Male">Boys</option>
          <option value="Female">Girls</option>
        </select>
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
                  <th>Reg. No</th>
                  <th>Institution</th>
                  <th>Department</th>
                  <th>Year</th>
                  <th>Room</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s => {
                  const avatarUrl = generateAvatarDataUrl(s.name, s.dept_name, s.gender);
                  const isVacated = s.active === 0;
                  return (
                    <tr key={s.id} style={{ opacity: isVacated ? 0.7 : 1 }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <img src={avatarUrl} alt={s.name} className="table-img" />
                          <div>
                            <div style={{ fontWeight: 600 }}>{s.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><code style={{ color: 'var(--primary-light)', fontWeight: 700 }}>{s.reg_no}</code></td>
                      <td><span className={`badge ${INST_BADGE[s.institution_code] || 'badge-gray'}`}>{s.institution_code}</span></td>
                      <td style={{ fontSize: 13 }}>{s.dept_name}</td>
                      <td><span className="badge badge-gray">{s.year}</span></td>
                      <td>
                        {s.room_no ? (
                          <div>
                            <div style={{ fontWeight:600, fontSize:13 }}>Room {s.room_no}</div>
                            {canManage && <button className="btn btn-sm" style={{ fontSize:10, padding:'2px 8px', marginTop:3, background:'var(--surface-2)' }} onClick={() => openAssignRoom(s)}>✏️ Change</button>}
                          </div>
                        ) : (
                          canManage && <button className="btn btn-sm btn-primary" style={{ fontSize:11 }} onClick={() => openAssignRoom(s)}>🛏️ Assign Room</button>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${isVacated ? 'badge-danger' : 'badge-success'}`}>
                          {isVacated ? 'VACATED' : 'ACTIVE'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {canManage && <button className="btn btn-sm btn-ghost" onClick={() => openEdit(s)}>✏️ Edit</button>}
                          <button className="btn btn-sm btn-primary" onClick={() => openCard(s)}>🪪 Card</button>
                          {!isVacated ? (
                            canManage && <button className="btn btn-sm btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleVacate(s)} title="Vacate Student">
                              🚪 Vacate
                            </button>
                          ) : (
                            canManage && <button className="btn btn-sm btn-outline" style={{ color: 'var(--success)', borderColor: 'var(--success)' }} onClick={() => handleReadmit(s)} title="Re-admit Student">
                              🔄 Re-admit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredStudents.length === 0 && (
                  <tr><td colSpan={8}><div className="empty-state"><div className="empty-icon">👥</div><p>No students found</p></div></td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Student Card Modal */}
      {selectedStudent && (
        <div className="modal-overlay" onClick={() => setSelectedStudent(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">🪪 Hostel Card</span>
              <button className="modal-close" onClick={() => setSelectedStudent(null)}>×</button>
            </div>
            <HostelCard student={selectedStudent} qrData={qrData} />

            {/* Photo Upload Section */}
            <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {selectedStudent.photo_url ? (
                  <img src={selectedStudent.photo_url} alt="Student"
                    style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', border: '2px solid var(--primary)' }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📷</div>
                )}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    {selectedStudent.photo_url ? '✅ Photo uploaded' : '📷 No photo yet'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>JPG/PNG, max 3MB</div>
                </div>
                <input type="file" accept="image/*" style={{ display: 'none' }} ref={photoInputRef}
                  onChange={e => handlePhotoUpload(selectedStudent, e.target.files[0])} />
                <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }}
                  onClick={() => photoInputRef.current?.click()} disabled={photoUploading}>
                  {photoUploading ? '⏳...' : selectedStudent.photo_url ? '🔄 Change' : '📤 Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Add Student Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => { setShowAdd(false); setEditId(null); }}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editId ? '✏️ Edit Student' : '➕ Add New Student'}</span>
              <button className="modal-close" onClick={() => { setShowAdd(false); setEditId(null); }}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Register No *</label>
                  <input className="form-input" required value={form.reg_no} onChange={e => setForm(f => ({ ...f, reg_no: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender *</label>
                  <select className="form-input" required value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                    <option>Male</option><option>Female</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Year *</label>
                  <select className="form-input" required value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))}>
                    <option value="">Select Year</option>
                    {['1st','2nd','3rd','4th'].map(y => <option key={y} value={y}>{y} Year</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Batch (e.g. 2024-2028)</label>
                  <input className="form-input" placeholder="2024-2028" value={form.batch} onChange={e => setForm(f => ({ ...f, batch: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Institution *</label>
                  <select className="form-input" required value={form.institution_id} onChange={e => setForm(f => ({ ...f, institution_id: e.target.value }))}>
                    <option value="">Select</option>
                    {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Department *</label>
                  <select className="form-input" required value={form.dept_id} onChange={e => setForm(f => ({ ...f, dept_id: e.target.value }))}>
                    <option value="">Select</option>
                    {departments.filter(d => !form.institution_id || d.institution_id == form.institution_id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile *</label>
                  <input className="form-input" required pattern="[0-9]{10}" title="10 digit mobile number" value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-input" required type="email" pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$" title="Valid email address (e.g., name@example.com)" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Guardian Name *</label>
                  <input className="form-input" required value={form.guardian_name} onChange={e => setForm(f => ({ ...f, guardian_name: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label className="form-label">Room Assignment *</label>
                  <select className="form-input" required value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))}>
                    <option value="">Select Room</option>
                    {rooms
                      .filter(r => 
                        (!form.institution_id || !r.institution_id || r.institution_id == form.institution_id) && 
                        (!form.gender || r.gender === form.gender) && 
                        ((editId && r.id === parseInt(form.room_id)) || (r.capacity - (r.occupied || 0) > 0))
                      )
                      .map(r => <option key={r.id} value={r.id}>{r.room_no} ({r.block} Block) — {r.occupied || 0}/{r.capacity} occ.</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Guardian Phone *</label>
                  <input className="form-input" required pattern="[0-9]{10}" title="10 digit mobile number" value={form.guardian_phone} onChange={e => setForm(f => ({ ...f, guardian_phone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Blood Group *</label>
                  <select className="form-input" value={form.blood_group} onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))}>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg}>{bg}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Birth *</label>
                  <input className="form-input" type="date" required value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>🔐 DOB will be used as default login password (DDMMYYYY format)</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-ghost" onClick={() => { setShowAdd(false); setEditId(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editId ? '💾 Save Changes' : 'Register Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROMOTE YEAR MODAL */}
      {showPromoteModal && (
        <div className="modal-overlay" onClick={() => setShowPromoteModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">🎓 Promote Students</span>
              <button className="modal-close" onClick={() => setShowPromoteModal(false)}>×</button>
            </div>
            <form onSubmit={handlePromoteSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Target Batch (Optional)</label>
                <input className="form-input" placeholder="e.g. 2024-2028" value={promoteForm.batch} onChange={e => setPromoteForm(f => ({ ...f, batch: e.target.value }))} />
                <small style={{ color: 'var(--text-muted)' }}>Leave blank to apply to all batches.</small>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">From Year (Optional)</label>
                  <select className="form-input" value={promoteForm.from_year} onChange={e => setPromoteForm(f => ({ ...f, from_year: e.target.value }))}>
                    <option value="">All Years</option>
                    {['1st','2nd','3rd','4th'].map(y => <option key={y} value={y}>{y} Year</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">To Year *</label>
                  <select className="form-input" required value={promoteForm.to_year} onChange={e => setPromoteForm(f => ({ ...f, to_year: e.target.value }))}>
                    <option value="">Select Next Year</option>
                    {['1st','2nd','3rd','4th'].map(y => <option key={y} value={y}>{y} Year</option>)}
                    <option value="Alumni">Alumni</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>✅ Confirm Promotion</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowPromoteModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN ROOM MODAL */}
      {showRoomModal && assigningStudent && (
        <div className="modal-overlay" onClick={() => setShowRoomModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">🛏️ Assign Room — {assigningStudent.name}</span>
              <button className="modal-close" onClick={() => setShowRoomModal(false)}>×</button>
            </div>
            <form onSubmit={handleAssignRoom} style={{ padding: '20px 24px' }}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Select Room</label>
                <select className="form-input" value={assignRoomId} onChange={e => setAssignRoomId(e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {rooms
                    .filter(r => 
                      (!assigningStudent.institution_id || !r.institution_id || r.institution_id == assigningStudent.institution_id) && 
                      r.gender === assigningStudent.gender &&
                      (r.id === assigningStudent.room_id || (r.capacity - (r.occupied || 0) > 0))
                    )
                    .map(r => (
                      <option key={r.id} value={r.id}>
                        Room {r.room_no} — Block {r.block} ({r.occupied || 0}/{r.capacity} occupied)
                      </option>
                    ))}
                </select>
                <small style={{ color: 'var(--text-muted)', marginTop: 6, display: 'block' }}>
                  Showing {assigningStudent.gender === 'Male' ? 'Boys' : 'Girls'} hostel rooms for {assigningStudent.institution_code || 'this institution'}
                </small>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={assignSaving}>
                  {assignSaving ? 'Saving...' : '✅ Save Assignment'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowRoomModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}