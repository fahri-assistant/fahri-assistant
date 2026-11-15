// auth.js - versi final, ada profil
(function(){
  function setStatus(msg){
    var el = document.getElementById('authStatus');
    if(el) el.textContent = msg;
    console.log('[auth]', msg);
  }

  var tries = 0;
  var timer = setInterval(function(){
    if(window.firebase){
      clearInterval(timer);
      start();
    } else if(++tries > 50){
      clearInterval(timer);
      setStatus('Firebase gagal ke-load, refresh lagi');
    }
  }, 100);

  async function start(){
    try{
      var r = await fetch('/firebase-config.json', {cache:'no-store'});
      if(!r.ok){ setStatus('firebase-config.json tidak ketemu'); return; }
      var config = await r.json();
      if(!firebase.apps.length) firebase.initializeApp(config);
      var auth = firebase.auth();

      try{
        var res = await auth.getRedirectResult();
        if(res && res.user) setStatus('Login berhasil: ' + res.user.email);
      }catch(e){ setStatus('Login gagal: ' + e.message); }

      auth.onAuthStateChanged(function(user){
        var dlg = document.getElementById('authDialog');
        if(dlg && dlg.close) { try{ dlg.close(); }catch(e){} }
        if(!user) return;

        setStatus('Login sebagai: ' + user.email);

        document.querySelectorAll('#loginBtn').forEach(function(b){ b.style.display = 'none'; });
        document.querySelectorAll('button').forEach(function(b){
          if(b.textContent.trim() === 'Masuk / Login' || b.textContent.trim() === 'Masuk'){
            b.style.display = 'none';
          }
        });

        var oldProfile = document.getElementById('profileBtn');
        if(oldProfile) oldProfile.remove();

        var profileBtn = document.createElement('button');
        profileBtn.id = 'profileBtn';
        profileBtn.style.cssText = 'display:flex;align-items:center;gap:8px;background:#1a1a2e;color:white;border:1px solid #333;padding:8px 14px;border-radius:999px;cursor:pointer;margin:0 auto;';
        var img = document.createElement('img');
        img.src = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || user.email) + '&background=7c3aed&color=fff';
        img.style.cssText = 'width:28px;height:28px;border-radius:50%;object-fit:cover;';
        profileBtn.appendChild(img);
        var span = document.createElement('span');
        span.textContent = user.displayName || user.email.split('@')[0];
        span.style.cssText = 'font-weight:600;font-size:14px;';
        profileBtn.appendChild(span);
        profileBtn.addEventListener('click', function(){
          if(confirm('Logout dari ' + user.email + ' ?')){
            auth.signOut().then(function(){ location.reload(); });
          }
        });
        var firstLoginArea = document.getElementById('loginBtn')?.parentElement || document.body;
        firstLoginArea.appendChild(profileBtn);
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
