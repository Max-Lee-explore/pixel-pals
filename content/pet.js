(() => {
  if (window.__pixelPalsLoaded) return;
  window.__pixelPalsLoaded = true;

  const TIPS = ['pagePetTip1', 'pagePetTip2', 'pagePetTip3', 'pagePetTip4', 'pagePetTip5', 'pagePetTip6'];
  const SIZE = 64;

  const STYLE = `
    :host { all: initial; }
    .wrap {
      position: fixed; bottom: 0; left: 24px; z-index: 2147483647;
      width: ${SIZE}px; height: ${SIZE}px;
      transition: left 4s linear;
      font-family: system-ui, -apple-system, "Segoe UI", "PingFang TC", "Microsoft JhengHei", sans-serif;
    }
    .pet { width: 100%; height: 100%; cursor: pointer; animation: hop .4s steps(2) infinite paused; }
    .wrap.walking .pet { animation-play-state: running; }
    .pet img { width: 100%; height: 100%; display: block; image-rendering: pixelated; }
    .wrap.flip .pet img { transform: scaleX(-1); }
    .bubble {
      position: absolute; bottom: ${SIZE + 6}px; left: 50%; transform: translateX(-50%);
      width: max-content; max-width: 220px;
      padding: 6px 10px; border-radius: 12px;
      background: #fff; color: #264653; border: 2px solid #264653;
      font-size: 13px; font-weight: 600; line-height: 1.35; text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,.12);
    }
    .bubble[hidden] { display: none; }
    .close {
      position: absolute; top: -4px; right: -8px;
      width: 20px; height: 20px; border-radius: 50%; border: 0;
      background: #264653; color: #fff; font-size: 13px; line-height: 20px; padding: 0;
      cursor: pointer; opacity: 0; transition: opacity .2s;
    }
    .wrap:hover .close { opacity: 1; }
    @keyframes hop { 50% { transform: translateY(-5px); } }
  `;

  let host = null;
  let bubbleTimeout = null;
  let walkTimeout = null;

  const loadJson = async (path) => {
    const res = await chrome.runtime.sendMessage({ type: 'loadJson', path });
    if (!res?.ok) throw new Error(res?.error || 'load failed');
    return res.data;
  };

  function say(text) {
    if (!host) return;
    const bubble = host.shadowRoot.querySelector('.bubble');
    bubble.textContent = text;
    bubble.hidden = false;
    clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(() => { bubble.hidden = true; }, 4000);
  }

  function scheduleWalk() {
    clearTimeout(walkTimeout);
    walkTimeout = setTimeout(() => {
      if (!host) return;
      const wrap = host.shadowRoot.querySelector('.wrap');
      const current = parseFloat(wrap.style.left) || 24;
      const target = Math.round(24 + Math.random() * Math.max(0, window.innerWidth - SIZE - 48));
      wrap.classList.toggle('flip', target < current);
      wrap.classList.add('walking');
      wrap.style.left = `${target}px`;
      setTimeout(() => wrap.classList.remove('walking'), 4000);
      scheduleWalk();
    }, 9000 + Math.random() * 12000);
  }

  async function onPetClick() {
    const { timer } = await chrome.storage.local.get('timer');
    if (timer?.status === 'running' && timer.phase === 'focus') {
      const minutes = Math.max(1, Math.ceil((timer.endsAt - Date.now()) / 60000));
      say(I18n.plural('pagePetMinutesLeft', minutes));
    } else {
      say(I18n.t(TIPS[Math.floor(Math.random() * TIPS.length)]));
    }
  }

  async function refresh() {
    if (!host) return;
    const pet = await Store.get('pet');
    const name = Store.petName(pet, I18n.t);
    const img = host.shadowRoot.querySelector('.pet img');
    img.src = Store.spriteUrl(pet.species);
    img.alt = name;
    const close = host.shadowRoot.querySelector('.close');
    close.title = I18n.t('pagePetHide', [name]);
    close.setAttribute('aria-label', close.title);
    host.shadowRoot.querySelector('.bubble').dir = I18n.dir();
  }

  async function mount() {
    if (host || !document.body) return;
    const { pet } = await chrome.storage.local.get('pet');
    if (!pet?.species) return;
    host = document.createElement('pixel-pals-pet');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>${STYLE}</style>
      <div class="wrap">
        <div class="bubble" hidden></div>
        <div class="pet" role="button" tabindex="0"><img alt=""></div>
        <button class="close">×</button>
      </div>`;
    root.querySelector('.pet').addEventListener('click', onPetClick);
    root.querySelector('.close').addEventListener('click', unmount);
    document.body.append(host);
    await refresh();
    scheduleWalk();
  }

  function unmount() {
    clearTimeout(walkTimeout);
    clearTimeout(bubbleTimeout);
    host?.remove();
    host = null;
  }

  async function start() {
    await I18n.init({ loadJson });
    const { showPagePet = true } = await chrome.storage.local.get('showPagePet');
    if (showPagePet) await mount();

    chrome.storage.onChanged.addListener(async (changes) => {
      if (changes.showPagePet) changes.showPagePet.newValue ? mount() : unmount();
      if (changes.uiLocale) await I18n.init({ loadJson });
      if (changes.pet || changes.uiLocale) {
        const { showPagePet: visible = true } = await chrome.storage.local.get('showPagePet');
        if (visible && !host) await mount();
        else await refresh();
      }
      const event = changes.pageEvent?.newValue;
      if (event && document.visibilityState === 'visible') {
        say(event.type === 'levelUp' ? I18n.t('reactLevelUp', [I18n.number(event.level)]) : I18n.t('pagePetFocusDone'));
      }
    });
  }

  start().catch(() => { /* extension reloaded or context invalidated */ });
})();
