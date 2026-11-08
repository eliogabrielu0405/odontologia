/* Odontograma digital interactivo (numeración FDI, 5 caras por pieza). */
(function () {
  const { esc } = U;

  const STATES = [
    { key: 'sano', label: 'Sano', color: '#16a34a' },
    { key: 'caries', label: 'Caries', color: '#ef4444', face: true },
    { key: 'obturacion', label: 'Obturación', color: '#3b82f6', face: true },
    { key: 'fractura', label: 'Fractura', color: '#f97316', face: true },
    { key: 'corona', label: 'Corona', color: '#f59e0b' },
    { key: 'endodoncia', label: 'Endodoncia', color: '#9333ea' },
    { key: 'extraccion', label: 'Extracción indicada', color: '#e11d48' },
    { key: 'implante', label: 'Implante', color: '#0891b2' },
    { key: 'protesis', label: 'Prótesis', color: '#db2777' },
    { key: 'ausente', label: 'Ausente', color: '#94a3b8' },
  ];
  const STATE = Object.fromEntries(STATES.map((s) => [s.key, s]));

  const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

  /** Nombre clínico de cada cara según la posición en pantalla y el cuadrante. */
  const faceName = (tooth, face) => {
    const quadrant = Math.floor(tooth / 10);
    const upper = quadrant === 1 || quadrant === 2;
    const leftSideOfScreen = quadrant === 1 || quadrant === 4;
    const pos = tooth % 10;
    const posterior = pos >= 4;
    if (face === 'c') return posterior ? 'Oclusal' : 'Incisal';
    if (face === 't') return upper ? 'Vestibular' : 'Lingual';
    if (face === 'b') return upper ? 'Palatina' : 'Vestibular';
    // Mesial apunta a la línea media.
    if (face === 'l') return leftSideOfScreen ? 'Distal' : 'Mesial';
    return leftSideOfScreen ? 'Mesial' : 'Distal';
  };

  const FACE_POLYS = {
    t: '2,2 38,2 28,12 12,12',
    b: '12,28 28,28 38,38 2,38',
    l: '2,2 12,12 12,28 2,38',
    r: '38,2 38,38 28,28 28,12',
    c: '12,12 28,12 28,28 12,28',
  };

  const toothSVG = (num, data, upper) => {
    const whole = data && data.whole;
    const faces = (data && data.faces) || {};
    const crownY = upper ? 16 : 0;
    const rootPath = upper
      ? 'M10,17 L14,2 L18,15 L22,15 L26,2 L30,17 Z'
      : 'M10,39 L14,54 L18,41 L22,41 L26,54 L30,39 Z';
    const posterior = num % 10 >= 4;
    const singleRoot = upper ? 'M13,17 L20,1 L27,17 Z' : 'M13,39 L20,55 L27,39 Z';

    const faceFill = (f) => {
      if (whole === 'ausente') return 'var(--tooth-absent)';
      if (faces[f]) return STATE[faces[f]].color;
      if (whole === 'corona') return 'var(--crown-fill)';
      return 'var(--tooth)';
    };
    let overlay = '';
    const cx = 20; const cy = crownY + 20;
    if (whole === 'extraccion') overlay = `<path d="M${cx - 17},${cy - 17} L${cx + 17},${cy + 17} M${cx + 17},${cy - 17} L${cx - 17},${cy + 17}" stroke="${STATE.extraccion.color}" stroke-width="3.5" stroke-linecap="round"/>`;
    if (whole === 'ausente') overlay = `<path d="M${cx - 17},${cy - 17} L${cx + 17},${cy + 17} M${cx + 17},${cy - 17} L${cx - 17},${cy + 17}" style="stroke:var(--tooth-line)" stroke-width="2" stroke-linecap="round"/>`;
    if (whole === 'corona') overlay = `<circle cx="${cx}" cy="${cy}" r="21" fill="none" stroke="${STATE.corona.color}" stroke-width="3"/>`;
    if (whole === 'protesis') overlay = `<path d="M-2,${upper ? crownY - 3 : crownY + 43} L42,${upper ? crownY - 3 : crownY + 43}" stroke="${STATE.protesis.color}" stroke-width="3.5" stroke-linecap="round"/>`;
    if (whole === 'fractura') overlay = `<path d="M8,${crownY + 6} L18,${crownY + 18} L13,${crownY + 22} L32,${crownY + 34}" stroke="${STATE.fractura.color}" stroke-width="3" fill="none" stroke-linecap="round"/>`;

    let rootExtra = '';
    if (whole === 'endodoncia') rootExtra = upper
      ? `<path d="M20,3 L20,16" stroke="${STATE.endodoncia.color}" stroke-width="3.5" stroke-linecap="round"/>`
      : `<path d="M20,40 L20,53" stroke="${STATE.endodoncia.color}" stroke-width="3.5" stroke-linecap="round"/>`;
    if (whole === 'implante') {
      const ys = upper ? [4, 8, 12] : [44, 48, 52];
      rootExtra = ys.map((y) => `<path d="M14,${y} L26,${y}" stroke="${STATE.implante.color}" stroke-width="2.5" stroke-linecap="round"/>`).join('');
    }

    const rootFill = whole === 'implante' ? 'var(--implant-root)' : whole === 'ausente' ? 'var(--tooth-absent)' : '';
    return `
      <svg viewBox="0 0 40 56" role="img" aria-label="Pieza ${num}">
        <path class="root" d="${posterior ? rootPath : singleRoot}" ${rootFill ? `style="fill:${rootFill}"` : ''}/>
        ${rootExtra}
        <g transform="translate(0 ${crownY})">
          ${Object.entries(FACE_POLYS).map(([f, pts]) => `<polygon class="face" data-face="${f}" points="${pts}" style="fill:${faceFill(f)}"><title>${num} · ${faceName(num, f)}</title></polygon>`).join('')}
        </g>
        ${overlay}
      </svg>`;
  };

  const summarize = (data) => {
    const rows = [];
    Object.keys(data).map(Number).sort((a, b) => a - b).forEach((num) => {
      const t = data[num];
      if (t.whole) rows.push({ num, what: STATE[t.whole].label, color: STATE[t.whole].color, where: 'Pieza completa' });
      Object.entries(t.faces || {}).forEach(([f, s]) => rows.push({ num, what: STATE[s].label, color: STATE[s].color, where: faceName(num, f) }));
    });
    return rows;
  };

  /**
   * Monta el odontograma en `container`. `onChange(data, detail)` se llama con
   * el nuevo estado completo cada vez que se modifica una pieza.
   */
  const mount = (container, initial, onChange, readOnly = false) => {
    let data = JSON.parse(JSON.stringify(initial || {}));
    let mode = 'cara';
    let current = 'caries';

    const render = () => {
      const row = (list, upper) => {
        const half = (nums) => `<div class="odo-half">${nums.map((n) => `<div class="tooth${readOnly ? ' ro' : ''}" data-tooth="${n}">${upper ? toothSVG(n, data[n], true) + `<span class="num">${n}</span>` : `<span class="num">${n}</span>` + toothSVG(n, data[n], false)}</div>`).join('')}</div>`;
        return `<div class="odo-row">${half(list.slice(0, 8))}<div class="odo-mid"></div>${half(list.slice(8))}</div>`;
      };
      const findings = summarize(data);
      container.innerHTML = `
        ${readOnly ? '<p class="odo-notes" style="margin:0 0 12px">Vista de solo lectura: tu rol no permite editar el odontograma.</p>' : `
        <div class="odo-toolbar">
          <span class="label">MODO</span>
          <div class="seg">
            <button type="button" data-mode="pieza" class="${mode === 'pieza' ? 'active' : ''}">Diente completo</button>
            <button type="button" data-mode="cara" class="${mode === 'cara' ? 'active' : ''}">Por cara</button>
          </div>
          <span class="muted" style="font-size:12.5px">Elegí un estado y tocá ${mode === 'cara' ? 'la cara' : 'la pieza'}. Tocá de nuevo para quitarlo.</span>
        </div>
        <div class="odo-legend">
          ${STATES.map((s) => `<button type="button" data-state="${s.key}" class="${current === s.key ? 'active' : ''}" style="${current === s.key ? `color:${s.color};background:${s.color}14` : ''}"><i style="background:${s.color}"></i>${s.label}</button>`).join('')}
        </div>`}
        <div class="odo-board">
          <div class="odo-arch-label">ARCADA SUPERIOR</div>
          ${row(UPPER, true)}
          <div class="odo-sep"><span>LÍNEA MEDIA</span></div>
          ${row(LOWER, false)}
          <div class="odo-arch-label" style="margin-top:8px">ARCADA INFERIOR</div>
        </div>
        <div class="odo-notes"><strong>Caras:</strong> Superior/Inferior = Vestibular · Palatina/Lingual &nbsp;|&nbsp; Laterales = Mesial · Distal &nbsp;|&nbsp; Centro = Oclusal/Incisal</div>
        <div style="margin-top:16px">
          <h4 style="margin:0 0 8px;font-size:14px">Hallazgos registrados (${findings.length})</h4>
          ${findings.length ? `<div class="table-wrap"><table><thead><tr><th>Pieza</th><th>Hallazgo</th><th>Ubicación</th></tr></thead><tbody>
            ${findings.map((f) => `<tr><td><strong>${f.num}</strong></td><td><span class="badge" style="background:${f.color}1a;color:${f.color}">${esc(f.what)}</span></td><td>${esc(f.where)}</td></tr>`).join('')}
          </tbody></table></div>` : '<div class="empty">Sin hallazgos. Todas las piezas sanas.</div>'}
        </div>`;
    };

    const apply = (num, face) => {
      const previous = JSON.parse(JSON.stringify(data));
      const tooth = data[num] ? JSON.parse(JSON.stringify(data[num])) : { faces: {} };
      tooth.faces = tooth.faces || {};
      const st = STATE[current];
      let detail;
      if (current === 'sano') {
        if (mode === 'cara' && face && tooth.faces[face]) delete tooth.faces[face];
        else { delete tooth.whole; tooth.faces = {}; }
        detail = `Pieza ${num} marcada como sana`;
      } else if (mode === 'cara' && face && st.face) {
        if (tooth.faces[face] === current) delete tooth.faces[face];
        else tooth.faces[face] = current;
        detail = `Pieza ${num} ${faceName(num, face)}: ${st.label}`;
      } else {
        tooth.whole = tooth.whole === current ? undefined : current;
        if (!tooth.whole) delete tooth.whole;
        if (current === 'ausente' || current === 'extraccion' || current === 'implante') tooth.faces = {};
        detail = `Pieza ${num}: ${st.label}`;
      }
      if (!tooth.whole && !Object.keys(tooth.faces).length) delete data[num];
      else data[num] = tooth;
      if (onChange && onChange(data, detail) === false) data = JSON.parse(JSON.stringify(previous));
      render();
    };

    container.addEventListener('click', (e) => {
      if (readOnly) return;
      const modeBtn = e.target.closest('[data-mode]');
      if (modeBtn) { mode = modeBtn.dataset.mode; render(); return; }
      const stBtn = e.target.closest('[data-state]');
      if (stBtn) {
        current = stBtn.dataset.state;
        if (!STATE[current].face && current !== 'sano') mode = 'pieza';
        render();
        return;
      }
      const toothEl = e.target.closest('[data-tooth]');
      if (toothEl) {
        const faceEl = e.target.closest('[data-face]');
        apply(Number(toothEl.dataset.tooth), faceEl ? faceEl.dataset.face : null);
      }
    });

    render();
  };

  window.Odontogram = { mount, STATES, summarize };
})();
