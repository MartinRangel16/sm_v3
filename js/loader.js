// Primero se cargan todas las pantallas y después la lógica de la aplicación.
  // Esto permite que cada pantalla viva en su propio archivo HTML y funcione
  // también sin conexión cuando el Service Worker ya guardó los recursos.
  (async function loadApplication() {
    
    const screens = [
      ["home", "./screens/home.html"],
      ["sale", "./screens/sales.html"],
      ["cash-sale", "./screens/cash-sales.html"],
      ["stores", "./screens/stores.html"],
      ["prices", "./screens/prices.html"],
      ["history", "./screens/history.html"],
      ["sales-archives", "./screens/sales-archives.html"],
      ["entries", "./screens/entries.html"],
      ["entry-history", "./screens/entry-history.html"],
      ["commission", "./screens/commission.html"]
];

    const container = document.getElementById("screen-container");
    try {
      const fragments = await Promise.all(screens.map(async ([name, url]) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error("No se pudo cargar " + url);
        return [name, await response.text()];
      }));
      container.replaceChildren();
      for (const [name, markup] of fragments) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = markup;
        while (wrapper.firstElementChild) container.append(wrapper.firstElementChild);
      }

      const scripts = [
        "./users-config.js",
        "./js/storage.js",
        "./js/utils.js",
        "./js/qr.js",
        "./js/backup.js",
        "./js/icons.js",
        "./js/auth.js",
        "./js/navigation.js",
        "./js/app-core.js",
        "./js/app-scanner.js",
        "./js/app-sales.js",
        "./js/app-stores.js",
        "./js/app-history.js",
        "./js/app-commission.js",
        "./js/app-export.js",
        "./js/app-settings.js"
      ];
      for (const src of scripts) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = src;
          script.onload = resolve;
          script.onerror = () => reject(new Error("No se pudo cargar " + src));
          document.body.append(script);
        });
      }
    } catch (error) {
      const card = document.createElement("section");
      card.className = "card";
      const title = document.createElement("h1");
      title.textContent = "No se pudo cargar la aplicación";
      const text = document.createElement("p");
      text.textContent = "Abre la aplicación una vez con conexión para guardar todos los archivos necesarios y vuelve a intentarlo sin conexión.";
      card.append(title, text);
      container.replaceChildren(card);
      console.error(error);
    }
  })();
