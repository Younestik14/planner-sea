'use strict';
// Planner SEA · arranque: se carga el último, cuando ya existen todas las funciones
let started = false;
sb.auth.onAuthStateChange((ev, session) => setTimeout(() => {
  if (!session) { S.user = null; started = false; return loginScreen(); }
  if (started && S.user?.id === session.user.id) return;
  S.user = session.user; started = true;
  if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);
  subscribe(); start();
}));
// Si algo falla al arrancar, en vez de quedarse cargando para siempre se ofrece recargar o limpiar la caché local
function bootRescue(why){
  if (!navigator.onLine || !document.querySelector('#app .center .skel')) return;
  console.error('Arranque bloqueado:', why);
  $('#app').innerHTML = `<div class="center"><div class="boxc" style="max-width:420px;text-align:center"><h2 style="margin:0 0 8px">La web no termina de cargar</h2>
    <p class="mut">Suele arreglarse recargando. Si sigue igual, limpia los ajustes guardados en este navegador (no se borra nada de la web ni tu sesión).</p>
    <div class="row" style="justify-content:center;margin-top:14px;flex-wrap:wrap"><button class="btn pri" onclick="location.replace(location.pathname)">Recargar</button>
    <button class="btn" onclick="Object.keys(localStorage).filter(k => k.startsWith('psea.')).forEach(k => localStorage.removeItem(k));location.replace(location.pathname)">Limpiar y recargar</button></div></div></div>`;
}
window.addEventListener('error', e => setTimeout(() => bootRescue(e.message), 3000));
setTimeout(() => bootRescue('tiempo agotado'), 15000);

/* ============ app instalable (PWA) y conexión ============ */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker:', e));
let pwaPrompt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); pwaPrompt = e; });
addEventListener('appinstalled', () => { pwaPrompt = null; toast('Planner SEA instalada ✓', 'ok'); });
const pwaInstalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
async function instalarApp(){
  if (pwaPrompt) { pwaPrompt.prompt(); const { outcome } = await pwaPrompt.userChoice; pwaPrompt = null; if (outcome !== 'accepted') toast('Instalación cancelada'); return; }
  openModal('pwa');
}
function pwaHTML(){
  const ios = esIOS(), paso = (n, t) => `<li><span class="pwa-n">${n}</span><span>${t}</span></li>`;
  return `<div class="mod sm"><div class="mh"><h3>${ic('smartphone')} Instalar Planner SEA</h3><button class="ico" onclick="closeModal()" aria-label="Cerrar">${ic('x')}</button></div><div class="mb">
    <div class="pwa-hero"><img src="icons/icon-192.png" alt="" width="72" height="72"><div><b>Planner SEA</b><br><span class="small mut">Se abre a pantalla completa, con su icono, como una app.</span></div></div>
    <ol class="pwa-pasos">${ios
      ? paso(1, `Abre esta página en <b>Safari</b>.`) + paso(2, `Pulsa <b>Compartir</b> ${ic('share', 'sm')} en la barra de abajo.`) + paso(3, `Elige <b>Añadir a pantalla de inicio</b> ${ic('square-plus', 'sm')}.`) + paso(4, `Pulsa <b>Añadir</b>.`)
      : paso(1, `Abre esta página en <b>Chrome</b> o <b>Edge</b>.`) + paso(2, `Abre el menú ${ic('ellipsis-vertical', 'sm')} del navegador.`) + paso(3, `Elige <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>.`)}</ol>
    <p class="small mut">Sin conexión la app se abre igualmente, pero tus datos necesitan internet para cargarse.</p></div></div>`;
}
// Sin conexión: pantalla propia al arrancar y aviso fijo mientras dure
function offlineUI(){
  document.body.classList.toggle('offline', !navigator.onLine);
  if (!navigator.onLine && document.querySelector('#app .center .skel')) $('#app').innerHTML = `<div class="center"><div class="boxc" style="max-width:380px;text-align:center">
    <img src="icons/icon-192.png" alt="" width="64" height="64" style="border-radius:15px"><h2 style="margin:14px 0 6px">Sin conexión</h2>
    <p class="mut">Planner SEA necesita internet para cargar tus proyectos. En cuanto vuelva la conexión, se abrirá sola.</p></div></div>`;
}
addEventListener('offline', () => { offlineUI(); toast('Sin conexión', 'err'); });
addEventListener('online', () => { const wasBoot = !S.me; offlineUI(); if (wasBoot) location.reload(); else toast('Conectado de nuevo ✓', 'ok'); });
offlineUI();
