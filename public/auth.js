export async function setupAuth(onChange){
 const [{initializeApp},{getAuth,GoogleAuthProvider,GithubAuthProvider,signInWithPopup,onAuthStateChanged,signOut}]=await Promise.all([
  import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
  import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js")
 ]);
 const r=await fetch('/firebase-config.json',{cache:'no-store'});if(!r.ok)throw new Error('Konfigurasi Firebase tidak ditemukan.');const config=await r.json();if(!config.apiKey||config.apiKey.startsWith('ISI_'))throw new Error('Isi firebase-config.json.');const auth=getAuth(initializeApp(config));
 await new Promise((resolve,reject)=>{let first=true;onAuthStateChanged(auth,user=>{onChange(user);if(first){first=false;resolve()}},reject)});
 return {user:()=>auth.currentUser,token:async()=>{if(!auth.currentUser)throw new Error('Login diperlukan.');return auth.currentUser.getIdToken()},login:provider=>signInWithPopup(auth,provider==='google'?new GoogleAuthProvider():new GithubAuthProvider()),logout:()=>signOut(auth)};
}
