const $ = (sel) => document.querySelector(sel);
const t = (key, subs) => I18n.t(key, subs);
const MINUTE = 60 * 1000;
const RING_LENGTH = 553;

let petName = 'Pip';
let bubbleTimer = null;

/* ---------- Helpers ---------- */

function pad2(n) {
  return new Intl.NumberFormat(I18n.locale(), { minimumIntegerDigits: 2, useGrouping: false }).format(n);
}

function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

// 0 = Sunday … 6 = Saturday; 2026-01-04 is a Sunday.
function weekdayName(day) {
  return new Intl.DateTimeFormat(I18n.locale(), { weekday: 'long' }).format(new Date(2026, 0, 4 + day));
}

function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Intl.DateTimeFormat(I18n.locale(), { hour: 'numeric', minute: '2-digit' }).format(new Date(2026, 0, 4, h, m));
}

function weekOrder() {
  let firstDay = 1;
  try {
    const loc = new Intl.Locale(I18n.locale());
    const info = loc.getWeekInfo ? loc.getWeekInfo() : loc.weekInfo;
    if (info?.firstDay) firstDay = info.firstDay % 7;
  } catch { /* keep Monday */ }
  return Array.from({ length: 7 }, (_, i) => (firstDay + i) % 7);
}

/* ---------- Tabs ---------- */

async function setupTabs() {
  const { lastTab = 'pet' } = await chrome.storage.local.get('lastTab');
  const show = (name) => {
    document.querySelectorAll('.tab').forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.tab === name)));
    document.querySelectorAll('.panel').forEach((panel) => { panel.hidden = panel.id !== `panel-${name}`; });
    chrome.storage.local.set({ lastTab: name });
  };
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.title = tab.textContent;
    tab.addEventListener('click', () => show(tab.dataset.tab));
  });
  show(lastTab);
}

/* ---------- Pet ---------- */

function say(key, subs) {
  const bubble = $('#petBubble');
  bubble.textContent = t(key, subs);
  bubble.title = bubble.textContent;
  bubble.hidden = false;
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => { bubble.hidden = true; }, 2800);
}

async function renderPet() {
  const pet = Store.decay(await Store.get('pet'));
  $('#adoptView').hidden = Boolean(pet.species);
  $('#petView').hidden = !pet.species;
  if (!pet.species) return;

  const mood = Store.moodKey(pet);
  const sleeping = pet.sleepingUntil > Date.now() || mood === 'moodTired';
  const petEl = $('#petImg');
  const src = Store.spriteUrl(pet.species, sleeping ? 'sleep' : mood === 'moodSad' ? 'sad' : 'idle');
  if (petEl.src !== src) petEl.src = src;
  petEl.alt = petName;

  $('#petGreeting').textContent = t('petGreeting', [petName]);
  $('#petMood').textContent = t(mood, [petName]);
  $('#petLevel').textContent = t('statLevel', [I18n.number(pet.level)]);
  $('#petXp').textContent = t('statXp', [I18n.number(pet.xp), I18n.number(Store.xpForLevel(pet.level))]);
  $('#happyVal').textContent = I18n.number(pet.happiness);
  $('#energyVal').textContent = I18n.number(pet.energy);
  $('#happyBar').style.width = `${pet.happiness}%`;
  $('#energyBar').style.width = `${pet.energy}%`;
}

function setupPet() {
  document.querySelectorAll('[data-pet-action]').forEach((btn) => {
    btn.title = btn.textContent;
    btn.addEventListener('click', async () => {
      const { pet, reaction, levelUp } = await Store.updatePet(btn.dataset.petAction);
      const petEl = $('#petImg');
      petEl.classList.remove('bounce');
      void petEl.offsetWidth;
      if (reaction === 'reactFeed' || reaction === 'reactPlay') petEl.classList.add('bounce');
      if (levelUp) say('reactLevelUp', [I18n.number(pet.level)]);
      else say(reaction);
      await renderPet();
      if (reaction === 'reactNap') setTimeout(renderPet, 4100);
    });
  });
}

function setupAdopt() {
  const grid = $('#speciesGrid');
  const nameInput = $('#adoptName');
  let chosen = 'cat';

  const select = (species) => {
    chosen = species;
    grid.querySelectorAll('.species').forEach((el) => el.setAttribute('aria-checked', String(el.dataset.species === species)));
    nameInput.placeholder = Store.petName({ species }, t);
  };

  for (const species of Store.SPECIES) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'species';
    card.dataset.species = species;
    card.setAttribute('role', 'radio');
    const img = document.createElement('img');
    img.src = Store.spriteUrl(species);
    img.alt = '';
    const label = document.createElement('span');
    label.textContent = t(Store.speciesKey(species));
    label.title = label.textContent;
    card.append(img, label);
    card.addEventListener('click', () => select(species));
    grid.append(card);
  }
  select(chosen);

  $('#adoptView').addEventListener('submit', async (e) => {
    e.preventDefault();
    await Store.savePet(chosen, nameInput.value);
    location.reload();
  });
}

