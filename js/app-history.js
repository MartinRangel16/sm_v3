function renderHistory(){
  const container=$("sales-history");
  if(!container)return;
  container.replaceChildren();
  const all=sales().slice().reverse();
  const query=$("history-filter")?.value.trim().toLocaleLowerCase("es-MX")||"";
  const list=query?all.filter(note=>[
    note.storeName,note.storeNumber,note.storeCode,note.dateLabel,note.date,note.seller,note.sellerName,note.type,
    ...(note.lines||[]).map(line=>line.product)
  ].some(value=>String(value||"").toLocaleLowerCase("es-MX").includes(query))):all;
  const count=$("history-result-count");
  if(count)count.textContent=query?`${list.length} de ${all.length} nota(s)`: `${all.length} nota(s)`;

  if(!list.length){
    const p=document.createElement("p");
    p.className="muted";
    p.textContent=all.length?"No hay notas que coincidan con la búsqueda.":"Todavía no hay notas guardadas.";
    container.append(p);
  }

  list.forEach(note=>{
    const card=document.createElement("article");
    card.className="sale history-sale-card";

    const row=document.createElement("div");
    row.className="history-note-row";
    const info=document.createElement("div");
    info.className="history-note-info";
    const title=document.createElement("b");
    title.textContent=`${note.type === "Efectivo" ? "Efectivo" : "Crédito"} · Tienda ${note.storeNumber} · ${note.storeName}`;
    const meta=document.createElement("small");
    meta.textContent=`${note.dateLabel||note.date||""} · ${note.totalPieces||0} piezas · ${note.seller||""}`;
    info.append(title,meta);

    const amount=document.createElement("strong");
    amount.textContent=money(note.total);
    row.append(info,amount);
    card.append(row);

    const actions=document.createElement("div");
    actions.className="row-actions";

    const printButton=document.createElement("button");
    printButton.type="button";
    printButton.className="secondary history-print-ticket";
    printButton.textContent="Imprimir ticket";
    printButton.setAttribute("aria-label", `Imprimir ticket de la nota ${note.id || ""}`);
    printButton.addEventListener("click", () => {
      if (typeof printSaleNote === "function") {
        printSaleNote(note, "thermal");
      } else {
        notice("history-notice", "La función de impresión no está disponible.");
      }
    });

    const detailButton=document.createElement("button");
    detailButton.type="button";
    detailButton.className="secondary";
    detailButton.textContent="Ver detalle";

    const editButton=document.createElement("button");
    editButton.type="button";
    editButton.textContent="Editar";

    const detail=document.createElement("div");
    detail.className="history-detail";
    detail.hidden=true;

    const detailText=document.createElement("p");
    detailText.className="muted";
    detailText.textContent=(note.lines||[]).map(x=>`${x.product}: ${x.quantity} pzas. · Devoluciones ${Number(x.returnsPieces)||0} pzas. · Subtotal ${money(x.subtotal)}`).join(" · ");
    detail.append(detailText);
    const returnsText=document.createElement("p");
    returnsText.className="muted";
    returnsText.textContent=`Subtotal: ${money(note.subtotal ?? note.total)} · Piezas devueltas: ${(note.lines||[]).reduce((sum,line)=>sum+(Number(line.returnsPieces)||0),0)} · Total: ${money(note.total)}`;
    detail.append(returnsText);

    detailButton.addEventListener("click",()=>{
      detail.hidden=!detail.hidden;
      detailButton.textContent=detail.hidden?"Ver detalle":"Ocultar detalle";
    });

    const editArea=document.createElement("div");
    editArea.className="history-edit-area";
    editArea.hidden=true;

    editButton.addEventListener("click",()=>{
      if(!editArea.hidden){
        editArea.hidden=true;
        editButton.textContent="Editar";
        return;
      }

      editArea.replaceChildren();
      const form=document.createElement("form");
      form.className="history-edit-form";

      const heading=document.createElement("h3");
      heading.textContent="Editar nota de venta";
      form.append(heading);

      const storeLabel=document.createElement("label");
      storeLabel.textContent="Tienda";
      storeLabel.htmlFor=`edit-store-${note.id}`;

      const storeSelect=document.createElement("select");
      storeSelect.id=storeLabel.htmlFor;
      storeSelect.required=true;

      const availableStores=stores();
      const noteStoreIdentifier=String(note.storeCode || note.storeNumber);
      const matchingHistoricalStore=availableStores.find(s=>[s.code,s.number,s.legacyNumber].some(value=>String(value||"").toLowerCase()===noteStoreIdentifier.toLowerCase()));
      const selectedInitialCode=matchingHistoricalStore ? String(matchingHistoricalStore.code || matchingHistoricalStore.number) : noteStoreIdentifier;
      if(!matchingHistoricalStore){
        const oldOption=document.createElement("option");
        oldOption.value=noteStoreIdentifier;
        oldOption.textContent=`${noteStoreIdentifier} · ${note.storeName} (guardada en la nota)`;
        storeSelect.append(oldOption);
      }
      availableStores.forEach(s=>{
        const option=document.createElement("option");
        option.value=String(s.code || s.number);
        option.textContent=`${s.code || s.number} · ${s.name}`;
        storeSelect.append(option);
      });
      storeSelect.value=selectedInitialCode;
      form.append(storeLabel,storeSelect);

      const productsHeading=document.createElement("h4");
      productsHeading.textContent="Cantidades por producto";
      form.append(productsHeading);

      const quantityInputs={};
      const returnInputs={};
      const oldLines=Array.isArray(note.lines)?note.lines:[];
      const oldLineByProduct=Object.fromEntries(oldLines.map(line=>[line.product,line]));
      const editableProducts = note.type === "Efectivo"
        ? cashProductDefinitions().map(item => item.name)
        : PRODUCTS;
      editableProducts.forEach(product=>{
        const wrap=document.createElement("div");
        wrap.className="history-edit-product";
        const label=document.createElement("label");
        label.textContent=product;
        label.htmlFor=`edit-${String(note.id).replace(/[^a-zA-Z0-9_-]/g,"")}-${editableProducts.indexOf(product)}`;
        const input=document.createElement("input");
        input.id=label.htmlFor;
        input.type="number";
        input.min="0";
        input.step="1";
        input.inputMode="numeric";
        input.value=String(Math.max(0,Math.floor(Number(oldLineByProduct[product]?.quantity)||0)));
        input.setAttribute("aria-label",`Piezas de ${product}`);
        quantityInputs[product]=input;
        const returnLabel=document.createElement("label");
        returnLabel.textContent="Devoluciones (piezas)";
        const returnInput=document.createElement("input");
        returnInput.type="number"; returnInput.min="0"; returnInput.step="1"; returnInput.inputMode="numeric";
        returnInput.value=String(Math.max(0,Math.floor(Number(oldLineByProduct[product]?.returnsPieces)||0)));
        returnInput.setAttribute("aria-label",`Devoluciones de ${product}`);
        returnInputs[product]=returnInput;
        wrap.append(label,input,returnLabel,returnInput);
        form.append(wrap);
      });

      const message=document.createElement("p");
      message.className="notice";
      message.hidden=true;
      message.setAttribute("role","status");
      form.append(message);

      const formActions=document.createElement("div");
      formActions.className="row-actions";
      const saveButton=document.createElement("button");
      saveButton.type="submit";
      saveButton.textContent="Guardar cambios";
      const cancelButton=document.createElement("button");
      cancelButton.type="button";
      cancelButton.className="secondary";
      cancelButton.textContent="Cancelar";
      cancelButton.addEventListener("click",()=>{
        editArea.hidden=true;
        editButton.textContent="Editar";
      });
      formActions.append(saveButton,cancelButton);
      form.append(formActions);

      form.addEventListener("submit", async event => {
        event.preventDefault();
        const selectedNumber=storeSelect.value;
        const selectedStore=availableStores.find(s=>String(s.code || s.number)===selectedNumber);
        const lines=[];

        for(const product of editableProducts){
          const raw=quantityInputs[product].value;
          const quantity=Number(raw);
          if(raw.trim()===""||!Number.isFinite(quantity)||quantity<0||!Number.isInteger(quantity)){
            message.textContent=`Revisa la cantidad de ${product}. Debe ser un número entero igual o mayor que cero.`;
            message.hidden=false;
            return;
          }
          const returnsPieces=Math.max(0,Math.floor(Number(returnInputs[product].value)||0));
          if(quantity>0 || returnsPieces>0){
            const oldLine=oldLineByProduct[product];
            const priceSource = note.type === "Efectivo" ? effectiveCashPrices() : prices();
            const cashDefinition = note.type === "Efectivo"
              ? cashProductDefinitions().find(item => item.name === product)
              : null;
            const priceKey = oldLine?.priceKey || cashDefinition?.priceKey || product;
            const productKey = oldLine?.productKey || cashDefinition?.key;
            const unitPrice=Number(oldLine?.unitPrice ?? priceSource[priceKey])||0;
            lines.push({product, ...(productKey ? { productKey } : {}), ...(note.type === "Efectivo" ? { priceKey } : {}), quantity,unitPrice,returnsPieces,subtotal:Math.round(quantity*unitPrice*100)/100});
          }
        }

        if(!lines.length){
          message.textContent="La nota debe contener al menos una pieza.";
          message.hidden=false;
          return;
        }

        const totalPieces=lines.reduce((sum,line)=>sum+line.quantity,0);
        const subtotal=Math.round(lines.reduce((sum,line)=>sum+line.subtotal,0)*100)/100;
        const total=subtotal;
        const updatedNote={
          ...note,
          ...(selectedStore?{
            storeId:selectedStore.id,
            storeCode:selectedStore.code || selectedStore.number,
            storeNumber:selectedStore.code || selectedStore.number,
            storeLegacyNumber:selectedStore.legacyNumber || "",
            storeName:selectedStore.name,
            storeAddress:selectedStore.address,
            storeResponsibleSeller:selectedStore.responsibleSeller || ""
          }:{}),
          lines,totalPieces,subtotal,total
        };

        

        saveButton.disabled = true;

        try {
          const all = sales();
          const index = all.findIndex(item => item.id === note.id);

          if (index < 0) {
            message.textContent =
              "No se encontró la nota original. No se guardaron cambios.";
            message.hidden = false;
            return;
          }

          all[index] = updatedNote;

          await write(KEYS.sales, all);

          renderAll();
          editArea.hidden = true;
          editButton.textContent = "Editar";
        } catch (err) {
          console.error("Error al actualizar la nota:", err);

          message.textContent =
            "No se pudieron confirmar los cambios. La nota original debe conservarse. Revisa la consola.";
          message.hidden = false;
        } finally {
          saveButton.disabled = false;
        }
      });


      editArea.append(form);
      editArea.hidden=false;
      editButton.textContent="Cerrar edición";
    });

    
    const deleteButton=document.createElement("button");
    deleteButton.type="button";
    deleteButton.className="danger small-button";
    deleteButton.textContent="Eliminar";

    
deleteButton.addEventListener("click", async () => {
  const confirmed = await askConfirm({ title: "Eliminar nota de venta", message: `Tienda ${note.storeName} · ${money(note.total)}. Esta acción no se puede deshacer.`, confirmLabel: "Eliminar", danger: true });

  if (!confirmed) return;

  const current = sales();
  const index = current.findIndex(item => item.id === note.id);

  if (index < 0) {
    alert("No se encontró la nota. No se eliminó nada.");
    return;
  }

  deleteButton.disabled = true;

  try {
    current.splice(index, 1);

    await write(KEYS.sales, current);

    renderAll();
  } catch (err) {
    console.error("Error al eliminar la nota de venta:", err);

    alert(
      "No se pudo confirmar la eliminación de la nota. Revisa la consola antes de volver a intentarlo."
    );
  } finally {
    deleteButton.disabled = false;
  }
});


    actions.append(printButton,detailButton,editButton,deleteButton);
    card.append(actions,detail,editArea);
    container.append(card);

  });

  $("home-sales-count").textContent=sales().length;
}

