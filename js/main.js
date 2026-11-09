'use strict';
// Planner SEA · arranque: se carga el último, cuando ya existen todas las funciones
let started = false;
sb.auth.onAuthStateChange((ev, session) => setTimeout(() => {
  if (!session) { S.user = null; started = false; return loginScreen(); }
  // vuelta de «Conectar con Google Drive»: guardamos el permiso de Google (dura 1 h) y volvemos a la pestaña Archivos
  if (session.provider_token && location.search.includes('code=')) { ls('gdt', { t: session.provider_token, exp: Date.now() + 55 * 60e3 }); ls('gdtUsed', true); S.dErr = null; }
  const back = ls('driveBack'); if (back && location.search.includes('code=')) { ls('driveBack', null); history.replaceState(null, '', location.pathname + location.search + back); }
  if (started && S.user?.id === session.user.id) return;
  S.user = session.user; started = true;
  if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);
  subscribe(); start();
}));
