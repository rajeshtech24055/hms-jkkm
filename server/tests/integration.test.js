/**
 * HMS Backend – Integration Tests (CommonJS)
 * Real HTTP requests via Supertest against a fresh in-memory SQLite DB.
 */

const request = require('supertest');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const JWT_SECRET = 'test_secret_key';

function buildApp() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE institutions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, code TEXT UNIQUE);
    CREATE TABLE departments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, institution_id INTEGER, FOREIGN KEY (institution_id) REFERENCES institutions(id));
    CREATE TABLE rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, room_no TEXT, block TEXT, floor INTEGER DEFAULT 1, capacity INTEGER DEFAULT 4, gender TEXT DEFAULT 'Male', institution_id INTEGER);
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password_hash TEXT, role TEXT, institution_id INTEGER, dept_id INTEGER, gender TEXT, phone TEXT, active INTEGER DEFAULT 1);
    CREATE TABLE students (id INTEGER PRIMARY KEY AUTOINCREMENT, reg_no TEXT UNIQUE, name TEXT, gender TEXT DEFAULT 'Male', institution_id INTEGER, dept_id INTEGER, year TEXT, room_id INTEGER, guardian_name TEXT, guardian_phone TEXT, blood_group TEXT, mobile TEXT, email TEXT, qr_token TEXT UNIQUE, active INTEGER DEFAULT 1);
    CREATE TABLE leave_applications (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER, from_date TEXT, to_date TEXT, reason TEXT, type TEXT DEFAULT 'Home', place TEXT, is_emergency INTEGER DEFAULT 0, status TEXT DEFAULT 'Pending', created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE hostel_vacate_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER, reason TEXT, vacate_date TEXT, parent_phone TEXT, status TEXT DEFAULT 'PENDING_WARDEN', has_damage INTEGER DEFAULT 0, damage_description TEXT, fine_amount REAL DEFAULT 0, fine_paid INTEGER DEFAULT 0, warden_remarks TEXT, principal_remarks TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT);
    CREATE TABLE notices (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, type TEXT, priority TEXT DEFAULT 'Normal', posted_by TEXT, institution_id INTEGER, created_at TEXT DEFAULT (datetime('now')));
  `);

  const hash = bcrypt.hashSync('password123', 10);
  const eng = db.prepare('INSERT INTO institutions (name, code) VALUES (?, ?)').run('JKKM Engineering', 'ENG').lastInsertRowid;
  const cs  = db.prepare('INSERT INTO departments (name, institution_id) VALUES (?, ?)').run('Computer Science', eng).lastInsertRowid;
  const rm  = db.prepare('INSERT INTO rooms (room_no, block, floor, capacity, gender, institution_id) VALUES (?,?,?,?,?,?)').run('101','A',1,4,'Male',eng).lastInsertRowid;

  db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)').run('Super Admin', 'superadmin@jkkm.edu', hash, 'SUPER_ADMIN');
  db.prepare('INSERT INTO users (name,email,password_hash,role,institution_id) VALUES (?,?,?,?,?)').run('Warden', 'warden@jkkm.edu', hash, 'WARDEN', eng);
  db.prepare('INSERT INTO users (name,email,password_hash,role,institution_id) VALUES (?,?,?,?,?)').run('Principal', 'principal@jkkm.edu', hash, 'PRINCIPAL', eng);
  db.prepare('INSERT INTO users (name,email,password_hash,role,institution_id,dept_id,gender) VALUES (?,?,?,?,?,?,?)').run('Arjun Test', 'arjun@student.jkkm.edu', hash, 'STUDENT', eng, cs, 'Male');
  const stuId = db.prepare('INSERT INTO students (reg_no,name,gender,institution_id,dept_id,year,room_id,email,qr_token,active) VALUES (?,?,?,?,?,?,?,?,?,1)').run('ENG001','Arjun Test','Male',eng,cs,'2nd',rm,'arjun@student.jkkm.edu','QRTEST001').lastInsertRowid;

  const makeToken = (u) => jwt.sign(u, JWT_SECRET, { expiresIn: '1h' });
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
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
    const token = makeToken({ id: user.id, role: user.role, name: user.name, email: user.email, institution_id: user.institution_id });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email } });
  });

  app.get('/api/institutions', auth, (req, res) => res.json(db.prepare('SELECT * FROM institutions').all()));

  app.get('/api/departments', auth, (req, res) => {
    let q = `SELECT d.*, i.name as institution_name, (SELECT COUNT(*) FROM students WHERE dept_id = d.id AND active = 1) as student_count FROM departments d LEFT JOIN institutions i ON d.institution_id = i.id WHERE 1=1`;
    const p = [];
    if (req.query.institution_id) { q += ' AND d.institution_id = ?'; p.push(req.query.institution_id); }
    res.json(db.prepare(q).all(...p));
  });
  app.post('/api/departments', auth, (req, res) => {
    const { name, institution_id } = req.body;
    if (!name || !institution_id) return res.status(400).json({ error: 'Name and institution required' });
    const exists = db.prepare('SELECT id FROM departments WHERE LOWER(name) = LOWER(?) AND institution_id = ?').get(name.trim(), institution_id);
    if (exists) return res.status(400).json({ error: 'Department already exists' });
    const result = db.prepare('INSERT INTO departments (name, institution_id) VALUES (?, ?)').run(name.trim(), institution_id);
    res.json({ success: true, id: result.lastInsertRowid });
  });
  app.put('/api/departments/:id', auth, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    db.prepare('UPDATE departments SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
    res.json({ success: true });
  });
  app.delete('/api/departments/:id', auth, (req, res) => {
    const cnt = db.prepare('SELECT COUNT(*) as cnt FROM students WHERE dept_id = ? AND active = 1').get(req.params.id).cnt;
    if (cnt > 0) return res.status(400).json({ error: `Cannot delete: ${cnt} student(s) assigned` });
    db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.get('/api/students', auth, (req, res) => {
    res.json(db.prepare('SELECT s.*, d.name as dept_name FROM students s LEFT JOIN departments d ON s.dept_id = d.id WHERE s.active = 1').all());
  });
  app.post('/api/students', auth, (req, res) => {
    const { reg_no, name, gender, institution_id, dept_id, year, room_id, email, mobile } = req.body;
    if (!reg_no || !name) return res.status(400).json({ error: 'reg_no and name are required' });
    const dup = db.prepare('SELECT id FROM students WHERE reg_no = ?').get(reg_no);
    if (dup) return res.status(400).json({ error: 'Register number already exists' });
    const qr = 'QR_' + reg_no + '_' + Date.now();
    const result = db.prepare('INSERT INTO students (reg_no,name,gender,institution_id,dept_id,year,room_id,email,mobile,qr_token,active) VALUES (?,?,?,?,?,?,?,?,?,?,1)').run(reg_no,name,gender||'Male',institution_id||null,dept_id||null,year||'1st',room_id||null,email||null,mobile||null,qr);
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  });

  app.get('/api/leaves', auth, (req, res) => res.json(db.prepare('SELECT la.*, s.name as student_name, s.reg_no FROM leave_applications la JOIN students s ON la.student_id = s.id ORDER BY la.id DESC').all()));
  app.post('/api/leaves', auth, (req, res) => {
    const { student_id, from_dt, to_dt, reason, type, place } = req.body;
    if (!student_id || !from_dt || !to_dt || !reason) return res.status(400).json({ error: 'Required fields missing' });
    const result = db.prepare('INSERT INTO leave_applications (student_id,from_date,to_date,reason,type,place) VALUES (?,?,?,?,?,?)').run(student_id,from_dt,to_dt,reason,type||'Home',place||'');
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  });
  app.put('/api/leaves/:id', auth, (req, res) => {
    const { status } = req.body;
    if (!['Approved','Rejected','Pending'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    db.prepare('UPDATE leave_applications SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ success: true });
  });

  app.get('/api/vacate', auth, (req, res) => {
    let q = `SELECT v.*, s.name as student_name, s.reg_no FROM hostel_vacate_requests v JOIN students s ON v.student_id = s.id`;
    const p = [];
    if (req.user.role === 'STUDENT') { const stu = db.prepare('SELECT id FROM students WHERE email = ?').get(req.user.email); if (!stu) return res.json([]); q += ' WHERE v.student_id = ?'; p.push(stu.id); }
    res.json(db.prepare(q).all(...p));
  });
  app.post('/api/vacate', auth, (req, res) => {
    const { reason, vacate_date, parent_phone } = req.body;
    if (!reason || !vacate_date) return res.status(400).json({ error: 'reason and vacate_date required' });
    const student = db.prepare('SELECT id FROM students WHERE email = ?').get(req.user.email);
    if (!student) return res.status(400).json({ error: 'Student not found' });
    const result = db.prepare("INSERT INTO hostel_vacate_requests (student_id,reason,vacate_date,parent_phone,status) VALUES (?,?,?,?,'PENDING_WARDEN')").run(student.id,reason,vacate_date,parent_phone||null);
    res.json({ success: true, id: result.lastInsertRowid });
  });
  app.put('/api/vacate/:id/warden', auth, (req, res) => {
    const { has_damage, damage_description, fine_amount, warden_remarks } = req.body;
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
      if (v) db.prepare('UPDATE students SET active=0,room_id=NULL WHERE id=?').run(v.student_id);
    } else db.prepare("UPDATE hostel_vacate_requests SET status='REJECTED' WHERE id=?").run(req.params.id);
    res.json({ success: true });
  });

  app.get('/api/notices', auth, (req, res) => res.json(db.prepare('SELECT * FROM notices ORDER BY id DESC').all()));
  app.post('/api/notices', auth, (req, res) => {
    const { title, content, type, priority } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'title and content required' });
    const result = db.prepare('INSERT INTO notices (title,content,type,priority,posted_by) VALUES (?,?,?,?,?)').run(title,content,type||'General',priority||'Normal',req.user.name);
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  });

  return { app, db, makeToken, stuId, eng, cs };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('🔐 Authentication API', () => {
  let app, makeToken;
  beforeAll(() => ({ app, makeToken } = buildApp()));

  test('POST /api/auth/login → 200 with valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'superadmin@jkkm.edu', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('SUPER_ADMIN');
  });
  test('POST /api/auth/login → 401 with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'superadmin@jkkm.edu', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });
  test('POST /api/auth/login → 401 with unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@jkkm.edu', password: 'password123' });
    expect(res.status).toBe(401);
  });
  test('POST /api/auth/login → 400 when body is empty', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });
  test('Protected route → 401 without token', async () => {
    const res = await request(app).get('/api/institutions');
    expect(res.status).toBe(401);
  });
  test('Protected route → 401 with malformed token', async () => {
    const res = await request(app).get('/api/institutions').set('Authorization', 'Bearer badtoken');
    expect(res.status).toBe(401);
  });
});

describe('🏛️ Departments API', () => {
  let app, makeToken, eng;
  beforeAll(() => ({ app, makeToken, eng } = buildApp()));
  const adminToken = () => makeToken({ id: 1, role: 'SUPER_ADMIN', name: 'Super Admin', email: 'superadmin@jkkm.edu' });

  test('GET /api/departments → returns list', async () => {
    const res = await request(app).get('/api/departments').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('name');
  });
  test('POST /api/departments → creates new department', async () => {
    const res = await request(app).post('/api/departments').set('Authorization', `Bearer ${adminToken()}`).send({ name: 'Civil Engineering', institution_id: eng });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBeDefined();
  });
  test('POST /api/departments → 400 on duplicate name', async () => {
    await request(app).post('/api/departments').set('Authorization', `Bearer ${adminToken()}`).send({ name: 'Duplicate Dept', institution_id: eng });
    const res = await request(app).post('/api/departments').set('Authorization', `Bearer ${adminToken()}`).send({ name: 'Duplicate Dept', institution_id: eng });
    expect(res.status).toBe(400);
  });
  test('POST /api/departments → 400 when name missing', async () => {
    const res = await request(app).post('/api/departments').set('Authorization', `Bearer ${adminToken()}`).send({ institution_id: eng });
    expect(res.status).toBe(400);
  });
  test('PUT /api/departments/:id → renames department', async () => {
    const create = await request(app).post('/api/departments').set('Authorization', `Bearer ${adminToken()}`).send({ name: 'Old Name', institution_id: eng });
    const id = create.body.id;
    const res = await request(app).put(`/api/departments/${id}`).set('Authorization', `Bearer ${adminToken()}`).send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
  test('DELETE /api/departments/:id → deletes empty department', async () => {
    const create = await request(app).post('/api/departments').set('Authorization', `Bearer ${adminToken()}`).send({ name: 'To Delete', institution_id: eng });
    const id = create.body.id;
    const res = await request(app).delete(`/api/departments/${id}`).set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
  test('DELETE /api/departments/:id → 400 when students assigned', async () => {
    const depts = await request(app).get('/api/departments').set('Authorization', `Bearer ${adminToken()}`);
    const cs = depts.body.find(d => d.name === 'Computer Science');
    const res = await request(app).delete(`/api/departments/${cs.id}`).set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot delete/);
  });
});

describe('👨‍🎓 Students API', () => {
  let app, makeToken, eng, cs;
  beforeAll(() => ({ app, makeToken, eng, cs } = buildApp()));
  const adminToken = () => makeToken({ id: 1, role: 'SUPER_ADMIN', name: 'Super Admin', email: 'superadmin@jkkm.edu' });

  test('GET /api/students → returns array', async () => {
    const res = await request(app).get('/api/students').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
  test('POST /api/students → creates new student', async () => {
    const res = await request(app).post('/api/students').set('Authorization', `Bearer ${adminToken()}`).send({ reg_no: 'ENG099', name: 'Test Student', gender: 'Male', institution_id: eng, dept_id: cs, year: '1st' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
  test('POST /api/students → 400 on duplicate reg_no', async () => {
    await request(app).post('/api/students').set('Authorization', `Bearer ${adminToken()}`).send({ reg_no: 'ENG100', name: 'Dup A' });
    const res = await request(app).post('/api/students').set('Authorization', `Bearer ${adminToken()}`).send({ reg_no: 'ENG100', name: 'Dup B' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/);
  });
  test('POST /api/students → 400 when name missing', async () => {
    const res = await request(app).post('/api/students').set('Authorization', `Bearer ${adminToken()}`).send({ reg_no: 'ENG998' });
    expect(res.status).toBe(400);
  });
});

describe('📋 Leave Applications API', () => {
  let app, makeToken, stuId;
  beforeAll(() => ({ app, makeToken, stuId } = buildApp()));
  const adminToken   = () => makeToken({ id: 1, role: 'SUPER_ADMIN', name: 'Admin', email: 'superadmin@jkkm.edu' });
  const studentToken = () => makeToken({ id: 4, role: 'STUDENT', name: 'Arjun', email: 'arjun@student.jkkm.edu' });

  test('GET /api/leaves → returns array', async () => {
    const res = await request(app).get('/api/leaves').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
  test('POST /api/leaves → student can apply', async () => {
    const res = await request(app).post('/api/leaves').set('Authorization', `Bearer ${studentToken()}`).send({ student_id: stuId, from_dt: '2025-09-01', to_dt: '2025-09-03', reason: 'Family function', type: 'Home', place: 'Chennai' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
  test('POST /api/leaves → 400 when fields missing', async () => {
    const res = await request(app).post('/api/leaves').set('Authorization', `Bearer ${studentToken()}`).send({ student_id: stuId });
    expect(res.status).toBe(400);
  });
  test('PUT /api/leaves/:id → approve leave', async () => {
    const create = await request(app).post('/api/leaves').set('Authorization', `Bearer ${studentToken()}`).send({ student_id: stuId, from_dt: '2025-09-10', to_dt: '2025-09-11', reason: 'Test', type: 'Home', place: 'Home' });
    const res = await request(app).put(`/api/leaves/${create.body.id}`).set('Authorization', `Bearer ${adminToken()}`).send({ status: 'Approved' });
    expect(res.status).toBe(200);
  });
  test('PUT /api/leaves/:id → 400 for invalid status', async () => {
    const res = await request(app).put('/api/leaves/1').set('Authorization', `Bearer ${adminToken()}`).send({ status: 'GARBAGE' });
    expect(res.status).toBe(400);
  });
});

describe('🏠 Hostel Vacate Workflow API', () => {
  let app, makeToken, stuId;
  let vacateId;
  beforeAll(() => ({ app, makeToken, stuId } = buildApp()));
  const adminToken     = () => makeToken({ id: 1, role: 'SUPER_ADMIN', name: 'Admin',     email: 'superadmin@jkkm.edu' });
  const wardenToken    = () => makeToken({ id: 2, role: 'WARDEN',      name: 'Warden',    email: 'warden@jkkm.edu' });
  const principalToken = () => makeToken({ id: 3, role: 'PRINCIPAL',   name: 'Principal', email: 'principal@jkkm.edu' });
  const studentToken   = () => makeToken({ id: 4, role: 'STUDENT',     name: 'Arjun',     email: 'arjun@student.jkkm.edu' });

  test('POST /api/vacate → student submits request', async () => {
    const res = await request(app).post('/api/vacate').set('Authorization', `Bearer ${studentToken()}`).send({ reason: 'Course completed', vacate_date: '2025-12-31' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    vacateId = res.body.id;
  });
  test('GET /api/vacate → admin sees all', async () => {
    const res = await request(app).get('/api/vacate').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].status).toBe('PENDING_WARDEN');
  });
  test('GET /api/vacate → student sees only own', async () => {
    const res = await request(app).get('/api/vacate').set('Authorization', `Bearer ${studentToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.every(r => r.student_id === stuId)).toBe(true);
  });
  test('POST /api/vacate → 400 when reason missing', async () => {
    const res = await request(app).post('/api/vacate').set('Authorization', `Bearer ${studentToken()}`).send({ vacate_date: '2025-12-31' });
    expect(res.status).toBe(400);
  });
  test('Warden: no damage → PENDING_PRINCIPAL', async () => {
    const res = await request(app).put(`/api/vacate/${vacateId}/warden`).set('Authorization', `Bearer ${wardenToken()}`).send({ has_damage: false, fine_amount: 0, warden_remarks: 'Clean room' });
    expect(res.status).toBe(200);
    const updated = (await request(app).get('/api/vacate').set('Authorization', `Bearer ${adminToken()}`)).body.find(r => r.id === vacateId);
    expect(updated.status).toBe('PENDING_PRINCIPAL');
  });
  test('Principal: APPROVE → student deactivated', async () => {
    await request(app).put(`/api/vacate/${vacateId}/principal`).set('Authorization', `Bearer ${principalToken()}`).send({ decision: 'APPROVE' });
    const updated = (await request(app).get('/api/vacate').set('Authorization', `Bearer ${adminToken()}`)).body.find(r => r.id === vacateId);
    expect(updated.status).toBe('APPROVED');
    const students = (await request(app).get('/api/students').set('Authorization', `Bearer ${adminToken()}`)).body;
    expect(students.find(s => s.id === stuId)).toBeUndefined();
  });
  test('Warden assigns damage fine → PENDING_FINE_PAYMENT', async () => {
    const { app: a2, makeToken: mt2 } = buildApp();
    const st = mt2({ id: 4, role: 'STUDENT', name: 'A', email: 'arjun@student.jkkm.edu' });
    const wt = mt2({ id: 2, role: 'WARDEN', name: 'W', email: 'warden@jkkm.edu' });
    const at = mt2({ id: 1, role: 'SUPER_ADMIN', name: 'SA', email: 'superadmin@jkkm.edu' });
    const vr = await request(a2).post('/api/vacate').set('Authorization', `Bearer ${st}`).send({ reason: 'Done', vacate_date: '2025-12-31' });
    await request(a2).put(`/api/vacate/${vr.body.id}/warden`).set('Authorization', `Bearer ${wt}`).send({ has_damage: true, fine_amount: 2500, damage_description: 'Broken window' });
    const all = (await request(a2).get('/api/vacate').set('Authorization', `Bearer ${at}`)).body;
    expect(all[0].status).toBe('PENDING_FINE_PAYMENT');
    expect(all[0].fine_amount).toBe(2500);
  });
});

describe('📢 Notices API', () => {
  let app, makeToken;
  beforeAll(() => ({ app, makeToken } = buildApp()));
  const adminToken = () => makeToken({ id: 1, role: 'SUPER_ADMIN', name: 'Admin', email: 'superadmin@jkkm.edu' });

  test('GET /api/notices → returns array', async () => {
    const res = await request(app).get('/api/notices').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
  test('POST /api/notices → creates notice', async () => {
    const res = await request(app).post('/api/notices').set('Authorization', `Bearer ${adminToken()}`).send({ title: 'Test Notice', content: 'Test content.', type: 'General' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });
  test('POST /api/notices → 400 when title missing', async () => {
    const res = await request(app).post('/api/notices').set('Authorization', `Bearer ${adminToken()}`).send({ content: 'No title' });
    expect(res.status).toBe(400);
  });
  test('Notice appears in GET list', async () => {
    await request(app).post('/api/notices').set('Authorization', `Bearer ${adminToken()}`).send({ title: 'Findable', content: 'Find me.' });
    const res = await request(app).get('/api/notices').set('Authorization', `Bearer ${adminToken()}`);
    expect(res.body.some(n => n.title === 'Findable')).toBe(true);
  });
});
