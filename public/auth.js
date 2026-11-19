// auth.js - FIX TOTAL, jangan deklarasi firebaseConfig / auth lagi
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
  alert('Cek tombol ' + id + ' ketemu? ' + (b ? 'YA' : 'TIDAK'));
  if(!b) return;
  b.onclick = function(e){
    e.preventDefault();
    alert('Tombol ' + id + ' DIPENCET, mau buka popup');
    var p = provName === 'google' ? new firebase.auth.GoogleAuthProvider() : new firebase.auth.GithubAuthProvider();
    authObj.signInWithPopup(p).then(function(result){
      updateLoginUI(result.user);
    }).catch(function(e){
      alert('Login gagal: ' + e.code + ' - ' + e.message);
    });
  };
                                            }
