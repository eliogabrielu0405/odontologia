/* Plantilla Boutique: probador 360, catálogo, carrito y pedido por WhatsApp.
   Se carga desde puente.js cuando los datos del negocio ya están listos. */
const API_TIENDA = ''; // la plataforma entrega precios, tasa y agotados en los datos
/* ============================================================
   Motor 3D del probador: prendas modeladas a partir de siluetas,
   base giratoria, luz de estudio y fotos para el catálogo.
   ============================================================ */
function crearMotor(THREE, RoomEnvironment) {
  const TAU = Math.PI * 2;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const suave = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const campana = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
  const triangular = (x) => (2 / Math.PI) * Math.asin(Math.sin(x));

  function azar(semilla) {
    let s = (Math.imul(semilla + 1, 2654435761) >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // Suma de ondas con frecuencias enteras: cierra sin salto en la costura de la espalda.
  function ondas(semilla, frecs, pesos) {
    const r = azar(semilla);
    const fases = frecs.map(() => r() * TAU);
    const amps = pesos.map((p) => p * (0.7 + 0.6 * r()));
    const total = amps.reduce((s, a) => s + a, 0);
    return (th) => {
      let s = 0;
      for (let k = 0; k < frecs.length; k++) s += amps[k] * Math.sin(frecs[k] * th + fases[k]);
      return s / total;
    };
  }

  // ---------- Interpolación monótona (no se pasa de los puntos de control) ----------
  function tangentes(x, y) {
    const n = x.length, d = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
    if (n === 2) { m[0] = m[1] = d[0]; return m; }
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return m;
  }

  function interp(xs, ys) {
    const m = tangentes(xs, ys), n = xs.length;
    return (x) => {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      let k = 0;
      while (k < n - 2 && x > xs[k + 1]) k++;
      const h = xs[k + 1] - xs[k], s = (x - xs[k]) / h, s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * ys[k] + (s3 - 2 * s2 + s) * h * m[k] + (-2 * s3 + 3 * s2) * ys[k + 1] + (s3 - s2) * h * m[k + 1];
    };
  }

  const tramos = (pares) => interp(pares.map((p) => p[0]), pares.map((p) => p[1]));

  // Silueta de arriba hacia abajo: altura y, semiancho a, semifondo b y centro (cx, cz).
  function perfil(puntos) {
    const n = puntos.length, t = [0];
    for (let i = 1; i < n; i++) {
      const p = puntos[i - 1], q = puntos[i];
      t.push(t[i - 1] + Math.hypot(q.y - p.y, (q.a + q.b - p.a - p.b) / 2, (q.cx || 0) - (p.cx || 0)));
    }
    const largo = t[n - 1];
    const ts = t.map((x) => x / largo);
    const fy = interp(ts, puntos.map((p) => p.y));
    const fa = interp(ts, puntos.map((p) => p.a));
    const fb = interp(ts, puntos.map((p) => p.b));
    const fx = interp(ts, puntos.map((p) => p.cx || 0));
    const fz = interp(ts, puntos.map((p) => p.cz || 0));
    const f = (v) => ({ y: fy(v), a: fa(v), b: fb(v), cx: fx(v), cz: fz(v) });
    f.largo = largo;
    f.vDeY = (y) => {
      let lo = 0, hi = 1;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (fy(mid) > y) lo = mid; else hi = mid; }
      return (lo + hi) / 2;
    };
    return f;
  }

  // ---------- Geometría ----------
  function armar(pos, uv, vu, idx, C, R, cen) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('vuelo', new THREE.BufferAttribute(vu, 1));
    g.setIndex(idx);
    g.computeVertexNormals();
    let n = g.attributes.normal.array, s = 0;
    for (let k = 0; k < pos.length / 3; k += 5) {
      s += (pos[k * 3] - cen[k * 3]) * n[k * 3] + (pos[k * 3 + 1] - cen[k * 3 + 1]) * n[k * 3 + 1] + (pos[k * 3 + 2] - cen[k * 3 + 2]) * n[k * 3 + 2];
    }
    if (s < 0) {
      const ix = g.index.array;
      for (let q = 0; q < ix.length; q += 3) { const t = ix[q + 1]; ix[q + 1] = ix[q + 2]; ix[q + 2] = t; }
      g.index.needsUpdate = true;
      g.computeVertexNormals();
      n = g.attributes.normal.array;
    }
    // La primera y la última columna son la misma costura: se promedian sus normales.
    for (let j = 0; j <= R; j++) {
      const a = j * 3, b = (C * (R + 1) + j) * 3;
      const x = n[a] + n[b], y = n[a + 1] + n[b + 1], z = n[a + 2] + n[b + 2], l = Math.hypot(x, y, z) || 1;
      n[a] = n[b] = x / l; n[a + 1] = n[b + 1] = y / l; n[a + 2] = n[b + 2] = z / l;
    }
    return g;
  }

  function rejilla(C, R) {
    const idx = [];
    for (let i = 0; i < C; i++) for (let j = 0; j < R; j++) {
      const a = i * (R + 1) + j, b = a + R + 1, c = a + 1, d = b + 1;
      idx.push(a, c, b, b, c, d);
    }
    return idx;
  }

  function puntoSup(P, th, v, deformar) {
    const p = P(v);
    let m = 1, dy = 0;
    if (deformar) { const d = deformar(th, v, p); m = d.m ?? 1; dy = d.dy ?? 0; }
    return V3(p.cx + p.a * m * Math.sin(th), p.y + dy, p.cz + p.b * m * Math.cos(th));
  }

  // Superficie alrededor del eje vertical. th = 0 es el centro delantero; la costura queda en la espalda.
  function superficie({ perfil: P, columnas = 160, filas = 90, arriba = () => 0, abajo = () => 1, deformar = null, vuelo = null }) {
    const C = columnas, R = filas, N = (C + 1) * (R + 1);
    const pos = new Float32Array(N * 3), uv = new Float32Array(N * 2), vu = new Float32Array(N), cen = new Float32Array(N * 3);
    const L = P.largo;
    for (let i = 0; i <= C; i++) {
      const th = -Math.PI + (i / C) * TAU, sn = Math.sin(th), cs = Math.cos(th);
      const v0 = arriba(th), v1 = abajo(th);
      for (let j = 0; j <= R; j++) {
        const k = i * (R + 1) + j, v = lerp(v0, v1, j / R), p = P(v);
        let m = 1, dy = 0;
        if (deformar) { const d = deformar(th, v, p); m = d.m ?? 1; dy = d.dy ?? 0; }
        pos[k * 3] = p.cx + p.a * m * sn;
        pos[k * 3 + 1] = p.y + dy;
        pos[k * 3 + 2] = p.cz + p.b * m * cs;
        cen[k * 3] = p.cx; cen[k * 3 + 1] = p.y + dy; cen[k * 3 + 2] = p.cz;
        uv[k * 2] = th * Math.sqrt((p.a * p.a + p.b * p.b) / 2);
        uv[k * 2 + 1] = -v * L;
        vu[k] = vuelo ? vuelo(v, th) : 0;
      }
    }
    return armar(pos, uv, vu, rejilla(C, R), C, R, cen);
  }

  // Tubo a lo largo de una curva (mangas, tirantes anchos). phi = 0 mira hacia "adelante".
  function tubo({ puntos, radio, columnas = 72, filas = 48, deformar = null, vuelo = null, adelante = V3(0, 0, 1), referencia = null, kN = 1, kB = 1, tapa = false }) {
    const curva = new THREE.CatmullRomCurve3(puntos, false, 'centripetal');
    const C = columnas, R = filas, N = (C + 1) * (R + 1);
    const P = [], T = [], Nn = [], B = [];
    for (let j = 0; j <= R; j++) { const s = j / R; P.push(curva.getPointAt(s)); T.push(curva.getTangentAt(s).normalize()); }
    for (let j = 0; j <= R; j++) {
      let base = referencia ? referencia(P[j]) : (j === 0 ? adelante.clone() : Nn[j - 1].clone());
      base.sub(T[j].clone().multiplyScalar(base.dot(T[j]))).normalize();
      Nn.push(base);
      B.push(T[j].clone().cross(base).normalize());
    }
    const largo = curva.getLength();
    const pos = new Float32Array(N * 3), uv = new Float32Array(N * 2), vu = new Float32Array(N), cen = new Float32Array(N * 3);
    for (let i = 0; i <= C; i++) {
      const ph = (i / C) * TAU, cs = Math.cos(ph), sn = Math.sin(ph);
      for (let j = 0; j <= R; j++) {
        const s = j / R, k = i * (R + 1) + j, r = radio(s), rr = r * (deformar ? deformar(ph, s) : 1);
        pos[k * 3] = P[j].x + rr * (cs * Nn[j].x * kN + sn * B[j].x * kB);
        pos[k * 3 + 1] = P[j].y + rr * (cs * Nn[j].y * kN + sn * B[j].y * kB);
        pos[k * 3 + 2] = P[j].z + rr * (cs * Nn[j].z * kN + sn * B[j].z * kB);
        cen[k * 3] = P[j].x; cen[k * 3 + 1] = P[j].y; cen[k * 3 + 2] = P[j].z;
        uv[k * 2] = ph * r; uv[k * 2 + 1] = -s * largo;
        vu[k] = vuelo ? vuelo(s) : 0;
      }
    }
    const g = armar(pos, uv, vu, rejilla(C, R), C, R, cen);
    if (tapa) {
      // Cierra la boca de la manga que queda junto al escote, con un frunce hacia adentro.
      const anillo = [], r0 = radio(0);
      for (let i = 0; i <= C; i++) { const k = i * (R + 1); anillo.push(V3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2])); }
      const centro = P[0].clone().addScaledVector(T[0], r0 * 0.45);
      const tp = new Float32Array((C + 2) * 3), tuv = new Float32Array((C + 2) * 2), ix = [];
      tp.set([centro.x, centro.y, centro.z], 0);
      anillo.forEach((q, i) => {
        tp.set([q.x, q.y, q.z], (i + 1) * 3);
        const d = q.clone().sub(P[0]);
        tuv.set([d.dot(B[0]), d.dot(Nn[0])], (i + 1) * 2);
      });
      for (let i = 0; i < C; i++) ix.push(0, i + 1, i + 2);
      const t = new THREE.BufferGeometry();
      t.setAttribute('position', new THREE.BufferAttribute(tp, 3));
      t.setAttribute('uv', new THREE.BufferAttribute(tuv, 2));
      t.setIndex(ix);
      t.computeVertexNormals();
      const n = t.attributes.normal.array;
      if (n[0] * -T[0].x + n[1] * -T[0].y + n[2] * -T[0].z < 0) {
        for (let q = 0; q < ix.length; q += 3) { const a = ix[q + 1]; ix[q + 1] = ix[q + 2]; ix[q + 2] = a; }
        t.setIndex(ix); t.computeVertexNormals();
      }
      g.userData.tapa = conVuelo(t);
    }
    return g;
  }

  function conVuelo(g) {
    if (!g.getAttribute('vuelo')) g.setAttribute('vuelo', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    return g;
  }

  function tirante(puntos, radio) {
    return conVuelo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(puntos, false, 'centripetal'), 64, radio, 8, false));
  }

  // Cinta plana (para lazos): tres vértices por fila, con muesca opcional en la punta.
  function cinta({ puntos, ancho, lado, filas = 48, cerrada = false, muesca = 0, vueloPunto = null }) {
    const curva = new THREE.CatmullRomCurve3(puntos, cerrada, 'centripetal');
    const R = filas, pos = new Float32Array((R + 1) * 9), uv = new Float32Array((R + 1) * 6);
    const largo = curva.getLength();
    for (let j = 0; j <= R; j++) {
      const s = j / R, P = curva.getPointAt(s), T = curva.getTangentAt(s).normalize();
      const W = lado(s, P, T); W.sub(T.clone().multiplyScalar(W.dot(T))).normalize();
      const w = ancho(s) / 2;
      const centro = P.clone();
      if (muesca && j === R) centro.addScaledVector(T, -muesca);
      const filasPts = [P.clone().addScaledVector(W, -w), centro, P.clone().addScaledVector(W, w)];
      filasPts.forEach((q, c) => { pos.set([q.x, q.y, q.z], (j * 3 + c) * 3); uv.set([(c - 1) * w, -s * largo], (j * 3 + c) * 2); });
    }
    const idx = [];
    for (let j = 0; j < R; j++) for (let c = 0; c < 2; c++) {
      const a = j * 3 + c, b = a + 1, d = a + 3, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    if (vueloPunto) {
      const vu = new Float32Array((R + 1) * 3);
      for (let k = 0; k < vu.length; k++) vu[k] = vueloPunto(V3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]));
      g.setAttribute('vuelo', new THREE.BufferAttribute(vu, 1));
    }
    return conVuelo(g);
  }

  // Lazo: dos orejas, dos colas con punta en V y un nudo.
  function lazo({ centro, frente, arriba = V3(0, 1, 0), tam = 1, colas = 1, rutaCola = null, vueloPunto = null }) {
    const F = frente.clone().normalize();
    const U = arriba.clone().sub(F.clone().multiplyScalar(arriba.dot(F))).normalize();
    const X = U.clone().cross(F).normalize();
    const W = (x, y, z) => centro.clone().addScaledVector(X, x * tam).addScaledVector(U, y * tam).addScaledVector(F, z * tam);
    const piezas = [];
    for (const lado of [-1, 1]) {
      const pts = [];
      for (let q = 0; q < 18; q++) {
        const a = (q / 18) * TAU, x = lado * 0.088 * (1 - Math.cos(a)) / 2;
        pts.push(W(x, 0.34 * Math.abs(x) + 0.004 * Math.sin(a), 0.028 * Math.sin(a) + 0.01));
      }
      piezas.push(cinta({
        puntos: pts, cerrada: true, filas: 64,
        ancho: (s) => tam * lerp(0.01, 0.066, Math.pow((1 - Math.cos(TAU * s)) / 2, 1.5)),
        lado: () => U.clone(),
      }));
      const largoCola = 0.13 * colas;
      const cola = rutaCola ? rutaCola(lado, W) : [W(lado * 0.004, -0.006, 0.014), W(lado * 0.02, -largoCola * 0.33, 0.017), W(lado * 0.036, -largoCola * 0.68, 0.013), W(lado * 0.05, -largoCola, 0.016)];
      piezas.push(cinta({
        puntos: cola, filas: 40, muesca: 0.012 * tam, vueloPunto,
        ancho: (s) => tam * lerp(0.026, 0.04, Math.min(1, s * 2.5)),
        lado: (s, P, T) => F.clone().cross(T),
      }));
    }
    const nudo = new THREE.SphereGeometry(1, 18, 14);
    const m = new THREE.Matrix4().makeBasis(X, U, F).scale(V3(0.019 * tam, 0.026 * tam, 0.013 * tam));
    m.setPosition(W(0, 0, 0.018));
    nudo.applyMatrix4(m);
    const uvN = nudo.attributes.uv.array;
    for (let i = 0; i < uvN.length; i++) uvN[i] *= 0.012;
    piezas.push(conVuelo(nudo));
    return piezas;
  }

  // ---------- Prendas ----------
  const M = []; // piezas: { geo, mat }
  const pieza = (geo, mat = 'principal') => ({ geo, mat });

  function tirantesFinos(P, escote, def, { thF = 0.6, thB = Math.PI - 0.62, hombro = 0.108, radio = 0.0052 } = {}) {
    const res = [];
    for (const s of [-1, 1]) {
      const pf = puntoSup(P, s * thF, escote(s * thF) + 0.003, def);
      const pb = puntoSup(P, s * thB, escote(s * thB) + 0.003, def);
      const pts = [pf, V3(s * (hombro + 0.004), 1.36, 0.078), V3(s * hombro, 1.428, 0.012), V3(s * (hombro - 0.003), 1.37, -0.064), pb];
      res.push(pieza(tirante(pts, radio)));
    }
    return res;
  }

  function pretina(yArriba, yAbajo, a, b) {
    return superficie({ perfil: perfil([{ y: yArriba, a, b }, { y: yAbajo, a: a * 0.995, b: b * 0.995 }]), columnas: 128, filas: 4 });
  }

  function mangaGlobo(s, { pts, radios, pliegue = 0.1, semilla = 1, puno = null, volante = null }) {
    const radio = tramos(radios);
    const g = ondas(semilla, [11, 17, 23], [1, 0.5, 0.25]);
    const caida = ondas(semilla + 5, [3, 5], [1, 0.6]);
    const manga = tubo({
      puntos: pts, radio, columnas: 96, filas: 64, tapa: true,
      deformar: (ph, u) => 1 + pliegue * suave(0, 0.14, u) * (1 - suave(0.16, 0.4, u)) * g(ph) + pliegue * 0.9 * suave(0.72, 0.98, u) * g(ph + 1.7) + 0.035 * caida(ph) * Math.sin(Math.PI * u),
    });
    const res = [pieza(manga), pieza(manga.userData.tapa)];
    if (puno) res.push(pieza(tubo({ puntos: puno.pts, radio: () => puno.r, columnas: 48, filas: 6 })));
    if (volante) {
      const gv = ondas(semilla + 9, [19, 27], [1, 0.6]);
      res.push(pieza(tubo({ puntos: volante.pts, radio: tramos(volante.radios), columnas: 120, filas: 12, deformar: (ph, u) => 1 + 0.16 * suave(0, 1, u) * gv(ph) })));
    }
    return res;
  }

  const MODELOS = {
    // Vestido midi de tiras, escote en V y espalda baja.
    vestidoTiras() {
      const P = perfil([
        { y: 1.292, a: 0.150, b: 0.112 }, { y: 1.215, a: 0.164, b: 0.129 }, { y: 1.125, a: 0.142, b: 0.106 },
        { y: 1.040, a: 0.140, b: 0.102 }, { y: 0.900, a: 0.182, b: 0.136 }, { y: 0.690, a: 0.226, b: 0.186 },
        { y: 0.480, a: 0.266, b: 0.226 }, { y: 0.340, a: 0.290, b: 0.252 },
      ]);
      const L = P.largo, vCad = P.vDeY(0.97);
      const escote = (th) => {
        const a = Math.abs(th);
        const vf = Math.max(0, 1 - a / 0.62) ** 1.15, ve = Math.max(0, 1 - (Math.PI - a) / 1.0) ** 1.5;
        return (0.012 + 0.098 * vf + 0.09 * ve + 0.03 * Math.sin(th) ** 2) / L;
      };
      const pl = ondas(7, [7, 11, 17, 23], [1, 0.5, 0.28, 0.12]), ru = ondas(11, [5, 9], [1, 0.6]);
      const def = (th, v) => {
        const t = suave(vCad, 1, v), f = pl(th);
        return { m: 1 + 0.095 * t ** 1.2 * f, dy: t ** 3 * (0.014 * f + 0.008 * ru(th)) };
      };
      return [
        pieza(superficie({ perfil: P, columnas: 200, filas: 110, arriba: escote, deformar: def, vuelo: (v) => suave(vCad, 1, v) ** 1.4 })),
        ...tirantesFinos(P, escote, def),
      ];
    },

    // Vestido corto: escote corazón, mangas abullonadas, falda fruncida y lazo grande en la espalda.
    vestidoCoqueta() {
      const P = perfil([
        { y: 1.452, a: 0.070, b: 0.066 }, { y: 1.433, a: 0.126, b: 0.080 }, { y: 1.400, a: 0.176, b: 0.094 },
        { y: 1.335, a: 0.170, b: 0.113 }, { y: 1.250, a: 0.164, b: 0.125 }, { y: 1.212, a: 0.162, b: 0.128 },
        { y: 1.125, a: 0.138, b: 0.102 }, { y: 1.042, a: 0.131, b: 0.096 }, { y: 1.004, a: 0.152, b: 0.118 },
        { y: 0.890, a: 0.232, b: 0.196 }, { y: 0.760, a: 0.282, b: 0.246 }, { y: 0.655, a: 0.302, b: 0.266 },
      ]);
      const L = P.largo, vCin = P.vDeY(1.04);
      const escote = (th) => {
        const a = Math.abs(th);
        const fr = 1 - suave(0.95, 1.32, a), bk = suave(1.82, 2.2, a);
        const cora = 0.195 + 0.04 * Math.max(0, 1 - a / 0.16) - 0.024 * campana(a, 0.52, 0.22);
        return (0.085 + fr * (cora - 0.085) + bk * (0.155 - 0.085)) / L;
      };
      const fr = ondas(5, [14, 23, 31], [1, 0.45, 0.2]);
      const def = (th, v) => {
        const t = suave(vCin, 1, v), on = suave(vCin, vCin + 0.03, v);
        return { m: 1 + on * (0.03 + 0.05 * t) * fr(th), dy: t ** 3 * 0.01 * fr(th) };
      };
      const piezas = [pieza(superficie({ perfil: P, columnas: 200, filas: 120, arriba: escote, deformar: def, vuelo: (v) => suave(vCin, 1, v) ** 1.2 }))];
      for (const s of [-1, 1]) {
        piezas.push(...mangaGlobo(s, {
          semilla: 20 + s,
          pts: [V3(s * 0.132, 1.362, 0.0), V3(s * 0.196, 1.346, 0.004), V3(s * 0.242, 1.28, 0.01), V3(s * 0.266, 1.208, 0.014)],
          radios: [[0, 0.046], [0.2, 0.096], [0.5, 0.106], [0.82, 0.088], [1, 0.071]],
          volante: { pts: [V3(s * 0.264, 1.214, 0.014), V3(s * 0.274, 1.172, 0.016)], radios: [[0, 0.07], [1, 0.088]] },
        }));
      }
      // Colas del lazo apoyadas sobre la falda.
      const rutaCola = (lado) => [1.05, 0.97, 0.89, 0.81, 0.75].map((y, i) => {
        const th = Math.PI - lado * (0.05 + i * 0.045);
        const q = puntoSup(P, th, P.vDeY(y), def);
        return q.add(V3(Math.sin(th), 0, Math.cos(th)).multiplyScalar(0.012 + 0.003 * i));
      });
      const vueloFalda = (p) => suave(vCin, 1, P.vDeY(p.y)) ** 1.2;
      piezas.push(...lazo({ centro: V3(0, 1.08, -0.128), frente: V3(0, 0, -1), tam: 1.15, rutaCola, vueloPunto: vueloFalda }).map((g) => pieza(g, 'acento')));
      return piezas;
    },

    // Vestido ajustado de un solo hombro con abertura atrás.
    vestidoNoche() {
      const P = perfil([
        { y: 1.300, a: 0.150, b: 0.110 }, { y: 1.215, a: 0.161, b: 0.126 }, { y: 1.125, a: 0.137, b: 0.101 },
        { y: 1.040, a: 0.131, b: 0.096 }, { y: 0.950, a: 0.158, b: 0.114 }, { y: 0.865, a: 0.177, b: 0.129 },
        { y: 0.720, a: 0.170, b: 0.126 }, { y: 0.540, a: 0.153, b: 0.118 }, { y: 0.380, a: 0.145, b: 0.114 },
      ]);
      const L = P.largo;
      const escote = (th) => (0.048 - 0.04 * Math.sin(th) + 0.008 * Math.cos(th)) / L;
      const abajo = (th) => 1 - (0.15 * Math.max(0, 1 - (Math.PI - Math.abs(th)) / 0.09)) / L;
      const arr = ondas(31, [5, 9, 13], [1, 0.6, 0.3]);
      const def = (th, v) => ({ m: 1 + 0.005 * suave(0.5, 1, v) * arr(th) + 0.008 * campana(th, -Math.PI / 2, 0.5) * Math.sin(v * 80) * suave(0.05, 0.25, v) * (1 - suave(0.38, 0.5, v)) });
      const piezas = [pieza(superficie({ perfil: P, columnas: 180, filas: 110, arriba: escote, abajo, deformar: def }))];
      const pf = puntoSup(P, 0.78, escote(0.78) + 0.004, def), pb = puntoSup(P, Math.PI - 0.86, escote(Math.PI - 0.86) + 0.004, def);
      piezas.push(pieza(tubo({
        puntos: [pf, V3(0.128, 1.36, 0.07), V3(0.122, 1.432, 0.008), V3(0.118, 1.37, -0.06), pb],
        radio: tramos([[0, 0.034], [0.5, 0.026], [1, 0.034]]), columnas: 32, filas: 40, kN: 0.16, kB: 1,
        referencia: (p) => p.clone().sub(V3(0.09, 1.33, 0)),
      })));
      return piezas;
    },

    // Blusa de escote en V con mangas largas tipo globo.
    blusaGlobo() {
      const P = perfil([
        { y: 1.452, a: 0.072, b: 0.068 }, { y: 1.433, a: 0.130, b: 0.083 }, { y: 1.400, a: 0.182, b: 0.096 },
        { y: 1.335, a: 0.177, b: 0.118 }, { y: 1.250, a: 0.172, b: 0.132 }, { y: 1.190, a: 0.172, b: 0.134 },
        { y: 1.080, a: 0.160, b: 0.124 }, { y: 0.990, a: 0.166, b: 0.128 }, { y: 0.930, a: 0.176, b: 0.134 },
      ]);
      const L = P.largo;
      const escote = (th) => (0.014 + 0.165 * Math.max(0, 1 - Math.abs(th) / 0.72) ** 1.1 + 0.006 * Math.sin(th) ** 2) / L;
      const abajo = (th) => 1 - (0.03 * Math.sin(th) ** 2) / L;
      const dr = ondas(41, [5, 8, 13], [1, 0.5, 0.25]);
      const def = (th, v) => ({ m: 1 + 0.016 * suave(0.35, 1, v) * dr(th) });
      const piezas = [pieza(superficie({ perfil: P, columnas: 180, filas: 90, arriba: escote, abajo, deformar: def }))];
      for (const s of [-1, 1]) {
        piezas.push(...mangaGlobo(s, {
          semilla: 44 + s, pliegue: 0.07,
          pts: [V3(s * 0.150, 1.388, 0.0), V3(s * 0.226, 1.322, 0.008), V3(s * 0.282, 1.12, 0.03), V3(s * 0.318, 0.93, 0.05), V3(s * 0.33, 0.868, 0.058)],
          radios: [[0, 0.062], [0.1, 0.076], [0.45, 0.098], [0.75, 0.104], [0.9, 0.082], [0.96, 0.05], [1, 0.046]],
          puno: { pts: [V3(s * 0.33, 0.872, 0.058), V3(s * 0.336, 0.812, 0.064)], r: 0.046 },
        }));
      }
      return piezas;
    },

    // Top corto de tiras con lazo al centro.
    topLazo() {
      const P = perfil([{ y: 1.292, a: 0.150, b: 0.112 }, { y: 1.215, a: 0.163, b: 0.128 }, { y: 1.150, a: 0.146, b: 0.110 }, { y: 1.100, a: 0.139, b: 0.104 }]);
      const L = P.largo;
      const escote = (th) => { const a = Math.abs(th); return (0.012 + 0.02 * campana(a, 0, 0.12) - 0.006 * campana(a, 0.55, 0.25) + 0.026 * Math.sin(th) ** 2 + 0.012 * suave(2.2, Math.PI, a)) / L; };
      const abajo = (th) => 1 - (0.016 * (1 - campana(th, 0, 0.5))) / L;
      const fr = ondas(51, [9, 15], [1, 0.5]);
      const def = (th, v) => ({ m: 1 + 0.012 * campana(th, 0, 0.35) * fr(th * 3) });
      return [
        pieza(superficie({ perfil: P, columnas: 160, filas: 40, arriba: escote, abajo, deformar: def })),
        ...tirantesFinos(P, escote, def, { thF: 0.55 }),
        ...lazo({ centro: V3(0, 1.262, 0.124), frente: V3(0, 0, 1), tam: 0.85, colas: 0.8 }).map((g) => pieza(g)),
      ];
    },

    faldaPlisada() { return faldaPlisada({ largo: 0.42, pliegues: 48 }); },

    // Mini evasé con volante en el ruedo.
    faldaVichy() {
      const P = perfil([{ y: 1.040, a: 0.134, b: 0.099 }, { y: 0.950, a: 0.176, b: 0.132 }, { y: 0.840, a: 0.234, b: 0.192 }, { y: 0.745, a: 0.270, b: 0.232 }]);
      const pl = ondas(61, [6, 10, 15], [1, 0.5, 0.3]);
      const def = (th, v) => ({ m: 1 + 0.06 * suave(0.15, 1, v) * pl(th) });
      const PV = perfil([{ y: 0.770, a: 0.266, b: 0.228 }, { y: 0.705, a: 0.300, b: 0.262 }, { y: 0.676, a: 0.312, b: 0.272 }]);
      const gv = ondas(62, [26, 37], [1, 0.5]);
      const defV = (th, v) => ({ m: 1 + 0.055 * pl(th) + 0.1 * suave(0, 1, v) * gv(th), dy: 0.008 * suave(0.5, 1, v) * gv(th) });
      return [
        pieza(superficie({ perfil: P, columnas: 180, filas: 60, deformar: def, vuelo: (v) => suave(0.1, 1, v) ** 1.3 })),
        pieza(superficie({ perfil: PV, columnas: 260, filas: 16, deformar: defV, vuelo: () => 1 })),
        pieza(pretina(1.072, 1.036, 0.137, 0.102)),
      ];
    },

    pantalonPalazzo() { return pantalon({ tipo: 'palazzo' }); },
    pantalonSastre() { return pantalon({ tipo: 'sastre' }); },

    conjuntoRose() {
      return [...MODELOS.topLazo(), ...faldaPlisada({ largo: 0.74, pliegues: 40 })];
    },

    conjuntoLino() {
      const P = perfil([
        { y: 1.452, a: 0.076, b: 0.072 }, { y: 1.432, a: 0.136, b: 0.086 }, { y: 1.398, a: 0.190, b: 0.100 },
        { y: 1.320, a: 0.192, b: 0.130 }, { y: 1.220, a: 0.188, b: 0.142 }, { y: 1.080, a: 0.190, b: 0.145 }, { y: 1.000, a: 0.193, b: 0.147 },
      ]);
      const L = P.largo;
      const escote = (th) => (0.02 + 0.05 * Math.max(0, Math.cos(th)) ** 2) / L;
      const ar = ondas(71, [6, 11, 17, 29], [1, 0.6, 0.35, 0.2]);
      const def = (th, v) => ({ m: 1 + 0.014 * suave(0.3, 1, v) * ar(th) });
      const piezas = [pieza(superficie({ perfil: P, columnas: 180, filas: 80, arriba: escote, deformar: def }))];
      for (const s of [-1, 1]) {
        const g = ondas(74 + s, [7, 12], [1, 0.5]);
        piezas.push(pieza(tubo({
          puntos: [V3(s * 0.155, 1.385, 0), V3(s * 0.222, 1.33, 0.006), V3(s * 0.262, 1.215, 0.012)],
          radio: tramos([[0, 0.07], [0.3, 0.082], [1, 0.088]]), columnas: 72, filas: 30,
          deformar: (ph, u) => 1 + 0.03 * u * g(ph),
        })));
      }
      return [...piezas, ...pantalon({ tipo: 'palazzo', lazo: false })];
    },
  };

  function faldaPlisada({ largo, pliegues }) {
    const yR = largo, h = 1.04 - yR;
    const P = perfil([
      { y: 1.040, a: 0.134, b: 0.099 }, { y: 1.04 - h * 0.15, a: 0.168, b: 0.124 }, { y: 1.04 - h * 0.30, a: 0.192, b: 0.148 },
      { y: 1.04 - h * 0.65, a: 0.226 + h * 0.03, b: 0.190 + h * 0.03 }, { y: yR, a: 0.25 + h * 0.06, b: 0.218 + h * 0.06 },
    ]);
    const sw = ondas(81, [3, 5, 7], [1, 0.6, 0.3]);
    const def = (th, v) => {
      const amp = lerp(0.012, 0.05, suave(0, 1, v));
      return { m: 1 + amp * triangular(pliegues * th) + 0.025 * suave(0.2, 1, v) * sw(th), dy: 0.006 * suave(0.7, 1, v) * sw(th * 2) };
    };
    return [
      pieza(superficie({ perfil: P, columnas: pliegues * 6, filas: 70, deformar: def, vuelo: (v) => suave(0.08, 1, v) ** 1.3 })),
      pieza(pretina(1.078, 1.036, 0.138, 0.103)),
    ];
  }

  function pantalon({ tipo, lazo: conLazo = true }) {
    const palazzo = tipo === 'palazzo';
    const piezas = [];
    const yCintura = palazzo ? 1.06 : 1.0;
    for (const s of [-1, 1]) {
      const P = palazzo
        ? perfil([
          { y: 1.060, a: 0.106, b: 0.098, cx: s * 0.032 }, { y: 0.950, a: 0.140, b: 0.122, cx: s * 0.046 },
          { y: 0.865, a: 0.150, b: 0.136, cx: s * 0.058 }, { y: 0.760, a: 0.134, b: 0.140, cx: s * 0.096 },
          { y: 0.500, a: 0.140, b: 0.150, cx: s * 0.136 }, { y: 0.070, a: 0.154, b: 0.166, cx: s * 0.176 },
        ])
        : perfil([
          { y: 1.000, a: 0.110, b: 0.097, cx: s * 0.030 }, { y: 0.950, a: 0.134, b: 0.117, cx: s * 0.044 },
          { y: 0.865, a: 0.147, b: 0.133, cx: s * 0.056 }, { y: 0.770, a: 0.116, b: 0.122, cx: s * 0.090 },
          { y: 0.680, a: 0.104, b: 0.110, cx: s * 0.100 }, { y: 0.500, a: 0.099, b: 0.104, cx: s * 0.112 },
          { y: 0.080, a: 0.096, b: 0.100, cx: s * 0.126 },
        ]);
      const vEntre = P.vDeY(0.78);
      const pl = ondas(90 + s, palazzo ? [5, 8, 13] : [4, 7], [1, 0.5, 0.25]);
      const def = (th, v) => {
        const t = suave(vEntre, 1, v);
        const raya = palazzo ? 0.02 * campana(th, 0, 0.15) : 0.05 * campana(th, 0, 0.085) + 0.035 * campana(Math.abs(th), Math.PI, 0.085);
        const caida = palazzo ? 0.06 * t ** 1.3 * pl(th) : 0.012 * suave(0.85, 1, v) * pl(th * 2);
        return { m: 1 + raya * suave(vEntre * 0.4, vEntre, v) + caida, dy: palazzo ? 0.01 * t ** 3 * pl(th) : 0 };
      };
      piezas.push(pieza(superficie({ perfil: P, columnas: 140, filas: 100, deformar: def, vuelo: palazzo ? (v) => suave(vEntre, 1, v) ** 1.4 * 0.8 : null })));
    }
    if (palazzo) {
      piezas.push(pieza(pretina(1.100, 1.054, 0.140, 0.104)));
      if (conLazo) {
        piezas.push(pieza(pretina(1.088, 1.066, 0.146, 0.110)));
        const th = 0.62;
        const c = V3(0.146 * Math.sin(th), 1.077, 0.110 * Math.cos(th) + 0.006);
        piezas.push(...lazo({ centro: c, frente: V3(Math.sin(th) * 0.6, 0, Math.cos(th)), tam: 0.95, colas: 2.4 }).map((g) => pieza(g)));
      }
    } else {
      piezas.push(pieza(pretina(1.040, 0.998, 0.122, 0.101)));
      const boton = new THREE.CylinderGeometry(0.0085, 0.0085, 0.004, 24);
      boton.rotateX(Math.PI / 2); boton.translate(0, 1.019, 0.104);
      piezas.push(pieza(conVuelo(boton), 'acento'));
    }
    return piezas;
  }

  // ---------- Telas ----------
  const TELAS = {
    satin: { roughness: 0.32, sheen: 0.35, sheenRoughness: 0.32, specularIntensity: 0.75 },
    algodon: { roughness: 0.86, sheen: 0.75, sheenRoughness: 0.55, specularIntensity: 0.35 },
    lino: { roughness: 0.94, sheen: 0.55, sheenRoughness: 0.7, specularIntensity: 0.25 },
    crepe: { roughness: 0.7, sheen: 0.5, sheenRoughness: 0.45, specularIntensity: 0.45 },
    punto: { roughness: 0.78, sheen: 0.85, sheenRoughness: 0.4, specularIntensity: 0.4 },
    metal: { roughness: 0.3, metalness: 1, sheen: 0 },
  };

  function crearTela(tipo, uVuelo) {
    const mat = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, sheenColor: new THREE.Color('#ffffff'), ...TELAS[tipo] });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uVuelo = uVuelo;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float vuelo;\nuniform float uVuelo;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat wv = vuelo * uVuelo;\ntransformed.xz *= 1.0 + wv;\ntransformed.y += wv * 0.16;');
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <tonemapping_fragment>',
        'gl_FragColor.rgb *= gl_FrontFacing ? 1.0 : 0.52;\n#include <tonemapping_fragment>'
      );
    };
    return mat;
  }

  const texturas = new Map();
  function textura(c) {
    const clave = `${c.estampado}|${c.fondo}|${c.tinta}`;
    if (texturas.has(clave)) return texturas.get(clave);
    const lienzo = document.createElement('canvas');
    const x = lienzo.getContext('2d');
    let tile;
    if (c.estampado === 'lunares') {
      lienzo.width = lienzo.height = 256; tile = 0.066;
      x.fillStyle = c.fondo; x.fillRect(0, 0, 256, 256);
      x.fillStyle = c.tinta;
      for (const [px, py] of [[64, 64], [192, 192]]) { x.beginPath(); x.arc(px, py, 27, 0, TAU); x.fill(); }
    } else {
      lienzo.width = lienzo.height = 128; tile = 0.03;
      x.fillStyle = c.fondo; x.fillRect(0, 0, 128, 128);
      x.globalAlpha = 0.5; x.fillStyle = c.tinta;
      x.fillRect(0, 0, 64, 128); x.fillRect(0, 0, 128, 64);
      x.globalAlpha = 0.08;
      for (let i = 0; i < 128; i += 4) { x.fillRect(i, 0, 1, 128); x.fillRect(0, i, 128, 1); }
    }
    const t = new THREE.CanvasTexture(lienzo);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / tile, 1 / tile);
    t.anisotropy = 8;
    texturas.set(clave, t);
    return t;
  }

  function texturaSombra() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.45, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  // ---------- Prenda lista para mostrar ----------
  const cachePiezas = new Map();
  function piezasDe(modelo) {
    if (!cachePiezas.has(modelo)) {
      const piezas = MODELOS[modelo]();
      let minY = Infinity, maxY = -Infinity, rx = 0, rz = 0, r = 0;
      for (const p of piezas) {
        const a = p.geo.attributes.position.array;
        for (let i = 0; i < a.length; i += 3) {
          const x = a[i], y = a[i + 1], z = a[i + 2];
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          rx = Math.max(rx, Math.abs(x)); rz = Math.max(rz, Math.abs(z)); r = Math.max(r, Math.hypot(x, z));
        }
      }
      const banda = (maxY - minY) * 0.12;
      let rArriba = 0, rAbajo = 0;
      for (const p of piezas) {
        const a = p.geo.attributes.position.array;
        for (let i = 0; i < a.length; i += 3) {
          const h = Math.hypot(a[i], a[i + 2]);
          if (a[i + 1] > maxY - banda) rArriba = Math.max(rArriba, h);
          if (a[i + 1] < minY + banda) rAbajo = Math.max(rAbajo, h);
        }
      }
      cachePiezas.set(modelo, { piezas, caja: { minY, maxY, rx, rz, r, rArriba, rAbajo } });
    }
    return cachePiezas.get(modelo);
  }

  function construir(producto) {
    const { piezas, caja } = piezasDe(producto.modelo);
    const uVuelo = { value: 0 };
    const principal = crearTela(producto.tela, uVuelo);
    const acento = crearTela(producto.telaAcento || 'metal', uVuelo);
    const grupo = new THREE.Group();
    for (const p of piezas) grupo.add(new THREE.Mesh(p.geo, p.mat === 'acento' ? acento : principal));
    return {
      grupo, caja, uVuelo,
      aplicar(c) {
        if (c.estampado) { principal.map = textura(c); principal.color.set('#ffffff'); }
        else { principal.map = null; principal.color.set(c.hex); }
        acento.color.set(c.acento || '#c9b28f');
        principal.needsUpdate = true; acento.needsUpdate = true;
      },
      soltar() { principal.dispose(); acento.dispose(); },
    };
  }

  // ---------- Escenario: base giratoria, luces y cámara ----------
  function crearEscenario({ miniatura = false } = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: miniatura, powerPreference: miniatura ? 'low-power' : 'default' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    const escena = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    escena.environmentIntensity = 0.8;
    pmrem.dispose();
    const luz = new THREE.DirectionalLight(0xffffff, 1.55); luz.position.set(1.6, 2.6, 3.2); escena.add(luz);
    const relleno = new THREE.DirectionalLight(0xfff4f7, 0.45); relleno.position.set(-2.6, 1.0, 1.6); escena.add(relleno);
    const contra = new THREE.DirectionalLight(0xffdde8, 1.15); contra.position.set(-1.2, 2.2, -3.2); escena.add(contra);
    const camara = new THREE.PerspectiveCamera(24, 1, 0.05, 40);
    const giro = new THREE.Group(); escena.add(giro);
    const disco = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 120, 1),
      new THREE.MeshPhysicalMaterial({ color: '#F2C3D3', roughness: 0.45, clearcoat: 0.55, clearcoatRoughness: 0.3 })
    );
    giro.add(disco);
    const sombra = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texturaSombra(), transparent: true, depthWrite: false, color: 0x6a2a42, opacity: 0.42 }));
    sombra.rotation.x = -Math.PI / 2; giro.add(sombra);
    let actual = null, marco = null, ancho = 1, alto = 1;
    const ndc = new THREE.Vector3();

    // Busca la distancia de cámara para que prenda y base quepan con el margen pedido, centradas.
    function encuadrar() {
      if (!marco) return;
      camara.aspect = ancho / alto;
      camara.updateProjectionMatrix();
      const elev = THREE.MathUtils.degToRad(7), tv = Math.tan(THREE.MathUtils.degToRad(camara.fov) / 2);
      const pts = marco.puntos, lim = 1 / marco.margen;
      let cy = marco.base + marco.alto / 2, d = 4;
      const colocar = () => { camara.position.set(0, cy + Math.sin(elev) * d, Math.cos(elev) * d); camara.lookAt(0, cy, 0); camara.updateMatrixWorld(); };
      const medir = () => {
        let x1 = 0, y0 = 9, y1 = -9;
        for (const p of pts) { ndc.copy(p).project(camara); x1 = Math.max(x1, Math.abs(ndc.x)); y0 = Math.min(y0, ndc.y); y1 = Math.max(y1, ndc.y); }
        return { x1, y0, y1 };
      };
      for (let pasada = 0; pasada < 3; pasada++) {
        let lo = 0.3, hi = 40;
        for (let i = 0; i < 26; i++) {
          d = (lo + hi) / 2; colocar();
          const m = medir();
          if (m.x1 <= lim && (m.y1 - m.y0) / 2 <= lim) hi = d; else lo = d;
        }
        d = hi; colocar();
        const m = medir();
        cy += ((m.y0 + m.y1) / 2) * d * tv;
      }
      colocar();
    }

    return {
      lienzo: renderer.domElement,
      mostrar(prenda, { margen = 1.1 } = {}) {
        if (actual) giro.remove(actual.grupo);
        actual = prenda;
        if (!prenda) { marco = null; return; }
        giro.add(prenda.grupo);
        const c = prenda.caja, H = c.maxY - c.minY;
        const R = Math.max(c.r * 1.16, H * 0.22);
        const hueco = clamp(H * 0.05, 0.018, 0.05), grosor = 0.03 + R * 0.07;
        prenda.grupo.position.y = -c.minY + hueco;
        disco.scale.set(R, grosor, R); disco.position.y = -grosor / 2;
        sombra.scale.set(c.rx * 1.25, c.rz * 1.25, 1); sombra.position.y = 0.0015;
        sombra.material.opacity = 0.5 - hueco * 3;
        const top = H + hueco, puntos = [];
        for (const [y, r] of [[top, c.rArriba], [hueco, c.rAbajo], [hueco + H / 2, c.r]]) puntos.push(V3(r, y, 0), V3(-r, y, 0), V3(0, y, r), V3(0, y, -r));
        for (const y of [0, -grosor]) puntos.push(V3(R, y, 0), V3(-R, y, 0), V3(0, y, R), V3(0, y, -R));
        marco = { alto: H + hueco + grosor, base: -grosor, R, margen, puntos };
        encuadrar();
      },
      tamano(w, h, pr) {
        ancho = Math.max(1, w); alto = Math.max(1, h);
        renderer.setPixelRatio(pr ?? Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(ancho, alto, false);
        encuadrar();
      },
      set angulo(a) { giro.rotation.y = a; },
      set vuelo(v) { if (actual) actual.uVuelo.value = v; },
      render() { renderer.render(escena, camara); },
      montar(contenedor) { if (renderer.domElement.parentNode !== contenedor) contenedor.prepend(renderer.domElement); },
    };
  }

  // ---------- Fotos para el catálogo ----------
  let horno = null;
  function foto(producto, colorIdx, { ancho = 540, alto = 720, angulo = -0.3, formato = 'image/webp', vuelo = 0, margen = 1.08 } = {}) {
    if (!horno) horno = crearEscenario({ miniatura: true });
    const prenda = construir(producto);
    prenda.aplicar(producto.colores[colorIdx]);
    horno.tamano(ancho, alto, 1);
    horno.mostrar(prenda, { margen });
    horno.angulo = angulo;
    prenda.uVuelo.value = vuelo;
    horno.render();
    const url = horno.lienzo.toDataURL(formato, 0.9);
    horno.mostrar(null);
    prenda.soltar();
    return url;
  }

  return { construir, crearEscenario, foto, modelos: Object.keys(MODELOS) };
}

