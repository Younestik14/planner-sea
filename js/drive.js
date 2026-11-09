/* ============ Archivos: explorador de la carpeta de Drive del proyecto, dentro de la web ============
   Cada persona conecta su Google Drive (permiso de solo lectura). El token de Google dura 1 hora;
   después hay que volver a conectar (un clic). Las vistas previas se cargan con ese token, así que
   funcionan aunque la carpeta sea privada y el navegador bloquee cookies de terceros. */
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const GAPI = 'https://www.googleapis.com/drive/v3/';
const GDOC = { 'application/vnd.google-apps.document': 'Documento', 'application/vnd.google-apps.spreadsheet': 'Hoja de cálculo',
  'application/vnd.google-apps.presentation': 'Presentación', 'application/vnd.google-apps.drawing': 'Dibujo' };
const FOLDER = 'application/vnd.google-apps.folder';
const driveToken = () => { const g = ls('gdt'); return g && g.exp > Date.now() ? g.t : null; };
function connectDrive(){
  ls('driveBack', location.hash || '#v=files');
  sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, scopes: DRIVE_SCOPE,
    queryParams: { login_hint: S.me.email, prompt: 'consent', include_granted_scopes: 'true' } } });
}
async function gapi(path, as = 'json'){
  const t = driveToken(); if (!t) { S.dErr = 'expired'; throw new Error('expired'); }
  const r = await fetch(GAPI + path, { headers: { Authorization: 'Bearer ' + t } });
  if (r.status === 401) { ls('gdt', null); S.dErr = 'expired'; throw new Error('expired'); }
  if (!r.ok) { const e = await r.json().catch(() => ({})), m = e.error?.message || r.statusText;
    S.dErr = /has not been used|is disabled|accessNotConfigured/i.test(m) ? 'api' : r.status === 404 ? 'notfound' : r.status === 403 ? 'denied' : 'other'; S.dErrMsg = m; throw new Error(m); }
  return as === 'json' ? r.json() : r.blob();
}
// carpeta actual: S.dpath = [{id,name}] empezando en la del proyecto
async function loadDrive(force){
  const root = folderId(proj()?.drive_url); if (!root || !driveToken()) return;
  if (!S.dpath?.length || S.dpath[0].id !== root) S.dpath = [{ id: root, name: 'Carpeta del proyecto' }];
  const id = S.dpath.at(-1).id; S.dcache ??= {};
  if (S.dcache[id] && !force) { S.dfiles = S.dcache[id]; render(); return; }
  S.dLoading = true; S.dErr = null; render();
  try {
    const fields = 'files(id,name,mimeType,modifiedTime,size,iconLink,thumbnailLink,webViewLink,lastModifyingUser(displayName))';
    const q = encodeURIComponent(`'${id}' in parents and trashed = false`);
    const d = await gapi(`files?q=${q}&fields=${encodeURIComponent(fields)}&orderBy=folder,name_natural&pageSize=500&supportsAllDrives=true&includeItemsFromAllDrives=true`);
    S.dfiles = S.dcache[id] = d.files || [];
  } catch { S.dfiles = []; }
  S.dLoading = false; render();
}
function driveOpen(id, name){ S.dpath.push({ id, name }); S.dq = ''; loadDrive(); }
function driveUp(i){ S.dpath = S.dpath.slice(0, i + 1); S.dq = ''; loadDrive(); }
const dKind = f => f.mimeType === FOLDER ? 'folder' : f.mimeType.startsWith('image/') ? 'image' : f.mimeType === 'application/pdf' ? 'pdf' : GDOC[f.mimeType] ? 'gdoc'
  : f.mimeType.startsWith('video/') ? 'video' : f.mimeType.startsWith('audio/') ? 'audio' : /^text\/|^application\/(json|xml)$|csv/.test(f.mimeType) ? 'text' : 'other';
const dIcon = { folder: 'folder', image: 'image', pdf: 'file-text', gdoc: 'file-pen-line', video: 'film', audio: 'music', text: 'file-code', other: 'file' };
const fmtSize = b => !b ? '' : b < 1024 ** 2 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1024 ** 2).toFixed(1).replace('.', ',') + ' MB';

