// Base de datos local IndexedDB para Semilla Dorada Pruebas.
// Conserva una copia de los datos antiguos en localStorage como respaldo.
const KEYS = {
  sales: "sd-pruebas-sales-v1",
  stores: "sd-pruebas-stores-v1",
  prices: "sd-pruebas-prices-v1",
  entries: "sd-pruebas-entries-v1",
  commission: "sd-pruebas-commission-v1",
  closings: "sd-pruebas-closings-v1",
  salesArchives: "sd-pruebas-sales-archives-v1",
  entriesArchives: "sd-pruebas-entries-archives-v1",
  cashPrices: "sd-pruebas-cash-prices-v1",
  cashCatalog: "sd-pruebas-cash-catalog-v1",
  storeSequence: "sd-pruebas-store-sequence-v1"
};
const DB_NAME = "SemillaDoradaDB-Pruebas";
const DB_VERSION = 1;
const DB_STORE = "records";
const PRODUCTS = ["BT300","BT100","Pistache","Semilla","Español","Salado","Enchilado","Haba","Garbanzo","Garapiñado","Churro"];
const DEFAULT_PRICES = Object.fromEntries(PRODUCTS.map((name,i)=>[name,[120,85,95,60,55,50,50,65,55,60,45][i]]));
const CASH_EXTRA_PRODUCTS = [
  "BT500", "Pepita frita", "Semilla de girasol", "Nuez india",
  "Nuez natural", "Cacahuate japonés", "Chilio", "Ciruela pasa",
  "Uva pasa", "Cartoncito"
];
const CASH_BASE_PRODUCTS = ["BT500", ...PRODUCTS, ...CASH_EXTRA_PRODUCTS.filter(name => name !== "BT500")];
const DEFAULT_CASH_PRICES = Object.fromEntries([
  ...CASH_BASE_PRODUCTS.map(name => [name, 0]),
  ["OTHER_1", 0], ["OTHER_2", 0], ["OTHER_3", 0]
]);
const DEFAULT_CASH_CATALOG = {
  others: [
    { key: "OTHER_1", name: "OTROS 1", active: true },
    { key: "OTHER_2", name: "OTROS 2", active: true },
    { key: "OTHER_3", name: "OTROS 3", active: true }
  ]
};

const memory = {
  [KEYS.sales]: [],
  [KEYS.stores]: [],
  [KEYS.prices]: { ...DEFAULT_PRICES },
  [KEYS.entries]: [],
  [KEYS.commission]: { rate: 0 },
  [KEYS.closings]: [],
  [KEYS.salesArchives]: [],
  [KEYS.entriesArchives]: [],
  [KEYS.cashPrices]: { ...DEFAULT_CASH_PRICES },
  [KEYS.cashCatalog]: JSON.parse(JSON.stringify(DEFAULT_CASH_CATALOG)),
  [KEYS.storeSequence]: 1
};
let db = null;
let storageReady = false;
let storageMode = "initializing";
let storagePersisted = null;
let storageKey = null;
let storageSalt = null;
const STORAGE_META_KEY = "__sd_encryption_meta_v1__";
const STORAGE_KDF_ITERATIONS = 310000;
let storageIterations = STORAGE_KDF_ITERATIONS;

// Avisa a las otras pestañas/ventanas de la app cuando los datos cambian,
// para que no sobrescriban con información vieja.
const syncChannel = ("BroadcastChannel" in window) ? new BroadcastChannel("sd-pruebas-sync") : null;
function notifyDataChanged() {
  try { syncChannel?.postMessage({ type: "data-changed" }); } catch {}
}

function legacyRead(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Este navegador no ofrece IndexedDB."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DB_STORE)) {
        database.createObjectStore(DB_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir IndexedDB."));
    request.onblocked = () => console.warn("IndexedDB está esperando a que se cierre otra pestaña de Semilla Dorada Pruebas.");
  });
}

