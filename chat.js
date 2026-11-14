const systemPrompt = `Kamu Fahri Assistant, aplikasi asisten AI yang dikembangkan Fahri.

Jawab dalam bahasa Indonesia yang ramah, relevan, dan jelas. Jawab inti pertanyaan terlebih dahulu. Jangan selalu mengakhiri jawaban dengan pertanyaan. Ikuti bahasa Suroboyoan bila pengguna meminta.

Jangan mengaku sebagai manusia atau mengarang identitas model. Bedakan identitas aplikasi dengan model penyedia.

Informasi dari pemilik aplikasi: Fahri Al Akbar, asal Tempursari, Lumajang, Jawa Timur; lahir 14 Agustus 2008. Facebook Fahri al. TikTok @fahryal_official. Email fahrigaming0110@gmail.com. Jangan menambahkan gelar atau informasi yang belum diverifikasi.

Untuk menghubungi Fahri, berikan tautan utuh:
https://docs.google.com/forms/d/e/1FAIpQLSefP3GpGkvdd9AUB7L296KgwRf6w4do1VDteV_tMX3SlNa_nA/viewform?usp=publish-editor

Jangan menjanjikan waktu balasan atau kebijakan privasi yang belum ditetapkan.

Bantu belajar, menulis, coding, ide, dan pertanyaan umum. Tidak ada pencarian web pada konfigurasi ini: jangan mengaku memeriksa berita, cuaca, atau skor terbaru. Nyatakan ketidakpastian, jangan mengarang.

Untuk krisis keselamatan, tanggapi dengan empati dan sarankan bantuan segera dari orang tepercaya atau layanan darurat setempat. Jangan memberikan diagnosis pasti.`;

const isConfigured = value => {
  return typeof value === "string" && value.trim() !== "" && !/PASTE_|ISI_|masukkan_/i.test(value);
};

function jawabanLokal(message) {
  const t = message.toLowerCase();
  if (t.includes("siapa kamu") || t.includes("nama kamu") || t.includes("kamu siapa")) return "Halo! Aku Fahri Assistant, asisten virtual buatan Prof. Fahri AA. Seneng kenalan sama kamu! Kamu dari kota mana?";
  if (t.includes("fahri") || t.includes("tentang") || t.includes("profil")) return "Prof. Fahri AA. — atau Fahri Al Akbar, pemuda asal Tempursari, Lumajang, Jawa Timur. Lahir 14 Agustus 2008. Facebook: Fahri al, TikTok: @fahryal_official, Email: fahrigaming0110@gmail.com. Kamu tau Fahri dari mana?";
  if (t.includes("hubungi") || t.includes("kontak") || t.includes("berkomunikasi") || t.includes("wa fahri")) return "Untuk menghubungi Prof. Fahri AA, silakan isi form ini ya: https://docs.google.com/forms/d/e/1FAIpQLSefP3GpGkvdd9AUB7L296KgwRf6w4do1VDteV_tMX3SlNa_nA/viewform?usp=publish-editor — Isi Nama, Nomor WhatsApp, dan Keperluan kamu di situ ya.";
  if (t.includes("pantun")) return "Buah mangga buah kedondong, yang baca ini tampak menawan. Mau pantun lagi nggak?";
  if (t.includes("bisa bantu") || t.includes("bantu saya") || t.includes("tolong") || t.includes("bantuin")) return "Tentu, aku bantu! Coba ceritain lebih detail, kamu mau dibantu soal apa? Soal tugas, soal bikin pantun, soal ngitung, atau soal hubungi Prof. Fahri? Ceritain ya.";
  if (t.includes("halo") || t.includes("hai") || t.includes("hello")) return "Halo! Ada yang bisa aku bantu? Coba tanya aku soal Fahri, atau minta pantun.";
  if (t.includes("apa kabar")) return "Kabar aku baik banget! Makasih udah nanya. Kalau kabar kamu gimana?";
  if (t.includes("makasih") || t.includes("terima kasih")) return "Sama-sama, senang banget bisa bantu kamu! Ada lagi yang mau ditanyain?";
  if (/[0-9]+\s*[-+*/]\s*[0-9]+/.test(message)) {
    try {
      const soal = message.replace(/[^0-9+\-*/(). ]/g, "").trim();
      if (soal && soal.length > 2) {
        const hasil = Function("return " + soal)();
        return "Hasilnya " + soal + " = " + hasil + ". Mau ngitung yang lain lagi nggak?";
      }
    } catch(e) {}
  }
  return null;
}

const providers = [];

if (isConfigured(process.env.GROQ_API_KEY)) {
  providers.push({
    name: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: process.env.GROQ_API_KEY,
    model: "openai/gpt-oss-20b"
  });
}

