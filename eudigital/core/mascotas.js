/* Mascotas bailarinas: personajes dibujados en SVG con brazos, piernas y cara, y una lista de bailes.
   Todos comparten el mismo esqueleto (clases em-*), así que cualquier personaje puede hacer cualquier baile.
   Los bailes están en core/mascotas.css. Lienzo: 200 x 220. */
(function () {
  "use strict";
  const L = "#3a2412"; // línea de contorno

  const cara = (x, y, s = 1, { boca = true } = {}) => `<g transform="translate(${x} ${y}) scale(${s})">
<ellipse cx="-16" cy="0" rx="8" ry="10" fill="#fff" stroke="${L}" stroke-width="3"/><circle cx="-14" cy="2" r="4" fill="${L}"/>
<ellipse cx="16" cy="0" rx="8" ry="10" fill="#fff" stroke="${L}" stroke-width="3"/><circle cx="18" cy="2" r="4" fill="${L}"/>
${boca ? `<path d="M-14 18 Q0 32 14 18" stroke="${L}" stroke-width="4" fill="#9b1c1c" stroke-linecap="round"/>` : ""}
<circle cx="-29" cy="15" r="5" fill="#f08a7a" opacity=".7"/><circle cx="29" cy="15" r="5" fill="#f08a7a" opacity=".7"/></g>`;

  const brazo = (lado, x, y) => {
    const k = lado === "i" ? -1 : 1;
    return `<g class="em-brazo-${lado}" style="transform-origin:${x}px ${y}px"><path d="M${x} ${y} q${k * 24} -12 ${k * 34} -34" stroke="${L}" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="${x + k * 35}" cy="${y - 37}" r="8" fill="#fff" stroke="${L}" stroke-width="3"/></g>`;
  };
  const pie = (lado, dx, y, zapato) => {
    const k = lado === "i" ? -1 : 1, x = 100 + k * dx;
    return `<g class="em-pie-${lado}" style="transform-origin:${x}px ${y}px"><path d="M${x} ${y} L${x + k * 8} 192" stroke="${L}" stroke-width="7" stroke-linecap="round"/><ellipse cx="${x + k * 12}" cy="196" rx="13" ry="7" fill="${zapato}"/></g>`;
  };
  const C = (extra) => `stroke="${L}" stroke-width="5" stroke-linejoin="round" ${extra || ""}`;

  /* Cada personaje: hombros [x, y] (el derecho es el espejo), cadera [separación, y], color del zapato y su dibujo. */
  const PERSONAJES = [
    { id: "arepa", nombre: "Arepa", hombro: [42, 96], cadera: [14, 150], zapato: "#D9472B", cuerpo: `
<ellipse cx="100" cy="100" rx="62" ry="58" fill="#F2B640" stroke="#B8732A" stroke-width="5"/><ellipse cx="100" cy="98" rx="52" ry="48" fill="#F7C65A"/>
<circle cx="66" cy="66" r="6" fill="#B8732A" opacity=".5"/><circle cx="136" cy="74" r="7" fill="#B8732A" opacity=".45"/><circle cx="128" cy="132" r="5" fill="#B8732A" opacity=".45"/><circle cx="70" cy="130" r="4" fill="#B8732A" opacity=".4"/>
${cara(100, 92)}` },
    { id: "pizza", nombre: "Pizza", hombro: [52, 70], cadera: [14, 150], zapato: "#d7262b", cuerpo: `
<path d="M30 40 L170 40 L100 178 Z" fill="#f7c948" ${C()}/>
<path d="M40 46 Q70 62 98 52 Q128 64 160 46 L150 66 Q126 80 100 70 Q74 82 50 66 Z" fill="#fbe08a" opacity=".9"/>
<path d="M22 26 Q100 6 178 26 Q184 42 170 44 L30 44 Q16 42 22 26Z" fill="#d98c3d" ${C()}/>
<circle cx="78" cy="124" r="10" fill="#c22a20"/><circle cx="122" cy="118" r="9" fill="#c22a20"/><circle cx="100" cy="150" r="7" fill="#c22a20"/>
${cara(100, 80)}` },
    { id: "hamburguesa", nombre: "Hamburguesa", hombro: [44, 104], cadera: [16, 150], zapato: "#d7262b", cuerpo: `
<rect x="42" y="122" width="116" height="34" rx="16" fill="#E8A04A" ${C()}/>
<rect x="36" y="104" width="128" height="24" rx="12" fill="#6B3A1E" ${C()}/>
<path d="M36 104 L164 104 L150 118 L132 106 L112 120 L92 106 L70 120 L52 106 Z" fill="#FFC83D" stroke="${L}" stroke-width="4" stroke-linejoin="round"/>
<path d="M34 100 q11 -12 22 0 q11 -12 22 0 q11 -12 22 0 q11 -12 22 0 q11 -12 22 0 q11 -12 22 0 l0 6 l-132 0 Z" fill="#5DBB46" stroke="${L}" stroke-width="4" stroke-linejoin="round"/>
<path d="M38 96 Q38 36 100 36 Q162 36 162 96 Z" fill="#E8A04A" ${C()}/>
<ellipse cx="70" cy="50" rx="5" ry="3" fill="#FFF3D0" transform="rotate(-25 70 50)"/><ellipse cx="100" cy="44" rx="5" ry="3" fill="#FFF3D0"/><ellipse cx="130" cy="50" rx="5" ry="3" fill="#FFF3D0" transform="rotate(25 130 50)"/>
${cara(100, 70, 0.9)}` },
    { id: "perro", nombre: "Perro caliente", hombro: [58, 100], cadera: [14, 152], zapato: "#2E6FD8", cuerpo: `
<rect x="54" y="42" width="92" height="120" rx="42" fill="#E9B25D" ${C()}/>
<rect x="74" y="26" width="52" height="146" rx="26" fill="#C4452D" ${C()}/>
<path d="M82 122 l12 8 l12 -8 l12 8 M82 140 l12 8 l12 -8 l12 8" stroke="#FFD23F" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
${cara(100, 72, 0.72)}` },
    { id: "papas", nombre: "Papas fritas", hombro: [58, 112], cadera: [15, 154], zapato: "#FFC83D", cuerpo: `
<g fill="#FFD23F" stroke="${L}" stroke-width="4" stroke-linejoin="round"><rect x="62" y="40" width="14" height="70" rx="3" transform="rotate(-10 69 75)"/><rect x="80" y="28" width="14" height="80" rx="3" transform="rotate(-3 87 68)"/><rect x="97" y="34" width="14" height="76" rx="3" transform="rotate(4 104 72)"/><rect x="114" y="26" width="14" height="84" rx="3" transform="rotate(8 121 68)"/><rect x="128" y="44" width="14" height="66" rx="3" transform="rotate(14 135 77)"/></g>
<path d="M52 92 Q100 108 148 92 L138 162 L62 162 Z" fill="#D7262B" ${C()}/>
<path d="M70 150 L130 150" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>
${cara(100, 118, 0.8)}` },
    { id: "refresco", nombre: "Refresco", hombro: [64, 100], cadera: [14, 154], zapato: "#1E63C8", cuerpo: `
<path d="M112 52 L128 12" stroke="#E23B3B" stroke-width="8" stroke-linecap="round"/><path d="M112 52 L128 12" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-dasharray="6 8"/>
<path d="M58 60 L142 60 L132 162 L68 162 Z" fill="#E23B3B" ${C()}/>
<path d="M61 92 q13 -10 26 0 t26 0 t26 0 L137 110 q-12 10 -24 0 t-24 0 t-26 0 Z" fill="#fff" opacity=".85"/>
<rect x="52" y="48" width="96" height="14" rx="6" fill="#fff" ${C()}/>
${cara(100, 128, 0.78)}` },
    { id: "sushi", nombre: "Roll de sushi", hombro: [44, 100], cadera: [14, 152], zapato: "#E23B3B", cuerpo: `
<circle cx="100" cy="100" r="60" fill="#1F2D2B" ${C()}/><circle cx="100" cy="100" r="49" fill="#fff"/>
<rect x="80" y="56" width="22" height="16" rx="5" fill="#FF8A5B"/><circle cx="114" cy="64" r="9" fill="#7BC96F"/><circle cx="96" cy="76" r="5" fill="#FFD23F"/>
${cara(100, 104, 0.9)}` },
    { id: "nigiri", nombre: "Nigiri", hombro: [46, 122], cadera: [16, 152], zapato: "#1F2D2B", cuerpo: `
<rect x="42" y="92" width="116" height="66" rx="30" fill="#fff" ${C()}/>
<path d="M36 100 Q36 52 100 52 Q164 52 164 100 Q164 114 150 108 Q100 92 50 108 Q36 114 36 100 Z" fill="#FF8A5B" ${C()}/>
<path d="M64 62 L56 100 M92 54 L88 94 M120 55 L124 95 M146 66 L152 102" stroke="#FFD0B8" stroke-width="5" stroke-linecap="round"/>
${cara(100, 126, 0.74)}` },
    { id: "taco", nombre: "Taco", hombro: [44, 126], cadera: [16, 152], zapato: "#2FA36B", cuerpo: `
<g stroke="${L}" stroke-width="4"><circle cx="58" cy="100" r="16" fill="#5DBB46"/><circle cx="82" cy="78" r="17" fill="#5DBB46"/><circle cx="112" cy="74" r="17" fill="#5DBB46"/><circle cx="140" cy="94" r="16" fill="#5DBB46"/><circle cx="98" cy="70" r="9" fill="#E23B3B"/><circle cx="128" cy="80" r="8" fill="#E23B3B"/><circle cx="68" cy="86" r="8" fill="#FFD23F"/></g>
<path d="M34 156 A66 66 0 0 1 166 156 Z" fill="#F0C05A" ${C()}/>
<circle cx="60" cy="130" r="3" fill="#B8732A" opacity=".5"/><circle cx="142" cy="136" r="3" fill="#B8732A" opacity=".5"/>
${cara(100, 124, 0.8)}` },
    { id: "empanada", nombre: "Empanada", hombro: [44, 122], cadera: [16, 150], zapato: "#8A4B22", cuerpo: `
<path d="M30 150 A70 70 0 0 1 170 150 Q100 162 30 150 Z" fill="#E9A63F" ${C()}/>
<path d="M36 132 q2 -9 9 -12 M44 112 q4 -8 11 -10 M58 96 q6 -7 13 -7 M76 86 q7 -4 14 -2 M98 82 q7 -2 13 2 M120 86 q7 0 12 6 M138 98 q7 3 9 10 M152 116 q5 5 5 12" stroke="#B8732A" stroke-width="5" fill="none" stroke-linecap="round"/>
${cara(100, 124, 0.8)}` },
    { id: "tequeno", nombre: "Tequeño", hombro: [70, 98], cadera: [12, 156], zapato: "#D9472B", cuerpo: `
<rect x="68" y="24" width="64" height="144" rx="30" fill="#EDBE68" ${C()}/>
<path d="M70 132 L130 110 M70 152 L130 130 M82 166 L130 150 M70 50 L112 28 M70 112 L88 105 M118 96 L130 91" stroke="#B8732A" stroke-width="5" stroke-linecap="round" opacity=".75"/>
<path d="M92 24 q8 -12 16 0" fill="#FFF3D0" stroke="${L}" stroke-width="4"/>
${cara(100, 72, 0.74)}` },
    { id: "dona", nombre: "Dona", hombro: [44, 100], cadera: [14, 152], zapato: "#7A3FD1", cuerpo: `
<path fill-rule="evenodd" d="M100 40 a60 60 0 1 0 0.1 0 Z M100 98 a13 13 0 1 1 -0.1 0 Z" fill="#E9B25D" ${C()}/>
<path fill-rule="evenodd" d="M100 48 q20 -2 36 12 q16 16 15 38 q-1 10 -9 12 q-6 2 -8 12 q-4 12 -16 16 q-10 4 -18 0 q-8 -4 -16 0 q-12 2 -22 -8 q-14 -14 -13 -34 q1 -22 17 -36 q14 -12 34 -12 Z M100 96 a15 15 0 1 1 -0.1 0 Z" fill="#FF8FC0"/>
<g stroke-width="5" stroke-linecap="round"><path d="M70 66 l6 6" stroke="#fff"/><path d="M128 62 l-6 6" stroke="#5BC0DE"/><path d="M142 92 l-8 2" stroke="#FFD23F"/><path d="M58 96 l8 -2" stroke="#7BC96F"/><path d="M100 54 l0 8" stroke="#FFD23F"/><path d="M76 132 l6 -6" stroke="#5BC0DE"/><path d="M124 136 l-6 -6" stroke="#fff"/></g>
${cara(100, 80, 0.8, { boca: false })}` },
    { id: "helado", nombre: "Helado", hombro: [60, 92], cadera: [10, 156], zapato: "#5BC0DE", cuerpo: `
<path d="M66 106 L134 106 L100 180 Z" fill="#E0A050" ${C()}/>
<path d="M78 112 L112 152 M96 108 L122 138 M122 112 L88 152 M104 108 L78 138" stroke="#B8732A" stroke-width="3" opacity=".7"/>
<path d="M52 104 Q40 30 100 28 Q160 30 148 104 q-8 12 -16 0 q-8 12 -16 0 q-8 12 -16 0 q-8 12 -16 0 q-8 12 -16 0 q-8 12 -16 0 Z" fill="#FF9EC0" ${C()}/>
<circle cx="100" cy="26" r="9" fill="#E23B3B" stroke="${L}" stroke-width="4"/>
${cara(100, 68, 0.9)}` },
    { id: "cupcake", nombre: "Cupcake", hombro: [60, 104], cadera: [14, 156], zapato: "#E8395B", cuerpo: `
<path d="M58 108 L142 108 L130 164 L70 164 Z" fill="#5BC0DE" ${C()}/>
<path d="M76 112 L80 160 M92 112 L94 160 M108 112 L106 160 M124 112 L120 160" stroke="#2C8FB0" stroke-width="4" stroke-linecap="round"/>
<path d="M50 108 Q34 86 58 76 Q52 50 82 50 Q90 28 114 44 Q142 36 144 66 Q170 76 150 108 Z" fill="#FFF3D0" ${C()}/>
<circle cx="100" cy="30" r="10" fill="#E23B3B" stroke="${L}" stroke-width="4"/>
<g stroke-width="5" stroke-linecap="round"><path d="M64 88 l6 5" stroke="#FF8FC0"/><path d="M138 86 l-6 5" stroke="#7BC96F"/><path d="M118 52 l4 6" stroke="#FFD23F"/></g>
${cara(100, 78, 0.8)}` },
    { id: "cafe", nombre: "Café", hombro: [56, 106], cadera: [14, 156], zapato: "#6B3A1E", cuerpo: `
<path d="M84 44 q-8 -10 0 -18 q8 -8 0 -18 M108 44 q-8 -10 0 -18 q8 -8 0 -18" stroke="#B9A89A" stroke-width="5" fill="none" stroke-linecap="round"/>
<path d="M142 84 q30 0 28 26 q-2 24 -32 24" fill="none" stroke="${L}" stroke-width="14" stroke-linecap="round"/><path d="M142 84 q30 0 28 26 q-2 24 -32 24" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
<path d="M50 62 L146 62 L138 148 Q136 164 120 164 L76 164 Q60 164 58 148 Z" fill="#fff" ${C()}/>
<ellipse cx="98" cy="64" rx="46" ry="9" fill="#6B3A1E" stroke="${L}" stroke-width="4"/>
${cara(98, 112, 0.84)}` },
    { id: "bolsa", nombre: "Bolsa de compras", hombro: [50, 104], cadera: [16, 156], zapato: "#C2185B", cuerpo: `
<path d="M76 70 Q76 30 100 30 Q124 30 124 70" fill="none" stroke="${L}" stroke-width="7" stroke-linecap="round"/>
<path d="M48 66 L152 66 L160 164 L40 164 Z" fill="#F6A5C0" ${C()}/>
<path d="M48 66 L152 66 L154 86 L46 86 Z" fill="#EE7FA6" opacity=".9"/><circle cx="76" cy="76" r="4" fill="${L}"/><circle cx="124" cy="76" r="4" fill="${L}"/>
${cara(100, 118, 0.9)}` },
    { id: "vestido", nombre: "Vestido", hombro: [72, 62], cadera: [14, 158], zapato: "#C2185B", cuerpo: `
<path d="M76 30 L88 30 Q100 46 112 30 L124 30 L128 82 L162 164 L38 164 L72 82 Z" fill="#B56BE0" ${C()}/>
<path d="M72 82 L128 82" stroke="#FFD23F" stroke-width="8" stroke-linecap="round"/>
<path d="M60 150 q10 -8 20 0 t20 0 t20 0 t20 0" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/>
${cara(100, 114, 0.8)}` },
    { id: "corazon", nombre: "Corazón", hombro: [46, 92], cadera: [10, 154], zapato: "#8E1230", cuerpo: `
<path d="M100 170 C34 124 22 78 50 52 C74 32 96 46 100 66 C104 46 126 32 150 52 C178 78 166 124 100 170 Z" fill="#E8395B" ${C()}/>
<path d="M56 70 q6 -12 20 -12" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".6"/>
${cara(100, 98, 0.9)}` },
    { id: "estrella", nombre: "Estrella", hombro: [58, 92], cadera: [20, 146], zapato: "#E8395B", cuerpo: `
<path d="M100 22 L120 74 L176 78 L132 112 L147 166 L100 136 L53 166 L68 112 L24 78 L80 74 Z" fill="#FFC83D" ${C()}/>
${cara(100, 100, 0.8)}` },
  ];

  const BAILES = [
    { id: "meneo", nombre: "Meneo clásico" },
    { id: "brincos", nombre: "Brincos" },
    { id: "twist", nombre: "Twist" },
    { id: "salsa", nombre: "Salsa de lado a lado" },
    { id: "ola", nombre: "La ola" },
    { id: "giro", nombre: "Vueltas" },
    { id: "robot", nombre: "Robot" },
    { id: "rock", nombre: "Rockero" },
    { id: "tembleque", nombre: "Tembleque" },
    { id: "tranquilo", nombre: "Tranquilo" },
  ];

  const porId = Object.fromEntries(PERSONAJES.map((p) => [p.id, p]));

  // Lo de adentro del <svg> (para plantillas que ya tienen su propio <svg data-eu-mascota>)
  function interior(id) {
    const p = porId[id];
    if (!p) return "";
    const [hx, hy] = p.hombro, [dx, cy] = p.cadera;
    return `<g class="em-salto"><g class="em-todo">${pie("i", dx, cy, p.zapato)}${pie("d", dx, cy, p.zapato)}<g class="em-cuerpo">${brazo("i", hx, hy)}${brazo("d", 200 - hx, hy)}${p.cuerpo}</g></g></g>`;
  }
  const svg = (id) => (porId[id] ? `<svg viewBox="0 0 200 220" aria-hidden="true" focusable="false">${interior(id)}</svg>` : "");

  window.EU_MASCOTAS = { personajes: PERSONAJES.map(({ id, nombre }) => ({ id, nombre })), bailes: BAILES, existe: (id) => !!porId[id], hayBaile: (id) => BAILES.some((b) => b.id === id), interior, svg };
})();