/* ---------- Focus timer ---------- */

let timerState = null;

function renderClock() {
  if (!timerState) return;
  const { phase, status, endsAt, remainingMs, focusMin, breakMin } = timerState;
  const remaining = status === 'running' ? endsAt - Date.now() : remainingMs;
  const total = (phase === 'focus' ? focusMin : breakMin) * MINUTE;
  $('#clock').textContent = formatClock(remaining);
  $('#ringFg').style.strokeDashoffset = String(RING_LENGTH * (1 - Math.max(0, remaining) / total));
}

async function renderFocus() {
  timerState = await Store.get('timer');
  const { phase, status, focusMin, breakMin } = timerState;
  $('.ring').classList.toggle('break', phase === 'break');
  $('#phaseLabel').textContent = t(phase === 'focus' ? 'phaseFocus' : 'phaseBreak');
  const startKey = status === 'running' ? 'btnPause' : status === 'paused' ? 'btnResume' : 'btnStart';
  $('#btnStartPause').textContent = t(startKey);
  $('#btnStartPause').title = t(startKey);
  if (document.activeElement !== $('#focusMin')) $('#focusMin').value = focusMin;
  if (document.activeElement !== $('#breakMin')) $('#breakMin').value = breakMin;

  const { sessions } = await Store.getStats();
  $('#sessionsText').textContent = sessions === 0 ? t('sessionsTodayNone') : I18n.plural('sessionsToday', sessions);
  $('#focusTip').textContent = t('focusTip', [petName, I18n.number(Store.FOCUS_XP)]);
  renderClock();
}

function setupFocus() {
  const send = (action, payload) => chrome.runtime.sendMessage({ type: 'timer', action, payload }).then(renderFocus);
  $('#btnStartPause').addEventListener('click', () => send(timerState?.status === 'running' ? 'pause' : 'start'));
  $('#btnReset').addEventListener('click', () => send('reset'));
  const onLength = () => send('setLengths', { focusMin: $('#focusMin').value, breakMin: $('#breakMin').value });
  $('#focusMin').addEventListener('change', onLength);
  $('#breakMin').addEventListener('change', onLength);
  setInterval(renderClock, 500);
}

/* ---------- Timetable ---------- */

async function renderTimetable() {
  const classes = await Store.get('classes');
  const now = new Date();
  const today = now.getDay();
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const byStart = (a, b) => a.start.localeCompare(b.start);

  const next = classes.filter((c) => c.day === today && c.start > nowHHMM).sort(byStart)[0];
  $('#ttNext').textContent = !classes.length
    ? t('ttEmpty')
    : next
      ? t('ttNext', [next.name, formatTime(next.start)])
      : t('ttNothingLeftToday');

  const week = $('#ttWeek');
  week.replaceChildren();
  for (const day of weekOrder()) {
    const items = classes.filter((c) => c.day === day).sort(byStart);
    if (!items.length) continue;

    const block = document.createElement('div');
    block.className = 'day';
    const heading = document.createElement('div');
    heading.className = 'day-name';
    heading.textContent = weekdayName(day);
    if (day === today) {
      const tag = document.createElement('span');
      tag.className = 'today-tag';
      tag.textContent = t('ttToday');
      heading.append(tag);
    }
    block.append(heading);

    for (const c of items) {
      const item = document.createElement('div');
      item.className = 'class-item';
      const main = document.createElement('div');
      main.className = 'class-main';
      const name = document.createElement('div');
      name.className = 'class-name';
      name.textContent = c.name;
      const meta = document.createElement('div');
      meta.className = 'class-meta';
      meta.textContent = [t('ttTimeRange', [formatTime(c.start), formatTime(c.end)]), c.room].filter(Boolean).join(' · ');
      main.append(name, meta);

      const del = document.createElement('button');
      del.className = 'icon-btn';
      del.textContent = '×';
      del.title = t('btnDeleteClass', [c.name]);
      del.setAttribute('aria-label', del.title);
      del.addEventListener('click', async () => {
        await Store.set('classes', (await Store.get('classes')).filter((x) => x.id !== c.id));
        renderTimetable();
      });

      item.append(main, del);
      block.append(item);
    }
    week.append(block);
  }
}

function setupTimetable() {
  const select = $('#ttDay');
  for (const day of weekOrder()) select.add(new Option(weekdayName(day), String(day)));
  select.value = String(new Date().getDay());

  $('#ttForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = $('#ttError');
    const name = $('#ttName').value.trim();
    const start = $('#ttStart').value;
    const end = $('#ttEnd').value;
    error.hidden = true;
    if (!name) {
      error.textContent = t('errorClassNameRequired');
      error.hidden = false;
      return;
    }
    if (!start || !end || end <= start) {
      error.textContent = t('errorTimeOrder');
      error.hidden = false;
      return;
    }
    const classes = await Store.get('classes');
    classes.push({ id: crypto.randomUUID(), name, day: Number(select.value), start, end, room: $('#ttRoom').value.trim() });
    await Store.set('classes', classes);
    $('#ttName').value = '';
    $('#ttRoom').value = '';
    renderTimetable();
  });
}

