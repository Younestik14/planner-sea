'use strict';
// Planner SEA · acciones: tareas, chat, miembros, búsqueda, exportar, respuestas rápidas
/* ============ acciones: tareas ============ */
async function openTask(id){
  if (S.tid !== id) { S.reply = null; S.cdraft = []; }
  if (!S.tasks.some(t => t.id === id)) return;
  S.tid = id; S.modal = 'task'; S.comments = []; S.tact = []; S.subs = []; S.reacts = []; setHash(); renderModal();
  typingChannel(id); await loadTask(); keep(renderModal); render();
}
async function saveProject(edit){
  const name = $('#p-name').value.trim(), drive = $('#p-drive').value.trim();
  if (!name) return toast('Pon un nombre al proyecto', 'err');
  if (drive && !okUrl(drive)) return toast('El enlace de Drive debe empezar por https://', 'err');
  const row = { name, description: $('#p-desc').value.trim() || null, drive_url: drive || null, color: document.querySelector('input[name=pc]:checked').value,
                due_date: $('#p-due').value || null, is_template: $('#p-tpl').checked, emoji: $('#p-emoji').value.trim() || null, module: $('#p-mod').value || null };
  if (S.coverDraft !== undefined) row.cover = S.coverDraft;
  const people = [...document.querySelectorAll('#p-people input:checked')].map(i => i.value);
  if (!edit && S.newPriv) row.visibility = 'private';
  if (edit) { row.archived = $('#p-arch').checked; await q(sb.from('projects').update(row).eq('id', S.pid)); closeModal(); return; }
  let id;
  if ($('#p-from')?.value) { id = await q(sb.rpc('duplicate_project', { p_src: $('#p-from').value, p_name: name, p_template: row.is_template })); await q(sb.from('projects').update(row).eq('id', id)); }
  else { id = (await q(sb.from('projects').insert(row).select()))[0].id; if ($('#p-preset')?.value) await applyPreset(id, $('#p-preset').value); }
  if (people.length) await q(sb.from('project_members').insert(people.map(u => ({ project_id: id, user_id: u }))));
  S.newPriv = false; S.modal = null; await loadBase(); goProject(id);
}
async function saveAsTemplate(){
  const n = prompt('Nombre de la plantilla:', 'Plantilla – ' + proj().name); if (!n?.trim()) return;
  await q(sb.rpc('duplicate_project', { p_src: S.pid, p_name: n.trim(), p_template: true }));
  toast('Plantilla guardada. La verás al crear un proyecto nuevo.');
}
async function delProject(){
  if (prompt('Esto borra el proyecto con TODAS sus tareas, chats y diario.\nEscribe el nombre del proyecto para confirmar:') !== proj().name) return toast('Nombre incorrecto: no se ha borrado nada');
  const imgs = S.posts.flatMap(p => p.images);
  await q(sb.from('projects').delete().eq('id', S.pid));
  if (imgs.length) sb.storage.from('diario').remove(imgs).then(() => {});
  S.pid = null; S.modal = null; go('home');
}
async function toggleProjectAdmin(pid, uid, on){
  if (on) await q(sb.from('project_admins').insert({ project_id: pid, user_id: uid }));
  else await q(sb.from('project_admins').delete().match({ project_id: pid, user_id: uid }));
}
async function addBucket(){
  const n = prompt('Nombre de la nueva columna (ej.: "Memoria", "Planos", "Presentación"):'); if (!n?.trim()) return;
  await q(sb.from('buckets').insert({ project_id: S.pid, name: n.trim(), position: Date.now() }));
}
async function renameBucket(id){
  const b = S.buckets.find(x => x.id === id), n = prompt('Nuevo nombre de la columna:', b.name); if (!n?.trim()) return;
  await q(sb.from('buckets').update({ name: n.trim() }).eq('id', id));
}
async function delBucket(id){
  const b = S.buckets.find(x => x.id === id);
  if (!confirm(`¿Eliminar la columna «${b.name}»? Sus tareas NO se borran: pasan a «Sin columna».`)) return;
  S.hidden.add(id); render(); // se borra a los 5 s salvo que pulses Deshacer
  toastUndo(`Columna «${b.name}» eliminada`, () => { S.hidden.delete(id); render(); }, async () => { await q(sb.from('buckets').delete().eq('id', id)); S.hidden.delete(id); });
}
async function addTask(bid, el){
  const raw = el.value.trim(); if (!raw) return;
  el.value = ''; nlHint(el);
  await createParsed(raw, bid, -Date.now()); // posición negativa = arriba del todo, como Planner
}
async function createParsed(raw, bid, position){
  const x = parseQuick(raw);
  if (x.who.length || x.due || x.prio || x.labels.length) track('f:nl');
  const st = bid?.startsWith?.('st:') ? bid.slice(3) : null, pf = S.partF && S.partF !== 'mine' ? S.partF : null; // en el tablero por estados no hay columna: va a la primera
  const [t] = await q(sb.from('tasks').insert({ project_id: S.pid, bucket_id: st ? S.buckets[0]?.id || null : bid, title: x.title.slice(0, 300), position, priority: x.prio || 'media', due_date: x.due, labels: x.labels, part_id: pf, ...(st ? stPatch(st) : {}) }).select());
  if (x.who.length) await q(sb.from('task_assignees').insert(x.who.map(u => ({ task_id: t.id, user_id: u }))));
}
async function pasteTasks(e, bid){
  const lines = e.clipboardData.getData('text').split(/\r?\n/).map(s => s.replace(/^\s*([-*•·]|\d+[.)])\s*/, '').trim()).filter(Boolean);
  if (lines.length < 2) return;
  e.preventDefault();
  if (!confirm(`¿Crear ${lines.length} tareas?\n\n• ${lines.slice(0, 10).join('\n• ')}${lines.length > 10 ? '\n…' : ''}`)) return;
  const base = -Date.now();
  for (const [i, l] of lines.entries()) await createParsed(l, bid, base + i);
  toast(`${lines.length} tareas creadas`);
}
async function moveTask(t, bid, pos){
  const old = { bucket_id: t.bucket_id, position: t.position };
  if (old.bucket_id === bid && old.position === pos) return;
  Object.assign(t, { bucket_id: bid, position: pos }); render();
  pushUndo('mover tarea', () => q(sb.from('tasks').update(old).eq('id', t.id)));
  await q(sb.from('tasks').update({ bucket_id: bid, position: pos }).eq('id', t.id));
  if (old.bucket_id !== bid) toastUndo(`«${t.title}» movida a ${S.buckets.find(b => b.id === bid)?.name || 'otra columna'}`, () => q(sb.from('tasks').update(old).eq('id', t.id)));
}
async function dropOnCol(e, bid){
  e.preventDefault(); e.currentTarget.classList.remove('over');
  const d = e.dataTransfer.getData('text/plain');
  if (d.startsWith('col:')) { // la columna arrastrada queda justo antes de esta
    const id = d.slice(4), rest = visibleBuckets().filter(b => b.id !== id), i = rest.findIndex(b => b.id === bid);
    if (id === bid || i < 0) return;
    const pos = i > 0 ? (rest[i - 1].position + rest[i].position) / 2 : rest[i].position - 1;
    S.buckets.find(b => b.id === id).position = pos; S.buckets.sort((a, b) => a.position - b.position); render();
    return q(sb.from('buckets').update({ position: pos }).eq('id', id));
  }
  const t = S.tasks.find(x => x.id === d);
  if (t && bid?.startsWith('st:')) { const k = bid.slice(3); if (stOf(t) !== k) updateTask(t.id, stPatch(k), 'mover'); return; }
  if (t && t.bucket_id !== bid) moveTask(t, bid, Date.now());
}
async function dropOnCard(e, targetId){
  const d = e.dataTransfer.getData('text/plain'); if (d.startsWith('col:')) return;
  e.preventDefault(); e.stopPropagation(); e.currentTarget.closest('.col')?.classList.remove('over');
  const t = S.tasks.find(x => x.id === d), target = S.tasks.find(x => x.id === targetId);
  if (!t || !target || t.id === target.id) return;
  if (stMode()) { const k = stOf(target); if (stOf(t) !== k) updateTask(t.id, { ...stPatch(k), position: target.position - 0.5 }, 'mover'); else updateTask(t.id, { position: target.position - 0.5 }, 'mover'); return; }
  const list = colTasks(target.bucket_id).filter(x => x.id !== t.id), i = list.findIndex(x => x.id === targetId);
  moveTask(t, target.bucket_id, i > 0 ? (list[i - 1].position + target.position) / 2 : target.position - 1); // queda encima de la tarjeta destino
}
function setPop(tid, kind){ S.pop = S.pop?.tid === tid && S.pop.kind === kind ? null : { tid, kind }; render(); }
async function cyclePrio(tid){
  const t = S.tasks.find(x => x.id === tid), ks = Object.keys(PRIO), nx = ks[(ks.indexOf(t.priority) + 1) % ks.length];
  await updateTask(tid, { priority: nx }, 'cambio de prioridad');
}
function toggleSel(id){ S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); render(); }
async function bulk(kind, val){
  const ids = [...S.sel]; if (!ids.length || val === '') return;
  if (kind === 'patch') {
    const olds = ids.map(id => { const t = S.tasks.find(x => x.id === id); return [id, Object.fromEntries(Object.keys(val).map(k => [k, t?.[k] ?? null]))]; });
    pushUndo(`cambio en ${ids.length} tareas`, () => Promise.all(olds.map(([id, o]) => q(sb.from('tasks').update(o).eq('id', id)))));
    await q(sb.from('tasks').update(val).in('id', ids));
  }
  else if (kind === 'assign') await q(sb.from('task_assignees').upsert(ids.map(id => ({ task_id: id, user_id: val })), { ignoreDuplicates: true }));
  else if (kind === 'delete') {
    S.sel.clear();
    return trashTasks(ids, `${ids.length} tareas enviadas a la papelera`);
  }
  toast(`${ids.length} tareas actualizadas`);
}
async function quickDone(id){
  const t = S.tasks.find(x => x.id === id);
  if (t.status !== 'completada') { S.flash = id; if (S.tasks.every(x => x.id === id || x.status === 'completada')) confetti(); }
  await updateTask(id, { status: t.status === 'completada' ? 'no_iniciada' : 'completada' }, t.status === 'completada' ? 'reabrir tarea' : 'completar tarea');
}
async function saveTask(patch){ await updateTask(S.tid, patch, 'cambio en la tarea'); }
const undoStack = [];
function pushUndo(label, fn){ undoStack.push({ label, fn }); if (undoStack.length > 30) undoStack.shift(); }
async function undo(){
  track('f:undo');
  const u = undoStack.pop(); if (!u) return toast('No hay nada que deshacer');
  await u.fn(); toast('Deshecho: ' + u.label);
}
async function updateTask(tid, patch, label = 'cambio'){
  const t = S.tasks.find(x => x.id === tid); if (!t) return;
  const old = Object.fromEntries(Object.keys(patch).map(k => [k, t[k] ?? null]));
  if (Object.keys(patch).every(k => (patch[k] ?? null) === old[k])) return;
  Object.assign(t, patch); render(); if (S.modal === 'task') keep(renderModal);
  pushUndo(label, () => q(sb.from('tasks').update(old).eq('id', tid)));
  await q(sb.from('tasks').update(patch).eq('id', tid));
}
function saveDates(patch){
  const t = S.tasks.find(x => x.id === S.tid), s = patch.start_date !== undefined ? patch.start_date : t.start_date, d = patch.due_date !== undefined ? patch.due_date : t.due_date;
  if (s && d && s > d) { toast('La fecha de inicio no puede ser posterior a la fecha límite', 'err'); return keep(renderModal); }
  saveTask(patch);
}
function saveDrive(v){ v = v.trim(); if (v && !okUrl(v)) return toast('El enlace debe empezar por https://', 'err'); saveTask({ drive_url: v || null }); }
async function delTask(){
  const id = S.tid, t = S.tasks.find(x => x.id === id);
  closeModal(); await trashTasks([id], `«${t.title}» enviada a la papelera`);
}
async function trashTasks(ids, msg){
  pushUndo('enviar a la papelera', () => restoreTasks(ids));
  ids.forEach(id => S.hidden.add(id)); render();
  await q(sb.from('tasks').update({ deleted_at: new Date().toISOString() }).in('id', ids));
  toastUndo(msg, () => restoreTasks(ids));
}
async function restoreTasks(ids){
  await q(sb.from('tasks').update({ deleted_at: null }).in('id', ids));
  ids.forEach(id => S.hidden.delete(id)); toast(ids.length > 1 ? `${ids.length} tareas restauradas` : 'Tarea restaurada');
}
async function purgeTasks(ids){
  if (!confirm(ids.length > 1 ? `¿Eliminar DEFINITIVAMENTE ${ids.length} tareas? Se borran también sus chats, subtareas y horas.` : '¿Eliminar DEFINITIVAMENTE esta tarea? Se borran también su chat, subtareas y horas.')) return;
  const imgs = (await q(sb.from('comments').select('images').in('task_id', ids))).flatMap(c => c.images || []);
  await q(sb.from('tasks').delete().in('id', ids));
  if (imgs.length) sb.storage.from('chat').remove(imgs).then(() => {});
  toast('Eliminado definitivamente');
}
function trashHTML(){
  if (!adminOf()) return emptyState('lock', 'Solo para admins', 'La papelera solo la ven los admins del proyecto.');
  const list = [...S.trash].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));
  if (!list.length) return emptyState('trash-2', 'La papelera está vacía', 'Las tareas borradas se guardan aquí 30 días antes de eliminarse solas.');
  return `<div class="page" style="max-width:900px">
    <div class="row" style="margin-bottom:10px"><p class="mut small grow" style="margin:0">Las tareas se eliminan solas 30 días después de borrarlas. Al restaurarlas vuelven con su chat, subtareas y horas.</p>
      <button class="btn bad" onclick="purgeTasks(${esc(JSON.stringify(list.map(t => t.id)))})">${ic('trash-2')} Vaciar papelera</button></div>
    <div class="card-box" style="padding:6px">${list.map(t => { const left = 30 - Math.floor((Date.now() - new Date(t.deleted_at)) / 864e5);
      return `<div class="mrow" style="cursor:default;--p:${PRIO[t.priority][1]}"><span class="prio"></span><div class="t"><b>${esc(t.title)}</b>
        <small class="mut">Borrada por ${esc(pname(t.deleted_by))} · ${ago(t.deleted_at)} · se elimina en ${Math.max(left, 0)} día${left === 1 ? '' : 's'}</small></div>
        <button class="btn sm" onclick="restoreTasks(['${t.id}'])">${ic('undo-2', 'sm')} Restaurar</button>
        <button class="btn sm bad" onclick="purgeTasks(['${t.id}'])">${ic('x', 'sm')} Eliminar</button></div>`; }).join('')}</div></div>`;
}
async function dupTask(){
  const t = S.tasks.find(x => x.id === S.tid);
  const [n] = await q(sb.from('tasks').insert({ project_id: t.project_id, bucket_id: t.bucket_id, title: t.title + ' (copia)', description: t.description,
    drive_url: t.drive_url, priority: t.priority, start_date: t.start_date, due_date: t.due_date, labels: t.labels, position: t.position + 0.001 }).select());
  const subs = await q(sb.from('subtasks').select('title,position').eq('task_id', t.id));
  if (subs.length) await q(sb.from('subtasks').insert(subs.map(s => ({ task_id: n.id, title: s.title, position: s.position }))));
  if (t.task_assignees.length) await q(sb.from('task_assignees').insert(t.task_assignees.map(a => ({ task_id: n.id, user_id: a.user_id }))));
  toast('Tarea duplicada'); await loadProject(); openTask(n.id);
}
function copyLink(){
  const u = taskLink(S.pid, S.tid);
  navigator.clipboard?.writeText(u).then(() => toast('Enlace copiado: pégalo en WhatsApp o donde quieras'), () => prompt('Copia este enlace:', u));
}
async function toggleAssignee(uid, on, tid = S.tid){
  pushUndo(on ? 'asignar' : 'quitar asignación', () => on ? q(sb.from('task_assignees').delete().eq('task_id', tid).eq('user_id', uid)) : q(sb.from('task_assignees').insert({ task_id: tid, user_id: uid })));
  if (on) await q(sb.from('task_assignees').insert({ task_id: tid, user_id: uid }));
  else await q(sb.from('task_assignees').delete().eq('task_id', tid).eq('user_id', uid));
}
async function assignAll(on, tid = S.tid){
  const t = S.tasks.find(x => x.id === tid), had = new Set(t.task_assignees.map(a => a.user_id));
  const ids = on ? members().map(u => u.id).filter(id => !had.has(id)) : [...had];
  if (!ids.length) return;
  const add = () => q(sb.from('task_assignees').upsert(ids.map(u => ({ task_id: tid, user_id: u })), { ignoreDuplicates: true }));
  const del = () => q(sb.from('task_assignees').delete().eq('task_id', tid).in('user_id', ids));
  pushUndo(on ? 'asignar a toda la clase' : 'quitar a toda la clase', on ? del : add);
  await (on ? add() : del());
  toast(on ? `Asignada a toda la clase (${members().length})` : 'Quitada a toda la clase');
}
async function addDep(depId){ await q(sb.from('task_deps').insert({ task_id: S.tid, depends_on: depId })); }
async function delDep(depId){ await q(sb.from('task_deps').delete().match({ task_id: S.tid, depends_on: depId })); }
async function addSub(el){
  const title = el.value.trim(); if (!title) return; el.value = '';
  await q(sb.from('subtasks').insert({ task_id: S.tid, title, position: Date.now(), created_by: S.me.id }));
}
// Acepta "1:30", "1.5", "1,5", "90m", "45 min", "2h"
function parseDuration(v){
  v = (v || '').trim().toLowerCase().replace(',', '.');
  let m;
  if ((m = v.match(/^(\d+):(\d{1,2})$/))) return +m[1] * 60 + +m[2];
  if ((m = v.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minutos?)$/))) return Math.round(+m[1]);
  if ((m = v.match(/^(\d+(?:\.\d+)?)\s*(h|hora|horas)?$/))) return Math.round(+m[1] * 60);
  return NaN;
}
async function logTime(){
  const mins = parseDuration($('#f-hrs').value);
  if (!(mins >= 1 && mins <= 1440)) return toast('Escribe el tiempo así: 1:30, 1.5 o 45m (máx. 24 h)', 'err');
  const note = $('#f-hnote').value.trim() || null;
  await q(sb.from('time_logs').insert({ task_id: S.tid, minutes: mins, note }));
  $('#f-hrs').value = ''; $('#f-hnote').value = ''; toast(`Apuntado: ${fmtMin(mins)}`);
}

