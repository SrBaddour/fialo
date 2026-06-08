// server.js — API + servidor estático de Fíalo.
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { db, uid, seedIfEmpty, initDb } from './db.js';
import { evaluarCredito, mensajeCobranza } from './ai.js';

// Inicializa el backend de datos (Postgres en producción, archivo en local).
await initDb();
// Si la base arranca vacía (p. ej. primer deploy en Render), siembra datos de demo.
if (seedIfEmpty()) console.log('Base vacía → datos de demo sembrados.');

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Para el MVP trabajamos con un comercio "activo" (el primero). En producción
// esto vendría de la sesión autenticada del comercio.
function comercioActivo() {
  return db.get('comercios')[0] || null;
}

// ---------- Lógica BNPL (modelo tipo Cashea) ----------
// Inicial 40% + 3 cuotas quincenales del 20% c/u. Configurable por comercio.
function generarPlanPago(montoUsd, { inicialPct = 0.4, nCuotas = 3, diasEntre = 15 } = {}) {
  const inicial = +(montoUsd * inicialPct).toFixed(2);
  const restante = +(montoUsd - inicial).toFixed(2);
  const montoCuota = +(restante / nCuotas).toFixed(2);
  const cuotas = [];
  const hoy = new Date();
  for (let i = 1; i <= nCuotas; i++) {
    const f = new Date(hoy);
    f.setDate(f.getDate() + diasEntre * i);
    cuotas.push({
      n: i,
      montoUsd: montoCuota,
      vence: f.toISOString().slice(0, 10),
      pagada: false,
    });
  }
  return { inicialUsd: inicial, cuotas, montoUsd };
}

// ---------- Endpoints ----------
app.get('/api/resumen', (req, res) => {
  const com = comercioActivo();
  const clientes = db.filter('clientes', (c) => c.comercioId === com?.id);
  const ventas = db.filter('ventas', (v) => v.comercioId === com?.id);
  const productos = db.filter('productos', (p) => p.comercioId === com?.id);
  const valorInventario = productos.reduce((a, p) => a + p.precioUsd * p.stock, 0);
  const stockBajo = productos.filter((p) => p.stock <= (p.stockMin || 1)).length;
  let porCobrar = 0;
  let cobrado = 0;
  let enMora = 0;
  const hoy = new Date().toISOString().slice(0, 10);
  for (const v of ventas) {
    cobrado += v.inicialUsd;
    for (const q of v.cuotas) {
      if (q.pagada) cobrado += q.montoUsd;
      else {
        porCobrar += q.montoUsd;
        if (q.vence < hoy) enMora += q.montoUsd;
      }
    }
  }
  res.json({
    comercio: com,
    kpis: {
      clientes: clientes.length,
      ventas: ventas.length,
      productos: productos.length,
      valorInventarioUsd: +valorInventario.toFixed(2),
      stockBajo,
      porCobrarUsd: +porCobrar.toFixed(2),
      cobradoUsd: +cobrado.toFixed(2),
      enMoraUsd: +enMora.toFixed(2),
      // Comisión Fíalo (ingreso del SaaS): 3% del volumen financiado.
      comisionFialoUsd: +(ventas.reduce((a, v) => a + v.montoUsd, 0) * 0.03).toFixed(2),
    },
  });
});

// ---------- Inventario / Productos ----------
app.get('/api/productos', (req, res) => {
  const com = comercioActivo();
  res.json(db.filter('productos', (p) => p.comercioId === com?.id));
});

function normalizarProducto(row, comercioId) {
  return {
    id: uid('prod_'),
    comercioId,
    sku: String(row.sku ?? row.SKU ?? '').trim(),
    nombre: String(row.nombre ?? row.descripcion ?? row.Descripcion ?? row.Descripción ?? row.Nombre ?? '').trim(),
    categoria: String(row.categoria ?? row.Categoria ?? row.Categoría ?? 'General').trim(),
    precioUsd: Number(row.precioUsd ?? row.precio ?? row.Precio ?? 0) || 0,
    stock: Number(row.stock ?? row.unidades ?? row.Unidades ?? row.Stock ?? 0) || 0,
    stockMin: Number(row.stockMin ?? row.minimo ?? row.Minimo ?? 1) || 1,
    activo: true,
    creado: new Date().toISOString(),
  };
}

app.post('/api/productos', (req, res) => {
  const com = comercioActivo();
  const p = normalizarProducto(req.body || {}, com.id);
  if (!p.nombre) return res.status(400).json({ error: 'El producto requiere descripción/nombre.' });
  res.json(db.insert('productos', p));
});

