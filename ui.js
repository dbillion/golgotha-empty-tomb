/* Rearrange mode: press M (or the Move button), then drag any highlighted part of the screen.
   Offsets use the CSS `translate` property, so they never fight the `transform`s the app already uses.
   The Environment panel can also be dragged by its title on desktop at any time. */
const KEY = 'itp-layout-v1';
const $ = id => document.getElementById(id);
const PARTS = { title: '#top h1', scenes: '#scenes', view: '#top .group:not(#scenes)', move: '#bMove', hudbtn: '#bHud', chip: '#chip', play: '#bPlay', seek: '#seek', time: '#time', hud: '#hud' };
const M = 48;   // keep at least this many px of a part on screen
const cl = (v, a, b) => Math.min(Math.max(v, a), b);
let pos = {};
try { pos = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { pos = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(pos)); } catch {} };

const els = {};
for (const [k, sel] of Object.entries(PARTS)) { const el = document.querySelector(sel); if (el) { el.dataset.move = k; els[k] = el; } }
function apply(k) {
  const el = els[k]; if (!el) return; const p = pos[k];
  el.style.translate = p && (p[0] || p[1]) ? `${Math.round(p[0])}px ${Math.round(p[1])}px` : '';
  if (k === 'hud') el.classList.toggle('floating', !!(p && (p[0] || p[1])));
}
Object.keys(els).forEach(apply);

/* toolbar shown while rearranging */
const bar = document.createElement('div');
bar.id = 'arrangeBar'; bar.setAttribute('role', 'toolbar');
bar.innerHTML = '<span>Drag any outlined part to move it</span><button id="bResetLayout" class="ghost">Reset layout</button><button id="bDone">Done</button>';
document.body.appendChild(bar);
const setArrange = on => { document.body.classList.toggle('arrange', on); const b = $('bMove'); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); } };
$('bMove') && ($('bMove').onclick = () => setArrange(!document.body.classList.contains('arrange')));
$('bDone').onclick = () => setArrange(false);
$('bResetLayout').onclick = () => { pos = {}; save(); Object.keys(els).forEach(apply); };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'm' || e.key === 'M') setArrange(!document.body.classList.contains('arrange'));
  else if (e.key === 'Escape') setArrange(false);
});

/* dragging */
let drag = null;
function startDrag(el, e) {
  const k = el.dataset.move, r = el.getBoundingClientRect();
  drag = { el, k, id: e.pointerId, sx: e.clientX, sy: e.clientY, o: pos[k] ? pos[k].slice() : [0, 0], r };
  try { el.setPointerCapture(e.pointerId); } catch {}
  el.classList.add('moving');
}
document.addEventListener('pointerdown', e => {
  if (!document.body.classList.contains('arrange')) return;
  if (e.target.closest('#arrangeBar')) return;
  e.preventDefault(); e.stopPropagation();          // never orbit the 3D view or press a button while rearranging
  const el = e.target.closest('[data-move]');
  if (el && (e.button === 0 || e.pointerType !== 'mouse')) startDrag(el, e);
}, true);
document.addEventListener('wheel', e => { if (document.body.classList.contains('arrange') && !e.target.closest('#arrangeBar')) e.stopPropagation(); }, { capture: true, passive: true });
document.addEventListener('click', e => { if (document.body.classList.contains('arrange') && !e.target.closest('#arrangeBar')) { e.preventDefault(); e.stopPropagation(); } }, true);
/* the side panel also drags by its title on desktop, no mode needed */
const hh = document.querySelector('.hudhead strong');
if (hh) hh.addEventListener('pointerdown', e => { if (innerWidth >= 900 && els.hud && !document.body.classList.contains('arrange')) { e.preventDefault(); startDrag(els.hud, e); } });
document.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const { r, o, k } = drag, dx = cl(e.clientX - drag.sx, M - r.right, innerWidth - M - r.left), dy = cl(e.clientY - drag.sy, -r.top, innerHeight - 32 - r.top);
  pos[k] = [o[0] + dx, o[1] + dy]; apply(k);
});
const end = e => { if (!drag || e.pointerId !== drag.id) return; drag.el.classList.remove('moving'); drag = null; save(); };
document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);

/* if a window resize leaves a part off screen, put it back */
addEventListener('resize', () => {
  for (const k of Object.keys(pos)) { const el = els[k]; if (!el) continue; const r = el.getBoundingClientRect();
    if (r.right < M || r.left > innerWidth - M || r.top > innerHeight - 32) { delete pos[k]; apply(k); } }
  save();
});
