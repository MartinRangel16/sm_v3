let activeStoreScanner = null;
function stopStoreScanner() {
  if (!activeStoreScanner) return;
  activeStoreScanner.active = false;
  activeStoreScanner.stream?.getTracks().forEach(track => track.stop());
  if (activeStoreScanner.video) {
    activeStoreScanner.video.pause();
    activeStoreScanner.video.srcObject = null;
    activeStoreScanner.video.hidden = true;
  }
  if (activeStoreScanner.stopButton) activeStoreScanner.stopButton.hidden = true;
  if (activeStoreScanner.status) activeStoreScanner.status.textContent = "Cámara detenida.";
  activeStoreScanner = null;
}
window.sdStopStoreScanner = stopStoreScanner;
function acceptScannedStore(rawValue, mode) {
  const payload = String(rawValue || "").trim();
  const match = payload.match(/^SDT1:([A-Z0-9-]{1,12})$/i);
  if (!match) {
    notice(mode === "cash" ? "cash-sale-notice" : "sale-notice", "El QR no pertenece a una etiqueta de tienda Semilla Dorada.");
    return;
  }
  const code = match[1];
  const input = $(mode === "cash" ? "cash-store-number" : "sale-store-number");
  input.value = code;
  const result = updateStoreSelection(mode);
  if (result.error) notice(mode === "cash" ? "cash-sale-notice" : "sale-notice", result.error);
  else notice(mode === "cash" ? "cash-sale-notice" : "sale-notice", `Tienda ${result.store.name} identificada correctamente.`);
}
async function startStoreScanner(mode) {
  stopStoreScanner();
  const prefix = mode === "cash" ? "cash-sale" : "sale";
  const video = $(`${prefix}-scanner-video`);
  const status = $(`${prefix}-scanner-status`);
  const stopButton = $(`${prefix}-stop-scan`);
  if (!video || !status) return;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    status.textContent = "La cámara requiere HTTPS o localhost. Puedes introducir el código manualmente.";
    return;
  }
  if (!("BarcodeDetector" in window)) {
    status.textContent = "Este navegador no ofrece lector QR nativo. Usa el campo de código manual o un lector QR USB/Bluetooth.";
    return;
  }
  try {
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    const scanner = { active: true, video, stream, stopButton, status };
    activeStoreScanner = scanner;
    video.srcObject = stream;
    video.hidden = false;
    stopButton.hidden = false;
    await video.play();
    status.textContent = "Cámara activa. Coloca el QR dentro del encuadre.";
    const scanFrame = async () => {
      if (!scanner.active) return;
      try {
        const codes = await detector.detect(video);
        if (codes.length) {
          const raw = codes[0].rawValue;
          stopStoreScanner();
          acceptScannedStore(raw, mode);
          return;
        }
      } catch (error) {
        console.warn("No se pudo leer el QR en este fotograma:", error);
      }
      if (scanner.active) requestAnimationFrame(scanFrame);
    };
    requestAnimationFrame(scanFrame);
  } catch (error) {
    console.error("No se pudo iniciar la cámara:", error);
    status.textContent = "No se pudo abrir la cámara. Revisa el permiso del navegador o introduce el código manualmente.";
    stopStoreScanner();
  }
}
$("sale-scan-qr")?.addEventListener("click", () => startStoreScanner("credit"));
$("cash-sale-scan-qr")?.addEventListener("click", () => startStoreScanner("cash"));
$("sale-stop-scan")?.addEventListener("click", stopStoreScanner);
$("cash-sale-stop-scan")?.addEventListener("click", stopStoreScanner);
document.addEventListener("visibilitychange", () => { if (document.hidden) stopStoreScanner(); });

