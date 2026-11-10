'use strict';
// Planner SEA · extras: favoritos, confeti, Ctrl+K, clic derecho, vista previa, fechas, texto natural, comentarios en notas, comparar
/* ============ Accesos directos (favoritos) ============ */
const isFav = (t, id) => pref('favs', []).some(f => f.t === t && f.id === id);
function toggleFav(t, id, pid){
  const favs = pref('favs', []);
  const was = isFav(t, id);
  setPref('favs', was ? favs.filter(f => !(f.t === t && f.id === id)) : [...favs, { t, id, pid, name: t === 'w' ? S.wiki.find(w => w.id === id)?.title : undefined }].slice(-12));
  toast(was ? 'Quitado de accesos directos' : 'Añadido a accesos directos de Inicio'); return;
  toast(isFav(t, id) ? 'Quitado de accesos directos' : 'Añadido a accesos directos de Inicio');
}
function favsHTML(){
  const items = pref('favs', []).map(f => f.t === 'p' ? (p => p && { icon: p.emoji || '📁', name: p.name, go: `goProject('${p.id}')`, c: p.color })(proj(f.id))
    : (p => p && { icon: '📝', name: f.name || 'Nota', sub: p.name, go: `S.wid='${f.id}';goProject('${f.pid}','wiki')`, c: p.color })(proj(f.pid))).filter(Boolean);
  if (!items.length) return '';
  return `<div class="favs">${items.map(x => `<button class="fav" style="--c:${esc(x.c)}" onclick="${x.go}"><span>${esc(x.icon)}</span><b>${esc(x.name)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</button>`).join('')}</div>`;
}

/* ============ Confeti al terminar un proyecto ============ */
function confetti(){
  if (reduceMotion()) return toast('🎉 ¡Proyecto completado!');
  const box = document.createElement('div'); box.className = 'confetti';
  const cols = ['#f39200', '#6366f1', '#22c55e', '#ef4444', '#eab308', '#06b6d4'];
  box.innerHTML = Array.from({ length: 90 }, () => `<i style="left:${Math.random() * 100}%;background:${cols[Math.floor(Math.random() * cols.length)]};animation-delay:${Math.random() * .6}s;animation-duration:${1.8 + Math.random() * 1.4}s;transform:rotate(${Math.random() * 360}deg)"></i>`).join('');
  document.body.append(box); setTimeout(() => box.remove(), 3600);
  toast('🎉 ¡Todas las tareas del proyecto completadas!');
}

/* ============ 7 · Menú de comandos (Ctrl+K) ============ */
function palItems(){
  const it = [], add = (icon, label, sub, run) => it.push({ icon, label, sub, run });
  add('house', 'Ir a Inicio', '', () => go('home'));
  add('list-todo', 'Ir a Mis tareas', '', () => go('mine'));
  add('calendar-range', 'Calendario de clase', '', () => go('week'));
  add('clock', 'Horario', '', () => go('timetable'));
  add('pin', 'Tablón de clase', '', () => go('tablon'));
  if (S.pid) { add('message-circle', 'Resumen para WhatsApp', '', () => openModal('wa')); add('shield-alert', 'Incidencias', '', () => go('issues')); if (adminOf()) add('sliders-horizontal', 'Organizar proyecto (partes, plan, sesiones)', '', () => openModal('org'));
    add('file-text', 'Documentos del proyecto (memoria, presupuesto, presentación)', '', () => openModal('docs')); add('drafting-compass', 'Planos', '', () => go('plans')); add('scale', 'Decisiones', '', () => go('decide')); }
  add('book-open', 'Apuntes', '', () => go('apuntes'));
  add('sun', 'Mi plan de hoy', '', () => openDay(today()));
  if (isOwner()) add('user-check', 'Seguimiento', '', () => go('track'));
  add('calculator', 'Calculadoras eléctricas', 'Intensidad, potencia, caída de tensión, sección', () => openCalc());
  if (proj() && adminOf()) add('plus', 'Nueva tarea', proj().name, async () => { if (S.view !== 'board') await go('board'); $('.addt input')?.focus(); });
  if (canCreate()) add('folder-plus', 'Nuevo proyecto', '', () => openModal('project-new'));
  if (isOwner()) { add('users', 'Miembros y permisos', '', () => openModal('members')); add('columns-3', 'Comparar proyectos', '', () => go('compare'));
    add('chart-no-axes-column', 'Estadísticas de uso', '', () => go('usage')); add('scroll-text', 'Registro de administración', '', () => go('audit')); add('megaphone', 'Anuncio general', '', () => openModal('banner')); }
  add('user', 'Mi perfil', '', () => go('person', { uid: S.me.id }));
  add('user-cog', 'Editar perfil y avisos', '', () => openModal('profile'));
  add('sun-moon', 'Cambiar modo claro / oscuro', '', () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
  add('keyboard', 'Atajos de teclado', '', () => openModal('keys'));
  add('undo-2', 'Deshacer último cambio', 'Ctrl+Z', () => undo());
  if (proj()) { add('presentation', 'Pantalla de clase', proj().name, () => presentMode(true));
    PVIEWS.filter(v => v[0] !== 'trash' || adminOf()).forEach(([k, n, i]) => add(i, `${n}`, proj().name, () => go(k))); }
  S.projects.filter(p => !p.archived).forEach(p => add('folder-kanban', `Ir a ${p.name}`, p.is_template ? 'Plantilla' : 'Proyecto', () => goProject(p.id)));
  S.wiki.forEach(w => add('file-text', w.title, 'Nota · ' + (proj()?.name || ''), () => { S.wid = w.id; go('wiki'); }));
  const seen = new Set();
  [...S.tasks, ...S.mine].forEach(t => { if (seen.has(t.id)) return; seen.add(t.id); add('square-check', t.title, 'Tarea · ' + (proj(t.project_id)?.name || ''), () => jump(t.project_id, t.id)); });
  members().forEach(u => add('user', pname(u.id), 'Perfil', () => go('person', { uid: u.id })));
  return it;
}
function openPalette(){ track('f:palette'); S.pal = { q: '', i: 0 }; renderPalette(); setTimeout(() => $('#palq')?.focus()); }
function closePalette(){ S.pal = null; $('#palette')?.remove(); }
function renderPalette(){
  let el = $('#palette'); if (!el) { el = document.createElement('div'); el.id = 'palette'; document.body.append(el); }
  const words = norm(S.pal.q).split(/\s+/).filter(Boolean);
  const rank = x => { const l = norm(x.label), q0 = norm(S.pal.q.trim()); return !q0 ? 0 : l.startsWith(q0) ? 0 : l.split(/\s+/).some(w => w.startsWith(q0)) ? 1 : l.includes(q0) ? 2 : 3; };
  S.palList = palItems().filter(x => words.every(w => norm(x.label + ' ' + x.sub).includes(w))).map((x, i) => [rank(x), i, x]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(e => e[2]).slice(0, 40);
  S.pal.i = Math.min(S.pal.i, Math.max(0, S.palList.length - 1));
  el.innerHTML = `<div class="ov pal-ov" onclick="if(event.target===this)closePalette()"><div class="pal">
    <div class="row pal-in">${ic('search')}<input id="palq" value="${esc(S.pal.q)}" placeholder="Escribe un comando, un proyecto, una tarea o una persona…" autocomplete="off"
      oninput="S.pal.q=this.value;S.pal.i=0;renderPalette();$('#palq').focus();$('#palq').setSelectionRange(this.value.length,this.value.length)" onkeydown="palKey(event)"><kbd>Esc</kbd></div>
    <div class="pal-list">${S.palList.map((x, i) => `<button class="${i === S.pal.i ? 'on' : ''}" onmouseenter="S.pal.i=${i};document.querySelectorAll('.pal-list button').forEach((b,k)=>b.classList.toggle('on',k===${i}))" onclick="runPal(${i})">${ic(x.icon)}<span class="grow">${esc(x.label)}</span><small>${esc(x.sub)}</small></button>`).join('') || '<p class="mut" style="padding:14px">Sin resultados</p>'}</div>
    <div class="pal-foot small mut">↑ ↓ para moverte · Enter para abrir · Ctrl+K para cerrar</div></div></div>`;
  icons();
  el.querySelector('.pal-list .on')?.scrollIntoView({ block: 'nearest' });
}
function palKey(e){
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); S.pal.i = (S.pal.i + (e.key === 'ArrowDown' ? 1 : -1) + S.palList.length) % Math.max(S.palList.length, 1); const q0 = S.pal.q; renderPalette(); const i = $('#palq'); i.focus(); i.setSelectionRange(q0.length, q0.length); }
  else if (e.key === 'Enter') { e.preventDefault(); runPal(S.pal.i); }
  else if (e.key === 'Escape') { e.stopPropagation(); closePalette(); }
}
function runPal(i){ const x = S.palList[i]; closePalette(); x?.run(); }

/* ============ 8 · Menú del clic derecho en las tarjetas ============ */
function closeCtx(){ const el = $('#ctx'); if (el) { el.remove(); return true; } return false; }
function cardMenu(e, tid){
  e.preventDefault(); closeCtx(); hoverOff(); track('f:ctx');
  const t = S.tasks.find(x => x.id === tid), E = adminOf(), assigned = new Set(t.task_assignees.map(a => a.user_id));
  const el = document.createElement('div'); el.id = 'ctx'; el.className = 'ctx';
  el.innerHTML = `<button onclick="closeCtx();openTask('${tid}')">${ic('external-link')} Abrir</button>
    <button onclick="closeCtx();voteTask('${tid}',${votesOf(tid).some(v => v.user_id === S.me.id)})">${ic('chevron-up')} ${votesOf(tid).some(v => v.user_id === S.me.id) ? 'Quitar mi voto' : 'Votar como prioritaria'}</button>
    <button onclick="closeCtx();navigator.clipboard?.writeText(taskLink('${t.project_id}','${tid}')).then(()=>toast('Enlace copiado'))">${ic('link')} Copiar enlace</button>
    ${E ? `<hr><div class="ctx-l">Estado</div><div class="ctx-row">${Object.entries(STATUS).map(([k, n]) => `<button class="chipb ${t.status === k ? 'on' : ''}" onclick="closeCtx();updateTask('${tid}',{status:'${k}'},'cambio de estado')">${n}</button>`).join('')}</div>
      <div class="ctx-l">Prioridad</div><div class="ctx-row">${Object.entries(PRIO).map(([k, [n, c]]) => `<button class="chipb ${t.priority === k ? 'on' : ''}" style="--p:${c}" onclick="closeCtx();updateTask('${tid}',{priority:'${k}'},'cambio de prioridad')"><span class="prio"></span>${n}</button>`).join('')}</div>
      <div class="ctx-l">Mover a</div><div class="ctx-row">${S.buckets.map(b => `<button class="chipb ${t.bucket_id === b.id ? 'on' : ''}" onclick="closeCtx();moveTask(S.tasks.find(x=>x.id==='${tid}'),'${b.id}',Date.now())">${esc(b.name)}</button>`).join('')}</div>
      <div class="ctx-l">Asignar</div><div class="ctx-row">${members().map(u => `<button class="chipb ${assigned.has(u.id) ? 'on' : ''}" onclick="closeCtx();toggleAssignee('${u.id}',${!assigned.has(u.id)},'${tid}')">${av(u.id)}${esc(first(u.id))}</button>`).join('')}</div>
      <div class="ctx-l">Fecha límite</div><div class="ctx-row"><input type="date" value="${t.due_date || ''}" onchange="updateTask('${tid}',{due_date:this.value||null},'cambio de fecha');closeCtx()"></div>
      <hr><button onclick="closeCtx();S.tid='${tid}';dupTask()">${ic('copy')} Duplicar</button>
      <button class="bad" onclick="closeCtx();trashTasks(['${tid}'],'«'+S.tasks.find(x=>x.id==='${tid}').title+'» enviada a la papelera')">${ic('trash-2')} Enviar a la papelera</button>` : ''}`;
  document.body.append(el); icons();
  const r = el.getBoundingClientRect();
  el.style.left = Math.min(e.clientX, innerWidth - r.width - 8) + 'px';
  el.style.top = Math.min(e.clientY, innerHeight - r.height - 8) + 'px';
}
document.addEventListener('mousedown', e => { if (!e.target.closest('#ctx')) closeCtx(); });
addEventListener('scroll', closeCtx, true);
addEventListener('resize', closeCtx);

/* ============ 12 · Vista previa al pasar el ratón ============ */
let hoverT;
function hoverCard(e, tid){
  if (matchMedia('(hover:none)').matches || S.selMode) return;
  const card = e.currentTarget; clearTimeout(hoverT);
  hoverT = setTimeout(() => {
    if ($('#ctx') || S.modal === 'task' && !pref('drawer', true)) return;
    const t = S.tasks.find(x => x.id === tid); if (!t || !document.body.contains(card)) return;
    const last = [...(t.comments || [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!t.description && !t.subtasks.length && !last) return;
    let el = $('#hov'); if (!el) { el = document.createElement('div'); el.id = 'hov'; el.className = 'hov'; document.body.append(el); }
    el.innerHTML = `<b>${esc(t.title)}</b>
      ${t.description ? `<p>${esc(t.description.slice(0, 220))}${t.description.length > 220 ? '…' : ''}</p>` : ''}
      ${t.subtasks.length ? `<div class="hov-subs">${t.subtasks.slice(0, 6).map(s => `<div class="${s.done ? 'd' : ''}">${s.done ? '☑' : '☐'} ${esc(s.title || '')}</div>`).join('')}${t.subtasks.length > 6 ? `<div class="mut">…y ${t.subtasks.length - 6} más</div>` : ''}</div>` : ''}
      ${last ? `<div class="hov-last">${av(last.user_id)}<span><b>${esc(first(last.user_id))}</b> · ${ago(last.created_at)}<br>${esc((last.body || '📷 Foto').slice(0, 110))}</span></div>` : ''}`;
    const r = card.getBoundingClientRect(), w = 300;
    el.style.left = (r.right + 10 + w > innerWidth ? Math.max(8, r.left - w - 10) : r.right + 10) + 'px';
    el.style.top = Math.min(r.top, innerHeight - el.offsetHeight - 10) + 'px';
    el.classList.add('on');
  }, 650);
}
function hoverOff(){ clearTimeout(hoverT); $('#hov')?.remove(); }
document.addEventListener('dragstart', hoverOff);

/* ============ 9 · Arrastrar fechas en calendario y cronograma ============ */
async function calDrop(e, iso){
  e.preventDefault(); e.currentTarget.classList.remove('over');
  const t = S.tasks.find(x => x.id === e.dataTransfer.getData('text/plain')); if (!t || t.due_date === iso) return;
  const patch = { due_date: iso };
  if (t.start_date && t.due_date) patch.start_date = addDays(t.start_date, dayDiff(t.due_date, iso)); // mantiene la duración
  else if (t.start_date && t.start_date > iso) patch.start_date = iso;
  await updateTask(t.id, patch, 'cambio de fecha'); track('f:dragdate');
  toast(`«${t.title}» ahora vence el ${fmtD(iso)} · Ctrl+Z para deshacer`);
}
function ganttDown(e, tid, W){
  if (e.button !== 0) return;
  e.preventDefault();
  const el = e.currentTarget, t = S.tasks.find(x => x.id === tid), x0 = e.clientX, left0 = el.offsetLeft, w0 = el.offsetWidth;
  const resize = !!(t.start_date && t.due_date) && e.offsetX > w0 - 10;
  let days = 0, moved = false;
  el.classList.add('dragging');
  const mv = ev => { const dx = ev.clientX - x0; if (Math.abs(dx) > 4) moved = true; days = Math.round(dx / W);
    if (resize) el.style.width = Math.max(W - 4, w0 + days * W) + 'px'; else el.style.left = (left0 + days * W) + 'px'; };
  const up = async () => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up); el.classList.remove('dragging');
    if (!moved) return openTask(tid);
    if (!days) return render();
    const patch = {};
    if (resize) { let nd = addDays(t.due_date, days); if (nd < t.start_date) nd = t.start_date; patch.due_date = nd; }
    else { if (t.start_date) patch.start_date = addDays(t.start_date, days); if (t.due_date) patch.due_date = addDays(t.due_date, days); }
    await updateTask(tid, patch, 'cambio de fechas'); track('f:dragdate');
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}

/* ============ 10 · Crear tareas escribiendo de forma natural ============ */
// "Planos @Ana viernes !urgente #Planos" → asignada a Ana, vence el viernes, urgente, etiqueta Planos
const DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
function parseQuick(raw){
  const out = { who: [], prio: null, labels: [], due: null };
  const keep = [], words = raw.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const w = words[i], n = norm(w), nx = norm(words[i + 1] || '');
    let m;
    if ((m = w.match(/^@(.+)$/))) {
      const q2 = norm(m[1]); const u = members().find(p => norm(pname(p.id)).split(/\s+/).some(part => part.startsWith(q2)) || norm(pname(p.id)).replace(/\s+/g, '').startsWith(q2));
      if (u) { if (!out.who.includes(u.id)) out.who.push(u.id); continue; }
    }
    if ((m = n.match(/^!(urgente|u|alta|importante|i|media|m|baja|b)$/))) { out.prio = { u:'urgente', urgente:'urgente', alta:'importante', importante:'importante', i:'importante', media:'media', m:'media', baja:'baja', b:'baja' }[m[1]]; continue; }
    if ((m = w.match(/^#([\p{L}\p{N}_-]+)$/u))) { out.labels.push(m[1]); continue; }
    if (n === 'hoy') { out.due = today(); continue; }
    if (n === 'manana') { out.due = addDays(today(), 1); continue; }
    if (n === 'pasado' && nx === 'manana') { out.due = addDays(today(), 2); i++; continue; }
    if (n === 'en' && /^\d+$/.test(nx) && /^dias?$/.test(norm(words[i + 2] || ''))) { out.due = addDays(today(), +nx); i += 2; continue; }
    if (n === 'el' && DAYS.includes(nx)) continue; // "el viernes"
    const di = DAYS.indexOf(n);
    if (di >= 0) { const d = new Date(), k = (di - d.getDay() + 7) % 7 || 7; out.due = addDays(today(), k); continue; }
    if ((m = n.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/))) {
      const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
      let iso = `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
      if (!m[3] && iso < today()) iso = `${y + 1}${iso.slice(4)}`;
      if (!isNaN(new Date(iso + 'T00:00'))) { out.due = iso; continue; }
    }
    keep.push(w);
  }
  out.title = keep.join(' ').trim() || raw;
  return out;
}
function nlHint(el){
  let h = el.parentNode.querySelector('.nlhint');
  const v = el.value.trim(), x = v ? parseQuick(v) : null;
  const bits = x ? [x.who.length && `👤 ${x.who.map(first).join(', ')}`, x.due && `📅 ${fmtD(x.due)}`, x.prio && `⚡ ${PRIO[x.prio][0]}`, x.labels.length && `🏷 ${x.labels.join(', ')}`].filter(Boolean) : [];
  if (!bits.length) { h?.remove(); return; }
  if (!h) { h = document.createElement('div'); h.className = 'nlhint'; el.after(h); }
  h.textContent = `«${x.title}» · ${bits.join(' · ')}`;
}

/* ============ 15 · Comentarios en las Notas ============ */
function wikiSel(){
  const sel = getSelection().toString().trim();
  if (sel.length > 1) { S.wquote = sel.slice(0, 500); keep(render); setTimeout(() => $('#wc-body')?.focus()); }
}
function wikiCommentsHTML(page){
  const all = (S.wcom || []).filter(c => c.page_id === page.id), open = all.filter(c => !c.resolved), done = all.filter(c => c.resolved);
  const E = adminOf(), item = c => `<div class="wcom ${c.resolved ? 'res' : ''}">${av(c.user_id)}<div class="grow">
      <div class="row small" style="gap:6px"><b>${esc(pname(c.user_id))}</b><span class="mut">${ago(c.created_at)}</span>${c.resolved ? '<span class="chip ok" style="padding:0 6px">Resuelto</span>' : ''}<span class="grow"></span>
        ${c.user_id === S.me.id || E ? `<button class="btn sm ghost" onclick="resolveWcom('${c.id}',${!c.resolved})">${ic(c.resolved ? 'rotate-ccw' : 'check', 'sm')} ${c.resolved ? 'Reabrir' : 'Resolver'}</button><button class="ico" title="Borrar" onclick="delWcom('${c.id}')">${ic('trash-2', 'sm')}</button>` : ''}</div>
      ${c.quote ? `<div class="quote">«${esc(c.quote)}»</div>` : ''}<div style="white-space:pre-wrap">${linkify(c.body)}</div></div></div>`;
  return `<div class="wcoms"><div class="row" style="margin-bottom:8px"><b>${ic('message-square-text')} Comentarios (${open.length})</b><span class="grow"></span>
      ${done.length ? `<button class="btn sm ghost" onclick="S.wshowRes=!S.wshowRes;render()">${S.wshowRes ? 'Ocultar' : 'Ver'} resueltos (${done.length})</button>` : ''}</div>
    ${open.map(item).join('') || '<p class="small mut">Sin comentarios. Selecciona un texto de la página para comentar ese trozo.</p>'}
    ${S.wshowRes ? done.map(item).join('') : ''}
    <div class="wc-new">${S.wquote ? `<div class="quote row">«${esc(S.wquote)}»<span class="grow"></span><button class="ico" onclick="S.wquote=null;keep(render)">${ic('x', 'sm')}</button></div>` : ''}
      <div class="row"><input id="wc-body" placeholder="${S.wquote ? 'Comenta el texto seleccionado…' : 'Escribe un comentario (o selecciona un texto de la página)…'}" onkeydown="if(event.key==='Enter')addWcom('${page.id}')"><button class="btn pri" onclick="addWcom('${page.id}')">${ic('send', 'sm')}</button></div></div></div>`;
}
async function addWcom(pageId){
  track('f:wikicomment');
  const body = $('#wc-body').value.trim(); if (!body) return;
  const quote = S.wquote || null; $('#wc-body').value = ''; S.wquote = null;
  const [c] = await q(sb.from('wiki_comments').insert({ page_id: pageId, body, quote }).select());
  S.wcom = [...(S.wcom || []), c]; render();
}
async function resolveWcom(id, v){ const c = S.wcom.find(x => x.id === id); c.resolved = v; render(); await q(sb.from('wiki_comments').update({ resolved: v }).eq('id', id)); }
async function delWcom(id){ if (!confirm('¿Borrar este comentario?')) return; S.wcom = S.wcom.filter(x => x.id !== id); render(); await q(sb.from('wiki_comments').delete().eq('id', id)); }

/* ============ 16 · Comparar proyectos (solo propietario) ============ */
async function loadCompare(){
  if (!isOwner()) { S.view = 'home'; return; }
  const [tasks, deps, logs, coms] = await Promise.all([
    q(sb.from('tasks').select('id,project_id,status,due_date,completed_at,created_at,task_assignees(user_id)').is('deleted_at', null)),
    q(sb.from('task_deps').select('*')),
    q(sb.from('time_logs').select('minutes,user_id,task_id')),
    q(sb.from('comments').select('user_id,task_id')),
  ]);
  S.cmp = { tasks, deps, logs, coms };
}
function compareHTML(){
  if (!S.cmp) return '';
  const { tasks, deps, logs, coms } = S.cmp, td = today();
  const list = S.projects.filter(p => !p.is_template && (S.cmpArch || !p.archived));
  const rows = list.map(p => {
    const ts = tasks.filter(t => t.project_id === p.id), ids = new Set(ts.map(t => t.id)), done = ts.filter(t => t.status === 'completada').length;
    const pl = logs.filter(l => ids.has(l.task_id)), pc = coms.filter(c => ids.has(c.task_id));
    const score = {};
    ts.forEach(t => t.status === 'completada' && t.task_assignees.forEach(a => score[a.user_id] = (score[a.user_id] || 0) + 3));
    pl.forEach(l => score[l.user_id] = (score[l.user_id] || 0) + l.minutes / 60);
    pc.forEach(c => score[c.user_id] = (score[c.user_id] || 0) + 0.2);
    const top = Object.entries(score).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([u]) => u);
    return { p, n: ts.length, done, pct: ts.length ? Math.round(done / ts.length * 100) : 0, risk: p.archived ? null : computeRisk(p, ts, deps),
      late: ts.filter(t => t.status !== 'completada' && t.due_date && t.due_date < td).length, mins: pl.reduce((a, l) => a + l.minutes, 0), msgs: pc.length, top };
  });
  return `<div class="page" style="max-width:none"><div class="row"><h1 class="grow">Comparar proyectos</h1>
      <label class="tg row small mut" style="margin:0"><input type="checkbox" style="width:auto" ${S.cmpArch ? 'checked' : ''} onchange="S.cmpArch=this.checked;render()"> Incluir archivados</label></div>
    <p class="mut" style="margin-top:0">Solo lo ves tú. «Más activos» combina tareas completadas, horas y mensajes.</p>
    <div class="card-box tablewrap"><table class="ltable"><thead><tr><th>Proyecto</th><th>Entrega</th><th>Progreso</th><th>Estado</th><th>Tareas</th><th>Vencidas</th><th>Horas</th><th>Mensajes</th><th>Más activos</th></tr></thead>
    <tbody>${rows.map(r => `<tr onclick="goProject('${r.p.id}')"><td><div class="row" style="gap:8px">${r.p.emoji ? `<span style="font-size:18px">${esc(r.p.emoji)}</span>` : `<i class="dot" style="width:10px;height:10px;border-radius:3px;background:${esc(r.p.color)};display:inline-block"></i>`}<b>${esc(r.p.name)}</b>${r.p.archived ? '<span class="chip">Archivado</span>' : ''}</div></td>
      <td>${r.p.due_date ? fmtD(r.p.due_date) : '—'}</td>
      <td style="min-width:150px"><div class="row" style="gap:8px"><div class="bar grow" style="--c:${esc(r.p.color)}"><i style="width:${r.pct}%"></i></div><b class="small">${r.pct}%</b></div></td>
      <td>${r.risk ? `<span class="chip ${r.risk.level === 'ok' ? 'ok' : r.risk.level}" title="${esc(r.risk.reasons.join(' · ') || 'Sin problemas')}"><span class="light ${r.risk.level}"></span>${RISK_TXT[r.risk.level]}</span>` : '—'}</td>
      <td>${r.done}/${r.n}</td><td>${r.late ? `<span style="color:var(--bad-t)">${r.late}</span>` : '0'}</td><td>${fmtMin(r.mins)}</td><td>${r.msgs}</td>
      <td><div class="avs" style="margin:0;justify-content:flex-start">${r.top.map(u => av(u)).join('') || '<span class="mut">—</span>'}</div></td></tr>`).join('') || `<tr><td colspan="9">${emptyState('columns-3', 'No hay proyectos')}</td></tr>`}</tbody></table></div></div>`;
}
