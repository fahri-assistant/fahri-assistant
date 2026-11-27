// api/cari.js - pencarian web untuk menu "Cari Web"
// Sumber: wiki-id, wiki-en, berita (Google News RSS), umum (Firecrawl, perlu FIRECRAWL_API_KEY)
export const config = { maxDuration: 15 };

function bersih(t) { return String(t || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim(); }

async function ambil(url, opt = {}, ms = 8000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opt, signal: c.signal }); }
  finally { clearTimeout(t); }
}

async function wikipedia(lang, q) {
  const r = await ambil(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srlimit=4&format=json&origin=*&srsearch=${encodeURIComponent(q)}`);
  const j = await r.json();
  const items = (j && j.query && j.query.search) || [];
  return items.map(x => ({
    title: bersih(x.title),
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(x.title).replace(/ /g, '_'))}`,
    snippet: bersih(x.snippet).slice(0, 260)
  }));
}

async function berita(q) {
  const r = await ambil(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`);
  const xml = await r.text();
  const hasil = [];
  const blok = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const b of blok.slice(0, 5)) {
    const judul = bersih((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
    const link = bersih((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1]);
    const sumber = bersih((b.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1]);
    const tgl = bersih((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]);
    if (judul && link) hasil.push({ title: judul, url: link, snippet: [sumber, tgl].filter(Boolean).join(' • ') });
  }
  return hasil;
}

async function umum(q) {
  const key = (process.env.FIRECRAWL_API_KEY || '').trim();
  if (!key) throw new Error('FIRECRAWL_API_KEY belum terpasang');
  const r = await ambil('https://api.firecrawl.dev/v2/search', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q.slice(0, 300), limit: 5 })
  }, 12000);
  if (!r.ok) throw new Error('pencarian umum status ' + r.status);
  const j = await r.json();
  const web = (j && j.data && j.data.web) || [];
  return web.slice(0, 5).map(w => ({ title: bersih(w.title || w.url), url: String(w.url || ''), snippet: bersih(w.description || '').slice(0, 260) })).filter(x => x.url);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method salah' });
  let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const q = String((body && body.q) || '').trim().slice(0, 200);
  const sumber = String((body && body.sumber) || 'wiki-id');
  if (!q) return res.status(400).json({ ok: false, error: 'Kata kunci kosong' });
  try {
    let hasil;
    if (sumber === 'wiki-id') hasil = await wikipedia('id', q);
    else if (sumber === 'wiki-en') hasil = await wikipedia('en', q);
    else if (sumber === 'berita') hasil = await berita(q);
    else if (sumber === 'umum') hasil = await umum(q);
    else return res.status(400).json({ ok: false, error: 'Sumber tidak dikenal' });
    return res.status(200).json({ ok: true, sumber, hasil });
  } catch (e) {
    console.error('CARI gagal:', e && e.message);
    return res.status(200).json({ ok: false, sumber, error: 'Sumber sedang tidak tersedia' });
  }
}
