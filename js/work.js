/* ============ Forma de trabajar del grupo: estados, partes, juntar, revisión, incidencias, plan, WhatsApp, sesiones ============ */

/* ---------- 1 · Tablero por estados ---------- */
const STC = [['todo', 'Por hacer', 'circle-dashed', '#94a3b8'], ['doing', 'En proceso', 'loader', '#38bdf8'], ['review', 'En revisión', 'eye', '#f59e0b'], ['done', 'Hecho', 'circle-check', '#22c55e']];
const stMode = () => (proj()?.board_mode || 'status') === 'status';
const stOf = t => t.status === 'completada' ? 'done' : t.review_requested ? 'review' : t.status === 'en_curso' ? 'doing' : 'todo';
const stPatch = k => ({ todo: { status: 'no_iniciada', review_requested: false }, doing: { status: 'en_curso', review_requested: false },
  review: { status: 'en_curso', review_requested: true }, done: { status: 'completada', review_requested: false } }[k]);
function stColHTML([k, name, icon, color]){
  const E = adminOf(), bid = 'st:' + k, ts = colTasks(bid);
  return `<section class="col stcol" style="--sc:${color}" ${E ? `ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="dropOnCol(event,'${bid}')"` : ''}>
    <div class="colh"><span class="sth">${ic(icon, 'sm')} ${name}</span><span class="cnt">${ts.length}</span></div>
    ${E && k === 'todo' ? `<div class="addt"><input id="nt-${bid}" placeholder="+ Agregar tarea" title="Enter para crear · pega una lista para crear varias · Ej.: Planos @Ana viernes !urgente #Planos" oninput="nlHint(this)" onkeydown="if(event.key==='Enter')addTask('${bid}',this)" onpaste="pasteTasks(event,'${bid}')"></div>` : ''}
    <div class="cards">${ts.map(cardHTML).join('') || `<div class="empty">${k === 'review' ? 'Nada pendiente de revisar' : 'Sin tareas'}</div>`}</div></section>`;
}
async function setBoardMode(m){ const p = proj(); p.board_mode = m; render(); await q(sb.from('projects').update({ board_mode: m }).eq('id', p.id)); }

