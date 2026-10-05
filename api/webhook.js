// Função serverless do Vercel: recebe TODO lead do formulário (qualificado ou não) e repassa ao CRM.
// A URL do webhook fica na variável de ambiente CRM_WEBHOOK_URL (painel do Vercel),
// assim ela não aparece no código público nem no navegador, e não depende de CORS.

const ALLOWED = [
  'event', 'event_id', 'timestamp', 'is_qualified', 'disqualification_reason', 'lead_temperature',
  'name', 'whatsapp', 'whatsapp_e164', 'airport', 'destination',
  'timeframe', 'timeframe_label', 'passengers', 'budget', 'budget_label',
  'payment', 'payment_label', 'entry', 'entry_label',
  'purchase_readiness', 'purchase_readiness_label',
  'source', 'campaign', 'page_url',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'fbclid', 'fbp', 'fbc',
];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const target = process.env.CRM_WEBHOOK_URL;
  if (!target) return res.status(500).json({ error: 'CRM_WEBHOOK_URL não configurado' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const input = (body && body.lead) || {};

  // Aceita qualquer lead, desde que tenha os dados mínimos
  if (typeof input.is_qualified !== 'boolean' || !input.name || !input.whatsapp_e164) {
    return res.status(400).json({ error: 'lead inválido' });
  }

  const lead = {};
  for (const k of ALLOWED) {
    const v = input[k];
    if (v !== undefined && v !== null && v !== '') lead[k] = typeof v === 'string' ? v.slice(0, 500) : v;
  }
  lead.received_at = new Date().toISOString();

  try {
    const r = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
      signal: AbortSignal.timeout(8000),
    });
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, crm_status: r.status });
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'falha ao contatar o CRM' });
  }
};
