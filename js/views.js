'use strict';
// Planner SEA · vistas: Inicio, Perfil, Tablero, Cronograma, Calendario, Diario, Equipo, Lista, Notas, Estadísticas
/* ============ Inicio ============ */
function homeHTML(){
  const h = new Date().getHours(), hi = h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
  const open = S.mine.filter(t => t.status !== 'completada' && !proj(t.project_id)?.is_template && !proj(t.project_id)?.archived);
  const late = open.filter(t => t.due_date && daysLeft(t.due_date) < 0);
  const week = open.filter(t => t.due_date && daysLeft(t.due_date) >= 0 && daysLeft(t.due_date) <= 7);
  const soon = [...late, ...week, ...open.filter(t => !t.due_date || daysLeft(t.due_date) > 7)].slice(0, 8);
  const review = S.review.filter(t => adminOf(t.project_id));
  const act = S.projects.filter(p => !p.is_template && !p.archived);
  return `<div class="page">
    <h1>${hi}, ${esc(first(S.me.id))} 👋</h1>
    <p class="mut" style="margin:0">${cap(new Date().toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' }))}</p>
    ${favsHTML()}
    <div class="kpis">
      <div class="card-box kpi"><b>${open.length}</b><span>Tareas pendientes</span></div>
      <div class="card-box kpi"><b style="color:${late.length ? 'var(--bad-t)' : 'inherit'}">${late.length}</b><span>Vencidas</span></div>
      <div class="card-box kpi"><b>${week.length}</b><span>Vencen esta semana</span></div>
      <div class="card-box kpi"><b>${fmtMin(S.weekMin)}</b><span>Dedicadas esta semana</span></div>
    </div>
    <div class="hgrid">
      <div class="card-box"><h3>${ic('list-todo')} Tus próximas tareas <button class="btn ghost sm" style="margin-left:auto" onclick="go('mine')">Ver todas</button></h3>
        ${soon.map(mineRow).join('') || emptyState('party-popper', 'Todo al día', 'No tienes tareas pendientes.')}
        ${review.length ? `<div class="sect">Pendiente de revisar</div>${review.map(t => `<div class="mrow" onclick="jump('${t.project_id}','${t.id}')">${ic('eye')}<div class="t"><b>${esc(t.title)}</b><small class="mut">${esc(proj(t.project_id)?.name)}</small></div><span class="rev">Revisar</span></div>`).join('')}` : ''}
      </div>
      <div class="card-box">${(ms => ms.length ? `<h3>${ic('calendar-clock')} Próximas reuniones</h3>${ms.map(m => { const w = meetingWhen(m.meeting_at);
          return `<div class="mrow" onclick="goProject('${m.project_id}','diary')"><div class="meet-mini"><b>${w.time}</b><small>${w.rel}</small></div><div class="t"><b>${esc(proj(m.project_id)?.name || '')}</b><small class="mut">${esc(w.date)}${m.place ? ' · ' + esc(m.place) : ''}</small></div></div>`; }).join('')}<div style="height:12px"></div>` : '')(S.meetings.filter(m => new Date(m.meeting_at) > new Date()).slice(0, 3))}
        <h3>${ic('megaphone')} Último en los diarios</h3>
        ${S.recent.map(p => `<div class="pmini" onclick="goProject('${p.project_id}','diary')"><div class="row">${av(p.user_id)}<b class="small">${esc(pname(p.user_id))}</b><span class="small mut">· ${esc(proj(p.project_id)?.name)} · ${ago(p.created_at)}</span>${p.pinned ? ic('pin', 'sm') : ''}</div>
          <p>${esc(p.body || (p.poll_options ? '📊 Encuesta' : ''))}${p.images.length ? ` <span class="mut">· ${ic('image', 'sm')} ${p.images.length}</span>` : ''}</p></div>`).join('') || emptyState('megaphone', 'Sin publicaciones', 'Los admins publicarán aquí avisos y novedades.')}
      </div>
    </div>
    <div class="sect">Proyectos activos</div>
    <div class="pcards">${act.map(p => { const tot = p.tasks.length, d = p.tasks.filter(t => t.status === 'completada').length;
      return `<div class="card-box pcard" style="--c:${esc(p.color)}" onclick="goProject('${p.id}')"><div class="cover">${esc(p.emoji || '')}</div><h4>${esc(p.name)}</h4>
        <div class="bar"><i style="width:${tot ? d / tot * 100 : 0}%"></i></div>
        <div class="row small mut" style="margin-top:8px"><span>${tot ? Math.round(d / tot * 100) : 0}% · ${d}/${tot}</span><span class="grow"></span>${dueProjectChip(p)}</div>
        ${p.due_date && daysLeft(p.due_date) >= 0 ? `<div style="margin-top:8px">${riskChipLite(p)}</div>` : ''}
        <div class="avs" style="margin-top:10px;justify-content:flex-start;padding-left:6px">${adminsOf(p.id).map(id => av(id)).join('')}</div></div>`; }).join('') || `<div class="card-box">${emptyState('folder-kanban', 'No hay proyectos activos')}</div>`}</div>
  </div>`;
}
function mineRow(t){
  const p = proj(t.project_id), pr = PRIO[t.priority];
  return `<div class="mrow" style="--p:${pr[1]}" onclick="jump('${t.project_id}','${t.id}')"><span class="prio"></span>
    <div class="t"><b>${esc(t.title)}</b><small class="mut">${esc(p?.name)}</small> ${(t.labels || []).map(lblHTML).join(' ')}</div>
    ${t.status === 'en_curso' ? '<span class="st hide-m">En curso</span>' : ''}${t.review_requested ? `<span class="rev hide-m">${ic('eye', 'sm')} En revisión</span>` : ''}
    ${dueChip(t) || '<span class="chip">Sin fecha</span>'}</div>`;
}
function mineHTML(){
  const open = S.mine.filter(t => t.status !== 'completada' && !proj(t.project_id)?.is_template)
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const done = S.mine.filter(t => t.status === 'completada').length;
  const groups = [['Vencidas', t => t.due_date && daysLeft(t.due_date) < 0], ['Próximos 7 días', t => t.due_date && daysLeft(t.due_date) >= 0 && daysLeft(t.due_date) <= 7],
                  ['Más adelante', t => t.due_date && daysLeft(t.due_date) > 7], ['Sin fecha', t => !t.due_date]];
  return `<div class="page" style="max-width:900px"><h1>Mis tareas</h1>
    <div class="row"><span class="chip">${open.length} pendientes</span><span class="chip ok">${done} completadas</span></div>
    ${open.length ? groups.map(([n, f]) => { const l = open.filter(f); return l.length ? `<div class="sect">${n} (${l.length})</div><div class="card-box" style="padding:6px">${l.map(mineRow).join('')}</div>` : ''; }).join('')
      : emptyState('party-popper', 'No tienes tareas pendientes', '¡Buen trabajo!')}</div>`;
}

/* ============ Perfil ============ */
function personHTML(){
  const u = prof(S.uid), P = S.person; if (!u || !P) return '';
  const adm = isOwner() && u.id === S.me.id ? [] : S.padmins.filter(a => a.user_id === u.id).map(a => proj(a.project_id)).filter(Boolean);
  const open = P.tasks.filter(t => t.status !== 'completada'), done = P.tasks.length - open.length;
  const late = open.filter(t => t.due_date && daysLeft(t.due_date) < 0).length;
  return `<div class="page" style="max-width:900px">
    <div class="card-box prof" style="padding:20px">${av(u.id, 'xl')}<div class="grow"><h1>${esc(pname(u.id))}</h1><div class="mut">${esc(u.email)}</div>
      <div class="row" style="margin-top:8px;flex-wrap:wrap">${u.is_admin ? '<span class="badge own">Propietario</span>' : ''}${adm.map(p => `<span class="badge">Admin · ${esc(p.name)}</span>`).join('')}${!u.is_admin && !adm.length ? '<span class="chip">Miembro</span>' : ''}</div></div>
      <div class="row" style="flex-wrap:wrap">${u.id === S.me.id ? `<button class="btn" onclick="openModal('profile')">${ic('user-cog')} Editar perfil</button>` : ''}
        ${isOwner() ? `<button class="btn" onclick="exportPersonReport('${u.id}')" title="Solo lo ves tú">${ic('file-text')} Informe</button>` : ''}
        ${isOwner() && u.id !== S.me.id ? `<button class="btn" onclick="openModal('members')">${ic('shield')} Permisos</button>` : ''}</div></div>
    <div class="kpis">
      <div class="card-box kpi"><b>${P.tasks.length}</b><span>Tareas asignadas</span></div>
      <div class="card-box kpi"><b style="color:var(--ok-t)">${done}</b><span>Completadas</span></div>
      <div class="card-box kpi"><b>${fmtMin(P.minutes)}</b><span>Horas dedicadas</span></div>
      <div class="card-box kpi"><b>${P.msgs}</b><span>Mensajes en chats</span></div>
    </div>
    ${late ? `<div class="banner bad">${ic('triangle-alert')} Tiene ${late} tarea${late > 1 ? 's' : ''} vencida${late > 1 ? 's' : ''}.</div>` : ''}
    <div class="sect">Actividad en las últimas 20 semanas</div>
    <div class="card-box" style="padding:16px;overflow-x:auto">${heatGrid(P.act.map(a => a.created_at), 140)}</div>
    <div class="sect">Tareas pendientes (${open.length})</div>
    <div class="card-box" style="padding:6px">${open.sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999')).map(t => mineRow({ ...t, labels: [] })).join('') || emptyState('party-popper', 'Sin tareas pendientes')}</div>
  </div>`;
}

