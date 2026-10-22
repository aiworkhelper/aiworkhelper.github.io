/*
  Заявки с сайта на почту через сервис FormSubmit (у сайта нет своего сервера).
  Письма приходят на EMAIL с темой «Заявка с сайта: …» или «Отзыв с сайта: …»,
  отправитель — formsubmit.co. По этим признакам их раскладывает фильтр Gmail.

  Первый раз FormSubmit присылает на EMAIL письмо «Activate Form» — по ссылке
  в нём нужно один раз нажать подтверждение, после этого заявки идут сами.
  Если отправка не удалась, посетителю показывается запасной вариант: письмо
  с уже заполненным текстом через его почтовую программу.
*/
(function () {
  'use strict';

  var EMAIL = 'aiworkingmaksim@gmail.com';
  var ENDPOINT = 'https://formsubmit.co/ajax/' + EMAIL;
  var en = (document.documentElement.lang || 'ru').slice(0, 2) === 'en';

  var T = en ? {
    source: 'Website (EN)', leadSubject: 'Заявка с сайта (EN): ', sending: 'Sending…',
    ok: 'Thank you! Your request has been sent. I will reply within a day with a price and timeline.',
    fail: 'Could not send the form. Please send the same text by email:', mailBtn: 'Open email',
    vName: 'Please enter your name.', vContact: 'Please leave a way to contact you: Telegram, phone or email.',
    vTask: 'Please describe the task in a couple of words.',
    fName: 'Name', fContact: 'Contact', fTask: 'Task', fSource: 'Source'
  } : {
    source: 'Сайт (RU)', leadSubject: 'Заявка с сайта: ', sending: 'Отправляю…',
    ok: 'Спасибо! Заявка отправлена. Отвечу в течение дня с ценой и сроком.',
    fail: 'Не получилось отправить форму. Отправьте, пожалуйста, тот же текст письмом:', mailBtn: 'Открыть письмо',
    vName: 'Укажите имя.', vContact: 'Оставьте контакт для ответа: Telegram, телефон или почту.',
    vTask: 'Опишите задачу хотя бы парой слов.',
    fName: 'Имя', fContact: 'Контакт', fTask: 'Задача', fSource: 'Источник'
  };

  // Отправка любой заявки. Возвращает Promise, который падает, если письмо не ушло.
  window.sendLead = function (fields) {
    var data = { _template: 'table', _captcha: 'false' };
    for (var k in fields) data[k] = fields[k];
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || String(j.success) !== 'true') throw new Error(j.message || 'send failed');
        return j;
      });
    });
  };
  window.leadMailto = function (subject, body) {
    return 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  };

  function init() {
    var form = document.getElementById('lead-form');
    if (!form) return;
    var name = form.querySelector('[name="name"]');
    var contact = form.querySelector('[name="contact"]');
    var task = form.querySelector('[name="task"]');
    var honey = form.querySelector('[name="_honey"]');
    var btn = form.querySelector('button[type="submit"]');
    var err = form.querySelector('.form-error');
    var ok = form.querySelector('.form-ok');
    var btnText = btn.textContent;

    function fail(msg, field) { err.textContent = msg; err.hidden = false; if (field) field.focus(); }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      ok.hidden = true; err.hidden = true;
      if (honey && honey.value) return;                          // бот заполнил скрытое поле
      var v = { n: name.value.trim(), c: contact.value.trim(), t: task.value.trim() };
      if (v.n.length < 2) return fail(T.vName, name);
      if (v.c.length < 3) return fail(T.vContact, contact);
      if (v.t.length < 4) return fail(T.vTask, task);

      btn.disabled = true; btn.textContent = T.sending;
      var fields = {};
      fields._subject = T.leadSubject + v.n;
      fields[T.fName] = v.n; fields[T.fContact] = v.c; fields[T.fTask] = v.t; fields[T.fSource] = T.source;
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.c)) fields._replyto = v.c;   // только если это почта, а не @ник

      window.sendLead(fields).then(function () {
        ok.textContent = T.ok; ok.hidden = false;
        form.reset();
        if (window.ym) { try { ym(113726093, 'reachGoal', 'lead_sent'); } catch (x) {} }
      }).catch(function () {
        var body = T.fName + ': ' + v.n + '\n' + T.fContact + ': ' + v.c + '\n' + T.fTask + ': ' + v.t;
        err.textContent = T.fail + ' ';
        var a = document.createElement('a');
        a.href = window.leadMailto(T.leadSubject + v.n, body);
        a.textContent = T.mailBtn;
        err.appendChild(a); err.hidden = false;
      }).then(function () { btn.disabled = false; btn.textContent = btnText; });
    });

    // Демо на первом экране передаёт сюда задачу посетителя
    window.prefillLead = function (text) {
      task.value = text;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function () { try { name.focus({ preventScroll: true }); } catch (x) { name.focus(); } }, 600);
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
