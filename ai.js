// ai.js — Integración con Claude (Anthropic API) usando fetch nativo de Node 24.
// Si no hay ANTHROPIC_API_KEY, cae a una lógica de reglas determinista para que
// el producto FUNCIONE en demo sin costo de API. Esa es la clave del modelo
// bootstrap: la IA mejora el resultado, pero el negocio no se cae sin ella.

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001'; // barato para volumen

async function callClaude(system, user, maxTokens = 600) {
  if (!API_KEY) return null; // modo fallback
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.content?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

// ---- Scoring crediticio ----
// Devuelve { score (0-100), nivel (1-3), limiteUsd, motivo }.
export async function evaluarCredito(cliente) {
  const reglas = scoringPorReglas(cliente);

  const txt = await callClaude(
    'Eres un analista de riesgo crediticio para un comercio en Venezuela que vende a cuotas (modelo tipo Cashea). ' +
      'Evalúas riesgo con criterio conservador porque el comercio arriesga su propio capital. ' +
      'Responde SOLO con un JSON válido: {"score":0-100,"nivel":1-3,"limiteUsd":número,"motivo":"texto breve en español"}.',
    `Cliente:\n${JSON.stringify(cliente, null, 2)}\n\n` +
      `Reglas de referencia del sistema (puedes ajustar ±15 puntos con criterio): ${JSON.stringify(reglas)}.\n` +
      'Nivel 1 = límite ~100 USD, Nivel 2 = ~250 USD, Nivel 3 = ~500 USD. ' +
      'Mora alta o ingreso bajo deben reducir el score.',
    400
  );

  if (txt) {
    try {
      const j = JSON.parse(txt.match(/\{[\s\S]*\}/)?.[0] ?? txt);
      if (typeof j.score === 'number') return { ...reglas, ...j, fuente: 'claude' };
    } catch { /* cae a reglas */ }
  }
  return { ...reglas, fuente: 'reglas' };
}

function scoringPorReglas(c) {
  let score = 50;
  const hist = (c.historialPagos || '').toLowerCase();
  if (hist === 'excelente') score += 30;
  else if (hist === 'bueno') score += 18;
  else if (hist === 'regular') score += 5;
  else if (hist === 'malo') score -= 25;

  const ingreso = Number(c.ingresoMensualUsd) || 0;
  if (ingreso >= 500) score += 18;
  else if (ingreso >= 300) score += 10;
  else if (ingreso >= 150) score += 3;
  else score -= 10;

  const mora = Number(c.moraDias) || 0;
  if (mora > 30) score -= 30;
  else if (mora > 7) score -= 15;
  else if (mora > 0) score -= 5;

  score = Math.max(0, Math.min(100, score));
  const nivel = score >= 75 ? 3 : score >= 50 ? 2 : 1;
  const limiteUsd = nivel === 3 ? 500 : nivel === 2 ? 250 : 100;
  return {
    score,
    nivel,
    limiteUsd,
    motivo: `Historial: ${hist || 'n/d'}, ingreso ${ingreso} USD/mes, mora ${mora} días.`,
  };
}

// ---- Mensajes de cobranza por WhatsApp ----
export async function mensajeCobranza({ cliente, venta, cuota, tono = 'amable' }) {
  const txt = await callClaude(
    'Eres un asistente de cobranza para un comercio venezolano. Escribes mensajes de WhatsApp ' +
      'cortos, en español venezolano natural, respetuosos y que invitan a pagar sin amenazar. ' +
      'Incluye el monto, la fecha y un cierre cordial. Máximo 4 líneas.',
    `Tono: ${tono}.\nCliente: ${cliente.nombre}.\nProducto: ${venta.descripcion}.\n` +
      `Cuota pendiente: ${cuota.montoUsd} USD, vence/venció el ${cuota.vence}.\n` +
      `Comercio: ${venta.comercioNombre || 'la tienda'}.`,
    300
  );
  if (txt) return { texto: txt.trim(), fuente: 'claude' };

  // Fallback plantilla
  const plantilla =
    `Hola ${cliente.nombre} 👋 Le saludamos de ${venta.comercioNombre || 'la tienda'}. ` +
    `Le recordamos su cuota de $${cuota.montoUsd} de "${venta.descripcion}" con fecha ${cuota.vence}. ` +
    `Puede pagar por Pago Móvil o en tienda. ¡Gracias por su confianza! 🙌`;
  return { texto: plantilla, fuente: 'plantilla' };
}
