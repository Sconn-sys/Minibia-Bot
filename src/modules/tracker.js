window.__minibiaCopilotBundle = window.__minibiaCopilotBundle || {};

window.__minibiaCopilotBundle.installTrackerModule = function installTrackerModule(bot) {
  const configStorageKey = "minibiaCopilot.tracker.config";
  const deathsStorageKey = "minibiaCopilot.tracker.deaths";
  const trackedStorageKey = "minibiaCopilot.tracker.tracked";
  const seenDeathsStorageKey = "minibiaCopilot.tracker.seenDeathKeys";

  const state = {
    running: false,
    pollTimerId: null,
    expireTimerId: null,
    lastPollAt: 0,
    lastOnlineSet: new Set(),
    lastError: null,
    pollInFlight: false,
  };

  const config = Object.assign(
    {
      pollIntervalMs: 120000,
      retentionMs: 30 * 60 * 1000,
      onlineUrl: "/api/online",
      characterApiUrlTemplate: "/api/character?name={name}",
      characterPageUrlTemplate: "/character.html?name={name}",
      enabled: false,
    },
    bot.storage.get(configStorageKey, {})
  );

  if (config.onlineUrl === "/online.html") {
    config.onlineUrl = "/api/online";
  }
  if (!config.characterApiUrlTemplate) {
    config.characterApiUrlTemplate = "/api/character?name={name}";
  }
  if (!config.characterPageUrlTemplate) {
    config.characterPageUrlTemplate = "/character.html?name={name}";
  }

  const validCategories = new Set(["enemy", "friendly"]);
  const defaultCategory = "enemy";

  function normalizeCategory(value) {
    const raw = String(value || "").trim().toLowerCase();
    return validCategories.has(raw) ? raw : defaultCategory;
  }

  function normalizeName(value) {
    return String(value || "").trim();
  }

  function normalizeKey(value) {
    return normalizeName(value).toLowerCase();
  }

  function normalizeTrackedNames(value) {
    const list = Array.isArray(value) ? value : [];
    const dedup = new Map();
    list.forEach((entry) => {
      if (entry == null) return;
      let name;
      let category;
      if (typeof entry === "string") {
        name = normalizeName(entry);
        category = defaultCategory;
      } else if (typeof entry === "object") {
        name = normalizeName(entry.name);
        category = normalizeCategory(entry.category);
      } else {
        return;
      }
      const key = normalizeKey(name);
      if (key) dedup.set(key, { name, category });
    });
    return Array.from(dedup.values());
  }

  let trackedPlayers = normalizeTrackedNames(bot.storage.get(trackedStorageKey, []));
  let recentDeaths = normalizeDeathRecords(bot.storage.get(deathsStorageKey, []));
  let seenDeathKeys = new Set(bot.storage.get(seenDeathsStorageKey, []) || []);

  function getPlayerCategory(name) {
    const key = normalizeKey(name);
    const found = trackedPlayers.find((p) => normalizeKey(p.name) === key);
    return found?.category || defaultCategory;
  }

  function getTrackedNamesArray() {
    return trackedPlayers.map((p) => p.name);
  }

  function normalizeDeathRecords(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => {
        if (!entry) return null;
        const name = normalizeName(entry.name);
        const at = Number(entry.at);
        if (!name || !Number.isFinite(at)) return null;
        return {
          name,
          at,
          level: entry.level ?? null,
          description: String(entry.description || ""),
          dedupKey: String(entry.dedupKey || ""),
        };
      })
      .filter(Boolean);
  }

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }
  function persistTracked() {
    bot.storage.set(trackedStorageKey, trackedPlayers);
  }
  function persistDeaths() {
    bot.storage.set(deathsStorageKey, recentDeaths);
  }
  function persistSeenDeathKeys() {
    bot.storage.set(seenDeathsStorageKey, Array.from(seenDeathKeys));
  }

  function expireOldDeaths(now = Date.now()) {
    const cutoff = now - Math.max(60000, Number(config.retentionMs) || 1800000);
    const next = recentDeaths.filter((entry) => entry.at >= cutoff);
    if (next.length !== recentDeaths.length) {
      recentDeaths = next;
      persistDeaths();
      const keep = new Set(next.map((d) => d.dedupKey).filter(Boolean));
      const newSeen = new Set();
      seenDeathKeys.forEach((key) => {
        if (keep.has(key)) newSeen.add(key);
      });
      if (newSeen.size !== seenDeathKeys.size) {
        seenDeathKeys = newSeen;
        persistSeenDeathKeys();
      }
      try { bot.ui?.refreshTrackerStatus?.(); } catch (error) {}
    }
  }

  function buildCharacterApiUrl(name) {
    const template = String(config.characterApiUrlTemplate || "/api/character?name={name}");
    return template.replace("{name}", encodeURIComponent(name));
  }

  function buildCharacterPageUrl(name) {
    const template = String(config.characterPageUrlTemplate || "/character.html?name={name}");
    return template.replace("{name}", encodeURIComponent(name));
  }

  async function fetchAny(url) {
    const response = await fetch(url, {
      credentials: "include",
      headers: { "Accept": "application/json, text/html;q=0.9, */*;q=0.5" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }
    const contentType = String(response.headers.get("content-type") || "");
    const text = await response.text();
    let json = null;
    if (contentType.includes("application/json")) {
      try { json = JSON.parse(text); } catch (error) {}
    }
    if (json == null && text && (text[0] === "{" || text[0] === "[")) {
      try { json = JSON.parse(text); } catch (error) {}
    }
    return { text, json, contentType };
  }

  function parseHtml(html) {
    try {
      const parser = new DOMParser();
      return parser.parseFromString(html, "text/html");
    } catch (error) {
      return null;
    }
  }

  function collectStrings(value, key, out) {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => collectStrings(entry, key, out));
      return;
    }
    if (typeof value === "object") {
      const candidate = value[key];
      if (typeof candidate === "string") {
        const trimmed = candidate.trim();
        if (trimmed) out.add(trimmed);
      }
      Object.keys(value).forEach((subKey) => collectStrings(value[subKey], key, out));
    }
  }

  function extractOnlineNamesFromJson(json) {
    if (!json) return new Set();
    const out = new Set();
    const arrayCandidate =
      (Array.isArray(json) && json) ||
      json.players ||
      json.online ||
      json.list ||
      json.results ||
      json.data ||
      null;
    if (Array.isArray(arrayCandidate)) {
      arrayCandidate.forEach((entry) => {
        if (typeof entry === "string") {
          const trimmed = entry.trim();
          if (trimmed) out.add(trimmed);
        } else if (entry && typeof entry === "object") {
          const candidates = [entry.name, entry.character, entry.playerName, entry.character_name, entry.charname];
          for (const candidate of candidates) {
            if (typeof candidate === "string" && candidate.trim()) {
              out.add(candidate.trim());
              break;
            }
          }
        }
      });
    }
    if (!out.size) {
      collectStrings(json, "name", out);
    }
    return out;
  }

  function extractOnlineNamesFromHtml(doc) {
    if (!doc) return new Set();
    const names = new Set();
    const anchors = doc.querySelectorAll('a[href*="character.html"]');
    anchors.forEach((anchor) => {
      const href = anchor.getAttribute("href") || "";
      const match = href.match(/[?&]name=([^&#]+)/i);
      const name = match
        ? decodeURIComponent(match[1].replace(/\+/g, " ")).trim()
        : (anchor.textContent || "").trim();
      if (name) names.add(name);
    });
    return names;
  }

  function extractOnlineNames(result) {
    if (!result) return new Set();
    if (result.json) {
      const fromJson = extractOnlineNamesFromJson(result.json);
      if (fromJson.size) return fromJson;
    }
    if (result.text) {
      return extractOnlineNamesFromHtml(parseHtml(result.text));
    }
    return new Set();
  }

  function extractCharacterDeathsFromJson(json, name) {
    if (!json) return [];
    const out = [];
    const lowerName = name.toLowerCase();

    function tryArray(candidate) {
      if (!Array.isArray(candidate)) return;
      candidate.forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        const dateRaw =
          entry.date || entry.time || entry.timestamp || entry.at || entry.died_at || entry.created_at || null;
        const at = dateRaw == null ? null :
          (typeof dateRaw === "number" ? (dateRaw < 1e12 ? dateRaw * 1000 : dateRaw) : parseDeathDate(String(dateRaw)));
        if (at == null) return;
        const level = entry.level != null ? Number(entry.level) : null;
        const description = String(
          entry.description || entry.cause || entry.killer || entry.text || entry.message || ""
        ).trim();
        const dedupKey = `${lowerName}|${at}|${description.slice(0, 60).toLowerCase()}`;
        out.push({ name, at, level: Number.isFinite(level) ? level : null, description, dedupKey });
      });
    }

    tryArray(json.deaths);
    if (!out.length) tryArray(json.death_history);
    if (!out.length) tryArray(json.deathlist);
    if (!out.length && json.character) {
      tryArray(json.character.deaths);
      tryArray(json.character.death_history);
    }
    return out;
  }

  function parseDeathDate(raw) {
    if (!raw) return null;
    const direct = Date.parse(raw);
    if (Number.isFinite(direct)) return direct;
    const isoLike = String(raw).trim().replace(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(:\d{2})?)/, "$1T$2");
    const second = Date.parse(isoLike);
    if (Number.isFinite(second)) return second;
    const monthMatch = String(raw).match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})[ ,]+(\d{1,2}):(\d{2})/);
    if (monthMatch) {
      const probe = Date.parse(`${monthMatch[2]} ${monthMatch[1]} ${monthMatch[3]} ${monthMatch[4]}:${monthMatch[5]}`);
      if (Number.isFinite(probe)) return probe;
    }
    return null;
  }

  function extractCharacterDeaths(doc, name) {
    if (!doc) return [];
    const lowerName = name.toLowerCase();
    const deaths = [];

    const rows = doc.querySelectorAll("tr, li, .death, .death-entry, [data-death]");
    rows.forEach((row) => {
      const text = (row.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return;

      if (!/(died|killed by|slain|death)/i.test(text)) {
        if (!/\b\d{4}-\d{2}-\d{2}\b/.test(text) && !/\b\d{1,2}\s+\w+\s+\d{4}\b/.test(text)) {
          return;
        }
      }

      let at = null;
      const cells = row.querySelectorAll("td, span, time, .death-date, [data-date]");
      cells.forEach((cell) => {
        if (at != null) return;
        const candidate = cell.getAttribute?.("datetime") || cell.getAttribute?.("data-date") || cell.textContent;
        const parsed = parseDeathDate(candidate);
        if (parsed != null) at = parsed;
      });
      if (at == null) {
        const dateGuess = text.match(/(\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(?::\d{2})?)|(\d{1,2}\s+[A-Za-z]+\s+\d{4}[,\s]+\d{1,2}:\d{2})/);
        if (dateGuess) at = parseDeathDate(dateGuess[0]);
      }
      if (at == null) return;

      const levelMatch = text.match(/(?:level|lvl)\s*[:\-]?\s*(\d+)/i);
      const level = levelMatch ? Number(levelMatch[1]) : null;

      let description = text;
      const colonIndex = text.indexOf(",");
      if (colonIndex > 0 && colonIndex < 60) description = text.slice(colonIndex + 1).trim();
      if (description.length > 240) description = description.slice(0, 240) + "…";

      const dedupKey = `${lowerName}|${at}|${description.slice(0, 60).toLowerCase()}`;
      deaths.push({ name, at, level, description, dedupKey });
    });

    const dedup = new Map();
    deaths.forEach((entry) => {
      if (!dedup.has(entry.dedupKey)) dedup.set(entry.dedupKey, entry);
    });
    return Array.from(dedup.values()).sort((a, b) => a.at - b.at);
  }

  async function fetchCharacterDeaths(name) {
    try {
      const apiResult = await fetchAny(buildCharacterApiUrl(name));
      if (apiResult.json) {
        const fromJson = extractCharacterDeathsFromJson(apiResult.json, name);
        if (fromJson.length) return fromJson;
      }
      if (apiResult.text && !apiResult.json) {
        const fromHtml = extractCharacterDeaths(parseHtml(apiResult.text), name);
        if (fromHtml.length) return fromHtml;
      }
    } catch (error) {
      bot.log("tracker: character api fetch failed, falling back to page", {
        name,
        error: error?.message || String(error),
      });
    }

    try {
      const pageResult = await fetchAny(buildCharacterPageUrl(name));
      if (pageResult.json) {
        const fromJson = extractCharacterDeathsFromJson(pageResult.json, name);
        if (fromJson.length) return fromJson;
      }
      return extractCharacterDeaths(parseHtml(pageResult.text), name);
    } catch (error) {
      bot.log("tracker: character page fetch failed", {
        name,
        error: error?.message || String(error),
      });
      return [];
    }
  }

  async function pollOnce(now = Date.now()) {
    if (state.pollInFlight) return false;
    state.pollInFlight = true;

    const previousOnlineKeys = state.lastOnlineSet;
    const isFirstPoll = previousOnlineKeys.size === 0 && !state.lastPollAt;

    try {
      const onlineResult = await fetchAny(config.onlineUrl);
      const onlineNames = extractOnlineNames(onlineResult);

      const onlineKeys = new Set();
      onlineNames.forEach((n) => onlineKeys.add(normalizeKey(n)));
      state.lastOnlineSet = onlineKeys;

      if (!isFirstPoll) {
        for (const trackedPlayer of trackedPlayers) {
          const trackedName = trackedPlayer.name;
          const key = normalizeKey(trackedName);
          const wasOnline = previousOnlineKeys.has(key);
          const isOnlineNow = onlineKeys.has(key);
          if (!wasOnline && isOnlineNow) {
            try {
              bot.ui?.showTrackerNotification?.("login", trackedName, { category: trackedPlayer.category });
            } catch (error) {}
            bot.log("tracker: login observed", { name: trackedName, category: trackedPlayer.category });
          }
        }
      }

      const cutoff = now - Math.max(60000, Number(config.retentionMs) || 1800000);
      let appended = 0;
      const newDeathsForNotifications = [];

      for (const trackedPlayer of trackedPlayers) {
        const trackedName = trackedPlayer.name;
        const deaths = await fetchCharacterDeaths(trackedName);
        for (const death of deaths) {
          if (death.at < cutoff) continue;
          if (seenDeathKeys.has(death.dedupKey)) continue;
          seenDeathKeys.add(death.dedupKey);
          recentDeaths.push(death);
          appended += 1;
          if (!isFirstPoll) newDeathsForNotifications.push(death);
          bot.log("tracker: new death observed", {
            name: death.name,
            at: new Date(death.at).toISOString(),
            level: death.level,
            description: death.description.slice(0, 80),
          });
        }
      }

      if (appended > 0) {
        recentDeaths.sort((a, b) => a.at - b.at);
        persistDeaths();
        persistSeenDeathKeys();
      }

      newDeathsForNotifications.forEach((death) => {
        const category = getPlayerCategory(death.name);
        try {
          bot.ui?.showTrackerNotification?.("death", death.name, { ...death, category });
        } catch (error) {}
      });

      state.lastPollAt = now;
      state.lastError = null;
      expireOldDeaths(now);
      try { bot.ui?.refreshTrackerStatus?.(); } catch (error) {}
      return true;
    } catch (error) {
      state.lastError = error?.message || String(error);
      bot.log("tracker: poll failed", { error: state.lastError });
      try { bot.ui?.refreshTrackerStatus?.(); } catch (error2) {}
      return false;
    } finally {
      state.pollInFlight = false;
    }
  }

  function schedulePoll() {
    stopPollTimer();
    if (!state.running) return;
    const interval = Math.max(30000, Math.min(600000, Number(config.pollIntervalMs) || 120000));
    state.pollTimerId = window.setInterval(() => {
      pollOnce().catch((error) => {
        bot.log("tracker: poll exception", error?.message || error);
      });
    }, interval);
  }

  function stopPollTimer() {
    if (state.pollTimerId != null) {
      window.clearInterval(state.pollTimerId);
      state.pollTimerId = null;
    }
  }

  function startExpireTimer() {
    if (state.expireTimerId != null) return;
    state.expireTimerId = window.setInterval(() => expireOldDeaths(), 30000);
  }

  function stopExpireTimer() {
    if (state.expireTimerId != null) {
      window.clearInterval(state.expireTimerId);
      state.expireTimerId = null;
    }
  }

  function start(overrides = {}) {
    Object.assign(config, overrides);
    config.enabled = true;
    persistConfig();
    if (state.running) {
      bot.log("tracker already running");
      return false;
    }
    state.running = true;
    schedulePoll();
    startExpireTimer();
    pollOnce().catch(() => {});
    bot.log("tracker started", {
      pollIntervalMs: config.pollIntervalMs,
      retentionMs: config.retentionMs,
      tracked: trackedPlayers.length,
    });
    return true;
  }

  function stop(options = {}) {
    const persistEnabled = options.persistEnabled !== false;
    state.running = false;
    stopPollTimer();
    stopExpireTimer();
    if (persistEnabled) {
      config.enabled = false;
      persistConfig();
    }
    bot.log("tracker stopped");
    return true;
  }

  function addTracked(name, category) {
    const normalized = normalizeName(name);
    if (!normalized) return null;
    const key = normalizeKey(normalized);
    const cat = normalizeCategory(category);
    if (trackedPlayers.some((p) => normalizeKey(p.name) === key)) return null;
    trackedPlayers.push({ name: normalized, category: cat });
    persistTracked();
    bot.log("tracker: added", { name: normalized, category: cat });
    if (state.running) pollOnce().catch(() => {});
    try { bot.ui?.refreshTrackerStatus?.(); } catch (error) {}
    return { name: normalized, category: cat };
  }

  function removeTracked(name) {
    const key = normalizeKey(name);
    const before = trackedPlayers.length;
    trackedPlayers = trackedPlayers.filter((p) => normalizeKey(p.name) !== key);
    if (before === trackedPlayers.length) return false;
    persistTracked();
    bot.log("tracker: removed", { name });
    try { bot.ui?.refreshTrackerStatus?.(); } catch (error) {}
    return true;
  }

  function setCategory(name, category) {
    const key = normalizeKey(name);
    const cat = normalizeCategory(category);
    const found = trackedPlayers.find((p) => normalizeKey(p.name) === key);
    if (!found) return false;
    if (found.category === cat) return true;
    found.category = cat;
    persistTracked();
    bot.log("tracker: category changed", { name: found.name, category: cat });
    try { bot.ui?.refreshTrackerStatus?.(); } catch (error) {}
    return true;
  }

  function getTrackedNames(category) {
    if (!category) return getTrackedNamesArray();
    const cat = normalizeCategory(category);
    return trackedPlayers.filter((p) => p.category === cat).map((p) => p.name);
  }

  function isOnline(name) {
    return state.lastOnlineSet.has(normalizeKey(name));
  }

  function getRecentDeaths(category, now = Date.now()) {
    expireOldDeaths(now);
    if (!category) return recentDeaths.slice().sort((a, b) => b.at - a.at);
    const cat = normalizeCategory(category);
    return recentDeaths
      .filter((d) => getPlayerCategory(d.name) === cat)
      .sort((a, b) => b.at - a.at);
  }

  function status() {
    const allNames = getTrackedNamesArray();
    const enemyNames = trackedPlayers.filter((p) => p.category === "enemy").map((p) => p.name);
    const friendlyNames = trackedPlayers.filter((p) => p.category === "friendly").map((p) => p.name);
    return {
      running: state.running,
      config: { ...config },
      tracked: allNames,
      trackedPlayers: trackedPlayers.map((p) => ({ ...p })),
      enemy: enemyNames,
      friendly: friendlyNames,
      online: allNames.filter((n) => isOnline(n)),
      offline: allNames.filter((n) => !isOnline(n)),
      enemyDeaths: getRecentDeaths("enemy"),
      friendlyDeaths: getRecentDeaths("friendly"),
      recentDeaths: getRecentDeaths(),
      lastPollAt: state.lastPollAt,
      lastError: state.lastError,
      pollInFlight: state.pollInFlight,
      onlineCount: state.lastOnlineSet.size,
    };
  }

  function updateConfig(nextConfig = {}) {
    Object.assign(config, nextConfig);
    persistConfig();
    if (state.running) schedulePoll();
    bot.log("tracker config updated", { ...config });
    return { ...config };
  }

  async function debugFetch(name) {
    if (!name) {
      const url = config.onlineUrl;
      try {
        const result = await fetchAny(url);
        const names = Array.from(extractOnlineNames(result));
        return {
          url,
          contentType: result.contentType,
          bodyLength: result.text?.length || 0,
          gotJson: !!result.json,
          sample: result.text?.slice(0, 600) || "",
          jsonSample: result.json ? JSON.stringify(result.json).slice(0, 600) : null,
          onlineSample: names.slice(0, 20),
          onlineCount: names.size || names.length,
        };
      } catch (error) {
        return { url, error: error?.message || String(error) };
      }
    }

    const apiUrl = buildCharacterApiUrl(name);
    const pageUrl = buildCharacterPageUrl(name);
    let apiResult = null;
    let pageResult = null;
    try { apiResult = await fetchAny(apiUrl); } catch (error) { apiResult = { error: error?.message || String(error) }; }
    try { pageResult = await fetchAny(pageUrl); } catch (error) { pageResult = { error: error?.message || String(error) }; }

    const apiDeaths = apiResult?.json ? extractCharacterDeathsFromJson(apiResult.json, name) : [];
    const pageDeaths = pageResult?.text ? extractCharacterDeaths(parseHtml(pageResult.text), name) : [];

    return {
      apiUrl,
      apiContentType: apiResult?.contentType,
      apiGotJson: !!apiResult?.json,
      apiSample: apiResult?.text?.slice(0, 600) || apiResult?.error || "",
      apiJsonSample: apiResult?.json ? JSON.stringify(apiResult.json).slice(0, 800) : null,
      apiDeaths,
      pageUrl,
      pageContentType: pageResult?.contentType,
      pageBodyLength: pageResult?.text?.length || 0,
      pageSample: pageResult?.text?.slice(0, 600) || pageResult?.error || "",
      pageDeaths,
    };
  }

  function clearDeaths() {
    recentDeaths = [];
    seenDeathKeys.clear();
    persistDeaths();
    persistSeenDeathKeys();
    try { bot.ui?.refreshTrackerStatus?.(); } catch (error) {}
    return true;
  }

  bot.addCleanup(() => {
    stopPollTimer();
    stopExpireTimer();
  });

  if (config.enabled) start();

  bot.tracker = {
    start,
    stop,
    status,
    updateConfig,
    addTracked,
    removeTracked,
    setCategory,
    getTrackedNames,
    getTrackedPlayers: () => trackedPlayers.map((p) => ({ ...p })),
    getPlayerCategory,
    isOnline,
    getRecentDeaths,
    pollOnce: () => pollOnce(),
    debugFetch,
    clearDeaths,
    config,
  };
};
