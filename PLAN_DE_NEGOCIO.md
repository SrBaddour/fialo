# Fíalo — Plan de negocio

> **Vende a cuotas como Cashea, pero en tu propio comercio.**
> SaaS de gestión de crédito (BNPL) con scoring y cobranza asistidos por IA, para comercios venezolanos.

---

## 1. El problema

En Venezuela, **Cashea** popularizó el "compra ahora, paga después" (BNPL) y demostró que existe una demanda enorme de crédito al consumo. Pero Cashea funciona como un **intermediario centralizado**:

- El comercio paga una comisión y **cede la relación con el cliente** a Cashea.
- Miles de comercios pequeños y medianos (electrodomésticos, ferreterías, ropa, repuestos, motos, odontología, ópticas) **ya venden "fiado" de forma informal** — en un cuaderno, por WhatsApp, sin control de mora ni scoring.
- Ese "fiao" informal genera **pérdidas por morosidad, descontrol de caja y cero data** para decidir a quién darle crédito.

**Insight:** no todos los comercios quieren depender de Cashea. Muchos quieren **su propio sistema de cuotas**, con su marca, controlando su cartera y sus clientes.

## 2. La solución

**Fíalo** es un software (web + móvil) que el comercio instala/contrata para:

1. **Registrar clientes** y asignarles un **nivel y límite de crédito** automáticamente (scoring con IA).
2. **Generar planes de pago** estilo Cashea: inicial 40% + cuotas quincenales (configurable).
3. **Controlar cobranza**: cuotas, vencimientos, mora, y **mensajes de cobranza por WhatsApp redactados con IA** (tono amable/firme).
4. **Ver KPIs**: por cobrar, cobrado, en mora, comisión generada.

La IA (Claude) hace dos trabajos que ningún comerciante quiere hacer a mano:
- **Decidir cuánto crédito dar** (scoring de riesgo).
- **Redactar y personalizar la cobranza** (lo que más fricción y pena social genera al dueño).

> Diseño clave: **el sistema funciona sin IA** (lógica de reglas) y la IA *mejora* el resultado. Así el costo de API no bloquea el arranque bootstrap.

## 3. Modelo de monetización (cómo ganas dinero)

Modelo **híbrido SaaS + transaccional** (lo mejor de Cashea + lo mejor del SaaS):

| Plan | Precio | Para quién | Incluye |
|------|--------|-----------|---------|
| **Free** | $0 | Bodegas / probar | Hasta 20 clientes, scoring por reglas, sin IA |
| **Pro** | $19–29/mes | Comercio pequeño | Clientes ilimitados, scoring IA, cobranza IA, reportes |
| **Business** | $49–79/mes | Cadena / multi-sucursal | Multiusuario, multi-sucursal, API, marca propia |
| **Comisión** | 1–3% del volumen financiado | Todos los planes pagos | Opcional: % sobre lo que se financia |

**Ejemplo de unidad económica:** 50 comercios en plan Pro ($25) = **$1.250/mes recurrente** con costos casi fijos (un servidor + tu tiempo). La comisión transaccional es el upside que escala con el volumen de cada cliente.

Servicios adicionales (tu objetivo #2, **consultoría/automatización con IA**):
- **Implementación + capacitación**: $100–300 por comercio (one-time).
- **Personalización / integración** (pago móvil, punto de venta, inventario): por proyecto.

## 4. Mercado y sectores en Venezuela

Sectores donde el modelo crédito/cuotas ya es natural y Fíalo encaja:

- **Electrodomésticos y línea blanca** — ticket alto, el cliente *necesita* cuotas. (Terreno clásico de Cashea.)
- **Tecnología / celulares / motos / repuestos** — ticket alto, alta demanda de financiamiento.
- **Ropa, calzado, muebles, ferreterías** — ticket medio, recurrencia.
- **Servicios: odontología, ópticas, estética, cursos/educación** — tratamientos y matrículas a cuotas.
- **Alimentos / bodegas / mayoristas** — el "fiado" informal de toda la vida, listo para digitalizarse.

Contexto que lo hace viable: **baja bancarización**, **dolarización parcial** (el sistema maneja USD como referencia), inflación que empuja a comprar a crédito, y penetración alta de smartphones + WhatsApp + Pago Móvil.

## 5. Ventaja competitiva vs. Cashea

| | Cashea | Fíalo |
|---|---|---|
| Dueño de la relación con el cliente | Cashea | **El comercio** |
| Control de la cartera y los términos | Cashea | **El comercio** |
| Marca | Cashea | **La del comercio** (white-label) |
| Para quién | Consumidor final + grandes aliados | **PyMES y comercios que ya fían** |
| IA integrada para scoring/cobranza | — | **Sí (Claude)** |

No competimos con Cashea por el consumidor: **le damos a cada comercio su propia "mini-Cashea".**

## 6. Go-to-market bootstrap (tú solo, bajo capital)

1. **Nicho inicial:** un solo rubro y una sola ciudad (ej. electrodomésticos en Maracaibo o Valencia). Profundidad antes que amplitud.
2. **Venta directa:** demo en vivo con este MVP → "esto reemplaza tu cuaderno de fiados y te dice a quién darle crédito".
3. **Precio de entrada bajo** + implementación pagada (genera caja inmediata mientras crece el recurrente).
4. **Referidos:** cada comercio satisfecho refiere a otros del mismo rubro.
5. **Reinversión:** la comisión transaccional y las suscripciones financian el desarrollo de las siguientes features.

## 7. Riesgos y mitigación

- **Riesgo de crédito lo asume el comercio, no tú** → tú vendes la *herramienta*, no el capital. (Mucho menor riesgo regulatorio y financiero que ser un Cashea.)
- **Regulación fintech:** al no prestar dinero propio ni custodiar fondos, Fíalo es un *software de gestión*, no una entidad financiera. (Validar con asesor legal local antes de añadir pasarela de pagos/custodia.)
- **Morosidad de los comercios contigo:** cobro por adelantado / corte de servicio automático.
- **Dependencia de IA:** mitigada por el modo reglas (funciona sin API).

## 8. Roadmap

- **MVP (hecho):** clientes + scoring + planes de pago + cobranza IA + dashboard.
- **v1:** login multi-comercio, registro de pagos por Pago Móvil, recordatorios automáticos por WhatsApp (API).
- **v2:** app para el cliente final, historial crediticio compartido entre comercios (red), reportes de cartera.
- **v3:** marketplace / red Fíalo (efecto de red estilo buró de crédito para PyMES).

---

### Cómo encaja Claude / IA
- **Scoring:** Claude evalúa el perfil del cliente con criterio conservador y explica el porqué.
- **Cobranza:** Claude redacta mensajes de WhatsApp naturales en español venezolano, ajustando el tono.
- **Futuro:** análisis de cartera, detección de patrones de mora, generación de reportes y respuestas a clientes.

> Este documento es la *estructura de negocio* que puedes presentar a clientes potenciales e inversionistas. El MVP en este mismo repositorio es la demo funcional.
