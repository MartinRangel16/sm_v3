// Navegación entre las pantallas que ya fueron cargadas en index.html.
function showScreen(name){
  if (typeof window.sdStopStoreScanner === "function") window.sdStopStoreScanner();
  $("app-shell").classList.toggle("home-active", name === "home");
  document.querySelectorAll(".view-screen").forEach(el=>el.hidden=el.id!==`screen-${name}`);
  document.querySelectorAll("[data-screen]").forEach(el=>el.classList.toggle("active",el.dataset.screen===name));
  if(name==="home"&&typeof renderBackupStatus==="function")renderBackupStatus();
  if(name==="sale")prepareSale();
  if(name==="cash-sale")prepareCashSale();
  if(name==="stores")renderStores();
  if(name==="prices")renderPrices();
  if(name==="history")renderHistory();
  if(name==="entries")renderEntries();
  if(name==="commission")renderCommission();
  window.scrollTo({top:0,behavior:"instant"});
}

document.querySelectorAll("[data-screen]").forEach(button=>{
  button.addEventListener("click",()=>showScreen(button.dataset.screen));
});
