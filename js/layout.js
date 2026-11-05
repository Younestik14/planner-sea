'use strict';
// Planner SEA · estructura de la página, notificaciones, modales y teclado
/* ============ estructura de la página ============ */
function render(){
  const unread = S.notifs.filter(n => !n.read).length;
  const pending = S.profiles.filter(p => !p.approved && !p.is_admin).length;
  document.title = (unread ? `(${unread}) ` : '') + 'Planner SEA';
  document.body.classList.toggle('side-off', !!ls('sideoff'));
  $('#app').innerHTML = `
  <header class="top">
    <button class="ico" onclick="toggleSide()" title="Mostrar u ocultar el menú" aria-label="Menú">${ic('panel-left', 'lg')}</button>
    ${brandHTML()}
    <div class="sp"></div>
    <div class="search">${ic('search')}<input id="sq" type="search" placeholder="Buscar tareas y mensajes…  ( / )" value="${esc(S.found?.q || '')}" oninput="clearTimeout(window._sq);window._sq=setTimeout(()=>doSearch(this.value),300)">
      ${S.panel === 'search' && S.found ? `<div class="sr">${S.found.items.map(r => `<div onclick="jump('${r.p}','${r.t}')"><b>${r.icon} ${esc(r.title)}</b><br><small class="mut">${esc(r.sub)}</small></div>`).join('') || '<div class="mut">Sin resultados</div>'}</div>` : ''}</div>
    ${isOwner() ? `<button class="btn hide-m" onclick="openModal('members')">${ic('users')} Miembros${pending ? ` <span class="chip warn">${pending}</span>` : ''}</button>` : ''}
    <button class="ico bell" onclick="togglePanel('notifs')" aria-label="Notificaciones">${ic('bell', 'lg')}${unread ? `<b>${unread}</b>` : ''}</button>
    <button class="ico" onclick="togglePanel('menu')" style="padding:2px" aria-label="Tu cuenta">${av(S.me.id, 'l')}</button>
    ${S.panel === 'notifs' ? notifsHTML() : ''}
    ${S.panel === 'menu' ? menuHTML() : ''}
  </header>
  <div class="layout">
    <aside class="side">${sideHTML()}</aside><div class="scrim" onclick="closeSide()"></div>
    <main>${bannerHTML()}${mainHTML()}</main>
  </div>
  <nav class="bottomnav">
    <button class="${S.view === 'home' ? 'on' : ''}" onclick="go('home')">${ic('house', 'lg')}Inicio</button>
    <button class="${S.view === 'mine' ? 'on' : ''}" onclick="go('mine')">${ic('list-todo', 'lg')}Mis tareas</button>
    <button class="${PVIEWS.some(v => v[0] === S.view) ? 'on' : ''}" onclick="toggleSide(true)">${ic('folder-kanban', 'lg')}Proyectos</button>
    <button onclick="togglePanel('notifs')">${ic('bell', 'lg')}Avisos${unread ? `<b>${unread}</b>` : ''}</button>
  </nav>
  ${S.selMode && S.sel.size ? bulkBarHTML() : ''}`;
  icons();
}
function toggleSide(force){
  if (matchMedia('(max-width:860px)').matches) document.body.classList.toggle('side-open', force);
  else { ls('sideoff', !ls('sideoff')); document.body.classList.toggle('side-off', !!ls('sideoff')); }
}
function closeSide(){ document.body.classList.remove('side-open'); }

function menuHTML(){
  const light = document.documentElement.dataset.theme === 'light';
  return `<div class="menu"><div style="padding:8px 10px" class="row">${av(S.me.id, 'l')}<div class="grow"><b>${esc(S.me.full_name)}</b><br><small class="mut">${esc(S.me.email)}</small></div></div>
    ${isOwner() ? '<div style="padding:0 10px 6px"><span class="badge own">Propietario</span></div>' : ''}
    <hr>
    <button onclick="go('person',{uid:S.me.id});S.panel=null">${ic('user')} Mi perfil</button>
    <button onclick="openModal('profile')">${ic('user-cog')} Editar perfil y avisos</button>
    ${isOwner() ? `<button onclick="openModal('members')">${ic('users')} Miembros y permisos</button>` : ''}
    <button onclick="setTheme('${light ? 'dark' : 'light'}')">${ic(light ? 'moon' : 'sun')} Modo ${light ? 'oscuro' : 'claro'}</button>
    <button onclick="ls('sound', ls('sound') === false);render()">${ic(ls('sound') === false ? 'volume-x' : 'volume-2')} Sonido ${ls('sound') === false ? 'desactivado' : 'activado'}</button>
    <button onclick="S.panel=null;openModal('keys')">${ic('keyboard')} Atajos de teclado</button>
    <hr><button onclick="logout()">${ic('log-out')} Cerrar sesión</button></div>`;
}
function setTheme(t){ document.documentElement.dataset.theme = t; ls('theme', t); render(); }

function sideHTML(){
  const act = S.projects.filter(p => !p.is_template && !p.archived), arch = S.projects.filter(p => !p.is_template && p.archived);
  const tpl = S.projects.filter(p => p.is_template);
  const pv = PVIEWS.some(v => v[0] === S.view);
  const pj = p => { const tot = p.tasks.length, done = p.tasks.filter(t => t.status === 'completada').length;
    return `<button class="pj ${p.id === S.pid && pv ? 'on' : ''}" style="--c:${esc(p.color)}" onclick="goProject('${p.id}')">
      <div class="n">${p.emoji ? `<span class="semoji">${esc(p.emoji)}</span>` : '<i class="dot"></i>'}<span>${esc(p.name)}</span>${adminOf(p.id) && !isOwner() ? '<span class="badge" style="margin-left:auto">Admin</span>' : ''}</div>
      <div class="bar"><i style="width:${tot ? done / tot * 100 : 0}%"></i></div>
      <small class="mut">${done}/${tot} tareas${p.due_date && !p.archived ? ` · entrega ${fmtD(p.due_date)}` : ''}</small></button>`; };
  const openArch = !!ls('arch');
  return `
    <button class="nav ${S.view === 'home' ? 'on' : ''}" onclick="go('home')">${ic('house')} Inicio</button>
    <button class="nav ${S.view === 'mine' ? 'on' : ''}" onclick="go('mine')">${ic('list-todo')} Mis tareas <span class="cnt">${S.mine.filter(t => t.status !== 'completada').length}</span></button>
    <button class="nav ${S.view === 'week' ? 'on' : ''}" onclick="go('week')">${ic('calendar-range')} Calendario de clase</button>
    <button class="nav ${S.view === 'timetable' ? 'on' : ''}" onclick="go('timetable')">${ic('clock')} Horario</button>
    ${isOwner() ? `<h4>Administración</h4>
      <button class="nav ${S.view === 'compare' ? 'on' : ''}" onclick="go('compare')">${ic('columns-3')} Comparar proyectos</button>
      <button class="nav ${S.view === 'usage' ? 'on' : ''}" onclick="go('usage')">${ic('chart-no-axes-column')} Estadísticas de uso</button>
      <button class="nav ${S.view === 'audit' ? 'on' : ''}" onclick="go('audit')">${ic('scroll-text')} Registro</button>
      <button class="nav" onclick="openModal('banner')">${ic('megaphone')} Anuncio general${bannerActive() ? ' <span class="cnt">activo</span>' : ''}</button>` : ''}
    <h4>Proyectos ${canCreate() ? `<button class="ico" title="Nuevo proyecto" onclick="openModal('project-new')">${ic('plus', 'sm')}</button>` : ''}</h4>
    ${act.map(pj).join('') || '<p class="mut small" style="padding:0 10px">Aún no hay proyectos activos</p>'}
    ${tpl.length && canCreate() ? `<h4>Plantillas</h4>${tpl.map(p => `<button class="pj ${p.id === S.pid && pv ? 'on' : ''}" style="--c:${esc(p.color)}" onclick="goProject('${p.id}')"><div class="n">${ic('layers', 'sm')}<span>${esc(p.name)}</span></div></button>`).join('')}` : ''}
    ${arch.length ? `<h4 style="cursor:pointer" onclick="ls('arch',${!openArch});render()">Archivados (${arch.length}) ${ic(openArch ? 'chevron-up' : 'chevron-down', 'sm')}</h4>${openArch ? arch.map(pj).join('') : ''}` : ''}
    <div style="flex:1"></div>
    <p class="mut small" style="padding:10px;margin:0">${SCHOOL}</p>`;
}

