
// Utilidades compartidas por los módulos.

const $ = id => document.getElementById(id);

const encoder = new TextEncoder();

function money(n) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(Number(n) || 0);
}

function bytesToHex(buffer) {
  return Array.from(
    new Uint8Array(buffer),
    b => b.toString(16).padStart(2, "0")
  ).join("");
}

// Identificador único.
function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();

  const b = crypto.getRandomValues(new Uint8Array(16));

  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;

  const h = bytesToHex(b);

  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Celda CSV segura para evitar fórmulas al abrir en Excel.
function csvCell(value) {
  let text = String(value ?? "");

  if (
    typeof value === "string" &&
    /^[=+\-@\t\r]/.test(text)
  ) {
    text = "'" + text;
  }

  return '"' + text.replaceAll('"', '""') + '"';
}

// Diálogo accesible y consistente para operaciones que requieren confirmación.
function askConfirm({ title = "Confirmar acción", message, confirmLabel = "Continuar", danger = false }) {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog";
    dialog.setAttribute("aria-labelledby", "confirm-dialog-title");
    const heading = document.createElement("h2");
    heading.id = "confirm-dialog-title";
    heading.textContent = title;
    const description = document.createElement("p");
    description.textContent = message;
    const actions = document.createElement("div");
    actions.className = "confirm-dialog-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "secondary";
    cancel.textContent = "Cancelar";
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = danger ? "danger" : "primary-action";
    confirm.textContent = confirmLabel;
    actions.append(cancel, confirm);
    dialog.append(heading, description, actions);
    document.body.append(dialog);
    const finish = value => { dialog.close(); dialog.remove(); resolve(value); };
    cancel.addEventListener("click", () => finish(false));
    confirm.addEventListener("click", () => finish(true));
    dialog.addEventListener("cancel", event => { event.preventDefault(); finish(false); });
    dialog.addEventListener("click", event => { if (event.target === dialog) finish(false); });
    dialog.showModal();
    confirm.focus();
  });
}

function askSecret({ title = "Contraseña maestra", message }) {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog";
    const heading = document.createElement("h2");
    heading.textContent = title;
    const description = document.createElement("p");
    description.textContent = message;
    const input = document.createElement("input");
    input.type = "password";
    input.autocomplete = "current-password";
    input.minLength = 12;
    input.maxLength = 128;
    input.required = true;
    input.setAttribute("aria-label", "Contraseña maestra");
    input.className = "secret-input";
    const actions = document.createElement("div");
    actions.className = "confirm-dialog-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "secondary";
    cancel.textContent = "Cancelar";
    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "primary-action";
    submit.textContent = "Continuar";
    actions.append(cancel, submit);
    dialog.append(heading, description, input, actions);
    document.body.append(dialog);
    const finish = value => { dialog.close(); dialog.remove(); resolve(value); };
    cancel.addEventListener("click", () => finish(null));
    submit.addEventListener("click", () => input.reportValidity() && finish(input.value));
    dialog.addEventListener("cancel", event => { event.preventDefault(); finish(null); });
    dialog.showModal();
    input.focus();
  });
}

// Evita residuos de coma flotante en importes nuevos sin alterar registros históricos.
function roundMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) / 100 : 0;
}
