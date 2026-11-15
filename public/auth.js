export async function setupAuth(onChange){
  const [{initializeApp},{getAuth,GoogleAuthProvider,GithubAuthProvider,signInWithRedirect,getRedirectResult,signOut,onAuthStateChanged}] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js")
  ]);
  const r = await fetch('/firebase-config.json',{cache:'no-store'});
  if(!r.ok) throw new Error('Konfigurasi Firebase tidak ditemukan.');
  const config = await r.json();
  if(!config.apiKey || config.apiKey.startsWith('ISI_')) throw new Error('Isi firebase-config.json.');
  const auth = getAuth(initializeApp(config));

  // Cek hasil redirect dari Google/GitHub (ini yang bikin login HP bisa)
  try{
    const result = await getRedirectResult(auth);
    if(result && result.user && onChange) onChange(result.user);
  }catch(e){
    console.error(e);
    const el = document.getElementById('authStatus');
    if(el) el.textContent = 'Login gagal: ' + e.message;
  }

  await new Promise((resolve)=>{
    let first = true;
    onAuthStateChanged(auth, user=>{
      if(onChange) onChange(user);
      if(first){ first=false; resolve(); }
    });
  });

  return {
    user: ()=> auth.currentUser,
    auth: ()=> auth,
    getToken: async ()=>{ if(!auth.currentUser) throw new Error('Login diperlukan.'); return auth.currentUser.getIdToken(); },
    login: (provider)=> signInWithRedirect(auth, provider==='google' ? new GoogleAuthProvider() : new GithubAuthProvider()),
    logout: ()=> signOut(auth)
  };
}