$("cash-sale-form")?.addEventListener("submit", async event => {
  event.preventDefault();
  const form = $("cash-sale-form");
  const button = form.querySelector('[type="submit"]');
  if (button?.disabled) return;
  const { store, error } = updateStoreSelection("cash");
  if (error) { notice("cash-sale-notice", error); return; }
  const pricesNow = effectiveCashPrices();
  const lines = [];
  for (const item of cashProductDefinitions()) {
    const input = document.querySelector(`[data-cash-product-key="${CSS.escape(item.key)}"]`);
    const quantity = Math.max(0, Math.floor(Number(input?.value || 0)));
    if (quantity > 0) {
      const unitPrice = Number(pricesNow[item.priceKey]) || 0;
      if (unitPrice <= 0) { notice("cash-sale-notice", `Configura primero el precio de ${item.name} en la lista de efectivo.`); return; }
      lines.push({ product: item.name, productKey: item.key, priceKey: item.priceKey, quantity, unitPrice, subtotal: roundMoney(quantity * unitPrice) });
    }
  }
  if (!lines.length) { notice("cash-sale-notice", "Captura al menos una pieza antes de generar la nota."); return; }
  const now = new Date();
  const totalPieces = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const returnsAmount = roundMoney(Math.max(0, Number($("cash-sale-returns")?.value) || 0));
  const total = roundMoney(subtotal + returnsAmount);
  const seller = currentSellerUsername();
  const note = {
    id: newId(), storeId: store.id, storeCode: store.code || store.number,
    storeNumber: store.code || store.number, storeLegacyNumber: store.legacyNumber || "",
    storeName: store.name, storeAddress: store.address, storeResponsibleSeller: store.responsibleSeller || "",
    lines, totalPieces, subtotal, returnsAmount, total, date: now.toISOString(), dateLabel: now.toLocaleString("es-MX"),
    seller, sellerName: currentSellerName(seller),
    type: "Efectivo", paymentMethod: "Efectivo", priceList: "Efectivo"
  };
  button.disabled = true;
  try {
    const all = sales(); all.push(note);
    await write(KEYS.sales, all);

    // Habilitar impresión de la nota de efectivo
    lastSavedCashNote = note;
    const cashPrintActions = $("cash-print-actions");

    if (cashPrintActions) {
      cashPrintActions.hidden = false;
    }

    playSaleSound();
    form.reset(); prepareCashSale(); renderAll();
    notice("cash-sale-notice", `Nota de efectivo guardada. Total: ${money(total)}.`);
  } catch (error) {
    console.error("Error al guardar la nota de efectivo:", error);
    notice("cash-sale-notice", "No se pudo confirmar el guardado. No repitas la operación hasta revisar el historial.");
  } finally { button.disabled = false; }
});
$("cash-cancel-sale")?.addEventListener("click", async () => {
  if(await askConfirm({ title: "Limpiar nota", message: "Se borrarán los datos capturados de esta nota. No se guardará." })){
    $("cash-sale-form").reset(); prepareCashSale();
    notice("cash-sale-notice", "La nota se limpió; no se guardó.");
  }
});

$("sale-form").addEventListener("submit", async event => {
  event.preventDefault();

  const form = $("sale-form");
  const submitButton = form.querySelector('[type="submit"]');

  if (submitButton?.disabled) return;

  const { store, error: storeError } = updateStoreSelection("credit");
  if (storeError) {
    notice("sale-notice", storeError);
    return;
  }

  const currentPrices = prices();
  const lines = [];

  PRODUCTS.forEach(name => {
    const input = document.querySelector(
      `.quantity-input[data-product="${CSS.escape(name)}"]`
    );

    const qty = Math.max(0, Math.floor(Number(input?.value) || 0));

    if (qty > 0) {
      const unitPrice = Number(currentPrices[name]) || 0;

      lines.push({
        product: name,
        quantity: qty,
        unitPrice,
        subtotal: roundMoney(qty * unitPrice)
      });
    }
  });

  if (!lines.length) {
    notice(
      "sale-notice",
      "Captura al menos una pieza antes de generar la venta."
    );
    return;
  }

  const totalPieces = lines.reduce((a, x) => a + x.quantity, 0);
  const subtotal = roundMoney(lines.reduce((a, x) => a + x.subtotal, 0));
  const returnsAmount = roundMoney(Math.max(0, Number($("sale-returns")?.value) || 0));
  const total = roundMoney(subtotal + returnsAmount);

  const now = new Date();

  const seller = currentSellerUsername();
  const note = {
    id: newId(),
    storeId: store.id,
    storeCode: store.code || store.number,
    storeNumber: store.code || store.number,
    storeLegacyNumber: store.legacyNumber || "",
    storeName: store.name,
    storeAddress: store.address,
    storeResponsibleSeller: store.responsibleSeller || "",
    lines,
    totalPieces,
    subtotal,
    returnsAmount,
    total,
    date: now.toISOString(),
    dateLabel: now.toLocaleString("es-MX"),
    seller,
    sellerName: currentSellerName(seller),
    type: "Crédito"
  };

  if (submitButton) submitButton.disabled = true;

  try {
    const all = sales();
    all.push(note);

    await write(KEYS.sales, all);

    // Habilitar impresión de la nota de crédito
    lastSavedCreditNote = note;
    $("sale-print-actions").hidden = false;
    playSaleSound();

    form.reset();
    prepareSale();
    renderAll();

    notice(
      "sale-notice",
      `Venta guardada correctamente. Total: ${money(total)}. Puedes registrar otra nota.`
    );
  } catch (err) {
    console.error("Error al guardar la nota:", err);

    notice(
      "sale-notice",
      "No se pudo confirmar el guardado de la venta. Tus datos anteriores no deben borrarse. Revisa la consola antes de volver a intentarlo."
    );
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});


$("cancel-sale").addEventListener("click",async()=>{
  if(await askConfirm({ title: "Limpiar nota", message: "Se borrarán los datos capturados de esta nota. No se guardará." })){
    $("sale-form").reset();
    prepareSale();
    notice("sale-notice","La nota se limpió; no se guardó.");
  }
});

