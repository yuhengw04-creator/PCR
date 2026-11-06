/* CIHANG — visits, counted by us. One "view" when the page opens and one "end" when it
   is left, carrying how far down the page the reader got and how long they stayed.
   No cookie, no identifier that survives the tab, no third party. The backend stores
   the address only as a salted daily hash, so repeat visits can be counted but nobody
   can be traced. If the backend is unreachable the page never notices. */
(function () {
  'use strict';
  var API = String(window.CIHANG_API || '').replace(/\/+$/, '');
  /* the page's own reading order — the backend charts the furthest one reached */
  var SECTIONS = ['top', 'buy', 'autonomy', 'perception', 'fold', 'design', 'voice', 'people', 'specs', 'faq', 'contact', 'closing'];
  var sid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  var best = 0, depth = 0, t0 = Date.now(), ended = false;

  /* text/plain keeps this a "simple" request: no CORS preflight, and sendBeacon
     is allowed to use it. The backend reads the body as JSON either way. */
  function post(o, onExit) {
    var body;
    try { body = JSON.stringify(o); } catch (e) { return; }
    var url = API + '/api/hit';
    try {
      if (onExit && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
        return;
      }
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: body, keepalive: true })['catch'](function () {});
    } catch (e) {}
  }

  function send(o) { o.s = sid; post(o, false); }
  window.CIHANG_STAT = { send: send };

  function device() {
    var w = window.innerWidth || 1024;
    return w < 700 ? 'phone' : (w < 1024 ? 'tablet' : 'desktop');
  }
  function lang() {
    if (window.I18N && I18N.lang) return I18N.lang;
    return (document.documentElement.lang || 'en').slice(0, 2);
  }

  send({
    t: 'view', p: location.pathname, lang: lang(), ref: document.referrer,
    w: window.innerWidth, dev: device(), tz: -new Date().getTimezoneOffset()
  });

  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        var k = SECTIONS.indexOf(entries[i].target.id);
        if (k > best) best = k;
      }
    }, { threshold: 0.35 });
    for (var i = 1; i < SECTIONS.length; i++) {
      var el = document.getElementById(SECTIONS[i]);
      if (el) io.observe(el);
    }
  }

  function onScroll() {
    var h = Math.max(document.body.scrollHeight || 0, document.documentElement.scrollHeight || 0);
    var p = Math.round(((window.pageYOffset || 0) + (window.innerHeight || 0)) / (h || 1) * 100);
    if (p > depth) depth = p > 100 ? 100 : p;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function end() {
    if (ended) return;
    ended = true;
    post({ t: 'end', s: sid, sec: SECTIONS[best], d: depth, dw: Math.round((Date.now() - t0) / 1000) }, true);
  }
  window.addEventListener('pagehide', end);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') end();
  });
})();
