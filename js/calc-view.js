'use strict';
// Planner SEA · Cálculos SEA: asistente paso a paso (la lógica y las tablas están en calc-core.js)
const CS_PIE = 'Cálculo orientativo según REBT 2002 e ITC. La firma y responsabilidad del proyecto son del técnico competente.';
const CS_CALCS = [
  ['seccion', 'cable', 'Sección de una línea', 'Intensidad admisible, caída de tensión, sección mínima y protección, todo a la vez.'],
  ['intensidad', 'zap', 'Intensidad y potencia', 'Monofásica o trifásica, con su fórmula.'],
  ['proteccion', 'shield-check', 'Protección', 'Elige el PIA o fusible gG para una línea ya conocida (Ib e Iz).'],
];
const CS_PASOS = ['Tipo de línea', 'Carga', 'Cable', 'Condiciones', 'Longitud y protección'];
const csNew = calc => ({ calc, paso: 0, err: {}, r: null,
  d: { linea: 'fuerza', circuito: 'C2', sistema: 'tri', U: '400', modo: 'P', P: '', I: '', cos: '0,9', mat: 'cu', aisl: 'XLPE', metodo: 'B1',
    T: '40', disp: 1, n: '1', capas: '1', rho: '2,5', directo: false, L: '', prot: 'pia', Ib: '', Iz: '' } });
const csNum = k => CALCSEA.parseNum(S.cs.d[k]);
const csNf = CALCSEA.nf;

