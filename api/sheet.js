const ALLOWED = [
  'status', 'temperatura', 'motivo', 'nome', 'whatsapp', 'whatsapp_e164',
  'aeroporto', 'destino', 'prazo', 'passageiros', 'orcamento', 'pagamento',
  'entrada', 'intencao', 'utm_source', 'utm_medium', 'utm_campaign',
  'utm_content', 'utm_term', 'pagina', 'event_id',
];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const target = process.env.SHEETS_WEBHOOK_URL;
  if (!target) return res.status(500).json({ error: 'SHEETS_WEBHOOK_URL não configurado' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const input = (body && body.row) || {};

  if (!input.nome || !input.whatsapp) return res.status(400).json({ error: 'dados incompletos' });

  const row = {};
  for (const k of ALLOWED) {
    const v = input[k];
    if (v !== undefined && v !== null && v !== '') row[k] = String(v).slice(0, 500);
  }

  try {
    const r = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(row),
      redirect: 'follow',
      signal: AbortSignal.timeout(9000),
    });
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, sheet_status: r.status });
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'falha ao contatar a planilha' });
  }
};
