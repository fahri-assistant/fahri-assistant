const firebaseConfig = {
  apiKey: "AIzaSyC_enCjCWHSq4GTFHABA6kcCgjWeww1hks",
  authDomain: "fahri-assistant.firebaseapp.com",
  projectId: "fahri-assistant",
  storageBucket: "fahri-assistant.firebasestorage.app",
  messagingSenderId: "338206792631",
  appId: "1:338206792631:web:112d5ca99d7d4917c4a632",
  measurementId: "G-E25LVGYHNL"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
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

function pasang(id, provName){
  var b = document.getElementById(id);
  if(!b) return;
  b.onclick = async function(e){
    e.preventDefault();
    // Di APK: coba plugin native dulu, kalau gak ada langsung Redirect (bukan Popup)
    try {
      var isNative = window.Capacitor && window.Capacitor.isNativePlatform();
      if (isNative) {
        var plugin = window.Capacitor.Plugins && window.Capacitor.Plugins.FirebaseAuthentication;
        if (plugin) {
          var res = provName === 'google' ? await plugin.signInWithGoogle() : await plugin.signInWithGithub();
          var idToken = res && res.credential && res.credential.idToken;
          if (idToken) { await auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(idToken)); return; }
        }
      }
    } catch(err){ console.log('Native login gagal, lanjut Redirect:', err); }
    var p = provName === 'google' ? new firebase.auth.GoogleAuthProvider() : new firebase.auth.GithubAuthProvider();
    auth.signInWithRedirect(p);
  };
      }
pasang('btnGoogle', 'google');
pasang('btnGithub', 'github');
pasang('google-login-btn', 'google');
pasang('github-login-btn', 'github');