/* ============================================================
   Interfaz: catálogo, probador 360, ficha, carrito y WhatsApp.
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Ajustes que el dueño cambia en su panel: tasa BCV, precios y tallas agotadas.
// Llegan de API_TIENDA; sin servidor (vista previa) se usan los valores de datos.js.
const AJUSTES = { tasa: CONFIG.tasaInicial?.valor || 0, tasaFecha: CONFIG.tasaInicial?.fecha || '' };
function aplicarAjustes(a) {
  if (!a || typeof a !== 'object') return;
  if (Number.isFinite(a.tasa) && a.tasa >= 0) { AJUSTES.tasa = a.tasa; AJUSTES.tasaFecha = typeof a.tasaFecha === 'string' ? a.tasaFecha : ''; }
  for (const p of PRODUCTOS) {
    const x = a.productos?.[p.id];
    if (!x) continue;
    if (Number.isFinite(x.precio) && x.precio > 0) p.precio = x.precio;
    if (Array.isArray(x.agotadas)) p.agotadas = x.agotadas.filter((t) => p.tallas.includes(t));
  }
}
const agotada = (p) => p.tallas.every((t) => p.agotadas.includes(t));
const formatoBs = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bolivares = (usd, tasa = AJUSTES.tasa) => (tasa > 0 ? `Bs. ${formatoBs.format(usd * tasa)}` : '');
function fechaLarga(iso) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-VE', { day: 'numeric', month: 'long' });
}
const textoTasa = () => (AJUSTES.tasa > 0 ? `Tasa BCV${AJUSTES.tasaFecha ? ` del ${fechaLarga(AJUSTES.tasaFecha)}` : ''}: ${formatoBs.format(AJUSTES.tasa)} Bs. por dólar.` : '');
const VUELTA = Math.PI * 2;
const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const limitar = (x, a, b) => Math.min(b, Math.max(a, x));
const porId = new Map(PRODUCTOS.map((p) => [p.id, p]));
const nombreCategoria = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.nombre]));
const normalizar = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
for (const p of PRODUCTOS) {
  p._texto = normalizar([p.nombre, nombreCategoria[p.categoria], p.descripcion, ...p.colores.map((c) => c.nombre), ...(p.etiquetas || [])].join(' '));
}
const precio = (n) => CONFIG.moneda + (Number.isInteger(n) ? String(n) : n.toFixed(2));

function leer(clave, def) { try { const v = localStorage.getItem(clave); return v ? JSON.parse(v) : def; } catch { return def; } }
function guardar(clave, v) { try { localStorage.setItem(clave, JSON.stringify(v)); } catch { /* sin almacenamiento: no pasa nada */ } }

