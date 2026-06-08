// db.js — Almacén de datos con backend dual:
//   • Si existe DATABASE_URL  → PostgreSQL (un documento JSONB). Para Render/producción.
//   • Si no                   → archivo JSON local. Para desarrollo sin configuración.
// La API pública (insert/update/find/filter/remove/set) es síncrona en ambos casos:
// los datos viven en memoria (cache) y persist() guarda en el backend correspondiente.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const DB_PATH = join(DATA_DIR, 'db.json');

const EMPTY = { comercios: [], clientes: [], ventas: [], pagos: [], productos: [] };
const USE_PG = !!process.env.DATABASE_URL;

let cache = structuredClone(EMPTY);
let pgPool = null;

// ---------- Backend: archivo JSON ----------
function loadFile() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_PATH)) return structuredClone(EMPTY);
  try {
    return { ...structuredClone(EMPTY), ...JSON.parse(readFileSync(DB_PATH, 'utf8')) };
  } catch {
    return structuredClone(EMPTY);
  }
}
function saveFile() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
}

// ---------- Backend: PostgreSQL (un solo documento JSONB) ----------
async function initPg() {
  const { default: pg } = await import('pg');
  const needSsl = !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
  pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: needSsl ? { rejectUnauthorized: false } : false,
  });
  await pgPool.query('CREATE TABLE IF NOT EXISTS fialo_store (id text PRIMARY KEY, doc jsonb NOT NULL)');
  const { rows } = await pgPool.query("SELECT doc FROM fialo_store WHERE id = 'main'");
  cache = rows.length ? { ...structuredClone(EMPTY), ...rows[0].doc } : structuredClone(EMPTY);
}

// Guardado en PG con debounce: nunca solapa dos escrituras y siempre persiste el último estado.
let saving = false;
let dirty = false;
async function savePg() {
  if (saving) { dirty = true; return; }
  saving = true;
  try {
    do {
      dirty = false;
      await pgPool.query(
        "INSERT INTO fialo_store (id, doc) VALUES ('main', $1::jsonb) " +
          'ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc',
        [JSON.stringify(cache)]
      );
    } while (dirty);
  } catch (e) {
    console.error('Error guardando en Postgres:', e.message);
  } finally {
    saving = false;
  }
}

function persist() {
  if (USE_PG) savePg(); // asíncrono (debounced); la API pública no espera
  else saveFile();
}

// Inicializa el backend. El servidor debe await initDb() antes de listen().
export async function initDb() {
  if (USE_PG) {
    await initPg();
    console.log('DB: PostgreSQL');
  } else {
    cache = loadFile();
    console.log('DB: archivo JSON local');
  }
}

export const db = {
  data: () => cache,
  get: (col) => cache[col],
  insert(col, row) {
    cache[col].push(row);
    persist();
    return row;
  },
  update(col, id, patch) {
    const row = cache[col].find((r) => r.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    persist();
    return row;
  },
  find: (col, pred) => cache[col].find(pred),
  filter: (col, pred) => cache[col].filter(pred),
  remove(col, pred) {
    const before = cache[col].length;
    cache[col] = cache[col].filter((r) => !pred(r));
    persist();
    return before - cache[col].length;
  },
  set(col, arr) {
    cache[col] = arr;
    persist();
  },
  reset() {
    cache = structuredClone(EMPTY);
    persist();
  },
};

export const uid = (p = '') =>
  p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

// ---- Datos de demostración (ejecuta: npm run seed) ----
export function seed() {
  db.reset();
  const comercio = db.insert('comercios', {
    id: uid('com_'),
    nombre: 'Electro Zulia C.A.',
    rubro: 'Electrodomésticos',
    plan: 'pro', // free | pro | business
    creado: new Date('2026-01-15').toISOString(),
  });

  const clientesSeed = [
    { nombre: 'María Pérez', cedula: 'V-12.345.678', telefono: '+58 414 1234567', ingresoMensualUsd: 320, historialPagos: 'bueno', moraDias: 0 },
    { nombre: 'José Rodríguez', cedula: 'V-18.222.333', telefono: '+58 424 9876543', ingresoMensualUsd: 180, historialPagos: 'regular', moraDias: 5 },
    { nombre: 'Ana Gómez', cedula: 'V-9.111.222', telefono: '+58 412 5556677', ingresoMensualUsd: 540, historialPagos: 'excelente', moraDias: 0 },
  ];

  for (const c of clientesSeed) {
    const nivel = c.historialPagos === 'excelente' ? 3 : c.historialPagos === 'bueno' ? 2 : 1;
    db.insert('clientes', {
      id: uid('cli_'),
      comercioId: comercio.id,
      ...c,
      nivel,
      limiteUsd: nivel === 3 ? 500 : nivel === 2 ? 250 : 100,
      creado: new Date('2026-02-01').toISOString(),
    });
  }

  const productosSeed = [
    { sku: 'NEV-001', nombre: 'Nevera Mabe 14 pies', categoria: 'Línea blanca', precioUsd: 420, stock: 8, stockMin: 2 },
    { sku: 'LAV-014', nombre: 'Lavadora Samsung 13kg', categoria: 'Línea blanca', precioUsd: 380, stock: 5, stockMin: 2 },
    { sku: 'TV-055', nombre: 'TV Smart 55" 4K', categoria: 'Electrónica', precioUsd: 310, stock: 12, stockMin: 3 },
    { sku: 'CEL-128', nombre: 'Celular Xiaomi Redmi 128GB', categoria: 'Telefonía', precioUsd: 180, stock: 20, stockMin: 5 },
    { sku: 'COC-004', nombre: 'Cocina a gas 4 hornillas', categoria: 'Línea blanca', precioUsd: 230, stock: 1, stockMin: 2 },
  ];
  for (const p of productosSeed) {
    db.insert('productos', {
      id: uid('prod_'),
      comercioId: comercio.id,
      ...p,
      activo: true,
      creado: new Date('2026-02-01').toISOString(),
    });
  }
  console.log('Seed completo: 1 comercio, 3 clientes, ' + productosSeed.length + ' productos.');
}

// Siembra solo si la base está vacía (útil en Render: disco efímero en plan free).
export function seedIfEmpty() {
  if (db.get('comercios').length === 0) {
    seed();
    return true;
  }
  return false;
}

if (process.argv.includes('--seed')) seed();
