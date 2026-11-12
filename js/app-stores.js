function storeSellerUsers() {
  return (window.SD_USERS || []).filter(user =>
    user?.username && user.role !== "admin" && user.active !== false
  );
}

function renderStoreSellerControls() {
  const responsible = $("store-responsible-seller");
  if (!responsible) return;

  responsible.replaceChildren();
  const users = storeSellerUsers();

  if (!users.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Primero registra usuarios vendedores";
    responsible.append(option);
    responsible.disabled = true;
    return;
  }

  responsible.disabled = false;

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecciona al responsable";
  responsible.append(placeholder);

  users.forEach(user => {
    const option = document.createElement("option");
    option.value = user.username;
    option.textContent = `${user.name || user.username} (${user.username})`;
    responsible.append(option);
  });
}

function resetStoreForm() {
  $("store-form").reset();
  $("store-edit-id").value = "";
  $("store-form-title").textContent = "Registrar tienda";
  $("store-save-button").textContent = "Guardar tienda y generar QR";
  $("store-cancel-edit").hidden = true;
  renderStoreSellerControls();
  const firstUser = storeSellerUsers()[0];
  if (firstUser) $("store-responsible-seller").value = firstUser.username;
}
resetStoreForm();

$("store-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = $("store-form");
  const submitButton = $("store-save-button");
  if (submitButton.disabled) return;
  const id = $("store-edit-id").value;
  const name = $("store-name").value.trim();
  const number = $("store-number").value.trim();
  const address = $("store-address").value.trim();
  if (!number) { notice("store-notice", "Captura el número de tienda."); return; }
  const duplicate = stores().find(store => String(store.number || store.code || "").toLowerCase() === number.toLowerCase() && store.id !== id);
  if (duplicate) { notice("store-notice", "Ese número de tienda ya está registrado."); return; }
  const responsibleSeller = $("store-responsible-seller").value;
  if (!responsibleSeller) { notice("store-notice", "Selecciona un vendedor responsable."); return; }
  // Todas las tiendas quedan disponibles para cualquier vendedor activo.
  const sellerAccess = "all";
  const authorizedSellers = [];
  const existing = stores().find(store => store.id === id);
  const recordData = {
    ...(existing || {}),
    name, number, code: number, legacyNumber: existing?.legacyNumber || "", address, responsibleSeller, sellerAccess, authorizedSellers,
    active: existing ? existing.active !== false : true,
    updatedAt: new Date().toISOString()
  };
  submitButton.disabled = true;
  try {
    if (id) {
      const updatedList = stores().map(store => store.id === id ? recordData : store);
      await write(KEYS.stores, updatedList);
    } else {
      recordData.createdAt = new Date().toISOString();
      const created = { ...recordData, id: newId(), createdAt: new Date().toISOString(), qrVersion: 1, active: true };
      await write(KEYS.stores, [...stores(), created]);
    }
    resetStoreForm();
    notice("store-notice", id ? "Tienda actualizada. Su QR conserva el número registrado." : "Tienda registrada con número y QR generado.");
    renderAll();
  } catch (error) {
    console.error("Error al guardar la tienda:", error);
    notice("store-notice", "No se pudo guardar la tienda. No vuelvas a enviar el formulario hasta revisar el estado.");
  } finally { submitButton.disabled = false; }
});

$("store-cancel-edit").addEventListener("click", resetStoreForm);

