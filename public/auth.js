// auth.js - Login Google & GitHub
// Di Chrome (web): popup seperti biasa.
// Di APK (Capacitor): Google memakai pemilih akun Android (tanpa pindah ke website),
// GitHub memakai plugin native. Token dikirim ke Firebase Auth, jadi sesi tetap sama.
var authObj = firebase.auth();

function isNative() {
  try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
  catch (e) { return false; }
}
function nativeAuth() {
  try { return (window.Capacitor.Plugins && window.Capacitor.Plugins.FirebaseAuthentication) || null; }
  catch (e) { return null; }
}

function updateLoginUI(user) {
  var txt = document.getElementById('statusText');
  var dot = document.getElementById('statusDot');
  var loginBtns = document.getElementById('loginBtns');
  var btnLogout = document.getElementById('btnLogout');
  var drawerName = document.getElementById('drawerName');
  var drawerEmail = document.getElementById('drawerEmail');
  if (user) {
    if (txt) txt.textContent = user.displayName || user.email || 'Login';
    if (dot) dot.classList.add('on');
    if (loginBtns) loginBtns.style.display = 'none';
    if (btnLogout) btnLogout.classList.remove('hidden');
    if (drawerName) drawerName.textContent = user.displayName || 'Pengguna';
    if (drawerEmail) drawerEmail.textContent = user.email || '';
  } else {
    if (txt) txt.textContent = 'Belum login';
    if (dot) dot.classList.remove('on');
    if (loginBtns) loginBtns.style.display = 'flex';
    if (btnLogout) btnLogout.classList.add('hidden');
  }
}

authObj.onAuthStateChanged(function (user) { updateLoginUI(user); });

// Pesan gagal. Kalau user sendiri membatalkan, tidak perlu muncul pesan.
function gagal(e) {
  var kode = (e && e.code) || '';
  var pesan = (e && e.message) || '';
  if (/cancel|closed|user_cancel|popup-closed/i.test(kode + ' ' + pesan)) return;
  alert('Login gagal: ' + (kode ? kode + ' - ' : '') + pesan);
}

// Login native (APK): ambil token dari plugin, lalu masuk ke Firebase Auth web.
async function loginNative(provName) {
  var FA = nativeAuth();
  if (!FA) throw new Error('Fitur login belum tersedia di aplikasi ini');
  var res = provName === 'google'
    ? await FA.signInWithGoogle({ skipNativeAuth: true })
    : await FA.signInWithGithub({ skipNativeAuth: true });
  var cred = res && res.credential;
  if (!cred) throw new Error('Token login tidak diterima');
  var fCred = provName === 'google'
    ? firebase.auth.GoogleAuthProvider.credential(cred.idToken)
    : firebase.auth.GithubAuthProvider.credential(cred.accessToken);
  var r = await authObj.signInWithCredential(fCred);
  updateLoginUI(r.user);
}

function pasang(id, provName) {
  var b = document.getElementById(id);
  if (!b) return;
  b.onclick = function (e) {
    e.preventDefault();
    if (isNative()) { loginNative(provName).catch(gagal); return; }
    var p = provName === 'google' ? new firebase.auth.GoogleAuthProvider() : new firebase.auth.GithubAuthProvider();
    authObj.signInWithPopup(p).then(function (r) { updateLoginUI(r.user); }).catch(gagal);
  };
}

function pasangSemua() {
  pasang('btnGoogle', 'google');
  pasang('btnGithub', 'github');
  pasang('btn-google', 'google');
  pasang('btn-github', 'github');
  pasang('login-google', 'google');
  pasang('login-github', 'github');
  var lo = document.getElementById('btnLogout');
  if (lo) { lo.onclick = function () { authObj.signOut(); }; }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pasangSemua);
else pasangSemua();

if (isNative()) {
  try {
    var sb = window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;
    if (sb) {
      sb.hide().catch(function () {});
      sb.setOverlaysWebView({ overlay: true }).catch(function () {});
    }
  } catch (_) {}
}
