// Respaldo y estado del almacenamiento (pantalla Inicio).
const LAST_BACKUP_KEY = "sd-pruebas-last-backup-at";
const BACKUP_REMINDER_DAYS = 7;

function getLastBackup() {
  try { return localStorage.getItem(LAST_BACKUP_KEY); } catch { return null; }
}
function setLastBackup(iso) {
  try { localStorage.setItem(LAST_BACKUP_KEY, iso); } catch {}
}
function backupNotice(message, isError) {
  const el = $("backup-notice");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  el.classList.toggle("backup-error", !!isError);
}
function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

const BACKUP_KDF_ITERATIONS = 310000;
function bytesToBase64(bytes) {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (let offset = 0; offset < view.length; offset += 0x8000) binary += String.fromCharCode(...view.subarray(offset, offset + 0x8000));
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
async function backupKey(password, salt, iterations = BACKUP_KDF_ITERATIONS) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encryptBackup(backup, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await backupKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(backup)));
  return { app: "semilla-dorada-pruebas", encryptedBackup: 1, exportedAt: backup.exportedAt, kdf: "PBKDF2-SHA256", iterations: BACKUP_KDF_ITERATIONS, salt: bytesToHex(salt), iv: bytesToHex(iv), ciphertext: bytesToBase64(ciphertext) };
}
async function decryptBackup(envelope, password) {
  if (envelope?.app !== "semilla-dorada-pruebas" || envelope.encryptedBackup !== 1 || envelope.kdf !== "PBKDF2-SHA256" || !Number.isInteger(envelope.iterations) || envelope.iterations < 200000 || envelope.iterations > 1000000 || typeof envelope.ciphertext !== "string" || envelope.ciphertext.length > 35 * 1024 * 1024) throw new Error("El archivo cifrado no tiene un formato válido.");
  const salt = Uint8Array.from(envelope.salt?.match(/.{2}/g) || [], part => parseInt(part, 16));
  const iv = Uint8Array.from(envelope.iv?.match(/.{2}/g) || [], part => parseInt(part, 16));
  if (salt.length !== 16 || iv.length !== 12) throw new Error("Los parámetros de cifrado del respaldo no son válidos.");
  const key = await backupKey(password, salt, envelope.iterations);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, base64ToBytes(envelope.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function renderBackupStatus() {
  const box = $("backup-status");
  if (!box) return;
  const lines = [];
  const last = getLastBackup();
  const days = last ? (Date.now() - new Date(last).getTime()) / 86400000 : Infinity;
  lines.push(last
    ? "Último respaldo: " + new Date(last).toLocaleString("es-MX")
    : "Todavía no has exportado ningún respaldo en este dispositivo.");

  const info = typeof storageInfo === "function" ? storageInfo() : {};
  if (info.persisted === true) lines.push("Almacenamiento protegido: sí, el navegador no debería borrar tus datos por falta de espacio.");
  else if (info.persisted === false) lines.push("Almacenamiento protegido: no concedido. El navegador podría borrar los datos si necesita espacio. Instala la app y exporta respaldos con frecuencia.");

  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      if (usage != null && quota != null) lines.push("Espacio usado por la app: " + formatBytes(usage) + " de " + formatBytes(quota) + ".");
    }
  } catch {}

  box.replaceChildren(...lines.map(text => {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = text;
    return p;
  }));

  const alert = $("backup-alert");
  if (alert) {
    alert.hidden = !(days > BACKUP_REMINDER_DAYS);
    alert.textContent = last
      ? "Han pasado más de " + BACKUP_REMINDER_DAYS + " días desde tu último respaldo. Exporta uno ahora."
      : "Aún no tienes respaldo. Exporta uno para no perder tus datos si el navegador los borra.";
  }
}

