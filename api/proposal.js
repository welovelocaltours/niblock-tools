// Niblock proposal generator — server-side AI draft.
// Calls the Anthropic Messages API using a secret key stored in the
// ANTHROPIC_API_KEY env var. The key never reaches the browser, and no
// end user needs an account or login. Prices are passed through verbatim
// from the calculator — the model is told never to invent or alter numbers.

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.PROPOSAL_MODEL || 'claude-sonnet-4-6';
  if (!key) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'The proposal engine is not configured yet (missing API key). Add ANTHROPIC_API_KEY in Vercel and redeploy.' }));
  }

  // Read body
  let raw = '';
  await new Promise((resolve) => { req.on('data', (c) => (raw += c)); req.on('end', resolve); });
  let d = {};
  try { d = JSON.parse(raw || '{}'); } catch (e) { d = {}; }

  const v = (x) => (typeof x === 'string' ? x.trim() : (x == null ? '' : String(x)));

  const system =
`You are a senior B2B proposal writer for NIBLOCK LOGISTICS, a family-run UK third-party logistics (3PL) company near Gatwick (Unit 8, Gatwick Business Park, Hookwood, Surrey RH6 0AH). Tagline: "big enough to cope, small enough to care".

HOUSE STYLE
- Warm, plain British English (UK spelling). Confident, never hypey. Short paragraphs.
- Speak to the prospect as "you". Refer to the company as "Niblock" or "we".
- Sell Niblock's real differentiators ONLY: family-run and personal (direct access, no ticket queues); flexible with no long lock-in; happy to handle complexity other 3PLs decline (large SKU ranges, hand-packed/gift orders, specialist or cold-chain storage); you can keep using your own systems/WMS with no integration fees; blue-chip pedigree (FedEx Supply Chain Services, Hackett, Pepe Jeans, EAST) alongside small-brand care.
- Carriage/postage is a pass-through billed at courier cost plus a small handling margin — never bundled or marked up to look like profit. If carriage figures are supplied, frame them as pass-through.

ABSOLUTE RULES
- NEVER invent, infer, alter, round or add ANY numbers, prices, percentages, dates, volumes or statistics. Use only figures that appear verbatim in the user's "FIXED FIGURES" block, and only where natural. If a figure is not provided, do not state one.
- Do not invent client names, testimonials, awards or guarantees.
- Do not promise specific delivery times, accuracy rates or savings unless they are given to you verbatim.
- British spelling throughout.

OUTPUT
Return ONLY valid minified JSON (no markdown, no commentary) with this exact shape:
{"headline":"","subhead":"","intro":"","challenges":[{"title":"","body":""}],"why":[{"title":"","body":""}],"how":[{"title":"","body":""}],"pricing_note":"","closing":""}
- headline: a short cover line for the prospect (<=8 words).
- subhead: one supporting line.
- intro: 2-3 sentences addressed to the prospect.
- challenges: 2-4 items naming the prospect's likely pain points (from the brief).
- why: 3-4 items, each a Niblock strength mapped to this prospect.
- how: 3-5 short items describing how the service would run for them (inbound, storage, pick/pack, dispatch, returns as relevant).
- pricing_note: 1-2 plain sentences introducing the pricing, making clear carriage is pass-through if carriage is mentioned. Do not restate the numbers.
- closing: a warm 1-2 sentence call to action inviting a conversation/visit.`;

  const userMsg =
`Write a tailored fulfilment proposal for this prospect.

PROSPECT
- Brand: ${v(d.brand) || '(not given)'}
- Contact: ${v(d.contact) || '(not given)'}
- What they sell: ${v(d.sells) || '(not given)'}
- Their priorities: ${v(d.priorities) || '(not given)'}
- Discovery notes / context: ${v(d.notes) || '(not given)'}

FIXED FIGURES (use these EXACTLY where natural; do not invent others)
${v(d.figures) || '(no figures provided — write the narrative without stating any numbers)'}

Remember: return only the JSON object described in the system instructions.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 2200,
        temperature: 0.4,
        system,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    const j = await r.json();
    if (!r.ok) {
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: (j && j.error && j.error.message) || 'AI service error' }));
    }

    const text = (j.content || []).map((c) => c.text || '').join('').trim();
    let parsed = null;
    try {
      const s = text.indexOf('{'), e = text.lastIndexOf('}');
      parsed = JSON.parse(s >= 0 ? text.slice(s, e + 1) : text);
    } catch (e) {
      parsed = null;
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ proposal: parsed, raw: parsed ? undefined : text }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'Request failed: ' + (err && err.message ? err.message : 'unknown') }));
  }
};
