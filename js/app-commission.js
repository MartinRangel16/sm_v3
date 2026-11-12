function getCommissionSold(){
  const sold=Object.fromEntries(INVENTORY_PRODUCTS().map(product=>[product,0]));
  sales().forEach(note=>(note.lines||[]).forEach(line=>{if(sold[line.product]!==undefined)sold[line.product]+=Number(line.quantity)||0;}));
  return sold;
}
function getCommissionReceived(){
  const received=Object.fromEntries(INVENTORY_PRODUCTS().map(product=>[product,0]));
  entries().forEach(record=>(record.lines||[]).forEach(line=>{if(received[line.product]!==undefined)received[line.product]+=Number(line.quantity)||0;}));
  return received;
}
function renderCommission(){
  const config=commissionConfig();
  const rateInput=$("commission-rate");if(rateInput&&document.activeElement!==rateInput)rateInput.value=String(Number(config.rate)||0);
  const dateInput=$("commission-date");if(dateInput&&!dateInput.value)dateInput.value=new Date().toISOString().slice(0,10);
  const sold=getCommissionSold(),received=getCommissionReceived();
  const tbody=$("commission-product-rows");if(!tbody)return;tbody.replaceChildren();
  INVENTORY_PRODUCTS().forEach((product,i)=>{
    const tr=document.createElement("tr");
    const name=document.createElement("td");name.textContent=product;name.dataset.label="Producto";
    const initialCell=document.createElement("td");initialCell.dataset.label="Existencia inicial";const initial=document.createElement("input");initial.type="number";initial.min="0";initial.step="1";initial.value=String(received[product]||0);initial.readOnly=true;initial.title="Se llena automáticamente con las entradas de mercancía registradas";initial.className="quantity-input";initial.dataset.initialProduct=product;initial.setAttribute("aria-label",`Existencia inicial de ${product}`);initialCell.append(initial);
    const soldCell=document.createElement("td");soldCell.dataset.label="Ventas (pzas.)";soldCell.textContent=String(sold[product]);
    const finalCell=document.createElement("td");finalCell.dataset.label="Existencia final";const finalInput=document.createElement("input");finalInput.type="number";finalInput.min="0";finalInput.step="1";finalInput.value="0";finalInput.className="quantity-input";finalInput.dataset.finalProduct=product;finalInput.setAttribute("aria-label",`Existencia final de ${product}`);finalCell.append(finalInput);
    const diff=document.createElement("td");diff.dataset.label="Diferencia de inventario";diff.id=`commission-diff-${i}`;diff.textContent="Correcto";
    const valueCell=document.createElement("td");valueCell.dataset.label="Valor del faltante";valueCell.id=`commission-missing-value-${i}`;valueCell.textContent=money(0);
    const reasonCell=document.createElement("td");reasonCell.dataset.label="Motivo / observación";const reason=document.createElement("input");reason.type="text";reason.maxLength=240;reason.placeholder="Explica el faltante o sobrante (opcional)";reason.dataset.missingReason=product;reason.setAttribute("aria-label",`Motivo u observación de inventario de ${product}`);reasonCell.append(reason);
    [initial,finalInput].forEach(input=>input.addEventListener("input",calculateCommissionCloseout));
    reason.addEventListener("input",calculateCommissionCloseout);
    tr.append(name,initialCell,soldCell,finalCell,diff,valueCell,reasonCell);tbody.append(tr);
  });
  ["commission-cash","commission-deposits","commission-date","commission-rate"].forEach(id=>{const field=$(id);if(field)field.oninput=calculateCommissionCloseout;});
  renderClosings();calculateCommissionCloseout();
}
function calculateCommissionCloseout(){
  const config=commissionConfig(),sold=getCommissionSold(),received=getCommissionReceived();
  const notes=sales();const amount=notes.reduce((sum,note)=>sum+(Number(note.total)||0),0);
  const rateInput=$("commission-rate");const rate=rateInput&&rateInput.value!==""?Number(rateInput.value):(Number(config.rate)||0);
  const commission=amount*(Number.isFinite(rate)?rate:0)/100;
  const cash=Math.max(0,Number($("commission-cash")?.value)||0),deposits=Math.max(0,Number($("commission-deposits")?.value)||0),delivered=cash+deposits;
  let soldCount=0,inventoryDifference=0,missingValueTotal=0;
  const currentPrices=inventoryPrices();
  INVENTORY_PRODUCTS().forEach((product,i)=>{
    soldCount+=sold[product];
    const initial=Math.max(0,Math.floor(Number(document.querySelector(`[data-initial-product="${CSS.escape(product)}"]`)?.value)||0));
    const finalQty=Math.max(0,Math.floor(Number(document.querySelector(`[data-final-product="${CSS.escape(product)}"]`)?.value)||0));
    // La entrada registrada ES la existencia inicial; no se suma por segunda vez.
    const diff=initial-sold[product]-finalQty;inventoryDifference+=diff;
    const missing=Math.max(0,diff);
    const surplus=Math.max(0,-diff);
    const missingValue=missing*(Number(currentPrices[product])||0);missingValueTotal+=missingValue;
    const cell=$(`commission-diff-${i}`);
    if(cell){
      cell.textContent=missing>0?`Faltan ${missing}`:surplus>0?`Sobran ${surplus}`:"Correcto";
      cell.dataset.status=missing>0?"missing":surplus>0?"surplus":"balanced";
      cell.setAttribute("aria-label",missing>0?`${missing} piezas faltantes`:surplus>0?`${surplus} piezas sobrantes`:"Inventario correcto");
    }
    const valueCell=$(`commission-missing-value-${i}`);if(valueCell)valueCell.textContent=money(missingValue);
    const reasonInput=document.querySelector(`[data-missing-reason="${CSS.escape(product)}"]`);
    if(reasonInput){reasonInput.required=diff>0;reasonInput.placeholder=diff>0?`Explica las ${diff} piezas faltantes`:surplus>0?`Hay ${surplus} piezas sobrantes (observación opcional)`:"Sin diferencias (observación opcional)";reasonInput.setAttribute("aria-invalid",diff>0&&!reasonInput.value.trim()?"true":"false");}
  });
  $("commission-sales-total").textContent=money(amount);
  $("commission-delivered-total").textContent=money(delivered);
  $("commission-money-difference").textContent=money(amount-delivered);
  $("commission-total").textContent=money(commission);
  $("commission-sold").textContent=String(soldCount);
  $("commission-inventory-difference").textContent=String(inventoryDifference);
  $("commission-missing-value-total").textContent=money(missingValueTotal);
  return {date:$("commission-date")?.value||new Date().toISOString().slice(0,10),rate:Number.isFinite(rate)?rate:0,salesAmount:amount,cash,deposits,delivered,moneyDifference:Math.round((amount-delivered)*100)/100,commission:Math.round(commission*100)/100,inventoryDifference,missingValueTotal:Math.round(missingValueTotal*100)/100,products:INVENTORY_PRODUCTS().map(product=>{const initial=Math.max(0,Math.floor(Number(document.querySelector(`[data-initial-product="${CSS.escape(product)}"]`)?.value)||0));const final=Math.max(0,Math.floor(Number(document.querySelector(`[data-final-product="${CSS.escape(product)}"]`)?.value)||0));const difference=initial-sold[product]-final;const missing=Math.max(0,difference);const surplus=Math.max(0,-difference);const unitPrice=Number(currentPrices[product])||0;return {product,initial,sold:sold[product],final,difference,missing,surplus,unitPrice,missingValue:Math.round(missing*unitPrice*100)/100,missingReason:document.querySelector(`[data-missing-reason="${CSS.escape(product)}"]`)?.value.trim()||""}}),reference:$("commission-reference")?.value.trim()||"",createdAt:new Date().toISOString()};
}
function renderClosings(){
  const list=$("commission-closings-list");if(!list)return;list.replaceChildren();const records=closings().slice().reverse();
  if(!records.length){list.textContent="Todavía no hay cierres guardados.";return;}
  records.forEach(record=>{const card=document.createElement("article");card.className="sale";const title=document.createElement("h3");title.textContent=`Cierre · ${new Date(record.date+"T12:00:00").toLocaleDateString("es-MX")}`;const detail=document.createElement("p");detail.textContent=`Ventas: ${money(record.salesAmount)} · Efectivo: ${money(record.cash)} · Depósitos: ${money(record.deposits)} · Comisión: ${money(record.commission)}`;const difference=document.createElement("p");difference.textContent=`Diferencia de dinero (ventas menos entregas): ${money(record.moneyDifference)} · Diferencia de inventario: ${record.inventoryDifference} piezas · Valor estimado de faltantes: ${money(record.missingValueTotal||0)}. La comisión se muestra por separado y no se descuenta automáticamente.`;const reasons=document.createElement("p");const productRows=record.products||[];const missingItems=productRows.filter(item=>item.missing>0);const surplusItems=productRows.filter(item=>(item.surplus||0)>0);const missingText=missingItems.length?"Faltantes: "+missingItems.map(item=>`${item.product}: ${item.missing} pzas. (${money(item.missingValue||0)}) — ${item.missingReason||"Sin motivo registrado"}`).join("; "):"Sin faltantes";const surplusText=surplusItems.length?"Sobrantes: "+surplusItems.map(item=>`${item.product}: ${item.surplus} pzas.`).join("; "):"Sin sobrantes";reasons.textContent=`${missingText}. ${surplusText}.`;const reference=document.createElement("p");reference.className="muted";reference.textContent=record.reference||"Sin referencia";card.append(title,detail,difference,reasons,reference);list.append(card);});
}

