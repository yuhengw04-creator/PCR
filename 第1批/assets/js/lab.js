/* CIHANG — the Autonomy demo: one plan, three ways. The point cloud (scan.js) builds the floor plan while you
   scroll; then the same plan is used two ways on one SVG: "Send it" — tap a room (or tell the app, app.js) and
   the chair drives there along the hallway graph; "Drive it" — a joystick game on the very same plan, with the
   traced walls and furniture as the collision set and a chase camera.
   Coordinates are the plan's viewBox, 1791 × 1180, about 100 units per metre.
   Public API for app.js: window.CIHANG_LAB = { send(roomId, intro), stop(), setMode(m), mode, state }, and
   'cihang:lab' events on the root ({ type: driving | changing | already | arrived | docked | stopped | idle, ... }). */
(function () {
  'use strict';
  var root = document.getElementById('lab-scan'), P = window.CIHANG_PLAN;
  if (!root || !P) return;
  function $(id) { return document.getElementById(id); }
  var sticky = $('lab-sticky'), stage = $('lab-stage'), svg = $('lab-svg'), flash = $('lab-flash'), toast = $('lab-toast');
  var sendBox = $('lab-send'), driveBox = $('lab-drive'), roomList = $('lab-roomlist');
  var joy = $('lab-joy'), knob = $('lab-joy-knob'), shade = $('lab-joy-shade'), arc = $('lab-joy-arc');
  var ui = {
    target: $('lab-target'), leg: $('lab-leg'), time: $('lab-time'), best: $('lab-best'),
    stops: $('lab-stops'), assists: $('lab-assists'), bumps: $('lab-bumps'),
    status: $('lab-status'), statusText: $('lab-status-text'), reset: $('lab-reset'), assist: $('lab-assist'),
    batt: $('lab-batt'), battPct: $('lab-batt-pct'), range: $('lab-range'), speed: $('lab-speed'), sens: $('lab-sens')
  };
  function emit(type, detail) { detail = detail || {}; detail.type = type; try { root.dispatchEvent(new CustomEvent('cihang:lab', { detail: detail })); } catch (e) {} }
  var NS = 'http://www.w3.org/2000/svg';
  function L10N(k, f) { return window.I18N ? window.I18N.t(k, f) : f; }
  function L10NF(k, f, v) { if (window.I18N && window.I18N.f) return window.I18N.f(k, f, v); var s = f; for (var n in v) s = s.split('{' + n + '}').join(v[n]); return s; }
  function roomName(id) { return L10N('js.roomname.' + id, ROOMS[id].name); }
  function roomLabel(id) { return L10N('js.room.' + id, ROOMS[id].label); }
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PW = P.W, PH = P.H, NODES = P.NODES, HY = P.HY;

  /* ---------- The plan: graph, rooms, collision set ---------- */
  var EDGES = [
    ['ent', 'wcd'], ['wcd', 'e1'], ['wcd', 'wc'], ['e1', 'lv'], ['lv', 'liv'], ['lv', 'din'], ['din', 'k1'],
    ['k1', 'k2'], ['k1', 'h1'], ['h1', 'dock'],
    ['h1', 'h2'], ['h2', 'b1d'], ['b1d', 'b1a'], ['b1a', 'b1'],
    ['h2', 'hb'], ['hb', 'bth'], ['bth', 'b2'],
    ['hb', 'h3'], ['h3', 'gd'], ['gd', 'g1'],
    ['h3', 'vd'], ['vd', 'v1'], ['v1', 'u1'], ['u1', 'md'], ['md', 'mb'],
    ['u1', 'u2'], ['u2', 'ed'], ['ed', 'ens']
  ];
  // nodes the scan module does not need
  NODES = Object.assign({}, NODES, { wc: [245, 378], bth: [876, 761], b2: [876, 840], ens: [1280, 200] });
  var ROOMS = {
    dock:    { node: 'dock', name: 'Dock',         label: 'the dock' },
    entry:   { node: 'ent',  name: 'Entry',        label: 'the entry' },
    wc:      { node: 'wc',   name: 'Toilet',       label: 'the toilet' },
    kitchen: { node: 'k2',   name: 'Kitchen',      label: 'the kitchen' },
    dining:  { node: 'din',  name: 'Dining',       label: 'the dining table' },
    living:  { node: 'liv',  name: 'Living room',  label: 'the living room' },
    bedroom: { node: 'b1',   name: 'Bedroom',      label: 'the bedroom' },
    ensuite: { node: 'ens',  name: 'Ensuite',      label: 'the ensuite' },
    master:  { node: 'mb',   name: 'Main bedroom', label: 'the main bedroom' },
    bath:    { node: 'b2',   name: 'Bathroom',     label: 'the bathroom' },
    guest:   { node: 'g1',   name: 'Guest room',   label: 'the guest room' }
  };
  var PIN_ORDER = ['entry', 'wc', 'kitchen', 'dining', 'living', 'bedroom', 'ensuite', 'master', 'bath', 'guest'];
  var PIN_POS = { entry: [97, 420], wc: [272, 466], kitchen: [421, 300], dining: [519, 500], living: [561, 760], bedroom: [935, 300], ensuite: [1230, 70], master: [1660, 391], bath: [835, 1010], guest: [1150, 900] };
  var DOCK = NODES.dock;
  // the game: four targets in order, par times from the route lengths
  var GAME = [
    { id: 'kitchen', goal: NODES.k2, par: 9 },
    { id: 'living', goal: NODES.liv, par: 12 },
    { id: 'bedroom', goal: NODES.b1, par: 15 },
    { id: 'dock', goal: DOCK, par: 10 }
  ];
  var GOAL_R = 70;
  var RECTS = P.WALLS.concat(P.WINDOWS, P.FURN.map(function (f) { return [f[0], f[1], f[2], f[3]]; }));
  var CIRCLES = P.ROUND.map(function (c) { return [c[0], c[1], c[2], 'furniture']; });

  /* ---------- Build the SVG ---------- */
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    (parent || world).appendChild(e);
    return e;
  }
  var defs = el('defs', {}, svg);
  function scanGrad(id, rgb) {
    var g = el('radialGradient', { id: id, gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: 190 }, defs);
    el('stop', { offset: '0', 'stop-color': rgb, 'stop-opacity': '.26' }, g);
    el('stop', { offset: '1', 'stop-color': rgb, 'stop-opacity': '0' }, g);
    return g;
  }
  var gradCool = scanGrad('lscan', '#1d1d1f'), gradHot = scanGrad('lscanhot', '#ff9f43');
  var world = el('g', { 'class': 'world', id: 'lab-world' }, svg);
  el('rect', { x: -3000, y: -3000, width: 7800, height: 7200, 'class': 'outside' });
  el('image', { href: 'assets/img/floorplan.webp', x: 0, y: 0, width: PW, height: PH, preserveAspectRatio: 'none', 'class': 'plan-img' });
  var roomsG = svg.querySelector('.lab__rooms'); world.appendChild(roomsG);
  var polys = Array.prototype.slice.call(roomsG.querySelectorAll('.navmap__room'));
  var routeEl = el('polyline', { 'class': 'lab__route', points: '' });
  // dock pad (as in the map demo)
  var dockG = el('g', { 'class': 'lab__dock', transform: 'translate(' + DOCK[0] + ' ' + (DOCK[1] - 26) + ')' });
  el('circle', { 'class': 'dockpad__pulse', r: 22 }, dockG);
  el('rect', { x: -40, y: -14, width: 80, height: 28, rx: 8 }, dockG);
  el('path', { d: 'M-3 -8 L-8 1 L-1 1 L-3 8 L4 -1 L-3 -1 Z' }, dockG);
  // game targets
  var goalEls = {};
  GAME.forEach(function (r) {
    var g = el('g', { 'class': 'target', transform: 'translate(' + r.goal[0] + ' ' + r.goal[1] + ')' });
    el('circle', { r: GOAL_R, 'class': 'goal-zone' }, g);
    el('circle', { r: 26 }, g); el('circle', { r: 40 }, g); el('circle', { r: 54 }, g);
    goalEls[r.id] = g;
  });
  // destination halo (send mode)
  var haloG = el('g', { 'class': 'halo', transform: 'translate(-999 -999)' });
  el('circle', { 'class': 'halo__ring halo__ring--1', r: 60 }, haloG); el('circle', { 'class': 'halo__ring halo__ring--2', r: 60 }, haloG); el('circle', { 'class': 'halo__ring halo__ring--3', r: 60 }, haloG);
  // dynamic layers
  var trailG = el('g', { 'class': 'trail' });
  var TRAIL_N = 34, trailEls = [];
  for (var ti = 0; ti < TRAIL_N; ti++) trailEls.push(el('circle', { r: 3.5, 'class': 'trail__dot', opacity: 0 }, trailG));
  var RAY_ANGLES = [-75, -64, -53, -42, -32, -21, -10, 0, 10, 21, 32, 42, 53, 64, 75];
  var REAR_ANGLES = [140, 160, 180, 200, 220];
  var scanG = el('g', { 'class': 'scan-layer' });
  var fanRear = el('polygon', { 'class': 'scan scan--rear' }, scanG);
  var fanFront = el('polygon', { 'class': 'scan' }, scanG);
  var dotEls = RAY_ANGLES.map(function () { return el('circle', { r: 3.5, 'class': 'dot', opacity: 0 }, scanG); });
  var brakeG = el('g', { 'class': 'brake' });
  var ring = el('circle', { r: 76, 'class': 'sensor-ring' });
  var bot = el('g', { 'class': 'bot' });
  el('image', { href: 'assets/img/chair-top.webp', x: -61.6, y: -34.4, width: 123.2, height: 68.8 }, bot);
  // pins: SVG pills so they can turn with the chase camera and still read upright
  var pinEls = {}, pinList = [];
  PIN_ORDER.forEach(function (id, i) {
    var p = PIN_POS[id], g = el('g', { 'class': 'lab__pin', 'data-room': id, transform: 'translate(' + p[0] + ' ' + p[1] + ')' });
    g.style.setProperty('--d', (0.5 + i * 0.3).toFixed(2) + 's');
    var label = el('text', { x: 30, y: 9, 'class': 'lab__pin-text' }, g); label.textContent = roomName(id);
    var w = label.getComputedTextLength ? 0 : 0;   // measured below, once the SVG is laid out
    var bg = el('rect', { x: -22, y: -22, height: 44, rx: 22, width: 160 }, g); g.insertBefore(bg, label);
    el('circle', { cx: 0, cy: 0, r: 7 }, g);
    pinEls[id] = g; pinList.push({ el: g, id: id, x: p[0], y: p[1], bg: bg, label: label });
  });
  function sizePins() {
    pinList.forEach(function (p) {
      p.label.textContent = roomName(p.id);
      var w = 0; try { w = p.label.getComputedTextLength(); } catch (e) { w = roomName(p.id).length * 13; }
      if (!w) w = roomName(p.id).length * 13;
      var pill = w + 30 + 26;
      p.bg.setAttribute('width', pill.toFixed(0));
      // a pill that would run off the right edge of the plan hangs to the left of its dot instead
      if (p.x - 22 + pill > PW - 12) { p.bg.setAttribute('x', (22 - pill).toFixed(0)); p.label.setAttribute('x', (22 - pill + 26).toFixed(0)); }
      else { p.bg.setAttribute('x', -22); p.label.setAttribute('x', 30); }
    });
  }
  sizePins();

  /* ---------- Room list (panel) ---------- */
  var roomBtns = [];
  PIN_ORDER.forEach(function (id) {
    var b = document.createElement('button'); b.type = 'button'; b.dataset.room = id; b.textContent = roomName(id);
    roomList.appendChild(b); roomBtns.push(b);
  });
  function markRoom(id) {
    pinList.forEach(function (p) { p.el.classList.toggle('is-active', p.id === id); });
    polys.forEach(function (p) { p.classList.toggle('is-active', p.dataset.room === id); });
    roomBtns.forEach(function (b) { b.classList.toggle('is-active', b.dataset.room === id); });
  }

  /* ---------- Shared chair state ---------- */
  var st = { x: DOCK[0], y: DOCK[1], a: 90, v: 0, w: 0, node: 'dock', edge: ['dock', 'dock'], moving: false };
  var mode = 'send';
  function draw() {
    bot.setAttribute('transform', 'translate(' + st.x.toFixed(1) + ' ' + st.y.toFixed(1) + ') rotate(' + st.a.toFixed(1) + ')');
    ring.setAttribute('cx', st.x.toFixed(1)); ring.setAttribute('cy', st.y.toFixed(1));
    var home = Math.hypot(st.x - DOCK[0], st.y - DOCK[1]) < 26 && !st.moving && Math.abs(st.v) < 1;
    dockG.classList.toggle('is-home', home);
  }
  function setStatus(kind, text) {
    if (ui.statusText.textContent === text && st.mode === kind) return;
    st.mode = kind;
    ui.status.className = 'drive__status lab__status' + (kind === 'driving' ? ' is-driving' : kind === 'assist' ? ' is-assist' : (kind === 'stopped' || kind === 'bump' || kind === 'off') ? ' is-stopped' : '');
    ui.statusText.textContent = text;
    if (miniStatus) miniStatus.textContent = text;
  }

  /* ---------- Send it: the map demo's planner ---------- */
  var adj = {};
  function dist(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy); }
  EDGES.forEach(function (e) {
    var a = e[0], b = e[1], d = dist(NODES[a], NODES[b]);
    (adj[a] = adj[a] || []).push({ n: b, d: d });
    (adj[b] = adj[b] || []).push({ n: a, d: d });
  });
  function dijkstra(from) {
    var best = {}, prev = {}, done = {}, open = [from];
    best[from] = 0;
    while (open.length) {
      var cur = null, curD = Infinity;
      for (var i = 0; i < open.length; i++) { if (best[open[i]] < curD) { curD = best[open[i]]; cur = open[i]; } }
      open.splice(open.indexOf(cur), 1); done[cur] = true;
      (adj[cur] || []).forEach(function (nb) {
        if (done[nb.n]) return;
        var nd = curD + nb.d;
        if (best[nb.n] === undefined || nd < best[nb.n]) { best[nb.n] = nd; prev[nb.n] = cur; if (open.indexOf(nb.n) < 0) open.push(nb.n); }
      });
    }
    return { best: best, prev: prev };
  }
  function route(from, to) {
    var r = dijkstra(from);
    if (r.best[to] === undefined) return null;
    var path = [to];
    while (path[0] !== from) path.unshift(r.prev[path[0]]);
    return path;
  }
  var SPEED = 120, CORNER = 28, TURN_RATE = 170;
  function smoothPath(pts) {
    if (pts.length < 3) return pts.slice();
    var out = [pts[0]];
    for (var i = 1; i < pts.length - 1; i++) {
      var p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], d1 = dist(p0, p1), d2 = dist(p1, p2), rr = Math.min(CORNER, d1 / 2, d2 / 2);
      if (rr < 1) { out.push(p1); continue; }
      var A = [p1[0] + (p0[0] - p1[0]) / d1 * rr, p1[1] + (p0[1] - p1[1]) / d1 * rr];
      var B = [p1[0] + (p2[0] - p1[0]) / d2 * rr, p1[1] + (p2[1] - p1[1]) / d2 * rr];
      for (var k = 0; k <= 8; k++) { var t = k / 8, u = 1 - t; out.push([u * u * A[0] + 2 * u * t * p1[0] + t * t * B[0], u * u * A[1] + 2 * u * t * p1[1] + t * t * B[1]]); }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function buildTrack(nodeIds, startPos) {
    var raw = nodeIds.map(function (n) { return NODES[n]; });
    if (startPos && dist(startPos, raw[0]) > 2) raw.unshift(startPos);
    var pts = smoothPath(raw), cum = [0];
    for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
    var marks = [];
    nodeIds.forEach(function (n) {
      var p = NODES[n], best = 0, bd = Infinity;
      for (var i = 0; i < pts.length; i++) { var d = dist(pts[i], p); if (d < bd) { bd = d; best = i; } }
      marks.push({ s: cum[best], node: n });
    });
    return { pts: pts, cum: cum, total: cum[cum.length - 1], marks: marks, nodes: nodeIds };
  }
  function pointAt(track, s) {
    var pts = track.pts, cum = track.cum;
    if (s <= 0) return pts[0];
    if (s >= track.total) return pts[pts.length - 1];
    var lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
    var segLen = cum[hi] - cum[lo] || 1, t = (s - cum[lo]) / segLen;
    return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t];
  }
  function headingAt(track, s) {
    var p0 = pointAt(track, Math.max(0, s - 6)), p1 = pointAt(track, Math.min(track.total, s + 6));
    return Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180 / Math.PI;
  }
  function shortestTurn(from, to) { var d = (to - from) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; }
  function planFrom(pos, currentNode, target) {
    if (currentNode && currentNode !== target) return route(currentNode, target);
    if (currentNode === target) return [target];
    var D = dijkstra(target).best;
    var cands = (st.edge || []).filter(function (n) { return D[n] !== undefined; });
    if (!cands.length || st.free) { cands = []; Object.keys(NODES).forEach(function (n) { if (D[n] !== undefined) cands.push(n); }); }
    var bestN = null, bestC = Infinity;
    cands.forEach(function (n) {
      var d0 = dist(pos, NODES[n]);
      if (d0 > 2 && !segmentClear(pos, NODES[n])) return;   // the first leg is a straight line: it must not cross a wall
      var c = d0 + D[n]; if (c < bestC) { bestC = c; bestN = n; }
    });
    if (!bestN) return null;
    return bestN === target ? [target] : route(bestN, target);
  }
  function segmentClear(a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 1e-6) return true;
    return !rayHit(a[0], a[1], dx / L, dy / L, L);
  }
  function metres(units) { return (units / 100).toFixed(1) + ' m'; }

  /* ---------- Telemetry (the app card): battery drains with distance, charges on the dock ---------- */
  var RANGE_KM = 25, DRAIN_PER_UNIT = 1 / 260, chargeTimer = null;
  st.battery = 92; st.charging = false; st.speed = 0;
  function renderTele() {
    if (!ui.batt) return;
    var b = Math.max(0, Math.min(100, st.battery));
    ui.batt.style.setProperty('--lvl', b.toFixed(0) + '%');
    ui.batt.classList.toggle('is-low', b < 20);
    ui.batt.classList.toggle('is-charging', st.charging);
    ui.battPct.textContent = b.toFixed(0) + '%';
    ui.range.textContent = st.charging ? L10N('js.map.charging', 'Charging') : L10NF('js.map.km_left', '{km} km left', { km: (RANGE_KM * b / 100).toFixed(0) });
    ui.speed.textContent = (st.speed / 100).toFixed(1);
    ui.sens.textContent = st.speed > 1 ? L10N('js.map.scanning', 'Scanning') : L10N('js.map.clear', 'Clear');
  }
  function setCharging(on) {
    if (on && !chargeTimer) {
      st.charging = true;
      chargeTimer = setInterval(function () {
        st.battery = Math.min(100, st.battery + 1);
        if (st.battery >= 100) { clearInterval(chargeTimer); chargeTimer = null; st.charging = false; }
        renderTele();
      }, 1500);
    } else if (!on && chargeTimer) { clearInterval(chargeTimer); chargeTimer = null; }
    if (!on) st.charging = false;
    renderTele();
  }
  function drain(units) { st.battery = Math.max(0, st.battery - units * DRAIN_PER_UNIT); }
  function showHalo(nodeId) {
    var p = NODES[nodeId];
    haloG.setAttribute('transform', 'translate(' + p[0] + ' ' + p[1] + ')');
    haloG.classList.remove('is-on'); void haloG.getBoundingClientRect(); haloG.classList.add('is-on');
  }
  function hideHalo() { haloG.classList.remove('is-on'); }
  var sendRaf = 0, sendLast = 0, teleTick = 0;
  function navigateTo(roomId, intro) {
    if (!ROOMS[roomId]) return null;
    if (mode !== 'send') setMode('send');
    var target = ROOMS[roomId].node;
    if (!st.moving && target === st.node) {
      markRoom(roomId);
      setStatus('idle', roomId === 'dock' ? L10N('js.lab.already_docked', 'Already on the dock.') : L10NF('js.lab.already_at', 'Already at {room}.', { room: roomLabel(roomId) }));
      emit('already', { room: roomId, intro: intro });
      return 'already';
    }
    if (st.moving && roomId === st.dest) return 'same';
    var wasMoving = st.moving;
    var path = planFrom([st.x, st.y], st.moving ? null : st.node, target);
    if (!path) return null;
    setCharging(false);
    st.track = buildTrack(path, [st.x, st.y]);
    st.s = 0; st.dest = roomId; st.moving = true; st.node = null; st.free = false;
    routeEl.setAttribute('points', st.track.pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '));
    showHalo(target);
    svg.classList.add('is-driving');
    markRoom(roomId);
    setStatus('driving', L10NF('js.map.driving_to', 'Driving to {room}', { room: roomLabel(roomId) }) + ' · ' + L10NF('js.map.eta', '{m} · about {s} s', { m: metres(st.track.total), s: Math.max(1, Math.round(st.track.total / SPEED)) }));
    emit(wasMoving ? 'changing' : 'driving', { room: roomId, intro: intro, m: metres(st.track.total), s: Math.max(1, Math.round(st.track.total / SPEED)) });
    sendLast = 0;
    cancelAnimationFrame(sendRaf);
    sendRaf = requestAnimationFrame(tickSend);
    return wasMoving ? 'changing' : 'driving';
  }
  function tickSend(ts) {
    if (!st.moving || mode !== 'send') return;
    if (!sendLast) sendLast = ts;
    var dt = Math.min(0.05, (ts - sendLast) / 1000); sendLast = ts;
    var tr = st.track, want = headingAt(tr, st.s), turn = shortestTurn(st.a, want), maxStep = TURN_RATE * dt;
    st.a += Math.max(-maxStep, Math.min(maxStep, turn));
    var off = Math.abs(turn), v = SPEED * (off > 60 ? 0.22 : off > 25 ? 0.45 : off > 10 ? 0.8 : 1);
    st.s += v * dt; st.speed = v; drain(v * dt);
    if ((teleTick++ & 7) === 0) renderTele();
    var pos = pointAt(tr, st.s);
    st.x = pos[0]; st.y = pos[1];
    for (var mi = tr.marks.length - 1; mi >= 0; mi--) {
      if (st.s >= tr.marks[mi].s) { st.edge = [tr.nodes[mi], tr.nodes[Math.min(mi + 1, tr.nodes.length - 1)]]; break; }
    }
    draw();
    if (st.s >= tr.total) { arriveSend(); return; }
    var remaining = tr.total - st.s;
    ui.statusText.textContent = L10NF('js.map.driving_to', 'Driving to {room}', { room: roomLabel(st.dest) }) + ' · ' + L10NF('js.map.eta', '{m} · about {s} s', { m: metres(remaining), s: Math.max(1, Math.round(remaining / SPEED)) });
    sendRaf = requestAnimationFrame(tickSend);
  }
  function arriveSend() {
    st.moving = false;
    st.node = ROOMS[st.dest].node; st.edge = [st.node, st.node];
    var p = NODES[st.node]; st.x = p[0]; st.y = p[1];
    svg.classList.remove('is-driving');
    routeEl.setAttribute('points', '');
    setTimeout(hideHalo, 900);
    st.speed = 0;
    if (st.dest === 'dock') { st.a = 90; setStatus('idle', L10N('js.lab.docked_msg', 'Docked and charging. Tap another room.')); setCharging(st.battery < 100); emit('docked', { room: 'dock' }); }
    else { setStatus('idle', L10NF('js.lab.arrived_msg', 'Arrived at {room}. Tap another room, or send it back to the dock.', { room: roomLabel(st.dest) })); emit('arrived', { room: st.dest }); }
    renderTele();
    draw();
  }
  // a "stop" from the app (or the Stop chip): halt where it is; the planner can start again from a free position
  function stopNow() {
    if (mode !== 'send') { setMode('send'); }
    if (!st.moving) { emit('idle', {}); return false; }
    stopSend();
    st.speed = 0; renderTele();
    markRoom(null); draw();
    setStatus('stopped', L10N('js.map.stopped', 'Stopped') + ' · ' + L10N('js.map.stopped_detail', 'Tell CIHANG where to go next.'));
    emit('stopped', {});
    return true;
  }
  function stopSend() {
    cancelAnimationFrame(sendRaf);
    if (st.moving) { st.moving = false; st.node = null; st.free = true; }
    svg.classList.remove('is-driving');
    routeEl.setAttribute('points', '');
    hideHalo();
  }
  polys.forEach(function (p) { p.addEventListener('click', function () { navigateTo(p.dataset.room); }); });
  pinList.forEach(function (p) { p.el.addEventListener('click', function () { navigateTo(p.id); }); });
  roomBtns.forEach(function (b) { b.addEventListener('click', function () { navigateTo(b.dataset.room); }); });

  /* ---------- Drive it: the joystick demo's physics on this plan ---------- */
  var VMAX = 130, VREV = 65, ACC = 320, BRAKE = 720, WMAX = 140, ASSIST_RATE = 170, TURN_LAG = 0.06;
  var RAY = 190, R = 33, HALF = 26;
  var input = { x: 0, y: 0, active: false }, keys = {};
  var inView = false, raf = 0, last = 0, trail = [], lastTrail = null;
  var best = loadBest();
  function loadBest() { try { return JSON.parse(localStorage.getItem('cihang.lab.best') || '{}') || {}; } catch (e) { return {}; } }
  function saveBest() { try { localStorage.setItem('cihang.lab.best', JSON.stringify(best)); } catch (e) {} }
  var g = {};   // game state
  function resetGame(keepPos) {
    g = { targetIdx: 0, time: 0, running: false, stops: 0, assists: 0, bumps: 0, releaseV: 0, assistOn: false, assistCool: 0, phase: 'ready', legs: [], total: 0, tStops: 0, tAssists: 0, tBumps: 0 };
    if (!keepPos) { st.x = DOCK[0]; st.y = DOCK[1] + 14; st.a = 90; st.node = 'dock'; st.edge = ['dock', 'dock']; st.free = false; }   // +14: the collision body just clears the wall behind the dock
    st.v = 0; st.w = 0; st.moving = false;
    input.x = 0; input.y = 0; placeKnob(0, 0);
    trail = []; lastTrail = null; trailEls.forEach(function (d) { d.setAttribute('opacity', 0); });
    for (var k in goalEls) goalEls[k].classList.remove('is-on');
    pinList.forEach(function (p) { p.el.classList.remove('is-target'); });
    light(GAME[0].id);
    toast.hidden = true;
    if (cam.chase && !cam.tween) { cam.a = st.a + 90; camera(1); }
    updateHud(); draw(); setStatus('ready', L10N('js.game.ready', 'Ready. Push the knob.'));
  }
  function currentTarget() { return GAME[g.targetIdx]; }
  function light(id) { goalEls[id].classList.add('is-on'); if (pinEls[id]) pinEls[id].classList.add('is-target'); }
  function unlight(id) { goalEls[id].classList.remove('is-on'); if (pinEls[id]) pinEls[id].classList.remove('is-target'); }
  function rad(d) { return d * Math.PI / 180; }
  function rayHit(ox, oy, dx, dy, maxT) {
    var bestH = null, i;
    for (i = 0; i < RECTS.length; i++) {
      var r = RECTS[i], x0 = r[0], y0 = r[1], x1 = r[0] + r[2], y1 = r[1] + r[3], tmin = 0, tmax = maxT, nx = 0, ny = 0;
      if (Math.abs(dx) < 1e-6) { if (ox < x0 || ox > x1) continue; }
      else { var tx1 = (x0 - ox) / dx, tx2 = (x1 - ox) / dx, txn = Math.min(tx1, tx2), txf = Math.max(tx1, tx2); if (txn > tmin) { tmin = txn; nx = dx > 0 ? -1 : 1; ny = 0; } tmax = Math.min(tmax, txf); }
      if (Math.abs(dy) < 1e-6) { if (oy < y0 || oy > y1) continue; }
      else { var ty1 = (y0 - oy) / dy, ty2 = (y1 - oy) / dy, tyn = Math.min(ty1, ty2), tyf = Math.max(ty1, ty2); if (tyn > tmin) { tmin = tyn; nx = 0; ny = dy > 0 ? -1 : 1; } tmax = Math.min(tmax, tyf); }
      if (tmax < tmin || tmin < 0 || tmin > maxT) continue;
      if (!bestH || tmin < bestH.t) bestH = { t: tmin, nx: nx, ny: ny, kind: 'wall' };
    }
    for (i = 0; i < CIRCLES.length; i++) {
      var c = CIRCLES[i], lx = c[0] - ox, ly = c[1] - oy, tca = lx * dx + ly * dy;
      if (tca < 0) continue;
      var d2 = lx * lx + ly * ly - tca * tca; if (d2 > c[2] * c[2]) continue;
      var t = tca - Math.sqrt(c[2] * c[2] - d2); if (t < 0 || t > maxT) continue;
      if (!bestH || t < bestH.t) bestH = { t: t, nx: (ox + dx * t - c[0]) / c[2], ny: (oy + dy * t - c[1]) / c[2], kind: c[3] };
    }
    return bestH;
  }
  function pushOut(cx, cy) {
    var mx = 0, my = 0, i;
    for (i = 0; i < RECTS.length; i++) {
      var r = RECTS[i], px = Math.max(r[0], Math.min(cx + mx, r[0] + r[2])), py = Math.max(r[1], Math.min(cy + my, r[1] + r[3]));
      var dx = (cx + mx) - px, dy = (cy + my) - py, d = Math.sqrt(dx * dx + dy * dy);
      if (d >= R) continue;
      if (d < 1e-6) {
        var l = (cx + mx) - r[0], rr = r[0] + r[2] - (cx + mx), t = (cy + my) - r[1], b = r[1] + r[3] - (cy + my), m = Math.min(l, rr, t, b);
        if (m === l) mx -= l + R; else if (m === rr) mx += rr + R; else if (m === t) my -= t + R; else my += b + R;
      } else { mx += dx / d * (R - d); my += dy / d * (R - d); }
    }
    for (i = 0; i < CIRCLES.length; i++) {
      var c = CIRCLES[i], ex = (cx + mx) - c[0], ey = (cy + my) - c[1], ed = Math.sqrt(ex * ex + ey * ey), need = R + c[2];
      if (ed >= need) continue;
      if (ed < 1e-6) mx += need; else { mx += ex / ed * (need - ed); my += ey / ed * (need - ed); }
    }
    return [mx, my];
  }
  function step(dt) {
    var jx = input.x, jy = input.y;
    var pushing = Math.abs(jx) > 0.06 || Math.abs(jy) > 0.06;
    var sx = Math.abs(jx) < 0.08 ? 0 : (jx < 0 ? -1 : 1) * Math.pow((Math.abs(jx) - 0.08) / 0.92, 1.35);
    var sy = (jy < 0 ? -1 : 1) * Math.pow(Math.abs(jy), 1.25);
    if (pushing && !toast.hidden) advance();
    var assistEnabled = ui.assist.checked;
    var dirx = Math.cos(rad(st.a)), diry = Math.sin(rad(st.a));
    var fx = st.x + dirx * HALF, fy = st.y + diry * HALF, bx = st.x - dirx * HALF, by = st.y - diry * HALF;
    var dfront = RAY, dbrush = RAY, brushL = RAY, brushR = RAY, frontHit = null, leftFree = 0, rightFree = 0, i;
    var pts = fx.toFixed(1) + ',' + fy.toFixed(1);
    for (i = 0; i < RAY_ANGLES.length; i++) {
      var th = RAY_ANGLES[i], an = rad(st.a + th), ca = Math.cos(an), sa = Math.sin(an), h = rayHit(fx, fy, ca, sa, RAY);
      var tt = h ? h.t : RAY, L = tt * Math.cos(rad(th)), lat = tt * Math.abs(Math.sin(rad(th)));
      if (h) {
        if (lat < R - 2) { var dd = Math.max(0, L - Math.sqrt(R * R - lat * lat) - 4); if (dd < dfront) { dfront = dd; frontHit = h; } }
        else if (lat <= R + 10) { if (L < dbrush) dbrush = L; if (th < 0) { if (L < brushL) brushL = L; } else if (L < brushR) brushR = L; }
      }
      if (th < 0) leftFree += tt; else if (th > 0) rightFree += tt;
      var ex = fx + ca * tt, ey = fy + sa * tt;
      pts += ' ' + ex.toFixed(1) + ',' + ey.toFixed(1);
      var dot = dotEls[i];
      if (h) { dot.setAttribute('cx', ex.toFixed(1)); dot.setAttribute('cy', ey.toFixed(1)); dot.setAttribute('opacity', 1); dot.classList.toggle('is-near', tt < 100); }
      else dot.setAttribute('opacity', 0);
    }
    fanFront.setAttribute('points', pts);
    var drear = RAY, rpts = bx.toFixed(1) + ',' + by.toFixed(1);
    for (i = 0; i < REAR_ANGLES.length; i++) {
      var thb = REAR_ANGLES[i] - 180, ab = rad(st.a + REAR_ANGLES[i]), cb = Math.cos(ab), sb = Math.sin(ab), hb = rayHit(bx, by, cb, sb, RAY);
      var tb = hb ? hb.t : RAY, Lb = tb * Math.cos(rad(thb)), latb = tb * Math.abs(Math.sin(rad(thb)));
      if (hb && latb < R - 2) { var db = Math.max(0, Lb - Math.sqrt(R * R - latb * latb) - 4); if (db < drear) drear = db; }
      rpts += ' ' + (bx + cb * tb).toFixed(1) + ',' + (by + sb * tb).toFixed(1);
    }
    fanRear.setAttribute('points', rpts);
    gradCool.setAttribute('cx', fx.toFixed(1)); gradCool.setAttribute('cy', fy.toFixed(1));
    gradHot.setAttribute('cx', fx.toFixed(1)); gradHot.setAttribute('cy', fy.toFixed(1));
    fanFront.classList.toggle('is-near', dfront < 66 || dbrush < 44);
    fanRear.classList.toggle('is-near', drear < 55);

    var target = sy >= 0 ? sy * VMAX : sy * VREV;
    if (assistEnabled) {
      var capF = VMAX * Math.min(1, Math.max(0, (dfront - 6) / 100));
      if (dbrush < 55) capF = Math.min(capF, VMAX * 0.55);
      var capR = VREV * Math.min(1, Math.max(0, (drear - 6) / 90));
      if (target > capF) target = capF;
      if (target < -capR) target = -capR;
    }
    if (pushing) {
      var dv = target - st.v, mx = (Math.abs(target) < Math.abs(st.v) || target * st.v < 0 ? BRAKE * 0.8 : ACC) * dt;
      st.v += Math.max(-mx, Math.min(mx, dv));
      g.releaseV = Math.abs(st.v);
    } else {
      var brake = BRAKE * dt;
      if (Math.abs(st.v) <= brake) {
        if (st.v !== 0) {
          if (g.releaseV > 25) { g.stops++; brakePulse(); setStatus('stopped', L10NF('js.game.released', 'Released — stopped in {s} s.', { s: (g.releaseV / BRAKE).toFixed(1) })); }
          else setStatus('stopped', L10N('js.game.stopped', 'Stopped.'));
        }
        st.v = 0; g.releaseV = 0;
      } else st.v -= Math.sign(st.v) * brake;
    }
    if (pushing) {
      var wmax = WMAX * (1 - 0.35 * Math.min(1, Math.abs(st.v) / VMAX)), wantW = sx * wmax * (sy < -0.05 ? -1 : 1);
      st.w += (wantW - st.w) * Math.min(1, dt / TURN_LAG);
    } else st.w = 0;
    var turn = st.w * dt, assisting = false;
    if (assistEnabled && pushing && jy > 0.1 && frontHit && dfront < 110) {
      var n = [frontHit.nx, frontHit.ny], into = -(dirx * n[0] + diry * n[1]);
      if (into > 0.03) {
        var t1 = [-n[1], n[0]], t2 = [n[1], -n[0]], tan, t1Right = (t1[0] * -diry + t1[1] * dirx) > 0;
        if (into > 0.6 && rightFree > leftFree * 1.2) tan = t1Right ? t1 : t2;
        else if (into > 0.6 && leftFree > rightFree * 1.2) tan = t1Right ? t2 : t1;
        else tan = (dirx * t1[0] + diry * t1[1]) >= (dirx * t2[0] + diry * t2[1]) ? t1 : t2;
        var want = Math.atan2(tan[1], tan[0]) * 180 / Math.PI, delta = ((want - st.a) % 360 + 540) % 360 - 180, rate = ASSIST_RATE * (1 - dfront / 110) * dt;
        turn += Math.max(-rate, Math.min(rate, delta));
        assisting = true;
      }
    }
    if (assistEnabled && pushing && jy > 0.1 && !assisting) {
      var away = (brushL < 50 ? (1 - brushL / 50) : 0) - (brushR < 50 ? (1 - brushR / 50) : 0);
      turn += away * 55 * dt;
    }
    st.a += turn;
    if (assisting && !g.assistOn && g.assistCool <= 0) { g.assists++; g.assistCool = 0.9; }
    g.assistOn = assisting; g.assistCool -= dt;

    dirx = Math.cos(rad(st.a)); diry = Math.sin(rad(st.a));
    st.x += dirx * st.v * dt; st.y += diry * st.v * dt;
    st.speed = Math.abs(st.v); drain(Math.abs(st.v) * dt);
    var disp = 0;
    for (var pass = 0; pass < 2; pass++) {
      var pf = pushOut(st.x + dirx * HALF, st.y + diry * HALF); st.x += pf[0]; st.y += pf[1];
      var pb = pushOut(st.x - dirx * HALF, st.y - diry * HALF); st.x += pb[0]; st.y += pb[1];
      disp += Math.abs(pf[0]) + Math.abs(pf[1]) + Math.abs(pb[0]) + Math.abs(pb[1]);
    }
    if (disp > 0.4) { if (!assistEnabled && Math.abs(st.v) > 40) bump(); else if (Math.abs(st.v) > 20) st.v *= 0.5; }

    if (!reduced && (!lastTrail || Math.hypot(st.x - lastTrail[0], st.y - lastTrail[1]) > 10)) {
      lastTrail = [st.x, st.y]; trail.push(lastTrail); if (trail.length > TRAIL_N) trail.shift();
      for (i = 0; i < TRAIL_N; i++) {
        var p = trail[i], te = trailEls[i];
        if (!p) { te.setAttribute('opacity', 0); continue; }
        te.setAttribute('cx', p[0].toFixed(1)); te.setAttribute('cy', p[1].toFixed(1));
        te.setAttribute('opacity', (0.05 + 0.4 * (i + 1) / trail.length).toFixed(2));
        te.setAttribute('r', (2.5 + 2 * (i + 1) / trail.length).toFixed(1));
      }
    }
    if (pushing && !g.running && g.phase !== 'done') { g.running = true; g.phase = 'driving'; }
    if (g.running) g.time += dt;
    if (pushing && st.mode !== 'bump') {
      var what = frontHit && frontHit.kind === 'furniture' ? L10N('js.game.furniture', 'Furniture') : L10N('js.game.wall', 'Wall');
      if (assisting) setStatus('assist', L10NF('js.game.ahead_steering', '{what} ahead — slowing and steering along it.', { what: what }));
      else if (dfront < 66 && jy > 0.1) setStatus(assistEnabled ? 'assist' : 'off', assistEnabled ? L10NF('js.game.ahead_slowing', '{what} ahead — slowing down.', { what: what }) : L10NF('js.game.ahead_off', '{what} ahead — assist is off.', { what: what }));
      else setStatus('driving', L10NF('js.game.driving', 'Driving {v} m/s', { v: (Math.abs(st.v) / 100).toFixed(1) }));
    }
    ring.classList.toggle('is-on', assisting || (dfront < 66 && jy > 0.1));
    var goal = currentTarget().goal, gd = Math.hypot(st.x - goal[0], st.y - goal[1]);
    if (g.phase === 'driving' && gd < GOAL_R && Math.abs(st.v) < 6 && !pushing) arrive();
  }
  function bump() {
    st.v = 0; g.bumps++; g.releaseV = 0;
    setStatus('bump', L10N('js.game.bump', 'Bump! Wall assist would have caught that.'));
    if (!reduced) {
      stage.classList.remove('is-bump'); void stage.offsetWidth; stage.classList.add('is-bump');
      flash.classList.remove('is-on'); void flash.offsetWidth; flash.classList.add('is-on');
    }
    try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) {}
    clearTimeout(bump.t); bump.t = setTimeout(function () { if (st.mode === 'bump') st.mode = ''; }, 1400);
  }
  function brakePulse() {
    if (reduced) return;
    brakeG.setAttribute('transform', 'translate(' + st.x.toFixed(1) + ' ' + st.y.toFixed(1) + ')');
    while (brakeG.firstChild) brakeG.removeChild(brakeG.firstChild);
    el('circle', { r: 46, 'class': 'brake__ring' }, brakeG);
  }
  function stars(t, par) { return t <= par ? 3 : t <= par * 1.7 ? 2 : 1; }
  function starHtml(n, of) {
    var s = '<span class="drive__stars" aria-label="' + L10NF('js.game.stars_of', '{n} of {of} stars', { n: n, of: of }) + '">';
    for (var i = 0; i < of; i++) s += '<i' + (i < n ? ' class="is-on"' : '') + '></i>';
    return s + '</span>';
  }
  function plural(n, key, w) { var f = L10N('js.game.' + key, w); var parts = f.split('|'); return (n === 1 ? parts[0] : parts[parts.length - 1]).replace('{n}', n); }
  function arrive() {
    g.running = false;
    var r = currentTarget(), t = Math.round(g.time * 10) / 10, s = stars(t, r.par), lastOne = g.targetIdx >= GAME.length - 1;
    var newBest = !(best[r.id] > 0) || t < best[r.id];
    if (newBest) { best[r.id] = t; saveBest(); }
    g.legs.push(s); g.total += t; g.tStops += g.stops; g.tAssists += g.assists; g.tBumps += g.bumps;
    g.phase = lastOne ? 'done' : 'arrived';
    var html;
    if (!lastOne) {
      html = '<strong>' + L10NF('js.game.leg_done', '{room} in {t} s.', { room: roomName(r.id), t: t.toFixed(1) }) + '</strong>' + starHtml(s, 3) +
        '<span>' + L10NF('js.game.par', 'Par {par} s', { par: r.par }) + ' · ' + plural(g.stops, 'release_stops', '{n} release stop|{n} release stops') + ' · ' + plural(g.assists, 'wall_assists', '{n} wall assist|{n} wall assists') + (g.bumps ? ' · ' + plural(g.bumps, 'bumps', '{n} bump|{n} bumps') : '') + (newBest ? ' · ' + L10N('js.game.new_best', 'New best') : '') + '</span>' +
        '<button type="button" class="btn btn--primary" id="lab-next">' + L10NF('js.game.next', 'Next: {room}', { room: GAME[g.targetIdx + 1].id === 'dock' ? L10N('js.game.back_to_the_dock', 'back to the dock') : roomName(GAME[g.targetIdx + 1].id) }) + '</button><small>' + L10N('js.game.or_push', 'or just push the knob') + '</small>';
    } else {
      var sum = g.legs.reduce(function (a, b) { return a + b; }, 0), loopBest = !(best.loop > 0) || g.total < best.loop;
      if (loopBest) { best.loop = Math.round(g.total * 10) / 10; saveBest(); }
      html = '<strong>' + L10NF('js.game.loop_done', 'Back on the dock. {t} s.', { t: g.total.toFixed(1) }) + '</strong>' + starHtml(sum, 12).replace('drive__stars', 'drive__stars drive__stars--loop') +
        '<span>' + L10NF('js.game.stars_of', '{n} of {of} stars', { n: sum, of: 12 }) + ' · ' + plural(g.tStops, 'stops', '{n} stop|{n} stops') + ' · ' + plural(g.tAssists, 'assists', '{n} assist|{n} assists') + ' · ' + plural(g.tBumps, 'bumps', '{n} bump|{n} bumps') + (loopBest ? ' · ' + L10N('js.game.best_loop', 'Best loop') : '') + '</span>' +
        '<div class="drive__toast-actions"><button type="button" class="btn btn--primary" id="lab-next">' + L10N('js.game.drive_again', 'Drive again') + '</button>' + (ui.assist.checked ? '<button type="button" class="btn btn--ghost" id="lab-hard">' + L10N('js.game.again_off', 'Again, assist off') + '</button>' : '') + '</div>';
    }
    toast.innerHTML = html; toast.hidden = false;
    setStatus('stopped', lastOne ? L10N('js.game.loop_complete', 'Loop complete.') : L10N('js.game.arrived', 'Arrived. Next room is lit.'));
    $('lab-next').addEventListener('click', function () { advance(); joy.focus({ preventScroll: true }); });
    var hard = $('lab-hard');
    if (hard) hard.addEventListener('click', function () { ui.assist.checked = false; resetGame(false); joy.focus({ preventScroll: true }); });
    if (!lastOne) { unlight(r.id); light(GAME[g.targetIdx + 1].id); }
    updateHud();
  }
  function advance() {
    toast.hidden = true;
    if (g.phase === 'done') { resetGame(false); return; }
    if (g.phase !== 'arrived') return;
    unlight(GAME[g.targetIdx].id);
    g.targetIdx++; g.time = 0; g.stops = 0; g.assists = 0; g.bumps = 0; g.running = false; g.phase = 'ready';
    light(GAME[g.targetIdx].id);
    updateHud(); setStatus('ready', L10N('js.game.next_lit', 'Next target lit. Push the knob.'));
  }
  function updateHud() {
    renderTele();
    var r = currentTarget();
    ui.target.textContent = roomName(r.id);
    ui.leg.textContent = (g.targetIdx + 1) + ' / ' + GAME.length;
    ui.time.textContent = g.time.toFixed(1) + ' s';
    ui.best.textContent = best[r.id] > 0 ? L10NF('js.game.best', 'Best {t} s', { t: best[r.id].toFixed(1) }) + ' · ' + L10NF('js.game.par', 'Par {par} s', { par: r.par }) : L10NF('js.game.par', 'Par {par} s', { par: r.par });
    ui.stops.textContent = g.stops; ui.assists.textContent = g.assists; ui.bumps.textContent = g.bumps;
    if (miniTarget) { miniTarget.textContent = roomName(r.id) + ' · ' + (g.targetIdx + 1) + '/' + GAME.length; miniTime.textContent = g.time.toFixed(1) + ' s · ' + L10NF('js.game.par', 'Par {par} s', { par: r.par }).toLowerCase(); }
  }
  var miniTarget = $('lab-mini-target'), miniTime = $('lab-mini-time'), miniStatus = $('lab-mini-status');

  /* ---------- Camera ----------
     One model for both modes: the world is drawn as translate(cx cy) rotate(-a) translate(-fx -fy) inside a W×H
     viewBox. "Send it" looks at the whole plan (W×H = the plan, a = 0, focus = centre → identity), "Drive it" is the
     chase view (a tall window, the chair at 66 % height, pointing up). Switching modes tweens between the two, so the
     view zooms in onto the chair where it stands, or pulls back out to the plan, instead of cutting. */
  var phoneMq = window.matchMedia('(max-width: 700px)');
  var joyHome = joy.parentNode, joyNext = joy.nextSibling;
  var plan = svg.parentNode;
  var cam = { chase: false, W: PW, H: PH, cx: PW / 2, cy: PH / 2, fx: PW / 2, fy: PH / 2, a: 0, phone: false, tween: 0 };
  var tweenSeq = 0;
  function fullView() { return { W: PW, H: PH, cx: PW / 2, cy: PH / 2, fx: PW / 2, fy: PH / 2, a: 0 }; }
  function chaseView() { var w = cam.phone ? 900 : 1300, h = cam.phone ? 1125 : 780; return { W: w, H: h, cx: w / 2, cy: h * 0.66, fx: st.x, fy: st.y, a: st.a + 90 }; }
  function applyCam() {
    svg.setAttribute('viewBox', '0 0 ' + cam.W.toFixed(1) + ' ' + cam.H.toFixed(1));
    if (!cam.chase && !cam.tween) {
      world.setAttribute('transform', '');
      for (var j = 0; j < pinList.length; j++) pinList[j].el.setAttribute('transform', 'translate(' + pinList[j].x + ' ' + pinList[j].y + ')');
      return;
    }
    world.setAttribute('transform', 'translate(' + cam.cx.toFixed(1) + ' ' + cam.cy.toFixed(1) + ') rotate(' + (-cam.a).toFixed(2) + ') translate(' + (-cam.fx).toFixed(1) + ' ' + (-cam.fy).toFixed(1) + ')');
    for (var i = 0; i < pinList.length; i++) { var L = pinList[i]; L.el.setAttribute('transform', 'translate(' + L.x + ' ' + L.y + ') rotate(' + cam.a.toFixed(2) + ')'); }
  }
  function setCam(v) { cam.W = v.W; cam.H = v.H; cam.cx = v.cx; cam.cy = v.cy; cam.fx = v.fx; cam.fy = v.fy; cam.a = v.a; applyCam(); }
  function ease(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  // tween the camera (and, on phones, the plan box's aspect ratio) to the other mode's view
  function tweenCam(chase, done) {
    var from = cam.chase || cam.tween ? { W: cam.W, H: cam.H, cx: cam.cx, cy: cam.cy, fx: cam.fx, fy: cam.fy, a: cam.a } : fullView();
    var r0 = null, r1 = null;
    if (cam.phone) { r0 = chase ? PW / PH : 0.8; r1 = chase ? 0.8 : PW / PH; plan.style.aspectRatio = r0.toFixed(4) + ' / 1'; }
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    cam.chase = false;
    var id = ++tweenSeq, t0 = null, dur = 850;
    cam.tween = id;
    function frame(ts) {
      if (cam.tween !== id) return;
      if (!t0) t0 = ts;
      var u = Math.min(1, (ts - t0) / dur), e = ease(u);
      // zooming in: move onto the chair first, then turn to its heading; zooming out: turn back first, then pull away
      var ea = ease(Math.max(0, Math.min(1, chase ? (u - 0.3) / 0.7 : u / 0.7)));
      var to = chase ? chaseView() : fullView();
      var da = ((to.a - from.a) % 360 + 540) % 360 - 180;
      cam.W = from.W + (to.W - from.W) * e; cam.H = from.H + (to.H - from.H) * e;
      cam.cx = from.cx + (to.cx - from.cx) * e; cam.cy = from.cy + (to.cy - from.cy) * e;
      cam.fx = from.fx + (to.fx - from.fx) * e; cam.fy = from.fy + (to.fy - from.fy) * e;
      cam.a = from.a + da * ea;
      if (r0 !== null) plan.style.aspectRatio = (r0 + (r1 - r0) * e).toFixed(4) + ' / 1';
      applyCam();
      if (u < 1) { requestAnimationFrame(frame); return; }
      cam.tween = 0; cam.chase = chase;
      plan.style.aspectRatio = '';
      if (chase) { setCam(chaseView()); }
      else { svg.setAttribute('preserveAspectRatio', 'none'); setCam(fullView()); }
      if (done) done();
    }
    requestAnimationFrame(frame);
  }
  function layout(animate) {
    var phone = phoneMq.matches;
    cam.phone = phone;
    if (mode === 'drive' && phone && joy.parentNode !== stage) stage.appendChild(joy);
    else if ((mode !== 'drive' || !phone) && joy.parentNode !== joyHome) joyHome.insertBefore(joy, joyNext);
    var chase = mode === 'drive';
    placeKnob(input.x, input.y);
    if (animate && chase !== cam.chase) return true;   // the caller starts the tween
    cam.tween = 0; cam.chase = chase;
    plan.style.aspectRatio = '';
    svg.setAttribute('preserveAspectRatio', chase ? 'xMidYMid slice' : 'none');
    setCam(chase ? chaseView() : fullView());
    return false;
  }
  if (phoneMq.addEventListener) phoneMq.addEventListener('change', function () { layout(false); }); else phoneMq.addListener(function () { layout(false); });
  /* Keep the demo vertically centred in the viewport while it is pinned (desktop: the sticky grid of plan + panel);
     scan.js reads the sticky's computed top, so its scroll progress follows. Phones pin the stage itself, near full-screen. */
  var tabletMq = window.matchMedia('(max-width: 820px)');
  // v41: the phone beside the plan keeps a real handset's proportions (iPhone body ≈ 0.478 wide : 1 tall) and is
  // sized with the plan so the pair fits the viewport: solve pairH from the sticky width (plan 1.518 : 1 + phone
  // 0.478 : 1 + gap), clamp the phone to 280–360 px, then give the plan whatever width is left. --phone-w and
  // --plan-h feed the grid column, the phone's height and the stage's max-width in the stylesheet.
  var PHONE_R = 0.478, PLAN_R = 1791 / 1180;
  function centerSticky() {
    if (tabletMq.matches) { sticky.style.top = ''; sticky.style.removeProperty('--plan-h'); sticky.style.removeProperty('--phone-w'); return; }
    var navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64;
    var W = sticky.clientWidth, gap = parseFloat(getComputedStyle(sticky).columnGap) || 24;
    var avail = window.innerHeight - navH - 72;
    var target = Math.min((W - gap) / (PLAN_R + PHONE_R), avail);
    var pw = Math.max(280, Math.min(360, PHONE_R * target));
    var planH = Math.max(320, Math.min((W - pw - gap) / PLAN_R, avail));
    sticky.style.setProperty('--phone-w', Math.round(pw) + 'px');
    sticky.style.setProperty('--plan-h', Math.round(planH) + 'px');
    var top = Math.max(navH + 16, Math.round(navH + (window.innerHeight - navH - sticky.offsetHeight) / 2));
    sticky.style.top = top + 'px';
  }
  window.addEventListener('resize', centerSticky);
  if ('ResizeObserver' in window) new ResizeObserver(centerSticky).observe(sticky);
  centerSticky();
  function camera(dt) {
    if (!cam.chase || cam.tween) return;
    var want = st.a + 90, delta = ((want - cam.a) % 360 + 540) % 360 - 180;
    cam.a += delta * (1 - Math.exp(-7 * (dt || 0.016)));
    cam.fx = st.x; cam.fy = st.y;
    applyCam();
  }
  var hudTick = 0;
  function loop(ts) {
    if (!inView || mode !== 'drive') { raf = 0; return; }
    if (!last) last = ts;
    var dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    if (!input.active) {
      var kx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), ky = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
      input.x = kx ? input.x + Math.max(-6 * dt, Math.min(6 * dt, kx - input.x)) : 0;
      input.y = ky ? input.y + Math.max(-6 * dt, Math.min(6 * dt, ky - input.y)) : 0;
      placeKnob(input.x, input.y);
    }
    step(dt); camera(dt); draw();
    if ((hudTick++ & 3) === 0) updateHud();
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf && mode === 'drive' && !cam.tween) { last = 0; raf = requestAnimationFrame(loop); } }

  /* ---------- Joystick input ---------- */
  function placeKnob(x, y) {
    var RADIUS = (joy.clientWidth || 196) * 0.315, mag = Math.min(1, Math.hypot(x, y));
    knob.style.transform = 'translate(' + (x * RADIUS).toFixed(1) + 'px, ' + (-y * RADIUS).toFixed(1) + 'px) scale(' + (1 + mag * 0.06).toFixed(3) + ')';
    shade.style.transform = 'translate(' + (x * RADIUS * 0.55).toFixed(1) + 'px, ' + (-y * RADIUS * 0.55 + 6 + mag * 6).toFixed(1) + 'px) scale(' + (1 + mag * 0.25).toFixed(2) + ')';
    shade.style.opacity = (0.35 + mag * 0.3).toFixed(2);
    var ang = mag > 0.02 ? Math.atan2(x, y) * 180 / Math.PI : 0;
    arc.style.setProperty('--ang', ang.toFixed(1) + 'deg');
    arc.style.opacity = (mag * 0.9).toFixed(2);
  }
  function setFromPointer(e) {
    var r = joy.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy), max = r.width * 0.31;
    if (d > max) { dx *= max / d; dy *= max / d; }
    input.x = dx / max; input.y = -dy / max;
    placeKnob(input.x, input.y);
  }
  joy.addEventListener('pointerdown', function (e) { e.preventDefault(); joy.setPointerCapture(e.pointerId); input.active = true; joy.classList.add('is-active'); setFromPointer(e); start(); });
  joy.addEventListener('pointermove', function (e) { if (input.active) setFromPointer(e); });
  function release(e) {
    if (!input.active) return;
    input.active = false; joy.classList.remove('is-active'); input.x = 0; input.y = 0; placeKnob(0, 0);
    try { joy.releasePointerCapture(e.pointerId); } catch (err) {}
  }
  joy.addEventListener('pointerup', release); joy.addEventListener('pointercancel', release); joy.addEventListener('lostpointercapture', release);
  var KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  window.addEventListener('keydown', function (e) {
    var k = KEYMAP[e.code]; if (!k || !inView || mode !== 'drive') return;
    var tg = e.target, tn = tg && tg.tagName;
    if (tn === 'TEXTAREA' || tn === 'SELECT' || (tn === 'INPUT' && !/^(checkbox|radio|button|submit)$/.test(tg.type))) return;
    e.preventDefault(); keys[k] = true; start();
  });
  window.addEventListener('keyup', function (e) { var k = KEYMAP[e.code]; if (k) keys[k] = false; });
  window.addEventListener('blur', function () { keys = {}; });
  ui.reset.addEventListener('click', function () { resetGame(false); joy.focus({ preventScroll: true }); });
  ui.assist.addEventListener('change', function () {
    root.classList.toggle('is-noassist', !ui.assist.checked);
    joy.focus({ preventScroll: true });
    setStatus(ui.assist.checked ? 'ready' : 'off', ui.assist.checked ? L10N('js.game.assist_on', 'Wall assist on.') : L10N('js.game.assist_off', 'Wall assist off — walls will bump.'));
  });

  /* ---------- Modes ---------- */
  var modeBtns = Array.prototype.slice.call(root.querySelectorAll('.lab__mode'));
  function setMode(m) {
    if (m === mode) return;
    stage.classList.toggle('is-drive', m === 'drive');
    if (m === 'drive') {
      stopSend();
      mode = 'drive';
      root.classList.add('is-driven');   // v40: the "Drive it" nudge stops once the joystick has been tried
      svg.classList.add('is-drive');
      sendBox.hidden = true; driveBox.hidden = false;
      markRoom(null);
      var anim = layout(true);
      resetGame(true);
      if (anim) { stage.classList.add('is-zooming'); tweenCam(true, function () { stage.classList.remove('is-zooming'); start(); }); } else start();   // zoom in onto the chair where it stands, then hand over the knob
    } else {
      mode = 'send';
      keys = {}; input.x = 0; input.y = 0; placeKnob(0, 0);
      st.v = 0; st.w = 0; toast.hidden = true;
      for (var k in goalEls) goalEls[k].classList.remove('is-on');
      pinList.forEach(function (p) { p.el.classList.remove('is-target'); });
      fanFront.setAttribute('points', ''); fanRear.setAttribute('points', ''); dotEls.forEach(function (d) { d.setAttribute('opacity', 0); }); ring.classList.remove('is-on');
      svg.classList.remove('is-drive');
      sendBox.hidden = false; driveBox.hidden = true;
      // where are we? on a node if close to one, otherwise free (the planner picks the best node to join)
      st.node = null; st.free = true;
      for (var n in NODES) { if (dist([st.x, st.y], NODES[n]) < 30) { st.node = n; st.edge = [n, n]; st.free = false; break; } }
      if (layout(true)) tweenCam(false);   // pull back out to the whole plan
      draw();
      setStatus('idle', st.node === 'dock' ? L10N('js.lab.docked', 'Docked. Tap a room.') : L10N('js.lab.tap_room', 'Tap a room and CIHANG drives there.'));
    }
    modeBtns.forEach(function (b) { var on = b.dataset.mode === mode; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
  }
  modeBtns.forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); if (mode === 'drive') joy.focus({ preventScroll: true }); }); });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { inView = e.isIntersecting; if (inView) start(); else keys = {}; });
    }, { threshold: 0.3 });
    io.observe(stage);
  } else { inView = true; }

  root.__state = function () { return { inView: inView, mode: mode, raf: raf, keys: keys, phone: cam.phone }; };
  window.CIHANG_LAB = { send: navigateTo, stop: stopNow, setMode: setMode, get mode() { return mode; }, get state() { return st; }, roomLabel: roomLabel, root: root };
  layout();
  draw();
  resetGame(false); mode = 'send'; driveBox.hidden = true; sendBox.hidden = false; toast.hidden = true;
  for (var k0 in goalEls) goalEls[k0].classList.remove('is-on');
  pinList.forEach(function (p) { p.el.classList.remove('is-target'); });
  layout();
  setStatus('idle', L10N('js.lab.docked', 'Docked. Tap a room.'));
  setCharging(true);
  if (reduced) trailG.style.display = 'none';
  window.addEventListener('load', sizePins);
  window.addEventListener('cihang:lang', function () {
    sizePins();
    roomBtns.forEach(function (b) { b.textContent = b.dataset.room === 'dock' ? L10N('js.lab.back_to_dock', 'Back to dock') : roomName(b.dataset.room); });
    updateHud();
    if (mode === 'send' && !st.moving) setStatus('idle', st.node === 'dock' ? L10N('js.lab.docked', 'Docked. Tap a room.') : L10N('js.lab.tap_room', 'Tap a room and CIHANG drives there.'));
  });
})();