function dbGetAllRaw() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const request = tx.objectStore(DB_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function deriveEncryptionKey(password, salt, iterations = STORAGE_KDF_ITERATIONS) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function encryptRecord(key, value) {
  if (!storageKey) throw new Error("El almacenamiento está bloqueado.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(key) }, storageKey, bytes);
  return { key, encrypted: 1, iv: bytesToHex(iv), value: bytesToHex(ciphertext) };
}

async function decryptRecord(record) {
  if (record.encrypted !== 1) return record;
  if (!storageKey) throw new Error("El almacenamiento está bloqueado.");
  const iv = Uint8Array.from(record.iv.match(/.{2}/g) || [], byte => parseInt(byte, 16));
  const ciphertext = Uint8Array.from(record.value.match(/.{2}/g) || [], byte => parseInt(byte, 16));
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(record.key) }, storageKey, ciphertext);
  return { key: record.key, value: JSON.parse(new TextDecoder().decode(plaintext)) };
}

async function dbGetAll() {
  const records = (await dbGetAllRaw()).filter(record => record.key !== STORAGE_META_KEY);
  return Promise.all(records.map(decryptRecord));
}

async function dbPutRaw(record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("No se pudo guardar el registro."));
    tx.onabort = () => reject(tx.error || new Error("Se canceló el guardado."));
  });
}

async function dbPut(key, value) {
  await dbPutRaw(await encryptRecord(key, value));
}

function legacySnapshot() {
  return {
    [KEYS.sales]: legacyRead(KEYS.sales, []),
    [KEYS.stores]: legacyRead(KEYS.stores, []),
    [KEYS.prices]: legacyRead(KEYS.prices, {}),
    [KEYS.entries]: legacyRead(KEYS.entries, []),
    [KEYS.commission]: legacyRead(KEYS.commission, { rate: 0 }),
    [KEYS.closings]: legacyRead(KEYS.closings, []),
    [KEYS.salesArchives]: legacyRead(KEYS.salesArchives, []),
    [KEYS.entriesArchives]: legacyRead(KEYS.entriesArchives, []),
    [KEYS.cashPrices]: legacyRead(KEYS.cashPrices, DEFAULT_CASH_PRICES),
    [KEYS.cashCatalog]: legacyRead(KEYS.cashCatalog, DEFAULT_CASH_CATALOG),
    [KEYS.storeSequence]: legacyRead(KEYS.storeSequence, 1)
  };
}