/* ---------- 2 · Partes del proyecto ---------- */
const partsOf = () => [...S.parts].sort((a, b) => a.position - b.position);
const partOf = id => S.parts.find(p => p.id === id);
const partMembers = pid => S.pmembers.filter(m => m.part_id === pid).map(m => m.user_id);
const myParts = () => S.parts.filter(p => partMembers(p.id).includes(S.me.id)).map(p => p.id);
const partChip = id => { const p = partOf(id); return p ? `<span class="pchip" style="--c:${esc(p.color)}">${esc(p.name)}</span>` : ''; };
// filtro del tablero: null = todas, 'mine' = mis partes, o el id de una parte
const partFilterOk = t => !S.partF || (S.partF === 'mine' ? myParts().includes(t.part_id) : t.part_id === S.partF);
function partFilterHTML(){
  if (!S.parts.length) return adminOf() ? `<button class="btn sm ghost" onclick="openModal('parts')">${ic('puzzle', 'sm')} Definir partes</button>` : '';
  const b = (v, l, c) => `<button class="pfb ${S.partF === v ? 'on' : ''}" ${c ? `style="--c:${esc(c)}"` : ''} onclick="S.partF=${v ? `'${v}'` : 'null'};render()">${l}</button>`;
  return `<div class="pfilter" role="group" aria-label="Filtrar por parte">${b(null, 'Todas')}${myParts().length ? b('mine', 'Mi parte') : ''}${partsOf().map(p => b(p.id, esc(p.name), p.color)).join('')}
    ${adminOf() ? `<button class="ico" title="Editar partes" onclick="openModal('parts')">${ic('settings-2', 'sm')}</button>` : ''}</div>`;
}
const PCOLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#ef4444'];
function partsModalHTML(){
  return `<div class="mod md"><div class="mh"><h3>Partes del proyecto</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <p class="small mut" style="margin-top:0">Cada parte es un trozo del trabajo con sus personas (por ejemplo Mecánica, RFID, Cargador). Las tareas se asignan a una parte y en las tareas de «juntar todo» cada parte marca cuando ha subido lo suyo.</p>
    ${partsOf().map(p => `<div class="card-box prow"><div class="row"><input type="color" value="${esc(p.color)}" onchange="savePart('${p.id}',{color:this.value})" aria-label="Color">
        <input value="${esc(p.name)}" maxlength="60" onchange="savePart('${p.id}',{name:this.value.trim()||'${esc(p.name)}'})" aria-label="Nombre de la parte">
        <button class="ico" title="Borrar parte" onclick="delPart('${p.id}')">${ic('trash-2', 'sm')}</button></div>
      <div class="pick">${members().map(u => `<label class="${partMembers(p.id).includes(u.id) ? 'on' : ''}"><input type="checkbox" ${partMembers(p.id).includes(u.id) ? 'checked' : ''} onchange="togglePartMember('${p.id}','${u.id}',this.checked)">${av(u.id)}${esc(pname(u.id))}</label>`).join('')}</div></div>`).join('')}
    <div class="row" style="margin-top:10px"><input id="np-name" maxlength="60" placeholder="Nueva parte… Ej.: Mecánica" onkeydown="if(event.key==='Enter')addPart()"><button class="btn pri" onclick="addPart()">${ic('plus', 'sm')} Añadir</button></div></div></div>`;
}
async function addPart(){
  const name = $('#np-name').value.trim(); if (!name) return;
  const [p] = await q(sb.from('project_parts').insert({ project_id: S.pid, name, color: PCOLORS[S.parts.length % PCOLORS.length], position: Date.now() }).select());
  if (p) { S.parts.push(p); renderModal(); $('#np-name')?.focus(); }
}
async function savePart(id, patch){ Object.assign(partOf(id), patch); render(); await q(sb.from('project_parts').update(patch).eq('id', id)); }
async function delPart(id){
  if (!confirm(`¿Borrar la parte «${partOf(id).name}»? Las tareas no se borran, solo dejan de tener parte.`)) return;
  S.parts = S.parts.filter(p => p.id !== id); S.tasks.forEach(t => { if (t.part_id === id) t.part_id = null; }); renderModal(); render();
  await q(sb.from('project_parts').delete().eq('id', id));
}
async function togglePartMember(pid, uid, on){
  if (on) { S.pmembers.push({ part_id: pid, user_id: uid }); await q(sb.from('part_members').insert({ part_id: pid, user_id: uid })); }
  else { S.pmembers = S.pmembers.filter(m => !(m.part_id === pid && m.user_id === uid)); await q(sb.from('part_members').delete().match({ part_id: pid, user_id: uid })); }
  keep(renderModal);
}
// asignar una parte a una tarea; si la tarea no tiene a nadie, se asignan los de esa parte
async function setTaskPart(tid, pid){
  const t = S.tasks.find(x => x.id === tid); await updateTask(tid, { part_id: pid || null }, 'parte');
  const ids = pid ? partMembers(pid) : [];
  if (pid && ids.length && !t.task_assignees.length && confirm('¿Asignar la tarea a las personas de esa parte?'))
    await q(sb.from('task_assignees').upsert(ids.map(u => ({ task_id: tid, user_id: u })), { ignoreDuplicates: true }));
}

