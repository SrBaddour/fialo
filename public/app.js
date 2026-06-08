const $ = (s) => document.querySelector(s);
const api = (url, opts) =>
  fetch(url, { headers: { 'content-type': 'application/json' }, ...opts }).then((r) => {
    if (r.status === 401) { location.href = '/login.html'; throw new Error('Sesión expirada'); }
    return r.json();
  });
const money = (n) => '$' + Number(n || 0).toFixed(2);
const nivelBadge = (n) => `<span class="badge n${n}">Nivel ${n}</span>`;

// Tabs
document.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    $('#tab-' + t.dataset.tab).classList.add('active');
    if (t.dataset.tab === 'ventas') cargarVentas();
    if (t.dataset.tab === 'inventario') cargarProductos();
    if (t.dataset.tab === 'venta') cargarSelectoresVenta();
  })
);

// Modal
const modal = $('#modal');
$('#modal-close').onclick = () => modal.classList.add('hidden');
function showModal(html) { $('#modal-body').innerHTML = html; modal.classList.remove('hidden'); }

async function cargarResumen() {
  const { comercio, kpis } = await api('/api/resumen');
  $('#kpis').innerHTML = `
    <div class="kpi"><div class="v">${kpis.clientes}</div><div class="l">Clientes</div></div>
    <div class="kpi"><div class="v">${kpis.productos ?? 0}</div><div class="l">Productos</div></div>
    <div class="kpi"><div class="v">${money(kpis.valorInventarioUsd ?? 0)}</div><div class="l">Valor inventario</div></div>
    <div class="kpi ${kpis.stockBajo ? 'mora' : ''}"><div class="v">${kpis.stockBajo ?? 0}</div><div class="l">Stock bajo</div></div>
    <div class="kpi"><div class="v">${kpis.ventas}</div><div class="l">Ventas</div></div>
    <div class="kpi"><div class="v">${money(kpis.porCobrarUsd)}</div><div class="l">Por cobrar</div></div>
    <div class="kpi ingreso"><div class="v">${money(kpis.cobradoUsd)}</div><div class="l">Cobrado</div></div>
    <div class="kpi mora"><div class="v">${money(kpis.enMoraUsd)}</div><div class="l">En mora</div></div>
    <div class="kpi"><div class="v">${money(kpis.comisionFialoUsd)}</div><div class="l">Comisión Fíalo (3%)</div></div>`;
  document.querySelector('.tag').textContent = comercio
    ? `${comercio.nombre} · ${comercio.rubro} · plan ${comercio.plan}`
    : 'Vende a cuotas como Cashea — en tu propio comercio';
}

async function cargarClientes() {
  const cs = await api('/api/clientes');
  $('#tabla-clientes').querySelector('tbody').innerHTML = cs
    .map((c) => `<tr><td>${c.nombre}<br><small class="muted">${c.cedula || ''}</small></td>
      <td>${nivelBadge(c.nivel)}</td><td>${c.score ?? '—'}</td><td>${money(c.limiteUsd)}</td><td>${c.telefono || ''}</td></tr>`)
    .join('');
  // poblar select de venta
  $('#venta-cliente').innerHTML = cs
    .map((c) => `<option value="${c.id}">${c.nombre} — límite ${money(c.limiteUsd)} (N${c.nivel})</option>`)
    .join('');
}

$('#form-cliente').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  const { evaluacion } = await api('/api/clientes', { method: 'POST', body: JSON.stringify(body) });
  showModal(`<h3>Cliente registrado</h3>
    <p>Score: <b>${evaluacion.score}</b> · ${nivelBadge(evaluacion.nivel)} · Límite ${money(evaluacion.limiteUsd)}</p>
    <p class="muted">${evaluacion.motivo}</p>
    <p><span class="pill">fuente: ${evaluacion.fuente}</span></p>`);
  e.target.reset();
  cargarClientes(); cargarResumen();
});

$('#form-venta').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  const r = await api('/api/ventas', { method: 'POST', body: JSON.stringify(body) });
  if (r.error) { $('#plan-resultado').innerHTML = `<div class="card" style="color:var(--rojo)">⚠️ ${r.error}</div>`; return; }
  $('#plan-resultado').innerHTML = renderVenta(r, false);
  cargarResumen();
  cargarSelectoresVenta();
});

