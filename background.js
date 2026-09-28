importScripts('lib/i18n.js', 'lib/store.js');

const ALARM = 'pip-timer';
const MINUTE = 60 * 1000;

async function notify(titleKey, bodyKey, subs) {
  await I18n.init();
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: I18n.t(titleKey),
    message: I18n.t(bodyKey, subs),
    priority: 1
  });
}

async function timerAction(action, payload = {}) {
  const timer = await Store.get('timer');
  const now = Date.now();

  if (action === 'start' && timer.status !== 'running') {
    timer.endsAt = now + timer.remainingMs;
    timer.status = 'running';
    await chrome.alarms.create(ALARM, { when: timer.endsAt });
  } else if (action === 'pause' && timer.status === 'running') {
    timer.remainingMs = Math.max(0, timer.endsAt - now);
    timer.status = 'paused';
    await chrome.alarms.clear(ALARM);
  } else if (action === 'reset') {
    Object.assign(timer, { phase: 'focus', status: 'idle', remainingMs: timer.focusMin * MINUTE });
    await chrome.alarms.clear(ALARM);
  } else if (action === 'setLengths') {
    timer.focusMin = Math.min(120, Math.max(1, Number(payload.focusMin) || timer.focusMin));
    timer.breakMin = Math.min(60, Math.max(1, Number(payload.breakMin) || timer.breakMin));
    if (timer.status === 'idle') {
      timer.remainingMs = (timer.phase === 'focus' ? timer.focusMin : timer.breakMin) * MINUTE;
    }
  }

  await Store.set('timer', timer);
  return timer;
}

async function onTimerFinished() {
  const timer = await Store.get('timer');
  if (timer.status !== 'running') return;
  await I18n.init();
  const petName = Store.petName(await Store.get('pet'), I18n.t);

  if (timer.phase === 'focus') {
    await Store.addSession();
    const { pet, levelUp } = await Store.updatePet('focusDone');
    Object.assign(timer, {
      phase: 'break',
      status: 'running',
      endsAt: Date.now() + timer.breakMin * MINUTE,
      remainingMs: timer.breakMin * MINUTE
    });
    await chrome.alarms.create(ALARM, { when: timer.endsAt });
    await Store.set('pageEvent', { type: levelUp ? 'levelUp' : 'focusDone', level: pet.level, at: Date.now() });
    await notify('notifFocusDoneTitle', 'notifFocusDoneBody', [petName, I18n.number(Store.FOCUS_XP), I18n.number(timer.breakMin)]);
  } else {
    Object.assign(timer, { phase: 'focus', status: 'idle', endsAt: 0, remainingMs: timer.focusMin * MINUTE });
    await notify('notifBreakDoneTitle', 'notifBreakDoneBody', [petName]);
  }
  await Store.set('timer', timer);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) onTimerFinished();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'timer') {
    timerAction(msg.action, msg.payload).then(sendResponse);
    return true;
  }
  if (msg?.type === 'loadJson') {
    if (!/^_locales\/[A-Za-z0-9_]+\/messages\.json$/.test(msg.path)) {
      sendResponse({ ok: false, error: 'Invalid path' });
      return false;
    }
    fetch(chrome.runtime.getURL(msg.path))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return JSON.parse(await res.text());
      })
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  }
  return false;
});
