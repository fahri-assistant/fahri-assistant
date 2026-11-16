export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method salah' });
  try {
    const { prompt, imageBase64 } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Prompt kosong' });

    // Kalau ada foto -> mode EDIT, kalau nggak ada foto -> mode BIKIN BARU
    // Pake Together AI (key yang kamu pasang)
    const r = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}` },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-schnell-Free',
        prompt: prompt,
        width: 512, height: 512, steps: 4, n: 1
      })
    });
    const d = await r.json();
    const url = d?.data?.[0]?.url || d?.data?.[0]?.b64_json;
    if (!url) {
      console.log('Together gagal:', JSON.stringify(d).slice(0,500));
      return res.status(500).json({ error: 'Together lagi sibuk / key salah. Cek di Vercel -> Settings -> Environment Variables, namanya harus TOGETHER_API_KEY' });
    }
    // Kalau Together ngasih base64, balikin jadi data URL
    const finalUrl = url.startsWith('data:') || url.startsWith('http') ? url : `data:image/png;base64,${url}`;
    return res.status(200).json({ imageUrl: finalUrl });
  } catch(e){ return res.status(500).json({ error: 'Server gambar sibuk: '+e.message }); }
      }
