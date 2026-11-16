export default async function handler(req, res) {
  try {
    const { prompt, imageBase64 } = req.body || {};
    if (!prompt) return res.json({ error: 'Prompt kosong' });

    // Kalau nggak ada foto, bikin baru kayak dulu
    if (!imageBase64) {
      const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=1024&height=1024&seed=' + Math.floor(Math.random()*999999) + '&nologo=true&private=true&enhance=true';
      return res.json({ imageUrl: url });
    }

    // Kalau ada foto, edit pake Together
    if (process.env.TOGETHER_API_KEY) {
      const r = await fetch('https://api.together.xyz/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.TOGETHER_API_KEY },
        body: JSON.stringify({ model: 'black-forest-labs/FLUX.1-schnell-Free', prompt: 'Edit this image: ' + prompt, image: imageBase64 })
      });
      const d = await r.json();
      if (d?.data?.[0]?.url) return res.json({ imageUrl: d.data[0].url });
      if (d?.data?.[0]?.b64_json) return res.json({ imageUrl: 'data:image/png;base64,' + d.data[0].b64_json });
    }
    return res.json({ error: 'Gagal edit. Cek TOGETHER_API_KEY di Vercel lalu Redeploy.' });
  } catch (e) { return res.json({ error: 'Gagal, coba lagi ya.' }); }
  }
