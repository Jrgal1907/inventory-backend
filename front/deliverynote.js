// ── Open delivery note screen and load products ──
async function openDeliveryNote() {
  clearScreen();
  showScreen('deliverynote-screen');
  document.getElementById('carrito').innerHTML = '';
  document.getElementById('btn-generar').style.display = 'none';  
  document.getElementById('lista-remision').innerText = '';
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

// ── Remove product from cart ──
function removeFromCart(code) {
  delete cart[code];
  const item = document.getElementById(`item-${code}`);
  if (item) item.style.background = '';
  renderCart();
}

// ── Render cart with quantity and price inputs ──
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
        <div style="display:flex; align-items:center; gap:6px;">
          <input type="number" min="1" max="${item.stock}" value="${item.qty}"
                 id="qty-${code}"
                 onchange="cart['${code}'].qty = parseInt(this.value) || 1"
                 style="width:55px; padding:4px; border:1px solid #007bff; border-radius:6px; text-align:center;">
          <input type="number" value="${item.price}"
                 id="price-${code}"
                 onchange="cart['${code}'].price = parseFloat(this.value) || ${item.price}"
                 style="width:75px; padding:4px; border:1px solid #28a745; border-radius:6px; text-align:center;">
          <button onclick="removeFromCart('${code}')"
                  style="background:#ff4444; color:white; border:none; border-radius:50%; width:22px; height:22px; cursor:pointer; font-size:12px; line-height:1;">✕</button>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  document.getElementById('carrito').innerHTML = html;
  document.getElementById('btn-generar').style.display = 'block';
}

// ── Filter delivery note product list ──
async function filterDeliveryList() {
  const search = document.getElementById('searchRemision').value.trim();
  if (!search) {
    document.getElementById('lista-remision').innerHTML = '';
    return;
  }

  const data = await postData(`${API}/search`, { name: search, clientId: getClientId() });

  if (data.error) {
    document.getElementById('lista-remision').innerHTML = '<span style="color:gray">Sin resultados</span>';
    return;
  }

  let html = `<div style="max-width:400px; margin:auto; text-align:left;">`;
  data.forEach(p => {
    html += `
      <div onclick="addToCart('${p.code}', '${p.name}', ${p.price}, ${p.stock})"
           id="item-${p.code}"
           style="display:flex; justify-content:space-between; align-items:center;
                  padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
        <div>
          <div style="font-weight:600;">${p.name}</div>
          <div style="font-size:12px; color:#777;">${p.code}${p.ref ? ' · ' + p.ref : ''}</div>
        </div>
        <div style="font-size:12px; color:#333;">Stock: ${p.stock}</div>
      </div>
    `;
  });
  html += `</div>`;
  document.getElementById('lista-remision').innerHTML = html;
}

// ── Scanner for delivery note screen ──
const html5QrCodeDelivery = new Html5Qrcode('reader-delivery');
let scanningDelivery = false;

function startDeliveryScanner() {
  if (scanningDelivery) {
    html5QrCodeDelivery.stop().then(() => { scanningDelivery = false; });
    return;
  }
  html5QrCodeDelivery.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    async (decodedText) => {
      const cleanCode = decodedText.trim().replace(/\s/g, '').replace(/[^\d]/g, '');
      const products  = await getData(`${API}/products?clientId=${getClientId()}`);
      const product   = products.find(p => p.code === cleanCode);
      if (product) {
        addToCart(product.code, product.name, product.price, product.stock);
        html5QrCodeDelivery.stop().then(() => { scanningDelivery = false; });
      }
    }
  ).then(() => { scanningDelivery = true; });
}

