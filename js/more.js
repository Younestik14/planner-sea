/* ============ Tablón de clase (publicaciones sin proyecto: todos publican, reaccionan y votan) ============ */
const CLASS_DIR = '00000000-0000-0000-0000-000000000000'; // carpeta de las fotos del tablón en el bucket "diario"
const allPosts = () => [...S.posts, ...S.cposts];
const allVotes = () => [...S.votes, ...S.cvotes];
const allReacts = () => [...S.preacts, ...S.creacts];
async function loadClass(){
  const posts = await q(sb.from('posts').select('*').is('project_id', null).order('created_at', { ascending:false }).limit(100));
  const ids = posts.map(p => p.id);
  const [votes, reacts] = ids.length ? await Promise.all([q(sb.from('post_votes').select('*').in('post_id', ids)), q(sb.from('post_reactions').select('*').in('post_id', ids))]) : [[], []];
  Object.assign(S, { cposts: posts, cvotes: votes, creacts: reacts });
  await signImages('diario', posts.flatMap(p => p.images));
}
function tablonHTML(){
  return `<div class="page"><h1 style="margin-bottom:4px">Tablón de clase</h1>
    <p class="mut" style="margin-top:0">Avisos, encuestas y cosas de clase que no son de un proyecto. Cualquiera puede publicar.</p>${diaryHTML()}</div>`;
}

/* ============ Apuntes compartidos por módulo ============ */
async function loadNotes(){
  S.notes = await q(sb.from('module_notes').select('*').order('created_at', { ascending:false }));
  await signImages('apuntes', S.notes.filter(n => n.image).map(n => n.image));
}
function notesHTML(){
  const subs = S.settings?.timetable?.subjects || {}, f = S.apMod, D = S.ndraft;
  const list = S.notes.filter(n => !f || n.module === f);
  const card = n => { const m = subs[n.module], img = n.image && imgUrl('apuntes', n.image);
    return `<div class="card-box note-c" style="--c:${m?.color || 'var(--acc)'}">
      ${img ? `<img src="${esc(img)}" alt="${esc(n.title)}" loading="lazy" onclick="lightbox(this.src)">` : n.image ? `<div class="note-ph">${ic('image')}</div>` : ''}
      <div class="note-b"><b>${okUrl(n.url) ? `<a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)} ${ic('external-link', 'sm')}</a>` : esc(n.title)}</b>
        <small class="mut">${m ? esc(m.short) + ' · ' : ''}${esc(first(n.created_by))} · ${fmtD(n.created_at.slice(0, 10))}</small></div>
      ${n.created_by === S.me.id || isOwner() ? `<button class="ico" title="Borrar" onclick="delNote('${n.id}')">${ic('trash-2', 'sm')}</button>` : ''}</div>`; };
  return `<div class="page" style="max-width:none"><div class="row" style="flex-wrap:wrap;margin-bottom:4px"><h1 class="grow" style="margin:0">Apuntes</h1>
      <select style="width:auto" aria-label="Filtrar por módulo" onchange="S.apMod=this.value||null;render()"><option value="">Todos los módulos</option>
        ${Object.entries(subs).map(([k, m]) => `<option value="${k}" ${k === f ? 'selected' : ''}>${esc(m.short)} (${S.notes.filter(n => n.module === k).length})</option>`).join('')}</select></div>
    <p class="mut" style="margin-top:0">Enlaces y fotos de la pizarra de cada asignatura. Cualquiera puede subirlos.</p>
    <div class="card-box" style="margin-bottom:16px"><div class="grid4" style="grid-template-columns:1fr 2fr 2fr auto;align-items:end">
      <div><label>Módulo</label><select id="nt-mod">${Object.entries(subs).map(([k, m]) => `<option value="${k}" ${k === (D.mod || f) ? 'selected' : ''}>${esc(m.short)}</option>`).join('')}</select></div>
      <div><label>Título</label><input id="nt-title" maxlength="200" value="${esc(D.title)}" placeholder="Ej.: Tema 4 – Centros de transformación" oninput="S.ndraft.title=this.value"></div>
      <div><label>Enlace <small>(o sube una foto)</small></label><input id="nt-url" value="${esc(D.url)}" placeholder="https://drive.google.com/…" oninput="S.ndraft.url=this.value"></div>
      <div class="row"><label class="btn" style="margin:0" title="Foto de la pizarra o de los apuntes">${ic(D.blob ? 'image-check' : 'camera')}${D.blob ? ' Foto lista' : ' Foto'}<input type="file" accept="image/*" hidden onchange="noteImage(this.files[0])"></label>
        <button class="btn pri" ${S.busy ? 'disabled' : ''} onclick="addNote()">${ic('plus')} Subir</button></div></div></div>
    <div class="notes">${list.map(card).join('') || emptyState('book-open', 'Sin apuntes todavía', 'Sube el primero con el formulario de arriba.')}</div></div>`;
}
async function noteImage(file){
  if (!file) return;
  try { S.ndraft.blob = await compress(file); S.ndraft.mod = $('#nt-mod').value; if (!S.ndraft.title) S.ndraft.title = 'Pizarra ' + fmtD(today()); render(); }
  catch { toast('No se pudo leer la foto. Prueba con JPG o PNG.', 'err'); }
}
async function addNote(){
  const D = S.ndraft, title = $('#nt-title').value.trim(), url = $('#nt-url').value.trim(), module = $('#nt-mod').value;
  if (!module) return toast('Primero hay que poner las asignaturas en el horario', 'err');
  if (!title) return toast('Pon un título', 'err');
  if (url && !okUrl(url)) return toast('El enlace debe empezar por https://', 'err');
  if (!url && !D.blob) return toast('Pon un enlace o sube una foto', 'err');
  S.busy = true; render();
  try {
    let image = null;
    if (D.blob) { image = `${S.me.id}/${newId()}.jpg`; const { error } = await sb.storage.from('apuntes').upload(image, D.blob, { contentType: 'image/jpeg' }); if (error) throw error; }
    await q(sb.from('module_notes').insert({ module, title, url: url || null, image }));
    S.ndraft = { title:'', url:'', blob:null, mod: module }; await loadNotes(); toast('Apunte subido');
  } catch (e) { toast('No se pudo subir: ' + (e.message || e), 'err'); }
  S.busy = false; render();
}
async function delNote(id){
  const n = S.notes.find(x => x.id === id); if (!confirm('¿Borrar este apunte?')) return;
  S.notes = S.notes.filter(x => x.id !== id); render();
  await q(sb.from('module_notes').delete().eq('id', id));
  if (n.image) sb.storage.from('apuntes').remove([n.image]).then(() => {});
}

