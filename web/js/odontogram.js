/* Odontograma digital interactivo (numeración FDI, 5 caras por pieza).
   Cada hallazgo puede llevar el tratamiento que se cobra y su precio; la suma se pasa a un presupuesto. */
(function () {
  const { esc, icon } = U;

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

  /** Lista de hallazgos: pieza, estado y ubicación ('pieza' para el diente completo o la cara). */
  const summarize = (data) => {
    const rows = [];
    Object.keys(data).map(Number).sort((a, b) => a - b).forEach((num) => {
      const t = data[num];
      if (t.whole) rows.push({ num, loc: 'pieza', state: t.whole, what: STATE[t.whole].label, color: STATE[t.whole].color, where: 'Pieza completa' });
      Object.entries(t.faces || {}).forEach(([f, s]) => rows.push({ num, loc: f, state: s, what: STATE[s].label, color: STATE[s].color, where: faceName(num, f) }));
    });
    return rows;
  };

  /* ---------- Precio de los hallazgos ---------- */
  // Tratamiento del catálogo que se cobra por defecto. Endodoncias y exodoncias dependen de la pieza
  // (molares: multirradicular; terceros molares: exodoncia de cordal). Obturaciones hechas y piezas ausentes no se cobran.
  const MATCH = {
    caries: () => [/resina.*1\s*cara/i, /resina/i, /restauraci/i, /obturaci/i],
    fractura: () => [/resina.*(2|dos|m[aá]s)/i, /reconstrucci/i, /resina/i, /restauraci/i],
    endodoncia: (num) => (num % 10 >= 6 ? [/endodoncia.*multi/i, /endodoncia/i] : [/endodoncia.*uni/i, /endodoncia/i]),
    extraccion: (num) => (num % 10 === 8 ? [/cordal|tercer molar/i, /exodoncia|extracci/i] : [/exodoncia simple|extracci[oó]n simple/i, /exodoncia|extracci/i]),
    corona: () => [/corona/i],
    implante: () => [/implante/i],
    protesis: () => [/pr[oó]tesis/i],
  };
  const autoTreatment = (state, num, treatments) => {
    for (const re of (MATCH[state] ? MATCH[state](num) : [])) {
      const t = treatments.find((x) => re.test(x.name));
      if (t) return t;
    }
    return null;
  };
  /** Nombre del tratamiento automático de un hallazgo, para mostrarlo en los ajustes. */
  const autoLabel = (state, treatments) => {
    const names = [...new Set([11, 14, 36, 38].map((n) => autoTreatment(state, n, treatments)).filter(Boolean).map((t) => t.name))];
    return names.length ? names.join(' / ') : '';
  };

  /**
   * Tratamiento y precio de un hallazgo. Orden: lo que se eligió para ese hallazgo en este paciente,
   * lo que la clínica eligió para ese tipo de hallazgo y, si no, el tratamiento automático del catálogo.
   */
  const planFor = (data, row, opts = {}) => {
    const treatments = opts.treatments || [];
    const own = ((data[row.num] || {}).plan || {})[row.loc];
    const mine = own && own.state === row.state ? own : null;
    let treatment;
    if (mine && mine.treatmentId !== undefined) treatment = treatments.find((t) => t.id === mine.treatmentId) || null;
    else {
      const mapped = (opts.mapping || {})[row.state];
      if (mapped === '') treatment = null;
      else treatment = (mapped && treatments.find((t) => t.id === mapped)) || autoTreatment(row.state, row.num, treatments);
    }
    const custom = mine && mine.price !== undefined && mine.price !== null && mine.price !== '';
    const price = custom ? Number(mine.price) || 0 : treatment ? Number(treatment.price) || 0 : 0;
    const charged = !!treatment || (custom && price > 0);
    return { treatment, price: charged ? price : 0, charged, customPrice: !!custom };
  };

  /** Renglones de presupuesto con los hallazgos que se cobran. */
  const budgetItems = (data, opts = {}) => summarize(data)
    .map((row) => ({ row, plan: planFor(data, row, opts) }))
    .filter(({ plan }) => plan.charged)
    .map(({ row, plan }) => ({
      treatmentId: plan.treatment ? plan.treatment.id : '',
      description: `${plan.treatment ? plan.treatment.name : row.what}${row.loc === 'pieza' ? '' : ` · ${row.where}`}`,
      qty: 1,
      price: U.cents(plan.price),
      tooth: String(row.num),
    }));

  /**
   * Monta el odontograma en `container`. `onChange(data, detail)` se llama con
   * el nuevo estado completo cada vez que se modifica una pieza.
   */
  const mount = (container, initial, onChange, readOnly = false, opts = {}) => {
    let data = JSON.parse(JSON.stringify(initial || {}));
    let mode = 'cara';
    let current = 'caries';
    const money = opts.money || ((n) => String(n));
    const treatments = opts.treatments || [];

    const render = () => {
      const row = (list, upper) => {
        const half = (nums) => `<div class="odo-half">${nums.map((n) => `<div class="tooth${readOnly ? ' ro' : ''}" data-tooth="${n}">${upper ? toothSVG(n, data[n], true) + `<span class="num">${n}</span>` : `<span class="num">${n}</span>` + toothSVG(n, data[n], false)}</div>`).join('')}</div>`;
        return `<div class="odo-row">${half(list.slice(0, 8))}<div class="odo-mid"></div>${half(list.slice(8))}</div>`;
      };
      const findings = summarize(data);
      const priced = findings.map((f) => ({ ...f, plan: planFor(data, f, opts) }));
      const charged = priced.filter((f) => f.plan.charged);
      const total = U.cents(charged.reduce((sum, f) => sum + f.plan.price, 0));
      container.innerHTML = `
        ${readOnly ? '<p class="odo-notes" style="margin:0 0 12px">Solo lectura: los odontólogos de la clínica pueden editar el odontograma.</p>' : `
        <div class="odo-toolbar">
          <span class="label">MODO</span>
          <div class="seg">
            <button type="button" data-mode="pieza" class="${mode === 'pieza' ? 'active' : ''}">Diente completo</button>
            <button type="button" data-mode="cara" class="${mode === 'cara' ? 'active' : ''}">Por cara</button>
          </div>
          <span class="muted" style="font-size:12.5px">Elige un estado y toca ${mode === 'cara' ? 'la cara' : 'la pieza'}. Toca de nuevo para quitarlo.</span>
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
        <div class="odo-findings">
          <div class="odo-findings-head">
            <h4>Hallazgos registrados (${findings.length})</h4>
            ${charged.length ? `<span class="odo-total-pill">Total <strong data-odo-total-top>${money(total)}</strong></span>` : ''}
          </div>
          ${findings.length ? `<div class="table-wrap"><table><thead><tr><th>Pieza</th><th>Hallazgo</th><th>Ubicación</th><th>Tratamiento que se cobra</th><th class="num">Precio</th></tr></thead><tbody>
            ${priced.map((f) => `<tr class="${f.plan.charged ? '' : 'odo-free'}">
              <td><strong>${f.num}</strong></td>
              <td><span class="badge" style="background:${f.color}1a;color:${f.color}">${esc(f.what)}</span></td>
              <td>${esc(f.where)}</td>
              <td>${readOnly
                ? esc(f.plan.treatment ? f.plan.treatment.name : f.plan.charged ? f.what : 'No se cobra')
                : `<select class="cell-input" data-plan-t="${f.num}:${f.loc}" aria-label="Tratamiento para la pieza ${f.num}, ${esc(f.where)}"><option value="">No se cobra</option>${treatments.map((t) => `<option value="${esc(t.id)}" ${f.plan.treatment && f.plan.treatment.id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`}</td>
              <td class="num">${readOnly
                ? (f.plan.charged ? money(f.plan.price) : '—')
                : `<input type="number" min="0" step="0.01" inputmode="decimal" class="cell-input" data-plan-p="${f.num}:${f.loc}" data-default="${f.plan.treatment ? Number(f.plan.treatment.price) || 0 : ''}" value="${f.plan.charged ? f.plan.price : ''}" placeholder="0" aria-label="Precio para la pieza ${f.num}, ${esc(f.where)}">`}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr><td colspan="4"><strong>Total</strong> <span class="muted">· ${charged.length} ${charged.length === 1 ? 'hallazgo se cobra' : 'hallazgos se cobran'}</span></td><td class="num"><strong data-odo-total>${money(total)}</strong></td></tr></tfoot>
          </table></div>` : '<div class="empty">Sin hallazgos. Todas las piezas sanas.</div>'}
          ${findings.length && !treatments.length ? '<p class="odo-hint">Para cobrar los hallazgos, primero carga tu catálogo en <a href="#tratamientos">Tratamientos</a>.</p>' : ''}
          ${charged.some((f) => !f.plan.price) ? '<p class="odo-hint">Hay tratamientos sin precio. Ponles precio en <a href="#tratamientos">Tratamientos</a> o escríbelo aquí.</p>' : ''}
          ${findings.length && (opts.onCreateBudget || opts.onEditPrices) ? `<div class="action-row odo-actions">
            ${opts.onCreateBudget ? `<button type="button" class="btn btn-primary" data-odo-budget ${charged.length ? '' : 'disabled'}>${icon('file')}Crear presupuesto con estos hallazgos</button>` : ''}
            ${opts.onEditPrices ? `<button type="button" class="btn" data-odo-prices>${icon('settings')}Precios de los hallazgos</button>` : ''}
          </div>` : ''}
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
      if (tooth.plan) {
        Object.keys(tooth.plan).forEach((loc) => {
          const now = loc === 'pieza' ? tooth.whole : tooth.faces[loc];
          if (!now || now !== tooth.plan[loc].state) delete tooth.plan[loc];
        });
        if (!Object.keys(tooth.plan).length) delete tooth.plan;
      }
      if (!tooth.whole && !Object.keys(tooth.faces).length) delete data[num];
      else data[num] = tooth;
      if (onChange && onChange(data, detail) === false) data = JSON.parse(JSON.stringify(previous));
      render();
    };

    /** Guarda el tratamiento o el precio elegido para un hallazgo ("16:c" = pieza 16, cara central). */
    const setPlan = (key, patch, detail) => {
      const [numText, loc] = key.split(':');
      const num = Number(numText);
      const tooth = data[num];
      const state = tooth && (loc === 'pieza' ? tooth.whole : (tooth.faces || {})[loc]);
      if (!state) return;
      const previous = JSON.parse(JSON.stringify(data));
      tooth.plan = tooth.plan || {};
      const base = tooth.plan[loc] && tooth.plan[loc].state === state ? tooth.plan[loc] : {};
      const next = { ...base, ...patch, state };
      Object.keys(next).forEach((k) => { if (next[k] === undefined) delete next[k]; });
      if (Object.keys(next).length === 1) delete tooth.plan[loc]; else tooth.plan[loc] = next;
      if (!Object.keys(tooth.plan).length) delete tooth.plan;
      if (onChange && onChange(data, detail) === false) data = previous;
      render();
    };
    const placeOf = (key) => {
      const [numText, loc] = key.split(':');
      return `Pieza ${numText}${loc === 'pieza' ? '' : ` · ${faceName(Number(numText), loc)}`}`;
    };

    container.addEventListener('change', (e) => {
      if (readOnly) return;
      const sel = e.target.closest('[data-plan-t]');
      if (sel) {
        const t = treatments.find((x) => x.id === sel.value);
        setPlan(sel.dataset.planT, { treatmentId: sel.value, price: undefined }, `${placeOf(sel.dataset.planT)}: ${t ? t.name : 'no se cobra'}`);
        return;
      }
      const input = e.target.closest('[data-plan-p]');
      if (input) {
        const raw = String(input.value).trim();
        const price = raw === '' ? undefined : U.cents(Math.max(0, Number(raw) || 0));
        setPlan(input.dataset.planP, { price }, `${placeOf(input.dataset.planP)}: precio ${price === undefined ? 'del catálogo' : money(price)}`);
      }
    });
    // Mientras se escribe un precio, el total se actualiza sin guardar todavía.
    container.addEventListener('input', (e) => {
      if (!e.target.closest('[data-plan-p]')) return;
      let sum = 0;
      container.querySelectorAll('[data-plan-p]').forEach((el) => {
        const typed = String(el.value).trim();
        if (typed !== '') sum += Math.max(0, Number(typed) || 0);
        else if (el.dataset.default !== '') sum += Number(el.dataset.default) || 0;
      });
      container.querySelectorAll('[data-odo-total], [data-odo-total-top]').forEach((el) => { el.textContent = money(U.cents(sum)); });
    });

    container.addEventListener('click', (e) => {
      if (e.target.closest('[data-odo-budget]') && opts.onCreateBudget) { opts.onCreateBudget(budgetItems(data, opts)); return; }
      if (e.target.closest('[data-odo-prices]') && opts.onEditPrices) { opts.onEditPrices(); return; }
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

  window.Odontogram = { mount, STATES, summarize, planFor, budgetItems, autoLabel };
})();
