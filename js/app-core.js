function cashProductDefinitions(){
  const slots = cashCatalog().others || [];
  return [
    ...CASH_BASE_PRODUCTS.map(name => ({ key: name, name, priceKey: name })),
    ...slots.map(slot => ({
      key: slot.key,
      name: String(slot.name || slot.key),
      priceKey: slot.key
    }))
  ];
}
function INVENTORY_PRODUCTS(){
  return [...new Set([...PRODUCTS, ...CASH_BASE_PRODUCTS, ...cashProductDefinitions().slice(CASH_BASE_PRODUCTS.length).map(item => item.name)])];
}
// Una sola lista maestra: los precios de crédito conservan prioridad en los
// 11 productos compartidos; los exclusivos de efectivo conservan sus importes.
function unifiedPrices(){
  return { ...cashPrices(), ...prices() };
}
// Mantiene operativas las instalaciones anteriores: si un producto compartido
// todavía no tiene precio de efectivo configurado, inicia con el precio anterior.
// En cuanto se guarda la lista de efectivo, ambos importes quedan independientes.
function effectiveCashPrices(){
  const result = cashPrices();
  const credit = prices();
  PRODUCTS.forEach(name => {
    if (!(Number(result[name]) > 0) && Number(credit[name]) > 0) result[name] = Number(credit[name]);
  });
  return result;
}
function inventoryPrices(){
  const result = unifiedPrices();
  cashProductDefinitions().forEach(item => {
    result[item.name] = Number(result[item.priceKey]) || 0;
  });
  return result;
}
function productHasHistory(productName){
  const noteCollections = [...sales(), ...salesArchives().flatMap(archive => archive.notes || [])];
  const entryCollections = [...entries(), ...entriesArchives().flatMap(archive => archive.entries || [])];
  const closeoutHistory = closings().some(record => (record.products || []).some(item => item.product === productName));
  return noteCollections.some(note => (note.lines || []).some(line => line.product === productName))
    || entryCollections.some(record => (record.lines || []).some(line => line.product === productName))
    || closeoutHistory;
}
function renderAll(){
  renderHome();
  renderStores();
  renderPrices();
  renderHistory();
  if($("entries-list"))renderEntries();
  if($("sales-archives-list"))renderSalesArchives();
  if($("entry-archives-list"))renderEntryArchives();
  if($("commission-total"))renderCommission();
}

function renderSalesArchives(){
  const container = $("sales-archives-list");
  if(!container) return;

  container.replaceChildren();

  const archives = salesArchives().slice().reverse();

  if(!archives.length){
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Todavía no hay semanas con ventas archivadas.";
    container.append(p);
    return;
  }

  archives.forEach(archive => {
    const card = document.createElement("article");
    card.className = "sale";

    const title = document.createElement("h3");
    title.textContent = `Semana cerrada · ${archive.closedDate || archive.closedAt || "Fecha no disponible"}`;

    const summary = document.createElement("p");
    summary.textContent =
      `${archive.count || 0} notas · Total vendido: ${money(archive.total || 0)}`;

    const list = document.createElement("div");
    list.hidden = true;

    (archive.notes || []).forEach(note => {
      const noteCard = document.createElement("section");
      noteCard.className = "history-detail";

      const heading = document.createElement("h4");
      heading.textContent =
        `Tienda ${note.storeNumber || ""} · ${note.storeName || "Sin nombre"}`;

      const meta = document.createElement("p");
      meta.className = "muted";
      meta.textContent =
        `${note.type || "Crédito"} · ${note.dateLabel || note.date || ""} · ${note.totalPieces || 0} piezas · ${note.seller || ""}`;

      const details = document.createElement("p");
      details.textContent = (note.lines || []).map(line =>
        `${line.product}: ${line.quantity} pza. × ${money(line.unitPrice || 0)} = ${money(line.subtotal || 0)}`
      ).join(" · ");

      const total = document.createElement("strong");
      total.textContent = `Total de la nota: ${money(note.total || 0)}`;

      noteCard.append(heading, meta, details, total);
      list.append(noteCard);
    });

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "secondary";
    toggle.textContent = "Ver notas de esta semana";

    toggle.addEventListener("click", () => {
      list.hidden = !list.hidden;
      toggle.textContent = list.hidden
        ? "Ver notas de esta semana"
        : "Ocultar notas";
    });

    card.append(title, summary, toggle, list);
    container.append(card);
  });
}

