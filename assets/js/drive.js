/* CIHANG — joystick demo. Drive the chair yourself in a small flat.
   Release the knob and it brakes to a stop; near walls it slows down and
   steers along them (the "assist"). Coordinates: 100 units = 1 m. */
(function () {
  'use strict';
  var root = document.getElementById('drive');
  if (!root) return;
  var svg = document.getElementById('drive-svg');
  var joy = document.getElementById('joy');
  var knob = document.getElementById('joy-knob');
  var toast = document.getElementById('drive-toast');
  var targetEl = document.getElementById('drive-target');
  var timeEl = document.getElementById('drive-time');
  var stopsEl = document.getElementById('drive-stops');
  var assistsEl = document.getElementById('drive-assists');
  var statusEl = document.getElementById('drive-status');
  var statusText = document.getElementById('drive-status-text');
  var resetBtn = document.getElementById('drive-reset');
  var NS = 'http://www.w3.org/2000/svg';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- The flat ---------- */
  var T = 16;
  var WALLS = [
    [0, 0, 1200, T], [0, 720 - T, 1200, T], [0, 0, T, 720], [1200 - T, 0, T, 720],
    // wall A (living | kitchen + hall) with two doors
    [512, T, T, 94], [512, 240, T, 190], [512, 570, T, 134],
    // wall B (kitchen | hall + bedroom) with a door
    [528, 300, 62, T], [720, 300, 464, T],
    // wall C (hall | bedroom) with a door
    [752, 316, T, 114], [752, 570, T, 134]
  ];
  var FURN = [
    { r: [40, 30, 340, 50], cls: 'furn furn--wood' },        // TV bench
    { r: [30, 330, 100, 220], cls: 'furn furn--soft' },      // armchair / side seat
    { r: [30, 590, 330, 90], cls: 'furn furn--soft' },       // sofa
    { r: [190, 360, 150, 100], cls: 'furn furn--wood' },     // coffee table
    { r: [544, 30, 620, 60], cls: 'furn' },                  // kitchen counter
    { r: [760, 140, 200, 60], cls: 'furn' },                 // island
    { r: [930, 400, 240, 250], cls: 'furn furn--soft' },     // bed
    { r: [930, 340, 60, 50], cls: 'furn furn--wood' }        // nightstand
  ];
  var OBST = WALLS.concat(FURN.map(function (f) { return f.r; }));
  var ROOMS = [
    { id: 'living', label: 'Living room', lx: 264, ly: 300, goal: [300, 520] },
    { id: 'kitchen', label: 'Kitchen', lx: 856, ly: 260, goal: [1060, 250] },
    { id: 'bedroom', label: 'Bedroom', lx: 850, ly: 350, goal: [850, 600] },
    { id: 'dock', label: 'the dock', lx: 640, ly: 350, goal: [640, 640] }
  ];
  var ORDER = ['kitchen', 'living', 'bedroom', 'dock'];
  var DOCK = [640, 640];
  var GOAL_R = 58;

  /* ---------- Build the SVG ---------- */
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(e);
    return e;
  }
  el('rect', { x: 0, y: 0, width: 1200, height: 720, 'class': 'floor' });
  el('rect', { x: 528, y: 316, width: 224, height: 388, 'class': 'room-floor' });     // hall
  el('rect', { x: 60, y: 300, width: 400, height: 260, rx: 10, 'class': 'rug' });     // living rug
  el('rect', { x: 800, y: 380, width: 360, height: 300, rx: 10, 'class': 'rug' });    // bedroom rug
  FURN.forEach(function (f) { el('rect', { x: f.r[0], y: f.r[1], width: f.r[2], height: f.r[3], rx: 8, 'class': f.cls }); });
  WALLS.forEach(function (w) { el('rect', { x: w[0], y: w[1], width: w[2], height: w[3], 'class': 'wall' }); });
  ROOMS.forEach(function (r) {
    if (r.id === 'dock') return;
    var t = el('text', { x: r.lx, y: r.ly, 'class': 'label', 'text-anchor': 'middle' }); t.textContent = r.label;
  });
  el('rect', { x: DOCK[0] - 30, y: DOCK[1] + 44, width: 60, height: 14, rx: 5, 'class': 'dock' });
  el('rect', { x: DOCK[0] - 6, y: DOCK[1] + 48, width: 12, height: 6, rx: 2, 'class': 'dock-bolt' });
  var goalEls = {};
  ROOMS.forEach(function (r) {
    var g = el('g', { 'class': 'target', transform: 'translate(' + r.goal[0] + ' ' + r.goal[1] + ')' });
    el('circle', { r: GOAL_R, 'class': 'goal-zone' }, g);
    el('circle', { r: 22 }, g); el('circle', { r: 34 }, g); el('circle', { r: 46 }, g);
    goalEls[r.id] = g;
  });
  var rayEls = [], rearEls = [];
  var RAY_ANGLES = [-70, -45, -22, 0, 22, 45, 70];
  var REAR_ANGLES = [145, 180, 215];
  var rayGroup = el('g', {});
  RAY_ANGLES.forEach(function () { rayEls.push(el('line', { 'class': 'ray' }, rayGroup)); });
  REAR_ANGLES.forEach(function () { rearEls.push(el('line', { 'class': 'ray' }, rayGroup)); });
  var ring = el('circle', { r: 66, 'class': 'sensor-ring' });
  var bot = el('g', {});
  el('image', { href: 'assets/img/chair-top.webp', x: -55, y: -30.8, width: 110, height: 61.6 }, bot);

  /* ---------- State ---------- */
  var VMAX = 130, VREV = 65, ACC = 260, BRAKE = 720, WMAX = 130, ASSIST_RATE = 170;
  var RAY = 170, R = 30, HALF = 22;
  var st = {};
  var input = { x: 0, y: 0, active: false };
  var keys = {};
  var inView = false, raf = 0, last = 0;

  function reset() {
    st = { x: DOCK[0], y: DOCK[1], a: -90, v: 0, targetIdx: 0, time: 0, running: false, stops: 0, assists: 0, releaseV: 0, assistOn: false, assistCool: 0, done: false, mode: 'ready' };
    input.x = 0; input.y = 0;
    for (var k in goalEls) goalEls[k].classList.remove('is-on');
    goalEls[ORDER[0]].classList.add('is-on');
    toast.hidden = true;
    updateHud(); draw(); setStatus('ready', 'Ready. Push the knob.');
  }
  function roomById(id) { for (var i = 0; i < ROOMS.length; i++) if (ROOMS[i].id === id) return ROOMS[i]; }
  function currentTarget() { return roomById(ORDER[st.targetIdx]); }

  /* ---------- Geometry ---------- */
  function rad(d) { return d * Math.PI / 180; }
  function rayHit(ox, oy, dx, dy, maxT) {
    // nearest axis-aligned rectangle along the ray; returns {t, nx, ny} or null
    var best = null;
    for (var i = 0; i < OBST.length; i++) {
      var r = OBST[i], x0 = r[0], y0 = r[1], x1 = r[0] + r[2], y1 = r[1] + r[3];
      var tmin = 0, tmax = maxT, nx = 0, ny = 0;
      if (Math.abs(dx) < 1e-6) { if (ox < x0 || ox > x1) continue; }
      else {
        var tx1 = (x0 - ox) / dx, tx2 = (x1 - ox) / dx, txn = Math.min(tx1, tx2), txf = Math.max(tx1, tx2);
        if (txn > tmin) { tmin = txn; nx = dx > 0 ? -1 : 1; ny = 0; }
        tmax = Math.min(tmax, txf);
      }
      if (Math.abs(dy) < 1e-6) { if (oy < y0 || oy > y1) continue; }
      else {
        var ty1 = (y0 - oy) / dy, ty2 = (y1 - oy) / dy, tyn = Math.min(ty1, ty2), tyf = Math.max(ty1, ty2);
        if (tyn > tmin) { tmin = tyn; nx = 0; ny = dy > 0 ? -1 : 1; }
        tmax = Math.min(tmax, tyf);
      }
      if (tmax < tmin || tmin < 0 || tmin > maxT) continue;
      if (!best || tmin < best.t) best = { t: tmin, nx: nx, ny: ny };
    }
    return best;
  }
  function pushOut(cx, cy) {
    // move a circle of radius R out of any rectangle it overlaps; returns [dx, dy]
    var mx = 0, my = 0;
    for (var i = 0; i < OBST.length; i++) {
      var r = OBST[i];
      var px = Math.max(r[0], Math.min(cx + mx, r[0] + r[2]));
      var py = Math.max(r[1], Math.min(cy + my, r[1] + r[3]));
      var dx = (cx + mx) - px, dy = (cy + my) - py, d = Math.sqrt(dx * dx + dy * dy);
      if (d >= R) continue;
      if (d < 1e-6) { // centre inside the rect: push along the shortest axis
        var l = (cx + mx) - r[0], rr = r[0] + r[2] - (cx + mx), t = (cy + my) - r[1], b = r[1] + r[3] - (cy + my);
        var m = Math.min(l, rr, t, b);
        if (m === l) mx -= l + R; else if (m === rr) mx += rr + R; else if (m === t) my -= t + R; else my += b + R;
      } else { mx += dx / d * (R - d); my += dy / d * (R - d); }
    }
    return [mx, my];
  }

  /* ---------- Simulation ---------- */
  function step(dt) {
    var jx = input.x, jy = input.y;
    var pushing = Math.abs(jx) > 0.06 || Math.abs(jy) > 0.06;
    var dirx = Math.cos(rad(st.a)), diry = Math.sin(rad(st.a));
    var fx = st.x + dirx * HALF, fy = st.y + diry * HALF;   // front axle
    var bx = st.x - dirx * HALF, by = st.y - diry * HALF;   // rear axle

    // sensors
    // dfront: what is straight ahead (rays within 22 deg) — drives the assist and the speed cap.
    // dside: the 45 deg rays only matter when something is right there (door jambs, table corners).
    var dfront = RAY, dside = RAY, frontHit = null;
    for (var i = 0; i < RAY_ANGLES.length; i++) {
      var an = rad(st.a + RAY_ANGLES[i]), h = rayHit(fx, fy, Math.cos(an), Math.sin(an), RAY);
      var d = h ? Math.max(0, h.t - R) : RAY;
      var aa = Math.abs(RAY_ANGLES[i]);
      if (aa <= 22 && d < dfront) { dfront = d; frontHit = h; }
      else if (aa <= 45 && d < dside) dside = d;
      rayEls[i].setAttribute('x1', fx); rayEls[i].setAttribute('y1', fy);
      var tt = h ? h.t : RAY;
      rayEls[i].setAttribute('x2', fx + Math.cos(an) * tt); rayEls[i].setAttribute('y2', fy + Math.sin(an) * tt);
      rayEls[i].classList.toggle('is-near', d < 70);
    }
    var drear = RAY;
    for (var j = 0; j < REAR_ANGLES.length; j++) {
      var ab = rad(st.a + REAR_ANGLES[j]), hb = rayHit(bx, by, Math.cos(ab), Math.sin(ab), RAY);
      var db = hb ? Math.max(0, hb.t - R) : RAY;
      if (db < drear) drear = db;
      rearEls[j].setAttribute('x1', bx); rearEls[j].setAttribute('y1', by);
      var tb = hb ? hb.t : RAY;
      rearEls[j].setAttribute('x2', bx + Math.cos(ab) * tb); rearEls[j].setAttribute('y2', by + Math.sin(ab) * tb);
      rearEls[j].classList.toggle('is-near', db < 70);
    }

    // speed: joystick sets the target, the assist caps it near walls, release brakes hard
    var target = jy >= 0 ? jy * VMAX : jy * VREV;
    var capF = VMAX * Math.min(1, Math.max(0, (dfront - 10) / 95));
    if (dside < 40) capF = Math.min(capF, VMAX * Math.max(0.25, dside / 40));
    var capR = VREV * Math.min(1, Math.max(0, (drear - 10) / 80));
    if (target > capF) target = capF;
    if (target < -capR) target = -capR;
    if (pushing) {
      var dv = target - st.v, mx = ACC * dt;
      st.v += Math.max(-mx, Math.min(mx, dv));
      st.releaseV = Math.abs(st.v);           // remembered for the moment the knob is let go
    } else {
      var brake = BRAKE * dt;
      if (Math.abs(st.v) <= brake) {
        if (st.v !== 0) {
          if (st.releaseV > 25) { st.stops++; setStatus('stopped', 'Released \u2014 stopped in ' + (st.releaseV / BRAKE).toFixed(1) + ' s.'); }
          else setStatus('stopped', 'Stopped.');
        }
        st.v = 0; st.releaseV = 0;
      } else st.v -= Math.sign(st.v) * brake;
    }

    // steering: joystick turns the body; the assist bends it parallel to a wall ahead
    var turn = jx * WMAX * dt;
    var assisting = false;
    if (pushing && jy > 0.1 && frontHit && dfront < 100) {
      var n = [frontHit.nx, frontHit.ny];
      var into = -(dirx * n[0] + diry * n[1]);      // >0 when heading into the wall
      if (into > 0.12) {
        var t1 = [-n[1], n[0]], t2 = [n[1], -n[0]];
        var tan = (dirx * t1[0] + diry * t1[1]) >= (dirx * t2[0] + diry * t2[1]) ? t1 : t2;
        var want = Math.atan2(tan[1], tan[0]) * 180 / Math.PI;
        var delta = ((want - st.a) % 360 + 540) % 360 - 180;
        var rate = ASSIST_RATE * (1 - dfront / 100) * dt;
        turn += Math.max(-rate, Math.min(rate, delta));
        assisting = true;
      }
    }
    st.a += turn;
    if (assisting && !st.assistOn && st.assistCool <= 0) { st.assists++; st.assistCool = 0.9; }
    st.assistOn = assisting;
    st.assistCool -= dt;

    // move + resolve overlaps for both axles
    dirx = Math.cos(rad(st.a)); diry = Math.sin(rad(st.a));
    st.x += dirx * st.v * dt; st.y += diry * st.v * dt;
    for (var pass = 0; pass < 2; pass++) {
      var pf = pushOut(st.x + dirx * HALF, st.y + diry * HALF);
      st.x += pf[0]; st.y += pf[1];
      var pb = pushOut(st.x - dirx * HALF, st.y - diry * HALF);
      st.x += pb[0]; st.y += pb[1];
      if ((pf[0] || pf[1] || pb[0] || pb[1]) && Math.abs(st.v) > 20) st.v *= 0.5;
    }

    // clock + status
    if (pushing && !st.running && !st.done) { st.running = true; }
    if (st.running) st.time += dt;
    if (pushing) {
      if (assisting) setStatus('assist', 'Wall ahead — slowing and steering along it.');
      else if (dfront < 60 && jy > 0.1) setStatus('assist', 'Wall ahead — slowing down.');
      else setStatus('driving', 'Driving ' + (Math.abs(st.v) / 100).toFixed(1) + ' m/s');
    }
    ring.classList.toggle('is-on', assisting || (dfront < 60 && jy > 0.1));

    // goal
    var g = currentTarget().goal, gd = Math.hypot(st.x - g[0], st.y - g[1]);
    if (!st.done && gd < GOAL_R && Math.abs(st.v) < 6 && !pushing && st.running) arrive();
  }

  function arrive() {
    st.running = false;
    var r = currentTarget();
    var lastOne = st.targetIdx >= ORDER.length - 1;
    var t = st.time.toFixed(1);
    toast.innerHTML = '<strong>' + (r.id === 'dock' ? 'Back on the dock.' : 'Arrived at the ' + r.label.toLowerCase() + '.') + '</strong>' +
      '<span>' + t + ' s · ' + st.stops + ' release stop' + (st.stops === 1 ? '' : 's') + ' · ' + st.assists + ' wall assist' + (st.assists === 1 ? '' : 's') + '</span>' +
      '<button type="button" class="btn btn--primary" id="drive-next">' + (lastOne ? 'Drive again' : 'Next: ' + roomById(ORDER[st.targetIdx + 1]).label.replace('the dock', 'back to the dock')) + '</button>';
    toast.hidden = false;
    setStatus('stopped', 'Arrived.');
    document.getElementById('drive-next').addEventListener('click', function () {
      toast.hidden = true;
      if (lastOne) { reset(); return; }
      goalEls[ORDER[st.targetIdx]].classList.remove('is-on');
      st.targetIdx++; st.time = 0; st.stops = 0; st.assists = 0; st.running = false;
      goalEls[ORDER[st.targetIdx]].classList.add('is-on');
      updateHud(); setStatus('ready', 'Next target lit. Push the knob.');
      joy.focus({ preventScroll: true });
    });
    updateHud();
  }

  function setStatus(mode, text) {
    if (st.mode === mode && statusText.textContent === text) return;
    st.mode = mode;
    statusEl.className = 'drive__status' + (mode === 'driving' ? ' is-driving' : mode === 'assist' ? ' is-assist' : mode === 'stopped' ? ' is-stopped' : '');
    statusText.textContent = text;
  }
  function updateHud() {
    var r = currentTarget();
    targetEl.textContent = r.id === 'dock' ? 'Dock' : r.label;
    timeEl.textContent = st.time.toFixed(1) + ' s';
    stopsEl.textContent = st.stops;
    assistsEl.textContent = st.assists;
  }
  function draw() {
    bot.setAttribute('transform', 'translate(' + st.x.toFixed(1) + ' ' + st.y.toFixed(1) + ') rotate(' + st.a.toFixed(1) + ')');
    ring.setAttribute('cx', st.x.toFixed(1)); ring.setAttribute('cy', st.y.toFixed(1));
  }
  var hudTick = 0;
  function loop(ts) {
    if (!inView) { raf = 0; return; }
    if (!last) last = ts;
    var dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    // keyboard ramps toward its target so it feels like a stick, not a switch
    if (!input.active) {
      var kx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), ky = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
      // ramp up like a stick being pushed; let go and it snaps back at once (that is the whole point)
      input.x = kx ? input.x + Math.max(-6 * dt, Math.min(6 * dt, kx - input.x)) : 0;
      input.y = ky ? input.y + Math.max(-6 * dt, Math.min(6 * dt, ky - input.y)) : 0;
      placeKnob(input.x, input.y);
    }
    step(dt); draw();
    if ((hudTick++ & 3) === 0) updateHud();
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }

  /* ---------- Joystick input ---------- */
  var RADIUS = 58;
  function placeKnob(x, y) {
    knob.style.transform = 'translate(' + (x * RADIUS).toFixed(1) + 'px, ' + (-y * RADIUS).toFixed(1) + 'px)';
  }
  function setFromPointer(e) {
    var r = joy.getBoundingClientRect();
    var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    var d = Math.hypot(dx, dy), max = r.width * 0.29;
    if (d > max) { dx *= max / d; dy *= max / d; }
    input.x = dx / max; input.y = -dy / max;
    placeKnob(input.x, input.y);
  }
  joy.addEventListener('pointerdown', function (e) {
    e.preventDefault(); joy.setPointerCapture(e.pointerId);
    input.active = true; joy.classList.add('is-active'); setFromPointer(e); start();
  });
  joy.addEventListener('pointermove', function (e) { if (input.active) setFromPointer(e); });
  function release(e) {
    if (!input.active) return;
    input.active = false; joy.classList.remove('is-active');
    input.x = 0; input.y = 0; placeKnob(0, 0);
    try { joy.releasePointerCapture(e.pointerId); } catch (err) {}
  }
  joy.addEventListener('pointerup', release);
  joy.addEventListener('pointercancel', release);
  joy.addEventListener('lostpointercapture', release);

  var KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  window.addEventListener('keydown', function (e) {
    var k = KEYMAP[e.code]; if (!k || !inView) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    e.preventDefault(); keys[k] = true; start();
  });
  window.addEventListener('keyup', function (e) { var k = KEYMAP[e.code]; if (k) keys[k] = false; });
  window.addEventListener('blur', function () { keys = {}; });

  resetBtn.addEventListener('click', function () { reset(); joy.focus({ preventScroll: true }); });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { inView = e.isIntersecting; if (inView) start(); else { keys = {}; } });
    }, { threshold: 0.35 });
    io.observe(root);
  } else { inView = true; start(); }

  reset();
  if (reduced) { rayGroup.style.display = 'none'; }
})();
