// ── Open delivery note screen and load products ──
async function openDeliveryNote() {
  clearScreen();
  showScreen('deliverynote-screen');
  document.getElementById('carrito').innerHTML = '';
  document.getElementById('btn-generar').style.display = 'none';

  try {
    const products = await getData(`${API}/products?clientId=${getClientId()}`);

    let html = `<div style="max-width:400px; margin:auto; text-align:left;">`;
    products
      .sort((a, b) => a.code.localeCompare(b.code))
      .forEach(p => {
        html += `
          <div onclick="addToCart('${p.code}', '${p.name}', ${p.price}, ${p.stock})"
               id="item-${p.code}"
               style="display:flex; justify-content:space-between; align-items:center;
                      padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
            <div>
              <div style="font-weight:600;">${p.name}</div>
              <div style="font-size:12px; color:#777;">${p.code}</div>
            </div>
            <div style="font-size:12px; color:#333;">Stock: ${p.stock}</div>
          </div>
        `;
      });
    html += `</div>`;
    document.getElementById('lista-remision').innerHTML = html;

  } catch {
    document.getElementById('lista-remision').innerText = 'Error cargando productos';
  }
}

// ── Add product to delivery note cart ──
function addToCart(code, name, price, stock) {
  if (cart[code]) {
    delete cart[code];
    document.getElementById(`item-${code}`).style.background = '';
  } else {
    cart[code] = { name, price, stock, qty: 1 };
    document.getElementById(`item-${code}`).style.background = '#e6f0ff';
  }
  renderCart();
}

