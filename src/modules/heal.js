window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installHealModule = function installHealModule(bot) {
  const configStorageKey = "minibiaBot.heal.config";
  const state = {
    running: false,
    timerId: null,
    lastHpHealAt: 0,
    lastManaHealAt: 0,
  };

  const config = Object.assign(
    {
      tickMs: 1000,
      healCooldownMs: 1200,
      minHp: 250,
      hpHotbarSlot: 1,
      minMana: 150,
      manaHotbarSlot: 2,
      enabled: false,
    },
    bot.storage.get(configStorageKey, {})
  );

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }

  function readStats() {
    const playerState = bot.getPlayerSnapshot?.();

    return playerState
      ? {
          hp: {
            current: Number(playerState.health ?? 0),
            max: Number(playerState.maxHealth ?? 0),
          },
          mana: {
            current: Number(playerState.mana ?? 0),
            max: Number(playerState.maxMana ?? 0),
          },
        }
      : { hp: null, mana: null };
  }

  function normalizeHotbarSlot(slot) {
    const value = Number(slot);
    if (!Number.isFinite(value)) {
      return null;
    }

    const normalized = Math.trunc(value);
    if (normalized < 1 || normalized > 12) {
      return null;
    }

    return normalized;
  }

  function canUseHpHeal(now = Date.now()) {
    const { hp } = readStats();
    const slot = normalizeHotbarSlot(config.hpHotbarSlot);
    if (!hp || !slot) return false;

    return hp.current > 0 && hp.current <= Math.max(0, Number(config.minHp) || 0) && now - state.lastHpHealAt >= config.healCooldownMs;
  }

  function canUseManaHeal(now = Date.now()) {
    const { mana } = readStats();
    const slot = normalizeHotbarSlot(config.manaHotbarSlot);
    if (!mana || !slot) return false;

    return mana.current <= Math.max(0, Number(config.minMana) || 0) && now - state.lastManaHealAt >= config.healCooldownMs;
  }

  function triggerHpHeal(now = Date.now()) {
    if (!canUseHpHeal(now)) {
      return false;
    }

    const slot = normalizeHotbarSlot(config.hpHotbarSlot);
    const clicked = bot.clickHotbar(slot - 1);
    if (clicked) {
      state.lastHpHealAt = now;
      bot.log("used hp heal hotkey", { slot, minHp: config.minHp });
    }

    return clicked;
  }

  function triggerManaHeal(now = Date.now()) {
    if (!canUseManaHeal(now)) {
      return false;
    }

    const slot = normalizeHotbarSlot(config.manaHotbarSlot);
    const clicked = bot.clickHotbar(slot - 1);
    if (clicked) {
      state.lastManaHealAt = now;
      bot.log("used mana heal hotkey", { slot, minMana: config.minMana });
    }

    return clicked;
  }

  function tryHeal() {
    if (!config.enabled) {
      return false;
    }

    const now = Date.now();

    if (triggerHpHeal(now)) {
      return true;
    }

    return triggerManaHeal(now);
  }

  function scheduleNextTick() {
    if (!state.running) return;

    state.timerId = window.setTimeout(() => {
      tick();
    }, config.tickMs);
  }

  function tick() {
    if (!state.running) return;

    tryHeal();
    scheduleNextTick();
  }

  function start(overrides = {}) {
    Object.assign(config, overrides, { enabled: true });
    persistConfig();

    if (state.running) {
      bot.log("auto heal already running");
      return false;
    }

    state.running = true;
    bot.log("auto heal started", { ...config });
    tick();
    return true;
  }

  function stop() {
    state.running = false;

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    config.enabled = false;
    persistConfig();
    bot.log("auto heal stopped");
    return true;
  }

  function status() {
    return {
      running: state.running,
      config: { ...config },
      stats: readStats(),
      lastHpHealAt: state.lastHpHealAt,
      lastManaHealAt: state.lastManaHealAt,
    };
  }

  function updateConfig(nextConfig = {}) {
    if (Object.prototype.hasOwnProperty.call(nextConfig, "hpHotbarSlot")) {
      nextConfig.hpHotbarSlot = normalizeHotbarSlot(nextConfig.hpHotbarSlot) ?? config.hpHotbarSlot;
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "manaHotbarSlot")) {
      nextConfig.manaHotbarSlot = normalizeHotbarSlot(nextConfig.manaHotbarSlot) ?? config.manaHotbarSlot;
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "minHp")) {
      nextConfig.minHp = Math.max(0, Number(nextConfig.minHp) || 0);
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "minMana")) {
      nextConfig.minMana = Math.max(0, Number(nextConfig.minMana) || 0);
    }

    Object.assign(config, nextConfig);
    persistConfig();
    bot.log("auto heal config updated", { ...config });
    return { ...config };
  }

  if (config.enabled) {
    start();
  }

  bot.heal = {
    start,
    stop,
    status,
    updateConfig,
    readStats,
    tryHeal,
    canUseHpHeal,
    canUseManaHeal,
    triggerHpHeal,
    triggerManaHeal,
    normalizeHotbarSlot,
    config,
  };
};