// La clave aleatoria se conserva únicamente en este navegador/origen.
// No es equivalente a cifrado protegido por una contraseña que el usuario memoriza.
const DEVICE_SECRET_KEY = "__sd_device_secret_v1__";
async function initDeviceStorage() {
  const existing = localStorage.getItem(DEVICE_SECRET_KEY);
  if (existing) {
    await initStorage(existing);
    return;
  }
  // No generar una clave nueva sobre datos cifrados existentes.
  const probe = await openDatabase();
  let records;
  try {
    const tx = probe.transaction(DB_STORE, "readonly");
    records = await new Promise((resolve, reject) => {
      const request = tx.objectStore(DB_STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } finally { probe.close(); }
  const meta = records.find(row => row.key === STORAGE_META_KEY);
  if (meta?.deviceManaged) {
    throw new Error("Falta la clave local de este dispositivo. No se sobrescribieron los datos. Restaura una copia de seguridad o recupera el almacenamiento original.");
  }
  const secret = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  if (meta) {
    if (typeof askSecret !== "function") throw new Error("No se puede iniciar la migración segura.");
    const previous = await askSecret({
      title: "Migración única de datos",
      message: "Esta base todavía está protegida con la contraseña maestra anterior. Escríbela una sola vez para conservar tus ventas, tiendas e historial."
    });
    if (!previous) throw new Error("Migración cancelada. Tus datos siguen intactos.");
    try {
      await initStorage(previous);
      await changeStoragePassword(previous, secret);
    } catch (error) {
      lockStorage();
      throw new Error("No se pudo migrar la base. Revisa la contraseña anterior. No se borraron los datos.");
    }
  } else {
    await initStorage(secret);
  }
  // Marcar primero la base como administrada por dispositivo, luego guardar su clave.
  await dbPutRaw({ key: STORAGE_META_KEY, salt: bytesToHex(storageSalt), kdf: "PBKDF2-SHA256", iterations: storageIterations, deviceManaged: true });
  localStorage.setItem(DEVICE_SECRET_KEY, secret);
}

async function initStorage(masterPassword) {
  if (typeof masterPassword !== "string" || masterPassword.length < 12) throw new Error("La contraseña maestra debe tener al menos 12 caracteres.");
  storageReady = false;
  db = await openDatabase();
  const rawRecords = await dbGetAllRaw();
  let meta = rawRecords.find(record => record.key === STORAGE_META_KEY);
  if (!meta) {
    storageSalt = crypto.getRandomValues(new Uint8Array(16));
    meta = { key: STORAGE_META_KEY, salt: bytesToHex(storageSalt), kdf: "PBKDF2-SHA256", iterations: STORAGE_KDF_ITERATIONS };
    await dbPutRaw(meta);
  } else {
    storageSalt = Uint8Array.from(meta.salt.match(/.{2}/g) || [], byte => parseInt(byte, 16));
    if (storageSalt.length !== 16 || meta.kdf !== "PBKDF2-SHA256" || !Number.isInteger(meta.iterations) || meta.iterations < 200000 || meta.iterations > 1000000) throw new Error("La configuración de cifrado local no es válida.");
  }
  storageIterations = meta.iterations || STORAGE_KDF_ITERATIONS;
  storageKey = await deriveEncryptionKey(masterPassword, storageSalt, storageIterations);
  const records = await dbGetAll();
  const stored = new Map(records.map(record => [record.key, record.value]));
  const legacy = legacySnapshot();
  const hasAnyStoredData = records.some(record => Object.values(KEYS).includes(record.key));

  for (const key of Object.values(KEYS)) {
    if (!hasAnyStoredData || !stored.has(key)) stored.set(key, legacy[key]);
  }

  memory[KEYS.sales] = Array.isArray(stored.get(KEYS.sales)) ? stored.get(KEYS.sales) : [];
  memory[KEYS.stores] = Array.isArray(stored.get(KEYS.stores)) ? stored.get(KEYS.stores) : [];
  memory[KEYS.prices] = { ...DEFAULT_PRICES, ...(stored.get(KEYS.prices) || {}) };
  memory[KEYS.entries] = Array.isArray(stored.get(KEYS.entries)) ? stored.get(KEYS.entries) : [];
  memory[KEYS.commission] = { rate: 0, ...(stored.get(KEYS.commission) || {}) };
  memory[KEYS.closings] = Array.isArray(stored.get(KEYS.closings)) ? stored.get(KEYS.closings) : [];
  memory[KEYS.salesArchives] = Array.isArray(stored.get(KEYS.salesArchives)) ? stored.get(KEYS.salesArchives) : [];
  memory[KEYS.entriesArchives] = Array.isArray(stored.get(KEYS.entriesArchives)) ? stored.get(KEYS.entriesArchives) : [];
  memory[KEYS.cashPrices] = { ...DEFAULT_CASH_PRICES, ...(stored.get(KEYS.cashPrices) || {}) };
  const savedCashCatalog = stored.get(KEYS.cashCatalog) || DEFAULT_CASH_CATALOG;
  memory[KEYS.cashCatalog] = { others: DEFAULT_CASH_CATALOG.others.map((slot, index) => ({ ...slot, ...(savedCashCatalog.others?.[index] || {}) })) };
  memory[KEYS.storeSequence] = Number(stored.get(KEYS.storeSequence)) || 1;

  // Migra el contenido antiguo en una sola escritura y limpia las copias legibles tras confirmar.
  const requiresMigration = !hasAnyStoredData || rawRecords.some(record => record.key !== STORAGE_META_KEY && record.encrypted !== 1) || Object.values(KEYS).some(key => !rawRecords.some(record => record.key === key && record.encrypted === 1));
  if (requiresMigration) {
    const rowsToEncrypt = new Map(records.map(record => [record.key, record.value]));
    Object.values(KEYS).forEach(key => rowsToEncrypt.set(key, memory[key]));
    const encryptedRows = await Promise.all([...rowsToEncrypt].map(([key, value]) => encryptRecord(key, value)));
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      const store = tx.objectStore(DB_STORE);
      encryptedRows.forEach(row => store.put(row));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("No se pudieron migrar los datos al formato cifrado."));
      tx.onabort = () => reject(tx.error || new Error("Se canceló la migración al formato cifrado."));
    });
  }
  try { Object.values(KEYS).forEach(key => localStorage.removeItem(key)); } catch {}
  storageMode = "indexeddb-encrypted";
  storageReady = true;
  if (navigator.storage?.persist) navigator.storage.persist().then(granted => { storagePersisted = granted; }).catch(() => {});
  await ensureStoreCodes();
}

