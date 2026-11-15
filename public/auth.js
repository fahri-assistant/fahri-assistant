// auth.js FINAL - jangan diubah lagi
(function(){
  function setStatus(m){ var el=document.getElementById('authStatus'); if(el) el.textContent=m; }
  function waitFirebase(cb){
    var n=0; var t=setInterval(function(){
      if(window.firebase){ clearInterval(t); cb(); }
      else if(++n>50){ clearInterval(t); setStatus('Firebase gagal ke-load'); }
    },100);
  }
  waitFirebase(async function(){
    try{
      var r=await fetch('/firebase-config.json',{cache:'no-store'});
      if(!r.ok){ setStatus('firebase-config.json tidak ketemu'); return; }
      var cfg=await r.json();
      if(!firebase.apps.length) firebase.initializeApp(cfg);
      var auth=firebase.auth();
      window.__FAHRI_LOGOUT__ = function(){ return auth.signOut().then(function(){ location.reload(); }); };
      try{ var res=await auth.getRedirectResult(); if(res&&res.user) setStatus('Login berhasil'); }catch(e){ setStatus('Login gagal: '+e.message); }
      auth.onAuthStateChanged(function(user){
        if(window.__FAHRI_SET_USER__) window.__FAHRI_SET_USER__(user);
        if(!user) setStatus('Auth siap - silakan login');
        else setStatus('Login sebagai: '+user.email);
      });
      function pasang(id, provName){
        var b=document.getElementById(id); if(!b) return;
        b.onclick=function(e){ e.preventDefault(); var p = provName==='google' ? new firebase.auth.GoogleAuthProvider() : new firebase.auth.GithubAuthProvider(); auth.signInWithRedirect(p).catch(function(err){ alert('Login gagal: '+err.message); }); };
      }
      pasang('googleLogin','google');
      pasang('githubLogin','github');
    }catch(e){ setStatus('Auth error: '+e.message); }
  });
})();