/* ============ Tablero ============ */
// Tareas de una columna tal y como se ven (filtros + orden). Lo usan el tablero, el arrastre y las flechas.
function colTasks(bid){
  const cmp = {
    manual: (x, y) => x.position - y.position,
    due: (x, y) => (x.due_date || '9999').localeCompare(y.due_date || '9999'),
    prio: (x, y) => PRANK[x.priority] - PRANK[y.priority],
    person: (x, y) => (x.task_assignees[0] ? pname(x.task_assignees[0].user_id) : '~').localeCompare(y.task_assignees[0] ? pname(y.task_assignees[0].user_id) : '~'),
    votes: (x, y) => votesOf(y.id).length - votesOf(x.id).length,
  }[S.sort] || ((x, y) => x.position - y.position);
  return S.tasks.filter(t => (t.bucket_id || null) === bid && !S.hidden.has(t.id)
      && (!S.onlyMine || t.task_assignees.some(a => a.user_id === S.me.id)) && (!S.label || (t.labels || []).includes(S.label)))
    .sort((x, y) => (x.status === 'completada') - (y.status === 'completada') || cmp(x, y) || x.position - y.position);
}
const visibleBuckets = () => S.buckets.filter(b => !S.hidden.has(b.id));
const boardOrder = () => [...visibleBuckets().map(b => b.id), null].flatMap(colTasks);
const depsOf = t => S.deps.filter(d => d.task_id === t.id).map(d => S.tasks.find(x => x.id === d.depends_on)).filter(Boolean);
const blockers = t => t.status === 'completada' ? [] : depsOf(t).filter(x => x.status !== 'completada');
const minutesOf = tid => S.tlogs.filter(l => l.task_id === tid).reduce((a, l) => a + l.minutes, 0);

function boardHTML(){
  const E = adminOf();
  const col = b => {
    const bid = b?.id || null, ts = colTasks(bid);
    if (!b && !ts.length) return '';
    const dnd = E && b ? `ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="dropOnCol(event,'${b.id}')"` : '';
    return `<section class="col" ${dnd}>
      <div class="colh" ${E && b ? `draggable="true" ondragstart="event.dataTransfer.setData('text/plain','col:${b.id}')" title="Arrastra para mover la columna" style="cursor:grab"` : ''}>
        <span>${esc(b ? b.name : 'Sin columna')}</span><span class="cnt">${ts.length}</span>
        ${E && b ? `<button class="ico" title="Renombrar" onclick="renameBucket('${b.id}')">${ic('pencil', 'sm')}</button><button class="ico" title="Eliminar columna" onclick="delBucket('${b.id}')">${ic('trash-2', 'sm')}</button>` : ''}</div>
      ${E && b ? `<div class="addt"><input id="nt-${b.id}" placeholder="+ Agregar tarea" title="Enter para crear · pega una lista para crear varias · Ej.: Planos @Ana viernes !urgente #Planos" oninput="nlHint(this)" onkeydown="if(event.key==='Enter')addTask('${b.id}',this)" onpaste="pasteTasks(event,'${b.id}')"></div>` : ''}
      <div class="cards">${ts.map(cardHTML).join('') || '<div class="empty">Sin tareas</div>'}</div>
    </section>`;
  };
  if (!S.buckets.length && !S.tasks.length) return `<div class="board">${E ? `<button class="addcol" onclick="addBucket()">${ic('plus')} Agregar columna</button>` : emptyState('square-kanban', 'Tablero vacío')}</div>`;
  return `<div class="board ${S.compact ? 'compact' : ''}">${visibleBuckets().map(col).join('')}${col(null)}
    ${E ? `<button class="addcol" onclick="addBucket()">${ic('plus')} Agregar columna</button>` : ''}</div>`;
}
function unreadOf(t){ const r = new Date(S.reads[t.id] || 0); return (t.comments || []).filter(c => c.user_id !== S.me.id && new Date(c.created_at) > r).length; }
function cardHTML(t){
  const p = PRIO[t.priority], done = t.status === 'completada', E = adminOf();
  const sd = t.subtasks.filter(s => s.done).length, cc = (t.comments || []).length, nu = unreadOf(t), bl = blockers(t).length, mins = minutesOf(t.id);
  const sel = S.selMode && E, on = S.sel.has(t.id), pop = S.pop?.tid === t.id ? S.pop.kind : null;
  const assigned = new Set(t.task_assignees.map(a => a.user_id));
  const fl = S.flash === t.id; if (fl) setTimeout(() => { S.flash = null; }, 700);
  return `<article class="card ${done ? 'done' : ''} ${on ? 'selected' : ''} ${fl ? 'flash' : ''}" style="--p:${p[1]}" draggable="${E && !sel}"
      ondragstart="event.dataTransfer.setData('text/plain','${t.id}')" ${E && S.sort === 'manual' ? `ondragover="event.preventDefault()" ondrop="dropOnCard(event,'${t.id}')"` : ''}
      onclick="${sel ? `toggleSel('${t.id}')` : E ? `cardClick('${t.id}')` : `openTask('${t.id}')`}" oncontextmenu="cardMenu(event,'${t.id}')"
      onmouseenter="hoverCard(event,'${t.id}')" onmouseleave="hoverOff()">
    ${sel ? `<input type="checkbox" class="selbox" ${on ? 'checked' : ''} aria-label="Seleccionar">` : E ? `<button class="chk ${done ? 'on' : ''}" title="${done ? 'Reabrir' : 'Marcar como completada'}" onclick="event.stopPropagation();quickDone('${t.id}')">${done ? ic('check') : ''}</button>` : ''}
    <div class="tags">${showField('prio') ? `<span class="prio">${p[0]}</span>` : ''}${t.status === 'en_curso' ? '<span class="st">En curso</span>' : ''}${bl ? `<span class="blk">${ic('lock', 'sm')} Bloqueada</span>` : ''}${t.review_requested && !done ? `<span class="rev">${ic('eye', 'sm')} Revisar</span>` : ''}${showField('labels') ? (t.labels || []).map(lblHTML).join('') : ''}</div>
    <div class="ttl" ${E && !sel ? `ondblclick="event.stopPropagation();clearTimeout(window._ct);inlineRename(this,'${t.id}')" title="Doble clic para renombrar"` : ''}>${esc(t.title)}</div>
    <div class="meta">${showField('votes') ? voteBtn(t) : ''}${showField('due') ? dueChip(t) : ''}${showField('subtasks') && t.subtasks.length ? `<span>${ic('square-check', 'sm')} ${sd}/${t.subtasks.length}</span>` : ''}${nu ? `<span class="chip warn">${ic('message-square', 'sm')} ${nu} nuevo${nu > 1 ? 's' : ''}</span>` : cc && showField('comments') ? `<span>${ic('message-square', 'sm')} ${cc}</span>` : ''}${showField('hours') && mins ? `<span>${ic('clock', 'sm')} ${fmtMin(mins)}</span>` : ''}${okUrl(t.drive_url) ? `<span>${ic('folder', 'sm')}</span>` : ''}
      ${showField('avatars') ? `<span class="avs">${t.task_assignees.map(a => av(a.user_id)).join('')}</span>` : ''}</div>
    ${E && !sel ? `<div class="qa" onclick="event.stopPropagation()">
      <button class="ico" title="Asignar" onclick="setPop('${t.id}','who')">${ic('user-plus', 'sm')}</button>
      <button class="ico" title="Fecha límite" onclick="setPop('${t.id}','date')">${ic('calendar', 'sm')}</button>
      <button class="ico" title="Cambiar prioridad" onclick="cyclePrio('${t.id}')">${ic('zap', 'sm')}</button></div>` : ''}
    ${pop ? `<div class="pop" onclick="event.stopPropagation()">${pop === 'who'
      ? members().map(u => `<label><input type="checkbox" ${assigned.has(u.id) ? 'checked' : ''} onchange="toggleAssignee('${u.id}',this.checked,'${t.id}')"> ${av(u.id)} ${esc(pname(u.id))}</label>`).join('')
      : `<input type="date" value="${t.due_date || ''}" onchange="q(sb.from('tasks').update({due_date:this.value||null}).eq('id','${t.id}'));S.pop=null">`}</div>` : ''}
  </article>`;
}
const votesOf = tid => S.tvotes.filter(v => v.task_id === tid);
function voteBtn(t){
  const vs = votesOf(t.id), mine = vs.some(v => v.user_id === S.me.id);
  return `<button class="vote ${mine ? 'on' : ''}" title="${vs.length ? esc(vs.map(v => pname(v.user_id)).join(', ')) : 'Votar como prioritaria'}" onclick="event.stopPropagation();voteTask('${t.id}',${mine})">${ic('chevron-up', 'sm')}${vs.length || ''}</button>`;
}
async function voteTask(tid, had){
  if (had) S.tvotes = S.tvotes.filter(v => !(v.task_id === tid && v.user_id === S.me.id)); else S.tvotes.push({ task_id: tid, user_id: S.me.id });
  render();
  if (had) await q(sb.from('task_votes').delete().match({ task_id: tid, user_id: S.me.id })); else await q(sb.from('task_votes').insert({ task_id: tid }));
}
// Los admins pueden renombrar con doble clic: el clic simple espera un instante para no abrir la tarea antes
function cardClick(id){ clearTimeout(window._ct); window._ct = setTimeout(() => openTask(id), 240); }
function inlineRename(el, tid){
  const t = S.tasks.find(x => x.id === tid), inp = document.createElement('input');
  inp.value = t.title; inp.className = 'inline-edit'; el.replaceWith(inp); inp.focus(); inp.select();
  let done = false;
  const finish = async save => { if (done) return; done = true; const v = inp.value.trim();
    if (save && v && v !== t.title) { t.title = v; render(); await q(sb.from('tasks').update({ title: v }).eq('id', tid)); } else render(); };
  inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); };
  inp.onblur = () => finish(true); inp.onclick = e => e.stopPropagation();
}

