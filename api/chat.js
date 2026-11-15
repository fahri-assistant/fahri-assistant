export default async function handler(req, res){
  if(req.method!=='POST') return res.status(405).json({error:'Method tidak diizinkan'});
  try{
    const {messages}=req.body||{};
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.GROQ_API_KEY},
      body:JSON.stringify({model:'llama-3.1-8b-instant',messages,temperature:0.7,max_tokens:800})
    });
    const data=await r.json();
    if(!r.ok) return res.status(r.status).json({error:data?.error?.message||'Groq error'});
    return res.status(200).json({reply:data.choices?.[0]?.message?.content||''});
  }catch(e){ return res.status(500).json({error:'Server error: '+e.message}); }
}