function el(tag, props = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const h of hijos.flat()) if (h != null && h !== false) e.append(h);
  return e;
}

function fondoMuestra(c, chico = false) {
  if (c.estampado === 'lunares') {
    if (chico) return `radial-gradient(circle, ${c.tinta} 0 2px, transparent 2.6px) center / 100% 100% no-repeat, ${c.fondo}`;
    return `radial-gradient(circle, ${c.tinta} 0 2.3px, transparent 2.9px) 0 0 / 13px 13px, radial-gradient(circle, ${c.tinta} 0 2.3px, transparent 2.9px) 6.5px 6.5px / 13px 13px, ${c.fondo}`;
  }
  if (c.estampado === 'vichy') return `linear-gradient(90deg, ${c.tinta}88 50%, transparent 0) 0 0 / ${chico ? 6 : 10}px ${chico ? 6 : 10}px, linear-gradient(${c.tinta}88 50%, transparent 0) 0 0 / ${chico ? 6 : 10}px ${chico ? 6 : 10}px, ${c.fondo}`;
  return c.hex;
}

// Si la búsqueda nombra un color ("negro", "rosa"), la foto muestra la prenda en ese color.
function colorBuscado(p) {
  const palabras = normalizar(estado.busqueda).split(/\s+/).filter(Boolean);
  const i = palabras.length ? p.colores.findIndex((c) => palabras.some((w) => normalizar(c.nombre).includes(w))) : -1;
  return Math.max(0, i);
}

