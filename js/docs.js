/* ============ Documentos del proyecto: planos con marcas, decisiones, presupuesto, memoria y presentación ============ */
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
const PPTX = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
const team = () => { const ids = new Set(S.tasks.flatMap(t => t.task_assignees.map(a => a.user_id))); return members().filter(u => ids.has(u.id)); };
const fmtLong = d => new Date(d + 'T00:00').toLocaleDateString('es-ES', { day:'numeric', month:'long', year:'numeric' });

/* ---------- 1 · Planos con marcas ---------- */
// Lienzo → JPEG (los planos se guardan grandes para poder leer los detalles)
const canvasJpeg = c => new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.85));
async function imageToJpeg(file, max = 2400){
  const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
  return canvasJpeg(c);
}
async function pdfToJpegs(file, maxPages = 20){
  if (!window.pdfjsLib) { await loadScript(PDFJS + 'pdf.min.js'); pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; }
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise, out = [];
  for (let i = 1; i <= Math.min(pdf.numPages, maxPages); i++) {
    const page = await pdf.getPage(i), v1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: Math.min(4, 2400 / Math.max(v1.width, v1.height)) });
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(vp.width), height: Math.round(vp.height) });
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp, background: '#fff' }).promise;
    out.push(await canvasJpeg(c));
  }
  return out;
}
async function uploadPlan(file){
  if (!file) return;
  const title = ($('#pl-title')?.value || '').trim() || file.name.replace(/\.[^.]+$/, '');
  S.busy = true; render(); toast('Subiendo el plano…');
  try {
    const blobs = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name) ? await pdfToJpegs(file) : [await imageToJpeg(file)];
    const pages = [];
    for (const b of blobs) { const path = `${S.pid}/${newId()}.jpg`; const { error } = await sb.storage.from('planos').upload(path, b, { contentType: 'image/jpeg' }); if (error) throw error; pages.push(path); }
    const [p] = await q(sb.from('plans').insert({ project_id: S.pid, title, pages }).select());
    await signImages('planos', pages); S.plans.unshift(p); S.planId = p.id; S.planPage = 0; track('f:plan');
    toast(pages.length > 1 ? `Plano subido (${pages.length} páginas)` : 'Plano subido');
  } catch (e) { toast('No se pudo subir el plano: ' + (e.message || e), 'err'); }
  S.busy = false; render();
}
const marksOf = pid => S.marks.filter(m => m.plan_id === pid).sort((a, b) => a.created_at.localeCompare(b.created_at));
function plansHTML(){
  const p = S.plans.find(x => x.id === S.planId);
  if (p) return planViewHTML(p);
  return `<div class="page" style="max-width:none">
    <div class="card-box row" style="flex-wrap:wrap;margin-bottom:14px"><input id="pl-title" style="max-width:340px" placeholder="Nombre del plano (opcional) · Ej.: Esquema unifilar v2">
      <label class="btn pri" style="margin:0" ${S.busy ? 'disabled' : ''}>${ic('upload')} Subir plano (imagen o PDF)<input type="file" accept="image/*,application/pdf" hidden onchange="uploadPlan(this.files[0])"></label>
      <span class="small mut">Luego pulsa sobre el plano para dejar marcas con comentarios.</span></div>
    <div class="plans">${S.plans.map(x => { const ms = marksOf(x.id), open = ms.filter(m => !m.resolved).length;
      return `<button class="card-box plan-c" onclick="S.planId='${x.id}';S.planPage=0;render()">
        <img src="${esc(imgUrl('planos', x.pages[0]) || '')}" alt="" loading="lazy">
        <b>${esc(x.title)}</b><small class="mut">${esc(first(x.created_by))} · ${fmtD(x.created_at.slice(0, 10))}${x.pages.length > 1 ? ` · ${x.pages.length} págs.` : ''}</small>
        <span class="chip ${open ? 'warn' : 'ok'}">${open ? `${open} marca${open === 1 ? '' : 's'} sin resolver` : ms.length ? 'Todo resuelto' : 'Sin marcas'}</span></button>`; }).join('')
      || emptyState('drafting-compass', 'Sin planos', 'Sube un esquema, unifilar o plano para revisarlo entre todos.')}</div></div>`;
}
function planViewHTML(p){
  const pg = Math.min(S.planPage || 0, p.pages.length - 1), all = marksOf(p.id), num = m => all.indexOf(m) + 1;
  const ms = all.filter(m => m.page === pg && (S.planAll || !m.resolved)), z = S.planZoom || 1;
  const canDel = p.created_by === S.me.id || adminOf();
  const pin = m => `<button class="pin ${m.resolved ? 'res' : ''} ${S.planSel === m.id ? 'sel' : ''}" style="left:${m.x * 100}%;top:${m.y * 100}%" onclick="event.stopPropagation();S.planSel='${m.id}';render()" title="${esc(m.body)}">${num(m)}</button>`;
  const nw = S.planNew && S.planNew.page === pg ? `<div class="pin-new" style="left:${S.planNew.x * 100}%;top:${S.planNew.y * 100}%" onclick="event.stopPropagation()">
      <textarea id="pm-body" rows="3" placeholder="¿Qué hay que revisar aquí?" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();addMark()}"></textarea>
      <div class="row"><button class="btn sm" onclick="S.planNew=null;render()">Cancelar</button><button class="btn sm pri" onclick="addMark()">Marcar</button></div></div>` : '';
  return `<div class="page" style="max-width:none"><div class="row" style="flex-wrap:wrap;margin-bottom:10px">
      <button class="btn" onclick="S.planId=null;S.planNew=null;S.planSel=null;render()">${ic('arrow-left')} Planos</button>
      <h3 class="grow" style="margin:0 6px">${esc(p.title)}</h3>
      ${p.pages.length > 1 ? `<div class="seg">${p.pages.map((_, i) => `<button class="${i === pg ? 'on' : ''}" onclick="S.planPage=${i};S.planNew=null;render()">${i + 1}</button>`).join('')}</div>` : ''}
      <div class="seg">${[1, 1.5, 2, 3].map(k => `<button class="${z === k ? 'on' : ''}" onclick="S.planZoom=${k};render()">${k * 100}%</button>`).join('')}</div>
      <a class="btn" href="${esc(imgUrl('planos', p.pages[pg]) || '#')}" target="_blank" rel="noopener" title="Abrir la imagen original">${ic('external-link')}</a>
      ${canDel ? `<button class="btn" onclick="renamePlan('${p.id}')" title="Renombrar">${ic('pencil')}</button><button class="btn" onclick="delPlan('${p.id}')" title="Borrar plano">${ic('trash-2')}</button>` : ''}</div>
    <div class="plan-v"><div class="plan-scroll"><div class="plan-img" style="width:${z * 100}%" onclick="planClick(event)">
        <img src="${esc(imgUrl('planos', p.pages[pg]) || '')}" alt="${esc(p.title)}" draggable="false">${ms.map(pin).join('')}${nw}</div></div>
      <aside class="card-box plan-side"><div class="row"><b class="grow">Marcas (${all.filter(m => !m.resolved).length} abiertas)</b>
          <label class="small" style="margin:0;display:flex;gap:4px;align-items:center"><input type="checkbox" style="width:auto" ${S.planAll ? 'checked' : ''} onchange="S.planAll=this.checked;render()"> Ver resueltas</label></div>
        <p class="small mut" style="margin:4px 0 10px">Pulsa sobre el plano para añadir una marca.</p>
        ${all.filter(m => S.planAll || !m.resolved).map(m => `<div class="pmark ${S.planSel === m.id ? 'sel' : ''} ${m.resolved ? 'res' : ''}" onclick="S.planSel='${m.id}';S.planPage=${m.page};render()">
          <span class="pin static">${num(m)}</span><div class="grow"><div>${linkify(m.body)}</div><small class="mut">${esc(first(m.created_by))} · ${ago(m.created_at)}${p.pages.length > 1 ? ` · pág. ${m.page + 1}` : ''}</small></div>
          <div class="col-acts"><button class="ico" title="${m.resolved ? 'Reabrir' : 'Marcar como resuelta'}" onclick="event.stopPropagation();resolveMark('${m.id}',${!m.resolved})">${ic(m.resolved ? 'rotate-ccw' : 'check', 'sm')}</button>
            ${m.created_by === S.me.id || adminOf() ? `<button class="ico" title="Borrar" onclick="event.stopPropagation();delMark('${m.id}')">${ic('x', 'sm')}</button>` : ''}</div></div>`).join('') || '<p class="small mut">Sin marcas todavía.</p>'}</aside></div></div>`;
}
function planClick(e){
  if (e.target.closest('.pin,.pin-new')) return;
  const r = e.currentTarget.getBoundingClientRect();
  S.planNew = { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)), page: S.planPage || 0 };
  S.planSel = null; render(); $('#pm-body')?.focus();
}
async function addMark(){
  const body = $('#pm-body')?.value.trim(); if (!body) return toast('Escribe qué hay que revisar', 'err');
  const n = S.planNew; S.planNew = null;
  const [m] = await q(sb.from('plan_marks').insert({ plan_id: S.planId, page: n.page, x: n.x, y: n.y, body }).select());
  if (m) { S.marks.push(m); S.planSel = m.id; } render();
}
async function resolveMark(id, resolved){ const m = S.marks.find(x => x.id === id); m.resolved = resolved; render(); await q(sb.from('plan_marks').update({ resolved }).eq('id', id)); }
async function delMark(id){ if (!confirm('¿Borrar esta marca?')) return; S.marks = S.marks.filter(x => x.id !== id); render(); await q(sb.from('plan_marks').delete().eq('id', id)); }
async function renamePlan(id){ const p = S.plans.find(x => x.id === id), v = prompt('Nombre del plano', p.title); if (!v?.trim()) return; p.title = v.trim(); render(); await q(sb.from('plans').update({ title: p.title }).eq('id', id)); }
async function delPlan(id){
  const p = S.plans.find(x => x.id === id); if (!confirm(`¿Borrar el plano «${p.title}» y todas sus marcas?`)) return;
  S.plans = S.plans.filter(x => x.id !== id); S.planId = null; render();
  await q(sb.from('plans').delete().eq('id', id)); sb.storage.from('planos').remove(p.pages).then(() => {});
}

