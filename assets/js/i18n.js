/* CIHANG — languages. English is written in the page; every other language is a JSON dictionary
   (assets/i18n/<lang>.json) applied over it: elements carry data-i18n (text), data-i18n-html (inner
   markup) or data-i18n-attr="attr:key;…". Scripts ask window.I18N.t(key, fallback) for their own
   strings and refresh on the 'cihang:lang' event. The choice is ?lang=xx → saved → browser language. */
(function () {
  'use strict';
  var LANGS = [['en', 'English'], ['zh', '简体中文'], ['ja', '日本語'], ['ko', '한국어'], ['de', 'Deutsch'], ['es', 'Español'], ['fr', 'Français']];
  var V = '45';                                   // bump with the dictionaries (cache key + query string)
  var dict = {}, lang = 'en', originals = new Map(), ready = false;
  function t(key, fallback) {
    var v = dict[key];
    return (v === undefined || v === null) ? (fallback === undefined ? key : fallback) : v;
  }
  /* f(): t() plus {placeholder} substitution, then the language's own fix-ups from the 'js.fix' key
     ("a=b;c=d" pairs, e.g. German "zu der " → "zur ") so article + preposition read naturally. */
  function f(key, fallback, vars) {
    var s = t(key, fallback);
    if (vars) for (var n in vars) s = s.split('{' + n + '}').join(vars[n]);
    var fix = dict['js.fix'];
    if (fix) {
      var pairs = fix.split(';');
      for (var i = 0; i < pairs.length; i++) { var eq = pairs[i].indexOf('='); if (eq > 0) s = s.split(pairs[i].slice(0, eq)).join(pairs[i].slice(eq + 1)); }
    }
    return s;
  }
  function norm(code) {
    code = String(code || '').toLowerCase();
    var two = code.slice(0, 2);
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i][0] === two) return two;
    return null;
  }
  function detect() {
    var q = /[?&]lang=([a-z]{2})/i.exec(location.search);
    if (q && norm(q[1])) return norm(q[1]);
    try { var s = localStorage.getItem('cihang-lang'); if (s && norm(s)) return norm(s); } catch (e) {}
    var list = navigator.languages || [navigator.language || 'en'];
    for (var i = 0; i < list.length; i++) { var n = norm(list[i]); if (n) return n; }
    return 'en';
  }
  function remember(el, kind, value) {
    var o = originals.get(el); if (!o) { o = {}; originals.set(el, o); }
    if (o[kind] === undefined) o[kind] = value;
    return o[kind];
  }
  function apply() {
    var html = document.documentElement;
    html.lang = lang === 'zh' ? 'zh-CN' : lang;
    html.setAttribute('data-lang', lang);
    var els = document.querySelectorAll('[data-i18n], [data-i18n-html], [data-i18n-attr]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], k = el.getAttribute('data-i18n'), kh = el.getAttribute('data-i18n-html'), ka = el.getAttribute('data-i18n-attr');
      if (k) { var ot = remember(el, 'text', el.textContent); var nt = t(k, ot); if (el.textContent !== nt) el.textContent = nt; }
      if (kh) { var oh = remember(el, 'html', el.innerHTML); var nh = t(kh, oh); if (el.innerHTML !== nh) el.innerHTML = nh; }
      if (ka) {
        var pairs = ka.split(';');
        for (var j = 0; j < pairs.length; j++) {
          var p = pairs[j].split(':'), attr = p[0], key = p[1];
          if (!attr || !key) continue;
          var oa = remember(el, 'attr:' + attr, el.getAttribute(attr) || '');
          el.setAttribute(attr, t(key, oa));
        }
      }
    }
    var code = document.getElementById('lang-code'); if (code) code.textContent = lang.toUpperCase();
    markMenus();
    html.classList.remove('i18n-loading');
    ready = true;
    try { window.dispatchEvent(new CustomEvent('cihang:lang', { detail: { lang: lang } })); } catch (e) {}
  }
  function setLang(l, save) {
    l = norm(l) || 'en'; lang = l;
    if (save !== false) { try { localStorage.setItem('cihang-lang', l); } catch (e) {} }
    if (l === 'en') { dict = {}; apply(); return Promise.resolve(); }
    var cacheKey = 'cihang-i18n-' + l + '-' + V, cached = null;
    try { cached = localStorage.getItem(cacheKey); } catch (e) {}
    if (cached) { try { dict = JSON.parse(cached); apply(); } catch (e) { cached = null; } }
    return fetch('assets/i18n/' + l + '.json?v=' + V, { cache: 'force-cache' }).then(function (r) { return r.json(); }).then(function (d) {
      if (lang !== l) return;
      dict = d; try { localStorage.setItem(cacheKey, JSON.stringify(d)); } catch (e) {}
      apply();
    }).catch(function () { document.documentElement.classList.remove('i18n-loading'); if (!cached) { dict = {}; apply(); } });
  }
  /* ---------- Switcher: a dropdown in the nav, pills in the phone menu sheet ---------- */
  var menu = document.getElementById('lang-menu'), toggle = document.getElementById('lang-toggle'), pills = document.getElementById('lang-pills');
  function markMenus() {
    var items = document.querySelectorAll('[data-lang-pick]');
    for (var i = 0; i < items.length; i++) { var on = items[i].getAttribute('data-lang-pick') === lang; items[i].classList.toggle('is-active', on); items[i].setAttribute('aria-selected', on ? 'true' : 'false'); }
  }
  function build(container, cls) {
    if (!container) return;
    LANGS.forEach(function (l) {
      var b = document.createElement('button'); b.type = 'button'; b.className = cls; b.setAttribute('role', 'option'); b.setAttribute('lang', l[0] === 'zh' ? 'zh-CN' : l[0]);
      b.setAttribute('data-lang-pick', l[0]); b.textContent = l[1];
      b.addEventListener('click', function () { setLang(l[0]); closeMenu(); });
      container.appendChild(b);
    });
  }
  function openMenu() { if (!menu) return; menu.hidden = false; toggle.setAttribute('aria-expanded', 'true'); }
  function closeMenu() { if (!menu) return; menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }
  build(menu, 'lang__item'); build(pills, 'lang__pill');
  if (toggle) {
    toggle.addEventListener('click', function (e) { e.stopPropagation(); if (menu.hidden) openMenu(); else closeMenu(); });
    document.addEventListener('click', function (e) { if (menu && !menu.hidden && !menu.contains(e.target)) closeMenu(); });
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }
  window.I18N = { t: t, f: f, set: setLang, LANGS: LANGS, get lang() { return lang; }, get ready() { return ready; } };
  // safety: never leave the page hidden
  setTimeout(function () { document.documentElement.classList.remove('i18n-loading'); }, 1800);
  setLang(detect(), false);
})();
