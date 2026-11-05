'use strict';
/* =====================================================================
   Planner SEA · CIFP Politécnico de Cartagena
   Web estática (GitHub Pages) + Supabase (base de datos, login, tiempo real).
   La seguridad está en la base de datos (RLS): la web solo oculta botones.
   ===================================================================== */

// Clave pública (anon): es segura en el navegador; la protegen las reglas RLS.
const SB_URL = 'https://wnmrgnskdcioepmqvxin.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndubXJnbnNrZGNpb2VwbXF2eGluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NDEwNDAsImV4cCI6MjEwOTAxNzA0MH0.5bnrLkc6NBKVXFPQP8Rtvz_reOWFmvGA4ZumgVs2Ux0';
const sb = supabase.createClient(SB_URL, SB_KEY, { auth: { flowType: 'pkce' } });
const SCHOOL = 'CIFP Politécnico de Cartagena · 2º SEA';

const PRIO = { urgente:['Urgente','#ef4444'], importante:['Importante','#f59e0b'], media:['Media','#3b82f6'], baja:['Baja','#94a3b8'] };
const PRANK = { urgente:0, importante:1, media:2, baja:3 };
const STATUS = { no_iniciada:'No iniciada', en_curso:'En curso', completada:'Completada' };
const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899','#a855f7','#84cc16'];
const PVIEWS = [['board','Tablero','square-kanban'],['gantt','Cronograma','gantt-chart'],['cal','Calendario','calendar-days'],['diary','Diario','megaphone'],
                ['team','Equipo','users'],['files','Archivos','folder'],['hist','Historial','history']];
const REACT_POST = ['👍','✅','👀','❤️','🎉'], REACT_MSG = ['👍','✅','👀'];

const S = { user:null, me:null, profiles:[], projects:[], padmins:[], notifs:[], mine:[], reads:{}, recent:[], review:[], weekMin:0,
  pid:null, tid:null, view:'home', uid:null, person:null,
  buckets:[], tasks:[], activity:[], deps:[], tlogs:[], posts:[], preacts:[], votes:[],
  comments:[], tact:[], subs:[], reacts:[],
  onlyMine:false, label:'', cal:null, found:null, sel:new Set(), selMode:false, pop:null, reply:null, hidden:new Set(),
  sort: ls('sort') || 'manual', compact: !!ls('compact'), panel:null, modal:null, seen:null, urls:{},
  draft:{ body:'', images:[], poll:null }, busy:false };

