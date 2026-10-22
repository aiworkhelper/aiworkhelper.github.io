/*
  Интерактивное демо: посетитель пишет задачу, ассистент по шагам «работает»,
  показывает результат и счёт. Оплата здесь ненастоящая: в конце посетитель
  может отправить свою задачу на почту и получить реальную оценку.

  Язык берётся из <html lang="..">. Цены совпадают с таблицей услуг.
  Чтобы поменять цены или тексты, правьте объект KINDS ниже.
*/
(function () {
  'use strict';

  var root = document.getElementById('demo-app');
  if (!root) return;

  var EMAIL = 'aiworkingmaksim@gmail.com';
  var RATE = 81.914;                                   // курс ЦБ на 22.10.2026, как в таблице услуг
  var lang = (document.documentElement.lang || 'ru').slice(0, 2) === 'en' ? 'en' : 'ru';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Тексты интерфейса ----------
  var T = {
    ru: {
      me: 'Вы', bot: 'Максим Helper · ассистент',
      analyze: 'Разбираю задачу. Вот план:',
      build: 'Пишу решение',
      check: 'Проверяю:',
      result: 'Готово',
      payTitle: 'Счёт',
      service: 'Услуга', term: 'Срок', price: 'Стоимость',
      from: 'от ',
      pay: 'Оплатить (демо)', paying: 'Проводим оплату…',
      paid: 'Оплачено · чек самозанятого отправлен (демо)',
      payNote: 'Это демонстрация: деньги не списываются. Настоящая цена и срок — после того, как я посмотрю задачу.',
      send: 'Отправить эту задачу мне', again: 'Ещё раз',
      subject: 'Задача с сайта',
      body: 'Здравствуйте! Хочу заказать:\n\n',
      empty: 'Нужна задача хотя бы из пары слов.',
      hello: 'Опишите задачу внизу, и я покажу, как она решается.',
      stages: ['Задача', 'Разбор', 'Разработка', 'Проверка', 'Результат', 'Оплата'],
      examples: ['Telegram-бот для записи в барбершоп', '3D-модель держателя для наушников', 'Таблица учёта заказов и расходов', 'Сайт для кофейни с меню и картой']
    },
    en: {
      me: 'You', bot: 'Maksim Helper · assistant',
      analyze: 'Analyzing the task. Here is the plan:',
      build: 'Building the solution',
      check: 'Checking:',
      result: 'Done',
      payTitle: 'Invoice',
      service: 'Service', term: 'Timeline', price: 'Price',
      from: 'from ',
      pay: 'Pay (demo)', paying: 'Processing payment…',
      paid: 'Paid · receipt sent (demo)',
      payNote: 'This is a demo: no money is charged. The real price and timeline come after I look at your task.',
      send: 'Send this task to me', again: 'Run again',
      subject: 'Task from website',
      body: 'Hello! I would like to order:\n\n',
      empty: 'Please describe the task in at least a couple of words.',
      hello: 'Describe a task below, and I will show how it gets solved.',
      stages: ['Task', 'Analysis', 'Build', 'Testing', 'Result', 'Payment'],
      examples: ['Telegram bot for barbershop bookings', '3D model of a headphone holder', 'Spreadsheet for orders and expenses', 'Website for a coffee shop with a menu and map']
    }
  }[lang];

  // ---------- Виды задач: как распознать, цена, план, код, проверки, результат ----------
  var CODE_WORDS = {
    ru: { HELLO: 'Здравствуйте! Выберите услугу:', SERVICES: 'Услуги и цены', MANICURE: 'Классический маникюр', FROM: 'от' },
    en: { HELLO: 'Hello! Pick a service:', SERVICES: 'Services and prices', MANICURE: 'Classic manicure', FROM: 'from' }
  }[lang];
  function fillWords(line) { return line.replace(/\{(\w+)\}/g, function (m, k) { return CODE_WORDS[k] || m; }); }

  var KINDS = [
    { id: 'bot', re: /бот|telegram|телеграм|\bbot/i, rub: 3000, file: 'bot.py',
      ru: { name: 'Telegram-бот', days: '3–7 дней',
        plan: ['Сценарий: меню, услуги, дата и время', 'Сбор имени и телефона клиента', 'Заявка сразу приходит владельцу'],
        checks: ['Бот отвечает на /start', 'Запись проходит до конца', 'Заявка доходит владельцу'],
        res: ['Бот готов к запуску', 'Клиенты записываются сами, а вы получаете готовые заявки в Telegram.'] },
      en: { name: 'Telegram bot', days: '3–7 days',
        plan: ['Flow: menu, services, date and time', 'Collect the client\'s name and phone', 'Send the request straight to the owner'],
        checks: ['Bot replies to /start', 'Booking works end to end', 'Request reaches the owner'],
        res: ['The bot is ready to launch', 'Clients book on their own, and you get ready requests in Telegram.'] },
      code: ['@router.message(CommandStart())', 'async def start(message):', '    await message.answer("{HELLO}",', '                         reply_markup=services_menu())', '', '@router.callback_query(F.data.startswith("svc:"))', 'async def pick_time(call): ...'] },

    { id: '3d', re: /3d|3д|модел|печат|stl|print|деталь|подставк|корпус/i, rub: 1500, file: 'part.py',
      ru: { name: '3D-моделирование', days: '1–3 дня',
        plan: ['Снимаю размеры с эскиза', 'Строю параметрическую модель', 'Готовлю STL для печати'],
        checks: ['Сетка замкнута', 'Размеры совпадают с эскизом', 'Печатается без поддержек'],
        res: ['Модель готова к печати', 'STL-файл и исходник, где размеры меняются одной строкой.'] },
      en: { name: '3D modeling', days: '1–3 days',
        plan: ['Take dimensions from the sketch', 'Build a parametric model', 'Export STL for printing'],
        checks: ['Mesh is watertight', 'Dimensions match the sketch', 'Prints without supports'],
        res: ['The model is ready to print', 'An STL file plus source code where any size is one line to change.'] },
      code: ['WIDTH, DEPTH, WALL = 70, 90, 4   # mm', 'profile = stroke(centerline(), WALL)', 'profile = fillet(profile, r=1.6)', 'mesh = extrude(profile, WIDTH)', 'assert mesh.is_watertight', 'mesh.save("part.stl")'] },

    { id: 'table', re: /таблиц|excel|эксель|отч[её]т|учёт|учет|sheet|spreadsheet|report|расход/i, rub: 1000, file: 'formulas.gs',
      ru: { name: 'Таблицы и отчёты', days: '1–2 дня',
        plan: ['Листы: заявки, клиенты, расходы', 'Формулы и сводка по месяцам', 'График, который обновляется сам'],
        checks: ['Формулы без ошибок', 'Итоги сходятся', 'Удобно на телефоне'],
        res: ['Таблица готова', 'Вы вносите данные, а сводка и график считаются сами.'] },
      en: { name: 'Spreadsheets and reports', days: '1–2 days',
        plan: ['Sheets: requests, clients, expenses', 'Formulas and a monthly summary', 'A chart that updates itself'],
        checks: ['No formula errors', 'Totals add up', 'Easy to use on a phone'],
        res: ['The spreadsheet is ready', 'You enter the data; the summary and chart update themselves.'] },
      code: ['=QUERY(Requests!A:F,', '  "select B, sum(F) where A >= date \'2026-01-01\'', '   group by B label sum(F) \'Total\'")', '', '=SPARKLINE(Summary!C2:C13, {"charttype","column"})'] },

    { id: 'server', re: /сервер|vps|хостинг|круглосуточ|server|hosting|deploy|24\/7/i, rub: 1500, file: 'deploy.sh',
      ru: { name: 'Настройка сервера', days: '1 день',
        plan: ['Подбираю недорогой VPS', 'Переношу проект и настраиваю', 'Включаю автозапуск после сбоев'],
        checks: ['Сервис запущен', 'Поднимается после перезагрузки', 'Логи без ошибок'],
        res: ['Всё работает круглосуточно', 'Проект живёт на сервере, ваш компьютер можно выключать.'] },
      en: { name: 'Server setup', days: '1 day',
        plan: ['Pick an affordable VPS', 'Move and configure the project', 'Enable auto-restart after failures'],
        checks: ['Service is running', 'Comes back after reboot', 'Logs are clean'],
        res: ['Everything runs 24/7', 'The project lives on a server; you can turn your computer off.'] },
      code: ['ssh root@your-server', 'apt install -y python3-venv', 'python3 -m venv .venv && .venv/bin/pip install -r requirements.txt', 'systemctl enable --now bot.service', 'systemctl status bot   # active (running)'] },

    { id: 'doc', re: /презентац|документ|\bкп\b|коммерческ|прайс|инструкц|presentation|deck|document|proposal|price list/i, rub: 1000, file: 'layout',
      ru: { name: 'Презентации и документы', days: '1–2 дня',
        plan: ['Собираю структуру и тексты', 'Аккуратная вёрстка в вашем стиле', 'Файлы для печати и отправки'],
        checks: ['Нет опечаток', 'Всё влезает на страницы', 'PDF открывается везде'],
        res: ['Документ готов', 'Аккуратный файл, который не стыдно отправить клиенту.'] },
      en: { name: 'Presentations and documents', days: '1–2 days',
        plan: ['Outline the structure and copy', 'Clean layout in your style', 'Files ready to print and send'],
        checks: ['No typos', 'Everything fits the pages', 'PDF opens anywhere'],
        res: ['The document is ready', 'A clean file you can confidently send to a client.'] },
      code: ['slides = [', '  title("Studio offer 2026"),', '  bullets(["Services", "Prices", "Contacts"]),', '  table(price_list),', ']', 'export(slides, "offer.pdf")'] },

    { id: 'code', re: /код|скрипт|ошибк|баг|исправ|python|питон|javascript|script|bug|fix|code|парс|данн|data|scrap/i, rub: 500, file: 'script.py',
      ru: { name: 'Написание и исправление кода', days: 'от 1 дня',
        plan: ['Воспроизвожу задачу или ошибку', 'Пишу и исправляю код', 'Объясняю, что изменилось'],
        checks: ['Тесты проходят', 'Ошибка больше не появляется', 'Код понятный и с комментариями'],
        res: ['Код работает', 'Готовый скрипт и короткое объяснение, что было не так.'] },
      en: { name: 'Writing and fixing code', days: 'from 1 day',
        plan: ['Reproduce the task or the bug', 'Write and fix the code', 'Explain what changed'],
        checks: ['Tests pass', 'The bug is gone', 'Code is readable and commented'],
        res: ['The code works', 'A working script plus a short explanation of what was wrong.'] },
      code: ['def load_orders(path):', '    with open(path, encoding="utf-8") as f:', '        rows = csv.DictReader(f)', '        return [r for r in rows if r["status"] != "cancelled"]', '', 'print(len(load_orders("orders.csv")), "orders")'] },

    { id: 'site', re: /.*/, rub: 3000, file: 'index.html',
      ru: { name: 'Сайт', days: '2–5 дней',
        plan: ['Структура: услуги, цены, отзывы, контакты', 'Дизайн под телефон и компьютер', 'Публикация и счётчик посещений'],
        checks: ['Открывается на телефоне', 'Все ссылки работают', 'Страница загружается быстро'],
        res: ['Сайт опубликован', 'Своя страница со ссылкой, которую можно отправлять клиентам.'] },
      en: { name: 'Website', days: '2–5 days',
        plan: ['Structure: services, prices, reviews, contacts', 'Design for phones and desktops', 'Publishing and visit analytics'],
        checks: ['Works on phones', 'All links work', 'Page loads fast'],
        res: ['The website is live', 'Your own page with a link you can send to clients.'] },
      code: ['<section id="services">', '  <h2>{SERVICES}</h2>', '  <div class="service">', '    <h3>{MANICURE}</h3><span>{FROM} 1 500 ₽</span>', '  </div>', '</section>'] }
  ];

  // ---------- Элементы ----------
  var log = root.querySelector('.demo-log');
  var form = root.querySelector('.demo-form');
  var input = form.querySelector('input');
  var runBtn = form.querySelector('button[type="submit"]');
  var chips = root.querySelectorAll('.demo-chips button');
  var segs = root.querySelectorAll('.demo-progress i');
  var stage = root.querySelector('.demo-stage');
  var errorBox = root.querySelector('.demo-error');

  var busy = false, autoplayed = false, userTouched = false, token = 0;

  function wait(ms) { return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); }); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function scrollDown() { log.scrollTop = log.scrollHeight; }
  function money(rub) {
    var r = rub.toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU').replace(/ | /g, lang === 'en' ? ',' : ' ');
    return T.from + r + ' ₽ / $' + Math.round(rub / RATE);
  }
  function setStep(i) {
    for (var k = 0; k < segs.length; k++) {
      segs[k].classList.toggle('done', k < i);
      segs[k].classList.toggle('active', k === i);
    }
    if (stage) stage.textContent = i < T.stages.length ? T.stages[i] + ' · ' + (i + 1) + '/' + T.stages.length : T.stages[T.stages.length - 1] + ' ✓';
  }
  function lock(on) {
    busy = on;
    runBtn.disabled = on;
    for (var i = 0; i < chips.length; i++) chips[i].disabled = on;
  }

  function botMsg(cls) {
    var m = el('div', 'msg bot' + (cls ? ' ' + cls : ''));
    m.appendChild(el('span', 'who', T.bot));
    log.appendChild(m);
    scrollDown();
    return m;
  }
  async function thinking(ms) {
    var m = botMsg();
    var t = el('span', 'typing'); t.innerHTML = '<i></i><i></i><i></i>';
    m.appendChild(t); scrollDown();
    await wait(ms);
    m.remove();
  }
  async function typeInto(node, text, speed) {
    if (reduce) { node.textContent += text; return; }
    for (var i = 0; i < text.length; i++) {
      node.textContent += text[i];
      if (i % 3 === 0) await wait(speed);
    }
  }

  // ---------- Основной сценарий ----------
  async function run(task) {
    var my = ++token;
    lock(true);
    errorBox.hidden = true;
    log.textContent = '';
    var kind = KINDS.filter(function (k) { return k.re.test(task); })[0];
    var tx = kind[lang];

    // 1. Задача
    setStep(0);
    var u = el('div', 'msg user');
    u.appendChild(el('span', 'who', T.me));
    u.lastChild.style.color = 'inherit'; u.lastChild.style.opacity = '0.75';
    u.appendChild(document.createTextNode(task));
    log.appendChild(u); scrollDown();
    await wait(500);

    // 2. Разбор
    setStep(1);
    await thinking(900);
    var a = botMsg();
    a.appendChild(document.createTextNode(T.analyze));
    var ul = el('ul'); a.appendChild(ul);
    for (var i = 0; i < tx.plan.length; i++) { ul.appendChild(el('li', null, tx.plan[i])); scrollDown(); await wait(380); }
    if (my !== token) return;

    // 3. Разработка: код печатается
    setStep(2);
    await wait(300);
    var c = el('div', 'msg code-msg');
    var top = el('div', 'code-top'); top.appendChild(el('span', null, kind.file)); var st = el('span', null, T.build + '…'); top.appendChild(st);
    var pre = el('pre'); var codeText = el('span'); var caret = el('span', 'cursor');
    pre.appendChild(codeText); pre.appendChild(caret);
    var bar = el('div', 'code-progress'); var fill = el('b'); bar.appendChild(fill);
    c.appendChild(top); c.appendChild(pre); c.appendChild(bar);
    log.appendChild(c); scrollDown();
    var total = fillWords(kind.code.join('\n')).length, done = 0;
    for (var l = 0; l < kind.code.length; l++) {
      var line = fillWords(kind.code[l]) + (l < kind.code.length - 1 ? '\n' : '');
      await typeInto(codeText, line, 14);
      done += line.length; fill.style.width = Math.round(done / total * 100) + '%';
      scrollDown();
      if (my !== token) return;
    }
    caret.remove(); st.textContent = '✓';
    await wait(300);

    // 4. Проверка
    setStep(3);
    var ch = botMsg();
    ch.appendChild(document.createTextNode(T.check));
    var cl = el('ul'); ch.appendChild(cl);
    for (var j = 0; j < tx.checks.length; j++) { await wait(420); cl.appendChild(el('li', 'ok', tx.checks[j])); scrollDown(); }
    await wait(450);
    if (my !== token) return;

    // 5. Результат
    setStep(4);
    var r = botMsg('card-result');
    r.appendChild(el('h4', null, '✓ ' + tx.res[0]));
    r.appendChild(el('p', null, tx.res[1]));
    r.appendChild(el('span', 'tag', tx.name + ' · ' + tx.days));
    scrollDown();
    await wait(700);

    // 6. Счёт и демо-оплата
    setStep(5);
    var p = botMsg('card-pay');
    p.appendChild(el('h4', null, T.payTitle));
    var dl = el('dl', 'pay-rows');
    [[T.service, tx.name], [T.term, tx.days], [T.price, money(kind.rub)]].forEach(function (row, idx) {
      dl.appendChild(el('dt', null, row[0]));
      dl.appendChild(el('dd', idx === 2 ? 'total' : null, row[1]));
    });
    p.appendChild(dl);
    var actions = el('div', 'pay-actions');
    var payBtn = el('button', 'btn', T.pay); payBtn.type = 'button';
    actions.appendChild(payBtn);
    p.appendChild(actions);
    p.appendChild(el('p', 'pay-note', T.payNote));
    scrollDown();
    lock(false);

    var finished = false;
    async function finish() {
      if (finished) return; finished = true;
      payBtn.disabled = true;
      payBtn.textContent = '';
      payBtn.appendChild(el('span', 'spinner')); payBtn.appendChild(document.createTextNode(T.paying));
      await wait(1100);
      actions.textContent = '';
      var ok = el('div', 'paid');
      ok.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M8.5 14.5l3.6 3.6 7.4-7.6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      ok.style.color = 'var(--accent)';
      ok.appendChild(el('span', null, T.paid));
      actions.appendChild(ok);
      setStep(6);   // все этапы пройдены

      var next = el('div', 'pay-actions'); next.style.marginTop = '12px';
      var send = el('a', 'btn', T.send);
      send.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(T.subject) + '&body=' + encodeURIComponent(T.body + task);
      var again = el('button', 'btn btn-ghost', T.again); again.type = 'button';
      again.addEventListener('click', function () { input.focus(); input.select(); });
      next.appendChild(send); next.appendChild(again);
      p.appendChild(next);
      scrollDown();
    }
    payBtn.addEventListener('click', finish);
    // при автопоказе оплата «нажимается» сама, а потом запускается следующий пример
    if (!userTouched) {
      await wait(1400);
      if (my === token && !userTouched) {
        await finish();
        await wait(4500);
        if (my === token && !userTouched) autoplay();
      }
    }
  }

  // ---------- Ввод ----------
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    userTouched = true;
    var task = input.value.trim();
    if (task.length < 4) { errorBox.textContent = T.empty; errorBox.hidden = false; input.focus(); return; }
    if (!busy) run(task);
  });
  for (var i = 0; i < chips.length; i++) {
    chips[i].addEventListener('click', function () {
      userTouched = true;
      input.value = this.textContent;
      if (!busy) run(this.textContent);
    });
  }
  ['focus', 'keydown', 'pointerdown'].forEach(function (ev) {
    input.addEventListener(ev, function () { userTouched = true; });
  });

  // ---------- Автопоказ: когда демо появляется на экране, печатаем пример ----------
  var exampleIndex = 0, visible = true;
  async function autoplay() {
    if (userTouched || busy) return;
    // пока демо не видно на экране, ждём, чтобы не крутить анимацию впустую
    while (!visible) { await wait(500); if (userTouched) return; }
    var example = T.examples[exampleIndex++ % T.examples.length];
    input.value = '';
    setStep(0);
    for (var i = 0; i < example.length; i++) {
      if (userTouched) return;
      input.value += example[i];
      await wait(38);
    }
    await wait(350);
    if (!userTouched && !busy) run(example);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !autoplayed) { autoplayed = true; setTimeout(autoplay, 900); }
    }, { threshold: 0.4 });
    io.observe(root);
  }

  // стартовое сообщение
  var hello = el('div', 'demo-empty');
  hello.appendChild(el('b', null, T.hello));
  log.appendChild(hello);
})();