function filesHTML(){
  const p = proj(), id = folderId(p.drive_url);
  if (!id) return emptyState('folder', 'Sin carpeta de Drive', adminOf() ? 'Pega el enlace de una carpeta en «Ajustes» para ver aquí sus archivos.' : 'Este proyecto aún no tiene carpeta de Drive.');
  const open = `<a class="btn" href="${esc(p.drive_url)}" target="_blank" rel="noopener">${ic('external-link')} Abrir en Drive</a>`;
  if (!driveToken() || S.dErr === 'expired') return `<div class="page"><div class="card-box drive-connect">
      ${ic('hard-drive', 'lg')}<h3>${ls('gdtUsed') ? 'Vuelve a conectar Google Drive' : 'Ve los archivos sin salir de la web'}</h3>
      <p class="mut">${ls('gdtUsed') ? 'La conexión con Drive dura una hora por seguridad. Pulsa para seguir viendo los archivos.' : 'Conecta tu Google Drive una vez para navegar por la carpeta del proyecto y abrir PDFs, fotos, documentos y presentaciones aquí mismo. La web solo puede <b>ver</b> tus archivos, nunca cambiarlos.'}</p>
      <div class="row" style="justify-content:center;flex-wrap:wrap"><button class="btn pri" onclick="connectDrive()">${ic('plug')} Conectar con Google Drive</button>${open}</div>
      ${ls('gdtUsed') ? '' : '<p class="small mut" style="margin-top:14px">Google puede avisar de que la app «no está verificada»: es normal en webs de clase. Pulsa «Configuración avanzada» → «Ir a…» para seguir.</p>'}</div></div>`;
  const err = { api: 'La API de Google Drive no está activada en el proyecto de Google Cloud de la web. ' + (isOwner() ? 'Actívala (te expliqué los pasos) y recarga.' : 'Avisa a Younes.'),
    notfound: 'No tienes acceso a esta carpeta con tu cuenta de Google. Pide al dueño de la carpeta que te la comparta.', denied: 'Google ha denegado el acceso a esta carpeta.', other: 'No se pudo cargar la carpeta: ' + esc(S.dErrMsg || '') }[S.dErr];
  const q = (S.dq || '').toLowerCase(), list = (S.dfiles || []).filter(f => !q || f.name.toLowerCase().includes(q)), G = (S.dview || ls('dview') || 'grid') === 'grid';
  const crumbs = S.dpath.map((c, i) => i === S.dpath.length - 1 ? `<b>${esc(c.name)}</b>` : `<button class="btn ghost sm" onclick="driveUp(${i})">${esc(c.name)}</button>`).join(`<span class="mut">›</span>`);
  const item = f => { const k = dKind(f), act = k === 'folder' ? `driveOpen('${f.id}','${esc(f.name).replace(/'/g, "\\'")}')` : `drivePreview('${f.id}')`;
    return G ? `<button class="dcard ${k}" onclick="${act}" title="${esc(f.name)}">
        <div class="dthumb">${f.thumbnailLink && k !== 'folder' ? `<img src="${esc(f.thumbnailLink)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${ic(dIcon[k], 'lg')}</div>
        <div class="dname"><img src="${esc(f.iconLink || '')}" alt="" referrerpolicy="no-referrer" onerror="this.remove()"><span>${esc(f.name)}</span></div></button>`
      : `<button class="drow" onclick="${act}"><img src="${esc(f.iconLink || '')}" alt="" referrerpolicy="no-referrer" onerror="this.remove()"><span class="grow">${esc(f.name)}</span>
        <small class="mut">${esc(f.lastModifyingUser?.displayName || '')}</small><small class="mut">${fmtD(f.modifiedTime.slice(0, 10))}</small><small class="mut" style="width:70px;text-align:right">${k === 'folder' ? '' : GDOC[f.mimeType] || fmtSize(+f.size)}</small></button>`; };
  return `<div class="page" style="max-width:none">
    <div class="row dtool"><div class="row grow dcrumbs">${ic('hard-drive')} ${crumbs}</div>
      <input type="search" style="max-width:220px" placeholder="Buscar en esta carpeta…" value="${esc(S.dq || '')}" oninput="S.dq=this.value;keep(render)">
      <div class="seg"><button class="${G ? 'on' : ''}" onclick="S.dview='grid';ls('dview','grid');render()" title="Cuadrícula">${ic('layout-grid', 'sm')}</button><button class="${G ? '' : 'on'}" onclick="S.dview='list';ls('dview','list');render()" title="Lista">${ic('list', 'sm')}</button></div>
      <button class="btn" onclick="loadDrive(true)" title="Actualizar">${ic('refresh-cw')}</button>
      <a class="btn" href="https://drive.google.com/drive/folders/${esc(S.dpath.at(-1).id)}" target="_blank" rel="noopener" title="Para subir o editar archivos">${ic('upload')} Subir en Drive</a></div>
    ${err ? `<div class="card-box" style="padding:14px;color:var(--bad-t)">${ic('triangle-alert')} ${err}</div>` : ''}
    ${S.dLoading ? `<div class="${G ? 'dgrid' : ''}">${'<div class="skel" style="height:150px"></div>'.repeat(6)}</div>`
      : list.length ? `<div class="${G ? 'dgrid' : 'dlist card-box'}">${list.map(item).join('')}</div>`
      : err ? '' : emptyState('folder-open', q ? 'Nada coincide con la búsqueda' : 'Carpeta vacía', q ? '' : 'Sube archivos desde «Subir en Drive».')}</div>`;
}

/* ---- vista previa dentro de la web ---- */
async function drivePreview(id){
  const f = S.dfiles.find(x => x.id === id); if (!f) return;
  if (S.dprev?.url) URL.revokeObjectURL(S.dprev.url);
  S.dprev = { f, loading: true }; drawPreview();
  const k = dKind(f);
  try {
    if (k === 'image' || k === 'pdf' || ((k === 'video' || k === 'audio') && +f.size < 150 * 1024 ** 2))
      S.dprev.url = URL.createObjectURL(await gapi(`files/${id}?alt=media&supportsAllDrives=true`, 'blob'));
    else if (k === 'gdoc') S.dprev.url = URL.createObjectURL(await gapi(`files/${id}/export?mimeType=application/pdf`, 'blob'));
    else if (k === 'text' && +f.size < 2 * 1024 ** 2) S.dprev.text = await (await gapi(`files/${id}?alt=media&supportsAllDrives=true`, 'blob')).text();
  } catch { S.dprev.fail = true; }
  if (S.dprev?.f === f) { S.dprev.loading = false; drawPreview(); }
}
function drawPreview(){
  let el = $('#dprev'); const d = S.dprev;
  if (!d) { el?.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'dprev'; el.className = 'ov dprev-ov'; el.onclick = e => { if (e.target === el) closePreview(); }; document.body.append(el); }
  const f = d.f, k = dKind(f), files = S.dfiles.filter(x => dKind(x) !== 'folder'), i = files.indexOf(f);
  const body = d.loading ? `<div class="dprev-msg">${ic('loader-circle', 'lg')} Cargando…</div>`
    : d.fail ? `<div class="dprev-msg">${ic('triangle-alert', 'lg')}<p>No se pudo abrir aquí.</p><a class="btn pri" href="${esc(f.webViewLink)}" target="_blank" rel="noopener">Abrir en Drive</a></div>`
    : k === 'image' ? `<img src="${d.url}" alt="${esc(f.name)}">`
    : k === 'pdf' || k === 'gdoc' ? `<iframe src="${d.url}" title="${esc(f.name)}"></iframe>`
    : k === 'video' && d.url ? `<video src="${d.url}" controls autoplay></video>`
    : k === 'audio' && d.url ? `<audio src="${d.url}" controls autoplay></audio>`
    : k === 'text' && d.text != null ? `<pre class="dprev-text">${esc(d.text)}</pre>`
    : `<iframe src="https://drive.google.com/file/d/${esc(f.id)}/preview" title="${esc(f.name)}" allow="autoplay"></iframe>
       <p class="small mut dprev-hint">Si no se ve, <a href="${esc(f.webViewLink)}" target="_blank" rel="noopener">ábrelo en Drive</a> (los archivos de Word y Excel se ven con el visor de Google).</p>`;
  el.innerHTML = `<div class="dprev"><div class="dprev-h"><img src="${esc(f.iconLink || '')}" alt="" referrerpolicy="no-referrer" onerror="this.remove()"><b class="grow">${esc(f.name)}</b>
      <small class="mut hide-m">${i + 1} / ${files.length}</small>
      <button class="ico" onclick="stepPreview(-1)" title="Anterior (←)" ${i <= 0 ? 'disabled' : ''}>${ic('chevron-left')}</button><button class="ico" onclick="stepPreview(1)" title="Siguiente (→)" ${i >= files.length - 1 ? 'disabled' : ''}>${ic('chevron-right')}</button>
      ${d.url ? `<a class="btn sm" href="${d.url}" download="${esc(k === 'gdoc' ? f.name + '.pdf' : f.name)}">${ic('download', 'sm')} <span class="hide-m">Descargar</span></a>` : ''}
      <a class="btn sm" href="${esc(f.webViewLink)}" target="_blank" rel="noopener">${ic('external-link', 'sm')} <span class="hide-m">Drive</span></a>
      <button class="ico" onclick="closePreview()" title="Cerrar (Esc)">${ic('x')}</button></div><div class="dprev-b ${k}">${body}</div></div>`;
  icons();
}
function stepPreview(k){ const files = S.dfiles.filter(x => dKind(x) !== 'folder'), i = files.indexOf(S.dprev?.f); if (files[i + k]) drivePreview(files[i + k].id); }
function closePreview(){ if (S.dprev?.url) URL.revokeObjectURL(S.dprev.url); S.dprev = null; drawPreview(); }
document.addEventListener('keydown', e => {
  if (!S.dprev) return;
  if (e.key === 'Escape') { e.stopPropagation(); closePreview(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); stepPreview(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); stepPreview(-1); }
}, true);
