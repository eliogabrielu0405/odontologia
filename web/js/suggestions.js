/* Sugerencias: el equipo de cada clínica propone mejoras para Sonrisas y EU Digital Solutions las responde.
   Clínica: #sugerencias (enviar y ver respuestas). Administrador: #admin-sugerencias (revisar, responder y cambiar el estado).
   Lo guarda la tabla "suggestions"; la base de datos pone el autor y la clínica, y solo el administrador responde. */
(function () {
  const { icon, esc, fmtDateTime, toast, openModal, confirmDialog, waLink } = U;

  const KINDS = [
    ['idea', 'Idea nueva', 'Algo que Sonrisas todavía no hace'],
    ['facilitar', 'Hacerlo más fácil', 'Algo que hoy cuesta o lleva muchos pasos'],
    ['problema', 'Algo no funciona', 'Un error o algo que se ve mal'],
    ['otro', 'Otro', 'Cualquier otro comentario'],
  ];
  const KIND_LABEL = Object.fromEntries(KINDS.map(([k, l]) => [k, l]));
  const AREAS = ['Agenda', 'Pacientes', 'Odontograma', 'Historia clínica', 'Fotos', 'Presupuestos', 'Cobros', 'Tratamientos', 'Reportes', 'Mi equipo', 'Mi suscripción', 'Instalar la app', 'Otra'];
  // [clave, nombre para el administrador, nombre para la clínica, color]
  const STATUS = [
    ['nueva', 'Nueva', 'Recibida', 'b-info'],
    ['revisando', 'En revisión', 'En revisión', 'b-violet'],
    ['planeada', 'Planeada', 'Planeada', 'b-warn'],
    ['hecha', 'Hecha', 'Ya está lista', 'b-ok'],
    ['descartada', 'Descartada', 'No por ahora', 'b-muted'],
  ];
  const statusOf = (k) => STATUS.find((s) => s[0] === k) || STATUS[0];
  const ROLE_LABEL = { titular: 'Titular', odontologo: 'Odontólogo/a', recepcion: 'Recepción' };

  const sb = () => Session.client;
  const userId = () => (Session.context() || {}).user_id || '';
  const errorText = (error) => (error && error.code === '42501' ? 'No tienes permiso para hacer esto.' : Session.friendly(error));
  const pageHead = (title, subtitle) => `<div class="page-head"><div><h1>${esc(title)}</h1><p>${subtitle}</p></div></div>`;

  /* ---------- Avisos en el menú ---------- */
  let unseen = 0; // clínica: sugerencias mías con estado o respuesta nuevos desde la última vez que entré
  let fresh = 0; // administrador: sugerencias nuevas sin revisar
  const seenKey = () => `sonrisas:sugerencias-vistas:${userId()}`;
  const lastSeen = () => { try { return localStorage.getItem(seenKey()) || ''; } catch { return ''; } };
  const markSeen = (iso) => {
    if (!iso) return;
    try { if (!lastSeen() || new Date(iso) > new Date(lastSeen())) localStorage.setItem(seenKey(), iso); } catch { /* sin almacenamiento */ }
  };
  const isNewAnswer = (s, since) => !!(s.answered_at && s.user_id === userId() && (!since || new Date(s.answered_at) > new Date(since)));

  const navCount = (route) => (route === 'admin-sugerencias' ? fresh : route === 'sugerencias' ? unseen : 0);
  const paint = () => {
    let any = false;
    document.querySelectorAll('[data-nav-count]').forEach((el) => {
      const n = navCount(el.dataset.navCount);
      el.textContent = n ? String(n) : '';
      el.hidden = !n;
      if (n) any = true;
    });
    // En el celular el menú está escondido: el botón del menú muestra un punto si hay novedades.
    document.querySelectorAll('[data-menu-dot]').forEach((el) => { el.hidden = !any; });
  };
  const refreshUnseen = async () => {
    if (!userId()) return;
    const { count, error } = await sb().from('suggestions').select('id', { count: 'exact', head: true })
      .eq('user_id', userId()).gt('answered_at', lastSeen() || '1970-01-01T00:00:00Z');
    if (!error) { unseen = count || 0; paint(); }
  };
  const refreshFresh = async () => {
    const { count, error } = await sb().from('suggestions').select('id', { count: 'exact', head: true }).eq('status', 'nueva');
    if (!error) { fresh = count || 0; paint(); }
  };
  const reset = () => { unseen = 0; fresh = 0; };

  const head = (s, label) => `<div class="sug-top"><span class="badge ${statusOf(s.status)[3]}">${esc(label)}</span><span class="sug-kind">${esc(KIND_LABEL[s.kind] || s.kind)}${s.area ? ` · ${esc(s.area)}` : ''}</span></div>`;

  /* =====================================================================
     Clínica: enviar sugerencias y ver respuestas
     ===================================================================== */
  const clinicView = async (el) => {
    const title = 'Sugerencias';
    const subtitle = 'Cuéntanos qué mejorar de Sonrisas para que te sea más fácil manejar tu consultorio.';
    el.innerHTML = `${pageHead(title, subtitle)}<div class="card empty">Cargando…</div>`;
    let list = [];
    const load = async () => {
      const { data, error } = await sb().from('suggestions').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw new Error(errorText(error));
      list = data || [];
    };
    try { await load(); } catch (err) { el.innerHTML = `${pageHead(title, subtitle)}<div class="card empty">${esc(err.message)}</div>`; return; }

    const item = (s, since) => `<article class="sug-item">
        ${head(s, statusOf(s.status)[2])}
        ${isNewAnswer(s, since) ? '<span class="sug-new">Novedad</span>' : ''}
        <h4>${esc(s.title)}</h4>
        ${s.details ? `<p class="sug-details">${esc(s.details)}</p>` : ''}
        <div class="sug-meta">${esc(s.author_name || 'Alguien de tu clínica')} · ${fmtDateTime(s.created_at)}</div>
        ${s.admin_reply ? `<div class="sug-reply"><strong>Respuesta de EU Digital Solutions</strong><p>${esc(s.admin_reply)}</p>${s.answered_at ? `<small>${fmtDateTime(s.answered_at)}</small>` : ''}</div>` : ''}
        ${s.user_id === userId() && s.status === 'nueva' ? `<button type="button" class="link-btn danger" data-del-sug="${s.id}">Eliminar</button>` : ''}
      </article>`;

    const draw = (keep = {}) => {
      const since = lastSeen();
      const news = list.filter((s) => isNewAnswer(s, since));
      el.innerHTML = `${pageHead(title, subtitle)}
        ${news.length ? `<section class="card sug-news" aria-labelledby="sug-news-title">
          <div class="card-head"><h3 id="sug-news-title">${news.length === 1 ? 'Te respondimos' : `Tienes ${news.length} respuestas nuevas`}</h3></div>
          <div class="card-body sug-list">${news.map((s) => item(s, since)).join('')}</div>
        </section>` : ''}
        <div class="sug-layout">
          <form class="card card-pad sug-form" data-sug-form novalidate>
            <h3 class="section-title">Nueva sugerencia</h3>
            <fieldset class="kind-pick"><legend>¿Qué quieres contarnos?</legend>
              ${KINDS.map(([k, l, h]) => `<label class="kind-opt"><input type="radio" name="kind" value="${k}" ${k === (keep.kind || 'idea') ? 'checked' : ''}><span><strong>${l}</strong><small>${h}</small></span></label>`).join('')}
            </fieldset>
            <label class="field">¿En qué parte de la app?<select name="area">${AREAS.map((a) => `<option ${a === keep.area ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
            <label class="field"><span>Tu idea en una frase <span class="req">*</span></span><input name="title" maxlength="120" required placeholder="Ej: Enviar el presupuesto al paciente por WhatsApp"></label>
            <label class="field">Cuéntanos más<textarea name="details" rows="5" maxlength="2000" placeholder="¿Cómo lo haces hoy? ¿Qué te ayudaría? Mientras más detalles, mejor."></textarea></label>
            <button class="btn btn-primary" type="submit" data-send>${icon('bulb')}Enviar sugerencia</button>
            <p class="hint">La lee el equipo de EU Digital Solutions y te responde aquí mismo.</p>
          </form>
          <section class="card" aria-labelledby="sug-list-title">
            <div class="card-head"><h3 id="sug-list-title">Sugerencias de tu clínica</h3><span class="muted small">${list.length ? `${list.length} enviada${list.length === 1 ? '' : 's'}` : ''}</span></div>
            <div class="card-body sug-list">${list.length ? list.map((s) => item(s, since)).join('') : '<div class="empty">Todavía no han enviado sugerencias. ¿Qué te gustaría que Sonrisas hiciera por tu consultorio?</div>'}</div>
          </section>
        </div>`;

      const form = el.querySelector('[data-sug-form]');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        const ideaTitle = String(data.title || '').trim();
        if (ideaTitle.length < 3) { form.querySelector('[name=title]').focus(); toast('Escribe tu idea en una frase (al menos 3 letras).', 'err'); return; }
        const send = form.querySelector('[data-send]');
        send.disabled = true;
        send.textContent = 'Enviando…';
        const ctx = Session.context();
        const { error } = await sb().from('suggestions').insert({
          clinic_id: ctx.clinic.id, user_id: userId(), kind: data.kind || 'idea', area: data.area || '',
          title: ideaTitle, details: String(data.details || '').trim(),
        });
        if (error) {
          toast(errorText(error), 'err');
          send.disabled = false;
          send.innerHTML = `${icon('bulb')}Enviar sugerencia`;
          return;
        }
        toast('¡Gracias! Recibimos tu sugerencia.');
        try { await load(); } catch { /* se muestra lo que hay */ }
        draw({ kind: data.kind, area: data.area });
      });
      el.querySelectorAll('[data-del-sug]').forEach((b) => b.addEventListener('click', () => confirmDialog('¿Eliminar esta sugerencia?', async () => {
        const { error } = await sb().from('suggestions').delete().eq('id', b.dataset.delSug);
        if (error) throw new Error(errorText(error));
        toast('Sugerencia eliminada');
        await load();
        draw();
        return undefined;
      })));

      // Lo que hay en pantalla ya se vio: se apaga el aviso del menú.
      list.forEach((s) => { if (s.answered_at) markSeen(s.answered_at); });
      unseen = 0;
      paint();
    };
    draw();
  };

  /* =====================================================================
     Administrador: revisar, responder y cambiar el estado
     ===================================================================== */
  let adminTab = 'nueva';
  let adminKind = '';
  const adminView = async (el) => {
    const title = 'Sugerencias';
    const subtitle = 'Ideas, mejoras y problemas que envían las clínicas';
    el.innerHTML = `${pageHead(title, subtitle)}<div class="card empty">Cargando…</div>`;
    let rows = [];
    let clinics = [];
    let people = [];
    const load = async () => {
      const [s, c, p] = await Promise.all([
        sb().from('suggestions').select('*').order('created_at', { ascending: false }).limit(1000),
        sb().from('clinics').select('id, name'),
        sb().from('profiles').select('id, first_name, last_name, phone, email'),
      ]);
      [s, c, p].forEach((r) => { if (r.error) throw new Error(errorText(r.error)); });
      rows = s.data || [];
      clinics = c.data || [];
      people = p.data || [];
      fresh = rows.filter((r) => r.status === 'nueva').length;
      paint();
    };
    try { await load(); } catch (err) { el.innerHTML = `${pageHead(title, subtitle)}<div class="card empty">${esc(err.message)}</div>`; return; }
    const clinicName = (id) => (clinics.find((c) => c.id === id) || {}).name || 'Clínica eliminada';
    const personOf = (id) => people.find((x) => x.id === id) || null;
    const waText = (s, p) => `Hola ${p.first_name || ''}, te escribe EU Digital Solutions por tu sugerencia en Sonrisas: "${s.title}". `;

    const card = (s) => {
      const p = personOf(s.user_id);
      return `<article class="card card-pad sug-admin">
        <div class="sug-row">${head(s, statusOf(s.status)[1])}<span class="muted small">${fmtDateTime(s.created_at)}</span></div>
        <h4>${esc(s.title)}</h4>
        ${s.details ? `<p class="sug-details">${esc(s.details)}</p>` : ''}
        <div class="sug-meta"><strong>${esc(clinicName(s.clinic_id))}</strong> · ${esc(s.author_name || '—')}${s.author_role ? ` (${esc(ROLE_LABEL[s.author_role] || s.author_role)})` : ''}${p && p.email ? ` · ${esc(p.email)}` : ''}</div>
        ${s.admin_reply ? `<div class="sug-reply"><strong>Tu respuesta</strong><p>${esc(s.admin_reply)}</p>${s.answered_at ? `<small>${fmtDateTime(s.answered_at)}</small>` : ''}</div>` : ''}
        <div class="action-row">
          <button type="button" class="btn btn-sm btn-primary" data-answer="${s.id}">${icon('edit')}${s.admin_reply ? 'Editar respuesta' : 'Responder'}</button>
          ${p && p.phone ? `<a class="btn btn-sm" href="${esc(waLink(p.phone, waText(s, p)))}" target="_blank" rel="noopener">${icon('whatsapp')}WhatsApp</a>` : ''}
          <button type="button" class="btn btn-sm btn-danger-soft" data-del-sug="${s.id}">${icon('trash')}Eliminar</button>
        </div>
      </article>`;
    };

    const answer = (s) => openModal({
      title: 'Responder sugerencia',
      body: `<div class="stack">
        <div class="sug-quote"><strong>${esc(s.title)}</strong>${s.details ? `<p>${esc(s.details)}</p>` : ''}<small>${esc(clinicName(s.clinic_id))} · ${esc(s.author_name || '—')}</small></div>
        <label class="field">Estado<select name="status">${STATUS.map(([k, l]) => `<option value="${k}" ${k === (s.status === 'nueva' ? 'revisando' : s.status) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">Respuesta para la clínica<textarea name="reply" rows="5" maxlength="1500" placeholder="Ej: ¡Gracias! Lo vamos a agregar en las próximas semanas.">${esc(s.admin_reply)}</textarea></label>
        <p class="hint">La clínica ve el estado y tu respuesta en su sección Sugerencias, con un aviso en el menú.</p>
      </div>`,
      submitLabel: 'Guardar',
      onSubmit: async (data) => {
        const reply = String(data.reply || '').trim();
        if (data.status === s.status && reply === s.admin_reply) return undefined;
        const { error } = await sb().from('suggestions').update({ status: data.status, admin_reply: reply }).eq('id', s.id);
        if (error) throw new Error(errorText(error));
        toast(reply && reply !== s.admin_reply ? 'Respuesta enviada a la clínica' : 'Estado actualizado');
        await load();
        draw();
        return undefined;
      },
    });

    const draw = () => {
      const counts = Object.fromEntries(STATUS.map(([k]) => [k, rows.filter((r) => r.status === k).length]));
      const list = rows.filter((r) => (adminTab === 'todas' || r.status === adminTab) && (!adminKind || r.kind === adminKind));
      el.innerHTML = `${pageHead(title, subtitle)}
        <div class="tabs" role="tablist">${[...STATUS.map(([k, l]) => [k, l]), ['todas', 'Todas']].map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === adminTab}" data-sug-tab="${k}" class="${k === adminTab ? 'active' : ''}">${l}${k !== 'todas' && counts[k] ? ` <span class="count-pill">${counts[k]}</span>` : ''}</button>`).join('')}</div>
        <div class="sug-filter">
          <label class="field">Tipo<select data-sug-kind><option value="">Todos</option>${KINDS.map(([k, l]) => `<option value="${k}" ${k === adminKind ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <span class="muted small">${list.length} ${list.length === 1 ? 'sugerencia' : 'sugerencias'}</span>
        </div>
        <div class="sug-admin-list">${list.map(card).join('') || `<div class="card empty">${adminTab === 'nueva' ? 'No hay sugerencias nuevas. Cuando una clínica envíe una, aparece aquí.' : 'No hay sugerencias en esta lista.'}</div>`}</div>`;
      el.querySelectorAll('[data-sug-tab]').forEach((b) => b.addEventListener('click', () => { adminTab = b.dataset.sugTab; draw(); }));
      el.querySelector('[data-sug-kind]').addEventListener('change', (e) => { adminKind = e.target.value; draw(); });
      el.querySelectorAll('[data-answer]').forEach((b) => b.addEventListener('click', () => answer(rows.find((r) => r.id === b.dataset.answer))));
      el.querySelectorAll('[data-del-sug]').forEach((b) => b.addEventListener('click', () => confirmDialog('¿Eliminar esta sugerencia? La clínica ya no la verá.', async () => {
        const { error } = await sb().from('suggestions').delete().eq('id', b.dataset.delSug);
        if (error) throw new Error(errorText(error));
        toast('Sugerencia eliminada');
        await load();
        draw();
        return undefined;
      })));
    };
    draw();
  };

  window.Suggestions = { clinicView, adminView, refreshUnseen, refreshFresh, navCount, freshCount: () => fresh, reset };
})();
