/* Client ID filter */
function getClientId() {
  return sessionStorage.getItem('clientId');
}

/* API and scanner constants */
const API           = 'https://inventory-backend-mwnq.onrender.com';
const SCAN_COOLDOWN = 1500;

let currentProductKey = null;
let scanned           = false;
let lastStock         = null;
let price             = null;
let cart              = {};

// ── Show one screen, hide all others ──
function showScreen(id) {
['login-screen', 'main-screen', 'inventory-screen', 'adding-screen', 'deliverynote-screen', 'history-screen', 'editing-screen','import-screen']    .forEach(p => document.getElementById(p).style.display = 'none');
  document.getElementById(id).style.display = 'block';
}

// ── Reset shared state and product UI ──
function clearScreen() {
  document.getElementById('result').innerText      = '';
  document.getElementById('actions').style.display = 'none';
  currentProductKey = null;
  lastStock         = null;
}

// ── Render product detail on main screen ──
function renderProduct(data, code) {
  currentProductKey = code;
  lastStock         = data.stock;

  const stockColor = data.stock < 10 ? 'red' : 'black';

  document.getElementById('result').innerHTML =
    `<strong style="font-size:18px">${data.name}</strong><br>
     <span style="color:#777">Código: ${code}</span><br><br>
     💰 Precio: $${data.price}<br>
     📦 Stock: <strong style="color:${stockColor}">${data.stock}</strong><br><br>
     <button onclick="openEdit('${code}', '${data.name}', ${data.price})">✏️ Editar</button>
     <button onclick="generateQR('${code}')">🖨️ Generar QR</button>`;

  document.getElementById('actions').style.display = 'block';
  showScreen('main-screen');
}

