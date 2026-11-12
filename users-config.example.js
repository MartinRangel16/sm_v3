// EJEMPLO. Copia este archivo como users-config.js y reemplaza los valores.
// Genera salt y hash con herramientas/configurar-acceso.html (ábrela en tu equipo, no la publiques).
// Nota: esta validación es una barrera básica local; no cifra los datos guardados en el dispositivo.
window.SD_USERS = [
  {
    username: "usuario",
    name: "Nombre visible",
    salt: "<32 caracteres hexadecimales>",
    hash: "<64 caracteres hexadecimales>",
    iterations: 180000
  }
];