if (isConfigured(process.env.OPENROUTER_API_KEY)) {
  providers.push({
    name: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    key: process.env.OPENROUTER_API_KEY,
    model: "meta-llama/llama-3.1-8b-instruct:free"
  });
  providers.push({
    name: "OpenRouter-2",
    url: "https://openrouter.ai/api/v1/chat/completions",
    key: process.env.OPENROUTER_API_KEY,
    model: "qwen/qwen-2.5-72b-instruct:free"
  });
}

providers.push({
  name: "Pollinations",
  url: "https://text.pollinations.ai/openai",
  key: "dummy",
  model: "openai",
  noAuth: true
});

providers.push({
  name: "Pollinations-2",
  url: "https://gen.pollinations.ai/v1/chat/completions",
  key: "dummy",
  model: "openai",
  noAuth: true
});

providers.push({
  name: "Pollinations-3",
  url: "https://text.pollinations.ai/openai",
  key: "dummy",
  model: "mistral",
  noAuth: true
});

const statusReason = code => {
  const reasons = {
    400: "Parameter atau model tidak sesuai.",
    401: "API key ditolak.",
    402: "Kredit atau billing diperlukan.",
    403: "Akses ditolak.",
    404: "Model atau endpoint tidak ditemukan.",
    429: "Kuota atau batas permintaan tercapai."
  };
  return reasons[code] || (code >= 500 ? "Server penyedia bermasalah." : "Permintaan ditolak penyedia.");
};

const validateHistory = history => {
  if (!Array.isArray(history)) return false;
  if (history.length > 12) return false;
  if (history.length % 2 !== 0) return false;
  return history.every((message, index) => {
    const expectedRole = index % 2 === 0 ? "user" : "assistant";
    return message && message.role === expectedRole && typeof message.content === "string" && message.content.length <= 16000;
  });
};

function cleanReply(t) {
  return String(t || '')
    .replace(/\*\*/g, '')
    .replace(/###/g, '')
    .replace(/##/g, '')
    .replace(/`/g, '')
    .replace(/^\s*[-*]\s+/gm, '• ');
}

async function callProvider(provider, messages, signal) {
  const headers = { "Content-Type": "application/json" };
  if (!provider.noAuth) headers.Authorization = `Bearer ${provider.key}`;
  if (provider.name.startsWith("OpenRouter")) {
    headers["HTTP-Referer"] = "https://fahri-assistant.vercel.app";
    headers["X-Title"] = "Fahri Assistant";
  }
  const response = await fetch(provider.url, {
    method: "POST",
    signal,
    headers,
    body: JSON.stringify({ model: provider.model, messages, stream: false, max_tokens: 1200 })
  });
  if (!response.ok) {
    await response.body?.cancel();
    return { provider: provider.name, status: response.status, reason: statusReason(response.status) };
  }
  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    return { provider: provider.name, reason: "Respons tidak berisi teks jawaban." };
  }
  return { ok: true, reply: cleanReply(reply.trim()), provider: provider.name, model: data.model };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metode tidak diizinkan." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body || "{}"); } catch { return res.status(400).json({ error: "JSON permintaan tidak valid." }); }
  }
  if (!body || typeof body !== "object") body = {};

  const { message, history = [] } = body;
  if (typeof message !== "string" || !message.trim() || message.length > 6000) {
    return res.status(400).json({ error: "Pesan wajib diisi, maksimal 6000 karakter." });
  }
  if (!validateHistory(history)) {
    return res.status(400).json({ error: "Format riwayat percakapan tidak valid." });
  }

  const lokal = jawabanLokal(message);
  if (lokal) {
    return res.status(200).json({ ok: true, reply: cleanReply(lokal), provider: "Lokal" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map(item => ({ role: item.role, content: item.content })),
      { role: "user", content: message.trim() }
    ];
    const attempts = [];
    for (const provider of providers) {
      const result = await callProvider(provider, messages, controller.signal);
      if (result.ok) return res.status(200).json(result);
      attempts.push(result);
    }
    return res.status(200).json({
      ok: true,
      reply: "Maaf ya, semua AI-nya lagi padat barengan barusan. Coba kirim lagi pesan kamu sekali aja, biasanya langsung nyambung. Atau coba tanya yang simpel dulu kayak 'Siapa kamu?'",
      provider: "Fallback",
      model: "fallback"
    });
  } catch {
    return res.status(200).json({
      ok: true,
      reply: "Sinyalnya lagi lemot dikit, maaf ya. Coba kirim lagi pesan kamu sekali aja. Aku udah di sini lagi kok.",
      provider: "Fallback",
      model: "fallback"
    });
  } finally {
    clearTimeout(timeout);
  }
}