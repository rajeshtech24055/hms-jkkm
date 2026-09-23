/**
 * JKKM HMS — Export Utilities
 * Provides PDF (jsPDF + autotable) and Excel (xlsx) export helpers.
 * Usage: import { exportPDF, exportExcel } from '../utils/exportUtils';
 */

// ── PDF Export ────────────────────────────────────────────────────────────────
export async function exportPDF({ title, subtitle = '', columns, rows, filename = 'report.pdf' }) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const now = new Date().toLocaleString('en-IN');

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('JKKM Institutions — Hostel Management System', pageW / 2, 14, { align: 'center' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageW / 2, 22, { align: 'center' });

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(subtitle, pageW / 2, 28, { align: 'center' });
  }

  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text(`Generated: ${now}`, pageW - 10, 10, { align: 'right' });
  doc.text(`Total Records: ${rows.length}`, 10, 10);

  doc.setTextColor(0);

  // Table
  autoTable(doc, {
    startY: subtitle ? 33 : 28,
    head: [columns.map(c => c.header)],
    body: rows.map(row => columns.map(c => {
      const val = row[c.key];
      return val == null ? '' : String(val);
    })),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [63, 63, 240], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    margin: { left: 10, right: 10 },
  });

  doc.save(filename);
}

// ── Excel Export ──────────────────────────────────────────────────────────────
export async function exportExcel({ title, columns, rows, filename = 'report.xlsx', sheetName = 'Report' }) {
  const XLSX = await import('xlsx');

  // Header rows
  const header = columns.map(c => c.header);
  const data = rows.map(row => columns.map(c => {
    const val = row[c.key];
    return val == null ? '' : val;
  }));

  const ws = XLSX.utils.aoa_to_sheet([
    [`JKKM Institutions — ${title}`],
    [`Generated: ${new Date().toLocaleString('en-IN')}  |  Total Records: ${rows.length}`],
    [],
    header,
    ...data,
  ]);

  // Column widths
  ws['!cols'] = columns.map(() => ({ wch: 20 }));

  // Style title rows (basic — xlsx doesn't support rich styling without xlsx-style)
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// ── Convenient Pre-built Report Functions ────────────────────────────────────

/** Export student list as PDF */
export function exportStudentsPDF(students) {
  return exportPDF({
    title: 'Student List Report',
    subtitle: `Active hostel residents`,
    filename: 'jkkm_students.pdf',
    columns: [
      { header: 'Reg No',      key: 'reg_no' },
      { header: 'Name',        key: 'name' },
      { header: 'Gender',      key: 'gender' },
      { header: 'Institution', key: 'institution_name' },
      { header: 'Department',  key: 'dept_name' },
      { header: 'Year',        key: 'year' },
      { header: 'Room',        key: 'room_no' },
      { header: 'Mobile',      key: 'mobile' },
      { header: 'Blood Group', key: 'blood_group' },
      { header: 'Guardian',    key: 'guardian_name' },
      { header: 'Guardian Ph', key: 'guardian_phone' },
    ],
    rows: students,
  });
}

/** Export student list as Excel */
export function exportStudentsExcel(students) {
  return exportExcel({
    title: 'Student List Report',
    filename: 'jkkm_students.xlsx',
    sheetName: 'Students',
    columns: [
      { header: 'Reg No',       key: 'reg_no' },
      { header: 'Name',         key: 'name' },
      { header: 'Gender',       key: 'gender' },
      { header: 'Institution',  key: 'institution_name' },
      { header: 'Department',   key: 'dept_name' },
      { header: 'Year',         key: 'year' },
      { header: 'Room No',      key: 'room_no' },
      { header: 'Block',        key: 'block' },
      { header: 'Mobile',       key: 'mobile' },
      { header: 'Email',        key: 'email' },
      { header: 'Blood Group',  key: 'blood_group' },
      { header: 'Guardian',     key: 'guardian_name' },
      { header: 'Guardian Ph',  key: 'guardian_phone' },
      { header: 'Guardian Email', key: 'guardian_email' },
    ],
    rows: students,
  });
}

/** Export inventory as PDF */
export function exportInventoryPDF(items) {
  return exportPDF({
    title: 'Inventory Stock Report',
    filename: 'jkkm_inventory.pdf',
    columns: [
      { header: 'Item Name',  key: 'name' },
      { header: 'Category',   key: 'category' },
      { header: 'Asset Code', key: 'asset_code' },
      { header: 'Qty',        key: 'quantity' },
      { header: 'Condition',  key: 'condition' },
      { header: 'Location',   key: 'location' },
      { header: 'Vendor',     key: 'vendor' },
      { header: 'Purchase Date', key: 'purchase_date' },
      { header: 'Warranty',   key: 'warranty_date' },
    ],
    rows: items,
  });
}

/** Export inventory as Excel */
export function exportInventoryExcel(items) {
  return exportExcel({
    title: 'Inventory Stock Report',
    filename: 'jkkm_inventory.xlsx',
    sheetName: 'Inventory',
    columns: [
      { header: 'Item Name',    key: 'name' },
      { header: 'Category',     key: 'category' },
      { header: 'Asset Code',   key: 'asset_code' },
      { header: 'Quantity',     key: 'quantity' },
      { header: 'Unit',         key: 'unit' },
      { header: 'Condition',    key: 'condition' },
      { header: 'Location',     key: 'location' },
      { header: 'Vendor',       key: 'vendor' },
      { header: 'Unit Price',   key: 'unit_price' },
      { header: 'Total Value',  key: 'total_value' },
      { header: 'Purchase Date', key: 'purchase_date' },
      { header: 'Warranty',     key: 'warranty_date' },
    ],
    rows: items,
  });
}

/** Export grocery items as Excel */
export function exportGroceryExcel(items) {
  return exportExcel({
    title: 'Grocery Stock Report',
    filename: 'jkkm_grocery.xlsx',
    sheetName: 'Grocery',
    columns: [
      { header: 'Item Name',  key: 'name' },
      { header: 'Category',   key: 'category' },
      { header: 'Stock',      key: 'current_stock' },
      { header: 'Unit',       key: 'unit' },
      { header: 'Batch No',   key: 'batch_no' },
      { header: 'Mfg Date',   key: 'mfg_date' },
      { header: 'Exp Date',   key: 'exp_date' },
      { header: 'Supplier',   key: 'supplier' },
      { header: 'Unit Price', key: 'unit_price' },
      { header: 'Reorder At', key: 'reorder_level' },
    ],
    rows: items,
  });
}

/** Export leave applications as PDF */
export function exportLeavesPDF(leaves) {
  return exportPDF({
    title: 'Leave Applications Report',
    filename: 'jkkm_leaves.pdf',
    columns: [
      { header: 'Student',      key: 'student_name' },
      { header: 'Reg No',       key: 'reg_no' },
      { header: 'From',         key: 'from_date' },
      { header: 'To',           key: 'to_date' },
      { header: 'Days',         key: 'days' },
      { header: 'Reason',       key: 'reason' },
      { header: 'Status',       key: 'status' },
      { header: 'Approved By',  key: 'approved_by' },
    ],
    rows: leaves,
  });
}