// ---------- Estado ----------
const estado = {
  categoria: 'todo',
  busqueda: '',
  colorDestacado: 0,
  carrito: leer(CONFIG.clave + '-carrito', []).filter((i) => {
    const p = porId.get(i.id);
    return p && p.colores[i.color] && p.tallas.includes(i.talla) && i.cantidad > 0;
  }),
  datos: Object.assign({ nombre: '', entrega: CONFIG.entregas[0].id, direccion: '', pago: CONFIG.pagos[0], nota: '' }, leer(CONFIG.clave + '-datos', {})),
};
if (!CONFIG.entregas.some((o) => o.id === estado.datos.entrega)) estado.datos.entrega = CONFIG.entregas[0].id;
if (!CONFIG.pagos.includes(estado.datos.pago)) estado.datos.pago = CONFIG.pagos[0] || '';
let ficha = null; // { p, color, talla, origen }

// ---------- Fotos del catálogo (se generan con el motor 3D) ----------
const fotos = new Map();
const cola = [];
let horneando = false;

function claveFoto(p, color) { return `${p.id}:${color}`; }

function imgFoto(p, color, props = {}) {
  const clave = claveFoto(p, color);
  const img = el('img', { width: 540, height: 720, decoding: 'async', ...props });
  if (fotos.has(clave)) img.src = fotos.get(clave);
  else { img.dataset.foto = clave; pedirFoto(p, color); }
  return img;
}