/* ---------- Settings ---------- */

function languageLabel(code) {
  const tag = code.replace('_', '-');
  try {
    const native = new Intl.DisplayNames([tag], { type: 'language' }).of(tag);
    return `${native} (${code})`;
  } catch {
    return code;
  }
}

async function setupSettings() {
  const select = $('#langSelect');
  const { uiLocale = 'browser' } = await chrome.storage.local.get('uiLocale');
  const locales = await I18n.detectLocales();

  select.add(new Option(`${t('langBrowserDefault')} – ${chrome.i18n.getUILanguage()}`, 'browser'));
  for (const code of locales) select.add(new Option(languageLabel(code), code));
  select.add(new Option(t('langPseudo'), '__pseudo'));
  select.add(new Option(t('langKeys'), '__keys'));
  select.value = uiLocale;
  select.addEventListener('change', async () => {
    await chrome.storage.local.set({ uiLocale: select.value });
    location.reload();
  });

  if (I18n.state.error) {
    $('#langError').textContent = t('qaLoadError', [I18n.state.error]);
    $('#langError').hidden = false;
  }

  const pet = await Store.get('pet');
  const speciesSelect = $('#setSpecies');
  for (const species of Store.SPECIES) speciesSelect.add(new Option(t(Store.speciesKey(species)), species));
  speciesSelect.value = pet.species || 'cat';
  const nameInput = $('#setPetName');
  nameInput.value = pet.name;
  const updatePlaceholder = () => { nameInput.placeholder = Store.petName({ species: speciesSelect.value }, t); };
  updatePlaceholder();
  speciesSelect.addEventListener('change', updatePlaceholder);
  $('#petSettings').addEventListener('submit', async (e) => {
    e.preventDefault();
    await Store.savePet(speciesSelect.value, nameInput.value);
    $('#petSavedMsg').textContent = t('petSaved');
    $('#petSavedMsg').hidden = false;
    setTimeout(() => location.reload(), 700);
  });

  const { showPagePet = true } = await chrome.storage.local.get('showPagePet');
  $('#showPagePet').checked = showPagePet;
  $('#showPagePetLabel').textContent = t('settingsShowPet', [petName]);
  $('#showPagePet').addEventListener('change', (e) => chrome.storage.local.set({ showPagePet: e.target.checked }));

  $('#btnRunQa').addEventListener('click', () => runQa(select.value));

  $('#btnResetData').addEventListener('click', async () => {
    if (!confirm(t('confirmResetData', [petName]))) return;
    await chrome.storage.local.remove(['pet', 'timer', 'stats', 'classes']);
    await chrome.runtime.sendMessage({ type: 'timer', action: 'reset' });
    location.reload();
  });

  $('#version').textContent = t('aboutVersion', [chrome.runtime.getManifest().version]);
}

async function runQa(code) {
  const box = $('#qaResults');
  box.replaceChildren();
  const message = (text, cls) => {
    const p = document.createElement('p');
    p.textContent = text;
    if (cls) p.className = cls;
    box.append(p);
  };

  if (!code || code.startsWith('__') || code === 'browser' || code === I18n.SOURCE_LOCALE) {
    message(t('qaChooseLanguage'));
    return;
  }

  let source;
  let target;
  try {
    source = await I18n.loadJson(`_locales/${I18n.SOURCE_LOCALE}/messages.json`);
    target = await I18n.loadJson(`_locales/${code}/messages.json`);
  } catch (err) {
    message(t('qaLoadError', [err.message]), 'error');
    return;
  }

  const issues = LocaleQA.check(source, target, code, t);
  if (!issues.length) {
    message(t('qaAllGood'), 'qa-ok');
    return;
  }
  message(I18n.plural('qaSummary', issues.length));
  const list = document.createElement('ul');
  for (const issue of issues) {
    const li = document.createElement('li');
    const keyEl = document.createElement('code');
    keyEl.textContent = issue.key;
    li.append(keyEl, ` ${issue.text}`);
    list.append(li);
  }
  box.append(list);
}

/* ---------- Boot ---------- */

async function main() {
  await I18n.init();
  I18n.applyToDom();
  petName = Store.petName(await Store.get('pet'), t);

  setupPet();
  setupAdopt();
  setupFocus();
  setupTimetable();
  await setupTabs();
  await Promise.all([renderPet(), renderFocus(), renderTimetable(), setupSettings()]);

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.timer || changes.stats) renderFocus();
    if (changes.pet) renderPet();
  });
}

main();
