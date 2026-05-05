window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installTalkModule = function installTalkModule(bot) {
  const configStorageKey = "minibiaBot.talk.config";
  const defaultSystemPrompt =
    "You are a real player on a Tibia OT server called Minibia chatting in-game. Reply like a normal Tibia OT player with short, casual wording and natural grammar. Sound relaxed and human, not formal or polished. Always keep replies to under 180 characters, plain text only. Never say or imply that you are an AI, assistant, language model, automation, script, or bot under any circumstances. If someone asks whether you are a bot, say no";
  const defaultModel = "gemini-3-flash-preview";
  const minPollMs = 20000;
  const maxMessageAgeMs = 5 * 60 * 1000;
  const additionalGuidanceHeader = "Additional reply guidance:";
  const state = {
    running: false,
    timerId: null,
    pending: false,
    lastApiRequestAt: 0,
    lastReplyAt: 0,
    lastSentText: "",
    lastSentAt: 0,
    selfSenderNames: [],
    seenMessageKeys: [],
  };

  const config = Object.assign(
    {
      enabled: false,
      provider: "gemini",
      apiKey: "",
      model: defaultModel,
      pollMs: minPollMs,
      replyCooldownMs: 15000,
      systemPrompt: defaultSystemPrompt,
    },
    bot.storage.get(configStorageKey, {})
  );

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }

  function normalizeName(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getTrustedNames() {
    return new Set(
      (bot.panic?.config?.trustedNames || [])
        .map((name) => normalizeName(name))
        .filter(Boolean)
    );
  }

  function extractCustomSystemPrompt(value) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }

    if (text === defaultSystemPrompt) {
      return "";
    }

    const mergedPrefix = `${defaultSystemPrompt}\n\n${additionalGuidanceHeader}\n`;
    if (text.startsWith(mergedPrefix)) {
      return text.slice(mergedPrefix.length).trim();
    }

    return text;
  }

  function getEffectiveSystemPrompt() {
    const customSystemPrompt = extractCustomSystemPrompt(config.systemPrompt);
    return customSystemPrompt
      ? `${defaultSystemPrompt}\n\n${additionalGuidanceHeader}\n${customSystemPrompt}`
      : defaultSystemPrompt;
  }

  function sanitizeConfig() {
    config.provider = "gemini";
    config.apiKey = String(config.apiKey || "").trim();
    config.model = defaultModel;
    config.pollMs = Math.max(minPollMs, Number(config.pollMs) || minPollMs);
    config.replyCooldownMs = Math.max(0, Number(config.replyCooldownMs) || 15000);
    config.systemPrompt = extractCustomSystemPrompt(config.systemPrompt);
  }

  function trimSeenKeys() {
    const maxSeenKeys = 200;
    if (state.seenMessageKeys.length > maxSeenKeys) {
      state.seenMessageKeys = state.seenMessageKeys.slice(-maxSeenKeys);
    }
  }

  function rememberSeenKey(key) {
    if (!key || state.seenMessageKeys.includes(key)) {
      return;
    }

    state.seenMessageKeys.push(key);
    trimSeenKeys();
  }

  function hasSeenKey(key) {
    return !!key && state.seenMessageKeys.includes(key);
  }

  function rememberSeenMessages(messages) {
    messages.forEach((message) => rememberSeenKey(message?.key));
  }

  function rememberSelfSenderName(name) {
    const normalized = normalizeName(name);
    if (!normalized || state.selfSenderNames.includes(normalized)) {
      return;
    }

    state.selfSenderNames.push(normalized);
  }

  function getSelfSenderNames() {
    return new Set(
      [
        "you",
        bot.getPlayerName?.(),
        window.gameClient?.player?.name,
        window.gameClient?.player?.state?.name,
        ...state.selfSenderNames,
      ]
        .map((name) => normalizeName(name))
        .filter(Boolean)
    );
  }

  function extractSenderFromMessage(message) {
    const text = String(message || "").trim();
    if (!text) {
      return { sender: null, body: "" };
    }

    const patterns = [
      /^\[[^\]]+\]\s*([^:\n]{2,40}):\s+(.+)$/i,
      /^([^:\n]{2,40}):\s+(.+)$/i,
      /^([^:\n]{2,40})\s+says:\s+(.+)$/i,
      /^From\s+([^:\n]{2,40}):\s+(.+)$/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          sender: String(match[1] || "").trim() || null,
          body: String(match[2] || "").trim(),
        };
      }
    }

    return { sender: null, body: text };
  }

  function getRawChatEntries() {
    return (window.gameClient?.interface?.channelManager?.channels || []).flatMap((channel) =>
      (channel?.__contents || []).map((entry, index) => ({
        channelName: channel?.name || null,
        entry,
        index,
      }))
    );
  }

  function toChatMessage(rawEntry) {
    const entry = rawEntry?.entry || {};
    const rawMessage = String(entry?.message || entry?.text || "").trim();
    const parsed = extractSenderFromMessage(rawMessage);
    const sender =
      String(entry?.author || entry?.sender || entry?.name || parsed.sender || "").trim() || null;
    const body = String(entry?.text || parsed.body || rawMessage).trim();
    const time = entry?.__time || entry?.time || null;
    const key = [
      rawEntry?.channelName || "",
      time || "",
      sender || "",
      rawMessage || "",
      rawEntry?.index || 0,
    ].join("|");

    return {
      key,
      channelName: rawEntry?.channelName || null,
      sender,
      body,
      rawMessage,
      time,
    };
  }

  function getChatMessages() {
    return getRawChatEntries().map(toChatMessage).filter((entry) => entry.body);
  }

  function getMessageTimestamp(message) {
    const rawTime = message?.time;
    if (typeof rawTime === "number" && Number.isFinite(rawTime)) {
      return rawTime < 1e12 ? rawTime * 1000 : rawTime;
    }

    if (rawTime instanceof Date) {
      return rawTime.getTime();
    }

    const parsed = Date.parse(String(rawTime || ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function isSelfMessage(message) {
    return getSelfSenderNames().has(normalizeName(message?.sender));
  }

  function isTrustedMessage(message) {
    const senderName = normalizeName(message?.sender);
    if (!senderName) {
      return false;
    }

    return getTrustedNames().has(senderName);
  }

  function isBotRecentMessage(message) {
    const candidates = [message?.body, message?.rawMessage];
    return candidates.some((text) => bot.isRecentSentChat?.(text, 45000));
  }

  function isLikelyBotEcho(message) {
    const lastSentText = normalizeName(state.lastSentText);
    if (!lastSentText || !state.lastSentAt) {
      return false;
    }

    if (Date.now() - state.lastSentAt > 120000) {
      return false;
    }

    const messageTexts = [message?.body, message?.rawMessage]
      .map((text) => normalizeName(text))
      .filter(Boolean);

    const matched = messageTexts.some(
      (text) =>
        text === lastSentText ||
        text.includes(lastSentText) ||
        lastSentText.includes(text)
    );

    if (matched) {
      rememberSelfSenderName(message?.sender);
    }

    return matched;
  }

  function syncSelfSenderNames(messages) {
    messages.forEach((message) => {
      if (!message?.sender) {
        return;
      }

      if (isBotRecentMessage(message) || isLikelyBotEcho(message)) {
        rememberSelfSenderName(message.sender);
        rememberSeenKey(message.key);
      }
    });
  }

  function isTradeMessage(text) {
    const normalizedText = normalizeName(text);
    if (!normalizedText) {
      return false;
    }

    return /\b(sell|selling|buy|buying|trade|wtb|wts|offer|offers|bp|backpack|uh|uhs|sd|sds|runes?)\b/.test(
      normalizedText
    );
  }

  function isStatsQuestion(text) {
    const normalizedText = normalizeName(text);
    if (!normalizedText) {
      return false;
    }

    return /\b(level|lvl|ml|mlvl|magic level|stats|stat|hp|health|mana|cap|capacity|exp|experience)\b/.test(
      normalizedText
    );
  }

  function looksLikeSpellCast(text) {
    const normalizedText = normalizeName(text);
    if (!normalizedText) {
      return false;
    }

    if (/^[a-z]{2,10}(?:\s+[a-z]{2,10}){0,4}[!.,]?$/i.test(normalizedText)) {
      const spellWords = [
        "exura",
        "exori",
        "exevo",
        "adori",
        "utani",
        "utura",
        "utana",
        "exana",
        "exeta",
        "utevo",
        "adevo",
        "adura"
      ];

      if (spellWords.some((word) => normalizedText.includes(word))) {
        return true;
      }
    }

    return false;
  }

  function looksLikeFoodMessage(text) {
    const normalizedText = normalizeName(text);
    if (!normalizedText) {
      return false;
    }

    if (/^(?:munch|chomp|gulp|nom|slurp)[!.,]?$/.test(normalizedText)) {
      return true;
    }

    return (
      /\b(ate|eating|eat|drinking|drink|used|use|chomp|munch)\b/.test(normalizedText) &&
      /\b(food|ham|meat|fish|mushroom|egg|pear|shrimp|mana fluid|health potion|potion)\b/.test(normalizedText)
    );
  }

  function shouldReplyToMessage(message) {
    if (!message?.body || !message?.key) {
      return false;
    }

    if (message.channelName !== "Default") {
      rememberSeenKey(message.key);
      return false;
    }

    if (hasSeenKey(message.key)) {
      return false;
    }

    if (isSelfMessage(message)) {
      rememberSeenKey(message.key);
      return false;
    }

    if (isBotRecentMessage(message)) {
      rememberSeenKey(message.key);
      return false;
    }

    if (isLikelyBotEcho(message)) {
      rememberSeenKey(message.key);
      return false;
    }

    if (isTrustedMessage(message)) {
      rememberSeenKey(message.key);
      return false;
    }

    if (!message.sender) {
      rememberSeenKey(message.key);
      return false;
    }

    if (looksLikeSpellCast(message.body) || looksLikeFoodMessage(message.body)) {
      rememberSeenKey(message.key);
      return false;
    }

    return true;
  }

  function getRecentContextMessages(targetMessage) {
    return getChatMessages()
      .filter((message) => message.channelName === targetMessage.channelName)
      .filter((message) => !isSelfMessage(message))
      .filter((message) => !isBotRecentMessage(message))
      .filter((message) => !looksLikeSpellCast(message.body))
      .filter((message) => !looksLikeFoodMessage(message.body))
      .slice(-8);
  }

  function getPendingMessages() {
    const chatMessages = getChatMessages();
    syncSelfSenderNames(chatMessages);
    const replyableMessages = chatMessages.filter(shouldReplyToMessage);
    const targetMessage = replyableMessages[replyableMessages.length - 1] || null;
    if (!targetMessage) {
      return { targetMessage: null, pendingMessages: [] };
    }

    if (isSelfMessage(targetMessage)) {
      rememberSeenKey(targetMessage.key);
      return { targetMessage: null, pendingMessages: [] };
    }

    const messageTimestamp = getMessageTimestamp(targetMessage);
    if (messageTimestamp && Date.now() - messageTimestamp > maxMessageAgeMs) {
      rememberSeenMessages(
        replyableMessages.filter((message) => message.channelName === targetMessage.channelName)
      );
      return { targetMessage: null, pendingMessages: [] };
    }

    return {
      targetMessage,
      pendingMessages: replyableMessages.filter(
        (message) => message.channelName === targetMessage.channelName
      ),
    };
  }

  function buildPrompt(targetMessage, pendingMessages, contextMessages) {
    const playerSnapshot = bot.getPlayerSnapshot?.() || null;
    const statsQuestion = pendingMessages.some(
      (message) => isStatsQuestion(message.body) || isStatsQuestion(message.rawMessage)
    );
    const transcript = contextMessages
      .map((message) => `${message.sender || "system"}: ${message.body}`)
      .join("\n");
    const pendingTranscript = pendingMessages
      .map((message) => `${message.sender || "system"}: ${message.body}`)
      .join("\n");

    return [
      getEffectiveSystemPrompt(),
      "",
      "Reply once in this in-game chat after considering all new unseen messages.",
      "Rules:",
      "- Sound human and casual.",
      "- Stay in character as a Tibia OT player.",
      "- Use natural grammar, but keep it casual and not too formal.",
      "- Reply with exactly one short sentence.",
      "- Keep it under 180 characters.",
      "- Plain text only.",
      "- Do not advertise items, prices, buying, or selling unless the new message is clearly about trading.",
      "- Do not repeat your own earlier lines or echo the chat.",
      "- If someone asks about your level or stats, use the live player stats provided below instead of making them up.",
      "- Never say or imply that you are an AI, assistant, bot, prompt, policy, script, or automation.",
      "",
      `Channel: ${targetMessage.channelName || "default"}`,
      statsQuestion && playerSnapshot
        ? `Live player stats: level=${playerSnapshot.level ?? "unknown"}, magic level=${playerSnapshot.magicLevel ?? "unknown"}, hp=${playerSnapshot.health ?? "unknown"}/${playerSnapshot.maxHealth ?? "unknown"}, mana=${playerSnapshot.mana ?? "unknown"}/${playerSnapshot.maxMana ?? "unknown"}, cap=${playerSnapshot.capacity ?? "unknown"}, exp=${playerSnapshot.experience ?? "unknown"}`
        : "",
      "Recent chat:",
      transcript,
      "",
      "New unseen messages to consider, oldest to newest:",
      pendingTranscript,
      "",
      `Newest message from ${targetMessage.sender}: ${targetMessage.body}`,
      `Trade-related newest message: ${isTradeMessage(targetMessage.body) ? "yes" : "no"}`,
      "Reply text only:",
    ].join("\n");
  }

  async function generateGeminiReply(prompt) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": config.apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.9,
            topP: 0.95,
            maxOutputTokens: 80,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return (
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => String(part?.text || ""))
        .join(" ")
        .trim() || ""
    );
  }

  function sanitizeReply(text) {
    const singleLine = String(text || "")
      .replace(/\s+/g, " ")
      .replace(/^["'`]+|["'`]+$/g, "")
      .trim();

    if (!singleLine) {
      return "";
    }

    return singleLine.slice(0, 180).trim();
  }

  async function maybeRespond() {
    if (!state.running || state.pending || !config.enabled || !config.apiKey) {
      return false;
    }

    if (Date.now() - state.lastReplyAt < config.replyCooldownMs) {
      return false;
    }

    if (Date.now() - state.lastApiRequestAt < minPollMs) {
      return false;
    }

    const { targetMessage, pendingMessages } = getPendingMessages();
    if (!targetMessage || !pendingMessages.length) {
      return false;
    }

    state.pending = true;

    try {
      state.lastApiRequestAt = Date.now();
      const contextMessages = getRecentContextMessages(targetMessage);
      const prompt = buildPrompt(targetMessage, pendingMessages, contextMessages);
      const reply = sanitizeReply(await generateGeminiReply(prompt));

      rememberSeenMessages(pendingMessages);

      if (!reply) {
        bot.log("talk module skipped empty reply", {
          channelName: targetMessage.channelName,
          newestMessage: targetMessage.body,
          consideredMessages: pendingMessages.length,
        });
        return false;
      }

      const sent = bot.sendChat(reply);
      if (sent) {
        state.lastReplyAt = Date.now();
        state.lastSentAt = state.lastReplyAt;
        state.lastSentText = reply;
        bot.log("talk module replied", {
          channelName: targetMessage.channelName,
          sender: targetMessage.sender,
          message: targetMessage.body,
          consideredMessages: pendingMessages.length,
          reply,
        });
      }

      return sent;
    } finally {
      state.pending = false;
    }
  }

  function scheduleNextTick() {
    if (!state.running) {
      return;
    }

    state.timerId = window.setTimeout(async () => {
      try {
        await tick();
      } catch (error) {
        console.error("[minibia-bot] talk tick failed", error);
      }
    }, config.pollMs);
  }

  async function tick() {
    if (!state.running) {
      return;
    }

    try {
      await maybeRespond();
    } catch (error) {
      bot.log("talk module request failed", error?.message || error);
    }

    scheduleNextTick();
  }

  function seedSeenMessages() {
    rememberSelfSenderName(bot.getPlayerName?.());
    getChatMessages().forEach((message) => rememberSeenKey(message.key));
  }

  function start(overrides = {}) {
    Object.assign(config, overrides, { enabled: true });
    sanitizeConfig();
    persistConfig();

    if (!config.apiKey) {
      bot.log("talk module requires a Gemini API key");
      return false;
    }

    if (state.running) {
      bot.log("talk module already running");
      return false;
    }

    state.running = true;
    seedSeenMessages();
    bot.log("talk module started", {
      model: config.model,
      playerName: bot.getPlayerName?.(),
    });
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
    bot.log("talk module stopped");
    return true;
  }

  function status() {
    return {
      running: state.running,
      pending: state.pending,
      lastReplyAt: state.lastReplyAt,
      config: {
        ...config,
        apiKey: config.apiKey ? "***configured***" : "",
      },
    };
  }

  function updateConfig(nextConfig = {}) {
    Object.assign(config, nextConfig);
    sanitizeConfig();
    persistConfig();
    bot.log("talk config updated", {
      ...config,
      apiKey: config.apiKey ? "***configured***" : "",
    });
    return status().config;
  }

  sanitizeConfig();

  if (config.enabled && config.apiKey) {
    start();
  }

  bot.talk = {
    start,
    stop,
    status,
    updateConfig,
    getChatMessages,
    config,
  };
};