function lockStorage() {
  storageReady = false;
  storageKey = null;
  storageSalt = null;
  storageIterations = STORAGE_KDF_ITERATIONS;
  storageMode = "locked";
  Object.keys(memory).forEach(key => { memory[key] = null; });
  db?.close();
  db = null;
}

async function verifyMasterPassword(password) {
  if (!storageKey || !storageSalt) return false;
  try {
    const candidate = await deriveEncryptionKey(password, storageSalt, storageIterations);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sample = new TextEncoder().encode("semilla-dorada-master-check");
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, candidate, sample);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, storageKey, encrypted);
    return new TextDecoder().decode(decrypted) === "semilla-dorada-master-check";
  } catch { return false; }
}

async function changeStoragePassword(currentPassword, nextPassword) {
  if (typeof nextPassword !== "string" || nextPassword.length < 12) throw new Error("La nueva contraseña maestra debe tener al menos 12 caracteres.");
  if (!await verifyMasterPassword(currentPassword)) throw new Error("La contraseña maestra actual no coincide.");
  const records = await dbGetAll();
  const previous = { key: storageKey, salt: storageSalt, iterations: storageIterations };
  const nextSalt = crypto.getRandomValues(new Uint8Array(16));
  const nextKey = await deriveEncryptionKey(nextPassword, nextSalt, STORAGE_KDF_ITERATIONS);
  storageKey = nextKey;
  storageSalt = nextSalt;
  storageIterations = STORAGE_KDF_ITERATIONS;
  try {
    const rows = await Promise.all(records.map(record => encryptRecord(record.key, record.value)));
    rows.push({ key: STORAGE_META_KEY, salt: bytesToHex(nextSalt), kdf: "PBKDF2-SHA256", iterations: STORAGE_KDF_ITERATIONS });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      rows.forEach(row => tx.objectStore(DB_STORE).put(row));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("No se pudo cambiar la contraseña maestra."));
      tx.onabort = () => reject(tx.error || new Error("Se canceló el cambio de contraseña maestra."));
    });
    notifyDataChanged();
  } catch (error) {
    storageKey = previous.key;
    storageSalt = previous.salt;
    storageIterations = previous.iterations;
    throw error;
  }
}

async function ensureStoreCodes() {
  const current = stores();
  let changed = false;
  const normalized = current.map(store => {
    const number = String(store.number || store.code || store.legacyNumber || "").trim();
    const updated = {
      ...store,
      number,
      code: number,
      legacyNumber: store.legacyNumber || "",
      responsibleSeller: store.responsibleSeller || "",
      sellerAccess: "all",
      authorizedSellers: [],
      creditAuthorized: true,
      active: typeof store.active === "boolean" ? store.active : true,
      qrVersion: Number(store.qrVersion) || 1
    };
    if (JSON.stringify(updated) !== JSON.stringify(store)) changed = true;
    return updated;
  });
  if (changed) await write(KEYS.stores, normalized);
}

function read(key, fallback) {
  if (Object.prototype.hasOwnProperty.call(memory, key)) return memory[key] ?? fallback;
  return legacyRead(key, fallback);
}


async function write(key, value) {
  if (!storageReady) {
    throw new Error(
      "El almacenamiento todavía no está listo. Intenta nuevamente."
    );
  }

  if (db && storageMode === "indexeddb-encrypted") {
    // Espera la confirmación de la transacción de IndexedDB.
    await dbPut(key, value);

    // Actualiza la memoria solo después de confirmar el guardado.
    memory[key] = value;
    notifyDataChanged();
    return true;
  }

  throw new Error(
    "No hay un almacenamiento cifrado disponible."
  );
}


