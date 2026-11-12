#!/usr/bin/env node
// Regenera en sw.js la lista de archivos a guardar sin conexión (ASSETS) y la VERSION
// (hash del contenido). Uso, desde la carpeta de la app:   node herramientas/actualizar-sw.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const EXCLUDE_DIRS = new Set(["herramientas", ".git", "node_modules"]);
const EXCLUDE_FILES = new Set(["sw.js", "README.md", ".gitignore", "users-config.example.js", ".DS_Store"]);

function walk(dir, base = "") {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + "/" + entry.name : entry.name;
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) found.push(...walk(path.join(dir, entry.name), rel));
    } else if (!EXCLUDE_FILES.has(entry.name) && !/respaldo.*\.json$/i.test(entry.name)) {
      found.push(rel);
    }
  }
  return found;
}

const files = walk(root).sort();
const hash = crypto.createHash("sha1");
for (const file of files) {
  hash.update(file + "\0");
  hash.update(fs.readFileSync(path.join(root, file)));
}
const version = "v" + hash.digest("hex").slice(0, 10);

const assets = ["./", ...files.map(file => "./" + file)];
const swPath = path.join(root, "sw.js");
let sw = fs.readFileSync(swPath, "utf8");
sw = sw.replace(/\/\/ VERSION-START[\s\S]*?\/\/ VERSION-END/, `// VERSION-START\nconst VERSION = "${version}";\n// VERSION-END`);
sw = sw.replace(/\/\/ ASSETS-START[\s\S]*?\/\/ ASSETS-END/, `// ASSETS-START\nconst ASSETS = ${JSON.stringify(assets, null, 2)};\n// ASSETS-END`);
fs.writeFileSync(swPath, sw);
console.log(`sw.js actualizado: ${version}, ${assets.length} archivos en caché sin conexión.`);
