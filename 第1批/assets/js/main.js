/* CIHANG — site behaviour. No dependencies. */
(function () {
  'use strict';

  var root = document.documentElement;
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Reveal on scroll ----------
     First, before anything that could fail on an older browser: sections start at opacity 0 and are shown as they
     come into view, so this must always run. Safety net: whatever happens, everything is shown after 3 s. */
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  /* Numbers count up from 0 the first time their block is revealed (stat rows, spec tiles). Only plain values animate:
     an optional sign or "<" in front, digits, then a unit — "5 s", "510 mm", "−42%", "<200 ms", "0°"; "1st drive",
     "IP54", "2 + 2" and "1044 × 587 mm" are left alone. A language switch mid-count just shows the final text. */
  var counters = [];
  function countUp(el) {
    if (prefersReduced || el.__counted) return; el.__counted = true;
    var text = el.textContent, mm = /^([<>~≈]?[−\-+]?)(\d+)([^\d]*)$/.exec(text);
    if (!mm || /^[A-Za-z]/.test(mm[3])) return;
    var prefix = mm[1], target = parseInt(mm[2], 10), suffix = mm[3], t0 = null, dur = 1100 + Math.min(600, target);
    var job = { el: el, done: false };
    counters.push(job);
    function frame(ts) {
      if (job.done) return;
      if (t0 === null) t0 = ts;
      var u = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - u, 3);
      el.textContent = prefix + Math.round(target * e) + suffix;
      if (u < 1) requestAnimationFrame(frame); else { job.done = true; el.textContent = text; }
    }
    el.textContent = prefix + '0' + suffix;
    requestAnimationFrame(frame);
  }
  function markIn(el) {
    el.classList.add('in');
    var nums = el.querySelectorAll('.stat__num, .spec__num');
    for (var ni = 0; ni < nums.length; ni++) countUp(nums[ni]);
  }
  document.addEventListener('cihang:lang', function () { for (var ci = 0; ci < counters.length; ci++) counters[ci].done = true; });
  function revealAll() { for (var ri = 0; ri < reveals.length; ri++) markIn(reveals[ri]); }
  // belt and braces: whatever the observer does, anything on screen is shown (checked on load and on scroll)
  function sweepReveals() {
    var vh = window.innerHeight || 800;
    for (var ri = 0; ri < reveals.length; ri++) {
      var el = reveals[ri]; if (el.classList.contains('in')) continue;
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) markIn(el);
    }
  }
  if ('IntersectionObserver' in window && !prefersReduced) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { markIn(e.target); ro.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { ro.observe(el); });
    var sweepTick = false;
    window.addEventListener('scroll', function () { if (!sweepTick) { sweepTick = true; setTimeout(function () { sweepTick = false; sweepReveals(); }, 250); } }, { passive: true });
    setTimeout(sweepReveals, 1200); setTimeout(sweepReveals, 3000);
  } else {
    revealAll();
  }

  /* ---------- Theme toggle ---------- */
  var themeBtn = document.getElementById('theme-toggle');
  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('cihang-theme', next); } catch (e) {}
    });
  }

  /* ---------- Hero video ---------- */
  var video = document.getElementById('hero-video');
  var soundBtn = document.getElementById('video-sound');
  var playBtn = document.getElementById('video-play');
  function L10N(k, f) { return window.I18N ? window.I18N.t(k, f) : f; }
  if (video && soundBtn && playBtn) {
    soundBtn.addEventListener('click', function () {
      video.muted = !video.muted;
      soundBtn.setAttribute('aria-pressed', video.muted ? 'false' : 'true');
      soundBtn.setAttribute('aria-label', video.muted ? L10N('js.video.sound_on', 'Turn sound on') : L10N('js.video.sound_off', 'Turn sound off'));
      if (!video.muted && video.paused) video.play();
    });
    playBtn.addEventListener('click', function () {
      if (video.paused) video.play(); else video.pause();
    });
    function syncPlay() {
      playBtn.setAttribute('aria-pressed', video.paused ? 'false' : 'true');
      playBtn.setAttribute('aria-label', video.paused ? L10N('js.video.play', 'Play video') : L10N('js.video.pause', 'Pause video'));
    }
    video.addEventListener('play', syncPlay);
    video.addEventListener('pause', syncPlay);
    syncPlay();

    // Progress bar (seekable)
    var seek = document.getElementById('video-seek');
    var timeEl = document.getElementById('video-time');
    function fmt(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2); }
    var scrubbing = false;
    function syncTime() {
      if (!video.duration) return;
      if (!scrubbing) {
        var p = video.currentTime / video.duration;
        seek.value = Math.round(p * 1000);
        seek.style.setProperty('--p', (p * 100).toFixed(2) + '%');
      }
      timeEl.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
    }
    if (seek && timeEl) {
      video.addEventListener('timeupdate', syncTime);
      video.addEventListener('loadedmetadata', syncTime);
      video.addEventListener('durationchange', syncTime);
      seek.addEventListener('input', function () {
        scrubbing = true;
        var p = seek.value / 1000;
        seek.style.setProperty('--p', (p * 100).toFixed(2) + '%');
        if (video.duration) { video.currentTime = p * video.duration; timeEl.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration); }
      });
      seek.addEventListener('change', function () { scrubbing = false; });
      seek.addEventListener('pointerup', function () { scrubbing = false; });
      seek.addEventListener('keyup', function () { scrubbing = false; });
      syncTime();
    }
    // Save bandwidth: pause when scrolled far away, resume when back.
    if ('IntersectionObserver' in window) {
      var userPaused = false;
      playBtn.addEventListener('click', function () { userPaused = video.paused; });
      var vo = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { if (!userPaused && video.paused) { var pr = video.play(); if (pr && pr.catch) pr.catch(function () {}); } }
          else if (!video.paused) { video.pause(); }
        });
      }, { threshold: 0.1 });
      vo.observe(video);
    }
  }

  /* ---------- Film crop: keep the bottom captions, crop from the top ---------- */
  var frame = document.querySelector('.film__frame');
  if (video && frame) {
    var BOTTOM_KEEP = 0.04; // fraction of the frame allowed to be lost at the bottom (rest is cropped from the top)
    function fitFilm() {
      var w = frame.clientWidth, h = frame.clientHeight;
      if (!w || !h || window.innerWidth <= 820) { video.style.objectPosition = ''; return; }
      var excess = 1 - (h / w) / (9 / 16);        // fraction of the 16:9 frame that does not fit
      if (excess <= 0) { video.style.objectPosition = '50% 50%'; return; }
      var p = Math.min(1, Math.max(0.5, 1 - BOTTOM_KEEP / excess));
      video.style.objectPosition = '50% ' + (p * 100).toFixed(1) + '%';
    }
    fitFilm();
    window.addEventListener('resize', fitFilm);
  }

  /* ---------- Buy module ---------- */
  var buyMain = document.getElementById('buy-main');
  var thumbs = document.querySelectorAll('.buy__thumbs button');
  if (buyMain && thumbs.length) {
    var thumbList = Array.prototype.slice.call(thumbs);
    function showThumb(t) {
      if (t.classList.contains('is-active')) return;
      thumbList.forEach(function (x) { x.classList.remove('is-active'); });
      t.classList.add('is-active');
      buyMain.classList.add('is-fading');
      setTimeout(function () {
        buyMain.src = t.dataset.src; buyMain.alt = t.dataset.alt || '';
        var done = function () { buyMain.classList.remove('is-fading'); };
        if (buyMain.complete) done(); else buyMain.addEventListener('load', done, { once: true });
      }, 180);
    }
    // Auto-play: cycle through the views while the gallery is on screen,
    // until the visitor picks a view themselves.
    var galleryTimer = null, galleryTouched = false, galleryInView = false, galleryHover = false;
    var gallery = buyMain.closest('.buy__gallery') || buyMain;
    function nextThumb() {
      var i = thumbList.findIndex(function (x) { return x.classList.contains('is-active'); });
      showThumb(thumbList[(i + 1) % thumbList.length]);
    }
    function stopGallery() { if (galleryTimer) { clearInterval(galleryTimer); galleryTimer = null; } }
    function syncGallery() {
      var run = galleryInView && !galleryHover && !galleryTouched && !prefersReduced && !document.hidden;
      if (run && !galleryTimer) galleryTimer = setInterval(nextThumb, 3600);
      if (!run) stopGallery();
    }
    thumbList.forEach(function (t) {
      t.addEventListener('click', function () { galleryTouched = true; syncGallery(); showThumb(t); });
    });
    gallery.addEventListener('mouseenter', function () { galleryHover = true; syncGallery(); });
    gallery.addEventListener('mouseleave', function () { galleryHover = false; syncGallery(); });
    if ('IntersectionObserver' in window) {
      var go = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { galleryInView = e.isIntersecting; syncGallery(); });
      }, { threshold: 0.4 });
      go.observe(gallery);
    } else {
      galleryInView = true; syncGallery();
    }
    document.addEventListener('visibilitychange', syncGallery);
    // Preload the other views so the crossfade never waits on the network.
    thumbList.forEach(function (t) { var im = new Image(); im.src = t.dataset.src; });

    // Finish swatches: swap the whole view set (cream / navy / titanium renders, same cameras).
    var finishBtns = document.querySelectorAll('#buy-finishes .swatch');
    finishBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.classList.contains('is-active')) return;
        finishBtns.forEach(function (x) { x.classList.remove('is-active'); x.setAttribute('aria-pressed', 'false'); });
        b.classList.add('is-active'); b.setAttribute('aria-pressed', 'true');
        var suffix = b.dataset.finish || '';
        thumbList.forEach(function (t) {
          t.dataset.src = 'assets/img/' + t.dataset.base + suffix + '.webp' + (suffix ? '?r=2' : '');   // r=2: KeyShot renders replaced the recolours
          var im = t.querySelector('img'); if (im) im.src = t.dataset.src;
        });
        var active = thumbList.find(function (x) { return x.classList.contains('is-active'); }) || thumbList[0];
        buyMain.classList.add('is-fading');
        setTimeout(function () {
          buyMain.src = active.dataset.src;
          var done = function () { buyMain.classList.remove('is-fading'); };
          if (buyMain.complete) done(); else buyMain.addEventListener('load', done, { once: true });
        }, 180);
        thumbList.forEach(function (t) { var im = new Image(); im.src = t.dataset.src; });
      });
    });
  }
  var versionBtns = document.querySelectorAll('#buy-versions .opt');
  var amountEl = document.getElementById('buy-amount');
  var noteEl = document.getElementById('buy-note');
  var ctaEl = document.getElementById('buy-cta');
  if (versionBtns.length && amountEl && noteEl && ctaEl) {
    function OFFERS(v) {
      return v === 'shared'
        ? { amount: L10N('js.buy.custom_pricing', 'Custom pricing'), note: L10N('js.buy.shared_note', 'Fleet packages for care facilities and rental operators.'), cta: L10N('js.buy.talk_to_sales', 'Talk to sales'), label: L10N('js.buy.shared', 'Shared') }
        : { amount: '$5,999', note: L10N('js.buy.personal_note', 'Suggested retail price, personal version.'), cta: L10N('js.buy.pre_order', 'Pre-order'), label: L10N('js.buy.personal', 'Personal') };
    }
    function applyOffer() {
      var cur = document.querySelector('#buy-versions .opt.is-active'), o = OFFERS(cur ? cur.dataset.version : 'personal');
      amountEl.textContent = o.amount; noteEl.textContent = o.note; ctaEl.textContent = o.cta;
      if (window.__syncBuyBar) window.__syncBuyBar(o, o.label);
    }
    versionBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        versionBtns.forEach(function (x) { x.classList.remove('is-active'); x.setAttribute('aria-pressed', 'false'); });
        b.classList.add('is-active'); b.setAttribute('aria-pressed', 'true');
        applyOffer();
      });
    });
    window.addEventListener('cihang:lang', applyOffer);
  }

  /* ---------- No orphans: keep the last two words of a block together ----------
     Each text node is glued once per run (a <li> and the <small> inside it share the same last node), the glue is
     undone before it is re-applied, and long pairs (German, French) are left alone so narrow columns never overflow. */
  function widont() {
    var sel = 'p, figcaption, li, dd, dt, summary, .lede, small, .spec__label, .stat__label, .way small, .feature p, .msg';
    var seen = [];
    document.querySelectorAll(sel).forEach(function (el) {
      if (el.children.length && !el.querySelector('strong, em, b, i, a, span')) return; // complex markup: skip
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      var last = null, n;
      while ((n = walker.nextNode())) { if (n.nodeValue.trim().length) last = n; }
      if (!last || seen.indexOf(last) !== -1) return;
      seen.push(last);
      var words = last.nodeValue.replace(/\u00A0/g, ' ').split(' ');
      if (words.length < 4) return;
      var tail = words.slice(-2);
      if (tail.join(' ').length > 22) { last.nodeValue = words.join(' '); return; }
      last.nodeValue = words.slice(0, -2).join(' ') + ' ' + tail.join('\u00A0');
    });
  }
  widont();
  window.addEventListener('cihang:lang', widont);

  /* ---------- Mobile menu ---------- */
  var nav = document.querySelector('.nav');
  var menuBtn = document.getElementById('menu-toggle');
  if (nav && menuBtn) {
    function setMenu(open) {
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', open ? L10N('js.nav.close_menu', 'Close menu') : L10N('js.nav.open_menu', 'Open menu'));
    }
    menuBtn.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
    nav.querySelectorAll('.nav__links a').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('is-open')) setMenu(false); });
    window.addEventListener('resize', function () { if (window.innerWidth > 820 && nav.classList.contains('is-open')) setMenu(false); });
    // second theme switch inside the sheet
    var theme2 = document.getElementById('theme-toggle-2');
    if (theme2 && themeBtn) {
      function labelTheme2() { theme2.textContent = currentTheme() === 'dark' ? L10N('js.nav.light_mode', 'Light mode') : L10N('js.nav.dark_mode', 'Dark mode'); }
      theme2.addEventListener('click', function () { themeBtn.click(); labelTheme2(); });
      themeBtn.addEventListener('click', labelTheme2);
      window.addEventListener('cihang:lang', labelTheme2);
      labelTheme2();
    }
  }

  /* ---------- Sticky buy bar on phones: appears once the price block has scrolled by, hides at the closing ---------- */
  var buybar = document.getElementById('buybar');
  var priceBlock = document.querySelector('.buy__price');
  if (buybar && priceBlock) {
    var endEl = document.querySelector('.closing'), galleryEl = document.querySelector('.buy__main'), barShown = false, barTick = false;
    var demos = [document.getElementById('lab-scan')].filter(Boolean);   // keep the bar out of the way while the demo is playing
    function syncBar() {
      barTick = false;
      var vh = window.innerHeight;
      // once the product picture has scrolled away the bar carries the price, unless the price card itself is on screen
      var pr = priceBlock.getBoundingClientRect(), gal = galleryEl ? galleryEl.getBoundingClientRect() : pr;
      var past = gal.bottom < 0 && !(pr.top < vh && pr.bottom > 0);
      var atEnd = endEl ? endEl.getBoundingClientRect().top < vh * 0.9 : false;
      var inDemo = demos.some(function (d) { var r = d.getBoundingClientRect(); return r.top < vh * 0.55 && r.bottom > vh * 0.75; });
      var show = past && !atEnd && !inDemo && window.innerWidth <= 700 && !document.body.classList.contains('menu-open');
      if (show === barShown) return;
      barShown = show;
      if (show) { buybar.hidden = false; requestAnimationFrame(function () { buybar.classList.add('is-on'); }); }
      else { buybar.classList.remove('is-on'); setTimeout(function () { if (!barShown) buybar.hidden = true; }, 350); }
    }
    function queueBar() { if (!barTick) { barTick = true; requestAnimationFrame(syncBar); } }
    window.addEventListener('scroll', queueBar, { passive: true });
    window.addEventListener('resize', queueBar);
    queueBar();
    var barAmount = document.getElementById('buybar-amount'), barNote = document.getElementById('buybar-note'), barBtn = buybar.querySelector('.btn');
    window.__syncBuyBar = function (o, label) {
      if (barAmount) barAmount.textContent = o.amount;
      if (barNote) barNote.textContent = 'CIHANG \u00b7 ' + label;
      if (barBtn) barBtn.textContent = o.cta;
    };
  }

  /* ---------- Back to top (v45): the wordmark and the closing button point at #top, which is the sticky header itself,
     so the browser had nothing to scroll to — scroll the page explicitly instead ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('a[href="#top"]'), function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      try { window.scrollTo({ top: 0, left: 0, behavior: prefersReduced ? 'auto' : 'smooth' }); } catch (err) { window.scrollTo(0, 0); }
      if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    });
  });

  /* ---------- Nav: highlight the section in view ---------- */
  var navLinks = document.querySelectorAll('.nav__links a[href^="#"]');
  if (navLinks.length && 'IntersectionObserver' in window) {
    var linkFor = {};
    navLinks.forEach(function (a) { linkFor[a.getAttribute('href').slice(1)] = a; });
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.remove('is-active'); });
        var a = linkFor[e.target.id]; if (a) a.classList.add('is-active');
      });
    }, { rootMargin: '-38% 0px -57% 0px', threshold: 0 });
    Object.keys(linkFor).forEach(function (id) { var el = document.getElementById(id); if (el) so.observe(el); });
  }

  /* ---------- Fold demo ---------- */
  var demo = document.getElementById('fold-demo');
  if (demo) {
    var imgs = demo.querySelectorAll('.fold-img');
    var btns = demo.querySelectorAll('.segmented button');
    var heightEl = document.getElementById('fold-height');
    var state = 'unfolded';
    var userTouched = false;
    var timer = null;

    function setState(s) {
      state = s;
      imgs.forEach(function (im) { im.classList.toggle('is-active', im.dataset.state === s); });
      btns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.state === s ? 'true' : 'false'); });
      demo.classList.toggle('is-folded', s === 'folded');
      if (heightEl) heightEl.textContent = s === 'folded' ? '510 mm' : '880 mm';
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        userTouched = true;
        if (timer) { clearInterval(timer); timer = null; }
        setState(b.dataset.state);
      });
    });

    // Auto-demo while in view, until the visitor takes over.
    if ('IntersectionObserver' in window && !prefersReduced) {
      var fo = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (userTouched) return;
          if (e.isIntersecting && !timer) {
            timer = setInterval(function () { setState(state === 'folded' ? 'unfolded' : 'folded'); }, 3200);
          } else if (!e.isIntersecting && timer) {
            clearInterval(timer); timer = null;
          }
        });
      }, { threshold: 0.5 });
      fo.observe(demo);
    }
  }

  /* ---------- Scroll-driven unfold sequence ---------- */
  var unfold = document.getElementById('unfold');
  if (unfold) {
    var N = parseInt(unfold.dataset.frames, 10) || 56;
    var canvas = unfold.querySelector('.unfold__canvas');
    var ctx = canvas.getContext('2d');
    var fillEl = document.getElementById('unfold-fill');
    var heightEl = document.getElementById('unfold-height');
    var frames = [], current = -1, ticking = false, started = false;
    var H0 = 510, H1 = 880;
    function frameSrc(i) { return 'assets/seq/unfold-' + ('0' + (i + 1)).slice(-2) + '.webp'; }
    // Frames load coarse-to-fine (first, last, middle, quarters, …) so the chair already moves in big steps while the
    // rest is still arriving; render() always draws the nearest frame that has loaded. Loading starts right after
    // the page has loaded (or when the section comes near, whichever is first) rather than only on approach.
    function preloadOrder() {
      var order = [], seen = {}, level;
      function add(i) { if (!seen[i]) { seen[i] = true; order.push(i); } }
      add(0); add(N - 1);
      for (level = 2; level < N * 2; level *= 2) for (var k = 1; k < level; k += 2) add(Math.round((N - 1) * k / level));
      for (var i = 0; i < N; i++) add(i);
      return order;
    }
    function preload() {
      if (started) return; started = true;
      for (var i = 0; i < N; i++) frames.push(null);
      var order = preloadOrder(), at = 0, inFlight = 0, LANES = 6;
      function next() {
        while (inFlight < LANES && at < order.length) {
          (function (idx) {
            var im = new Image(); im.decoding = 'async'; frames[idx] = im; inFlight++;
            function done() { inFlight--; render(); next(); }
            im.addEventListener('load', done); im.addEventListener('error', done);
            im.src = frameSrc(idx);
          })(order[at++]);
        }
      }
      next();
    }
    function progress() {
      var r = unfold.getBoundingClientRect();
      var total = unfold.offsetHeight - window.innerHeight;
      if (total <= 0) return 1;
      return Math.min(1, Math.max(0, -r.top / total));
    }
    function render() {
      ticking = false;
      var p = progress();   // scroll-scrubbed by the visitor, so it runs even with reduce-motion on (Windows 'animation effects' off sets it on many PCs)
      var want = Math.round(p * (N - 1));
      unfold.classList.toggle('is-scrolled', p > 0.03);
      if (fillEl) fillEl.style.height = (58 + 42 * p).toFixed(1) + '%';
      if (heightEl) heightEl.textContent = Math.round(H0 + (H1 - H0) * p) + ' mm';
      // draw the nearest frame that has actually loaded, so scrubbing never blanks
      var i = want, best = -1;
      for (var d = 0; d < N; d++) {
        if (want - d >= 0 && frames[want - d] && frames[want - d].complete && frames[want - d].naturalWidth) { best = want - d; break; }
        if (want + d < N && frames[want + d] && frames[want + d].complete && frames[want + d].naturalWidth) { best = want + d; break; }
      }
      if (best < 0 || best === current) return;
      ctx.drawImage(frames[best], 0, 0, canvas.width, canvas.height);
      current = best;
      unfold.classList.add('is-drawn');
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(render); } }
    if ('IntersectionObserver' in window) {
      var uo = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { preload(); uo.disconnect(); } });
      }, { rootMargin: '150% 0px' });
      uo.observe(unfold);
    }
    if (document.readyState === 'complete') setTimeout(preload, 800); else window.addEventListener('load', function () { setTimeout(preload, 800); });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }

  /* ---------- Play-once animations (chat, map) ---------- */
  var players = document.querySelectorAll('#chat');
  if ('IntersectionObserver' in window) {
    var po = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('play'); po.unobserve(e.target); }
      });
    }, { threshold: 0.35 });
    players.forEach(function (el) { po.observe(el); });
  } else {
    players.forEach(function (el) { el.classList.add('play'); });
  }
})();
