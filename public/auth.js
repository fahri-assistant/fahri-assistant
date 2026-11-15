// auth.js - versi compat, anti failed to fetch
(function(){
  function setStatus(msg){
    var el = document.getElementById('authStatus');
    if(el) el.textContent = msg;
    console.log('[auth]', msg);
  }

  // Tunggu firebase ke-load
  var tries = 0;
  var timer = setInterval(function(){
    if(window.firebase){
      clearInterval(timer);
      start();
    } else if(++tries > 50){
      clearInterval(timer);
      setStatus('Firebase gagal ke-load, cek internet / refresh');
    }
  }, 100);

  async function start(){
    try{
      var r = await fetch('/firebase-config.json', {cache:'no-store'});
      if(!r.ok){ setStatus('firebase-config.json tidak ketemu'); return; }
      var config = await r.json();
      if(!firebase.apps.length) firebase.initializeApp(config);
      var auth = firebase.auth();

      // Nangkep hasil balik dari Google
      try{
        var res = await auth.getRedirectResult();
        if(res && res.user) setStatus('Login berhasil: ' + res.user.email);
      }catch(e){ setStatus('Login gagal: ' + e.message); }

      auth.onAuthStateChanged(function(user){
        if(user){
          setStatus('Login sebagai: ' + user.email);
          var dlg = document.getElementById('authDialog');
          if(dlg && dlg.close) dlg.close();
          var btn = document.getElementById('loginBtn');
          if(btn) btn.textContent = user.email.split('@')[0];
        }
      });

      function pasang(id, provName){
        var btn = document.getElementById(id);
        if(!btn) return;
        btn.addEventListener('click', function(e){
          e.preventDefault();
          e.stopPropagation();
          var prov = provName === 'google' ? new firebase.auth.GoogleAuthProvider() : new firebase.auth.GithubAuthProvider();
          auth.signInWithRedirect(prov).catch(function(err){
            alert('Login gagal: ' + err.message);
          });
        });
      }

      pasang('googleLogin', 'google');
      pasang('githubLogin', 'github');

      var loginBtn = document.getElementById('loginBtn');
      var dlg2 = document.getElementById('authDialog');
      if(loginBtn && dlg2){
        loginBtn.addEventListener('click', function(){
          if(dlg2.showModal) dlg2.showModal();
        });
      }

      setStatus('Auth siap');
    }catch(e){
      setStatus('Auth error: ' + e.message);
    }
  }
})();
