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

    async function tryOpenAI(url, key, model, extraHeaders = {}) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, ...extraHeaders },
          body: JSON.stringify({ model, messages: cleanMsgs, temperature: 0.5, max_tokens: 1000 })
        });
        const d = await r.json();
        return d?.choices?.[0]?.message?.content?.trim() || '';
      } catch (e) { return ''; }
    }

    // 1. GROQ
    if (process.env.GROQ_API_KEY) {
      for (const m of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']) {
        const out = await tryOpenAI('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY, m);
        if (out) return res.status(200).json({ reply: out });
      }
    }
    // 2. OPENROUTER FREE
    if (process.env.OPENROUTER_API_KEY) {
      for (const m of ['deepseek/deepseek-chat-v3.1:free', 'qwen/qwen-2.5-72b-instruct:free', 'meta-llama/llama-3.1-8b-instruct:free', 'google/gemma-3-27b-it:free']) {
        const out = await tryOpenAI('https://openrouter.ai/api/v1/chat/completions', process.env.OPENROUTER_API_KEY, m, { 'HTTP-Referer': 'https://fahri-assistant.vercel.app', 'X-Title': 'Fahri Assistant' });
        if (out) return res.status(200).json({ reply: out });
      }
    }
    // 3. SAMBANOVA
    if (process.env.SAMBANOVA_API_KEY) {
      const out = await tryOpenAI('https://api.sambanova.ai/v1/chat/completions', process.env.SAMBANOVA_API_KEY, 'Meta-Llama-3.3-70B-Instruct');
      if (out) return res.status(200).json({ reply: out });
    }
    // 4. MISTRAL
    if (process.env.MISTRAL_API_KEY) {
      const out = await tryOpenAI('https://api.mistral.ai/v1/chat/completions', process.env.MISTRAL_API_KEY, 'mistral-small-latest');
      if (out) return res.status(200).json({ reply: out });
    }
    // 5. KIMI / MOONSHOT
    if (process.env.KIMI_API_KEY) {
      const out = await tryOpenAI('https://api.moonshot.ai/v1/chat/completions', process.env.KIMI_API_KEY, 'kimi-k2-0711-preview');
      if (out) return res.status(200).json({ reply: out });
    }
    // 6. GLM / ZHIPU
    if (process.env.GLM_API_KEY) {
      const out = await tryOpenAI('https://open.bigmodel.cn/api/paas/v4/chat/completions', process.env.GLM_API_KEY, 'glm-4-flash');
      if (out) return res.status(200).json({ reply: out });
    }
    // 7. MINIMAX
    if (process.env.MINIMAX_API_KEY) {
      const out = await tryOpenAI('https://api.minimax.io/v1/chat/completions', process.env.MINIMAX_API_KEY, 'MiniMax-M2.1');
      if (out) return res.status(200).json({ reply: out });
    }
    // 8. KLUSTER - BARU
    if (process.env.KLUSTER_API_KEY) {
      const out = await tryOpenAI('https://api.kluster.ai/v1/chat/completions', process.env.KLUSTER_API_KEY, 'klusterai/Meta-Llama-3.3-70B-Instruct-Turbo');
      if (out) return res.status(200).json({ reply: out });
    }
    // 9. HYPERBOLIC - BARU
    if (process.env.HYPERBOLIC_API_KEY) {
      const out = await tryOpenAI('https://api.hyperbolic.xyz/v1/chat/completions', process.env.HYPERBOLIC_API_KEY, 'meta-llama/Meta-Llama-3.1-70B-Instruct');
      if (out) return res.status(200).json({ reply: out });
    }
    // 10. FEATHERLESS - BARU
    if (process.env.FEATHERLESS_API_KEY) {
      const out = await tryOpenAI('https://api.featherless.ai/v1/chat/completions', process.env.FEATHERLESS_API_KEY, 'meta-llama/Meta-Llama-3.1-8B-Instruct');
      if (out) return res.status(200).json({ reply: out });
    }
    // 11. ARLI AI - BARU
    if (process.env.ARLI_API_KEY) {
      const out = await tryOpenAI('https://api.arliai.com/v1/chat/completions', process.env.ARLI_API_KEY, 'ArliAI/Mistral-Small-3.1-24B-Instruct-2503');
      if (out) return res.status(200).json({ reply: out });
    }
    // 12. CHUTES
    if (process.env.CHUTES_API_KEY) {
      const out = await tryOpenAI('https://llm.chutes.ai/v1/chat/completions', process.env.CHUTES_API_KEY, 'deepseek-ai/DeepSeek-V3-0324');
      if (out) return res.status(200).json({ reply: out });
    }
    // 13. HUGGING FACE
    if (process.env.HF_API_KEY) {
      const out = await tryOpenAI('https://router.huggingface.co/v1/chat/completions', process.env.HF_API_KEY, 'meta-llama/Meta-Llama-3.1-8B-Instruct');
      if (out) return res.status(200).json({ reply: out });
    }
    // 14. COHERE
    if (process.env.COHERE_API_KEY) {
      try {
        const r = await fetch('https://api.cohere.com/v2/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.COHERE_API_KEY}` },
          body: JSON.stringify({ model: 'command-a-03-2025', messages: cleanMsgs, temperature: 0.5, max_tokens: 1000 })
        });
        const d = await r.json();
        const out = d?.message?.content?.[0]?.text?.trim() || '';
        if (out) return res.status(200).json({ reply: out });
      } catch (e) {}
    }
    // 15. POLLINATIONS - TANPA KEY
    try {
      const r = await fetch('https://text.pollinations.ai/' + encodeURIComponent(lastText));
      const t = await r.text();
      if (t && t.length > 5) return res.status(200).json({ reply: t.trim() });
    } catch (e) {}

    return res.status(200).json({ reply: 'Maaf, semua AI lagi sibuk sebentar. Coba kirim lagi pertanyaan yang sama ya.' });
  } catch (e) {
    return res.status(200).json({ reply: 'Maaf, server lagi sibuk sebentar. Coba kirim lagi ya.' });
  }
}