$("history-filter")?.addEventListener("input",renderHistory);


// Entrada de mercancía: registra cantidades recibidas por fecha.
let editingEntryId = null;
function resetEntryForm(){
  editingEntryId = null;
  const form=$("entry-form");
  if(form) form.reset();
  const date=$("entry-date");if(date)date.value=new Date().toISOString().slice(0,10);
  const submit=$("entry-form")?.querySelector('button[type="submit"]');if(submit)submit.textContent="Guardar entrada";
  const clear=$("entry-clear");if(clear)clear.textContent="Limpiar";
  const noticeEl=$("entry-notice");if(noticeEl)noticeEl.hidden=true;
}
function beginEditEntry(id){
  const record=entries().find(item=>String(item.id)===String(id));
  if(!record){notice("entry-notice","No se encontró esa entrada.");return;}
  editingEntryId=record.id;
  $("entry-date").value=record.date||new Date().toISOString().slice(0,10);
  $("entry-reference").value=record.reference||"";
  const quantities=Object.fromEntries((record.lines||[]).map(line=>[line.product,line.quantity]));
  INVENTORY_PRODUCTS().forEach(product=>{const input=document.querySelector(`[data-entry-product="${CSS.escape(product)}"]`);if(input)input.value=quantities[product]??"";});
  const submit=$("entry-form")?.querySelector('button[type="submit"]');if(submit)submit.textContent="Guardar cambios de entrada";
  const clear=$("entry-clear");if(clear)clear.textContent="Cancelar edición";
  notice("entry-notice","Editando entrada existente. Al guardar se actualizará el registro, no se duplicará.");
  $("entry-form").scrollIntoView({behavior:"smooth",block:"start"});
}
function renderEntries(){
  const date=$("entry-date");
  if(date&&!date.value)date.value=new Date().toISOString().slice(0,10);
  const tbody=$("entry-product-rows");if(!tbody)return;tbody.replaceChildren();
  INVENTORY_PRODUCTS().forEach(product=>{
    const tr=document.createElement("tr");
    const name=document.createElement("td");name.textContent=product;name.dataset.label="Producto";
    const cell=document.createElement("td");cell.dataset.label="Piezas recibidas";
    const input=document.createElement("input");input.type="number";input.min="0";input.step="1";input.inputMode="numeric";input.placeholder="0";input.value="";input.className="quantity-input";input.dataset.entryProduct=product;input.setAttribute("aria-label",`Piezas recibidas de ${product}`);
    cell.append(input);tr.append(name,cell);tbody.append(tr);
  });
  const list=$("entries-list");list.replaceChildren();
  const records=entries().slice().reverse();
  if(!records.length){list.textContent="Todavía no hay entradas de mercancía registradas.";return;}
  records.forEach(record=>{
    const card=document.createElement("article");card.className="sale";
    const title=document.createElement("h3");title.textContent=`Entrada · ${new Date(record.date+"T12:00:00").toLocaleDateString("es-MX")}`;
    const meta=document.createElement("p");meta.className="muted";meta.textContent=record.reference||"Sin referencia";
    const detail=document.createElement("p");detail.textContent=(record.lines||[]).map(line=>`${line.product}: ${line.quantity} pza.`).join(" · ");
    const total=document.createElement("b");total.textContent=`Total recibido: ${(record.lines||[]).reduce((sum,line)=>sum+line.quantity,0)} piezas`;
    const edit=document.createElement("button");edit.type="button";edit.className="secondary";edit.textContent="Modificar entrada";edit.addEventListener("click",()=>beginEditEntry(record.id));
    card.append(title,meta,detail,total,edit);list.append(card);
  });
}