function renderEntryArchives(){
  const container = $("entry-archives-list");
  if(!container) return;

  container.replaceChildren();

  const archives = entriesArchives().slice().reverse();

  if(!archives.length){
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Todavía no hay entradas de mercancía archivadas.";
    container.append(p);
    return;
  }

  archives.forEach(archive => {
    const card = document.createElement("article");
    card.className = "sale";

    const title = document.createElement("h3");
    title.textContent =
      `Semana cerrada · ${archive.closedDate || archive.closedAt || "Fecha no disponible"}`;

    const summary = document.createElement("p");
    summary.textContent =
      `${archive.count || 0} entradas · Total recibido: ${archive.totalPieces || 0} piezas`;

    const list = document.createElement("div");
    list.hidden = true;

    (archive.entries || []).forEach(entry => {
      const entryCard = document.createElement("section");
      entryCard.className = "history-detail";

      const heading = document.createElement("h4");
      heading.textContent =
        `Entrada · ${entry.date ? new Date(entry.date + "T12:00:00").toLocaleDateString("es-MX") : "Fecha no disponible"}`;

      const reference = document.createElement("p");
      reference.className = "muted";
      reference.textContent =
        `Referencia: ${entry.reference || "Sin referencia"} · Vendedor: ${entry.seller || "No indicado"}`;

      const details = document.createElement("p");
      details.textContent = (entry.lines || []).map(line =>
        `${line.product}: ${line.quantity} pza.`
      ).join(" · ");

      const total = document.createElement("strong");
      total.textContent =
        `Total recibido: ${(entry.lines || []).reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)} piezas`;

      entryCard.append(heading, reference, details, total);
      list.append(entryCard);
    });

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "secondary";
    toggle.textContent = "Ver entradas de esta semana";

    toggle.addEventListener("click", () => {
      list.hidden = !list.hidden;
      toggle.textContent = list.hidden
        ? "Ver entradas de esta semana"
        : "Ocultar entradas";
    });

    card.append(title, summary, toggle, list);
    container.append(card);
  });
}

function renderHome(){
  const allNotes=sales();
  $("home-sales-count").textContent=allNotes.length;
  $("home-sales-total").textContent=money(roundMoney(allNotes.reduce((sum,note)=>sum+(Number(note.total)||0),0)));
  $("home-stores-count").textContent=stores().filter(store=>store.active!==false).length;
  $("home-entries-count").textContent=entries().length;
  const recent=$("home-recent-sales");
  if(!recent)return;
  recent.replaceChildren();
  const latest=allNotes.slice().sort((left,right)=>
    new Date(right.date||right.createdAt||0)-new Date(left.date||left.createdAt||0)
  ).slice(0,6);
  if(!latest.length){
    const empty=document.createElement("p");
    empty.className="muted";
    empty.textContent="Todavía no hay notas registradas. Las ventas a crédito y en efectivo aparecerán aquí.";
    recent.append(empty);
  }else{
    latest.forEach(note=>{
      const item=document.createElement("article");
      item.className="home-recent-sale";
      const info=document.createElement("div");
      const title=document.createElement("strong");
      title.textContent=`${note.type==="Efectivo"?"Efectivo":"Crédito"} · Tienda ${note.storeNumber||""} · ${note.storeName||"Sin nombre"}`;
      const meta=document.createElement("small");
      meta.textContent=`${note.dateLabel||(note.date?new Date(note.date).toLocaleString("es-MX"):"")} · ${note.totalPieces||0} piezas`;
      info.append(title,meta);
      const total=document.createElement("strong");
      total.className="home-recent-total";
      total.textContent=money(note.total||0);
      item.append(info,total);
      recent.append(item);
    });
  }
  const viewHistory=document.createElement("button");
  viewHistory.type="button";
  viewHistory.className="secondary";
  viewHistory.textContent="Ver historial completo";
  viewHistory.addEventListener("click",()=>showScreen("history"));
  recent.append(viewHistory);
}
function prepareSale(){
  const today = new Date();
  $("sale-date").textContent = today.toLocaleDateString("es-MX");
  const datalist = $("store-options");
  datalist.replaceChildren();
  stores().filter(store => store.active !== false).forEach(store => {
    const option = document.createElement("option");
    option.value = store.code || store.number;
    option.label = store.name;
    datalist.append(option);
  });
  renderProductRows();
  updateStoreAutofill();
  updateSaleTotals();
}

