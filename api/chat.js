import { cekKuota } from './kuota.js';
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

export const config = { maxDuration: 60 };

// ===== PENCARIAN WEB (Firecrawl) =====
// Dipakai hanya untuk pertanyaan yang butuh info terbaru (berita, skor, jadwal, hari ini, dll).
const RE_CARI = /\b(berita|news|terbaru|terkini|hari ini|sekarang|barusan|kemarin|besok|skor|hasil (?:pertandingan|laga|liga)|jadwal|klasemen|harga|kurs|rilis|update|live|2026|2027|pemenang|menang|kalah|bola|liga|timnas|saham|cuaca)\b/i;
function perluCari(teks) { return RE_CARI.test(String(teks || '')); }

async function cariWeb(query, key) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 9000);
  try {
    const r = await fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: String(query).slice(0, 300), limit: 5 }),
      signal: c.signal
    });
    if (!r.ok) return [];
    const j = await r.json();
    const web = (j && j.data && j.data.web) || [];
    return web.slice(0, 5).map(w => ({
      title: String(w.title || w.url || '').slice(0, 160),
      url: String(w.url || ''),
      snippet: String(w.description || w.snippet || w.markdown || '').replace(/\s+/g, ' ').slice(0, 350)
    })).filter(w => w.url);
  } catch (e) { return []; }
  finally { clearTimeout(t); }
}

function konteksCari(hasil) {
  return 'Hasil pencarian web terbaru (gunakan untuk menjawab, dan sebut sumbernya dengan nama situs):\n' +
    hasil.map((h, i) => (i + 1) + '. ' + h.title + ' - ' + h.snippet + ' (' + h.url + ')').join('\n');
}

function daftarSumber(hasil) {
  if (!hasil || !hasil.length) return '';
  return '\n\nSumber:\n' + hasil.map((h, i) => (i + 1) + '. ' + h.title + ' - ' + h.url).join('\n');
}