function mainHTML(){
  if (S.view === 'home') return homeHTML();
  if (S.view === 'mine') return mineHTML();
  if (S.view === 'person') return personHTML();
  if (S.view === 'compare') return compareHTML();
  if (S.view === 'week') return weekHTML();
  if (S.view === 'timetable') return timetableHTML();
  if (S.view === 'audit') return auditHTML();
  if (S.view === 'usage') return usageHTML();
  const p = proj();
  if (!p) return emptyState('folder-kanban', 'No hay proyectos todavía', canCreate() ? 'Crea el primero con el botón + del menú.' : 'Cuando se cree uno, aparecerá aquí.');
  const view = { material: materialHTML, board: boardHTML, list: listHTML, gantt: ganttHTML, cal: calHTML, diary: diaryHTML, wiki: wikiHTML, team: teamHTML, stats: statsHTML, files: filesHTML, trash: trashHTML }[S.view];
  const anim = S._lastView !== S.view + S.pid && !reduceMotion(); S._lastView = S.view + S.pid;
  return projectHeaderHTML(p) + `<div class="${anim ? 'view-in' : ''}" style="display:contents">${view ? view() : `<div class="hist">${histHTML(S.activity, true)}</div>`}</div>`;
}
const emptyState = (icon, title, text = '') => `<div class="empty-state">${ic(icon)}<h3>${title}</h3><p>${text}</p></div>`;

