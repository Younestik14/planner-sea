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
  if (!document.querySelector('#app .center .skel')) return;
  console.error('Arranque bloqueado:', why);
  $('#app').innerHTML = `<div class="center"><div class="boxc" style="max-width:420px;text-align:center"><h2 style="margin:0 0 8px">La web no termina de cargar</h2>
    <p class="mut">Suele arreglarse recargando. Si sigue igual, limpia los ajustes guardados en este navegador (no se borra nada de la web ni tu sesión).</p>
    <div class="row" style="justify-content:center;margin-top:14px;flex-wrap:wrap"><button class="btn pri" onclick="location.replace(location.pathname)">Recargar</button>
    <button class="btn" onclick="Object.keys(localStorage).filter(k => k.startsWith('psea.')).forEach(k => localStorage.removeItem(k));location.replace(location.pathname)">Limpiar y recargar</button></div></div></div>`;
}
window.addEventListener('error', e => setTimeout(() => bootRescue(e.message), 3000));
setTimeout(() => bootRescue('tiempo agotado'), 15000);
