function openImport() {
  clearScreen();
  showScreen('import-screen');
  document.getElementById('import-preview').innerHTML = '';
  document.getElementById('import-msg').innerText     = '';
  document.getElementById('importFile').value         = '';
}
// ── Download CSV template ──
function downloadTemplate() {
  const a    = document.createElement('a');
  a.href     = 'Template-products.xlsx';
  a.download = 'Template-products.xlsx';
  a.click();
}
// ── Handle file upload and show preview ──
async function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Get next code from backend
  const products    = await getData(`${API}/products?clientId=${getClientId()}`);
  const codes       = products.map(p => Number(p.code)).filter(n => !isNaN(n));
  let   nextCode    = codes.length > 0 ? Math.max(...codes) + 1 : 100;

  const reader = new FileReader();
  reader.onload = (e) => {
    const workbook  = XLSX.read(e.target.result, { type: 'array' });
    const sheet     = workbook.Sheets['Productos'];
    const rows      = XLSX.utils.sheet_to_json(sheet);

    // Auto-assign codes
  const parsed = rows.map(row => ({
  code:  String(nextCode++),
  name:  row['Name']  || row['name']  || '',
  price: row['Price'] || row['price'] || 0,
  stock: row['Stock'] || row['stock'] || 0,
  ref:   row['Ref']   || row['ref']   || ''
  }));

    showImportPreview(parsed);
  };
  reader.readAsArrayBuffer(file);
}
// ── Show preview before confirming import ──
function showImportPreview(products) {
  let html = `
    <div style="max-width:400px; margin:auto; text-align:left;">
      <h4 style="text-align:center;">Vista previa — ${products.length} productos</h4>
      <div style="font-size:12px; color:#777; text-align:center; margin-bottom:12px;">
        Revisa que todo esté correcto antes de importar
      </div>
  `;

  products.forEach(p => {
    const valid = p.code && p.name && p.price;
    const color = valid ? '#333' : '#ff4444';
    html += `
      <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #eee;">
        <div>
          <div style="font-weight:600; font-size:13px; color:${color};">${p.name || '⚠️ Sin nombre'}</div>
          <div style="font-size:12px; color:#777;">Código: ${p.code || '⚠️ Sin código'}</div>
        </div>
        <div style="text-align:right; font-size:12px;">
          <div>$${p.price || '⚠️'}</div>
          <div style="color:#777;">Stock: ${p.stock || 0}</div>
          <div style="font-size:12px; color:#777;">
          Código: ${p.code}${p.ref ? ` · Ref: ${p.ref}` : ''}
          </div>
        </div>
      </div>
    `;
  });

  html += `
      <div style="text-align:center; margin-top:16px;">
        <button onclick="confirmImport(${JSON.stringify(products).replace(/"/g, '&quot;')})" 
                style="background:#007bff; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer;">
          ✅ Confirmar importación
        </button>
      </div>
    </div>
  `;

  document.getElementById('import-preview').innerHTML = html;
}

// ── Confirm and send to backend ──
async function confirmImport(products) {
  const msg = document.getElementById('import-msg');
  msg.style.color  = 'gray';
  msg.innerText    = 'Importando...';

  try {
    const result = await postData(`${API}/import-products`, {
      clientId: getClientId(),
      products
    });

    msg.style.color = 'green';
    msg.innerText   = `✅ ${result.saved} guardados · ${result.skipped} duplicados omitidos`;
    document.getElementById('import-preview').innerHTML = '';
    document.getElementById('importFile').value = '';

  } catch {
    msg.style.color = 'red';
    msg.innerText   = 'Error importando productos';
  }
}