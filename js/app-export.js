
function exportCSV() {
  const notes = sales();

  // Catálogo base de productos.
  const catalogProducts = [
    "BT500", "BT300", "BT100",
    "Pistache", "Semilla", "Español",
    "Salado", "Enchilado", "Haba",
    "Garbanzo", "Garapiñado", "Churro",
    "Pepita frita", "Semilla de girasol",
    "Nuez india", "Nuez natural",
    "Cacahuate japonés", "Chilio",
    "Ciruela pasa", "Uva pasa", "Cartoncito"
  ];

  // Agregar productos personalizados que aparezcan en las notas.
  const products = [
    ...new Set([
      ...catalogProducts,
      ...notes.flatMap(note =>
        (note.lines || []).map(line => line.product)
      )
    ])
  ];

  const headers = [
    "Fecha",
    "Número de nota",
    "Vendedor",
    "Número de tienda",
    "Nombre de tienda",
    "Tipo de venta",
    ...products,
    "Total piezas",
    "Total MXN"
  ];

  const rows = [headers];

  notes.forEach(note => {
    const quantities = {};

    (note.lines || []).forEach(line => {
      const product = line.product;
      quantities[product] =
        (quantities[product] || 0) +
        (Number(line.quantity) || 0);
    });

    const sellerName =
      typeof sellerDisplayName === "function"
        ? sellerDisplayName(note.seller)
        : note.seller || "";

    rows.push([
      note.dateLabel || note.date || "",
      note.id || "",
      sellerName,
      note.storeNumber || "",
      note.storeName || "",
      note.type || "Crédito",
      ...products.map(product => quantities[product] || 0),
      Number(note.totalPieces) || 0,
      Number(note.total) || 0
    ]);
  });

  const csv = "\uFEFF" +
    rows.map(row => row.map(csvCell).join(",")).join("\r\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "Reporte_Ventas_Semilla_Dorada.csv";
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("export").addEventListener("click",exportCSV);
$("export-history").addEventListener("click",exportCSV);


const closeWeekButton = $("close-week");

if (closeWeekButton) {
  closeWeekButton.addEventListener("click", async () => {
    const currentSales = sales();
    const currentEntries = entries();

    if (!currentSales.length && !currentEntries.length) {
      notice(
        "close-week-notice",
        "No hay ventas ni entradas de mercancía para cerrar."
      );
      return;
    }

    const total = currentSales.reduce(
      (sum, note) => sum + (Number(note.total) || 0),
      0
    );

    const totalPieces = currentEntries.reduce(
      (sum, entry) =>
        sum + (entry.lines || []).reduce(
          (lineSum, line) => lineSum + (Number(line.quantity) || 0),
          0
        ),
      0
    );

    const confirmed = await askConfirm({ title: "Cerrar semana", message: `Ventas: ${currentSales.length} nota(s) por ${money(total)}. Entradas: ${currentEntries.length} registro(s), ${totalPieces} piezas. Se archivarán y saldrán de los registros activos.`, confirmLabel: "Cerrar semana", danger: true });

    if (!confirmed) return;

    closeWeekButton.disabled = true;

    try {
      const result = await archiveAndClearWeek();

      renderAll();

      const archivedSales = result.salesArchive?.count || 0;
      const archivedEntries = result.entriesArchive?.count || 0;

      notice(
        "close-week-notice",
        `Semana cerrada correctamente. ` +
        `Ventas archivadas: ${archivedSales}. ` +
        `Entradas archivadas: ${archivedEntries}. ` +
        "Los registros activos se reiniciaron."
      );
    } catch (error) {
      console.error("Error al cerrar la semana:", error);

      notice(
        "close-week-notice",
        "No se pudo confirmar el cierre. No intentes repetirlo todavía; " +
        "revisa los datos y la consola de VS Code o del navegador."
      );
    } finally {
      closeWeekButton.disabled = false;
    }
  });
}

$("logout").addEventListener("click",showLogin);


function startFlow() {
  $("splash").hidden = false;
  $("login-screen").hidden = true;
  $("app-shell").hidden = true;

  // El nombre de usuario en sessionStorage no es una prueba de autenticación.
  // Cada recarga debe pedir la contraseña de nuevo.
  window.setTimeout(showLogin, 500);
}



startFlow();
