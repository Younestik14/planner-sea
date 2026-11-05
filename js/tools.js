'use strict';
// Planner SEA · herramientas: reuniones, plantillas de notas, calculadoras, material, mi semana,
// notas privadas, anuncio general, registro de administración y estadísticas de uso

/* ============ 19 · Registro de uso (lo ve solo el propietario) ============ */
const _tracked = {};
function track(kind){
  if (!S.me || (!S.me.approved && !S.me.is_admin)) return;
  if (Date.now() - (_tracked[kind] || 0) < 30000) return; // como mucho una vez cada 30 s por tipo
  _tracked[kind] = Date.now();
  sb.from('usage_events').insert({ kind }).then(() => {});
}

/* ============ 9 · Reuniones ============ */
const RSVP = [['si', 'Voy', 'circle-check'], ['quiza', 'Quizá', 'circle-help'], ['no', 'No voy', 'circle-x']];
function meetingWhen(iso){
  const d = new Date(iso), days = dayDiff(today(), isoOf(d));
  const rel = d < new Date() ? 'ya pasó' : days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`;
  return { date: cap(d.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' })), time: d.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }), rel, past: d < new Date() };
}
function meetingHTML(p){
  const w = meetingWhen(p.meeting_at), rs = S.rsvps.filter(r => r.post_id === p.id), mine = rs.find(r => r.user_id === S.me.id)?.answer, M = canManagePost(p);
  const agreements = (p.minutes || '').split('\n').map(l => l.match(/^\s*(?:[-*]|\d+[.)])\s+(.+)$/)?.[1]).filter(Boolean);
  return `<div class="meet ${w.past ? 'past' : ''}">
      <div class="meet-date"><b>${esc(w.time)}</b><span>${esc(w.date)}</span><small>${w.rel}</small></div>
      <div class="grow">${p.place ? `<div class="row small">${ic('map-pin', 'sm')} ${esc(p.place)}</div>` : ''}
        ${p.body ? `<div class="sect" style="margin:8px 0 4px">Orden del día</div><div class="mdv">${md(p.body)}</div>` : ''}</div></div>
    <div class="rsvp">${RSVP.map(([k, n, i]) => { const who = rs.filter(r => r.answer === k);
      return `<button class="${mine === k ? 'on ' + k : ''}" ${w.past ? 'disabled' : ''} onclick="rsvp('${p.id}','${k}',${mine === k})" title="${esc(who.map(r => pname(r.user_id)).join(', ') || 'Nadie')}">${ic(i, 'sm')} ${n} <b>${who.length}</b></button>`; }).join('')}
      <span class="avs" style="margin-left:6px">${rs.filter(r => r.answer === 'si').map(r => av(r.user_id)).join('')}</span></div>
    ${p.minutes ? `<div class="acta"><div class="row"><b>${ic('notebook-text')} Acta de la reunión</b><span class="grow"></span>
        ${M ? `<button class="btn sm ghost" onclick="openMinutes('${p.id}')">${ic('pencil', 'sm')} Editar</button>` : ''}
        ${adminOf(p.project_id) && agreements.length ? `<button class="btn sm" onclick="openAgreements('${p.id}')">${ic('list-plus', 'sm')} Convertir acuerdos en tareas</button>` : ''}</div>
      <div class="mdv">${md(p.minutes)}</div></div>`
      : M ? `<button class="btn sm ghost" style="margin-top:10px" onclick="openMinutes('${p.id}')">${ic('notebook-pen', 'sm')} Escribir el acta</button>` : ''}`;
}
async function rsvp(pid, answer, had){
  track('f:rsvp');
  S.rsvps = S.rsvps.filter(r => !(r.post_id === pid && r.user_id === S.me.id)); if (!had) S.rsvps.push({ post_id: pid, user_id: S.me.id, answer }); render();
  if (had) await q(sb.from('meeting_rsvps').delete().match({ post_id: pid, user_id: S.me.id }));
  else await q(sb.from('meeting_rsvps').upsert({ post_id: pid, user_id: S.me.id, answer }, { onConflict: 'post_id,user_id' }));
}
function openMinutes(pid){
  const p = S.posts.find(x => x.id === pid);
  S.minutes = { pid, text: p.minutes || `**Asistentes:** ${S.rsvps.filter(r => r.post_id === pid && r.answer === 'si').map(r => pname(r.user_id)).join(', ')}\n\n## Temas tratados\n- \n\n## Acuerdos\n- Tarea @persona fecha !prioridad\n` };
  openModal('minutes');
}
function minutesHTML(){
  return `<div class="mod md"><div class="mh"><h3>Acta de la reunión</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <p class="small mut">Escribe cada acuerdo como una línea que empiece por «- ». Luego podrás convertirlos en tareas: <code>- Comprar cable @ana viernes !urgente #Material</code></p>
    <textarea id="min-text" class="wtext" style="min-height:300px" oninput="S.minutes.text=this.value">${esc(S.minutes.text)}</textarea>
    <div class="row" style="margin-top:12px"><span class="grow"></span><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" onclick="saveMinutes()">${ic('check', 'sm')} Guardar acta</button></div></div></div>`;
}
async function saveMinutes(){ await q(sb.from('posts').update({ minutes: S.minutes.text.trim() || null }).eq('id', S.minutes.pid)); closeModal(); toast('Acta guardada'); }
function openAgreements(pid){
  const p = S.posts.find(x => x.id === pid);
  S.agr = { pid, items: p.minutes.split('\n').map(l => l.match(/^\s*(?:[-*]|\d+[.)])\s+(.+)$/)?.[1]).filter(Boolean).map(t => ({ t, on: true })), bucket: S.buckets[0]?.id || null };
  openModal('agreements');
}
function agreementsHTML(){
  const A = S.agr;
  return `<div class="mod md"><div class="mh"><h3>Convertir acuerdos en tareas</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <p class="small mut">Se entienden @persona, fechas (viernes, 20/12…), !prioridad y #etiqueta, igual que al escribir una tarea.</p>
    ${A.items.map((x, i) => { const r = parseQuick(x.t); return `<label class="chkrow" style="align-items:flex-start;padding:8px 4px"><input type="checkbox" ${x.on ? 'checked' : ''} onchange="S.agr.items[${i}].on=this.checked">
      <span><b>${esc(r.title)}</b><br><small class="mut">${[r.who.length && '👤 ' + r.who.map(first).join(', '), r.due && '📅 ' + fmtD(r.due), r.prio && '⚡ ' + PRIO[r.prio][0], r.labels.length && '🏷 ' + r.labels.join(', ')].filter(Boolean).join(' · ') || 'Sin persona ni fecha'}</small></span></label>`; }).join('')}
    <label>Columna</label><select onchange="S.agr.bucket=this.value">${S.buckets.map(b => `<option value="${b.id}" ${A.bucket === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
    <div class="row" style="margin-top:14px"><span class="grow"></span><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" onclick="createAgreements()">${ic('list-plus', 'sm')} Crear ${A.items.filter(x => x.on).length} tareas</button></div></div></div>`;
}
async function createAgreements(){
  const items = S.agr.items.filter(x => x.on); if (!items.length) return closeModal();
  const base = -Date.now();
  for (const [i, x] of items.entries()) await createParsed(x.t, S.agr.bucket, base + i);
  closeModal(); toast(`${items.length} tareas creadas a partir del acta`); track('f:agreements');
}

/* ============ 10 · Plantillas de documentos para Notas ============ */
const WIKI_TPL = [
  ['blank', 'En blanco', 'file', ''],
  ['memoria', 'Memoria técnica', 'file-text', `# Memoria técnica\n\n## 1. Objeto del proyecto\nDescribe qué se va a hacer y para qué.\n\n## 2. Emplazamiento\n- Dirección / ubicación:\n- Uso del local o instalación:\n\n## 3. Normativa aplicable\n- REBT (RD 842/2002) e ITC-BT aplicables:\n- Otras normas (UNE, ordenanzas…):\n\n## 4. Descripción de la instalación\n### 4.1 Acometida y caja general de protección\n### 4.2 Línea general de alimentación / derivación individual\n### 4.3 Cuadro general de mando y protección\n### 4.4 Circuitos interiores\n\n## 5. Previsión de cargas\n| Receptor | Potencia (W) | Coef. | Potencia de cálculo (W) |\n\n## 6. Cálculos justificativos\n- Intensidades:\n- Secciones y caídas de tensión:\n- Protecciones (magnetotérmicos y diferenciales):\n\n## 7. Puesta a tierra\n\n## 8. Conclusión\n`],
  ['presupuesto', 'Presupuesto', 'calculator', `# Presupuesto\n\n## Capítulo 1. Material\n- Ver la pestaña **Material** del proyecto (se exporta a Excel).\n\n## Capítulo 2. Mano de obra\n- Horas oficial:\n- Horas ayudante:\n\n## Capítulo 3. Otros\n- Transporte, medios auxiliares…\n\n---\n**Total ejecución material:**\n**Gastos generales (13 %):**\n**Beneficio industrial (6 %):**\n**IVA (21 %):**\n**TOTAL:**\n`],
  ['pliego', 'Pliego de condiciones', 'scroll-text', `# Pliego de condiciones\n\n## 1. Condiciones generales\n- Objeto y alcance del pliego\n- Normativa de obligado cumplimiento\n\n## 2. Condiciones de los materiales\n- Conductores:\n- Canalizaciones:\n- Aparamenta de protección:\n- Cuadros:\n\n## 3. Condiciones de ejecución\n- Replanteo y montaje\n- Conexionado y señalización\n\n## 4. Pruebas y verificaciones\n- Aislamiento, continuidad, tierra, disparo de diferenciales\n\n## 5. Condiciones de seguridad\n\n## 6. Certificados y documentación final\n`],
  ['seguridad', 'Estudio básico de seguridad y salud', 'shield-check', `# Estudio básico de seguridad y salud\n\n## 1. Datos de la obra\n- Descripción y duración prevista:\n- Número de trabajadores:\n\n## 2. Riesgos identificados\n- [ ] Contacto eléctrico directo / indirecto\n- [ ] Caídas a distinto nivel\n- [ ] Cortes y golpes con herramientas\n- [ ] Sobreesfuerzos\n\n## 3. Medidas preventivas\n- Las 5 reglas de oro para trabajar sin tensión (RD 614/2001)\n- Señalización y delimitación de la zona\n\n## 4. Equipos de protección individual\n- Guantes aislantes, gafas, casco, calzado de seguridad\n\n## 5. Primeros auxilios y emergencias\n`],
  ['acta', 'Acta de reunión', 'notebook-text', `# Acta de reunión\n\n**Fecha:**\n**Lugar:**\n**Asistentes:**\n\n## Orden del día\n1. \n\n## Temas tratados\n- \n\n## Acuerdos\n- Tarea @persona fecha !prioridad\n\n## Próxima reunión\n`],
  ['pruebas', 'Protocolo de pruebas y puesta en marcha', 'clipboard-check', `# Protocolo de pruebas y puesta en marcha\n\n## Inspección visual\n- [ ] Identificación de circuitos y cuadros\n- [ ] Apriete de bornes y conexiones\n- [ ] Secciones y colores de conductores\n\n## Medidas\n| Prueba | Valor medido | Valor exigido | ¿Cumple? |\n- [ ] Continuidad de protección\n- [ ] Resistencia de aislamiento\n- [ ] Resistencia de puesta a tierra\n- [ ] Disparo de diferenciales (tiempo e intensidad)\n\n## Puesta en marcha\n- [ ] Secuencia de arranque\n- [ ] Comprobación de automatismos y señalización\n\n**Responsable:**\n**Fecha:**\n`],
];
function newWikiPage(){ S.wnew = { tpl: 'blank', title: '' }; openModal('wikinew'); }
function wikiNewHTML(){
  return `<div class="mod md"><div class="mh"><h3>Nueva página de notas</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <label>Título</label><input id="wn-title" value="${esc(S.wnew.title)}" placeholder="Ej.: Memoria técnica del cuadro" oninput="S.wnew.title=this.value">
    <label>Plantilla</label><div class="tpls">${WIKI_TPL.map(([k, n, i]) => `<button class="tpl ${S.wnew.tpl === k ? 'on' : ''}" onclick="S.wnew.tpl='${k}';if(!S.wnew.title&&'${k}'!=='blank')S.wnew.title='${n}';keep(renderModal)">${ic(i)}<span>${n}</span></button>`).join('')}</div>
    <div class="row" style="margin-top:16px"><span class="grow"></span><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" onclick="createWikiPage()">Crear página</button></div></div></div>`;
}
async function createWikiPage(){
  const t = (S.wnew.title || '').trim(); if (!t) return toast('Ponle un título a la página', 'err');
  const body = WIKI_TPL.find(x => x[0] === S.wnew.tpl)[3];
  const [w] = await q(sb.from('wiki_pages').insert({ project_id: S.pid, title: t, body, position: Date.now() }).select());
  closeModal(); S.wiki.push(w); S.wid = w.id; S.wedit = { id: w.id, title: w.title, body }; render();
  if (S.wnew.tpl !== 'blank') track('f:wikitemplate');
}

/* ============ 11 · Calculadoras eléctricas ============ */
// Conductividad γ en m/(Ω·mm²) según material y temperatura del conductor
const GAMMA = { cu20: ['Cobre a 20 °C', 56], cu70: ['Cobre a 70 °C (PVC)', 48], cu90: ['Cobre a 90 °C (XLPE/EPR)', 44], al20: ['Aluminio a 20 °C', 35], al70: ['Aluminio a 70 °C (PVC)', 30], al90: ['Aluminio a 90 °C (XLPE/EPR)', 28] };
const SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];
const nf = (v, d = 2) => Number.isFinite(v) ? v.toLocaleString('es-ES', { maximumFractionDigits: d }) : '—';
const k3 = tri => tri ? Math.sqrt(3) : 2; // factor de la línea: 2 (monofásica, ida y vuelta) o √3 (trifásica)
// Fórmulas simplificadas sin reactancia, válidas para secciones habituales en baja tensión
const CALC = {
  intensidad: v => { const I = v.P / ((v.tri ? Math.sqrt(3) : 1) * v.U * v.cos); return { I, txt: `I = ${nf(I)} A` }; },
  potencia: v => { const P = (v.tri ? Math.sqrt(3) : 1) * v.U * v.I * v.cos; return { P, txt: `P = ${nf(P, 0)} W (${nf(P / 1000)} kW)` }; },
  caida: v => { const dU = k3(v.tri) * v.L * v.I * v.cos / (GAMMA[v.g][1] * v.S), pct = dU / v.U * 100; return { dU, pct, txt: `ΔU = ${nf(dU)} V (${nf(pct)} %)${v.max ? (pct <= v.max ? ` · cumple el ${nf(v.max, 1)} %` : ` · NO cumple el ${nf(v.max, 1)} %`) : ''}` }; },
  seccion: v => { const Smin = k3(v.tri) * v.L * v.I * v.cos / (GAMMA[v.g][1] * v.max / 100 * v.U), S = SECTIONS.find(s => s >= Smin);
    return { Smin, S, txt: `Sección mínima por caída de tensión: ${nf(Smin)} mm² → normalizada ${S ? nf(S, 1) + ' mm²' : 'más de 300 mm²'}` }; },
};
const CALC_TABS = [['intensidad', 'Intensidad'], ['potencia', 'Potencia'], ['caida', 'Caída de tensión'], ['seccion', 'Sección por caída']];
function openCalc(){ S.calc ||= { t: 'caida', v: { tri: true, U: 400, P: 10000, I: 16, cos: 0.9, L: 30, S: 6, g: 'cu70', max: 3 } }; openModal('calc'); track('f:calc'); }
function calcHTML(){
  const C = S.calc, v = C.v, f = (k, label, unit) => `<div><label>${label}</label><div class="row" style="gap:4px"><input type="text" inputmode="decimal" value="${Number.isFinite(v[k]) ? String(v[k]).replace('.', ',') : ''}" oninput="S.calc.v.${k}=parseFloat(this.value.replace(',','.'));calcUpdate()"><span class="small mut" style="min-width:28px">${unit}</span></div></div>`;
  const fields = { intensidad: ['P', 'U', 'cos'], potencia: ['I', 'U', 'cos'], caida: ['L', 'I', 'cos', 'S', 'U', 'g', 'max'], seccion: ['L', 'I', 'cos', 'U', 'g', 'max'] }[C.t];
  const F = { P: f('P', 'Potencia', 'W'), U: f('U', 'Tensión', 'V'), cos: f('cos', 'cos φ', ''), I: f('I', 'Intensidad', 'A'), L: f('L', 'Longitud de la línea', 'm'), S: f('S', 'Sección', 'mm²'),
    g: `<div><label>Conductor</label><select onchange="S.calc.v.g=this.value;calcUpdate()">${Object.entries(GAMMA).map(([k, [n, gg]]) => `<option value="${k}" ${v.g === k ? 'selected' : ''}>${n} · γ=${gg}</option>`).join('')}</select></div>`,
    max: `<div><label>Caída máxima admitida</label><div class="row" style="gap:4px"><select onchange="S.calc.v.max=parseFloat(this.value);calcUpdate()">${[[1, 'DI: 1 %'], [1.5, 'DI: 1,5 %'], [3, 'Alumbrado: 3 %'], [5, 'Otros usos: 5 %']].map(([k, n]) => `<option value="${k}" ${v.max === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>` };
  const canIns = adminOf() && S.view === 'wiki' && S.wid;
  return `<div class="mod md"><div class="mh"><h3>${ic('calculator')} Calculadoras eléctricas</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <div class="tabs" style="position:static;padding:0;margin:4px 0 6px">${CALC_TABS.map(([k, n]) => `<button class="tab ${C.t === k ? 'on' : ''}" onclick="S.calc.t='${k}';keep(renderModal)">${n}</button>`).join('')}</div>
    <div class="seg" style="margin-top:10px"><button class="${v.tri ? '' : 'on'}" onclick="S.calc.v.tri=false;S.calc.v.U=230;keep(renderModal)">Monofásica 230 V</button><button class="${v.tri ? 'on' : ''}" onclick="S.calc.v.tri=true;S.calc.v.U=400;keep(renderModal)">Trifásica 400 V</button></div>
    <div class="grid4" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${fields.map(k => F[k]).join('')}</div>
    <div class="calc-res" id="calc-res"></div>
    <p class="small mut">${C.t === 'caida' || C.t === 'seccion' ? `Fórmula: ΔU = ${v.tri ? '√3' : '2'}·L·I·cos φ / (γ·S), sin reactancia (válida para secciones habituales en BT). Límites orientativos: derivación individual 1 % o 1,5 % (ITC-BT-15), alumbrado 3 % y demás usos 5 % (ITC-BT-19). Comprueba también la <b>intensidad admisible</b> (tablas de la ITC-BT-19) y las secciones mínimas (ITC-BT-25): esta calculadora no las incluye.`
      : `Fórmula: ${C.t === 'intensidad' ? `I = P / (${v.tri ? '√3·' : ''}U·cos φ)` : `P = ${v.tri ? '√3·' : ''}U·I·cos φ`}.`}</p>
    <div class="row" style="margin-top:10px"><span class="grow"></span>${canIns ? `<button class="btn pri" onclick="insertCalc()">${ic('file-plus', 'sm')} Insertar en la nota</button>` : `<span class="small mut">${adminOf() ? 'Abre una página de Notas para poder insertar el resultado.' : ''}</span>`}</div></div></div>`;
}
function calcUpdate(){
  const el = $('#calc-res'); if (!el) return;
  const v = S.calc.v, need = { intensidad: ['P', 'U', 'cos'], potencia: ['I', 'U', 'cos'], caida: ['L', 'I', 'cos', 'S', 'U'], seccion: ['L', 'I', 'cos', 'U', 'max'] }[S.calc.t];
  const bad = need.some(k => !(v[k] > 0)) || v.cos > 1;
  el.className = 'calc-res' + (bad ? ' err' : '');
  if (bad) { el.textContent = v.cos > 1 ? 'El cos φ debe estar entre 0 y 1' : 'Rellena todos los datos con valores mayores que 0'; return; }
  const r = CALC[S.calc.t](v); S.calc.r = r;
  el.className = 'calc-res' + (S.calc.t === 'caida' && v.max && r.pct > v.max ? ' err' : ' ok');
  el.textContent = r.txt;
}
async function insertCalc(){
  const v = S.calc.v, r = S.calc.r, w = S.wiki.find(x => x.id === S.wid); if (!r || !w) return;
  const name = CALC_TABS.find(x => x[0] === S.calc.t)[1], line = v.tri ? 'trifásica' : 'monofásica';
  const data = { intensidad: `P = ${nf(v.P, 0)} W · U = ${v.U} V · cos φ = ${nf(v.cos)}`, potencia: `I = ${nf(v.I)} A · U = ${v.U} V · cos φ = ${nf(v.cos)}`,
    caida: `L = ${nf(v.L)} m · I = ${nf(v.I)} A · cos φ = ${nf(v.cos)} · S = ${nf(v.S, 1)} mm² · ${GAMMA[v.g][0]} (γ = ${GAMMA[v.g][1]}) · U = ${v.U} V`,
    seccion: `L = ${nf(v.L)} m · I = ${nf(v.I)} A · cos φ = ${nf(v.cos)} · ${GAMMA[v.g][0]} (γ = ${GAMMA[v.g][1]}) · U = ${v.U} V · ΔU máx = ${nf(v.max, 1)} %` }[S.calc.t];
  const block = `\n\n### 🧮 ${name} (línea ${line})\n- Datos: ${data}\n- **Resultado: ${r.txt}**\n- Calculado el ${new Date().toLocaleDateString('es-ES')} por ${pname(S.me.id)}`;
  await q(sb.from('wiki_pages').update({ body: (w.body || '') + block }).eq('id', w.id));
  w.body = (w.body || '') + block; closeModal(); toast('Resultado añadido a la nota'); track('f:calcinsert');
}

/* ============ 12 · Lista de material ============ */
const MAT_STATUS = { pendiente: ['Pendiente', 'warn'], pedido: ['Pedido', 'acc'], recibido: ['Recibido', 'ok'] };
const eur = v => Number.isFinite(v) ? v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '—';
function materialHTML(){
  const E = adminOf(), rows = [...S.materials].sort((a, b) => a.position - b.position);
  const tot = rows.reduce((a, m) => a + (m.unit_price ?? 0) * m.qty, 0), by = k => rows.filter(m => m.status === k).reduce((a, m) => a + (m.unit_price ?? 0) * m.qty, 0);
  // los números van en texto con teclado decimal para aceptar la coma española (9,5)
  const cell = (m, k, type = 'text', w = '') => E ? `<input class="cellin" style="${w}" type="${type === 'url' ? 'url' : 'text'}" ${type === 'number' ? 'inputmode="decimal"' : ''} value="${esc(type === 'number' && m[k] != null ? String(m[k]).replace('.', ',') : m[k] ?? '')}" onclick="event.stopPropagation()" onchange="saveMat('${m.id}','${k}',this.value,'${type}')">` : esc(m[k] ?? '—');
  return `<div class="page" style="max-width:none">
    <div class="kpis" style="margin-top:0"><div class="card-box kpi"><b>${eur(tot)}</b><span>Total (sin IVA)</span></div>
      <div class="card-box kpi"><b style="color:var(--warn-t)">${eur(by('pendiente'))}</b><span>Pendiente de pedir</span></div>
      <div class="card-box kpi"><b style="color:var(--acc2)">${eur(by('pedido'))}</b><span>Pedido</span></div>
      <div class="card-box kpi"><b style="color:var(--ok-t)">${eur(by('recibido'))}</b><span>Recibido</span></div></div>
    <div class="row" style="margin:16px 0 10px">${E ? `<input id="mat-new" style="max-width:420px" placeholder="+ Añadir material (Enter)… Ej.: Cable RZ1-K 2,5 mm²" onkeydown="if(event.key==='Enter')addMat(this)">` : '<span class="small mut">Solo los admins del proyecto pueden editar el material.</span>'}
      <span class="grow"></span><button class="btn" onclick="exportExcel()">${ic('file-spreadsheet')} Exportar a Excel</button></div>
    <div class="card-box tablewrap"><table class="ltable mat"><thead><tr><th>Artículo</th><th>Cantidad</th><th>Ud.</th><th>Precio ud.</th><th>Total</th><th>Proveedor</th><th>Estado</th><th>Enlace</th>${E ? '<th></th>' : ''}</tr></thead>
    <tbody>${rows.map(m => `<tr style="cursor:default"><td>${cell(m, 'name', 'text', 'min-width:200px')}</td><td>${cell(m, 'qty', 'number', 'width:80px')}</td><td>${cell(m, 'unit', 'text', 'width:60px')}</td>
      <td>${E ? cell(m, 'unit_price', 'number', 'width:90px') : eur(m.unit_price)}</td><td><b>${m.unit_price != null ? eur(m.unit_price * m.qty) : '—'}</b></td><td>${cell(m, 'supplier', 'text', 'width:130px')}</td>
      <td>${E ? `<select class="cellsel" onchange="saveMat('${m.id}','status',this.value)">${Object.entries(MAT_STATUS).map(([k, [n]]) => `<option value="${k}" ${m.status === k ? 'selected' : ''}>${n}</option>`).join('')}</select>` : `<span class="chip ${MAT_STATUS[m.status][1]}">${MAT_STATUS[m.status][0]}</span>`}</td>
      <td>${E ? cell(m, 'link', 'url', 'width:130px') : ''}${okUrl(m.link) ? ` <a href="${esc(m.link)}" target="_blank" rel="noopener" title="Abrir">${ic('external-link', 'sm')}</a>` : ''}</td>
      ${E ? `<td><button class="ico" title="Eliminar" onclick="delMat('${m.id}')">${ic('trash-2', 'sm')}</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="9">${emptyState('package', 'Sin material todavía', E ? 'Añade el primer artículo arriba.' : '')}</td></tr>`}</tbody></table></div></div>`;
}
async function addMat(el){
  const name = el.value.trim(); if (!name) return; el.value = '';
  const [m] = await q(sb.from('materials').insert({ project_id: S.pid, name, position: Date.now() }).select());
  S.materials.push(m); keep(render); track('f:material');
}
async function saveMat(id, k, v, type){
  const m = S.materials.find(x => x.id === id); if (!m) return;
  if (type === 'number') { v = String(v).trim() === '' ? (k === 'unit_price' ? null : 0) : Number(String(v).trim().replace(/\./g, '').replace(',', '.'));
    if (v !== null && !(v >= 0)) { keep(render); return toast('Número no válido: usa coma para los decimales (ej.: 9,5)', 'err'); } }
  else if (type === 'url' && v && !okUrl(v)) return toast('El enlace debe empezar por https://', 'err');
  else if (k === 'name' && !String(v).trim()) return toast('El artículo necesita un nombre', 'err');
  else v = v === '' ? null : v;
  m[k] = v; keep(render); await q(sb.from('materials').update({ [k]: v }).eq('id', id));
}
async function delMat(id){ if (!confirm('¿Eliminar este artículo?')) return; S.materials = S.materials.filter(x => x.id !== id); render(); await q(sb.from('materials').delete().eq('id', id)); }

/* ============ 14 · Calendario de clase (entregas de proyectos + exámenes, lo ve todo el mundo) ============ */
function weekHTML(){
  const base = S.ccal || new Date(), y = base.getFullYear(), m = base.getMonth(), O = isOwner();
  const first = new Date(y, m, 1), start = new Date(y, m, 1 - (first.getDay() + 6) % 7), td = today();
  const ents = S.projects.filter(p => p.due_date && !p.is_template && !p.archived);
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i); const k = isoOf(d);
    const ex = S.exams.filter(e => e.exam_date === k), en = ents.filter(p => p.due_date === k);
    cells += `<div class="dc ${d.getMonth() !== m ? 'out' : ''} ${k === td ? 'today' : ''}" ${O ? `ondblclick="if(event.target===this){S.examDay='${k}';editExam()}"` : ''}><div class="dn">${d.getDate()}</div>
      ${ex.map(examChip).join('')}
      ${en.map(p => `<button class="ct ce" style="--p:${p.color || 'var(--acc)'}" title="Entrega: ${esc(p.name)}" onclick="goProject('${p.id}')">${ic('flag', 'sm')} ${esc(p.name)}</button>`).join('')}</div>`;
  }
  const mv = k => `S.ccal=new Date(${y},${m + k},1);render()`;
  const next = [...S.exams.filter(e => e.exam_date >= td).map(e => ({ d: e.exam_date, t: 'Examen', n: e.title })), ...ents.filter(p => p.due_date >= td).map(p => ({ d: p.due_date, t: 'Entrega', n: p.name }))].sort((a, b) => a.d.localeCompare(b.d)).slice(0, 4);
  return `<div class="page" style="max-width:none"><div class="row" style="flex-wrap:wrap;margin-bottom:6px"><h1 class="grow" style="margin:0">Calendario de clase</h1>
      ${O ? `<button class="btn pri" onclick="S.examDay=null;editExam()">${ic('graduation-cap')} Añadir examen</button>` : ''}</div>
    <p class="mut" style="margin-top:0">Exámenes ${ic('graduation-cap', 'sm')} y entregas de proyectos ${ic('flag', 'sm')} de toda la clase.${O ? ' Doble clic en un día para poner un examen ese día.' : ''}</p>
    ${next.length ? `<div class="row" style="flex-wrap:wrap;gap:8px;margin-bottom:14px">${next.map(x => `<span class="chip" style="${x.t === 'Examen' ? 'color:var(--bad-t);background:var(--bad-bg)' : ''}"><b>${x.t}</b>&nbsp;${esc(x.n)} · ${fmtD(x.d)}${x.d === td ? ' (hoy)' : ''}</span>`).join('')}</div>` : ''}
    <div class="row" style="margin-bottom:12px">
      <button class="btn" onclick="${mv(-1)}" aria-label="Mes anterior">${ic('chevron-left')}</button><button class="btn" onclick="S.ccal=null;render()">Hoy</button><button class="btn" onclick="${mv(1)}" aria-label="Mes siguiente">${ic('chevron-right')}</button>
      <h3 style="margin:0 0 0 8px">${cap(first.toLocaleDateString('es-ES', { month:'long', year:'numeric' }))}</h3></div>
    <div class="cal">${['lun','mar','mié','jue','vie','sáb','dom'].map(d => `<div class="dh">${d}</div>`).join('')}${cells}</div></div>`;
}

/* ============ 15 · Notas privadas en cada tarea ============ */
let privT;
function privNoteHTML(){
  return `<label>${ic('lock', 'sm')} Mis notas privadas <small>(solo las ves tú; nadie más, ni el propietario)</small></label>
    <textarea id="f-priv" rows="3" placeholder="Apuntes para ti: ideas, dudas, lo que te queda por hacer…" oninput="savePriv(this.value)">${esc(S.priv || '')}</textarea>
    <small class="mut" id="priv-st"></small>`;
}
function savePriv(v){
  S.priv = v; clearTimeout(privT); const st = $('#priv-st'); if (st) st.textContent = 'Guardando…';
  const tid = S.tid;
  privT = setTimeout(async () => {
    await q(sb.from('task_private_notes').upsert({ task_id: tid, user_id: S.me.id, body: v, updated_at: new Date().toISOString() }));
    const s2 = $('#priv-st'); if (s2) s2.textContent = 'Guardado';
  }, 700);
}

/* ============ 18 · Anuncio general ============ */
const bannerActive = () => { const b = S.settings || {}; return b.banner?.trim() && (!b.banner_until || b.banner_until >= today()); };
function bannerHTML(){
  const b = S.settings || {};
  if (!bannerActive() || ls('bannerSeen') === b.updated_at) return '';
  return `<div class="gbanner ${b.banner_level}">${ic(b.banner_level === 'bad' ? 'octagon-alert' : b.banner_level === 'warn' ? 'triangle-alert' : 'megaphone')}<div class="grow">${linkify(b.banner)}</div>
    <button class="ico" title="Ocultar" onclick="ls('bannerSeen','${esc(b.updated_at)}');render()">${ic('x', 'sm')}</button></div>`;
}
function bannerFormHTML(){
  const b = S.settings || {};
  return `<div class="mod sm"><div class="mh"><h3>Anuncio general</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <p class="small mut">Sale arriba en toda la web para todos y les llega un aviso. Cada uno puede ocultarlo.</p>
    <label>Mensaje</label><textarea id="bn-text" rows="3" maxlength="500" placeholder="Ej.: Mañana no hay clase en el taller">${esc(b.banner || '')}</textarea>
    <div class="grid4" style="grid-template-columns:1fr 1fr"><div><label>Tipo</label><select id="bn-level">${[['info', 'Información'], ['warn', 'Importante'], ['bad', 'Urgente']].map(([k, n]) => `<option value="${k}" ${b.banner_level === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div><label>Mostrar hasta (opcional)</label><input id="bn-until" type="date" value="${b.banner_until || ''}"></div></div>
    <div class="row" style="margin-top:16px">${b.banner ? `<button class="btn bad" onclick="saveBanner(true)">${ic('trash-2', 'sm')} Quitar anuncio</button>` : ''}<span class="grow"></span><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" onclick="saveBanner()">Publicar</button></div></div></div>`;
}
async function saveBanner(clear){
  const row = clear ? { banner: null, banner_until: null } : { banner: $('#bn-text').value.trim() || null, banner_level: $('#bn-level').value, banner_until: $('#bn-until').value || null };
  await q(sb.from('app_settings').update(row).eq('id', 1));
  Object.assign(S.settings, row, { updated_at: new Date().toISOString() }); closeModal(); toast(clear ? 'Anuncio quitado' : 'Anuncio publicado');
}

/* ============ 17 · Registro de administración ============ */
async function loadAudit(){ S.audit = isOwner() ? await q(sb.from('admin_log').select('*').order('created_at', { ascending:false }).limit(300)) : []; }
const AUDIT = {
  member_approved: ['user-check', d => `aprobó a <b>${d.t}</b>`], member_removed: ['user-x', d => `quitó el acceso a <b>${d.t}</b>`], member_rejected: ['user-x', d => `rechazó la solicitud de <b>${d.t}</b>`],
  admin_added: ['shield-plus', d => `nombró a <b>${d.t}</b> admin de «${d.p}»`], admin_removed: ['shield-minus', d => `quitó a <b>${d.t}</b> como admin de «${d.p}»`],
  project_created: ['folder-plus', d => `creó el proyecto <b>${d.t}</b>`], project_deleted: ['folder-x', d => `eliminó el proyecto <b>${d.t}</b>`],
  project_archived: ['archive', d => `archivó el proyecto <b>${d.t}</b>`], project_unarchived: ['archive-restore', d => `desarchivó el proyecto <b>${d.t}</b>`],
  task_purged: ['trash-2', d => `eliminó definitivamente la tarea <b>${d.t}</b> («${d.p}»)`], banner_changed: ['megaphone', d => d.t ? `cambió el anuncio general: <i>${d.t}</i>` : 'quitó el anuncio general'],
};
function auditHTML(){
  let last = '';
  return `<div class="page" style="max-width:900px"><h1>Registro de administración</h1><p class="mut" style="margin-top:0">Solo lo ves tú. Últimas 300 acciones de miembros, admins, proyectos, papeleras y anuncios.</p>
    <div class="card-box" style="padding:8px 16px">${(S.audit || []).map(a => { const day = cap(new Date(a.created_at).toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' })), A = AUDIT[a.action] || ['circle', () => esc(a.action)];
      const head = day !== last ? `<div class="day">${(last = day)}</div>` : '';
      return `${head}<div class="ev">${ic(A[0], 'mut')}<div><b>${esc(pname(a.actor_id))}</b> ${A[1]({ t: esc(a.target || ''), p: esc(a.details?.project || '') })}<time>${new Date(a.created_at).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })}</time></div></div>`; }).join('') || emptyState('scroll-text', 'Sin acciones registradas todavía')}</div></div>`;
}

/* ============ 19 · Estadísticas de uso ============ */
const FEATURES = { 'f:palette': 'Menú Ctrl+K', 'f:ctx': 'Clic derecho en tarjetas', 'f:nl': 'Tareas con texto natural', 'f:undo': 'Ctrl+Z', 'f:dragdate': 'Arrastrar fechas',
  'f:present': 'Pantalla de clase', 'f:report': 'Informe PDF', 'f:excel': 'Excel', 'f:quick': 'Respuestas rápidas', 'f:wikicomment': 'Comentarios en notas', 'f:meeting': 'Convocar reunión',
  'f:rsvp': 'Responder a reunión', 'f:agreements': 'Acuerdos → tareas', 'f:calc': 'Calculadoras', 'f:calcinsert': 'Insertar cálculo', 'f:material': 'Lista de material', 'f:wikitemplate': 'Plantillas de notas' };
const VIEW_NAMES = { home: 'Inicio', mine: 'Mis tareas', week: 'Calendario de clase', timetable: 'Horario', person: 'Perfiles', compare: 'Comparar', audit: 'Registro', usage: 'Uso', ...Object.fromEntries(PVIEWS.map(v => [v[0], v[1]])) };
async function loadUsage(){ S.usage = isOwner() ? await q(sb.from('usage_events').select('user_id,kind,at').gte('at', addDays(today(), -30)).order('at').limit(20000)) : []; }
function usageHTML(){
  const ev = S.usage || [], days = Array.from({ length: 30 }, (_, i) => addDays(today(), i - 29));
  const dau = days.map(d => new Set(ev.filter(e => isoOf(new Date(e.at)) === d).map(e => e.user_id)).size), maxD = Math.max(1, ...dau);
  const people = members().map(u => { const mine = ev.filter(e => e.user_id === u.id); return { u, sessions: mine.filter(e => e.kind === 'session').length, days: new Set(mine.map(e => isoOf(new Date(e.at)))).size, last: mine.length ? mine[mine.length - 1].at : null }; })
    .sort((a, b) => b.days - a.days || b.sessions - a.sessions);
  const count = pre => Object.entries(ev.filter(e => e.kind.startsWith(pre)).reduce((m, e) => (m[e.kind] = (m[e.kind] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]);
  const views = count('view:'), feats = count('f:'), unused = Object.keys(FEATURES).filter(k => !feats.some(f => f[0] === k));
  const bar = (rows, names, pre) => { const mx = Math.max(1, ...rows.map(r => r[1])); return rows.map(([k, n]) => `<div class="ubar"><span>${esc(names[k.slice(pre.length)] || names[k] || k)}</span><i style="width:${n / mx * 100}%"></i><b>${n}</b></div>`).join(''); };
  return `<div class="page" style="max-width:1100px"><h1>Estadísticas de uso</h1><p class="mut" style="margin-top:0">Solo lo ves tú · últimos 30 días · se guardan 6 meses.</p>
    <div class="card-box" style="padding:16px"><h3 style="margin:0 0 10px;font-size:15px">Personas activas cada día</h3>
      <div class="dau">${dau.map((n, i) => `<div title="${fmtD(days[i])}: ${n} persona${n === 1 ? '' : 's'}"><i style="height:${n / maxD * 100}%"></i></div>`).join('')}</div>
      <div class="row small mut"><span>${fmtD(days[0])}</span><span class="grow"></span><span>Hoy</span></div></div>
    <div class="hgrid" style="grid-template-columns:1fr 1fr">
      <div class="card-box"><h3>${ic('users')} Por persona</h3><table class="ltable"><thead><tr><th>Persona</th><th>Días activos</th><th>Sesiones</th><th>Último acceso</th></tr></thead>
        <tbody>${people.map(p => `<tr onclick="go('person',{uid:'${p.u.id}'})"><td><div class="row" style="gap:6px">${av(p.u.id)}${esc(pname(p.u.id))}</div></td><td>${p.days}</td><td>${p.sessions}</td><td>${p.last ? ago(p.last) : '<span class="mut">No ha entrado</span>'}</td></tr>`).join('')}</tbody></table></div>
      <div class="card-box"><h3>${ic('layout-grid')} Pestañas más vistas</h3>${bar(views, VIEW_NAMES, 'view:') || '<p class="mut">Sin datos todavía.</p>'}
        <h3 style="margin-top:18px">${ic('sparkles')} Funciones usadas</h3>${bar(feats, FEATURES, '') || '<p class="mut">Sin datos todavía.</p>'}
        ${unused.length ? `<p class="small mut" style="margin-top:12px"><b>Sin usar en 30 días:</b> ${unused.map(k => FEATURES[k]).join(', ')}</p>` : ''}</div></div></div>`;
}

/* ============ Exámenes (calendario de la clase; solo los crea el propietario) ============ */
const examChip = e => `<button class="ct cx" title="Examen: ${esc(e.title)}${e.notes ? ' · ' + esc(e.notes) : ''}" onclick="editExam('${e.id}')">${ic('graduation-cap', 'sm')} ${esc(e.title)}</button>`;
function editExam(id){ S.examId = id || null; if (id) S.examDay = null; openModal('exam'); }
function examFormHTML(){
  const e = S.exams.find(x => x.id === S.examId), O = isOwner();
  if (e && !O) return `<div class="mod sm"><div class="mh"><h3>Examen</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <p><b>${esc(e.title)}</b><br><span class="mut">${cap(new Date(e.exam_date + 'T00:00').toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' }))}</span></p>
    ${e.notes ? `<p>${linkify(e.notes)}</p>` : ''}<div class="row"><span class="grow"></span><button class="btn" onclick="closeModal()">Cerrar</button></div></div></div>`;
  if (!O) return '';
  return `<div class="mod sm"><div class="mh"><h3>${e ? 'Editar examen' : 'Nuevo examen'}</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    <p class="small mut">Lo verá toda la clase en el Calendario de clase y en el calendario de cada proyecto.</p>
    <label>Asignatura o examen</label><input id="ex-title" maxlength="120" value="${esc(e?.title || '')}" placeholder="Ej.: Automatismos – tema 4">
    <label>Fecha</label><input id="ex-date" type="date" value="${e?.exam_date || S.examDay || today()}">
    <label>Notas (opcional)</label><textarea id="ex-notes" rows="2" maxlength="500" placeholder="Temario, aula, material que hay que llevar…">${esc(e?.notes || '')}</textarea>
    <div class="row" style="margin-top:16px">${e ? `<button class="btn bad" onclick="delExam()">${ic('trash-2', 'sm')} Borrar</button>` : ''}<span class="grow"></span>
      <button class="btn" onclick="closeModal()">Cancelar</button><button class="btn pri" onclick="saveExam()">Guardar</button></div></div></div>`;
}
async function saveExam(){
  const row = { title: $('#ex-title').value.trim(), exam_date: $('#ex-date').value, notes: $('#ex-notes').value.trim() || null };
  if (!row.title || !row.exam_date) return toast('Pon el nombre y la fecha del examen');
  const r = S.examId ? await q(sb.from('exams').update(row).eq('id', S.examId).select().single()) : await q(sb.from('exams').insert(row).select().single());
  if (!r) return;
  S.exams = [...S.exams.filter(x => x.id !== r.id), r].sort((a, b) => a.exam_date.localeCompare(b.exam_date));
  closeModal(); toast('Examen guardado');
}
async function delExam(){
  if (!confirm('¿Borrar este examen del calendario?')) return;
  await q(sb.from('exams').delete().eq('id', S.examId));
  S.exams = S.exams.filter(x => x.id !== S.examId); closeModal(); toast('Examen borrado');
}

/* ============ Horario de clase (lo ven todos; solo lo edita el propietario) ============ */
const DAYS5 = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const ttMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
// Clase actual y siguiente de hoy: { now, next, brk }
function ttNow(){
  const T = S.settings?.timetable; if (!T) return {};
  const d = new Date(), wd = d.getDay(), min = d.getHours() * 60 + d.getMinutes(); if (wd < 1 || wd > 5) return {};
  const row = T.grid[wd] || [], i = T.slots.findIndex(([a, b]) => min >= ttMin(a) && min < ttMin(b)), n = T.slots.findIndex(([a]) => ttMin(a) > min);
  return { now: i >= 0 && row[i] ? { s: T.subjects[row[i]], i } : null, next: n >= 0 && row[n] ? { s: T.subjects[row[n]], i: n } : null,
    brk: T.break && min >= ttMin(T.break[0]) && min < ttMin(T.break[1]) };
}
function nowClassHTML(){
  const { now, next, brk } = ttNow(), T = S.settings?.timetable; if (!now && !next && !brk) return '';
  const it = (lbl, x) => `<span><small class="mut">${lbl}</small> <b style="color:${x.s?.color}">${esc(x.s?.short || '—')}</b> <span class="mut">· ${esc(x.s?.room || '')} · ${T.slots[x.i].join('–')}</span></span>`;
  return `<div class="card-box nowcls" onclick="go('timetable')">${ic('clock')} ${now ? it('Ahora', now) : brk ? `<span><b>Descanso</b> <span class="mut">hasta las ${T.break[1]}</span></span>` : ''}${next ? it('Siguiente', next) : ''}</div>`;
}
function timetableHTML(){
  const T = S.ttEdit ? S.ttDraft : S.settings?.timetable, O = isOwner();
  if (!T) return `<div class="page">${emptyState('clock', 'Aún no hay horario', O ? '' : 'Cuando el propietario lo ponga, aparecerá aquí.')}</div>`;
  const E = S.ttEdit, wd = new Date().getDay(), { now } = ttNow(), td = today();
  const mon = (() => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return isoOf(d); })();
  const codes = Object.keys(T.subjects);
  const cell = (dia, i) => { const c = T.grid[dia]?.[i], s = T.subjects[c];
    if (E) return `<td><select onchange="S.ttDraft.grid[${dia}][${i}]=this.value||null;render()"><option value="">— libre —</option>${codes.map(k => `<option value="${k}" ${k === c ? 'selected' : ''}>${esc(T.subjects[k].short)}</option>`).join('')}</select></td>`;
    return `<td class="${dia === wd && now?.i === i ? 'now' : ''}">${s ? `<div class="tt-c" style="--c:${s.color}" title="${esc(s.name)}"><b>${esc(s.short)}</b><small>${ic('user', 'sm')} ${esc(s.teacher || '—')}</small><small>${ic('map-pin', 'sm')} ${esc(s.room || '—')}</small></div>` : ''}</td>`; };
  const rows = T.slots.map(([a, b], i) => `${i === T.breakAfter && T.break ? `<tr class="tt-brk"><th>${T.break.join('–')}</th><td colspan="5">Descanso</td></tr>` : ''}
    <tr><th>${E ? `<input value="${a}" onchange="S.ttDraft.slots[${i}][0]=this.value"><input value="${b}" onchange="S.ttDraft.slots[${i}][1]=this.value">` : `${a}<br><small>${b}</small>`}</th>${[1, 2, 3, 4, 5].map(d => cell(d, i)).join('')}</tr>`).join('');
  const head = [1, 2, 3, 4, 5].map(d => { const k = addDays(mon, d - 1), ex = S.exams.filter(e => e.exam_date === k);
    return `<th class="${d === wd ? 'today' : ''}">${DAYS5[d - 1]}<small> ${new Date(k + 'T00:00').getDate()}</small>${ex.map(e => `<div class="tt-ex" onclick="editExam('${e.id}')">${ic('graduation-cap', 'sm')} ${esc(e.title)}</div>`).join('')}</th>`; }).join('');
  const subj = E ? `<h3 style="margin-top:20px">Asignaturas</h3><table class="ltable tt-subj"><thead><tr><th>Color</th><th>Nombre corto</th><th>Profesor</th><th>Aula</th><th></th></tr></thead><tbody>
    ${codes.map(k => { const s = T.subjects[k], f = (p, ph) => `<input value="${esc(s[p] || '')}" placeholder="${ph}" onchange="S.ttDraft.subjects['${k}'].${p}=this.value">`;
      return `<tr><td><input type="color" value="${s.color}" onchange="S.ttDraft.subjects['${k}'].color=this.value;render()"></td><td>${f('short', 'Nombre')}</td><td>${f('teacher', 'Profesor')}</td><td>${f('room', 'Aula')}</td>
        <td><button class="ico" title="Quitar asignatura" onclick="ttDelSubj('${k}')">${ic('trash-2', 'sm')}</button></td></tr>`; }).join('')}</tbody></table>
    <button class="btn sm" style="margin-top:8px" onclick="ttAddSubj()">${ic('plus', 'sm')} Añadir asignatura</button>` : '';
  return `<div class="page" style="max-width:none"><div class="row" style="flex-wrap:wrap;margin-bottom:6px"><h1 class="grow" style="margin:0">Horario</h1>
      ${O ? E ? `<button class="btn" onclick="S.ttEdit=false;render()">Cancelar</button><button class="btn pri" onclick="ttSave()">${ic('check')} Guardar horario</button>`
              : `<button class="btn" onclick="S.ttDraft=JSON.parse(JSON.stringify(S.settings.timetable));S.ttEdit=true;render()">${ic('pencil')} Editar horario</button>` : ''}</div>
    <p class="mut" style="margin-top:0">2º SEA · ${E ? 'Elige la asignatura de cada hora y cambia profesores, aulas y horas.' : 'Se resalta la clase de ahora. Los exámenes de esta semana salen debajo del día.'}</p>
    ${nowClassHTML()}
    <div class="tt-wrap"><table class="tt"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>${subj}</div>`;
}
function ttAddSubj(){
  const n = prompt('Nombre corto de la asignatura'); if (!n?.trim()) return;
  S.ttDraft.subjects['s' + Date.now()] = { name: n.trim(), short: n.trim(), teacher: '', room: '', color: '#64748b' }; render();
}
function ttDelSubj(k){
  if (!confirm('¿Quitar esta asignatura? Sus horas quedarán libres.')) return;
  delete S.ttDraft.subjects[k]; Object.values(S.ttDraft.grid).forEach(r => r.forEach((c, i) => c === k && (r[i] = null))); render();
}
async function ttSave(){
  const T = S.ttDraft;
  if (T.slots.some(([a, b]) => !/^\d{1,2}:\d{2}$/.test(a) || !/^\d{1,2}:\d{2}$/.test(b))) return toast('Revisa las horas: formato 15:15', 'err');
  Object.values(T.subjects).forEach(s => s.name = s.name || s.short);
  await q(sb.from('app_settings').update({ timetable: T }).eq('id', 1));
  S.settings.timetable = T; S.ttEdit = false; render(); toast('Horario guardado');
}
