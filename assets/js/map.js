/* CIHANG — interactive navigation map.
   Click a room; the chair plans a route through doors and hallways and drives there.
   Coordinates are in the SVG viewBox (1791 x 1180). ~100 units ≈ 1 m. */
(function () {
  'use strict';

  var root = document.getElementById('navmap');
  if (!root) return;

  /* ---------- Waypoint graph (hand-placed on the floor plan) ---------- */
  // Orthogonal network: every edge is horizontal or vertical and runs down the
  // middle of a hallway or through a door, so the chair never cuts across a wall.
  var HY = 672; // main hallway / open-plan centreline (y)
  var NODES = {
    // entry corridor + open living / dining floor
    ent: [100, 250], wcd: [100, 378], wc: [245, 378], e1: [100, HY],
    lv: [400, HY], liv: [400, 890],
    din: [470, HY],
    // kitchen strip between the table and the counter
    k1: [622, HY], k2: [622, 335],
    // hallway spine
    h1: [720, HY], dock: [720, 596],
    h2: [803, HY], b1d: [803, 548], b1a: [803, 430], b1: [990, 430],
    hb: [876, HY], bth: [876, 761], b2: [876, 840],
    h3: [1002, HY], gd: [1002, 761], g1: [1002, 940],
    // door into the east hall, then up to the ensuite / main bedroom
    vd: [1110, HY], v1: [1222, HY], u1: [1222, 430], md: [1340, 430], mb: [1520, 430],
    u2: [1222, 300], ed: [1280, 300], ens: [1280, 200]
  };
  var EDGES = [
    ['ent', 'wcd'], ['wcd', 'e1'], ['wcd', 'wc'], ['e1', 'lv'], ['lv', 'liv'], ['lv', 'din'], ['din', 'k1'],
    ['k1', 'k2'], ['k1', 'h1'], ['h1', 'dock'],
    ['h1', 'h2'], ['h2', 'b1d'], ['b1d', 'b1a'], ['b1a', 'b1'],
    ['h2', 'hb'], ['hb', 'bth'], ['bth', 'b2'],
    ['hb', 'h3'], ['h3', 'gd'], ['gd', 'g1'],
    ['h3', 'vd'], ['vd', 'v1'], ['v1', 'u1'], ['u1', 'md'], ['md', 'mb'],
    ['u1', 'u2'], ['u2', 'ed'], ['ed', 'ens']
  ];
  var ROOMS = {
    dock:    { node: 'dock', label: 'the dock' },
    entry:   { node: 'ent',  label: 'the entry' },
    wc:      { node: 'wc',   label: 'the toilet' },
    kitchen: { node: 'k2',   label: 'the kitchen' },
    dining:  { node: 'din',  label: 'the dining table' },
    living:  { node: 'liv',  label: 'the living room' },
    bedroom: { node: 'b1',   label: 'the bedroom' },
    ensuite: { node: 'ens',  label: 'the ensuite' },
    master:  { node: 'mb',   label: 'the main bedroom' },
    bath:    { node: 'b2',   label: 'the bathroom' },
    guest:   { node: 'g1',   label: 'the guest room' }
  };
  var SPEED = 120;            // units per second (~1.2 m/s on screen)
  var UNITS_PER_M = 100;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) SPEED = 600;

  /* adjacency + Dijkstra */
  var adj = {};
  function dist(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy); }
  EDGES.forEach(function (e) {
    var a = e[0], b = e[1], d = dist(NODES[a], NODES[b]);
    (adj[a] = adj[a] || []).push({ n: b, d: d });
    (adj[b] = adj[b] || []).push({ n: a, d: d });
  });
  function route(from, to) {
    var best = {}, prev = {}, done = {}, open = [from];
    best[from] = 0;
    while (open.length) {
      var cur = null, curD = Infinity;
      for (var i = 0; i < open.length; i++) { if (best[open[i]] < curD) { curD = best[open[i]]; cur = open[i]; } }
      open.splice(open.indexOf(cur), 1);
      if (cur === to) break;
      done[cur] = true;
      (adj[cur] || []).forEach(function (nb) {
        if (done[nb.n]) return;
        var nd = curD + nb.d;
        if (best[nb.n] === undefined || nd < best[nb.n]) {
          best[nb.n] = nd; prev[nb.n] = cur;
          if (open.indexOf(nb.n) < 0) open.push(nb.n);
        }
      });
    }
    if (best[to] === undefined) return null;
    var path = [to];
    while (path[0] !== from) path.unshift(prev[path[0]]);
    return path;
  }

  /* ---------- DOM ---------- */
  var bot = document.getElementById('navmap-bot');
  var routeEl = document.getElementById('navmap-route');
  var haloEl = document.getElementById('navmap-halo');
  var stateEl = document.getElementById('navmap-state');
  var detailEl = document.getElementById('navmap-detail');
  var dotEl = document.getElementById('navmap-dot');
  var homeBtn = document.getElementById('navmap-home');
  var dockEl = document.getElementById('navmap-dock');
  var dockLabel = document.getElementById('navmap-dock-label');
  var logEl = document.getElementById('navmap-log');
  var askForm = document.getElementById('navmap-ask');
  var askInput = document.getElementById('navmap-input');
  var chips = document.getElementById('navmap-chips');
  var battEl = document.getElementById('navmap-batt');
  var battPct = document.getElementById('navmap-batt-pct');
  var rangeEl = document.getElementById('navmap-range');
  var speedEl = document.getElementById('navmap-speed');
  var sensEl = document.getElementById('navmap-sens');
  var pins = root.querySelectorAll('.navmap__pin');
  var polys = root.querySelectorAll('.navmap__room');

  var st = {
    node: 'dock', x: NODES.dock[0], y: NODES.dock[1], angle: 90,
    moving: false, path: null, seg: 0, segT: 0, pending: null, dest: null, raf: 0, last: 0,
    battery: 92, charging: false, speed: 0, track: null, s: 0, edge: ['dock', 'dock']
  };
  var RANGE_KM = 25;              // full-charge range
  var DRAIN_PER_UNIT = 1 / 260;   // % of battery per unit driven (demo pacing)
  var chargeTimer = null;

  function renderTele() {
    if (!battEl) return;
    var b = Math.max(0, Math.min(100, st.battery));
    battEl.style.setProperty('--lvl', b.toFixed(0) + '%');
    battEl.classList.toggle('is-low', b < 20);
    battEl.classList.toggle('is-charging', st.charging);
    battPct.textContent = b.toFixed(0) + '%';
    rangeEl.textContent = st.charging ? 'Charging' : (RANGE_KM * b / 100).toFixed(0) + ' km left';
    speedEl.textContent = (st.speed / UNITS_PER_M).toFixed(1);
    sensEl.textContent = st.moving ? 'Scanning' : 'Clear';
    if (dockEl) {
      dockEl.classList.toggle('is-charging', st.charging);
      if (dockLabel) dockLabel.textContent = st.charging ? 'Charging ' + b.toFixed(0) + '%' : (st.node === 'dock' ? 'Docked \u00B7 ' + b.toFixed(0) + '%' : 'Charging dock');
    }
  }
  function setCharging(on) {
    if (on && !chargeTimer) {
      st.charging = true;
      chargeTimer = setInterval(function () {
        st.battery = Math.min(100, st.battery + 1);
        if (st.battery >= 100) { clearInterval(chargeTimer); chargeTimer = null; st.charging = false; }
        renderTele();
      }, 1500);
    } else if (!on && chargeTimer) {
      clearInterval(chargeTimer); chargeTimer = null; st.charging = false;
    }
    if (!on) st.charging = false;
    renderTele();
  }

  function setHud(mode, title, detail) {
    root.setAttribute('data-mode', mode);
    stateEl.textContent = title;
    detailEl.textContent = detail;
  }
  function markRoom(id) {
    pins.forEach(function (p) { p.classList.toggle('is-active', p.dataset.room === id); });
    polys.forEach(function (p) { p.classList.toggle('is-active', p.dataset.room === id); });
  }
  function draw() {
    bot.setAttribute('transform', 'translate(' + st.x.toFixed(1) + ' ' + st.y.toFixed(1) + ') rotate(' + st.angle.toFixed(1) + ')');
  }
  function pathLengthFrom(path, seg, segT) {
    var total = 0;
    for (var i = seg; i < path.length - 1; i++) {
      var d = dist(NODES[path[i]], NODES[path[i + 1]]);
      total += (i === seg) ? d * (1 - segT) : d;
    }
    return total;
  }
  function metres(units) { return (units / UNITS_PER_M).toFixed(1) + ' m'; }
  function roomLabel(id) { return ROOMS[id].label; }
  function titleCase(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- Chat log ---------- */
  var typingEl = null;
  function say(text, who) {
    if (!logEl) return;
    if (typingEl) { typingEl.remove(); typingEl = null; }
    var m = document.createElement('div');
    m.className = 'msg msg--' + (who || 'bot');
    m.textContent = text;
    logEl.appendChild(m);
    while (logEl.children.length > 8) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  }
  function botSays(text, delay) {
    if (!logEl) return;
    if (typingEl) typingEl.remove();
    typingEl = document.createElement('div');
    typingEl.className = 'msg msg--bot msg--typing';
    typingEl.innerHTML = '<i></i><i></i><i></i>';
    logEl.appendChild(typingEl);
    logEl.scrollTop = logEl.scrollHeight;
    setTimeout(function () { say(text, 'bot'); }, delay || 500);
  }

  /* ---------- Understanding a typed request (stand-in for the on-device model) ---------- */
  // What people actually say, not just room names: a need maps to a room and to a reply
  // that acknowledges the need. Order matters — the first match wins.
  var INTENTS = [
    { room: 'wc', reply: 'Taking you to the toilet.',
      keys: ['toilet', 'wc', 'loo', 'restroom', 'pee', 'wash my hands', 'wash hands', '\u5395\u6240', '\u4e0a\u5395\u6240', '\u6d17\u624b', '\u65b9\u4fbf', '\u5c3f', '\u5382\u6240', '\u536b\u751f\u95f4', '\u6d17\u624b\u95f4'] },
    { room: 'bath', reply: 'Off to the bathroom.',
      keys: ['bathroom', 'shower', 'bath', 'wash up', 'brush my teeth', 'teeth', 'washroom', '\u6d17\u6fa1', '\u5237\u7259', '\u6d17\u6f31', '\u6d74\u5ba4', '\u51b2\u51c9'] },
    { room: 'bedroom', reply: 'Sounds like you need a rest \u2014 the bedroom it is.',
      keys: ['tired', 'sleepy', 'exhausted', 'worn out', 'lie down', 'lay down', 'nap', 'sleep', 'rest', 'bedroom', 'my bed', 'go to bed', '\u7d2f', '\u56f0', '\u60f3\u7761', '\u7761\u89c9', '\u4f11\u606f', '\u8eba', '\u5367\u5ba4', '\u5e8a'] },
    { room: 'kitchen', reply: 'Let\u2019s get you something in the kitchen.',
      keys: ['thirsty', 'hungry', 'water', 'drink', 'snack', 'coffee', 'tea', 'fridge', 'cook', 'kitchen', '\u6e34', '\u997f', '\u559d\u6c34', '\u559d\u70b9', '\u5403\u70b9', '\u5496\u5561', '\u8336', '\u51b0\u7bb1', '\u505a\u996d', '\u53a8\u623f', '\u96f6\u98df'] },
    { room: 'dining', reply: 'Time to eat \u2014 heading to the dining table.',
      keys: ['dinner', 'lunch', 'breakfast', 'eat', 'meal', 'dining', 'table', '\u5403\u996d', '\u665a\u996d', '\u5348\u996d', '\u65e9\u996d', '\u5f00\u996d', '\u9910\u5385', '\u9910\u684c'] },
    { room: 'living', reply: 'Let\u2019s relax in the living room.',
      keys: ['tv', 'television', 'watch', 'movie', 'relax', 'bored', 'sofa', 'couch', 'lounge', 'living', 'sit down', '\u770b\u7535\u89c6', '\u7535\u89c6', '\u770b\u5267', '\u65e0\u804a', '\u653e\u677e', '\u6c99\u53d1', '\u5ba2\u5385'] },
    { room: 'entry', reply: 'Heading to the front door.',
      keys: ['doorbell', 'someone', 'visitor', 'delivery', 'package', 'front door', 'door', 'go out', 'going out', 'leave', 'outside', 'entry', 'entrance', 'hallway', '\u95e8\u94c3', '\u6709\u4eba', '\u5feb\u9012', '\u5916\u5356', '\u51fa\u95e8', '\u5f00\u95e8', '\u95e8\u53e3', '\u7384\u5173', '\u5927\u95e8'] },
    { room: 'dock', reply: 'Going back to the dock to charge.',
      keys: ['charge', 'charging', 'battery', 'power', 'dock', 'go home', 'back home', 'park', '\u5145\u7535', '\u6ca1\u7535', '\u7535\u91cf', '\u56de\u53bb', '\u56de\u5bb6', '\u505c\u9760'] },
    { room: 'master', reply: 'To the main bedroom.',
      keys: ['main bedroom', 'master', 'my room', 'parents', '\u4e3b\u5367', '\u6211\u7684\u623f\u95f4', '\u7238\u5988'] },
    { room: 'ensuite', reply: 'To the ensuite.',
      keys: ['ensuite', 'en-suite', 'en suite', 'master bath', '\u4e3b\u536b'] },
    { room: 'guest', reply: 'To the guest room.',
      keys: ['guest', 'spare room', '\u5ba2\u623f', '\u5ba2\u5367', '\u5ba2\u4eba'] }
  ];
  function parseIntent(text) {
    var t = text.toLowerCase();
    for (var i = 0; i < INTENTS.length; i++) {
      var keys = INTENTS[i].keys;
      for (var k = 0; k < keys.length; k++) { if (t.indexOf(keys[k]) >= 0) return INTENTS[i]; }
    }
    return null;
  }
  function parseRoom(text) { var it = parseIntent(text); return it ? it.room : null; }
  function isGreeting(t) { return /^(hi|hello|hey|good (morning|evening|afternoon))\b/.test(t) || /^(\u4f60\u597d|\u55e8|\u65e9\u4e0a\u597d|\u665a\u4e0a\u597d)/.test(t); }
  function isThanks(t) { return /\b(thanks|thank you|cheers)\b/.test(t) || t.indexOf('\u8c22\u8c22') >= 0 || t.indexOf('\u8f9b\u82e6') >= 0; }
  function isStop(text) {
    var t = text.toLowerCase();
    return /\b(stop|halt|wait|pause)\b/.test(t) || t.indexOf('停') >= 0 || t.indexOf('等') >= 0;
  }
  function placeName(id) { return roomLabel(id).replace(/^the /, ''); }

  /* ---------- Path geometry ---------- */
  var CORNER = 28;      // corner rounding radius (units) — tight, so the body pivots near the node instead of swinging into door frames
  var TURN_RATE = 170;  // deg/s the body rotates while the wheels do the steering
  function smoothPath(pts) {
    if (pts.length < 3) return pts.slice();
    var out = [pts[0]];
    for (var i = 1; i < pts.length - 1; i++) {
      var p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
      var d1 = dist(p0, p1), d2 = dist(p1, p2);
      var rr = Math.min(CORNER, d1 / 2, d2 / 2);
      if (rr < 1) { out.push(p1); continue; }
      var A = [p1[0] + (p0[0] - p1[0]) / d1 * rr, p1[1] + (p0[1] - p1[1]) / d1 * rr];
      var B = [p1[0] + (p2[0] - p1[0]) / d2 * rr, p1[1] + (p2[1] - p1[1]) / d2 * rr];
      for (var k = 0; k <= 8; k++) {
        var t = k / 8, u = 1 - t;
        out.push([u * u * A[0] + 2 * u * t * p1[0] + t * t * B[0], u * u * A[1] + 2 * u * t * p1[1] + t * t * B[1]]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function buildTrack(nodeIds, startPos) {
    var raw = nodeIds.map(function (n) { return NODES[n]; });
    if (startPos && dist(startPos, raw[0]) > 2) raw.unshift(startPos);
    var pts = smoothPath(raw);
    var cum = [0];
    for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
    // arc-length marks where each graph node is considered "reached"
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
  function shortestTurn(from, to) {
    var d = (to - from) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  // Pick the graph node to start from: close to where we are, and not a detour.
  function distancesFrom(target) {
    var best = {}, done = {}, open = [target];
    best[target] = 0;
    while (open.length) {
      var cur = null, curD = Infinity;
      for (var i = 0; i < open.length; i++) { if (best[open[i]] < curD) { curD = best[open[i]]; cur = open[i]; } }
      open.splice(open.indexOf(cur), 1); done[cur] = true;
      (adj[cur] || []).forEach(function (nb) {
        if (done[nb.n]) return;
        var nd = curD + nb.d;
        if (best[nb.n] === undefined || nd < best[nb.n]) { best[nb.n] = nd; if (open.indexOf(nb.n) < 0) open.push(nb.n); }
      });
    }
    return best;
  }
  function planFrom(pos, currentNode, target) {
    if (currentNode && currentNode !== target) return route(currentNode, target);
    if (currentNode === target) return [target];
    var D = distancesFrom(target);
    // The chair is somewhere along the graph edge st.edge = [a, b]: continue to
    // whichever end gives the shorter trip, so the first leg stays on that edge.
    var cands = (st.edge || []).filter(function (n) { return D[n] !== undefined; });
    if (!cands.length) {
      Object.keys(NODES).forEach(function (n) { if (D[n] !== undefined) cands.push(n); });
    }
    var bestN = null, bestC = Infinity;
    cands.forEach(function (n) {
      var c = dist(pos, NODES[n]) + D[n];
      if (c < bestC) { bestC = c; bestN = n; }
    });
    if (!bestN) return null;
    return bestN === target ? [target] : route(bestN, target);
  }
  function startTrack(nodeIds, roomId) {
    st.track = buildTrack(nodeIds, [st.x, st.y]);
    st.s = 0; st.dest = roomId; st.moving = true; st.pending = null; st.node = null;
    routeEl.setAttribute('points', st.track.pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '));
    showHalo(ROOMS[roomId].node);
    root.classList.add('is-driving');
    markRoom(roomId);
    var len = st.track.total;
    setHud('driving', 'Driving to ' + roomLabel(roomId), metres(len) + ' · about ' + Math.max(1, Math.round(len / SPEED)) + ' s');
    return len;
  }

  function navigateTo(roomId, intro) {
    if (!ROOMS[roomId]) return;
    var target = ROOMS[roomId].node;
    if (st.moving) {
      if (roomId === st.dest) return;
      var p2 = planFrom([st.x, st.y], null, target);
      if (!p2) return;
      startTrack(p2, roomId);
      botSays((intro ? intro + ' ' : '') + 'Changing course to ' + roomLabel(roomId) + '.', 400);
      return;
    }
    if (target === st.node) {
      setHud('idle', 'Already at ' + roomLabel(roomId), 'Pick another room.');
      markRoom(roomId);
      botSays(roomId === 'dock' ? 'I\'m already on the dock.' : 'We\'re already at ' + roomLabel(roomId) + '.', 400);
      return;
    }
    var path = planFrom([st.x, st.y], st.node, target);
    if (!path) return;
    setCharging(false);
    var len = startTrack(path, roomId);
    var eta = metres(len) + ', about ' + Math.max(1, Math.round(len / SPEED)) + ' s.';
    botSays(intro ? intro + ' ' + eta.charAt(0).toUpperCase() + eta.slice(1) : (roomId === 'dock' ? 'Heading back to the dock' : 'On my way to ' + roomLabel(roomId)) + ' \u2014 ' + eta, 450);
    st.last = 0;
    cancelAnimationFrame(st.raf);
    st.raf = requestAnimationFrame(tick);
  }

  function showHalo(nodeId) {
    if (!haloEl) return;
    var p = NODES[nodeId];
    haloEl.setAttribute('transform', 'translate(' + p[0] + ' ' + p[1] + ')');
    haloEl.classList.remove('is-on'); void haloEl.getBoundingClientRect();
    haloEl.classList.add('is-on');
  }
  function hideHalo() { if (haloEl) haloEl.classList.remove('is-on'); }

  function arrive() {
    st.moving = false; st.speed = 0;
    st.node = ROOMS[st.dest].node; st.edge = [st.node, st.node];
    var p = NODES[st.node]; st.x = p[0]; st.y = p[1];
    root.classList.remove('is-driving');
    routeEl.setAttribute('points', '');
    setTimeout(hideHalo, 900);
    var id = st.dest;
    if (id === 'dock') {
      st.angle = 90; draw();
      setHud('idle', 'Docked', 'Charging. Tap a room, or tell CIHANG where to go.');
      say('Docked and charging.', 'bot');
      setCharging(st.battery < 100);
    } else {
      draw();
      setHud('arrived', 'Arrived at ' + roomLabel(id), 'Tap another room, or return to the dock.');
      say('Here we are — ' + roomLabel(id) + '.', 'bot');
    }
    renderTele();
  }

  function tick(ts) {
    if (!st.moving) return;
    if (!st.last) st.last = ts;
    var dt = Math.min(0.05, (ts - st.last) / 1000);
    st.last = ts;
    var tr = st.track;

    // Mecanum front wheels + differential rear: the chassis slides along the path
    // while the body turns at its own pace — no stop-and-pivot at corners.
    var want = headingAt(tr, st.s);
    var turn = shortestTurn(st.angle, want);
    var maxStep = TURN_RATE * dt;
    st.angle += Math.max(-maxStep, Math.min(maxStep, turn));
    // Slow right down while the body is far off the path heading: the Mecanum chassis
    // creeps and pivots on the spot at corners, so the rear never sweeps through a wall.
    var off = Math.abs(turn);
    var v = SPEED * (off > 60 ? 0.22 : off > 25 ? 0.45 : off > 10 ? 0.8 : 1);
    st.s += v * dt;
    st.speed = v;
    st.battery = Math.max(0, st.battery - v * dt * DRAIN_PER_UNIT);
    renderTele();

    var pos = pointAt(tr, st.s);
    st.x = pos[0]; st.y = pos[1];
    // which graph edge are we on? (the leg before the first mark is still the previous edge)
    for (var mi = tr.marks.length - 1; mi >= 0; mi--) {
      if (st.s >= tr.marks[mi].s) { st.edge = [tr.nodes[mi], tr.nodes[Math.min(mi + 1, tr.nodes.length - 1)]]; break; }
    }
    draw();
    if (st.s >= tr.total) { arrive(); return; }
    var remaining = tr.total - st.s;
    detailEl.textContent = metres(remaining) + ' · about ' + Math.max(1, Math.round(remaining / SPEED)) + ' s';
    st.raf = requestAnimationFrame(tick);
  }

  function stopNow() {
    if (!st.moving) { botSays('I\'m not moving.', 300); return; }
    st.moving = false; st.pending = null; st.speed = 0; st.node = null;
    cancelAnimationFrame(st.raf);
    root.classList.remove('is-driving');
    routeEl.setAttribute('points', '');
    hideHalo();
    draw();
    markRoom(null);
    setHud('idle', 'Stopped', 'Tell CIHANG where to go next.');
    botSays('Stopped.', 300);
    renderTele();
  }

  /* ---------- Wire up ---------- */
  function handleCommand(text) {
    say(text, 'user');
    var t = text.toLowerCase().trim();
    if (isStop(text)) { stopNow(); return; }
    var it = parseIntent(text);
    if (it) { navigateTo(it.room, it.reply); return; }
    if (isGreeting(t)) { botSays('Hi! Tell me where to go, or how you feel \u2014 \u201cI\u2019m tired\u201d works too.', 400); return; }
    if (isThanks(t)) { botSays('Anytime.', 300); return; }
    botSays('I didn\'t catch that. Try a room (\u201ckitchen\u201d), or just say what you need \u2014 \u201cI\u2019m thirsty\u201d, \u201cI\u2019m tired\u201d, \u201csomeone\u2019s at the door\u201d.', 500);
  }
  if (askForm && askInput) {
    askForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var text = askInput.value.trim();
      if (!text) return;
      askInput.value = '';
      handleCommand(text);
    });
  }
  if (chips) {
    chips.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () { handleCommand(b.dataset.cmd || b.textContent.trim()); });
    });
  }
  /* Voice input (Web Speech API — Chrome / Edge; needs mic permission) */
  var micBtn = document.getElementById('navmap-mic');
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (micBtn && askInput) {
    if (!SR) {
      micBtn.addEventListener('click', function () { botSays('Voice input needs Chrome or Edge on desktop.', 300); });
    } else {
      var rec = null, listening = false;
      micBtn.addEventListener('click', function () {
        if (listening) { try { rec.stop(); } catch (e) {} return; }
        rec = new SR();
        rec.lang = /^zh/i.test(navigator.language || '') ? 'zh-CN' : 'en-US';
        rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
        rec.onstart = function () {
          listening = true; micBtn.setAttribute('aria-pressed', 'true');
          askInput.placeholder = 'Listening…'; root.classList.add('is-listening');
        };
        rec.onresult = function (ev) {
          var text = '';
          for (var i = ev.resultIndex; i < ev.results.length; i++) text += ev.results[i][0].transcript;
          askInput.value = text;
          if (ev.results[ev.results.length - 1].isFinal) {
            var finalText = text.trim(); askInput.value = '';
            if (finalText) handleCommand(finalText);
          }
        };
        rec.onerror = function (ev) {
          if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') botSays('Microphone access was blocked. Allow it in the address bar and try again.', 300);
          else if (ev.error === 'network') botSays('Voice recognition needs an internet connection in this browser.', 300);
          else if (ev.error !== 'aborted' && ev.error !== 'no-speech') botSays('Voice input isn\'t available right now (' + ev.error + ').', 300);
        };
        rec.onend = function () {
          listening = false; micBtn.setAttribute('aria-pressed', 'false');
          askInput.placeholder = 'Where to?'; root.classList.remove('is-listening');
        };
        try { rec.start(); } catch (e) {}
      });
    }
  }

  pins.forEach(function (p) { p.addEventListener('click', function () { navigateTo(p.dataset.room); }); });
  if (dockEl) {
    dockEl.addEventListener('click', function () { handleCommand('Back to dock'); });
    dockEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCommand('Back to dock'); } });
  }
  polys.forEach(function (p) { p.addEventListener('click', function () { navigateTo(p.dataset.room); }); });
  if (homeBtn) homeBtn.addEventListener('click', function () { navigateTo('dock'); });

  draw();
  setCharging(true);

  // Phone mock-up: match the plan's height
  var plan = root.querySelector('.navmap__plan');
  function sizePhone() { if (plan && plan.clientHeight) root.style.setProperty('--map-h', plan.clientHeight + 'px'); }
  if (plan) {
    if (plan.complete) sizePhone(); else plan.addEventListener('load', sizePhone);
    window.addEventListener('resize', sizePhone);
    if ('ResizeObserver' in window) new ResizeObserver(sizePhone).observe(plan);
  }
  setHud('idle', 'Docked', 'Tap a room to send CIHANG there.');

  // Reveal the pins one by one the first time the map scrolls into view.
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { root.classList.add('play'); io.unobserve(root); } });
    }, { threshold: 0.35 });
    io.observe(root);
  } else { root.classList.add('play'); }
})();