app.put('/api/productos/:id', (req, res) => {
  const b = req.body || {};
  const patch = {};
  for (const k of ['sku', 'nombre', 'categoria']) if (b[k] !== undefined) patch[k] = String(b[k]);
  for (const k of ['precioUsd', 'stock', 'stockMin']) if (b[k] !== undefined) patch[k] = Number(b[k]) || 0;
  if (b.activo !== undefined) patch.activo = !!b.activo;
  const row = db.update('productos', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(row);
});

app.delete('/api/productos/:id', (req, res) => {
  const eliminados = db.remove('productos', (p) => p.id === req.params.id);
  res.json({ ok: true, eliminados });
});

// Importación masiva desde Excel (el front envía filas ya parseadas como JSON)
app.post('/api/productos/importar', (req, res) => {
  const com = comercioActivo();
  const filas = Array.isArray(req.body?.filas) ? req.body.filas : [];
  const modo = req.body?.modo === 'reemplazar' ? 'reemplazar' : 'agregar';
  if (modo === 'reemplazar') {
    db.remove('productos', (p) => p.comercioId === com.id);
  }
  let creados = 0, omitidos = 0, actualizados = 0;
  for (const row of filas) {
    const p = normalizarProducto(row, com.id);
    if (!p.nombre) { omitidos++; continue; }
    // Si existe SKU, actualiza; si no, crea.
    const existente = p.sku
      ? db.find('productos', (x) => x.comercioId === com.id && x.sku && x.sku === p.sku)
      : null;
    if (existente) {
      db.update('productos', existente.id, {
        nombre: p.nombre, categoria: p.categoria, precioUsd: p.precioUsd, stock: p.stock, stockMin: p.stockMin,
      });
      actualizados++;
    } else {
      db.insert('productos', p);
      creados++;
    }
  }
  res.json({ ok: true, creados, actualizados, omitidos, total: db.filter('productos', (p) => p.comercioId === com.id).length });
});

app.get('/api/clientes', (req, res) => {
  const com = comercioActivo();
  res.json(db.filter('clientes', (c) => c.comercioId === com?.id));
});

app.post('/api/clientes', async (req, res) => {
  const com = comercioActivo();
  const body = req.body || {};
  const evalCredito = await evaluarCredito(body);
  const cliente = db.insert('clientes', {
    id: uid('cli_'),
    comercioId: com.id,
    nombre: body.nombre,
    cedula: body.cedula,
    telefono: body.telefono,
    ingresoMensualUsd: Number(body.ingresoMensualUsd) || 0,
    historialPagos: body.historialPagos || 'regular',
    moraDias: Number(body.moraDias) || 0,
    nivel: evalCredito.nivel,
    limiteUsd: evalCredito.limiteUsd,
    score: evalCredito.score,
    creado: new Date().toISOString(),
  });
  res.json({ cliente, evaluacion: evalCredito });
});

// Evaluar sin guardar (simulador de scoring)
app.post('/api/evaluar', async (req, res) => {
  res.json(await evaluarCredito(req.body || {}));
});

app.get('/api/ventas', (req, res) => {
  const com = comercioActivo();
  res.json(db.filter('ventas', (v) => v.comercioId === com?.id));
});

app.post('/api/ventas', (req, res) => {
  const com = comercioActivo();
  const { clienteId, productoId, cantidad, descripcion, montoUsd } = req.body || {};
  const cliente = db.find('clientes', (c) => c.id === clienteId);
  if (!cliente) return res.status(400).json({ error: 'Cliente no existe' });

  // Construir la lista de ítems. Soporta venta por producto (con stock) o venta libre.
  let monto = 0;
  let desc = descripcion || 'Compra';
  let producto = null;
  let qty = Math.max(1, Number(cantidad) || 1);

  if (productoId) {
    producto = db.find('productos', (p) => p.id === productoId && p.comercioId === com.id);
    if (!producto) return res.status(400).json({ error: 'Producto no existe' });
    if (producto.stock < qty)
      return res.status(400).json({ error: `Stock insuficiente: quedan ${producto.stock} de "${producto.nombre}".` });
    monto = +(producto.precioUsd * qty).toFixed(2);
    desc = `${producto.nombre}${qty > 1 ? ` x${qty}` : ''}`;
  } else {
    monto = Number(montoUsd) || 0;
  }

  if (monto <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a 0.' });
  if (monto > cliente.limiteUsd)
    return res
      .status(400)
      .json({ error: `Supera el límite del cliente ($${cliente.limiteUsd}). Nivel ${cliente.nivel}.` });

  // Descontar stock si aplica.
  if (producto) db.update('productos', producto.id, { stock: producto.stock - qty });

  const plan = generarPlanPago(monto);
  const venta = db.insert('ventas', {
    id: uid('ven_'),
    comercioId: com.id,
    comercioNombre: com.nombre,
    clienteId,
    clienteNombre: cliente.nombre,
    productoId: producto?.id || null,
    cantidad: producto ? qty : null,
    descripcion: desc,
    ...plan,
    creado: new Date().toISOString(),
  });
  res.json(venta);
});

app.post('/api/ventas/:id/pagar', (req, res) => {
  const venta = db.find('ventas', (v) => v.id === req.params.id);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  const n = Number(req.body?.n);
  const cuota = venta.cuotas.find((q) => q.n === n);
  if (!cuota) return res.status(400).json({ error: 'Cuota no encontrada' });
  cuota.pagada = true;
  cuota.pagadaEl = new Date().toISOString().slice(0, 10);
  db.update('ventas', venta.id, { cuotas: venta.cuotas });
  res.json(venta);
});

// Generar mensaje de cobranza con IA
app.post('/api/cobranza', async (req, res) => {
  const venta = db.find('ventas', (v) => v.id === req.body?.ventaId);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  const cuota = venta.cuotas.find((q) => q.n === Number(req.body?.n));
  const cliente = db.find('clientes', (c) => c.id === venta.clienteId);
  const msg = await mensajeCobranza({
    cliente,
    venta,
    cuota,
    tono: req.body?.tono || 'amable',
  });
  res.json(msg);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Fíalo corriendo en  http://localhost:${PORT}`);
  console.log(`  IA: ${process.env.ANTHROPIC_API_KEY ? 'Claude activo' : 'modo reglas (sin API key)'}\n`);
});
