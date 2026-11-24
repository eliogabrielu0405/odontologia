/* Editor de formularios a partir de una lista de campos.
   Cada plantilla describe lo que el cliente puede cambiar (datos.js) y este archivo
   arma los controles: textos, precios, fotos, listas, horarios, colores... */
(function () {
  "use strict";
  const EU = window.EU;
  const K = window.EU_CATALOGOS;
  const h = EU.h;
  let contadorId = 0;
  const nuevoId = (p) => (p || "c") + "-" + (++contadorId) + "-" + Math.random().toString(36).slice(2, 6);
  const FLECHA = '<svg class="flecha" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

  /* ---------- Avisos y ventanas ---------- */
  let avisoT;
  EU.aviso = function (texto, mal) {
    document.querySelectorAll(".aviso-flota").forEach((x) => x.remove());
    const a = h("div", { class: "aviso-flota" + (mal ? " mal" : ""), role: mal ? "alert" : "status" }, texto);
    document.body.append(a);
    clearTimeout(avisoT);
    avisoT = setTimeout(() => a.remove(), mal ? 4200 : 2400);
  };

  EU.modal = function ({ titulo, ancho, construir, alCerrar }) {
    const idT = nuevoId("t");
    const cuerpo = h("div", { class: "modal-cuerpo" });
    const pie = h("div", { class: "modal-pie" });
    const d = h("dialog", { class: "modal" + (ancho ? " ancho" : ""), "aria-labelledby": idT },
      h("div", { class: "modal-cab" }, h("h2", { id: idT }, titulo), h("button", { class: "cerrar-x", type: "button", "aria-label": "Cerrar", onclick: () => d.close() }, "×")),
      cuerpo, pie);
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    d.addEventListener("close", () => { d.remove(); if (alCerrar) alCerrar(); });
    document.body.append(d);
    const m = { d, cuerpo, pie, cerrar: () => { if (d.open) d.close(); }, titulo: (t) => { d.querySelector("h2").textContent = t; } };
    if (construir) construir(m);
    pie.hidden = !pie.childNodes.length;
    d.showModal();
    return m;
  };

  /* ---------- Editor ---------- */
  EU.crearEditor = function (op) {
    const raiz = op.raiz;
    const condicionales = [];

    const norm = (x) => (typeof x === "string" || typeof x === "number")
      ? { id: String(x), nombre: String(x) }
      : { id: x.id == null ? "" : String(x.id), nombre: String(x.nombre || x.titulo || x.talla || x.id || "") };
    function opcionesDe(def) {
      const o = def.opciones;
      if (Array.isArray(o)) return o.map(norm);
      if (o && o.desde) { const l = EU.obtener(raiz(), o.desde); return Array.isArray(l) ? l.filter((x) => x != null && x !== "").map(norm) : []; }
      return [];
    }
    function enlace(def, obj) {
      const ruta = def.clave != null ? def.clave : def.ruta;
      if (ruta === "$nombre") return { get: () => op.nombre(), set: (v) => op.nombre(v) };
      const base = () => (obj || raiz());
      return { get: () => EU.obtener(base(), ruta), set: (v) => EU.poner(base(), ruta, v) };
    }
    function cambio(def, extra) {
      for (let i = condicionales.length - 1; i >= 0; i--) {
        const c = condicionales[i];
        if (!c.el.isConnected) { condicionales.splice(i, 1); continue; }
        c.el.hidden = !c.visible();
      }
      if (op.alCambiar) op.alCambiar(def, extra);
    }
    function caja(def, control, { legend } = {}) {
      const id = def._id || (def._id = nuevoId("f"));
      const etq = def.etiqueta ? (legend ? h("legend", {}, def.etiqueta) : h("label", { for: id }, def.etiqueta)) : null;
      const ayuda = def.ayuda ? h("p", { class: "ayuda", id: id + "-ayuda" }, def.ayuda) : null;
      const err = h("p", { class: "error-campo", role: "alert", hidden: true });
      const el = legend
        ? h("div", { class: "campo", "data-tipo": def.tipo }, h("fieldset", {}, etq, control, ayuda), err)
        : h("div", { class: "campo", "data-tipo": def.tipo }, etq, control, ayuda, err);
      el._error = (t) => { err.textContent = t || ""; err.hidden = !t; };
      return el;
    }
    const idDe = (def) => def._id || (def._id = nuevoId("f"));

    const TIPOS = {
      nota(def) { return h("p", { class: "banda azul" }, def.texto || def.etiqueta || ""); },

      texto(def, obj) {
        const b = enlace(def, obj);
        const inp = h("input", { class: "entrada", type: "text", id: idDe(def), value: b.get() == null ? "" : String(b.get()), maxlength: def.max || 200, placeholder: def.placeholder || "", autocomplete: "off" });
        if (def.ayuda) inp.setAttribute("aria-describedby", idDe(def) + "-ayuda");
        if (def.usuario) { inp.setAttribute("autocapitalize", "none"); inp.setAttribute("autocorrect", "off"); inp.spellcheck = false; }
        const el = caja(def, inp);
        inp.addEventListener("input", () => { b.set(inp.value); el._error(""); cambio(def); });
        inp.addEventListener("blur", () => {
          const v = inp.value.trim();
          if (v !== inp.value) { inp.value = v; b.set(v); cambio(def); }
          if (def.requerido && !v) el._error("Este dato no puede quedar vacío.");
        });
        el._validar = () => (def.requerido && !String(b.get() || "").trim() ? (el._error("Este dato no puede quedar vacío."), false) : true);
        return el;
      },

      telefono(def, obj) {
        const b = enlace(def, obj);
        const inp = h("input", { class: "entrada num", type: "tel", inputmode: "tel", id: idDe(def), value: b.get() || "", maxlength: 20, placeholder: def.placeholder || "584141234567", autocomplete: "off" });
        const ver = h("p", { class: "equivale" });
        const el = caja(def, inp);
        el.insertBefore(ver, el.querySelector(".ayuda") || el.lastChild);
        const pintar = () => {
          const d = EU.soloNumeros(inp.value);
          if (!d) { ver.textContent = ""; return; }
          if (d.startsWith("0")) { ver.textContent = "Quítale el 0 del principio y ponle el código del país. Ej: 58 414 1234567."; return; }
          ver.textContent = "Los pedidos llegan a: +" + d + (d.startsWith("58") && d.length === 12 ? " (" + EU.telefonoVisible(d) + ")" : "");
        };
        inp.addEventListener("input", () => { b.set(EU.soloNumeros(inp.value)); pintar(); cambio(def); });
        inp.addEventListener("blur", () => { inp.value = EU.soloNumeros(inp.value); });
        pintar();
        return el;
      },

      area(def, obj) {
        const b = enlace(def, obj);
        const max = def.max || 300;
        const ta = h("textarea", { class: "entrada", id: idDe(def), rows: def.filas || 3, maxlength: max, placeholder: def.placeholder || "", value: b.get() || "" });
        const cont = h("span", { class: "contador", "aria-hidden": "true" });
        const pintar = () => { cont.textContent = ta.value.length + "/" + max; };
        ta.addEventListener("input", () => { b.set(ta.value); pintar(); cambio(def); });
        ta.addEventListener("blur", () => { const v = ta.value.trim(); if (v !== ta.value) { ta.value = v; b.set(v); pintar(); cambio(def); } });
        pintar();
        const el = caja(def, ta);
        el.insertBefore(cont, ta.nextSibling);
        return el;
      },

      dinero(def, obj) {
        const b = enlace(def, obj);
        const v0 = Number(b.get()) || 0;
        const inp = h("input", { type: "text", inputmode: "decimal", id: idDe(def), value: v0.toFixed(2), autocomplete: "off" });
        const equiv = h("p", { class: "equivale" });
        const pintarBs = () => {
          const t = Number(EU.obtener(raiz(), "tasa.valor")) || 0;
          const n = Number(b.get()) || 0;
          equiv.textContent = t > 0 && n > 0 ? "Bs " + EU.fmtBs.format(n * t) + " con la tasa de hoy" : "";
        };
        inp.addEventListener("input", () => {
          const n = EU.numero(inp.value);
          const ok = inp.value.trim() === "" || (Number.isFinite(n) && n >= 0);
          inp.setAttribute("aria-invalid", String(!ok));
          if (ok) { b.set(inp.value.trim() === "" ? 0 : Math.round(n * 100) / 100); pintarBs(); cambio(def); }
        });
        inp.addEventListener("blur", () => { if (inp.getAttribute("aria-invalid") !== "true") inp.value = (Number(b.get()) || 0).toFixed(2); });
        inp.addEventListener("focus", () => { if (Number(EU.numero(inp.value)) === 0) inp.select(); });
        pintarBs();
        const el = caja(def, h("div", { class: "con-prefijo" }, h("span", {}, "$"), inp));
        el.insertBefore(equiv, el.querySelector(".ayuda") || el.lastChild);
        return el;
      },

      numero(def, obj) {
        const b = enlace(def, obj);
        const inp = h("input", { type: "text", inputmode: def.decimal ? "decimal" : "numeric", id: idDe(def), value: String(b.get() == null ? "" : b.get()), autocomplete: "off" });
        const limitar = (n) => Math.min(def.max == null ? Infinity : def.max, Math.max(def.min == null ? -Infinity : def.min, n));
        inp.addEventListener("input", () => {
          const n = EU.numero(inp.value);
          const ok = Number.isFinite(n);
          inp.setAttribute("aria-invalid", String(!ok && inp.value.trim() !== ""));
          if (ok) { b.set(def.decimal ? n : Math.round(n)); cambio(def); }
        });
        inp.addEventListener("blur", () => {
          const n = limitar(Number(b.get()) || 0);
          b.set(def.decimal ? n : Math.round(n)); inp.value = String(b.get()); inp.setAttribute("aria-invalid", "false"); cambio(def);
        });
        const ctl = def.sufijo ? h("div", { class: "con-prefijo" }, inp, h("span", { class: "der" }, def.sufijo)) : (inp.className = "entrada num", inp);
        return caja(def, ctl);
      },

      interruptor(def, obj) {
        const b = enlace(def, obj);
        const inp = h("input", { type: "checkbox", role: "switch", checked: !!b.get() });
        inp.addEventListener("change", () => { b.set(inp.checked); cambio(def); });
        const el = h("div", { class: "campo", "data-tipo": "interruptor" },
          h("label", { class: "interruptor" + (def.peligro ? " peligro" : "") }, h("span", { class: "txt" }, h("b", {}, def.etiqueta), def.ayuda ? h("span", { class: "ayuda" }, def.ayuda) : null), inp));
        return el;
      },

      selector(def, obj) {
        const b = enlace(def, obj);
        const ops = opcionesDe(def);
        const actual = b.get() == null ? "" : String(b.get());
        const corto = ops.length && ops.length <= 3 && ops.every((o) => o.nombre.length <= 16) && !def.lista;
        if (corto) {
          const seg = h("div", { class: "segmento", role: "group", "aria-label": def.etiqueta || "" });
          const pintar = () => seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === String(b.get() == null ? "" : b.get()))));
          ops.forEach((o) => seg.append(h("button", { type: "button", "data-v": o.id, onclick: () => { b.set(o.id); pintar(); cambio(def); } }, o.nombre)));
          pintar();
          return caja(def, seg, { legend: true });
        }
        const sel = h("select", { class: "entrada", id: idDe(def) });
        if (!ops.some((o) => o.id === actual)) sel.append(h("option", { value: actual, disabled: true, selected: true }, ops.length ? "Elige una opción" : "No hay opciones todavía"));
        ops.forEach((o) => sel.append(h("option", { value: o.id, selected: o.id === actual }, o.nombre)));
        sel.addEventListener("change", () => { b.set(sel.value); cambio(def); });
        return caja(def, sel);
      },

      multi(def, obj) {
        const b = enlace(def, obj);
        const ops = opcionesDe(def);
        let arr = b.get();
        if (!Array.isArray(arr)) { arr = []; b.set(arr); }
        const chips = h("div", { class: "chips", role: "group", "aria-label": def.etiqueta || "" });
        const el = caja(def, chips, { legend: true });
        const pintar = () => chips.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(b.get().map(String).includes(x.dataset.v))));
        ops.forEach((o) => chips.append(h("button", {
          class: "chip", type: "button", "data-v": o.id,
          onclick: () => {
            const a = b.get().map(String);
            const i = a.indexOf(o.id);
            if (i > -1) {
              if (def.minimo && a.length <= def.minimo) { el._error("Deja al menos " + def.minimo + "."); return; }
              a.splice(i, 1);
            } else a.push(o.id);
            // se guarda en el mismo orden de las opciones
            b.set(ops.map((x) => x.id).filter((id) => a.includes(id)));
            el._error(""); pintar(); cambio(def);
          },
        }, o.nombre)));
        if (!ops.length) chips.append(h("p", { class: "ayuda" }, "Todavía no hay opciones para elegir."));
        pintar();
        return el;
      },

      color(def, obj) {
        const b = enlace(def, obj);
        const fila = h("div", { class: "color-fila" });
        const el = caja(def, fila);
        const pintar = () => {
          const v = EU.color(b.get());
          fila.replaceChildren();
          const pick = h("input", { type: "color", value: v || "#2a44c8", "aria-label": def.etiqueta || "Color" });
          const txt = h("input", { class: "entrada", type: "text", value: v ? v.toUpperCase() : "", placeholder: "#RRGGBB", maxlength: 7, "aria-label": (def.etiqueta || "Color") + " en código" });
          pick.addEventListener("input", () => { b.set(pick.value); txt.value = pick.value.toUpperCase(); cambio(def, { vivo: true }); });
          pick.addEventListener("change", () => { b.set(pick.value); cambio(def); if (!v) pintar(); });
          txt.addEventListener("change", () => {
            const c = EU.color(txt.value.startsWith("#") ? txt.value : "#" + txt.value);
            if (c) { b.set(c); pick.value = c; txt.value = c.toUpperCase(); cambio(def); if (!v) pintar(); }
            else if (!txt.value.trim() && def.opcional) { b.set(""); cambio(def); pintar(); }
            else txt.value = (EU.color(b.get()) || "").toUpperCase();
          });
          if (!v && def.opcional) {
            fila.append(h("span", { class: "muestra-vacia" }, "Sin"), h("button", { class: "btn btn-sec btn-chico", type: "button", onclick: () => { b.set(pick.value); cambio(def); pintar(); } }, "Elegir color"));
          } else {
            fila.append(pick, txt);
            if (def.opcional) fila.append(h("button", { class: "btn btn-plano btn-chico", type: "button", onclick: () => { b.set(""); cambio(def); pintar(); } }, "Quitar"));
          }
        };
        pintar();
        return el;
      },

      foto(def, obj) {
        const b = enlace(def, obj);
        const mini = h("div", { class: "foto-mini" + (def.forma === "redonda" ? " redonda" : "") + (def.cubre ? " cubre" : "") });
        const archivo = h("input", { type: "file", accept: "image/*", hidden: true });
        const btnSubir = h("button", { class: "btn btn-sec btn-chico", type: "button", onclick: () => archivo.click() }, "Subir foto");
        const btnGaleria = def.galeria && op.galeria && op.galeria.length ? h("button", { class: "btn btn-sec btn-chico", type: "button", onclick: elegirGaleria }, "Elegir de la plantilla") : null;
        const btnQuitar = h("button", { class: "btn btn-plano btn-chico", type: "button", onclick: () => { b.set(""); pintar(); cambio(def); } }, "Quitar");
        const el = caja(def, h("div", { class: "foto-fila" }, mini, h("div", { class: "acciones" }, btnSubir, btnGaleria, btnQuitar), archivo), { legend: true });
        function pintar(cargando) {
          const u = EU.url(b.get());
          mini.replaceChildren(u ? h("img", { src: u, alt: "" }) : h("span", {}, "Sin foto"));
          if (cargando) mini.append(h("span", { class: "cargando" }, "Subiendo"));
          btnQuitar.hidden = !u;
          btnSubir.textContent = u ? "Cambiar foto" : "Subir foto";
        }
        function elegirGaleria() {
          EU.modal({
            titulo: "Fotos de la plantilla", ancho: true,
            construir: (m) => {
              m.cuerpo.append(h("p", { class: "ayuda" }, "Toca una para usarla."),
                h("div", { class: "galeria" }, op.galeria.map((g) => h("button", { type: "button", onclick: () => { b.set(g.src); pintar(); cambio(def); m.cerrar(); } },
                  h("img", { src: g.src, alt: "", loading: "lazy" }), g.nombre))));
            },
          });
        }
        archivo.addEventListener("change", async () => {
          const f = archivo.files && archivo.files[0];
          archivo.value = "";
          if (!f) return;
          pintar(true);
          try { const url = await op.subirFoto(f, { max: def.max || 1000 }); b.set(url); cambio(def); EU.aviso("Foto lista. Recuerda guardar los cambios."); }
          catch (e) { EU.aviso(e.message || "No se pudo subir la foto.", true); }
          pintar();
        });
        pintar();
        return el;
      },

      fotos(def, obj) {
        const b = enlace(def, obj);
        if (!Array.isArray(b.get())) b.set([]);
        const rejilla = h("div", { class: "fotos-rejilla" });
        const archivo = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true });
        const btn = h("button", { class: "btn btn-sec btn-chico", type: "button", onclick: () => archivo.click() }, "Agregar fotos");
        const estado = h("p", { class: "ayuda", "aria-live": "polite" });
        const el = caja(def, h("div", { class: "campos" }, rejilla, h("div", { class: "acciones" }, btn, archivo), estado), { legend: true });
        const maximo = def.maximo || 12;
        function pintar() {
          const a = b.get();
          rejilla.replaceChildren(...a.map((u, i) => h("div", { class: "foto-mini" },
            h("img", { src: EU.url(u), alt: "Foto " + (i + 1), loading: "lazy" }),
            h("button", { class: "foto-quitar", type: "button", "aria-label": "Quitar foto " + (i + 1), onclick: () => { a.splice(i, 1); pintar(); cambio(def); } }, "×"),
            a.length > 1 ? h("span", { class: "foto-mover" },
              i > 0 ? h("button", { type: "button", "aria-label": "Mover antes", onclick: () => { [a[i - 1], a[i]] = [a[i], a[i - 1]]; pintar(); cambio(def); } }, "‹") : null,
              i < a.length - 1 ? h("button", { type: "button", "aria-label": "Mover después", onclick: () => { [a[i + 1], a[i]] = [a[i], a[i + 1]]; pintar(); cambio(def); } }, "›") : null) : null)));
          if (!a.length) rejilla.append(h("p", { class: "ayuda" }, "Sin fotos."));
          btn.disabled = a.length >= maximo;
        }
        archivo.addEventListener("change", async () => {
          const fs = Array.from(archivo.files || []).slice(0, maximo - b.get().length);
          archivo.value = "";
          for (let i = 0; i < fs.length; i++) {
            estado.textContent = `Subiendo ${i + 1} de ${fs.length}`;
            try { const url = await op.subirFoto(fs[i], { max: def.max || 1000 }); b.get().push(url); pintar(); cambio(def); }
            catch (e) { EU.aviso(e.message || "No se pudo subir una foto.", true); }
          }
          estado.textContent = fs.length ? "Fotos listas. Recuerda guardar los cambios." : "";
        });
        pintar();
        return el;
      },

      etiquetas(def, obj) {
        const b = enlace(def, obj);
        if (!Array.isArray(b.get())) b.set([]);
        const chips = h("div", { class: "chips" });
        const inp = h("input", { class: "entrada", type: "text", maxlength: def.largo || 30, placeholder: def.placeholder || "Escribe y toca Agregar", "aria-label": "Nueva: " + (def.etiqueta || "") });
        const agregar = () => {
          const v = inp.value.trim();
          if (!v) return;
          const a = b.get();
          if (a.length >= (def.max || 20)) { el._error("Llegaste al máximo de " + (def.max || 20) + "."); return; }
          if (!a.includes(v)) a.push(v);
          inp.value = ""; el._error(""); pintar(); cambio(def);
        };
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } });
        const el = caja(def, h("div", { class: "campos" }, chips, h("div", { class: "fila-agregar" }, inp, h("button", { class: "btn btn-sec btn-chico", type: "button", onclick: agregar }, "Agregar"))), { legend: true });
        function pintar() {
          const a = b.get();
          chips.replaceChildren(...a.map((t, i) => h("span", { class: "chip" }, t, h("button", { class: "x", type: "button", "aria-label": "Quitar " + t, onclick: () => { a.splice(i, 1); pintar(); cambio(def); } }, "×"))));
          if (!a.length) chips.append(h("span", { class: "ayuda" }, "Ninguna todavía."));
        }
        pintar();
        return el;
      },

      pares(def, obj) {
        const b = enlace(def, obj);
        if (!Array.isArray(b.get())) b.set([]);
        const filas = h("div", { class: "pares" });
        const btn = h("button", { class: "btn btn-sec btn-chico", type: "button", onclick: () => { b.get().push(["", ""]); pintar(true); cambio(def); } }, "Agregar dato");
        const el = caja(def, h("div", { class: "campos" }, filas, h("div", {}, btn)), { legend: true });
        function pintar(enfocar) {
          const a = b.get();
          filas.replaceChildren(...a.map((par, i) => {
            const k = h("input", { class: "entrada", type: "text", value: par[0] || "", maxlength: 30, placeholder: def.placeholderA || "Dato", "aria-label": "Nombre del dato " + (i + 1) });
            const v = h("input", { class: "entrada", type: "text", value: par[1] || "", maxlength: 80, placeholder: def.placeholderB || "Valor", "aria-label": "Valor del dato " + (i + 1) });
            k.addEventListener("input", () => { par[0] = k.value; cambio(def); });
            v.addEventListener("input", () => { par[1] = v.value; cambio(def); });
            return h("div", { class: "par" }, k, v, h("button", { class: "quitar", type: "button", "aria-label": "Quitar dato " + (i + 1), onclick: () => { a.splice(i, 1); pintar(); cambio(def); } }, "×"));
          }));
          if (!a.length) filas.append(h("p", { class: "ayuda" }, "Sin datos."));
          btn.disabled = a.length >= (def.max || 8);
          if (enfocar) { const ins = filas.querySelectorAll(".par input"); if (ins.length) ins[ins.length - 2].focus(); }
        }
        pintar();
        return el;
      },

      horario(def, obj) {
        const b = enlace(def, obj);
        if (!b.get() || typeof b.get() !== "object") b.set({});
        const cont = h("div", { class: "horario" });
        [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
          const H = b.get();
          const v = Array.isArray(H[d]) && H[d][0] ? H[d] : null;
          const sw = h("input", { type: "checkbox", role: "switch", checked: !!v, "aria-label": K.dias[d] + " abierto" });
          const a = h("input", { type: "time", value: v ? v[0] : "09:00", "aria-label": K.dias[d] + " abre" });
          const z = h("input", { type: "time", value: v ? (v[1] === "24:00" ? "00:00" : v[1]) : "18:00", "aria-label": K.dias[d] + " cierra" });
          const horas = h("div", { class: "horas" }, a, h("span", { class: "suave" }, "a"), z);
          const cerrado = h("span", { class: "cerrado-txt" }, "Cerrado");
          const pintar = () => { horas.hidden = !sw.checked; cerrado.hidden = sw.checked; };
          const guardar = () => { b.get()[d] = sw.checked ? [a.value || "09:00", z.value || "18:00"] : null; pintar(); cambio(def); };
          sw.addEventListener("change", guardar); a.addEventListener("change", guardar); z.addEventListener("change", guardar);
          pintar();
          cont.append(h("div", { class: "dia" }, h("b", {}, K.dias[d]), h("label", { class: "interruptor" }, sw), h("div", {}, horas, cerrado)));
        });
        const el = caja(def, cont, { legend: true });
        return el;
      },

      tasa(def, obj) {
        const b = enlace(def, obj);
        if (!b.get() || typeof b.get() !== "object") b.set({ valor: 0, fecha: "" });
        const t = b.get();
        const inp = h("input", { type: "text", inputmode: "decimal", id: idDe(def), value: t.valor ? EU.fmtBs.format(t.valor) : "", placeholder: "Ej: 36,50", autocomplete: "off" });
        const info = h("p", { class: "equivale" });
        const pintar = () => {
          const x = b.get();
          info.textContent = x.valor > 0 ? `$1 = Bs ${EU.fmtBs.format(x.valor)}. ${x.fecha === EU.hoyISO() ? "Actualizada hoy." : x.fecha ? "Actualizada el " + EU.fecha(x.fecha) + "." : ""}` : "Sin tasa: los precios se muestran solo en dólares.";
        };
        inp.addEventListener("input", () => {
          const n = EU.numero(inp.value);
          const ok = inp.value.trim() === "" || (Number.isFinite(n) && n >= 0);
          inp.setAttribute("aria-invalid", String(!ok));
          if (!ok) return;
          b.get().valor = inp.value.trim() === "" ? 0 : Math.round(n * 10000) / 10000;
          b.get().fecha = EU.hoyISO();
          pintar(); cambio(def);
        });
        inp.addEventListener("blur", () => { const x = b.get(); if (x.valor) inp.value = EU.fmtBs.format(x.valor); });
        pintar();
        const el = caja(def, h("div", { class: "con-prefijo" }, h("span", {}, "Bs"), inp, h("span", { class: "der" }, "por $1")));
        el.insertBefore(info, el.querySelector(".ayuda") || el.lastChild);
        return el;
      },

      // Mascota bailarina: una cuadrícula con todos los personajes bailando el baile elegido
      mascotas(def) {
        const M = window.EU_MASCOTAS, b = enlace(def);
        const baile = () => EU.obtener(op.raiz(), def.rutaBaile) || "meneo";
        const cont = h("div", { class: "mascotas", role: "group", "aria-label": def.etiqueta });
        const opciones = [{ id: "ninguna", nombre: "Sin mascota" }, ...M.personajes];
        const pintar = () => cont.querySelectorAll(".mascota-op").forEach((x, i) => {
          x.setAttribute("aria-pressed", String((b.get() || "ninguna") === opciones[i].id));
          const d = x.querySelector(".eu-mascota"); if (d) d.className = "eu-mascota eu-baile-" + baile();
        });
        opciones.forEach((o) => {
          const dibujo = h("span", { class: "eu-mascota", "aria-hidden": "true" });
          if (o.id === "ninguna") dibujo.className = "mascota-nada"; else dibujo.innerHTML = M.svg(o.id);
          cont.append(h("button", { class: "mascota-op", type: "button", onclick: () => { b.set(o.id); pintar(); cambio(def); } }, dibujo, h("span", {}, o.nombre)));
        });
        pintar();
        cont._repintar = pintar;
        return caja(def, cont, { legend: true });
      },

      temas(def) {
        const temas = (op.plantilla && op.plantilla.temas) || [];
        const b = enlace({ ruta: "tema.preset" });
        const cont = h("div", { class: "temas", role: "group", "aria-label": "Temas" });
        const pintar = () => cont.querySelectorAll(".tema").forEach((x, i) => x.setAttribute("aria-pressed", String((b.get() || temas[0].id) === temas[i].id)));
        temas.forEach((t) => cont.append(h("button", { class: "tema", type: "button", onclick: () => { b.set(t.id); pintar(); cambio({ ruta: "tema.preset", tipo: "temas" }); } },
          h("span", { class: "tiras", "aria-hidden": "true" }, (t.muestra || []).map((c) => h("i", { style: "background:" + (EU.color(c) || "#ccc") }))), t.nombre)));
        pintar();
        return caja({ etiqueta: def.etiqueta || "Tema", ayuda: def.ayuda, tipo: "temas" }, cont, { legend: true });
      },

      agotados(def) {
        const lista = EU.obtener(raiz(), def.ruta);
        const items = Array.isArray(lista) ? lista.filter((x) => x && x.nombre) : [];
        const cont = h("div", { class: "lista" });
        const buscar = items.length > 12 ? h("input", { class: "entrada", type: "search", placeholder: "Buscar por nombre", "aria-label": "Buscar en " + def.titulo }) : null;
        const filas = items.map((it) => {
          const sw = h("input", { type: "checkbox", role: "switch", checked: !!it.agotado, "aria-label": it.nombre + " agotado" });
          sw.addEventListener("change", () => { it.agotado = sw.checked; cambio(def); });
          const f = h("label", { class: "fila interruptor peligro", style: "grid-template-columns:minmax(0,1fr) auto" }, h("span", { class: "fila-txt" }, h("b", {}, it.nombre)), sw);
          f._nombre = String(it.nombre).toLowerCase();
          return f;
        });
        cont.append(...filas);
        if (!items.length) cont.append(h("p", { class: "lista-vacia" }, "No hay nada en esta lista todavía."));
        if (buscar) buscar.addEventListener("input", () => { const q = buscar.value.trim().toLowerCase(); filas.forEach((f) => { f.hidden = q && !f._nombre.includes(q); }); });
        return caja({ etiqueta: def.titulo, ayuda: def.ayuda || "Enciende lo que se acabó hoy. En la página sale como agotado.", tipo: "agotados" }, h("div", { class: "campos" }, buscar, cont), { legend: true });
      },

      grupo(def, obj) {
        return h("div", { class: "campo", "data-tipo": "grupo" },
          def.etiqueta ? h("h3", { style: "font-size:17px" }, def.etiqueta) : null,
          def.ayuda ? h("p", { class: "ayuda" }, def.ayuda) : null,
          campos(def.campos || [], obj));
      },

      lista(def, obj) {
        const b = enlace(def, obj);
        if (!Array.isArray(b.get())) b.set([]);
        const items = () => b.get();
        const contador = h("span", { class: "suave chico num" });
        const cont = h("div", { class: "lista" });
        const btnNuevo = h("button", { class: "btn btn-sec btn-chico", type: "button", onclick: () => agregar() }, "Agregar " + (def.item || "uno"));
        const el = h("div", { class: "campo", "data-tipo": "lista" },
          h("div", { class: "hoja-fila" }, h("span", { class: "etq" }, def.etiqueta, " ", contador), btnNuevo),
          def.ayuda ? h("p", { class: "ayuda" }, def.ayuda) : null,
          cont);
        const tituloDe = (it) => String(it[def.titulo || "nombre"] || "").trim() || "Sin nombre";
        function miniDe(it) {
          const foto = EU.url(def.foto ? it[def.foto] : def.fotoDe ? EU.obtener(it, def.fotoDe) : "");
          if (foto) return h("span", { class: "fila-mini" + (def.foto ? " contiene" : "") }, h("img", { src: foto, alt: "", loading: "lazy" }));
          if (def.muestra && EU.color(it[def.muestra])) return h("span", { class: "fila-mini", style: "background:" + EU.color(it[def.muestra]) });
          const letra = it.emoji || it.kanji || tituloDe(it).slice(0, 1).toUpperCase();
          return h("span", { class: "fila-mini", "aria-hidden": "true" }, letra);
        }
        function subDe(it) {
          if (def.precio) return EU.usd(it[def.precio]);
          if (def.sub) return String(EU.obtener(it, def.sub) || "");
          return String(it.desc || it.descripcion || it.nota || it.detalle || "");
        }
        function grupos() {
          const a = items();
          const g = def.agrupar;
          if (!g) return null;
          let lista;
          if (g.desde) {
            lista = (EU.obtener(raiz(), g.desde) || []).filter((x) => x && x.id).map((x) => ({ id: String(x.id), nombre: String(x.nombre || x.id) }));
          } else {
            const vistos = [];
            a.forEach((it) => { const v = String(it[g.clave] || "").trim(); if (!vistos.includes(v)) vistos.push(v); });
            lista = vistos.map((v) => ({ id: v, nombre: v || "Sin grupo" }));
          }
          const conocidos = new Set(lista.map((x) => x.id));
          const huerfanos = a.filter((it) => !conocidos.has(String(it[g.clave] == null ? "" : it[g.clave]).trim()));
          const out = lista.map((x) => ({ id: x.id, nombre: x.nombre, items: a.filter((it) => String(it[g.clave] == null ? "" : it[g.clave]).trim() === x.id) }));
          if (huerfanos.length) out.push({ id: null, nombre: "Sin categoría (edítalos y elige una)", items: huerfanos });
          return out;
        }
        function fila(it) {
          const f = h("button", { class: "fila", type: "button", onclick: () => editar(it) },
            miniDe(it),
            h("span", { class: "fila-txt" }, h("b", {}, tituloDe(it)), subDe(it) ? h("span", {}, subDe(it)) : null),
            h("span", { class: "fila-der" }, it.agotado ? h("span", { class: "etiqueta-agotado" }, "Agotado") : null, h("span", { html: FLECHA })));
          return f;
        }
        function pintar() {
          const a = items();
          contador.textContent = "(" + a.length + ")";
          btnNuevo.disabled = !!def.maximo && a.length >= def.maximo;
          cont.replaceChildren();
          const gs = grupos();
          if (gs) {
            gs.forEach((g) => {
              if (!g.items.length && g.id === null) return;
              cont.append(h("div", { class: "lista-grupo" }, h("span", {}, g.nombre + " (" + g.items.length + ")"),
                g.id !== null && !btnNuevo.disabled ? h("button", { class: "btn btn-plano btn-chico", type: "button", onclick: () => agregar(g.id) }, "Agregar aquí") : null));
              g.items.forEach((it) => cont.append(fila(it)));
            });
            if (!gs.length) cont.append(h("p", { class: "lista-vacia" }, "Primero crea una categoría."));
          } else {
            a.forEach((it) => cont.append(fila(it)));
          }
          if (!a.length && (!gs || gs.length)) cont.append(h("p", { class: "lista-vacia" }, "Todavía no hay nada aquí. Toca «Agregar " + (def.item || "uno") + "»."));
        }
        function agregar(grupo) {
          const a = items();
          if (def.maximo && a.length >= def.maximo) return;
          const it = EU.clonar(def.nuevo || {});
          let id;
          do { id = (def.prefijoId || "i") + "-" + EU.claveAzar(5); } while (a.some((x) => x.id === id));
          it.id = id;
          if (def.agrupar) {
            if (grupo != null) it[def.agrupar.clave] = grupo;
            else if (def.agrupar.desde) { const l = EU.obtener(raiz(), def.agrupar.desde) || []; if (l[0] && it[def.agrupar.clave] == null) it[def.agrupar.clave] = l[0].id; }
          }
          // los selectores con opciones de otra lista arrancan en la primera opción
          (def.campos || []).forEach((c) => {
            if (c.tipo === "selector" && it[c.clave] == null) { const ops = opcionesDe(c); if (ops[0]) it[c.clave] = ops[0].id; }
          });
          if (def.alFinal === false) a.unshift(it); else a.push(it);
          pintar();
          cambio(def);
          editar(it, true);
        }
        function editar(it, nuevo) {
          let formulario;
          EU.modal({
            titulo: (nuevo ? "Nuevo " : "Editar ") + (def.item || "elemento"),
            alCerrar: () => { pintar(); cambio(def); },
            construir: (m) => {
              formulario = campos(def.campos || [], it);
              m.cuerpo.append(formulario);
              const a = items();
              const mover = (dir) => {
                const g = def.agrupar && def.agrupar.clave;
                let i = a.indexOf(it), j = i + dir;
                while (j >= 0 && j < a.length && g && String(a[j][g]) !== String(it[g])) j += dir;
                if (j < 0 || j >= a.length) { EU.aviso(dir < 0 ? "Ya está de primero." : "Ya está de último."); return; }
                a.splice(i, 1); a.splice(j, 0, it);
                cambio(def);
                EU.aviso(dir < 0 ? "Subió un puesto." : "Bajó un puesto.");
              };
              const btnBorrar = h("button", { class: "btn btn-peligro", type: "button", disabled: !!def.minimo && a.length <= def.minimo }, "Eliminar");
              btnBorrar.addEventListener("click", () => {
                const pieViejo = Array.from(m.pie.childNodes);
                m.pie.replaceChildren(h("div", { class: "confirmar", style: "width:100%" },
                  h("p", {}, "¿Eliminar «" + tituloDe(it) + "»? No se puede deshacer."),
                  h("div", { class: "acciones" },
                    h("button", { class: "btn btn-peligro lleno", type: "button", onclick: () => { const i = a.indexOf(it); if (i > -1) a.splice(i, 1); m.cerrar(); EU.aviso("Eliminado. Recuerda guardar los cambios."); } }, "Sí, eliminar"),
                    h("button", { class: "btn btn-sec", type: "button", onclick: () => m.pie.replaceChildren(...pieViejo) }, "No"))));
              });
              m.pie.append(
                h("div", { class: "acciones" }, btnBorrar,
                  a.length > 1 ? h("button", { class: "btn btn-sec btn-chico", type: "button", onclick: () => mover(-1), "aria-label": "Mover arriba" }, "Subir") : null,
                  a.length > 1 ? h("button", { class: "btn btn-sec btn-chico", type: "button", onclick: () => mover(1), "aria-label": "Mover abajo" }, "Bajar") : null),
                h("button", { class: "btn", type: "button", onclick: () => { if (validar(formulario)) m.cerrar(); } }, "Listo"));
            },
          });
        }
        pintar();
        el._repintar = pintar;
        return el;
      },
    };

    function validar(contenedor) {
      let ok = true;
      contenedor.querySelectorAll(".campo").forEach((c) => { if (c._validar && !c.hidden && !c._validar()) ok = false; });
      if (!ok) { const e = contenedor.querySelector(".error-campo:not([hidden])"); if (e) e.scrollIntoView({ block: "center" }); }
      return ok;
    }

    function campo(def, obj) {
      const f = TIPOS[def.tipo];
      if (!f) return h("p", { class: "ayuda" }, "Campo desconocido: " + def.tipo);
      const el = f(def, obj);
      if (def.si) {
        const visible = () => {
          const v = EU.obtener(obj || raiz(), def.si.ruta);
          return def.si.igual !== undefined ? v === def.si.igual : def.si.distinto !== undefined ? v !== def.si.distinto : !!v;
        };
        el.hidden = !visible();
        condicionales.push({ el, visible });
      }
      return el;
    }
    function campos(defs, obj) {
      return h("div", { class: "campos" }, defs.filter(Boolean).map((d) => campo(d, obj)));
    }
    return { campo, campos, validar, opcionesDe };
  };
})();