function renderProductRows(){
  const tbody=$("sale-product-rows");
  tbody.replaceChildren();
  const currentPrices=prices();
  PRODUCTS.forEach((name,i)=>{
    const tr=document.createElement("tr");
    const product=document.createElement("td");
    product.textContent=name;
    const qtyCell=document.createElement("td");
    const input=document.createElement("input");
    input.type="number";
    input.min="0";
    input.step="1";
    input.inputMode="numeric";
    input.addEventListener("focus", () => {
    input.select();
    });
    input.placeholder="0";
    input.value="";
    input.setAttribute("aria-label",`Piezas de ${name}`);
    input.dataset.product=name;
    input.className="quantity-input";
    input.addEventListener("input",updateSaleTotals);
    qtyCell.append(input);
    const sub=document.createElement("td");
    sub.className="subtotal-cell";
    sub.id=`subtotal-${i}`;
    sub.textContent=money(0);
    tr.append(product,qtyCell,sub);
    tbody.append(tr);
  });
}
function updateSaleTotals(){
  let pieceCount=0,total=0;
  const p=prices();
  PRODUCTS.forEach((name,i)=>{
    const input=document.querySelector(`.quantity-input[data-product="${CSS.escape(name)}"]`);
    const qty=Math.max(0,Math.floor(Number(input?.value)||0));
    pieceCount+=qty;
    const subtotal=qty*(Number(p[name])||0);
    total+=subtotal;
    const cell=$(`subtotal-${i}`);
    if(cell)cell.textContent=money(subtotal);
  });
  $("sale-total-pieces").textContent=pieceCount;
  const returnsAmount = Math.max(0, Number($("sale-returns")?.value) || 0);
  $("sale-total-amount").textContent=money(total + returnsAmount);
}

function prepareCashSale(){
  const today = new Date();
  const date = $("cash-sale-date");
  if (date) date.textContent = today.toLocaleDateString("es-MX");
  const datalist = $("cash-store-options");
  if (datalist) {
    datalist.replaceChildren();
    stores().filter(store => store.active !== false).forEach(store => {
      const option = document.createElement("option");
      option.value = store.code || store.number;
      option.label = store.name;
      datalist.append(option);
    });
  }
  renderCashProductRows();
  updateCashStoreAutofill();
  updateCashSaleTotals();
}

