const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const QRCode = require('qrcode');
const multer = require('multer');
const fs = require('fs');

const db = require('./db/database');
const JWT_SECRET = 'jkkm_hms_secret_2026';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── MULTER — Photo Upload ────────────────────────────────────────────────────
const photoDir = path.join(__dirname, 'uploads', 'photos');
if (!fs.existsSync(photoDir)) fs.mkdirSync(photoDir, { recursive: true });
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, photoDir),
  filename: (req, file, cb) => cb(null, `student_${req.params.id}_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage: photoStorage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files allowed'));
    cb(null, true);
  }
});

// In-memory OTP store: { email -> { otp, expiresAt } }
const otpStore = {};

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please login again.', expired: true });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  // ✅ 8-hour token — permanently fixes "Invalid token after restart" bug
  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email, institution_id: user.institution_id, dept_id: user.dept_id, year: user.year, gender: user.gender },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email, institution_id: user.institution_id, dept_id: user.dept_id, year: user.year, gender: user.gender } });
});

// ─── FORGOT PASSWORD — Step 1: Generate OTP ───────────────────────────────────
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'No account found with this email' });
  // Generate 6-digit OTP, valid for 10 minutes
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = { otp, expiresAt: Date.now() + 10 * 60 * 1000, name: user.name };
  // In production: send email via Nodemailer. For now return in response (dev mode)
  console.log(`🔑 OTP for ${email}: ${otp}`);
  res.json({ success: true, message: 'OTP sent to your email', otp_dev: otp }); // remove otp_dev in production
});

// ─── FORGOT PASSWORD — Step 2: Verify OTP & Set New Password ─────────────────
app.post('/api/auth/reset-password', (req, res) => {
  const { email, otp, new_password } = req.body;
  if (!email || !otp || !new_password) return res.status(400).json({ error: 'Email, OTP, and new password are required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const stored = otpStore[email];
  if (!stored) return res.status(400).json({ error: 'No OTP requested for this email. Please request again.' });
  if (Date.now() > stored.expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }
  if (stored.otp !== otp) return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
  // OTP valid — update password
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, email);
  delete otpStore[email];
  res.json({ success: true, message: 'Password reset successful! Please login with your new password.' });
});

// ─── CHANGE PASSWORD (logged in user) ────────────────────────────────────────
app.post('/api/auth/change-password', auth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both current and new passwords are required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash)) return res.status(400).json({ error: 'Current password is incorrect' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(new_password, 10), req.user.id);
  res.json({ success: true, message: 'Password changed successfully' });
});


// ─── USER MANAGEMENT (STAFF/ADMINS) ───────────────────────────────────────────
app.get('/api/users', auth, (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.phone, u.gender, u.year, u.institution_id, u.dept_id, i.name as institution_name, d.name as dept_name
    FROM users u
    LEFT JOIN institutions i ON u.institution_id = i.id
    LEFT JOIN departments d ON u.dept_id = d.id
    WHERE u.active = 1 AND u.role != 'STUDENT'
    ORDER BY u.role, u.name
  `).all();
  res.json(users);
});

