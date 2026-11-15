// auth.js - versi nyambung sendiri, nggak nunggu file lain
(async function(){
  function setStatus(msg){
    var el = document.getElementById('authStatus');
    if(el) el.textContent = msg;
    console.log('[auth]', msg);
  }

  try{
    const [appMod, authMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js")
    ]);
    const r = await fetch('/firebase-config.json', {cache:'no-store'});
    if(!r.ok){ setStatus('firebase-config.json tidak ketemu'); return; }
    const config = await r.json();
    const auth = authMod.getAuth(appMod.initializeApp(config));

    // Buat nangkep hasil balik dari Google
    try{
      const res = await authMod.getRedirectResult(auth);
      if(res && res.user) setStatus('Login berhasil: ' + res.user.email);
    }catch(e){ setStatus('Login gagal: ' + e.message); }

    authMod.onAuthStateChanged(auth, (user)=>{
      if(user){
        setStatus('Login sebagai: ' + user.email);
        // sembunyiin dialog login kalau ada
        var dlg = document.getElementById('authDialog');
        if(dlg) dlg.close ? dlg.close() : dlg.style.display = 'none';
        var btn = document.getElementById('loginBtn');
        if(btn) btn.textContent = user.email.split('@')[0];
      }
    });

    // INI KUNCINYA - langsung tempel ke tombol
    function pasang(id, provider){
      var btn = document.getElementById(id);
      if(!btn){ console.log('tombol tidak ketemu:', id); return; }
      btn.addEventListener('click', async (e)=>{
        e.preventDefault();
        e.stopPropagation();
        alert('Tombol ' + id + ' kepencet, lagi buka Google...');
        try{
          const prov = provider === 'google' ? new authMod.GoogleAuthProvider() : new authMod.GithubAuthProvider();
          await authMod.signInWithRedirect(auth, prov);
        }catch(err){ alert('Login gagal: ' + err.message); }
      });
      console.log('tombol kepasang:', id);
    }

    pasang('googleLogin', 'google');
    pasang('githubLogin', 'github');

    // Tombol Masuk yang buka dialog
    var loginBtn = document.getElementById('loginBtn');
    var dlg2 = document.getElementById('authDialog');
    if(loginBtn && dlg2){
      loginBtn.addEventListener('click', ()=>{
        if(dlg2.showModal) dlg2.showModal();
        else dlg2.style.display = 'block';
      });
    }

    setStatus('Auth siap');
  }catch(e){
    console.error(e);
    setStatus('Auth error: ' + e.message);
  }
})();
