alert('auth.js KE-LOAD!');
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
alert('auth.js KE-LOAD!');
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
  b.onclick = function(e){
    e.preventDefault();
    var p = provName === 'google' ? new firebase.auth.GoogleAuthProvider() : new firebase.auth.GithubAuthProvider();
    auth.signInWithRedirect(p);
  };
}
function pasangSemua(){
  pasang('btn-google','google');
  pasang('btn-github','github');
  pasang('login-google','google');
  pasang('login-github','github');
}
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', pasangSemua);
} else {
  pasangSemua();
  }
