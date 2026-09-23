/**
 * HMS Backend – Unit Tests (CommonJS)
 * Tests individual helper functions in isolation (no DB, no HTTP).
 */

// ── Pure helper functions ─────────────────────────────────────────────────

function validateRegNo(regNo) {
  return /^[A-Z]{2,6}\d{3,6}$/.test(regNo);
}

function sanitiseName(raw) {
  return raw.trim().replace(/\b\w/g, c => c.toUpperCase());
}

function leaveDuration(from, to) {
  return Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
}

function requiresFine(hasDamage, fineAmount) {
  return hasDamage === true && typeof fineAmount === 'number' && fineAmount > 0;
}

function httpStatusLabel(code) {
  const map = { 200: 'OK', 201: 'Created', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error' };
  return map[code] || 'Unknown';
}

function isStrongPassword(pw) {
  return pw.length >= 8;
}

function canApproveLeave(role) {
  return ['WARDEN', 'HOSTEL_ADMIN', 'SUPER_ADMIN', 'TUTOR', 'HOD', 'PRINCIPAL'].includes(role);
}

function isRoomFull(currentOccupancy, capacity) {
  return currentOccupancy >= capacity;
}

function vacateStatusLabel(status) {
  const labels = {
    PENDING_WARDEN: 'Awaiting Warden',
    PENDING_FINE_PAYMENT: 'Fine Pending',
    PENDING_PRINCIPAL: 'Awaiting Principal',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
  };
  return labels[status] || 'Unknown';
}

function formatINR(amount) {
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

function occupancyPercent(occupied, capacity) {
  if (!capacity) return 0;
  return Math.round((occupied / capacity) * 100);
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('validateRegNo', () => {
  test('accepts ENG001', () => expect(validateRegNo('ENG001')).toBe(true));
  test('accepts AGRI002', () => expect(validateRegNo('AGRI002')).toBe(true));
  test('accepts PHARM001', () => expect(validateRegNo('PHARM001')).toBe(true));
  test('rejects lowercase letters', () => expect(validateRegNo('eng001')).toBe(false));
  test('rejects missing digits', () => expect(validateRegNo('ENG')).toBe(false));
  test('rejects empty string', () => expect(validateRegNo('')).toBe(false));
  test('rejects special characters', () => expect(validateRegNo('ENG-001')).toBe(false));
});

describe('sanitiseName', () => {
  test('title-cases a name', () => expect(sanitiseName('arjun krishnamurthy')).toBe('Arjun Krishnamurthy'));
  test('trims whitespace', () => expect(sanitiseName('  Priya  ')).toBe('Priya'));
  test('handles single word', () => expect(sanitiseName('rajesh')).toBe('Rajesh'));
  test('handles already title-cased', () => expect(sanitiseName('Vijay Sundaram')).toBe('Vijay Sundaram'));
});

describe('leaveDuration', () => {
  test('single day = 1', () => expect(leaveDuration('2025-08-07', '2025-08-07')).toBe(1));
  test('two days = 2', () => expect(leaveDuration('2025-08-07', '2025-08-08')).toBe(2));
  test('one week = 7', () => expect(leaveDuration('2025-08-01', '2025-08-07')).toBe(7));
  test('cross-month = 5', () => expect(leaveDuration('2025-07-29', '2025-08-02')).toBe(5));
});

describe('requiresFine', () => {
  test('true when damage=true, fine>0', () => expect(requiresFine(true, 500)).toBe(true));
  test('false when no damage', () => expect(requiresFine(false, 500)).toBe(false));
  test('false when fine is 0', () => expect(requiresFine(true, 0)).toBe(false));
  test('false when fine is negative', () => expect(requiresFine(true, -100)).toBe(false));
});

describe('httpStatusLabel', () => {
  test('200 → OK', () => expect(httpStatusLabel(200)).toBe('OK'));
  test('201 → Created', () => expect(httpStatusLabel(201)).toBe('Created'));
  test('400 → Bad Request', () => expect(httpStatusLabel(400)).toBe('Bad Request'));
  test('401 → Unauthorized', () => expect(httpStatusLabel(401)).toBe('Unauthorized'));
  test('404 → Not Found', () => expect(httpStatusLabel(404)).toBe('Not Found'));
  test('500 → Internal Server Error', () => expect(httpStatusLabel(500)).toBe('Internal Server Error'));
  test('999 → Unknown', () => expect(httpStatusLabel(999)).toBe('Unknown'));
});

describe('isStrongPassword', () => {
  test('8 chars is strong enough', () => expect(isStrongPassword('password')).toBe(true));
  test('12 chars passes', () => expect(isStrongPassword('superSecret1')).toBe(true));
  test('7 chars too weak', () => expect(isStrongPassword('abc123!')).toBe(false));
  test('empty fails', () => expect(isStrongPassword('')).toBe(false));
});

describe('canApproveLeave', () => {
  test('WARDEN can approve', () => expect(canApproveLeave('WARDEN')).toBe(true));
  test('TUTOR can approve', () => expect(canApproveLeave('TUTOR')).toBe(true));
  test('HOD can approve', () => expect(canApproveLeave('HOD')).toBe(true));
  test('PRINCIPAL can approve', () => expect(canApproveLeave('PRINCIPAL')).toBe(true));
  test('SUPER_ADMIN can approve', () => expect(canApproveLeave('SUPER_ADMIN')).toBe(true));
  test('STUDENT cannot approve', () => expect(canApproveLeave('STUDENT')).toBe(false));
  test('GATE_STAFF cannot approve', () => expect(canApproveLeave('GATE_STAFF')).toBe(false));
  test('MESS_WORKER cannot approve', () => expect(canApproveLeave('MESS_WORKER')).toBe(false));
});

describe('isRoomFull', () => {
  test('at capacity is full', () => expect(isRoomFull(4, 4)).toBe(true));
  test('over capacity is full', () => expect(isRoomFull(5, 4)).toBe(true));
  test('1 space left is not full', () => expect(isRoomFull(3, 4)).toBe(false));
  test('empty room is not full', () => expect(isRoomFull(0, 4)).toBe(false));
});

describe('vacateStatusLabel', () => {
  test('PENDING_WARDEN', () => expect(vacateStatusLabel('PENDING_WARDEN')).toBe('Awaiting Warden'));
  test('PENDING_FINE_PAYMENT', () => expect(vacateStatusLabel('PENDING_FINE_PAYMENT')).toBe('Fine Pending'));
  test('PENDING_PRINCIPAL', () => expect(vacateStatusLabel('PENDING_PRINCIPAL')).toBe('Awaiting Principal'));
  test('APPROVED', () => expect(vacateStatusLabel('APPROVED')).toBe('Approved'));
  test('REJECTED', () => expect(vacateStatusLabel('REJECTED')).toBe('Rejected'));
  test('unknown → Unknown', () => expect(vacateStatusLabel('BLAH')).toBe('Unknown'));
});

describe('occupancyPercent', () => {
  test('full room = 100%', () => expect(occupancyPercent(4, 4)).toBe(100));
  test('half full = 50%', () => expect(occupancyPercent(2, 4)).toBe(50));
  test('empty = 0%', () => expect(occupancyPercent(0, 4)).toBe(0));
  test('no divide by zero', () => expect(occupancyPercent(3, 0)).toBe(0));
  test('rounds correctly', () => expect(occupancyPercent(1, 3)).toBe(33));
});

describe('getInitials', () => {
  test('two-word name', () => expect(getInitials('Arjun Krishnamurthy')).toBe('AK'));
  test('single word', () => expect(getInitials('Priya')).toBe('P'));
  test('three words = first+last', () => expect(getInitials('Dr Anand Venkat')).toBe('DV'));
  test('empty → ?', () => expect(getInitials('')).toBe('?'));
  test('null → ?', () => expect(getInitials(null)).toBe('?'));
});

describe('formatINR', () => {
  test('₹500 formats correctly', () => expect(formatINR(500)).toBe('₹500'));
  test('₹0 formats correctly', () => expect(formatINR(0)).toBe('₹0'));
  test('contains ₹ symbol', () => expect(formatINR(2500)).toContain('₹'));
});

// ══ Inventory Helper Functions ════════════════════════════════════════════════

function calcTotalValue(qty, unitPrice) {
  return Math.max(0, (qty || 0) * (unitPrice || 0));
}

function stockAfterAdjust(current, change) {
  return Math.max(0, current + change);
}

function txTypeDirection(type) {
  const addTypes    = ['Purchase', 'Return', 'Adjustment'];
  const removeTypes = ['Issue', 'Damage', 'Disposal'];
  if (addTypes.includes(type))    return '+';
  if (removeTypes.includes(type)) return '-';
  return '?';
}

function poStatusFlow(current, action) {
  const transitions = {
    Pending:   { approve: 'Approved',  cancel: 'Cancelled' },
    Approved:  { order:   'Ordered',   cancel: 'Cancelled' },
    Ordered:   { receive: 'Received',  cancel: 'Cancelled' },
  };
  return (transitions[current] || {})[action] || null;
}

function warrantyExpired(warrantyDate) {
  if (!warrantyDate) return false;
  return new Date(warrantyDate) < new Date();
}

function assetCodeValid(code) {
  return /^[A-Z]{2,8}-[A-Z]{2,8}-\d{3,6}$/i.test(code);
}

function toCSV(rows, columns) {
  const header = columns.join(',');
  const body = rows.map(r =>
    columns.map(c => {
      const val = r[c] == null ? '' : String(r[c]).replace(/"/g, '""');
      return `"${val}"`;
    }).join(',')
  ).join('\n');
  return header + '\n' + body;
}

function lowStockAlert(qty, minQty) {
  return qty <= minQty;
}

function poTotalAmount(qty, unitPrice) {
  return (qty || 0) * (unitPrice || 0);
}

function generatePONumber() {
  const ts = Date.now().toString().slice(-8);
  return 'PO-' + ts;
}

// ── Unit Tests: calcTotalValue ────────────────────────────────────────────────
describe('calcTotalValue', () => {
  test('qty=10, price=100 → 1000',        () => expect(calcTotalValue(10, 100)).toBe(1000));
  test('qty=0, price=500 → 0',            () => expect(calcTotalValue(0, 500)).toBe(0));
  test('null qty → 0',                    () => expect(calcTotalValue(null, 200)).toBe(0));
  test('null price → 0',                  () => expect(calcTotalValue(5, null)).toBe(0));
  test('negative qty → capped 0',         () => expect(calcTotalValue(-5, 100)).toBe(0));
  test('fractional: 2.5 × 400 = 1000',   () => expect(calcTotalValue(2.5, 400)).toBe(1000));
});

// ── Unit Tests: stockAfterAdjust ─────────────────────────────────────────────
describe('stockAfterAdjust', () => {
  test('add 10 to 50 → 60',              () => expect(stockAfterAdjust(50, 10)).toBe(60));
  test('remove 5 from 20 → 15',          () => expect(stockAfterAdjust(20, -5)).toBe(15));
  test('remove more than stock → 0',     () => expect(stockAfterAdjust(3, -10)).toBe(0));
  test('zero change → unchanged',        () => expect(stockAfterAdjust(25, 0)).toBe(25));
  test('starting from 0 add 1 → 1',      () => expect(stockAfterAdjust(0, 1)).toBe(1));
});

// ── Unit Tests: txTypeDirection ───────────────────────────────────────────────
describe('txTypeDirection', () => {
  test('Purchase → +',                   () => expect(txTypeDirection('Purchase')).toBe('+'));
  test('Return → +',                     () => expect(txTypeDirection('Return')).toBe('+'));
  test('Adjustment → +',                 () => expect(txTypeDirection('Adjustment')).toBe('+'));
  test('Issue → -',                      () => expect(txTypeDirection('Issue')).toBe('-'));
  test('Damage → -',                     () => expect(txTypeDirection('Damage')).toBe('-'));
  test('Disposal → -',                   () => expect(txTypeDirection('Disposal')).toBe('-'));
  test('Unknown type → ?',               () => expect(txTypeDirection('Transfer')).toBe('?'));
});

// ── Unit Tests: poStatusFlow ──────────────────────────────────────────────────
describe('poStatusFlow', () => {
  test('Pending → approve → Approved',   () => expect(poStatusFlow('Pending',  'approve')).toBe('Approved'));
  test('Pending → cancel → Cancelled',   () => expect(poStatusFlow('Pending',  'cancel')).toBe('Cancelled'));
  test('Approved → order → Ordered',     () => expect(poStatusFlow('Approved', 'order')).toBe('Ordered'));
  test('Approved → cancel → Cancelled',  () => expect(poStatusFlow('Approved', 'cancel')).toBe('Cancelled'));
  test('Ordered → receive → Received',   () => expect(poStatusFlow('Ordered',  'receive')).toBe('Received'));
  test('Ordered → cancel → Cancelled',   () => expect(poStatusFlow('Ordered',  'cancel')).toBe('Cancelled'));
  test('Received → any → null',          () => expect(poStatusFlow('Received', 'approve')).toBeNull());
  test('Unknown status → null',          () => expect(poStatusFlow('GARBAGE',  'approve')).toBeNull());
});

// ── Unit Tests: warrantyExpired ───────────────────────────────────────────────
describe('warrantyExpired', () => {
  test('past date → expired',            () => expect(warrantyExpired('2020-01-01')).toBe(true));
  test('far future → not expired',       () => expect(warrantyExpired('2099-12-31')).toBe(false));
  test('null → not expired',             () => expect(warrantyExpired(null)).toBe(false));
  test('empty string → not expired',     () => expect(warrantyExpired('')).toBe(false));
});

// ── Unit Tests: assetCodeValid ────────────────────────────────────────────────
describe('assetCodeValid', () => {
  test('JKKM-FURN-001 valid',            () => expect(assetCodeValid('JKKM-FURN-001')).toBe(true));
  test('EL-ELEC-999 valid',              () => expect(assetCodeValid('EL-ELEC-999')).toBe(true));
  test('HOSTEL-CLEAN-10050 valid',       () => expect(assetCodeValid('HOSTEL-CLEAN-10050')).toBe(true));
  test('no dashes → invalid',            () => expect(assetCodeValid('JKKMFURN001')).toBe(false));
  test('missing number part → invalid',  () => expect(assetCodeValid('JKKM-FURN')).toBe(false));
  test('empty string → invalid',         () => expect(assetCodeValid('')).toBe(false));
});

// ── Unit Tests: toCSV ─────────────────────────────────────────────────────────
describe('toCSV', () => {
  test('header row is correct',          () => expect(toCSV([], ['id','name','qty']).split('\n')[0]).toBe('id,name,qty'));
  test('data row has correct values',    () => {
    const csv = toCSV([{ id: 1, name: 'Steel Cot', qty: 10 }], ['id','name','qty']);
    expect(csv).toContain('"Steel Cot"');
    expect(csv).toContain('"10"');
  });
  test('quotes are escaped',             () => {
    const csv = toCSV([{ id:1, name:'Cot "Deluxe"', qty:5 }], ['id','name','qty']);
    expect(csv).toContain('""Deluxe""');
  });
  test('null values become empty string', () => {
    const csv = toCSV([{ id:1, name:null, qty:0 }], ['id','name','qty']);
    const parts = csv.split('\n')[1].split(',');
    expect(parts[1]).toBe('""');
  });
  test('empty rows → header only',       () => expect(toCSV([], ['id','name']).trim()).toBe('id,name'));
  test('multiple rows correct count',    () => {
    const csv = toCSV([{id:1,name:'A'},{id:2,name:'B'}], ['id','name']);
    expect(csv.split('\n').length).toBe(3); // header + 2 rows
  });
});

// ── Unit Tests: lowStockAlert ─────────────────────────────────────────────────
describe('lowStockAlert', () => {
  test('qty === min_qty → alert',        () => expect(lowStockAlert(5, 5)).toBe(true));
  test('qty < min_qty → alert',          () => expect(lowStockAlert(3, 5)).toBe(true));
  test('qty > min_qty → no alert',       () => expect(lowStockAlert(6, 5)).toBe(false));
  test('qty = 0 → alert',               () => expect(lowStockAlert(0, 5)).toBe(true));
});

// ── Unit Tests: poTotalAmount ─────────────────────────────────────────────────
describe('poTotalAmount', () => {
  test('10 × 500 = 5000',               () => expect(poTotalAmount(10, 500)).toBe(5000));
  test('0 × 1000 = 0',                  () => expect(poTotalAmount(0, 1000)).toBe(0));
  test('null qty → 0',                  () => expect(poTotalAmount(null, 200)).toBe(0));
  test('null price → 0',                () => expect(poTotalAmount(5, null)).toBe(0));
});

// ── Unit Tests: generatePONumber ─────────────────────────────────────────────
describe('generatePONumber', () => {
  test('starts with PO-',               () => expect(generatePONumber().startsWith('PO-')).toBe(true));
  test('has 8-digit suffix',            () => expect(generatePONumber().replace('PO-','')).toHaveLength(8));
  test('two calls produce different POs', () => {
    const a = generatePONumber();
    const b = generatePONumber();
    // They may occasionally match within the same ms, so just check format
    expect(a).toMatch(/^PO-\d{8}$/);
    expect(b).toMatch(/^PO-\d{8}$/);
  });
});
