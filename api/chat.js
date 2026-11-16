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
    const lower = lastText.toLowerCase();

    // KUNCI IDENTITAS - NGGAK LEWAT AI
    if (lower.includes('siapa kamu') || lower.includes('kamu siapa') || lower.includes('siapa pembuat') || lower.includes('siapa yang buat') || lower.includes('kamu dibuat oleh') || lower.includes('kamu buatan siapa')) {
      return res.status(200).json({ reply: 'Halo! Aku Fahri Assistant, asisten pintar buatan FahriAI. Aku dibuat oleh Fahri untuk bantu jawab pertanyaan, bikin gambar, dan bantu tugas kamu. Mau tanya apa hari ini? ✨' });
    }

    const isImageRequest = lower.includes('buatkan gambar') || lower.includes('buat gambar') || lower.includes('buatkan foto') || lower.includes('buat foto') || lower.includes('gambar') || lower.includes('foto') || lower.includes('lukis') || lower.includes('desain') || lower.includes('generate image') || lower.includes('gambar kan');
    if (isImageRequest) {
      let prompt = lastText.replace(/buatkan gambar|buat gambar|buatkan foto|buat foto|gambar kan|tolong|please|dong/gi, '').trim();
      if (!prompt) prompt = lastText;
      const enhancedPrompt = prompt + ', high quality, detailed, beautiful, realistic, 4k';
      const seed = Math.floor(Math.random() * 999999);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true&private=true&enhance=true&referrer=FahriAI`;
      return res.status(200).json({ reply: `Nih gambarnya, aku buatin sesuai permintaan kamu: "${prompt}"\n\n![gambar](${imageUrl})\n\n✨ Gambar dibuat oleh FahriAI ✨`, image: imageUrl });
    }

    const systemPrompt = `Kamu adalah Fahri Assistant, asisten pintar buatan FahriAI, dibuat oleh Fahri. Kamu BUKAN ChatGPT, BUKAN OpenAI, BUKAN Meta AI, BUKAN Gemini, BUKAN Claude. Kamu adalah Fahri Assistant buatan FahriAI. Kalau ditanya siapa kamu, jawab Fahri Assistant buatan FahriAI. Jawab dalam Bahasa Indonesia yang santai, jelas, dan masuk akal. Jangan mengarang fakta. Kalau tidak tahu, bilang "Aku belum yakin, tapi menurut yang aku tahu...". Jawab sesuai pertanyaan terakhir, jangan melenceng. Jawab singkat tapi lengkap, pakai poin-poin kalau perlu. Jangan jawab bahasa Inggris kecuali user minta`;

    const cleanMsgs = [
      { role: 'system', content: systemPrompt },
      ...msgs.filter(m => m.role === 'user' || m.role === 'assistant').slice(-8)
    ];

    function bersihinIdentitas(text){
      if(!text) return text;
      return text.replace(/aku ChatGPT/gi, 'aku Fahri Assistant').replace(/saya ChatGPT/gi, 'saya Fahri Assistant').replace(/ChatGPT/gi, 'Fahri Assistant').replace(/dibuat oleh OpenAI/gi, 'dibuat oleh FahriAI').replace(/buatan OpenAI/gi, 'buatan FahriAI').replace(/oleh OpenAI/gi, 'oleh FahriAI').replace(/OpenAI/gi, 'FahriAI').replace(/Meta AI/gi, 'FahriAI');
    }

    async function tryOpenAI(url, key, model, extraHeaders = {}) {
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, ...extraHeaders }, body: JSON.stringify({ model, messages: cleanMsgs, temperature: 0.5, max_tokens: 1000 }) });
        const d = await r.json();
        return bersihinIdentitas(d?.choices?.[0]?.message?.content?.trim() || '');
      } catch (e) { return ''; }
    }

    if (process.env.GROQ_API_KEY) {
      for (const m of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']) {
        const out = await tryOpenAI('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY, m);
        if (out) return res.status(200).json({ reply: out });
      }
    }
    if (process.env.OPENROUTER_API_KEY) {
      for (const m of ['deepseek/deepseek-chat-v3.1:free', 'qwen/qwen-2.5-72b-instruct:free', 'meta-llama/llama-3.1-8b-instruct:free', 'google/gemma-3-27b-it:free']) {
        const out = await tryOpenAI('https://openrouter.ai/api/v1/chat/completions', process.env.OPENROUTER_API_KEY, m, { 'HTTP-Referer': 'https://fahri-assistant.vercel.app', 'X-Title': 'Fahri Assistant' });
        if (out) return res.status(200).json({ reply: out });
      }
    }
    if (process.env.SAMBANOVA_API_KEY) {
      const out = await tryOpenAI('https://api.sambanova.ai/v1/chat/completions', process.env.SAMBANOVA_API_KEY, 'Meta-Llama-3.3-70B-Instruct');
      if (out) return res.status(200).json({ reply: out });
    }
    if (process.env.MISTRAL_API_KEY) {
      const out = await tryOpenAI('https://api.mistral.ai/v1/chat/completions', process.env.MISTRAL_API_KEY, 'mistral-small-latest');
      if (out) return res.status(200).json({ reply: out });
    }
    if (process.env.KIMI_API_KEY) {
      const out = await tryOpenAI('https://api.moonshot.ai/v1/chat/completions', process.env.KIMI_API_KEY, 'kimi-k2-0711-preview');
      if (out) return res.status(200).json({ reply: out });
    }
    if (process.env.GLM_API_KEY) {
      const out = await tryOpenAI('https://open.bigmodel.cn/api/paas/v4/chat/completions', process.env.GLM_API_KEY, 'glm-4-flash');
      if (out) return res.status(200).json({ reply: out });
    }
    if (process.env.MINIMAX_API_KEY) {
      const out = await tryOpenAI('https://api.minimax.io/v1/chat/completions', process.env.MINIMAX_API_KEY, 'MiniMax-M2.1');
      if (out) return res.status(200).json({ reply: out });
    }
    if (process.env.KLUSTER_API_KEY) {
      const out = await tryOpenAI('https://api.kluster.ai/v1/chat/completions', process.env.KLUSTER_API_KEY, 'klusterai/Meta-Llama-3.3-70B-Instruct-Turbo');
      if (out) return res.status(200).json({ reply: out });
    }
    if (process.env.HYPERBOLIC_API_KEY) {
      const out = await tryOpenAI('https://api.hyperbolic.xyz/v1/chat/completions', process.env.HYPERBOLIC_API_KEY, 'meta-llama/Meta-Llama-3.1-70B-Instruct');
      if (out) return res.status(200).json({ reply: out });
    }
    if (process.env.FEATHERLESS_API_KEY) {
      const out = await tryOpenAI('https://api.featherless.ai/v1/chat/completions', process.env.FEATHERLESS_API_KEY, 'meta-llama/Meta-Llama-3.1-8B-Instruct');
      if (out) return res.status(200).json({ reply: out });
    }
    if (process.env.ARLI_API_KEY) {
      const out = await tryOpenAI('https://api.arliai.com/v1/chat/completions', process.env.ARLI_API_KEY, 'ArliAI/Mistral-Small-3.1-24B-Instruct-2503');
      if (out) return res.status(200).json({ reply: out });
    }
    if (process.env.CHUTES_API_KEY) {
      const out = await tryOpenAI('https://llm.chutes.ai/v1/chat/completions', process.env.CHUTES_API_KEY, 'deepseek-ai/DeepSeek-V3-0324');
      if (out) return res.status(200).json({ reply: out });
    }
    if (process.env.HF_API_KEY) {
      const out = await tryOpenAI('https://router.huggingface.co/v1/chat/completions', process.env.HF_API_KEY, 'meta-llama/Meta-Llama-3.1-8B-Instruct');
      if (out) return res.status(200).json({ reply: out });
    }
    if (process.env.COHERE_API_KEY) {
      try {
        const r = await fetch('https://api.cohere.com/v2/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.COHERE_API_KEY}` }, body: JSON.stringify({ model: 'command-a-03-2025', messages: cleanMsgs, temperature: 0.5, max_tokens: 1000 }) });
        const d = await r.json();
        const out = bersihinIdentitas(d?.message?.content?.[0]?.text?.trim() || '');
        if (out) return res.status(200).json({ reply: out });
      } catch (e) {}
    }
    try {
      const r = await fetch('https://text.pollinations.ai/' + encodeURIComponent(lastText));
      const t = await r.text();
      if (t && t.length > 5) return res.status(200).json({ reply: bersihinIdentitas(t.trim()) });
    } catch (e) {}
    return res.status(200).json({ reply: 'Maaf, semua AI lagi sibuk sebentar. Coba kirim lagi pertanyaan yang sama ya.' });
  } catch (e) {
    return res.status(200).json({ reply: 'Maaf, server lagi sibuk sebentar. Coba kirim lagi ya.' });
  }
                                                                                                                                                                                                                                                                                                                                 }
