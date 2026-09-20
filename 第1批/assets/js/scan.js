(function () {
  'use strict';
  /* One instance per div.scan on the page (the Autonomy demo and the Lab module both use it). Elements are
     found inside the root: [data-scan="sticky"] (the element that sticks on desktop), [data-scan="track"]
     (the phone track), .scan__stage, [data-scan="plan"] (the plan's frame — the point cloud is aligned to it),
     .scan__layer with the canvas and readouts. The room polygons (.navmap__room) are read from the sticky element. */
  var PW = 1791, PH = 1180;
  /* ---------- The flat (traced from floorplan.webp; units = plan viewBox) ---------- */
  var WALL_H = 240, WIN_H = 120;
  var WALLS = [[0,4,20,1172],[20,4,12,20],[20,244,4,496],[20,1160,200,16],[32,8,12,20],[40,1176,20,4],[44,12,8,20],[52,16,4,16],[52,1156,12,4],[56,16,4,8],[64,1176,32,4],[104,1176,28,4],[116,1156,100,4],[152,532,200,20],[156,4,20,420],[160,0,192,4],[160,1176,16,4],[176,4,4,20],[176,220,4,20],[180,4,172,16],[180,224,188,16],[184,240,168,4],[184,1176,36,4],[196,220,36,4],[256,220,108,4],[292,404,60,4],[304,372,48,20],[308,368,44,4],[308,392,44,4],[328,364,24,4],[328,396,24,8],[332,244,20,120],[332,408,20,124],[368,236,4,4],[464,224,144,20],[476,0,100,20],[540,1160,548,16],[544,1156,220,4],[548,1176,36,4],[576,4,296,16],[580,0,84,4],[588,1176,20,4],[608,224,124,16],[656,128,76,24],[656,240,76,4],[656,384,76,76],[660,124,72,4],[660,460,72,4],[664,120,68,4],[664,152,68,4],[676,0,192,4],[692,220,40,4],[708,20,24,100],[708,156,24,20],[712,176,20,44],[712,244,20,140],[712,464,20,88],[720,752,20,404],[732,536,20,16],[740,752,76,20],[740,896,72,16],[740,1048,4,36],[744,1056,4,40],[748,1068,12,28],[752,536,4,4],[752,1064,8,4],[860,536,292,20],[884,532,268,4],[888,480,12,52],[900,896,32,16],[904,752,44,20],[912,772,20,124],[912,912,20,248],[932,1156,4,4],[948,756,4,16],[952,760,4,12],[960,1176,12,4],[988,0,144,20],[1048,1176,40,4],[1060,752,288,16],[1064,768,120,4],[1100,556,16,60],[1100,732,16,20],[1128,20,24,4],[1128,480,24,52],[1132,4,656,16],[1132,24,20,456],[1136,0,652,4],[1152,272,84,16],[1196,768,20,4],[1228,768,60,4],[1280,1160,68,16],[1284,1176,64,4],[1320,768,28,4],[1324,272,28,12],[1324,1156,24,4],[1328,536,20,216],[1328,772,20,384],[1332,20,20,252],[1332,284,20,60],[1348,536,440,24],[1352,20,4,4],[1352,288,4,20],[1356,292,64,12],[1464,524,8,12],[1472,532,204,4],[1516,528,148,4],[1528,524,128,4],[1684,532,20,4],[1768,20,16,200],[1768,348,20,188],[1784,20,4,196]];
  var WINDOWS = [[56,0,96,20],[352,0,120,20],[872,0,112,20],[1771,224,20,120],[224,1160,312,20],[1088,1160,192,20]];
  // furniture boxes: [x, y, w, h, height]
  var FURN = [
    [430,40,130,100,55], [655,60,45,100,40], [500,245,60,45,90], [664,380,41,165,90],          // laundry / kitchen
    [280,330,50,65,40], [280,420,60,100,20],                                                  // toilet
    [440,370,120,230,75], [408,380,32,220,45], [560,380,10,220,45],                           // dining table + chairs
    [755,160,205,185,55], [1020,50,100,110,70], [1100,180,30,170,90], [878,470,252,70,45],    // bedroom
    [1150,125,65,75,40], [1150,205,50,55,85],                                                 // ensuite
    [1355,30,65,270,200], [1510,40,180,250,55], [1460,50,40,50,60], [1700,50,45,50,60], [1655,390,85,80,70], [1465,510,235,35,45],  // main bedroom
    [40,760,120,360,80], [40,1000,300,130,80], [200,845,110,140,40], [490,1020,220,110,80], [630,830,80,300,80], [500,850,100,135,40],  // living room
    [745,780,55,60,85], [745,940,55,60,40], [825,1020,95,140,15],                             // bathroom
    [1085,765,245,85,75], [1120,940,180,210,55], [995,1060,80,80,70]                          // guest room
  ];
  // round things: [cx, cy, r, height]
  var ROUND = [[255,170,40,85], [70,760,32,55], [220,770,32,55], [660,780,32,55], [1730,330,30,45], [1255,880,30,60], [1070,1030,28,45], [1010,50,25,55]];
  var OUTLINE = [[0,0],[1791,0],[1791,550],[1340,550],[1340,1180],[0,1180]];
  // the demo's hallway graph (shared with lab.js) — the mapping drive is one loop through it
  var HY = 672;
  var NODES = {
    ent: [100, 250], wcd: [100, 378], e1: [100, HY], lv: [400, HY], liv: [400, 890], din: [470, HY],
    k1: [622, HY], k2: [622, 335], h1: [720, HY], dock: [720, 596],
    h2: [803, HY], b1d: [803, 548], b1a: [803, 430], b1: [990, 430],
    hb: [876, HY], h3: [1002, HY], gd: [1002, 761], g1: [1002, 940],
    vd: [1110, HY], v1: [1222, HY], u1: [1222, 430], md: [1340, 430], mb: [1520, 430], u2: [1222, 300], ed: [1280, 300]
  };
  var LOOP = ['dock', 'h1', 'k1', 'k2', 'k1', 'din', 'lv', 'liv', 'lv', 'e1', 'wcd', 'ent', 'wcd', 'e1', 'lv', 'din', 'k1', 'h1',
    'h2', 'b1d', 'b1a', 'b1', 'b1a', 'b1d', 'h2', 'hb', 'h3', 'gd', 'g1', 'gd', 'h3', 'vd', 'v1', 'u1', 'u2', 'ed', 'u2', 'u1', 'md', 'mb', 'md', 'u1', 'v1', 'vd', 'h3', 'hb', 'h2', 'h1', 'dock'];
  var STEP = 13, RAYS = 40, RAY_LEN = 620;

  window.CIHANG_PLAN = { W: PW, H: PH, WALLS: WALLS, WINDOWS: WINDOWS, FURN: FURN, ROUND: ROUND, OUTLINE: OUTLINE, NODES: NODES, HY: HY };

  function initScan(scan) {
  var navmap = scan.querySelector('[data-scan="sticky"]'), track = scan.querySelector('[data-scan="track"]'), stage = scan.querySelector('.scan__stage'), layer = scan.querySelector('.scan__layer');
  var navStage = scan.querySelector('[data-scan="plan"]');
  if (!navmap || !track || !stage || !layer || !navStage) return;
  var canvas = layer.querySelector('.scan__canvas');
  var ctx = canvas.getContext('2d');
  var steps = layer.querySelectorAll('.scan__step');
  var pointsEl = layer.querySelector('.scan__points'), roomsEl = layer.querySelector('.scan__rooms'), pctEl = layer.querySelector('.scan__pct');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mqPhone = window.matchMedia('(max-width: 820px)');

  /* rooms: the demo's own polygons, straight from the SVG */
  var ROOM_TINTS = ['63,205,185', '255,159,67', '99,132,255', '154,101,68', '92,176,96', '255,105,97', '198,130,255', '52,170,220', '240,190,60', '120,200,120', '255,140,120'];
  var ROOMS = [];
  Array.prototype.forEach.call(navmap.querySelectorAll('.navmap__room'), function (poly, i) {
    var pts = poly.getAttribute('points').trim().split(/\s+/).map(function (p) { var xy = p.split(','); return [parseFloat(xy[0]), parseFloat(xy[1])]; });
    ROOMS.push({ id: poly.getAttribute('data-room'), poly: pts, color: ROOM_TINTS[i % ROOM_TINTS.length] });
  });

  /* ---------- Sample the drive ---------- */
  var positions = [];   // {x, y, a}
  (function () {
    for (var i = 0; i < LOOP.length - 1; i++) {
      var a = NODES[LOOP[i]], b = NODES[LOOP[i + 1]], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), n = Math.max(1, Math.round(len / STEP));
      var ang = Math.atan2(dy, dx);
      // out of the dock and back onto it the chair keeps facing the hallway (it reverses onto the dock, like the demo)
      if (LOOP[i] === 'dock' || LOOP[i + 1] === 'dock') ang = Math.PI / 2;
      for (var k = 0; k < n; k++) positions.push({ x: a[0] + dx * k / n, y: a[1] + dy * k / n, a: ang });
    }
    var last = NODES[LOOP[LOOP.length - 1]];
    positions.push({ x: last[0], y: last[1], a: Math.PI / 2 });
  })();

  /* ---------- Cast rays, collect points ---------- */
  var RECTS = [];
  WALLS.forEach(function (w) { RECTS.push({ r: w, h: WALL_H, kind: 0 }); });
  WINDOWS.forEach(function (w) { RECTS.push({ r: w, h: WIN_H, kind: 0 }); });
  FURN.forEach(function (f) { RECTS.push({ r: [f[0], f[1], f[2], f[3]], h: f[4], kind: 1 }); });
  function rayHit(ox, oy, dx, dy) {
    var best = null, i;
    for (i = 0; i < RECTS.length; i++) {
      var r = RECTS[i].r, x0 = r[0], y0 = r[1], x1 = r[0] + r[2], y1 = r[1] + r[3], tmin = 0, tmax = RAY_LEN;
      if (Math.abs(dx) < 1e-6) { if (ox < x0 || ox > x1) continue; }
      else { var tx1 = (x0 - ox) / dx, tx2 = (x1 - ox) / dx; tmin = Math.max(tmin, Math.min(tx1, tx2)); tmax = Math.min(tmax, Math.max(tx1, tx2)); }
      if (Math.abs(dy) < 1e-6) { if (oy < y0 || oy > y1) continue; }
      else { var ty1 = (y0 - oy) / dy, ty2 = (y1 - oy) / dy; tmin = Math.max(tmin, Math.min(ty1, ty2)); tmax = Math.min(tmax, Math.max(ty1, ty2)); }
      if (tmax < tmin || tmin <= 0 || tmin > RAY_LEN) continue;
      if (!best || tmin < best.t) best = { t: tmin, h: RECTS[i].h, kind: RECTS[i].kind };
    }
    for (i = 0; i < ROUND.length; i++) {
      var c = ROUND[i], lx = c[0] - ox, ly = c[1] - oy, tca = lx * dx + ly * dy;
      if (tca < 0) continue;
      var d2 = lx * lx + ly * ly - tca * tca; if (d2 > c[2] * c[2]) continue;
      var t = tca - Math.sqrt(c[2] * c[2] - d2);
      if (t <= 0 || t > RAY_LEN) continue;
      if (!best || t < best.t) best = { t: t, h: c[3], kind: 2 };
    }
    return best;
  }
  // seeded random so the cloud is the same on every visit
  var seed = 11;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  var PX = [], PY = [], PZ = [], PK = [];   // point cloud, in scan order
  var perPos = [];
  (function () {
    for (var i = 0; i < positions.length; i++) {
      var p = positions[i], start = PX.length;
      for (var r = 0; r < RAYS; r++) {
        var an = (r / RAYS) * Math.PI * 2 + (i % 4) * 0.033, dx = Math.cos(an), dy = Math.sin(an);
        var h = rayHit(p.x, p.y, dx, dy);
        if (!h) continue;
        var hx = p.x + dx * h.t, hy = p.y + dy * h.t;
        var n = h.kind === 0 ? 3 : 2;   // walls get a third sample so they read as walls
        for (var s = 0; s < n; s++) {
          PX.push(hx + (rnd() - 0.5) * 4); PY.push(hy + (rnd() - 0.5) * 4); PZ.push(rnd() * h.h); PK.push(h.kind);
        }
      }
      for (var f = 0; f < 4; f++) {   // a few floor returns around the chair
        var fa = rnd() * Math.PI * 2, fd = 30 + rnd() * 120;
        PX.push(p.x + Math.cos(fa) * fd); PY.push(p.y + Math.sin(fa) * fd); PZ.push(0); PK.push(3);
      }
      perPos.push(PX.length - start);
    }
  })();
  var TOTAL = PX.length;

  /* ---------- Colours ---------- */
  var COLORS = {
    wallLow: [255, 178, 90], wallHigh: [206, 68, 42],       // orange → red with height
    furnLow: [82, 205, 190], furnHigh: [24, 132, 122],
    round: [92, 176, 96], floor: [150, 140, 128]
  };
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  function ramp(p, a, b) { return ease((p - a) / (b - a)); }
  function colorOf(kind, t) {
    var a, b;
    if (kind === 0) { a = COLORS.wallLow; b = COLORS.wallHigh; }
    else if (kind === 1) { a = COLORS.furnLow; b = COLORS.furnHigh; }
    else if (kind === 2) { a = COLORS.round; b = COLORS.round; }
    else { a = COLORS.floor; b = COLORS.floor; }
    return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ')';
  }
  var BUCKETS = 6, palette = [];
  for (var k = 0; k < 4; k++) { palette.push([]); for (var b = 0; b < BUCKETS; b++) palette[k].push(colorOf(k, b / (BUCKETS - 1))); }
  // the same palette as packed 32-bit pixels for the rasteriser below (ABGR little-endian, straight alpha)
  var LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1, PAL32 = [];
  for (var pk = 0; pk < 4; pk++) {
    PAL32.push([]);
    for (var pb = 0; pb < BUCKETS; pb++) {
      var m = /rgb\((\d+),(\d+),(\d+)\)/.exec(palette[pk][pb]), pr_ = +m[1], pg_ = +m[2], pbl = +m[3], pa = pk === 3 ? 90 : 217;
      PAL32[pk].push(LE ? ((pa << 24) | (pbl << 16) | (pg_ << 8) | pr_) >>> 0 : ((pr_ << 24) | (pg_ << 16) | (pbl << 8) | pa) >>> 0);
    }
  }
  var PB = new Uint8Array(TOTAL);
  for (var i = 0; i < TOTAL; i++) {
    var hMax = PK[i] === 0 ? WALL_H : PK[i] === 1 ? 90 : PK[i] === 2 ? 90 : 1;
    PB[i] = Math.min(BUCKETS - 1, Math.floor(PZ[i] / hMax * (BUCKETS - 0.001)));
  }
  // one index list per (kind, bucket), in scan order — a frame walks each list only up to the points scanned so far
  var LISTS = [];
  (function () {
    var tmpLists = [], k, b, n;
    for (k = 0; k < 4; k++) { tmpLists.push([]); for (b = 0; b < BUCKETS; b++) tmpLists[k].push([]); }
    for (n = 0; n < TOTAL; n++) tmpLists[PK[n]][PB[n]].push(n);
    for (k = 0; k < 4; k++) { LISTS.push([]); for (b = 0; b < BUCKETS; b++) { var src = tmpLists[k][b], arr = new Int32Array(src.length); for (n = 0; n < src.length; n++) arr[n] = src[n]; LISTS[k].push(arr); } }
  })();

  /* ---------- Camera / projection ---------- */
  var cam = { yaw: 0, pitch: 0, s: 1, cx: 0, cy: 0 };
  var W = 0, H = 0, dpr = 1, fullH = 0, baseTop = 0, lastTop = -1;
  function isPhone() { return mqPhone.matches; }
  function resize() {
    var r = layer.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.round(r.width); H = Math.round(r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  var chair = new Image(); chair.src = 'assets/img/chair-top.webp';
  function project(x, y, z, out) {
    var dx = x - PW / 2, dy = y - PH / 2, cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    var rx = dx * cy - dy * sy, ry = dx * sy + dy * cy;
    out[0] = cam.cx + rx * cam.s;
    out[1] = cam.cy + ry * cam.s * Math.cos(cam.pitch) - z * cam.s * Math.sin(cam.pitch) * 0.85;
  }
  var tmp = [0, 0];
  function setVar(name, v) { scan.style.setProperty(name, v); }

  /* ---------- Point-cloud rasteriser ----------
     58k canvas rects per frame are too much for weak laptops (the scroll visibly stalls); writing the points into a
     pixel buffer and blitting it once is 10–50× cheaper. Quality adapts: if frames still take too long, the cloud
     is drawn with every 2nd/3rd/4th point until it keeps up, and comes back when it does. */
  var cloudCanvas = document.createElement('canvas'), cctx = cloudCanvas.getContext('2d'), cloudImg = null, cloudBuf = null, CW = 0, CH = 0, cscale = 1;
  var stride = 1, slowFrames = 0, fastFrames = 0;
  function ensureCloud() {
    cscale = Math.min(dpr, 1.5, Math.sqrt(1.2e6 / Math.max(1, W * H)));
    var cw = Math.max(1, Math.round(W * cscale)), ch = Math.max(1, Math.round(H * cscale));
    if (cw !== CW || ch !== CH || !cloudBuf) {
      CW = cw; CH = ch; cloudCanvas.width = CW; cloudCanvas.height = CH;
      cloudImg = cctx.createImageData(CW, CH); cloudBuf = new Uint32Array(cloudImg.data.buffer);
    }
  }
  function drawCloud(count, size) {
    ensureCloud();
    cloudBuf.fill(0);
    var sz = Math.max(1, Math.round(size * cscale)), buf = cloudBuf, cw = CW, ch = CH;
    var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch) * 0.85;
    var sc = cam.s * cscale, ox = cam.cx * cscale, oy = cam.cy * cscale, hx = PW / 2, hy = PH / 2;
    for (var kind = 3; kind >= 0; kind--) {
      for (var bk = 0; bk < BUCKETS; bk++) {
        var list = LISTS[kind][bk];
        if (!list.length || list[0] >= count) continue;
        var col = PAL32[kind][bk];
        for (var j = 0; j < list.length; j += stride) {
          var n = list[j];
          if (n >= count) break;
          var dx = PX[n] - hx, dy = PY[n] - hy;
          var px = (ox + (dx * cy - dy * sy) * sc) | 0, py = (oy + (dx * sy + dy * cy) * sc * cp - PZ[n] * sc * sp) | 0;
          if (px < 0 || py < 0 || px + sz > cw || py + sz > ch) continue;
          for (var yy = 0; yy < sz; yy++) { var row = (py + yy) * cw + px; for (var xx = 0; xx < sz; xx++) buf[row + xx] = col; }
        }
      }
    }
    cctx.putImageData(cloudImg, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(cloudCanvas, 0, 0, CW, CH, 0, 0, W, H);
  }
  function adapt(ms) {
    if (ms > 28) { fastFrames = 0; if (++slowFrames >= 2 && stride < 4) { stride++; slowFrames = 0; } }
    else if (ms < 9) { slowFrames = 0; if (++fastFrames >= 20 && stride > 1) { stride--; fastFrames = 0; } }
    else { slowFrames = 0; fastFrames = 0; }
  }

  /* ---------- Render ---------- */
  var lastP = -1, ticking = false, planWasOn = false;
  function render(force) {
    ticking = false;
    var p = progress();   // scroll-scrubbed by the visitor: not gated on reduce-motion
    if (!force && Math.abs(p - lastP) < 0.0005) return;
    lastP = p;
    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    if (!W) resize();
    var phone = isPhone();

    /* timeline
       0–.04 hold · .04–.62 drive + scan (tilt to 3D .08–.40, back to top-down .60–.80)
       .66–.87 rooms recognised · .70 pins · .80–.90 plan fades in · .84–.95 cloud fades out · .95–1 readouts fade */
    var drive = ramp(p, 0.04, 0.62);
    var idx = Math.min(positions.length - 1, Math.floor(drive * (positions.length - 1)));
    var count = 0; for (var i = 0; i <= idx; i++) count += perPos[i];
    var up = ramp(p, 0.08, 0.40), down = ramp(p, 0.60, 0.80), tilt = up * (1 - down);
    cam.pitch = 0.95 * tilt;
    cam.yaw = lerp(0, 0.32, ramp(p, 0.08, 0.5)) * (1 - down);
    var reveal = ramp(p, 0.80, 0.90), cloud = 1 - ramp(p, 0.84, 0.95);
    // readouts leave before the plan appears on phones (the plan is small there); the caption stays a little longer
    var ui = phone ? 1 - ramp(p, 0.76, 0.84) : 1 - ramp(p, 0.95, 1), uiSteps = phone ? 1 - ramp(p, 0.90, 0.96) : ui;

    // the plan's own frame: where the map demo draws it, measured against the drawing layer
    var lr = layer.getBoundingClientRect(), pr = navStage.getBoundingClientRect();
    var s1 = pr.width / PW, ox = pr.left - lr.left, oy = pr.top - lr.top;
    var planCam = { s: s1, cx: ox + PW / 2 * s1, cy: oy + PH / 2 * s1 };
    // while tilted: fit the projected bounding box of the flat (walls included) into the stage minus the readouts + caption
    var padT = phone ? 108 : 76, padB = phone ? 112 : 64, padX = phone ? 10 : 24;
    cam.s = 1; cam.cx = 0; cam.cy = 0;
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (var c = 0; c < 12; c++) {
      var pt = OUTLINE[c % 6];
      project(pt[0], pt[1], c < 6 ? 0 : WALL_H, tmp);
      if (tmp[0] < minX) minX = tmp[0]; if (tmp[0] > maxX) maxX = tmp[0];
      if (tmp[1] < minY) minY = tmp[1]; if (tmp[1] > maxY) maxY = tmp[1];
    }
    var safeW = W - padX * 2, safeH = H - padT - padB;
    var fs = Math.min(safeW / (maxX - minX), safeH / (maxY - minY)) * (phone ? 1.02 : 1.0);
    // phones: while the chair drives, the camera follows it zoomed in (the flat is too wide for a portrait
    // stage); it zooms back out to the whole flat before the view returns to top-down
    var chaseW = phone ? up * (1 - ramp(p, 0.50, 0.64)) : 0;
    fs *= lerp(1, 1.8, chaseW);
    var fitCam = { s: fs, cx: W / 2 - (minX + maxX) / 2 * fs, cy: padT + safeH / 2 - (minY + maxY) / 2 * fs };
    if (chaseW > 0) {
      cam.s = fitCam.s; cam.cx = fitCam.cx; cam.cy = fitCam.cy;
      var cp = positions[Math.min(positions.length - 1, Math.floor(drive * (positions.length - 1)))];
      project(cp.x, cp.y, 0, tmp);
      fitCam.cx += (W / 2 - tmp[0]) * chaseW; fitCam.cy += (padT + safeH * 0.55 - tmp[1]) * chaseW;
    }
    cam.s = lerp(planCam.s, fitCam.s, tilt); cam.cx = lerp(planCam.cx, fitCam.cx, tilt); cam.cy = lerp(planCam.cy, fitCam.cy, tilt);

    // phones: the stage is taller than the plan while the cloud is 3D; it shrinks onto the plan as the
    // view comes back to top-down, and the app card below it grows into the room that frees up
    if (phone) {
      var planH = navStage.offsetHeight, hNow = Math.round(lerp(fullH, planH, ramp(p, 0.72, 0.86)));
      if (fullH && Math.abs(hNow - H) > 1) { stage.style.height = hNow + 'px'; }
    }

    ctx.clearRect(0, 0, W, H);
    if (cloud > 0.001) {
      ctx.globalAlpha = 1;
      // faint floor grid inside the outline of the flat
      ctx.save();
      ctx.beginPath();
      OUTLINE.forEach(function (o, j) { project(o[0], o[1], 0, tmp); if (j) ctx.lineTo(tmp[0], tmp[1]); else ctx.moveTo(tmp[0], tmp[1]); });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(120,110,95,.28)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.clip();
      ctx.strokeStyle = 'rgba(120,110,95,.11)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var gx = 100; gx < PW; gx += 100) { project(gx, 0, 0, tmp); ctx.moveTo(tmp[0], tmp[1]); project(gx, PH, 0, tmp); ctx.lineTo(tmp[0], tmp[1]); }
      for (var gy = 100; gy < PH; gy += 100) { project(0, gy, 0, tmp); ctx.moveTo(tmp[0], tmp[1]); project(PW, gy, 0, tmp); ctx.lineTo(tmp[0], tmp[1]); }
      ctx.stroke();
      ctx.restore();
    }

    // recognised rooms: floor tints in the demo's own polygons
    var roomsOn = 0;
    if (cloud > 0.001) {
      ROOMS.forEach(function (room, ri) {
        var t = ramp(p, 0.66 + ri * 0.014, 0.74 + ri * 0.014);
        if (t <= 0) return;
        roomsOn++;
        ctx.beginPath();
        room.poly.forEach(function (pt, j) { project(pt[0], pt[1], 0, tmp); if (j) ctx.lineTo(tmp[0], tmp[1]); else ctx.moveTo(tmp[0], tmp[1]); });
        ctx.closePath();
        var ta = t * (1 - reveal);   // the tints hand over to the plan itself
        ctx.fillStyle = 'rgba(' + room.color + ',' + (0.16 * ta).toFixed(3) + ')'; ctx.fill();
        ctx.strokeStyle = 'rgba(' + room.color + ',' + (0.75 * ta).toFixed(3) + ')'; ctx.lineWidth = 1.5; ctx.stroke();
      });
    } else {
      ROOMS.forEach(function (room, ri) { if (ramp(p, 0.66 + ri * 0.014, 0.74 + ri * 0.014) > 0) roomsOn++; });
    }

    if (cloud > 0.001) {
      // the cloud, in scan order, batched by colour bucket, rasterised into a pixel buffer (see drawCloud)
      drawCloud(count, phone ? 1.7 : 1.9);
      ctx.globalAlpha = 1;

      // route so far
      ctx.beginPath();
      for (var q = 0; q <= idx; q++) { project(positions[q].x, positions[q].y, 2, tmp); if (q) ctx.lineTo(tmp[0], tmp[1]); else ctx.moveTo(tmp[0], tmp[1]); }
      ctx.strokeStyle = 'rgba(47,109,246,.7)'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

      // the chair and its live sweep (the sweep comes from the LiDAR on top of the body while the view is 3D)
      var pos = positions[idx], lidarZ = 8 + 15 * tilt;
      if (drive > 0 && drive < 1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,159,67,.55)'; ctx.lineWidth = 1;
        var sweep = (p * 40) % (Math.PI * 2);
        for (var r = 0; r < 24; r++) {
          var an = sweep + r * (Math.PI * 2 / 24), h = rayHit(pos.x, pos.y, Math.cos(an), Math.sin(an)), len = h ? h.t : RAY_LEN;
          ctx.globalAlpha = 0.12 + 0.5 * (r < 4 ? (4 - r) / 4 : 0);
          ctx.beginPath(); project(pos.x, pos.y, lidarZ, tmp); ctx.moveTo(tmp[0], tmp[1]);
          project(pos.x + Math.cos(an) * len, pos.y + Math.sin(an) * len, lidarZ, tmp); ctx.lineTo(tmp[0], tmp[1]); ctx.stroke();
        }
        ctx.restore();
      }
      // top-down: the demo's chair sprite. Tilted: a solid body (a flat picture would give the 3D away),
      // cross-faded as the view goes up and comes back down
      var bodyA = Math.min(1, tilt / 0.22), spriteA = 1 - bodyA;
      if (spriteA > 0.001) {
        ctx.save();
        ctx.globalAlpha = spriteA;
        project(pos.x, pos.y, 0, tmp);
        ctx.translate(tmp[0], tmp[1]);
        ctx.scale(1, Math.cos(cam.pitch));
        ctx.rotate(pos.a + cam.yaw);
        var cw = 123.2 * cam.s, ch = 68.8 * cam.s;   // same sprite size as the demo's chair
        ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 12 * cam.s; ctx.shadowOffsetY = 12 * cam.s;
        if (chair.complete && chair.naturalWidth) ctx.drawImage(chair, -cw / 2, -ch / 2, cw, ch);
        else { ctx.fillStyle = '#f3efe7'; ctx.fillRect(-cw / 2, -ch / 2, cw, ch); }
        ctx.restore();
      }
      if (bodyA > 0.001) drawBody(pos.x, pos.y, pos.a, bodyA);
    }

    // hand-off to the demo: plan + legend + app panel fade in, cloud fades out, pins pop in one by one
    setVar('--reveal', reveal.toFixed(3));
    setVar('--cloud', cloud.toFixed(3));
    setVar('--ui', ui.toFixed(3));
    setVar('--ui-steps', uiSteps.toFixed(3));
    var planOn = p >= 0.70;
    if (planOn !== planWasOn) { navmap.classList.toggle('play', planOn); planWasOn = planOn; }
    scan.classList.toggle('is-done', p > 0.9);
    scan.classList.toggle('is-mapped', p >= 0.999);
    scan.classList.toggle('is-scrolled', p > 0.02);

    // readouts + captions
    if (pointsEl) pointsEl.textContent = count.toLocaleString('en-US');
    if (roomsEl) roomsEl.textContent = roomsOn;
    if (pctEl) pctEl.textContent = Math.round(drive * 100) + '%';
    var step = p < 0.30 ? 0 : p < 0.66 ? 1 : p < (phone ? 0.80 : 0.84) ? 2 : 3;
    for (var s = 0; s < steps.length; s++) steps[s].classList.toggle('is-on', s === step);
    if (t0 && cloud > 0.001) adapt(performance.now() - t0);
  }
  /* The robot while the view is 3D: a small low-poly chair built from boxes in the chair's own frame
     (+x = front, z up; 100 units = 1 m): chassis, four wheels, footplate, seat, backrest, walnut armrests
     and a LiDAR puck at the front. Faces are depth-sorted (painter's order for this oblique camera),
     near faces lit, far faces in shade. About 0.85 × the sprite's footprint, so the cross-fade barely changes size. */
  var PARTS = [
    // [cx, cy, z0, L, W, H, top, near, far]
    [0, 0, 4, 100, 56, 10, '#4a4a50', '#3a3a3f', '#2c2c30'],          // chassis
    [-32, -31, 0, 24, 8, 24, '#2a2a2d', '#1d1d1f', '#161618'],        // rear wheels
    [-32, 31, 0, 24, 8, 24, '#2a2a2d', '#1d1d1f', '#161618'],
    [34, -26, 0, 14, 7, 14, '#2a2a2d', '#1d1d1f', '#161618'],         // front casters
    [34, 26, 0, 14, 7, 14, '#2a2a2d', '#1d1d1f', '#161618'],
    [52, 0, 6, 14, 38, 5, '#4a4a4f', '#333338', '#28282c'],           // footplate
    [-3, 0, 14, 58, 52, 26, '#f1ece2', '#ddd6c9', '#c9c2b4'],         // seat cushion
    [-30, 0, 40, 9, 52, 48, '#ece6da', '#d9d2c5', '#c6bfb1'],         // backrest
    [-9, -30, 40, 5, 5, 16, '#3a3a3e', '#2c2c30', '#232326'],         // armrest posts
    [-9, 30, 40, 5, 5, 16, '#3a3a3e', '#2c2c30', '#232326'],
    [-5, -30, 56, 42, 6, 5, '#6b4a36', '#5e4030', '#4a3226'],         // walnut armrests
    [-5, 30, 56, 42, 6, 5, '#6b4a36', '#5e4030', '#4a3226']
  ];
  var LIDAR = [42, 0, 16, 7, 7];   // cx, cy, z, r, h
  // depth along the view direction of this oblique camera (larger = nearer): a proper painter's sort
  function depthOf(wx, wy, z) {
    var dx = wx - PW / 2, dy = wy - PH / 2, ry = dx * Math.sin(cam.yaw) + dy * Math.cos(cam.yaw);
    return ry * Math.sin(cam.pitch) * 0.85 + z * Math.cos(cam.pitch);
  }
  var faceList = [];
  function pushBoxFaces(x, y, ca, sa, part) {
    var cx = part[0], cy = part[1], z0 = part[2], hl = part[3] / 2, hw = part[4] / 2, z1 = z0 + part[5];
    var corners = [[cx + hl, cy - hw], [cx + hl, cy + hw], [cx - hl, cy + hw], [cx - hl, cy - hw]], W3 = [], P0 = [], P1 = [];
    for (var i = 0; i < 4; i++) {
      var wx = x + corners[i][0] * ca - corners[i][1] * sa, wy = y + corners[i][0] * sa + corners[i][1] * ca;
      W3.push([wx, wy]);
      project(wx, wy, z0, tmp); P0.push([tmp[0], tmp[1]]);
      project(wx, wy, z1, tmp); P1.push([tmp[0], tmp[1]]);
    }
    var zm = (z0 + z1) / 2;
    for (var f = 0; f < 4; f++) {
      var g = (f + 1) % 4, mx = (W3[f][0] + W3[g][0]) / 2, my = (W3[f][1] + W3[g][1]) / 2;
      var d = depthOf(mx, my, zm);
      // near faces are lit, far faces in shade: nearer than the box centre → near tone
      var near = d > depthOf(x + cx * ca - cy * sa, y + cx * sa + cy * ca, zm);
      faceList.push({ d: d, pts: [P0[f], P0[g], P1[g], P1[f]], fill: near ? part[7] : part[8] });
    }
    faceList.push({ d: depthOf(x + cx * ca - cy * sa, y + cx * sa + cy * ca, z1), pts: [P1[0], P1[1], P1[2], P1[3]], fill: part[6] });
  }
  function drawBody(x, y, a, alpha) {
    var ca = Math.cos(a), sa = Math.sin(a);
    ctx.save();
    ctx.globalAlpha = alpha;
    // floor shadow under the chassis
    ctx.beginPath();
    var sh = [[52, -30], [52, 30], [-46, 30], [-46, -30]];
    for (var j = 0; j < 4; j++) { project(x + sh[j][0] * ca - sh[j][1] * sa + 5, y + sh[j][0] * sa + sh[j][1] * ca + 7, 0, tmp); if (j) ctx.lineTo(tmp[0], tmp[1]); else ctx.moveTo(tmp[0], tmp[1]); }
    ctx.closePath(); ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fill();
    faceList.length = 0;
    for (var k = 0; k < PARTS.length; k++) pushBoxFaces(x, y, ca, sa, PARTS[k]);
    faceList.sort(function (u, v) { return u.d - v.d; });
    ctx.lineWidth = 0.8; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(20,18,16,.26)';
    for (var o = 0; o < faceList.length; o++) {
      var fc = faceList[o], q = fc.pts;
      ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.lineTo(q[3][0], q[3][1]); ctx.closePath();
      ctx.fillStyle = fc.fill; ctx.fill(); ctx.stroke();
    }
    // LiDAR puck at the front, with its orange emitter
    var lx = x + LIDAR[0] * ca - LIDAR[1] * sa, ly = y + LIDAR[0] * sa + LIDAR[1] * ca, pr = LIDAR[3] * cam.s, sq = Math.max(0.25, Math.cos(cam.pitch));
    project(lx, ly, LIDAR[2], tmp);
    var bx = tmp[0], by = tmp[1];
    project(lx, ly, LIDAR[2] + LIDAR[4], tmp);
    ctx.beginPath(); ctx.moveTo(bx - pr, by); ctx.lineTo(tmp[0] - pr, tmp[1]); ctx.lineTo(tmp[0] + pr, tmp[1]); ctx.lineTo(bx + pr, by); ctx.closePath(); ctx.fillStyle = '#2c2c30'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(tmp[0], tmp[1], pr, pr * sq, 0, 0, Math.PI * 2); ctx.fillStyle = '#1d1d1f'; ctx.fill();
    ctx.beginPath(); ctx.arc(tmp[0], tmp[1], Math.max(1.2, 2.2 * cam.s), 0, Math.PI * 2); ctx.fillStyle = '#ff9f43'; ctx.fill();
    ctx.restore();
  }
  // the sticky element is the whole demo on every screen (phones: stage above the app, pinned together; the
  // stage's height is what changes); the track is the tall .scan
  var panelEl = scan.querySelector('.lab__panel');
  function stickyEl() { return navmap; }
  function trackEl() { return scan; }
  // phones: the pinned pair ends up as the plan plus the app under it (the app's natural height, it scrolls inside
  // its card when there is less room), capped at the screen
  function pairH() { var app = panelEl ? panelEl.scrollHeight + 12 : 0; return Math.min(window.innerHeight - baseTop - 8, navStage.offsetHeight + app); }
  function progress() {
    var st = stickyEl(), tr = trackEl();
    var top = parseFloat(getComputedStyle(st).top) || 0;
    // phones: normalised to the pinned pair's final height (plan + app)
    // after the hand-off the finished plan stays pinned for a while (HOLD of the viewport) so it is not flicked past
    var hold = (isPhone() ? 0.6 : 0.7) * window.innerHeight;
    var r = tr.getBoundingClientRect(), total = tr.offsetHeight - (isPhone() ? pairH() : st.offsetHeight) - hold;
    if (total <= 0) return 1;
    return Math.min(1, Math.max(0, (top - r.top) / total));
  }
  function place() {
    // the layer lives in the sticky element: the whole demo on desktop, the stage on phones
    var want = isPhone() ? stage : navmap;
    if (layer.parentNode !== want) { if (want === navmap) navmap.insertBefore(layer, track.nextSibling); else stage.appendChild(layer); }
  }
  function measure() {
    place();
    if (isPhone()) {
      // the stage's full (3D) height from the stylesheet, before any inline height
      var inline = stage.style.height; stage.style.height = ''; stage.style.top = '';
      fullH = stage.getBoundingClientRect().height;
      baseTop = parseFloat(getComputedStyle(navmap).top) || 0; lastTop = -1;
      if (inline) stage.style.height = inline;
    } else { fullH = 0; stage.style.height = ''; stage.style.top = ''; lastTop = -1; }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(function () { render(false); }); } }
  var resizing = false;
  function onResize() { if (resizing) return; resizing = true; measure(); resize(); render(true); resizing = false; }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  if (mqPhone.addEventListener) mqPhone.addEventListener('change', onResize);
  if ('ResizeObserver' in window) { var ro = new ResizeObserver(function () { if (!resizing) { resizing = true; resize(); render(true); resizing = false; } }); ro.observe(layer); ro.observe(navStage); }
  chair.addEventListener('load', function () { render(true); });
  measure(); resize(); render(true);
  }
  // if the point cloud cannot run on this browser, leave the plan usable: the stylesheet's defaults show the plan and
  // hide the canvas (--reveal 1, --cloud 0), and lab.js still gets the plan data exported above
  Array.prototype.forEach.call(document.querySelectorAll('div.scan'), function (scan) {
    try { initScan(scan); }
    catch (e) { scan.classList.add('is-done', 'is-mapped', 'scan--off'); if (window.console) console.warn('CIHANG scan:', e); }
  });
})();