/* ---------- 3 · Tareas de juntar las partes ---------- */
const contribOf = (tid, pid) => S.contribs.find(c => c.task_id === tid && c.part_id === pid);
const mergeProgress = t => { const ps = S.parts; return [ps.filter(p => contribOf(t.id, p.id)?.done).length, ps.length]; };
function mergeHTML(t){
  const E = adminOf(), ps = partsOf();
  if (!t.is_merge) return E ? `<button class="btn sm ghost" style="margin-top:6px" onclick="updateTask('${t.id}',{is_merge:true},'juntar partes')">${ic('puzzle', 'sm')} Es una tarea de juntar las partes</button>` : '';
  const [d, n] = mergeProgress(t);
  return `<div class="merge"><div class="row"><b class="grow">${ic('puzzle', 'sm')} Aportación de cada parte · ${d}/${n}</b>
      ${d < n ? `<button class="btn sm" onclick="remindMerge('${t.id}')">${ic('bell-ring', 'sm')} Recordar a los que faltan</button>` : `<span class="chip ok">${ic('check', 'sm')} Todas las partes listas</span>`}
      ${E ? `<button class="ico" title="Ya no es tarea de juntar" onclick="updateTask('${t.id}',{is_merge:false},'juntar partes')">${ic('x', 'sm')}</button>` : ''}</div>
    ${!ps.length ? `<p class="small mut">Primero hay que definir las partes del proyecto${E ? ` (<a href="#" onclick="event.preventDefault();openModal('parts')">definir partes</a>)` : ''}.</p>` : ''}
    ${ps.map(p => { const c = contribOf(t.id, p.id), can = E || partMembers(p.id).includes(S.me.id);
      return `<div class="mrow ${c?.done ? 'ok' : ''}" style="--c:${esc(p.color)}"><span class="pchip" style="--c:${esc(p.color)}">${esc(p.name)}</span>
        <span class="avs">${partMembers(p.id).map(av).join('')}</span>
        ${can ? `<input class="cellin" type="url" placeholder="Enlace a su parte (Drive)…" value="${esc(c?.link || '')}" onchange="saveContrib('${t.id}','${p.id}',{link:this.value.trim()||null})">`
          : okUrl(c?.link) ? `<a href="${esc(c.link)}" target="_blank" rel="noopener" class="grow">${ic('external-link', 'sm')} Ver su parte</a>` : '<span class="grow"></span>'}
        ${can ? `<button class="btn sm ${c?.done ? '' : 'pri'}" onclick="saveContrib('${t.id}','${p.id}',{done:${!c?.done}})">${c?.done ? `${ic('check', 'sm')} Subido` : 'Marcar como subido'}</button>`
          : `<span class="chip ${c?.done ? 'ok' : 'warn'}">${c?.done ? 'Subido' : 'Falta'}</span>`}</div>`; }).join('')}</div>`;
}
async function saveContrib(tid, pid, patch){
  if (patch.link && !okUrl(patch.link)) return toast('El enlace debe empezar por https://', 'err');
  let c = contribOf(tid, pid); if (!c) { c = { task_id: tid, part_id: pid, done: false, link: null }; S.contribs.push(c); }
  Object.assign(c, patch); keep(renderModal); render();
  await q(sb.from('part_contribs').upsert({ task_id: tid, part_id: pid, done: c.done, link: c.link, updated_by: S.me.id, updated_at: new Date().toISOString() }));
}
async function remindMerge(tid){
  const { data, error } = await sb.rpc('remind_merge', { p_task: tid });
  toast(error ? 'No se pudo avisar: ' + error.message : data ? `Aviso enviado a ${data} persona${data === 1 ? '' : 's'}` : 'No hay nadie a quien avisar (¿tienen personas esas partes?)', error ? 'err' : undefined);
}

