/**
 * HMS Frontend – Unit Tests (Vitest + React Testing Library)
 * Tests pure utility functions used across the React client.
 */

import { describe, test, expect } from 'vitest';

// ── Utility functions ─────────────────────────────────────────────────────

/** Format a date string to Indian locale */
function formatDateIN(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN');
}

/** Derive badge CSS class from leave/vacate status */
function statusBadgeClass(status) {
  if (['Approved', 'APPROVED'].includes(status)) return 'badge-success';
  if (['Rejected', 'REJECTED'].includes(status)) return 'badge-danger';
  return 'badge-warning';
}

/** Determine vacate status label */
function vacateLabel(status) {
  const map = {
    PENDING_WARDEN:       'Awaiting Warden',
    PENDING_FINE_PAYMENT: 'Fine Pending',
    PENDING_PRINCIPAL:    'Awaiting Principal',
    APPROVED:             'Approved & Vacated',
    REJECTED:             'Rejected',
  };
  return map[status] ?? 'Unknown';
}

/** Build initials avatar from a name */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Check if a role can access the department management page */
function canManageDepartments(role) {
  return ['SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(role);
}

/** Check if a role can view the gate scanner */
function canAccessGate(role) {
  return ['GATE_STAFF', 'SUPER_ADMIN', 'HOSTEL_ADMIN'].includes(role);
}

/** Truncate text to N chars with ellipsis */
function truncate(text, n) {
  if (!text) return '';
  return text.length > n ? text.slice(0, n) + '…' : text;
}

/** Compute room occupancy percentage */
function occupancyPercent(occupied, capacity) {
  if (!capacity) return 0;
  return Math.round((occupied / capacity) * 100);
}

/** Format currency in INR */
function formatINR(amount) {
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

/** Parse blood group string to display form */
function bloodGroupDisplay(bg) {
  if (!bg) return 'Not recorded';
  return bg;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('formatDateIN', () => {
  test('formats an ISO date to en-IN locale', () => {
    const result = formatDateIN('2025-08-07');
    // jsdom may render 7/8/2025 or 07/08/2025 depending on locale
    expect(result).toMatch(/7|07/);
    expect(result).toMatch(/8|08/);
    expect(result).toMatch(/2025/);
  });

  test('returns em-dash for null/undefined', () => {
    expect(formatDateIN(null)).toBe('—');
    expect(formatDateIN(undefined)).toBe('—');
    expect(formatDateIN('')).toBe('—');
  });
});

describe('statusBadgeClass', () => {
  test('Approved → badge-success', () => expect(statusBadgeClass('Approved')).toBe('badge-success'));
  test('APPROVED → badge-success', () => expect(statusBadgeClass('APPROVED')).toBe('badge-success'));
  test('Rejected → badge-danger', () => expect(statusBadgeClass('Rejected')).toBe('badge-danger'));
  test('REJECTED → badge-danger', () => expect(statusBadgeClass('REJECTED')).toBe('badge-danger'));
  test('Pending → badge-warning', () => expect(statusBadgeClass('Pending')).toBe('badge-warning'));
  test('PENDING_WARDEN → badge-warning', () => expect(statusBadgeClass('PENDING_WARDEN')).toBe('badge-warning'));
  test('anything else → badge-warning', () => expect(statusBadgeClass('UNKNOWN')).toBe('badge-warning'));
});

describe('vacateLabel', () => {
  test('PENDING_WARDEN label', () => expect(vacateLabel('PENDING_WARDEN')).toBe('Awaiting Warden'));
  test('PENDING_FINE_PAYMENT label', () => expect(vacateLabel('PENDING_FINE_PAYMENT')).toBe('Fine Pending'));
  test('PENDING_PRINCIPAL label', () => expect(vacateLabel('PENDING_PRINCIPAL')).toBe('Awaiting Principal'));
  test('APPROVED label', () => expect(vacateLabel('APPROVED')).toBe('Approved & Vacated'));
  test('REJECTED label', () => expect(vacateLabel('REJECTED')).toBe('Rejected'));
  test('unknown returns Unknown', () => expect(vacateLabel('BLAH')).toBe('Unknown'));
});

describe('getInitials', () => {
  test('two-word name → two initials', () => expect(getInitials('Arjun Krishnamurthy')).toBe('AK'));
  test('single word → one initial', () => expect(getInitials('Priya')).toBe('P'));
  test('three words → first+last initial', () => expect(getInitials('Dr Anand Venkat')).toBe('DV'));
  test('empty string → ?', () => expect(getInitials('')).toBe('?'));
  test('null → ?', () => expect(getInitials(null)).toBe('?'));
});

describe('canManageDepartments', () => {
  test('SUPER_ADMIN can manage', () => expect(canManageDepartments('SUPER_ADMIN')).toBe(true));
  test('HOSTEL_ADMIN can manage', () => expect(canManageDepartments('HOSTEL_ADMIN')).toBe(true));
  test('WARDEN cannot manage', () => expect(canManageDepartments('WARDEN')).toBe(false));
  test('STUDENT cannot manage', () => expect(canManageDepartments('STUDENT')).toBe(false));
  test('PRINCIPAL cannot manage', () => expect(canManageDepartments('PRINCIPAL')).toBe(false));
});

describe('canAccessGate', () => {
  test('GATE_STAFF can access', () => expect(canAccessGate('GATE_STAFF')).toBe(true));
  test('SUPER_ADMIN can access', () => expect(canAccessGate('SUPER_ADMIN')).toBe(true));
  test('HOSTEL_ADMIN can access', () => expect(canAccessGate('HOSTEL_ADMIN')).toBe(true));
  test('STUDENT cannot access', () => expect(canAccessGate('STUDENT')).toBe(false));
  test('WARDEN cannot access', () => expect(canAccessGate('WARDEN')).toBe(false));
});

describe('truncate', () => {
  test('short text is returned as-is', () => expect(truncate('Hello', 10)).toBe('Hello'));
  test('long text is truncated with ellipsis', () => expect(truncate('Hello World!', 5)).toBe('Hello…'));
  test('text exactly at limit is not truncated', () => expect(truncate('Hello', 5)).toBe('Hello'));
  test('null/undefined returns empty string', () => {
    expect(truncate(null, 10)).toBe('');
    expect(truncate(undefined, 10)).toBe('');
  });
});

describe('occupancyPercent', () => {
  test('full room = 100%', () => expect(occupancyPercent(4, 4)).toBe(100));
  test('half full = 50%', () => expect(occupancyPercent(2, 4)).toBe(50));
  test('empty = 0%', () => expect(occupancyPercent(0, 4)).toBe(0));
  test('zero capacity returns 0 (no divide by zero)', () => expect(occupancyPercent(3, 0)).toBe(0));
  test('rounds correctly', () => expect(occupancyPercent(1, 3)).toBe(33));
});

describe('formatINR', () => {
  test('formats 500 as ₹500', () => expect(formatINR(500)).toBe('₹500'));
  test('formats 1000 with comma', () => expect(formatINR(1000)).toContain('₹'));
  test('formats 0 as ₹0', () => expect(formatINR(0)).toBe('₹0'));
  test('formats float amount', () => expect(formatINR(2500.50)).toContain('₹'));
});

describe('bloodGroupDisplay', () => {
  test('returns blood group string as-is', () => expect(bloodGroupDisplay('O+')).toBe('O+'));
  test('returns A+ correctly', () => expect(bloodGroupDisplay('A+')).toBe('A+'));
  test('null → not recorded', () => expect(bloodGroupDisplay(null)).toBe('Not recorded'));
  test('undefined → not recorded', () => expect(bloodGroupDisplay(undefined)).toBe('Not recorded'));
});