function printStoreLabel(store) {
  const root = document.createElement("section");
  root.id = "sd-store-label-print";
  root.className = "store-label-print";
  const label = document.createElement("div"); label.className = "store-label-card";
  const brand = document.createElement("strong"); brand.textContent = "SEMILLA DORADA";
  const subtitle = document.createElement("small"); subtitle.textContent = "IDENTIFICACIÓN DE ESTABLECIMIENTO";
  const qr = document.createElement("img"); qr.alt = `Código QR ${store.code}`; qr.src = SDQR.dataUrl(SDQR.payloadForStore(store.code), 8, 4);
  const name = document.createElement("b"); name.textContent = store.name;
  const code = document.createElement("span"); code.textContent = store.code;
  label.append(brand, subtitle, qr, name, code); root.append(label); document.body.append(root);
  window.print();
  root.remove();
}
function renderStores() {
  const container = $("stores-list");
  if (!container) return;
  container.replaceChildren();
  const list = stores();
  if ($("stores-count")) $("stores-count").textContent = String(list.length);
  if (!list.length) {
    const empty = document.createElement("p"); empty.className = "muted"; empty.textContent = "Todavía no hay tiendas registradas."; container.append(empty); return;
  }
  list.forEach(store => {
    const row = document.createElement("article"); row.className = "store-row store-record";
    const info = document.createElement("div"); info.className = "store-record-info";
    const title = document.createElement("b"); title.textContent = `${store.code || store.number} · ${store.name}`;
    const address = document.createElement("small"); address.textContent = store.address || "Sin dirección";
    const meta = document.createElement("small");
    meta.textContent = `Responsable: ${sellerDisplayName(store.responsibleSeller)} · Acceso: Todos los vendedores activos · Ventas a crédito y efectivo disponibles`;
    const state = document.createElement("span"); state.className = `store-state ${store.active === false ? "is-inactive" : "is-active"}`; state.textContent = store.active === false ? "DADA DE BAJA" : "ACTIVA";
    info.append(title, address, meta, state);
    const qrWrap = document.createElement("div"); qrWrap.className = "store-qr-preview";
    const qr = document.createElement("img"); qr.alt = `QR de ${store.name}`; qr.src = SDQR.dataUrl(SDQR.payloadForStore(store.code || store.number), 4, 4);
    const qrCaption = document.createElement("small"); qrCaption.textContent = "QR de tienda"; qrWrap.append(qr, qrCaption);
    const actions = document.createElement("div"); actions.className = "row-actions store-actions";
    const print = document.createElement("button"); print.type = "button"; print.className = "secondary small-button"; print.textContent = "Imprimir etiqueta"; print.addEventListener("click", () => printStoreLabel(store));
    const edit = document.createElement("button"); edit.type = "button"; edit.className = "secondary small-button"; edit.textContent = "Editar"; edit.addEventListener("click", () => {
      $("store-edit-id").value = store.id; $("store-number").value = store.number || store.code || ""; $("store-name").value = store.name; $("store-address").value = store.address;
      $("store-responsible-seller").value = store.responsibleSeller || "";
      renderStoreSellerControls();
      $("store-responsible-seller").value = store.responsibleSeller || "";
      $("store-form-title").textContent = `Editar tienda · ${store.code || store.number}`;
      $("store-save-button").textContent = "Guardar cambios"; $("store-cancel-edit").hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = store.active === false ? "secondary small-button" : "danger small-button"; toggle.textContent = store.active === false ? "Reactivar" : "Dar de baja";
    toggle.addEventListener("click", async () => {
      const nextActive = store.active === false;
      if (!await askConfirm({ title: nextActive ? "Reactivar tienda" : "Dar de baja tienda", message: `${store.code} · ${store.name}. El código y el historial se conservarán.`, confirmLabel: nextActive ? "Reactivar" : "Dar de baja", danger: !nextActive })) return;
      toggle.disabled = true;
      try { await write(KEYS.stores, stores().map(item => item.id === store.id ? { ...item, active: nextActive, updatedAt: new Date().toISOString() } : item)); renderAll(); }
      catch (error) { console.error(error); alert("No se pudo actualizar el estado de la tienda."); }
      finally { toggle.disabled = false; }
    });
    actions.append(print, edit, toggle); row.append(info, qrWrap, actions); container.append(row);
  });
}

function appendPriceRow(container, item, value, datasetName, index){
  const row=document.createElement("div");
  row.className="price-row";
  const label=document.createElement("label");
  label.textContent=item.name;
  label.htmlFor=`${datasetName}-${index}`;
  const wrap=document.createElement("div");
  wrap.className="price-input-wrap";
  const sign=document.createElement("span");
  sign.textContent="$";
  const input=document.createElement("input");
  input.id=label.htmlFor;
  input.type="number"; input.min="0"; input.step="0.01";
  input.inputMode="decimal"; input.required=true;
  input.value=Number(value||0).toFixed(2);
  input.dataset[datasetName]=item.priceKey;
  input.setAttribute("aria-label",`Precio por pieza de ${item.name}`);
  wrap.append(sign,input); row.append(label,wrap); container.append(row);
}

function renderPrices(){
  const creditContainer=$("credit-prices-list");
  const cashContainer=$("cash-prices-list");
  if(!creditContainer||!cashContainer)return;
  creditContainer.replaceChildren();
  cashContainer.replaceChildren();

  const creditConfigured=prices();
  PRODUCTS.forEach((name,index)=>{
    appendPriceRow(creditContainer,{name,priceKey:name},creditConfigured[name],"creditPriceKey",index);
  });

  const cashConfigured=effectiveCashPrices();
  cashProductDefinitions().forEach((item,index)=>{
    appendPriceRow(cashContainer,item,cashConfigured[item.priceKey],"cashPriceKey",index);
  });

  cashCatalog().others.forEach((slot,index)=>{
    const row=document.createElement("div");
    row.className="price-row cash-other-row";
    const label=document.createElement("label");
    label.textContent=`Espacio adicional ${index+1}`;
    label.htmlFor=`cash-price-other-${index}`;
    const fields=document.createElement("div");
    fields.className="cash-other-fields";
    const nameInput=document.createElement("input");
    nameInput.type="text"; nameInput.maxLength=60; nameInput.required=true;
    nameInput.value=slot.name||`OTROS ${index+1}`;
    nameInput.dataset.cashPriceOtherName=slot.key;
    nameInput.id=label.htmlFor;
    nameInput.setAttribute("aria-label",`Nombre del espacio OTROS ${index+1}`);
    const priceWrap=document.createElement("div");
    priceWrap.className="price-input-wrap";
    const sign=document.createElement("span"); sign.textContent="$";
    const priceInput=document.createElement("input");
    priceInput.type="number"; priceInput.min="0"; priceInput.step="0.01";
    priceInput.inputMode="decimal"; priceInput.required=true;
    priceInput.value=Number(cashConfigured[slot.key]||0).toFixed(2);
    priceInput.dataset.cashPriceKey=slot.key;
    priceInput.setAttribute("aria-label",`Precio por pieza de ${slot.name}`);
    priceWrap.append(sign,priceInput);
    fields.append(nameInput,priceWrap); row.append(label,fields); cashContainer.append(row);
  });
}

// Cambiar de lista no modifica ni guarda precios.
document.querySelectorAll("[data-price-tab]").forEach(button=>{
  button.addEventListener("click",()=>{
    const selected=button.dataset.priceTab;
    const isCredit=selected==="credit";
    $("credit-prices-panel").hidden=!isCredit;
    $("cash-prices-panel").hidden=isCredit;
    $("price-tab-credit").classList.toggle("active",isCredit);
    $("price-tab-cash").classList.toggle("active",!isCredit);
    $("price-tab-credit").setAttribute("aria-selected",String(isCredit));
    $("price-tab-cash").setAttribute("aria-selected",String(!isCredit));
  });
});

$("credit-prices-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const form=$("credit-prices-form");
  const button=form.querySelector('[type="submit"]');
  if(button?.disabled)return;
  const next={...prices()};
  let valid=true;
  form.querySelectorAll("[data-credit-price-key]").forEach(input=>{
    const value=Number(input.value);
    if(input.value.trim()===""||!Number.isFinite(value)||value<0)valid=false;
    else next[input.dataset.creditPriceKey]=Math.round(value*100)/100;
  });
  if(!valid){notice("credit-prices-notice","Todos los precios deben ser números iguales o mayores que cero.");return;}
  if(button)button.disabled=true;
  try{
    await write(KEYS.prices,next);
    notice("credit-prices-notice","Lista de crédito guardada. Los precios de efectivo no cambiaron.");
    renderProductRows(); updateSaleTotals(); renderCommission();
  }catch(error){
    console.error("Error al guardar precios de crédito:",error);
    notice("credit-prices-notice","No se pudo confirmar el guardado. Revisa la consola antes de volver a intentarlo.");
  }finally{if(button)button.disabled=false;}
});

$("cash-prices-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const form=$("cash-prices-form");
  const button=form.querySelector('[type="submit"]');
  if(button?.disabled)return;
  const nextCash={...cashPrices()};
  let valid=true;
  form.querySelectorAll("[data-cash-price-key]").forEach(input=>{
    const value=Number(input.value);
    if(input.value.trim()===""||!Number.isFinite(value)||value<0)valid=false;
    else nextCash[input.dataset.cashPriceKey]=Math.round(value*100)/100;
  });
  const oldCatalog=cashCatalog();
  const nextCatalog={others:oldCatalog.others.map(slot=>({...slot}))};
  form.querySelectorAll("[data-cash-price-other-name]").forEach(input=>{
    const slot=nextCatalog.others.find(item=>item.key===input.dataset.cashPriceOtherName);
    const nextName=input.value.trim();
    const duplicate=[...CASH_BASE_PRODUCTS,...nextCatalog.others.filter(item=>item.key!==input.dataset.cashPriceOtherName).map(item=>item.name)]
      .some(name=>String(name).trim().toLowerCase()===nextName.toLowerCase());
    if(!nextName||duplicate)valid=false;
    if(slot&&nextName!==slot.name&&productHasHistory(slot.name)){
      valid=false;
      notice("cash-prices-notice",`No se puede renombrar ${slot.name}: ya tiene movimientos. Conserva el nombre para proteger el historial.`);
    }
    if(slot)slot.name=nextName;
  });
  if(!valid){
    if($("cash-prices-notice").hidden)notice("cash-prices-notice","Revisa los nombres y precios. Los nombres deben ser únicos y los precios iguales o mayores que cero.");
    return;
  }
  if(button)button.disabled=true;
  try{
    await writeMany([[KEYS.cashPrices,nextCash],[KEYS.cashCatalog,nextCatalog]]);
    notice("cash-prices-notice","Lista de efectivo guardada. Los precios de crédito no cambiaron.");
    renderCashProductRows(); updateCashSaleTotals(); renderCommission();
  }catch(error){
    console.error("Error al guardar precios de efectivo:",error);
    notice("cash-prices-notice","No se pudo confirmar el guardado. Revisa la consola antes de volver a intentarlo.");
  }finally{if(button)button.disabled=false;}
});