function bulkBarHTML(){
  return `<div class="bulk"><b>${S.sel.size} seleccionadas</b>
    <select onchange="bulk('assign',this.value)"><option value="">Asignar a…</option>${members().map(p => `<option value="${p.id}">${esc(pname(p.id))}</option>`).join('')}</select>
    <input type="date" title="Fecha límite" onchange="bulk('patch',{due_date:this.value||null})">
    <select onchange="this.value&&bulk('patch',{status:this.value})"><option value="">Estado…</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <select onchange="this.value&&bulk('patch',{priority:this.value})"><option value="">Prioridad…</option>${Object.entries(PRIO).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select>
    <select onchange="this.value&&bulk('patch',{bucket_id:this.value})"><option value="">Mover a…</option>${S.buckets.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select>
    <button class="btn bad" onclick="bulk('delete')">${ic('trash-2')} Eliminar</button>
    <button class="btn ghost" onclick="S.sel.clear();render()">Quitar selección</button></div>`;
}

/* ============ Cronograma ============ */
function ganttHTML(){
  const p = proj(), ts = S.tasks.filter(t => !S.hidden.has(t.id));
  const dated = ts.filter(t => t.start_date || t.due_date).sort((a, b) => (a.start_date || a.due_date).localeCompare(b.start_date || b.due_date));
  const undated = ts.filter(t => !t.start_date && !t.due_date);
  if (!dated.length) return emptyState('gantt-chart', 'Sin fechas todavía', 'Pon fecha de inicio y fecha límite a las tareas para verlas en el cronograma.');
  const all = [...dated.flatMap(t => [t.start_date, t.due_date]), p.due_date, today()].filter(Boolean).sort();
  const min = addDays(all[0], -2), max = addDays(all[all.length - 1], 3), n = Math.min(dayDiff(min, max) + 1, 180), W = 30;
  const days = Array.from({ length: n }, (_, i) => addDays(min, i));
  const x = d => dayDiff(min, d) * W;
  const lines = `<div class="gline today" style="left:${x(today()) + W / 2}px" title="Hoy"></div>${p.due_date ? `<div class="gline due" style="left:${x(p.due_date) + W / 2}px" title="Entrega"></div>` : ''}`;
  const row = t => {
    const s = t.start_date || t.due_date, e = t.due_date || t.start_date, pt = !t.start_date;
    const bl = blockers(t).length, pr = PRIO[t.priority][1];
    return `<div class="nm" title="${esc(t.title)}"><span class="prio" style="--p:${pr}"></span><span>${esc(t.title)}</span>${bl ? ic('lock', 'sm') : ''}</div>
      <div class="days" style="width:${n * W}px">${lines}
        <div class="gbar ${t.status === 'completada' ? 'done' : ''} ${pt ? 'pt' : ''}" style="--p:${pr};left:${x(s) + (pt ? W / 2 : 2)}px;width:${pt ? 14 : (dayDiff(s, e) + 1) * W - 4}px" ${adminOf() ? `onpointerdown="ganttDown(event,'${t.id}',${W})"` : `onclick="openTask('${t.id}')"`} title="${esc(t.title)} · ${fmtD(s)}${pt ? '' : ' → ' + fmtD(e)}${adminOf() ? ' · arrastra para mover, estira el borde derecho para alargar' : ''}">${pt ? '' : esc(t.title)}</div></div>`;
  };
  return `<div class="gantt">
    <p class="small mut" style="margin-top:0">${ic('info', 'sm')} Barra = de la fecha de inicio a la fecha límite · rombo = solo fecha límite · <span style="color:var(--acc2)">línea azul</span> = hoy · <span style="color:var(--bad-t)">línea roja</span> = entrega del proyecto.</p>
    <div class="gt" style="grid-template-columns:260px ${n * W}px">
      <div class="nm hd"><b>Tarea</b></div>
      <div class="hd"><div class="dayh">${days.map(d => { const dt = new Date(d + 'T00:00'), we = dt.getDay() % 6 === 0;
        return `<div class="${we ? 'we' : ''} ${dt.getDate() === 1 || d === min ? 'mo' : ''}" style="width:${W}px">${dt.getDate() === 1 || d === min ? dt.toLocaleDateString('es-ES', { month:'short' }) : '&nbsp;'}<span>${dt.getDate()}</span></div>`; }).join('')}</div></div>
      ${dated.map(row).join('')}
    </div>
    ${undated.length ? `<p class="small mut">${undated.length} tarea${undated.length > 1 ? 's' : ''} sin fechas no aparece${undated.length > 1 ? 'n' : ''}: ${undated.slice(0, 6).map(t => `<a href="#" onclick="event.preventDefault();openTask('${t.id}')">${esc(t.title)}</a>`).join(', ')}${undated.length > 6 ? '…' : ''}</p>` : ''}
  </div>`;
}

