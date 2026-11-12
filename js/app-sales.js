function notice(id,message){
  const el=$(id);
  el.textContent=message;
  el.hidden=false;
}
/* ==========================================
   SONIDO DE CONFIRMACIÓN DE VENTA
========================================== */

let saleAudioContext = null;

function unlockSaleAudio() {
  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    if (!saleAudioContext) {
      saleAudioContext = new AudioContextClass();
    }

    if (saleAudioContext.state === "suspended") {
      saleAudioContext.resume();
    }
  } catch (error) {
    console.warn("Audio no disponible:", error);
  }
}

// Preparar audio durante la interacción del usuario
document.addEventListener("submit", event => {
  if (
    event.target.matches("#sale-form") ||
    event.target.matches("#cash-sale-form")
  ) {
    unlockSaleAudio();
  }
}, true);

function playSaleSound() {
  try {
    if (!saleAudioContext) return;

    const ctx = saleAudioContext;

    if (ctx.state !== "running") {
      ctx.resume();
    }

    const now = ctx.currentTime;

    [880, 1174.66].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      const start = now + index * 0.14;

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.20, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(start);
      oscillator.stop(start + 0.23);
    });

  } catch (error) {
    console.warn("Error al reproducir sonido:", error);
  }
}

/* ==========================================
   IMPRESIÓN DE NOTAS DE VENTA
   Formatos: térmica 80 mm y hoja carta
========================================== */

let lastSavedCreditNote = null;
let lastSavedCashNote = null;

function escapePrintHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function printSaleNote(note, format = "thermal") {
  if (!note || !Array.isArray(note.lines)) {
    alert("No hay una nota guardada para imprimir.");
    return;
  }

  // La ventana se abre directamente desde la acción del usuario.
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Permite las ventanas emergentes para imprimir.");
    return;
  }

  const thermal = format === "thermal";
  const logoUrl = new URL("images/logo-semilla-dorada.png", window.location.href).href;
  const folio = "SD-" + String(note.id || "").replaceAll("-", "").slice(0, 12).toUpperCase();
  const date = note.dateLabel || (note.date ? new Date(note.date).toLocaleString("es-MX") : "");
  const safe = escapePrintHTML;

  const rows = note.lines.map(line => {
    const quantity = Number(line.quantity) || 0;
    const unitPrice = Number(line.unitPrice ?? line.price ?? 0);
    const subtotal = Number(line.subtotal) || 0;
    return `
      <tr>
        <td class="product-cell">${safe(line.product)}</td>
        <td class="numeric">${quantity}</td>
        <td class="numeric">${money(unitPrice)}</td>
        <td class="numeric">${money(subtotal)}</td>
      </tr>
    `;
  }).join("");

  const totalPieces = Number(note.totalPieces) || note.lines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0), 0
  );
  const html = `<!doctype html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Nota de venta ${safe(folio)}</title>
    <link rel="stylesheet" href="${new URL("css/ticket.css", window.location.href).href}">
    <link rel="stylesheet" href="${new URL(thermal ? "css/ticket-thermal.css" : "css/ticket-letter.css", window.location.href).href}">
  </head>
  <body>
    <main class="ticket">
      <header class="header">
        <img class="brand-logo" src="${logoUrl}" alt="Logo Semilla Dorada">
        <div class="brand-name">SEMILLA DORADA</div>
        <div class="subtitle">DISTRIBUCIÓN DE BOTANAS</div>
        <div class="document-title">NOTA DE VENTA</div>
        <div class="folio">FOLIO: ${safe(folio)}</div>
      </header>

      <section class="section">
        <h2 class="section-title">Establecimiento</h2>
        <div class="data-row"><strong>${safe(note.storeName || "Sin nombre")}</strong></div>
        <div class="data-row">Código: ${safe(note.storeCode || note.storeNumber || "")}</div>
        <div class="data-row">Dirección: ${safe(note.storeAddress || "No registrada")}</div>
      </section>

      <section class="section">
        <h2 class="section-title">Datos de operación</h2>
        <div class="data-row">Fecha: ${safe(date)}</div>
        <div class="data-row">Vendedor: ${safe(note.sellerName || note.seller || "")}</div>
        <div class="data-row">Modalidad: ${safe(note.type || "Venta")}</div>
      </section>

      <section class="section">
        <h2 class="section-title">Detalle de productos</h2>
        <table>
          <thead><tr><th>Producto</th><th class="numeric">Cant.</th><th class="numeric">Precio</th><th class="numeric">Importe</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>

      <section class="total-box">
        <div class="total-label">Total de piezas: ${totalPieces}</div>
        <div class="total-label">TOTAL DE LA VENTA</div>
        <div class="total">${money(note.total)}</div>
      </section>

      <footer class="footer">
        <strong>¡Gracias por su preferencia!</strong>
        <p>Conserve esta nota como comprobante interno de su operación.</p>
        <p>SEMILLA DORADA</p>
      </footer>
    </main>
  </body>
  </html>`;

  // Esperar las hojas CSS externas permitidas por la política CSP (style-src 'self').
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  const waitForResource = element => new Promise(resolve => {
    if (!element) return resolve();
    if (element.tagName === "LINK" && element.sheet) return resolve();
    if (element.tagName === "IMG" && element.complete) return resolve();
    element.addEventListener("load", resolve, { once: true });
    element.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 4000);
  });

  Promise.all([
    ...Array.from(printWindow.document.querySelectorAll('link[rel="stylesheet"]'), waitForResource),
    waitForResource(printWindow.document.querySelector(".brand-logo"))
  ]).then(() => {
    printWindow.focus();
    printWindow.print();
  });
}

/* Botones de impresión manual */

$("sale-print-thermal")?.addEventListener("click", () => {
  printSaleNote(lastSavedCreditNote, "thermal");
});

$("sale-print-letter")?.addEventListener("click", () => {
  printSaleNote(lastSavedCreditNote, "letter");
});

// IMPRESIÓN DE EFECTIVO
$("cash-print-thermal")?.addEventListener("click", () => {
  const note = lastSavedCashNote ||
    sales().slice().reverse().find(item => item.type === "Efectivo");

  printSaleNote(note, "thermal");
});

$("cash-print-letter")?.addEventListener("click", () => {
  const note = lastSavedCashNote ||
    sales().slice().reverse().find(item => item.type === "Efectivo");

  printSaleNote(note, "letter");
});



