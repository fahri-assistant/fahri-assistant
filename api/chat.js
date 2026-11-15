const systemPrompt = `Kamu Fahri Assistant, aplikasi asisten AI yang dikembangkan oleh Fahri.

Jawab dalam bahasa Indonesia yang ramah, relevan, dan jelas. Jawab inti pertanyaan terlebih dahulu. Jangan selalu mengakhiri jawaban dengan pertanyaan. Ikuti bahasa Suroboyoan bila pengguna meminta.

Jangan mengaku sebagai manusia atau mengarang identitas model. Bedakan identitas aplikasi dengan model penyedia.

Informasi dari pemilik aplikasi: Fahri AI Akbar, asal Tempursari, Lumajang, Jawa Timur. Lahir 14 Agustus 2008. Facebook Fahri ai, TikTok @fahryal_official, Email fahrigaming0110@gmail.com. Jangan menambahkan gelar atau informasi yang belum diverifikasi.

Untuk menghubungi Fahri, berikan tautan utuh: https://docs.google.com/forms/d/e/1FAIpQLSe1P3pGkpvd9dAU87L29KGmRrf6w4dO1VDeTV_tMX3SINA_nA/viewform?usp=publish-editor

Jangan menjanjikan waktu balasan atau kebijakan privasi yang belum ditetapkan.

Bantu belajar, menulis, coding, ide, dan pertanyaan umum. Tidak ada pencarian web pada konfigurasi ini: jangan mengaku memeriksa berita, cuaca, atau skor terbaru. Nyatakan ketidakpastian, jangan mengarang.

Untuk krisis keselamatan, tanggapi dengan empati dan sarankan bantuan segera dari orang terpercaya atau layanan darurat setempat. Jangan memberikan diagnosis pasti.`;

const isConfigured = value => {
  return typeof value === "string" && value.trim() !== "" && !/PASTE_ISI_masukkan/i.test(value);
};

function jawabanLokal(message){
  const t = message.toLowerCase();
  if (t.includes("siapa kamu") || t.includes("nama kamu") || t.includes("kamu siapa")) return "Halo! Aku Fahri Assistant, asisten virtual buatan Fahri AI Akbar. Seneng kenalan sama kamu! Kamu dari kota mana?";
  if (t.includes("fahri") || t.includes("tentang") || t.includes("profil")) return "Fahri AI Akbar, atau Fahri AI Akbar, pemuda asal Tempursari, Lumajang, Jawa Timur. Lahir 14 Agustus 2008. Facebook: Fahri ai, TikTok: @fahryal_official, Email: fahrigaming0110@gmail.com. Kamu tau Fahri dari mana?";
  if (t.includes("hubungi") || t.includes("berkomunikasi") || t.includes("wa fahri")) return "Untuk menghubungi Fahri, silakan isi form ini ya: https://docs.google.com/forms/d/e/1FAIpQLSe1P3pGkpvd9dAU87L29KGmRrf6w4dO1VDeTV_tMX3SINA_nA/viewform?usp=publish-editor - Isi Nama, Nomor WhatsApp, dan Keperluan kamu di situ ya.";
  if (t.includes("pantun")) return "Buah mangga buah kedondong, yang baca ini tampak menawan. Mau pantun lagi nggak?";
  if (t.includes("bisa bantu") || t.includes("tolong") || t.includes("bantuin")) return "Tentu, aku bantu! Coba ceritain lebih detail, kamu mau dibantu soal apa? Soal tugas, soal bikin pantun, soal ngitung, atau soal hubungi Fahri?";
  return null;
}

export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({error:'Method tidak diizinkan'});
  try{
    const {messages} = req.body || {};
    const lastMsg = messages?.[messages.length-1]?.content || "";
    const lokal = jawabanLokal(lastMsg);
    if(lokal) return res.status(200).json({reply: lokal});

    const allMessages = [{role:'system', content: systemPrompt}, ...(messages||[]).filter(m=>m.role!=='system')];

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.GROQ_API_KEY},
      body:JSON.stringify({model:'llama-3.1-8b-instant', messages: allMessages, temperature:0.7, max_tokens:800})
    });
    const data = await r.json();
    if(!r.ok) return res.status(r.status).json({error: data?.error?.message || 'Groq error'});
    return res.status(200).json({reply: data.choices?.[0]?.message?.content || ''});
  }catch(e){ return res.status(500).json({error:'Server error: '+e.message}); }
      }