/* ============ Calendario ============ */
function calHTML(){
  const p = proj(), base = S.cal || new Date(), y = base.getFullYear(), m = base.getMonth();
  const first = new Date(y, m, 1), start = new Date(y, m, 1 - (first.getDay() + 6) % 7); // la semana empieza en lunes
  const td = today();
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i); const k = isoOf(d);
    const ts = S.tasks.filter(t => t.due_date === k && !S.hidden.has(t.id));
    cells += `<div class="dc ${d.getMonth() !== m ? 'out' : ''} ${k === td ? 'today' : ''} ${k === p.due_date ? 'due' : ''}" ${adminOf() ? `ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="calDrop(event,'${k}')"` : ''}>
      <div class="dn">${d.getDate()}${k === p.due_date ? ` · <b style="color:var(--bad-t)">Entrega</b>` : ''}</div>
      ${ts.map(t => `<button class="ct ${t.status === 'completada' ? 'done' : ''}" style="--p:${PRIO[t.priority][1]}" title="${esc(t.title)}${adminOf() ? ' · arrastra para cambiar la fecha' : ''}" onclick="openTask('${t.id}')" ${adminOf() ? `draggable="true" ondragstart="event.dataTransfer.setData('text/plain','${t.id}')"` : ''}>${esc(t.title)}</button>`).join('')}</div>`;
  }
  const mv = k => `S.cal=new Date(${y},${m + k},1);render()`;
  return `<div class="page" style="max-width:none"><div class="row" style="margin-bottom:12px">
      <button class="btn" onclick="${mv(-1)}" aria-label="Mes anterior">${ic('chevron-left')}</button><button class="btn" onclick="S.cal=null;render()">Hoy</button><button class="btn" onclick="${mv(1)}" aria-label="Mes siguiente">${ic('chevron-right')}</button>
      <h3 style="margin:0 0 0 8px">${cap(first.toLocaleDateString('es-ES', { month:'long', year:'numeric' }))}</h3></div>
    <div class="cal">${['lun','mar','mié','jue','vie','sáb','dom'].map(d => `<div class="dh">${d}</div>`).join('')}${cells}</div></div>`;
}

