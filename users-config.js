// CREDENCIALES LOCALES DE DEMOSTRACIÓN.
// Antes de distribuir, cambia el usuario, la sal y el hash con el generador incluido.
// Esto NO equivale a autenticación robusta: los archivos del cliente pueden modificarse.
// Para habilitar la página de precios en efectivo, agrega role: "admin" SOLO
// al usuario que deba administrar el catálogo. Los demás usuarios no deben llevar ese rol.
window.SD_USERS = [
  { username: "Veronica", 
    salt: "8b8278e3e22088475f7d02832bee8143", 
    hash: "a721f15c86f58f162c3fcd9e60349002c0eb5beb707f28f5b008fd5e8cfd0fe3", 
    iterations: 180000
  },
  { 
    username: "Miguel", 
    salt: "dc266d1dc2c7b2f7a15afb1c90a61043", 
    hash: "f0715ef509f579cc589ce3bceb4d65d1c01b197790c982f9fe6dd3e0cdfd79fe", 
    iterations: 180000 },
  { 
      username: "Susana", 
      salt: "c214f3cfdad98c94e9b55d31b8b8352d", 
      hash: "4810436d96a09fbdd187cb81a267e7d0afb04b3779fd1d9c1fef7823a990b610", 
      iterations: 180000 
  }
];
