/* CIHANG — the pre-order / contact form. There is exactly one form on the page: it
   lives in the Contact section, and the overlay borrows it when a Pre-order button is
   pressed, then hands it back. One set of fields, one set of translations, one
   submit path. Without JavaScript the same buttons are ordinary links to #contact. */
(function () {
  'use strict';
  var API = String(window.CIHANG_API || '').replace(/\/+$/, '');
  var MAILTO = String(window.CIHANG_EMAIL || '');
  var form = document.getElementById('pform');
  var home = document.getElementById('form-home');
  var slot = document.getElementById('form-modal');
  var modal = document.getElementById('preorder');
  if (!form || !home || !slot || !modal) return;

  var msg = document.getElementById('pform-msg');
  var sendBtn = form.querySelector('.pform__send');
  var openedAt = 0, source = 'contact', lastFocus = null, closing = null;

  function L(key, fallback) { return window.I18N ? I18N.t(key, fallback) : fallback; }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  /* closest() is missing on SVG elements in older engines, and the close button holds an svg */
  function up(el, attr) {
    while (el && el.nodeType === 1) {
      if (el.getAttribute(attr) !== null) return el;
      el = el.parentNode;
    }
    return null;
  }

  /* ------------------------------------------------------------ the overlay */

  function openModal(src) {
    source = src || 'nav';
    lastFocus = document.activeElement;
    if (closing) { clearTimeout(closing); closing = null; }
    home.style.minHeight = home.offsetHeight + 'px';  // the section keeps its height behind the scrim
    slot.appendChild(form);
    modal.hidden = false;
    document.body.classList.add('modal-open');
    if (window.requestAnimationFrame) requestAnimationFrame(function () { modal.classList.add('is-open'); });
    else modal.classList.add('is-open');
    syncVersion();
    openedAt = Date.now();
    var first = form.querySelector('input[name="name"]');
    if (first) setTimeout(function () { try { first.focus(); } catch (e) {} }, 80);
    if (window.CIHANG_STAT) CIHANG_STAT.send({ t: 'cta', id: src });
  }

  function closeModal() {
    if (modal.hidden) return;
    modal.classList.remove('is-open');
    closing = setTimeout(function () {
      closing = null;
      modal.hidden = true;
      home.appendChild(form);
      home.style.minHeight = '';
      document.body.classList.remove('modal-open');
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    }, 220);
  }

  function inModal() { return !modal.hidden; }

  /* pick up whichever version is selected in the Buy section */
  function syncVersion() {
    var cur = document.querySelector('#buy-versions .opt.is-active');
    var v = cur && cur.getAttribute('data-version');
    if (!v) return;
    var r = form.querySelector('input[name="version"][value="' + v + '"]');
    if (r) r.checked = true;
  }

  document.addEventListener('click', function (e) {
    var open = up(e.target, 'data-preorder');
    if (open) { e.preventDefault(); openModal(open.getAttribute('data-preorder')); return; }
    if (up(e.target, 'data-modal-close')) { e.preventDefault(); closeModal(); }
  });

  document.addEventListener('keydown', function (e) {
    if (!inModal()) return;
    if (e.key === 'Escape' || e.keyCode === 27) { closeModal(); return; }
    if (e.key !== 'Tab' && e.keyCode !== 9) return;
    /* keep the tab order inside the dialog while it is open */
    var panel = modal.querySelector('.modal__panel');
    var f = panel.querySelectorAll('a[href], button:not([disabled]), input:not([type="hidden"]), textarea, select');
    var list = [];
    for (var i = 0; i < f.length; i++) if (f[i].offsetParent !== null || f[i] === document.activeElement) list.push(f[i]);
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ------------------------------------------------------------- submitting */

  function field(name) { return form.querySelector('[name="' + name + '"]'); }
  function value(name) { var el = field(name); return el ? String(el.value || '').replace(/^\s+|\s+$/g, '') : ''; }

  function clearBad() {
    var bad = form.querySelectorAll('.is-bad');
    for (var i = 0; i < bad.length; i++) bad[i].classList.remove('is-bad');
  }
  function bad(name, text) {
    clearBad();
    var el = field(name);
    if (el) { el.classList.add('is-bad'); try { el.focus(); } catch (e) {} }
    msg.className = 'pform__msg is-bad-msg';
    msg.textContent = text;
  }
  function fail(text) {
    msg.className = 'pform__msg is-bad-msg';
    msg.innerHTML = esc(text) + (MAILTO ? ' <a href="mailto:' + esc(MAILTO) + '">' + esc(MAILTO) + '</a>' : '');
  }
  function busy(on) {
    sendBtn.disabled = on;
    sendBtn.textContent = on ? L('form.sending', 'Sending…') : L('form.send', 'Send');
  }
  function done() {
    form.classList.add('is-sent');
    msg.className = 'pform__msg is-ok';
    msg.innerHTML = '<strong>' + esc(L('form.thank_you', 'Thank you.')) + '</strong> ' +
      esc(L('form.we_have_your_message_and', 'We have your message and will write back to the address you gave us.')) +
      ' <button type="button" class="pform__again">' + esc(L('form.send_another', 'Send another')) + '</button>';
    form.reset();
  }

  msg.addEventListener('click', function (e) {
    if (!e.target.classList || !e.target.classList.contains('pform__again')) return;
    form.classList.remove('is-sent');
    msg.className = 'pform__msg';
    msg.textContent = '';
    var first = field('name');
    if (first) try { first.focus(); } catch (err) {}
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearBad();
    var name = value('name'), email = value('email');
    if (!name) return bad('name', L('form.please_tell_us_your_name', 'Please tell us your name.'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      return bad('email', L('form.that_email_address_doesnt_look', 'That email address does not look right.'));

    var ver = form.querySelector('input[name="version"]:checked');
    var body = {
      name: name, email: email, region: value('region'),
      version: ver ? ver.value : '', message: value('message'),
      lang: (window.I18N && I18N.lang) || 'en',
      source: inModal() ? source : 'contact',
      ref: document.referrer,
      website: value('website'),
      elapsed: Date.now() - (openedAt || (Date.now() - 60000))
    };

    busy(true);
    msg.className = 'pform__msg';
    msg.textContent = '';
    fetch(API + '/api/inquiry', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, body: j }; },
                           function () { return { status: r.status, body: {} }; });
    }).then(function (o) {
      busy(false);
      if (o.status === 200 && o.body && o.body.ok) return done();
      if (o.status === 429) return fail(L('form.youve_already_sent_a_few', 'You have already sent a few. Please give it an hour, or write to us directly.'));
      if (o.body && o.body.error === 'email_invalid') return bad('email', L('form.that_email_address_doesnt_look', 'That email address does not look right.'));
      if (o.body && o.body.error === 'name_required') return bad('name', L('form.please_tell_us_your_name', 'Please tell us your name.'));
      fail(L('form.that_didnt_go_through_please', 'That did not go through. Please try again in a moment, or write to us directly.'));
    })['catch'](function () {
      busy(false);
      fail(L('form.that_didnt_go_through_please', 'That did not go through. Please try again in a moment, or write to us directly.'));
    });
  });

  /* the send button relabels itself when the language changes */
  window.addEventListener('cihang:lang', function () { if (!sendBtn.disabled) sendBtn.textContent = L('form.send', 'Send'); });

  /* the form starts life in the page, so a visitor who opened #contact directly sees it */
  openedAt = Date.now();
})();
