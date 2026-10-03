// Função serverless do Vercel: repassa o evento de visita do site para a integração do CRM.
// O navegador não pode chamar o CRM direto (o CRM bloqueia chamadas de outros sites - CORS),
// então o site chama esta função e ela envia ao CRM pelo servidor.

const TARGET = process.env.CRM_SITE_EVENT_URL || 'https://api.legendaryhub.com.br/siteintegration/0f7970ff';
const ALLOWED = ['url', 'referrer', 'userAgent', 'timestamp', 'page_url'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const data = {};
  for (const k of ALLOWED) {
    const v = body[k];
    if (typeof v === 'string' && v) data[k] = v.slice(0, 500);
  }
  if (!data.timestamp) data.timestamp = new Date().toISOString();

  try {
    const r = await fetch(TARGET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(8000),
    });
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, crm_status: r.status });
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'falha ao contatar o CRM' });
  }
};
