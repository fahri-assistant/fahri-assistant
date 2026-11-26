import { cekKuota } from './kuota.js';
// api/edit.js - Edit foto: Cloudflare Workers AI (FLUX.2 klein) dulu, cadangan Pollinations (POST /v1/images/edits)
// Kirim: { "prompt": "jadikan anime", "image": "data:image/jpeg;base64,...", "imageCF": "(opsional) foto <=480px", "ow": 768, "oh": 768 }
// Balasan sukses: { "image": "data:image/...;base64,..." } atau { "url": "https://..." }
export const config = { maxDuration: 60 };

const API = 'https://gen.pollinations.ai/v1/images/edits';
// Urutan model yang dicoba (semua bisa menerima foto). Kalau satu gagal, lanjut ke berikutnya.
const MODELS = ['klein', 'gptimage', 'flux-2-dev', 'kontext'];

function getKey() {
  const e = process.env;
  let name = ['POLLINATIONS_API_KEY', 'POLLINATIONS_KEY', 'POLLINATIONS_TOKEN'].find(n => e[n]);
  if (!name) name = Object.keys(e).find(n => /pollinations/i.test(n) && /key|token|secret/i.test(n));
  if (!name) return { key: '', name: '' };
  // buang spasi / tanda kutip yang tidak sengaja ikut tertempel
  const key = String(e[name]).trim().replace(/^["']+|["']+$/g, '').replace(/^Bearer\s+/i, '');
  return { key, name };
}

function guessMime(b64) {
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('iVBOR')) return 'image/png';
  if (b64.startsWith('UklG')) return 'image/webp';
  return 'image/png';
}

// ===== Cloudflare Workers AI (FLUX.2 klein) - jatah gratis harian =====
// Variabel di Vercel: CLOUDFLARE_ACCOUNT_ID dan CLOUDFLARE_API_TOKEN.
// Opsional: CLOUDFLARE_IMAGE_MODEL (default flux-2-klein-4b; boleh diganti ke @cf/black-forest-labs/flux-2-klein-9b).
// Catatan: foto masukan harus kecil (di bawah 512x512), jadi pakai imageCF dari aplikasi.
async function editCloudflare(akun, token, model, prompt, mime, buf, ow, oh, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('width', String(ow));
    form.append('height', String(oh));
    form.append('input_image_0', new Blob([buf], { type: mime }), 'foto.' + (mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]));
    const r = await fetch('https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(akun) + '/ai/run/' + model, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: form,
      signal: ctrl.signal
    });
    const txt = await r.text();
    clearTimeout(t);
    if (!r.ok) return { ok: false, err: 'cloudflare: ' + r.status + ' ' + txt.slice(0, 160).replace(/\s+/g, ' ') };
    let j; try { j = JSON.parse(txt); } catch { return { ok: false, err: 'cloudflare: balasan bukan JSON' }; }
    const b64 = j && j.result && j.result.image;
    if (!b64) return { ok: false, err: 'cloudflare: tidak ada gambar di balasan' };
    if (b64.length > 4.2 * 1024 * 1024) return { ok: false, err: 'cloudflare: hasil terlalu besar' };
    return { ok: true, image: 'data:' + guessMime(b64) + ';base64,' + b64 };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, err: 'cloudflare: ' + (e && e.name === 'AbortError' ? 'timeout' : (e && e.message) || 'error') };
  }
}

// Pembatas pemakaian sederhana per alamat IP (tersimpan di memori fungsi; cukup untuk menahan penyalahgunaan ringan)
const _hits = globalThis.__rl || (globalThis.__rl = new Map());
function terlaluBanyak(req, nama, maks, jendelaMs) {
  const xf = req.headers && req.headers['x-forwarded-for'];
  const ip = String(xf || (req.socket && req.socket.remoteAddress) || '?').split(',')[0].trim();
  const k = nama + ':' + ip, now = Date.now();
  const arr = (_hits.get(k) || []).filter(t => now - t < jendelaMs);
  if (arr.length >= maks) { _hits.set(k, arr); return true; }
  arr.push(now); _hits.set(k, arr);
  if (_hits.size > 2000) { for (const [kk, v] of _hits) { if (!v.length || now - v[v.length - 1] > jendelaMs) _hits.delete(kk); } }
  return false;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method salah' });
  if (terlaluBanyak(req, 'edit', 6, 10 * 60 * 1000)) { res.setHeader('Retry-After', '300'); return res.status(429).json({ error: 'Terlalu banyak permintaan edit foto. Tunggu beberapa menit lalu coba lagi ya.' }); }
  const kuotaEdit = await cekKuota(req, 'edit');
  if (!kuotaEdit.ok) return res.status(429).json({ error: kuotaEdit.pesan });

  const { key, name: keyName } = getKey();
  const cfAkun = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const cfToken = (process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const adaCF = !!(cfAkun && cfToken);
  if (!key && !adaCF) return res.status(500).json({ error: 'API key belum terpasang di Vercel (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN, atau POLLINATIONS_API_KEY).' });

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

  // 1) Cloudflare (FLUX.2 klein) lebih dulu
  if (adaCF) {
    const mc = String(body.imageCF || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    const bufCF = mc ? Buffer.from(mc[2], 'base64') : buf;
    const mimeCF = mc ? mc[1] : mime;
    const dim = v => { v = parseInt(v, 10); return (v >= 256 && v <= 1920) ? Math.round(v / 16) * 16 : 768; };
    const sisa = deadline - Date.now();
    if (bufCF.length <= 1024 * 1024 && sisa > 10000) {
      const modelCF = (process.env.CLOUDFLARE_IMAGE_MODEL || '').trim() || '@cf/black-forest-labs/flux-2-klein-4b';
      const c = await editCloudflare(cfAkun, cfToken, modelCF, prompt, mimeCF, bufCF, dim(body.ow), dim(body.oh), Math.min(sisa - 8000, 28000));
      if (c.ok) return res.status(200).json({ image: c.image, model: modelCF });
      lastErr = c.err;
      console.error('EDIT: ' + c.err);
    } else {
      lastErr = 'cloudflare: foto terlalu besar untuk jalur ini';
    }
  }
  const galatCF = lastErr;

  // 2) Cadangan: Pollinations
  for (const model of (key ? MODELS : [])) {
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
        if (r.status === 401) return res.status(502).json({ error: 'API key Pollinations ditolak (401). Variabel terbaca: ' + keyName + ' (awalan "' + key.slice(0, 3) + '", panjang ' + key.length + '). Buat key baru (jenis Secret, awalan sk_) di enter.pollinations.ai lalu isi POLLINATIONS_API_KEY di Vercel dan deploy ulang.' + (galatCF ? ' | Percobaan Cloudflare juga gagal: ' + galatCF : (adaCF ? '' : ' | Cloudflare belum dipasang.')) });
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
