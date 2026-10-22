/*
  Видео-визитка: открывается в окне поверх страницы и ставится на паузу при закрытии.
*/
(function () {
  'use strict';
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  function init() {
  var dlg = document.getElementById('video-dialog');
  var openBtn = document.querySelector('[data-video-open]');
  if (!dlg || !openBtn || typeof dlg.showModal !== 'function') {
    if (openBtn && dlg) {   // очень старый браузер: просто открываем файл
      openBtn.addEventListener('click', function () { window.location.href = dlg.querySelector('source').src; });
    }
  } else {
    var video = dlg.querySelector('video');
    openBtn.addEventListener('click', function () {
      dlg.showModal();
      try { var pr = video.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
      if (window.ym) { try { ym(113726093, 'reachGoal', 'video_open'); } catch (e) {} }
    });
    dlg.querySelector('[data-video-close]').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });   // клик по фону
    dlg.addEventListener('close', function () { video.pause(); });
  }
  }
})();

/*
  Плавное появление блоков при прокрутке.
  Прячутся только блоки ниже первого экрана, поэтому верх страницы виден сразу.
  Если браузер старый или включено «Уменьшить движение», ничего не происходит.
*/
(function () {
  'use strict';
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var groups = [
    '.section-head', '.service', '.work', '.steps li',
    '.pc', '.price-foot', '.reviews-grid > *', '.faq details', '.contact', '.details .card'
  ];
  var fold = window.innerHeight;
  var items = [];

  groups.forEach(function (sel) {
    var list = document.querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.getBoundingClientRect().top < fold) continue;   // уже видно - не трогаем
      el.classList.add('reveal');
      // соседние элементы появляются чуть по очереди
      el.style.transitionDelay = (i % 4) * 70 + 'ms';
      items.push(el);
    }
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      el.classList.add('in');
      io.unobserve(el);
      // после появления убираем задержку, чтобы наведение срабатывало сразу
      setTimeout(function () { el.style.transitionDelay = ''; }, 900);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  items.forEach(function (el) { io.observe(el); });

  // переход по якорю из меню: блоки по пути показываем сразу, без пустых мест
  window.addEventListener('hashchange', function () {
    items.forEach(function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('in');
    });
  });
})();
