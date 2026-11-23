// api/edit.js - Edit foto pakai Pollinations (POST /v1/images/edits)
// Kirim: { "prompt": "jadikan anime", "image": "data:image/jpeg;base64,..." }
// Balasan sukses: { "image": "data:image/...;base64,..." } atau { "url": "https://..." }
export const config = { maxDuration: 60 };

const API = 'https://gen.pollinations.ai/v1/images/edits';
// Urutan model yang dicoba (semua bisa menerima foto). Kalau satu gagal, lanjut ke berikutnya.
const MODELS = ['klein', 'gptimage', 'flux-2-dev', 'kontext'];

function getKey() {
  const e = process.env;
  const k = e.POLLINATIONS_API_KEY || e.POLLINATIONS_KEY || e.POLLINATIONS_TOKEN;
  if (k) return k;
  const name = Object.keys(e).find(n => /pollinations/i.test(n));
  return name ? e[name] : '';
}

function guessMime(b64) {
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('iVBOR')) return 'image/png';
  if (b64.startsWith('UklG')) return 'image/webp';
  return 'image/png';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method salah' });

  const key = getKey();
  if (!key) return res.status(500).json({ error: 'API key Pollinations belum terpasang di Vercel (nama variabel: POLLINATIONS_API_KEY).' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const prompt = String(body.prompt || '').trim().slice(0, 800);
  const m = String(body.image || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!prompt) return res.status(400).json({ error: 'Instruksi editnya kosong.' });
  if (!m) return res.status(400).json({ error: 'Foto tidak valid (pakai JPG/PNG/WEBP).' });

  const mime = m[1];
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 3.5 * 1024 * 1024) return res.status(413).json({ error: 'Foto terlalu besar, coba foto yang lebih kecil.' });
  const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];

  const deadline = Date.now() + 55000;
  let lastErr = '';

  for (const model of MODELS) {
    const remaining = deadline - Date.now();
    if (remaining < 6000) break;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.min(remaining - 2000, 25000));
    try {
      const form = new FormData();
      form.append('prompt', prompt);
      form.append('model', model);
      form.append('image', new Blob([buf], { type: mime }), 'foto.' + ext);

      const r = await fetch(API, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key },
        body: form,
        signal: ctrl.signal
      });
      const txt = await r.text();
      clearTimeout(timer);

      if (!r.ok) {
        lastErr = model + ': ' + r.status + ' ' + txt.slice(0, 160).replace(/\s+/g, ' ');
        if (r.status === 401) return res.status(502).json({ error: 'API key Pollinations tidak valid (401). Cek lagi key di Vercel.' });
        continue;
      }

      let j;
      try { j = JSON.parse(txt); } catch { lastErr = model + ': balasan bukan JSON'; continue; }
      const d = j && j.data && j.data[0];
      if (d && d.b64_json) {
        if (d.b64_json.length > 4.2 * 1024 * 1024) { lastErr = model + ': hasil terlalu besar'; continue; }
        return res.status(200).json({ image: 'data:' + guessMime(d.b64_json) + ';base64,' + d.b64_json, model });
      }
      if (d && d.url) return res.status(200).json({ url: d.url, model });
      lastErr = model + ': hasil kosong';
    } catch (e) {
      clearTimeout(timer);
      lastErr = model + ': ' + (e && e.name === 'AbortError' ? 'timeout' : (e && e.message) || 'error');
    }
  }
  return res.status(502).json({ error: 'Edit foto gagal. ' + lastErr });
}