app.post('/api/users', auth, (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const { name, email, role, phone, gender, institution_id, dept_id, year } = req.body;
  if (!name || !email || !role) return res.status(400).json({ error: 'Name, email and role are required' });
  if (role === 'TUTOR' && (!dept_id || !year)) {
    return res.status(400).json({ error: 'Department and Year are required for Class Tutors' });
  }
  if (role === 'HOD' && !dept_id) {
    return res.status(400).json({ error: 'Department is required for HODs' });
  }
  
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Email already exists' });
  
  const passwordHash = bcrypt.hashSync('admin123', 10);
  
  db.prepare(`
    INSERT INTO users (name, email, password_hash, role, institution_id, dept_id, year, gender, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, email, passwordHash, role, institution_id || null, dept_id || null, year || null, gender || null, phone || null);
  
  res.json({ success: true, message: 'User created successfully. Default password is admin123' });
});

app.put('/api/users/:id', auth, (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const { name, email, role, phone, gender, institution_id, dept_id, year } = req.body;
  if (!name || !email || !role) return res.status(400).json({ error: 'Name, email and role are required' });
  
  const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.params.id);
  if (existing) return res.status(400).json({ error: 'Email already exists' });
  
  db.prepare(`
    UPDATE users 
    SET name = ?, email = ?, role = ?, phone = ?, gender = ?, institution_id = ?, dept_id = ?, year = ?
    WHERE id = ?
  `).run(name, email, role, phone || null, gender || null, institution_id || null, dept_id || null, year || null, req.params.id);
  
  res.json({ success: true, message: 'User updated successfully' });
});

app.delete('/api/users/:id', auth, (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  if (req.user.id === parseInt(req.params.id)) return res.status(400).json({ error: 'Cannot delete yourself' });
  
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'User deactivated' });
});

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────
app.get('/api/dashboard/stats', auth, (req, res) => {
  const totalStudents = db.prepare('SELECT COUNT(*) as count FROM students WHERE active = 1').get().count;
  const totalRooms = db.prepare('SELECT COUNT(*) as count FROM rooms').get().count;
  const insideNow = db.prepare(`SELECT COUNT(DISTINCT student_id) as count FROM entry_exit_logs WHERE direction='OUT' AND id IN (SELECT MAX(id) FROM entry_exit_logs WHERE flagged=0 GROUP BY student_id)`).get().count;
  const pendingLeaves = db.prepare("SELECT COUNT(*) as count FROM leave_applications WHERE status='pending'").get().count;
  const lowStock = db.prepare('SELECT COUNT(*) as count FROM mess_materials_tools_items WHERE current_stock <= reorder_level').get().count;
  const openMaintenance = db.prepare("SELECT COUNT(*) as count FROM maintenance_requests WHERE status != 'completed'").get().count;
  const openComplaints = db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status IN ('open','in_progress')").get().count;
  res.json({ totalStudents, totalRooms, studentsOutside: insideNow, pendingLeaves, lowStock, openMaintenance, openComplaints });
});

// ─── INSTITUTIONS ─────────────────────────────────────────────────────────────
app.get('/api/institutions', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM institutions').all());
});

// ─── STUDENTS ────────────────────────────────────────────────────────────────
app.get('/api/students', auth, (req, res) => {
  let query = `SELECT s.*, i.name as institution_name, i.code as institution_code, d.name as dept_name, r.room_no, r.block
    FROM students s
    LEFT JOIN institutions i ON s.institution_id = i.id
    LEFT JOIN departments d ON s.dept_id = d.id
    LEFT JOIN rooms r ON s.room_id = r.id
    WHERE 1=1`;
  const params = [];
  if (req.query.active === 'vacated' || req.query.active === '0') {
    query += ' AND s.active = 0';
  } else if (req.query.active !== 'all') {
    query += ' AND s.active = 1';
  }
  
  // Strict Scoping for TUTOR and HOD
  if (req.user.role === 'HOD') {
    query += ' AND s.dept_id = ?';
    params.push(req.user.dept_id);
  } else if (req.user.role === 'TUTOR') {
    query += ' AND s.dept_id = ?';
    params.push(req.user.dept_id);
    if (req.user.year) {
      query += ' AND s.year = ?';
      params.push(req.user.year);
    }
  } else {
    // Super admins / others can filter by dept_id via query
    if (req.query.dept_id) { query += ' AND s.dept_id = ?'; params.push(req.query.dept_id); }
  }

  if (req.query.institution_id) { query += ' AND s.institution_id = ?'; params.push(req.query.institution_id); }
  if (req.query.year) { query += ' AND s.year = ?'; params.push(req.query.year); }
  if (req.query.gender) { query += ' AND s.gender = ?'; params.push(req.query.gender); }
  res.json(db.prepare(query).all(...params));
});

app.get('/api/students/:id', auth, (req, res) => {
  const student = db.prepare(`SELECT s.*, i.name as institution_name, i.code as institution_code, d.name as dept_name, r.room_no, r.block
    FROM students s
    LEFT JOIN institutions i ON s.institution_id = i.id
    LEFT JOIN departments d ON s.dept_id = d.id
    LEFT JOIN rooms r ON s.room_id = r.id
    WHERE s.id = ?`).get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Not found' });
  res.json(student);
});

app.post('/api/students', auth, (req, res) => {
  try {
      if (!['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Unauthorized' });
    const { reg_no, name, gender, institution_id, dept_id, year, room_id, guardian_name, guardian_phone, guardian_email, blood_group, mobile, email } = req.body;
    
    if (!reg_no || !name) {
      return res.status(400).json({ error: 'Register Number and Full Name are required.' });
    }

    const instId = (institution_id !== '' && institution_id !== null && institution_id !== undefined) ? parseInt(institution_id) : null;
    const deptId = (dept_id !== '' && dept_id !== null && dept_id !== undefined) ? parseInt(dept_id) : null;
    const roomId = (room_id !== '' && room_id !== null && room_id !== undefined) ? parseInt(room_id) : null;

    const existing = db.prepare('SELECT id FROM students WHERE reg_no = ?').get(reg_no);
    if (existing) {
      return res.status(400).json({ error: `Student with Register No '${reg_no}' already exists.` });
    }

    const token = Math.random().toString(36).substring(2, 10).toUpperCase();
    const stmt = db.prepare(`INSERT INTO students (reg_no, name, gender, institution_id, dept_id, year, room_id, guardian_name, guardian_phone, guardian_email, blood_group, mobile, email, qr_token, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`);
    const result = stmt.run(reg_no, name, gender || 'Male', instId, deptId, year || '1st', roomId, guardian_name || null, guardian_phone || null, guardian_email || null, blood_group || 'O+', mobile || null, email || null, token);

    if (email) {
      const passwordHash = bcrypt.hashSync('student123', 10);
      db.prepare(`INSERT OR IGNORE INTO users (name, email, password_hash, role, institution_id, dept_id, gender, phone)
        VALUES (?, ?, ?, 'STUDENT', ?, ?, ?, ?)`)
        .run(name, email, passwordHash, instId, deptId, gender || 'Male', mobile || null);
    }

    res.json({ id: result.lastInsertRowid, message: 'Student added successfully' });
  } catch (err) {
    console.error('Error adding student:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/students/:id', auth, (req, res) => {
  if (!['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Unauthorized' });
  const { reg_no, name, gender, institution_id, dept_id, year, guardian_name, guardian_phone, guardian_email, blood_group, mobile, email } = req.body;
  
  if (!reg_no || !name) return res.status(400).json({ error: 'Register Number and Full Name are required.' });

  const instId = (institution_id !== '' && institution_id !== null && institution_id !== undefined) ? parseInt(institution_id) : null;
  const deptId = (dept_id !== '' && dept_id !== null && dept_id !== undefined) ? parseInt(dept_id) : null;

  const existing = db.prepare('SELECT id FROM students WHERE reg_no = ? AND id != ?').get(reg_no, req.params.id);
  if (existing) return res.status(400).json({ error: `Student with Register No '${reg_no}' already exists.` });

  db.prepare(`
    UPDATE students 
    SET reg_no = ?, name = ?, gender = ?, institution_id = ?, dept_id = ?, year = ?, guardian_name = ?, guardian_phone = ?, guardian_email = ?, blood_group = ?, mobile = ?, email = ?
    WHERE id = ?
  `).run(reg_no, name, gender || 'Male', instId, deptId, year || '1st', guardian_name || null, guardian_phone || null, guardian_email || null, blood_group || 'O+', mobile || null, email || null, req.params.id);

  // Sync user account email and name if exists
  if (email) {
    db.prepare('UPDATE users SET name = ?, email = ?, dept_id = ?, year = ?, gender = ? WHERE email = (SELECT email FROM students WHERE id = ? LIMIT 1)').run(name, email, deptId, year || '1st', gender || 'Male', req.params.id);
  }

  res.json({ success: true, message: 'Student updated successfully' });
});

// Quick Room Assignment
app.put('/api/students/:id/room', auth, (req, res) => {
  const { room_id } = req.body;
  const roomId = (room_id !== '' && room_id !== null && room_id !== undefined) ? parseInt(room_id) : null;
  db.prepare('UPDATE students SET room_id = ? WHERE id = ?').run(roomId, req.params.id);
  res.json({ success: true, message: roomId ? 'Room assigned' : 'Room unassigned' });
});

// Bulk Promote Students
app.post('/api/students/promote', auth, (req, res) => {
  if (!['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Unauthorized to perform year promotion' });
  }

  // Use a transaction for atomic update
  const promoteTransaction = db.transaction(() => {
    // 4th year -> Alumni & Inactive & clear room
    db.prepare(`UPDATE students SET year = 'Alumni', active = 0, room_id = NULL WHERE year = '4th' AND active = 1`).run();
    // 3rd -> 4th
    db.prepare(`UPDATE students SET year = '4th' WHERE year = '3rd' AND active = 1`).run();
    // 2nd -> 3rd
    db.prepare(`UPDATE students SET year = '3rd' WHERE year = '2nd' AND active = 1`).run();
    // 1st -> 2nd
    db.prepare(`UPDATE students SET year = '2nd' WHERE year = '1st' AND active = 1`).run();
  });

  try {
    promoteTransaction();
    if (global.auditLog) {
      global.auditLog(req, 'Academic Year Promotion', 'students', null, 'Bulk promoted all active students to their next academic year');
    }
    res.json({ success: true, message: 'All students successfully promoted to the next academic year.' });
  } catch (err) {
    console.error('Promotion error:', err);
    res.status(500).json({ error: 'Failed to promote students' });
  }
});

app.post('/api/students/:id/vacate', auth, (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  db.prepare('UPDATE students SET active = 0, room_id = NULL WHERE id = ?').run(req.params.id);
  if (student.email) {
    db.prepare('UPDATE users SET active = 0 WHERE email = ?').run(student.email);
  }
  res.json({ success: true, message: `Student ${student.name} has been vacated from the hostel.` });
});

app.post('/api/students/:id/reactivate', auth, (req, res) => {
  const { room_id } = req.body || {};
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  db.prepare('UPDATE students SET active = 1, room_id = ? WHERE id = ?').run(room_id || null, req.params.id);
  if (student.email) {
    db.prepare('UPDATE users SET active = 1 WHERE email = ?').run(student.email);
  }
  res.json({ success: true, message: `Student ${student.name} has been reactivated.` });
});

// ─── QR CODE GENERATION ───────────────────────────────────────────────────────
app.get('/api/students/:id/qr', auth, async (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Not found' });
  
  // DYNAMIC QR: Generate a 60-second JWT token (refreshed automatically by client)
  const dynamicToken = jwt.sign(
    { id: student.id, reg_no: student.reg_no, type: 'GATE_PASS' },
    JWT_SECRET,
    { expiresIn: '60s' } 
  );
  
  const data = JSON.stringify({ id: student.id, reg: student.reg_no, token: dynamicToken });
  const qr = await QRCode.toDataURL(data, { width: 200, margin: 1 });
  res.json({ qr, expiresAt: Date.now() + 60000 });
});

// ─── STUDENT PHOTO UPLOAD ─────────────────────────────────────────────────────
app.post('/api/students/:id/photo', auth, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  // Delete old photo if exists
  if (student.photo_url) {
    const oldPath = path.join(__dirname, student.photo_url.replace('/uploads/', 'uploads/'));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  const photoUrl = `/uploads/photos/${req.file.filename}`;
  db.prepare('UPDATE students SET photo_url = ? WHERE id = ?').run(photoUrl, req.params.id);
  res.json({ success: true, photo_url: photoUrl });
});


// ─── ROOMS ───────────────────────────────────────────────────────────────────
app.get('/api/rooms', auth, (req, res) => {
  let query = `SELECT r.*, i.name as institution_name, i.code as institution_code,
    COUNT(s.id) as occupied
    FROM rooms r
    LEFT JOIN institutions i ON r.institution_id = i.id
    LEFT JOIN students s ON s.room_id = r.id AND s.active = 1
    WHERE 1=1`;
  const params = [];
  if (req.query.institution_id) { query += ' AND r.institution_id = ?'; params.push(req.query.institution_id); }
  if (req.query.gender) { query += ' AND r.gender = ?'; params.push(req.query.gender); }
  query += ' GROUP BY r.id';
  res.json(db.prepare(query).all(...params));
});

app.get('/api/rooms/:id/students', auth, (req, res) => {
  const students = db.prepare(`SELECT s.*, i.code as institution_code, d.name as dept_name,
    (SELECT direction FROM entry_exit_logs WHERE student_id = s.id AND flagged=0 ORDER BY id DESC LIMIT 1) as last_direction
    FROM students s
    LEFT JOIN institutions i ON s.institution_id = i.id
    LEFT JOIN departments d ON s.dept_id = d.id
    WHERE s.room_id = ? AND s.active = 1`).all(req.params.id);
  res.json(students);
});

app.post('/api/rooms', auth, (req, res) => {
    if (!['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Unauthorized' });
  const { room_no, block, floor, capacity, gender, institution_id } = req.body;
  const result = db.prepare('INSERT INTO rooms (room_no, block, floor, capacity, gender, institution_id) VALUES (?,?,?,?,?,?)').run(room_no, block, floor, capacity, gender, institution_id);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/rooms/:id', auth, (req, res) => {
  if (!['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Unauthorized' });
  const { room_no, block, floor, capacity, gender, institution_id } = req.body;
  db.prepare('UPDATE rooms SET room_no = ?, block = ?, floor = ?, capacity = ?, gender = ?, institution_id = ? WHERE id = ?').run(room_no, block, floor, capacity, gender, institution_id, req.params.id);
  res.json({ success: true, message: 'Room updated successfully' });
});

app.delete('/api/rooms/:id', auth, (req, res) => {
  if (!['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  const id = req.params.id;
  // Unassign all students from this room first
  db.prepare('UPDATE students SET room_id = NULL WHERE room_id = ?').run(id);
  db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
  res.json({ success: true, message: 'Room deleted and students unassigned' });
});


// ─── ENTRY / EXIT ─────────────────────────────────────────────────────────────
app.get('/api/gate/log', auth, (req, res) => {
  const logs = db.prepare(`SELECT el.*, s.name, s.reg_no, s.gender, i.code as institution_code, d.name as dept_name
    FROM entry_exit_logs el
    JOIN students s ON el.student_id = s.id
    LEFT JOIN institutions i ON s.institution_id = i.id
    LEFT JOIN departments d ON s.dept_id = d.id
    ORDER BY el.id DESC LIMIT 100`).all();
  res.json(logs);
});

app.post('/api/gate/scan', auth, (req, res) => {
    if (!['SUPER_ADMIN', 'GATE_STAFF'].includes(req.user.role)) return res.status(403).json({ error: 'Only Gate Staff can scan' });
  const { reg_no, token } = req.body;
  
  // DYNAMIC QR VERIFICATION
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.reg_no?.toUpperCase() !== reg_no?.toUpperCase() || decoded.type !== 'GATE_PASS') {
        return res.json({ success: false, reason: 'QR Code tampered or mismatch.' });
      }
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.json({ success: false, reason: 'Expired QR! Screenshots are not allowed.' });
      }
      return res.json({ success: false, reason: 'Invalid QR signature.' });
    }
  }

  const student = db.prepare('SELECT s.*, i.name as institution_name, i.code as institution_code, d.name as dept_name, r.room_no FROM students s LEFT JOIN institutions i ON s.institution_id=i.id LEFT JOIN departments d ON s.dept_id=d.id LEFT JOIN rooms r ON s.room_id=r.id WHERE (UPPER(s.reg_no)=UPPER(?) OR s.qr_token=?) AND s.active=1').get(reg_no, reg_no);
  if (!student) return res.json({ success: false, reason: 'Student not found', student: null });

  const lastLog = db.prepare('SELECT * FROM entry_exit_logs WHERE student_id = ? AND flagged = 0 ORDER BY id DESC LIMIT 1').get(student.id);
  const direction = (!lastLog || lastLog.direction === 'IN') ? 'OUT' : 'IN';

  let activeLeaveForOut = null;
  // Check if approved to exit
  if (direction === 'OUT') {
    const now = new Date().toISOString();
    activeLeaveForOut = db.prepare(`SELECT * FROM leave_applications WHERE student_id=? AND status='approved' AND from_dt <= ? AND to_dt >= ?`).get(student.id, now, now);
    if (!activeLeaveForOut) {
      db.prepare('INSERT INTO entry_exit_logs (student_id, direction, authorized, flagged, flag_reason, created_at) VALUES (?,?,0,1,?,?)').run(student.id, 'OUT', 'No approved leave', new Date().toISOString());
      return res.json({ success: false, reason: 'No approved leave — Gate remains closed', student, direction: 'OUT' });
    }
  }

  db.prepare('INSERT INTO entry_exit_logs (student_id, direction, authorized, flagged, created_at) VALUES (?,?,1,0,?)').run(student.id, direction, new Date().toISOString());

  // Parent Notification Trigger for GATE_OUT & LATE_IN
  let notificationSent = null;
  const nowStr = new Date().toISOString();
  
  if (direction === 'OUT') {
    if (activeLeaveForOut) {
       // Mark the leave as used!
       db.prepare(`UPDATE leave_applications SET status='used' WHERE id=?`).run(activeLeaveForOut.id);
    }
    
    const parentPhone = student.guardian_phone || student.mobile || '9876501000';
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg = `ALERT: Your ward ${student.name} (${student.reg_no}) checked OUT of JKKM Hostel at ${timeStr}.`;
    db.prepare('INSERT INTO notification_logs (recipient_phone, student_id, student_name, type, message, status, sent_at) VALUES (?,?,?,?,?,?,?)')
      .run(parentPhone, student.id, student.name, 'GATE_OUT', msg, 'SENT', nowStr);
    notificationSent = { recipient: parentPhone, message: msg };
  } else if (direction === 'IN') {
    // Find the used leave
    const usedLeave = db.prepare(`SELECT * FROM leave_applications WHERE student_id=? AND status='used' ORDER BY id DESC LIMIT 1`).get(student.id);
    if (usedLeave) {
       // Complete it so it cannot be reused
       db.prepare(`UPDATE leave_applications SET status='completed' WHERE id=?`).run(usedLeave.id);
       
       // Check for late return
       if (usedLeave.to_dt < nowStr) {
         // Late! Imposing fine & alerting parents
         const fineAmount = 500;
         const parentPhone = student.guardian_phone || student.mobile || '9876501000';
         const msg = `LATE RETURN ALERT: Your ward ${student.name} returned late from leave. A disciplinary fine of ₹${fineAmount} has been imposed.`;
         
         // Log SMS
         db.prepare('INSERT INTO notification_logs (recipient_phone, student_id, student_name, type, message, status, sent_at) VALUES (?,?,?,?,?,?,?)')
           .run(parentPhone, student.id, student.name, 'LATE_IN', msg, 'SENT', nowStr);
           
         // Add Fine
         db.prepare('INSERT INTO fines (student_id, amount, reason, status, created_at) VALUES (?,?,?,?,?)')
           .run(student.id, fineAmount, 'Late return from leave', 'UNPAID', nowStr);
           
         notificationSent = { recipient: parentPhone, message: msg, isLate: true, fine: fineAmount };
       }
    }
  }

  res.json({ success: true, direction, student, notificationSent });
});

// ─── STUDENTS CURRENTLY OUTSIDE ───────────────────────────────────────────────
app.get('/api/gate/outside', auth, (req, res) => {
  let query = `SELECT s.*, i.name as institution_name, i.code as institution_code, d.name as dept_name, r.room_no,
    el.created_at as exit_time, la.from_dt, la.to_dt, la.type as leave_type
    FROM students s
    JOIN entry_exit_logs el ON el.student_id = s.id
    LEFT JOIN institutions i ON s.institution_id = i.id
    LEFT JOIN departments d ON s.dept_id = d.id
    LEFT JOIN rooms r ON s.room_id = r.id
    LEFT JOIN leave_applications la ON la.student_id = s.id AND la.status='approved'
    WHERE el.id = (SELECT MAX(id) FROM entry_exit_logs WHERE student_id = s.id AND flagged=0)
    AND el.direction = 'OUT' AND s.active = 1`;
  const params = [];
  if (req.user.role === 'HOD') {
    query += ' AND s.dept_id = ?';
    params.push(req.user.dept_id);
  } else if (req.user.role === 'TUTOR') {
    query += ' AND s.dept_id = ?';
    params.push(req.user.dept_id);
    if (req.user.year) {
      query += ' AND s.year = ?';
      params.push(req.user.year);
    }
  }
  const outside = db.prepare(query).all(...params);
  res.json(outside);
});

// ─── LEAVE APPLICATIONS ───────────────────────────────────────────────────────
app.get('/api/leaves', auth, (req, res) => {
  let query = `SELECT la.*, s.name as student_name, s.reg_no, s.gender, i.name as institution_name, i.code as institution_code, d.name as dept_name, s.year
    FROM leave_applications la
    JOIN students s ON la.student_id = s.id
    LEFT JOIN institutions i ON s.institution_id = i.id
    LEFT JOIN departments d ON s.dept_id = d.id
    WHERE 1=1`;
  const params = [];
  
  if (req.user.role === 'HOD') {
    query += ' AND s.dept_id = ?';
    params.push(req.user.dept_id);
  } else if (req.user.role === 'TUTOR') {
    query += ' AND s.dept_id = ?';
    params.push(req.user.dept_id);
    if (req.user.year) {
      query += ' AND s.year = ?';
      params.push(req.user.year);
    }
  }

  if (req.query.status) { query += ' AND la.status = ?'; params.push(req.query.status); }
  if (req.query.student_id) { query += ' AND la.student_id = ?'; params.push(req.query.student_id); }
  if (req.query.institution_id) { query += ' AND s.institution_id = ?'; params.push(req.query.institution_id); }
  query += ' ORDER BY la.id DESC';
  res.json(db.prepare(query).all(...params));
});


app.delete('/api/leaves/:id', auth, (req, res) => {
  const leave = db.prepare('SELECT * FROM leave_applications WHERE id = ?').get(req.params.id);
  if (!leave) return res.status(404).json({ error: 'Leave not found' });
  // Only the student who owns it can delete, and only if still pending
  if (req.user.role === 'STUDENT' && leave.student_id !== req.user.id) return res.status(403).json({ error: 'You can only cancel your own leave' });
    if (leave.status !== 'pending') return res.status(400).json({ error: 'Cannot cancel a leave that has already been processed' });
  db.prepare('DELETE FROM leave_applications WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Leave application cancelled' });
});

app.post('/api/leaves', auth, (req, res) => {
  let { student_id, type, reason, from_dt, to_dt, place, is_emergency } = req.body;

  // 1. Data Isolation / Security Check
  if (req.user.role === 'STUDENT') {
    const student = db.prepare('SELECT id FROM students WHERE email = ?').get(req.user.email);
    if (!student) return res.status(403).json({ error: 'Student record not found.' });
    student_id = student.id; // Override to prevent spoofing
  } else if (!student_id) {
    return res.status(400).json({ error: 'Student ID is required for staff applications.' });
  }

  // 2. Logical Check: Prevent overlapping leaves
  const overlapping = db.prepare(`
    SELECT id FROM leave_applications 
    WHERE student_id = ? AND status IN ('pending', 'approved', 'used')
    AND (
      (from_dt <= ? AND to_dt >= ?) OR
      (from_dt <= ? AND to_dt >= ?) OR
      (from_dt >= ? AND to_dt <= ?)
    )
  `).get(student_id, to_dt, from_dt, from_dt, from_dt, from_dt, to_dt);

  if (overlapping) {
    return res.status(400).json({ error: 'You already have an active leave application during these dates.' });
  }

  const status = 'pending';
  const current_level = is_emergency ? 1 : 1;
  const result = db.prepare(`INSERT INTO leave_applications (student_id, type, reason, from_dt, to_dt, place, is_emergency, status, current_level, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(student_id, type, reason, from_dt, to_dt, place, is_emergency ? 1 : 0, status, current_level, new Date().toISOString());
  
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
  const studentName = student?.name || 'Student';

  // Audit
  if (global.auditLog) {
    global.auditLog(req, 'Leave Applied', 'leave_applications', result.lastInsertRowid, `Leave applied by ${studentName} for ${from_dt}`);
  }

  // Real-time Notification
  if (global.io) {
    global.io.to('WARDEN').emit('notification', `New leave request from ${studentName}`);
    if (is_emergency) global.io.to('PRINCIPAL').emit('notification', `🚨 EMERGENCY leave request from ${studentName}`);
  }

  let notificationSent = null;
  if (is_emergency) {
    const parentPhone = student?.guardian_phone || student?.mobile || '9876501000';
    const msg = `EMERGENCY LEAVE ALERT: Your ward ${studentName} applied for emergency leave to ${place || 'Home'} (${from_dt} to ${to_dt}). Reason: ${reason || 'Emergency'}.`;
    db.prepare('INSERT INTO notification_logs (recipient_phone, student_id, student_name, type, message, status, sent_at) VALUES (?,?,?,?,?,?,?)')
      .run(parentPhone, student_id, studentName, 'EMERGENCY_LEAVE', msg, 'SENT', new Date().toISOString());
    notificationSent = { recipient: parentPhone, message: msg };
  }

  res.json({ id: result.lastInsertRowid, message: 'Leave applied', notificationSent });
});

app.post('/api/leaves/:id/approve', auth, (req, res) => {
  const { decision, reason } = req.body;
  const leave = db.prepare('SELECT * FROM leave_applications WHERE id = ?').get(req.params.id);
  if (!leave) return res.status(404).json({ error: 'Not found' });

  const maxLevel = leave.is_emergency ? 1 : 4;
  let newStatus = leave.status;
  let newLevel = leave.current_level;

  if (decision === 'reject') {
    newStatus = 'rejected';
  } else {
    if (leave.current_level >= maxLevel) {
      newStatus = 'approved';
    } else {
      newLevel = leave.current_level + 1;
    }
  }

  db.prepare('UPDATE leave_applications SET status=?, current_level=? WHERE id=?').run(newStatus, newLevel, leave.id);
  db.prepare('INSERT INTO leave_approvals (application_id, approver_id, level, decision, reason, created_at) VALUES (?,?,?,?,?,?)').run(leave.id, req.user.id, leave.current_level, decision, reason || null, new Date().toISOString());

  if (global.auditLog) {
    global.auditLog(req, `Leave ${decision}`, 'leave_applications', leave.id, `Status updated to ${newStatus}`);
  }
  if (global.io) {
    global.io.to('STUDENT').emit('notification', `Your leave has been ${newStatus.toUpperCase()}`);
  }

  res.json({ message: 'Done', status: newStatus, next_level: newLevel });
});

app.post('/api/leaves/bulk-approve', auth, (req, res) => {
    if (!['SUPER_ADMIN', 'HOSTEL_ADMIN', 'PRINCIPAL', 'WARDEN', 'TUTOR', 'HOD'].includes(req.user.role)) return res.status(403).json({ error: 'Unauthorized' });
  const { ids, decision, reason } = req.body;
  const results = [];
  for (const id of ids) {
    const leave = db.prepare('SELECT * FROM leave_applications WHERE id = ?').get(id);
    if (!leave) continue;
    const maxLevel = leave.is_emergency ? 1 : 4;
    let newStatus = leave.status;
    let newLevel = leave.current_level;
    if (decision === 'reject') {
      newStatus = 'rejected';
    } else {
      if (leave.current_level >= maxLevel) newStatus = 'approved';
      else newLevel = leave.current_level + 1;
    }
    db.prepare('UPDATE leave_applications SET status=?, current_level=? WHERE id=?').run(newStatus, newLevel, id);
    db.prepare('INSERT INTO leave_approvals (application_id, approver_id, level, decision, reason, created_at) VALUES (?,?,?,?,?,?)').run(id, req.user.id, leave.current_level, decision, reason || null, new Date().toISOString());
    results.push({ id, status: newStatus });
  }
  res.json({ results });
});

// ─── DEPARTMENTS ──────────────────────────────────────────────────────────────
app.get('/api/departments', auth, (req, res) => {
  let q = `SELECT d.*, i.name as institution_name, i.code as institution_code,
             (SELECT COUNT(*) FROM students WHERE dept_id = d.id AND active = 1) as student_count
             FROM departments d LEFT JOIN institutions i ON d.institution_id = i.id WHERE 1=1`;
  const p = [];
  if (req.query.institution_id) { q += ' AND d.institution_id = ?'; p.push(req.query.institution_id); }
  q += ' ORDER BY i.name, d.name';
  res.json(db.prepare(q).all(...p));
});

app.post('/api/departments', auth, (req, res) => {
  const { name, institution_id } = req.body;
  if (!name || !institution_id) return res.status(400).json({ error: 'Department name and institution are required.' });
  const exists = db.prepare('SELECT id FROM departments WHERE LOWER(name) = LOWER(?) AND institution_id = ?').get(name.trim(), institution_id);
  if (exists) return res.status(400).json({ error: 'A department with this name already exists in that institution.' });
  const result = db.prepare('INSERT INTO departments (name, institution_id) VALUES (?, ?)').run(name.trim(), institution_id);
  res.json({ success: true, id: result.lastInsertRowid, message: `Department "${name}" added successfully.` });
});

app.put('/api/departments/:id', auth, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Department name is required.' });
  const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  if (!dept) return res.status(404).json({ error: 'Department not found.' });
  db.prepare('UPDATE departments SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  res.json({ success: true, message: `Department renamed to "${name}".` });
});

app.delete('/api/departments/:id', auth, (req, res) => {
  const students = db.prepare('SELECT COUNT(*) as cnt FROM students WHERE dept_id = ? AND active = 1').get(req.params.id);
  if (students.cnt > 0) return res.status(400).json({ error: `Cannot delete: ${students.cnt} active student(s) are assigned to this department.` });
  db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Department deleted.' });
});

// ─── GROCERY / MESS ───────────────────────────────────────────────────────────
app.get('/api/mess_inventory', auth, (req, res) => {
  const items = db.prepare('SELECT * FROM mess_materials_tools_items ORDER BY category, name').all();
  const today = new Date().toISOString().split('T')[0];
  const result = items.map(item => {
    const batches = db.prepare('SELECT * FROM mess_inventory_batches WHERE item_id = ? AND qty_remaining > 0 ORDER BY exp_date ASC, id ASC').all(item.id);
    
    let is_expired = false;
    let expires_soon = false;
    
    if (batches.length > 0) {
      item.batches = batches.map(b => ({
         ...b,
         is_expired: b.exp_date ? b.exp_date < today : false,
         expires_soon: b.exp_date ? (new Date(b.exp_date) - new Date(today)) / 86400000 <= 7 && b.exp_date >= today : false
      }));
      item.batch_no = batches[0].batch_no;
      item.mfg_date = batches[0].mfg_date;
      item.exp_date = batches[0].exp_date;
      item.unit_price = batches[0].unit_price;
      is_expired = item.batches[0].is_expired;
      expires_soon = item.batches[0].expires_soon;
    } else {
      is_expired = item.exp_date ? item.exp_date < today : false;
      expires_soon = item.exp_date ? (new Date(item.exp_date) - new Date(today)) / 86400000 <= 7 && item.exp_date >= today : false;
    }
    
    return {
      ...item,
      is_expired,
      expires_soon
    };
  });
  res.json(result);
});

app.post('/api/mess_inventory', auth, (req, res) => {
  const { name, category, unit, current_stock, reorder_level, reorder_qty, supplier, unit_price, batch_no, mfg_date, exp_date, bill_image } = req.body;
  if (!name) return res.status(400).json({ error: 'Item name is required' });
  const stock = parseFloat(current_stock)||0;
  const result = db.prepare(
    'INSERT INTO mess_materials_tools_items (name,category,unit,current_stock,reorder_level,reorder_qty,supplier,unit_price,batch_no,mfg_date,exp_date,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(name, category||'General', unit||'kg', stock, parseFloat(reorder_level)||10, parseFloat(reorder_qty)||50, supplier||'', parseFloat(unit_price)||0, batch_no||'', mfg_date||null, exp_date||null, new Date().toISOString());
  const itemId = result.lastInsertRowid;
  if (stock > 0) {
    db.prepare('INSERT INTO mess_inventory_batches (item_id, batch_no, mfg_date, exp_date, unit_price, qty_initial, qty_remaining) VALUES (?,?,?,?,?,?,?)')
      .run(itemId, batch_no||'', mfg_date||null, exp_date||null, parseFloat(unit_price)||0, stock, stock);
  }
  res.json({ success: true, id: itemId });
});

app.put('/api/mess_inventory/:id', auth, (req, res) => {
  const { name, category, unit, current_stock, reorder_level, reorder_qty, supplier, unit_price, batch_no, mfg_date, exp_date, bill_image } = req.body;
  const existing = db.prepare('SELECT * FROM mess_materials_tools_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item not found' });
  
  const getFloat = (val, existingVal) => val !== undefined && val !== '' && val !== null ? parseFloat(val) : existingVal;

  db.prepare(
    'UPDATE mess_materials_tools_items SET name=?,category=?,unit=?,current_stock=?,reorder_level=?,reorder_qty=?,supplier=?,unit_price=?,batch_no=?,mfg_date=?,exp_date=?,updated_at=? WHERE id=?'
  ).run(
    name||existing.name, category||existing.category, unit||existing.unit,
    getFloat(current_stock, existing.current_stock), getFloat(reorder_level, existing.reorder_level),
    getFloat(reorder_qty, existing.reorder_qty), supplier??existing.supplier,
    getFloat(unit_price, existing.unit_price), batch_no??existing.batch_no,
    mfg_date??existing.mfg_date, exp_date??existing.exp_date,
    new Date().toISOString(), req.params.id
  );
  res.json({ success: true });
});

app.delete('/api/mess_inventory/:id', auth, (req, res) => {
    if (!['SUPER_ADMIN', 'FOOD_ADMIN', 'INVENTORY_ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Unauthorized' });
  db.prepare('DELETE FROM mess_materials_tools_items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/mess_inventory/:id/use', auth, (req, res) => {
  const { qty } = req.body;
  let remainingToDeduct = parseFloat(qty);
  
  // FIFO / FEFO Deductions from batches
  const batches = db.prepare('SELECT * FROM mess_inventory_batches WHERE item_id = ? AND qty_remaining > 0 ORDER BY exp_date ASC, id ASC').all(req.params.id);
  for (const batch of batches) {
    if (remainingToDeduct <= 0) break;
    const deduct = Math.min(batch.qty_remaining, remainingToDeduct);
    db.prepare('UPDATE mess_inventory_batches SET qty_remaining = qty_remaining - ? WHERE id = ?').run(deduct, batch.id);
    remainingToDeduct -= deduct;
  }
  
  // If no batches exist (legacy items), we just deduct from master
  db.prepare('UPDATE mess_materials_tools_items SET current_stock = MAX(0, current_stock - ?), updated_at=? WHERE id = ?').run(qty, new Date().toISOString(), req.params.id);
  db.prepare('INSERT INTO mess_inventory_usage_logs (item_id, qty_used, date, logged_by) VALUES (?,?,?,?)').run(req.params.id, qty, new Date().toISOString().split('T')[0], req.user.id);
  res.json({ message: 'Usage logged (FIFO)' });
});

app.post('/api/mess_inventory/:id/restock', auth, (req, res) => {
  const { qty, batch_no, mfg_date, exp_date, unit_price, bill_image } = req.body;
  const qtyFloat = parseFloat(qty);
  
  // Insert new batch
  db.prepare('INSERT INTO mess_inventory_batches (item_id, batch_no, mfg_date, exp_date, unit_price, qty_initial, qty_remaining) VALUES (?,?,?,?,?,?,?)')
    .run(req.params.id, batch_no||'', mfg_date||null, exp_date||null, parseFloat(unit_price)||0, qtyFloat, qtyFloat);
  
  // Update master total stock (we only update stock, we don't overwrite master dates)
  db.prepare('UPDATE mess_materials_tools_items SET current_stock = current_stock + ?, updated_at=? WHERE id = ?').run(qtyFloat, new Date().toISOString(), req.params.id);
  
  res.json({ message: 'Restocked in new batch (FIFO active)' });
});

app.get('/api/mess_inventory/expiry-alerts', auth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const in7days = new Date(Date.now() + 7*24*3600000).toISOString().split('T')[0];
  
  // Get active batches joining with item name
  const expired = db.prepare(`SELECT b.*, i.name, i.category, i.unit FROM mess_inventory_batches b JOIN mess_materials_tools_items i ON b.item_id = i.id WHERE b.qty_remaining > 0 AND b.exp_date IS NOT NULL AND b.exp_date < ? ORDER BY b.exp_date`).all(today);
  const expiringSoon = db.prepare(`SELECT b.*, i.name, i.category, i.unit FROM mess_inventory_batches b JOIN mess_materials_tools_items i ON b.item_id = i.id WHERE b.qty_remaining > 0 AND b.exp_date IS NOT NULL AND b.exp_date >= ? AND b.exp_date <= ? ORDER BY b.exp_date`).all(today, in7days);
  
  const lowStock = db.prepare(`SELECT * FROM mess_materials_tools_items WHERE current_stock <= reorder_level AND reorder_level > 0 ORDER BY current_stock ASC`).all();
    res.json({ expired, expiringSoon, lowStock });
});

app.get('/api/mess_inventory/usage', auth, (req, res) => {
  const logs = db.prepare(`SELECT gl.*, gi.name as item_name, gi.unit, u.name as logged_by_name
    FROM mess_inventory_usage_logs gl
    JOIN mess_materials_tools_items gi ON gl.item_id = gi.id
    LEFT JOIN users u ON gl.logged_by = u.id
    ORDER BY gl.id DESC LIMIT 50`).all();
  res.json(logs);
});

// AI Prediction (simple formula for demo)
app.get('/api/mess_inventory/prediction', auth, (req, res) => {
  const items = db.prepare('SELECT * FROM mess_materials_tools_items').all();
  const outsideCount = db.prepare(`SELECT COUNT(*) as count FROM entry_exit_logs WHERE direction='OUT' AND id IN (SELECT MAX(id) FROM entry_exit_logs WHERE flagged=0 GROUP BY student_id)`).get().count;
  const totalStudents = db.prepare('SELECT COUNT(*) as count FROM students WHERE active=1').get().count;
  const presentStudents = totalStudents - outsideCount;
  const today = new Date().toISOString().split('T')[0];

  const predictions = items.map(item => {
    const avgUsage = db.prepare('SELECT AVG(qty_used) as avg FROM mess_inventory_usage_logs WHERE item_id = ?').get(item.id);
    const perStudentAvg = presentStudents > 0 ? (avgUsage?.avg || item.current_stock * 0.05) / Math.max(presentStudents, 1) : 0;
    const next7days = perStudentAvg * presentStudents * 7;
    const next30days = perStudentAvg * presentStudents * 30;
    const wastageRisk = item.current_stock > next30days * 1.3 ? 'High' : item.current_stock > next7days * 1.5 ? 'Medium' : 'Low';
    return {
      ...item,
      present_students: presentStudents,
      per_student_daily: parseFloat(perStudentAvg.toFixed(3)),
      next_7_days: parseFloat(next7days.toFixed(2)),
      next_30_days: parseFloat(next30days.toFixed(2)),
      wastage_risk: wastageRisk,
      reorder_needed: item.current_stock < item.reorder_level,
      is_expired: item.exp_date ? item.exp_date < today : false,
      expires_soon: item.exp_date ? (new Date(item.exp_date) - new Date(today)) / 86400000 <= 7 && item.exp_date >= today : false
    };
  });
  res.json(predictions);
});

// --- INVENTORY ----------------------------------------------------------------
app.get('/api/materials_tools', auth, (req, res) => {
  const { category, search } = req.query;
  let query = 'SELECT * FROM materials_tools_items WHERE 1=1';
  const params = [];
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (search)   { query += ' AND (name LIKE ? OR vendor LIKE ? OR location LIKE ? OR asset_code LIKE ?)'; params.push('%'+search+'%', '%'+search+'%', '%'+search+'%', '%'+search+'%'); }
  query += ' ORDER BY category, name';
  res.json(db.prepare(query).all(...params));
});

app.get('/api/materials_tools/stats', auth, (req, res) => {
  const total       = db.prepare('SELECT COUNT(*) as count FROM materials_tools_items').get().count;
  const totalValue  = db.prepare('SELECT SUM(total_price) as val FROM materials_tools_items').get().val || 0;
  const lowStock    = db.prepare('SELECT COUNT(*) as count FROM materials_tools_items WHERE qty <= min_qty').get().count;
  const byCategory  = db.prepare('SELECT category, COUNT(*) as count, SUM(total_price) as value FROM materials_tools_items GROUP BY category').all();
  const byCondition = db.prepare("SELECT condition_status, COUNT(*) as count FROM materials_tools_items GROUP BY condition_status").all();
  const pendingPOs  = db.prepare("SELECT COUNT(*) as count FROM materials_tools_purchase_orders WHERE status IN ('Pending','Approved','Ordered')").get().count;
  const totalTx     = db.prepare('SELECT COUNT(*) as count FROM materials_tools_transactions').get().count;
  res.json({ total, totalValue, lowStock, byCategory, byCondition, pendingPOs, totalTx });
});

app.post('/api/materials_tools', auth, (req, res) => {
  const { name, category, qty, min_qty, unit, unit_price, vendor, purchase_date, location, condition_status, asset_code, serial_no, warranty_expiry, notes } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'Name and category are required' });
  const total = (qty || 0) * (unit_price || 0);
  const result = db.prepare(
    'INSERT INTO materials_tools_items (name,category,qty,min_qty,unit,unit_price,total_price,vendor,purchase_date,location,condition_status,asset_code,serial_no,warranty_expiry,notes,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(name, category, qty||0, min_qty||5, unit||'nos', unit_price||0, total, vendor||'', purchase_date||'', location||'', condition_status||'Good', asset_code||'', serial_no||'', warranty_expiry||'', notes||'', new Date().toISOString());
  if ((qty||0) > 0) {
    db.prepare('INSERT INTO materials_tools_transactions (item_id,type,qty_change,reason,done_by,done_by_id,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(result.lastInsertRowid, 'Purchase', qty, 'Initial stock entry', req.user.name, req.user.id, new Date().toISOString());
  }
  res.json({ success: true, id: result.lastInsertRowid });
});

app.put('/api/materials_tools/:id', auth, (req, res) => {
  const { name, category, qty, min_qty, unit, unit_price, vendor, purchase_date, location, condition_status, asset_code, serial_no, warranty_expiry, notes } = req.body;
  const existing = db.prepare('SELECT * FROM materials_tools_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item not found' });
  const newQty = (qty !== undefined ? qty : existing.qty);
  const newPrice = (unit_price !== undefined ? unit_price : existing.unit_price);
  const total = newQty * newPrice;
  db.prepare(
    'UPDATE materials_tools_items SET name=?,category=?,qty=?,min_qty=?,unit=?,unit_price=?,total_price=?,vendor=?,purchase_date=?,location=?,condition_status=?,asset_code=?,serial_no=?,warranty_expiry=?,notes=?,updated_at=? WHERE id=?'
  ).run(name||existing.name, category||existing.category, newQty, min_qty||existing.min_qty, unit||existing.unit, newPrice, total, vendor||existing.vendor, purchase_date||existing.purchase_date, location||existing.location, condition_status||existing.condition_status, asset_code||existing.asset_code||'', serial_no||existing.serial_no||'', warranty_expiry||existing.warranty_expiry||'', notes||existing.notes, new Date().toISOString(), req.params.id);
  const prevCond = existing.condition_status;
  const newCond  = condition_status || existing.condition_status;
  if ((newCond === 'Poor' || newCond === 'Under Repair') && prevCond !== newCond) {
    const tag = '[INV-'+req.params.id+']';
    const maintExists = db.prepare("SELECT id FROM maintenance_requests WHERE description LIKE ? AND status != 'completed'").get('%'+tag+'%');
    if (!maintExists) {
      db.prepare('INSERT INTO maintenance_requests (raised_by,room_no,category,description,priority,status,created_at) VALUES (?,?,?,?,?,?,?)')
        .run(req.user.id, existing.location||'Inventory', 'Inventory', 'Item "'+existing.name+'" marked as '+newCond+'. Please inspect. '+tag, newCond==='Poor'?'Urgent':'Normal', 'pending', new Date().toISOString());
    }
  }
  res.json({ success: true });
});

app.patch('/api/materials_tools/:id/adjust', auth, (req, res) => {
  const { change, type, reason, reference_no } = req.body;
  const existing = db.prepare('SELECT * FROM materials_tools_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item not found' });
  const newQty = Math.max(0, existing.qty + change);
  db.prepare('UPDATE materials_tools_items SET qty=?, total_price=?, updated_at=? WHERE id=?')
    .run(newQty, newQty * existing.unit_price, new Date().toISOString(), req.params.id);
  db.prepare('INSERT INTO materials_tools_transactions (item_id,type,qty_change,reason,reference_no,done_by,done_by_id,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(req.params.id, type||(change>0?'Purchase':'Issue'), change, reason||'', reference_no||'', req.user.name, req.user.id, new Date().toISOString());
  res.json({ success: true, new_qty: newQty });
});

app.delete('/api/materials_tools/:id', auth, (req, res) => {
    if (!['SUPER_ADMIN', 'INVENTORY_ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Unauthorized' });
  db.prepare('DELETE FROM materials_tools_transactions WHERE item_id = ?').run(req.params.id);
  db.prepare('DELETE FROM materials_tools_assignments WHERE item_id = ?').run(req.params.id);
  db.prepare('DELETE FROM materials_tools_items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// -- Transactions ------------------------------------------------------------
app.get('/api/materials_tools/transactions', auth, (req, res) => {
  const { item_id, type, from_date, to_date } = req.query;
  let q = 'SELECT t.*, i.name as item_name, i.category, i.unit FROM materials_tools_transactions t JOIN materials_tools_items i ON t.item_id = i.id WHERE 1=1';
  const p = [];
  if (item_id)   { q += ' AND t.item_id = ?';          p.push(item_id); }
  if (type)      { q += ' AND t.type = ?';              p.push(type); }
  if (from_date) { q += ' AND date(t.created_at) >= ?'; p.push(from_date); }
  if (to_date)   { q += ' AND date(t.created_at) <= ?'; p.push(to_date); }
  q += ' ORDER BY t.id DESC LIMIT 500';
  res.json(db.prepare(q).all(...p));
});

// -- Assignments -------------------------------------------------------------
app.get('/api/materials_tools/assignments', auth, (req, res) => {
  const { item_id, status } = req.query;
  let q = 'SELECT a.*, i.name as item_name, i.unit, i.category FROM materials_tools_assignments a JOIN materials_tools_items i ON a.item_id = i.id WHERE 1=1';
  const p = [];
  if (item_id) { q += ' AND a.item_id = ?'; p.push(item_id); }
  if (status)  { q += ' AND a.status = ?';  p.push(status); }
  q += ' ORDER BY a.id DESC';
  res.json(db.prepare(q).all(...p));
});

app.post('/api/materials_tools/assign', auth, (req, res) => {
  const { item_id, room_id, room_label, student_id, student_name, assigned_qty, assigned_date, expected_return, notes } = req.body;
  if (!item_id || !assigned_qty) return res.status(400).json({ error: 'item_id and assigned_qty are required' });
  const item = db.prepare('SELECT * FROM materials_tools_items WHERE id = ?').get(item_id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.qty < assigned_qty) return res.status(400).json({ error: 'Only '+item.qty+' '+item.unit+' available' });
  const newQty = item.qty - assigned_qty;
  db.prepare('UPDATE materials_tools_items SET qty=?, total_price=?, updated_at=? WHERE id=?').run(newQty, newQty * item.unit_price, new Date().toISOString(), item_id);
  db.prepare('INSERT INTO materials_tools_transactions (item_id,type,qty_change,reason,done_by,done_by_id,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(item_id, 'Issue', -assigned_qty, 'Issued to '+(room_label||student_name||'unknown'), req.user.name, req.user.id, new Date().toISOString());
  const result = db.prepare('INSERT INTO materials_tools_assignments (item_id,room_id,room_label,student_id,student_name,assigned_qty,assigned_date,expected_return,assigned_by,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(item_id, room_id||null, room_label||'', student_id||null, student_name||'', assigned_qty, assigned_date||new Date().toISOString().split('T')[0], expected_return||'', req.user.name, 'Active', notes||'');
  res.json({ success: true, id: result.lastInsertRowid });
});

app.put('/api/materials_tools/assignments/:id/return', auth, (req, res) => {
  const { condition_on_return, notes } = req.body;
  const asgn = db.prepare('SELECT * FROM materials_tools_assignments WHERE id = ?').get(req.params.id);
  if (!asgn) return res.status(404).json({ error: 'Assignment not found' });
  db.prepare("UPDATE materials_tools_assignments SET status='Returned', returned_date=?, condition_on_return=?, notes=? WHERE id=?")
    .run(new Date().toISOString().split('T')[0], condition_on_return||'Good', notes||'', req.params.id);
  const item = db.prepare('SELECT * FROM materials_tools_items WHERE id = ?').get(asgn.item_id);
  const newQty = item.qty + asgn.assigned_qty;
  db.prepare('UPDATE materials_tools_items SET qty=?, total_price=?, updated_at=? WHERE id=?').run(newQty, newQty * item.unit_price, new Date().toISOString(), asgn.item_id);
  db.prepare('INSERT INTO materials_tools_transactions (item_id,type,qty_change,reason,done_by,done_by_id,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(asgn.item_id, 'Return', asgn.assigned_qty, 'Returned from '+(asgn.room_label||asgn.student_name||'assignment'), req.user.name, req.user.id, new Date().toISOString());
  res.json({ success: true });
});

// -- Purchase Orders ---------------------------------------------------------
app.get('/api/purchase-orders', auth, (req, res) => {
  const { status } = req.query;
  let q = 'SELECT * FROM materials_tools_purchase_orders WHERE 1=1';
  const p = [];
  if (status) { q += ' AND status = ?'; p.push(status); }
  q += ' ORDER BY id DESC';
  res.json(db.prepare(q).all(...p));
});

app.post('/api/purchase-orders', auth, (req, res) => {
  const { item_name, category, requested_qty, unit_price, vendor, notes } = req.body;
  if (!item_name || !requested_qty) return res.status(400).json({ error: 'item_name and requested_qty required' });
  const po_number = 'PO-' + Date.now().toString().slice(-8);
  const total_amount = (requested_qty||0) * (unit_price||0);
  const result = db.prepare('INSERT INTO materials_tools_purchase_orders (po_number,item_name,category,requested_qty,unit_price,total_amount,vendor,status,requested_by,requested_by_id,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(po_number, item_name, category||'Other', requested_qty, unit_price||0, total_amount, vendor||'', 'Pending', req.user.name, req.user.id, notes||'', new Date().toISOString());
  res.json({ success: true, id: result.lastInsertRowid, po_number });
});

app.put('/api/purchase-orders/:id', auth, (req, res) => {
  const { status, unit_price, vendor, notes, received_qty, bill_image } = req.body;
  const po = db.prepare('SELECT * FROM materials_tools_purchase_orders WHERE id = ?').get(req.params.id);
  if (!po) return res.status(404).json({ error: 'PO not found' });
  const updates = ['updated_at = ?']; const params = [new Date().toISOString()];
  if (status !== undefined)       { updates.push('status = ?');    params.push(status); }
  if (['Approved','Rejected'].includes(status)) { updates.push('approved_by = ?'); params.push(req.user.name); updates.push('approved_by_id = ?'); params.push(req.user.id); }
  if (unit_price !== undefined)   { updates.push('unit_price = ?'); params.push(unit_price); updates.push('total_amount = ?'); params.push(po.requested_qty * unit_price); }
  if (vendor !== undefined)       { updates.push('vendor = ?');    params.push(vendor); }
  if (notes !== undefined)        { updates.push('notes = ?');     params.push(notes); }
  if (received_qty !== undefined) { updates.push('received_qty = ?'); params.push(received_qty); }
  if (bill_image !== undefined) { updates.push('bill_image = ?'); params.push(bill_image); }
  params.push(req.params.id);
  db.prepare('UPDATE materials_tools_purchase_orders SET '+updates.join(', ')+' WHERE id = ?').run(...params);
  if (status === 'Received' && received_qty > 0) {
    if (po.inventory_item_id) {
      const item = db.prepare('SELECT * FROM materials_tools_items WHERE id = ?').get(po.inventory_item_id);
      if (item) {
        const newQty = item.qty + received_qty;
        db.prepare('UPDATE materials_tools_items SET qty=?, total_price=?, updated_at=? WHERE id=?').run(newQty, newQty * item.unit_price, new Date().toISOString(), po.inventory_item_id);
        db.prepare('INSERT INTO materials_tools_transactions (item_id,type,qty_change,reason,reference_no,done_by,done_by_id,created_at) VALUES (?,?,?,?,?,?,?,?)')
          .run(po.inventory_item_id, 'Purchase', received_qty, 'PO '+po.po_number, po.po_number, req.user.name, req.user.id, new Date().toISOString());
      }
    } else {
      const newItem = db.prepare('INSERT INTO materials_tools_items (name,category,qty,min_qty,unit,unit_price,total_price,vendor,purchase_date,condition_status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(po.item_name, po.category||'Other', received_qty, 5, 'nos', po.unit_price||0, received_qty*(po.unit_price||0), po.vendor||'', new Date().toISOString().split('T')[0], 'New', new Date().toISOString());
      db.prepare('INSERT INTO materials_tools_transactions (item_id,type,qty_change,reason,reference_no,done_by,done_by_id,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(newItem.lastInsertRowid, 'Purchase', received_qty, 'PO '+po.po_number, po.po_number, req.user.name, req.user.id, new Date().toISOString());
      db.prepare('UPDATE materials_tools_purchase_orders SET inventory_item_id = ? WHERE id = ?').run(newItem.lastInsertRowid, req.params.id);
    }
  }
  res.json({ success: true });
});

app.delete('/api/purchase-orders/:id', auth, (req, res) => {
    if (!['SUPER_ADMIN', 'INVENTORY_ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Unauthorized' });
  const po = db.prepare('SELECT * FROM materials_tools_purchase_orders WHERE id = ?').get(req.params.id);
  if (!po) return res.status(404).json({ error: 'PO not found' });
  if (!['Pending','Cancelled'].includes(po.status)) return res.status(400).json({ error: 'Cannot delete an active PO' });
  db.prepare('DELETE FROM materials_tools_purchase_orders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// -- CSV Reports -------------------------------------------------------------
function toCSV(rows, columns) {
  const header = columns.join(',');
  const body = rows.map(r => columns.map(c => { const v = r[c]==null?'':String(r[c]).replace(/"/g,'""'); return '"'+v+'"'; }).join(',')).join('\n');
  return header + '\n' + body;
}
app.get('/api/reports/inventory-csv', auth, (req, res) => {
  const rows = db.prepare('SELECT id,name,category,qty,min_qty,unit,unit_price,total_price,vendor,purchase_date,location,condition_status,asset_code,serial_no,warranty_expiry,notes,updated_at FROM materials_tools_items ORDER BY category,name').all();
  const csv = toCSV(rows,['id','name','category','qty','min_qty','unit','unit_price','total_price','vendor','purchase_date','location','condition_status','asset_code','serial_no','warranty_expiry','notes','updated_at']);
  res.setHeader('Content-Type','text/csv'); res.setHeader('Content-Disposition','attachment; filename="inventory_report.csv"'); res.send(csv);
});
app.get('/api/reports/low-stock-csv', auth, (req, res) => {
  const rows = db.prepare('SELECT id,name,category,qty,min_qty,unit,vendor,location,condition_status FROM materials_tools_items WHERE qty <= min_qty ORDER BY category,name').all();
  const csv = toCSV(rows,['id','name','category','qty','min_qty','unit','vendor','location','condition_status']);
  res.setHeader('Content-Type','text/csv'); res.setHeader('Content-Disposition','attachment; filename="low_stock_report.csv"'); res.send(csv);
});
app.get('/api/reports/transactions-csv', auth, (req, res) => {
  const { from_date, to_date } = req.query;
  let q = 'SELECT t.id, i.name as item_name, i.category, t.type, t.qty_change, t.reason, t.reference_no, t.done_by, t.created_at FROM materials_tools_transactions t JOIN materials_tools_items i ON t.item_id = i.id WHERE 1=1';
  const p = [];
  if (from_date) { q += ' AND date(t.created_at) >= ?'; p.push(from_date); }
  if (to_date)   { q += ' AND date(t.created_at) <= ?'; p.push(to_date); }
  q += ' ORDER BY t.id DESC';
  const rows = db.prepare(q).all(...p);
  const csv = toCSV(rows,['id','item_name','category','type','qty_change','reason','reference_no','done_by','created_at']);
  res.setHeader('Content-Type','text/csv'); res.setHeader('Content-Disposition','attachment; filename="transactions_report.csv"'); res.send(csv);
});
app.get('/api/reports/purchase-orders-csv', auth, (req, res) => {
  const rows = db.prepare('SELECT po_number,item_name,category,requested_qty,received_qty,unit_price,total_amount,vendor,status,requested_by,approved_by,notes,created_at FROM materials_tools_purchase_orders ORDER BY id DESC').all();
  const csv = toCSV(rows,['po_number','item_name','category','requested_qty','received_qty','unit_price','total_amount','vendor','status','requested_by','approved_by','notes','created_at']);
  res.setHeader('Content-Type','text/csv'); res.setHeader('Content-Disposition','attachment; filename="materials_tools_purchase_orders_report.csv"'); res.send(csv);
});


// ─── MAINTENANCE ──────────────────────────────────────────────────────────────
app.get('/api/maintenance', auth, (req, res) => {
  res.json(db.prepare(`SELECT mr.*, u.name as raised_by_name, u2.name as assigned_to_name, s.name as verified_by_name
    FROM maintenance_requests mr
    LEFT JOIN users u ON mr.raised_by = u.id
    LEFT JOIN users u2 ON mr.assigned_to = u2.id
    LEFT JOIN students s ON mr.verified_by_student_id = s.id
    ORDER BY mr.id DESC`).all());
});

app.post('/api/maintenance', auth, (req, res) => {
  const { room_no, category, description, priority } = req.body;
  const result = db.prepare('INSERT INTO maintenance_requests (raised_by,room_no,category,description,priority,status,created_at) VALUES (?,?,?,?,?,?,?)').run(req.user.id, room_no, category, description, priority || 'Normal', 'pending', new Date().toISOString());
  res.json({ id: result.lastInsertRowid });
});

app.patch('/api/maintenance/:id', auth, (req, res) => {
    if (!['SUPER_ADMIN', 'MAINTENANCE', 'HOSTEL_ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Unauthorized' });
  const { status, remarks, assigned_to } = req.body;
  
  if (assigned_to !== undefined) {
    db.prepare('UPDATE maintenance_requests SET assigned_to=? WHERE id=?').run(assigned_to, req.params.id);
    if (global.auditLog) global.auditLog(req, 'Maintenance Assigned', 'maintenance_requests', req.params.id, `Assigned to user ID ${assigned_to}`);
    return res.json({ message: 'Assigned' });
  }
  
  db.prepare('UPDATE maintenance_requests SET status=?, remarks=?, resolved_at=? WHERE id=?').run(status, remarks, status === 'completed' || status === 'Resolved' ? new Date().toISOString() : null, req.params.id);
  if (global.auditLog) global.auditLog(req, 'Maintenance Updated', 'maintenance_requests', req.params.id, `Status: ${status}`);
  res.json({ message: 'Updated' });
});

app.get('/api/users/staff', auth, (req, res) => {
  res.json(db.prepare(`SELECT id, name, role FROM users WHERE role IN ('MAINTENANCE', 'MESS_WORKER', 'GATE_STAFF')`).all());
});

app.post('/api/maintenance/:id/verify-scan', auth, (req, res) => {
  const { code } = req.body; // Can be reg_no or qr_token
  
  // Find the student by reg_no or qr_token
  const student = db.prepare('SELECT * FROM students WHERE (reg_no = ? OR qr_token = ?) AND active = 1').get(code, code);
  
  if (!student) {
    return res.status(404).json({ success: false, error: 'Student not found or inactive.' });
  }

  const existing = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Maintenance request not found.' });
  }

  // Update the request as verified and completed
  db.prepare(`UPDATE maintenance_requests SET 
    status = 'completed', 
    remarks = 'Verified and completed by scan', 
    resolved_at = ?,
    verified_by_student_id = ?,
    verified_at = ?
    WHERE id = ?`).run(new Date().toISOString(), student.id, new Date().toISOString(), req.params.id);

  res.json({ success: true, message: `Successfully verified by ${student.name}` });
});

// ─── NOTICES ──────────────────────────────────────────────────────────────────
app.get('/api/notices', auth, (req, res) => {
  res.json(db.prepare('SELECT n.*, u.name as posted_by_name FROM notices n LEFT JOIN users u ON n.posted_by=u.id ORDER BY n.id DESC LIMIT 20').all());
});

app.post('/api/notices', auth, (req, res) => {
  const { title, content, category } = req.body;
  db.prepare('INSERT INTO notices (posted_by,title,content,category,created_at) VALUES (?,?,?,?,?)').run(req.user.id, title, content, category, new Date().toISOString());
  res.json({ message: 'Notice posted' });
});

app.delete('/api/notices/:id', auth, (req, res) => {
  if (req.user.role === 'STUDENT') return res.status(403).json({ error: 'Unauthorized' });
  db.prepare('DELETE FROM notices WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Notice deleted' });
});

// ─── MENU ─────────────────────────────────────────────────────────────────────
app.get('/api/menu', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM weekly_menu ORDER BY id').all();
  // Group by day for frontend convenience
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.day]) grouped[row.day] = { day: row.day };
    grouped[row.day][row.meal_type.toLowerCase()] = row.items_description;
  }
  res.json(Object.values(grouped));
});

app.put('/api/menu/:day', auth, (req, res) => {
  if (!['SUPER_ADMIN', 'FOOD_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const { day } = req.params;
  const { breakfast, lunch, snacks, dinner } = req.body;
  
  const updateMeal = (type, items) => {
    if (items !== undefined) {
      const exists = db.prepare('SELECT id FROM weekly_menu WHERE day = ? AND meal_type = ?').get(day, type);
      if (exists) {
        db.prepare('UPDATE weekly_menu SET items_description = ? WHERE id = ?').run(items, exists.id);
      } else {
        db.prepare('INSERT INTO weekly_menu (day, meal_type, items_description) VALUES (?, ?, ?)').run(day, type, items);
      }
    }
  };

  updateMeal('Breakfast', breakfast);
  updateMeal('Lunch', lunch);
  updateMeal('Snacks', snacks);
  updateMeal('Dinner', dinner);

  res.json({ success: true });
});

// ─── NOTIFICATION LOGS ────────────────────────────────────────────────────────
app.get('/api/notifications', auth, (req, res) => {
  const role = req.user.role;
  const userInst = req.user.institution_id;
  
  let logs = [];
  let inventoryAlerts = [];

  // 1. Parent SMS Logs (Data Isolation applied)
  if (['SUPER_ADMIN', 'HOSTEL_ADMIN', 'PRINCIPAL', 'WARDEN', 'GATE_STAFF'].includes(role)) {
    let query = `
      SELECT n.* 
      FROM notification_logs n
      LEFT JOIN students s ON n.student_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (role !== 'SUPER_ADMIN' && userInst) {
      query += ` AND s.institution_id = ?`;
      params.push(userInst);
    }
    
    query += ` ORDER BY n.id DESC LIMIT 50`;
    logs = db.prepare(query).all(...params);
  }

  // 2. Mess & Grocery Alerts
  if (['SUPER_ADMIN', 'HOSTEL_ADMIN', 'PRINCIPAL', 'FOOD_ADMIN', 'MESS_WORKER', 'INVENTORY_ADMIN'].includes(role)) {
    const today = new Date().toISOString().split('T')[0];
    const in7days = new Date(Date.now() + 7*24*3600000).toISOString().split('T')[0];
    
    const lowStock = db.prepare(`SELECT * FROM mess_materials_tools_items WHERE current_stock <= reorder_level AND reorder_level > 0`).all();
    const expired = db.prepare(`SELECT b.*, i.name, i.category, i.unit FROM mess_inventory_batches b JOIN mess_materials_tools_items i ON b.item_id = i.id WHERE b.qty_remaining > 0 AND b.exp_date IS NOT NULL AND b.exp_date < ?`).all(today);
    const expiringSoon = db.prepare(`SELECT b.*, i.name, i.category, i.unit FROM mess_inventory_batches b JOIN mess_materials_tools_items i ON b.item_id = i.id WHERE b.qty_remaining > 0 AND b.exp_date IS NOT NULL AND b.exp_date >= ? AND b.exp_date <= ?`).all(today, in7days);
    
    lowStock.forEach(item => {
      inventoryAlerts.push({
        id: 'ls_' + item.id,
        type: 'LOW_STOCK',
        student_name: 'Mess & Grocery',
        message: `Low Stock Alert: ${item.name} has dropped to ${item.current_stock} ${item.unit} (Limit: ${item.reorder_level}). Please restock soon.`,
        sent_at: new Date().toISOString()
      });
    });
  
    expired.forEach(batch => {
      inventoryAlerts.push({
        id: 'ex_' + batch.id,
        type: 'EXPIRED',
        student_name: 'Mess & Grocery',
        message: `Expired Alert: ${batch.name} (Batch: ${batch.batch_no || 'N/A'}) expired on ${batch.exp_date}. It has ${batch.qty_remaining} ${batch.unit} remaining.`,
        sent_at: new Date().toISOString()
      });
    });
  
    expiringSoon.forEach(batch => {
      inventoryAlerts.push({
        id: 'es_' + batch.id,
        type: 'EXPIRING_SOON',
        student_name: 'Mess & Grocery',
        message: `Expiring Soon: ${batch.name} (Batch: ${batch.batch_no || 'N/A'}) will expire on ${batch.exp_date}. It has ${batch.qty_remaining} ${batch.unit} remaining.`,
        sent_at: new Date().toISOString()
      });
    });
  }

  // Combine and sort
  const allLogs = [...inventoryAlerts, ...logs].sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at)).slice(0, 50);

  res.json(allLogs);
});

// ─── MESS FEEDBACK & RATINGS ──────────────────────────────────────────────────
app.get('/api/mess/feedback', auth, (req, res) => {
  const feedbacks = db.prepare('SELECT * FROM mess_feedback ORDER BY id DESC LIMIT 50').all();
  res.json(feedbacks);
});

app.get('/api/mess/feedback/stats', auth, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as total, AVG(rating) as avg_rating FROM mess_feedback').get();
  const breakdown = db.prepare('SELECT rating, COUNT(*) as count FROM mess_feedback GROUP BY rating').all();
  const recent = db.prepare('SELECT * FROM mess_feedback ORDER BY id DESC LIMIT 10').all();
  res.json({
    totalCount: total.total || 0,
    avgRating: total.avg_rating ? parseFloat(total.avg_rating.toFixed(1)) : 5.0,
    breakdown,
    recent
  });
});

app.post('/api/mess/feedback', auth, (req, res) => {
  const { rating, meal_type, dish_name, comment } = req.body;
  const student = db.prepare('SELECT * FROM students WHERE email = ?').get(req.user.email);
  const studentName = student ? student.name : (req.user.name || 'Student');
  const studentId = student ? student.id : req.user.id;

  const result = db.prepare(`INSERT INTO mess_feedback (student_id, student_name, rating, meal_type, dish_name, comment, created_at)
    VALUES (?,?,?,?,?,?,?)`).run(studentId, studentName, rating, meal_type, dish_name, comment, new Date().toISOString());

  res.json({ success: true, id: result.lastInsertRowid, message: 'Feedback submitted successfully!' });
});

// ─── COMPLAINTS / GRIEVANCE SYSTEM ───────────────────────────────────────────
app.get('/api/complaints', auth, (req, res) => {
  const { status, category } = req.query;
  let query = `
    SELECT c.* 
    FROM complaints c
    LEFT JOIN students s ON c.student_id = s.id
  `;
  const conditions = [];
  const params = [];

  if (req.user.role === 'STUDENT') {
    conditions.push('c.student_id = ?');
    params.push(req.user.id);
  } else if (req.user.role === 'HOD') {
    conditions.push('s.dept_id = ?');
    params.push(req.user.dept_id);
  } else if (req.user.role === 'TUTOR') {
    conditions.push('s.dept_id = ?');
    params.push(req.user.dept_id);
    if (req.user.year) {
      conditions.push('s.year = ?');
      params.push(req.user.year);
    }
  }

  if (status) { conditions.push('c.status = ?'); params.push(status); }
  if (category) { conditions.push('c.category = ?'); params.push(category); }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY c.id DESC';

  const complaints = db.prepare(query).all(...params);
  const result = complaints.map(c => {
    if (c.is_anonymous && req.user.role !== 'STUDENT') {
      return { ...c, student_name: '🕵️ Anonymous', student_id: null, room_no: null };
    }
    return c;
  });
  res.json(result);
});

app.get('/api/complaints/stats', auth, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM complaints').get().count;
  const open = db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status = 'open'").get().count;
  const inProgress = db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status = 'in_progress'").get().count;
  const resolved = db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status = 'resolved'").get().count;
  const dismissed = db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status = 'dismissed'").get().count;
  const byCategory = db.prepare('SELECT category, COUNT(*) as count FROM complaints GROUP BY category').all();
  res.json({ total, open, inProgress, resolved, dismissed, byCategory });
});

app.post('/api/complaints', auth, (req, res) => {
  const { category, subject, description, is_anonymous } = req.body;
  if (!category || !subject || !description) {
    return res.status(400).json({ error: 'Category, subject and description are required' });
  }

  const student = db.prepare(
    `SELECT s.*, r.room_no, r.block FROM students s
     LEFT JOIN rooms r ON s.room_id = r.id
     WHERE s.email = ?`
  ).get(req.user.email || '');

  const studentName = student ? student.name : req.user.name;
  const studentId   = student ? student.id   : req.user.id;
  const roomNo      = student ? (student.block ? student.block + '-' + student.room_no : student.room_no) : null;
  const priority    = category === 'ragging' ? 'critical' : 'medium';

  const result = db.prepare(
    `INSERT INTO complaints (student_id, student_name, room_no, category, subject, description, is_anonymous, priority, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(studentId, studentName, roomNo, category, subject, description, is_anonymous ? 1 : 0, priority, new Date().toISOString());

  res.json({ success: true, id: result.lastInsertRowid, message: 'Complaint submitted successfully' });
});

app.put('/api/complaints/:id', auth, (req, res) => {
  const { status, admin_remarks, priority } = req.body;
  const existing = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Complaint not found' });

  const updates = [];
  const params  = [];
  if (status)                    { updates.push('status = ?');        params.push(status); }
  if (admin_remarks !== undefined){ updates.push('admin_remarks = ?'); params.push(admin_remarks); }
  if (priority)                  { updates.push('priority = ?');      params.push(priority); }
  updates.push('resolved_by = ?'); params.push(req.user.name);
  updates.push('updated_at = ?');  params.push(new Date().toISOString());
  params.push(req.params.id);

  db.prepare(`UPDATE complaints SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ success: true, message: 'Complaint updated' });
});

// ─── HOSTEL VACATE WORKFLOW ──────────────────────────────────────────────────
app.get('/api/vacate', auth, (req, res) => {
  let query = `
    SELECT v.*, s.name as student_name, s.reg_no, s.email as student_email, s.mobile as student_mobile,
           r.room_no, r.block, d.name as dept_name, i.code as institution_code
    FROM hostel_vacate_requests v
    JOIN students s ON v.student_id = s.id
    LEFT JOIN rooms r ON s.room_id = r.id
    LEFT JOIN departments d ON s.dept_id = d.id
    LEFT JOIN institutions i ON s.institution_id = i.id
  `;
  const params = [];

  if (req.user.role === 'STUDENT') {
    const student = db.prepare('SELECT id FROM students WHERE email = ?').get(req.user.email);
    if (!student) return res.json([]);
    query += ' WHERE v.student_id = ?';
    params.push(student.id);
  }

  query += ' ORDER BY v.id DESC';
  const requests = db.prepare(query).all(...params);
  res.json(requests);
});

app.post('/api/vacate', auth, (req, res) => {
  const { reason, vacate_date, parent_phone } = req.body;
  if (!reason || !vacate_date) {
    return res.status(400).json({ error: 'Reason and intended vacate date are required.' });
  }

  const student = db.prepare('SELECT id, room_id FROM students WHERE email = ?').get(req.user.email);
  if (!student) {
    return res.status(400).json({ error: 'Student record not found.' });
  }

  const pending = db.prepare("SELECT id FROM hostel_vacate_requests WHERE student_id = ? AND status IN ('PENDING_WARDEN', 'PENDING_FINE_PAYMENT', 'PENDING_PRINCIPAL')").get(student.id);
  if (pending) {
    return res.status(400).json({ error: 'You already have an active vacate request in progress.' });
  }

  const result = db.prepare(`
    INSERT INTO hostel_vacate_requests (student_id, reason, vacate_date, parent_phone, status)
    VALUES (?, ?, ?, ?, 'PENDING_WARDEN')
  `).run(student.id, reason, vacate_date, parent_phone || null);

  res.json({ success: true, id: result.lastInsertRowid, message: 'Vacate request submitted to Warden for room inspection.' });
});

app.put('/api/vacate/:id/warden', auth, (req, res) => {
    if (!['SUPER_ADMIN', 'WARDEN', 'HOSTEL_ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Unauthorized' });
  const { has_damage, damage_description, fine_amount, warden_remarks } = req.body;
  const existing = db.prepare('SELECT * FROM hostel_vacate_requests WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Request not found' });

  if (has_damage && fine_amount > 0) {
    db.prepare(`
      UPDATE hostel_vacate_requests
      SET status = 'PENDING_FINE_PAYMENT', has_damage = 1, damage_description = ?, fine_amount = ?, fine_paid = 0, warden_remarks = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(damage_description || 'Room damage detected', fine_amount, warden_remarks || null, req.params.id);
    return res.json({ success: true, message: `Damage fine of ₹${fine_amount} assigned. Student must clear payment.` });
  } else {
    db.prepare(`
      UPDATE hostel_vacate_requests
      SET status = 'PENDING_PRINCIPAL', has_damage = 0, damage_description = null, fine_amount = 0, fine_paid = 1, warden_remarks = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(warden_remarks || 'Room inspected. No damages found.', req.params.id);
    return res.json({ success: true, message: 'Room cleared! Request forwarded to Principal for final approval.' });
  }
});

app.put('/api/vacate/:id/pay-fine', auth, (req, res) => {
    if (req.user.role === 'STUDENT') return res.status(403).json({ error: 'Students cannot verify their own payment' });
  const existing = db.prepare('SELECT * FROM hostel_vacate_requests WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Request not found' });

  db.prepare(`
    UPDATE hostel_vacate_requests
    SET fine_paid = 1, status = 'PENDING_PRINCIPAL', updated_at = datetime('now')
    WHERE id = ?
  `).run(req.params.id);

  res.json({ success: true, message: 'Fine payment verified! Request forwarded to Principal.' });
});

app.put('/api/vacate/:id/principal', auth, (req, res) => {
    if (!['SUPER_ADMIN', 'PRINCIPAL'].includes(req.user.role)) return res.status(403).json({ error: 'Only Principal can approve' });
  const { decision, principal_remarks } = req.body;
  const request = db.prepare('SELECT * FROM hostel_vacate_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  if (decision === 'APPROVE') {
    db.prepare(`
      UPDATE hostel_vacate_requests
      SET status = 'APPROVED', principal_remarks = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(principal_remarks || 'Approved by Principal', req.params.id);

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(request.student_id);
    if (student) {
      db.prepare('UPDATE students SET active = 0, room_id = NULL WHERE id = ?').run(student.id);
      if (student.email) {
        db.prepare('UPDATE users SET active = 0 WHERE email = ?').run(student.email);
      }
    }

    res.json({ success: true, message: 'Hostel vacate request approved! Student access has been revoked and room bed freed.' });
  } else {
    db.prepare(`
      UPDATE hostel_vacate_requests
      SET status = 'REJECTED', principal_remarks = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(principal_remarks || 'Vacate request rejected by Principal', req.params.id);

    res.json({ success: true, message: 'Vacate request rejected by Principal.' });
  }
});

// ─── GLOBAL SEARCH (Ctrl+K) ───────────────────────────────────────────────────
app.get('/api/search', auth, (req, res) => {
  const q = `%${(req.query.q || '').toLowerCase()}%`;
  const results = [];
  
  // Search Students
  const students = db.prepare('SELECT id, name, reg_no FROM students WHERE LOWER(name) LIKE ? OR LOWER(reg_no) LIKE ? LIMIT 5').all(q, q);
  students.forEach(s => results.push({ id: s.id, type: 'student', title: s.name, subtitle: `Reg: ${s.reg_no}`, icon: '👨‍🎓', page: 'students' }));

  // Search Rooms
  const rooms = db.prepare('SELECT id, room_no, block FROM rooms WHERE LOWER(room_no) LIKE ? OR LOWER(block) LIKE ? LIMIT 5').all(q, q);
  rooms.forEach(r => results.push({ id: r.id, type: 'room', title: `Room ${r.room_no}`, subtitle: `Block ${r.block}`, icon: '🚪', page: 'rooms' }));

  // Search Notices
  const notices = db.prepare('SELECT id, title FROM notices WHERE LOWER(title) LIKE ? LIMIT 5').all(q);
  notices.forEach(n => results.push({ id: n.id, type: 'notice', title: n.title, subtitle: 'Notice', icon: '📢', page: 'notices' }));

  res.json(results);
});

// ─── SOS EMERGENCY ────────────────────────────────────────────────────────────
app.post('/api/sos', auth, (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE email = ?').get(req.user.email);
  if (!student) return res.status(403).json({ error: 'Only registered students can trigger SOS.' });
  
  // Log Emergency Complaint
  const msg = `SOS TRIGGERED by ${student.name} (Reg: ${student.reg_no}, Room: ${student.room_no || 'Unknown'})`;
  db.prepare(`INSERT INTO complaints (student_id, student_name, room_no, category, subject, description, priority, created_at)
              VALUES (?,?,?,?,?,?,?,?)`)
    .run(student.id, student.name, student.room_no, 'other', '🚨 SOS EMERGENCY', msg, 'critical', new Date().toISOString());

  // Real-time Socket Alert
  if (global.io) {
    global.io.to('WARDEN').emit('notification', msg);
    global.io.to('SUPER_ADMIN').emit('notification', msg);
    global.io.to('GATE_STAFF').emit('notification', msg);
  }

  // Audit
  if (global.auditLog) {
    global.auditLog(req, 'SOS Triggered', 'complaints', null, msg);
  }

  res.json({ success: true, message: 'SOS sent' });
});

// ─── AUDIT LOG HELPER ─────────────────────────────────────────────────────────
function audit(req, action, entity = '', entityId = '', details = '') {
  try {
    db.prepare(
      'INSERT INTO audit_logs (user_id, user_name, user_role, action, entity, entity_id, details, ip, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(
      req.user?.id || null,
      req.user?.name || 'System',
      req.user?.role || '',
      action, entity, String(entityId), details,
      req.ip || '',
      new Date().toISOString()
    );
  } catch (e) { console.error('Audit log error:', e.message); }
}

// ─── AUDIT LOG ROUTES ─────────────────────────────────────────────────────────
app.get('/api/audit-logs', auth, (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const { entity, user_id } = req.query;
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];
  if (entity)  { query += ' AND entity = ?'; params.push(entity); }
  if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
  query += ' ORDER BY id DESC LIMIT ?';
  params.push(limit);
  res.json(db.prepare(query).all(...params));
});

// ─── ANALYTICS ENDPOINTS ──────────────────────────────────────────────────────
app.get('/api/analytics/overview', auth, (req, res) => {
  const { role, dept_id, year, institution_id, gender } = req.user;

  // Student filter clause
  let sWhere = 'WHERE s.active = 1';
  let sParams = [];
  if (role === 'TUTOR') {
    sWhere += ' AND s.dept_id = ?';
    sParams.push(dept_id);
    if (year) {
      sWhere += ' AND s.year = ?';
      sParams.push(year);
    }
  } else if (role === 'HOD') {
    sWhere += ' AND s.dept_id = ?';
    sParams.push(dept_id);
  } else if (role === 'WARDEN') {
    if (institution_id) { sWhere += ' AND s.institution_id = ?'; sParams.push(institution_id); }
    if (gender) { sWhere += ' AND s.gender = ?'; sParams.push(gender); }
  }

  const totalStudents = db.prepare(`SELECT COUNT(*) as c FROM students s ${sWhere}`).get(...sParams).c;
  
  // Pending leaves count
  let lWhere = "WHERE la.status = 'pending'";
  let lParams = [];
  if (role === 'TUTOR') {
    lWhere += ' AND s.dept_id = ?'; lParams.push(dept_id);
    if (year) { lWhere += ' AND s.year = ?'; lParams.push(year); }
  } else if (role === 'HOD') {
    lWhere += ' AND s.dept_id = ?'; lParams.push(dept_id);
  } else if (role === 'WARDEN') {
    if (institution_id) { lWhere += ' AND s.institution_id = ?'; lParams.push(institution_id); }
    if (gender) { lWhere += ' AND s.gender = ?'; lParams.push(gender); }
  }
  const pendingLeaves = db.prepare(`
    SELECT COUNT(*) as c FROM leave_applications la JOIN students s ON la.student_id = s.id ${lWhere}
  `).get(...lParams).c;

  // Students currently outside count
  let outWhere = `WHERE el.direction='OUT' AND s.active=1 AND el.id IN (SELECT MAX(id) FROM entry_exit_logs WHERE flagged=0 GROUP BY student_id)`;
  let outParams = [];
  if (role === 'TUTOR') {
    outWhere += ' AND s.dept_id = ?'; outParams.push(dept_id);
    if (year) { outWhere += ' AND s.year = ?'; outParams.push(year); }
  } else if (role === 'HOD') {
    outWhere += ' AND s.dept_id = ?'; outParams.push(dept_id);
  } else if (role === 'WARDEN') {
    if (institution_id) { outWhere += ' AND s.institution_id = ?'; outParams.push(institution_id); }
    if (gender) { outWhere += ' AND s.gender = ?'; outParams.push(gender); }
  }
  const studentsOutside = db.prepare(`
    SELECT COUNT(DISTINCT s.id) as c FROM entry_exit_logs el JOIN students s ON el.student_id = s.id ${outWhere}
  `).get(...outParams).c;

  // Open complaints count
  let cWhere = "WHERE c.status IN ('open', 'in_progress')";
  let cParams = [];
  if (role === 'TUTOR') {
    cWhere += ' AND s.dept_id = ?'; cParams.push(dept_id);
    if (year) { cWhere += ' AND s.year = ?'; cParams.push(year); }
  } else if (role === 'HOD') {
    cWhere += ' AND s.dept_id = ?'; cParams.push(dept_id);
  } else if (role === 'WARDEN') {
    if (institution_id) { cWhere += ' AND s.institution_id = ?'; cParams.push(institution_id); }
    if (gender) { cWhere += ' AND s.gender = ?'; cParams.push(gender); }
  }
  const openComplaints = db.prepare(`
    SELECT COUNT(*) as c FROM complaints c JOIN students s ON c.student_id = s.id ${cWhere}
  `).get(...cParams).c;

  // Rooms and occupancy
  let rWhere = 'WHERE 1=1';
  let rParams = [];
  if (role === 'WARDEN') {
    if (institution_id) { rWhere += ' AND r.institution_id = ?'; rParams.push(institution_id); }
    if (gender) { rWhere += ' AND r.gender = ?'; rParams.push(gender); }
  }
  const totalRooms = db.prepare(`SELECT COUNT(*) as c FROM rooms r ${rWhere}`).get(...rParams).c;
  const occupiedRooms = db.prepare(`SELECT COUNT(DISTINCT room_id) as c FROM students s ${sWhere} AND s.room_id IS NOT NULL`).get(...sParams).c;
  const occupancyPct = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  // Students by institution
  const byInstitution = db.prepare(`
    SELECT i.code, i.name, COUNT(s.id) as count
    FROM institutions i LEFT JOIN students s ON s.institution_id = i.id AND s.active=1
    ${role === 'TUTOR' ? 'AND s.dept_id = ? AND s.year = ?' : role === 'HOD' ? 'AND s.dept_id = ?' : ''}
    GROUP BY i.id ORDER BY count DESC
  `).all(...(role === 'TUTOR' ? [dept_id, year] : role === 'HOD' ? [dept_id] : []));

  // Students by year
  const byYear = db.prepare(`SELECT s.year, COUNT(*) as count FROM students s ${sWhere} GROUP BY s.year ORDER BY s.year`).all(...sParams);

  // Students by gender
  const byGender = db.prepare(`SELECT s.gender, COUNT(*) as count FROM students s ${sWhere} GROUP BY s.gender`).all(...sParams);

  // Leave trend last 30 days
  const leaveTrend = db.prepare(`
    SELECT date(la.created_at) as date, COUNT(*) as count, la.status
    FROM leave_applications la
    JOIN students s ON la.student_id = s.id
    WHERE la.created_at >= date('now', '-30 days')
    ${role === 'TUTOR' ? 'AND s.dept_id = ? AND s.year = ?' : role === 'HOD' ? 'AND s.dept_id = ?' : ''}
    GROUP BY date(la.created_at), la.status
    ORDER BY date
  `).all(...(role === 'TUTOR' ? [dept_id, year] : role === 'HOD' ? [dept_id] : []));

  // Complaints by category
  const complaintsByCategory = db.prepare(`
    SELECT c.category, COUNT(*) as count
    FROM complaints c
    JOIN students s ON c.student_id = s.id
    ${cWhere}
    GROUP BY c.category ORDER BY count DESC
  `).all(...cParams);

  // Room occupancy by block
  const roomsByBlock = db.prepare(`
    SELECT r.block, COUNT(r.id) as total_rooms, COUNT(s.id) as occupied
    FROM rooms r LEFT JOIN students s ON s.room_id = r.id AND s.active=1
    ${role === 'WARDEN' && gender ? 'WHERE r.gender = ?' : ''}
    GROUP BY r.block ORDER BY r.block
  `).all(...(role === 'WARDEN' && gender ? [gender] : []));

  // Grocery expiry summary
  const expiringItems = db.prepare(`SELECT COUNT(*) as c FROM mess_materials_tools_items WHERE exp_date IS NOT NULL AND exp_date <= date('now', '+7 days')`).get().c;

  res.json({
    totalStudents, totalRooms, occupiedRooms, occupancyPct,
    pendingLeaves, studentsOutside, openComplaints,
    byInstitution, byYear, byGender,
    leaveTrend, complaintsByCategory, roomsByBlock,
    expiringItems
  });
});

// Patch key routes to emit audit events (Leave approve/reject)
// Done inline — the audit() helper is called from routes below.
// We use a global reference so routes written before this section can call it.
global.auditLog = audit;

// ─── START WITH SOCKET.IO ─────────────────────────────────────────────────────
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Connected socket rooms: role -> socket ids
io.on('connection', (socket) => {
  socket.on('join', (role) => {
    socket.join(role); // e.g. 'WARDEN', 'SUPER_ADMIN', 'FOOD_ADMIN'
    socket.join('ALL');
  });
});

// Expose io globally so routes can emit
global.io = io;

// STATIC_PLACEHOLDER_WILL_BE_APPENDED_AT_END

// ─── MESS ANALYTICS ─────────────────────────────────────────────────────────────

app.get('/api/mess_analytics/today', auth, (req, res) => {
  if (!['SUPER_ADMIN', 'HOSTEL_ADMIN', 'PRINCIPAL', 'FOOD_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const date = req.query.date || new Date().toISOString().split('T')[0];
  
  try {
    // 1. Auto-pull Student Headcount & Calculate Meals (3 meals/day)
    const activeStudentsCount = db.prepare('SELECT COUNT(*) as c FROM students WHERE active = 1').get()?.c || 0;
    const studentsServed = activeStudentsCount > 0 ? activeStudentsCount : 680;
    const totalMeals = studentsServed * 3;
    
    // 2. Food Cost & Consumption
    const logs = db.prepare(`
      SELECT l.qty_used, i.unit_price 
      FROM mess_inventory_usage_logs l
      JOIN mess_materials_tools_items i ON l.item_id = i.id
      WHERE l.date = ?
    `).all(date);
    
    const totalFoodCost = logs.reduce((sum, log) => sum + (log.qty_used * log.unit_price), 0);
    const costPerStudent = studentsServed ? (totalFoodCost / studentsServed) : 0;
    const costPerMeal = totalMeals ? (totalFoodCost / totalMeals) : 0;
    
    // 3. Wastage
    const wastage = db.prepare('SELECT SUM(prepared_qty) as p, SUM(consumed_qty) as c, SUM(wasted_qty) as w FROM mess_food_wastage WHERE date = ?').get(date) || { p: 0, c: 0, w: 0 };
    const preparedQuantity = wastage.p || 0;
    const consumedQuantity = wastage.c || 0;
    const wastedQuantity = wastage.w || 0;
    const wastagePercentage = preparedQuantity ? ((wastedQuantity / preparedQuantity) * 100) : 0;
    
    res.json({
      date,
      studentsServed,
      mealsServed: totalMeals,
      totalFoodCost,
      costPerStudent: parseFloat(costPerStudent.toFixed(2)),
      costPerMeal: parseFloat(costPerMeal.toFixed(2)),
      preparedQuantity,
      consumedQuantity,
      wastedQuantity,
      wastagePercentage: parseFloat(wastagePercentage.toFixed(2))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET & SAVE DAILY MESS PREPARATION & WASTAGE LOG ───────────────────────────
app.get('/api/mess_analytics/daily_log', auth, (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  try {
    const wastage = db.prepare('SELECT * FROM mess_food_wastage WHERE date = ? ORDER BY id DESC LIMIT 1').get(date) || {};
    res.json({
      date,
      prepared_qty: wastage.prepared_qty || '',
      consumed_qty: wastage.consumed_qty || '',
      wasted_qty: wastage.wasted_qty || '',
      unit: wastage.unit || 'kg',
      reason: wastage.reason || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mess_analytics/daily_log', auth, (req, res) => {
  if (!['SUPER_ADMIN', 'FOOD_ADMIN', 'HOSTEL_ADMIN', 'PRINCIPAL'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const { date, prepared_qty, consumed_qty, wasted_qty, unit, reason } = req.body;
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    const p = parseFloat(prepared_qty) || 0;
    const w = parseFloat(wasted_qty) || 0;
    const c = consumed_qty !== undefined && consumed_qty !== '' ? parseFloat(consumed_qty) : Math.max(0, p - w);

    db.prepare('DELETE FROM mess_food_wastage WHERE date = ?').run(targetDate);
    db.prepare(`
      INSERT INTO mess_food_wastage (date, category, prepared_qty, consumed_qty, wasted_qty, unit, reason)
      VALUES (?, 'General', ?, ?, ?, ?, ?)
    `).run(targetDate, p, c, w, unit || 'kg', reason || 'Daily Operations');

    res.json({ message: 'Daily food log updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/mess_analytics/consumption', auth, (req, res) => {
  const { startDate, endDate } = req.query;
  const start = startDate || new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];
  
  const query = `
    SELECT i.name as itemName, i.unit, i.unit_price as unitPrice, SUM(l.qty_used) as quantity
    FROM mess_inventory_usage_logs l
    JOIN mess_materials_tools_items i ON l.item_id = i.id
    WHERE l.date >= ? AND l.date <= ?
    GROUP BY i.id, i.name, i.unit, i.unit_price
    ORDER BY quantity DESC
  `;
  
  const results = db.prepare(query).all(start, end).map(r => ({
    ...r,
    cost: r.quantity * r.unitPrice
  }));
  res.json(results);
});

app.get('/api/mess_analytics/trends', auth, (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const start = new Date(new Date().setDate(new Date().getDate() - days)).toISOString().split('T')[0];
  
  const daysList = [];
  for(let i=days-1; i>=0; i--) {
    daysList.push(new Date(new Date().setDate(new Date().getDate() - i)).toISOString().split('T')[0]);
  }
  
  const results = daysList.map(date => {
    const logs = db.prepare(`SELECT l.qty_used, i.unit_price FROM mess_inventory_usage_logs l JOIN mess_materials_tools_items i ON l.item_id = i.id WHERE l.date = ?`).all(date);
    const foodCost = logs.reduce((sum, log) => sum + (log.qty_used * log.unit_price), 0);
    
    const w = db.prepare('SELECT SUM(prepared_qty) as p, SUM(wasted_qty) as w FROM mess_food_wastage WHERE date = ?').get(date) || {p:0, w:0};
    const wastagePercentage = w.p ? ((w.w / w.p) * 100) : 0;
    
    return {
      date,
      foodCost,
      wastage: w.w || 0,
      wastagePercentage: parseFloat(wastagePercentage.toFixed(2))
    };
  });
  
  res.json(results);
});

app.get('/api/mess_analytics/stock-status', auth, (req, res) => {
  const items = db.prepare('SELECT name as itemName, current_stock as currentStock, unit, reorder_level as reorderLevel FROM mess_materials_tools_items ORDER BY current_stock DESC').all();
  
  const results = items.map(i => {
    let status = 'NORMAL';
    if (i.currentStock <= 0) status = 'OUT OF STOCK';
    else if (i.currentStock <= i.reorderLevel) status = 'LOW';
    return { ...i, status };
  });
  res.json(results);
});

app.get('/api/mess_analytics/insights', auth, (req, res) => {
  const insights = [];
  
  // 1. Stock Insights
  const lowStock = db.prepare('SELECT name FROM mess_materials_tools_items WHERE current_stock > 0 AND current_stock <= reorder_level').all();
  if (lowStock.length > 0) {
    insights.push(`⚠ ${lowStock.map(i=>i.name).join(', ')} stock is below reorder level.`);
  }
  const outOfStock = db.prepare('SELECT name FROM mess_materials_tools_items WHERE current_stock <= 0').all();
  if (outOfStock.length > 0) {
    insights.push(`⚠ ${outOfStock.map(i=>i.name).join(', ')} is OUT OF STOCK.`);
  }

  // 2. Wastage Insight (Compare today vs yesterday)
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0];
  
  const wToday = db.prepare('SELECT SUM(wasted_qty) as w FROM mess_food_wastage WHERE date = ?').get(today)?.w || 0;
  const wYest = db.prepare('SELECT SUM(wasted_qty) as w FROM mess_food_wastage WHERE date = ?').get(yesterday)?.w || 0;
  
  if (wToday > wYest && wYest > 0) {
    insights.push(`⚠ Food wastage increased compared to yesterday (${wToday}kg vs ${wYest}kg).`);
  } else if (wToday < wYest) {
    insights.push(`✓ Food wastage decreased compared to yesterday.`);
  }
  
  // 3. Rice consumption
  const rToday = db.prepare(`SELECT SUM(l.qty_used) as q FROM mess_inventory_usage_logs l JOIN mess_materials_tools_items i ON l.item_id=i.id WHERE i.name='Rice' AND l.date=?`).get(today)?.q || 0;
  if (rToday > 100) {
    insights.push(`⚠ Rice consumption is high today (${rToday}kg).`);
  } else if (rToday > 0) {
    insights.push(`✓ Rice consumption is within normal range.`);
  }

  if (insights.length === 0) insights.push('✓ Everything is operating normally.');
  
  res.json(insights);
});




// ─── PRODUCTION SETUP (SERVE FRONTEND) ────────────────────────────────────────
// Serve static files AFTER all API routes
const clientBuildPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  // Catch-all route to serve index.html for React Router
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`✅ JKKM HMS Server running on port ${PORT} (Socket.io enabled)`));