/* ---------- 6 · Matriz de decisión ---------- */
// Nota de cada opción: media de cada criterio entre quienes han puntuado, ponderada por el peso del criterio (sobre 5)
function decResult(d){
  const sc = S.dscores.filter(s => s.decision_id === d.id);
  return d.options.map((o, oi) => {
    let num = 0, den = 0;
    d.criteria.forEach((c, ci) => { const v = sc.filter(s => s.option === oi && s.criterion === ci).map(s => s.score); if (v.length) { num += c.weight * v.reduce((a, b) => a + b, 0) / v.length; den += c.weight; } });
    return { o, oi, score: den ? num / den : null };
  });
}
function decideHTML(){
  return `<div class="page" style="max-width:none"><div class="row" style="margin-bottom:10px"><p class="mut grow" style="margin:0">Compara alternativas (qué autómata, qué proveedor, qué solución…). Cada uno puntúa del 1 al 5 y la web calcula la mejor según el peso de cada criterio.</p>
      <button class="btn pri" onclick="openModal('decnew')">${ic('plus')} Nueva decisión</button></div>
    ${S.decisions.map(decCardHTML).join('') || emptyState('scale', 'Sin decisiones', 'Crea una para comparar alternativas entre todos.')}</div>`;
}
function decCardHTML(d){
  const res = decResult(d), best = Math.max(...res.map(r => r.score ?? -1)), mine = S.dscores.filter(s => s.decision_id === d.id && s.user_id === S.me.id);
  const voters = new Set(S.dscores.filter(s => s.decision_id === d.id).map(s => s.user_id)).size, E = d.created_by === S.me.id || adminOf();
  const my = (oi, ci) => mine.find(s => s.option === oi && s.criterion === ci)?.score || '';
  return `<div class="card-box dec"><div class="row" style="flex-wrap:wrap"><h3 class="grow" style="margin:0">${esc(d.title)}</h3>
      <small class="mut">${voters} persona${voters === 1 ? '' : 's'} han puntuado</small>
      ${E ? `<button class="ico" title="Borrar decisión" onclick="delDecision('${d.id}')">${ic('trash-2', 'sm')}</button>` : ''}</div>
    <div class="tablewrap"><table class="ltable dec-t"><thead><tr><th>Opción</th>${d.criteria.map(c => `<th title="Peso ${c.weight}">${esc(c.name)} <small class="mut">×${c.weight}</small></th>`).join('')}<th>Resultado del grupo</th></tr></thead><tbody>
    ${res.map(r => `<tr class="${r.score != null && r.score === best ? 'win' : ''} ${d.chosen === r.oi ? 'chosen' : ''}"><td><b>${esc(r.o)}</b>${d.chosen === r.oi ? ` <span class="chip ok">${ic('check', 'sm')} Elegida</span>` : ''}</td>
      ${d.criteria.map((c, ci) => `<td><select class="cellsel" aria-label="Tu nota para ${esc(r.o)} en ${esc(c.name)}" onchange="scoreDecision('${d.id}',${r.oi},${ci},this.value)"><option value="">—</option>${[1, 2, 3, 4, 5].map(n => `<option ${my(r.oi, ci) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></td>`).join('')}
      <td style="min-width:150px">${r.score == null ? '<span class="mut">Sin notas</span>' : `<div class="row" style="gap:6px"><div class="bar grow"><i style="width:${r.score / 5 * 100}%"></i></div><b>${r.score.toFixed(1).replace('.', ',')}</b>${r.score === best ? ' 🏆' : ''}</div>`}
        ${E ? `<button class="btn ghost sm" onclick="chooseDecision('${d.id}',${d.chosen === r.oi ? 'null' : r.oi})">${d.chosen === r.oi ? 'Quitar elección' : 'Elegir esta'}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
    <p class="small mut" style="margin:6px 0 0">Tus notas (1 = mal, 5 = muy bien) en los desplegables. Lo elegido sale en la memoria y en la presentación.</p></div>`;
}
function decNewHTML(){
  return `<div class="mod md"><div class="mh"><h3>Nueva decisión</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <label>¿Qué hay que decidir?</label><input id="dn-title" maxlength="200" placeholder="Ej.: Qué autómata usamos">
    <label>Opciones <small>(una por línea, de 2 a 8)</small></label><textarea id="dn-opts" rows="4" placeholder="Siemens LOGO!&#10;Schneider Zelio&#10;Arduino Opta"></textarea>
    <label>Criterios y su importancia <small>(uno por línea; el número del final es el peso del 1 al 5)</small></label><textarea id="dn-crit" rows="4">Precio: 4&#10;Facilidad de programación: 3&#10;Disponibilidad en el taller: 5</textarea>
    <div class="row" style="margin-top:14px"><span class="grow"></span><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" onclick="saveDecision()">Crear</button></div></div></div>`;
}
async function saveDecision(){
  const title = $('#dn-title').value.trim(), options = [...new Set($('#dn-opts').value.split('\n').map(s => s.trim()).filter(Boolean))];
  const criteria = $('#dn-crit').value.split('\n').map(s => s.trim()).filter(Boolean).map(l => { const m = l.match(/^(.*?)[\s:–-]+([1-5])$/); return m ? { name: m[1].trim(), weight: +m[2] } : { name: l, weight: 3 }; }).filter(c => c.name);
  if (!title) return toast('Pon qué hay que decidir', 'err');
  if (options.length < 2 || options.length > 8) return toast('Pon entre 2 y 8 opciones', 'err');
  if (!criteria.length || criteria.length > 10) return toast('Pon entre 1 y 10 criterios', 'err');
  const [d] = await q(sb.from('decisions').insert({ project_id: S.pid, title, options, criteria }).select());
  if (d) { S.decisions.push(d); closeModal(); track('f:decision'); }
}
async function scoreDecision(did, option, criterion, v){
  S.dscores = S.dscores.filter(s => !(s.decision_id === did && s.user_id === S.me.id && s.option === option && s.criterion === criterion));
  if (v) { const row = { decision_id: did, user_id: S.me.id, option, criterion, score: +v }; S.dscores.push(row); keep(render); await q(sb.from('decision_scores').upsert(row)); }
  else { keep(render); await q(sb.from('decision_scores').delete().match({ decision_id: did, user_id: S.me.id, option, criterion })); }
}
async function chooseDecision(id, chosen){ S.decisions.find(d => d.id === id).chosen = chosen; render(); await q(sb.from('decisions').update({ chosen }).eq('id', id)); }
async function delDecision(id){ if (!confirm('¿Borrar esta decisión y sus notas?')) return; S.decisions = S.decisions.filter(d => d.id !== id); render(); await q(sb.from('decisions').delete().eq('id', id)); }

/* ---------- Documentos: menú ---------- */
function docsHTML(){
  const it = (icon, t, d, fn) => `<button class="doc-o" onclick="${fn}">${ic(icon)}<div><b>${t}</b><small>${d}</small></div></button>`;
  return `<div class="mod md"><div class="mh"><h3>Documentos del proyecto</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb docs-g">
    ${it('book-text', 'Memoria técnica', 'Documento con índice: descripción, planificación, desarrollo, decisiones, material, planos y entregables. Word o PDF.', "openModal('memoria')")}
    ${it('receipt-euro', 'Presupuesto', 'Presupuesto profesional del material con mano de obra e IVA, con el logo del centro. PDF.', "openModal('budget')")}
    ${it('presentation', 'Presentación', 'Diapositivas automáticas del proyecto para exponer: en pantalla o en PowerPoint.', "openModal('deck')")}
    ${it('file-text', 'Informe de seguimiento', 'Tareas, participación de cada uno, diario e historial. PDF.', 'closeModal();exportReport()')}</div></div>`;
}
// Ventana de impresión común (Guardar como PDF)
function printDoc(title, body, color = '#4f46e5'){
  const w = window.open('', '_blank'); if (!w) { toast('Permite las ventanas emergentes para generar el documento', 'err'); return null; }
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${docCss(color)}
    .bar-p{position:sticky;top:0;background:#fff;padding:8px 0;text-align:right}@media print{.bar-p{display:none}}</style></head><body>
    <div class="bar-p"><button onclick="print()" style="padding:8px 14px;font:inherit">Guardar como PDF / Imprimir</button></div>${body}</body></html>`);
  w.document.close(); return w;
}
const docCss = c => `@page{size:A4;margin:18mm 16mm}body{font:11pt/1.5 Calibri,Inter,system-ui,Segoe UI,sans-serif;color:#111;margin:24px}
  h1{font-size:22pt;margin:0 0 6px}h2{font-size:15pt;margin:26px 0 8px;color:${c};border-bottom:2px solid ${c};padding-bottom:3px;page-break-after:avoid}h3{font-size:12.5pt;margin:16px 0 6px;page-break-after:avoid}
  table{width:100%;border-collapse:collapse;margin:6px 0 10px}th,td{border:1px solid #c9ccd3;padding:5px 7px;text-align:left;vertical-align:top}th{background:#eef0f4}
  td.n,th.n{text-align:right;white-space:nowrap}.m{color:#666}.tot td{font-weight:bold;background:#f6f7f9}
  .cover{text-align:center;padding-top:70px;page-break-after:always}.cover img{height:90px}.cover h1{font-size:28pt;margin:40px 0 10px}.cover .sub{font-size:14pt;color:#444}
  .toc li{margin:4px 0}.plan-img{max-width:100%;max-height:230mm;border:1px solid #ccc;display:block;margin:6px auto}
  .hd{display:flex;align-items:center;gap:14px;margin-bottom:10px}.hd img{height:54px}.right{text-align:right}.grow{flex:1}`;

/* ---------- 3 · Presupuesto ---------- */
function budgetDefaults(){
  const saved = ls('budget:' + S.pid) || {}, hrs = Math.round(S.tlogs.reduce((a, l) => a + l.minutes, 0) / 60);
  return { num: 'P-' + today().replace(/-/g, ''), client: SCHOOL, hours: hrs, rate: 20, gg: 0, iva: 21, valid: 30, notes: '', ...saved };
}
function budgetHTML(){
  const b = budgetDefaults(), noPrice = S.materials.filter(m => !Number.isFinite(m.unit_price)).length;
  const f = (id, l, v, t = 'text', ex = '') => `<div><label>${l}</label><input id="bg-${id}" type="${t}" value="${esc(String(v))}" ${ex}></div>`;
  return `<div class="mod md"><div class="mh"><h3>Presupuesto en PDF</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    ${!S.materials.length ? `<p class="chip warn">El proyecto no tiene material todavía.</p>` : noPrice ? `<p class="small" style="color:var(--warn-t)">${ic('triangle-alert', 'sm')} ${noPrice} artículo${noPrice === 1 ? '' : 's'} sin precio: saldrán a 0 €.</p>` : ''}
    <div class="grid4" style="grid-template-columns:1fr 2fr">${f('num', 'Nº de presupuesto', b.num)}${f('client', 'Para (cliente / destinatario)', b.client)}</div>
    <div class="grid4">${f('hours', 'Horas de mano de obra', b.hours, 'number', 'min="0" step="0.5"')}${f('rate', '€ por hora', b.rate, 'number', 'min="0" step="0.5"')}${f('gg', '% gastos generales / beneficio', b.gg, 'number', 'min="0" step="1"')}${f('iva', '% IVA', b.iva, 'number', 'min="0" step="1"')}</div>
    <div class="grid4" style="grid-template-columns:1fr 3fr">${f('valid', 'Validez (días)', b.valid, 'number', 'min="1"')}<div><label>Notas <small>(condiciones, plazo de ejecución…)</small></label><input id="bg-notes" value="${esc(b.notes)}"></div></div>
    <p class="small mut">Las horas vienen de las horas registradas en el proyecto. Se recuerda lo que pongas para la próxima vez.</p>
    <div class="row" style="margin-top:12px"><span class="grow"></span><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" onclick="makeBudget()">${ic('file-down', 'sm')} Generar PDF</button></div></div></div>`;
}
function budgetCalc(b){
  const rows = [...S.materials].sort((a, b) => a.position - b.position).map(m => ({ ...m, imp: (Number(m.qty) || 0) * (Number.isFinite(m.unit_price) ? m.unit_price : 0) }));
  const mat = rows.reduce((a, r) => a + r.imp, 0), mo = b.hours * b.rate, sub = mat + mo, gg = sub * b.gg / 100, base = sub + gg, iva = base * b.iva / 100;
  return { rows, mat, mo, sub, gg, base, iva, total: base + iva };
}
function makeBudget(){
  const g = id => $('#bg-' + id).value, n = id => Math.max(0, parseFloat(String(g(id)).replace(',', '.')) || 0);
  const b = { num: g('num').trim(), client: g('client').trim(), hours: n('hours'), rate: n('rate'), gg: n('gg'), iva: n('iva'), valid: n('valid') || 30, notes: g('notes').trim() };
  ls('budget:' + S.pid, b); track('f:budget');
  const p = proj(), c = budgetCalc(b), logo = new URL('logo-full.png', location.href).href, nq = v => String(v).replace('.', ',');
  printDoc(`Presupuesto ${b.num} – ${p.name}`, `
    <div class="hd"><img src="${logo}" onerror="this.remove()"><div class="grow"><b>${esc(SCHOOL)}</b><div class="m">2º Sistemas Electrotécnicos y Automatizados</div></div>
      <div class="right"><h1>PRESUPUESTO</h1><div>Nº <b>${esc(b.num)}</b></div><div class="m">Fecha: ${new Date().toLocaleDateString('es-ES')} · Validez: ${b.valid} días</div></div></div>
    <table><tr><th style="width:25%">Proyecto</th><td>${esc(p.name)}</td></tr><tr><th>Para</th><td>${esc(b.client || '—')}</td></tr>
      ${team().length ? `<tr><th>Elaborado por</th><td>${team().map(u => esc(pname(u.id))).join(', ')}</td></tr>` : ''}</table>
    <h2>Material</h2><table><tr><th style="width:34px">Nº</th><th>Descripción</th><th class="n">Cant.</th><th>Ud.</th><th class="n">Precio ud.</th><th class="n">Importe</th></tr>
      ${c.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}${r.supplier ? `<br><span class="m">${esc(r.supplier)}</span>` : ''}</td><td class="n">${nq(r.qty)}</td><td>${esc(r.unit || '')}</td><td class="n">${Number.isFinite(r.unit_price) ? eur(r.unit_price) : '<span class="m">sin precio</span>'}</td><td class="n">${eur(r.imp)}</td></tr>`).join('') || '<tr><td colspan="6" class="m">Sin material</td></tr>'}
      <tr class="tot"><td colspan="5">Total material</td><td class="n">${eur(c.mat)}</td></tr></table>
    <h2>Resumen</h2><table style="width:60%;margin-left:auto">
      <tr><td>Material</td><td class="n">${eur(c.mat)}</td></tr>
      <tr><td>Mano de obra (${nq(b.hours)} h × ${eur(b.rate)})</td><td class="n">${eur(c.mo)}</td></tr>
      ${b.gg ? `<tr><td>Gastos generales y beneficio (${nq(b.gg)} %)</td><td class="n">${eur(c.gg)}</td></tr>` : ''}
      <tr class="tot"><td>Base imponible</td><td class="n">${eur(c.base)}</td></tr>
      <tr><td>IVA (${nq(b.iva)} %)</td><td class="n">${eur(c.iva)}</td></tr>
      <tr class="tot"><td style="font-size:13pt">TOTAL</td><td class="n" style="font-size:13pt">${eur(c.total)}</td></tr></table>
    ${b.notes ? `<h3>Condiciones</h3><p>${esc(b.notes)}</p>` : ''}`, p.color);
  closeModal();
}

/* ---------- 2 · Memoria técnica (Word y PDF) ---------- */
const MEM = [['cover', 'Portada'], ['toc', 'Índice'], ['obj', 'Objeto del proyecto'], ['team', 'Equipo de trabajo'], ['plan', 'Planificación'], ['dev', 'Desarrollo técnico (páginas de Notas)'],
  ['dec', 'Justificación de decisiones'], ['mat', 'Material y presupuesto'], ['plans', 'Planos'], ['deliv', 'Entregables'], ['concl', 'Conclusiones (para completar)']];
function memoriaHTML(){
  const sel = ls('mem:' + S.pid) || Object.fromEntries(MEM.map(([k]) => [k, true])), p = proj(), mod = modOf(p.module);
  return `<div class="mod md"><div class="mh"><h3>Memoria técnica</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <p class="small mut" style="margin-top:0">Se monta sola con lo que hay en el proyecto. Las páginas de <b>Notas</b> van como capítulos de «Desarrollo técnico» (ahí podéis escribir los cálculos y explicaciones). Elige qué apartados incluir:</p>
    <div class="mem-g">${MEM.map(([k, l]) => `<label class="mem-o"><input type="checkbox" id="mem-${k}" ${sel[k] !== false ? 'checked' : ''}> ${l}</label>`).join('')}</div>
    <div class="grid4" style="grid-template-columns:2fr 1fr"><div><label>Autores</label><input id="mem-authors" value="${esc(team().map(u => pname(u.id)).join(', '))}"></div>
      <div><label>Profesor/a</label><input id="mem-teacher" value="${esc(mod?.teacher || '')}"></div></div>
    <div class="row" style="margin-top:14px"><span class="grow"></span><button class="btn" onclick="buildMemoria('pdf')">${ic('printer', 'sm')} Ver / PDF</button><button class="btn pri" onclick="buildMemoria('word')">${ic('file-down', 'sm')} Descargar Word</button></div></div></div>`;
}
// Imagen firmada → data URL (para meterla dentro del Word)
async function toDataUrl(url){ const b = await (await fetch(url)).blob(); return new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); }); }
function memoriaBody(o){
  const p = proj(), mod = modOf(p.module), on = k => o.sel[k] !== false, H = [], T = [];
  const sec = (k, title, html) => { if (!on(k)) return ''; const n = T.length + 1; T.push([n, title]); return `<h2>${n}. ${esc(title)}</h2>${html}`; };
  const bks = [...S.buckets].sort((a, b) => a.position - b.position), d = S.decisions.filter(x => x.chosen != null);
  const c = budgetCalc(budgetDefaults());
  let body = '';
  body += sec('obj', 'Objeto del proyecto', `<p>${p.description ? esc(p.description).replace(/\n/g, '<br>') : '<i>[Describe aquí el objetivo y el alcance del proyecto.]</i>'}</p>
    ${p.due_date ? `<p><b>Fecha de entrega:</b> ${fmtLong(p.due_date)}</p>` : ''}${mod ? `<p><b>Módulo:</b> ${esc(mod.name)}</p>` : ''}`);
  body += sec('team', 'Equipo de trabajo', `<table><tr><th>Persona</th><th>Tareas a su cargo</th></tr>${team().map(u => `<tr><td>${esc(pname(u.id))}</td><td>${S.tasks.filter(t => t.task_assignees.some(a => a.user_id === u.id)).map(t => esc(t.title)).join('; ')}</td></tr>`).join('') || '<tr><td colspan="2" class="m">Sin tareas asignadas</td></tr>'}</table>`);
  body += sec('plan', 'Planificación', bks.map(b => { const ts = S.tasks.filter(t => t.bucket_id === b.id).sort((a, b) => a.position - b.position);
    return `<h3>${esc(b.name)}</h3><table><tr><th>Tarea</th><th>Responsables</th><th>Inicio</th><th>Límite</th><th>Estado</th></tr>${ts.map(t => `<tr><td>${esc(t.title)}</td><td>${t.task_assignees.map(a => esc(pname(a.user_id))).join(', ') || '—'}</td><td>${t.start_date ? fmtD(t.start_date) : '—'}</td><td>${t.due_date ? fmtD(t.due_date) : '—'}</td><td>${STATUS[t.status]}</td></tr>`).join('') || '<tr><td colspan="5" class="m">Sin tareas</td></tr>'}</table>`; }).join('') || '<p class="m">Sin fases.</p>');
  body += sec('dev', 'Desarrollo técnico', S.wiki.length ? S.wiki.map((w, i) => `<h3>${T.length + 1}.${i + 1}. ${esc(w.title)}</h3>${(md(w.body) || '<p class="m">Página vacía.</p>').replace(/<(\/?)h[1-3]\b/g, '<$1h4')}`).join('') : '<p><i>[Escribe aquí el desarrollo técnico: cálculos, criterios de diseño, normativa aplicada… Consejo: crea páginas en «Notas» del proyecto y saldrán aquí solas.]</i></p>');
  body += sec('dec', 'Justificación de decisiones', d.length ? d.map(x => { const r = decResult(x);
    return `<h3>${esc(x.title)}</h3><p>Se eligió <b>${esc(x.options[x.chosen])}</b> tras valorar ${x.options.length} alternativas con estos criterios: ${x.criteria.map(c => `${esc(c.name)} (peso ${c.weight})`).join(', ')}.</p>
      <table><tr><th>Opción</th><th class="n">Nota ponderada (sobre 5)</th></tr>${r.map(y => `<tr><td>${esc(y.o)}${y.oi === x.chosen ? ' <b>(elegida)</b>' : ''}</td><td class="n">${y.score == null ? '—' : y.score.toFixed(2).replace('.', ',')}</td></tr>`).join('')}</table>`; }).join('') : '<p class="m">No hay decisiones marcadas como elegidas en la pestaña «Decisiones».</p>');
  body += sec('mat', 'Material y presupuesto', `<table><tr><th>Artículo</th><th class="n">Cant.</th><th>Ud.</th><th class="n">Precio</th><th class="n">Importe</th><th>Proveedor</th></tr>${c.rows.map(r => `<tr><td>${esc(r.name)}</td><td class="n">${String(r.qty).replace('.', ',')}</td><td>${esc(r.unit || '')}</td><td class="n">${eur(r.unit_price)}</td><td class="n">${eur(r.imp)}</td><td>${esc(r.supplier || '')}</td></tr>`).join('') || '<tr><td colspan="6" class="m">Sin material</td></tr>'}
    <tr class="tot"><td colspan="4">Total material (sin IVA)</td><td class="n">${eur(c.mat)}</td><td></td></tr></table>`);
  body += sec('plans', 'Planos', S.plans.length ? S.plans.map(pl => pl.pages.map((pg, i) => `<h3>${esc(pl.title)}${pl.pages.length > 1 ? ` (${i + 1}/${pl.pages.length})` : ''}</h3><img class="plan-img" src="${o.img(pg)}" alt="${esc(pl.title)}">`).join('')).join('') : '<p class="m">No hay planos subidos en la pestaña «Planos».</p>');
  body += sec('deliv', 'Entregables', S.deliv.length ? `<table><tr><th>Entregable</th><th>Estado</th><th>Archivo</th></tr>${S.deliv.map(x => `<tr><td>${esc(x.title)}</td><td>${DLV[x.status][0]}</td><td>${okUrl(x.link) ? `<a href="${esc(x.link)}">${esc(x.link)}</a>` : '—'}</td></tr>`).join('')}</table>` : '<p class="m">Sin entregables.</p>');
  body += sec('concl', 'Conclusiones', '<p><i>[Escribe aquí las conclusiones: resultados obtenidos, problemas encontrados y cómo se resolvieron, posibles mejoras.]</i></p>');
  const logo = o.logo;
  if (on('toc')) H.push(`<div style="page-break-after:always"><h2>Índice</h2><ol class="toc" style="list-style:none;padding:0">${T.map(([n, t]) => `<li>${n}. ${esc(t)}</li>`).join('')}</ol></div>`);
  if (on('cover')) H.unshift(`<div class="cover">${logo ? `<img src="${logo}">` : ''}<p class="sub">${esc(SCHOOL)}<br>2º Sistemas Electrotécnicos y Automatizados</p><h1>${esc(p.name)}</h1>
    <p class="sub">Memoria técnica${mod ? `<br>${esc(mod.name)}` : ''}</p><p style="margin-top:60px">${o.authors ? `<b>Autores:</b> ${esc(o.authors)}<br>` : ''}${o.teacher ? `<b>Profesor/a:</b> ${esc(o.teacher)}<br>` : ''}${new Date().toLocaleDateString('es-ES', { month:'long', year:'numeric' })}</p></div>`);
  return H.join('') + body;
}
async function buildMemoria(kind){
  const sel = Object.fromEntries(MEM.map(([k]) => [k, $('#mem-' + k).checked])); ls('mem:' + S.pid, sel);
  const o = { sel, authors: $('#mem-authors').value.trim(), teacher: $('#mem-teacher').value.trim() }, p = proj();
  track('f:memoria');
  if (kind === 'pdf') { o.logo = new URL('logo-full.png', location.href).href; o.img = pg => esc(imgUrl('planos', pg) || ''); closeModal(); printDoc('Memoria técnica – ' + p.name, memoriaBody(o), p.color); return; }
  toast('Preparando el Word…');
  try {
    if (!window.docx) await loadScript(DOCX);
    await signImages('planos', S.plans.flatMap(x => x.pages));
    o.logo = new URL('logo-full.png', location.href).href; o.img = pg => imgUrl('planos', pg) || '';
    const blob = await htmlToDocx(memoriaBody(o), p.color);
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `Memoria - ${p.name}.docx` }); document.body.append(a);
    a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); closeModal(); toast('Memoria descargada. Al abrirla, Word puede pedir actualizar el índice: di que sí.');
  } catch (e) { toast('No se pudo crear el Word: ' + (e.message || e), 'err'); }
}
const DOCX = 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.iife.js';
// Convierte el HTML de la memoria en un .docx de verdad (Word, LibreOffice y Google Docs), con índice automático
async function htmlToDocx(html, color){
  const D = window.docx, C = (color || '#4f46e5').replace('#', ''), root = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstChild, out = [];
  const imgRun = async (src, maxW = 600, maxH = 820) => {
    try { const buf = await (await fetch(src)).arrayBuffer(), u = URL.createObjectURL(new Blob([buf]));
      const [w, h] = await new Promise(ok => { const i = new Image(); i.onload = () => ok([i.width, i.height]); i.onerror = () => ok([4, 3]); i.src = u; }); URL.revokeObjectURL(u);
      const k = Math.min(1, maxW / w, maxH / h); return new D.ImageRun({ data: buf, transformation: { width: Math.round(w * k), height: Math.round(h * k) } }); } catch { return null; }
  };
  const runs = (node, st = {}) => [...node.childNodes].flatMap(n => {
    if (n.nodeType === 3) { const t = n.textContent.replace(/\s+/g, ' '); return t.trim() || t === ' ' ? [new D.TextRun({ text: t, bold: st.b, italics: st.i, color: st.c, size: st.size })] : []; }
    if (n.nodeType !== 1) return [];
    const t = n.tagName;
    if (t === 'BR') return [new D.TextRun({ text: '', break: 1 })];
    if (t === 'A' && /^https?:/.test(n.getAttribute('href') || '')) return [new D.ExternalHyperlink({ link: n.getAttribute('href'), children: [new D.TextRun({ text: n.textContent, style: 'Hyperlink' })] })];
    if (t === 'CODE') return [new D.TextRun({ text: n.textContent, font: 'Consolas' })];
    return runs(n, { ...st, b: st.b || t === 'B' || t === 'STRONG' || t === 'TH', i: st.i || t === 'I' || t === 'EM', c: n.classList?.contains('m') ? '666666' : st.c });
  });
  const para = (n, o = {}) => new D.Paragraph({ children: runs(n, o.st), spacing: { after: 120 }, ...o });
  const heading = { H1: D.HeadingLevel.TITLE, H2: D.HeadingLevel.HEADING_1, H3: D.HeadingLevel.HEADING_2, H4: D.HeadingLevel.HEADING_3, H5: D.HeadingLevel.HEADING_3, H6: D.HeadingLevel.HEADING_3 };
  async function block(n, list){
    if (n.nodeType === 3) { if (n.textContent.trim()) out.push(new D.Paragraph({ children: [new D.TextRun(n.textContent.trim())] })); return; }
    if (n.nodeType !== 1) return;
    const t = n.tagName, cls = n.classList;
    if (cls.contains('cover')) {
      const logo = n.querySelector('img') && await imgRun(n.querySelector('img').getAttribute('src'), 260, 120);
      if (logo) out.push(new D.Paragraph({ children: [logo], alignment: D.AlignmentType.CENTER, spacing: { before: 1200, after: 600 } }));
      n.querySelectorAll('p,h1').forEach(x => out.push(new D.Paragraph({ children: runs(x, { size: x.tagName === 'H1' ? 56 : 28, b: x.tagName === 'H1' }), alignment: D.AlignmentType.CENTER, spacing: { before: x.tagName === 'H1' ? 600 : 240, after: 240 } })));
      out.push(new D.Paragraph({ children: [new D.PageBreak()] })); return;
    }
    if (n.querySelector?.(':scope > ol.toc')) { out.push(new D.Paragraph({ children: [new D.TextRun({ text: 'Índice', bold: true, size: 30, color: C })], spacing: { after: 200 } }), new D.TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-2' }),
        new D.Paragraph({ children: [new D.TextRun({ text: 'Si el índice sale vacío: en Word, clic derecho sobre él › Actualizar campos; en LibreOffice, Herramientas › Actualizar › Actualizar todo. Borra esta nota después.', italics: true, color: '888888', size: 18 })] }),
        new D.Paragraph({ children: [new D.PageBreak()] })); return; }
    if (heading[t]) { out.push(new D.Paragraph({ children: runs(n), heading: heading[t] })); return; }
    if (t === 'P' || t === 'PRE' || t === 'BLOCKQUOTE') { out.push(para(n, t === 'BLOCKQUOTE' ? { indent: { left: 400 } } : {})); return; }
    if (t === 'UL' || t === 'OL') { for (const li of n.children) out.push(new D.Paragraph({ children: runs(li), bullet: { level: list || 0 } })); return; }
    if (t === 'HR') { out.push(new D.Paragraph({ border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } } })); return; }
    if (t === 'IMG') { const r = await imgRun(n.getAttribute('src')); if (r) out.push(new D.Paragraph({ children: [r], alignment: D.AlignmentType.CENTER })); return; }
    if (t === 'TABLE') {
      const rows = [...n.querySelectorAll('tr')].map((tr, ri) => new D.TableRow({ tableHeader: ri === 0 && !!tr.querySelector('th'), children: [...tr.children].map(c => new D.TableCell({
        columnSpan: +c.getAttribute('colspan') || 1, shading: c.tagName === 'TH' || tr.classList.contains('tot') ? { fill: 'EEF0F4' } : undefined,
        children: [new D.Paragraph({ children: runs(c, { b: tr.classList.contains('tot') }), alignment: c.classList.contains('n') ? D.AlignmentType.RIGHT : D.AlignmentType.LEFT })] })) }));
      out.push(new D.Table({ rows, width: { size: 100, type: D.WidthType.PERCENTAGE } }), new D.Paragraph({ text: '' })); return;
    }
    for (const c of n.childNodes) await block(c, list);
    if (/page-break-after:\s*always/.test(n.getAttribute('style') || '')) out.push(new D.Paragraph({ children: [new D.PageBreak()] }));
  }
  for (const c of root.childNodes) await block(c);
  const doc = new D.Document({ features: { updateFields: true }, creator: 'Planner SEA', title: proj().name,
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } }, heading1: { run: { size: 30, bold: true, color: C }, paragraph: { spacing: { before: 360, after: 160 } } },
      heading2: { run: { size: 25, bold: true, color: '1F2937' }, paragraph: { spacing: { before: 240, after: 120 } } }, heading3: { run: { size: 23, bold: true, color: '374151' } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children: out,
      footers: { default: new D.Footer({ children: [new D.Paragraph({ alignment: D.AlignmentType.RIGHT, children: [new D.TextRun({ children: [D.PageNumber.CURRENT], color: '888888', size: 18 })] })] }) } }] });
  return D.Packer.toBlob(doc);
}

/* ---------- 12 · Presentación automática ---------- */
function deckSlides(){
  const p = proj(), mod = modOf(p.module), done = S.tasks.filter(t => t.status === 'completada').length, pct = S.tasks.length ? Math.round(done / S.tasks.length * 100) : 0;
  const bks = [...S.buckets].sort((a, b) => a.position - b.position), c = budgetCalc(budgetDefaults());
  const photos = S.posts.flatMap(x => x.images).slice(0, 4), mins = S.tlogs.reduce((a, l) => a + l.minutes, 0);
  const s = [{ k: 'cover', title: p.name, sub: [mod?.name, SCHOOL].filter(Boolean).join(' · '), extra: team().map(u => pname(u.id)).join(' · ') },
    { k: 'text', title: 'Objetivo', text: p.description || 'Añade una descripción al proyecto en sus Ajustes y saldrá aquí.' }];
  if (team().length) s.push({ k: 'list', title: 'Equipo', items: team().map(u => { const n = S.tasks.filter(t => t.task_assignees.some(a => a.user_id === u.id)).length; return `${pname(u.id)} — ${n} tarea${n === 1 ? "" : "s"}`; }) });
  if (bks.length) s.push({ k: 'phases', title: 'Planificación', items: bks.map(b => { const ts = S.tasks.filter(t => t.bucket_id === b.id), d = ts.filter(t => t.status === 'completada').length; return { name: b.name, pct: ts.length ? Math.round(d / ts.length * 100) : 0, n: ts.length }; }), note: p.due_date ? 'Entrega: ' + fmtLong(p.due_date) : '' });
  S.decisions.filter(d => d.chosen != null).forEach(d => s.push({ k: 'list', title: d.title, items: decResult(d).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map(r => `${r.oi === d.chosen ? '✔ ' : ''}${r.o}${r.score != null ? ` — ${r.score.toFixed(1).replace('.', ',')}/5` : ''}`), note: 'Criterios: ' + d.criteria.map(c => c.name).join(', ') }));
  if (S.materials.length) s.push({ k: 'list', title: 'Material y presupuesto', items: [...c.rows].sort((a, b) => b.imp - a.imp).slice(0, 7).map(r => `${r.name} (${String(r.qty).replace('.', ',')} ${r.unit || ''}) — ${eur(r.imp)}`), note: `Total material: ${eur(c.mat)} · ${S.materials.length} artículos` });
  S.plans.forEach(pl => s.push({ k: 'img', title: pl.title, img: ['planos', pl.pages[0]] }));
  if (photos.length) s.push({ k: 'photos', title: 'El proyecto en fotos', imgs: photos.map(x => ['diario', x]) });
  s.push({ k: 'stats', title: 'Estado del proyecto', stats: [[pct + '%', 'completado'], [`${done}/${S.tasks.length}`, 'tareas hechas'], [fmtMin(mins), 'de trabajo registrado']] });
  s.push({ k: 'end', title: '¿Preguntas?', sub: 'Gracias por vuestra atención' });
  return s;
}
function deckOptsHTML(){
  return `<div class="mod sm"><div class="mh"><h3>Presentación del proyecto</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <p class="small mut" style="margin-top:0">Se crean ${deckSlides().length} diapositivas con la descripción, el equipo, las fases, las decisiones elegidas, el material, los planos y las fotos del diario.</p>
    <div class="docs-g"><button class="doc-o" onclick="closeModal();startDeck()">${ic('monitor-play')}<div><b>Presentar aquí</b><small>Pantalla completa. Flechas o clic para avanzar, Esc para salir.</small></div></button>
      <button class="doc-o" onclick="pptxDeck()">${ic('file-down')}<div><b>Descargar PowerPoint</b><small>Para retocarla o presentarla en el ordenador de clase.</small></div></button></div></div></div>`;
}
function slideHTML(x, color){
  const img = ([b, path]) => esc(imgUrl(b, path) || '');
  const body = {
    cover: () => `<img class="sl-logo" src="logo-full.png" alt=""><h1>${esc(x.title)}</h1><p class="sl-sub">${esc(x.sub)}</p><p class="sl-x">${esc(x.extra)}</p>`,
    text: () => `<h2>${esc(x.title)}</h2><p class="sl-t">${esc(x.text)}</p>`,
    list: () => `<h2>${esc(x.title)}</h2><ul>${x.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>${x.note ? `<p class="sl-n">${esc(x.note)}</p>` : ''}`,
    phases: () => `<h2>${esc(x.title)}</h2>${x.items.map(i => `<div class="sl-ph"><span>${esc(i.name)}</span><div class="sl-bar"><i style="width:${i.pct}%"></i></div><b>${i.pct}%</b></div>`).join('')}${x.note ? `<p class="sl-n">${esc(x.note)}</p>` : ''}`,
    img: () => `<h2>${esc(x.title)}</h2><img class="sl-img" src="${img(x.img)}" alt="">`,
    photos: () => `<h2>${esc(x.title)}</h2><div class="sl-photos">${x.imgs.map(i => `<img src="${img(i)}" alt="">`).join('')}</div>`,
    stats: () => `<h2>${esc(x.title)}</h2><div class="sl-stats">${x.stats.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>`,
    end: () => `<h1>${esc(x.title)}</h1><p class="sl-sub">${esc(x.sub)}</p>`,
  }[x.k]();
  return `<div class="slide sl-${x.k}" style="--c:${esc(color)}">${body}</div>`;
}
async function startDeck(){
  track('f:deck'); await Promise.all([signImages('diario', S.posts.flatMap(x => x.images)), signImages('planos', S.plans.map(x => x.pages[0]))]);
  S.deck = { i: 0, s: deckSlides() };
  const el = document.createElement('div'); el.id = 'deck'; document.body.append(el);
  el.onclick = e => { if (!e.target.closest('.deck-nav')) deckGo(1); };
  document.documentElement.requestFullscreen?.().catch(() => {}); drawDeck();
}
function drawDeck(){
  const d = S.deck, el = $('#deck'); if (!d || !el) return;
  el.innerHTML = slideHTML(d.s[d.i], proj().color) + `<div class="deck-nav"><button onclick="deckGo(-1)" aria-label="Anterior">‹</button><span>${d.i + 1} / ${d.s.length}</span><button onclick="deckGo(1)" aria-label="Siguiente">›</button><button onclick="endDeck()" aria-label="Salir">✕</button></div>`;
}
function deckGo(k){ const d = S.deck; if (!d) return; d.i = Math.max(0, Math.min(d.s.length - 1, d.i + k)); drawDeck(); }
function endDeck(){ S.deck = null; $('#deck')?.remove(); if (document.fullscreenElement) document.exitFullscreen?.(); }
document.addEventListener('keydown', e => {
  if (!S.deck) return;
  if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); deckGo(1); }
  else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); deckGo(-1); }
  else if (e.key === 'Escape') { e.stopPropagation(); endDeck(); }
}, true);
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && S.deck) endDeck(); });
async function pptxDeck(){
  toast('Creando el PowerPoint…'); track('f:pptx');
  try { if (!window.PptxGenJS) await loadScript(PPTX); } catch { return toast('No se pudo cargar el generador de PowerPoint. Revisa tu conexión.', 'err'); }
  await Promise.all([signImages('diario', S.posts.flatMap(x => x.images)), signImages('planos', S.plans.map(x => x.pages[0]))]);
  const p = proj(), C = (p.color || '#4f46e5').replace('#', ''), slides = deckSlides(), pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE'; pres.title = p.name;
  const data = async ([b, path]) => { try { const u = b === 'logo' ? new URL('logo-full.png', location.href).href : imgUrl(b, path); return u ? await toDataUrl(u) : null; } catch { return null; } };
  const size = src => new Promise(ok => { const i = new Image(); i.onload = () => ok([i.width, i.height]); i.onerror = () => ok([4, 3]); i.src = src; });
  const fit = async (src, x, y, w, h) => { const [iw, ih] = await size(src), k = Math.min(w / iw, h / ih); return { data: src, x: x + (w - iw * k) / 2, y: y + (h - ih * k) / 2, w: iw * k, h: ih * k }; };
  const title = (sl, t) => { sl.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: C } }); sl.addText(t, { x: 0.6, y: 0.35, w: 12.1, h: 0.9, fontSize: 30, bold: true, color: '1F2937', fontFace: 'Calibri' }); };
  const logo = await data(['logo']);
  for (const x of slides) {
    const sl = pres.addSlide(); sl.background = { color: 'FFFFFF' };
    if (x.k === 'cover' || x.k === 'end') {
      sl.background = { color: C };
      if (x.k === 'cover' && logo) sl.addImage(await fit(logo, 4.67, 0.6, 4, 1.4));
      sl.addText(x.title, { x: 0.6, y: x.k === 'cover' ? 2.4 : 2.6, w: 12.1, h: 1.4, fontSize: 44, bold: true, color: 'FFFFFF', align: 'center', fontFace: 'Calibri' });
      sl.addText(x.sub || '', { x: 0.6, y: x.k === 'cover' ? 3.9 : 4.1, w: 12.1, h: 0.6, fontSize: 20, color: 'FFFFFF', align: 'center' });
      if (x.extra) sl.addText(x.extra, { x: 0.6, y: 5.6, w: 12.1, h: 0.8, fontSize: 16, color: 'FFFFFF', align: 'center' });
      continue;
    }
    title(sl, x.title);
    if (x.k === 'text') sl.addText(x.text, { x: 0.8, y: 1.6, w: 11.7, h: 5, fontSize: 22, color: '374151', valign: 'top' });
    if (x.k === 'list') { sl.addText(x.items.map(t => ({ text: t, options: { bullet: true, breakLine: true } })), { x: 0.8, y: 1.5, w: 11.7, h: 4.8, fontSize: 20, color: '374151', valign: 'top', paraSpaceAfter: 8 }); if (x.note) sl.addText(x.note, { x: 0.8, y: 6.5, w: 11.7, h: 0.5, fontSize: 14, color: '6B7280' }); }
    if (x.k === 'phases') { x.items.forEach((ph, i) => { const y = 1.6 + i * 0.75; sl.addText(ph.name, { x: 0.8, y, w: 4, h: 0.5, fontSize: 18, color: '374151' });
        sl.addShape(pres.ShapeType.roundRect, { x: 5, y: y + 0.12, w: 6.5, h: 0.28, fill: { color: 'E5E7EB' }, rectRadius: 0.1 });
        if (ph.pct) sl.addShape(pres.ShapeType.roundRect, { x: 5, y: y + 0.12, w: 6.5 * ph.pct / 100, h: 0.28, fill: { color: C }, rectRadius: 0.1 });
        sl.addText(ph.pct + '%', { x: 11.7, y, w: 1, h: 0.5, fontSize: 16, bold: true, color: '374151' }); });
      if (x.note) sl.addText(x.note, { x: 0.8, y: 6.5, w: 11.7, h: 0.5, fontSize: 14, color: '6B7280' }); }
    if (x.k === 'img') { const s = await data(x.img); if (s) sl.addImage(await fit(s, 0.6, 1.4, 12.1, 5.8)); }
    if (x.k === 'photos') { const n = x.imgs.length, cols = n > 1 ? 2 : 1, rows = Math.ceil(n / cols), w = 12.1 / cols, h = 5.8 / rows;
      for (let i = 0; i < n; i++) { const s = await data(x.imgs[i]); if (s) sl.addImage(await fit(s, 0.6 + (i % cols) * w + 0.1, 1.4 + Math.floor(i / cols) * h + 0.1, w - 0.2, h - 0.2)); } }
    if (x.k === 'stats') x.stats.forEach(([v, l], i) => { sl.addText(v, { x: 0.8 + i * 4, y: 2.4, w: 3.8, h: 1.2, fontSize: 48, bold: true, color: C, align: 'center' }); sl.addText(l, { x: 0.8 + i * 4, y: 3.6, w: 3.8, h: 0.6, fontSize: 18, color: '6B7280', align: 'center' }); });
  }
  await pres.writeFile({ fileName: `Presentacion - ${p.name}.pptx` }); closeModal(); toast('PowerPoint descargado');
}