/* ============ Diario ============ */
const canManagePost = p => isOwner() || (p.user_id === S.me.id && adminOf(p.project_id));
function diaryHTML(){
  const E = adminOf(), D = S.draft;
  const posts = [...S.posts].sort((a, b) => b.pinned - a.pinned || b.created_at.localeCompare(a.created_at));
  return `<div class="diary">
    ${E ? `<div class="card-box composer">
      <div class="row" style="margin-bottom:8px">${av(S.me.id, 'l')}<b>Nueva publicación</b><span class="small mut">· la verán todos y recibirán un aviso</span></div>
      ${D.meeting ? `<div class="grid4" style="grid-template-columns:1fr 1fr 2fr;margin-bottom:8px"><div><label>Día</label><input type="date" value="${D.meeting.date}" oninput="S.draft.meeting.date=this.value"></div>
        <div><label>Hora</label><input type="time" value="${D.meeting.time}" oninput="S.draft.meeting.time=this.value"></div><div><label>Lugar</label><input value="${esc(D.meeting.place)}" placeholder="Taller, aula 12, Meet…" oninput="S.draft.meeting.place=this.value"></div></div>` : ''}
      <textarea id="pbody" placeholder="${D.meeting ? 'Orden del día (uno por línea: - Revisar planos…)' : 'Escribe un aviso, una novedad o un resumen de la reunión…'}" oninput="S.draft.body=this.value">${esc(D.body)}</textarea>
      ${D.images.length ? `<div class="thumbs">${D.images.map((im, i) => `<div><img src="${im.url}" alt=""><button onclick="S.draft.images.splice(${i},1);render()" aria-label="Quitar foto">${ic('x', 'sm')}</button></div>`).join('')}</div>` : ''}
      ${D.poll ? `<div class="poll">${D.poll.map((o, i) => `<div class="row"><input id="po-${i}" value="${esc(o)}" placeholder="Opción ${i + 1}" oninput="S.draft.poll[${i}]=this.value">${D.poll.length > 2 ? `<button class="ico" onclick="S.draft.poll.splice(${i},1);render()">${ic('x', 'sm')}</button>` : ''}</div>`).join('')}
        <div class="row">${D.poll.length < 10 ? `<button class="btn sm ghost" onclick="S.draft.poll.push('');render()">${ic('plus', 'sm')} Opción</button>` : ''}<button class="btn sm ghost" onclick="S.draft.poll=null;render()">Quitar encuesta</button></div></div>` : ''}
      <div class="row" style="margin-top:10px">
        <label class="btn ghost" style="margin:0;color:var(--txt2)">${ic('image')} Fotos<input type="file" accept="image/*" multiple hidden onchange="addImages(this.files)"></label>
        ${D.poll || D.meeting ? '' : `<button class="btn ghost" onclick="S.draft.poll=['','']; render()">${ic('chart-bar')} Encuesta</button>`}
        <button class="btn ghost ${D.meeting ? 'on' : ''}" onclick="S.draft.meeting=S.draft.meeting?null:{date:addDays(today(),1),time:'17:00',place:''};S.draft.poll=null;render()">${ic('calendar-clock')} ${D.meeting ? 'Quitar reunión' : 'Convocar reunión'}</button>
        <span class="grow"></span>
        <button class="btn pri" ${S.busy ? 'disabled' : ''} onclick="publishPost()">${ic('send')} ${S.busy ? 'Publicando…' : D.meeting ? 'Convocar' : 'Publicar'}</button>
      </div></div>` : `<div class="banner info">${ic('info')} Solo los admins de este proyecto pueden publicar. Tú puedes leer, reaccionar y votar en las encuestas.</div>`}
    ${posts.map(postHTML).join('') || `<div class="card-box post">${emptyState('megaphone', 'El diario está vacío', E ? 'Publica el primer aviso.' : 'Aquí aparecerán los avisos de los admins.')}</div>`}
  </div>`;
}
function postHTML(p){
  const imgs = p.images.map(x => imgUrl('diario', x)).filter(Boolean), M = canManagePost(p);
  const votes = S.votes.filter(v => v.post_id === p.id), mine = votes.find(v => v.user_id === S.me.id);
  return `<article class="card-box post ${p.pinned ? 'pin' : ''}">
    <div class="hd">${av(p.user_id, 'l')}<div class="grow"><div class="row" style="gap:6px"><b>${esc(pname(p.user_id))}</b>${roleBadge(p.user_id, p.project_id)}</div>
      <small class="mut">${fmtT(p.created_at)}${p.edited_at ? ' · editado' : ''}</small></div>
      ${p.kind === 'meeting' ? `<span class="chip acc">${ic('calendar-clock', 'sm')} Reunión</span>` : ''}${p.pinned ? `<span class="chip warn">${ic('pin', 'sm')} Fijado</span>` : ''}
      ${M ? `<button class="ico" title="${p.pinned ? 'Desfijar' : 'Fijar arriba'}" onclick="q(sb.from('posts').update({pinned:${!p.pinned}}).eq('id','${p.id}'))">${ic(p.pinned ? 'pin-off' : 'pin')}</button>
        <button class="ico" title="Editar" onclick="editPost('${p.id}')">${ic('pencil')}</button>
        <button class="ico" title="Eliminar" onclick="delPost('${p.id}')">${ic('trash-2')}</button>` : ''}</div>
    ${p.kind === 'meeting' ? meetingHTML(p) : p.body ? `<div class="body">${linkify(p.body)}</div>` : ''}
    ${imgs.length ? `<div class="gallery" style="--n:${Math.min(imgs.length, 3)}">${imgs.map(u => `<img src="${esc(u)}" alt="Foto del diario" loading="lazy" onclick="lightbox(this.src)">`).join('')}</div>` : p.images.length ? `<p class="small mut">${ic('image', 'sm')} Cargando fotos…</p>` : ''}
    ${p.poll_options ? `<div class="poll">${p.poll_options.map((o, i) => { const c = votes.filter(v => v.option === i), pct = votes.length ? Math.round(c.length / votes.length * 100) : 0;
      return `<button class="opt ${mine?.option === i ? 'mine' : ''}" onclick="vote('${p.id}',${i})" title="${esc(c.map(v => pname(v.user_id)).join(', ') || 'Sin votos')}">
        <span class="fill" style="width:${mine ? pct : 0}%"></span>${mine?.option === i ? ic('circle-check', 'sm') : ic('circle', 'sm')}<span>${esc(o)}</span>${mine ? `<span class="pct">${pct}% · ${c.length}</span>` : ''}</button>`; }).join('')}
      <small class="mut">${votes.length} voto${votes.length === 1 ? '' : 's'}${mine ? ' · pulsa tu opción para quitar el voto' : ' · vota para ver los resultados'}</small></div>` : ''}
    <div class="reacts">${REACT_POST.map(em => { const rs = S.preacts.filter(r => r.post_id === p.id && r.emoji === em), me = rs.some(r => r.user_id === S.me.id);
      return `<button class="${me ? 'on' : ''} ${rs.length ? 'has' : ''}" title="${esc(rs.map(r => pname(r.user_id)).join(', '))}" onclick="reactPost('${p.id}','${em}',${me})">${em}${rs.length ? ' ' + rs.length : ''}</button>`; }).join('')}</div>
  </article>`;
}
function lightbox(src){ const d = document.createElement('div'); d.className = 'lightbox'; d.innerHTML = `<img src="${esc(src)}" alt="">`; d.onclick = () => d.remove(); document.body.append(d); }
// Comprime en el navegador (máx. 1600 px, JPEG) para ahorrar espacio del plan gratuito
async function compress(file){
  const img = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
}
async function addImages(files){
  for (const f of [...files]) {
    if (S.draft.images.length >= 6) { toast('Máximo 6 fotos por publicación', 'err'); break; }
    try { const blob = await compress(f); S.draft.images.push({ blob, url: URL.createObjectURL(blob) }); }
    catch { toast(`No se pudo leer «${f.name}». Prueba con JPG o PNG.`, 'err'); }
  }
  render();
}
async function publishPost(){
  const D = S.draft, body = D.body.trim(), poll = D.poll?.map(s => s.trim()).filter(Boolean) || null;
  if (D.poll && poll.length < 2) return toast('La encuesta necesita al menos 2 opciones', 'err');
  if (D.meeting && !(D.meeting.date && D.meeting.time)) return toast('Pon el día y la hora de la reunión', 'err');
  if (!body && !D.images.length && !poll && !D.meeting) return toast('Escribe algo, añade fotos o una encuesta', 'err');
  S.busy = true; render();
  try {
    const paths = [];
    for (const im of D.images) {
      const path = `${S.pid}/${newId()}.jpg`;
      const { error } = await sb.storage.from('diario').upload(path, im.blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      paths.push(path);
    }
    const meet = D.meeting ? { kind: 'meeting', meeting_at: new Date(`${D.meeting.date}T${D.meeting.time}`).toISOString(), place: D.meeting.place.trim() || null } : {};
    await q(sb.from('posts').insert({ project_id: S.pid, body, images: paths, poll_options: poll, ...meet }));
    D.images.forEach(im => URL.revokeObjectURL(im.url));
    if (D.meeting) track('f:meeting');
    S.draft = { body:'', images:[], poll:null, meeting:null }; toast(meet.kind ? 'Reunión convocada: todos recibirán un aviso' : 'Publicado en el diario');
  } catch (e) { toast('No se pudo publicar: ' + (e.message || e), 'err'); }
  S.busy = false; render();
}
async function editPost(id){
  const p = S.posts.find(x => x.id === id), v = prompt('Edita la publicación:', p.body);
  if (v == null || v.trim() === p.body) return;
  if (!v.trim() && !p.images.length && !p.poll_options) return toast('La publicación no puede quedar vacía', 'err');
  await q(sb.from('posts').update({ body: v.trim() }).eq('id', id));
}
async function delPost(id){
  const p = S.posts.find(x => x.id === id);
  if (!confirm('¿Eliminar esta publicación del diario?')) return;
  await q(sb.from('posts').delete().eq('id', id));
  if (p.images.length) sb.storage.from('diario').remove(p.images).then(() => {});
}
async function vote(pid, i){
  const mine = S.votes.find(v => v.post_id === pid && v.user_id === S.me.id);
  if (mine?.option === i) await q(sb.from('post_votes').delete().match({ post_id: pid, user_id: S.me.id }));
  else await q(sb.from('post_votes').upsert({ post_id: pid, user_id: S.me.id, option: i }, { onConflict: 'post_id,user_id' }));
}
async function reactPost(pid, emoji, had){
  if (had) await q(sb.from('post_reactions').delete().match({ post_id: pid, user_id: S.me.id, emoji }));
  else await q(sb.from('post_reactions').insert({ post_id: pid, emoji }));
}

/* ============ Equipo, Archivos, Historial ============ */
function workload(){
  return members().map(u => {
    const ts = S.tasks.filter(t => t.task_assignees.some(a => a.user_id === u.id));
    const done = ts.filter(t => t.status === 'completada').length;
    const late = ts.filter(t => t.status !== 'completada' && t.due_date && daysLeft(t.due_date) < 0).length;
    const mins = S.tlogs.filter(l => l.user_id === u.id).reduce((a, l) => a + l.minutes, 0);
    const msgs = S.tasks.reduce((a, t) => a + (t.comments || []).filter(c => c.user_id === u.id).length, 0);
    return { u, total: ts.length, done, late, open: ts.length - done - late, mins, msgs };
  }).sort((a, b) => (b.open + b.late) - (a.open + a.late) || b.total - a.total);
}
function teamHTML(){
  const w = workload(), max = Math.max(1, ...w.map(x => x.total)), free = S.tasks.filter(t => !t.task_assignees.length && t.status !== 'completada').length;
  const adm = adminsOf(S.pid);
  return `<div class="page">
    <div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:6px"><b class="small">Admins del proyecto:</b>
      ${S.profiles.filter(p => p.is_admin).map(p => `<span class="chip">${av(p.id)} ${esc(pname(p.id))} <span class="badge own">Propietario</span></span>`).join('')}
      ${adm.map(id => `<span class="chip">${av(id)} ${esc(pname(id))} <span class="badge">Admin</span></span>`).join('')}
      ${isOwner() ? `<button class="btn sm ghost" onclick="openModal('project-edit')">${ic('shield', 'sm')} Gestionar</button>` : ''}</div>
    <p class="small mut"><span style="color:var(--ok)">■</span> completadas · <span style="color:var(--acc)">■</span> pendientes · <span style="color:var(--bad)">■</span> vencidas
      ${free ? ` · <b class="rev">${free} tareas pendientes sin asignar</b>` : ''} · Pulsa una persona para ver su perfil.</p>
    <div class="card-box" style="padding:6px 12px">${w.map(x => `<div class="wl" onclick="go('person',{uid:'${x.u.id}'})"><div class="row">${av(x.u.id, 'l')}<b>${esc(pname(x.u.id))}</b>${roleBadge(x.u.id, S.pid)}</div>
      <div class="bars" style="width:${x.total / max * 100}%;min-width:4px">${x.done ? `<i style="width:${x.done / x.total * 100}%;background:var(--ok)"></i>` : ''}${x.open ? `<i style="width:${x.open / x.total * 100}%;background:var(--acc)"></i>` : ''}${x.late ? `<i style="width:${x.late / x.total * 100}%;background:var(--bad)"></i>` : ''}</div>
      <small class="mut">${x.done}/${x.total} hechas · ${fmtMin(x.mins)} · ${x.msgs} msj${x.late ? ` · <span style="color:var(--bad-t)">${x.late} vencidas</span>` : ''}</small></div>`).join('')}</div></div>`;
}
function filesHTML(){
  const p = proj(), id = folderId(p.drive_url);
  if (!id) return emptyState('folder', 'Sin carpeta de Drive', adminOf() ? 'Pega el enlace de una carpeta en «Ajustes» para ver aquí sus archivos.' : 'Este proyecto aún no tiene carpeta de Drive.');
  return `<div class="page" style="max-width:none;display:flex;flex-direction:column">
    <p class="small mut" style="margin-top:0">Si no ves los archivos, la carpeta debe estar compartida como «Cualquier persona con el enlace». Para subir archivos: <a href="${esc(p.drive_url)}" target="_blank" rel="noopener">abrir en Drive</a>.</p>
    <iframe src="https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(id)}#list" style="flex:1;min-height:65vh;border:1px solid var(--line);border-radius:12px;background:#fff" title="Archivos de Drive"></iframe></div>`;
}
function actText(a){
  const d = a.details || {}, t = a.task_title ? `«${esc(a.task_title)}»` : '';
  switch (a.action) {
    case 'task_created': return `creó la tarea ${t}`;
    case 'task_deleted': return `eliminó definitivamente la tarea ${t}`;
    case 'task_trashed': return `envió a la papelera la tarea ${t}`;
    case 'task_restored': return `restauró de la papelera la tarea ${t}`;
    case 'title_changed': return `renombró «${esc(d.from)}» a «${esc(d.to)}»`;
    case 'status_changed': return `cambió ${t} de ${STATUS[d.from]} a <b>${STATUS[d.to]}</b>`;
    case 'priority_changed': return `cambió la prioridad de ${t} a <b>${PRIO[d.to]?.[0]}</b>`;
    case 'due_changed': return d.to ? `puso la fecha límite de ${t} en <b>${fmtD(d.to)}</b>` : `quitó la fecha límite de ${t}`;
    case 'bucket_changed': return `movió ${t} a <b>${esc(d.to || 'Sin columna')}</b>`;
    case 'description_changed': return `editó la descripción de ${t}`;
    case 'drive_changed': return `cambió el enlace de Drive de ${t}`;
    case 'assigned': return `asignó ${t} a <b>${esc(d.name)}</b>`;
    case 'unassigned': return `quitó a <b>${esc(d.name)}</b> de ${t}`;
    case 'subtask_added': return `añadió la subtarea «${esc(d.title)}» a ${t}`;
    case 'subtask_done': return `completó la subtarea «${esc(d.title)}» de ${t}`;
    case 'subtask_undone': return `reabrió la subtarea «${esc(d.title)}» de ${t}`;
    case 'subtask_deleted': return `eliminó la subtarea «${esc(d.title)}» de ${t}`;
    case 'subtask_renamed': return `renombró una subtarea de ${t}`;
    case 'comment': return `comentó en ${t}${d.preview ? `: <i>${esc(d.preview)}</i>` : ''}`;
    case 'ready': return `ha terminado su parte de ${t} y pide revisión`;
    case 'project_created': return `creó el proyecto <b>${esc(d.name)}</b>`;
    case 'project_updated': return `actualizó los datos del proyecto`;
    case 'notice': case 'post': return `publicó en el diario${d.poll ? ' una encuesta' : ''}${d.preview || d.text ? `: <i>${esc(d.preview || d.text)}</i>` : ''}`;
    case 'admin_added': return `nombró admin del proyecto a <b>${esc(d.name)}</b>`;
    case 'admin_removed': return `quitó a <b>${esc(d.name)}</b> como admin del proyecto`;
    case 'time_logged': return `apuntó <b>${fmtMin(d.minutes)}</b> en ${t}${d.note ? ` (${esc(d.note)})` : ''}`;
    default: return esc(a.action);
  }
}
function histHTML(list, byDay){
  if (!list.length) return emptyState('history', 'Sin actividad todavía');
  let last = '';
  return list.map(a => {
    const day = new Date(a.created_at).toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });
    const head = byDay && day !== last ? `<div class="day">${(last = day)}</div>` : '';
    const clk = byDay && a.task_id && S.tasks.some(t => t.id === a.task_id);
    return `${head}<div class="ev ${clk ? 'clk' : ''}" ${clk ? `onclick="openTask('${a.task_id}')"` : ''}>${av(a.actor_id)}
      <div><b>${esc(pname(a.actor_id))}</b> ${actText(a)}<time>${byDay ? new Date(a.created_at).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }) : ago(a.created_at)}</time></div></div>`;
  }).join('');
}