$("commission-save-closeout")?.addEventListener("click", async event => {
  const button = event.currentTarget;

  if (button.disabled) return;

  const closeout = calculateCommissionCloseout();

  if (!closeout.date) {
    notice("closeout-notice", "Selecciona la fecha del cierre.");
    return;
  }

  if (
    !Number.isFinite(closeout.rate) ||
    closeout.rate < 0 ||
    closeout.rate > 100
  ) {
    notice("closeout-notice", "El porcentaje debe estar entre 0 y 100.");
    return;
  }

  const missingWithoutReason = closeout.products.filter(
    item => item.missing > 0 && !item.missingReason
  );

  if (missingWithoutReason.length) {
    notice(
      "closeout-notice",
      `Debes explicar el faltante de: ${missingWithoutReason
        .map(item => `${item.product} (${item.missing} pzas.)`)
        .join(", ")}.`
    );

    document.querySelector(
      `[data-missing-reason="${CSS.escape(missingWithoutReason[0].product)}"]`
    )?.focus();

    return;
  }

  button.disabled = true;

  try {
    const all = closings();

    all.push({
      id: newId(),
      ...closeout,
      seller: sessionStorage.getItem("sd-pruebas-session-user") || ""
    });

    await write(KEYS.closings, all);

    renderClosings();

    notice(
      "closeout-notice",
      "Cierre guardado. La comisión calculada quedó registrada."
    );
  } catch (err) {
    console.error("Error al guardar el cierre:", err);

    notice(
      "closeout-notice",
      "No se pudo confirmar el guardado del cierre. Revisa la consola antes de volver a intentarlo."
    );
  } finally {
    button.disabled = false;
  }
});


