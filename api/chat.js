export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ reply: 'Method salah' });
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
- Jawab dalam Bahasa Indonesia yang santai, jelas, dan masuk akal
- Jangan mengarang fakta. Kalau tidak tahu, bilang "Aku belum yakin, tapi menurut yang aku tahu..."
- Jawab sesuai pertanyaan terakhir, jangan melenceng
- Kalau user tanya "siapa kamu", jawab kamu Fahri Assistant buatan Fahri
- Jawab singkat tapi lengkap, pakai poin-poin kalau perlu
- Jangan jawab bahasa Inggris kecuali user minta`;

    const cleanMsgs = [
      { role: 'system', content: systemPrompt },
      ...msgs.filter(m => m.role === 'user' || m.role === 'assistant').slice(-8)
    ];

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
      return res.status(200).json({ reply: text });
    }

    // ===== 14 AI ANTRIAN - SEMUA AKTIF =====
    // 1. GROQ - Utama, 8 detik
    if (process.env.GROQ_API_KEY) {
      for (const m of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b']) {
        const r = await tryOpenAI('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY, m, 8000);
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
  const pr = await fetch('https://text.pollinations.ai/' + encodeURIComponent(lastText), { headers: { 'Accept': 'text/plain' } });
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
