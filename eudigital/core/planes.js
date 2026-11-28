/* Planes de Tiendo: prueba gratis, Básico y Premium, por mes o por año.
   Los precios, los días de prueba y el tope de páginas se cambian en el panel de administración
   (Ajustes > Planes y precios); los de aquí son los que se usan si todavía no hay ajustes. */
(function () {
  "use strict";
  const EU = (window.EU = window.EU || {});
  const BASE = { diasPrueba: 15, registroAbierto: true, maxPaginas: 2, metodos: [], whatsapp: "",
    precios: { basico: { mensual: 10, anual: 110 }, premium: { mensual: 20, anual: 200 }, extra: { mensual: 10, anual: 110 } } };
  const num = (v, defecto, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? n : defecto;
  };

  EU.planes = {
    nombres: { prueba: "Prueba gratis", basico: "Básico", premium: "Premium" },
    ciclos: { mensual: "Mensual", anual: "Anual" },

    /* Acepta lo que devuelve eu_planes_publicos() o los ajustes del administrador (eu_ajustes.datos). */
    leer(d) {
      d = d || {};
      const p = d.precios || {};
      const uno = (plan, ciclo) => num(p[plan] && p[plan][ciclo], BASE.precios[plan][ciclo], 0, 9999999);
      return {
        diasPrueba: Math.round(num(d.diasPrueba, BASE.diasPrueba, 1, 90)),
        registroAbierto: d.registroAbierto !== false && d.registroAbierto !== "false",
        maxPaginas: Math.round(num(d.maxPaginas != null ? d.maxPaginas : d.maxPaginasPremium, BASE.maxPaginas, 1, 20)),
        metodos: Array.isArray(d.metodos) ? d.metodos.filter(Boolean).map(String)
          : Array.isArray(d.pagos) ? d.pagos.map((m) => m && m.metodo).filter(Boolean).map(String) : [],
        whatsapp: String(d.whatsapp || "").replace(/\D+/g, ""),
        precios: { basico: { mensual: uno("basico", "mensual"), anual: uno("basico", "anual") }, premium: { mensual: uno("premium", "mensual"), anual: uno("premium", "anual") }, extra: { mensual: uno("extra", "mensual"), anual: uno("extra", "anual") } },
      };
    },
    precio(pl, plan, ciclo) {
      const p = (pl && pl.precios && pl.precios[plan]) || BASE.precios[plan] || {};
      return Number(p[ciclo === "anual" ? "anual" : "mensual"]) || 0;
    },
    // Lo que se ahorra pagando el año de una vez en lugar de 12 meses
    ahorro(pl, plan) { return Math.max(0, Math.round((EU.planes.precio(pl, plan, "mensual") * 12 - EU.planes.precio(pl, plan, "anual")) * 100) / 100); },
    // "$10" o "$10.50": sin decimales cuando no hacen falta
    dinero(n) { n = Number(n) || 0; return "$" + (Math.round(n * 100) % 100 === 0 ? String(Math.round(n)) : n.toFixed(2)); },
    // "Básico, por mes" / "Premium, por año" / "Prueba gratis"
    etiqueta(plan, ciclo) {
      if (plan === "prueba") return "Prueba gratis";
      return "Plan " + (EU.planes.nombres[plan] || "Básico") + (ciclo === "anual" ? ", por año" : ", por mes");
    },
    // Lo que incluye cada plan, para la portada y el panel
    lista(pl) {
      pl = pl || EU.planes.leer();
      return [
        { id: "basico", nombre: "Básico", para: "Para un negocio con una sola página.",
          puntos: ["Una página con la plantilla que elijas (menos las Premium)", "Pedidos directo a tu WhatsApp, sin comisión", "Panel para cambiar precios, fotos y la tasa del día", "Código QR, tarjeta para compartir y tus pedidos en cifras"] },
        { id: "premium", nombre: "Premium", para: "Para varios negocios, sucursales o líneas de productos.",
          puntos: ["Todo lo del plan Básico", pl.maxPaginas + (pl.maxPaginas === 1 ? " página incluida" : " páginas incluidas") + ", cada una con su enlace. Más páginas por " + EU.planes.dinero(EU.planes.precio(pl, "extra", "mensual")) + " al mes cada una", "Todas las plantillas, también las Premium como Delicias y Licorería", "Cambia de plantilla sin perder tu menú"] },
      ];
    },
  };
})();