function pedirFoto(p, color, primero = false) {
  const clave = claveFoto(p, color);
  if (fotos.has(clave) || cola.some((t) => t.clave === clave) || esperanMotor.some((t) => t.clave === clave)) return;
  const tarea = { p, color, clave };
  if (primero) cola.unshift(tarea); else cola.push(tarea);
  hornear();
}

// Las prendas con fotos propias no esperan al motor 3D; las demás sí.
const esperanMotor = [];
function hornear() {
  if (horneando || !cola.length || (motor && bucle.giroInicial)) return;
  horneando = true;
  const siguiente = () => {
    const t = cola.shift();
    if (!t) { horneando = false; return; }
    const c = t.p.colores[t.color];
    let url = c.fotos360?.length ? c.fotos360[0] : null;
    if (!url && !motor) { esperanMotor.push(t); setTimeout(siguiente, 0); return; }
    if (!url) { try { url = motor.foto(t.p, t.color); } catch (e) { console.error(e); } }
    if (url) {
      fotos.set(t.clave, url);
      for (const img of $$(`img[data-foto="${t.clave}"]`)) { img.src = url; img.removeAttribute('data-foto'); }
    }
    setTimeout(siguiente, 12);
  };
  setTimeout(siguiente, 0);
}

// ---------- Motor 3D ----------
let motor = null;
let escenario = null;
const prendas = new Map();

function prendaDe(p) {
  if (!prendas.has(p.id)) prendas.set(p.id, motor.construir(p));
  return prendas.get(p.id);
}

// Un solo bucle de animación para el probador que esté a la vista.
const bucle = { activo: null, corriendo: false, previo: 0, giroInicial: false };
function pedirCuadro() {
  if (bucle.corriendo) return;
  bucle.corriendo = true;
  bucle.previo = performance.now();
  requestAnimationFrame(cuadro);
}
function cuadro(t) {
  const dt = limitar((t - bucle.previo) / 1000, 0.001, 0.05);
  bucle.previo = t;
  const sigue = bucle.activo ? bucle.activo.paso(dt, t) : false;
  if (sigue) requestAnimationFrame(cuadro);
  else bucle.corriendo = false;
}

const suaveSalida = (k) => 1 - (1 - k) ** 3;
const suaveAmbos = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const pxPorGrado = (w) => limitar((w / 2 - 56) / 90, 1.2, 2.3);
const ETIQUETAS = { 0: 'Frente', 90: 'Lado', 180: 'Espalda', 270: 'Lado' };
const grados = (rad) => (rad * 180) / Math.PI;
const normal360 = (g) => ((g % 360) + 360) % 360;
function nombreVista(g) {
  const m = normal360(g);
  if (m < 45 || m >= 315) return 'de frente';
  if (m < 135) return 'del lado derecho';
  if (m < 225) return 'de espalda';
  return 'del lado izquierdo';
}