/* ============ acciones: chat ============ */
async function sendComment(){
  const el = $('#cbody'), body = el.value.trim(), pics = S.cdraft; if ((!body && !pics.length) || S.busy) return;
  const links = [...new Set(body.match(/https?:\/\/[^\s<>"']+/g) || [])];
  const mentions = members().filter(p => body.includes('@' + pname(p.id))).map(p => p.id);
  const reply_to = S.reply, tid = S.tid; S.reply = null; S.cdraft = []; chatDraft(tid, null);
  el.value = ''; $('#mbox').innerHTML = '';
  if (pics.length) { S.busy = true; keep(renderModal); }
  try {
    const images = [];
    for (const im of pics) {
      const path = `${tid}/${newId()}.jpg`;
      const { error } = await sb.storage.from('chat').upload(path, im.blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      images.push(path);
    }
    await q(sb.from('comments').insert({ task_id: tid, body, links, mentions, reply_to, images }));
    pics.forEach(im => URL.revokeObjectURL(im.url));
  } catch (e) { toast('No se pudo enviar: ' + (e.message || e), 'err'); if ($('#cbody')) $('#cbody').value = body; chatDraft(tid, body); S.reply = reply_to; S.cdraft = pics; }
  S.busy = false; if (S.modal === 'task') keep(renderModal);
}
async function addChatImages(files){
  for (const f of [...files].filter(f => f.type.startsWith('image/'))) {
    if (S.cdraft.length >= 4) { toast('Máximo 4 fotos por mensaje', 'err'); break; }
    try { const blob = await compress(f); S.cdraft.push({ blob, url: URL.createObjectURL(blob) }); }
    catch { toast(`No se pudo leer «${f.name}». Prueba con JPG o PNG.`, 'err'); }
  }
  keep(renderModal);
}
function pasteChatImages(e){
  const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
  if (files.length) { e.preventDefault(); addChatImages(files); }
}
async function sendReady(){
  if (!confirm('¿Avisar a los admins de que has terminado tu parte de esta tarea?')) return;
  await q(sb.from('comments').insert({ task_id: S.tid, kind: 'ready', body: '✅ He terminado mi parte. Lista para revisar.' }));
}
function mentionInput(el){
  const m = el.value.slice(0, el.selectionStart).match(/@([^\s@]*)$/);
  const box = $('#mbox');
  if (!m) { box.innerHTML = ''; return; }
  box.innerHTML = members().filter(p => p.id !== S.me.id && norm(pname(p.id)).includes(norm(m[1]))).slice(0, 6)
    .map(p => `<button type="button" onmousedown="event.preventDefault();pickMention('${p.id}')">${av(p.id)} ${esc(pname(p.id))}</button>`).join('');
}
function pickMention(id){
  const el = $('#cbody'), pos = el.selectionStart;
  const before = el.value.slice(0, pos).replace(/@([^\s@]*)$/, '@' + pname(id) + ' ');
  el.value = before + el.value.slice(pos); el.focus(); el.setSelectionRange(before.length, before.length);
  $('#mbox').innerHTML = '';
}
function mentionify(c){
  let h = linkify(c.body);
  for (const id of c.mentions || []) { const n = esc('@' + pname(id)); h = h.split(n).join(`<span class="men">${n}</span>`); }
  return h;
}
function setReply(id){ S.reply = id; keep(renderModal); $('#cbody').focus(); }
async function editComment(id){
  const c = S.comments.find(x => x.id === id), v = prompt('Edita tu mensaje:', c.body);
  if (v == null || !v.trim() || v.trim() === c.body) return;
  const data = await q(sb.from('comments').update({ body: v.trim() }).eq('id', id).select());
  if (!data.length) toast('Ya han pasado más de 5 minutos: no se puede editar', 'err');
}
async function delComment(id){ if (confirm('¿Borrar este mensaje?')) await q(sb.from('comments').delete().eq('id', id)); }
async function react(cid, emoji, had){
  if (had) await q(sb.from('comment_reactions').delete().match({ comment_id: cid, user_id: S.me.id, emoji }));
  else await q(sb.from('comment_reactions').insert({ comment_id: cid, emoji }));
}
// "Fulano está escribiendo…": mensajes efímeros por Realtime, no se guardan
let tch, typingAt = 0, typingTimers = {};
function typingChannel(tid){
  if (tch) { sb.removeChannel(tch); tch = null; }
  typingTimers = {};
  if (!tid) return;
  tch = sb.channel('typing:' + tid).on('broadcast', { event: 'typing' }, ({ payload }) => {
    if (payload.id === S.me.id) return;
    clearTimeout(typingTimers[payload.id]);
    typingTimers[payload.id] = setTimeout(() => { delete typingTimers[payload.id]; showTyping(); }, 3500);
    showTyping();
  }).subscribe();
}
function showTyping(){
  const el = $('#typing'); if (!el) return;
  const ns = Object.keys(typingTimers).map(first);
  el.textContent = ns.length ? `${ns.join(', ')} ${ns.length > 1 ? 'están' : 'está'} escribiendo…` : '';
}
function sendTyping(){ if (tch && Date.now() - typingAt > 2000) { typingAt = Date.now(); tch.send({ type: 'broadcast', event: 'typing', payload: { id: S.me.id } }); } }

/* ============ acciones: miembros ============ */
async function approve(id, ok){ await q(sb.from('profiles').update({ approved: ok }).eq('id', id)); }
async function reject(id){ if (confirm('¿Rechazar esta solicitud?')) await q(sb.from('profiles').delete().eq('id', id)); }

/* ============ búsqueda ============ */
async function doSearch(v){
  v = v.replace(/[,()%*\\]/g, ' ').trim();
  if (v.length < 2) { S.found = null; if (S.panel === 'search') S.panel = null; return keep(render); }
  const [ts, cs] = await Promise.all([
    q(sb.from('tasks').select('id,title,project_id').or(`title.ilike.%${v}%,description.ilike.%${v}%`).is('deleted_at', null).limit(15)),
    q(sb.from('comments').select('body,task_id,user_id,tasks(title,project_id,deleted_at)').ilike('body', `%${v}%`).order('created_at', { ascending:false }).limit(15)),
  ]);
  const pn = id => proj(id)?.name || '';
  S.found = { q: v, items: [
    ...ts.map(t => ({ p: t.project_id, t: t.id, icon: '📋', title: t.title, sub: pn(t.project_id) })),
    ...cs.filter(c => c.tasks && !c.tasks.deleted_at).map(c => ({ p: c.tasks.project_id, t: c.task_id, icon: '💬', title: c.body.slice(0, 80), sub: `${pname(c.user_id)} en «${c.tasks.title}» · ${pn(c.tasks.project_id)}` })),
  ] };
  S.panel = 'search'; keep(render);
}

/* ============ exportar ============ */
// Informe: se abre en una pestaña nueva lista para "Guardar como PDF"
async function exportReport(){
  track('f:report');
  const w = window.open('', '_blank');
  if (!w) return toast('Permite las ventanas emergentes para generar el informe', 'err');
  const p = proj();
  const act = await q(sb.from('activity').select('*').eq('project_id', p.id).order('created_at'));
  const wl = workload(), names = t => t.task_assignees.map(a => esc(pname(a.user_id))).join(', ') || '—';
  const tasks = [...S.tasks].sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const done = S.tasks.filter(t => t.status === 'completada').length, totalMin = S.tlogs.reduce((a, l) => a + l.minutes, 0);
  const admins = [...S.profiles.filter(x => x.is_admin).map(x => x.id), ...adminsOf(p.id)].map(pname).map(esc).join(', ');
  const logo = new URL('logo-full.png', location.href).href;
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe – ${esc(p.name)}</title><style>
    body{font:12px/1.45 Inter,system-ui,Segoe UI,Roboto,sans-serif;color:#111;margin:28px}h1{margin:0;font-size:22px}h2{font-size:14px;margin:22px 0 8px;border-bottom:2px solid ${esc(p.color)};padding-bottom:4px}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #d5d8de;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f1f2f5}.m{color:#666}
    .hd{display:flex;align-items:center;gap:14px}.hd img{height:48px}
    .k{display:flex;gap:16px;margin-top:12px;flex-wrap:wrap}.k div{border:1px solid #ddd;border-radius:8px;padding:8px 14px}.k b{font-size:18px;display:block}
    @media print{button{display:none}}</style></head><body>
    <button onclick="print()" style="float:right;padding:8px 14px">Guardar como PDF</button>
    <div class="hd"><img src="${logo}" onerror="this.remove()"><div><h1>${esc(p.name)}</h1><div class="m">${SCHOOL} · Informe generado el ${new Date().toLocaleString('es-ES')}</div></div></div>
    ${p.description ? `<p>${esc(p.description)}</p>` : ''}<p class="m">Admins: ${admins}</p>
    <div class="k"><div><b>${S.tasks.length}</b>tareas</div><div><b>${done}</b>completadas</div><div><b>${S.tasks.length ? Math.round(done / S.tasks.length * 100) : 0}%</b>progreso</div><div><b>${fmtMin(totalMin)}</b>dedicadas</div>${p.due_date ? `<div><b>${new Date(p.due_date + 'T00:00').toLocaleDateString('es-ES')}</b>entrega</div>` : ''}</div>
    <h2>Participación del equipo</h2><table><tr><th>Persona</th><th>Tareas</th><th>Completadas</th><th>Vencidas</th><th>Horas</th><th>Mensajes</th></tr>
    ${wl.map(x => `<tr><td>${esc(pname(x.u.id))}</td><td>${x.total}</td><td>${x.done}</td><td>${x.late}</td><td>${fmtMin(x.mins)}</td><td>${x.msgs}</td></tr>`).join('')}</table>
    <h2>Tareas</h2><table><tr><th>Tarea</th><th>Responsables</th><th>Prioridad</th><th>Estado</th><th>Inicio</th><th>Límite</th><th>Completada</th><th>Horas</th></tr>
    ${tasks.map(t => `<tr><td>${esc(t.title)}${(t.labels || []).length ? `<br><span class="m">${esc(t.labels.join(', '))}</span>` : ''}</td><td>${names(t)}</td><td>${PRIO[t.priority][0]}</td><td>${STATUS[t.status]}</td>
      <td>${t.start_date ? fmtD(t.start_date) : '—'}</td><td>${t.due_date ? fmtD(t.due_date) : '—'}</td><td>${t.completed_at ? new Date(t.completed_at).toLocaleDateString('es-ES') : '—'}</td><td>${minutesOf(t.id) ? fmtMin(minutesOf(t.id)) : '—'}</td></tr>`).join('')}</table>
    <h2>Diario del proyecto</h2>${S.posts.length ? `<table><tr><th style="width:130px">Fecha</th><th style="width:150px">Autor</th><th>Publicación</th></tr>${[...S.posts].reverse().map(x => `<tr><td>${new Date(x.created_at).toLocaleString('es-ES', { dateStyle:'short', timeStyle:'short' })}</td><td>${esc(pname(x.user_id))}</td><td>${esc(x.body)}${x.poll_options ? `<br><span class="m">Encuesta: ${x.poll_options.map((o, i) => `${esc(o)} (${S.votes.filter(v => v.post_id === x.id && v.option === i).length})`).join(' · ')}</span>` : ''}${x.images.length ? `<br><span class="m">${x.images.length} foto(s)</span>` : ''}</td></tr>`).join('')}</table>` : '<p class="m">Sin publicaciones.</p>'}
    <h2>Historial completo</h2><table><tr><th style="width:130px">Fecha</th><th style="width:150px">Persona</th><th>Acción</th></tr>
    ${act.map(a => `<tr><td>${new Date(a.created_at).toLocaleString('es-ES', { dateStyle:'short', timeStyle:'short' })}</td><td>${esc(pname(a.actor_id))}</td><td>${actText(a).replace(/<i data-lucide[^>]*><\/i>/g, '')}</td></tr>`).join('')}</table>
    </body></html>`);
  w.document.close();
}
async function exportPersonReport(uid){
  if (!isOwner()) return;
  const w = window.open('', '_blank');
  if (!w) return toast('Permite las ventanas emergentes para generar el informe', 'err');
  w.document.write('<p style="font:14px system-ui;padding:20px">Preparando el informe…</p>');
  const u = prof(uid);
  const [tasks, logs, coms, subs, posts] = await Promise.all([
    q(sb.from('tasks').select('id,title,status,priority,start_date,due_date,completed_at,project_id,task_assignees!inner(user_id)').eq('task_assignees.user_id', uid).is('deleted_at', null)),
    q(sb.from('time_logs').select('minutes,logged_on,note,task_id,tasks(title,project_id)').eq('user_id', uid).order('logged_on')),
    q(sb.from('comments').select('created_at,kind,tasks(project_id)').eq('user_id', uid)),
    q(sb.from('subtasks').select('done,tasks(project_id)').eq('created_by', uid)),
    q(sb.from('posts').select('project_id').eq('user_id', uid)),
  ]);
  const onTime = t => t.status === 'completada' && t.due_date && t.completed_at && t.completed_at.slice(0, 10) <= t.due_date;
  const lateDone = t => t.status === 'completada' && t.due_date && t.completed_at && t.completed_at.slice(0, 10) > t.due_date;
  const overdue = t => t.status !== 'completada' && t.due_date && daysLeft(t.due_date) < 0;
  const pids = [...new Set([...tasks.map(t => t.project_id), ...logs.map(l => l.tasks?.project_id), ...coms.map(c => c.tasks?.project_id)].filter(Boolean))];
  const per = pids.map(pid => { const ts = tasks.filter(t => t.project_id === pid);
    return { p: proj(pid), n: ts.length, done: ts.filter(t => t.status === 'completada').length, ok: ts.filter(onTime).length, late: ts.filter(lateDone).length, over: ts.filter(overdue).length,
      mins: logs.filter(l => l.tasks?.project_id === pid).reduce((a, l) => a + l.minutes, 0), msgs: coms.filter(c => c.tasks?.project_id === pid && c.kind === 'msg').length,
      ready: coms.filter(c => c.tasks?.project_id === pid && c.kind === 'ready').length, subs: subs.filter(x => x.tasks?.project_id === pid).length,
      admin: S.padmins.some(a => a.project_id === pid && a.user_id === uid) }; });
  const tot = k => per.reduce((a, x) => a + x[k], 0), done = tasks.filter(t => t.status === 'completada').length;
  const punct = tasks.filter(t => t.status === 'completada' && t.due_date).length ? Math.round(tasks.filter(onTime).length / tasks.filter(t => t.status === 'completada' && t.due_date).length * 100) + '%' : '—';
  const pn = id => esc(proj(id)?.name || '—'), logo = new URL('logo-full.png', location.href).href;
  w.document.open();
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe – ${esc(pname(uid))}</title><style>
    body{font:12px/1.45 Inter,system-ui,Segoe UI,Roboto,sans-serif;color:#111;margin:28px}h1{margin:0;font-size:22px}h2{font-size:14px;margin:22px 0 8px;border-bottom:2px solid #f39200;padding-bottom:4px}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #d5d8de;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f1f2f5}.m{color:#666}.ok{color:#15803d}.bad{color:#b91c1c}
    .hd{display:flex;align-items:center;gap:14px}.hd img{height:48px}
    .k{display:flex;gap:12px;margin-top:12px;flex-wrap:wrap}.k div{border:1px solid #ddd;border-radius:8px;padding:8px 14px}.k b{font-size:18px;display:block}
    @media print{button{display:none}}</style></head><body>
    <button onclick="print()" style="float:right;padding:8px 14px">Guardar como PDF</button>
    <div class="hd"><img src="${logo}" onerror="this.remove()"><div><h1>${esc(pname(uid))}</h1><div class="m">${esc(u?.email)} · ${SCHOOL}</div><div class="m">Informe individual generado el ${new Date().toLocaleString('es-ES')} · Documento interno</div></div></div>
    <div class="k"><div><b>${tasks.length}</b>tareas asignadas</div><div><b>${done}</b>completadas</div><div><b>${punct}</b>entregadas a tiempo</div><div><b>${tasks.filter(overdue).length}</b>vencidas sin terminar</div>
      <div><b>${fmtMin(logs.reduce((a, l) => a + l.minutes, 0))}</b>horas apuntadas</div><div><b>${coms.filter(c => c.kind === 'msg').length}</b>mensajes</div><div><b>${subs.length}</b>subtareas creadas</div><div><b>${posts.length}</b>publicaciones en diarios</div></div>
    <h2>Resumen por proyecto</h2><table><tr><th>Proyecto</th><th>Rol</th><th>Tareas</th><th>Completadas</th><th>A tiempo</th><th>Tarde</th><th>Vencidas</th><th>Horas</th><th>Mensajes</th><th>"Terminé mi parte"</th><th>Subtareas</th></tr>
    ${per.map(x => `<tr><td>${esc(x.p?.name || '—')}${x.p?.archived ? ' <span class="m">(archivado)</span>' : ''}</td><td>${x.admin ? 'Admin' : u?.is_admin ? 'Propietario' : 'Miembro'}</td><td>${x.n}</td><td>${x.done}</td><td class="ok">${x.ok}</td><td class="bad">${x.late}</td><td class="bad">${x.over}</td><td>${fmtMin(x.mins)}</td><td>${x.msgs}</td><td>${x.ready}</td><td>${x.subs}</td></tr>`).join('') || '<tr><td colspan="11" class="m">Sin actividad en proyectos.</td></tr>'}
    ${per.length > 1 ? `<tr style="font-weight:600"><td>Total</td><td></td><td>${tot('n')}</td><td>${tot('done')}</td><td>${tot('ok')}</td><td>${tot('late')}</td><td>${tot('over')}</td><td>${fmtMin(tot('mins'))}</td><td>${tot('msgs')}</td><td>${tot('ready')}</td><td>${tot('subs')}</td></tr>` : ''}</table>
    <h2>Tareas</h2><table><tr><th>Tarea</th><th>Proyecto</th><th>Estado</th><th>Inicio</th><th>Límite</th><th>Completada</th><th>Cumplimiento</th></tr>
    ${[...tasks].sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999')).map(t => `<tr><td>${esc(t.title)}</td><td>${pn(t.project_id)}</td><td>${STATUS[t.status]}</td><td>${t.start_date ? fmtD(t.start_date) : '—'}</td><td>${t.due_date ? fmtD(t.due_date) : '—'}</td>
      <td>${t.completed_at ? new Date(t.completed_at).toLocaleDateString('es-ES') : '—'}</td><td>${onTime(t) ? '<span class="ok">A tiempo</span>' : lateDone(t) ? '<span class="bad">Tarde</span>' : overdue(t) ? '<span class="bad">Vencida</span>' : '—'}</td></tr>`).join('') || '<tr><td colspan="7" class="m">Sin tareas asignadas.</td></tr>'}</table>
    <h2>Horas apuntadas</h2>${logs.length ? `<table><tr><th>Fecha</th><th>Tarea</th><th>Proyecto</th><th>Tiempo</th><th>Nota</th></tr>${logs.map(l => `<tr><td>${new Date(l.logged_on + 'T00:00').toLocaleDateString('es-ES')}</td><td>${esc(l.tasks?.title || '—')}</td><td>${pn(l.tasks?.project_id)}</td><td>${fmtMin(l.minutes)}</td><td>${esc(l.note || '')}</td></tr>`).join('')}</table>` : '<p class="m">No ha apuntado horas.</p>'}
    </body></html>`);
  w.document.close();
}
async function exportExcel(){
  try { if (!window.XLSX) await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'); }
  catch { return toast('No se pudo cargar el generador de Excel. Revisa tu conexión.', 'err'); }
  const p = proj(), act = await q(sb.from('activity').select('*').eq('project_id', p.id).order('created_at'));
  const strip = h => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const bname = id => S.buckets.find(b => b.id === id)?.name || 'Sin columna';
  const tareas = [...S.tasks].sort((a, b) => bname(a.bucket_id).localeCompare(bname(b.bucket_id)) || a.position - b.position).map(t => ({
    'Tarea': t.title, 'Columna': bname(t.bucket_id), 'Estado': STATUS[t.status], 'Prioridad': PRIO[t.priority][0],
    'Responsables': t.task_assignees.map(a => pname(a.user_id)).join(', '), 'Inicio': t.start_date || '', 'Fecha límite': t.due_date || '',
    'Completada el': t.completed_at ? t.completed_at.slice(0, 10) : '', 'Etiquetas': (t.labels || []).join(', '),
    'Subtareas': t.subtasks.length ? `${t.subtasks.filter(s => s.done).length}/${t.subtasks.length}` : '', 'Horas': +(minutesOf(t.id) / 60).toFixed(2),
    'Mensajes': (t.comments || []).length, 'Depende de': depsOf(t).map(x => x.title).join(', '), 'Descripción': t.description || '' }));
  const equipo = workload().map(x => ({ 'Persona': pname(x.u.id), 'Rol': x.u.is_admin ? 'Propietario' : adminsOf(p.id).includes(x.u.id) ? 'Admin' : 'Miembro',
    'Tareas': x.total, 'Completadas': x.done, 'Vencidas': x.late, 'Horas': +(x.mins / 60).toFixed(2), 'Mensajes': x.msgs }));
  const horas = S.tlogs.map(l => ({ 'Fecha': l.logged_on, 'Persona': pname(l.user_id), 'Tarea': S.tasks.find(t => t.id === l.task_id)?.title || '', 'Horas': +(l.minutes / 60).toFixed(2), 'Nota': l.note || '' }));
  const hist = act.map(a => ({ 'Fecha': new Date(a.created_at).toLocaleString('es-ES'), 'Persona': pname(a.actor_id), 'Acción': strip(actText(a)) }));
  const wb = XLSX.utils.book_new();
  const add = (rows, name) => { const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '': 'Sin datos' }]);
    ws['!cols'] = Object.keys(rows[0] || { '': '' }).map(k => ({ wch: Math.min(60, Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)) + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, name); };
  const material = S.materials.map(m => ({ 'Artículo': m.name, 'Cantidad': +m.qty, 'Unidad': m.unit, 'Precio ud. (€)': m.unit_price ?? '', 'Total (€)': m.unit_price != null ? +(m.unit_price * m.qty).toFixed(2) : '',
    'Proveedor': m.supplier || '', 'Estado': MAT_STATUS[m.status][0], 'Enlace': m.link || '' }));
  add(tareas, 'Tareas'); add(equipo, 'Equipo'); add(horas, 'Horas'); if (material.length) add(material, 'Material'); add(hist, 'Historial');
  track('f:excel');
  XLSX.writeFile(wb, `${p.name.replace(/[\\/:*?"<>|]/g, '')} - Planner SEA.xlsx`);
  toast('Excel descargado');
}


/* ============ Respuestas rápidas y mensajes fijados ============ */
function quickRepliesHTML(){
  const mine = S.me.quick_replies || [];
  return `<div class="qr">${[...QUICK, ...mine].map((t, i) => `<span class="qrb"><button onclick="useQuick(${i})">${esc(t)}</button>${i >= QUICK.length ? `<button class="x" title="Quitar" onclick="delQuick(${i - QUICK.length})">${ic('x', 'sm')}</button>` : ''}</span>`).join('')}
    <span class="qrb"><input id="qr-new" placeholder="+ Añadir la tuya (Enter)" onkeydown="if(event.key==='Enter')addQuick(this.value)"></span></div>`;
}
function useQuick(i){
  track('f:quick');
  const t = [...QUICK, ...(S.me.quick_replies || [])][i], el = $('#cbody');
  el.value = (el.value.trim() ? el.value.trimEnd() + ' ' : '') + t; S.qr = false; keep(renderModal); $('#cbody').focus();
}
async function addQuick(v){
  v = v.trim(); if (!v) return;
  const list = [...(S.me.quick_replies || []), v].slice(-15);
  S.me.quick_replies = list; keep(renderModal); if ($('#qr-new')) $('#qr-new').value = '';
  await q(sb.from('profiles').update({ quick_replies: list }).eq('id', S.me.id));
}
async function delQuick(i){
  const list = (S.me.quick_replies || []).filter((_, k) => k !== i);
  S.me.quick_replies = list; keep(renderModal); await q(sb.from('profiles').update({ quick_replies: list }).eq('id', S.me.id));
}
async function pinComment(id){ const on = await q(sb.rpc('toggle_pin_comment', { p_id: id })); toast(on ? 'Mensaje fijado arriba del chat' : 'Mensaje desfijado'); }
