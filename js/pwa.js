
// Registro del Service Worker, aviso de actualización y avisos generales de la app.
(function () {
  // Aviso fijo en la parte inferior. Solo usa textContent (sin HTML).
  function banner(text, label, onClick) {
    let el = document.getElementById("app-banner");

    if (!el) {
      el = document.createElement("div");
      el.id = "app-banner";
      el.className = "app-banner";
      el.setAttribute("role", "status");
      document.body.append(el);
    }

    el.replaceChildren();

    const span = document.createElement("span");
    span.textContent = text;
    el.append(span);

    if (label) {
      const action = document.createElement("button");
      action.type = "button";
      action.textContent = label;
      action.addEventListener("click", onClick);
      el.append(action);
    }

    const close = document.createElement("button");
    close.type = "button";
    close.className = "app-banner-close";
    close.setAttribute("aria-label", "Cerrar aviso");
    close.textContent = "×";
    close.addEventListener("click", () => el.remove());
    el.append(close);
  }

  window.sdShowBanner = banner;

  if (!("serviceWorker" in navigator)) return;

  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        "./sw.js",
        { updateViaCache: "none" }
      );

      const offerUpdate = worker => banner(
        "Hay una versión nueva de la aplicación. Termina lo que estás capturando y actualiza.",
        "Actualizar",
        () => worker.postMessage({ type: "SKIP_WAITING" })
      );

      if (registration.waiting && navigator.serviceWorker.controller) {
        offerUpdate(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener("statechange", () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            offerUpdate(worker);
          }
        });
      });

      const check = () => registration.update().catch(() => {});

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });

      setInterval(check, 60 * 60 * 1000);

    } catch (error) {
      console.error("Error al registrar el Service Worker:", error);
    }
  });
})();