// ── Shared PDF builder — used by both generate and regen ──
function buildPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Brand header
  doc.setFontSize(18);
  doc.setFont('times', 'italic');
  doc.setTextColor(0, 123, 255);
  doc.text(data.issuer, 14, 15);
  doc.setTextColor(0, 0, 0);

  // Title and number
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Remisión', 170, 20, { align: 'right' });
  doc.setFontSize(10);
  doc.text(`${data.number}`, 190, 20, { align: 'right' });

  // Info block
  const fields = [
    ['Emite:',      data.issuer],
    ['Para:',       data.recipient],
    ['Dirección:',  data.address || ''],
    ['Fecha:',      data.date]
  ];
  fields.forEach(([label, value], i) => {
    const y = 35 + i * 7;
    doc.setFont('helvetica', 'bold');   doc.text(label, 14, y);
    doc.setFont('helvetica', 'normal'); doc.text(value, 36, y);
  });

  // Divider
  doc.setDrawColor(220);
  doc.line(14, 60, 196, 60);

  // Table header
  let y = 65;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Producto', 14, y);
  doc.text('Cant.',    130, y);
  doc.text('Precio',   155, y);
  doc.text('Total',    180, y);
  y += 6;
  doc.setDrawColor(200);
  doc.line(14, y, 196, y);
  y += 6;

  // Table rows
  doc.setFont('helvetica', 'normal');
  data.items.forEach(item => {
    doc.text(item.name.substring(0, 40), 14,  y);
    doc.text(String(item.qty),           130, y);
    doc.text(`$${item.price}`,           155, y);
    doc.text(`$${item.subtotal}`,        180, y);
    y += 8;
  });

  // Total
  y += 4;
  doc.setDrawColor(180);
  doc.line(14, y, 196, y);
  y += 8;
  doc.setFont('helvetica', 'bold');   doc.text('Total:', 155, y);
  doc.setFont('helvetica', 'normal'); doc.text(`$${data.total}`, 196, y, { align: 'right' });

  return doc;
}

// ── Generate delivery note — saves to DB, no PDF download ──
async function generateDeliveryNote() {
  const recipient = document.getElementById('remisionDestinatario').value || 'Sin especificar';
  const address   = document.getElementById('remisionDireccion').value;

  // Read qty and price from inputs, validate stock
  let hasError = false;
  Object.entries(cart).forEach(([code, item]) => {
    const inputQty   = document.getElementById(`qty-${code}`);
    const inputPrice = document.getElementById(`price-${code}`);
    if (inputQty)   item.qty   = parseInt(inputQty.value)     || 1;
    if (inputPrice) item.price = parseFloat(inputPrice.value) || item.price;

    if (item.qty > item.stock) {
      alert(`Stock insuficiente para ${item.name}. Máximo: ${item.stock}`);
      item.qty = item.stock;
      if (inputQty) inputQty.value = item.stock;
      hasError = true;
    }
  });
  if (hasError) return;

  // Get consecutive number
  const numberRes      = await postData(`${API}/next-delivery-number`, { clientId: getClientId() });
  const deliveryNumber = numberRes.number;

  // Discount stock
  for (const [code, item] of Object.entries(cart)) {
    await updateStockAPI(code, -item.qty);
  }

  // Build items and total
  let total = 0;
  const noteItems = Object.entries(cart).map(([code, item]) => {
    const subtotal = item.qty * item.price;
    total += subtotal;
    return { code, name: item.name, qty: item.qty, price: item.price, subtotal };
  });

  // Save to database
  await postData(`${API}/delivery-notes`, {
    clientId: getClientId(),
    number:   deliveryNumber,
    recipient,
    address,
    items:    noteItems,
    total
  });

  // Reset
  cart = {};
  renderCart();
  document.getElementById('remisionDestinatario').value = '';
  document.getElementById('remisionDireccion').value    = '';

  alert(`✅ Remisión ${deliveryNumber} guardada. Puedes descargarla desde el historial.`);
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
        <h4>${note.number} · ${note.recipient}</h4>
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
        <div style="text-align:center; margin-top:16px;">
          <button onclick="regenPDF('${note._id}')">📥 Descargar PDF</button>
        </div>
      </div>
    `;

    document.getElementById('delivery-history').innerHTML = html;

  } catch {
    document.getElementById('delivery-history').innerText = 'Error cargando detalle';
  }
}

// ── Regenerate PDF from history ──
async function regenPDF(id) {
  const notes = await getData(`${API}/delivery-notes?clientId=${getClientId()}`);
  const note  = notes.find(n => n._id === id);
  if (!note) return;

  const doc  = buildPDF({
    issuer:    note.clientId,
    number:    note.number,
    recipient: note.recipient,
    address:   note.address || '',
    date:      new Date(note.date).toLocaleDateString('es-CO'),
    items:     note.items,
    total:     note.total
  });

  doc.save(`rem-${note.number}.pdf`);
}

// ── Clear delivery note history ──
async function clearHistory() {
  if (!confirm('¿Borrar todo el historial?')) return;
  await fetch(`${API}/delivery-notes?clientId=${getClientId()}`, { method: 'DELETE' });
  openHistory();
}