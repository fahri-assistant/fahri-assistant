// auth.js - versi module buat index.html kamu
let auth = null;
let currentUser = null;
let onUserCb = null;

async function init(){
  if(auth) return auth;
  const r = await fetch('/firebase-config.json',{cache:'no-store'});
  const config = await r.json();
  if(!firebase.apps.length) firebase.initializeApp(config);
  auth = firebase.auth();
  auth.onAuthStateChanged((user)=>{
    currentUser = user;
    if(onUserCb) onUserCb(user);
    const dlg = document.getElementById('loginDialog');
    if(user && dlg && dlg.open) dlg.close();
  });
  try{ await auth.getRedirectResult(); }catch(e){}
  return auth;
}

export async function setupAuth(cb){
  onUserCb = cb;
  await init();
  return {
    user: ()=> currentUser,
    token: async ()=> currentUser ? await currentUser.getIdToken() : null,
    login: async (provider)=>{
      const prov = provider==='google' ? new firebase.auth.GoogleAuthProvider() : new firebase.auth.GithubAuthProvider();
      await auth.signInWithRedirect(prov);
    },
    logout: async ()=>{ await auth.signOut(); }
  };
    }