function renderCashProductRows(){
  const tbody = $("cash-sale-product-rows");
  if(!tbody) return;
  tbody.replaceChildren();
  const currentPrices = effectiveCashPrices();
  cashProductDefinitions().forEach((item, index) => {
    const tr = document.createElement("tr");
    const product = document.createElement("td");
    product.textContent = item.name;
    const qtyCell = document.createElement("td");
    const input = document.createElement("input");
    input.type = "number"; input.min = "0"; input.step = "1";
    input.inputMode = "numeric";
    input.placeholder = "0"; input.value = "";
    input.className = "quantity-input";
    input.dataset.cashProductKey = item.key;
    input.dataset.cashProductName = item.name;
    input.setAttribute("aria-label", `Piezas de ${item.name}`);
    input.addEventListener("focus", () => input.select());
    input.addEventListener("input", updateCashSaleTotals);
    qtyCell.append(input);
    const subtotal = document.createElement("td");
    subtotal.className = "subtotal-cell";
    subtotal.id = `cash-subtotal-${index}`;
    subtotal.textContent = money(0);
    tr.append(product, qtyCell, subtotal);
    tbody.append(tr);
  });
}
function updateCashSaleTotals(){
  let pieces = 0, total = 0;
  const pricesNow = effectiveCashPrices();
  cashProductDefinitions().forEach((item, index) => {
    const input = document.querySelector(`[data-cash-product-key="${CSS.escape(item.key)}"]`);
    const quantity = Math.max(0, Math.floor(Number(input?.value) || 0));
    const subtotal = quantity * (Number(pricesNow[item.priceKey]) || 0);
    pieces += quantity; total += subtotal;
    const cell = $(`cash-subtotal-${index}`);
    if(cell) cell.textContent = money(subtotal);
  });
  $("cash-sale-total-pieces").textContent = String(pieces);
  const returnsAmount = Math.max(0, Number($("cash-sale-returns")?.value) || 0);
  $("cash-sale-total-amount").textContent = money(total + returnsAmount);
}
function findStoreByCode(identifier) {
  const value = String(identifier || "").trim().toLowerCase();
  if (!value) return null;
  return stores().find(store => [store.code, store.number, store.legacyNumber]
    .some(candidate => String(candidate || "").trim().toLowerCase() === value)) || null;
}
function currentSellerUsername() {
  return sessionStorage.getItem("sd-pruebas-session-user") || "";
}
function currentSellerName(username = currentSellerUsername()) {
  const user = (window.SD_USERS || []).find(item => item.username === username);
  return user?.name || username || "";
}
function storeAccessError(store, mode) {
  if (!store) return "No encontramos esa tienda. Escanea su QR o registra el establecimiento.";
  if (store.active === false) return "Esta tienda está dada de baja y no admite nuevas ventas.";
  return "";
}
function updateStoreSelection(mode) {
  const prefix = mode === "cash" ? "cash" : "sale";
  const input = $(`${prefix}-store-number`);
  const name = $(`${prefix}-store-name`);
  const status = $(`${prefix}-store-status`);
  const store = findStoreByCode(input?.value);
  const error = storeAccessError(store, mode);
  if (name) name.value = store?.name || "";
  if (status) {
    status.textContent = store ? (error || `Tienda identificada · ${store.code || store.number} · Responsable: ${sellerDisplayName(store.responsibleSeller)}`) : (input?.value ? error : "Escanea el QR de la tienda o introduce su número.");
    status.classList.toggle("is-error", !!error);
    status.classList.toggle("is-valid", !!store && !error);
  }
  return { store, error };
}
function sellerDisplayName(username) {
  const user = (window.SD_USERS || []).find(item => item.username === username);
  return user?.name || username || "Sin asignar";
}
function updateCashStoreAutofill(){ updateStoreSelection("cash"); }
function updateStoreAutofill(){ updateStoreSelection("credit"); }
$("cash-store-number")?.addEventListener("input", updateCashStoreAutofill);
$("cash-store-number")?.addEventListener("change", updateCashStoreAutofill);
$("sale-store-number")?.addEventListener("input", updateStoreAutofill);
$("sale-store-number")?.addEventListener("change", updateStoreAutofill);


$("sale-returns")?.addEventListener("input", updateSaleTotals);
$("cash-sale-returns")?.addEventListener("input", updateCashSaleTotals);
