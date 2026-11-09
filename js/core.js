'use strict';
// Planner SEA · núcleo: configuración, utilidades, estado, roles, datos, tiempo real y rutas
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
const PVIEWS = [['board','Tablero','square-kanban'],['list','Lista','list'],['gantt','Cronograma','gantt-chart'],['cal','Calendario','calendar-days'],['diary','Diario','megaphone'],
                ['wiki','Notas','notebook-pen'],['material','Material','package'],['deliv','Entregables','package-check'],['plans','Planos','drafting-compass'],['decide','Decisiones','scale'],['team','Equipo','users'],['stats','Estadísticas','chart-line'],['files','Archivos','folder'],['hist','Historial','history'],['trash','Papelera','trash-2']];
const QUICK = ['Lo reviso hoy 👀', 'Hecho ✅', 'Subido a Drive 📁', '¿Alguien puede revisarlo?', 'Necesito ayuda con esto 🙋', 'Voy con retraso, lo termino mañana'];
const REACT_POST = ['👍','✅','👀','❤️','🎉'], REACT_MSG = ['👍','✅','👀'];

const S = { user:null, me:null, profiles:[], projects:[], padmins:[], notifs:[], mine:[], reads:{}, recent:[], review:[], weekMin:0,
  pid:null, tid:null, view:'home', uid:null, person:null,
  buckets:[], tasks:[], trash:[], activity:[], deps:[], tlogs:[], posts:[], preacts:[], votes:[], cdraft:[], tvotes:[], wiki:[], wid:null, wedit:null, revs:null, act84:[],
  listSort:{ k:'due', d:1 }, listQ:'', qr:false, rsvps:[], materials:[], meetings:[], exams:[], pitems:[], priv:'', cposts:[], cvotes:[], creacts:[], notes:[], ndraft:{ title:'', url:'', blob:null, mod:null }, track:[], deliv:[], cweek:null, plans:[], marks:[], decisions:[], dscores:[],
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
const newId = () => crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
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
  const st = p?.avatar_style || 'google', url = st === 'photo' ? p.photo_url : st === 'google' ? p?.avatar_url : null;
  const ini = n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const h = url ? `<img class="av ${cls}" src="${esc(url)}" title="${esc(n)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="av ${cls}" style="background:${p?.color ? esc(p.color) : `hsl(${hue(id || 'x')} 55% 45%)`}" title="${esc(n)}">${esc(ini)}</span>`;
  return h;
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

/* ============ preferencias de cada persona (se guardan en su perfil) ============ */
const pref = (k, d) => S.me?.prefs?.[k] ?? d;
async function setPref(k, v){
  S.me.prefs = { ...(S.me.prefs || {}), [k]: v }; applyTheme(); render(); if (S.modal) keep(renderModal);
  await q(sb.from('profiles').update({ prefs: S.me.prefs }).eq('id', S.me.id));
}
const ACCENTS = { indigo:['Índigo','#6366f1'], orange:['Naranja CIFP','#f39200'], green:['Verde','#16a34a'], blue:['Azul','#2563eb'] };
function applyTheme(){
  const a = pref('accent', 'indigo'), c = pref('contrast', false), root = document.documentElement;
  root.dataset.accent = a; root.dataset.contrast = c ? 'high' : '';
  ls('accent', a); ls('contrast', c);
}
const DEFAULT_TABS = ['board', 'gantt', 'diary', 'cal', 'files', 'material'];
const CARD_FIELDS = [['prio', 'Prioridad'], ['labels', 'Etiquetas'], ['due', 'Fecha límite'], ['subtasks', 'Subtareas'], ['comments', 'Mensajes'], ['hours', 'Horas'], ['votes', 'Votos'], ['avatars', 'Personas']];
const showField = k => !pref('cardOff', []).includes(k);
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  if (S.view === 'compare') await loadCompare();
  if (S.view === 'audit') await loadAudit();
  if (S.view === 'usage') await loadUsage();
  await loadView();
  await loadTask();
  if (!S.sessionTracked) { S.sessionTracked = true; track('session'); }
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
  const [profiles, projects, , mine, reads, padmins, recent, review, week, settings, meetings, exams, pitems] = await Promise.all([
    q(sb.from('profiles').select('*')),
    q(sb.from('projects').select('*, tasks(status,deleted_at)').order('created_at')),
    loadNotifs(),
    q(sb.from('tasks').select('id,title,status,priority,due_date,start_date,project_id,review_requested,labels,task_assignees!inner(user_id)').eq('task_assignees.user_id', S.me.id).is('deleted_at', null)),
    q(sb.from('task_reads').select('task_id,read_at')),
    q(sb.from('project_admins').select('*')),
    q(sb.from('posts').select('id,project_id,user_id,body,images,poll_options,pinned,created_at').not('project_id', 'is', null).order('created_at', { ascending:false }).limit(6)),
    q(sb.from('tasks').select('id,title,project_id').eq('review_requested', true).neq('status', 'completada').is('deleted_at', null)),
    q(sb.from('time_logs').select('minutes').eq('user_id', S.me.id).gte('logged_on', monday)),
    q(sb.from('app_settings').select('*').maybeSingle()),
    q(sb.from('posts').select('id,project_id,meeting_at,place').eq('kind', 'meeting').gte('meeting_at', new Date(Date.now() - 864e5 * 8).toISOString()).order('meeting_at').limit(40)),
    q(sb.from('exams').select('*').order('exam_date')),
    q(sb.from('personal_items').select('*').order('position')),
  ]);
  S.meetings = meetings; S.exams = exams; S.pitems = pitems || [];
  S.settings = settings || {};
  projects.forEach(p => p.tasks = p.tasks.filter(t => !t.deleted_at));
  Object.assign(S, { profiles, projects, mine, padmins, recent, review });
  S.me = profiles.find(p => p.id === S.me.id) || S.me;
  applyTheme();
  S.weekMin = week.reduce((a, r) => a + r.minutes, 0);
  S.reads = Object.fromEntries(reads.map(r => [r.task_id, r.read_at]));
}
async function loadNotifs(){
  const notifs = await q(sb.from('notifications').select('*').eq('digest', false).order('created_at', { ascending:false }).limit(80));
  const fresh = S.seen ? notifs.filter(n => !n.read && !S.seen.has(n.id)) : [];
  if (fresh.length > 2) toast(`Tienes ${fresh.length} notificaciones nuevas`); else fresh.forEach(n => toast(n.message));
  if (fresh.length) { beep(); browserNotify(fresh); }
  S.seen = new Set(notifs.map(n => n.id));
  S.notifs = notifs;
}
async function loadProject(){
  if (!S.projects.some(p => p.id === S.pid)) S.pid = (S.projects.find(p => !p.archived && !p.is_template) || S.projects[0])?.id || null;
  if (!S.pid) { Object.assign(S, { buckets:[], tasks:[], activity:[], deps:[], tlogs:[], posts:[], preacts:[], votes:[] }); return; }
  const [b, t, a, posts, wiki] = await Promise.all([
    q(sb.from('buckets').select('*').eq('project_id', S.pid).order('position')),
    q(sb.from('tasks').select('*, task_assignees(user_id), subtasks(id,done,title), comments(created_at,user_id,body)').eq('project_id', S.pid).order('position')),
    q(sb.from('activity').select('*').eq('project_id', S.pid).order('created_at', { ascending:false }).limit(300)),
    q(sb.from('posts').select('*').eq('project_id', S.pid).order('created_at', { ascending:false })),
    q(sb.from('wiki_pages').select('*').eq('project_id', S.pid).order('position').order('created_at')),
  ]);
  const ids = t.map(x => x.id), pids = posts.map(x => x.id);
  const wids = wiki.map(w => w.id);
  const [deps, tlogs, preacts, votes, tvotes, act84, wcom, materials, rsvps, deliv, plans, decisions] = await Promise.all([
    ids.length ? q(sb.from('task_deps').select('*').in('task_id', ids)) : [],
    ids.length ? q(sb.from('time_logs').select('*').in('task_id', ids).order('logged_on', { ascending:false })) : [],
    pids.length ? q(sb.from('post_reactions').select('*').in('post_id', pids)) : [],
    pids.length ? q(sb.from('post_votes').select('*').in('post_id', pids)) : [],
    ids.length ? q(sb.from('task_votes').select('*').in('task_id', ids)) : [],
    S.view === 'stats' ? q(sb.from('activity').select('actor_id,created_at').eq('project_id', S.pid).gte('created_at', addDays(today(), -84)).limit(5000)) : S.act84,
    wids.length ? q(sb.from('wiki_comments').select('*').in('page_id', wids).order('created_at')) : [],
    q(sb.from('materials').select('*').eq('project_id', S.pid).order('position')),
    pids.length ? q(sb.from('meeting_rsvps').select('*').in('post_id', pids)) : [],
    q(sb.from('deliverables').select('*').eq('project_id', S.pid).order('position')),
    q(sb.from('plans').select('*').eq('project_id', S.pid).order('created_at', { ascending:false })),
    q(sb.from('decisions').select('*').eq('project_id', S.pid).order('created_at')),
  ]);
  const planIds = plans.map(p => p.id), decIds = decisions.map(d => d.id);
  const [marks, dscores] = await Promise.all([
    planIds.length ? q(sb.from('plan_marks').select('*').in('plan_id', planIds).order('created_at')) : [],
    decIds.length ? q(sb.from('decision_scores').select('*').in('decision_id', decIds)) : [],
  ]);
  Object.assign(S, { materials, rsvps, deliv, plans, marks, decisions, dscores });
  await signImages('planos', plans.flatMap(p => p.pages));
  S.wcom = wcom;
  Object.assign(S, { buckets:b, tasks: t.filter(x => !x.deleted_at), trash: t.filter(x => x.deleted_at), activity:a, posts, deps, tlogs, preacts, votes, tvotes, wiki, act84 });
  if (!wiki.some(w => w.id === S.wid)) S.wid = wiki[0]?.id || null;
  await signImages('diario', posts.flatMap(p => p.images));
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
  const [reacts, priv] = await Promise.all([
    c.length ? q(sb.from('comment_reactions').select('*').in('comment_id', c.map(x => x.id))) : [],
    q(sb.from('task_private_notes').select('body').eq('task_id', S.tid).eq('user_id', S.me.id).maybeSingle()),
  ]);
  S.reacts = reacts; if (document.activeElement?.id !== 'f-priv') S.priv = priv?.body || '';
  await signImages('chat', c.flatMap(x => x.images || []));
  // task_reads no está en tiempo real, así que marcar como leído no provoca bucles
  const now = new Date().toISOString(); S.reads[S.tid] = now;
  sb.from('task_reads').upsert({ user_id: S.me.id, task_id: S.tid, read_at: now }).then(() => {});
}
async function loadPerson(){
  if (!prof(S.uid)) { S.view = 'home'; return; }
  const [tasks, logs, msgs, act] = await Promise.all([
    q(sb.from('tasks').select('id,title,status,priority,due_date,project_id,task_assignees!inner(user_id)').eq('task_assignees.user_id', S.uid).is('deleted_at', null)),
    q(sb.from('time_logs').select('minutes,logged_on,task_id').eq('user_id', S.uid)),
    sb.from('comments').select('id', { count:'exact', head:true }).eq('user_id', S.uid),
    q(sb.from('activity').select('created_at').eq('actor_id', S.uid).gte('created_at', addDays(today(), -140)).limit(5000)),
  ]);
  S.person = { tasks, minutes: logs.reduce((a, r) => a + r.minutes, 0), msgs: msgs.count || 0, act };
}
// Fotos del diario y del chat: los buckets son privados, así que pedimos enlaces firmados (1 h) y los guardamos
const imgUrl = (bucket, path) => S.urls[bucket + ':' + path]?.u;
async function signImages(bucket, paths){
  const need = [...new Set(paths)].filter(p => { const c = S.urls[bucket + ':' + p]; return !c || Date.now() - c.t > 45 * 60e3; });
  if (!need.length) return;
  const { data } = await sb.storage.from(bucket).createSignedUrls(need, 3600);
  (data || []).forEach(d => { if (d.signedUrl) S.urls[bucket + ':' + d.path] = { u: d.signedUrl, t: Date.now() }; });
}