// ── Generate and display QR below product detail ──
function generateQR(code) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?data=${code}&size=200x200`;

  const existing = document.getElementById('qr-container');
  if (existing) existing.remove();

  document.getElementById('result').innerHTML +=
    `<div id="qr-container" style="margin-top:16px;"><img src="${url}" alt="QR ${code}"><br><small>${code}</small></div>`;
}

// ── Read feature flags from session ──
function getFeatures() {
  return JSON.parse(sessionStorage.getItem('features') || '{}');
}

// ── Apply feature flags to UI ──
function applyFlags(features) {
  const showtes = features.remisiones ? 'inline-block' : 'none';
  document.getElementById('btnDeliveryNote').style.display = shownotes;
  document.getElementById('btnHistory').style.display      = shownotes;
}

// ── Login transaction ──
async function login() {
  const username = document.getElementById('inputUser').value.trim();
  const password = document.getElementById('inputPass').value.trim();
  const msg      = document.getElementById('msgLogin');

  if (!username || !password) {
    msg.style.color = 'red';
    msg.innerText   = 'Usuario y contraseña son obligatorios';
    return;
  }

  msg.style.color = 'gray';
  msg.innerText   = 'Ingresando...';

  try {
    const data = await postData(`${API}/login`, { username, password });

    if (data.error) {
      msg.style.color = 'red';
      msg.innerText   = data.error;
      return;
    }

    sessionStorage.setItem('clientId', data.clientId);
    sessionStorage.setItem('logoUrl',  data.logoUrl);
    sessionStorage.setItem('features', JSON.stringify(data.features));

    if (data.logoUrl) {
      document.getElementById('bg').style.backgroundImage = `url('${data.logoUrl}')`;
    }

    document.getElementById('bg').style.display = 'block';
    showScreen('main-screen');
    applyFlags(data.features || {});

  } catch {
    msg.style.color = 'red';
    msg.innerText   = 'Error conectando al backend';
  }
}

// ── Generic POST helper ──
async function postData(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Server error');
    return await res.json();
  } catch (err) {
    console.log('Fetch error:', err);
    throw err;
  }
}

// ── Generic GET helper ──
async function getData(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Server error');
    return await res.json();
  } catch (err) {
    console.log('Fetch error:', err);
    throw err;
  }
}

// ── Stock update via API ──
async function updateStockAPI(code, qty) {
  return await postData(`${API}/update-stock`, { code, qty, clientId: getClientId() });
}

// ── Fetch single product and navigate to detail screen ──
async function fetchProduct(code) {
  clearScreen();
  showScreen('main-screen');
  document.getElementById('result').innerHTML =
    '<span style="color:gray">Buscando producto...</span>';

  try {
    const data = await postData(`${API}/scan`, { code, clientId: getClientId() });

    if (data.error) {
      document.getElementById('result').innerText = 'No encontrado';
      return;
    }
    renderProduct(data, code);

  } catch {
    document.getElementById('result').innerText = 'Error conectando al backend';
  }
}

// ── QR scan success callback ──
async function onScanSuccess(decodedText) {
  if (scanned) return;
  scanned = true;

  const cleanCode = decodedText
    .trim()
    .replace(/\s/g, '')
    .replace(/[^\d]/g, '');

  await fetchProduct(cleanCode);

  // TC5X-style cooldown — re-arms scanner after delay
  setTimeout(() => { scanned = false; }, SCAN_COOLDOWN);
}

// ── Add or remove stock ──
async function addStock(isAdding) {
  if (!currentProductKey) return;

  const input    = document.getElementById('qty');
  const qty      = parseInt(input.value) || 1;
  const finalQty = isAdding ? qty : -qty;

  // Block negative stock on frontend before calling backend
  if (!isAdding && qty > lastStock) {
    document.getElementById('result').innerText = '⚠️ Stock insuficiente';
    return;
  }

  document.getElementById('result').innerHTML =
    `<span style="color:gray">${isAdding ? 'Agregando' : 'Restando'} stock...</span>`;

  let data;
  try {
    data = await updateStockAPI(currentProductKey, finalQty);
  } catch (err) {
    console.error('ERROR:', err);
    document.getElementById('result').innerText = 'Error conectando al backend';
    return;
  }

  if (data.error) {
    document.getElementById('result').innerText = data.error;
    return;
  }

  input.value = '';

  const previous = lastStock ?? data.stock;
  const current  = data.stock;
  const diff     = current - previous;

  document.getElementById('result').innerText =
    `Actualizado\n\nProducto: ${data.name}\nPrecio: $${data.price}\n\nStock anterior: ${previous}\nCambio: ${diff > 0 ? '+' : ''}${diff}\nStock actual: ${current}`;

  lastStock = current;
}

// ── Manual name search ──
async function searchProduct() {
  document.getElementById('actions').style.display = 'none';
  currentProductKey = null;
  lastStock         = null;

  const name = document.getElementById('manualCode').value.trim();

  if (!name) {
    alert('Escribe un nombre');
    return;
  }

  document.getElementById('manualCode').value = '';
  showScreen('main-screen');
  document.getElementById('result').innerHTML =
    '<span style="color:gray">Buscando...</span>';

  try {
    const data = await postData(`${API}/search`, { name, clientId: getClientId() });

    if (data.error) {
      document.getElementById('result').innerText = 'No encontrado';
      return;
    }

    // If only one result, go directly to detail
    if (data.length === 1) {
      await fetchProduct(data[0].code);
      return;
    }

    // Multiple results — show list
    let html = `<div style="max-width:400px; margin:auto; text-align:left;">`;
    data.forEach(p => {
      const color = p.stock < 10 ? 'red' : '#333';
      html += `
  <div onclick="fetchProduct('${p.code}')"
       style="display:flex; justify-content:space-between; align-items:center;
              padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
    <div>
      <div style="font-weight:600;">${p.name}</div>
      <div style="font-size:12px; color:#777;">${p.code}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-weight:bold; color:${color};">${p.stock}</div>
      <div style="font-size:12px; color:#555;">$${p.price}</div>
    </div>
  </div>
  `;
    });
    html += `</div>`;
    document.getElementById('result').innerHTML = html;

  } catch {
    document.getElementById('result').innerText = 'Error conectando al backend';
  }
}

// ── Load and display full inventory list ──
async function getProducts() {
  clearScreen();
  showScreen('inventory-screen');
  document.getElementById('lista-inventario').innerHTML =
    '<span style="color:gray">Cargando inventario...</span>';

  try {
    const data = await getData(`${API}/products?clientId=${getClientId()}`);

    let html = `
      <div style="max-width:400px; margin:auto; text-align:left;">
        <h3 style="text-align:center; margin-bottom:15px;">Inventario</h3>
    `;

    data
      .sort((a, b) => a.code.localeCompare(b.code))
      .forEach(p => {
        const color = p.stock < 10 ? 'red' : '#333';
        html += `
  <div onclick="fetchProduct('${p.code}')"
       style="display:flex; justify-content:space-between; align-items:center;
              padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
    <div>
      <div style="font-weight:600;">${p.name}</div>
      <div style="font-size:12px; color:#777;">${p.code}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-weight:bold; color:${color};">${p.stock}</div>
      <div style="font-size:12px; color:#555;">$${p.price}</div>
    </div>
  </div>
