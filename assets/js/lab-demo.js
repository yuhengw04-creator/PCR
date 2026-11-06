/* CIHANG — v50: a demo pointer on the Autonomy plan.
   Leo, 10/15: "直接上鼠标分别提示点房间和点manual 不然根本看不到就滚过去了".
   Once the map is done (.lab__scan.is-done) and at least half of the demo is on screen, a pointer (a fingertip on
   touch screens) appears on the plan, glides to a room pin and clicks it — CIHANG really drives there, so the visitor
   sees what a tap does — then glides to the Manual switch and keeps tapping the air over it with a pulsing ring
   (no click: switching to Manual is left to the visitor). Plays at most twice per page view (4.5 s apart), stops for
   good at the visitor's first real click / tap / key inside the demo or once Manual has been tried, and is cut short
   (not counted) when the demo leaves the screen. Reduced motion: off. Uses window.CIHANG_LAB from lab.js. */
(function () {
  'use strict';
  var root = document.getElementById('lab-scan'), sticky = document.getElementById('lab-sticky'), stage = document.getElementById('lab-stage');
  if (!root || !sticky || !stage || !window.CIHANG_LAB) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var touch = window.matchMedia('(hover: none)').matches;
  var g = document.createElement('div');
  g.className = 'lab__ghost' + (touch ? ' is-touch' : '');
  g.setAttribute('aria-hidden', 'true');
  g.innerHTML = '<span class="lab__ghost-ring"></span>' + (touch ? '<span class="lab__ghost-dot"></span>'
    : '<svg class="lab__ghost-arrow" viewBox="0 0 20 26"><path d="M2 2v19.4l4.8-4.5 3.2 7.3 3.4-1.5-3.2-7.2h6.6z"/></svg>');
  sticky.appendChild(g);

  // v53 (Leo 10/21, 10/23): never into the bedroom — the manual drive that follows could not find its way out of it.
  // The pointer sends it to the Lounge, the open floor of the living room, and only there (a second run, already
  // there, goes straight to the Manual hint)
  var ROOMS = ['lounge'];
  var MAX = 2, runs = 0, off = false, busy = false, inView = false, gen = 0, T = [], startT = 0, roomDone = false;
  function sleep(ms) { return new Promise(function (r) { T.push(setTimeout(r, ms)); }); }
  function rel(el, fx, fy) {
    var r = el.getBoundingClientRect(), s = sticky.getBoundingClientRect();
    return { x: r.left - s.left + r.width * fx, y: r.top - s.top + r.height * fy, ok: r.width > 0 && r.height > 0 };
  }
  function put(p, ms) { g.style.setProperty('--gd', (ms || 0) + 'ms'); g.style.transform = 'translate(' + p.x.toFixed(1) + 'px, ' + p.y.toFixed(1) + 'px)'; }
  function flash(cls) { g.classList.remove(cls); void g.offsetWidth; g.classList.add(cls); }
  function onScreen(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight; }
  function manualBtn() {
    var bs = root.querySelectorAll('.lab__mode[data-mode="drive"]'), best = null;
    for (var i = 0; i < bs.length; i++) { if (onScreen(bs[i]) && (!best || bs[i].closest('.lab__modes--float'))) best = bs[i]; }
    return best;
  }
  // the pins fade in one by one after the hand-off: wait (up to 2.5 s) until they are all there before pointing at one
  function pinsShown() { var ps = root.querySelectorAll('.lab__pin'); for (var i = 0; i < ps.length; i++) if (parseFloat(getComputedStyle(ps[i]).opacity) < 0.9) return false; return ps.length > 0; }
  function ready() { return root.classList.contains('is-done') && !root.classList.contains('is-driven') && window.CIHANG_LAB.mode === 'send'; }
  function hide() { g.classList.remove('is-on', 'is-hint', 'is-press', 'is-click'); }
  function abort() {
    if (!busy) return;
    gen++; T.forEach(clearTimeout); T = []; hide(); busy = false;
    if (!roomDone) runs = Math.max(0, runs - 1);   // cut short before it showed anything: may play again
  }
  function maybe() {
    if (off || busy || startT || runs >= MAX || !inView || !ready()) return;
    startT = setTimeout(function () { startT = 0; if (!off && !busy && inView && ready() && runs < MAX) run(); }, runs ? 4500 : 350);
  }
  async function run() {
    var my = ++gen, L = window.CIHANG_LAB; busy = true; runs++; roomDone = false;
    for (var w = 0; w < 25 && !pinsShown(); w++) { await sleep(100); if (my !== gen) return; }
    put(rel(stage, 0.8, 0.8), 0);
    g.classList.add('is-on');
    await sleep(280); if (my !== gen) return;
    // 1 · a room: glide to its pin and click it — CIHANG drives there
    if (!root.classList.contains('has-sent') || runs > 1) {
      var st = L.state || {};
      for (var i = 0; i < ROOMS.length; i++) {
        var id = ROOMS[(i + runs - 1) % ROOMS.length];
        if (id === st.dest) continue;
        var pin = root.querySelector('.lab__pin[data-room="' + id + '"] circle:not(.lab__pin-pulse)');
        if (!pin) continue;
        var p = rel(pin, 0.5, 0.5); if (!p.ok) continue;
        put(p, 950); await sleep(1020); if (my !== gen) return;
        g.classList.add('is-press'); flash('is-click');
        await sleep(160); if (my !== gen) return;
        g.classList.remove('is-press');
        var res = L.send(id);
        roomDone = true;
        if (res === 'already') continue;
        await sleep(1500); if (my !== gen) return;
        break;
      }
    }
    roomDone = true;
    // 2 · the Manual switch: glide there and keep pointing (rings + small taps in the air), no click
    var mb = manualBtn();
    if (mb && !root.classList.contains('is-driven')) {
      put(rel(mb, 0.6, 0.62), 1000); await sleep(1060); if (my !== gen) return;
      g.classList.add('is-hint');
      await sleep(3300); if (my !== gen) return;
      g.classList.remove('is-hint');
    }
    g.classList.remove('is-on');
    await sleep(320); if (my !== gen) return;
    busy = false; maybe();
  }
  function stopForGood(e) { if (e && e.isTrusted === false) return; off = true; clearTimeout(startT); startT = 0; abort(); hide(); }
  root.addEventListener('pointerdown', stopForGood, true);
  root.addEventListener('keydown', stopForGood, true);
  if ('MutationObserver' in window) new MutationObserver(function () {
    if (root.classList.contains('is-driven') || window.CIHANG_LAB.mode !== 'send') { if (busy) abort(); return; }
    maybe();
  }).observe(root, { attributes: true, attributeFilter: ['class'] });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { inView = e.intersectionRatio >= 0.5; if (!inView) { clearTimeout(startT); startT = 0; abort(); } else maybe(); });
    }, { threshold: [0, 0.5, 1] }).observe(stage);
  }
  window.addEventListener('resize', function () { if (busy) abort(); maybe(); });
})();
