/* CIHANG › Structure (v57): keeps the figure on the page's theme and loads the drawing and its live code
   (assets/js/structure-svg.js) when the section comes near. The figures' own strings are in that file and follow
   window.I18N.lang ('cihang:lang'); the headline, lede and Fig 1's label are data-i18n keys (structure.*).
   From the portfolio's inline <script id="structure-js">; _gen/v57/structure_v57.py */
(function () {
  var sec = document.getElementById('structure');
  if (!sec) return;
  var wrap = sec.querySelector('.cx-wrap');
  if (!wrap) return;
  var root = document.documentElement;
  function theme() { wrap.setAttribute('data-theme', root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'); }
  theme();
  try { new MutationObserver(theme).observe(root, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) {}
  var asked = false;
  function load() {
    if (asked) return;
    asked = true;
    var tag = document.createElement('script');
    tag.src = wrap.getAttribute('data-svg');
    tag.async = true;
    document.body.appendChild(tag);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { for (var i = 0; i < es.length; i++) if (es[i].isIntersecting) { load(); io.disconnect(); } }, { rootMargin: '900px 0px' });
    io.observe(wrap);
  } else load();
})();
