/* CIHANG — the app card beside the demo: a conversation with the chair. Typed or spoken requests are matched to a
   room by need ("I'm tired" → bedroom, "thirsty" → kitchen, "someone's at the door" → entry) in English, Chinese and the
   current page language (js.intent.* in the dictionary), then handed to the demo (lab.js) through window.CIHANG_LAB;
   the chair's replies follow the demo's 'cihang:lab' events, so tapping a room on the plan is narrated too. */
(function () {
  'use strict';
  var LAB = window.CIHANG_LAB;
  var logEl = document.getElementById('lab-log'), askForm = document.getElementById('lab-ask'), askInput = document.getElementById('lab-input');
  var chips = document.getElementById('lab-chips'), micBtn = document.getElementById('lab-mic');
  if (!LAB || !logEl) return;
  var root = LAB.root;
  function L10N(k, f) { return window.I18N ? window.I18N.t(k, f) : f; }
  function L10NF(k, f, v) { if (window.I18N && window.I18N.f) return window.I18N.f(k, f, v); var s = f; for (var n in v) s = s.split('{' + n + '}').join(v[n]); return s; }
  function roomLabel(id) { return LAB.roomLabel(id); }

  /* ---------- Chat log ---------- */
  var typingEl = null;
  function say(text, who) {
    if (typingEl) { typingEl.remove(); typingEl = null; }
    var m = document.createElement('div');
    m.className = 'msg msg--' + (who || 'bot');
    m.textContent = text;
    logEl.appendChild(m);
    while (logEl.children.length > 8) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  }
  function botSays(text, delay) {
    if (typingEl) typingEl.remove();
    typingEl = document.createElement('div');
    typingEl.className = 'msg msg--bot msg--typing';
    typingEl.innerHTML = '<i></i><i></i><i></i>';
    logEl.appendChild(typingEl);
    logEl.scrollTop = logEl.scrollHeight;
    setTimeout(function () { say(text, 'bot'); }, delay || 500);
  }

  /* ---------- Understanding a request (stand-in for the on-device model) ----------
     What people actually say, not just room names: a need maps to a room and to a reply that acknowledges the
     need. Order matters — the first match wins. Extra phrases per language come from the dictionary (js.intent.*). */
  var INTENTS = [
    { room: 'wc', reply: 'Taking you to the toilet.',
      keys: ['toilet', 'wc', 'loo', 'restroom', 'pee', 'wash my hands', 'wash hands', '厕所', '上厕所', '洗手', '方便', '尿', '厂所', '卫生间', '洗手间'] },
    { room: 'bath', reply: 'Off to the bathroom.',
      keys: ['bathroom', 'shower', 'bath', 'wash up', 'brush my teeth', 'teeth', 'washroom', '洗澡', '刷牙', '洗漱', '浴室', '冲凉'] },
    { room: 'bedroom', reply: 'Sounds like you need a rest — the bedroom it is.',
      keys: ['tired', 'sleepy', 'exhausted', 'worn out', 'lie down', 'lay down', 'nap', 'sleep', 'rest', 'bedroom', 'my bed', 'go to bed', '累', '困', '想睡', '睡觉', '休息', '躺', '卧室', '床'] },
    { room: 'kitchen', reply: 'Let’s get you something in the kitchen.',
      keys: ['thirsty', 'hungry', 'water', 'drink', 'snack', 'coffee', 'tea', 'fridge', 'cook', 'kitchen', '渴', '饿', '喝水', '喝点', '吃点', '咖啡', '茶', '冰箱', '做饭', '厨房', '零食'] },
    { room: 'dining', reply: 'Time to eat — heading to the dining table.',
      keys: ['dinner', 'lunch', 'breakfast', 'eat', 'meal', 'dining', 'table', '吃饭', '晚饭', '午饭', '早饭', '开饭', '餐厅', '餐桌'] },
    { room: 'living', reply: 'Let’s relax in the living room.',
      keys: ['tv', 'television', 'watch', 'movie', 'relax', 'bored', 'sofa', 'couch', 'lounge', 'living', 'sit down', '看电视', '电视', '看剧', '无聊', '放松', '沙发', '客厅'] },
    { room: 'entry', reply: 'Heading to the front door.',
      keys: ['doorbell', 'someone', 'visitor', 'delivery', 'package', 'front door', 'door', 'go out', 'going out', 'leave', 'outside', 'entry', 'entrance', 'hallway', '门铃', '有人', '快递', '外卖', '出门', '开门', '门口', '玄关', '大门'] },
    { room: 'dock', reply: 'Going back to the dock to charge.',
      keys: ['charge', 'charging', 'battery', 'power', 'dock', 'go home', 'back home', 'park', '充电', '没电', '电量', '回去', '回家', '停靠'] },
    { room: 'master', reply: 'To the main bedroom.',
      keys: ['main bedroom', 'master', 'my room', 'parents', '主卧', '我的房间', '爸妈'] },
    { room: 'ensuite', reply: 'To the ensuite.',
      keys: ['ensuite', 'en-suite', 'en suite', 'master bath', '主卫'] },
    { room: 'guest', reply: 'To the guest room.',
      keys: ['guest', 'spare room', '客房', '客卧', '客人'] }
  ];
  function extraKeys(name) { var s = L10N('js.intent.' + name, ''); return s ? s.split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean) : []; }
  function hasAny(low, name) { var ks = extraKeys(name); for (var i = 0; i < ks.length; i++) if (low.indexOf(ks[i]) >= 0) return true; return false; }
  function parseIntent(text) {
    var low = text.toLowerCase();
    for (var i = 0; i < INTENTS.length; i++) {
      var keys = INTENTS[i].keys.concat(extraKeys(INTENTS[i].room));
      for (var k = 0; k < keys.length; k++) { if (low.indexOf(keys[k]) >= 0) return { room: INTENTS[i].room, reply: L10N('js.intent.' + INTENTS[i].room + '.reply', INTENTS[i].reply) }; }
    }
    return null;
  }
  function isGreeting(t) { if (hasAny(t, 'greet')) return true; return /^(hi|hello|hey|good (morning|evening|afternoon))\b/.test(t) || /^(你好|嗨|早上好|晚上好)/.test(t); }
  function isThanks(t) { if (hasAny(t, 'thanks')) return true; return /\b(thanks|thank you|cheers)\b/.test(t) || t.indexOf('谢谢') >= 0 || t.indexOf('辛苦') >= 0; }
  function isStop(text) {
    var low = text.toLowerCase();
    return /\b(stop|halt|wait|pause)\b/.test(low) || low.indexOf('停') >= 0 || low.indexOf('等') >= 0 || hasAny(low, 'stop');
  }

  /* ---------- Commands ---------- */
  function handleCommand(text) {
    say(text, 'user');
    var t = text.toLowerCase().trim();
    if (isStop(text)) { if (!LAB.stop()) botSays(L10N('js.map.not_moving', 'I\'m not moving.'), 300); return; }
    var it = parseIntent(text);
    if (it) { LAB.send(it.room, it.reply); return; }
    if (isGreeting(t)) { botSays(L10N('js.map.greeting', 'Hi! Tell me where to go, or how you feel — “I’m tired” works too.'), 400); return; }
    if (isThanks(t)) { botSays(L10N('js.map.anytime', 'Anytime.'), 300); return; }
    botSays(L10N('js.map.no_catch', 'I didn\'t catch that. Try a room (“kitchen”), or just say what you need — “I’m thirsty”, “I’m tired”, “someone’s at the door”.'), 500);
  }
  askForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var text = askInput.value.trim();
    if (!text) return;
    askInput.value = '';
    handleCommand(text);
  });
  if (chips) chips.querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () { handleCommand(b.dataset.cmd || b.textContent.trim()); });
  });

  /* ---------- The chair talks back (whatever started the trip: a chip, a sentence, a tap on the plan) ---------- */
  root.addEventListener('cihang:lab', function (ev) {
    var d = ev.detail || {}, intro = d.intro;
    switch (d.type) {
      case 'driving': {
        var eta = L10NF('js.map.eta_sentence', '{m}, about {s} s.', { m: d.m, s: d.s });
        botSays(intro ? intro + ' ' + eta.charAt(0).toUpperCase() + eta.slice(1)
          : (d.room === 'dock' ? L10N('js.map.heading_dock', 'Heading back to the dock') : L10NF('js.map.on_my_way', 'On my way to {room}', { room: roomLabel(d.room) })) + ' — ' + eta, 450);
        break;
      }
      case 'changing': botSays((intro ? intro + ' ' : '') + L10NF('js.map.changing_course', 'Changing course to {room}.', { room: roomLabel(d.room) }), 400); break;
      case 'already': botSays(d.room === 'dock' ? L10N('js.map.already_docked', 'I\'m already on the dock.') : L10NF('js.map.already_here', 'We\'re already at {room}.', { room: roomLabel(d.room) }), 400); break;
      case 'arrived': say(L10NF('js.map.here_we_are', 'Here we are — {room}.', { room: roomLabel(d.room) }), 'bot'); break;
      case 'docked': say(L10N('js.map.docked_msg', 'Docked and charging.'), 'bot'); break;
      case 'stopped': botSays(L10N('js.map.stopped_msg', 'Stopped.'), 300); break;
    }
  });

  /* ---------- Voice input (Web Speech API — Chrome / Edge; needs mic permission) ---------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (micBtn) {
    if (!SR) {
      micBtn.addEventListener('click', function () { botSays(L10N('js.map.mic_unsupported', 'Voice input needs Chrome or Edge on desktop.'), 300); });
    } else {
      var rec = null, listening = false;
      micBtn.addEventListener('click', function () {
        if (listening) { try { rec.stop(); } catch (e) {} return; }
        rec = new SR();
        rec.lang = ({ zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' })[window.I18N ? window.I18N.lang : 'en'] || (/^zh/i.test(navigator.language || '') ? 'zh-CN' : 'en-US');
        rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
        rec.onstart = function () {
          listening = true; micBtn.setAttribute('aria-pressed', 'true');
          askInput.placeholder = L10N('js.map.listening', 'Listening…'); root.classList.add('is-listening');
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
          if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') botSays(L10N('js.map.mic_blocked', 'Microphone access was blocked. Allow it in the address bar and try again.'), 300);
          else if (ev.error === 'network') botSays(L10N('js.map.mic_network', 'Voice recognition needs an internet connection in this browser.'), 300);
          else if (ev.error !== 'aborted' && ev.error !== 'no-speech') botSays(L10NF('js.map.mic_error', 'Voice input isn\'t available right now ({err}).', { err: ev.error }), 300);
        };
        rec.onend = function () {
          listening = false; micBtn.setAttribute('aria-pressed', 'false');
          askInput.placeholder = L10N('js.map.where_to', 'Where to?'); root.classList.remove('is-listening');
        };
        try { rec.start(); } catch (e) {}
      });
    }
  }
})();
