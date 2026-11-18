// auth.js - B (pisah) - Redirect + sembunyikan tombol, tanpa email
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(){});

auth.getRedirectResult().then(function(res){
  if(res && res.user) updateUI(res.user);
}).catch(function(e){
  console.log('Redirect result:', e.message);
});

function updateUI(user){
  var dot = document.getElementById('statusDot');
  var txt = document.getElementById('statusText');
  var loginBtns = document.getElementById('loginBtns');
  var logout = document.getElementById('btnLogout');
  if(!dot || !txt) return;
  if(user){
    dot.classList.add('on');
    txt.textContent = 'Terhubung';
    if(loginBtns) loginBtns.classList.add('hidden');
    if(logout) logout.classList.remove('hidden');
  } else {
    dot.classList.remove('on');
    txt.textContent = 'Belum login';
    if(loginBtns) loginBtns.classList.remove('hidden');
    if(logout) logout.classList.add('hidden');
  }
}

auth.onAuthStateChanged(function(user){
  updateUI(user);
});

function pasang(id, provName){
  var b = document.getElementById(id);
  if(!b) return;
  b.onclick = async function(e){
    e.preventDefault();
    // Kalau di APK - pake login native, langsung muncul pilih akun di dalam app
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      try {
        var res = await window.Capacitor.Plugins.FirebaseAuthentication.signInWithGoogle();
        var idToken = res && res.credential && res.credential.idToken;
        if (idToken) {
          var cred = firebase.auth.GoogleAuthProvider.credential(idToken);
          await auth.signInWithCredential(cred);
        }
        return;
      } catch (err) {
        alert('Login gagal: ' + err.message);
        return;
      }
    }
    // Kalau di web Vercel - pake cara lama
    var p = provName === 'google' ? new firebase.auth.GoogleAuthProvider() : null;
    auth.signInWithPopup(p).catch(function(){
      return auth.signInWithRedirect(p);
    });
  };
    }