const entryForm = $("entry-form");

if (entryForm) {
  entryForm.addEventListener("submit", async event => {
    event.preventDefault();

    const submitButton = entryForm.querySelector('[type="submit"]');

    if (submitButton?.disabled) return;

    const lines = [];

    INVENTORY_PRODUCTS().forEach(product => {
      const input = document.querySelector(
        `[data-entry-product="${CSS.escape(product)}"]`
      );

      const raw = input?.value || "0";
      const quantity = Number(raw);

      if (Number.isInteger(quantity) && quantity > 0) {
        lines.push({ product, quantity });
      }
    });

    if (!lines.length) {
      notice("entry-notice", "Captura al menos una cantidad recibida.");
      return;
    }

    const all = entries();
    const isEditing = editingEntryId !== null;

    if (isEditing) {
      const index = all.findIndex(
        item => String(item.id) === String(editingEntryId)
      );

      if (index < 0) {
        notice(
          "entry-notice",
          "No se encontró la entrada que intentas modificar. No se guardaron cambios."
        );
        return;
      }

      all[index] = {
        ...all[index],
        date: $("entry-date").value,
        reference: $("entry-reference").value.trim(),
        lines,
        updatedAt: new Date().toISOString()
      };
    } else {
      all.push({
        id: newId(),
        date: $("entry-date").value,
        reference: $("entry-reference").value.trim(),
        seller: sessionStorage.getItem("sd-pruebas-session-user") || "",
        lines,
        createdAt: new Date().toISOString()
      });
    }

    if (submitButton) submitButton.disabled = true;

    try {
      await write(KEYS.entries, all);

      resetEntryForm();

      notice(
        "entry-notice",
        isEditing
          ? "Entrada modificada correctamente."
          : "Entrada de mercancía guardada."
      );

      renderEntries();
      renderCommission();
    } catch (err) {
      console.error("Error al guardar la entrada:", err);

      notice(
        "entry-notice",
        "No se pudo confirmar el guardado de la entrada. Revisa la consola antes de volver a intentarlo."
      );
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

const entryClear=$("entry-clear");if(entryClear)entryClear.addEventListener("click",()=>{resetEntryForm();});

const commissionForm = $("commission-form");

if (commissionForm) {
  commissionForm.addEventListener("submit", async event => {
    event.preventDefault();

    const rateInput = $("commission-rate");
    const submitButton = commissionForm.querySelector('[type="submit"]');

    if (submitButton?.disabled) return;

    const rate = Number(rateInput?.value);

    if (
      !rateInput ||
      rateInput.value.trim() === "" ||
      !Number.isFinite(rate) ||
      rate < 0 ||
      rate > 100
    ) {
      notice(
        "commission-notice",
        "Ingresa un porcentaje válido entre 0 y 100."
      );
      return;
    }

    if (submitButton) submitButton.disabled = true;

    try {
      await write(KEYS.commission, { rate });

      notice(
        "commission-notice",
        `Porcentaje de comisión guardado: ${rate}%.`
      );

      calculateCommissionCloseout();
    } catch (err) {
      console.error("Error al guardar el porcentaje de comisión:", err);

      notice(
        "commission-notice",
        "No se pudo confirmar el guardado del porcentaje. Revisa la consola antes de volver a intentarlo."
      );
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

// Cierre de comisión: existencia inicial/final, ventas y entrega de dinero.
