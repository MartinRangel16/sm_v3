// Generador QR local y sin dependencias externas para identificadores cortos de tienda.
// QR versión 1-L: hasta 17 bytes en modo byte. No incorpora datos comerciales.
(function () {
  function matrixFor(text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    if (bytes.length > 17) throw new Error('El identificador excede la capacidad del QR local.');
    const bits = [];
    const append = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
    append(0b0100, 4); append(bytes.length, 8); bytes.forEach(byte => append(byte, 8));
    append(0, Math.min(4, 152 - bits.length));
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let value = 0;
      for (let j = 0; j < 8; j++) value = (value << 1) | bits[i + j];
      data.push(value);
    }
    let pad = 0;
    while (data.length < 19) data.push((pad++ % 2) === 0 ? 0xEC : 0x11);

    const exp = new Array(512), log = new Array(256);
    let x = 1;
    for (let i = 0; i < 255; i++) { exp[i] = x; log[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
    for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
    const multiply = (a, b) => (!a || !b) ? 0 : exp[log[a] + log[b]];
    let generator = [1];
    for (let i = 0; i < 7; i++) {
      const next = new Array(generator.length + 1).fill(0);
      for (let j = 0; j < generator.length; j++) {
        next[j] ^= generator[j];
        next[j + 1] ^= multiply(generator[j], exp[i]);
      }
      generator = next;
    }
    const remainder = data.concat(new Array(7).fill(0));
    for (let i = 0; i < 19; i++) {
      const factor = remainder[i];
      if (factor) for (let j = 0; j < generator.length; j++) remainder[i + j] ^= multiply(generator[j], factor);
    }
    const codewords = data.concat(remainder.slice(19));
    const size = 21;
    const modules = Array.from({ length: size }, () => Array(size).fill(false));
    const reserved = Array.from({ length: size }, () => Array(size).fill(false));
    function set(x, y, value) {
      if (x >= 0 && x < size && y >= 0 && y < size) { modules[y][x] = !!value; reserved[y][x] = true; }
    }
    function finder(cx, cy) {
      for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
        const inside = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        const black = inside && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        set(cx + dx, cy + dy, black);
      }
    }
    finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
    for (let i = 8; i < size - 8; i++) { set(i, 6, i % 2 === 0); set(6, i, i % 2 === 0); }

    const formatData = 1 << 3; // Corrección L (01), máscara 0.
    let formatRemainder = formatData;
    for (let i = 0; i < 10; i++) formatRemainder = (formatRemainder << 1) ^ (((formatRemainder >>> 9) & 1) * 0x537);
    const format = ((formatData << 10) | formatRemainder) ^ 0x5412;
    const formatBit = i => ((format >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(8, i, formatBit(i));
    set(8, 7, formatBit(6)); set(8, 8, formatBit(7)); set(7, 8, formatBit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, formatBit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, formatBit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, formatBit(i));
    set(8, size - 8, true);

    let bitIndex = 0, upward = true;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < size; vertical++) {
        const y = upward ? size - 1 - vertical : vertical;
        for (let j = 0; j < 2; j++) {
          const xx = right - j;
          if (!reserved[y][xx]) {
            let value = bitIndex < codewords.length * 8
              ? ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0
              : false;
            bitIndex++;
            if ((xx + y) % 2 === 0) value = !value; // máscara 0
            modules[y][xx] = value;
          }
        }
      }
      upward = !upward;
    }
    return modules;
  }

  function svgDataUrl(text, scale = 6, quiet = 4) {
    const matrix = matrixFor(text);
    const size = matrix.length;
    const full = size + quiet * 2;
    const paths = [];
    matrix.forEach((row, y) => row.forEach((dark, x) => {
      if (dark) paths.push(`M${x + quiet},${y + quiet}h1v1h-1z`);
    }));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges"><rect width="${full}" height="${full}" fill="#fff"/><path d="${paths.join('')}" fill="#111"/></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  window.SDQR = {
    payloadForStore: code => `SDT1:${code}`,
    dataUrl: svgDataUrl,
    matrix: matrixFor
  };
})();