// ── Render cart with quantity inputs ──
function renderCart() {
  const items = Object.entries(cart);

  if (items.length === 0) {
    document.getElementById('carrito').innerHTML = '';
    document.getElementById('btn-generar').style.display = 'none';
    return;
  }

  let html = `<div style="max-width:400px; margin:auto; text-align:left; border-top:2px solid #007bff; padding-top:12px;">
    <h4 style="text-align:center;">Productos seleccionados</h4>`;

  items.forEach(([code, item]) => {
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #eee;">
        <div style="font-size:13px; font-weight:600;">${item.name}</div>
        <input type="number" min="1" max="${item.stock}" value="${item.qty}"
               id="qty-${code}"
               onchange="cart['${code}'].qty = parseInt(this.value) || 1"
               style="width:60px; padding:4px; border:1px solid #007bff; border-radius:6px; text-align:center;">
      </div>
    `;
  });

  html += `</div>`;
  document.getElementById('carrito').innerHTML = html;
  document.getElementById('btn-generar').style.display = 'block';
}

// ── Generate delivery note PDF ──
async function generateDeliveryNote() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const date        = new Date().toLocaleDateString('es-CO');
  const recipient   = document.getElementById('remisionDestinatario').value || 'Sin especificar';
  const address     = document.getElementById('remisionDireccion').value;
  const issuer      = getClientId();
  // Stock validation — stop if any item exceeds available stock
  let hasError = false;
  Object.entries(cart).forEach(([code, item]) => {
    const inputQty = document.getElementById(`qty-${code}`);
    if (inputQty) item.qty = parseInt(inputQty.value) || 1;

    if (item.qty > item.stock) {
      alert(`Stock insuficiente para ${item.name}. Máximo: ${item.stock}`);
      item.qty = item.stock;
      if (inputQty) inputQty.value = item.stock;
      hasError = true;
    }
  });

  if (hasError) return;

  const numberRes = await postData(`${API}/next-delivery-number`, { clientId: getClientId() });
  const deliveryNumber = numberRes.number;

  // PDF header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Remisión', 170, 20, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`${deliveryNumber}`, 190, 20,{ align: 'right' })
  doc.setFontSize(10);
  // info style 
  doc.setFont('helvetica', 'bold');
  doc.text('Emite:', 14, 35);
  doc.setFont('helvetica', 'normal');
  doc.text(`${issuer}`, 36, 35);

  doc.setFont('helvetica', 'bold');
  doc.text('Para:', 14, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(`${recipient}`, 36, 42);

  doc.setFont('helvetica', 'bold');
  doc.text('Dirección:', 14, 49);
  doc.setFont('helvetica', 'normal');
  doc.text(`${address}`, 36, 49);

  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', 14, 56);
  doc.setFont('helvetica', 'normal');
  doc.text(`${date}`, 36, 56);

// brand style
  doc.setFontSize(18);
  doc.setFont('times', 'italic','bold');
  doc.setTextColor(0, 123, 255);
  doc.text(getClientId(), 14, 15);

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

// deco soft lining
  doc.setDrawColor(220);
  doc.line(14, 60, 196, 60);

  // Table header
  let y = 65;
  doc.setFontSize(11);
  doc.setFont('helvetica','bold');
  doc.text('Producto', 14,  y);
  doc.text('Cant.',    130, y);
  doc.text('Precio',   155, y);
  doc.text('Total',    180, y);
  y += 6;
  doc.setDrawColor(200);
  doc.line(14, y, 196, y);
  y += 6;

  // Table rows
  let total = 0;
  doc.setFont('helvetica', 'normal');
  Object.entries(cart).forEach(([code, item]) => {
    const subtotal = item.qty * item.price;
    total += subtotal;
    doc.text(item.name.substring(0, 40), 14,  y);
    doc.text(String(item.qty),           130, y);
    doc.text(`$${item.price}`,           155, y);
    doc.text(`$${subtotal}`,             180, y);
    y += 8;
  });

  // Total row
  y += 4;
  doc.setDrawColor(180);
  doc.line(14, y, 196, y);
  y += 8;
  doc.setFontSize(12);
  // Total
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', 155, y);

  // Value
  doc.setFont('helvetica', 'normal');
  doc.text(`$${total}`, 180, y, { align: 'right' });

  // Discount stock for each item
  for (const [code, item] of Object.entries(cart)) {
    await updateStockAPI(code, -item.qty);
  }
// Save delivery note to database
const noteItems = Object.entries(cart).map(([code, item]) => ({
  code,
  name:     item.name,
  qty:      item.qty,
  price:    item.price,
  subtotal: item.qty * item.price
}));

await postData(`${API}/delivery-notes`, {
  clientId:  getClientId(),
  number: deliveryNumber,
  recipient,
  address,
  items:     noteItems,
  total
});
  doc.save(`rem-${deliveryNumber}-${date}.pdf`);

  // Reset cart and fields
  cart = {};
  renderCart();
  document.getElementById('remisionDestinatario').value = '';
  document.getElementById('remisionDireccion').value    = '';
}
// ── Open delivery note history screen ──
async function openHistory() {
  clearScreen();
  showScreen('history-screen');
  document.getElementById('delivery-history').innerHTML =
    '<span style="color:gray">Cargando historial...</span>';

  try {
    const notes = await getData(`${API}/delivery-notes?clientId=${getClientId()}`);

    if (notes.length === 0) {
      document.getElementById('delivery-history').innerText = 'No hay remisiones aún';
      return;
    }

    let html = `<div style="max-width:400px; margin:auto; text-align:left;">`;
    notes.forEach(note => {
      const date = new Date(note.date).toLocaleDateString('es-CO');
      html += `
        <div style="padding:12px; border-bottom:1px solid #eee; cursor:pointer;"
             onclick="showNoteDetail('${note._id}')">
          <div style="font-weight:600;">${note.recipient}</div>
          <div style="font-size:12px; color:#777;">${note.number} · ${date} · $${note.total}</div>
        </div>
      `;
    });
    html += `</div>`;
    document.getElementById('delivery-history').innerHTML = html;

  } catch {
    document.getElementById('delivery-history').innerText = 'Error cargando historial';
  }
}
// ── Show delivery note detail ──
async function showNoteDetail(id) {
try {
    const notes = await getData(`${API}/delivery-notes?clientId=${getClientId()}`);
    const note  = notes.find(n => n._id === id);

    if (!note) return;

    const date = new Date(note.date).toLocaleDateString('es-CO');

    let html = `
      <div style="max-width:400px; margin:auto; text-align:left; padding:16px;">
        <button onclick="openHistory()" style="margin-bottom:16px;">← Volver</button>
        <h4>${note.recipient}</h4>
        <div style="font-size:13px; color:#777; margin-bottom:12px;">${date}${note.address ? ' · ' + note.address : ''}</div>
    `;

    note.items.forEach(item => {
      html += `
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee;">
          <div>
            <div style="font-weight:600; font-size:13px;">${item.name}</div>
            <div style="font-size:12px; color:#777;">x${item.qty} · $${item.price}</div>
          </div>
          <div style="font-weight:600;">$${item.subtotal}</div>
        </div>
      `;
    });

    html += `
        <div style="text-align:right; margin-top:12px; font-weight:600; font-size:15px;">
          Total: $${note.total}
        </div>
      </div>
    `;

    document.getElementById('delivery-history').innerHTML = html;
  } catch {
    document.getElementById('delivery-history').innerText = 'Error cargando detalle';
  }
}
//Clear history
async function clearHistory() {
  if (!confirm('¿Borrar todo el historial?')) return;
  await fetch(`${API}/delivery-notes?clientId=${getClientId()}`, { method: 'DELETE' });
  openHistory();
}