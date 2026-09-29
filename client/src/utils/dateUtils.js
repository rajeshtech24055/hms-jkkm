export const fmtDate = (d) => {
    if (!d) return '—';
    const obj = new Date(d);
    if (isNaN(obj)) return '—';
    const day = String(obj.getDate()).padStart(2, '0');
    const month = String(obj.getMonth() + 1).padStart(2, '0');
    const year = obj.getFullYear();
    return `${day}-${month}-${year}`;
};

export const fmtDateTime = (d) => {
    if (!d) return '—';
    const obj = new Date(d);
    if (isNaN(obj)) return '—';
    const day = String(obj.getDate()).padStart(2, '0');
    const month = String(obj.getMonth() + 1).padStart(2, '0');
    const year = obj.getFullYear();
    let h = obj.getHours();
    const m = String(obj.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${day}-${month}-${year} ${h}:${m} ${ampm}`;
};