`;
      });

    html += `</div>`;
    document.getElementById('lista-inventario').innerHTML = html;

  } catch {
    document.getElementById('lista-inventario').innerText = 'Error conectando al backend';
  }
}

// ── Select product from inventory list ──
async function selectProduct(code) {
  await fetchProduct(code);
}

// ── Open add product screen and auto-calculate next code ──
async function openAdd() {
  clearScreen();
  showScreen('adding-screen');

  document.getElementById('inputNombre').value       = '';
  document.getElementById('inputPrecio').value       = '';
  document.getElementById('inputStock').value        = '';
  document.getElementById('msgFormulario').innerText = '';

  try {
    const products = await getData(`${API}/products?clientId=${getClientId()}`);
    const codes    = products.map(p => Number(p.code)).filter(n => !isNaN(n));
    const nextCode = codes.length > 0 ? Math.max(...codes) + 1 : 100;
    document.getElementById('inputCodigo').value = nextCode;
  } catch {
    document.getElementById('inputCodigo').value = '';
  }
}

// ── Save new product to backend ──
async function saveProduct() {
  const code  = document.getElementById('inputCodigo').value.trim();
  const name  = document.getElementById('inputNombre').value.trim();
  const price = document.getElementById('inputPrecio').value.trim();
  const stock = document.getElementById('inputStock').value.trim() || '0';
  const msg   = document.getElementById('msgFormulario');

  // Validate required fields
  if (!name || !price) {
    msg.style.color = 'red';
    msg.innerText   = 'Nombre y precio son obligatorios';
    return;
  }

  // Block negative initial stock
  if (Number(stock) < 0) {
    msg.style.color = 'red';
    msg.innerText   = 'El stock no puede ser negativo';
    return;
  }

  msg.style.color = 'gray';
  msg.innerText   = 'Guardando...';

  try {
    const data = await postData(`${API}/add-product`, {
      code,
      name,
      price: Number(price),
      stock: Number(stock),
      clientId: getClientId()
    });

    if (data.error) {
      msg.style.color = 'red';
      msg.innerText   = data.error;
      return;
    }

    msg.style.color = 'green';
    msg.innerText   = `✅ "${name}" guardado`;

    const url = `https://api.qrserver.com/v1/create-qr-code/?data=${code}&size=200x200`;
    document.getElementById('qr-nuevo').innerHTML =
      `<br><img src="${url}" alt="QR ${code}"><br><small>${code}</small>`;

    // Clear fields and bump code for next product
    document.getElementById('inputNombre').value = '';
    document.getElementById('inputPrecio').value = '';
    document.getElementById('inputStock').value  = '';
    document.getElementById('inputCodigo').value = Number(code) + 1;

  } catch {
    msg.style.color = 'red';
    msg.innerText   = 'Error conectando al backend';
  }
}
// ── Open edit product screen ──
function openEdit(code, name, price) {
  clearScreen();
  showScreen('editing-screen');
  document.getElementById('editCodigo').value  = code;
  document.getElementById('editNombre').value  = name;
  document.getElementById('editPrecio').value  = price;
  document.getElementById('msgEditar').innerText = '';
}

// ── Save edited product ──
async function saveEdit() {
  const code  = document.getElementById('editCodigo').value.trim();
  const name  = document.getElementById('editNombre').value.trim();
  const price = document.getElementById('editPrecio').value.trim();
  const msg   = document.getElementById('msgEditar');

  if (!name || !price) {
    msg.style.color = 'red';
    msg.innerText   = 'Nombre y precio son obligatorios';
    return;
  }

  msg.style.color = 'gray';
  msg.innerText   = 'Guardando...';

  try {
    const data = await fetch(`${API}/update-product`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name, price, clientId: getClientId() })
    }).then(r => r.json());

    if (data.error) {
      msg.style.color = 'red';
      msg.innerText   = data.error;
      return;
    }

    msg.style.color = 'green';
    msg.innerText   = '✅ Producto actualizado';

  } catch {
    msg.style.color = 'red';
    msg.innerText   = 'Error conectando al backend';
  }
}
// ── Delete product ──
async function deleteProduct() {
  const code = document.getElementById('editCodigo').value.trim();
  if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return;

  try {
    await fetch(`${API}/delete-product?clientId=${getClientId()}&code=${code}`, { method: 'DELETE' });
    showScreen('main-screen');
  } catch {
    alert('Error eliminando producto');
  }
}
// ── Scanner init ──
const html5QrCode = new Html5Qrcode('reader');
let scanning = false;

function startScanner() {
  if (scanning) return;

  setTimeout(() => {
    html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 300, height: 300 } },
      onScanSuccess
    ).then(() => {
      scanning = true;
    }).catch(() => {
      html5QrCode.start(
        { facingMode: 'user' },
        { fps: 10, qrbox: 250 },
        onScanSuccess
      ).then(() => {
        scanning = true;
      });
    });
  }, 300);
}

function stopScanner() {
  if (!scanning) return;
  html5QrCode.stop().then(() => { scanning = false; });
}

document.getElementById('bg').style.display = 'none';
showScreen('login-screen');

// ── Logout ──
function logout() {
  sessionStorage.removeItem('clientId');
  sessionStorage.removeItem('logoUrl');
  sessionStorage.removeItem('features');
  
  // Reset app state
  currentProductKey = null;
  lastStock         = null;
  scanned           = false;
  cart              = {};

  // Stop scanner if running
  if (scanning) {
    html5QrCode.stop().then(() => { scanning = false; });
  }

  // Clear UI
  document.getElementById('result').innerText          = '';
  document.getElementById('actions').style.display     = 'none';
  document.getElementById('lista-inventario').innerHTML = '';
  document.getElementById('lista-remision').innerHTML   = '';
  document.getElementById('carrito').innerHTML          = '';
  document.getElementById('bg').style.display           = 'none';
  document.getElementById('bg').style.backgroundImage   = '';

  showScreen('login-screen');
}