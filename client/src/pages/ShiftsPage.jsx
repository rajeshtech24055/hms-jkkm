import React from 'react';

export default function ShiftsPage() {
  return (
    <div className="page-container" style={{ padding: 40, textAlign: 'center' }}>
      <div className="card" style={{ maxWidth: 600, margin: '0 auto', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📠</div>
        <h2>Biometric Attendance System Active</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.6 }}>
          Staff attendance and shift tracking are managed automatically via the institution's central Biometric Attendance System. Manual clock-in and clock-out have been disabled.
        </p>
      </div>
    </div>
  );
}