async function writeMany(entries) {
  if (!storageReady) throw new Error("El almacenamiento todavía no está listo.");
  if (!Array.isArray(entries) || !entries.length) return true;

  if (db && storageMode === "indexeddb-encrypted") {
    const rows = await Promise.all(entries.map(([key, value]) => encryptRecord(key, value)));
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      const store = tx.objectStore(DB_STORE);
      rows.forEach(row => store.put(row));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("No se pudieron guardar los ajustes."));
      tx.onabort = () => reject(tx.error || new Error("Se canceló el guardado de ajustes."));
    });
    entries.forEach(([key, value]) => { memory[key] = value; });
    notifyDataChanged();
    return true;
  }

  throw new Error("No hay un almacenamiento cifrado disponible.");
}

async function createStoreWithAutomaticCode(data) {
  if (!storageReady) throw new Error("El almacenamiento todavía no está listo.");
  const number = String(data.number || data.code || "").trim();
  if (!number) throw new Error("El número de tienda es obligatorio.");
  const created = { ...data, id: newId(), code: number, number, legacyNumber: "", qrVersion: 1, active: true };
  await write(KEYS.stores, [...stores(), created]);
  return created;
}

function sales() {
  const value = read(KEYS.sales, []);
  return Array.isArray(value) ? value : [];
}
function stores() {
  const value = read(KEYS.stores, []);
  return Array.isArray(value) ? value : [];
}
function prices() {
  return { ...DEFAULT_PRICES, ...(read(KEYS.prices, {}) || {}) };
}
function entries() {
  const value = read(KEYS.entries, []);
  return Array.isArray(value) ? value : [];
}
function cashPrices() {
  return { ...DEFAULT_CASH_PRICES, ...(read(KEYS.cashPrices, {}) || {}) };
}
function cashCatalog() {
  const saved = read(KEYS.cashCatalog, DEFAULT_CASH_CATALOG) || DEFAULT_CASH_CATALOG;
  return {
    others: DEFAULT_CASH_CATALOG.others.map((slot, index) => ({
      ...slot,
      ...(saved.others?.[index] || {})
    }))
  };
}
function commissionConfig() {
  return { rate: 0, ...(read(KEYS.commission, { rate: 0 }) || {}) };
}
function storageInfo() {
  return { ready: storageReady, mode: storageMode, database: DB_NAME, persisted: storagePersisted };
}

function closings() {
  const value = read(KEYS.closings, []);
  return Array.isArray(value) ? value : [];
}


function salesArchives() {
  const value = read(KEYS.salesArchives, []);
  return Array.isArray(value) ? value : [];
}
function entriesArchives() {
  const value = read(KEYS.entriesArchives, []);
  return Array.isArray(value) ? value : [];
}

// Archiva y limpia las notas activas. En IndexedDB ambas escrituras se hacen
// en una sola transacción para evitar borrar las notas si falla el archivado.
// Archiva ventas y entradas antes de comenzar una semana nueva.
async function archiveAndClearWeek() {
  const currentSales = sales();
  const currentEntries = entries();

  if (!currentSales.length && !currentEntries.length) {
    throw new Error("No hay ventas ni entradas para cerrar.");
  }

  const now = new Date();
  const id = newId();

  const salesArchive = currentSales.length
    ? {
        id,
        closedAt: now.toISOString(),
        closedDate: now.toLocaleDateString("es-MX"),
        count: currentSales.length,
        total: currentSales.reduce(
          (sum, note) => sum + (Number(note.total) || 0),
          0
        ),
        notes: currentSales
      }
    : null;

  const entriesArchive = currentEntries.length
    ? {
        id,
        closedAt: now.toISOString(),
        closedDate: now.toLocaleDateString("es-MX"),
        count: currentEntries.length,
        totalPieces: currentEntries.reduce(
          (sum, entry) =>
            sum + (entry.lines || []).reduce(
              (lineSum, line) => lineSum + (Number(line.quantity) || 0),
              0
            ),
          0
        ),
        entries: currentEntries
      }
    : null;

  const nextSalesArchives = salesArchive
    ? [...salesArchives(), salesArchive]
    : salesArchives();

  const nextEntriesArchives = entriesArchive
    ? [...entriesArchives(), entriesArchive]
    : entriesArchives();

  const changes = [[KEYS.sales, []], [KEYS.entries, []]];
  if (salesArchive) changes.push([KEYS.salesArchives, nextSalesArchives]);
  if (entriesArchive) changes.push([KEYS.entriesArchives, nextEntriesArchives]);
  await writeMany(changes);

  return {
    salesArchive,
    entriesArchive
  };
}