function crearProbador(raiz, { alTocar = null } = {}) {
  const escena = $('.escena', raiz);
  const cinta = $('.cinta', raiz);
  const lienzo = $('canvas', cinta);
  const pista = $('.pista', raiz);
  const st = { ang: 0, vel: 0, anim: null, vuelo: 0, previo: 0, arrastre: null, p: null, color: 0, vista: '', fotos: null };
  const textoPista = pista.textContent;

  const api = {
    raiz,
    get producto() { return st.p; },
    activar(p, color = 0) {
      if (bucle.giroInicial && bucle.activo !== api) { bucle.giroInicial = false; setTimeout(hornear, 300); }
      st.p = p; st.color = color; st.ang = 0; st.previo = 0; st.vel = 0; st.anim = null; st.vuelo = 0; st.vista = '';
      bucle.activo = api;
      montar();
      pedirCuadro();
    },
    color(i) {
      st.color = i;
      montar();
      pedirCuadro();
    },
    girarA(destino) {
      st.vel = 0;
      st.anim = { desde: st.ang, hasta: destino, t0: performance.now(), dur: sinMovimiento ? 1 : 560, curva: suaveSalida };
      pedirCuadro();
    },
    vuelta() {
      if (sinMovimiento || bucle.activo !== api) { bucle.giroInicial = false; hornear(); return; }
      st.anim = { desde: st.ang, hasta: st.ang + VUELTA, t0: performance.now(), dur: 2100, curva: suaveAmbos, inicial: true };
      bucle.giroInicial = true;
      pedirCuadro();
    },
    redimensionar() {
      if (bucle.activo === api && escenario && escena.clientWidth) {
        escenario.tamano(escena.clientWidth, escena.clientHeight);
        pedirCuadro();
      }
    },
    paso(dt, t) {
      if (st.anim) {
        const k = Math.min(1, (t - st.anim.t0) / st.anim.dur);
        st.ang = st.anim.desde + (st.anim.hasta - st.anim.desde) * st.anim.curva(k);
        if (k >= 1) {
          if (st.anim.inicial) { bucle.giroInicial = false; setTimeout(hornear, 200); }
          st.anim = null;
          st.ang %= VUELTA;
          st.previo = st.ang;
        }
      } else if (!st.arrastre && Math.abs(st.vel) > 0.03) {
        st.ang += st.vel * dt;
        st.vel *= Math.pow(0.05, dt);
      } else if (!st.arrastre) st.vel = 0;
      const omega = (st.ang - st.previo) / dt;
      st.previo = st.ang;
      const objetivo = sinMovimiento ? 0 : Math.min(1, Math.abs(omega) / 6.5) ** 1.25 * 0.24;
      st.vuelo += (objetivo - st.vuelo) * (1 - Math.exp(-dt * (objetivo > st.vuelo ? 9 : 3.5)));
      if (st.vuelo < 0.0015 && objetivo === 0) st.vuelo = 0;
      dibujar();
      return Boolean(st.anim || st.arrastre || Math.abs(st.vel) > 0.03 || st.vuelo > 0);
    },
  };

  function montar() {
    if (!st.p) return;
    const c = st.p.colores[st.color];
    st.fotos = c.fotos360?.length ? c.fotos360 : null;
    let img = $('.foto360', escena);
    if (st.fotos) {
      if (!img) { img = el('img', { class: 'foto360', alt: '' }); escena.append(img); }
      for (const src of st.fotos) { const pre = new Image(); pre.src = src; }
      if (escenario) escenario.lienzo.hidden = true;
      escena.dataset.estado = 'listo';
      return;
    }
    if (img) img.remove();
    if (!escenario || bucle.activo !== api) return;
    escenario.lienzo.hidden = false;
    escenario.montar(escena);
    escenario.tamano(escena.clientWidth, escena.clientHeight);
    const prenda = prendaDe(st.p);
    prenda.aplicar(c);
    escenario.mostrar(prenda);
    escena.dataset.estado = 'listo';
  }

  function dibujar() {
    if (st.fotos) {
      const n = st.fotos.length, i = Math.round((normal360(grados(st.ang)) / 360) * n) % n;
      const img = $('.foto360', escena);
      if (img && img.getAttribute('src') !== st.fotos[i]) img.src = st.fotos[i];
    } else if (escenario && bucle.activo === api && escena.dataset.estado === 'listo') {
      escenario.angulo = st.ang;
      escenario.vuelo = st.vuelo;
      escenario.render();
    }
    dibujarCinta();
    const g = grados(st.ang), vista = nombreVista(g);
    cinta.setAttribute('aria-valuenow', String(Math.round(normal360(g))));
    if (vista !== st.vista && st.p) {
      st.vista = vista;
      cinta.setAttribute('aria-valuetext', `Vista ${vista}`);
      escena.setAttribute('aria-label', `${st.p.nombre}, ${st.p.colores[st.color].nombre.toLowerCase()}, vista ${vista}`);
    }
  }

  function dibujarCinta() {
    const w = lienzo.clientWidth, h = lienzo.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (lienzo.width !== Math.round(w * dpr)) { lienzo.width = Math.round(w * dpr); lienzo.height = Math.round(h * dpr); }
    const x = lienzo.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    x.fillStyle = '#F2C3D3';
    x.fillRect(0, 0, w, h);
    const g = grados(st.ang), centro = w / 2, ppg = pxPorGrado(w);
    const d0 = Math.floor((g - centro / ppg) / 5) * 5 - 5, d1 = g + centro / ppg + 5;
    x.textAlign = 'center';
    for (let d = d0; d <= d1; d += 5) {
      const px = Math.round(centro + (g - d) * ppg) + 0.5, m = normal360(d);
      const largo = m % 90 === 0 ? 15 : m % 45 === 0 ? 11 : m % 15 === 0 ? 8 : 5;
      x.fillStyle = '#000';
      x.fillRect(px - 0.5, 0, 1, largo);
      if (m % 90 === 0) {
        const cerca = Math.abs(px - centro) < 34;
        x.font = `${cerca ? 600 : 400} 13px Jost, Futura, sans-serif`;
        x.fillStyle = cerca ? '#000' : '#6E5964';
        x.fillText(ETIQUETAS[m], px, largo + 17);
      }
    }
  }

  function ocultarPista() { pista.classList.add('oculta'); }

  function arrastrable(zona, sensibilidad, esCinta) {
    zona.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !st.p) return;
      st.arrastre = { id: e.pointerId, x0: e.clientX, x: e.clientX, t: performance.now(), movio: false, sens: sensibilidad() };
      st.anim = null; st.vel = 0;
      if (bucle.giroInicial) { bucle.giroInicial = false; setTimeout(hornear, 200); }
      zona.setPointerCapture(e.pointerId);
      pedirCuadro();
    });
    zona.addEventListener('pointermove', (e) => {
      const a = st.arrastre;
      if (!a || a.id !== e.pointerId) return;
      const ahora = performance.now(), dx = e.clientX - a.x, dts = Math.max(8, ahora - a.t) / 1000;
      a.x = e.clientX; a.t = ahora;
      if (Math.abs(e.clientX - a.x0) > 6) { a.movio = true; ocultarPista(); }
      st.ang += dx * a.sens;
      st.vel = 0.6 * st.vel + 0.4 * ((dx * a.sens) / dts);
      pedirCuadro();
    });
    const soltar = (e) => {
      const a = st.arrastre;
      if (!a || a.id !== e.pointerId) return;
      st.arrastre = null;
      if (performance.now() - a.t > 90 || sinMovimiento) st.vel = 0;
      st.vel = limitar(st.vel, -14, 14);
      if (!a.movio && e.type === 'pointerup') {
        if (esCinta) tocarEtiqueta(e.clientX - zona.getBoundingClientRect().left);
        else if (alTocar) alTocar();
      }
      pedirCuadro();
    };
    zona.addEventListener('pointerup', soltar);
    zona.addEventListener('pointercancel', soltar);
  }

  function tocarEtiqueta(px) {
    const w = lienzo.clientWidth, g = grados(st.ang), ppg = pxPorGrado(w);
    let mejor = null, distancia = 48;
    for (let d = Math.floor((g - w / ppg) / 90) * 90; d <= g + w / ppg; d += 90) {
      const pos = w / 2 + (g - d) * ppg;
      if (Math.abs(pos - px) < distancia) { distancia = Math.abs(pos - px); mejor = d; }
    }
    if (mejor !== null) { ocultarPista(); api.girarA((mejor * Math.PI) / 180); }
  }

  arrastrable(escena, () => VUELTA / Math.max(280, escena.clientWidth * 1.05), false);
  arrastrable(cinta, () => Math.PI / 180 / pxPorGrado(lienzo.clientWidth), true);

  cinta.addEventListener('keydown', (e) => {
    const paso = { ArrowRight: 15, ArrowUp: 15, ArrowLeft: -15, ArrowDown: -15, PageUp: 90, PageDown: -90 }[e.key];
    let destino = null;
    if (paso) destino = st.ang + (paso * Math.PI) / 180;
    else if (e.key === 'Home') destino = Math.round(st.ang / VUELTA) * VUELTA;
    else if (e.key === 'End') destino = Math.round((st.ang - Math.PI) / VUELTA) * VUELTA + Math.PI;
    if (destino === null) return;
    e.preventDefault();
    ocultarPista();
    api.girarA(destino);
  });

  new ResizeObserver(() => { api.redimensionar(); dibujarCinta(); }).observe(escena);
  pista.dataset.texto = textoPista;
  return api;
}

const probadorDestacado = crearProbador($('#probador-destacado'), { alTocar: () => abrirFicha(CONFIG.destacado, { empujar: true, color: estado.colorDestacado }) });
const probadorFicha = crearProbador($('#probador-ficha'));

async function iniciarMotor() {
  // El motor 3D va guardado en la propia página (vendor/). Si no baja es por la conexión;
  // si baja pero no arranca, es que el teléfono no puede dibujar en 3D.
  let bajo = false;
  try {
    const [THREE, { RoomEnvironment }] = await Promise.all([import('three'), import('three/addons/environments/RoomEnvironment.js')]);
    bajo = true;
    motor = crearMotor(THREE, RoomEnvironment);
    escenario = motor.crearEscenario();
  } catch (error) {
    console.error(error);
    motor = null;
    const texto = bajo
      ? 'Este teléfono no puede mostrar la vista 360. Igual puedes ver los colores, elegir tu talla y pedir.'
      : 'La vista 360 no cargó. Revisa tu conexión y vuelve a abrir la página.';
    for (const escena of $$('.escena')) {
      escena.dataset.estado = 'error';
      escena.append(el('p', { class: 'escena-aviso' }, texto));
    }
    for (const img of $$('img[data-foto]')) img.closest('.foto')?.classList.add('sin-foto');
    return;
  }
  cola.push(...esperanMotor.splice(0));
  const activo = bucle.activo;
  if (activo?.producto) activo.activar(activo.producto, activo === probadorFicha ? ficha.color : estado.colorDestacado);
  if (activo === probadorDestacado && !sinMovimiento && !$('#destacado').hidden) {
    bucle.giroInicial = true;
    setTimeout(() => probadorDestacado.vuelta(), 350);
  } else hornear();
}

// ---------- Catálogo ----------
function renderCategorias() {
  const opciones = [{ id: 'todo', nombre: 'Todo' }, ...CATEGORIAS];
  $('#categorias').replaceChildren(...opciones.map((c) => el('button', {
    class: 'chip', type: 'button', 'aria-pressed': String(estado.categoria === c.id),
    onclick: () => elegirCategoria(c.id),
  }, c.nombre)));
}

function elegirCategoria(id) {
  estado.categoria = id;
  renderCategorias();
  renderCatalogo();
  const cab = $('.catalogo');
  const tope = cab.getBoundingClientRect().top + window.scrollY - $('.categorias-barra').offsetHeight - $('.barra').offsetHeight - 8;
  if (window.scrollY > tope || id !== 'todo') window.scrollTo({ top: Math.max(0, tope), behavior: sinMovimiento ? 'auto' : 'smooth' });
}

function filtrados() {
  const palabras = normalizar(estado.busqueda).split(/\s+/).filter(Boolean);
  return PRODUCTOS.filter((p) => (estado.categoria === 'todo' || p.categoria === estado.categoria) && palabras.every((w) => p._texto.includes(w)));
}

function renderCatalogo() {
  const lista = filtrados();
  const filtrando = estado.categoria !== 'todo' || estado.busqueda.trim() !== '';
  const destacado = $('#destacado');
  const ocultar = filtrando;
  if (destacado.hidden !== ocultar) {
    destacado.hidden = ocultar;
    if (!ocultar && !ficha) probadorDestacado.activar(porId.get(CONFIG.destacado), estado.colorDestacado);
  }
  const q = estado.busqueda.trim();
  $('#catalogo-titulo').textContent = q ? `Resultados para “${q}”` : estado.categoria === 'todo' ? 'Toda la colección' : nombreCategoria[estado.categoria];
  $('#conteo').textContent = `${lista.length} ${lista.length === 1 ? 'prenda' : 'prendas'}`;
  $('#tasa-linea').textContent = textoTasa();
  $('#tasa-linea').hidden = !AJUSTES.tasa;
  $('#rejilla').replaceChildren(...lista.map(tarjeta));
  $('#vacio').hidden = lista.length > 0;
}

