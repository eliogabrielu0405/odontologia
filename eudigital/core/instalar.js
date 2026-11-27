/* Instalar el panel como app: queda con su ícono en el teléfono o la computadora y abre directo en /panel/.
   Donde el navegador lo permite, se instala con un toque; donde no (iPhone, navegadores dentro de otras
   apps), se muestran los pasos. Lo usan la portada, el registro y el panel. */
(function () {
  "use strict";
  const EU = (window.EU = window.EU || {});
  const ua = navigator.userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  // Instagram, Facebook, TikTok y otras apps abren los enlaces en su propio navegador, que no instala apps
  const dentroDeApp = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Line\/|; wv\)/.test(ua);
  const oyentes = [];
  let evento = null;
  let repintarVentana = null;
  const avisar = () => [repintarVentana, ...oyentes].forEach((f) => { try { if (f) f(); } catch (_) { /* un oyente roto no frena a los demás */ } });

  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); evento = e; avisar(); });
  addEventListener("appinstalled", () => { evento = null; avisar(); });
  const seguro = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if ("serviceWorker" in navigator && seguro) {
    try { navigator.serviceWorker.register("/panel/sw.js", { scope: "/panel/" }).catch(() => { /* sin app instalable */ }); } catch (_) { /* nada */ }
  }

  function el(tag, props, ...hijos) {
    const e = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v);
    });
    hijos.flat().forEach((x) => { if (x != null && x !== false) e.append(x.nodeType ? x : String(x)); });
    return e;
  }

  const app = (EU.app = {
    ios, android, dentroDeApp,
    get instalada() { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; },
    get lista() { return !!evento; },
    alCambiar(f) { oyentes.push(f); },

    // Pasos a mano, según el teléfono o la computadora
    pasos() {
      if (dentroDeApp) return ["Toca el menú de arriba (los tres puntos) y elige \"Abrir en el navegador\" o \"Abrir en Chrome\".", "Ya en el navegador, vuelve a tocar \"Instalar la app\"."];
      if (ios) return ["Abre esta página en Safari.", "Toca el botón Compartir: el cuadro con la flecha hacia arriba.", "Baja y elige \"Agregar a inicio\"."];
      if (android) return ["Toca el menú de tres puntos del navegador, arriba a la derecha.", "Elige \"Agregar a pantalla principal\" o \"Instalar app\"."];
      return ["En Chrome o Edge, busca el ícono de instalar al final de la barra de direcciones.", "También está en el menú del navegador: \"Guardar y compartir\" y luego \"Instalar página como app\"."];
    },

    // Con un toque donde se puede. Devuelve "ok", "no" (la persona dijo que no) o "manual" (hay que seguir los pasos).
    async instalar() {
      if (!evento) return "manual";
      const e = evento;
      evento = null;
      try { e.prompt(); const r = await e.userChoice; avisar(); return r && r.outcome === "accepted" ? "ok" : "no"; }
      catch (_) { avisar(); return "manual"; }
    },

    // Ventana con el botón de instalar o los pasos
    abrir() {
      const viejo = document.getElementById("eu-instalar");
      if (viejo) viejo.remove();
      const cuerpo = el("div", { class: "modal-cuerpo" });
      const pie = el("div", { class: "modal-pie" });
      const d = el("dialog", { class: "modal", id: "eu-instalar", "aria-labelledby": "eu-instalar-t" },
        el("div", { class: "modal-cab" }, el("h2", { id: "eu-instalar-t" }, "Instalar la app"),
          el("button", { class: "cerrar-x", type: "button", "aria-label": "Cerrar", onclick: () => d.close() }, "×")),
        cuerpo, pie);
      const pintar = () => {
        if (app.instalada) {
          cuerpo.replaceChildren(el("p", { class: "banda verde" }, "Ya estás usando la app instalada."));
          pie.replaceChildren(el("button", { class: "btn", type: "button", onclick: () => d.close() }, "Listo"));
          return;
        }
        const intro = el("p", {}, "Tu panel queda con su ícono, como cualquier app: entras con un toque para cambiar precios, la tasa del día o ver tus pedidos. No ocupa espacio ni pasa por la tienda de apps.");
        if (evento) {
          const ok = el("button", { class: "btn", type: "button" }, "Instalar ahora");
          ok.addEventListener("click", async () => {
            ok.disabled = true;
            const r = await app.instalar();
            if (r === "ok") { cuerpo.replaceChildren(el("p", { class: "banda verde" }, "Listo. Busca el ícono de Tiendo en tu pantalla de inicio.")); pie.replaceChildren(el("button", { class: "btn", type: "button", onclick: () => d.close() }, "Cerrar")); }
            else pintar();
          });
          cuerpo.replaceChildren(intro);
          pie.replaceChildren(el("button", { class: "btn btn-sec", type: "button", onclick: () => d.close() }, "Ahora no"), ok);
          return;
        }
        cuerpo.replaceChildren(intro,
          el("div", {}, el("p", { style: "font-weight:700;margin-bottom:6px" }, ios ? "En iPhone o iPad se instala así:" : "Se instala así:"),
            el("ol", { class: "pasos-app" }, app.pasos().map((p) => el("li", {}, p)))),
          location.pathname.indexOf("/panel") !== 0 ? el("p", { class: "suave chico" }, "Si ya tienes cuenta, también puedes instalarla desde tu panel.") : null);
        pie.replaceChildren(
          location.pathname.indexOf("/panel") !== 0 ? el("a", { class: "btn btn-sec", href: "/panel/" }, "Ir a mi panel") : el("span", {}),
          el("button", { class: "btn", type: "button", onclick: () => d.close() }, "Entendido"));
      };
      pintar();
      repintarVentana = pintar;
      d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
      d.addEventListener("close", () => { repintarVentana = null; d.remove(); });
      document.body.append(d);
      d.showModal();
      return d;
    },
  });
})();
