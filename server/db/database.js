const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'hms.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── SCHEMA ──────────────────────────────────────────────────────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS institutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  institution_id INTEGER,
  FOREIGN KEY (institution_id) REFERENCES institutions(id)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  institution_id INTEGER,
  dept_id INTEGER,
  year_id INTEGER,
  year TEXT,
  gender TEXT,
  phone TEXT,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_no TEXT NOT NULL,
  block TEXT,
  floor INTEGER DEFAULT 1,
  capacity INTEGER DEFAULT 4,
  gender TEXT NOT NULL,
  institution_id INTEGER,
  FOREIGN KEY (institution_id) REFERENCES institutions(id)
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reg_no TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  gender TEXT NOT NULL,
  institution_id INTEGER,
  dept_id INTEGER,
  year TEXT,
  room_id INTEGER,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_email TEXT,
  blood_group TEXT,
  mobile TEXT,
  email TEXT,
  qr_token TEXT,
  active INTEGER DEFAULT 1,
  FOREIGN KEY (institution_id) REFERENCES institutions(id),
  FOREIGN KEY (dept_id) REFERENCES departments(id),
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE IF NOT EXISTS entry_exit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  direction TEXT NOT NULL,
  authorized INTEGER DEFAULT 1,
  flagged INTEGER DEFAULT 0,
  flag_reason TEXT,
  created_at TEXT,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS leave_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  type TEXT NOT NULL,
  reason TEXT,
  from_dt TEXT,
  to_dt TEXT,
  place TEXT,
  is_emergency INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  current_level INTEGER DEFAULT 1,
  created_at TEXT,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS leave_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER,
  approver_id INTEGER,
  level INTEGER,
  decision TEXT,
  reason TEXT,
  created_at TEXT,
  FOREIGN KEY (application_id) REFERENCES leave_applications(id)
);

CREATE TABLE IF NOT EXISTS mess_materials_tools_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT,
  current_stock REAL DEFAULT 0,
  reorder_level REAL DEFAULT 10,
  reorder_qty REAL DEFAULT 50,
  supplier TEXT,
  unit_price REAL DEFAULT 0,
  batch_no TEXT,
  mfg_date TEXT,
  exp_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);


CREATE TABLE IF NOT EXISTS mess_inventory_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  batch_no TEXT,
  mfg_date TEXT,
  exp_date TEXT,
  unit_price REAL,
  qty_initial REAL DEFAULT 0,
  qty_remaining REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mess_inventory_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER,
  qty_used REAL,
  date TEXT,
  logged_by INTEGER
);

CREATE TABLE IF NOT EXISTS materials_tools_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  qty INTEGER DEFAULT 0,
  min_qty INTEGER DEFAULT 5,
  unit TEXT DEFAULT 'nos',
  unit_price REAL DEFAULT 0,
  total_price REAL DEFAULT 0,
  vendor TEXT,
  purchase_date TEXT,
  location TEXT,
  condition_status TEXT DEFAULT 'Good',
  asset_code TEXT,
  serial_no TEXT,
  warranty_expiry TEXT,
  notes TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS materials_tools_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  qty_change INTEGER NOT NULL,
  reason TEXT,
  reference_no TEXT,
  done_by TEXT,
  done_by_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES materials_tools_items(id)
);

CREATE TABLE IF NOT EXISTS materials_tools_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  room_id INTEGER,
  room_label TEXT,
  student_id INTEGER,
  student_name TEXT,
  assigned_qty INTEGER DEFAULT 1,
  assigned_date TEXT,
  expected_return TEXT,
  returned_date TEXT,
  condition_on_return TEXT,
  assigned_by TEXT,
  status TEXT DEFAULT 'Active',
  notes TEXT,
  FOREIGN KEY (item_id) REFERENCES materials_tools_items(id)
);

