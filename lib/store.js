(function (global) {
  const FOCUS_XP = 20;
  const MAX_FEEDS_PER_HOUR = 4;
  const HOUR = 60 * 60 * 1000;

  const SPECIES = ['cat', 'dog', 'rabbit', 'hamster'];
  const NAME_MAX = 12;

  const DEFAULTS = {
    pet: { species: null, name: '', happiness: 70, energy: 80, xp: 0, level: 1, feeds: [], sleepingUntil: 0, updatedAt: 0 },
    timer: { phase: 'focus', status: 'idle', endsAt: 0, remainingMs: 25 * 60 * 1000, focusMin: 25, breakMin: 5 },
    stats: { date: '', sessions: 0 },
    classes: [],
    showPagePet: true
  };

  const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));
  const todayKey = () => new Date().toLocaleDateString('en-CA');
  const xpForLevel = (level) => level * 50;

  async function get(key) {
    const data = await chrome.storage.local.get(key);
    const fallback = structuredClone(DEFAULTS[key]);
    if (data[key] === undefined) return fallback;
    return Array.isArray(fallback) || typeof fallback !== 'object' ? data[key] : { ...fallback, ...data[key] };
  }

  const set = (key, value) => chrome.storage.local.set({ [key]: value });

  // Happiness slowly drops and energy slowly recovers while the user is away.
  function decay(pet, now = Date.now()) {
    if (!pet.updatedAt) return { ...pet, updatedAt: now };
    const hours = (now - pet.updatedAt) / HOUR;
    return {
      ...pet,
      happiness: clamp(pet.happiness - hours * 3),
      energy: clamp(pet.energy + hours * 6),
      feeds: pet.feeds.filter((t) => now - t < HOUR),
      updatedAt: now
    };
  }

  function addXp(pet, amount) {
    let { xp, level } = pet;
    xp += amount;
    while (xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level += 1;
    }
    return { ...pet, xp, level };
  }

  const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const speciesKey = (species) => `species${capitalise(species)}`;

  function petName(pet, t) {
    const own = String(pet.name || '').trim();
    return own || t(`defaultName${capitalise(pet.species || 'cat')}`);
  }

  function spriteUrl(species, state = 'idle') {
    return chrome.runtime.getURL(`images/pets/${SPECIES.includes(species) ? species : 'cat'}-${state}.png`);
  }

  async function savePet(species, name) {
    const pet = await get('pet');
    pet.species = SPECIES.includes(species) ? species : 'cat';
    pet.name = String(name || '').trim().slice(0, NAME_MAX);
    if (!pet.updatedAt) pet.updatedAt = Date.now();
    await set('pet', pet);
    return pet;
  }

  async function updatePet(action) {
    const now = Date.now();
    let pet = decay(await get('pet'), now);
    const levelBefore = pet.level;
    let reaction = null;

    if (action === 'feed') {
      if (pet.feeds.length >= MAX_FEEDS_PER_HOUR) {
        reaction = 'reactFull';
      } else {
        pet = { ...pet, happiness: clamp(pet.happiness + 8), energy: clamp(pet.energy + 5), feeds: [...pet.feeds, now] };
        reaction = 'reactFeed';
      }
    } else if (action === 'play') {
      if (pet.energy < 15) {
        reaction = 'reactTooTired';
      } else {
        pet = addXp({ ...pet, happiness: clamp(pet.happiness + 15), energy: clamp(pet.energy - 15) }, 5);
        reaction = 'reactPlay';
      }
    } else if (action === 'nap') {
      pet = { ...pet, energy: clamp(pet.energy + 30), sleepingUntil: now + 4000 };
      reaction = 'reactNap';
    } else if (action === 'focusDone') {
      pet = addXp({ ...pet, happiness: clamp(pet.happiness + 10) }, FOCUS_XP);
    }

    await set('pet', pet);
    return { pet, reaction, levelUp: pet.level > levelBefore };
  }

  function moodKey(pet) {
    if (pet.energy < 20) return 'moodTired';
    if (pet.happiness >= 70) return 'moodHappy';
    if (pet.happiness >= 40) return 'moodOkay';
    return 'moodSad';
  }

  async function getStats() {
    const stats = await get('stats');
    return stats.date === todayKey() ? stats : { date: todayKey(), sessions: 0 };
  }

  async function addSession() {
    const stats = await getStats();
    stats.sessions += 1;
    await set('stats', stats);
    return stats;
  }

  global.Store = {
    SPECIES, NAME_MAX, DEFAULTS, FOCUS_XP,
    get, set, decay, updatePet, savePet, petName, speciesKey, spriteUrl, moodKey, xpForLevel, getStats, addSession
  };
})(globalThis);