async function exportBackup() {
  const button = $("backup-export");
  button.disabled = true;
  try {
    const password = await askSecret({ title: "Contraseña del respaldo", message: "Crea una contraseña de al menos 12 caracteres para proteger este archivo. Guárdala: será necesaria para restaurarlo." });
    if (!password) return;
    if (password.length < 12) { backupNotice("La contraseña del respaldo debe tener al menos 12 caracteres.", true); return; }
    const backup = await encryptBackup(await buildBackup(), password);
    const stamp = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "semilla-dorada-respaldo-" + stamp + ".json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setLastBackup(backup.exportedAt);
    backupNotice("Respaldo cifrado exportado. Guárdalo fuera del dispositivo y conserva su contraseña.");
    renderBackupStatus();
  } catch (error) {
    console.error(error);
    backupNotice("No se pudo crear el respaldo: " + error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function importBackupFile(file) {
  try {
    const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
    if (!file || file.size === 0) { backupNotice("Selecciona un archivo de respaldo válido.", true); return; }
    if (file.size > MAX_BACKUP_BYTES) { backupNotice("El respaldo supera el límite de 25 MB. Divide el archivo o utiliza el dispositivo donde se generaron los datos.", true); return; }
    let parsed;
    try { parsed = JSON.parse(await file.text()); }
    catch { backupNotice("El archivo no es un respaldo válido (no se pudo leer).", true); return; }

    let plainBackup = parsed;
    if (parsed?.encryptedBackup === 1) {
      const password = await askSecret({ title: "Abrir respaldo cifrado", message: "Escribe la contraseña con la que se protegió este respaldo." });
      if (!password) { backupNotice("Restauración cancelada. No se cambió nada."); return; }
      try { plainBackup = await decryptBackup(parsed, password); }
      catch { backupNotice("No se pudo descifrar el respaldo. Verifica la contraseña del respaldo y conserva el archivo original.", true); return; }
    }
    const checked = await validateBackup(plainBackup);
    if (!checked.ok) { backupNotice(checked.error, true); return; }

    if (parsed?.encryptedBackup !== 1) {
      const acceptPlain = await askConfirm({ title: "Respaldo sin cifrar", message: "Este respaldo antiguo contiene datos legibles. Si continúas, se importará y quedará cifrado en este dispositivo.", confirmLabel: "Continuar", danger: true });
      if (!acceptPlain) { backupNotice("Restauración cancelada. No se cambió nada."); return; }
    }

    const c = plainBackup.counts || backupCounts(plainBackup.data);
    const when = plainBackup.exportedAt ? new Date(plainBackup.exportedAt).toLocaleString("es-MX") : "fecha desconocida";
    const ok = await askConfirm({ title: "Restaurar respaldo", message: `Archivo del ${when}: ${c.notas} nota(s), ${c.tiendas} tienda(s), ${c.entradas} entrada(s). Reemplazará todos los datos de este dispositivo. Antes se guardará una copia interna de los datos actuales.`, confirmLabel: "Reemplazar datos", danger: true });
    if (!ok) { backupNotice("Restauración cancelada. No se cambió nada."); return; }

    await restoreBackup(plainBackup);
    renderAll();
    showScreen("home");
    backupNotice("Respaldo restaurado: " + c.notas + " notas, " + c.tiendas + " tiendas, " + c.entradas + " entradas.");
  } catch (error) {
    console.error(error);
    backupNotice("No se pudo restaurar el respaldo: " + error.message, true);
  } finally {
    $("backup-file").value = "";
  }
}

$("backup-export").addEventListener("click", exportBackup);
$("backup-import").addEventListener("click", () => $("backup-file").click());
$("backup-file").addEventListener("change", event => {
  const file = event.target.files && event.target.files[0];
  if (file) importBackupFile(file);
});

// Si otra pestaña/ventana cambia los datos, avisa para recargar y no sobrescribir.
if (typeof syncChannel !== "undefined" && syncChannel) {
  syncChannel.addEventListener("message", event => {
    if (event.data && event.data.type === "data-changed" && window.sdShowBanner) {
      window.sdShowBanner("Los datos cambiaron en otra ventana de la app. Recarga para no sobrescribirlos.", "Recargar", () => location.reload());
    }
  });
}