/* ---------- 4 · Revisión: aprobar o pedir cambios ---------- */
function reviewHTML(t){
  if (!t.review_requested || t.status === 'completada') return '';
  if (!adminOf()) return `<div class="banner warn">${ic('eye')} En revisión: un admin la aprobará o pedirá cambios.</div>`;
  return `<div class="banner warn review-b">${ic('eye')} <span class="grow">Esta tarea está esperando revisión.</span>
    <button class="btn sm" onclick="askChanges('${t.id}')">${ic('undo-2', 'sm')} Pedir cambios</button><button class="btn sm pri" onclick="approveTask('${t.id}')">${ic('check', 'sm')} Aprobar</button></div>`;
}
async function approveTask(tid){
  await updateTask(tid, stPatch('done'), 'aprobar');
  await q(sb.from('comments').insert({ task_id: tid, body: '✔️ Revisado y aprobado.' })); toast('Tarea aprobada');
}
async function askChanges(tid){
  const why = prompt('¿Qué hay que cambiar? Se lo enviaremos a quien la hizo.'); if (!why?.trim()) return;
  await updateTask(tid, stPatch('doing'), 'pedir cambios');
  const t = S.tasks.find(x => x.id === tid), at = t.task_assignees.filter(a => a.user_id !== S.me.id).map(a => '@' + pname(a.user_id)).join(' ');
  await q(sb.from('comments').insert({ task_id: tid, body: `↩️ Cambios pedidos: ${why.trim()}${at ? '\n' + at : ''}`, mentions: t.task_assignees.map(a => a.user_id).filter(u => u !== S.me.id) }));
  toast('Cambios pedidos: la tarea vuelve a «En proceso»');
}

