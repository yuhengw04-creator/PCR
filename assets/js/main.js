/* CIHANG — site behaviour. No dependencies. */
(function () {
  'use strict';

  var root = document.documentElement;
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  if (video && soundBtn && playBtn) {
    soundBtn.addEventListener('click', function () {
      video.muted = !video.muted;
      soundBtn.setAttribute('aria-pressed', video.muted ? 'false' : 'true');
      soundBtn.setAttribute('aria-label', video.muted ? 'Turn sound on' : 'Turn sound off');
      if (!video.muted && video.paused) video.play();
    });
    playBtn.addEventListener('click', function () {
      if (video.paused) video.play(); else video.pause();
    });
    function syncPlay() {
      playBtn.setAttribute('aria-pressed', video.paused ? 'false' : 'true');
      playBtn.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video');
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
          if (e.isIntersecting) { if (!userPaused && video.paused) video.play().catch(function () {}); }
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

    // Finish swatches: swap the whole view set (cream / mist / graphite renders).
    var finishBtns = document.querySelectorAll('#buy-finishes .swatch');
    finishBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.classList.contains('is-active')) return;
        finishBtns.forEach(function (x) { x.classList.remove('is-active'); x.setAttribute('aria-pressed', 'false'); });
        b.classList.add('is-active'); b.setAttribute('aria-pressed', 'true');
        var suffix = b.dataset.finish || '';
        thumbList.forEach(function (t) {
          t.dataset.src = 'assets/img/' + t.dataset.base + suffix + '.webp';
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
    var OFFERS = {
      personal: { amount: '$5,999', note: 'Suggested retail price, personal version.', cta: 'Pre-order' },
      shared:   { amount: 'Custom pricing', note: 'Fleet packages for care facilities and rental operators.', cta: 'Talk to sales' }
    };
    versionBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        versionBtns.forEach(function (x) { x.classList.remove('is-active'); x.setAttribute('aria-pressed', 'false'); });
        b.classList.add('is-active'); b.setAttribute('aria-pressed', 'true');
        var o = OFFERS[b.dataset.version] || OFFERS.personal;
        amountEl.textContent = o.amount; noteEl.textContent = o.note; ctaEl.textContent = o.cta;
      });
    });
  }

  /* ---------- No orphans: keep the last three words of a block together ---------- */
  (function widont() {
    var sel = 'p, figcaption, li, dd, dt, summary, .lede, small, .spec__label, .stat__label, .way small, .feature p, .msg';
    document.querySelectorAll(sel).forEach(function (el) {
      if (el.children.length && !el.querySelector('strong, em, b, i, a, span')) return; // complex markup: skip
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      var last = null, n;
      while ((n = walker.nextNode())) { if (n.nodeValue.trim().length) last = n; }
      if (!last) return;
      var words = last.nodeValue.split(' ');
      if (words.length < 4) return;
      // glue the last three words together
      last.nodeValue = words.slice(0, -2).join(' ') + '\u00A0' + words.slice(-2).join('\u00A0');
    });
  })();

  /* ---------- Mobile menu ---------- */
  var nav = document.querySelector('.nav');
  var menuBtn = document.getElementById('menu-toggle');
  if (nav && menuBtn) {
    menuBtn.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    nav.querySelectorAll('.nav__links a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

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

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !prefersReduced) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { ro.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
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
    function preload() {
      if (started) return; started = true;
      for (var i = 0; i < N; i++) {
        var im = new Image(); im.decoding = 'async'; im.src = frameSrc(i); frames.push(im);
        im.addEventListener('load', render);
      }
    }
    function progress() {
      var r = unfold.getBoundingClientRect();
      var total = unfold.offsetHeight - window.innerHeight;
      if (total <= 0) return 1;
      return Math.min(1, Math.max(0, -r.top / total));
    }
    function render() {
      ticking = false;
      var p = prefersReduced ? 1 : progress();
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
      }, { rootMargin: '120% 0px' });
      uo.observe(unfold);
    } else { preload(); }
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