// Tiempo real selectivo: cada cambio recarga solo la parte afectada (avisos, base, proyecto abierto o tarea abierta)
const RT_SKIP = new Set(['activity', 'task_reads', 'usage_events', 'admin_log', 'email_sent', 'wiki_revisions', 'task_private_notes']);
const RT_BASE = new Set(['projects', 'project_admins', 'app_settings', 'exams']);
let tmr, rtq = {};
function relProject(t, r){
  if ('project_id' in r) return r.project_id === S.pid;
  if ('task_id' in r) return [...S.tasks, ...S.trash].some(x => x.id === r.task_id);
  if ('post_id' in r) return S.posts.some(x => x.id === r.post_id);
  if ('page_id' in r) return S.wiki.some(x => x.id === r.page_id);
  if ('comment_id' in r) return S.comments.some(x => x.id === r.comment_id);
  if ('plan_id' in r) return S.plans.some(x => x.id === r.plan_id);
  if ('decision_id' in r) return S.decisions.some(x => x.id === r.decision_id);
  if (t === 'tasks' || t === 'posts') return [...S.tasks, ...S.trash, ...S.posts].some(x => x.id === r.id);
  return true; // borrados sin datos: mejor recargar
}
function relTask(t, r){
  if (!S.tid) return false;
  return r.task_id === S.tid || (t === 'tasks' && r.id === S.tid) || (t === 'comments' && S.comments.some(c => c.id === r.id))
    || (t === 'comment_reactions' && S.comments.some(c => c.id === r.comment_id)) || (t === 'subtasks' && S.subs.some(x => x.id === r.id));
}
function subscribe(){
  sb.channel('planner').on('postgres_changes', { event:'*', schema:'public' }, ev => {
    const t = ev.table, r = ev.new && Object.keys(ev.new).length ? ev.new : ev.old || {};
    if (RT_SKIP.has(t)) return;
    if (t === 'notifications') rtq.notif = true;
    else if (t === 'profiles') { if (r.id === S.me?.id && 'approved' in r && r.approved !== S.me.approved) rtq.full = true; else rtq.base = true; }
    else if (RT_BASE.has(t)) rtq.base = true;
    else if (t === 'module_notes') rtq.view = true;
    else {
      if ((t === 'posts' && (!r.project_id || S.cposts.some(p => p.id === r.id))) || ((t === 'post_votes' || t === 'post_reactions') && S.cposts.some(p => p.id === r.post_id))) rtq.view = true;
      if (relProject(t, r)) rtq.project = true;
      if (relTask(t, r)) rtq.task = true;
      if (t === 'tasks' || t === 'task_assignees' || t === 'posts' || t === 'time_logs') rtq.base = true; // Inicio y Mis tareas
      if (S.view === 'compare') rtq.compare = true;
    }
    clearTimeout(tmr); tmr = setTimeout(flushRealtime, 400);
  }).subscribe();
}
async function flushRealtime(){
  const f = rtq; rtq = {};
  if (f.full || !S.me || (!S.me.approved && !S.me.is_admin)) return start();
  if (f.base) await loadBase(); else if (f.notif) await loadNotifs();
  if (f.project && S.pid && (PVIEWS.some(v => v[0] === S.view) || S.tid)) await loadProject();
  if ((f.task || f.project) && S.tid) await loadTask();
  if (f.compare && S.view === 'compare') await loadCompare();
  if (S.view === 'person' && (f.base || f.project)) await loadPerson();
  if (f.view || (f.base && S.view === 'track')) await loadView();
  keep(() => { render(); renderModal(); });
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
// vistas de clase y del propietario que cargan sus propios datos
async function loadView(){
  if (S.view === 'tablon') await loadClass();
  if (S.view === 'apuntes' || S.view === 'timetable') await loadNotes();
  if (S.view === 'track') await loadTrack();
}
async function go(view, opts = {}){
  if (view === 'plans') S.planId = null; // la pestaña Planos vuelve siempre a la lista
  closeSide();
  S.view = view; S.sel.clear(); S.selMode = false; S.pop = null;
  if (opts.pid && opts.pid !== S.pid) { S.pid = opts.pid; S.label = ''; S.onlyMine = false; }
  if (opts.uid) S.uid = opts.uid;
  if (!opts.keepTask) { S.tid = null; if (S.modal === 'task') S.modal = null; }
  if (PVIEWS.some(v => v[0] === view)) { await loadProject(); if (!S.pid) S.view = 'home'; }
  if (S.view === 'person') await loadPerson();
  if (S.view === 'compare') await loadCompare();
  if (S.view === 'audit') await loadAudit();
  if (S.view === 'usage') await loadUsage();
  await loadView();
  track('view:' + S.view);
  setHash(); render(); renderModal();
  $('main')?.scrollTo?.(0, 0);
}
const goProject = (pid, view = 'board') => go(view, { pid });
async function jump(pid, tid){ S.panel = null; await go('board', { pid }); if (tid) openTask(tid); }