/* ---------- 5 · Incidencias ---------- */
const SEV = { critica: ['Crítica', 'bad', '🔴'], importante: ['Importante', 'warn', '🟠'], normal: ['Normal', '', '⚪'] };
function issuesHTML(){
  const f = S.issF || 'abierta', list = S.issues.filter(i => f === 'todas' || i.status === f)
    .sort((a, b) => (a.status === 'resuelta') - (b.status === 'resuelta') || Object.keys(SEV).indexOf(a.severity) - Object.keys(SEV).indexOf(b.severity) || b.created_at.localeCompare(a.created_at));
  const open = S.issues.filter(i => i.status === 'abierta');
  return `<div class="page" style="max-width:none"><div class="row" style="flex-wrap:wrap;margin-bottom:10px">
      <p class="mut grow" style="margin:0">Problemas detectados al juntar o revisar (por ejemplo, incongruencias entre esquemas). Cada uno tiene quién lo arregla y se marca como resuelto.</p>
      <div class="seg">${[['abierta', `Abiertas (${open.length})`], ['resuelta', 'Resueltas'], ['todas', 'Todas']].map(([k, l]) => `<button class="${f === k ? 'on' : ''}" onclick="S.issF='${k}';render()">${l}</button>`).join('')}</div>
      <button class="btn pri" onclick="S.issEdit=null;openModal('issue')">${ic('plus')} Nueva incidencia</button></div>
    ${list.map(i => { const [sl, sc, se] = SEV[i.severity], t = S.tasks.find(x => x.id === i.task_id);
      return `<div class="card-box iss ${i.status === 'resuelta' ? 'res' : ''} sev-${i.severity}" onclick="S.issEdit='${i.id}';openModal('issue')">
        <div class="row" style="align-items:flex-start"><span class="chip ${sc}">${se} ${sl}</span><b class="grow">${esc(i.title)}</b>
          <button class="btn sm ${i.status === 'resuelta' ? '' : 'pri'}" onclick="event.stopPropagation();resolveIssue('${i.id}',${i.status !== 'resuelta'})">${i.status === 'resuelta' ? `${ic('rotate-ccw', 'sm')} Reabrir` : `${ic('check', 'sm')} Resuelta`}</button></div>
        ${i.detail ? `<p class="iss-d">${esc(i.detail.length > 240 ? i.detail.slice(0, 240) + '…' : i.detail)}</p>` : ''}
        <div class="row small mut" style="flex-wrap:wrap">${i.owner ? `${av(i.owner)} ${esc(pname(i.owner))}` : '<span>Sin responsable</span>'}${partChip(i.part_id)}
          ${t ? `<a href="#" onclick="event.preventDefault();event.stopPropagation();openTask('${t.id}')">${ic('square-check', 'sm')} ${esc(t.title)}</a>` : ''}<span class="grow"></span><span>${ago(i.created_at)}</span></div></div>`; }).join('')
      || emptyState('shield-check', f === 'abierta' ? 'Sin incidencias abiertas' : 'Nada por aquí', f === 'abierta' ? 'Cuando alguien detecte un problema, que lo apunte aquí.' : '')}</div>`;
}
function issueFormHTML(){
  const i = S.issues.find(x => x.id === S.issEdit), opt = (v, cur) => v === cur ? 'selected' : '';
  return `<div class="mod md"><div class="mh"><h3>${i ? 'Incidencia' : 'Nueva incidencia'}</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <label>Qué pasa</label><input id="is-title" maxlength="200" value="${esc(i?.title || '')}" placeholder="Ej.: El motor de la mordaza tiene tensiones distintas en cada esquema">
    <label>Detalle y propuesta</label><textarea id="is-detail" rows="6" maxlength="4000">${esc(i?.detail || '')}</textarea>
    <div class="grid4"><div><label>Gravedad</label><select id="is-sev">${Object.entries(SEV).map(([k, [l, , e]]) => `<option value="${k}" ${opt(k, i?.severity || 'normal')}>${e} ${l}</option>`).join('')}</select></div>
      <div><label>Quién lo arregla</label><select id="is-owner"><option value="">—</option>${members().map(u => `<option value="${u.id}" ${opt(u.id, i?.owner)}>${esc(pname(u.id))}</option>`).join('')}</select></div>
      <div><label>Parte</label><select id="is-part"><option value="">—</option>${partsOf().map(p => `<option value="${p.id}" ${opt(p.id, i?.part_id)}>${esc(p.name)}</option>`).join('')}</select></div>
      <div><label>Tarea afectada</label><select id="is-task"><option value="">—</option>${S.tasks.map(t => `<option value="${t.id}" ${opt(t.id, i?.task_id)}>${esc(t.title)}</option>`).join('')}</select></div></div>
    <div class="row" style="margin-top:14px">${i && (i.created_by === S.me.id || adminOf()) ? `<button class="btn bad" onclick="delIssue('${i.id}')">${ic('trash-2', 'sm')} Borrar</button>` : ''}<span class="grow"></span>
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" onclick="saveIssue()">Guardar</button></div></div></div>`;
}
async function saveIssue(){
  const row = { title: $('#is-title').value.trim(), detail: $('#is-detail').value.trim() || null, severity: $('#is-sev').value, owner: $('#is-owner').value || null, part_id: $('#is-part').value || null, task_id: $('#is-task').value || null };
  if (!row.title) return toast('Escribe qué pasa', 'err');
  const r = S.issEdit ? await q(sb.from('issues').update(row).eq('id', S.issEdit).select()) : await q(sb.from('issues').insert({ ...row, project_id: S.pid }).select());
  if (!r?.[0]) return; S.issues = [...S.issues.filter(x => x.id !== r[0].id), r[0]]; closeModal(); render(); toast('Incidencia guardada');
}
async function resolveIssue(id, done){ const i = S.issues.find(x => x.id === id); i.status = done ? 'resuelta' : 'abierta'; render(); await q(sb.from('issues').update({ status: i.status }).eq('id', id)); if (done) toast('Incidencia resuelta'); }
async function delIssue(id){ if (!confirm('¿Borrar esta incidencia?')) return; S.issues = S.issues.filter(x => x.id !== id); closeModal(); render(); await q(sb.from('issues').delete().eq('id', id)); }
const openIssuesOf = tid => S.issues.filter(i => i.task_id === tid && i.status === 'abierta');

