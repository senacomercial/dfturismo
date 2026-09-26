// Função serverless do Vercel: recebe os eventos do formulário e envia para a
// API de Conversões da Meta. O token NUNCA fica no site, só aqui no servidor,
// lido da variável de ambiente META_CAPI_TOKEN (configurada no painel do Vercel).
const crypto = require('crypto');

const PIXEL_ID = process.env.META_PIXEL_ID || '1430379512538784';
const API_VERSION = process.env.META_API_VERSION || 'v25.0';
const ALLOWED_EVENTS = ['Lead', 'QualifiedLead', 'DisqualifiedLead'];

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10 || d.length === 11) d = '55' + d; // adiciona o código do Brasil
  return d;
}

function normalizeName(raw) {
  const n = String(raw || '').trim().toLowerCase().split(/\s+/)[0];
  return n ? n.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const token = process.env.META_CAPI_TOKEN;
  if (!token) return res.status(500).json({ error: 'META_CAPI_TOKEN não configurado' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const events = (Array.isArray(body.events) ? body.events : [])
    .filter((e) => e && ALLOWED_EVENTS.includes(e.event_name) && e.event_id)
    .slice(0, 3);
  if (!events.length) return res.status(400).json({ error: 'nenhum evento válido' });

  const user = body.user || {};
  const phone = normalizePhone(user.phone);
  const firstName = normalizeName(user.first_name);
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || undefined;

  const user_data = {
    ph: phone ? [sha256(phone)] : undefined,
    fn: firstName ? [sha256(firstName)] : undefined,
    country: [sha256('br')],
    client_ip_address: ip,
    client_user_agent: req.headers['user-agent'],
    fbp: body.fbp || undefined,
    fbc: body.fbc || undefined,
  };

  const now = Math.floor(Date.now() / 1000);
  const data = events.map((e) => ({
    event_name: e.event_name,
    event_time: now,
    event_id: String(e.event_id).slice(0, 100),
    action_source: 'website',
    event_source_url: body.event_source_url,
    user_data,
    custom_data: e.custom_data || {},
  }));

  const payload = { data };
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;

  try {
    const r = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    );
    const out = await r.json().catch(() => ({}));
    return res.status(r.ok ? 200 : 502).json(r.ok ? { ok: true, events_received: out.events_received } : { ok: false, error: out.error && out.error.message });
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'falha ao contatar a Meta' });
  }
};
