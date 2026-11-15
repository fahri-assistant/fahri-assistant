// auth.js - versi bandel, tombol login PASTI ilang
(function(){
  var currentUser = null;

  function hideLoginButtons(){
    if(!currentUser) return;
    document.querySelectorAll('button, a, div, span').forEach(function(el){
      var txt = (el.textContent || '').trim();
      if(txt === 'Masuk / Login' || txt === 'Masuk' || txt === 'Login' || txt === 'Masuk / Daftar'){
        if(el.closest && el.closest('#profileBtn')) return;
        el.style.display = 'none';
      }
    });
    var lb = document.getElementById('loginBtn');
    if(lb) lb.style.display = 'none';
    document.body.classList.add('is-logged-in');
  }

  function showProfile(user){
    var old = document.getElementById('profileBtn');
    if(old) return;
    var btn = document.createElement('button');
    btn.id = 'profileBtn';
    btn.style.cssText = 'display:flex !important;align-items:center;gap:8px;background:#1a1a2e;color:white;border:1px solid #444;padding:8px 14px;border-radius:999px;cursor:pointer;margin:10px auto;';
    var img = document.createElement('img');
    img.src = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || user.email) + '&background=7c3aed&color=fff';
    img.style.cssText = 'width:28px;height:28px;border-radius:50%;object-fit:cover;';
    btn.appendChild(img);
    var span = document.createElement('span');
    span.textContent = user.displayName || user.email.split('@')[0];
    span.style.cssText = 'font-weight:600;font-size:14px;';
    btn.appendChild(span);
    btn.onclick = function(){
      if(confirm('Logout dari ' + user.email + ' ?')){
        firebase.auth().signOut().then(function(){ location.reload(); });
      }
    };
    document.body.prepend(btn);
  }

  var tries = 0;
  var timer = setInterval(function(){
    if(window.firebase){ clearInterval(timer); start(); }
    else if(++tries > 50){ clearInterval(timer); }
  }, 100);

  async function start(){
    var r = await fetch('/firebase-config.json', {cache:'no-store'});
    var config = await r.json();
    if(!firebase.apps.length) firebase.initializeApp(config);
    var auth = firebase.auth();
    try{ await auth.getRedirectResult(); }catch(e){}
    auth.onAuthStateChanged(function(user){
      currentUser = user;
      var dlg = document.getElementById('authDialog');
      if(dlg && dlg.close){ try{ dlg.close(); }catch(e){} }
      if(!user) return;
      hideLoginButtons();
      showProfile(user);
      setInterval(hideLoginButtons, 500);
    });
    function pasang(id, provName){
      var btn = document.getElementById(id);
      if(!btn) return;
      btn.addEventListener('click', function(e){
        e.preventDefault();
        var prov = provName === 'google' ? new firebase.auth.GoogleAuthProvider() : new firebase.auth.GithubAuthProvider();
        auth.signInWithRedirect(prov);
      });
    }
    pasang('googleLogin', 'google');
    pasang('githubLogin', 'github');
    var loginBtn = document.getElementById('loginBtn');
    var dlg2 = document.getElementById('authDialog');
    if(loginBtn && dlg2){
      loginBtn.addEventListener('click', function(){ if(dlg2.showModal) dlg2.showModal(); });
    }
  }
})();