// Campo de texto numérico: guarda lo escrito sin repintar (no se pierde el foco)
function csIn(k, label, unit, hint = ''){
  const e = S.cs.err[k];
  return `<div><label for="cs-${k}">${label}</label><div class="row" style="gap:6px"><input id="cs-${k}" type="text" inputmode="decimal" autocomplete="off" value="${esc(S.cs.d[k])}" oninput="S.cs.d.${k}=this.value" ${e ? 'aria-invalid="true"' : ''}><span class="small mut" style="min-width:34px">${unit}</span></div>
    ${e ? `<p class="cs-err">${esc(e)}</p>` : hint ? `<p class="small mut" style="margin:4px 0 0">${hint}</p>` : ''}</div>`;
}
// Selector de opciones en botones
function csSeg(k, opts, after = ''){
  return `<div class="seg cs-seg">${opts.map(([v, n]) => `<button type="button" class="${S.cs.d[k] === v ? 'on' : ''}" onclick="S.cs.d.${k}=${JSON.stringify(v).replace(/"/g, '&quot;')};${after}render()">${n}</button>`).join('')}</div>`;
}
const csSel = (k, opts) => `<select id="cs-${k}" onchange="S.cs.d.${k}=this.value;render()">${opts.map(([v, n]) => `<option value="${esc(v)}" ${String(S.cs.d[k]) === String(v) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;

function openCalcSea(calc){ S.cs = csNew(calc); render(); }

function calcSeaHTML(){
  if (!S.cs) S.cs = csNew(null);
  const C = S.cs;
  const head = `<div class="row" style="flex-wrap:wrap;gap:10px;margin-bottom:6px"><h1 class="grow" style="display:flex;align-items:center;gap:10px">${ic('calculator')} Cálculos SEA</h1>
    ${C.calc ? `<button class="btn sm ghost" onclick="S.cs=csNew(null);render()">${ic('layout-grid', 'sm')} Todos los cálculos</button>` : ''}</div>
    <p class="mut" style="margin:0 0 18px">Cálculos eléctricos de baja tensión según el REBT y la UNE-HD 60364-5-52:2014. Cada resultado muestra la fórmula, la tabla y si cumple.</p>`;
  let body;
  if (!C.calc) body = `<div class="cs-grid">${CS_CALCS.map(([k, i, n, dsc]) => `<button class="card-box cs-card" onclick="openCalcSea('${k}')"><span class="cs-ic">${ic(i)}</span><b>${n}</b><span class="small mut">${dsc}</span></button>`).join('')}</div>`;
  else if (C.calc === 'seccion') body = C.r ? csResultHTML() : csWizardHTML();
  else if (C.calc === 'intensidad') body = csIntensidadHTML();
  else body = csProteccionHTML();
  return `<div class="page cs-page">${head}${body}</div>`;
}

/* ---------- Sección de una línea: asistente de 5 pasos ---------- */
function csWizardHTML(){
  const C = S.cs, d = C.d, viv = d.linea === 'viv', D = d.metodo === 'D';
  const steps = `<ol class="cs-steps">${CS_PASOS.map((n, i) => `<li class="${i === C.paso ? 'on' : i < C.paso ? 'done' : ''}"><span>${i < C.paso ? ic('check', 'sm') : i + 1}</span>${n}</li>`).join('')}</ol>`;
  let f = '';
  if (C.paso === 0) {
    f = `<label for="cs-linea">¿Qué línea vas a calcular?</label>${csSel('linea', CALCSEA.LINEAS.map(l => [l.id, l.label]))}
      ${viv ? `<label for="cs-circuito">Circuito (ITC-BT-25)</label>${csSel('circuito', Object.entries(CALCSEA.CIRC_VIV).map(([k, c]) => [k, `${c.label} · ${csNf(c.S, 1)} mm² · PIA ${c.In} A`]))}` : ''}
      <p class="small mut">Caída de tensión máxima: <b>${csNf(CALCSEA.LINEAS.find(l => l.id === d.linea).pct, 1)} %</b> (${CALCSEA.LINEAS.find(l => l.id === d.linea).ref}).</p>`;
  } else if (C.paso === 1) {
    f = viv ? `<div class="cs-note">${ic('info', 'sm')} En los circuitos de vivienda la intensidad de cálculo es la del PIA del circuito (${CALCSEA.CIRC_VIV[d.circuito].In} A), en monofásica a 230 V y con cos φ = 1, el caso más desfavorable (Guía técnica del REBT, Anexo 2).</div>`
      : `<label>Sistema</label>${csSeg('sistema', [['mono', 'Monofásica'], ['tri', 'Trifásica']], "S.cs.d.U=S.cs.d.sistema==='tri'?'400':'230';")}
        <div class="grid4 cs-fields">${csIn('U', 'Tensión', 'V')}${csIn('cos', 'cos φ', '', 'Entre 0 y 1')}</div>
        <label>Dato de la carga</label>${csSeg('modo', [['P', 'Potencia'], ['I', 'Intensidad']])}
        <div class="grid4 cs-fields">${d.modo === 'P' ? csIn('P', 'Potencia activa', 'kW') : csIn('I', 'Intensidad', 'A')}</div>`;
  } else if (C.paso === 2) {
    f = `<label>Material del conductor</label>${csSeg('mat', [['cu', 'Cobre'], ['al', 'Aluminio']])}
      <label>Aislamiento</label>${csSeg('aisl', [['PVC', 'Termoplástico (PVC, Z1) · 70 °C'], ['XLPE', 'Termoestable (XLPE, EPR) · 90 °C']])}
      <p class="small mut" style="margin:6px 0 0">Ejemplos: H07V-K y ES07Z1-K son termoplásticos; RZ1-K, RV-K y DZ1-K son termoestables.</p>
      <label for="cs-metodo">Método de instalación (UNE-HD 60364-5-52)</label>${csSel('metodo', Object.entries(CALCSEA.METODOS).map(([k, m]) => [k, `${k} · ${m.desc}`]))}
      ${viv && d.mat !== 'cu' ? `<p class="cs-err">En vivienda los circuitos son de cobre (ITC-BT-25).</p>` : ''}`;
  } else if (C.paso === 3) {
    f = `<div class="grid4 cs-fields">${csIn('T', D ? 'Temperatura del terreno' : 'Temperatura ambiente', '°C', D ? 'Referencia: 25 °C' : 'Referencia: 40 °C')}
      ${D ? csIn('rho', 'Resistividad térmica del terreno', 'K·m/W', 'Referencia: 2,5 K·m/W') : csIn('n', 'Circuitos agrupados', 'nº', 'Incluido este') + csIn('capas', 'Capas', 'nº', '1 si no hay capas superpuestas')}</div>
      ${D ? `<label>Instalación enterrada</label>${csSeg('directo', [[false, 'En tubo enterrado (D1)'], [true, 'Directamente enterrado (D2)']])}`
        : `<label for="cs-disp">Disposición de los circuitos agrupados</label>${csSel('disp', Object.entries(CALCSEA.DISP).map(([k, v]) => [k, v[0]]))}`}`;
  } else {
    f = `<div class="grid4 cs-fields">${csIn('L', 'Longitud de la línea', 'm')}</div>
      <label>Protección contra sobrecargas</label>${csSeg('prot', [['pia', 'Interruptor automático (PIA)'], ['gG', 'Fusible gG']])}`;
  }
  const last = C.paso === CS_PASOS.length - 1;
  return `<div class="card-box cs-box"><h3 style="margin:0 0 4px">${ic('cable', 'sm')} Sección de una línea</h3>${steps}<div class="cs-form">${f}</div>
    <div class="row" style="margin-top:18px">${C.paso ? `<button class="btn" onclick="csPaso(-1)">${ic('arrow-left', 'sm')} Atrás</button>` : ''}<span class="grow"></span>
    <button class="btn pri" onclick="csPaso(1)">${last ? `${ic('calculator', 'sm')} Calcular` : `Siguiente ${ic('arrow-right', 'sm')}`}</button></div></div>`;
}

// Comprueba los campos del paso actual; devuelve true si se puede avanzar
function csValida(){
  const C = S.cs, d = C.d, err = {}, viv = d.linea === 'viv', D = d.metodo === 'D';
  const pos = k => { const v = csNum(k); if (!(v > 0)) err[k] = 'Escribe un número mayor que 0'; return v; };
  if (C.paso === 1 && !viv) { pos('U'); const c = pos('cos'); if (c > 1) err.cos = 'El cos φ no puede ser mayor que 1'; pos(d.modo); }
  if (C.paso === 2 && viv && d.mat !== 'cu') err.mat = 'cobre';
  if (C.paso === 3) {
    const T = csNum('T'); if (!(T >= 10 && T <= 60)) err.T = 'La tabla va de 10 °C a 60 °C';
    if (D) { const r = csNum('rho'); if (!(r > 0 && r <= 3)) err.rho = 'La tabla llega hasta 3 K·m/W'; }
    else { const n = csNum('n'), c = csNum('capas'); if (!(Number.isInteger(n) && n >= 1)) err.n = 'Número entero, 1 o más'; if (!(Number.isInteger(c) && c >= 1)) err.capas = 'Número entero, 1 o más'; }
  }
  if (C.paso === 4) pos('L');
  C.err = err; return !Object.keys(err).length;
}
function csPaso(dir){
  const C = S.cs;
  if (dir < 0) { C.err = {}; C.paso--; return render(); }
  if (!csValida()) return render();
  if (C.paso === 2) { const D = C.d.metodo === 'D'; if (D && C.d.T === '40') C.d.T = '25'; if (!D && C.d.T === '25') C.d.T = '40'; } // temperatura de referencia de la tabla
  if (C.paso < CS_PASOS.length - 1) { C.paso++; return render(); }
  C.r = CALCSEA.dimensionar(csDatos()); render(); $('main')?.scrollTo?.(0, 0);
}
function csDatos(){
  const d = S.cs.d, viv = d.linea === 'viv', n = csNum;
  return { linea: d.linea, circuito: d.circuito, sistema: viv ? 'mono' : d.sistema, U: viv ? 230 : n('U'), cos: viv ? 1 : n('cos'),
    P: !viv && d.modo === 'P' ? n('P') * 1000 : undefined, I: !viv && d.modo === 'I' ? n('I') : undefined,
    L: n('L'), mat: d.mat, aisl: d.aisl, metodo: d.metodo, T: n('T'), disp: +d.disp, n: n('n'), capas: n('capas'), rho: n('rho'), directo: d.directo, prot: d.prot };
}

function csResultHTML(){
  const r = S.cs.r, d = csDatos();
  const acciones = `<div class="row" style="margin-top:16px;flex-wrap:wrap"><button class="btn" onclick="S.cs.r=null;S.cs.paso=0;render()">${ic('pencil', 'sm')} Cambiar datos</button><span class="grow"></span>
    ${r.ok ? `<button class="btn" onclick="csCopiar()">${ic('copy', 'sm')} Copiar resultado</button>` : ''}<button class="btn pri" onclick="openCalcSea('seccion')">${ic('plus', 'sm')} Nuevo cálculo</button></div>`;
  if (!r.ok) return `<div class="card-box cs-box"><div class="calc-res err">${ic('circle-x', 'sm')} ${esc(r.error)}</div>${acciones}<p class="small mut cs-pie">${CS_PIE}</p></div>`;
  const kpi = (n, v, s = '') => `<div class="cs-kpi"><span class="small mut">${n}</span><b>${v}</b>${s ? `<span class="small mut">${s}</span>` : ''}</div>`;
  return `<div class="card-box cs-box">
    <div class="calc-res ok">${ic('circle-check', 'sm')} Cumple: ${d.mat === 'cu' ? 'cobre' : 'aluminio'} ${d.aisl} de <b>${csNf(r.S, 1)} mm²</b> · manda ${CALCSEA.MANDA[r.manda]}</div>
    <div class="cs-kpis">${kpi('Sección de fase', `${csNf(r.S, 1)} mm²`)}${kpi('Conductor de protección', `${csNf(r.Sp, 1)} mm²`)}${kpi(d.prot === 'pia' ? 'PIA' : 'Fusible gG', `${r.In} A`)}
      ${kpi('Intensidad', `${csNf(r.Ib)} A`, `admisible ${csNf(r.Iz)} A`)}${kpi('Caída de tensión', `${csNf(r.pct)} %`, `máx. ${csNf(r.pctMax, 1)} %`)}</div>
    <h3 class="cs-h">Cómo se ha calculado</h3><ol class="cs-pasos">${r.pasos.map(p => `<li>${esc(p.t)}${p.f ? `<code>${esc(p.f)}</code>` : ''}</li>`).join('')}</ol>
    ${r.avisos.length ? `<div class="cs-note warn">${ic('triangle-alert', 'sm')} ${r.avisos.map(esc).join('<br>')}</div>` : ''}
    <h3 class="cs-h">Normativa aplicada</h3><ul class="cs-refs">${r.refs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    ${acciones}<p class="small mut cs-pie">${CS_PIE}</p></div>`;
}
function csCopiar(){
  const r = S.cs.r, d = csDatos(), L = CALCSEA.LINEAS.find(l => l.id === d.linea);
  const txt = [`CÁLCULO DE SECCIÓN · ${L.label}${d.linea === 'viv' ? ' · ' + CALCSEA.CIRC_VIV[d.circuito].label : ''}`,
    `Datos: ${d.sistema === 'tri' ? 'trifásica' : 'monofásica'} ${d.U} V · L = ${csNf(d.L)} m · ${d.mat === 'cu' ? 'cobre' : 'aluminio'} ${d.aisl} · método ${d.metodo} · ${d.T} °C`,
    `Resultado: S = ${csNf(r.S, 1)} mm² · protección ${csNf(r.Sp, 1)} mm² · ${d.prot === 'pia' ? 'PIA' : 'fusible gG'} ${r.In} A · Ib = ${csNf(r.Ib)} A · Iz = ${csNf(r.Iz)} A · ΔU = ${csNf(r.pct)} % (máx. ${csNf(r.pctMax, 1)} %) · manda ${CALCSEA.MANDA[r.manda]}`,
    '', 'Pasos:', ...r.pasos.map((p, i) => `${i + 1}. ${p.t}${p.f ? ': ' + p.f : ''}`), ...(r.avisos.length ? ['', 'Avisos:', ...r.avisos.map(a => '- ' + a)] : []),
    '', 'Normativa:', ...r.refs.map(x => '- ' + x), '', CS_PIE].join('\n');
  navigator.clipboard?.writeText(txt).then(() => toast('Resultado copiado'), () => toast('No se ha podido copiar', 'bad'));
}

/* ---------- Intensidad y potencia ---------- */
function csIntensidadHTML(){
  const d = S.cs.d, U = csNum('U'), cos = csNum('cos'), x = csNum(d.modo), tri = d.sistema === 'tri';
  const ok = U > 0 && cos > 0 && cos <= 1 && x > 0;
  let res = 'Rellena los datos con valores mayores que 0 (cos φ entre 0 y 1)';
  if (ok) res = d.modo === 'P'
    ? `I = P / (${tri ? '√3·' : ''}U·cos φ) = ${csNf(x * 1000, 0)} / (${tri ? '√3·' : ''}${csNf(U)}·${csNf(cos)}) = ${csNf(CALCSEA.intensidad({ sistema: d.sistema, P: x * 1000, U, cos }))} A`
    : `P = ${tri ? '√3·' : ''}U·I·cos φ = ${tri ? '√3·' : ''}${csNf(U)}·${csNf(x)}·${csNf(cos)} = ${csNf(CALCSEA.potencia({ sistema: d.sistema, I: x, U, cos }) / 1000, 3)} kW`;
  return `<div class="card-box cs-box"><h3 style="margin:0 0 8px">${ic('zap', 'sm')} Intensidad y potencia</h3>
    <label>Sistema</label>${csSeg('sistema', [['mono', 'Monofásica'], ['tri', 'Trifásica']], "S.cs.d.U=S.cs.d.sistema==='tri'?'400':'230';")}
    <label>Quiero calcular</label>${csSeg('modo', [['P', 'La intensidad (sé la potencia)'], ['I', 'La potencia (sé la intensidad)']])}
    <div class="grid4 cs-fields" oninput="csLive()">${csIn('U', tri ? 'Tensión entre fases' : 'Tensión', 'V')}${csIn('cos', 'cos φ', '')}${d.modo === 'P' ? csIn('P', 'Potencia activa', 'kW') : csIn('I', 'Intensidad', 'A')}</div>
    <div id="cs-live" class="calc-res ${ok ? 'ok' : ''}">${esc(res)}</div>
    <p class="small mut">Fórmulas: P = U·I·cos φ (monofásica) y P = √3·U·I·cos φ (trifásica, U entre fases). Guía técnica del REBT, Anexo 2.</p><p class="small mut cs-pie">${CS_PIE}</p></div>`;
}

/* ---------- Protección ---------- */
function csProteccionHTML(){
  const d = S.cs.d, Ib = csNum('Ib'), Iz = csNum('Iz'), ok = Ib > 0 && Iz > 0;
  const p = ok && CALCSEA.proteccion({ Ib, Iz, tipo: d.prot });
  const res = !ok ? 'Escribe Ib e Iz (mayores que 0)' : p.cumple ? `${d.prot === 'pia' ? 'PIA' : 'Fusible gG'} de ${p.In} A · ${p.pasos.join(' · ')}` : p.pasos[0] + '. Aumenta la sección (sube Iz).';
  return `<div class="card-box cs-box"><h3 style="margin:0 0 8px">${ic('shield-check', 'sm')} Protección contra sobrecargas</h3>
    <label>Dispositivo</label>${csSeg('prot', [['pia', 'Interruptor automático (PIA)'], ['gG', 'Fusible gG']])}
    <div class="grid4 cs-fields" oninput="csLive()">${csIn('Ib', 'Intensidad de cálculo Ib', 'A')}${csIn('Iz', 'Intensidad admisible del cable Iz', 'A', 'Ya corregida con los factores')}</div>
    <div id="cs-live" class="calc-res ${ok ? (p.cumple ? 'ok' : 'err') : ''}">${esc(res)}</div>
    <p class="small mut">Condiciones (UNE-HD 60364-4-43): Ib ≤ In ≤ Iz e I2 ≤ 1,45·Iz. I2 = 1,45·In en PIA (UNE-EN 60898) y 1,6·In en fusibles gG de 16 A o más (UNE-EN 60269-1).</p><p class="small mut cs-pie">${CS_PIE}</p></div>`;
}
// Recalcula el resultado en vivo sin repintar la página (no se pierde el foco al escribir)
function csLive(){
  const el = $('#cs-live'); if (!el) return;
  const tmp = document.createElement('div'); tmp.innerHTML = S.cs.calc === 'intensidad' ? csIntensidadHTML() : csProteccionHTML();
  const n = tmp.querySelector('#cs-live'); el.className = n.className; el.textContent = n.textContent;
}
