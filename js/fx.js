'use strict';
// Planner SEA · efectos de la piel Apple: anillos de progreso, contadores, entrada escalonada e inclinación con el ratón
const reduceFx = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Anillo de progreso tipo «Actividad» (pct 0–100). pathLength=100 permite animarlo solo con CSS
function ringHTML(pct, color, size = 56, stroke = 6, label = ''){
  const r = 50 - stroke * 50 / size, p = Math.max(0, Math.min(100, pct || 0));
  return `<span class="ring-w" style="--sz:${size}px">${`<svg class="ring" viewBox="0 0 100 100" style="--p:${p};--c:${esc(color || 'var(--acc)')};--sw:${stroke * 100 / size}" aria-hidden="true">
    <circle class="tr" cx="50" cy="50" r="${r}" pathLength="100"/><circle class="pr" cx="50" cy="50" r="${r}" pathLength="100"/></svg>`}${label ? `<b class="ring-l">${label}</b>` : ''}</span>`;
}

// Tras cada repintado: numera hijos para la entrada escalonada y anima contadores [data-count]
function fxAfterRender(root = document){
  root.querySelectorAll('.stagger').forEach(g => [...g.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 12))));
  if (reduceFx()) return;
  root.querySelectorAll('[data-count]:not([data-counted])').forEach(el => {
    el.dataset.counted = '1';
    const to = +el.dataset.count, t0 = performance.now(), dur = 900;
    if (!(to > 0)) return;
    const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(step); };
    el.textContent = '0'; requestAnimationFrame(step);
  });
}

// Inclinación suave de las tarjetas .tilt hacia el cursor (solo con ratón)
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.addEventListener('pointermove', e => {
    const el = e.target.closest?.('.tilt'); if (!el || reduceFx()) return;
    const b = el.getBoundingClientRect(), x = (e.clientX - b.left) / b.width - .5, y = (e.clientY - b.top) / b.height - .5;
    el.style.setProperty('--ry', `${x * 6}deg`); el.style.setProperty('--rx', `${-y * 6}deg`); el.style.setProperty('--ty', '-3px');
  }, { passive: true });
  document.addEventListener('pointerout', e => {
    const el = e.target.closest?.('.tilt'); if (!el || el.contains(e.relatedTarget)) return;
    ['--rx', '--ry', '--ty'].forEach(k => el.style.removeProperty(k));
  }, { passive: true });
}

// Título grande que se encoge al hacer scroll (como en iOS)
addEventListener('scroll', () => document.body.classList.toggle('scrolled', scrollY > 24), { passive: true });
