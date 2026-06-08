# 💳 Fíalo

**SaaS de gestión de crédito y cuotas (BNPL) para comercios venezolanos**, con scoring y cobranza asistidos por IA (Claude). Es una "mini-Cashea" que cada comercio opera con su propia marca y su propia cartera.

> 📄 La estrategia completa (modelo de negocio, monetización, mercado, go-to-market) está en **[PLAN_DE_NEGOCIO.md](PLAN_DE_NEGOCIO.md)**.

---

## Qué hace el MVP

- **Inventario de productos** (SKU, descripción, categoría, precio USD, stock, stock mínimo) con **alertas de stock bajo** y valor total del inventario.
- **Carga masiva por Excel/CSV**: plantilla descargable, importación (agregar/actualizar por SKU o reemplazar todo) y exportación. Procesamiento en el navegador con SheetJS (offline).
- **Registro de clientes con scoring crediticio** (IA o reglas) → nivel y límite de crédito automáticos.
- **Ventas a crédito estilo Cashea conectadas al inventario**: eliges producto y cantidad → toma el precio, valida y **descuenta stock**; inicial 40% + 3 cuotas quincenales (configurable).
- **Cobranza**: control de cuotas, vencimientos y mora; **mensajes de WhatsApp redactados con IA**.
- **Dashboard** con KPIs: productos, valor de inventario, stock bajo, por cobrar, cobrado, en mora y comisión generada (modelo de ingreso del SaaS).
- **Simulador de scoring** para evaluar a un cliente sin guardarlo.

### Formato del Excel de inventario

El importador reconoce estas columnas (acepta variaciones de mayúsculas/acentos):

| Columna | Alternativas aceptadas | Requerido |
|---------|------------------------|-----------|
| `Descripcion` | `nombre`, `Nombre` | ✅ sí |
| `Precio` | `precioUsd`, `precio` | recomendado |
| `Unidades` | `stock`, `Stock` | recomendado |
| `SKU` | — | opcional (si coincide, **actualiza** ese producto) |
| `Categoria` | `categoria` | opcional |
| `Minimo` | `stockMin` | opcional |

Descarga la plantilla desde el botón **"Descargar plantilla Excel"** en la pestaña Inventario.

## Cómo ejecutar

```bash
npm install      # instala express (sin dependencias nativas)
npm run seed     # carga datos de demo: 1 comercio + 3 clientes
npm start        # arranca en http://localhost:3000
```

Abre **http://localhost:3000**.

### Activar la IA (Claude) — opcional

Sin API key el sistema funciona en **modo reglas** (scoring determinista + plantillas de cobranza). Para activar Claude:

```bash
# PowerShell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
npm start
```

Variables:
- `ANTHROPIC_API_KEY` — tu API key de Anthropic.
- `CLAUDE_MODEL` — por defecto `claude-haiku-4-5-20251001` (barato, ideal para volumen).
- `PORT` — por defecto `3000`.

## Arquitectura

```
fialo/
├── server.js          API REST + lógica BNPL (Express)
├── ai.js              Integración Claude (scoring + cobranza) con fallback a reglas
├── db.js              Almacén JSON (migrable a SQLite/PostgreSQL) + seed
├── public/            Dashboard del comercio (HTML/CSS/JS vanilla)
├── data/db.json       Datos (se crea al sembrar)
├── PLAN_DE_NEGOCIO.md Estrategia para presentar a clientes/inversores
└── package.json
```

**Decisión de diseño bootstrap:** una sola dependencia (`express`), almacén en archivo, y la IA es *opcional*. Así arranca en cualquer máquina sin costos y sin fricción, y escala migrando solo `db.js` y añadiendo la API key.

## API (resumen)

| Método | Ruta | Qué hace |
|--------|------|----------|
| `GET`  | `/api/resumen` | KPIs del comercio |
| `GET`/`POST` | `/api/productos` | Listar / crear producto |
| `PUT`/`DELETE` | `/api/productos/:id` | Editar / eliminar producto |
| `POST` | `/api/productos/importar` | Importación masiva (filas de Excel ya parseadas) |
| `GET`/`POST` | `/api/clientes` | Listar / crear cliente (con scoring) |
| `POST` | `/api/evaluar` | Scoring sin guardar |
| `GET`/`POST` | `/api/ventas` | Listar / crear venta (por producto o libre) |
| `POST` | `/api/ventas/:id/pagar` | Marcar cuota pagada |
| `POST` | `/api/cobranza` | Generar mensaje de cobranza con IA |

## Próximos pasos

Ver roadmap en [PLAN_DE_NEGOCIO.md](PLAN_DE_NEGOCIO.md#8-roadmap): login multi-comercio, pagos por Pago Móvil, recordatorios automáticos por WhatsApp, app para el cliente final.

---
MIT · MVP de demostración.
