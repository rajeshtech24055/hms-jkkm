/**
 * HMS Backend – System Tests (CommonJS)
 * End-to-end scenario tests simulating complete user workflows.
 */

const request = require('supertest');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const JWT_SECRET = 'system_test_secret';

function buildFullApp() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE institutions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, code TEXT UNIQUE);
    CREATE TABLE departments  (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, institution_id INTEGER);
    CREATE TABLE rooms        (id INTEGER PRIMARY KEY AUTOINCREMENT, room_no TEXT, block TEXT, floor INTEGER DEFAULT 1, capacity INTEGER DEFAULT 4, gender TEXT DEFAULT 'Male', institution_id INTEGER);
    CREATE TABLE users        (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password_hash TEXT, role TEXT, institution_id INTEGER, dept_id INTEGER, gender TEXT, phone TEXT, active INTEGER DEFAULT 1);
    CREATE TABLE students     (id INTEGER PRIMARY KEY AUTOINCREMENT, reg_no TEXT UNIQUE, name TEXT, gender TEXT DEFAULT 'Male', institution_id INTEGER, dept_id INTEGER, year TEXT, room_id INTEGER, guardian_name TEXT, guardian_phone TEXT, blood_group TEXT, mobile TEXT, email TEXT, qr_token TEXT UNIQUE, active INTEGER DEFAULT 1);
    CREATE TABLE leave_applications (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER, from_date TEXT, to_date TEXT, reason TEXT, type TEXT DEFAULT 'Home', place TEXT, is_emergency INTEGER DEFAULT 0, status TEXT DEFAULT 'Pending', created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE gate_logs    (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER, direction TEXT, method TEXT DEFAULT 'QR', logged_by INTEGER, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE hostel_vacate_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, reason TEXT, vacate_date TEXT, parent_phone TEXT, status TEXT DEFAULT 'PENDING_WARDEN', has_damage INTEGER DEFAULT 0, damage_description TEXT, fine_amount REAL DEFAULT 0, fine_paid INTEGER DEFAULT 0, warden_remarks TEXT, principal_remarks TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT);
    CREATE TABLE notices (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, type TEXT, priority TEXT DEFAULT 'Normal', posted_by TEXT, institution_id INTEGER, created_at TEXT DEFAULT (datetime('now')));
  `);

  const hash    = bcrypt.hashSync('admin123', 10);
  const stuHash = bcrypt.hashSync('student123', 10);
  const engId = db.prepare('INSERT INTO institutions (name,code) VALUES (?,?)').run('JKKM Engineering','ENG').lastInsertRowid;
  const csId  = db.prepare('INSERT INTO departments (name,institution_id) VALUES (?,?)').run('Computer Science', engId).lastInsertRowid;
  const rmId  = db.prepare('INSERT INTO rooms (room_no,block,floor,capacity,gender,institution_id) VALUES (?,?,?,?,?,?)').run('101','A',1,4,'Male',engId).lastInsertRowid;

  db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)').run('Super Admin', 'superadmin@jkkm.edu', hash, 'SUPER_ADMIN');
  db.prepare('INSERT INTO users (name,email,password_hash,role,institution_id) VALUES (?,?,?,?,?)').run('Warden',    'warden@jkkm.edu',    hash, 'WARDEN',    engId);
  db.prepare('INSERT INTO users (name,email,password_hash,role,institution_id) VALUES (?,?,?,?,?)').run('Principal', 'principal@jkkm.edu', hash, 'PRINCIPAL', engId);
  db.prepare('INSERT INTO users (name,email,password_hash,role,institution_id,dept_id,gender) VALUES (?,?,?,?,?,?,?)').run('Ravi Student', 'ravi@student.jkkm.edu', stuHash, 'STUDENT', engId, csId, 'Male');
  const stuId = db.prepare('INSERT INTO students (reg_no,name,gender,institution_id,dept_id,year,room_id,email,qr_token,active) VALUES (?,?,?,?,?,?,?,?,?,1)').run('ENG001','Ravi Student','Male',engId,csId,'2nd',rmId,'ravi@student.jkkm.edu','QRSYS001').lastInsertRowid;

  const makeToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  const auth = (req, res, next) => {
    const h = req.headers.authorization;
    if (!h) return res.status(401).json({ error: 'No token' });
    try { req.user = jwt.verify(h.split(' ')[1], JWT_SECRET); next(); }
    catch { res.status(401).json({ error: 'Invalid token' }); }
  };

  const app = express();
  app.use(cors()); app.use(express.json());

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid' });
    const token = makeToken({ id: user.id, role: user.role, name: user.name, email: user.email, institution_id: user.institution_id });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  });

  app.get('/api/students', auth, (req, res) => {
    res.json(db.prepare('SELECT s.*, d.name as dept_name FROM students s LEFT JOIN departments d ON s.dept_id = d.id WHERE s.active = 1').all());
  });
  app.post('/api/students', auth, (req, res) => {
    const { reg_no, name, gender, institution_id, dept_id, room_id, email, mobile, year } = req.body;
    if (!reg_no || !name) return res.status(400).json({ error: 'Required fields missing' });
    const qr = 'QR_' + reg_no + '_' + Date.now();
    const r = db.prepare('INSERT INTO students (reg_no,name,gender,institution_id,dept_id,year,room_id,email,mobile,qr_token,active) VALUES (?,?,?,?,?,?,?,?,?,?,1)').run(reg_no,name,gender||'Male',institution_id||null,dept_id||null,year||'1st',room_id||null,email||null,mobile||null,qr);
    if (email) db.prepare('INSERT OR IGNORE INTO users (name,email,password_hash,role,institution_id,dept_id,gender,active) VALUES (?,?,?,?,?,?,?,1)').run(name,email,bcrypt.hashSync('student123',10),'STUDENT',institution_id||null,dept_id||null,gender||'Male');
    res.status(201).json({ success: true, id: r.lastInsertRowid });
  });

  app.get('/api/leaves', auth, (req, res) => res.json(db.prepare('SELECT la.*, s.name as student_name FROM leave_applications la JOIN students s ON la.student_id = s.id ORDER BY la.id DESC').all()));
  app.post('/api/leaves', auth, (req, res) => {
    const { student_id, from_dt, to_dt, reason, type, place } = req.body;
    if (!student_id || !from_dt || !to_dt || !reason) return res.status(400).json({ error: 'Missing fields' });
    const r = db.prepare('INSERT INTO leave_applications (student_id,from_date,to_date,reason,type,place) VALUES (?,?,?,?,?,?)').run(student_id,from_dt,to_dt,reason,type||'Home',place||'');
    res.status(201).json({ success: true, id: r.lastInsertRowid });
  });
  app.put('/api/leaves/:id', auth, (req, res) => {
    const { status } = req.body;
    if (!['Approved','Rejected','Pending'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    db.prepare('UPDATE leave_applications SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ success: true });
  });

  app.get('/api/gate/scan/:token', auth, (req, res) => {
    const s = db.prepare('SELECT s.*, d.name as dept_name FROM students s LEFT JOIN departments d ON s.dept_id = d.id WHERE s.qr_token = ? AND s.active = 1').get(req.params.token);
    if (!s) return res.status(404).json({ error: 'Student not found or inactive' });
    const last = db.prepare('SELECT direction FROM gate_logs WHERE student_id = ? ORDER BY id DESC LIMIT 1').get(s.id);
    const nextDir = (!last || last.direction === 'IN') ? 'OUT' : 'IN';
    db.prepare('INSERT INTO gate_logs (student_id, direction, logged_by) VALUES (?,?,?)').run(s.id, nextDir, req.user.id);
    res.json({ student: s, direction: nextDir, logged: true });
  });

  app.get('/api/notices', auth, (req, res) => res.json(db.prepare('SELECT * FROM notices ORDER BY id DESC').all()));
  app.post('/api/notices', auth, (req, res) => {
    const { title, content, type, priority } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'title and content required' });
    const r = db.prepare('INSERT INTO notices (title,content,type,priority,posted_by) VALUES (?,?,?,?,?)').run(title,content,type||'General',priority||'Normal',req.user.name);
    res.status(201).json({ success: true, id: r.lastInsertRowid });
  });

  app.get('/api/vacate', auth, (req, res) => {
    let q = `SELECT v.*, s.name as student_name, s.reg_no FROM hostel_vacate_requests v JOIN students s ON v.student_id = s.id`;
    const p = [];
    if (req.user.role === 'STUDENT') { const stu = db.prepare('SELECT id FROM students WHERE email = ?').get(req.user.email); if (!stu) return res.json([]); q += ' WHERE v.student_id = ?'; p.push(stu.id); }
    res.json(db.prepare(q).all(...p));
  });
  app.post('/api/vacate', auth, (req, res) => {
    const { reason, vacate_date } = req.body;
    if (!reason || !vacate_date) return res.status(400).json({ error: 'Missing fields' });
    const stu = db.prepare('SELECT id FROM students WHERE email = ?').get(req.user.email);
    if (!stu) return res.status(400).json({ error: 'Student not found' });
    const r = db.prepare("INSERT INTO hostel_vacate_requests (student_id,reason,vacate_date,status) VALUES (?,?,?,'PENDING_WARDEN')").run(stu.id,reason,vacate_date);
    res.json({ success: true, id: r.lastInsertRowid });
  });
  app.put('/api/vacate/:id/warden', auth, (req, res) => {
    const { has_damage, fine_amount, damage_description, warden_remarks } = req.body;
    if (has_damage && fine_amount > 0) db.prepare("UPDATE hostel_vacate_requests SET status='PENDING_FINE_PAYMENT',has_damage=1,damage_description=?,fine_amount=?,warden_remarks=? WHERE id=?").run(damage_description||'Damage',fine_amount,warden_remarks||null,req.params.id);
    else db.prepare("UPDATE hostel_vacate_requests SET status='PENDING_PRINCIPAL',has_damage=0,fine_paid=1,warden_remarks=? WHERE id=?").run(warden_remarks||'Clean',req.params.id);
    res.json({ success: true });
  });
  app.put('/api/vacate/:id/pay-fine', auth, (req, res) => {
    db.prepare("UPDATE hostel_vacate_requests SET fine_paid=1,status='PENDING_PRINCIPAL' WHERE id=?").run(req.params.id);
    res.json({ success: true });
  });
  app.put('/api/vacate/:id/principal', auth, (req, res) => {
    const { decision } = req.body;
    if (decision === 'APPROVE') {
      db.prepare("UPDATE hostel_vacate_requests SET status='APPROVED' WHERE id=?").run(req.params.id);
      const v = db.prepare('SELECT student_id FROM hostel_vacate_requests WHERE id=?').get(req.params.id);
      if (v) { db.prepare('UPDATE students SET active=0,room_id=NULL WHERE id=?').run(v.student_id); db.prepare('UPDATE users SET active=0 WHERE email=(SELECT email FROM students WHERE id=?)').run(v.student_id); }
    } else db.prepare("UPDATE hostel_vacate_requests SET status='REJECTED' WHERE id=?").run(req.params.id);
    res.json({ success: true });
  });

  return { app, db, makeToken, stuId, engId, csId, rmId };
}

// ════════════════════════════════════════════════════════════════════════════
//  SYSTEM TEST 1 – Full Leave Application Workflow
// ════════════════════════════════════════════════════════════════════════════
describe('🔄 SYSTEM TEST 1 — Complete Leave Application Workflow', () => {
  let app, makeToken, stuId, leaveId;
  let adminTok, studentTok;
  beforeAll(() => {
    ({ app, makeToken, stuId } = buildFullApp());
    adminTok   = makeToken({ id: 1, role: 'SUPER_ADMIN', name: 'Admin', email: 'superadmin@jkkm.edu' });
    studentTok = makeToken({ id: 4, role: 'STUDENT',     name: 'Ravi',  email: 'ravi@student.jkkm.edu' });
  });

  test('Step 1: Admin logs in successfully', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'superadmin@jkkm.edu', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });
  test('Step 2: Student submits leave application', async () => {
    const res = await request(app).post('/api/leaves').set('Authorization', `Bearer ${studentTok}`).send({ student_id: stuId, from_dt: '2025-09-01', to_dt: '2025-09-05', reason: 'Family function', type: 'Home', place: 'Coimbatore' });
    expect(res.status).toBe(201);
    leaveId = res.body.id;
  });
  test('Step 3: Admin sees the pending leave', async () => {
    const res = await request(app).get('/api/leaves').set('Authorization', `Bearer ${adminTok}`);
    const leave = res.body.find(l => l.id === leaveId);
    expect(leave).toBeDefined();
    expect(leave.status).toBe('Pending');
    expect(leave.student_name).toBe('Ravi Student');
  });
  test('Step 4: Admin approves the leave', async () => {
    const res = await request(app).put(`/api/leaves/${leaveId}`).set('Authorization', `Bearer ${adminTok}`).send({ status: 'Approved' });
    expect(res.status).toBe(200);
  });
  test('Step 5: Leave status is now Approved', async () => {
    const res = await request(app).get('/api/leaves').set('Authorization', `Bearer ${adminTok}`);
    const leave = res.body.find(l => l.id === leaveId);
    expect(leave.status).toBe('Approved');
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  SYSTEM TEST 2 – Full Vacate Workflow with Damage Fine
// ════════════════════════════════════════════════════════════════════════════
describe('🔄 SYSTEM TEST 2 — Hostel Vacate with Damage Fine Workflow', () => {
  let app, db, makeToken, stuId, vacateId;
  let adminTok, wardenTok, principalTok, studentTok;
  beforeAll(() => {
    ({ app, db, makeToken, stuId } = buildFullApp());
    adminTok     = makeToken({ id: 1, role: 'SUPER_ADMIN', name: 'Admin',     email: 'superadmin@jkkm.edu' });
    wardenTok    = makeToken({ id: 2, role: 'WARDEN',      name: 'Warden',    email: 'warden@jkkm.edu' });
    principalTok = makeToken({ id: 3, role: 'PRINCIPAL',   name: 'Principal', email: 'principal@jkkm.edu' });
    studentTok   = makeToken({ id: 4, role: 'STUDENT',     name: 'Ravi',      email: 'ravi@student.jkkm.edu' });
  });

  test('Step 1: Student submits vacate request', async () => {
    const res = await request(app).post('/api/vacate').set('Authorization', `Bearer ${studentTok}`).send({ reason: 'Course completed', vacate_date: '2025-12-31', parent_phone: '9876500000' });
    expect(res.status).toBe(200);
    vacateId = res.body.id;
  });
  test('Step 2: Initial status is PENDING_WARDEN', async () => {
    const res = await request(app).get('/api/vacate').set('Authorization', `Bearer ${adminTok}`);
    expect(res.body.find(v => v.id === vacateId).status).toBe('PENDING_WARDEN');
  });
  test('Step 3: Warden assigns ₹1500 damage fine', async () => {
    const res = await request(app).put(`/api/vacate/${vacateId}/warden`).set('Authorization', `Bearer ${wardenTok}`).send({ has_damage: true, fine_amount: 1500, damage_description: 'Broken window', warden_remarks: 'Damage found' });
    expect(res.status).toBe(200);
  });
  test('Step 4: Status is PENDING_FINE_PAYMENT with correct fine', async () => {
    const vac = (await request(app).get('/api/vacate').set('Authorization', `Bearer ${adminTok}`)).body.find(v => v.id === vacateId);
    expect(vac.status).toBe('PENDING_FINE_PAYMENT');
    expect(vac.fine_amount).toBe(1500);
    expect(vac.fine_paid).toBe(0);
  });
  test('Step 5: Fine marked paid → forward to Principal', async () => {
    await request(app).put(`/api/vacate/${vacateId}/pay-fine`).set('Authorization', `Bearer ${wardenTok}`).send({});
    const vac = (await request(app).get('/api/vacate').set('Authorization', `Bearer ${adminTok}`)).body.find(v => v.id === vacateId);
    expect(vac.status).toBe('PENDING_PRINCIPAL');
    expect(vac.fine_paid).toBe(1);
  });
  test('Step 6: Principal approves vacate', async () => {
    const res = await request(app).put(`/api/vacate/${vacateId}/principal`).set('Authorization', `Bearer ${principalTok}`).send({ decision: 'APPROVE' });
    expect(res.status).toBe(200);
  });
  test('Step 7: APPROVED and student deactivated', async () => {
    const vac = (await request(app).get('/api/vacate').set('Authorization', `Bearer ${adminTok}`)).body.find(v => v.id === vacateId);
    expect(vac.status).toBe('APPROVED');
    const students = (await request(app).get('/api/students').set('Authorization', `Bearer ${adminTok}`)).body;
    expect(students.find(s => s.id === stuId)).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  SYSTEM TEST 3 – Student Admission & Gate Entry Workflow
// ════════════════════════════════════════════════════════════════════════════
describe('🔄 SYSTEM TEST 3 — New Student Admission + Gate Entry', () => {
  let app, makeToken, engId, csId, rmId;
  let adminTok, gateTok, newStudentQR, newStudentId;
  beforeAll(() => {
    ({ app, makeToken, engId, csId, rmId } = buildFullApp());
    adminTok = makeToken({ id: 1, role: 'SUPER_ADMIN', name: 'Admin', email: 'superadmin@jkkm.edu' });
    gateTok  = makeToken({ id: 1, role: 'GATE_STAFF',  name: 'Gate',  email: 'superadmin@jkkm.edu' });
  });

  test('Step 1: Admin creates a new student', async () => {
    const res = await request(app).post('/api/students').set('Authorization', `Bearer ${adminTok}`).send({ reg_no: 'ENG999', name: 'Newly Admitted Kumar', gender: 'Male', institution_id: engId, dept_id: csId, room_id: rmId, year: '1st', email: 'kumar999@student.jkkm.edu', mobile: '9999900001' });
    expect(res.status).toBe(201);
    newStudentId = res.body.id;
  });
  test('Step 2: New student appears in active list', async () => {
    const res = await request(app).get('/api/students').set('Authorization', `Bearer ${adminTok}`);
    const stu = res.body.find(s => s.id === newStudentId);
    expect(stu).toBeDefined();
    expect(stu.name).toBe('Newly Admitted Kumar');
    newStudentQR = stu.qr_token;
  });
  test('Step 3: First gate scan → OUT', async () => {
    const res = await request(app).get(`/api/gate/scan/${newStudentQR}`).set('Authorization', `Bearer ${gateTok}`);
    expect(res.status).toBe(200);
    expect(res.body.direction).toBe('OUT');
    expect(res.body.student.name).toBe('Newly Admitted Kumar');
  });
  test('Step 4: Second gate scan → IN', async () => {
    const res = await request(app).get(`/api/gate/scan/${newStudentQR}`).set('Authorization', `Bearer ${gateTok}`);
    expect(res.status).toBe(200);
    expect(res.body.direction).toBe('IN');
  });
  test('Step 5: Invalid QR → 404', async () => {
    const res = await request(app).get('/api/gate/scan/INVALID_TOKEN_XYZ').set('Authorization', `Bearer ${gateTok}`);
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  SYSTEM TEST 4 – Notice Board Workflow
// ════════════════════════════════════════════════════════════════════════════
describe('🔄 SYSTEM TEST 4 — Notice Board Publish & View Workflow', () => {
  let app, makeToken, adminTok, studentTok, noticeId;
  beforeAll(() => {
    ({ app, makeToken } = buildFullApp());
    adminTok   = makeToken({ id: 1, role: 'SUPER_ADMIN', name: 'Admin', email: 'superadmin@jkkm.edu' });
    studentTok = makeToken({ id: 4, role: 'STUDENT',     name: 'Ravi',  email: 'ravi@student.jkkm.edu' });
  });

  test('Step 1: Initially no notices', async () => {
    const res = await request(app).get('/api/notices').set('Authorization', `Bearer ${adminTok}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
  test('Step 2: Admin posts a high-priority notice', async () => {
    const res = await request(app).post('/api/notices').set('Authorization', `Bearer ${adminTok}`).send({ title: 'Gate Closing Time Changed', content: 'Gates close at 9:30 PM effective Monday.', type: 'Rules', priority: 'High' });
    expect(res.status).toBe(201);
    noticeId = res.body.id;
  });
  test('Step 3: Student can read the notice', async () => {
    const res = await request(app).get('/api/notices').set('Authorization', `Bearer ${studentTok}`);
    const notice = res.body.find(n => n.id === noticeId);
    expect(notice).toBeDefined();
    expect(notice.title).toBe('Gate Closing Time Changed');
    expect(notice.priority).toBe('High');
    expect(notice.posted_by).toBe('Admin');
  });
  test('Step 4: Two notices, most recent first', async () => {
    await request(app).post('/api/notices').set('Authorization', `Bearer ${adminTok}`).send({ title: 'Holiday Notice', content: 'Closed on Independence Day.' });
    const res = await request(app).get('/api/notices').set('Authorization', `Bearer ${studentTok}`);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0].title).toBe('Holiday Notice');
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  SYSTEM TEST 5 – Vacate REJECTION Workflow
// ════════════════════════════════════════════════════════════════════════════
describe('🔄 SYSTEM TEST 5 — Vacate Request Rejection Workflow', () => {
  let app, makeToken, stuId, vacateId;
  let adminTok, wardenTok, principalTok, studentTok;
  beforeAll(() => {
    ({ app, makeToken, stuId } = buildFullApp());
    adminTok     = makeToken({ id: 1, role: 'SUPER_ADMIN', name: 'Admin',     email: 'superadmin@jkkm.edu' });
    wardenTok    = makeToken({ id: 2, role: 'WARDEN',      name: 'Warden',    email: 'warden@jkkm.edu' });
    principalTok = makeToken({ id: 3, role: 'PRINCIPAL',   name: 'Principal', email: 'principal@jkkm.edu' });
    studentTok   = makeToken({ id: 4, role: 'STUDENT',     name: 'Ravi',      email: 'ravi@student.jkkm.edu' });
  });

  test('Step 1: Student submits vacate request', async () => {
    const res = await request(app).post('/api/vacate').set('Authorization', `Bearer ${studentTok}`).send({ reason: 'Wants to vacate', vacate_date: '2025-11-30' });
    expect(res.status).toBe(200);
    vacateId = res.body.id;
  });
  test('Step 2: Warden clears room (no damage)', async () => {
    const res = await request(app).put(`/api/vacate/${vacateId}/warden`).set('Authorization', `Bearer ${wardenTok}`).send({ has_damage: false, fine_amount: 0, warden_remarks: 'Clean' });
    expect(res.status).toBe(200);
  });
  test('Step 3: Principal REJECTS the vacate', async () => {
    const res = await request(app).put(`/api/vacate/${vacateId}/principal`).set('Authorization', `Bearer ${principalTok}`).send({ decision: 'REJECT', principal_remarks: 'Pending dues.' });
    expect(res.status).toBe(200);
  });
  test('Step 4: Status is REJECTED, student still active', async () => {
    const vac = (await request(app).get('/api/vacate').set('Authorization', `Bearer ${adminTok}`)).body.find(v => v.id === vacateId);
    expect(vac.status).toBe('REJECTED');
    const students = (await request(app).get('/api/students').set('Authorization', `Bearer ${adminTok}`)).body;
    expect(students.find(s => s.id === stuId)).toBeDefined();
  });
});