function renderVenta(v, conAcciones = true) {
  const hoy = new Date().toISOString().slice(0, 10);
  const cuotas = v.cuotas.map((q) => {
    const cls = q.pagada ? 'pagada' : (q.vence < hoy ? 'vencida' : '');
    const acc = conAcciones && !q.pagada
      ? `<div class="acc">
           <button class="ok" onclick="pagar('${v.id}',${q.n})">Pagar</button>
           <button class="ghost" onclick="cobrar('${v.id}',${q.n})">Mensaje IA</button>
         </div>` : (q.pagada ? '<div class="muted">✓ pagada</div>' : '');
    return `<div class="cuota ${cls}"><b>Cuota ${q.n}</b><br>${money(q.montoUsd)}<br><small>vence ${q.vence}</small>${acc}</div>`;
  }).join('');
  return `<div class="venta">
    <h4>${v.descripcion} — ${money(v.montoUsd)}</h4>
    <div class="muted">${v.clienteNombre} · Inicial ${money(v.inicialUsd)} (40%)</div>
    <div class="cuotas">${cuotas}</div></div>`;
}

async function cargarVentas() {
  const vs = await api('/api/ventas');
  $('#lista-ventas').innerHTML = vs.length
    ? vs.map((v) => renderVenta(v, true)).join('')
    : '<p class="muted">Aún no hay ventas. Crea una en "Nueva venta".</p>';
}

window.pagar = async (id, n) => {
  await api(`/api/ventas/${id}/pagar`, { method: 'POST', body: JSON.stringify({ n }) });
  cargarVentas(); cargarResumen();
};

window.cobrar = async (ventaId, n) => {
  showModal('<p>Generando mensaje…</p>');
  const m = await api('/api/cobranza', { method: 'POST', body: JSON.stringify({ ventaId, n }) });
  showModal(`<h3>Mensaje de cobranza</h3><pre>${m.texto}</pre>
    <p><span class="pill">fuente: ${m.fuente}</span></p>
    <button onclick="navigator.clipboard.writeText(\`${m.texto.replace(/`/g,'')}\`)">Copiar</button>`);
};

$('#form-scoring').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  const r = await api('/api/evaluar', { method: 'POST', body: JSON.stringify(body) });
  const color = r.score >= 75 ? 'var(--verde)' : r.score >= 50 ? '#854d0e' : 'var(--rojo)';
  $('#scoring-resultado').innerHTML = `<div class="score-box">
    <div class="score-num" style="color:${color}">${r.score}<small style="font-size:18px">/100</small></div>
    ${nivelBadge(r.nivel)} · Límite sugerido ${money(r.limiteUsd)}
    <p class="muted" style="margin-top:8px">${r.motivo}</p>
    <span class="pill">fuente: ${r.fuente}</span></div>`;
});

// ===================== INVENTARIO =====================
let PRODUCTOS = [];

async function cargarProductos() {
  PRODUCTOS = await api('/api/productos');
  renderTablaProductos();
}

function renderTablaProductos() {
  const q = ($('#buscar-prod')?.value || '').toLowerCase();
  const filtrados = PRODUCTOS.filter(
    (p) => !q || `${p.sku} ${p.nombre} ${p.categoria}`.toLowerCase().includes(q)
  );
  const tbody = $('#tabla-productos').querySelector('tbody');
  tbody.innerHTML = filtrados.length
    ? filtrados
        .map((p) => {
          const bajo = p.stock <= (p.stockMin || 1);
          return `<tr>
            <td>${p.sku || '—'}</td>
            <td>${p.nombre}</td>
            <td>${p.categoria || ''}</td>
            <td>${money(p.precioUsd)}</td>
            <td class="${bajo ? 'stock-bajo' : 'stock-ok'}">${p.stock}${bajo ? ' ⚠️' : ''}</td>
            <td><button class="mini del" onclick="borrarProducto('${p.id}')">Eliminar</button></td>
          </tr>`;
        })
        .join('')
    : '<tr><td colspan="6" class="muted">Sin productos. Agrega uno o importa un Excel.</td></tr>';
}

$('#buscar-prod')?.addEventListener('input', renderTablaProductos);

$('#form-producto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  const r = await api('/api/productos', { method: 'POST', body: JSON.stringify(body) });
  if (r.error) return showModal(`<p style="color:var(--rojo)">⚠️ ${r.error}</p>`);
  e.target.reset();
  cargarProductos();
  cargarResumen();
});