function tarjeta(p) {
  const ci = colorBuscado(p), sinStock = agotada(p);
  return el('li', { class: sinStock ? 'tarjeta tarjeta-agotada' : 'tarjeta', 'data-eu-producto': '' },
    el('a', { href: `#${p.id}`, onclick: (e) => { e.preventDefault(); abrirFicha(p.id, { empujar: true, color: ci }); } },
      el('div', { class: 'foto' }, imgFoto(p, ci, { alt: `${p.nombre} en ${p.colores[ci].nombre.toLowerCase()}` })),
      el('div', { class: 'tarjeta-texto' },
        el('h3', { class: 'tarjeta-nombre' }, p.nombre),
        el('div', { class: 'tarjeta-pie' },
          el('span', { class: 'precio' }, precio(p.precio)),
          sinStock ? el('span', { class: 'agotada-etiqueta' }, 'Agotada') : p.nuevo ? el('span', { class: 'nuevo' }, 'Nuevo') : null,
          el('span', { class: 'puntos', role: 'img', 'aria-label': `${p.colores.length} colores` },
            p.colores.map((c) => el('span', { class: 'punto', style: `background:${fondoMuestra(c, true)}` })))),
        AJUSTES.tasa > 0 ? el('p', { class: 'precio-bs' }, bolivares(p.precio)) : null)));
}

function muestras(contenedor, p, elegido, alElegir) {
  contenedor.replaceChildren(...p.colores.map((c, i) => el('button', {
    class: 'muestra', type: 'button', role: 'radio', 'aria-checked': String(i === elegido), 'aria-label': c.nombre,
    tabindex: i === elegido ? '0' : '-1', style: `background:${fondoMuestra(c)}`,
    onclick: () => alElegir(i),
  })));
  contenedor.onkeydown = (e) => radiosConFlechas(e, contenedor, p.colores.length, (i) => alElegir(i));
}

function radiosConFlechas(e, contenedor, n, elegir) {
  const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!delta) return;
  e.preventDefault();
  const botones = $$('[role="radio"]:not(:disabled)', contenedor);
  const actual = botones.indexOf(document.activeElement);
  const sig = botones[(actual + delta + botones.length) % botones.length];
  if (sig) { sig.focus(); sig.click(); }
}

function renderDestacado() {
  const p = porId.get(CONFIG.destacado), c = p.colores[estado.colorDestacado];
  $('#destacado-nombre').textContent = p.nombre;
  $('#destacado-desc').textContent = p.descripcion;
  $('#destacado-precio').textContent = precio(p.precio);
  $('#destacado-bs').textContent = bolivares(p.precio);
  $('#destacado-bs').hidden = !AJUSTES.tasa;
  $('#destacado-color').textContent = c.nombre;
  muestras($('#destacado-muestras'), p, estado.colorDestacado, (i) => {
    estado.colorDestacado = i;
    renderDestacado();
    $('#destacado-muestras [aria-checked="true"]').focus();
    probadorDestacado.color(i);
  });
  const ver = $('#destacado-ver');
  ver.href = `#${p.id}`;
  ver.onclick = (e) => { e.preventDefault(); abrirFicha(p.id, { empujar: true, color: estado.colorDestacado }); };
}

// ---------- Capas (ficha y carrito) ----------
function actualizarCapas() {
  const carritoAbierto = !$('#carrito').hidden;
  const fichaAbierta = !$('#ficha').hidden;
  $('#barra').inert = fichaAbierta || carritoAbierto;
  $('#tienda').inert = fichaAbierta || carritoAbierto;
  $('#ficha').inert = carritoAbierto;
  document.documentElement.classList.toggle('bloqueado', fichaAbierta || carritoAbierto);
  document.documentElement.classList.toggle('con-ficha', fichaAbierta);
}

function abrirFicha(id, { empujar = false, color = 0 } = {}) {
  const p = porId.get(id);
  if (!p) return;
  if (empujar) { try { history.pushState({ lazo: id }, '', `#${id}`); } catch { /* el marco no deja cambiar la dirección */ } }
  const origen = ficha ? ficha.origen : document.activeElement;
  ficha = { p, color, talla: null, origen };
  renderFicha();
  const capa = $('#ficha');
  capa.hidden = false;
  capa.scrollTop = 0;
  actualizarCapas();
  requestAnimationFrame(() => capa.classList.add('abierta'));
  probadorFicha.activar(p, color);
  $('#cerrar-ficha').focus({ preventScroll: true });
}

function cerrarFicha({ desdeHistorial = false } = {}) {
  if (!ficha) return;
  if (!desdeHistorial && history.state?.lazo) { history.back(); return; }
  if (!desdeHistorial && location.hash) { try { history.replaceState(null, '', location.pathname + location.search); } catch { /* sin historial */ } }
  const capa = $('#ficha');
  capa.classList.remove('abierta');
  const origen = ficha.origen;
  ficha = null;
  setTimeout(() => { if (!ficha) { capa.hidden = true; actualizarCapas(); } }, sinMovimiento ? 0 : 240);
  if (!$('#destacado').hidden) probadorDestacado.activar(porId.get(CONFIG.destacado), estado.colorDestacado);
  else bucle.activo = null;
  if (origen && document.contains(origen)) origen.focus({ preventScroll: true });
}

function rutear() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (porId.has(id)) { if (!ficha || ficha.p.id !== id) abrirFicha(id); }
  else if (ficha) cerrarFicha({ desdeHistorial: true });
}
window.addEventListener('popstate', rutear);
window.addEventListener('hashchange', rutear);

function renderFicha() {
  const { p, color, talla } = ficha, c = p.colores[color];
  $('#ficha-nombre').textContent = p.nombre;
  $('#ficha-precio').textContent = precio(p.precio);
  $('#ficha-bs').textContent = bolivares(p.precio);
  $('#ficha-bs').hidden = !AJUSTES.tasa;
  $('#ficha-desc').textContent = p.descripcion;
  $('#ficha-color').textContent = c.nombre;
  muestras($('#ficha-muestras'), p, color, (i) => {
    ficha.color = i;
    renderFicha();
    $('#ficha-muestras [aria-checked="true"]').focus();
    probadorFicha.color(i);
  });
  const contenedor = $('#ficha-tallas');
  const primera = p.tallas.find((t) => !p.agotadas.includes(t));
  contenedor.replaceChildren(...p.tallas.map((t) => {
    const agotada = p.agotadas.includes(t);
    return el('button', {
      class: 'talla', type: 'button', role: 'radio', disabled: agotada,
      'aria-checked': String(t === talla), 'aria-label': agotada ? `${t}, agotada` : t,
      tabindex: t === (talla || primera) ? '0' : '-1',
      onclick: () => { ficha.talla = t; $('#ficha-error').hidden = true; renderFicha(); $(`#ficha-tallas [aria-checked="true"]`).focus(); },
    }, t);
  }));
  contenedor.onkeydown = (e) => radiosConFlechas(e, contenedor, p.tallas.length);
  const sinStock = agotada(p);
  const agotadas = sinStock
    ? 'Esta prenda está agotada en todas las tallas. Escríbenos por WhatsApp para saber cuándo vuelve.'
    : p.agotadas.length ? `Agotada en ${p.agotadas.join(', ')}.` : '';
  $('#tallas-nota').textContent = agotadas;
  $('#tallas-nota').hidden = !agotadas;
  $('#agregar').disabled = sinStock;
  $('#agregar').textContent = sinStock ? 'Agotada por ahora' : 'Agregar al carrito';
  $('#ficha-detalles').replaceChildren(...p.detalles.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]));
}

$('#cerrar-ficha').addEventListener('click', () => cerrarFicha());
$('#agregar').addEventListener('click', () => {
  if (agotada(ficha.p)) return;
  if (!ficha.talla) {
    const error = $('#ficha-error');
    error.textContent = 'Elige tu talla para agregar la prenda al carrito.';
    error.hidden = false;
    $('#ficha-tallas [tabindex="0"]')?.focus();
    return;
  }
  agregarAlCarrito(ficha.p, ficha.color, ficha.talla);
  avisar(`${ficha.p.nombre}, talla ${ficha.talla}, agregado al carrito`, { texto: 'Ver carrito', hacer: abrirCarrito });
});

// ---------- Guía de tallas ----------
$('#guia-filas').replaceChildren(...GUIA_TALLAS.map(([t, ...m]) => el('tr', {}, el('th', { scope: 'row' }, t), ...m.map((v) => el('td', {}, v)))));
$('#abrir-guia').addEventListener('click', () => $('#guia').showModal());
$('#cerrar-guia').addEventListener('click', () => $('#guia').close());
$('#guia').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

// ---------- Carrito ----------
const totalPrendas = () => estado.carrito.reduce((s, i) => s + i.cantidad, 0);
const totalPrecio = () => estado.carrito.reduce((s, i) => s + porId.get(i.id).precio * i.cantidad, 0);

function agregarAlCarrito(p, color, talla) {
  const existente = estado.carrito.find((i) => i.id === p.id && i.color === color && i.talla === talla);
  if (existente) existente.cantidad += 1;
  else estado.carrito.push({ id: p.id, color, talla, cantidad: 1 });
  pedirFoto(p, color, true);
  cambioCarrito();
  if (window.EU && window.EU.mascotaBrinca) window.EU.mascotaBrinca();
}

function cambioCarrito() {
  guardar(CONFIG.clave + '-carrito', estado.carrito);
  $('#enviado').hidden = true;
  $('#enviar').classList.remove('enviar-hecho');
  const n = totalPrendas();
  for (const c of $$('.contador')) { c.textContent = String(n); c.hidden = n === 0; }
  const etiqueta = n ? `Abrir carrito, ${n} ${n === 1 ? 'prenda' : 'prendas'}` : 'Abrir carrito, vacío';
  $('#abrir-carrito').setAttribute('aria-label', etiqueta);
  $('#ficha-carrito').setAttribute('aria-label', etiqueta);
  if (!$('#carrito').hidden) renderCarrito();
}

function renderCarrito() {
  const vacio = estado.carrito.length === 0;
  $('#carrito-vacio').hidden = !vacio;
  $('#datos').hidden = vacio;
  $('#carrito-pie').hidden = vacio;
  $('#items').replaceChildren(...estado.carrito.map((item, idx) => {
    const p = porId.get(item.id), c = p.colores[item.color];
    const cambiar = (d) => {
      item.cantidad += d;
      if (item.cantidad <= 0) estado.carrito.splice(idx, 1);
      cambioCarrito();
      $(`#items li:nth-child(${Math.min(idx + 1, estado.carrito.length)}) .cantidad button:last-child`)?.focus();
    };
    return el('li', { class: 'item' },
      imgFoto(p, item.color, { class: 'item-foto', alt: '' }),
      el('div', { class: 'item-info' },
        el('p', { class: 'item-nombre' }, p.nombre),
        el('p', { class: 'item-meta' }, `${c.nombre}, talla ${item.talla}`),
        el('div', { class: 'cantidad', role: 'group', 'aria-label': `Cantidad de ${p.nombre}` },
          el('button', { type: 'button', 'aria-label': 'Una menos', onclick: () => cambiar(-1) }, '−'),
          el('output', { 'aria-live': 'polite' }, String(item.cantidad)),
          el('button', { type: 'button', 'aria-label': 'Una más', onclick: () => cambiar(1) }, '+'))),
      el('div', { class: 'item-fin' },
        el('p', { class: 'precio' }, precio(p.precio * item.cantidad)),
        el('button', { class: 'enlace enlace-chico', type: 'button', onclick: () => { estado.carrito.splice(idx, 1); cambioCarrito(); $('#cerrar-carrito').focus(); } }, 'Quitar')));
  }));
  $('#total').textContent = precio(totalPrecio());
  $('#total-bs').textContent = AJUSTES.tasa > 0 ? `${bolivares(totalPrecio())} a tasa BCV de ${formatoBs.format(AJUSTES.tasa)}` : '';
  $('#total-bs').hidden = !AJUSTES.tasa;
  renderDatos();
}