/* ---------- 6 · Planificar hacia atrás desde la entrega ---------- */
// hitos en días antes de la entrega: partes listas, juntar, revisión, ensayo
const MILES = [['parts', 'Partes terminadas', 9], ['merge', 'Juntar todo', 5], ['review', 'Revisión final', 3], ['rehearse', 'Ensayo de la presentación', 1]];
function suggestDue(t, due){
  const d = k => addDays(due, -MILES.find(m => m[0] === k)[2]), s = norm(t.title);
  if (/present|expos|ensayo/.test(s)) return d('rehearse');
  if (/memoria|document|revis/.test(s)) return d('review');
  if (t.is_merge || /presupuesto|junt|integr|esquema/.test(s)) return d('merge');
  return d('parts');
}
function plannerHTML(){
  const p = proj(), due = p.due_date;
  if (!due) return `<div class="mod sm"><div class="mh"><h3>Planificar hasta la entrega</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb"><p>Primero pon la <b>fecha de entrega</b> del proyecto en «Ajustes».</p></div></div>`;
  const ts = S.tasks.filter(t => t.status !== 'completada' && !t.due_date);
  return `<div class="mod md"><div class="mh"><h3>Planificar hasta la entrega · ${fmtLong(due)}</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <div class="miles">${MILES.map(([, l, n]) => `<div><b>${fmtD(addDays(due, -n))}</b><span>${l}</span></div>`).join('')}<div class="end"><b>${fmtD(due)}</b><span>Entrega</span></div></div>
    ${ts.length ? `<p class="small mut">Fechas propuestas para las ${ts.length} tareas sin fecha (puedes cambiarlas antes de aplicar):</p>
      <div class="tablewrap"><table class="ltable"><tbody>${ts.map(t => `<tr style="cursor:default"><td>${esc(t.title)} ${partChip(t.part_id)}</td><td style="width:170px"><input type="date" class="cellin" data-tid="${t.id}" value="${suggestDue(t, due)}" max="${due}"></td></tr>`).join('')}</tbody></table></div>
      <div class="row" style="margin-top:12px"><span class="grow"></span><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" onclick="applyPlan()">${ic('calendar-check', 'sm')} Aplicar fechas</button></div>`
    : '<p class="mut">Todas las tareas pendientes ya tienen fecha. 👍</p>'}</div></div>`;
}
async function applyPlan(){
  const rows = [...document.querySelectorAll('#modal input[data-tid]')].filter(i => i.value);
  for (const i of rows) { S.tasks.find(t => t.id === i.dataset.tid).due_date = i.value; }
  closeModal(); render();
  await Promise.all(rows.map(i => q(sb.from('tasks').update({ due_date: i.value }).eq('id', i.dataset.tid))));
  toast(`Fechas puestas a ${rows.length} tareas`);
}

/* ---------- 7 · Resumen para WhatsApp ---------- */
function waText(){
  const p = proj(), ts = S.tasks, by = st => ts.filter(t => stOf(t) === st), who = t => t.task_assignees.length > 3 ? 'varios' : t.task_assignees.map(a => first(a.user_id)).join(', ') || 'sin asignar';
  const days = p.due_date ? Math.round((new Date(p.due_date + 'T00:00') - new Date(today() + 'T00:00')) / 864e5) : null;
  const L = [`*${p.name}* — resumen ${fmtD(today())}`];
  if (days != null) L.push(days > 0 ? `⏳ Entrega en ${days} día${days === 1 ? '' : 's'} (${fmtD(p.due_date)})` : days === 0 ? '⏳ ¡La entrega es HOY!' : `⚠️ La entrega era el ${fmtD(p.due_date)}`);
  L.push(`✅ Hecho: ${by('done').length}/${ts.length}`);
  const late = ts.filter(t => t.status !== 'completada' && t.due_date && t.due_date < today());
  if (late.length) L.push('', '🔴 *Atrasadas*', ...late.map(t => `• ${t.title} (${who(t)})`));
  if (by('review').length) L.push('', '👀 *Para revisar*', ...by('review').map(t => `• ${t.title}`));
  if (by('doing').length) L.push('', '🔄 *En proceso*', ...by('doing').map(t => `• ${t.title} (${who(t)})${t.due_date ? ' · ' + fmtD(t.due_date) : ''}`));
  if (by('todo').length) L.push('', '📝 *Por hacer*', ...by('todo').map(t => `• ${t.title} (${who(t)})`));
  const merges = ts.filter(t => t.is_merge && t.status !== 'completada');
  merges.forEach(t => { const miss = S.parts.filter(pp => !contribOf(t.id, pp.id)?.done); if (miss.length) L.push('', `🧩 *${t.title}* — falta: ${miss.map(pp => pp.name).join(', ')}`); });
  const crit = S.issues.filter(i => i.status === 'abierta' && i.severity !== 'normal');
  if (crit.length) L.push('', '⛔ *Incidencias abiertas*', ...crit.map(i => `• ${SEV[i.severity][2]} ${i.title}${i.owner ? ' (' + first(i.owner) + ')' : ''}`));
  L.push('', `👉 ${location.origin + location.pathname}#v=board&p=${p.id}`);
  return L.join('\n');
}
function waHTML(){
  const txt = waText();
  return `<div class="mod md"><div class="mh"><h3>Resumen para WhatsApp</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <p class="small mut" style="margin-top:0">Listo para pegar en el grupo. Puedes retocarlo aquí antes.</p>
    <textarea id="wa-txt" rows="14" style="font-size:13.5px">${esc(txt)}</textarea>
    <div class="row" style="margin-top:12px"><span class="grow"></span><button class="btn" onclick="navigator.clipboard.writeText($('#wa-txt').value).then(()=>toast('Copiado: pégalo en el grupo'))">${ic('copy', 'sm')} Copiar</button>
      <a class="btn pri" target="_blank" rel="noopener" onclick="this.href='https://wa.me/?text='+encodeURIComponent($('#wa-txt').value);track('f:wa')" href="#">${ic('send', 'sm')} Abrir WhatsApp</a></div></div></div>`;
}