export default async function handler(req, res) {
  // CORS: izinkan aplikasi (APK/WebView) dan alamat lain memanggil API ini
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return res.status(405).json({ reply: 'Method salah' });
  if (terlaluBanyak(req, 'chat', 40, 10 * 60 * 1000)) { res.setHeader('Retry-After', '120'); return res.status(429).json({ reply: 'Terlalu banyak permintaan. Tunggu beberapa menit lalu coba lagi ya.' }); }
  const kuotaChat = await cekKuota(req, 'chat');
  if (!kuotaChat.ok) return res.status(429).json({ reply: kuotaChat.pesan });
  try {
    const body = req.body || {};
    let msgs = body.messages || [];
    if (!Array.isArray(msgs) || msgs.length === 0) {
      const t = body.message || body.prompt || '';
      msgs = [{ role: 'user', content: t }];
    }
    const lastText = msgs[msgs.length - 1]?.content || '';
    if (!lastText) return res.status(200).json({ reply: 'Halo! Mau tanya apa?' });

    const systemPrompt = `Kamu adalah Fahri Assistant, asisten pintar buatan Fahri AI Akbar.
Aturan WAJIB:
- Jawab dalam Bahasa Indonesia yang sopan dan profesional, jelas, dan mudah dipahami. Sapa pengguna dengan "Anda" atau sapaan netral, dan hindari bahasa gaul
- Jangan mengarang fakta. Kalau tidak tahu, bilang "Aku belum yakin, tapi menurut yang aku tahu..."
- Jawab sesuai pertanyaan terakhir, jangan melenceng
- Kalau user tanya "siapa kamu", jawab kamu Fahri Assistant buatan Fahri
- Jawab singkat tapi lengkap, pakai poin-poin kalau perlu
- Kalau ada hasil pencarian web di pesan, utamakan info itu dan jangan bilang kamu tidak punya akses internet
- Jangan jawab bahasa Inggris kecuali user minta`;

    const cleanMsgs = [
      { role: 'system', content: systemPrompt },
      ...msgs.filter(m => m.role === 'user' || m.role === 'assistant').slice(-8)
    ];

    // Pencarian web: hanya untuk pertanyaan yang butuh info terbaru, dan hanya kalau key tersedia
    let hasilCari = [];
    const firecrawlKey = (process.env.FIRECRAWL_API_KEY || '').trim();
    if (firecrawlKey && perluCari(lastText)) {
      hasilCari = await cariWeb(lastText, firecrawlKey);
      if (hasilCari.length) cleanMsgs.splice(1, 0, { role: 'system', content: konteksCari(hasilCari) });
    }
    const SUMBER = daftarSumber(hasilCari);

    // ===== TANYA LEWAT FOTO: model vision Groq (Llama 4 Scout) =====
    const gambarUser = typeof body.image === 'string' ? body.image : '';
    if (gambarUser) {
      const valid = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(gambarUser) && gambarUser.length < 4 * 1024 * 1024;
      if (!valid) {
        return res.status(200).json({ reply: 'Maaf, aku belum bisa membaca fotonya. Coba kirim ulang fotonya ya (format JPG, PNG, atau WEBP, ukuran tidak terlalu besar).' });
      }
      // Model gambar: Gemini 3.8 Flash (Google AI Studio). Model 2.5 sudah tidak tersedia untuk pengguna baru. Model Groq Llama 4 Scout sudah dihentikan Groq (Juli 2026).
      const sysTxt = cleanMsgs.filter(m => m.role === 'system').map(m => m.content).join('\n');
      const percakapan = cleanMsgs.filter(m => m.role !== 'system');
      const vm = percakapan.map((m, i) => (i === percakapan.length - 1 && m.role === 'user')
        ? { role: 'user', content: [
            { type: 'text', text: (sysTxt ? sysTxt + '\n\n' : '') + (lastText || 'Jelaskan gambar ini') },
            { type: 'image_url', image_url: { url: gambarUser } }
          ] }
        : { role: m.role, content: m.content });
      const kunciGemini = (process.env.GEMINI_API_KEY || '').trim();
      if (!kunciGemini) {
        console.error('VISION: GEMINI_API_KEY belum terpasang');
        return res.status(200).json({ reply: 'Maaf, fitur baca foto belum aktif di server. Coba lagi nanti ya.' });
      }
      let visionErr = '';
      const batasVision = Date.now() + 50000; // total waktu untuk semua percobaan (fungsi Vercel 60 dtk)
      for (let coba = 1; coba <= 3; coba++) {
        const sisa = batasVision - Date.now();
        if (sisa < 8000) { visionErr = 'waktu habis, coba kirim lagi'; break; }
        try {
          const c = new AbortController(); const t = setTimeout(() => c.abort(), Math.min(sisa - 2000, 40000));
          const r = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + kunciGemini, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'gemini-3.8-flash', messages: vm, temperature: 0.5, max_tokens: 900 }),
            signal: c.signal
          });
          clearTimeout(t);
          if (r.ok) {
            const j = await r.json();
            const txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
            if (txt) return res.status(200).json({ reply: String(txt) });
            visionErr = 'balasan kosong'; console.error('VISION: balasan kosong', JSON.stringify(j).slice(0, 300));
            break;
          }
          const detail = (await r.text()).slice(0, 300).replace(/\s+/g, ' ');
          visionErr = 'status ' + r.status + ' - ' + detail.slice(0, 160);
          console.error('VISION: gagal ' + r.status + ' - ' + detail);
          // 503 (sibuk) dan 429 (batas sementara): coba lagi sebentar
          if ((r.status === 503 || r.status === 429) && coba < 3) { await new Promise(res2 => setTimeout(res2, 1500 * coba)); continue; }
          break;
        } catch (e) {
          visionErr = ((e && e.name === 'AbortError') ? 'Gemini terlalu lama menjawab' : ('error ' + (e && e.message ? e.message : e)));
          console.error('VISION: error ' + (e && e.message ? e.message : e));
          break;
        }
      }
      return res.status(200).json({ reply: 'Maaf, aku belum bisa membaca fotonya sekarang. Coba kirim ulang fotonya beberapa saat lagi ya.\n\n[detail: ' + visionErr + ']' });
    }

    const isStream = body.stream === true || req.headers.accept?.includes('text/event-stream');

    async function tryOpenAI(url, key, model, timeoutMs, extraHeaders = {}) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const r = await fetch(url, {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, ...extraHeaders },
          body: JSON.stringify({ model, messages: cleanMsgs, temperature: 0.5, max_tokens: 1000, stream: isStream })
        });
        clearTimeout(timer);
        if (!r.ok) return { ok: false };
        if (!isStream) {
          const d = await r.json();
          const text = d?.choices?.[0]?.message?.content?.trim() || '';
          return { ok: !!text, text };
        }
        return { ok: true, stream: r.body };
      } catch (e) { clearTimeout(timer); return { ok: false }; }
    }

    async function sendStream(streamBody) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
      const reader = streamBody.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const data = t.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const j = JSON.parse(data);
            const chunk = j?.choices?.[0]?.delta?.content || '';
            if (chunk) res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
          } catch {}
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      return res.end();
    }

    async function sendText(text) {
      if (isStream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        return res.end();
      }
      return res.status(200).json({ reply: text + SUMBER });
    }

    // ===== 14 AI ANTRIAN - SEMUA AKTIF =====
    // 1. GROQ - Utama, 8 detik
    if (process.env.GROQ_API_KEY) {
      for (const m of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b']) {
        const r = await tryOpenAI('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY, m, 8000);
        if (r.ok) { if (isStream) return await sendStream(r.stream); return await sendText(r.text); }
      }
    }
    // CLOUDFLARE WORKERS AI (cadangan setelah Groq) - 8 detik
    // Memakai akun Cloudflare yang sudah ada: CLOUDFLARE_ACCOUNT_ID dan CLOUDFLARE_API_TOKEN (atau CLOUDFLARE_API_KEY)
    {
      const cfAcc = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
      const cfTok = ((process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY || '').trim());
      if (cfAcc && cfTok) {
        const r = await tryOpenAI('https://api.cloudflare.com/client/v4/accounts/' + cfAcc + '/ai/v1/chat/completions', cfTok, '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 8000);
        if (r.ok) { if (isStream) return await sendStream(r.stream); return await sendText(r.text); }
      }
    }
    // TOGETHER - 8 detik
    if (process.env.TOGETHER_API_KEY) {
      for (const m of ['meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', 'deepseek-ai/DeepSeek-V3']) {
        const r = await tryOpenAI('https://api.together.xyz/v1/chat/completions', process.env.TOGETHER_API_KEY, m, 8000);
        if (r.ok) { if (isStream) return await sendStream(r.stream); return await sendText(r.text); }
      }
    }
    // 2. OPENROUTER - 3 detik
    if (process.env.OPENROUTER_API_KEY) {
      for (const m of ['deepseek/deepseek-chat-v3-0324:free', 'meta-llama/llama-3.1-8b-instruct:free', 'qwen/qwen3-235b-a22b:free']) {
        const r = await tryOpenAI('https://openrouter.ai/api/v1/chat/completions', process.env.OPENROUTER_API_KEY, m, 3000, { 'HTTP-Referer': 'https://fahri-assistant.vercel.app', 'X-Title': 'Fahri Assistant' });
        if (r.ok) { if (isStream) return await sendStream(r.stream); return await sendText(r.text); }
      }
    }
    // 3. SAMBANOVA - 3 detik
    if (process.env.SAMBANOVA_API_KEY) {
      for (const m of ['Meta-Llama-3.3-70B-Instruct', 'Meta-Llama-3.1-8B-Instruct']) {
        const r = await tryOpenAI('https://api.sambanova.ai/v1/chat/completions', process.env.SAMBANOVA_API_KEY, m, 3000);
        if (r.ok) { if (isStream) return await sendStream(r.stream); return await sendText(r.text); }
      }
    }
    // 4. MISTRAL - 3 detik
    if (process.env.MISTRAL_API_KEY) {
      const r = await tryOpenAI('https://api.mistral.ai/v1/chat/completions', process.env.MISTRAL_API_KEY, 'mistral-small-latest', 3000);
      if (r.ok) { if (isStream) return await sendStream(r.stream); return await sendText(r.text); }
    }
    // 5. KIMI / MOONSHOT - 3 detik
    if (process.env.KIMI_API_KEY) {
      const r = await tryOpenAI('https://api.moonshot.ai/v1/chat/completions', process.env.KIMI_API_KEY, 'kimi-k2-0711-preview', 3000);
      if (r.ok) { if (isStream) return await sendStream(r.stream); return await sendText(r.text); }
    }
    // 6. GLM / ZHIPU - 3 detik
    if (process.env.GLM_API_KEY) {
      const r = await tryOpenAI('https://open.bigmodel.cn/api/paas/v4/chat/completions', process.env.GLM_API_KEY, 'glm-4.5-flash', 3000);
      if (r.ok) { if (isStream) return await sendStream(r.stream); return await sendText(r.text); }
    }
    // 7. MINIMAX - 3 detik
    if (process.env.MINIMAX_API_KEY) {
      const r = await tryOpenAI('https://api.minimax.io/v1/chat/completions', process.env.MINIMAX_API_KEY, 'MiniMax-M2.1', 3000);
      if (r.ok) { if (isStream) return await sendStream(r.stream); return await sendText(r.text); }
    }
    // 8. KLUSTER - 3 detik
    if (process.env.KLUSTER_API_KEY) {
      const r = await tryOpenAI('https://api.kluster.ai/v1/chat/completions', process.env.KLUSTER_API_KEY, 'klusterai/Meta-Llama-3.3-70B-Instruct-Turbo', 3000);
      if (r.ok) { if (isStream) return await sendStream(r.stream); return await sendText(r.text); }
    }
    // 9. HYPERBOLIC - 3 detik
    if (process.env.HYPERBOLIC_API_KEY) {
      const r = await tryOpenAI('https://api.hyperbolic.xyz/v1/chat/completions', process.env.HYPERBOLIC_API_KEY, 'meta-llama/Meta-Llama-3.1-70B-Instruct', 3000);
      if (r.ok) { if (isStream) return await sendStream(r.stream); return await sendText(r.text); }
    }
    // 10. FEATHERLESS - 3 detik
    if (process.env.FEATHERLESS_API_KEY) {
      const r = await tryOpenAI('https://api.featherless.ai/v1/chat/completions', process.env.FEATHERLESS_API_KEY, 'meta-llama/Meta-Llama-3.1-8B-Instruct', 3000);
      if (r.ok) { if (isStream) return await sendStream(r.stream); return await sendText(r.text); }
    }
    // 11. ARLI AI - 3 detik
    if (process.env.ARLI_API_KEY) {
      const r = await tryOpenAI('https://api.arliai.com/v1/chat/completions', process.env.ARLI_API_KEY, 'ArliAI/Mistral-Small-3.1-24B-Instruct-2503', 3000);
      if (r.ok) { if (isStream) return await sendStream(r.stream); return await sendText(r.text); }
    }
    // 12. CHUTES - 3 detik
    if (process.env.CHUTES_API_KEY) {
      const r = await tryOpenAI('https://llm.chutes.ai/v1/chat/completions', process.env.CHUTES_API_KEY, 'deepseek-ai/DeepSeek-V3-0324', 3000);
      if (r.ok) { if (isStream) return await sendStream(r.stream); return await sendText(r.text); }
    }
    // 13. HUGGING FACE - 3 detik
    if (process.env.HF_API_KEY) {
      const r = await tryOpenAI('https://router.huggingface.co/v1/chat/completions', process.env.HF_API_KEY, 'meta-llama/Meta-Llama-3.1-8B-Instruct', 3000);
      if (r.ok) { if (isStream) return await sendStream(r.stream); return await sendText(r.text); }
    }
    // 14. COHERE - Format beda, 3 detik
    if (process.env.COHERE_API_KEY) {
      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 3000);
        const r = await fetch('https://api.cohere.com/v2/chat', {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.COHERE_API_KEY}` },
          body: JSON.stringify({ model: 'command-a-03-2025', messages: cleanMsgs, temperature: 0.5, max_tokens: 1000 })
        });
        const d = await r.json();
        const out = d?.message?.content?.[0]?.text?.trim() || '';
        if (out) return await sendText(out);
      } catch {}
    }

    // CADANGAN TERAKHIR - Pollinations, tanpa API Key, gratis
    try {
      const pc = new AbortController(); const pt = setTimeout(() => pc.abort(), 8000);
      const pr = await fetch('https://text.pollinations.ai/' + encodeURIComponent(lastText), { headers: { 'Accept': 'text/plain' }, signal: pc.signal });
      clearTimeout(pt);
      if (pr.ok) {
        const ptext = (await pr.text()).trim();
        if (ptext) return await sendText(ptext);
      }
    } catch {}
    return await sendText('Maaf, semua AI lagi sibuk sebentar. Coba kirim lagi pertanyaan yang sama ya, jangan ganti pertanyaan dulu.');
  } catch (e) {
    return res.status(200).json({ reply: 'Maaf, server lagi sibuk sebentar. Coba kirim lagi ya.' });
  }
                     }