function renderDatos() {
  const d = estado.datos;
  $('#f-nombre').value = d.nombre;
  $('#f-direccion').value = d.direccion;
  $('#f-nota').value = d.nota;
  $('#f-entregas').replaceChildren(...CONFIG.entregas.map((o) => el('label', { class: 'opcion-entrega' },
    el('input', { type: 'radio', name: 'entrega', value: o.id, checked: d.entrega === o.id, onchange: () => { d.entrega = o.id; guardarDatos(); renderDatos(); $('#f-entregas input:checked').focus(); } }),
    el('span', { class: 'entrega-nombre' }, o.nombre))));
  $('#f-pagos').replaceChildren(...CONFIG.pagos.map((nombre) => el('label', { class: 'pago' },
    el('input', { type: 'radio', name: 'pago', value: nombre, checked: d.pago === nombre, onchange: () => { d.pago = nombre; guardarDatos(); } }),
    el('span', {}, nombre))));
  const entrega = CONFIG.entregas.find((o) => o.id === d.entrega) || CONFIG.entregas[0];
  $('#campo-direccion').hidden = !entrega.campo;
  if (entrega.campo) $('#l-direccion').textContent = entrega.campo;
  actualizarEnlace();
}

function guardarDatos() { guardar(CONFIG.clave + '-datos', estado.datos); actualizarEnlace(); }
$('#f-nombre').addEventListener('input', (e) => { estado.datos.nombre = e.target.value; $('#e-nombre').hidden = true; guardarDatos(); });
$('#f-direccion').addEventListener('input', (e) => { estado.datos.direccion = e.target.value; $('#e-direccion').hidden = true; guardarDatos(); });
$('#f-nota').addEventListener('input', (e) => { estado.datos.nota = e.target.value; guardarDatos(); });
$('#datos').addEventListener('submit', (e) => e.preventDefault());

function mensajePedido() {
  const d = estado.datos;
  const entrega = CONFIG.entregas.find((o) => o.id === d.entrega) || CONFIG.entregas[0];
  const lineas = [`Hola, quiero hacer este pedido en ${CONFIG.tienda}:`, ''];
  estado.carrito.forEach((item, i) => {
    const p = porId.get(item.id), c = p.colores[item.color];
    lineas.push(`${i + 1}. *${p.nombre}*`);
    lineas.push(`   ${c.nombre}, talla ${item.talla}, cantidad ${item.cantidad}`);
    lineas.push(`   ${precio(p.precio * item.cantidad)}`);
  });
  lineas.push('', `*Total: ${precio(totalPrecio())}*`);
  if (AJUSTES.tasa > 0) lineas.push(`En bolívares: ${bolivares(totalPrecio())} (tasa BCV ${formatoBs.format(AJUSTES.tasa)}${AJUSTES.tasaFecha ? ` del ${fechaLarga(AJUSTES.tasaFecha)}` : ''})`);
  lineas.push('');
  lineas.push(`Nombre: ${d.nombre.trim()}`);
  lineas.push(`Entrega: ${entrega.nombre}`);
  if (entrega.campo && d.direccion.trim()) lineas.push(`${entrega.etiqueta}: ${d.direccion.trim()}`);
  lineas.push(`Pago: ${d.pago}`);
  if (d.nota.trim()) lineas.push(`Nota: ${d.nota.trim()}`);
  if (window.EU_BOUTIQUE) lineas.push(...window.EU_BOUTIQUE.lineasPago(d.pago));
  return lineas.join('\n');
}

function actualizarEnlace() {
  const cajaPago = $('#f-pago-detalle');
  if (cajaPago && window.EU_BOUTIQUE) cajaPago.innerHTML = window.EU_BOUTIQUE.detallePago(estado.datos.pago, totalPrecio());
  const entrega = CONFIG.entregas.find((o) => o.id === estado.datos.entrega) || CONFIG.entregas[0];
  $('#enviar').href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(mensajePedido())}`;
  $('#nota-entrega').textContent = entrega.nota.replace('{direccion}', [CONFIG.direccion, CONFIG.ciudad].filter(Boolean).join(', ') || 'la tienda');
}

$('#enviar').addEventListener('click', (e) => {
  const d = estado.datos;
  const entrega = CONFIG.entregas.find((o) => o.id === d.entrega) || CONFIG.entregas[0];
  let primerError = null;
  if (!d.nombre.trim()) {
    $('#e-nombre').textContent = 'Escribe tu nombre para enviar el pedido.';
    $('#e-nombre').hidden = false;
    primerError ||= $('#f-nombre');
  }
  if (entrega.campo && !d.direccion.trim()) {
    $('#e-direccion').textContent = entrega.id === 'nacional' ? 'Escribe la ciudad y la agencia de envío.' : 'Escribe la dirección de entrega.';
    $('#e-direccion').hidden = false;
    primerError ||= $('#f-direccion');
  }
  if (primerError) { e.preventDefault(); primerError.focus(); return; }
  actualizarEnlace();
  if (window.EU && window.EU.registrarPedido) {
    window.EU.registrarPedido({
      items: estado.carrito.map((item) => { const p = porId.get(item.id) || {}; return { nombre: p.nombre, cantidad: item.cantidad, precio: p.precio }; }),
      total: totalPrecio(), tipo: entrega.nombre, pago: d.pago,
    });
  }
  setTimeout(() => { $('#enviado').hidden = false; $('#enviar').classList.add('enviar-hecho'); }, 400);
});

$('#vaciar').addEventListener('click', () => {
  estado.carrito = [];
  $('#enviado').hidden = true;
  $('#enviar').classList.remove('enviar-hecho');
  cambioCarrito();
  renderCarrito();
  $('#seguir-comprando').focus();
});
$('#seguir').addEventListener('click', () => cerrarCarrito());
$('#seguir-comprando').addEventListener('click', () => { cerrarCarrito(); if (ficha) cerrarFicha(); });

function abrirCarrito() {
  const capa = $('#carrito');
  carritoOrigen = document.activeElement;
  $('#enviado').hidden = true;
  $('#enviar').classList.remove('enviar-hecho');
  renderCarrito();
  capa.hidden = false;
  $('#velo').hidden = false;
  actualizarCapas();
  requestAnimationFrame(() => { capa.classList.add('abierto'); $('#velo').classList.add('visible'); });
  $('#cerrar-carrito').focus({ preventScroll: true });
}
let carritoOrigen = null;
function cerrarCarrito() {
  const capa = $('#carrito');
  if (capa.hidden) return;
  capa.classList.remove('abierto');
  $('#velo').classList.remove('visible');
  setTimeout(() => { capa.hidden = true; $('#velo').hidden = true; actualizarCapas(); if (carritoOrigen && document.contains(carritoOrigen)) carritoOrigen.focus({ preventScroll: true }); }, sinMovimiento ? 0 : 280);
}
$('#abrir-carrito').addEventListener('click', abrirCarrito);
$('#ficha-carrito').addEventListener('click', abrirCarrito);
$('#cerrar-carrito').addEventListener('click', cerrarCarrito);
$('#velo').addEventListener('click', cerrarCarrito);

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || $('#guia').open) return;
  if (!$('#carrito').hidden) cerrarCarrito();
  else if (ficha) cerrarFicha();
});

// ---------- Aviso ----------
let temporizadorAviso = 0;
function avisar(texto, accion = null) {
  const a = $('#aviso');
  a.replaceChildren(el('span', {}, texto), accion ? el('button', { class: 'aviso-accion', type: 'button', onclick: () => { ocultarAviso(); accion.hacer(); } }, accion.texto) : null);
  a.classList.add('visible');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(ocultarAviso, 4500);
}
function ocultarAviso() { $('#aviso').classList.remove('visible'); }

// ---------- Búsqueda ----------
$('#buscar').addEventListener('input', (e) => { estado.busqueda = e.target.value; renderCatalogo(); });
$('#ver-todo').addEventListener('click', () => {
  estado.busqueda = ''; $('#buscar').value = '';
  elegirCategoria('todo');
});
$('#ir-inicio').addEventListener('click', (e) => {
  e.preventDefault();
  estado.busqueda = ''; $('#buscar').value = '';
  estado.categoria = 'todo';
  renderCategorias(); renderCatalogo();
  window.scrollTo({ top: 0, behavior: sinMovimiento ? 'auto' : 'smooth' });
});

// ---------- Ajustes del dueño ----------
function quitarAgotadosDelCarrito() {
  const antes = estado.carrito.length;
  estado.carrito = estado.carrito.filter((i) => !porId.get(i.id).agotadas.includes(i.talla));
  const quitadas = antes - estado.carrito.length;
  if (quitadas) {
    cambioCarrito();
    setTimeout(() => avisar(quitadas === 1 ? 'Quitamos del carrito una prenda que se agotó.' : `Quitamos del carrito ${quitadas} prendas que se agotaron.`), 600);
  }
}

async function cargarAjustes() {
  if (!API_TIENDA) return;
  const raiz = document.documentElement;
  raiz.classList.add('precios-pendientes');
  const control = new AbortController();
  const espera = setTimeout(() => control.abort(), 5000);
  try {
    const r = await fetch(API_TIENDA, { cache: 'no-store', signal: control.signal });
    const datos = r.ok ? await r.json() : null;
    if (datos?.ajustes) {
      aplicarAjustes(datos.ajustes);
      renderDestacado();
      renderCatalogo();
      cambioCarrito();
      if (ficha) renderFicha();
    }
  } catch (error) {
    console.warn('No se pudieron leer los precios del día; se muestran los de datos.js.', error);
  } finally {
    clearTimeout(espera);
    raiz.classList.remove('precios-pendientes');
    quitarAgotadosDelCarrito();
  }
}

// ---------- Arranque ----------
$('#pie-whatsapp').textContent = CONFIG.whatsappVisible;
$('#enviado-numero').textContent = CONFIG.whatsappVisible;
$('#pie-horario').textContent = CONFIG.horario;
const direccionCompleta = [CONFIG.direccion, CONFIG.ciudad].filter(Boolean).join(', ');
if (direccionCompleta) {
  $('#pie-direccion').replaceChildren(...[CONFIG.direccion, CONFIG.ciudad].filter(Boolean).flatMap((linea, i) => (i ? [el('br'), linea] : [linea])));
  $('#pie-mapa').href = CONFIG.mapa || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccionCompleta)}`;
} else $('#bloque-ubicacion').hidden = true;
for (const marca of $$('.marca')) marca.textContent = CONFIG.tienda;
renderCategorias();
renderDestacado();
renderCatalogo();
cambioCarrito();
probadorDestacado.activar(porId.get(CONFIG.destacado), 0);
rutear();
iniciarMotor();
if (API_TIENDA) cargarAjustes(); else quitarAgotadosDelCarrito();