/* ---------- 8 · Sesiones de taller ---------- */
const WD = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
// próxima sesión (hoy si aún no ha terminado)
function nextSession(p = proj()){
  const ss = p?.sessions || []; if (!ss.length) return null;
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  for (let k = 0; k < 8; k++) { const d = new Date(now); d.setDate(now.getDate() + k);
    const s = ss.filter(x => +x.wd === d.getDay() && (k > 0 || ttMin(x.end || '23:59') > nowMin)).sort((a, b) => a.start.localeCompare(b.start))[0];
    if (s) return { ...s, day: isoOf(d), today: k === 0 }; }
  return null;
}
function sessionPanelHTML(){
  const s = nextSession(); if (!s) return adminOf() ? '' : '';
  const items = S.sitems.filter(i => i.day === s.day).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const open = S.sesOpen ?? s.today; if (!open) return '';
  return `<div class="card-box sess ${s.today ? 'today' : ''}"><button class="sess-h" onclick="S.sesOpen=${!open};render()" aria-expanded="${open}">
      ${ic('wrench', 'sm')} <b>${s.today ? 'Hoy' : cap(WD[+s.wd])} ${fmtD(s.day)}</b> · ${s.start}–${s.end}${s.place ? ' · ' + esc(s.place) : ''} <span class="mut">· Sesión de taller</span>
      <span class="grow"></span><span class="mut small">${items.filter(i => i.done).length}/${items.length} hecho</span>${ic(open ? 'chevron-up' : 'chevron-down', 'sm')}</button>
    ${open ? `<div class="sess-b">${items.map(i => `<label class="today-i check"><input type="checkbox" ${i.done ? 'checked' : ''} onchange="toggleSItem('${i.id}',this.checked)"> <span class="${i.done ? 'done' : ''} grow">${esc(i.title)}</span><small class="mut">${esc(first(i.created_by))}</small>
        ${i.created_by === S.me.id || adminOf() ? `<button class="ico" title="Borrar" onclick="event.preventDefault();delSItem('${i.id}')">${ic('x', 'sm')}</button>` : ''}</label>`).join('')}
      <input id="si-new" placeholder="¿Qué hacemos en esta sesión? (Enter) Ej.: Cablear el cuadro del semáforo" onkeydown="if(event.key==='Enter')addSItem('${s.day}')"></div>` : ''}</div>`;
}
async function addSItem(day){
  const el = $('#si-new'), title = el.value.trim(); if (!title) return;
  const [i] = await q(sb.from('session_items').insert({ project_id: S.pid, day, title }).select());
  if (i) { S.sitems.push(i); render(); $('#si-new')?.focus(); }
}
async function toggleSItem(id, done){ S.sitems.find(i => i.id === id).done = done; render(); await q(sb.from('session_items').update({ done }).eq('id', id)); }
async function delSItem(id){ S.sitems = S.sitems.filter(i => i.id !== id); render(); await q(sb.from('session_items').delete().eq('id', id)); }
function sessionsModalHTML(){
  const ss = proj().sessions || [];
  return `<div class="mod md"><div class="mh"><h3>Sesiones fijas de taller</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <p class="small mut" style="margin-top:0">Las horas de clase que tenéis para este proyecto (por ejemplo, los miércoles 1 hora). Encima del tablero saldrá la próxima sesión con una lista de qué hacer en ella.</p>
    <div id="ses-rows">${(ss.length ? ss : [{ wd: 3, start: '', end: '', place: '' }]).map(sesRow).join('')}</div>
    <button class="btn sm ghost" onclick="$('#ses-rows').insertAdjacentHTML('beforeend',sesRow({wd:1}));icons()">${ic('plus', 'sm')} Otra sesión</button>
    <p class="small mut">Consejo: elige la hora en el horario de clase (${S.settings?.timetable ? S.settings.timetable.slots.map(s => s.join('–')).join(', ') : 'sin horario'}).</p>
    <div class="row" style="margin-top:12px"><span class="grow"></span><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" onclick="saveSessions()">Guardar</button></div></div></div>`;
}
const sesRow = s => `<div class="row ses-r"><select aria-label="Día">${[1, 2, 3, 4, 5].map(d => `<option value="${d}" ${+s.wd === d ? 'selected' : ''}>${cap(WD[d])}</option>`).join('')}</select>
  <input type="time" value="${s.start || ''}" aria-label="Empieza"><input type="time" value="${s.end || ''}" aria-label="Termina"><input value="${esc(s.place || '')}" placeholder="Lugar (Taller 3…)" aria-label="Lugar">
  <button class="ico" title="Quitar" onclick="this.parentElement.remove()">${ic('x', 'sm')}</button></div>`;
