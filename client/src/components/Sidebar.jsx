import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const ROLE_MENUS = {
  SUPER_ADMIN:    ['dashboard', 'users', 'students', 'rooms', 'departments', 'leaves', 'vacate', 'gate', 'mess', 'mess_analytics', 'inventory', 'maintenance',  'notices', 'complaints', 'audit', 'lobby'],
  HOSTEL_ADMIN:   ['dashboard', 'students', 'rooms', 'leaves', 'vacate', 'gate', 'mess_analytics', 'notices', 'complaints'],
  WARDEN:         ['dashboard', 'rooms', 'leaves', 'vacate', 'outside',  'notices', 'complaints'],
  TUTOR:          ['dashboard', 'leaves', 'outside', 'notices'],
  HOD:            ['dashboard', 'leaves', 'outside', 'notices'],
  PRINCIPAL:      ['dashboard', 'leaves', 'vacate', 'outside', 'mess_analytics', 'notices'],
  STUDENT:        ['mycard', 'myleave', 'menu', 'notices', 'complaints'],
  FOOD_ADMIN:     ['dashboard', 'mess', 'mess_analytics', 'menu',  'notices'],
  MESS_WORKER:    ['mess', 'menu'],
  INVENTORY_ADMIN:['inventory'],
  MAINTENANCE:    ['maintenance'],
  GATE_STAFF:     ['gate'],
};

const MENU_ITEMS = {
  dashboard:    { label: 'Dashboard', icon: '📊' },
  users:        { label: 'Staff & Users', icon: '👥' },
  lobby:        { label: 'TV Lobby Display', icon: '📺' },
  students:     { label: 'Students',      icon: '👨‍🎓' },
  rooms:        { label: 'Rooms',         icon: '🚪' },
  departments:  { label: 'Departments',   icon: '🏛️' },
  leaves:       { label: 'Leave Approvals', icon: '📋' },
  gate:         { label: 'Gate Scanner', icon: '🚪' },
  outside:      { label: 'Students Outside', icon: '🌍' },
  mycard:       { label: 'My Hostel Card', icon: '🪪' },
  myleave:      { label: 'My Leave', icon: '📝' },
  mess:         { label: 'Mess Inventory', icon: '🍽️' },
  mess_analytics: { label: 'Mess Analytics', icon: '📊' },
  menu:         { label: 'Weekly Menu', icon: '🥗' },
  inventory:    { label: 'Materials and tools', icon: '📦' },
  maintenance:  { label: 'Maintenance', icon: '🔧' },
  vacate:       { label: 'Vacate Requests', icon: '🏠' },
  notices:      { label: 'Notices',        icon: '📢' },
  complaints:   { label: 'Complaints',     icon: '⚠️' },
  audit:        { label: 'Audit Logs',     icon: '🔐' },
};


const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  HOSTEL_ADMIN: 'Hostel Admin',
  WARDEN: 'Warden',
  TUTOR: 'Class Tutor',
  HOD: 'Head of Dept.',
  PRINCIPAL: 'Principal',
  STUDENT: 'Student',
  FOOD_ADMIN: 'Food Admin',
  MESS_WORKER: 'Mess Worker',
  INVENTORY_ADMIN: 'Materials and tools Admin',
  MAINTENANCE: 'Maintenance',
  GATE_STAFF: 'Gate Staff',
};

export default function Sidebar({ activePage, onNavigate, isOpen }) {
  const { user, logout } = useAuth();
  const menuItems = ROLE_MENUS[user?.role] || [];
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || 'U';

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <h2>🏫 JKKM Institutions</h2>
        <span>Hostel Management System</span>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">Navigation</div>
        {menuItems.map(key => {
          const item = MENU_ITEMS[key];
          return (
            <div
              key={key}
              className={`nav-item ${activePage === key ? 'active' : ''}`}
              onClick={() => onNavigate(key)}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <h4>{user?.name}</h4>
            <span>{ROLE_LABELS[user?.role]}</span>
          </div>
        </div>
        <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={logout}>
          🚪 Sign Out
        </button>
      </div>
    </div>
  );
}
