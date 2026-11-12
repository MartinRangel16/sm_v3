/* Iconos locales estilo Lucide: SVG embebido, sin CDN ni dependencia de Internet. */
(() => {
  const paths = {
    "layout-dashboard": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    "receipt-text": '<path d="M4 2v20l3-2 3 2 3-2 3 2 4-2V2H4Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    "store": '<path d="m3 10 2-6h14l2 6"/><path d="M4 10v10h16V10M3 10a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/><path d="M9 20v-5h6v5"/>',
    "tags": '<path d="M20.6 13.4 11 3.8A2 2 0 0 0 9.6 3H4a1 1 0 0 0-1 1v5.6a2 2 0 0 0 .6 1.4l9.6 9.6a2 2 0 0 0 2.8 0l4.6-4.6a2 2 0 0 0 0-2.6Z"/><circle cx="7.5" cy="7.5" r=".8"/>',
    "clipboard-list": '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4.5h6a1 1 0 0 0-1-1h-1V2h-2v1.5h-1a1 1 0 0 0-1 1ZM9 10h6M9 14h6M9 18h3"/>',
    "archive": '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 12h4"/>',
    "package-plus": '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.3 7.7 7.7 4.4 7.7-4.4M12 12v9M16 4.8v4M14 6.8h4"/>',
    "history": '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    "calculator": '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8v4H8zM8 14h2M14 14h2M8 18h2M14 18h2"/>',
    "package": '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9"/>',
    "banknote": '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h.01M18 15h.01"/>',
    "sprout": '<path d="M12 22v-9"/><path d="M12 13C5 13 3 9 3 4c5 0 9 2 9 9ZM12 17c0-5 3-8 9-8 0 5-3 8-9 8Z"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.8Z"/>',
    "chevron-right": '<path d="m9 18 6-6-6-6"/>',
    "arrow-up-right": '<path d="M7 17 17 7M7 7h10v10"/>'
  };
  function draw(el) {
    const name = el.getAttribute("data-lucide");
    const body = paths[name];
    if (!body) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = body;
    el.replaceChildren(svg);
  }
  document.querySelectorAll("[data-lucide]").forEach(draw);
  window.SDIcons = { refresh: () => document.querySelectorAll("[data-lucide]").forEach(draw) };
})();
