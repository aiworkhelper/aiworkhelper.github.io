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
    '.reviews-grid > *', '.faq details', '.contact', '.details .card'
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
