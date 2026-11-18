if (typeof firebaseConfig !== 'undefined' && !firebase.apps.length) firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();

// ===== EDGE TO EDGE - status bar transparan =====
if (window.Capacitor && window.Capacitor.isNativePlatform()) {
  try {
    var sb = window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;
    if (sb) {
      sb.setOverlaysWebView({ overlay: true }).catch(function(){});
      sb.setBackgroundColor({ color: '#00000000' }).catch(function(){});
    }
  } catch (_) {}
}

// ===== CEK LOGIN =====
auth.onAuthStateChanged(function(user){
  if (user) {
    var el = document.getElementById('login-page');
    if (el) el.style.display = 'none';
    var main = document.getElementById('main-page');
    if (main) main.style.display = 'block';
  }
});

// ===== TOMBOL LOGIN - FINAL =====
function pasang(id, provName){
  var b = document.getElementById(id);
  if(!b) return;
  b.onclick = async function(e){
    e.preventDefault();
    var isNative = false;
    try { isNative = window.Capacitor && window.Capacitor.isNativePlatform(); } catch (_) {}
    if (isNative) {
      try {
        var plugin = (window.Capacitor.Plugins && window.Capacitor.Plugins.FirebaseAuthentication) || window.FirebaseAuthentication;
        if (!plugin) throw new Error('Plugin FirebaseAuthentication tidak ketemu - cap sync gagal');
        var res = await plugin.signInWithGoogle();
        var idToken = res && res.credential && res.credential.idToken;
        if (!idToken && res && res.user) idToken = res.user.idToken;
        if (!idToken) throw new Error('idToken kosong dari Google');
        var cred = firebase.auth.GoogleAuthProvider.credential(idToken);
        await auth.signInWithCredential(cred);
        return;
      } catch (err) {
        alert('Login gagal: ' + (err && err.message ? err.message : err));
        return;
      }
    }
    var p = provName === 'google' ? new firebase.auth.GoogleAuthProvider() : null;
    auth.signInWithPopup(p).catch(function(){ return auth.signInWithRedirect(p); });
  };
}
pasang('google-login-btn', 'google');
