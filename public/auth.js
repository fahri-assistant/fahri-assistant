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
  b.onclick = function(e){
    e.preventDefault();
    var p = provName === 'google' ? new firebase.auth.GoogleAuthProvider() : new firebase.auth.GithubAuthProvider();
    auth.signInWithPopup(p).catch(function(){
  return auth.signInWithRedirect(p);
});
  };
}

pasang('btnGoogle', 'google');
pasang('btnGithub', 'github');

var logoutBtn = document.getElementById('btnLogout');
if(logoutBtn){
  logoutBtn.onclick = function(){ auth.signOut(); };
    }
