// auth.js - FIX FINAL, pake Popup biar gak pindah web
var authObj = firebase.auth();

function updateLoginUI(user){
  var txt = document.getElementById('statusText');
  var dot = document.getElementById('statusDot');
  var loginBtns = document.getElementById('loginBtns');
  var btnLogout = document.getElementById('btnLogout');
  var drawerName = document.getElementById('drawerName');
  var drawerEmail = document.getElementById('drawerEmail');
  if(user){
    if(txt) txt.textContent = user.displayName || user.email || 'Login';
    if(dot) dot.classList.add('on');
    if(loginBtns) loginBtns.style.display = 'none';
    if(btnLogout) btnLogout.classList.remove('hidden');
    if(drawerName) drawerName.textContent = user.displayName || 'Pengguna';
    if(drawerEmail) drawerEmail.textContent = user.email || '';
  } else {
    if(txt) txt.textContent = 'Belum login';
    if(dot) dot.classList.remove('on');
    if(loginBtns) loginBtns.style.display = 'flex';
    if(btnLogout) btnLogout.classList.add('hidden');
  }
}

authObj.onAuthStateChanged(function(user){
  updateLoginUI(user);
});

function pasang(id, provName){
  var b = document.getElementById(id);
  if(!b) return;
  b.onclick = function(e){
    e.preventDefault();
    // Cegah dua popup terbuka bersamaan (satu ketukan bisa terbaca dua kali di HP)
    if (window.__authBusy) return;
    var p = provName === 'google' ? new firebase.auth.GoogleAuthProvider() : new firebase.auth.GithubAuthProvider();
    // Kalau di HP / aplikasi Capacitor, pake Redirect. Kalau di web, pake Popup.
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      authObj.signInWithRedirect(p);
    } else {
      window.__authBusy = true;
      authObj.signInWithPopup(p).then(function(result){
        updateLoginUI(result.user);
      }).catch(function(e){
        // Batal sendiri atau popup ganda: tidak perlu pesan
        var kode = (e && e.code) || '';
        if (/cancelled-popup-request|popup-closed-by-user|cancelled/.test(kode)) return;
        console.error('LOGIN gagal:', kode); alert('Login belum berhasil. Coba lagi ya.');
      }).finally(function(){
        window.__authBusy = false;
      });
    }
  };
}

function pasangSemua(){
  pasang('btnGoogle','google');
  pasang('btnGithub','github');
  pasang('btn-google','google');
  pasang('btn-github','github');
  pasang('login-google','google');
  pasang('login-github','github');
  var lo = document.getElementById('btnLogout');
  if(lo){
    lo.onclick = function(){ authObj.signOut(); };
  }
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', pasangSemua);
} else {
  pasangSemua();
}

if (window.Capacitor && window.Capacitor.isNativePlatform()) {
  try {
    var sb = window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;
    if (sb) {
      sb.hide().catch(function(){});
      sb.setOverlaysWebView({ overlay: true }).catch(function(){});
    }
  } catch (_) {}
      }