async function saveSessions(){
  const ss = [...document.querySelectorAll('.ses-r')].map(r => { const [d, a, b, pl] = r.querySelectorAll('select,input'); return { wd: +d.value, start: a.value, end: b.value, place: pl.value.trim() }; }).filter(s => s.start && s.end);
  if (ss.some(s => s.end <= s.start)) return toast('La hora de fin debe ser posterior a la de inicio', 'err');
  const p = proj(); p.sessions = ss; closeModal(); render(); await q(sb.from('projects').update({ sessions: ss }).eq('id', p.id)); toast('Sesiones guardadas');
}

/* ---------- menú «Organizar» del proyecto ---------- */
function orgHTML(){
  const it = (icon, t, d, fn) => `<button class="doc-o" onclick="${fn}">${ic(icon)}<div><b>${t}</b><small>${d}</small></div></button>`;
  return `<div class="mod md"><div class="mh"><h3>Organizar el proyecto</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb docs-g">
    ${it('puzzle', 'Partes del proyecto', 'Quién hace cada parte (Mecánica, RFID, Cargador…). Sirve para filtrar el tablero y para las tareas de juntar.', "openModal('parts')")}
    ${it('calendar-clock', 'Planificar hasta la entrega', 'Propone fechas hacia atrás desde el día de entrega para las tareas que no tienen.', "openModal('planner')")}
    ${it('wrench', 'Sesiones de taller', 'Las horas fijas de clase para este proyecto, con su lista de qué hacer.', "openModal('sessions')")}
    ${it('columns-3', stMode() ? 'Usar columnas propias' : 'Usar columnas por estado', stMode() ? 'Vuelve a las columnas que teníais (Tareas pendientes, En proceso…).' : 'Por hacer · En proceso · En revisión · Hecho, y al mover se cambia el estado.', `closeModal();setBoardMode('${stMode() ? 'buckets' : 'status'}')`)}</div></div>`;
}
