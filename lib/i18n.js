/*
 * Tiny i18n layer on top of chrome.i18n.
 *
 * Modes (stored in chrome.storage.local as `uiLocale`):
 *   "browser"  – normal Chrome behaviour (chrome.i18n.getMessage)
 *   "<code>"   – force a locale from _locales/<code>/messages.json (for testing)
 *   "__pseudo" – pseudo-localised English (accents + ~35% expansion)
 *   "__keys"   – show message keys instead of text
 */
(function (global) {
  const SOURCE_LOCALE = 'en';

  // Locale folder names accepted by Chrome (developer.chrome.com/docs/extensions/reference/api/i18n#locales).
  const CHROME_LOCALES = [
    'ar', 'am', 'bg', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'en', 'en_AU', 'en_GB', 'en_US',
    'es', 'es_419', 'et', 'fa', 'fi', 'fil', 'fr', 'gu', 'he', 'hi', 'hr', 'hu', 'id', 'it',
    'ja', 'kn', 'ko', 'lt', 'lv', 'ml', 'mr', 'ms', 'nl', 'no', 'pl', 'pt_BR', 'pt_PT', 'ro',
    'ru', 'sk', 'sl', 'sr', 'sv', 'sw', 'ta', 'te', 'th', 'tr', 'uk', 'vi', 'zh_CN', 'zh_TW'
  ];
  const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];

  const PSEUDO_MAP = {
    a: 'á', b: 'ƀ', c: 'ç', d: 'ď', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ',
    l: 'ļ', m: 'ɱ', n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'ü', v: 'ṽ',
    w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž', A: 'Å', B: 'Ɓ', C: 'Ç', D: 'Đ', E: 'É', F: 'Ƒ', G: 'Ĝ',
    H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ', N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ',
    S: 'Š', T: 'Ţ', U: 'Ü', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž'
  };
  const TOKEN_RE = /(\$[A-Za-z0-9_@]+\$|\$\d|\$\$)/;

  let state = { mode: 'browser', locale: null, dict: null, fallback: null, error: null };

  let loadJson = async (path) => {
    const res = await fetch(chrome.runtime.getURL(path));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return JSON.parse(await res.text());
  };

  function pseudoText(text) {
    const parts = text.split(TOKEN_RE);
    const body = parts
      .map((part, i) => (i % 2 ? part : [...part].map((c) => PSEUDO_MAP[c] || c).join('')))
      .join('');
    const visible = text.replace(new RegExp(TOKEN_RE.source, 'g'), '').length;
    return `[${body}${'~'.repeat(Math.ceil(visible * 0.35))}]`;
  }

  function pseudoDict(source) {
    const out = {};
    for (const [key, entry] of Object.entries(source)) {
      out[key] = { ...entry, message: key === 'appLocale' ? entry.message : pseudoText(entry.message || '') };
    }
    return out;
  }

  async function init(options = {}) {
    if (options.loadJson) loadJson = options.loadJson;
    const { uiLocale = 'browser' } = await chrome.storage.local.get('uiLocale');
    state = { mode: 'browser', locale: null, dict: null, fallback: null, error: null };
    if (uiLocale === 'browser') return state;

    try {
      state.fallback = await loadJson(`_locales/${SOURCE_LOCALE}/messages.json`);
      if (uiLocale === '__pseudo') {
        state.mode = 'pseudo';
        state.dict = pseudoDict(state.fallback);
      } else if (uiLocale === '__keys') {
        state.mode = 'keys';
      } else {
        state.dict = await loadJson(`_locales/${uiLocale}/messages.json`);
        state.mode = 'override';
        state.locale = uiLocale;
      }
    } catch (err) {
      state = { mode: 'browser', locale: null, dict: null, fallback: null, error: String(err.message || err) };
    }
    return state;
  }

  function findEntry(dict, key) {
    if (!dict) return null;
    if (dict[key]) return dict[key];
    const lower = key.toLowerCase();
    const match = Object.keys(dict).find((k) => k.toLowerCase() === lower);
    return match ? dict[match] : null;
  }

  // Mirrors Chrome's substitution rules: $NAME$ -> placeholder content, then $1..$9 -> substitutions, $$ -> $.
  function format(entry, subs) {
    const placeholders = {};
    for (const [name, def] of Object.entries(entry.placeholders || {})) {
      placeholders[name.toLowerCase()] = def;
    }
    let msg = String(entry.message ?? '');
    msg = msg.replace(/\$([A-Za-z0-9_@]+)\$/g, (m, name) => {
      const def = placeholders[name.toLowerCase()];
      return def ? String(def.content ?? '') : m;
    });
    return msg.replace(/\$(\$|[1-9])/g, (m, d) => (d === '$' ? '$' : subs[Number(d) - 1] ?? ''));
  }

  function normaliseSubs(subs) {
    if (subs == null) return [];
    return (Array.isArray(subs) ? subs : [subs]).map(String);
  }

  function has(key) {
    if (state.mode === 'browser') return chrome.i18n.getMessage(key) !== '';
    return Boolean(findEntry(state.dict, key) || findEntry(state.fallback, key));
  }

  function t(key, subs) {
    const list = normaliseSubs(subs);
    if (state.mode === 'keys') return key;
    if (state.mode === 'browser') return chrome.i18n.getMessage(key, list) || key;
    const entry = findEntry(state.dict, key) || findEntry(state.fallback, key);
    return entry ? format(entry, list) : key;
  }

  function isValidLocale(tag) {
    try {
      return Intl.getCanonicalLocales(tag).length > 0;
    } catch {
      return false;
    }
  }

  // BCP 47 tag used for Intl formatting (dates, times, numbers, plural rules).
  function locale() {
    if (state.mode === 'override') return state.locale.replace('_', '-');
    if (state.mode === 'pseudo' || state.mode === 'keys') return 'en';
    const declared = chrome.i18n.getMessage('appLocale').replace('_', '-');
    return declared && isValidLocale(declared) ? declared : chrome.i18n.getUILanguage();
  }

  function dir() {
    return RTL_LANGS.includes(locale().split('-')[0]) ? 'rtl' : 'ltr';
  }

  function number(n) {
    return new Intl.NumberFormat(locale()).format(n);
  }

  // Looks up `${base}_${cldrCategory}` (e.g. _one, _few, _other) and falls back to `${base}_other`.
  function plural(base, count, extraSubs = []) {
    let category = 'other';
    try {
      category = new Intl.PluralRules(locale()).select(count);
    } catch { /* keep "other" */ }
    const key = has(`${base}_${category}`) ? `${base}_${category}` : `${base}_other`;
    if (state.mode === 'keys') return key;
    return t(key, [number(count), ...normaliseSubs(extraSubs)]);
  }

  function applyToDom(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    for (const attr of ['title', 'placeholder', 'aria-label']) {
      root.querySelectorAll(`[data-i18n-${attr}]`).forEach((el) => {
        el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`)));
      });
    }
    if (root === document) {
      document.documentElement.lang = locale();
      document.documentElement.dir = dir();
    }
  }

  async function detectLocales() {
    const found = await Promise.all(
      CHROME_LOCALES.map(async (code) => {
        try {
          const res = await fetch(chrome.runtime.getURL(`_locales/${code}/messages.json`));
          return res.ok ? code : null;
        } catch {
          return null;
        }
      })
    );
    return found.filter(Boolean);
  }

  global.I18n = {
    SOURCE_LOCALE,
    CHROME_LOCALES,
    init,
    t,
    has,
    plural,
    number,
    locale,
    dir,
    applyToDom,
    detectLocales,
    loadJson: (path) => loadJson(path),
    get state() {
      return state;
    }
  };
})(globalThis);