// ---------------------------------------------------------------------------
// Respaldo completo: exportar / validar / restaurar todos los datos del dispositivo.
// ---------------------------------------------------------------------------
const BACKUP_APP = "semilla-dorada-pruebas";
const BACKUP_SCHEMA = 1;
const PRE_RESTORE_KEY = "sd-pruebas-pre-restore";
const BACKUP_ARRAY_KEYS = [KEYS.sales, KEYS.stores, KEYS.entries, KEYS.closings, KEYS.salesArchives, KEYS.entriesArchives];
const BACKUP_OBJECT_KEYS = [KEYS.prices, KEYS.commission, KEYS.cashPrices, KEYS.cashCatalog];
const BACKUP_NUMBER_KEYS = [KEYS.storeSequence];

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

function snapshotAll() {
  const data = {};
  Object.values(KEYS).forEach(key => {
    data[key] = JSON.parse(JSON.stringify(read(key, null)));
  });
  return data;
}

function backupCounts(data) {
  return {
    notas: (data[KEYS.sales] || []).length,
    tiendas: (data[KEYS.stores] || []).length,
    entradas: (data[KEYS.entries] || []).length,
    semanasArchivadas: (data[KEYS.salesArchives] || []).length
  };
}

function isPlainRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function validSaleRecord(note) {
  return isPlainRecord(note) && typeof note.id === "string" && note.id.length <= 100 && Array.isArray(note.lines) && note.lines.length <= 500
    && Number.isFinite(note.total) && note.total >= 0 && Number.isInteger(note.totalPieces) && note.totalPieces >= 0
    && note.lines.every(line => isPlainRecord(line) && typeof line.product === "string" && line.product.length <= 100
      && Number.isInteger(line.quantity) && line.quantity > 0 && Number.isFinite(line.unitPrice) && line.unitPrice >= 0
      && Number.isFinite(line.subtotal) && line.subtotal >= 0);
}
function validEntryRecord(record) {
  return isPlainRecord(record) && typeof record.id === "string" && Array.isArray(record.lines) && record.lines.length <= 500
    && record.lines.every(line => isPlainRecord(line) && typeof line.product === "string" && line.product.length <= 100
      && Number.isInteger(line.quantity) && line.quantity > 0);
}

async function buildBackup() {
  const data = snapshotAll();
  return {
    app: BACKUP_APP,
    schema: BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    counts: backupCounts(data),
    checksum: await sha256Hex(JSON.stringify(data)),
    data
  };
}