/* ============ Seguimiento (solo propietario): quién va al día ============ */
async function loadTrack(){
  S.track = await q(sb.from('tasks').select('id,title,due_date,project_id,status,task_assignees(user_id)').is('deleted_at', null).neq('status', 'completada'));
}
function trackHTML(){
  const live = t => { const p = proj(t.project_id); return p && !p.is_template && !p.archived; };
  const ts = S.track.filter(live), td = today();
  const rows = members().map(u => {
    const mine = ts.filter(t => t.task_assignees.some(a => a.user_id === u.id));
    const late = mine.filter(t => t.due_date && t.due_date < td).sort((a, b) => a.due_date.localeCompare(b.due_date));
    const next = mine.filter(t => t.due_date && t.due_date >= td).sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
    const seen = u.last_seen_at ? Math.floor((Date.now() - new Date(u.last_seen_at)) / 864e5) : null;
    return { u, mine, late, next, seen };
  }).sort((a, b) => b.late.length - a.late.length || (b.seen ?? 999) - (a.seen ?? 999));
  const free = ts.filter(t => !t.task_assignees.length);
  return `<div class="page" style="max-width:none"><h1 style="margin-bottom:4px">Seguimiento</h1>
    <p class="mut" style="margin-top:0">Quién va al día: tareas abiertas y vencidas de cada uno en los proyectos activos, y cuándo entró por última vez. Solo lo ves tú.</p>
    <div class="kpis"><div class="card-box kpi"><b>${ts.length}</b><span>Tareas abiertas</span></div>
      <div class="card-box kpi"><b style="color:var(--bad-t)">${ts.filter(t => t.due_date && t.due_date < td).length}</b><span>Vencidas</span></div>
      <div class="card-box kpi"><b>${rows.filter(r => r.late.length).length}</b><span>Personas con retraso</span></div>
      <div class="card-box kpi"><b>${free.length}</b><span>Sin asignar</span></div></div>
    <div class="card-box tablewrap" style="margin-top:14px"><table class="ltable"><thead><tr><th>Persona</th><th>Abiertas</th><th>Vencidas</th><th>Próxima fecha</th><th>Último acceso</th></tr></thead><tbody>
    ${rows.map(r => `<tr onclick="go('person',{uid:'${r.u.id}'})"><td><div class="row">${av(r.u.id)} ${esc(pname(r.u.id))}</div></td><td>${r.mine.length}</td>
      <td>${r.late.length ? `<b style="color:var(--bad-t)">${r.late.length}</b> <small class="mut">${r.late.slice(0, 2).map(t => esc(t.title)).join(', ')}${r.late.length > 2 ? '…' : ''}</small>` : '<span style="color:var(--ok-t)">✓ Al día</span>'}</td>
      <td>${r.next ? `${fmtD(r.next.due_date)} <small class="mut">${esc(r.next.title)}</small>` : '—'}</td>
      <td>${r.seen == null ? '<span class="mut">Nunca</span>' : r.seen === 0 ? 'Hoy' : `<span style="${r.seen > 7 ? 'color:var(--warn-t)' : ''}">Hace ${r.seen} día${r.seen === 1 ? '' : 's'}</span>`}</td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ============ Inicio: tarjeta «Hoy» ============ */
function todayHTML(){
  const td = today(), tm = addDays(td, 1);
  const sh = S.exams.filter(e => e.exam_date === td || e.exam_date === tm);
  const ev = S.pitems.filter(x => x.day === td && x.kind === 'event').sort((a, b) => (a.at_time || '99').localeCompare(b.at_time || '99'));
  const plan = S.pitems.filter(x => x.day === td && x.kind === 'plan').sort((a, b) => a.position - b.position);
  const due = S.mine.filter(t => t.status !== 'completada' && t.due_date === td);
  const ents = S.projects.filter(p => p.due_date === td && !p.is_template && !p.archived);
  return `<div class="card-box today-c"><h3>${ic('sun')} Hoy <button class="btn ghost sm" style="margin-left:auto" onclick="openDay('${td}')">${ic('list-checks', 'sm')} Mi plan</button></h3>
    ${nowClassHTML().replace('card-box nowcls', 'nowcls')}
    ${sh.map(e => `<div class="today-i bad" onclick="editExam('${e.id}')">${ic(e.kind === 'event' ? 'calendar' : 'graduation-cap', 'sm')} <b>${e.exam_date === td ? 'Hoy' : 'Mañana'}:</b> ${esc(e.title)}</div>`).join('')}
    ${ents.map(p => `<div class="today-i bad" onclick="goProject('${p.id}')">${ic('flag', 'sm')} <b>Entrega hoy:</b> ${esc(p.name)}</div>`).join('')}
    ${due.map(t => `<div class="today-i" onclick="jump('${t.project_id}','${t.id}')">${ic('square-check', 'sm')} <b>Vence hoy:</b> ${esc(t.title)}</div>`).join('')}
    ${ev.map(x => `<div class="today-i">${ic('lock', 'sm')} ${x.at_time ? `<b>${x.at_time}</b> ` : ''}${esc(x.title)}</div>`).join('')}
    ${plan.map(x => `<label class="today-i check"><input type="checkbox" ${x.done ? 'checked' : ''} onchange="togglePItem('${x.id}',this.checked).then(render)"> <span class="${x.done ? 'done' : ''}">${esc(x.title)}</span></label>`).join('')}
    ${!sh.length && !ents.length && !due.length && !ev.length && !plan.length ? `<p class="small mut" style="margin:6px 0 0">Nada apuntado para hoy. Pulsa «Mi plan» para organizarte el día.</p>` : ''}</div>`;
}

/* ============ Avisos del navegador (con la web abierta en otra pestaña) ============ */
async function toggleBrowserNotifs(){
  if (!('Notification' in window)) return toast('Este navegador no permite avisos', 'err');
  if (ls('bnotif')) { ls('bnotif', false); render(); return toast('Avisos del navegador desactivados'); }
  const p = await Notification.requestPermission();
  if (p !== 'granted') return toast('Has bloqueado los avisos. Actívalos en el candado de la barra de direcciones.', 'err');
  ls('bnotif', true); render(); new Notification('Planner SEA', { body: 'Así te llegarán los avisos cuando tengas la web en otra pestaña.', icon: 'favicon.png' });
}
function browserNotify(list){
  if (!ls('bnotif') || !document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
  (list.length > 3 ? [{ message: `Tienes ${list.length} avisos nuevos` }] : list).forEach(n => {
    const x = new Notification('Planner SEA', { body: n.message, icon: 'favicon.png', tag: n.id });
    x.onclick = () => { window.focus(); x.close(); if (n.id) clickNotif(n.id); };
  });
}

/* ============ Borradores del chat de cada tarea ============ */
const chatDraft = (tid, v) => v === undefined ? ls('draft:' + tid) || '' : ls('draft:' + tid, v || null);

/* ============ Calendario: vista semanal y arrastrar cosas privadas ============ */
async function dropPItem(ev, day){
  ev.preventDefault(); ev.currentTarget.classList.remove('over');
  const id = ev.dataTransfer.getData('text/pi'), x = S.pitems.find(i => i.id === id);
  if (!x || x.day === day) return;
  x.day = day; render(); await q(sb.from('personal_items').update({ day }).eq('id', id)); toast('Movido al ' + fmtD(day));
}
const dropAttrs = k => `ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="dropPItem(event,'${k}')"`;
const pChip = x => `<span class="ct cp" draggable="true" ondragstart="event.stopPropagation();event.dataTransfer.setData('text/pi','${x.id}')" title="Privado: solo lo ves tú · arrástralo a otro día">${ic('lock', 'sm')} ${x.at_time ? x.at_time + ' ' : ''}${esc(x.title)}</span>`;
function weekViewHTML(exams, ents){
  const base = S.cweek ? new Date(S.cweek + 'T00:00') : new Date(); base.setDate(base.getDate() - (base.getDay() + 6) % 7);
  const mon = isoOf(base), td = today(), T = S.settings?.timetable;
  const cols = [0, 1, 2, 3, 4, 5, 6].map(i => { const k = addDays(mon, i), d = new Date(k + 'T00:00'), wd = d.getDay();
    const cls = T && wd >= 1 && wd <= 5 ? (T.grid[wd] || []).map((c, j) => c && T.subjects[c] ? { s: T.subjects[c], t: T.slots[j] } : null).filter(Boolean) : [];
    const merged = cls.reduce((a, c) => { const l = a[a.length - 1]; if (l && l.s === c.s) l.t = [l.t[0], c.t[1]]; else a.push({ ...c }); return a; }, []);
    return `<div class="wk-col ${k === td ? 'today' : ''}" onclick="openDay('${k}')" ${dropAttrs(k)}>
      <div class="wk-h"><b>${cap(d.toLocaleDateString('es-ES', { weekday:'short' }))}</b> ${d.getDate()}</div>
      ${exams.filter(e => e.exam_date === k).map(examChip).join('')}
      ${ents.filter(p => p.due_date === k).map(p => `<button class="ct ce" style="--p:${p.color || 'var(--acc)'}" onclick="event.stopPropagation();goProject('${p.id}')">${ic('flag', 'sm')} ${esc(p.name)}</button>`).join('')}
      ${S.pitems.filter(x => x.kind === 'event' && x.day === k).sort((a, b) => (a.at_time || '99').localeCompare(b.at_time || '99')).map(pChip).join('')}
      ${merged.length ? `<div class="wk-cls">${merged.map(c => `<div style="--c:${c.s.color}"><small>${c.t[0]}–${c.t[1]}</small> ${esc(c.s.short)}</div>`).join('')}</div>` : ''}</div>`; }).join('');
  const sun = addDays(mon, 6), lbl = `${fmtD(mon)} – ${fmtD(sun)}`;
  const mv = k => `S.cweek='${addDays(mon, k)}';render()`;
  return `<div class="row" style="margin-bottom:12px"><button class="btn" onclick="${mv(-7)}" aria-label="Semana anterior">${ic('chevron-left')}</button><button class="btn" onclick="S.cweek=null;render()">Hoy</button><button class="btn" onclick="${mv(7)}" aria-label="Semana siguiente">${ic('chevron-right')}</button>
      <h3 style="margin:0 0 0 8px" class="grow">Semana del ${lbl}</h3></div><div class="wk">${cols}</div>`;
}

/* ============ Proyecto: tipos con tareas de partida ============ */
const PRESETS = {
  electrica: ['⚡ Instalación eléctrica', {
    'Estudio y diseño': ['Recoger requisitos y planos del local', 'Previsión de cargas'],
    'Cálculos': ['Cálculo de secciones y caída de tensión', 'Selección de protecciones (magnetotérmicos y diferenciales)', 'Puesta a tierra'],
    'Documentación': ['Esquema unifilar', 'Planos de planta', 'Presupuesto y lista de materiales', 'Memoria técnica'],
    'Montaje y pruebas': ['Montaje del cuadro', 'Verificaciones y pruebas (REBT)'] }],
  automatizacion: ['🤖 Automatización / domótica', {
    'Análisis': ['Descripción del proceso y GRAFCET', 'Lista de entradas y salidas'],
    'Diseño': ['Esquema de potencia', 'Esquema de mando', 'Selección de autómata y materiales'],
    'Programación': ['Programa del autómata', 'Pantalla HMI / app'],
    'Montaje y pruebas': ['Montaje del cuadro', 'Puesta en marcha y pruebas', 'Memoria y manual de usuario'] }],
  ict: ['📡 ICT / telecomunicaciones', {
    'Diseño': ['Red de radiodifusión y TV (RTV)', 'Red de telefonía y datos (fibra / par)', 'Recintos RITI y RITS', 'Canalizaciones y registros'],
    'Documentación': ['Planos y esquemas', 'Presupuesto y mediciones', 'Memoria y pliego de condiciones'],
    'Montaje': ['Montaje y conexionado', 'Medidas finales y certificación'] }],
  general: ['📋 Trabajo general', {
    'Organización': ['Repartir el trabajo', 'Buscar información'],
    'Desarrollo': ['Desarrollo del trabajo'],
    'Entrega': ['Memoria', 'Presentación'] }],
};
async function applyPreset(pid, key){
  const P = PRESETS[key]; if (!P) return;
  const cols = Object.entries(P[1]);
  const bks = await q(sb.from('buckets').insert(cols.map(([name], i) => ({ project_id: pid, name, position: i + 1 }))).select());
  const bid = name => (bks.find(b => b.name === name && b.project_id === pid) || {}).id;
  if (cols.some(([n]) => !bid(n))) return toast('Se creó el proyecto, pero no las tareas de partida', 'err');
  const tasks = cols.flatMap(([name, ts]) => ts.map((title, i) => ({ project_id: pid, bucket_id: bid(name), title, position: i + 1 })));
  await q(sb.from('tasks').insert(tasks));
}

/* ============ Proyecto: portada ============ */
const COVERS = ['linear-gradient(120deg,#6366f1,#a855f7)', 'linear-gradient(120deg,#f97316,#ef4444)', 'linear-gradient(120deg,#10b981,#06b6d4)', 'linear-gradient(120deg,#0ea5e9,#1e3a8a)', 'linear-gradient(120deg,#f59e0b,#84cc16)', 'linear-gradient(120deg,#334155,#0f172a)'];
const coverCss = c => !c ? '' : c.startsWith('g') ? COVERS[+c.slice(1)] || '' : okUrl(c) ? `center/cover no-repeat url("${c.replace(/"/g, '')}")` : '';
function coverPickHTML(p){
  const c = p?.cover, photo = c && !c.startsWith('g');
  return `<label>Portada <small>(fondo de la cabecera del proyecto)</small></label><div class="row covs" style="flex-wrap:wrap;gap:6px">
    <button type="button" class="cov ${!c ? 'on' : ''}" onclick="setCover(this,null)" title="Sin portada">${ic('ban', 'sm')}</button>
    ${COVERS.map((g, i) => `<button type="button" class="cov ${c === 'g' + i ? 'on' : ''}" style="background:${g}" onclick="setCover(this,'g${i}')" aria-label="Degradado ${i + 1}"></button>`).join('')}
    <button type="button" id="cov-photo" class="cov ${photo ? 'on' : ''}" ${photo ? `style="background:${esc(coverCss(c))}"` : 'hidden'} onclick="setCover(this,this.dataset.url)" data-url="${photo ? esc(c) : ''}" aria-label="Foto"></button>
    ${p ? `<label class="btn sm" style="margin:0">${ic('image-up', 'sm')} Subir foto<input type="file" accept="image/*" hidden onchange="uploadCover(this.files[0])"></label>` : ''}</div>`;
}
// sin re-pintar la ventana: así no se pierde lo ya escrito en el formulario
function setCover(el, v){ S.coverDraft = v || null; el.closest('.covs').querySelectorAll('.cov').forEach(b => b.classList.toggle('on', b === el)); }
async function uploadCover(file){
  if (!file) return;
  try {
    const blob = await compress(file), path = `${S.pid}/${newId()}.jpg`;
    const { error } = await sb.storage.from('covers').upload(path, blob, { contentType: 'image/jpeg' }); if (error) throw error;
    const url = sb.storage.from('covers').getPublicUrl(path).data.publicUrl, b = $('#cov-photo');
    b.dataset.url = url; b.style.background = coverCss(url); b.hidden = false; setCover(b, url); toast('Foto lista: pulsa Guardar');
  } catch (e) { toast('No se pudo subir la foto: ' + (e.message || e), 'err'); }
}

/* ============ Proyecto: entregables ============ */
const DLV = { pendiente: ['Pendiente', 'warn'], revision: ['En revisión', 'acc'], entregado: ['Entregado', 'ok'] };
function delivHTML(){
  const E = adminOf(), rows = [...S.deliv].sort((a, b) => a.position - b.position), done = rows.filter(d => d.status === 'entregado').length;
  return `<div class="page" style="max-width:none">
    <div class="row" style="margin-bottom:10px;flex-wrap:wrap"><div class="grow"><b>${done}/${rows.length} entregados</b><div class="bar" style="max-width:320px;margin-top:6px"><i style="width:${rows.length ? done / rows.length * 100 : 0}%"></i></div></div>
      ${E ? `<input style="max-width:380px" placeholder="+ Añadir entregable (Enter)… Ej.: Memoria técnica" onkeydown="if(event.key==='Enter')addDeliv(this)">` : ''}</div>
    <p class="small mut" style="margin-top:0">Lo que hay que entregar del proyecto. Cualquiera puede poner el enlace al archivo final, cambiar el estado y quién lo revisa${E ? '' : '; añadir o quitar entregables es cosa de los admins'}.</p>
    <div class="card-box tablewrap"><table class="ltable"><thead><tr><th>Entregable</th><th>Estado</th><th>Archivo final</th><th>Revisa</th>${E ? '<th></th>' : ''}</tr></thead><tbody>
    ${rows.map(d => `<tr style="cursor:default"><td>${E ? `<input class="cellin" style="min-width:200px" value="${esc(d.title)}" onchange="saveDeliv('${d.id}','title',this.value)">` : `<b>${esc(d.title)}</b>`}</td>
      <td><select class="cellsel chip ${DLV[d.status][1]}" onchange="saveDeliv('${d.id}','status',this.value)">${Object.entries(DLV).map(([k, [n]]) => `<option value="${k}" ${d.status === k ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
      <td><div class="row"><input class="cellin" type="url" style="min-width:180px" value="${esc(d.link || '')}" placeholder="https://drive.google.com/…" onchange="saveDeliv('${d.id}','link',this.value)">${okUrl(d.link) ? `<a href="${esc(d.link)}" target="_blank" rel="noopener" title="Abrir">${ic('external-link', 'sm')}</a>` : ''}</div></td>
      <td><select class="cellsel" onchange="saveDeliv('${d.id}','reviewer',this.value)"><option value="">—</option>${members().map(u => `<option value="${u.id}" ${d.reviewer === u.id ? 'selected' : ''}>${esc(pname(u.id))}</option>`).join('')}</select></td>
      ${E ? `<td><button class="ico" title="Eliminar" onclick="delDeliv('${d.id}')">${ic('trash-2', 'sm')}</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="5">${emptyState('package-check', 'Sin entregables', E ? 'Añade lo que hay que entregar arriba.' : 'Los admins del proyecto los añadirán.')}</td></tr>`}</tbody></table></div></div>`;
}
async function addDeliv(el){
  const title = el.value.trim(); if (!title) return; el.value = '';
  const [d] = await q(sb.from('deliverables').insert({ project_id: S.pid, title, position: Date.now() }).select()); S.deliv.push(d); keep(render);
}
async function saveDeliv(id, k, v){
  v = String(v).trim();
  if (k === 'link' && v && !okUrl(v)) return toast('El enlace debe empezar por https://', 'err');
  if (k === 'title' && !v) return toast('El entregable necesita un nombre', 'err');
  const d = S.deliv.find(x => x.id === id); d[k] = v || null; keep(render);
  await q(sb.from('deliverables').update({ [k]: v || null }).eq('id', id));
}
async function delDeliv(id){ if (!confirm('¿Eliminar este entregable?')) return; S.deliv = S.deliv.filter(x => x.id !== id); render(); await q(sb.from('deliverables').delete().eq('id', id)); }

/* ============ Material: importar desde Excel, duplicar y reordenar ============ */
// Pegado desde Excel/Sheets: columnas separadas por tabulador (o ;) → Artículo, Cantidad, Ud., Precio, Proveedor
function parseMatPaste(txt){
  const num = s => { s = String(s ?? '').replace(/[€\s]/g, ''); if (!s) return null; const n = Number(s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return n >= 0 ? n : null; };
  return txt.split(/\r?\n/).map(l => l.split(l.includes('\t') ? '\t' : ';').map(c => c.trim())).filter(c => c[0])
    .filter((c, i) => !(i === 0 && num(c[1]) == null && /art|nombre|material|descrip/i.test(c[0])))
    .map(c => ({ name: c[0], qty: num(c[1]) ?? 1, unit: c[2] || 'ud', unit_price: num(c[3]), supplier: c[4] || null }));
}
function matImportHTML(){
  const rows = parseMatPaste(S.matPaste || '');
  return `<div class="mod md"><div class="mh"><h3>Importar material desde Excel</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <p class="small mut" style="margin-top:0">Copia las filas en Excel o Google Sheets y pégalas aquí. Columnas en este orden: <b>Artículo · Cantidad · Unidad · Precio · Proveedor</b> (solo la primera es obligatoria).</p>
    <textarea id="mi-txt" rows="7" placeholder="Cable RZ1-K 2,5 mm²	100	m	0,85	Rexel" oninput="S.matPaste=this.value;keep(renderModal)">${esc(S.matPaste || '')}</textarea>
    ${rows.length ? `<p class="small"><b>${rows.length} artículo${rows.length === 1 ? '' : 's'}</b> listos: ${rows.slice(0, 4).map(r => `${esc(r.name)} (${String(r.qty).replace('.', ',')} ${esc(r.unit)})`).join(', ')}${rows.length > 4 ? '…' : ''}</p>` : ''}
    <div class="row" style="margin-top:12px"><span class="grow"></span><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" ${rows.length ? '' : 'disabled'} onclick="importMat()">${ic('upload', 'sm')} Importar</button></div></div></div>`;
}
async function importMat(){
  const rows = parseMatPaste(S.matPaste || ''); if (!rows.length) return;
  const base = Date.now(), ins = await q(sb.from('materials').insert(rows.map((r, i) => ({ ...r, project_id: S.pid, position: base + i }))).select());
  if (!ins) return;
  S.materials.push(...ins); S.matPaste = ''; closeModal(); toast(`${ins.length} artículos importados`);
}
async function dupMat(id){
  const m = S.materials.find(x => x.id === id), rows = [...S.materials].sort((a, b) => a.position - b.position), i = rows.indexOf(m);
  const pos = rows[i + 1] ? (m.position + rows[i + 1].position) / 2 : m.position + 1;
  const { name, qty, unit, unit_price, supplier, link, status } = m;
  const [d] = await q(sb.from('materials').insert({ project_id: S.pid, name: name + ' (copia)', qty, unit, unit_price, supplier, link, status, position: pos }).select());
  S.materials.push(d); render();
}
async function dropMat(ev, targetId){
  ev.preventDefault(); ev.currentTarget.classList.remove('over');
  const id = ev.dataTransfer.getData('text/mat'); if (!id || id === targetId) return;
  const rows = [...S.materials].sort((a, b) => a.position - b.position).filter(x => x.id !== id), i = rows.findIndex(x => x.id === targetId);
  const prev = rows[i - 1]?.position ?? rows[i].position - 2, pos = (prev + rows[i].position) / 2;
  S.materials.find(x => x.id === id).position = pos; render();
  await q(sb.from('materials').update({ position: pos }).eq('id', id));
}
