/* CIHANG film: the sound prompt as on ElectroGlide (Leo 10/23 19:24 CT "声音提醒和eg一样"; see snd.css).
   main.js still owns the button (a click mutes / unmutes); this only changes how it looks while the film is muted and
   flies "Sound on" in from the middle of the picture the first time the film plays muted. ES5. */
(function () {
  var video = document.getElementById('hero-video'), btn = document.getElementById('video-sound');
  var frame = video && video.closest ? video.closest('.film__frame') : null;
  if (!video || !btn || !frame) return;
  var WORDS = { en: 'Sound on', zh: '打开声音', ja: '音声をオン', ko: '소리 켜기', de: 'Ton an', es: 'Activar sonido', fr: 'Activer le son' };
  var label = document.createElement('span');
  label.className = 'snd-on';
  function words() { var l = document.documentElement.getAttribute('data-lang') || 'en'; label.textContent = WORDS[l] || WORDS.en; }
  words();
  btn.appendChild(label);
  window.addEventListener('cihang:lang', words);

  var shown = false, reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function sync() { btn.classList.toggle('is-snd', shown && video.muted); }
  video.addEventListener('volumechange', sync);

  function fly() {
    var f = frame.getBoundingClientRect(), b = btn.getBoundingClientRect(), v = video.getBoundingClientRect();
    if (!b.width || !v.width) { btn.classList.remove('is-fly'); return; }
    var g = document.createElement('div');
    g.className = 'snd-fly'; g.setAttribute('aria-hidden', 'true');
    g.style.left = (b.left - f.left) + 'px'; g.style.top = (b.top - f.top) + 'px';
    g.style.width = b.width + 'px'; g.style.height = b.height + 'px';
    var icon = btn.querySelector('.ic-muted');
    g.innerHTML = '<span class="snd__x"><span class="snd__y"><span class="snd__pill"></span></span></span>';
    var pill = g.querySelector('.snd__pill');
    if (icon) pill.appendChild(icon.cloneNode(true));
    var t = document.createElement('span'); t.textContent = label.textContent; pill.appendChild(t);
    pill.style.fontSize = getComputedStyle(btn).fontSize;
    function aim() {                                  /* from the button to the middle of the picture */
      var f2 = frame.getBoundingClientRect(), v2 = video.getBoundingClientRect();
      var cx = b.left - f.left + b.width / 2, cy = b.top - f.top + b.height / 2;
      g.style.setProperty('--dx', Math.round(v2.left - f2.left + v2.width / 2 - cx) + 'px');
      g.style.setProperty('--dy', Math.round(v2.top - f2.top + v2.height / 2 - cy) + 'px');
    }
    frame.appendChild(g);
    aim(); g.classList.add('is-mid');
    g.offsetWidth;                                    /* start from the middle, then fade in */
    g.classList.add('is-on');
    setTimeout(function () {
      g.classList.add('is-drop'); g.classList.remove('is-mid');
      setTimeout(function () {
        if (g.parentNode) g.parentNode.removeChild(g);
        btn.classList.remove('is-fly'); btn.classList.add('is-land');
        setTimeout(function () { btn.classList.remove('is-land'); }, 3200);
      }, 950);
    }, 1900);
  }
  function start() {
    if (shown || !video.muted) return;
    shown = true; sync();
    if (reduce) return;
    btn.classList.add('is-fly');
    setTimeout(fly, 450);
  }
  video.addEventListener('play', start);
  if (!video.paused) start();
})();