CREATE TABLE IF NOT EXISTS materials_tools_purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT UNIQUE,
  item_name TEXT NOT NULL,
  category TEXT,
  requested_qty INTEGER DEFAULT 1,
  received_qty INTEGER DEFAULT 0,
  unit_price REAL DEFAULT 0,
  total_amount REAL DEFAULT 0,
  vendor TEXT,
  status TEXT DEFAULT 'Pending',
  requested_by TEXT,
  requested_by_id INTEGER,
  approved_by TEXT,
  approved_by_id INTEGER,
  notes TEXT,
  bill_image TEXT,
  inventory_item_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raised_by INTEGER,
  room_no TEXT,
  category TEXT,
  description TEXT,
  priority TEXT DEFAULT 'Normal',
  status TEXT DEFAULT 'pending',
  assigned_to INTEGER,
  remarks TEXT,
  resolved_at TEXT,
  created_at TEXT
);


CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  posted_by INTEGER,
  title TEXT,
  content TEXT,
  category TEXT,
  created_at TEXT
);


  CREATE TABLE IF NOT EXISTS mess_meals_served (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE,
    students_served INTEGER DEFAULT 0,
    breakfast_count INTEGER DEFAULT 0,
    lunch_count INTEGER DEFAULT 0,
    snacks_count INTEGER DEFAULT 0,
    dinner_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS mess_food_wastage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    category TEXT,
    prepared_qty REAL DEFAULT 0,
    consumed_qty REAL DEFAULT 0,
    wasted_qty REAL DEFAULT 0,
    unit TEXT,
    reason TEXT
  );

  CREATE TABLE IF NOT EXISTS weekly_menu (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT,
  meal_type TEXT,
  items_description TEXT
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_phone TEXT,
  student_id INTEGER,
  student_name TEXT,
  type TEXT,
  message TEXT,
  status TEXT DEFAULT 'SENT',
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS mess_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  student_name TEXT,
  rating INTEGER,
  meal_type TEXT,
  dish_name TEXT,
  comment TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  student_name TEXT,
  room_no TEXT,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  is_anonymous INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  admin_remarks TEXT,
  resolved_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS hostel_vacate_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  vacate_date TEXT NOT NULL,
  parent_phone TEXT,
  status TEXT DEFAULT 'PENDING_WARDEN',
  has_damage INTEGER DEFAULT 0,
  damage_description TEXT,
  fine_amount REAL DEFAULT 0,
  fine_paid INTEGER DEFAULT 0,
  warden_remarks TEXT,
  principal_remarks TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  FOREIGN KEY (student_id) REFERENCES students(id)
);
`);

try { db.exec('ALTER TABLE materials_tools_purchase_orders ADD COLUMN bill_image TEXT'); } catch(e){}
try { db.exec('ALTER TABLE users ADD COLUMN year TEXT'); } catch(e){}

try {
  db.exec('ALTER TABLE maintenance_requests ADD COLUMN verified_by_student_id INTEGER');
  db.exec('ALTER TABLE maintenance_requests ADD COLUMN verified_at TEXT');
} catch(e) {
  // Ignore
}


// ─── SEED DATA ────────────────────────────────────────────────────────────────
const seedInstitutions = db.prepare('SELECT COUNT(*) as c FROM institutions').get().c;
if (seedInstitutions === 0) {
  const hash = bcrypt.hashSync('admin123', 10);

  // Institutions
  const instStmt = db.prepare('INSERT INTO institutions (name, code) VALUES (?, ?)');
  const eng = instStmt.run('JKKM College of Engineering', 'ENG').lastInsertRowid;
  const agri = instStmt.run('JKKM College of Agriculture', 'AGRI').lastInsertRowid;
  const pharm = instStmt.run('JKKM College of Pharmacy', 'PHARM').lastInsertRowid;

  // Departments
  const deptStmt = db.prepare('INSERT INTO departments (name, institution_id) VALUES (?, ?)');
  const cs = deptStmt.run('Computer Science', eng).lastInsertRowid;
  const mech = deptStmt.run('Mechanical Engineering', eng).lastInsertRowid;
  const eee = deptStmt.run('Electrical Engineering', eng).lastInsertRowid;
  const agriSci = deptStmt.run('Agricultural Science', agri).lastInsertRowid;
  const horti = deptStmt.run('Horticulture', agri).lastInsertRowid;
  const pharmSci = deptStmt.run('Pharmaceutical Science', pharm).lastInsertRowid;
  const pharmChem = deptStmt.run('Pharmaceutical Chemistry', pharm).lastInsertRowid;

  // Rooms - ENG Boys
  const roomStmt = db.prepare('INSERT INTO rooms (room_no, block, floor, capacity, gender, institution_id) VALUES (?,?,?,?,?,?)');
  const r101 = roomStmt.run('101', 'A', 1, 4, 'Male', eng).lastInsertRowid;
  const r102 = roomStmt.run('102', 'A', 1, 4, 'Male', eng).lastInsertRowid;
  const r103 = roomStmt.run('103', 'A', 1, 3, 'Male', eng).lastInsertRowid;
  const r201 = roomStmt.run('201', 'B', 2, 4, 'Female', eng).lastInsertRowid;
  const r202 = roomStmt.run('202', 'B', 2, 4, 'Female', eng).lastInsertRowid;
  // AGRI Rooms
  const r301 = roomStmt.run('301', 'C', 1, 4, 'Male', agri).lastInsertRowid;
  const r302 = roomStmt.run('302', 'C', 1, 4, 'Female', agri).lastInsertRowid;
  // PHARM Rooms
  const r401 = roomStmt.run('401', 'D', 1, 3, 'Male', pharm).lastInsertRowid;
  const r402 = roomStmt.run('402', 'D', 1, 3, 'Female', pharm).lastInsertRowid;

  // Users
  const userStmt = db.prepare('INSERT INTO users (name,email,password_hash,role,institution_id,dept_id,year,gender,phone) VALUES (?,?,?,?,?,?,?,?,?)');
  userStmt.run('Super Admin', 'superadmin@jkkm.edu', hash, 'SUPER_ADMIN', null, null, null, null, '9000000001');
  userStmt.run('ENG Hostel Admin', 'admin.eng@jkkm.edu', hash, 'HOSTEL_ADMIN', eng, null, null, null, '9000000002');
  userStmt.run('Mr. Rajesh Kumar', 'warden.eng@jkkm.edu', hash, 'WARDEN', eng, null, null, 'Male', '9000000003');
  userStmt.run('Mrs. Priya Lakshmi', 'warden.eng.g@jkkm.edu', hash, 'WARDEN', eng, null, null, 'Female', '9000000004');
  userStmt.run('Dr. Anand Venkat', 'tutor.cs@jkkm.edu', hash, 'TUTOR', eng, cs, '2nd', null, '9000000005');
  userStmt.run('Dr. Karthik Rajan', 'hod.cs@jkkm.edu', hash, 'HOD', eng, cs, null, null, '9000000006');
  userStmt.run('Dr. S. Muthuraman', 'principal.eng@jkkm.edu', hash, 'PRINCIPAL', eng, null, null, null, '9000000007');
  const foodAdminId = userStmt.run('Food Admin', 'food@jkkm.edu', hash, 'FOOD_ADMIN', null, null, null, null, '9000000008').lastInsertRowid;
  userStmt.run('Mess Worker', 'mess@jkkm.edu', hash, 'MESS_WORKER', null, null, null, null, '9000000009');
  userStmt.run('Inventory Admin', 'inventory@jkkm.edu', hash, 'INVENTORY_ADMIN', null, null, null, null, '9000000010');
  const wardUserId = userStmt.run('Warden ENG Boys', 'warden2@jkkm.edu', hash, 'WARDEN', eng, null, null, 'Male', '9000000011').lastInsertRowid;

  // Students
  const studentStmt = db.prepare('INSERT INTO students (reg_no,name,gender,institution_id,dept_id,year,room_id,guardian_name,guardian_phone,blood_group,mobile,email,qr_token,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)');
  const students = [
    ['ENG001', 'Arjun Krishnamurthy', 'Male', eng, cs, '2nd', r101, 'Krishnamurthy S', '9876501001', 'O+', '8765001001', 'arjun@student.jkkm.edu', 'QR001ENG'],
    ['ENG002', 'Vijay Sundaram', 'Male', eng, cs, '2nd', r101, 'Sundaram R', '9876501002', 'A+', '8765001002', 'vijay@student.jkkm.edu', 'QR002ENG'],
    ['ENG003', 'Ramesh Babu', 'Male', eng, mech, '3rd', r102, 'Babu N', '9876501003', 'B+', '8765001003', 'ramesh@student.jkkm.edu', 'QR003ENG'],
    ['ENG004', 'Suresh Natarajan', 'Male', eng, eee, '1st', r102, 'Natarajan K', '9876501004', 'AB+', '8765001004', 'suresh@student.jkkm.edu', 'QR004ENG'],
    ['ENG005', 'Karthik Murugan', 'Male', eng, cs, '4th', r103, 'Murugan A', '9876501005', 'O-', '8765001005', 'karthik@student.jkkm.edu', 'QR005ENG'],
    ['ENG006', 'Priya Devi', 'Female', eng, cs, '2nd', r201, 'Devi S', '9876501006', 'A+', '8765001006', 'priya@student.jkkm.edu', 'QR006ENG'],
    ['ENG007', 'Kavitha Rajan', 'Female', eng, eee, '3rd', r201, 'Rajan M', '9876501007', 'B-', '8765001007', 'kavitha@student.jkkm.edu', 'QR007ENG'],
    ['ENG008', 'Deepa Anand', 'Female', eng, mech, '1st', r202, 'Anand P', '9876501008', 'O+', '8765001008', 'deepa@student.jkkm.edu', 'QR008ENG'],
    ['AGRI001', 'Selvam Palanivel', 'Male', agri, agriSci, '2nd', r301, 'Palanivel G', '9876502001', 'A+', '8765002001', 'selvam@student.jkkm.edu', 'QR001AGRI'],
    ['AGRI002', 'Muthu Kumar', 'Male', agri, horti, '1st', r301, 'Kumar T', '9876502002', 'B+', '8765002002', 'muthu@student.jkkm.edu', 'QR002AGRI'],
    ['AGRI003', 'Geetha Selvan', 'Female', agri, agriSci, '3rd', r302, 'Selvan D', '9876502003', 'O+', '8765002003', 'geetha@student.jkkm.edu', 'QR003AGRI'],
    ['PHARM001', 'Ravi Chandran', 'Male', pharm, pharmSci, '2nd', r401, 'Chandran V', '9876503001', 'A-', '8765003001', 'ravi@student.jkkm.edu', 'QR001PHARM'],
    ['PHARM002', 'Meena Kumari', 'Female', pharm, pharmChem, '1st', r402, 'Kumari S', '9876503002', 'B+', '8765003002', 'meena@student.jkkm.edu', 'QR002PHARM'],
  ];
  students.forEach(s => studentStmt.run(...s));

  // Student Users (for login)
  userStmt.run('Arjun Krishnamurthy', 'arjun@student.jkkm.edu', hash, 'STUDENT', eng, cs, 'Male', '8765001001');

  // Entry/Exit Logs (some students already outside)
  const logStmt = db.prepare('INSERT INTO entry_exit_logs (student_id, direction, authorized, flagged, created_at) VALUES (?,?,?,?,?)');
  const ago = (h) => new Date(Date.now() - h * 3600000).toISOString();
  logStmt.run(3, 'OUT', 1, 0, ago(3));   // Ramesh is outside
  logStmt.run(9, 'OUT', 1, 0, ago(2));   // Selvam is outside
  logStmt.run(12, 'OUT', 1, 0, ago(1));  // Ravi is outside

  // Leave Applications
  const leaveStmt = db.prepare('INSERT INTO leave_applications (student_id,type,reason,from_dt,to_dt,place,is_emergency,status,current_level,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  leaveStmt.run(1, 'regular', 'Sister\'s wedding ceremony', today, nextWeek, 'Coimbatore', 0, 'pending', 1, new Date().toISOString());
  leaveStmt.run(2, 'regular', 'Medical check-up at home', today, new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0], 'Salem', 0, 'pending', 2, new Date().toISOString());
  leaveStmt.run(5, 'emergency', 'Father hospitalized urgently', today, today, 'Trichy', 1, 'approved', 1, new Date().toISOString());
  leaveStmt.run(6, 'festival', 'Pongal Festival', '2026-01-14', '2026-01-17', 'Chennai', 0, 'approved', 4, new Date().toISOString());
  leaveStmt.run(9, 'regular', 'Family function', today, new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0], 'Madurai', 0, 'pending', 3, new Date().toISOString());

  // Grocery Items
  const grocStmt = db.prepare('INSERT INTO mess_materials_tools_items (name,category,unit,current_stock,reorder_level,reorder_qty,supplier) VALUES (?,?,?,?,?,?,?)');
  grocStmt.run('Rice (Ponni)', 'Grains', 'kg', 450, 100, 200, 'Sri Murugan Traders');
  grocStmt.run('Toor Dal', 'Pulses', 'kg', 80, 30, 60, 'Quality Foods');
  grocStmt.run('Sunflower Oil', 'Oils', 'litre', 25, 20, 50, 'Gold Drop');
  grocStmt.run('Tomatoes', 'Vegetables', 'kg', 15, 20, 40, 'Local Market');
  grocStmt.run('Onions', 'Vegetables', 'kg', 60, 25, 50, 'Local Market');
  grocStmt.run('Potatoes', 'Vegetables', 'kg', 45, 20, 40, 'Local Market');
  grocStmt.run('Milk', 'Dairy', 'litre', 8, 20, 60, 'Aavin');
  grocStmt.run('Salt', 'Spices', 'kg', 12, 5, 10, 'Tata Salt');
  grocStmt.run('Turmeric', 'Spices', 'kg', 3, 2, 5, 'Sakthi Masala');
  grocStmt.run('Chilli Powder', 'Spices', 'kg', 5, 3, 8, 'Sakthi Masala');
  grocStmt.run('Wheat Flour', 'Grains', 'kg', 120, 50, 100, 'Pillsbury');
  grocStmt.run('Coconut', 'Vegetables', 'piece', 30, 20, 50, 'Local Market');

  // Usage logs, Meals served, and Food wastage seeds (Past 7 days including today)
  const usageStmt = db.prepare('INSERT INTO mess_inventory_usage_logs (item_id, qty_used, date, logged_by) VALUES (?,?,?,?)');
  const mealsStmt = db.prepare('INSERT INTO mess_meals_served (date, students_served, breakfast_count, lunch_count, snacks_count, dinner_count) VALUES (?,?,?,?,?,?)');
  const wasteStmt = db.prepare('INSERT INTO mess_food_wastage (date, category, prepared_qty, consumed_qty, wasted_qty, unit, reason) VALUES (?,?,?,?,?,?,?)');
  
  const days = [0, 1, 2, 3, 4, 5, 6];
  days.forEach(d => {
    const date = new Date(Date.now() - d * 86400000).toISOString().split('T')[0];
    // Ingredient usage
    usageStmt.run(1, 28 + Math.floor(Math.random()*5), date, foodAdminId); // Rice
    usageStmt.run(2, 4 + Math.floor(Math.random()*2), date, foodAdminId);  // Toor Dal
    usageStmt.run(3, 3 + Math.floor(Math.random()*1), date, foodAdminId);  // Oil
    usageStmt.run(4, 8 + Math.floor(Math.random()*3), date, foodAdminId);  // Tomatoes
    usageStmt.run(5, 12 + Math.floor(Math.random()*4), date, foodAdminId); // Onions

    // Meals served
    const students = 680 + Math.floor(Math.random()*40);
    const b = students - Math.floor(Math.random()*20);
    const l = students - Math.floor(Math.random()*10);
    const s = students - Math.floor(Math.random()*30);
    const dn = students - Math.floor(Math.random()*15);
    mealsStmt.run(date, students, b, l, s, dn);

    // Food wastage
    const prepared = 800 + Math.floor(Math.random()*60);
    const wasted = 15 + Math.floor(Math.random()*15);
    const consumed = prepared - wasted;
    wasteStmt.run(date, 'General', prepared, consumed, wasted, 'kg', 'Routine Mess Operation');
  });

  // Inventory
  const invStmt = db.prepare('INSERT INTO materials_tools_items (name,category,qty,min_qty,unit,unit_price,total_price,vendor,purchase_date,location,condition_status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  const now = new Date().toISOString();
  invStmt.run('Steel Cot',        'Furniture',  60,  50, 'nos',   3500,  210000, 'Sri Velmurugan Furniture',  '2025-06-01', 'Boys Block A',  'Good', now);
  invStmt.run('Mattress',         'Bedding',    60,  50, 'nos',   1800,  108000, 'Comfort Sleep',             '2025-06-01', 'Boys Block A',  'Good', now);
  invStmt.run('Ceiling Fan',      'Electrical', 25,  20, 'nos',   2200,   55000, 'Crompton Greaves',          '2025-07-15', 'All Blocks',    'Good', now);
  invStmt.run('Study Table',      'Furniture',  30,  25, 'nos',   2800,   84000, 'Sri Velmurugan Furniture',  '2025-06-01', 'Boys Block A',  'Good', now);
  invStmt.run('Water Purifier',   'Electrical',  4,   3, 'nos',  15000,   60000, 'Kent RO',                   '2025-08-01', 'Common Area',   'Good', now);
  invStmt.run('Washing Machine',  'Electrical',  2,   2, 'nos',  35000,   70000, 'LG Electronics',            '2025-09-01', 'Laundry Room',  'Good', now);
  invStmt.run('Mop & Bucket Set', 'Cleaning',   15,  10, 'set',    450,    6750, 'Cleaning Supplies Co',      '2026-01-10', 'All Blocks',    'Good', now);
  invStmt.run('Fire Extinguisher','Safety',       3,   5, 'nos',   2500,    7500, 'Minimax',                   '2025-10-01', 'All Floors',    'New',  now);
  invStmt.run('Pillow',           'Bedding',    60,  50, 'nos',    350,   21000, 'Comfort Sleep',             '2025-06-01', 'Boys Block A',  'Good', now);
  invStmt.run('Broom & Dustpan',  'Cleaning',   20,  15, 'set',    180,    3600, 'Cleaning Supplies Co',      '2026-01-10', 'All Blocks',    'Good', now);
  invStmt.run('Almirah/Cupboard', 'Furniture',  30,  25, 'nos',   5500,  165000, 'Sri Velmurugan Furniture',  '2025-06-01', 'Boys Block A',  'Good', now);
  invStmt.run('Tube Light 36W',   'Electrical', 40,  30, 'nos',    280,   11200, 'Philips',                   '2026-02-01', 'All Blocks',    'New',  now);
  invStmt.run('First Aid Kit',    'Safety',      4,   4, 'kit',   1200,    4800, 'Apollo Pharmacy',           '2026-01-01', 'Common Area',   'New',  now);

  // Maintenance Requests
  const maintStmt = db.prepare('INSERT INTO maintenance_requests (raised_by,room_no,category,description,priority,status,created_at) VALUES (?,?,?,?,?,?,?)');
  maintStmt.run(wardUserId, '101', 'Electrical', 'Ceiling fan not working in room 101', 'Urgent', 'pending', ago(5));
  maintStmt.run(wardUserId, '102', 'Plumbing', 'Water tap leaking in bathroom', 'Normal', 'in_progress', ago(2));
  maintStmt.run(wardUserId, '201', 'Furniture', 'Study table leg broken', 'Normal', 'pending', ago(1));
  maintStmt.run(wardUserId, '301', 'Civil', 'Wall paint peeling in room 301', 'Normal', 'completed', ago(10));

  // Notices
  const noticeStmt = db.prepare('INSERT INTO notices (posted_by,title,content,category,created_at) VALUES (?,?,?,?,?)');
  noticeStmt.run(1, 'Hostel Day Celebration', 'Annual Hostel Day will be celebrated on 15th July 2026. All students are requested to participate.', 'General', ago(24));
  noticeStmt.run(1, 'Water Supply Interruption', 'Water supply will be interrupted on 6th July from 10AM to 2PM for maintenance.', 'Urgent', ago(12));
  noticeStmt.run(1, 'New Mess Menu', 'Updated weekly menu has been posted. Please check the mess notice board.', 'General', ago(48));

  // Weekly Menu
  const menuStmt = db.prepare('INSERT INTO weekly_menu (day,meal_type,items_description) VALUES (?,?,?)');
  const menuData = [
    ['Monday', 'Breakfast', 'Idli (4), Sambar, Coconut Chutney, Tea'],
    ['Monday', 'Lunch', 'Rice, Sambar, Rasam, Potato Fry, Curd, Papad'],
    ['Monday', 'Dinner', 'Chapati (3), Dal Makhani, Mixed Veg Curry'],
    ['Tuesday', 'Breakfast', 'Dosa (2), Tomato Chutney, Sambar, Tea'],
    ['Tuesday', 'Lunch', 'Rice, Dal Fry, Rasam, Beans Poriyal, Curd'],
    ['Tuesday', 'Dinner', 'Rice, Chicken Curry, Papad, Pickle'],
    ['Wednesday', 'Breakfast', 'Pongal, Sambar, Chutney, Tea'],
    ['Wednesday', 'Lunch', 'Rice, Sambar, Kootu, Carrot Poriyal, Curd'],
    ['Wednesday', 'Dinner', 'Chapati (3), Paneer Butter Masala, Dal'],
    ['Thursday', 'Breakfast', 'Uthappam (2), Sambar, Coconut Chutney, Tea'],
    ['Thursday', 'Lunch', 'Rice, Sambar, Rasam, Egg Curry, Curd, Papad'],
    ['Thursday', 'Dinner', 'Fried Rice, Gobi Manchurian, Soup'],
    ['Friday', 'Breakfast', 'Idiyappam (3), Coconut Milk, Banana, Tea'],
    ['Friday', 'Lunch', 'Rice, Fish Curry, Sambar, Rasam, Curd'],
    ['Friday', 'Dinner', 'Parotta (2), Chicken Salna, Onion Raita'],
    ['Saturday', 'Breakfast', 'Poori (2), Potato Masala, Tea'],
    ['Saturday', 'Lunch', 'Biryani, Raita, Boiled Egg, Pickle'],
    ['Saturday', 'Dinner', 'Chapati (2), Dal Tadka, Mixed Veg'],
    ['Sunday', 'Breakfast', 'Bread, Jam, Butter, Boiled Egg, Tea/Coffee'],
    ['Sunday', 'Lunch', 'Rice, Mutton Curry, Sambar, Rasam, Curd, Sweet'],
    ['Sunday', 'Dinner', 'Naan (2), Paneer Tikka Masala, Dal Fry'],
  ];
  menuData.forEach(m => menuStmt.run(...m));

  // Mess Feedback Initial Seeds
  const feedbackCount = db.prepare('SELECT COUNT(*) as count FROM mess_feedback').get().count;
  if (feedbackCount === 0) {
    const feedbackStmt = db.prepare('INSERT INTO mess_feedback (student_id, student_name, rating, meal_type, dish_name, comment, created_at) VALUES (?,?,?,?,?,?,?)');
    feedbackStmt.run(1, 'Arjun Krishnamurthy', 5, 'Lunch', 'Biryani & Raita', 'Excellent taste and quantity! Very fresh.', ago(2));
    feedbackStmt.run(2, 'Vijay Sundaram', 4, 'Breakfast', 'Idli & Sambar', 'Sambar was hot and tasty.', ago(5));
    feedbackStmt.run(3, 'Ramesh Babu', 5, 'Dinner', 'Paneer Butter Masala', 'Great paneer dish! Soft and delicious.', ago(8));
  }

  // Notification Logs Initial Seeds
  const notifCount = db.prepare('SELECT COUNT(*) as count FROM notification_logs').get().count;
  if (notifCount === 0) {
    const notifStmt = db.prepare('INSERT INTO notification_logs (recipient_phone, student_id, student_name, type, message, status, sent_at) VALUES (?,?,?,?,?,?,?)');
    notifStmt.run('9876501001', 1, 'Arjun Krishnamurthy', 'GATE_OUT', 'ALERT: Your ward Arjun Krishnamurthy checked OUT of JKKM Hostel at 10:15 AM.', 'SENT', ago(3));
    notifStmt.run('9876501002', 2, 'Vijay Sundaram', 'EMERGENCY_LEAVE', 'EMERGENCY LEAVE ALERT: Your ward Vijay Sundaram applied for emergency leave to Salem.', 'SENT', ago(6));
  }

  console.log('✅ Database seeded with sample data');
}

module.exports = db;
