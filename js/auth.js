// Autenticación local de la versión de pruebas.
// Bloqueo por inactividad: si no hay uso durante 15 minutos se vuelve a pedir el acceso.
const IDLE_LOCK_MS=15*60*1000;
let idleTimer=null;
function resetIdleTimer(){
  clearTimeout(idleTimer);
  if($("app-shell").hidden)return;
  idleTimer=setTimeout(()=>{if(!$("app-shell").hidden)showLogin();},IDLE_LOCK_MS);
}
["pointerdown","keydown","touchstart","scroll"].forEach(name=>
  document.addEventListener(name,resetIdleTimer,{passive:true,capture:true}));
async function passwordHash(password,saltHex,iterations){
  const salt=new Uint8Array(saltHex.match(/.{2}/g).map(byte=>parseInt(byte,16)));
  const key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations,hash:"SHA-256"},key,256);
  return bytesToHex(bits);
}

async function validateLogin(username,password){
  if(!window.SD_USERS||!Array.isArray(window.SD_USERS))return false;
  const user=window.SD_USERS.find(item=>item.username.toLowerCase()===username.trim().toLowerCase());
  if(!user)return false;
  return (await passwordHash(password,user.salt,user.iterations))===user.hash;
}

function showApp(username){
  $("splash").hidden=true;
  $("login-screen").hidden=true;
  $("app-shell").hidden=false;
  $("logout").hidden=false;
  const user=window.SD_USERS?.find(item=>item.username.toLowerCase()===username.trim().toLowerCase());
  $("seller-name").textContent=user?.name||username;
  sessionStorage.setItem("sd-pruebas-session-user",username);
  renderAll();
  showScreen("home");
  resetIdleTimer();
}

function showLogin(){
  clearTimeout(idleTimer);
  if (typeof lockStorage === "function") lockStorage();
  if (typeof window.sdStopStoreScanner === "function") window.sdStopStoreScanner();
  sessionStorage.removeItem("sd-pruebas-session-user");
  $("app-shell").hidden=true;
  $("logout").hidden=true;
  $("splash").hidden=true;
  $("login-screen").hidden=false;
  $("password").value="";
  $("username").focus();
}

$("login-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const username=$("username").value.trim();
  const password=$("password").value;
  const button=$("login-button");
  const error=$("login-error");
  let storageUnlocked=false;
  button.disabled=true;
  button.textContent="Validando…";
  error.hidden=true;
  try{
    if(await validateLogin(username,password)){
      await initDeviceStorage();
      storageUnlocked=true;
      showApp(username);
    }
        else{
      error.hidden=false;
      $("password").value="";
      $("password").focus();
    }
  }catch(err){
    error.textContent=err.message || "No se pudieron abrir los datos locales.";
    error.hidden=false;
    console.error("No se pudo abrir el almacenamiento local.",err);
  }finally{
    if(!storageUnlocked&&typeof lockStorage==="function")lockStorage();
      button.disabled=false;
    button.textContent="Ingresar";
  }
});
