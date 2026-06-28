window.__minibiaCopilotBundle = window.__minibiaCopilotBundle || {};

window.__minibiaCopilotBundle.installRuneModule = function installRuneModule(bot) {
  const configStorageKey = "minibiaCopilot.rune.config";
  const state = {
    running: false,
    timerId: null,
    lastRuneAt: 0,
    lastGateReason: null,
    lastGateLoggedAt: 0,
    sentSinceStart: 0,
  };
  let resumeListenersAttached = false;

  const storedRuneConfig = bot.storage.get(configStorageKey, {}) || {};
  if (storedRuneConfig.minHpPercent === 50) delete storedRuneConfig.minHpPercent;
  if (storedRuneConfig.runeManaCost === 600) delete storedRuneConfig.runeManaCost;
  if (storedRuneConfig.minFoodSeconds === 30) delete storedRuneConfig.minFoodSeconds;
  const config = Object.assign(
    {
      tickMs: 250,
      minHpPercent: 30,
      minFoodSeconds: 5,
      runeSpellWords: "adori vita vis",
      runeManaCost: 100,
      runeCooldownMs: 3500,
      enabled: false,
    },
    storedRuneConfig
  );
  config.tickMs = 250;

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }

  function readStats() {
    const playerState = bot.getPlayerState();

    const hp = playerState
      ? { current: playerState.health ?? 0, max: playerState.maxHealth ?? 0 }
      : null;

    const mana = playerState
      ? { current: playerState.mana ?? 0, max: playerState.maxMana ?? 0 }
      : null;

    const foodText =
      document.querySelector('#skill-window div[skill="food"] .skill')?.textContent?.trim() ||
      null;

    let food = null;
    if (foodText) {
      const match = foodText.match(/^(\d{1,2}):(\d{2})$/);
      food = match
        ? {
            text: foodText,
            seconds: Number(match[1]) * 60 + Number(match[2]),
          }
        : { text: foodText, seconds: null };
    }

    return { hp, mana, food };
  }

  function getGateStatus(now = Date.now()) {
    const { hp, mana, food } = readStats();
    if (!hp || !mana) {
      return {
        hasStats: false,
        enoughHp: false,
        enoughMana: false,
        enoughFood: false,
        cooldownReady: false,
        cooldownRemainingMs: config.runeCooldownMs,
        canMakeRune: false,
      };
    }

    const hpPercent = hp.max > 0 ? (hp.current / hp.max) * 100 : 0;
    const enoughHp = hpPercent >= config.minHpPercent;
    const enoughMana = mana.current >= config.runeManaCost;
    const enoughFood = food?.seconds == null || food.seconds >= config.minFoodSeconds;
    const cooldownElapsedMs = now - state.lastRuneAt;
    const cooldownRemainingMs = Math.max(0, config.runeCooldownMs - cooldownElapsedMs);
    const cooldownReady = cooldownRemainingMs === 0;

    return {
      hasStats: true,
      enoughHp,
      enoughMana,
      enoughFood,
      cooldownReady,
      cooldownRemainingMs,
      canMakeRune: enoughHp && enoughMana && enoughFood && cooldownReady,
    };
  }

  function canMakeRune(now = Date.now()) {
    return getGateStatus(now).canMakeRune;
  }

  function describeGateFailure(gate) {
    if (!gate.hasStats) return "no player stats yet (player still loading?)";
    const reasons = [];
    if (!gate.enoughHp) {
      const stats = readStats();
      const hp = stats.hp;
      const pct = hp?.max > 0 ? Math.round((hp.current / hp.max) * 100) : 0;
      reasons.push(`HP ${pct}% < ${config.minHpPercent}%`);
    }
    if (!gate.enoughMana) {
      const stats = readStats();
      const mana = stats.mana;
      reasons.push(`mana ${mana?.current ?? 0} < ${config.runeManaCost}`);
    }
    if (!gate.enoughFood) {
      const stats = readStats();
      reasons.push(`food ${stats.food?.text || "?"} < ${config.minFoodSeconds}s`);
    }
    if (!gate.cooldownReady) {
      reasons.push(`cooldown ${Math.round(gate.cooldownRemainingMs)}ms`);
    }
    return reasons.length ? reasons.join("; ") : "unknown";
  }

  function findSpellByWords(words) {
    const target = String(words || "").trim().toLowerCase();
    if (!target) return null;
    let spellsMap = null;
    try {
      if (typeof Interface !== "undefined" && Interface?.prototype?.SPELLS) {
        spellsMap = Interface.prototype.SPELLS;
      }
    } catch (error) {}
    if (!spellsMap) return null;
    if (typeof spellsMap.forEach !== "function") return null;
    let found = null;
    spellsMap.forEach((spell, sid) => {
      if (found) return;
      if (String(spell?.words || "").trim().toLowerCase() === target) {
        found = { sid, spell };
      }
    });
    return found;
  }

  function castViaSpellbook(match) {
    const spellbook = window.gameClient?.player?.spellbook;
    if (!spellbook || typeof spellbook.castSpell !== "function") {
      return { sent: false, reason: "spellbook unavailable" };
    }

    try {
      if (spellbook.cooldowns?.has && typeof spellbook.__bucketFor === "function") {
        const bucket = spellbook.__bucketFor(match.sid);
        const sidOnCd = spellbook.cooldowns.has(match.sid);
        const bucketOnCd = spellbook.cooldowns.has(bucket);
        if (sidOnCd || bucketOnCd) {
          return { sent: false, reason: `spell-cooldown (sid:${sidOnCd ? "yes" : "no"}, bucket:${bucketOnCd ? "yes" : "no"})` };
        }
      }
    } catch (error) {}

    const manaBefore = Number(window.gameClient?.player?.state?.mana);

    try {
      spellbook.castSpell(match.sid);
    } catch (error) {
      return { sent: false, reason: `castSpell threw: ${error?.message || error}` };
    }

    const manaAfter = Number(window.gameClient?.player?.state?.mana);
    const manaSpent = Number.isFinite(manaBefore) && Number.isFinite(manaAfter) ? manaBefore - manaAfter : null;

    return { sent: true, manaBefore, manaAfter, manaSpent };
  }

  function castViaDefaultChannel(words) {
    const channelManager = window.gameClient?.interface?.channelManager;
    if (!channelManager || typeof channelManager.sendMessageText !== "function") return false;
    try {
      channelManager.sendMessageText(words, 0);
      return true;
    } catch (error) {
      bot.log("rune default-channel send threw", { error: error?.message || error });
      return false;
    }
  }

  function tryMakeRune() {
    const now = Date.now();
    const gate = getGateStatus(now);
    if (!gate.canMakeRune) {
      if (!gate.cooldownReady && gate.enoughHp && gate.enoughMana && gate.enoughFood && gate.hasStats) {
        return false;
      }
      const reason = describeGateFailure(gate);
      if (reason !== state.lastGateReason || now - state.lastGateLoggedAt > 15000) {
        state.lastGateReason = reason;
        state.lastGateLoggedAt = now;
        bot.log("rune maker waiting:", reason);
      }
      return false;
    }

    if (state.lastGateReason) {
      bot.log("rune maker gate cleared, casting", { spell: config.runeSpellWords });
      state.lastGateReason = null;
    }

    const match = findSpellByWords(config.runeSpellWords);
    let castOk = false;
    let path = "none";
    let lastSkipReason = null;
    let castDetail = null;

    if (match) {
      const result = castViaSpellbook(match);
      if (result.sent) {
        castOk = true;
        path = "spellbook";
        castDetail = result;
      } else {
        lastSkipReason = result.reason;
        path = "spellbook-blocked";
      }
    } else {
      lastSkipReason = "spell words not in Interface.SPELLS";
    }

    if (!castOk && lastSkipReason === "spellbook unavailable") {
      const sent = castViaDefaultChannel(config.runeSpellWords);
      if (sent) { castOk = true; path = "default-channel"; }
    }

    if (!castOk && !match) {
      const sent = castViaDefaultChannel(config.runeSpellWords);
      if (sent) { castOk = true; path = "default-channel"; }
      else if (bot.sendChat(config.runeSpellWords)) { castOk = true; path = "active-channel-fallback"; }
    }

    if (castOk) {
      state.lastRuneAt = now;
      state.sentSinceStart += 1;
      bot.log("rune cast sent", {
        spell: config.runeSpellWords,
        spellName: match?.spell?.name || "(custom)",
        path,
        manaSpent: castDetail?.manaSpent ?? "?",
        sentSinceStart: state.sentSinceStart,
      });
    } else {
      const reasonKey = "skip:" + (lastSkipReason || "unknown");
      if (reasonKey !== state.lastGateReason || now - state.lastGateLoggedAt > 5000) {
        state.lastGateReason = reasonKey;
        state.lastGateLoggedAt = now;
        bot.log("rune cast skipped", {
          spell: config.runeSpellWords,
          spellMatched: !!match,
          spellName: match?.spell?.name || "(unknown)",
          reason: lastSkipReason,
        });
      }
    }

    return castOk;
  }

  function scheduleNextTick() {
    if (!state.running) return;

    state.timerId = window.setTimeout(() => {
      tick();
    }, config.tickMs);
  }

  function runImmediateTick() {
    if (!state.running) return;

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    tick();
  }

  function handleResume() {
    if (document.hidden) {
      return;
    }

    runImmediateTick();
  }

  function attachResumeListeners() {
    if (resumeListenersAttached) {
      return;
    }

    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("focus", handleResume);
    window.addEventListener("pageshow", handleResume);
    resumeListenersAttached = true;
  }

  function detachResumeListeners() {
    if (!resumeListenersAttached) {
      return;
    }

    document.removeEventListener("visibilitychange", handleResume);
    window.removeEventListener("focus", handleResume);
    window.removeEventListener("pageshow", handleResume);
    resumeListenersAttached = false;
  }

  function tick() {
    if (!state.running) return;

    try {
      tryMakeRune();
    } catch (error) {
      bot.log("rune tick failed", error?.message || error);
    } finally {
      scheduleNextTick();
    }
  }

  function start(overrides = {}) {
    Object.assign(config, overrides, { enabled: true });
    config.tickMs = 250;
    persistConfig();

    if (state.running) {
      bot.log("rune maker already running");
      return false;
    }

    state.running = true;
    state.sentSinceStart = 0;
    state.lastGateReason = null;
    state.lastGateLoggedAt = 0;
    attachResumeListeners();
    bot.log("rune maker started", { ...config });
    tick();
    return true;
  }

  function stop(options = {}) {
    const shouldPersistEnabled = options.persistEnabled !== false;
    state.running = false;

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    detachResumeListeners();

    if (shouldPersistEnabled) {
      config.enabled = false;
      persistConfig();
    }
    bot.log("rune maker stopped");
    return true;
  }

  function status() {
    return {
      running: state.running,
      config: { ...config },
      stats: readStats(),
      gates: getGateStatus(),
      lastRuneAt: state.lastRuneAt,
      sentSinceStart: state.sentSinceStart,
      lastGateReason: state.lastGateReason,
    };
  }

  function updateConfig(nextConfig = {}) {
    Object.assign(config, nextConfig);
    config.tickMs = 250;
    persistConfig();
    bot.log("rune config updated", { ...config });
    return { ...config };
  }

  if (config.enabled) {
    start();
  }

  bot.rune = {
    start,
    stop,
    status,
    readStats,
    getGateStatus,
    canMakeRune,
    tryMakeRune,
    config,
    updateConfig,
  };

  bot.startRuneLoop = start;
  bot.stopRuneLoop = stop;
};
