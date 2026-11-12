// ── Status config: label, color and allowed next steps ──
const STATUS = {
  pendiente:    { label: 'Pendiente',    color: '#ffa500', next: ['alistamiento', 'cancelado'] },
  alistamiento: { label: 'Alistamiento', color: '#007bff', next: ['listo', 'cancelado'] },
  listo:        { label: 'Listo',        color: '#6f42c1', next: ['completado', 'cancelado'] },
  completado:   { label: 'Completado',   color: '#28a745', next: [] },
  cancelado:    { label: 'Cancelado',    color: '#ff4444', next: [] }
};

// ── Read-only label for list views ──
function renderStatusLabel(note) {
  const s = STATUS[note.status] || { label: 'Sin estado', color: '#999' };
  return `<span style="background:${s.color}; color:white; font-size:11px; padding:2px 8px; border-radius:99px;">${s.label}</span>`;
}

// ── Change status (backend validates the flow and moves stock) ──
async function updateStatus(id, status) {
  if (!status) return;
  try {
    const res  = await fetch(`${API}/delivery-notes/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, clientId: getClientId() })
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    showNoteDetail(id);
  } catch {
    alert('Error actualizando estado');
  }
}

// ── Badge with dropdown of allowed next steps ──
function renderStatusBadge(note) {
  if (!window.showOrderStatus) return '';
  if (!STATUS[note.status]) return renderStatusLabel(note);

  const { next } = STATUS[note.status];
  const options  = next.map(key => `<option value="${key}">${STATUS[key].label}</option>`).join('');
  const select   = next.length
    ? `<select onchange="updateStatus('${note._id}', this.value)" style="font-size:11px; border:1px solid #ddd; border-radius:6px; padding:2px;">
         <option value="">Cambiar...</option>${options}
       </select>`
    : '';

  return `<div style="display:flex; align-items:center; gap:6px;">${renderStatusLabel(note)}${select}</div>`;
}
