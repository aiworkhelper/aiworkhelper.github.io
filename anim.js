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
  «Обо мне»: окно поверх страницы по клику в меню (и по ссылке …#obo-mne).
*/
(function () {
  'use strict';
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  function init() {
    var dlg = document.getElementById('obo-mne');
    if (!dlg || typeof dlg.showModal !== 'function') return;   // старый браузер: окно просто не откроется
    function open(e) {
      if (e) e.preventDefault();
      if (!dlg.open) dlg.showModal();
      if (window.ym) { try { ym(113726093, 'reachGoal', 'about_open'); } catch (x) {} }
    }
    var links = document.querySelectorAll('[data-about-open]');
    for (var i = 0; i < links.length; i++) links[i].addEventListener('click', open);
    dlg.querySelector('[data-about-close]').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    if (location.hash === '#obo-mne') open();
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

/*
  Ссылки меню на разделы (#uslugi, #raboty…): плавно прокручиваем к разделу,
  но не дописываем «#raboty» в адрес — он остаётся чистым: aiworkhelper.ru
*/
(function () {
  'use strict';
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a || a.hasAttribute('data-about-open')) return;
    var id = a.getAttribute('href').slice(1);
    if (!id) return;
    var el = document.getElementById(id);
    if (!el && id !== 'top') return;
    e.preventDefault();
    // блоки, которые ещё не «проявились», показываем сразу, чтобы не было пустых мест
    var hidden = document.querySelectorAll('.reveal:not(.in)');
    for (var i = 0; i < hidden.length; i++) hidden[i].classList.add('in');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    if (location.hash && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
  });
})();

/*
  Пришли с другой страницы по ссылке вида aiworkhelper.ru/#raboty
  (из 3D-модели, статьи или страницы 404): браузер уже прокрутил к разделу —
  убираем «#raboty» из адреса, чтобы он оставался чистым.
*/
(function () {
  'use strict';
  function clean() {
    if (!location.hash || !history.replaceState) return;
    var id = decodeURIComponent(location.hash.slice(1));
    if (id && document.getElementById(id)) history.replaceState(null, '', location.pathname + location.search);
  }
  if (document.readyState === 'complete') setTimeout(clean, 0);
  else window.addEventListener('load', function () { setTimeout(clean, 0); });
})();