function projectHeaderHTML(p){
  const E = adminOf(p.id), total = S.tasks.length, open = S.tasks.filter(t => t.status !== 'completada');
  const done = total - open.length, late = open.filter(t => t.due_date && daysLeft(t.due_date) < 0).length;
  const pin = S.posts.find(x => x.pinned);
  return `
  <div class="ph" style="--c:${esc(p.color)}">
    <h2>${p.emoji ? `<span class="pemoji">${esc(p.emoji)}</span>` : '<i class="dot"></i>'}${esc(p.name)}</h2>
    <button class="ico" title="${isFav('p', p.id) ? 'Quitar de accesos directos' : 'Añadir a accesos directos de Inicio'}" onclick="toggleFav('p','${p.id}')">${ic('star', isFav('p', p.id) ? 'fav' : '')}</button>
    ${p.is_template ? '<span class="chip">Plantilla</span>' : ''}${p.archived ? '<span class="chip">Archivado</span>' : ''}${E && !isOwner() ? '<span class="badge">Eres admin</span>' : ''}
    <div class="acts">
      ${okUrl(p.drive_url) ? `<a class="btn" href="${esc(p.drive_url)}" target="_blank" rel="noopener">${ic('folder')} <span class="hide-m">Drive</span></a>` : ''}
      <button class="btn" onclick="exportReport()" title="Informe para imprimir o guardar como PDF">${ic('file-text')} <span class="hide-m">Informe</span></button>
      <button class="btn" onclick="exportExcel()" title="Descargar en Excel">${ic('file-spreadsheet')} <span class="hide-m">Excel</span></button>
      ${E ? `<button class="btn" onclick="openModal('project-edit')">${ic('settings')} <span class="hide-m">Ajustes</span></button>` : ''}
    </div>
    <div class="meta">
      <div class="bar" style="--c:${esc(p.color)}"><i style="width:${total ? done / total * 100 : 0}%"></i></div>
      <span class="small mut"><b style="color:var(--txt)">${total ? Math.round(done / total * 100) : 0}%</b> · ${done}/${total} completadas</span>
      ${late ? `<span class="chip bad">${ic('triangle-alert', 'sm')} ${late} vencidas</span>` : ''}
      ${dueProjectChip(p)}
      ${riskChip(p, S.tasks)}
    </div>
    ${p.description ? `<p class="desc">${linkify(p.description)}</p>` : ''}
    ${pin && S.view !== 'diary' ? `<div class="pinned" onclick="go('diary')">${ic('pin')}<div class="grow"><b>${esc(first(pin.user_id))}:</b> ${esc((pin.body || (pin.poll_options ? 'Encuesta' : 'Fotos')).slice(0, 160))}</div><span class="small mut">Ver diario →</span></div>` : ''}
  </div>
  <div class="tabs" style="--c:${esc(p.color)}">
    ${tabsHTML(E)}
    <div class="sp"></div>
    ${S.view === 'board' ? boardToolsHTML() : ''}
  </div>`;
}
function tabsHTML(E){
  const all = PVIEWS.filter(v => v[0] !== 'trash' || E), vis = pref('tabs', DEFAULT_TABS);
  const shown = all.filter(v => vis.includes(v[0]) || v[0] === S.view), more = all.filter(v => !shown.includes(v));
  const tab = ([k, n, i]) => `<button class="tab ${S.view === k ? 'on' : ''}" onclick="go('${k}')">${ic(i)} ${n}${k === 'trash' && S.trash.length ? ` <span class="cnt">${S.trash.length}</span>` : ''}</button>`;
  return shown.map(tab).join('') + `<div class="more-wrap"><button class="tab" onclick="event.stopPropagation();togglePanel('more')">${ic('ellipsis')} Más${more.length ? ` <span class="cnt">${more.length}</span>` : ''}</button>
    ${S.panel === 'more' ? `<div class="menu more-menu" onclick="event.stopPropagation()">${more.map(([k, n, i]) => `<button onclick="S.panel=null;go('${k}')">${ic(i)} ${n}</button>`).join('')}
      ${more.length ? '<hr>' : ''}<div class="small mut" style="padding:4px 10px">Pestañas visibles</div>
      ${all.map(([k, n]) => `<label class="chkrow"><input type="checkbox" ${vis.includes(k) ? 'checked' : ''} onchange="toggleTab('${k}',this.checked)"> ${n}</label>`).join('')}
      <button onclick="setPref('tabs',null)">${ic('rotate-ccw')} Restablecer</button></div>` : ''}</div>`;
}
function toggleTab(k, on){ const v = new Set(pref('tabs', DEFAULT_TABS)); on ? v.add(k) : v.delete(k); if (!v.size) v.add('board'); setPref('tabs', PVIEWS.map(x => x[0]).filter(x => v.has(x))); }
function boardToolsHTML(){
  const E = adminOf();
  return `<div class="tools">
    ${E ? `<button class="ico ${S.selMode ? 'on' : ''}" onclick="S.selMode=!S.selMode;S.sel.clear();render()" title="Seleccionar varias tareas">${ic('list-checks')}</button>` : ''}
    <button class="ico ${S.compact ? 'on' : ''}" onclick="S.compact=!S.compact;ls('compact',S.compact);render()" title="Vista compacta">${ic('rows-3')}</button>
    <select onchange="S.sort=this.value;ls('sort',S.sort);render()" title="Ordenar tarjetas">
      ${[['manual','Orden manual'],['due','Por fecha'],['prio','Por prioridad'],['person','Por persona'],['votes','Por votos']].map(([k, n]) => `<option value="${k}" ${S.sort === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
    ${labelsOf().length ? `<select onchange="S.label=this.value;render()"><option value="">Todas las etiquetas</option>${labelsOf().map(l => `<option ${l === S.label ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : ''}
    <label class="tg"><input type="checkbox" ${S.onlyMine ? 'checked' : ''} onchange="S.onlyMine=this.checked;render()"> Solo mías</label>
    <div class="tools-wrap"><button class="ico ${S.panel === 'cardcfg' ? 'on' : ''}" title="Qué mostrar en las tarjetas" onclick="event.stopPropagation();togglePanel('cardcfg')">${ic('sliders-horizontal')}</button>
      ${S.panel === 'cardcfg' ? `<div class="menu more-menu" onclick="event.stopPropagation()"><div class="small mut" style="padding:4px 10px">Mostrar en las tarjetas</div>
        ${CARD_FIELDS.map(([k, n]) => `<label class="chkrow"><input type="checkbox" ${showField(k) ? 'checked' : ''} onchange="toggleField('${k}',this.checked)"> ${n}</label>`).join('')}</div>` : ''}</div>
    <button class="ico" title="Pantalla de clase (tablero a pantalla completa para proyectar)" onclick="presentMode(true)">${ic('presentation')}</button></div>`;
}
function toggleField(k, on){ const off = new Set(pref('cardOff', [])); on ? off.delete(k) : off.add(k); setPref('cardOff', [...off]); }
// 13 · Pantalla de clase: tablero grande, sin menús, para proyectar
function presentMode(on){
  if (on) track('f:present');
  document.body.classList.toggle('present', on);
  if (on) { if (S.view !== 'board') go('board'); document.documentElement.requestFullscreen?.().catch(() => {}); toast('Pantalla de clase · pulsa Esc para salir'); }
  else if (document.fullscreenElement) document.exitFullscreen?.();
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.body.classList.remove('present'); });
const labelsOf = () => [...new Set(S.tasks.flatMap(t => t.labels || []))].sort();

/* ============ Notificaciones ============ */
function notifGroups(){
  const out = [], idx = {};
  for (const n of S.notifs) {
    const key = !n.read && n.task_id && ['comment', 'status', 'due'].includes(n.type) ? n.type + n.task_id : n.id;
    if (idx[key]) idx[key].push(n); else out.push(idx[key] = [n]);
  }
  return out;
}
const NICON = { digest:'newspaper', wiki_comment:'message-square-text', comment:'message-square', mention:'at-sign', reply:'reply', assigned:'user-plus', unassigned:'user-minus', status:'circle-check', due:'calendar', due_soon:'alarm-clock',
  project_due:'flag', ready:'eye', post:'megaphone', notice:'megaphone', role:'shield', approved:'party-popper', access_request:'user-plus', unblocked:'lock-open' };
function notifsHTML(){
  return `<div class="np"><div class="h"><b>Notificaciones</b>${S.notifs.some(n => !n.read) ? `<button class="btn ghost sm" onclick="readAll()">Marcar todo como leído</button>` : ''}</div>
    ${notifGroups().map(g => { const n = g[0], k = g.length;
      const txt = k > 1 ? `${k} ${n.type === 'comment' ? 'mensajes nuevos' : 'avisos'} en «${esc(S.tasks.find(t => t.id === n.task_id)?.title || n.message.match(/"(.*)"/)?.[1] || 'la tarea')}»` : esc(n.message);
      return `<div class="nt ${n.read ? '' : 'u'}" onclick="clickNotif('${g.map(x => x.id).join(',')}')"><span class="dot"></span>${ic(NICON[n.type] || 'bell', 'mut')}
      <div class="grow">${txt}<br><small class="mut">${ago(n.created_at)}</small></div></div>`; }).join('') || emptyState('bell', 'Sin notificaciones')}</div>`;
}
async function clickNotif(ids){
  ids = ids.split(','); const n = S.notifs.find(x => x.id === ids[0]); S.panel = null; closeSide();
  const unread = S.notifs.filter(x => ids.includes(x.id) && !x.read);
  if (unread.length) { unread.forEach(x => x.read = true); q(sb.from('notifications').update({ read:true }).in('id', unread.map(x => x.id))); }
  if (n.type === 'access_request') return openModal('members');
  if (n.type === 'exam') return go('week');
  if (!n.project_id || !proj(n.project_id)) return render();
  if (['post', 'notice'].includes(n.type)) return goProject(n.project_id, 'diary');
  await goProject(n.project_id);
  if (n.task_id && S.tasks.some(t => t.id === n.task_id)) openTask(n.task_id);
}
async function readAll(){ S.notifs.forEach(n => n.read = true); render(); await q(sb.from('notifications').update({ read:true }).eq('user_id', S.me.id).eq('read', false)); }

/* ============ Modales ============ */
function renderModal(){
  const m = S.modal;
  if (!m) { $('#modal').innerHTML = ''; return; }
  const extra = { minutes: minutesHTML, agreements: agreementsHTML, wikinew: wikiNewHTML, calc: calcHTML, banner: bannerFormHTML, exam: examFormHTML }[m];
  const html = extra ? extra() : m === 'task' ? taskHTML() : m === 'members' ? membersHTML() : m === 'summary' ? summaryHTML() : m === 'keys' ? keysHTML() : m === 'profile' ? profileHTML()
             : projectFormHTML(m === 'project-edit' ? proj() : null);
  if (!html) { S.modal = null; $('#modal').innerHTML = ''; return; }
  const drawer = m === 'task' && pref('drawer', true);
  $('#modal').innerHTML = drawer ? `<div class="ov drawer">${html}</div>` : `<div class="ov" onclick="if(event.target===this)closeModal()">${html}</div>`;
  const c = $('#chatlist'); if (c) c.scrollTop = c.scrollHeight;
  if (m === 'calc') calcUpdate();
  icons();
}
function openModal(m){ S.modal = m; S.panel = null; closeSide(); render(); renderModal(); }
function closeModal(){ S.modal = null; S.tid = null; S.reply = null; S.cdraft = []; typingChannel(null); setHash(); renderModal(); render(); }

function taskHTML(){
  const t = S.tasks.find(x => x.id === S.tid);
  if (!t) return '';
  const E = adminOf(t.project_id), dis = E ? '' : 'disabled', subs = S.subs || [];
  const assigned = new Set(t.task_assignees.map(a => a.user_id)), bl = blockers(t), deps = depsOf(t);
  const blocks = S.deps.filter(d => d.depends_on === t.id).map(d => S.tasks.find(x => x.id === d.task_id)).filter(Boolean);
  const logs = S.tlogs.filter(l => l.task_id === t.id), total = logs.reduce((a, l) => a + l.minutes, 0), mine = logs.filter(l => l.user_id === S.me.id).reduce((a, l) => a + l.minutes, 0);
  const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${Array.isArray(v) ? v[0] : v}</option>`).join('');
  return `<div class="mod">
    <div class="mh"><span class="chip" style="color:${PRIO[t.priority][1]}">${PRIO[t.priority][0]}</span><h3>${esc(proj(t.project_id)?.name)}</h3>
      <button class="ico" title="Tarea anterior (←)" onclick="navTask(-1)">${ic('chevron-left')}</button>
      <button class="ico" title="Tarea siguiente (→)" onclick="navTask(1)">${ic('chevron-right')}</button>
      <button class="btn sm" onclick="copyLink()" title="Para pegarlo en WhatsApp: abre esta tarea directamente">${ic('link', 'sm')} <span class="hide-m">Copiar enlace</span></button>
      ${E ? `<button class="btn sm" onclick="dupTask()">${ic('copy', 'sm')} <span class="hide-m">Duplicar</span></button><button class="btn sm bad" onclick="delTask()" title="Enviar a la papelera">${ic('trash-2', 'sm')}</button>` : ''}
      <button class="ico" onclick="closeModal()" aria-label="Cerrar">${ic('x')}</button></div>
    <div class="tgrid">
      <div>
        ${E ? `<input id="f-title" class="ttitle" style="margin-top:14px" value="${esc(t.title)}" onchange="if(this.value.trim())saveTask({title:this.value.trim()})">`
            : `<h2 class="ttitle" style="margin:14px 0 0">${esc(t.title)}</h2><p class="small mut" style="margin:4px 0 0">Solo los admins del proyecto modifican la tarea. Tú puedes comentar, añadir subtareas y apuntar horas.</p>`}
        ${bl.length ? `<div class="banner bad">${ic('lock')} <div>Bloqueada: espera a que se complete ${bl.map(x => `<a href="#" onclick="event.preventDefault();openTask('${x.id}')">«${esc(x.title)}»</a>`).join(', ')}.</div></div>` : ''}
        ${t.review_requested && E ? `<div class="banner warn">${ic('eye')} Un compañero ha terminado su parte: revísala y cambia el estado.</div>` : ''}
        <div class="grid4">
          <div><label>Estado</label><select ${dis} onchange="saveTask({status:this.value})">${opt(STATUS, t.status)}</select></div>
          <div><label>Prioridad</label><select ${dis} onchange="saveTask({priority:this.value})">${opt(PRIO, t.priority)}</select></div>
          <div><label>Columna</label><select ${dis} onchange="saveTask({bucket_id:this.value||null})">
            ${S.buckets.map(b => `<option value="${b.id}" ${b.id === t.bucket_id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}${!t.bucket_id ? '<option selected value="">Sin columna</option>' : ''}</select></div>
          <div><label>Fecha de inicio</label><input type="date" ${dis} value="${t.start_date || ''}" onchange="saveDates({start_date:this.value||null})"></div>
          <div><label>Fecha límite</label><input type="date" ${dis} value="${t.due_date || ''}" onchange="saveDates({due_date:this.value||null})"></div>
        </div>
        <label>Asignado a</label>
        <div class="pick">${E
          ? members().map(p => `<label class="${assigned.has(p.id) ? 'on' : ''}"><input type="checkbox" ${assigned.has(p.id) ? 'checked' : ''} onchange="toggleAssignee('${p.id}',this.checked)">${av(p.id)}${esc(pname(p.id))}</label>`).join('')
            + (members().every(p => assigned.has(p.id)) ? `<button class="btn sm ghost" onclick="assignAll(false)">${ic('users', 'sm')} Quitar a toda la clase</button>` : `<button class="btn sm" onclick="assignAll(true)">${ic('users', 'sm')} Toda la clase</button>`)
          : [...assigned].map(id => `<label class="on">${av(id)}${esc(pname(id))}</label>`).join('') || '<span class="mut">Nadie asignado</span>'}</div>
        ${!E && assigned.has(S.me.id) && t.status !== 'completada' ? (t.review_requested
          ? `<div class="banner warn">${ic('eye')} Has avisado de que terminaste tu parte. Un admin la revisará.</div>`
          : `<button class="btn" style="margin-top:10px;color:var(--ok-t)" onclick="sendReady()">${ic('circle-check')} He terminado mi parte</button>`) : ''}
        <label>Depende de <small>(no se puede empezar hasta que estas se completen)</small></label>
        <div class="pick">${deps.map(x => `<label class="${x.status === 'completada' ? '' : 'on'}" onclick="event.preventDefault();openTask('${x.id}')">${ic(x.status === 'completada' ? 'circle-check' : 'lock', 'sm')} ${esc(x.title)}${E ? `<button class="ico" style="padding:0 2px" title="Quitar" onclick="event.stopPropagation();event.preventDefault();delDep('${x.id}')">${ic('x', 'sm')}</button>` : ''}</label>`).join('') || (E ? '' : '<span class="mut">Ninguna</span>')}
          ${E ? `<select style="width:auto" onchange="this.value&&addDep(this.value)"><option value="">+ Añadir…</option>${S.tasks.filter(x => x.id !== t.id && !deps.includes(x)).map(x => `<option value="${x.id}">${esc(x.title)}</option>`).join('')}</select>` : ''}</div>
        ${blocks.length ? `<p class="small mut" style="margin:6px 0 0">Bloquea a: ${blocks.map(x => `<a href="#" onclick="event.preventDefault();openTask('${x.id}')">«${esc(x.title)}»</a>`).join(', ')}</p>` : ''}
        <label>Etiquetas ${E ? '<small>(separadas por comas)</small>' : ''}</label>
        ${E ? `<input id="f-labels" list="lbls" value="${esc((t.labels || []).join(', '))}" placeholder="Ej.: Automatismos, Planos" onchange="saveTask({labels:[...new Set(this.value.split(',').map(s=>s.trim()).filter(Boolean))]})">
               <datalist id="lbls">${labelsOf().map(l => `<option value="${esc(l)}">`).join('')}</datalist>`
            : `<div class="tags">${(t.labels || []).map(lblHTML).join('') || '<span class="mut">Sin etiquetas</span>'}</div>`}
        <label>Descripción</label>
        ${E ? `<textarea id="f-desc" rows="4" placeholder="Explica qué hay que hacer…" onchange="saveTask({description:this.value})">${esc(t.description)}</textarea>`
            : `<div style="white-space:pre-wrap">${t.description ? linkify(t.description) : '<span class="mut">Sin descripción</span>'}</div>`}
        <label>Enlace a Drive</label>
        ${E ? `<input id="f-drive" placeholder="https://drive.google.com/…" value="${esc(t.drive_url)}" onchange="saveDrive(this.value)">` : ''}
        ${okUrl(t.drive_url) ? `<a class="btn" style="margin-top:6px" href="${esc(t.drive_url)}" target="_blank" rel="noopener">${ic('external-link')} Abrir carpeta o documento</a>` : (E ? '' : '<span class="mut">Sin enlace</span>')}
        <label>Subtareas (${subs.filter(s => s.done).length}/${subs.length})</label>
        ${subs.map(s => `<div class="sub ${s.done ? 'd' : ''}"><input type="checkbox" ${s.done ? 'checked' : ''} onchange="q(sb.from('subtasks').update({done:this.checked}).eq('id','${s.id}'))">
          <span>${esc(s.title)}</span>${s.created_by && s.created_by !== S.me.id ? `<small>${esc(first(s.created_by))}</small>` : ''}
          ${E || s.created_by === S.me.id ? `<button class="ico" title="Eliminar" onclick="q(sb.from('subtasks').delete().eq('id','${s.id}'))">${ic('x', 'sm')}</button>` : ''}</div>`).join('')}
        <input id="f-sub" placeholder="+ Añadir subtarea (Enter)" onkeydown="if(event.key==='Enter')addSub(this)" style="margin-top:4px">
        <label>Horas dedicadas · <b style="color:var(--txt)">${fmtMin(total)}</b>${mine ? ` (tú: ${fmtMin(mine)})` : ''}</label>
        ${logs.slice(0, 8).map(l => `<div class="sub"><span>${ic('clock', 'sm')} <b>${fmtMin(l.minutes)}</b> · ${esc(pname(l.user_id))} · <span class="mut">${fmtD(l.logged_on)}</span>${l.note ? ` — ${esc(l.note)}` : ''}</span>
          ${E || l.user_id === S.me.id ? `<button class="ico" title="Borrar" onclick="q(sb.from('time_logs').delete().eq('id','${l.id}'))">${ic('x', 'sm')}</button>` : ''}</div>`).join('')}
        ${logs.length > 8 ? `<p class="small mut">…y ${logs.length - 8} registros más (en el Excel están todos).</p>` : ''}
        <div class="tlog"><input id="f-hrs" style="width:110px" placeholder="1:30 o 1.5" title="Horas: 1:30, 1.5, 45m…"><input id="f-hnote" placeholder="¿Qué has hecho? (opcional)" onkeydown="if(event.key==='Enter')logTime()"><button class="btn" onclick="logTime()">${ic('plus', 'sm')} Apuntar</button></div>
        ${privNoteHTML()}
        <details ${E ? '' : 'open'}><summary>Historial de la tarea</summary><div class="mini">${histHTML(S.tact, false)}</div></details>
      </div>
      <div>
        <b class="row">${ic('message-square')} Chat de la tarea</b>
        ${S.comments.some(c => c.pinned) ? `<div class="pins">${S.comments.filter(c => c.pinned).map(c => `<div class="row" onclick="document.getElementById('m-${c.id}')?.scrollIntoView({behavior:'smooth',block:'center'})">${ic('pin', 'sm')}<b>${esc(first(c.user_id))}:</b><span class="grow">${esc((c.body || '📷 Foto').slice(0, 120))}</span></div>`).join('')}</div>` : ''}
        <div class="chat" id="chatlist" ondragover="event.preventDefault();this.classList.add('drop')" ondragleave="this.classList.remove('drop')" ondrop="event.preventDefault();this.classList.remove('drop');addChatImages(event.dataTransfer.files)">${S.comments.map(c => { const me = c.user_id === S.me.id, rt = S.comments.find(x => x.id === c.reply_to);
          const canEdit = me && c.kind !== 'ready' && c.body && Date.now() - new Date(c.created_at) < 300000;
          return `<div class="msg ${me ? 'me' : ''} ${c.kind === 'ready' ? 'ready' : ''} ${c.pinned ? 'pinned-msg' : ''}" id="m-${c.id}">${av(c.user_id)}
          <div class="bd"><b>${esc(pname(c.user_id))}</b> ${roleBadge(c.user_id, t.project_id)} <small class="mut">${ago(c.created_at)}${c.edited_at ? ' · editado' : ''}</small>
          ${c.pinned ? `<span class="chip warn" style="padding:0 6px">${ic('pin', 'sm')} Fijado</span>` : ''}
          <span class="mact"><button class="ico" title="Responder" onclick="setReply('${c.id}')">${ic('reply', 'sm')}</button>
            ${me || E ? `<button class="ico" title="${c.pinned ? 'Desfijar' : 'Fijar arriba'}" onclick="pinComment('${c.id}')">${ic(c.pinned ? 'pin-off' : 'pin', 'sm')}</button>` : ''}
            ${canEdit ? `<button class="ico" title="Editar (5 min)" onclick="editComment('${c.id}')">${ic('pencil', 'sm')}</button>` : ''}
            ${E ? `<button class="ico" title="Borrar mensaje" onclick="delComment('${c.id}')">${ic('trash-2', 'sm')}</button>` : ''}</span>
          ${rt ? `<div class="quote">↩ <b>${esc(pname(rt.user_id))}</b>: ${esc(rt.body.slice(0, 90) || '📷 Foto')}</div>` : c.reply_to ? '<div class="quote">↩ Mensaje borrado</div>' : ''}
          ${c.body ? `<p>${mentionify(c)}</p>` : ''}
          ${(c.images || []).length ? `<div class="cimgs">${c.images.map(x => imgUrl('chat', x) ? `<img src="${esc(imgUrl('chat', x))}" alt="Foto" loading="lazy" onclick="lightbox(this.src)">` : `<span class="skel"></span>`).join('')}</div>` : ''}
          ${(c.links || []).filter(okUrl).map(u => `<a class="lk" href="${esc(u)}" target="_blank" rel="noopener">${ic(/drive\.google|docs\.google/.test(u) ? 'folder' : 'link', 'sm')} ${esc(u.replace(/^https?:\/\//, '').slice(0, 45))}</a>`).join('')}
          <div class="reacts">${REACT_MSG.map(em => { const rs = S.reacts.filter(r => r.comment_id === c.id && r.emoji === em), mi = rs.some(r => r.user_id === S.me.id);
            return `<button class="${mi ? 'on' : ''} ${rs.length ? 'has' : ''}" title="${esc(rs.map(r => pname(r.user_id)).join(', '))}" onclick="react('${c.id}','${em}',${mi})">${em}${rs.length ? ' ' + rs.length : ''}</button>`; }).join('')}</div>
          </div></div>`; }).join('') || emptyState('message-square', 'Sin mensajes', '¡Escribe el primero!')}</div>
        <div id="typing" class="mut small" style="min-height:18px"></div>
        <div class="comp">
          ${S.reply ? (rc => rc ? `<div class="quote row">↩ Respondiendo a <b>${esc(pname(rc.user_id))}</b>: <span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(rc.body || '📷 Foto')}</span><button class="ico" onclick="S.reply=null;keep(renderModal)">${ic('x', 'sm')}</button></div>` : '')(S.comments.find(x => x.id === S.reply)) : ''}
          ${S.cdraft.length ? `<div class="thumbs" style="margin:0 0 8px">${S.cdraft.map((im, i) => `<div><img src="${im.url}" alt=""><button onclick="S.cdraft.splice(${i},1);keep(renderModal)" aria-label="Quitar foto">${ic('x', 'sm')}</button></div>`).join('')}</div>` : ''}
          <div id="mbox"></div>
          <textarea id="cbody" placeholder="Escribe un mensaje… Usa @ para mencionar. Los enlaces de Drive se adjuntan solos." oninput="mentionInput(this);sendTyping()" onpaste="pasteChatImages(event)"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();const f=$('#mbox button');f?f.onmousedown(event):sendComment()}"></textarea>
          ${S.qr ? quickRepliesHTML() : ''}
          <div class="r"><button class="ico ${S.qr ? 'on' : ''}" title="Respuestas rápidas" onclick="S.qr=!S.qr;keep(renderModal)">${ic('zap')}</button><label class="ico" style="margin:0" title="Adjuntar fotos (también puedes arrastrarlas o pegarlas)">${ic('image')}<input type="file" accept="image/*" multiple hidden onchange="addChatImages(this.files)"></label>
            <small class="mut hide-m">Enter enviar · Shift+Enter nueva línea · @ mencionar · arrastra o pega fotos</small><span class="grow"></span><button class="btn pri" ${S.busy ? 'disabled' : ''} onclick="sendComment()">${ic('send', 'sm')} ${S.busy ? 'Enviando…' : 'Enviar'}</button></div>
        </div>
      </div>
    </div></div>`;
}

function projectFormHTML(p){
  const c = p?.color || COLORS[S.projects.length % COLORS.length], own = isOwner(), adm = p ? adminsOf(p.id) : [];
  return `<div class="mod md"><div class="mh"><h3>${p ? 'Ajustes del proyecto' : 'Nuevo proyecto'}</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div>
    <div class="mb">
      <label>Nombre *</label><input id="p-name" value="${esc(p?.name)}" placeholder="Ej.: Proyecto de automatización">
      <label>Descripción</label><textarea id="p-desc" rows="3">${esc(p?.description)}</textarea>
      ${!p && S.projects.length ? `<label>Partir de una plantilla o proyecto <small>(copia columnas, tareas y subtareas, sin personas ni fechas)</small></label>
        <select id="p-from"><option value="">— Proyecto vacío —</option>${[...S.projects].sort((a, b) => b.is_template - a.is_template).map(x => `<option value="${x.id}">${x.is_template ? '[Plantilla] ' : ''}${esc(x.name)}</option>`).join('')}</select>` : ''}
      <div class="grid4" style="grid-template-columns:2fr 1fr">
        <div><label>Carpeta de Google Drive</label><input id="p-drive" value="${esc(p?.drive_url)}" placeholder="https://drive.google.com/drive/folders/…"></div>
        <div><label>Fecha de entrega</label><input id="p-due" type="date" value="${p?.due_date || ''}"></div>
      </div>
      <label>Emoji de portada <small>(sale junto al nombre y en la tarjeta de Inicio)</small></label>
      <div class="row" style="flex-wrap:wrap;gap:4px"><input id="p-emoji" value="${esc(p?.emoji || '')}" maxlength="8" style="width:70px;text-align:center;font-size:18px" placeholder="🙂">
        ${['🛴','⚡','🔌','💡','🏭','🔧','🤖','📡','🚦','🔋','🏗️','📐','🧪','📊','🎓','🛠️'].map(e => `<button type="button" class="ico" style="font-size:18px" onclick="$('#p-emoji').value='${e}'">${e}</button>`).join('')}</div>
      <label>Color</label><div class="pick">${COLORS.map(k => `<label class="${k === c ? 'on' : ''}" style="padding:3px"><input type="radio" name="pc" value="${k}" ${k === c ? 'checked' : ''} onchange="this.closest('.pick').querySelectorAll('label').forEach(l=>l.classList.toggle('on',l.contains(this)))"><span class="av" style="background:${k};margin:0"></span></label>`).join('')}</div>
      ${p ? `<label>Administradores de este proyecto <small>(pueden editar todo el proyecto y publicar en su diario)</small></label>
        ${own ? `<div class="pick">${members().filter(u => !u.is_admin).map(u => `<label class="${adm.includes(u.id) ? 'on' : ''}"><input type="checkbox" ${adm.includes(u.id) ? 'checked' : ''} onchange="toggleProjectAdmin('${p.id}','${u.id}',this.checked)">${av(u.id)}${esc(pname(u.id))}</label>`).join('') || '<span class="mut">No hay miembros todavía</span>'}</div>`
              : `<div class="pick">${adm.map(id => `<label class="on">${av(id)}${esc(pname(id))}</label>`).join('')}</div><p class="small mut">Solo el propietario puede nombrar o quitar admins.</p>`}` : ''}
      <label class="row" style="color:var(--txt);margin-top:16px"><input id="p-tpl" type="checkbox" style="width:auto" ${p?.is_template ? 'checked' : ''}> Es una plantilla (no aparece entre los proyectos; sirve para copiarla)</label>
      ${p ? `<label class="row" style="color:var(--txt)"><input id="p-arch" type="checkbox" style="width:auto" ${p.archived ? 'checked' : ''}> Archivado (trabajo ya entregado)</label>` : ''}
      <div class="row" style="margin-top:20px;flex-wrap:wrap">
        ${p ? `<button class="btn bad" onclick="delProject()">${ic('trash-2')} Eliminar</button><button class="btn" onclick="saveAsTemplate()">${ic('layers')} Guardar como plantilla</button>` : ''}
        <span class="grow"></span><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" onclick="saveProject(${!!p})">Guardar</button>
      </div>
    </div></div>`;
}

function membersHTML(){
  const pend = S.profiles.filter(p => !p.approved && !p.is_admin), mem = members();
  const projs = S.projects.filter(p => !p.is_template);
  const row = (p, right) => `<div class="mem">${av(p.id, 'l')}<div><b>${esc(p.full_name || '(sin nombre aún)')}</b> ${p.is_admin ? '<span class="badge own">Propietario</span>' : ''}<small>${esc(p.email)}</small>
    ${!p.is_admin && p.approved ? `<div class="row" style="flex-wrap:wrap;margin-top:6px;gap:4px">${S.padmins.filter(a => a.user_id === p.id).map(a => `<span class="chip acc">${ic('shield', 'sm')} ${esc(proj(a.project_id)?.name)}<button class="ico" style="padding:0" title="Quitar admin" onclick="toggleProjectAdmin('${a.project_id}','${p.id}',false)">${ic('x', 'sm')}</button></span>`).join('')}
      <select style="width:auto;padding:2px 6px;font-size:12px" onchange="this.value&&toggleProjectAdmin(this.value,'${p.id}',true)"><option value="">+ Admin de…</option>${projs.filter(x => !S.padmins.some(a => a.user_id === p.id && a.project_id === x.id)).map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div>` : ''}</div>${right}</div>`;
  return `<div class="mod md"><div class="mh"><h3>Miembros y permisos</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <div class="banner info">${ic('info')}<div><b>Propietario</b> (tú): todo. <b>Admin</b>: edita sus proyectos, crea proyectos y publica en el diario; no puede aceptar ni quitar miembros ni nombrar admins. <b>Miembro</b>: ve todo, comenta, añade subtareas y apunta horas.</div></div>
    <label>Solicitudes pendientes (${pend.length})</label>
    ${pend.map(p => row(p, `<button class="btn pri sm" onclick="approve('${p.id}',true)">Aprobar</button><button class="btn bad sm" onclick="reject('${p.id}')">Rechazar</button>`)).join('') || '<p class="mut small">No hay solicitudes. Pásales el enlace de la web y que entren con Google.</p>'}
    <label>Con acceso (${mem.length})</label>
    ${mem.map(p => row(p, p.is_admin ? '' : `<button class="btn bad sm" onclick="approve('${p.id}',false)">Quitar acceso</button>`)).join('')}
  </div></div>`;
}

function summaryHTML(){
  const { since, ev } = S.summary, c = a => ev.filter(e => e.action === a).length;
  const done = ev.filter(e => e.action === 'status_changed' && e.details?.to === 'completada').length;
  const stats = [['clipboard-list', c('task_created'), 'tareas nuevas'], ['message-square', c('comment'), 'mensajes'], ['circle-check', done, 'completadas'],
                 ['megaphone', c('post'), 'publicaciones'], ['eye', c('ready'), 'partes terminadas'], ['user-plus', c('assigned'), 'asignaciones']].filter(s => s[1]);
  return `<div class="mod sm"><div class="mh"><h3>Desde tu última visita</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <p class="mut">Cambios de tus compañeros desde el ${fmtT(since)}:</p>
    <div class="row" style="flex-wrap:wrap">${stats.map(s => `<span class="chip">${ic(s[0], 'sm')} <b style="color:var(--txt)">${s[1]}</b> ${s[2]}</span>`).join('')}</div>
    <div class="mini" style="margin-top:12px">${ev.slice(0, 12).map(a => `<div class="ev ${a.task_id || a.action === 'post' ? 'clk' : ''}" onclick="${a.task_id ? `closeModal();jump('${a.project_id}','${a.task_id}')` : a.action === 'post' ? `closeModal();goProject('${a.project_id}','diary')` : ''}">${av(a.actor_id)}
      <div><b>${esc(pname(a.actor_id))}</b> ${actText(a)} <small class="mut">· ${esc(proj(a.project_id)?.name || '')} · ${ago(a.created_at)}</small></div></div>`).join('')}
      ${ev.length > 12 ? `<p class="mut small">…y ${ev.length - 12} más en el Historial de cada proyecto.</p>` : ''}</div>
    <button class="btn pri" style="margin-top:14px;width:100%;justify-content:center" onclick="closeModal()">Entendido</button></div></div>`;
}
const NOTIF_GROUPS = [
  ['chat', 'Mensajes del chat', 'Comentarios y respuestas en tus tareas'], ['mention', 'Menciones', 'Cuando alguien te nombra con @'],
  ['assign', 'Asignaciones', 'Cuando te asignan o quitan una tarea'], ['changes', 'Cambios en tus tareas', 'Estado, fecha límite y tareas desbloqueadas'],
  ['diary', 'Diario', 'Publicaciones nuevas en los diarios'], ['review', 'Revisiones', 'Cuando alguien termina su parte (admins)'],
  ['deadlines', 'Plazos', 'Tareas que vencen hoy o mañana y entregas de proyecto'], ['email', 'Correo 3 días antes', 'Email a tu Gmail con las tareas que vencen en 3 días'],
  ['mailnow', 'Correo con avisos importantes', 'Asignaciones, cambios en tus tareas, menciones, diario, anuncios y exámenes que no hayas visto en la web'],
];
function profileHTML(){
  const me = S.me, st = me.avatar_style || 'google', off = me.notif_off || [];
  const opt = (k, label, html) => `<label class="avopt ${st === k ? 'on' : ''}"><input type="radio" name="avs" ${st === k ? 'checked' : ''} onchange="saveProfile({avatar_style:'${k}'})">${html}<span>${label}</span></label>`;
  return `<div class="mod md"><div class="mh"><h3>Editar perfil y avisos</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <label>Nombre y apellidos</label>
    <div class="row"><input id="pf-name" value="${esc(me.full_name)}"><button class="btn" onclick="saveName2()">Guardar</button></div>
    <label>Foto de perfil</label>
    <div class="row" style="flex-wrap:wrap;gap:10px">
      ${me.avatar_url ? opt('google', 'Foto de Google', `<img class="av xl" src="${esc(me.avatar_url)}" alt="" referrerpolicy="no-referrer">`) : ''}
      ${opt('photo', me.photo_url ? 'Mi foto' : 'Subir foto', me.photo_url ? `<img class="av xl" src="${esc(me.photo_url)}" alt="">` : `<span class="av xl" style="background:var(--panel2);color:var(--mut)">${ic('upload', 'lg')}</span>`)}
      ${opt('initials', 'Iniciales', `<span class="av xl" style="background:${esc(me.color || `hsl(${hue(me.id)} 55% 45%)`)}">${esc(pname(me.id).split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase())}</span>`)}
    </div>
    <div class="row" style="margin-top:10px;flex-wrap:wrap">
      <label class="btn" style="margin:0">${ic('upload')} ${me.photo_url ? 'Cambiar foto' : 'Subir foto'}<input type="file" accept="image/*" hidden onchange="uploadAvatar(this.files[0])"></label>
      ${me.photo_url ? `<button class="btn ghost bad" onclick="removeAvatar()">${ic('trash-2')} Quitar mi foto</button>` : ''}
      ${S.busy ? '<span class="mut small">Subiendo…</span>' : ''}
    </div>
    <label>Color (para las iniciales)</label>
    <div class="pick">${['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899','#a855f7','#84cc16','#f97316','#64748b'].map(k => `<label class="${me.color === k ? 'on' : ''}" style="padding:3px" title="${k}"><input type="radio" name="pfc" ${me.color === k ? 'checked' : ''} onchange="saveProfile({color:'${k}'})"><span class="av" style="background:${k};margin:0"></span></label>`).join('')}</div>
    <label>Avisos que quieres recibir</label>
    <div class="card-box" style="padding:4px 12px;box-shadow:none">${NOTIF_GROUPS.map(([k, n, d]) => { const mode = off.includes(k) ? 'off' : (me.notif_digest || []).includes(k) ? 'digest' : 'now';
      return `<div class="toggle"><span class="grow"><b>${n}</b><small>${d}</small></span><div class="seg">${(k === 'email' || k === 'mailnow' ? [['now', 'Sí'], ['off', 'No']] : [['now', 'Al momento'], ['digest', 'Resumen 19:00'], ['off', 'No']]).map(([v, l]) => `<button class="${mode === v ? 'on' : ''}" onclick="setNotifMode('${k}','${v}')">${l}</button>`).join('')}</div></div>`; }).join('')}</div>
    <p class="small mut">«Resumen 19:00»: esos avisos se guardan y te llegan todos juntos a las 19:00, con un aviso que los resume. Los de acceso y cambios de rol llegan siempre.</p>
    <label>Color principal de la web</label>
    <div class="row" style="flex-wrap:wrap;gap:8px">${Object.entries(ACCENTS).map(([k, [n, c]]) => `<button class="btn ${pref('accent', 'indigo') === k ? 'pri' : ''}" style="${pref('accent', 'indigo') === k ? `background:${c};border-color:${c}` : ''}" onclick="setPref('accent','${k}')"><span class="av" style="background:${c};margin:0;width:14px;height:14px;border:0"></span>${n}</button>`).join('')}</div>
    <label class="toggle" style="border:0"><span class="grow"><b>Alto contraste</b><small>Textos y bordes más marcados</small></span><input type="checkbox" ${pref('contrast', false) ? 'checked' : ''} onchange="setPref('contrast',this.checked)"><i></i></label>
    <label class="toggle" style="border:0;padding-top:0"><span class="grow"><b>Abrir tareas en panel lateral</b><small>Si lo desactivas, se abren en una ventana centrada</small></span><input type="checkbox" ${pref('drawer', true) ? 'checked' : ''} onchange="setPref('drawer',this.checked)"><i></i></label>
  </div></div>`;
}
async function saveProfile(patch){ Object.assign(S.me, patch); keep(renderModal); render(); await q(sb.from('profiles').update(patch).eq('id', S.me.id)); }
async function saveName2(){
  const v = $('#pf-name').value.trim();
  if (v.split(/\s+/).length < 2) return toast('Pon al menos nombre y un apellido', 'err');
  await saveProfile({ full_name: v }); toast('Nombre guardado');
}
function setNotifMode(k, mode){
  const off = new Set(S.me.notif_off || []), dig = new Set(S.me.notif_digest || []);
  off.delete(k); dig.delete(k); if (mode === 'off') off.add(k); if (mode === 'digest') dig.add(k);
  saveProfile({ notif_off: [...off], notif_digest: [...dig] });
}
const avatarPath = url => (url || '').split('/storage/v1/object/public/avatars/')[1];
async function uploadAvatar(file){
  if (!file) return;
  S.busy = true; keep(renderModal);
  try {
    const img = await createImageBitmap(file), side = Math.min(img.width, img.height);
    const c = document.createElement('canvas'); c.width = c.height = 400; // recorte cuadrado centrado
    c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 400, 400);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    const path = `${S.me.id}/${newId()}.jpg`;
    const { error } = await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    const old = avatarPath(S.me.photo_url);
    await saveProfile({ photo_url: sb.storage.from('avatars').getPublicUrl(path).data.publicUrl, avatar_style: 'photo' });
    if (old) sb.storage.from('avatars').remove([old]).then(() => {});
    toast('Foto actualizada');
  } catch (e) { toast('No se pudo subir la foto: ' + (e.message || e), 'err'); }
  S.busy = false; keep(renderModal);
}
async function removeAvatar(){
  const old = avatarPath(S.me.photo_url);
  await saveProfile({ photo_url: null, avatar_style: S.me.avatar_url ? 'google' : 'initials' });
  if (old) sb.storage.from('avatars').remove([old]).then(() => {});
}

function keysHTML(){
  const k = [['Ctrl+K', 'Menú de comandos: ir a cualquier sitio, abrir tareas, crear…'], ['Ctrl+Z', 'Deshacer el último cambio en tareas'], ['Clic derecho', 'Menú rápido de una tarjeta'], ['/', 'Buscar'], ['H', 'Inicio'], ['M', 'Mis tareas'], ['1 … 9', 'Pestañas del proyecto (Tablero, Lista, Cronograma, Calendario, Diario, Notas, Equipo, Estadísticas, Archivos)'],
             ['N', 'Nueva tarea en la primera columna (admins)'], ['← →', 'Tarea anterior / siguiente (con una tarea abierta)'], ['Esc', 'Cerrar']];
  return `<div class="mod sm"><div class="mh"><h3>Atajos de teclado</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    ${k.map(([a, b]) => `<div class="mem"><kbd>${a}</kbd><div>${b}</div></div>`).join('')}</div></div>`;
}

/* ============ teclado y clics globales ============ */
function navTask(d){ const list = boardOrder(), i = list.findIndex(t => t.id === S.tid), nx = list[i + d]; if (nx) openTask(nx.id); else toast(d > 0 ? 'Es la última tarea' : 'Es la primera tarea'); }
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); return S.pal ? closePalette() : openPalette(); }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !e.target.closest?.('input,textarea,select,[contenteditable]') && S.me) { e.preventDefault(); return undo(); }
  if (e.key === 'Escape' && closeCtx()) return;
  if (e.key === 'Escape' && document.body.classList.contains('present')) return presentMode(false);
  if (e.key === 'Escape') { if (document.querySelector('.lightbox')) return document.querySelector('.lightbox').remove(); if (S.pop || S.panel) { S.pop = null; S.panel = null; return render(); } if (S.modal) return closeModal(); closeSide(); }
  if (e.target.closest?.('input,textarea,select,[contenteditable]') || e.ctrlKey || e.metaKey || e.altKey || !S.me || (!S.me.approved && !S.me.is_admin)) return;
  if (e.key === '/') { e.preventDefault(); $('#sq')?.focus(); }

  else if (S.modal === 'task' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) navTask(e.key === 'ArrowRight' ? 1 : -1);
  else if (S.modal) return;
  else if (e.key.toLowerCase() === 'n' && adminOf() && proj()) { e.preventDefault(); (S.view === 'board' ? Promise.resolve() : go('board')).then(() => $('.addt input')?.focus()); }
  else if (e.key.toLowerCase() === 'm') go('mine');
  else if (e.key.toLowerCase() === 'h') go('home');
  else if ('123456789'.includes(e.key) && proj()) go(PVIEWS[+e.key - 1][0]);
});
document.addEventListener('click', e => {
  let re = false;
  if (S.panel && !e.target.closest('.np,.menu,.bell,header .ico,.search,.bottomnav,.more-wrap,.tools-wrap')) { S.panel = null; re = true; }
  if (S.pop && !e.target.closest('.pop,.qa')) { S.pop = null; re = true; }
  if (re) render();
});
function togglePanel(p){ S.panel = S.panel === p ? null : p; closeSide(); render(); }