window.borrarProducto = async (id) => {
  if (!confirm('¿Eliminar este producto?')) return;
  await api('/api/productos/' + id, { method: 'DELETE' });
  cargarProductos();
  cargarResumen();
};

// ---- Excel: plantilla, importar, exportar ----
$('#btn-plantilla').addEventListener('click', () => {
  const datos = [
    { SKU: 'NEV-001', Descripcion: 'Nevera Mabe 14 pies', Categoria: 'Línea blanca', Precio: 420, Unidades: 8, Minimo: 2 },
    { SKU: 'TV-055', Descripcion: 'TV Smart 55" 4K', Categoria: 'Electrónica', Precio: 310, Unidades: 12, Minimo: 3 },
  ];
  const ws = XLSX.utils.json_to_sheet(datos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Productos');
  XLSX.writeFile(wb, 'plantilla_inventario_fialo.xlsx');
});

$('#btn-export').addEventListener('click', () => {
  const datos = PRODUCTOS.map((p) => ({
    SKU: p.sku, Descripcion: p.nombre, Categoria: p.categoria,
    Precio: p.precioUsd, Unidades: p.stock, Minimo: p.stockMin,
  }));
  const ws = XLSX.utils.json_to_sheet(datos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
  XLSX.writeFile(wb, 'inventario_fialo.xlsx');
});

$('#file-import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    if (!filas.length) return showModal('<p>El archivo no tiene filas.</p>');
    const modo = $('#import-modo').value;
    const r = await api('/api/productos/importar', {
      method: 'POST',
      body: JSON.stringify({ filas, modo }),
    });
    showModal(`<h3>Importación lista</h3>
      <p>✅ Creados: <b>${r.creados}</b><br>♻️ Actualizados: <b>${r.actualizados}</b><br>
      ⏭️ Omitidos (sin descripción): <b>${r.omitidos}</b><br>📦 Total en inventario: <b>${r.total}</b></p>`);
    cargarProductos();
    cargarResumen();
  } catch (err) {
    showModal(`<p style="color:var(--rojo)">Error leyendo el Excel: ${err.message}</p>`);
  } finally {
    e.target.value = '';
  }
});

// ===================== VENTA POR PRODUCTO =====================
async function cargarSelectoresVenta() {
  const [clientes, productos] = await Promise.all([api('/api/clientes'), api('/api/productos')]);
  PRODUCTOS = productos;
  $('#venta-cliente').innerHTML = clientes
    .map((c) => `<option value="${c.id}" data-limite="${c.limiteUsd}">${c.nombre} — límite ${money(c.limiteUsd)} (N${c.nivel})</option>`)
    .join('');
  $('#venta-producto').innerHTML = productos
    .filter((p) => p.stock > 0)
    .map((p) => `<option value="${p.id}" data-precio="${p.precioUsd}" data-stock="${p.stock}">${p.nombre} — ${money(p.precioUsd)} (stock ${p.stock})</option>`)
    .join('') || '<option value="">Sin productos con stock</option>';
  actualizarTotalVenta();
}

function actualizarTotalVenta() {
  const opt = $('#venta-producto').selectedOptions[0];
  if (!opt || !opt.dataset.precio) { $('#venta-total').textContent = ''; return; }
  const precio = Number(opt.dataset.precio);
  const stock = Number(opt.dataset.stock);
  let cant = Math.max(1, Number($('#venta-cantidad').value) || 1);
  if (cant > stock) { cant = stock; $('#venta-cantidad').value = stock; }
  $('#venta-cantidad').max = stock;
  $('#venta-total').textContent = `Total: ${money(precio * cant)}  (${cant} × ${money(precio)})`;
}

$('#venta-producto').addEventListener('change', actualizarTotalVenta);
$('#venta-cantidad').addEventListener('input', actualizarTotalVenta);

// ===================== SESIÓN =====================
$('#btn-logout').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.href = '/login.html';
});

async function init() {
  // Verifica sesión; si no hay, redirige a login.
  const r = await fetch('/api/auth/me');
  if (!r.ok) { location.href = '/login.html'; return; }
  const { usuario, comercio } = await r.json();
  $('#user-info').textContent = `${comercio.nombre} · ${usuario.email}`;
  cargarResumen();
  cargarClientes();
  cargarSelectoresVenta();
}

init();