/* ============ Vista Lista ============ */
const LIST_COLS = [
  ['title', 'Tarea', t => t.title.toLowerCase()], ['bucket', 'Columna', t => S.buckets.find(b => b.id === t.bucket_id)?.position ?? 1e15],
  ['status', 'Estado', t => ['no_iniciada', 'en_curso', 'completada'].indexOf(t.status)], ['prio', 'Prioridad', t => PRANK[t.priority]],
  ['who', 'Responsables', t => t.task_assignees[0] ? pname(t.task_assignees[0].user_id) : '~'], ['start', 'Inicio', t => t.start_date || '9999'],
  ['due', 'Fecha límite', t => t.due_date || '9999'], ['hours', 'Horas', t => minutesOf(t.id)], ['subs', 'Subtareas', t => t.subtasks.length ? t.subtasks.filter(s => s.done).length / t.subtasks.length : -1],
  ['votes', 'Votos', t => votesOf(t.id).length],
];
function listHTML(){
  const E = adminOf(), { k, d } = S.listSort, col = LIST_COLS.find(c => c[0] === k), qq = norm(S.listQ);
  const rows = S.tasks.filter(t => !S.hidden.has(t.id) && (!qq || norm(t.title + ' ' + (t.labels || []).join(' ')).includes(qq)))
    .sort((a, b) => { const x = col[2](a), y = col[2](b); return (x < y ? -1 : x > y ? 1 : 0) * d || a.position - b.position; });
  const sel = (t, field, obj) => E ? `<select class="cellsel" onclick="event.stopPropagation()" onchange="q(sb.from('tasks').update({${field}:this.value}).eq('id','${t.id}'))">${Object.entries(obj).map(([v, n]) => `<option value="${v}" ${t[field] === v ? 'selected' : ''}>${Array.isArray(n) ? n[0] : n}</option>`).join('')}</select>` : null;
  return `<div class="page" style="max-width:none">
    <div class="row" style="margin-bottom:10px"><div class="search" style="flex:0 1 320px">${ic('search')}<input id="lq" placeholder="Filtrar por nombre o etiqueta…" value="${esc(S.listQ)}" oninput="S.listQ=this.value;keep(render)"></div>
      <span class="mut small">${rows.length} de ${S.tasks.length} tareas · pulsa una cabecera para ordenar</span></div>
    <div class="card-box tablewrap"><table class="ltable"><thead><tr>${LIST_COLS.map(([key, name]) => `<th onclick="S.listSort={k:'${key}',d:${k === key ? -d : 1}};render()" class="${k === key ? 'on' : ''}">${name}${k === key ? (d > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(t => { const p = PRIO[t.priority], m = minutesOf(t.id), bl = blockers(t).length;
      return `<tr class="${t.status === 'completada' ? 'done' : ''}" onclick="openTask('${t.id}')">
        <td style="--p:${p[1]}"><div class="row" style="gap:6px"><span class="prio"></span><b>${esc(t.title)}</b>${bl ? ic('lock', 'sm') : ''}${t.review_requested ? ic('eye', 'sm') : ''}</div>${(t.labels || []).length ? `<div class="tags" style="margin-top:4px">${t.labels.map(lblHTML).join('')}</div>` : ''}</td>
        <td>${esc(S.buckets.find(b => b.id === t.bucket_id)?.name || '—')}</td>
        <td>${sel(t, 'status', STATUS) || STATUS[t.status]}</td><td>${sel(t, 'priority', PRIO) || p[0]}</td>
        <td><div class="avs" style="margin:0;justify-content:flex-start">${t.task_assignees.map(a => av(a.user_id)).join('') || '<span class="mut">—</span>'}</div></td>
        <td>${t.start_date ? fmtD(t.start_date) : '—'}</td><td>${dueChip(t) || '—'}</td><td>${m ? fmtMin(m) : '—'}</td>
        <td>${t.subtasks.length ? `${t.subtasks.filter(s => s.done).length}/${t.subtasks.length}` : '—'}</td><td>${voteBtn(t)}</td></tr>`; }).join('') || `<tr><td colspan="10">${emptyState('list', 'Sin tareas')}</td></tr>`}</tbody></table></div></div>`;
}

/* ============ Notas (wiki) ============ */
// Markdown sencillo: # títulos, **negrita**, *cursiva*, `código`, listas, [ ] casillas, > citas, --- y enlaces
function md(src){
  const inline = t => t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  let html = '', list = null, para = [];
  const flush = () => { if (para.length) { html += `<p>${para.map(inline).join('<br>')}</p>`; para = []; } if (list) { html += `</${list}>`; list = null; } };
  for (const raw of esc(src).split('\n')) {
    const l = raw.trimEnd(); let m;
    if (!l.trim()) { flush(); continue; }
    if ((m = l.match(/^(#{1,3})\s+(.*)$/))) { flush(); const h = m[1].length + 1; html += `<h${h}>${inline(m[2])}</h${h}>`; continue; }
    if (/^-{3,}$/.test(l.trim())) { flush(); html += '<hr>'; continue; }
    if ((m = l.match(/^&gt;\s?(.*)$/))) { flush(); html += `<blockquote>${inline(m[1])}</blockquote>`; continue; }
    if ((m = l.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/))) { if (para.length) { const l2 = list; list = null; flush(); list = l2; } if (list !== 'ul') { if (list) html += `</${list}>`; html += '<ul class="checks">'; list = 'ul'; }
      html += `<li><input type="checkbox" disabled ${m[1] !== ' ' ? 'checked' : ''}> ${inline(m[2])}</li>`; continue; }
    if ((m = l.match(/^\s*[-*]\s+(.*)$/)) || (m = l.match(/^\s*\d+[.)]\s+(.*)$/))) {
      const kind = /^\s*\d/.test(l) ? 'ol' : 'ul';
      if (para.length) { html += `<p>${para.map(inline).join('<br>')}</p>`; para = []; }
      if (list !== kind) { if (list) html += `</${list}>`; html += `<${kind}>`; list = kind; }
      html += `<li>${inline(m[1])}</li>`; continue;
    }
    if (list) { html += `</${list}>`; list = null; }
    para.push(l);
  }
  flush();
  return html;
}
function wikiHTML(){
  const E = adminOf(), page = S.wiki.find(w => w.id === S.wid), ed = S.wedit;
  const side = `<div class="wside card-box">
    ${S.wiki.map(w => `<button class="nav ${w.id === S.wid ? 'on' : ''}" onclick="S.wid='${w.id}';S.wedit=null;S.revs=null;render()">${ic('file-text', 'sm')}<span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(w.title)}</span></button>`).join('') || '<p class="mut small" style="padding:8px">Aún no hay páginas.</p>'}
    ${E ? `<button class="btn ghost" style="width:100%;justify-content:center;margin-top:6px" onclick="newWikiPage()">${ic('plus', 'sm')} Nueva página</button>` : ''}</div>`;
  let main;
  if (ed) main = `<div class="card-box wmain">
      <input id="w-title" class="ttitle" value="${esc(ed.title)}" placeholder="Título de la página" oninput="S.wedit.title=this.value">
      <div class="row" style="margin:10px 0 6px"><button class="btn sm ${ed.preview ? '' : 'pri'}" onclick="S.wedit.preview=false;render()">Escribir</button><button class="btn sm ${ed.preview ? 'pri' : ''}" onclick="S.wedit.preview=true;render()">Vista previa</button>
        <span class="small mut grow" style="text-align:right"># Título · **negrita** · *cursiva* · - lista · - [ ] casilla · [texto](enlace) · &gt; cita · ---</span></div>
      ${ed.preview ? `<div class="mdv">${md(ed.body) || '<p class="mut">Nada que mostrar todavía.</p>'}</div>` : `<textarea id="w-body" class="wtext" oninput="S.wedit.body=this.value" placeholder="Escribe aquí: normativa, cálculos, decisiones, enlaces útiles…">${esc(ed.body)}</textarea>`}
      <div class="row" style="margin-top:12px"><span class="grow"></span><button class="btn" onclick="S.wedit=null;render()">Cancelar</button><button class="btn pri" onclick="saveWiki()">${ic('check', 'sm')} Guardar</button></div></div>`;
  else if (!page) main = `<div class="card-box wmain">${emptyState('notebook-pen', 'Notas del proyecto', E ? 'Crea páginas con la normativa, cálculos, decisiones o enlaces útiles. Las leerá todo el equipo.' : 'Los admins del proyecto escribirán aquí la información útil.')}</div>`;
  else main = `<div class="card-box wmain">
      <div class="row" style="flex-wrap:wrap"><h2 class="grow" style="margin:0">${esc(page.title)}</h2>
        <button class="ico" title="${isFav('w', page.id) ? 'Quitar de accesos directos' : 'Añadir a accesos directos de Inicio'}" onclick="toggleFav('w','${page.id}','${S.pid}')">${ic('star', isFav('w', page.id) ? 'fav' : '')}</button>
        <button class="btn sm ghost" onclick="openCalc()">${ic('calculator', 'sm')} Calculadoras</button>
        <button class="btn sm ghost" onclick="loadRevs()">${ic('history', 'sm')} Historial</button>
        ${E ? `<button class="btn sm" onclick="S.wedit={id:'${page.id}',title:S.wiki.find(w=>w.id==='${page.id}').title,body:S.wiki.find(w=>w.id==='${page.id}').body};render()">${ic('pencil', 'sm')} Editar</button><button class="btn sm bad" onclick="delWiki('${page.id}')">${ic('trash-2', 'sm')}</button>` : ''}</div>
      <p class="small mut" style="margin:4px 0 14px">Última edición: ${esc(pname(page.updated_by))} · ${ago(page.updated_at)}</p>
      ${S.revs?.page === page.id ? `<div class="revs"><b class="small">Versiones anteriores</b>${S.revs.list.map((r, i) => `<div class="row small"><span class="grow">${fmtT(r.created_at)} · ${esc(pname(r.edited_by))}${i === 0 ? ' <span class="chip">actual</span>' : ''}</span>
        <button class="btn sm ghost" onclick="S.revs.view=${i};render()">Ver</button>${E && i > 0 ? `<button class="btn sm" onclick="restoreRev(${i})">Restaurar</button>` : ''}</div>`).join('')}
        <button class="btn sm ghost" onclick="S.revs=null;render()">Cerrar historial</button></div>` : ''}
      ${S.revs?.page === page.id && S.revs.view > 0 ? `<div class="banner warn">${ic('history')} Viendo la versión del ${fmtT(S.revs.list[S.revs.view].created_at)}. <a href="#" onclick="event.preventDefault();S.revs.view=0;render()">Volver a la actual</a></div>
        <div class="mdv">${md(S.revs.list[S.revs.view].body)}</div>` : `<div class="mdv" onmouseup="wikiSel()">${md(page.body) || '<p class="mut">Página vacía.</p>'}</div>`}
      ${wikiCommentsHTML(page)}</div>`;
  return `<div class="page wiki" style="max-width:none">${side}${main}</div>`;
}
async function saveWiki(){
  const ed = S.wedit; if (!ed.title.trim()) return toast('La página necesita un título', 'err');
  await q(sb.from('wiki_pages').update({ title: ed.title.trim(), body: ed.body }).eq('id', ed.id));
  Object.assign(S.wiki.find(w => w.id === ed.id) || {}, { title: ed.title.trim(), body: ed.body, updated_at: new Date().toISOString(), updated_by: S.me.id });
  S.wedit = null; S.revs = null; toast('Página guardada'); render();
}
async function delWiki(id){
  if (!confirm('¿Eliminar esta página de notas y su historial?')) return;
  await q(sb.from('wiki_pages').delete().eq('id', id)); S.wiki = S.wiki.filter(w => w.id !== id); S.wid = S.wiki[0]?.id || null; render();
}
async function loadRevs(){
  if (S.revs?.page === S.wid) { S.revs = null; return render(); }
  S.revs = { page: S.wid, list: await q(sb.from('wiki_revisions').select('*').eq('page_id', S.wid).order('created_at', { ascending:false }).limit(50)), view: 0 };
  render();
}
async function restoreRev(i){
  const r = S.revs.list[i];
  if (!confirm(`¿Restaurar la versión del ${fmtT(r.created_at)}? La actual seguirá en el historial.`)) return;
  await q(sb.from('wiki_pages').update({ title: r.title, body: r.body }).eq('id', S.wid));
  Object.assign(S.wiki.find(w => w.id === S.wid), { title: r.title, body: r.body }); S.revs = null; toast('Versión restaurada'); render();
}

/* ============ Riesgo, progreso y actividad ============ */
function computeRisk(p, tasks, deps = S.deps){
  const open = tasks.filter(t => t.status !== 'completada'), td = today(), byId = Object.fromEntries(tasks.map(t => [t.id, t]));
  const overdue = open.filter(t => t.due_date && t.due_date < td);
  const blocked = open.filter(t => deps.some(d => d.task_id === t.id && byId[d.depends_on] && byId[d.depends_on].status !== 'completada'));
  const unassigned = open.filter(t => !(t.task_assignees || []).length);
  const doneRecent = tasks.filter(t => t.completed_at && dayDiff(t.completed_at.slice(0, 10), td) <= 14).length;
  const pace = doneRecent / 14, left = p.due_date ? daysLeft(p.due_date) : null;
  const need = open.length ? (pace > 0 ? Math.ceil(open.length / pace) : Infinity) : 0;
  const bad = [], warn = [];
  if (left !== null && left < 0 && open.length) bad.push(`La fecha de entrega ya pasó y quedan ${open.length} tareas`);
  if (overdue.length >= 3) bad.push(`${overdue.length} tareas vencidas`); else if (overdue.length) warn.push(`${overdue.length} tarea${overdue.length > 1 ? 's' : ''} vencida${overdue.length > 1 ? 's' : ''}`);
  if (left !== null && left >= 0 && open.length) {
    if (need > left * 1.5 && open.length > 2) bad.push(`Al ritmo actual (${doneRecent} completadas en 14 días) harían falta ${need === Infinity ? 'muchos' : need} días y quedan ${left}`);
    else if (need > left) warn.push(`Ritmo justo: harían falta ~${need} días y quedan ${left}`);
  }
  if (blocked.length) warn.push(`${blocked.length} tarea${blocked.length > 1 ? 's' : ''} bloqueada${blocked.length > 1 ? 's' : ''} por otras`);
  if (unassigned.length) warn.push(`${unassigned.length} tarea${unassigned.length > 1 ? 's' : ''} pendiente${unassigned.length > 1 ? 's' : ''} sin asignar`);
  const level = bad.length ? 'bad' : warn.length ? 'warn' : 'ok';
  return { level, reasons: [...bad, ...warn], open: open.length, pace: doneRecent, left };
}
const RISK_TXT = { ok: 'En buen camino', warn: 'Atención', bad: 'En riesgo' };
function riskChip(p, tasks){
  if (p.is_template || p.archived || !tasks.length) return '';
  const r = computeRisk(p, tasks);
  return `<span class="chip ${r.level === 'ok' ? 'ok' : r.level}" style="cursor:pointer" title="${esc(r.reasons.join(' · ') || 'Sin problemas detectados')}" onclick="go('stats')"><span class="light ${r.level}"></span>${RISK_TXT[r.level]}</span>`;
}
// En Inicio solo tenemos el estado de las tareas de cada proyecto: semáforo aproximado por ritmo necesario
function riskChipLite(p){
  const open = p.tasks.filter(t => t.status !== 'completada').length, left = daysLeft(p.due_date);
  if (!p.tasks.length) return '';
  const level = open === 0 ? 'ok' : left <= 2 && open > 2 ? 'bad' : open / Math.max(left, 1) > 1 ? 'warn' : 'ok';
  return `<span class="chip ${level === 'ok' ? 'ok' : level}"><span class="light ${level}"></span>${RISK_TXT[level]}</span>`;
}
function burndownSVG(p, tasks){
  if (!tasks.length) return emptyState('chart-line', 'Sin tareas todavía');
  const td = today(), d0 = [p.created_at, ...tasks.map(t => t.created_at)].map(x => x.slice(0, 10)).sort()[0];
  const end = [td, p.due_date].filter(Boolean).sort().pop(), n = Math.min(dayDiff(d0, end), 150) + 1, start = addDays(end, -(n - 1));
  const days = Array.from({ length: n }, (_, i) => addDays(start, i));
  const rem = d => tasks.filter(t => t.created_at.slice(0, 10) <= d && !(t.completed_at && t.completed_at.slice(0, 10) <= d)).length;
  const real = days.filter(d => d <= td).map(rem), max = Math.max(1, ...real, tasks.length);
  const W = 800, H = 260, L = 40, B = 30, T = 14, R = 14, x = i => L + (W - L - R) * (n > 1 ? i / (n - 1) : 0), y = v => T + (H - T - B) * (1 - v / max);
  const pts = real.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const iTd = days.indexOf(td), iDue = p.due_date ? days.indexOf(p.due_date) : -1;
  const ideal = iDue > 0 ? `<line x1="${x(0)}" y1="${y(real[0] ?? 0)}" x2="${x(iDue)}" y2="${y(0)}" class="b-ideal"/>` : '';
  const ticks = [0, Math.round(max / 2), max].map(v => `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text><line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="b-grid"/>`).join('');
  const lab = [0, Math.floor((n - 1) / 2), n - 1].map(i => `<text x="${x(i)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${fmtD(days[i])}</text>`).join('');
  return `<svg class="burn" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de tareas pendientes por día">${ticks}${lab}${ideal}
    ${iTd >= 0 ? `<line x1="${x(iTd)}" x2="${x(iTd)}" y1="${T}" y2="${H - B}" class="b-today"/>` : ''}
    ${iDue >= 0 ? `<line x1="${x(iDue)}" x2="${x(iDue)}" y1="${T}" y2="${H - B}" class="b-due"/>` : ''}
    <polyline points="${pts}" class="b-real"/>${real.length ? `<circle cx="${x(real.length - 1)}" cy="${y(real[real.length - 1])}" r="4" class="b-dot"/>` : ''}</svg>
    <div class="row small mut" style="flex-wrap:wrap;gap:14px;margin-top:6px"><span><i class="lg real"></i> Pendientes reales</span>${ideal ? '<span><i class="lg ideal"></i> Ritmo ideal hasta la entrega</span>' : '<span>Pon fecha de entrega al proyecto para ver el ritmo ideal</span>'}<span><i class="lg today"></i> Hoy</span>${iDue >= 0 ? '<span><i class="lg due"></i> Entrega</span>' : ''}</div>`;
}
// Mapa de actividad: cuadrícula por semanas (columnas) y días (filas), como el de GitHub
function heatGrid(dates, nDays){
  const counts = {}; dates.forEach(d => { const k = isoOf(new Date(d)); counts[k] = (counts[k] || 0) + 1; });
  const end = new Date(), first = new Date(); first.setDate(end.getDate() - nDays + 1); first.setDate(first.getDate() - (first.getDay() + 6) % 7);
  const max = Math.max(1, ...Object.values(counts)), lv = c => c ? Math.min(4, Math.ceil(c / max * 4)) : 0;
  let cols = '', d = new Date(first), total = 0;
  while (d <= end) {
    let cells = '';
    for (let i = 0; i < 7; i++) { const k = isoOf(d), c = counts[k] || 0; if (d <= end) { total += c; cells += `<i class="h${lv(c)}" title="${fmtD(k)}: ${c} acci${c === 1 ? 'ón' : 'ones'}"></i>`; } else cells += '<i class="hx"></i>'; d.setDate(d.getDate() + 1); }
    cols += `<div>${cells}</div>`;
  }
  return `<div class="heat">${cols}</div><div class="row small mut" style="margin-top:8px;gap:6px">${total} acciones · menos <span class="heat inl"><div><i class="h0"></i></div><div><i class="h1"></i></div><div><i class="h2"></i></div><div><i class="h3"></i></div><div><i class="h4"></i></div></span> más</div>`;
}
function statsHTML(){
  const p = proj(), r = computeRisk(p, S.tasks), done = S.tasks.filter(t => t.status === 'completada').length;
  const byMember = members().map(u => ({ u, dates: S.act84.filter(a => a.actor_id === u.id).map(a => a.created_at) })).sort((a, b) => b.dates.length - a.dates.length);
  return `<div class="page" style="max-width:1100px">
    <div class="hgrid" style="margin-top:0;grid-template-columns:1fr 2fr">
      <div class="card-box"><h3>${ic('traffic-cone')} Estado del proyecto</h3>
        ${p.is_template || p.archived ? '<p class="mut">No se calcula en plantillas ni archivados.</p>' : `
        <div class="risk ${r.level}"><span class="light ${r.level} big"></span><div><b>${RISK_TXT[r.level]}</b><br><small class="mut">${r.open} pendientes · ${r.pace} completadas en 14 días${r.left !== null ? ` · ${r.left >= 0 ? `faltan ${r.left} días` : 'entrega pasada'}` : ''}</small></div></div>
        ${r.reasons.length ? `<ul class="reasons">${r.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="mut small">No se han detectado problemas: tareas al día, sin bloqueos y con buen ritmo.</p>'}`}
        <div class="kpis" style="grid-template-columns:1fr 1fr;margin-top:12px">
          <div class="card-box kpi" style="box-shadow:none"><b>${S.tasks.length ? Math.round(done / S.tasks.length * 100) : 0}%</b><span>completado</span></div>
          <div class="card-box kpi" style="box-shadow:none"><b>${fmtMin(S.tlogs.reduce((a, l) => a + l.minutes, 0))}</b><span>dedicadas</span></div></div></div>
      <div class="card-box"><h3>${ic('chart-line')} Progreso: tareas pendientes día a día</h3>${burndownSVG(p, S.tasks)}</div>
    </div>
    <div class="sect">Actividad del equipo · últimas 12 semanas</div>
    <div class="card-box" style="padding:12px 16px;overflow-x:auto">${byMember.map(x => `<div class="hrow" onclick="go('person',{uid:'${x.u.id}'})"><div class="row" style="width:200px;flex:none">${av(x.u.id)}<span class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(pname(x.u.id))}</span></div>${heatGrid(x.dates, 84)}</div>`).join('')}</div>
  </div>`;
}