// Devuelve { ok:true, backup } o { ok:false, error }.
async function validateBackup(backup) {
  if (!backup || typeof backup !== "object" || backup.app !== BACKUP_APP) {
    return { ok: false, error: "El archivo no es un respaldo de Semilla Dorada." };
  }
  if (!Number.isInteger(backup.schema) || backup.schema < 1 || backup.schema > BACKUP_SCHEMA) {
    return { ok: false, error: "El respaldo es de una versión más nueva de la aplicación. Actualiza la app primero." };
  }
  if (!backup.data || typeof backup.data !== "object" || Array.isArray(backup.data)) {
    return { ok: false, error: "El respaldo no contiene datos válidos." };
  }
  if (await sha256Hex(JSON.stringify(backup.data)) !== backup.checksum) {
    return { ok: false, error: "El respaldo está dañado o fue modificado (la suma de verificación no coincide)." };
  }
  const known = new Set(Object.values(KEYS));
  const suppliedKeys = Object.keys(backup.data);
  if (suppliedKeys.length !== known.size || [...known].some(key => !Object.prototype.hasOwnProperty.call(backup.data, key))) {
    return { ok: false, error: "El respaldo está incompleto. No se modificó ningún dato." };
  }
  for (const [key, value] of Object.entries(backup.data)) {
    if (!known.has(key)) return { ok: false, error: "El respaldo contiene datos desconocidos." };
    if (BACKUP_ARRAY_KEYS.includes(key) && !Array.isArray(value)) return { ok: false, error: "Un bloque de datos del respaldo no tiene el formato esperado." };
    if (BACKUP_OBJECT_KEYS.includes(key) && (!value || typeof value !== "object" || Array.isArray(value))) return { ok: false, error: "Un bloque de datos del respaldo no tiene el formato esperado." };
    if (BACKUP_NUMBER_KEYS.includes(key) && (!Number.isInteger(value) || value < 1)) return { ok: false, error: "El consecutivo de tiendas del respaldo no es válido." };
    if (Array.isArray(value) && value.length > 100000) return { ok: false, error: "El respaldo contiene demasiados registros." };
  }
  const data = backup.data;
  if (!data[KEYS.sales].every(validSaleRecord) || !data[KEYS.entries].every(validEntryRecord)) return { ok: false, error: "Una nota o entrada del respaldo tiene campos o cantidades inválidas." };
  if (!data[KEYS.stores].every(store => isPlainRecord(store) && typeof store.id === "string" && typeof store.name === "string" && store.name.length <= 200)) return { ok: false, error: "Una tienda del respaldo no tiene un formato válido." };
  if (!data[KEYS.salesArchives].every(archive => isPlainRecord(archive) && Array.isArray(archive.notes) && archive.notes.every(validSaleRecord))) return { ok: false, error: "El historial archivado de ventas no tiene un formato válido." };
  if (!data[KEYS.entriesArchives].every(archive => isPlainRecord(archive) && Array.isArray(archive.entries) && archive.entries.every(validEntryRecord))) return { ok: false, error: "El historial archivado de entradas no tiene un formato válido." };
  for (const key of [KEYS.prices, KEYS.cashPrices]) {
    if (Object.values(data[key]).some(value => !Number.isFinite(value) || value < 0 || value > 100000000)) return { ok: false, error: "Una lista de precios del respaldo contiene importes inválidos." };
  }
  if (!Number.isFinite(data[KEYS.commission].rate) || data[KEYS.commission].rate < 0 || data[KEYS.commission].rate > 100) return { ok: false, error: "El porcentaje de comisión del respaldo no es válido." };
  if (!Number.isFinite(Date.parse(backup.exportedAt))) return { ok: false, error: "La fecha del respaldo no es válida." };
  return { ok: true, backup };
}

// Reemplaza TODOS los datos del dispositivo por los del respaldo.
// Antes guarda una copia interna de los datos actuales (clave PRE_RESTORE_KEY).
async function restoreBackup(backup) {
  const checked = await validateBackup(backup);
  if (!checked.ok) throw new Error(checked.error);

  const previous = { at: new Date().toISOString(), data: snapshotAll() };
  if (db && storageMode === "indexeddb-encrypted") {
    await dbPut(PRE_RESTORE_KEY, previous);
  }

  const entriesToWrite = Object.values(KEYS).map(key => {
    if (Object.prototype.hasOwnProperty.call(backup.data, key)) return [key, backup.data[key]];
    return [key, BACKUP_ARRAY_KEYS.includes(key) ? [] : JSON.parse(JSON.stringify(defaultFor(key)))];
  });
  await writeMany(entriesToWrite);
  await ensureStoreCodes();
}

function defaultFor(key) {
  if (key === KEYS.prices) return DEFAULT_PRICES;
  if (key === KEYS.commission) return { rate: 0 };
  if (key === KEYS.cashPrices) return DEFAULT_CASH_PRICES;
  if (key === KEYS.cashCatalog) return DEFAULT_CASH_CATALOG;
  if (key === KEYS.storeSequence) return 1;
  return [];
}