/* ============ utilidades ============ */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const okUrl = u => /^https?:\/\/\S+$/i.test((u || '').trim());
const linkify = s => esc(s).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
const ic = (n, c = '') => `<i data-lucide="${n}" class="ic ${c}"></i>`;
function icons(){ try { window.lucide?.createIcons(); } catch {} }
function ls(k, v){ try { if (v === undefined) return JSON.parse(localStorage.getItem('psea.' + k)); localStorage.setItem('psea.' + k, JSON.stringify(v)); } catch { return null; } }
const prof = id => S.profiles.find(p => p.id === id);
const pname = id => { const p = prof(id); return p ? (p.full_name || p.google_name || p.email) : 'Sistema'; };
const first = id => pname(id).split(/\s+/)[0];
const members = () => S.profiles.filter(p => p.approved || p.is_admin).sort((a, b) => pname(a.id).localeCompare(pname(b.id)));
const proj = (id = S.pid) => S.projects.find(p => p.id === id);
const hue = s => [...s].reduce((a, c) => a + c.charCodeAt(0) * 7, 0) % 360;
const lblHTML = l => `<span class="lbl" style="--h:${hue(l)}">${esc(l)}</span>`;
const folderId = u => (u || '').match(/folders\/([\w-]+)/)?.[1] || (u || '').match(/[?&]id=([\w-]+)/)?.[1];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const isoOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 864e5);
const daysLeft = d => dayDiff(today(), d);
const fmtD = d => d ? new Date(d + 'T00:00').toLocaleDateString('es-ES', { day:'numeric', month:'short' }) : '';
const fmtT = ts => new Date(ts).toLocaleString('es-ES', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
const fmtMin = m => { m = Math.round(m || 0); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`; };
function ago(ts){
  const s = (Date.now() - new Date(ts)) / 1000;
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return fmtT(ts);
}
function av(id, cls = ''){
  const p = prof(id), n = pname(id);
  if (p?.avatar_url) return `<img class="av ${cls}" src="${esc(p.avatar_url)}" title="${esc(n)}" alt="" referrerpolicy="no-referrer">`;
  const ini = n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return `<span class="av ${cls}" style="background:hsl(${hue(id || 'x')} 55% 45%)" title="${esc(n)}">${esc(ini)}</span>`;
}
function dueChip(t){
  if (!t.due_date) return '';
  if (t.status === 'completada') return `<span class="chip">${ic('calendar', 'sm')} ${fmtD(t.due_date)}</span>`;
  const n = daysLeft(t.due_date);
  if (n < 0) return `<span class="chip bad">${ic('triangle-alert', 'sm')} Vencida · ${fmtD(t.due_date)}</span>`;
  if (n === 0) return `<span class="chip warn">${ic('calendar', 'sm')} Hoy</span>`;
  if (n === 1) return `<span class="chip warn">${ic('calendar', 'sm')} Mañana</span>`;
  return `<span class="chip">${ic('calendar', 'sm')} ${fmtD(t.due_date)}</span>`;
}
function dueProjectChip(p){
  if (!p.due_date) return '';
  const n = daysLeft(p.due_date), cls = n < 0 ? '' : n <= 7 ? 'warn' : 'acc';
  const txt = n < 0 ? `Entregado el ${fmtD(p.due_date)}` : n === 0 ? 'Entrega HOY' : n === 1 ? 'Entrega MAÑANA' : `Entrega ${fmtD(p.due_date)} · faltan ${n} días`;
  return `<span class="chip ${cls}">${ic('flag', 'sm')} ${txt}</span>`;
}
function toast(msg, cls = ''){
  const el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = msg;
  $('#toasts').append(el); setTimeout(() => el.remove(), 5000);
}
function toastUndo(msg, undo, commit){
  const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = `<span class="grow">${esc(msg)}</span><button class="btn sm">Deshacer</button>`;
  const t = setTimeout(() => { el.remove(); commit?.(); }, 5000);
  el.querySelector('button').onclick = () => { clearTimeout(t); el.remove(); undo(); };
  $('#toasts').append(el);
}
async function q(p){
  const { data, error } = await p;
  if (error) { toast('Error: ' + error.message, 'err'); throw error; }
  return data;
}
// Repinta sin perder lo que estás escribiendo (foco y borrador del chat)
function keep(fn){
  const a = document.activeElement, id = a?.id, val = id && 'value' in a ? a.value : null, pos = a?.selectionStart;
  const draft = $('#cbody')?.value;
  fn();
  if (draft != null && $('#cbody')) $('#cbody').value = draft;
  const e = id && document.getElementById(id);
  if (e) { if (val != null && e.tagName !== 'SELECT' && e.type !== 'checkbox' && e.type !== 'file') e.value = val; e.focus(); try { e.setSelectionRange(pos, pos); } catch {} }
}
let actx;
function beep(){
  if (ls('sound') === false) return;
  try { actx ||= new AudioContext(); const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = 880; g.gain.setValueAtTime(0.06, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.35);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.35); } catch {}
}
function loadScript(src){ return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.append(s); }); }

/* ============ roles ============ */
const isOwner = () => !!S.me?.is_admin;
const adminOf = (pid = S.pid) => isOwner() || S.padmins.some(a => a.project_id === pid && a.user_id === S.me.id);
const canCreate = () => isOwner() || S.padmins.some(a => a.user_id === S.me.id);
const adminsOf = pid => S.padmins.filter(a => a.project_id === pid).map(a => a.user_id);
function roleBadge(uid, pid){
  if (prof(uid)?.is_admin) return '<span class="badge own">Propietario</span>';
  if (pid && S.padmins.some(a => a.project_id === pid && a.user_id === uid)) return '<span class="badge">Admin</span>';
  return '';
}

/* ============ marca, login y arranque ============ */
const brandHTML = (big = false) => `<div class="brand"><span class="mark"><img src="logo.png" alt="" onerror="this.parentNode.classList.add('nologo');this.remove()"></span>
  ${big ? '' : `<div class="hide-m"><b>Planner SEA</b><small>${SCHOOL}</small></div>`}</div>`;
function screen(html){ $('#app').innerHTML = `<div class="center"><div class="boxc"><img class="logo-full" src="logo-full.png" alt="CIFP Politécnico de Cartagena" onerror="this.outerHTML=brandHTML(true)">${html}</div></div>`; $('#modal').innerHTML = ''; icons(); }
function loginScreen(){
  screen(`<h1>Planner SEA</h1><p class="mut" style="margin:0">${SCHOOL}</p>
    <p class="mut small" style="margin-top:14px">Organización de los trabajos en grupo: tareas, plazos, diario del proyecto y chat.</p>
    <button class="gbtn" onclick="login()"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Entrar con Google</button>`);
}
function login(){ sb.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: location.origin + location.pathname } }); }
async function logout(){ await sb.auth.signOut(); location.hash = ''; }
function nameScreen(){
  screen(`<h1>¡Bienvenido!</h1><p class="mut">Escribe tu nombre y apellidos reales para que tus compañeros sepan quién eres.</p>
    <input id="fname" value="${esc(S.me.full_name || S.me.google_name || '')}" placeholder="Nombre y apellidos" style="margin-top:14px">
    <button class="btn pri" style="margin-top:12px;width:100%;justify-content:center" onclick="saveName()">Continuar</button>
    <p><button class="btn ghost sm" onclick="logout()">Cerrar sesión</button></p>`);
  $('#fname').focus();
}
async function saveName(){
  const v = $('#fname').value.trim();
  if (v.split(/\s+/).length < 2) return toast('Pon al menos nombre y un apellido', 'err');
  await q(sb.from('profiles').update({ full_name: v }).eq('id', S.me.id));
  start();
}

let started = false;
sb.auth.onAuthStateChange((ev, session) => setTimeout(() => {
  if (!session) { S.user = null; started = false; return loginScreen(); }
  if (started && S.user?.id === session.user.id) return;
  S.user = session.user; started = true;
  if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);
  subscribe(); start();
}));

async function start(){
  const me = await q(sb.from('profiles').select('*').eq('id', S.user.id).maybeSingle());
  S.me = me;
  if (!me) return screen(`<h1>Acceso denegado</h1><p class="mut">El propietario ha rechazado tu solicitud.</p><button class="btn" onclick="logout()">Cerrar sesión</button>`);
  if (!me.full_name) return nameScreen();
  if (!me.approved && !me.is_admin) return screen(`<h1>Solicitud enviada</h1>
    <p class="mut">Hola ${esc(me.full_name)}. El propietario tiene que aprobar tu acceso. Esta página se actualizará sola cuando te acepte.</p>
    <button class="btn" onclick="logout()">Cerrar sesión</button>`);
  await loadBase();
  readHash();
  if (S.pid && (PVIEWS.some(v => v[0] === S.view) || S.tid)) await loadProject();
  if (S.view === 'person') await loadPerson();
  await loadTask();
  if (!S.summaryDone) await buildSummary();
  else if (Date.now() - new Date(me.last_seen_at || 0) > 300000) sb.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', me.id).then(() => {});
  keep(() => { render(); renderModal(); });
}

async function buildSummary(){
  S.summaryDone = true;
  const since = S.me.last_seen_at;
  await q(sb.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', S.me.id));
  if (!since || S.modal) return;
  const ev = await q(sb.from('activity').select('*').gt('created_at', since).neq('actor_id', S.me.id).order('created_at', { ascending:false }).limit(200));
  if (!ev.length) return;
  S.summary = { since, ev }; S.modal = 'summary';
}

/* ============ datos ============ */
async function loadBase(){
  const monday = (() => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return isoOf(d); })();
  const [profiles, projects, notifs, mine, reads, padmins, recent, review, week] = await Promise.all([
    q(sb.from('profiles').select('*')),
    q(sb.from('projects').select('*, tasks(status)').order('created_at')),
    q(sb.from('notifications').select('*').order('created_at', { ascending:false }).limit(80)),
    q(sb.from('tasks').select('id,title,status,priority,due_date,start_date,project_id,review_requested,labels,task_assignees!inner(user_id)').eq('task_assignees.user_id', S.me.id)),
    q(sb.from('task_reads').select('task_id,read_at')),
    q(sb.from('project_admins').select('*')),
    q(sb.from('posts').select('id,project_id,user_id,body,images,poll_options,pinned,created_at').order('created_at', { ascending:false }).limit(6)),
    q(sb.from('tasks').select('id,title,project_id').eq('review_requested', true).neq('status', 'completada')),
    q(sb.from('time_logs').select('minutes').eq('user_id', S.me.id).gte('logged_on', monday)),
  ]);
  Object.assign(S, { profiles, projects, mine, padmins, recent, review });
  S.weekMin = week.reduce((a, r) => a + r.minutes, 0);
  S.reads = Object.fromEntries(reads.map(r => [r.task_id, r.read_at]));
  const fresh = S.seen ? notifs.filter(n => !n.read && !S.seen.has(n.id)) : [];
  if (fresh.length > 2) toast(`Tienes ${fresh.length} notificaciones nuevas`); else fresh.forEach(n => toast(n.message));
  if (fresh.length) beep();
  S.seen = new Set(notifs.map(n => n.id));
  S.notifs = notifs;
}
async function loadProject(){
  if (!S.projects.some(p => p.id === S.pid)) S.pid = (S.projects.find(p => !p.archived && !p.is_template) || S.projects[0])?.id || null;
  if (!S.pid) { Object.assign(S, { buckets:[], tasks:[], activity:[], deps:[], tlogs:[], posts:[], preacts:[], votes:[] }); return; }
  const [b, t, a, posts] = await Promise.all([
    q(sb.from('buckets').select('*').eq('project_id', S.pid).order('position')),
    q(sb.from('tasks').select('*, task_assignees(user_id), subtasks(id,done), comments(created_at,user_id)').eq('project_id', S.pid).order('position')),
    q(sb.from('activity').select('*').eq('project_id', S.pid).order('created_at', { ascending:false }).limit(300)),
    q(sb.from('posts').select('*').eq('project_id', S.pid).order('created_at', { ascending:false })),
  ]);
  const ids = t.map(x => x.id), pids = posts.map(x => x.id);
  const [deps, tlogs, preacts, votes] = await Promise.all([
    ids.length ? q(sb.from('task_deps').select('*').in('task_id', ids)) : [],
    ids.length ? q(sb.from('time_logs').select('*').in('task_id', ids).order('logged_on', { ascending:false })) : [],
    pids.length ? q(sb.from('post_reactions').select('*').in('post_id', pids)) : [],
    pids.length ? q(sb.from('post_votes').select('*').in('post_id', pids)) : [],
  ]);
  Object.assign(S, { buckets:b, tasks:t, activity:a, posts, deps, tlogs, preacts, votes });
  await signImages(posts.flatMap(p => p.images));
}
async function loadTask(){
  if (S.tid && !S.tasks.some(t => t.id === S.tid)) { S.tid = null; if (S.modal === 'task') S.modal = null; }
  if (!S.tid) return;
  const [c, a, st] = await Promise.all([
    q(sb.from('comments').select('*').eq('task_id', S.tid).order('created_at')),
    q(sb.from('activity').select('*').eq('task_id', S.tid).order('created_at', { ascending:false }).limit(100)),
    q(sb.from('subtasks').select('*').eq('task_id', S.tid).order('position')),
  ]);
  S.comments = c; S.tact = a; S.subs = st;
  S.reacts = c.length ? await q(sb.from('comment_reactions').select('*').in('comment_id', c.map(x => x.id))) : [];
  // task_reads no está en tiempo real, así que marcar como leído no provoca bucles
  const now = new Date().toISOString(); S.reads[S.tid] = now;
  sb.from('task_reads').upsert({ user_id: S.me.id, task_id: S.tid, read_at: now }).then(() => {});
}
async function loadPerson(){
  if (!prof(S.uid)) { S.view = 'home'; return; }
  const [tasks, logs, msgs] = await Promise.all([
    q(sb.from('tasks').select('id,title,status,priority,due_date,project_id,task_assignees!inner(user_id)').eq('task_assignees.user_id', S.uid)),
    q(sb.from('time_logs').select('minutes,logged_on,task_id').eq('user_id', S.uid)),
    sb.from('comments').select('id', { count:'exact', head:true }).eq('user_id', S.uid),
  ]);
  S.person = { tasks, minutes: logs.reduce((a, r) => a + r.minutes, 0), msgs: msgs.count || 0 };
}
// Fotos del diario: el bucket es privado, así que pedimos enlaces firmados (1 h) y los guardamos
async function signImages(paths){
  const need = [...new Set(paths)].filter(p => !S.urls[p] || Date.now() - S.urls[p].t > 45 * 60e3);
  if (!need.length) return;
  const { data } = await sb.storage.from('diario').createSignedUrls(need, 3600);
  (data || []).forEach(d => { if (d.signedUrl) S.urls[d.path] = { u: d.signedUrl, t: Date.now() }; });
}

// Tiempo real: cualquier cambio en la base de datos refresca lo que estás viendo
let tmr;
function subscribe(){
  sb.channel('planner').on('postgres_changes', { event:'*', schema:'public' }, () => {
    clearTimeout(tmr); tmr = setTimeout(start, 400);
  }).subscribe();
}

/* ============ rutas (#v=…&p=…&t=…) ============ */
function readHash(){
  const h = new URLSearchParams(location.hash.slice(1));
  if (!S.restored) {
    S.restored = true;
    if (!h.get('v') && !h.get('p')) { S.view = ls('view') || 'home'; S.pid = ls('pid'); }
  }
  if (h.get('v')) S.view = h.get('v');
  if (h.get('p')) { S.pid = h.get('p'); if (!h.get('v')) S.view = 'board'; }
  if (h.get('u')) S.uid = h.get('u');
  if (h.get('t')) { S.tid = h.get('t'); S.modal = 'task'; }
  if (PVIEWS.some(v => v[0] === S.view) && !S.projects.some(p => p.id === S.pid)) S.pid = (S.projects.find(p => !p.archived && !p.is_template) || {}).id || null;
  if (PVIEWS.some(v => v[0] === S.view) && !S.pid) S.view = 'home';
}
function setHash(){
  const h = { v: S.view };
  if (PVIEWS.some(v => v[0] === S.view) || S.tid) h.p = S.pid;
  if (S.view === 'person') h.u = S.uid;
  if (S.tid) h.t = S.tid;
  history.replaceState(null, '', '#' + new URLSearchParams(h));
  ls('view', S.view === 'person' ? 'home' : S.view); ls('pid', S.pid);
}
// Pegar un enlace de tarea con la web ya abierta (setHash usa replaceState y no dispara esto)
addEventListener('hashchange', () => { if (S.me) start(); });
const taskLink = (pid, tid) => location.origin + location.pathname + '#' + new URLSearchParams({ v:'board', p: pid, t: tid });
async function go(view, opts = {}){
  closeSide();
  S.view = view; S.sel.clear(); S.selMode = false; S.pop = null;
  if (opts.pid && opts.pid !== S.pid) { S.pid = opts.pid; S.label = ''; S.onlyMine = false; }
  if (opts.uid) S.uid = opts.uid;
  if (!opts.keepTask) { S.tid = null; if (S.modal === 'task') S.modal = null; }
  if (PVIEWS.some(v => v[0] === view)) { await loadProject(); if (!S.pid) S.view = 'home'; }
  if (S.view === 'person') await loadPerson();
  setHash(); render(); renderModal();
  $('main')?.scrollTo?.(0, 0);
}
const goProject = (pid, view = 'board') => go(view, { pid });
async function jump(pid, tid){ S.panel = null; await go('board', { pid }); if (tid) openTask(tid); }

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
    <main>${mainHTML()}</main>
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
    <button onclick="renameMe()">${ic('pencil')} Cambiar mi nombre</button>
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
      <div class="n"><i class="dot"></i><span>${esc(p.name)}</span>${adminOf(p.id) && !isOwner() ? '<span class="badge" style="margin-left:auto">Admin</span>' : ''}</div>
      <div class="bar"><i style="width:${tot ? done / tot * 100 : 0}%"></i></div>
      <small class="mut">${done}/${tot} tareas${p.due_date && !p.archived ? ` · entrega ${fmtD(p.due_date)}` : ''}</small></button>`; };
  const openArch = !!ls('arch');
  return `
    <button class="nav ${S.view === 'home' ? 'on' : ''}" onclick="go('home')">${ic('house')} Inicio</button>
    <button class="nav ${S.view === 'mine' ? 'on' : ''}" onclick="go('mine')">${ic('list-todo')} Mis tareas <span class="cnt">${S.mine.filter(t => t.status !== 'completada').length}</span></button>
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
  const p = proj();
  if (!p) return emptyState('folder-kanban', 'No hay proyectos todavía', canCreate() ? 'Crea el primero con el botón + del menú.' : 'Cuando se cree uno, aparecerá aquí.');
  const view = { board: boardHTML, gantt: ganttHTML, cal: calHTML, diary: diaryHTML, team: teamHTML, files: filesHTML }[S.view];
  return projectHeaderHTML(p) + (view ? view() : `<div class="hist">${histHTML(S.activity, true)}</div>`);
}
const emptyState = (icon, title, text = '') => `<div class="empty-state">${ic(icon)}<h3>${title}</h3><p>${text}</p></div>`;

function projectHeaderHTML(p){
  const E = adminOf(p.id), total = S.tasks.length, open = S.tasks.filter(t => t.status !== 'completada');
  const done = total - open.length, late = open.filter(t => t.due_date && daysLeft(t.due_date) < 0).length;
  const pin = S.posts.find(x => x.pinned);
  return `
  <div class="ph" style="--c:${esc(p.color)}">
    <h2><i class="dot"></i>${esc(p.name)}</h2>
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
    </div>
    ${p.description ? `<p class="desc">${linkify(p.description)}</p>` : ''}
    ${pin && S.view !== 'diary' ? `<div class="pinned" onclick="go('diary')">${ic('pin')}<div class="grow"><b>${esc(first(pin.user_id))}:</b> ${esc((pin.body || (pin.poll_options ? 'Encuesta' : 'Fotos')).slice(0, 160))}</div><span class="small mut">Ver diario →</span></div>` : ''}
  </div>
  <div class="tabs" style="--c:${esc(p.color)}">
    ${PVIEWS.map(([k, n, i]) => `<button class="tab ${S.view === k ? 'on' : ''}" onclick="go('${k}')">${ic(i)} ${n}</button>`).join('')}
    <div class="sp"></div>
    ${S.view === 'board' ? boardToolsHTML() : ''}
  </div>`;
}
function boardToolsHTML(){
  const E = adminOf();
  return `<div class="tools">
    ${E ? `<button class="ico ${S.selMode ? 'on' : ''}" onclick="S.selMode=!S.selMode;S.sel.clear();render()" title="Seleccionar varias tareas">${ic('list-checks')}</button>` : ''}
    <button class="ico ${S.compact ? 'on' : ''}" onclick="S.compact=!S.compact;ls('compact',S.compact);render()" title="Vista compacta">${ic('rows-3')}</button>
    <select onchange="S.sort=this.value;ls('sort',S.sort);render()" title="Ordenar tarjetas">
      ${[['manual','Orden manual'],['due','Por fecha'],['prio','Por prioridad'],['person','Por persona']].map(([k, n]) => `<option value="${k}" ${S.sort === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
    ${labelsOf().length ? `<select onchange="S.label=this.value;render()"><option value="">Todas las etiquetas</option>${labelsOf().map(l => `<option ${l === S.label ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : ''}
    <label class="tg"><input type="checkbox" ${S.onlyMine ? 'checked' : ''} onchange="S.onlyMine=this.checked;render()"> Solo mías</label></div>`;
}
const labelsOf = () => [...new Set(S.tasks.flatMap(t => t.labels || []))].sort();

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
      <div class="card-box"><h3>${ic('megaphone')} Último en los diarios</h3>
        ${S.recent.map(p => `<div class="pmini" onclick="goProject('${p.project_id}','diary')"><div class="row">${av(p.user_id)}<b class="small">${esc(pname(p.user_id))}</b><span class="small mut">· ${esc(proj(p.project_id)?.name)} · ${ago(p.created_at)}</span>${p.pinned ? ic('pin', 'sm') : ''}</div>
          <p>${esc(p.body || (p.poll_options ? '📊 Encuesta' : ''))}${p.images.length ? ` <span class="mut">· ${ic('image', 'sm')} ${p.images.length}</span>` : ''}</p></div>`).join('') || emptyState('megaphone', 'Sin publicaciones', 'Los admins publicarán aquí avisos y novedades.')}
      </div>
    </div>
    <div class="sect">Proyectos activos</div>
    <div class="pcards">${act.map(p => { const tot = p.tasks.length, d = p.tasks.filter(t => t.status === 'completada').length;
      return `<div class="card-box pcard" style="--c:${esc(p.color)}" onclick="goProject('${p.id}')"><h4>${esc(p.name)}</h4>
        <div class="bar"><i style="width:${tot ? d / tot * 100 : 0}%"></i></div>
        <div class="row small mut" style="margin-top:8px"><span>${tot ? Math.round(d / tot * 100) : 0}% · ${d}/${tot}</span><span class="grow"></span>${dueProjectChip(p)}</div>
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
      ${isOwner() && u.id !== S.me.id ? `<button class="btn" onclick="openModal('members')">${ic('shield')} Permisos</button>` : ''}</div>
    <div class="kpis">
      <div class="card-box kpi"><b>${P.tasks.length}</b><span>Tareas asignadas</span></div>
      <div class="card-box kpi"><b style="color:var(--ok-t)">${done}</b><span>Completadas</span></div>
      <div class="card-box kpi"><b>${fmtMin(P.minutes)}</b><span>Horas dedicadas</span></div>
      <div class="card-box kpi"><b>${P.msgs}</b><span>Mensajes en chats</span></div>
    </div>
    ${late ? `<div class="banner bad">${ic('triangle-alert')} Tiene ${late} tarea${late > 1 ? 's' : ''} vencida${late > 1 ? 's' : ''}.</div>` : ''}
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
      ${E && b ? `<div class="addt"><input id="nt-${b.id}" placeholder="+ Agregar tarea" title="Enter para crear · pega una lista (una por línea) para crear varias" onkeydown="if(event.key==='Enter')addTask('${b.id}',this)" onpaste="pasteTasks(event,'${b.id}')"></div>` : ''}
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
  return `<article class="card ${done ? 'done' : ''} ${on ? 'selected' : ''}" style="--p:${p[1]}" draggable="${E && !sel}"
      ondragstart="event.dataTransfer.setData('text/plain','${t.id}')" ${E && S.sort === 'manual' ? `ondragover="event.preventDefault()" ondrop="dropOnCard(event,'${t.id}')"` : ''}
      onclick="${sel ? `toggleSel('${t.id}')` : `openTask('${t.id}')`}">
    ${sel ? `<input type="checkbox" class="selbox" ${on ? 'checked' : ''} aria-label="Seleccionar">` : E ? `<button class="chk ${done ? 'on' : ''}" title="${done ? 'Reabrir' : 'Marcar como completada'}" onclick="event.stopPropagation();quickDone('${t.id}')">${done ? ic('check') : ''}</button>` : ''}
    <div class="tags"><span class="prio">${p[0]}</span>${t.status === 'en_curso' ? '<span class="st">En curso</span>' : ''}${bl ? `<span class="blk">${ic('lock', 'sm')} Bloqueada</span>` : ''}${t.review_requested && !done ? `<span class="rev">${ic('eye', 'sm')} Revisar</span>` : ''}${(t.labels || []).map(lblHTML).join('')}</div>
    <div class="ttl">${esc(t.title)}</div>
    <div class="meta">${dueChip(t)}${t.subtasks.length ? `<span>${ic('square-check', 'sm')} ${sd}/${t.subtasks.length}</span>` : ''}${nu ? `<span class="chip warn">${ic('message-square', 'sm')} ${nu} nuevo${nu > 1 ? 's' : ''}</span>` : cc ? `<span>${ic('message-square', 'sm')} ${cc}</span>` : ''}${mins ? `<span>${ic('clock', 'sm')} ${fmtMin(mins)}</span>` : ''}${okUrl(t.drive_url) ? `<span>${ic('folder', 'sm')}</span>` : ''}
      <span class="avs">${t.task_assignees.map(a => av(a.user_id)).join('')}</span></div>
    ${E && !sel ? `<div class="qa" onclick="event.stopPropagation()">
      <button class="ico" title="Asignar" onclick="setPop('${t.id}','who')">${ic('user-plus', 'sm')}</button>
      <button class="ico" title="Fecha límite" onclick="setPop('${t.id}','date')">${ic('calendar', 'sm')}</button>
      <button class="ico" title="Cambiar prioridad" onclick="cyclePrio('${t.id}')">${ic('zap', 'sm')}</button></div>` : ''}
    ${pop ? `<div class="pop" onclick="event.stopPropagation()">${pop === 'who'
      ? members().map(u => `<label><input type="checkbox" ${assigned.has(u.id) ? 'checked' : ''} onchange="toggleAssignee('${u.id}',this.checked,'${t.id}')"> ${av(u.id)} ${esc(pname(u.id))}</label>`).join('')
      : `<input type="date" value="${t.due_date || ''}" onchange="q(sb.from('tasks').update({due_date:this.value||null}).eq('id','${t.id}'));S.pop=null">`}</div>` : ''}
  </article>`;
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
        <div class="gbar ${t.status === 'completada' ? 'done' : ''} ${pt ? 'pt' : ''}" style="--p:${pr};left:${x(s) + (pt ? W / 2 : 2)}px;width:${pt ? 14 : (dayDiff(s, e) + 1) * W - 4}px" onclick="openTask('${t.id}')" title="${esc(t.title)} · ${fmtD(s)}${pt ? '' : ' → ' + fmtD(e)}">${pt ? '' : esc(t.title)}</div></div>`;
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
    cells += `<div class="dc ${d.getMonth() !== m ? 'out' : ''} ${k === td ? 'today' : ''} ${k === p.due_date ? 'due' : ''}">
      <div class="dn">${d.getDate()}${k === p.due_date ? ` · <b style="color:var(--bad-t)">Entrega</b>` : ''}</div>
      ${ts.map(t => `<button class="ct ${t.status === 'completada' ? 'done' : ''}" style="--p:${PRIO[t.priority][1]}" title="${esc(t.title)}" onclick="openTask('${t.id}')">${esc(t.title)}</button>`).join('')}</div>`;
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
      <textarea id="pbody" placeholder="Escribe un aviso, una novedad o un resumen de la reunión…" oninput="S.draft.body=this.value">${esc(D.body)}</textarea>
      ${D.images.length ? `<div class="thumbs">${D.images.map((im, i) => `<div><img src="${im.url}" alt=""><button onclick="S.draft.images.splice(${i},1);render()" aria-label="Quitar foto">${ic('x', 'sm')}</button></div>`).join('')}</div>` : ''}
      ${D.poll ? `<div class="poll">${D.poll.map((o, i) => `<div class="row"><input id="po-${i}" value="${esc(o)}" placeholder="Opción ${i + 1}" oninput="S.draft.poll[${i}]=this.value">${D.poll.length > 2 ? `<button class="ico" onclick="S.draft.poll.splice(${i},1);render()">${ic('x', 'sm')}</button>` : ''}</div>`).join('')}
        <div class="row">${D.poll.length < 10 ? `<button class="btn sm ghost" onclick="S.draft.poll.push('');render()">${ic('plus', 'sm')} Opción</button>` : ''}<button class="btn sm ghost" onclick="S.draft.poll=null;render()">Quitar encuesta</button></div></div>` : ''}
      <div class="row" style="margin-top:10px">
        <label class="btn ghost" style="margin:0;color:var(--txt2)">${ic('image')} Fotos<input type="file" accept="image/*" multiple hidden onchange="addImages(this.files)"></label>
        ${D.poll ? '' : `<button class="btn ghost" onclick="S.draft.poll=['','']; render()">${ic('chart-bar')} Encuesta</button>`}
        <span class="grow"></span>
        <button class="btn pri" ${S.busy ? 'disabled' : ''} onclick="publishPost()">${ic('send')} ${S.busy ? 'Publicando…' : 'Publicar'}</button>
      </div></div>` : `<div class="banner info">${ic('info')} Solo los admins de este proyecto pueden publicar. Tú puedes leer, reaccionar y votar en las encuestas.</div>`}
    ${posts.map(postHTML).join('') || `<div class="card-box post">${emptyState('megaphone', 'El diario está vacío', E ? 'Publica el primer aviso.' : 'Aquí aparecerán los avisos de los admins.')}</div>`}
  </div>`;
}
function postHTML(p){
  const imgs = p.images.map(x => S.urls[x]?.u).filter(Boolean), M = canManagePost(p);
  const votes = S.votes.filter(v => v.post_id === p.id), mine = votes.find(v => v.user_id === S.me.id);
  return `<article class="card-box post ${p.pinned ? 'pin' : ''}">
    <div class="hd">${av(p.user_id, 'l')}<div class="grow"><div class="row" style="gap:6px"><b>${esc(pname(p.user_id))}</b>${roleBadge(p.user_id, p.project_id)}</div>
      <small class="mut">${fmtT(p.created_at)}${p.edited_at ? ' · editado' : ''}</small></div>
      ${p.pinned ? `<span class="chip warn">${ic('pin', 'sm')} Fijado</span>` : ''}
      ${M ? `<button class="ico" title="${p.pinned ? 'Desfijar' : 'Fijar arriba'}" onclick="q(sb.from('posts').update({pinned:${!p.pinned}}).eq('id','${p.id}'))">${ic(p.pinned ? 'pin-off' : 'pin')}</button>
        <button class="ico" title="Editar" onclick="editPost('${p.id}')">${ic('pencil')}</button>
        <button class="ico" title="Eliminar" onclick="delPost('${p.id}')">${ic('trash-2')}</button>` : ''}</div>
    ${p.body ? `<div class="body">${linkify(p.body)}</div>` : ''}
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
  if (!body && !D.images.length && !poll) return toast('Escribe algo, añade fotos o una encuesta', 'err');
  S.busy = true; render();
  try {
    const paths = [];
    for (const im of D.images) {
      const path = `${S.pid}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from('diario').upload(path, im.blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      paths.push(path);
    }
    await q(sb.from('posts').insert({ project_id: S.pid, body, images: paths, poll_options: poll }));
    D.images.forEach(im => URL.revokeObjectURL(im.url));
    S.draft = { body:'', images:[], poll:null }; toast('Publicado en el diario');
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
    case 'task_deleted': return `eliminó la tarea ${t}`;
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

/* ============ Notificaciones ============ */
function notifGroups(){
  const out = [], idx = {};
  for (const n of S.notifs) {
    const key = !n.read && n.task_id && ['comment', 'status', 'due'].includes(n.type) ? n.type + n.task_id : n.id;
    if (idx[key]) idx[key].push(n); else out.push(idx[key] = [n]);
  }
  return out;
}
const NICON = { comment:'message-square', mention:'at-sign', reply:'reply', assigned:'user-plus', unassigned:'user-minus', status:'circle-check', due:'calendar', due_soon:'alarm-clock',
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
  const html = m === 'task' ? taskHTML() : m === 'members' ? membersHTML() : m === 'summary' ? summaryHTML() : m === 'keys' ? keysHTML()
             : projectFormHTML(m === 'project-edit' ? proj() : null);
  if (!html) { S.modal = null; $('#modal').innerHTML = ''; return; }
  $('#modal').innerHTML = `<div class="ov" onclick="if(event.target===this)closeModal()">${html}</div>`;
  const c = $('#chatlist'); if (c) c.scrollTop = c.scrollHeight;
  icons();
}
function openModal(m){ S.modal = m; S.panel = null; closeSide(); render(); renderModal(); }
function closeModal(){ S.modal = null; S.tid = null; S.reply = null; typingChannel(null); setHash(); renderModal(); render(); }

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
      ${E ? `<button class="btn sm" onclick="dupTask()">${ic('copy', 'sm')} <span class="hide-m">Duplicar</span></button><button class="btn sm bad" onclick="delTask()">${ic('trash-2', 'sm')}</button>` : ''}
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
        <details ${E ? '' : 'open'}><summary>Historial de la tarea</summary><div class="mini">${histHTML(S.tact, false)}</div></details>
      </div>
      <div>
        <b class="row">${ic('message-square')} Chat de la tarea</b>
        <div class="chat" id="chatlist">${S.comments.map(c => { const me = c.user_id === S.me.id, rt = S.comments.find(x => x.id === c.reply_to);
          const canEdit = me && c.kind !== 'ready' && Date.now() - new Date(c.created_at) < 300000;
          return `<div class="msg ${me ? 'me' : ''} ${c.kind === 'ready' ? 'ready' : ''}">${av(c.user_id)}
          <div class="bd"><b>${esc(pname(c.user_id))}</b> ${roleBadge(c.user_id, t.project_id)} <small class="mut">${ago(c.created_at)}${c.edited_at ? ' · editado' : ''}</small>
          <span class="mact"><button class="ico" title="Responder" onclick="setReply('${c.id}')">${ic('reply', 'sm')}</button>
            ${canEdit ? `<button class="ico" title="Editar (5 min)" onclick="editComment('${c.id}')">${ic('pencil', 'sm')}</button>` : ''}
            ${E ? `<button class="ico" title="Borrar mensaje" onclick="delComment('${c.id}')">${ic('trash-2', 'sm')}</button>` : ''}</span>
          ${rt ? `<div class="quote">↩ <b>${esc(pname(rt.user_id))}</b>: ${esc(rt.body.slice(0, 90))}</div>` : c.reply_to ? '<div class="quote">↩ Mensaje borrado</div>' : ''}
          ${c.body ? `<p>${mentionify(c)}</p>` : ''}
          ${(c.links || []).filter(okUrl).map(u => `<a class="lk" href="${esc(u)}" target="_blank" rel="noopener">${ic(/drive\.google|docs\.google/.test(u) ? 'folder' : 'link', 'sm')} ${esc(u.replace(/^https?:\/\//, '').slice(0, 45))}</a>`).join('')}
          <div class="reacts">${REACT_MSG.map(em => { const rs = S.reacts.filter(r => r.comment_id === c.id && r.emoji === em), mi = rs.some(r => r.user_id === S.me.id);
            return `<button class="${mi ? 'on' : ''} ${rs.length ? 'has' : ''}" title="${esc(rs.map(r => pname(r.user_id)).join(', '))}" onclick="react('${c.id}','${em}',${mi})">${em}${rs.length ? ' ' + rs.length : ''}</button>`; }).join('')}</div>
          </div></div>`; }).join('') || emptyState('message-square', 'Sin mensajes', '¡Escribe el primero!')}</div>
        <div id="typing" class="mut small" style="min-height:18px"></div>
        <div class="comp">
          ${S.reply ? (rc => rc ? `<div class="quote row">↩ Respondiendo a <b>${esc(pname(rc.user_id))}</b>: <span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(rc.body)}</span><button class="ico" onclick="S.reply=null;keep(renderModal)">${ic('x', 'sm')}</button></div>` : '')(S.comments.find(x => x.id === S.reply)) : ''}
          <div id="mbox"></div>
          <textarea id="cbody" placeholder="Escribe un mensaje… Usa @ para mencionar. Los enlaces de Drive se adjuntan solos." oninput="mentionInput(this);sendTyping()"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();const f=$('#mbox button');f?f.onmousedown(event):sendComment()}"></textarea>
          <div class="r"><small class="mut hide-m">Enter enviar · Shift+Enter nueva línea · @ mencionar</small><span class="grow"></span><button class="btn pri" onclick="sendComment()">${ic('send', 'sm')} Enviar</button></div>
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
function keysHTML(){
  const k = [['/', 'Buscar'], ['H', 'Inicio'], ['M', 'Mis tareas'], ['1 … 7', 'Pestañas del proyecto (Tablero, Cronograma, Calendario, Diario, Equipo, Archivos, Historial)'],
             ['N', 'Nueva tarea en la primera columna (admins)'], ['← →', 'Tarea anterior / siguiente (con una tarea abierta)'], ['Esc', 'Cerrar']];
  return `<div class="mod sm"><div class="mh"><h3>Atajos de teclado</h3><button class="ico" onclick="closeModal()">${ic('x')}</button></div><div class="mb">
    ${k.map(([a, b]) => `<div class="mem"><kbd>${a}</kbd><div>${b}</div></div>`).join('')}</div></div>`;
}

/* ============ teclado y clics globales ============ */
function navTask(d){ const list = boardOrder(), i = list.findIndex(t => t.id === S.tid), nx = list[i + d]; if (nx) openTask(nx.id); else toast(d > 0 ? 'Es la última tarea' : 'Es la primera tarea'); }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (document.querySelector('.lightbox')) return document.querySelector('.lightbox').remove(); if (S.pop || S.panel) { S.pop = null; S.panel = null; return render(); } if (S.modal) return closeModal(); closeSide(); }
  if (e.target.closest?.('input,textarea,select,[contenteditable]') || e.ctrlKey || e.metaKey || e.altKey || !S.me || (!S.me.approved && !S.me.is_admin)) return;
  if (e.key === '/') { e.preventDefault(); $('#sq')?.focus(); }
  else if (S.modal === 'task' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) navTask(e.key === 'ArrowRight' ? 1 : -1);
  else if (S.modal) return;
  else if (e.key.toLowerCase() === 'n' && adminOf() && proj()) { e.preventDefault(); (S.view === 'board' ? Promise.resolve() : go('board')).then(() => $('.addt input')?.focus()); }
  else if (e.key.toLowerCase() === 'm') go('mine');
  else if (e.key.toLowerCase() === 'h') go('home');
  else if ('1234567'.includes(e.key) && proj()) go(PVIEWS[+e.key - 1][0]);
});
document.addEventListener('click', e => {
  let re = false;
  if (S.panel && !e.target.closest('.np,.menu,.bell,header .ico,.search,.bottomnav')) { S.panel = null; re = true; }
  if (S.pop && !e.target.closest('.pop,.qa')) { S.pop = null; re = true; }
  if (re) render();
});
function togglePanel(p){ S.panel = S.panel === p ? null : p; closeSide(); render(); }

/* ============ acciones: tareas ============ */
async function openTask(id){
  if (S.tid !== id) S.reply = null;
  if (!S.tasks.some(t => t.id === id)) return;
  S.tid = id; S.modal = 'task'; S.comments = []; S.tact = []; S.subs = []; S.reacts = []; setHash(); renderModal();
  typingChannel(id); await loadTask(); keep(renderModal); render();
}
async function renameMe(){
  const v = prompt('Tu nombre y apellidos:', S.me.full_name); if (!v?.trim()) return;
  await q(sb.from('profiles').update({ full_name: v.trim() }).eq('id', S.me.id));
}
async function saveProject(edit){
  const name = $('#p-name').value.trim(), drive = $('#p-drive').value.trim();
  if (!name) return toast('Pon un nombre al proyecto', 'err');
  if (drive && !okUrl(drive)) return toast('El enlace de Drive debe empezar por https://', 'err');
  const row = { name, description: $('#p-desc').value.trim() || null, drive_url: drive || null, color: document.querySelector('input[name=pc]:checked').value,
                due_date: $('#p-due').value || null, is_template: $('#p-tpl').checked };
  if (edit) { row.archived = $('#p-arch').checked; await q(sb.from('projects').update(row).eq('id', S.pid)); closeModal(); return; }
  let id;
  if ($('#p-from')?.value) { id = await q(sb.rpc('duplicate_project', { p_src: $('#p-from').value, p_name: name, p_template: row.is_template })); await q(sb.from('projects').update(row).eq('id', id)); }
  else id = (await q(sb.from('projects').insert(row).select()))[0].id;
  S.modal = null; await loadBase(); goProject(id);
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
  const title = el.value.trim(); if (!title) return;
  el.value = '';
  await q(sb.from('tasks').insert({ project_id: S.pid, bucket_id: bid, title, position: -Date.now() })); // negativo = arriba del todo, como Planner
}
async function pasteTasks(e, bid){
  const lines = e.clipboardData.getData('text').split(/\r?\n/).map(s => s.replace(/^\s*([-*•·]|\d+[.)])\s*/, '').trim()).filter(Boolean);
  if (lines.length < 2) return;
  e.preventDefault();
  if (!confirm(`¿Crear ${lines.length} tareas?\n\n• ${lines.slice(0, 10).join('\n• ')}${lines.length > 10 ? '\n…' : ''}`)) return;
  const base = -Date.now();
  await q(sb.from('tasks').insert(lines.map((title, i) => ({ project_id: S.pid, bucket_id: bid, title: title.slice(0, 300), position: base + i }))));
  toast(`${lines.length} tareas creadas`);
}
async function moveTask(t, bid, pos){
  const old = { bucket_id: t.bucket_id, position: t.position };
  if (old.bucket_id === bid && old.position === pos) return;
  Object.assign(t, { bucket_id: bid, position: pos }); render();
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
  if (t && t.bucket_id !== bid) moveTask(t, bid, Date.now());
}
async function dropOnCard(e, targetId){
  const d = e.dataTransfer.getData('text/plain'); if (d.startsWith('col:')) return;
  e.preventDefault(); e.stopPropagation(); e.currentTarget.closest('.col')?.classList.remove('over');
  const t = S.tasks.find(x => x.id === d), target = S.tasks.find(x => x.id === targetId);
  if (!t || !target || t.id === target.id) return;
  const list = colTasks(target.bucket_id).filter(x => x.id !== t.id), i = list.findIndex(x => x.id === targetId);
  moveTask(t, target.bucket_id, i > 0 ? (list[i - 1].position + target.position) / 2 : target.position - 1); // queda encima de la tarjeta destino
}
function setPop(tid, kind){ S.pop = S.pop?.tid === tid && S.pop.kind === kind ? null : { tid, kind }; render(); }
async function cyclePrio(tid){
  const t = S.tasks.find(x => x.id === tid), ks = Object.keys(PRIO), nx = ks[(ks.indexOf(t.priority) + 1) % ks.length];
  t.priority = nx; render(); await q(sb.from('tasks').update({ priority: nx }).eq('id', tid));
}
function toggleSel(id){ S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); render(); }
async function bulk(kind, val){
  const ids = [...S.sel]; if (!ids.length || val === '') return;
  if (kind === 'patch') await q(sb.from('tasks').update(val).in('id', ids));
  else if (kind === 'assign') await q(sb.from('task_assignees').upsert(ids.map(id => ({ task_id: id, user_id: val })), { ignoreDuplicates: true }));
  else if (kind === 'delete') {
    if (!confirm(`¿Eliminar ${ids.length} tareas?`)) return;
    ids.forEach(id => S.hidden.add(id)); S.sel.clear(); render();
    return toastUndo(`${ids.length} tareas eliminadas`, () => { ids.forEach(id => S.hidden.delete(id)); render(); }, () => q(sb.from('tasks').delete().in('id', ids)));
  }
  toast(`${ids.length} tareas actualizadas`);
}
async function quickDone(id){
  const t = S.tasks.find(x => x.id === id);
  await q(sb.from('tasks').update({ status: t.status === 'completada' ? 'no_iniciada' : 'completada' }).eq('id', id));
}
async function saveTask(patch){ await q(sb.from('tasks').update(patch).eq('id', S.tid)); }
function saveDates(patch){
  const t = S.tasks.find(x => x.id === S.tid), s = patch.start_date !== undefined ? patch.start_date : t.start_date, d = patch.due_date !== undefined ? patch.due_date : t.due_date;
  if (s && d && s > d) { toast('La fecha de inicio no puede ser posterior a la fecha límite', 'err'); return keep(renderModal); }
  saveTask(patch);
}
function saveDrive(v){ v = v.trim(); if (v && !okUrl(v)) return toast('El enlace debe empezar por https://', 'err'); saveTask({ drive_url: v || null }); }
async function delTask(){
  const id = S.tid, t = S.tasks.find(x => x.id === id);
  closeModal(); S.hidden.add(id); render();
  toastUndo(`Tarea «${t.title}» eliminada`, () => { S.hidden.delete(id); render(); }, () => q(sb.from('tasks').delete().eq('id', id)));
}
async function dupTask(){
  const t = S.tasks.find(x => x.id === S.tid);
  const [n] = await q(sb.from('tasks').insert({ project_id: t.project_id, bucket_id: t.bucket_id, title: t.title + ' (copia)', description: t.description,
    drive_url: t.drive_url, priority: t.priority, start_date: t.start_date, due_date: t.due_date, labels: t.labels, position: t.position + 0.001 }).select());
  if ((S.subs || []).length) await q(sb.from('subtasks').insert(S.subs.map(s => ({ task_id: n.id, title: s.title, position: s.position }))));
  if (t.task_assignees.length) await q(sb.from('task_assignees').insert(t.task_assignees.map(a => ({ task_id: n.id, user_id: a.user_id }))));
  toast('Tarea duplicada'); await loadProject(); openTask(n.id);
}
function copyLink(){
  const u = taskLink(S.pid, S.tid);
  navigator.clipboard?.writeText(u).then(() => toast('Enlace copiado: pégalo en WhatsApp o donde quieras'), () => prompt('Copia este enlace:', u));
}
async function toggleAssignee(uid, on, tid = S.tid){
  if (on) await q(sb.from('task_assignees').insert({ task_id: tid, user_id: uid }));
  else await q(sb.from('task_assignees').delete().eq('task_id', tid).eq('user_id', uid));
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
  const el = $('#cbody'), body = el.value.trim(); if (!body) return;
  const links = [...new Set(body.match(/https?:\/\/[^\s<>"']+/g) || [])];
  const mentions = members().filter(p => body.includes('@' + pname(p.id))).map(p => p.id);
  const reply_to = S.reply; S.reply = null;
  el.value = ''; $('#mbox').innerHTML = '';
  try { await q(sb.from('comments').insert({ task_id: S.tid, body, links, mentions, reply_to })); } catch { el.value = body; S.reply = reply_to; }
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
    q(sb.from('tasks').select('id,title,project_id').or(`title.ilike.%${v}%,description.ilike.%${v}%`).limit(15)),
    q(sb.from('comments').select('body,task_id,user_id,tasks(title,project_id)').ilike('body', `%${v}%`).order('created_at', { ascending:false }).limit(15)),
  ]);
  const pn = id => proj(id)?.name || '';
  S.found = { q: v, items: [
    ...ts.map(t => ({ p: t.project_id, t: t.id, icon: '📋', title: t.title, sub: pn(t.project_id) })),
    ...cs.filter(c => c.tasks).map(c => ({ p: c.tasks.project_id, t: c.task_id, icon: '💬', title: c.body.slice(0, 80), sub: `${pname(c.user_id)} en «${c.tasks.title}» · ${pn(c.tasks.project_id)}` })),
  ] };
  S.panel = 'search'; keep(render);
}

/* ============ exportar ============ */
// Informe: se abre en una pestaña nueva lista para "Guardar como PDF"
async function exportReport(){
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
  add(tareas, 'Tareas'); add(equipo, 'Equipo'); add(horas, 'Horas'); add(hist, 'Historial');
  XLSX.writeFile(wb, `${p.name.replace(/[\\/:*?"<>|]/g, '')} - Planner SEA.xlsx`);
  toast('Excel descargado');
}
