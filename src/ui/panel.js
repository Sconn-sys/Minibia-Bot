window.__minibiaCopilotBundle = window.__minibiaCopilotBundle || {};

window.__minibiaCopilotBundle.installPanel = function installPanel(bot) {
  const panelPositionKey = "minibiaCopilot.ui.panelPosition";
  const panelCollapsedKey = "minibiaCopilot.ui.panelCollapsed";

  function destroy() {
    document.getElementById("minibia-copilot-panel")?.remove();
    document.getElementById("minibia-copilot-style")?.remove();
  }

  function savePanelPosition(position, key = panelPositionKey) {
    bot.storage.set(key, position);
  }

  function getSavedPanelPosition(key = panelPositionKey) {
    return bot.storage.get(key, null);
  }

  function savePanelCollapsed(collapsed) {
    bot.storage.set(panelCollapsedKey, !!collapsed);
  }

  function getSavedPanelCollapsed() {
    return !!bot.storage.get(panelCollapsedKey, false);
  }

  function refreshHomeLabel() {
    const homeLabel = document.getElementById("minibia-copilot-home");
    if (!homeLabel) return;

    const home = bot.pz?.getHomePz?.();
    homeLabel.textContent = home
      ? `Panic Runner Home: ${home.x}, ${home.y}, ${home.z}`
      : "Panic Runner Home: not set";
  }

  function refreshPanicStatus() {
    const unknownToggle = document.getElementById("minibia-copilot-panic-unknown");
    const healthToggle = document.getElementById("minibia-copilot-panic-health");
    const returnToggle = document.getElementById("minibia-copilot-panic-return");
    const status = bot.panic?.status?.();

    if (unknownToggle) {
      unknownToggle.checked = !!status?.config?.unknownPlayerEnabled;
    }

    if (healthToggle) {
      healthToggle.checked = !!status?.config?.healthLossEnabled;
    }

    if (returnToggle) {
      returnToggle.checked = !!status?.config?.returnToOriginEnabled;
    }
  }

  function refreshXrayStatus() {
    const status = bot.xray?.status?.();
    const me = bot.getPlayerPosition?.();
    const overlayButton = document.getElementById("minibia-copilot-xray-overlay-toggle");
    const overlayLabel = document.getElementById("minibia-copilot-xray-overlay-status");
    const floorSelect = document.getElementById("minibia-copilot-xray-floor-select");
    const formatFloorOffset = (floor) => {
      if (!me || floor == null) {
        return null;
      }

      const offset = me.z - floor;
      return offset === 0 ? "0" : offset > 0 ? `+${offset}` : `${offset}`;
    };

    if (overlayButton) {
      overlayButton.textContent = status?.config?.overlayEnabled ? "Disable Overlay" : "Enable Overlay";
    }

    if (overlayLabel) {
      const floorLabel = status?.config?.selectedFloor == null
        ? "all floors"
        : `${formatFloorOffset(status.config.selectedFloor) ?? "?"}`;
      overlayLabel.textContent = `${status?.config?.overlayEnabled ? "Overlay: on" : "Overlay: off"} • ${floorLabel}`;
    }

    if (floorSelect) {
      const floors = Array.from(
        new Set(
          (status?.visibleCreatures || [])
            .map((creature) => creature?.position?.z)
            .filter((floor) => floor != null)
        )
      ).sort((a, b) => a - b);
      const selectedFloor = status?.config?.selectedFloor;

      if (selectedFloor != null && !floors.includes(selectedFloor)) {
        floors.push(selectedFloor);
        floors.sort((a, b) => a - b);
      }

      floorSelect.innerHTML = "";

      const allOption = document.createElement("option");
      allOption.value = "all";
      allOption.textContent = "All floors";
      floorSelect.appendChild(allOption);

      floors.forEach((floor) => {
        const option = document.createElement("option");
        option.value = String(floor);
        const offsetLabel = formatFloorOffset(floor);
        option.textContent = offsetLabel == null
          ? String(floor)
          : offsetLabel;
        floorSelect.appendChild(option);
      });

      floorSelect.value = selectedFloor == null ? "all" : String(selectedFloor);
    }
  }

  function renderTrustedNames() {
    const list = document.getElementById("minibia-copilot-panic-trusted-list");
    if (!list) return;

    const trustedNames = bot.panic?.config?.trustedNames || [];
    list.innerHTML = "";

    if (!trustedNames.length) {
      const empty = document.createElement("div");
      empty.className = "mc-small-note";
      empty.textContent = "No trusted names saved.";
      list.appendChild(empty);
      return;
    }

    trustedNames.forEach((name, index) => {
      const row = document.createElement("div");
      row.className = "mc-list-row";

      const label = document.createElement("span");
      label.textContent = name;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "mc-small-button";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => {
        const nextNames = trustedNames.filter((_, currentIndex) => currentIndex !== index);
        bot.panic.updateConfig({ trustedNames: nextNames });
        renderTrustedNames();
      });

      row.appendChild(label);
      row.appendChild(removeButton);
      list.appendChild(row);
    });
  }

  function renderGameMasterNames() {
    const list = document.getElementById("minibia-copilot-panic-gm-list");
    if (!list) return;

    const gameMasterNames = bot.panic?.config?.gameMasterNames || [];
    list.innerHTML = "";

    if (!gameMasterNames.length) {
      const empty = document.createElement("div");
      empty.className = "mc-small-note";
      empty.textContent = "No game master names saved.";
      list.appendChild(empty);
      return;
    }

    gameMasterNames.forEach((name, index) => {
      const row = document.createElement("div");
      row.className = "mc-list-row";

      const label = document.createElement("span");
      label.textContent = name;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "mc-small-button";
      removeButton.textContent = "Remove";
      removeButton.addEventListener("click", () => {
        const nextNames = gameMasterNames.filter((_, currentIndex) => currentIndex !== index);
        bot.panic.updateConfig({ gameMasterNames: nextNames });
        renderGameMasterNames();
      });

      row.appendChild(label);
      row.appendChild(removeButton);
      list.appendChild(row);
    });
  }

  function refreshRuneStatus() {
    const runeToggle = document.getElementById("minibia-copilot-rune-enabled");
    const running = !!bot.rune?.status?.().running;

    if (runeToggle) {
      runeToggle.checked = running;
    }
  }

  function refreshAutoEatStatus() {
    const autoEatToggle = document.getElementById("minibia-copilot-auto-eat-enabled");
    if (!autoEatToggle) return;

    autoEatToggle.checked = !!bot.eat?.status?.().running;
  }

  function refreshAutoHealStatus() {
    const autoHealToggle = document.getElementById("minibia-copilot-auto-heal-enabled");
    if (!autoHealToggle) return;

    autoHealToggle.checked = !!bot.heal?.status?.().running;
  }

  function refreshAutoInvisibleStatus() {
    const autoInvisibleToggle = document.getElementById("minibia-copilot-auto-invisible-enabled");
    if (!autoInvisibleToggle) return;

    autoInvisibleToggle.checked = !!bot.invisible?.status?.().running;
  }

  function refreshAutoMagicShieldStatus() {
    const autoMagicShieldToggle = document.getElementById("minibia-copilot-auto-magic-shield-enabled");
    if (!autoMagicShieldToggle) return;

    autoMagicShieldToggle.checked = !!bot.magicShield?.status?.().running;
  }

  function refreshAutoAttackStatus() {
    const autoAttackToggle = document.getElementById("minibia-copilot-auto-attack-enabled");
    if (!autoAttackToggle) return;

    autoAttackToggle.checked = !!bot.attack?.status?.().running;
  }

  function refreshCaveStatus() {
    const statusLabel = document.getElementById("minibia-copilot-cave-status");
    const startButton = document.getElementById("minibia-copilot-cave-start");
    const stopButton = document.getElementById("minibia-copilot-cave-stop");
    const route = bot.cave?.getRoute?.() || [];
    const status = bot.cave?.status?.();

    if (statusLabel) {
      if (!route.length) {
        statusLabel.textContent = "Status: no waypoints";
      } else if (status?.running) {
        const waypointNumber = (status.currentIndex ?? 0) + 1;
        const distanceLabel =
          Number.isFinite(status?.distanceToWaypoint) && status.distanceToWaypoint >= 0
            ? `, dist ${status.distanceToWaypoint}`
            : "";
        statusLabel.textContent = `Status: running (${waypointNumber}/${route.length}${distanceLabel})`;
      } else {
        statusLabel.textContent = `Status: idle (${route.length} waypoint${route.length === 1 ? "" : "s"})`;
      }
    }

    if (startButton) {
      startButton.disabled = !route.length || !!status?.running;
    }

    if (stopButton) {
      stopButton.disabled = !status?.running;
    }
  }

  function refreshCavePresetControls() {
    const select = document.getElementById("minibia-copilot-cave-preset-select");
    const label = document.getElementById("minibia-copilot-cave-preset-status");
    const deleteButton = document.getElementById("minibia-copilot-cave-preset-delete");
    const status = bot.cave?.status?.();
    const presetNames = status?.presetNames || bot.cave?.getPresetNames?.() || [];
    const activePresetName = status?.activePresetName || bot.cave?.getActivePresetName?.() || "Default";

    if (select) {
      const previousValue = select.value;
      select.innerHTML = "";

      if (!presetNames.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No saved presets";
        select.appendChild(option);
        select.disabled = true;
      } else {
        presetNames.forEach((name) => {
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          select.appendChild(option);
        });
        select.disabled = false;
        const nextValue = presetNames.includes(activePresetName) ? activePresetName : previousValue;
        if (nextValue) {
          select.value = nextValue;
        }
      }
    }

    if (label) {
      label.textContent = presetNames.length
        ? `Preset: ${activePresetName} (${presetNames.length} saved)`
        : `Preset: ${activePresetName}`;
    }

    if (deleteButton) {
      deleteButton.disabled = !presetNames.length || !select?.value;
    }
  }

  function refreshCaveClosestStatus() {
    const label = document.getElementById("minibia-copilot-cave-closest");
    if (!label) return;

    const position = bot.getPlayerPosition?.();
    const route = bot.cave?.getRoute?.() || [];

    if (!position) {
      label.textContent = "Closest start: current position unavailable";
      return;
    }

    if (!route.length) {
      label.textContent = "Closest start: no waypoints";
      return;
    }

    const closestIndex = bot.cave?.findClosestWaypointIndex?.(position) ?? 0;
    const waypoint = route[closestIndex];

    if (!waypoint) {
      label.textContent = "Closest start: unavailable";
      return;
    }

    label.textContent = `Closest start: ${closestIndex + 1}. ${waypoint.x}, ${waypoint.y}, ${waypoint.z}`;
  }

  function refreshCaveTransitionStatus() {
    const label = document.getElementById("minibia-copilot-cave-transition-status");
    if (!label) return;

    const transitions = bot.cave?.getTransitions?.() || [];
    if (!transitions.length) {
      label.textContent = "Transitions learned: none";
      return;
    }

    const latest = transitions
      .slice()
      .sort((a, b) => Number(b?.lastSeenAt || 0) - Number(a?.lastSeenAt || 0))[0];

    if (!latest?.from || !latest?.to) {
      label.textContent = `Transitions learned: ${transitions.length}`;
      return;
    }

    const extra = transitions.length > 1 ? ` (+${transitions.length - 1} more)` : "";
    label.textContent =
      `Transitions learned: ${latest.from.x}, ${latest.from.y}, ${latest.from.z} -> ` +
      `${latest.to.x}, ${latest.to.y}, ${latest.to.z}${extra}`;
  }

  function refreshEquipRingStatus() {
    const equipRingToggle = document.getElementById("minibia-copilot-equip-ring-enabled");
    if (!equipRingToggle) return;

    equipRingToggle.checked = !!bot.equipRing?.status?.().running;
  }

  const tabStorageKey = "minibiaCopilot.ui.activeTab";
  const defaultTab = "status";
  const moduleSummaryDefs = [
    { key: "heal",        label: "Heal",   getRunning: () => !!bot.heal?.status?.().running },
    { key: "attack",      label: "Attack", getRunning: () => !!bot.attack?.status?.().running },
    { key: "rune",        label: "Rune",   getRunning: () => !!bot.rune?.status?.().running },
    { key: "eat",         label: "Eat",    getRunning: () => !!bot.eat?.status?.().running },
    { key: "invisible",   label: "Invis",  getRunning: () => !!bot.invisible?.status?.().running },
    { key: "shield",      label: "Shield", getRunning: () => !!bot.magicShield?.status?.().running },
    { key: "ring",        label: "Ring",   getRunning: () => !!bot.equipRing?.status?.().running },
    { key: "cave",        label: "Cave",   getRunning: () => !!bot.cave?.status?.().running },
    { key: "talk",        label: "Talk",   getRunning: () => !!bot.talk?.status?.().running },
    { key: "mw",          label: "MW",     getRunning: () => !!bot.magicWall?.status?.().running },
    { key: "hunt",        label: "Hunt",   getRunning: () => !!bot.hunt?.status?.().lastInfo?.active },
  ];

  function activateTab(name) {
    const panel = document.getElementById("minibia-copilot-panel");
    if (!panel) return;
    const buttons = panel.querySelectorAll(".mc-tab-button");
    const panes = panel.querySelectorAll(".mc-tab-pane");
    let matched = false;
    buttons.forEach((button) => {
      const isActive = button.dataset.tab === name;
      button.dataset.active = isActive ? "true" : "false";
      if (isActive) matched = true;
    });
    panes.forEach((pane) => {
      pane.hidden = pane.dataset.tab !== name;
    });
    if (!matched) return;
    try { bot.storage.set(tabStorageKey, name); } catch (error) {}
  }

  function refreshPlayerSnapshot() {
    const snapshot = bot.getPlayerSnapshot?.();
    const hpEl = document.getElementById("minibia-copilot-snapshot-hp");
    const manaEl = document.getElementById("minibia-copilot-snapshot-mana");
    const levelEl = document.getElementById("minibia-copilot-snapshot-level");
    if (hpEl) {
      const cur = snapshot?.health;
      const max = snapshot?.maxHealth;
      hpEl.textContent = cur != null && max != null ? `${cur}/${max}` : (cur != null ? String(cur) : "—");
    }
    if (manaEl) {
      const cur = snapshot?.mana;
      const max = snapshot?.maxMana;
      manaEl.textContent = cur != null && max != null ? `${cur}/${max}` : (cur != null ? String(cur) : "—");
    }
    if (levelEl) {
      levelEl.textContent = snapshot?.level != null ? String(snapshot.level) : "—";
    }
  }

  function refreshStatusPillbar() {
    const container = document.getElementById("minibia-copilot-pillbar");
    if (!container) return;
    const html = moduleSummaryDefs.map((def) => {
      let running = false;
      try { running = def.getRunning(); } catch (error) { running = false; }
      return `<span class="mc-pill" data-active="${running ? "true" : "false"}">${def.label}</span>`;
    }).join("");
    container.innerHTML = html;
  }

  function formatNumber(value) {
    if (value == null || !Number.isFinite(Number(value))) return "—";
    const n = Number(value);
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(2) + "M";
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(Math.round(n));
  }

  function formatElapsed(ms) {
    const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
    if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
    return `${s}s`;
  }

  function refreshHuntStatus() {
    const status = bot.hunt?.status?.();
    const info = status?.lastInfo;
    const statusLabel = document.getElementById("minibia-copilot-hunt-status");
    const stats = document.getElementById("minibia-copilot-hunt-stats");
    const topMonster = document.getElementById("minibia-copilot-hunt-top-monster");
    const topLoot = document.getElementById("minibia-copilot-hunt-top-loot");
    const autoPoll = document.getElementById("minibia-copilot-hunt-autopoll");

    if (autoPoll && document.activeElement !== autoPoll) {
      autoPoll.checked = !!status?.config?.autoPoll;
    }

    if (statusLabel) {
      if (!info) {
        statusLabel.textContent = "Status: no data (click Refresh)";
      } else if (!info.active) {
        statusLabel.textContent = "Status: no active session (click Start)";
      } else if (info.paused) {
        statusLabel.textContent = `Status: paused (${formatElapsed(info.elapsedMs)})`;
      } else {
        statusLabel.textContent = `Status: running (${formatElapsed(info.elapsedMs)})`;
      }
    }

    if (stats) {
      const shouldShow = !!info?.active;
      stats.hidden = !shouldShow;
      if (shouldShow) {
        stats.querySelector('[data-key="elapsed"]').textContent = formatElapsed(info.elapsedMs);
        stats.querySelector('[data-key="xpPerHour"]').textContent = formatNumber(info.xpPerHour);
        stats.querySelector('[data-key="goldPerHour"]').textContent = formatNumber(info.goldPerHour);
        stats.querySelector('[data-key="killsPerHour"]').textContent = formatNumber(info.killsPerHour);
        stats.querySelector('[data-key="xp"]').textContent = formatNumber(info.xp);
        stats.querySelector('[data-key="gold"]').textContent = formatNumber(info.gold);
      }
    }

    if (topMonster) {
      const monsters = Array.isArray(info?.monsters) ? info.monsters.slice().sort((a, b) => (b.count || 0) - (a.count || 0)) : [];
      if (!monsters.length) {
        topMonster.textContent = "Top kill: —";
      } else {
        const top3 = monsters.slice(0, 3).map((m) => `${m.name} ${formatNumber(m.count)}`).join(", ");
        topMonster.textContent = `Top kills: ${top3}`;
      }
    }

    if (topLoot) {
      const loot = Array.isArray(info?.loot) ? info.loot.slice().sort((a, b) => (b.count || 0) - (a.count || 0)) : [];
      if (!loot.length) {
        topLoot.textContent = "Top loot: —";
      } else {
        const top3 = loot.slice(0, 3).map((l) => `${l.name} ${formatNumber(l.count)}`).join(", ");
        topLoot.textContent = `Top loot: ${top3}`;
      }
    }
  }

  function refreshMagicWallStatus() {
    const enabledInput = document.getElementById("minibia-copilot-magic-wall-enabled");
    const audioInput = document.getElementById("minibia-copilot-magic-wall-audio");
    const durationInput = document.getElementById("minibia-copilot-magic-wall-duration");
    const leadInput = document.getElementById("minibia-copilot-magic-wall-lead");
    const statusLabel = document.getElementById("minibia-copilot-magic-wall-status");
    const status = bot.magicWall?.status?.();

    if (enabledInput) {
      enabledInput.checked = !!status?.running;
    }
    if (audioInput) {
      audioInput.checked = !!status?.config?.audioOnExpiry;
    }
    if (durationInput && document.activeElement !== durationInput) {
      const primary = status?.config?.patternSpecs?.find((spec) =>
        String(spec?.name || "").toLowerCase().includes("magic wall")
      );
      const seconds = primary ? Math.round((Number(primary.durationMs) || 20000) / 1000) : 20;
      durationInput.value = String(seconds);
    }
    if (leadInput && document.activeElement !== leadInput) {
      const lead = Math.round((Number(status?.config?.flashLeadMs) || 3000) / 1000);
      leadInput.value = String(lead);
    }
    if (statusLabel) {
      const activeCount = Array.isArray(status?.timers) ? status.timers.length : 0;
      if (!status?.running) {
        statusLabel.textContent = "Status: idle";
      } else if (activeCount === 0) {
        statusLabel.textContent = "Status: watching";
      } else {
        statusLabel.textContent = `Status: ${activeCount} active`;
      }
    }
  }

  function refreshTalkStatus() {
    const talkToggle = document.getElementById("minibia-copilot-talk-enabled");
    const statusLabel = document.getElementById("minibia-copilot-talk-status");
    const status = bot.talk?.status?.();

    if (talkToggle) {
      talkToggle.checked = !!status?.running;
    }

    if (statusLabel) {
      if (!status?.config?.apiKey) {
        statusLabel.textContent = "Status: API key missing";
      } else if (status?.pending) {
        statusLabel.textContent = "Status: generating";
      } else if (status?.running) {
        statusLabel.textContent = "Status: listening to Default";
      } else {
        statusLabel.textContent = "Status: idle";
      }
    }
  }

  function refreshVisibleCreatures() {
    const list = document.getElementById("minibia-copilot-visible-creatures-list");
    if (!list) return;

    const me = bot.getPlayerPosition?.();
    const status = bot.xray?.status?.();
    const creatures = status?.visibleCreatures || [];
    const selectedFloor = status?.config?.selectedFloor;
    list.innerHTML = "";

    if (!me) {
      const empty = document.createElement("div");
      empty.className = "mc-small-note";
      empty.textContent = "Current position unavailable.";
      list.appendChild(empty);
      return;
    }

    const getFloorOffset = (creature) => (creature.position?.z || 0) - me.z;
    const getFloorDistance = (creature) => Math.abs(getFloorOffset(creature));

    const visibleCreatures = creatures
      .filter((creature) => {
        const floor = creature?.position?.z;
        if (floor == null) {
          return false;
        }

        if (selectedFloor != null) {
          return floor === selectedFloor;
        }

        return floor !== me.z;
      })
      .sort((a, b) => {
      const floorDistanceDiff = getFloorDistance(a) - getFloorDistance(b);
      if (floorDistanceDiff !== 0) return floorDistanceDiff;

      const floorOffsetDiff = getFloorOffset(a) - getFloorOffset(b);
      if (floorOffsetDiff !== 0) return floorOffsetDiff;

      const aDist = Math.abs((a.position?.x || 0) - me.x) + Math.abs((a.position?.y || 0) - me.y);
      const bDist = Math.abs((b.position?.x || 0) - me.x) + Math.abs((b.position?.y || 0) - me.y);
      return aDist - bDist;
    });

    if (!visibleCreatures.length) {
      const empty = document.createElement("div");
      empty.className = "mc-small-note";
      empty.textContent = selectedFloor == null
        ? "No off-floor creatures."
        : `No creatures on floor ${selectedFloor}.`;
      list.appendChild(empty);
      return;
    }

    let currentFloor = null;

    visibleCreatures.forEach((creature) => {
      const floor = creature.position?.z;
      if (floor !== currentFloor) {
        currentFloor = floor;
        const floorOffset = me.z - floor;
        const floorOffsetLabel =
          floorOffset === 0 ? "0" : floorOffset > 0 ? `+${floorOffset}` : `${floorOffset}`;

        const floorLabel = document.createElement("div");
        floorLabel.className = "mc-floor-label";
        floorLabel.textContent = floorOffsetLabel;
        list.appendChild(floorLabel);
      }

      const row = document.createElement("div");
      row.className = "mc-creature-row";

      const name = document.createElement("div");
      name.className = "mc-creature-name";
      name.textContent = creature.name || (creature.type === 0 ? "Player" : "Mob");

      const meta = document.createElement("div");
      meta.className = "mc-small-note";
      meta.textContent = `${creature.type === 0 ? "Player" : "Mob"} at ${creature.position.x}, ${creature.position.y}, ${creature.position.z}`;

      row.appendChild(name);
      row.appendChild(meta);
      list.appendChild(row);
    });
  }

  function setPanelCollapsed(panel, collapsed) {
    if (!panel) return;

    const body = panel.querySelector(".mc-body");
    const toggle = panel.querySelector("#minibia-copilot-collapse");
    const nextCollapsed = !!collapsed;

    panel.dataset.collapsed = nextCollapsed ? "true" : "false";

    if (body) {
      body.hidden = nextCollapsed;
    }

    if (toggle) {
      toggle.textContent = nextCollapsed ? "+" : "−";
      toggle.setAttribute("aria-label", nextCollapsed ? "Maximize panel" : "Minimize panel");
      toggle.setAttribute("title", nextCollapsed ? "Maximize" : "Minimize");
    }

    savePanelCollapsed(nextCollapsed);
  }

  function applySavedPanelPosition(panel, key = panelPositionKey) {
    const position = getSavedPanelPosition(key);
    if (!position) return;

    if (typeof position.top === "number") {
      panel.style.top = `${position.top}px`;
    }

    if (typeof position.left === "number") {
      panel.style.left = `${position.left}px`;
      panel.style.right = "auto";
    }
  }

  function clampPanelPosition(panel, left, top) {
    const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);

    return {
      left: Math.min(Math.max(0, left), maxLeft),
      top: Math.min(Math.max(0, top), maxTop),
    };
  }

  function enableDrag(panel, key = panelPositionKey) {
    const handle = panel.querySelector(".mc-title");
    if (!handle) return;

    let dragState = null;

    const onMouseMove = (event) => {
      if (!dragState) return;

      const next = clampPanelPosition(
        panel,
        event.clientX - dragState.offsetX,
        event.clientY - dragState.offsetY
      );

      panel.style.left = `${next.left}px`;
      panel.style.top = `${next.top}px`;
      panel.style.right = "auto";
    };

    const onMouseUp = () => {
      if (!dragState) return;

      dragState = null;
      const rect = panel.getBoundingClientRect();
      savePanelPosition({ left: rect.left, top: rect.top }, key);
    };

    handle.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;

      const rect = panel.getBoundingClientRect();
      dragState = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };

      event.preventDefault();
    });

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    bot.addCleanup(() => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    });
  }

  function inject() {
    destroy();

    const style = document.createElement("style");
    style.id = "minibia-copilot-style";
    style.textContent = `
      #minibia-copilot-panel {
        position: fixed;
        z-index: 999999;
        top: 16px;
        right: 16px;
        width: 340px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 32px);
        display: flex;
        flex-direction: column;
        padding: 0;
        border: 1px solid rgba(224, 200, 148, 0.45);
        border-radius: 12px;
        background: linear-gradient(180deg, rgba(30, 23, 15, 0.97), rgba(15, 11, 8, 0.98));
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
        color: #f1e2b8;
        font: 12px/1.4 Verdana, sans-serif;
        user-select: none;
        overflow: hidden;
      }

      #minibia-copilot-panel[data-collapsed="true"] {
        width: 200px;
        max-height: none;
      }

      #minibia-copilot-panel .mc-title {
        margin: 0;
        font-weight: 700;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: move;
        color: #f7eccf;
      }

      #minibia-copilot-panel .mc-title-accent {
        color: #ffcf5a;
      }

      #minibia-copilot-panel .mc-titlebar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(224, 200, 148, 0.22);
        background: linear-gradient(180deg, rgba(60, 46, 28, 0.55), rgba(28, 20, 12, 0.25));
      }

      #minibia-copilot-panel .mc-titlebar-actions {
        display: flex;
        gap: 4px;
      }

      #minibia-copilot-panel .mc-icon-button {
        width: 24px;
        min-width: 24px;
        height: 24px;
        padding: 0;
        border-radius: 6px;
        font-weight: 700;
        font-size: 14px;
        line-height: 1;
      }

      #minibia-copilot-panel[data-collapsed="true"] .mc-tabs,
      #minibia-copilot-panel[data-collapsed="true"] .mc-pillbar,
      #minibia-copilot-panel[data-collapsed="true"] .mc-body {
        display: none !important;
      }

      #minibia-copilot-panel .mc-pillbar {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        padding: 8px 12px;
        border-bottom: 1px solid rgba(224, 200, 148, 0.12);
        background: rgba(0, 0, 0, 0.18);
      }

      #minibia-copilot-panel .mc-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 7px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.02em;
        background: rgba(224, 200, 148, 0.08);
        color: #8c7a52;
        border: 1px solid transparent;
      }

      #minibia-copilot-panel .mc-pill[data-active="true"] {
        background: rgba(120, 220, 130, 0.18);
        color: #b5ecb8;
        border-color: rgba(120, 220, 130, 0.35);
      }

      #minibia-copilot-panel .mc-pill::before {
        content: "";
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: currentColor;
        opacity: 0.7;
      }

      #minibia-copilot-panel .mc-tabs {
        display: flex;
        padding: 6px 8px 0;
        gap: 2px;
        border-bottom: 1px solid rgba(224, 200, 148, 0.22);
        background: rgba(0, 0, 0, 0.12);
      }

      #minibia-copilot-panel .mc-tab-button {
        flex: 1;
        width: auto;
        padding: 7px 4px 9px;
        border: 0;
        border-bottom: 2px solid transparent;
        border-radius: 6px 6px 0 0;
        background: transparent;
        color: #8c7a52;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        line-height: 1.15;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
      }

      #minibia-copilot-panel .mc-tab-button:hover {
        color: #f1e2b8;
        background: rgba(224, 200, 148, 0.08);
      }

      #minibia-copilot-panel .mc-tab-button[data-active="true"] {
        color: #ffcf5a;
        border-bottom-color: #ffcf5a;
        background: rgba(255, 207, 90, 0.06);
      }

      #minibia-copilot-panel .mc-tab-icon {
        font-size: 14px;
        line-height: 1;
      }

      #minibia-copilot-panel .mc-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 10px 12px 14px;
      }

      #minibia-copilot-panel .mc-body::-webkit-scrollbar {
        width: 6px;
      }

      #minibia-copilot-panel .mc-body::-webkit-scrollbar-thumb {
        background: rgba(224, 200, 148, 0.18);
        border-radius: 6px;
      }

      #minibia-copilot-panel .mc-tab-pane[hidden] {
        display: none !important;
      }

      #minibia-copilot-panel .mc-tab-pane {
        display: grid;
        gap: 10px;
      }

      #minibia-copilot-panel .mc-section {
        padding: 10px 11px;
        border: 1px solid rgba(224, 200, 148, 0.18);
        border-radius: 8px;
        background: linear-gradient(180deg, rgba(50, 38, 22, 0.45), rgba(28, 20, 12, 0.55));
      }

      #minibia-copilot-panel .mc-column-section:first-child {
        padding-top: 10px;
      }

      #minibia-copilot-panel .mc-label {
        margin: 0 0 8px;
        color: #ffcf5a;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        word-break: break-word;
      }

      #minibia-copilot-panel .mc-snapshot {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
        padding: 10px;
        border: 1px solid rgba(224, 200, 148, 0.22);
        border-radius: 8px;
        background: linear-gradient(180deg, rgba(40, 30, 18, 0.6), rgba(20, 14, 8, 0.7));
      }

      #minibia-copilot-panel .mc-stat {
        text-align: center;
      }

      #minibia-copilot-panel .mc-stat-label {
        display: block;
        font-size: 9px;
        color: #8c7a52;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      #minibia-copilot-panel .mc-stat-value {
        display: block;
        margin-top: 2px;
        font-size: 14px;
        font-weight: 700;
        color: #f7eccf;
      }

      #minibia-copilot-panel .mc-stat-value[data-tone="hp"] {
        color: #ff7d6f;
      }

      #minibia-copilot-panel .mc-stat-value[data-tone="mana"] {
        color: #6fa8ff;
      }

      #minibia-copilot-panel .mc-stat-value[data-tone="lvl"] {
        color: #ffcf5a;
      }

      #minibia-copilot-panel .mc-hunt-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px;
      }

      #minibia-copilot-panel .mc-hunt-grid[hidden] {
        display: none !important;
      }

      #minibia-copilot-panel .mc-hunt-cell {
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding: 6px 8px;
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.22);
        border: 1px solid rgba(224, 200, 148, 0.12);
      }

      #minibia-copilot-panel .mc-hunt-cell > span:last-child {
        color: #f7eccf;
        font-weight: 700;
        font-size: 12px;
      }

      #minibia-copilot-panel .mc-actions {
        display: grid;
        gap: 6px;
      }

      #minibia-copilot-panel .mc-actions-inline-three {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      #minibia-copilot-panel .mc-actions-inline-two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      #minibia-copilot-panel button {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid rgba(224, 200, 148, 0.35);
        border-radius: 8px;
        background: linear-gradient(180deg, #635133, #3f321f);
        color: #f7eccf;
        font: inherit;
        cursor: pointer;
      }

      #minibia-copilot-panel button:hover {
        background: linear-gradient(180deg, #755f3d, #4f4028);
      }

      #minibia-copilot-panel input,
      #minibia-copilot-panel textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 8px 10px;
        border: 1px solid rgba(224, 200, 148, 0.35);
        border-radius: 8px;
        background: rgba(16, 12, 8, 0.88);
        color: #f7eccf;
        font: inherit;
      }

      #minibia-copilot-panel textarea {
        min-height: 72px;
        resize: vertical;
      }

      #minibia-copilot-panel .mc-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #d3c49d;
      }

      #minibia-copilot-panel .mc-toggle input[type="checkbox"] {
        width: auto;
        margin: 0;
      }

      #minibia-copilot-panel .mc-row {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: 8px;
      }

      #minibia-copilot-panel .mc-row-compact {
        grid-template-columns: auto auto;
        justify-content: start;
      }

      #minibia-copilot-panel .mc-row .mc-toggle {
        white-space: nowrap;
      }

      #minibia-copilot-panel .mc-row input[type="text"] {
        min-width: 0;
      }

      #minibia-copilot-panel .mc-row-three {
        display: grid;
        grid-template-columns: auto minmax(120px, 1fr) 72px;
        align-items: center;
        gap: 8px;
      }

      #minibia-copilot-panel .mc-row-three input[type="text"],
      #minibia-copilot-panel .mc-row-three input[type="number"] {
        min-width: 0;
      }

      #minibia-copilot-panel .mc-row-five {
        display: grid;
        grid-template-columns: auto 82px 72px 82px 72px;
        align-items: center;
        gap: 8px;
      }

      #minibia-copilot-panel .mc-row-five input[type="number"] {
        min-width: 0;
      }

      #minibia-copilot-panel .mc-field-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      #minibia-copilot-panel .mc-field {
        display: grid;
        gap: 4px;
      }

      #minibia-copilot-panel .mc-field-compact {
        width: 96px;
        justify-self: end;
      }

      #minibia-copilot-panel .mc-field-label {
        color: #d3c49d;
        font-size: 11px;
      }

      #minibia-copilot-panel .mc-stack {
        display: grid;
        gap: 8px;
      }

      #minibia-copilot-panel .mc-inline {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px;
        align-items: center;
      }

      #minibia-copilot-panel .mc-list {
        display: grid;
        gap: 6px;
      }

      #minibia-copilot-panel .mc-list-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px;
        align-items: center;
        color: #d3c49d;
      }

      #minibia-copilot-panel .mc-creature-row {
        padding: 6px 8px;
        border: 1px solid rgba(224, 200, 148, 0.14);
        border-radius: 8px;
        background: rgba(255, 244, 212, 0.04);
      }

      #minibia-copilot-panel .mc-creature-name {
        color: #f7eccf;
        word-break: break-word;
      }

      #minibia-copilot-panel .mc-floor-label {
        margin-top: 4px;
        color: #e2cf9c;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      #minibia-copilot-panel #minibia-copilot-visible-creatures-list {
        max-height: 150px;
        overflow-y: auto;
        padding-right: 2px;
      }

      #minibia-copilot-panel #minibia-copilot-panic-trusted-list {
        max-height: 140px;
        overflow-y: auto;
        padding-right: 2px;
      }

      #minibia-copilot-panel .mc-small-button {
        width: auto;
        padding: 4px 8px;
        border-radius: 6px;
      }

      #minibia-copilot-panel .mc-small-note {
        color: #b7a67d;
        font-size: 11px;
      }

      #minibia-copilot-panel .mc-note {
        margin-top: 8px;
        color: #b7a67d;
        font-size: 11px;
      }

      @media (max-width: 420px) {
        #minibia-copilot-panel {
          width: calc(100vw - 24px);
          right: 12px;
          top: 12px;
        }
      }
    `;
    document.head.appendChild(style);

    const panel = document.createElement("div");
    panel.id = "minibia-copilot-panel";
    panel.innerHTML = `
      <div class="mc-titlebar">
        <div class="mc-title">Minibia <span class="mc-title-accent">Copilot</span></div>
        <div class="mc-titlebar-actions">
          <button type="button" class="mc-icon-button" id="minibia-copilot-reload" aria-label="Reload bot" title="Reload bot">⟳</button>
          <button type="button" class="mc-icon-button" id="minibia-copilot-collapse" aria-label="Minimize panel" title="Minimize">−</button>
        </div>
      </div>
      <div class="mc-pillbar" id="minibia-copilot-pillbar"></div>
      <div class="mc-tabs" id="minibia-copilot-tabs">
        <button type="button" class="mc-tab-button" data-tab="status"><span class="mc-tab-icon">⚡</span><span>Status</span></button>
        <button type="button" class="mc-tab-button" data-tab="combat"><span class="mc-tab-icon">⚔</span><span>Combat</span></button>
        <button type="button" class="mc-tab-button" data-tab="survival"><span class="mc-tab-icon">❤</span><span>Survival</span></button>
        <button type="button" class="mc-tab-button" data-tab="navigation"><span class="mc-tab-icon">🗺</span><span>Navigate</span></button>
        <button type="button" class="mc-tab-button" data-tab="utility"><span class="mc-tab-icon">⚙</span><span>Utility</span></button>
      </div>
      <div class="mc-body">

        <div class="mc-tab-pane" data-tab="status" hidden>
          <div class="mc-snapshot" id="minibia-copilot-snapshot">
            <div class="mc-stat"><span class="mc-stat-label">HP</span><span class="mc-stat-value" data-tone="hp" id="minibia-copilot-snapshot-hp">—</span></div>
            <div class="mc-stat"><span class="mc-stat-label">Mana</span><span class="mc-stat-value" data-tone="mana" id="minibia-copilot-snapshot-mana">—</span></div>
            <div class="mc-stat"><span class="mc-stat-label">Lvl</span><span class="mc-stat-value" data-tone="lvl" id="minibia-copilot-snapshot-level">—</span></div>
          </div>
          <div class="mc-section">
            <div class="mc-label">Hunt Analyzer</div>
            <div class="mc-stack">
              <div class="mc-small-note" id="minibia-copilot-hunt-status">Status: no session</div>
              <div class="mc-hunt-grid" id="minibia-copilot-hunt-stats" hidden>
                <div class="mc-hunt-cell"><span class="mc-field-label">Elapsed</span><span data-key="elapsed">—</span></div>
                <div class="mc-hunt-cell"><span class="mc-field-label">XP / h</span><span data-key="xpPerHour">—</span></div>
                <div class="mc-hunt-cell"><span class="mc-field-label">Gold / h</span><span data-key="goldPerHour">—</span></div>
                <div class="mc-hunt-cell"><span class="mc-field-label">Kills / h</span><span data-key="killsPerHour">—</span></div>
                <div class="mc-hunt-cell"><span class="mc-field-label">Total XP</span><span data-key="xp">—</span></div>
                <div class="mc-hunt-cell"><span class="mc-field-label">Total Gold</span><span data-key="gold">—</span></div>
              </div>
              <div class="mc-small-note" id="minibia-copilot-hunt-top-monster">Top kill: —</div>
              <div class="mc-small-note" id="minibia-copilot-hunt-top-loot">Top loot: —</div>
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-hunt-autopoll" />
                <span>Auto-refresh every 10s</span>
              </label>
              <div class="mc-actions mc-actions-inline-three">
                <button type="button" class="mc-small-button" id="minibia-copilot-hunt-refresh">Refresh</button>
                <button type="button" class="mc-small-button" id="minibia-copilot-hunt-start">Start</button>
                <button type="button" class="mc-small-button" id="minibia-copilot-hunt-reset">Reset</button>
              </div>
              <div class="mc-actions mc-actions-inline-two">
                <button type="button" class="mc-small-button" id="minibia-copilot-hunt-pause">Pause / Resume</button>
                <button type="button" class="mc-small-button" id="minibia-copilot-hunt-stop">Stop</button>
              </div>
            </div>
          </div>
          <div class="mc-section">
            <div class="mc-label">X-Ray</div>
            <button type="button" class="mc-small-button" id="minibia-copilot-xray-overlay-toggle">Disable Overlay</button>
            <div class="mc-small-note" id="minibia-copilot-xray-overlay-status">Overlay: on</div>
            <label class="mc-field" for="minibia-copilot-xray-floor-select">
              <span class="mc-field-label">Floor Filter</span>
              <select id="minibia-copilot-xray-floor-select">
                <option value="all">All floors</option>
              </select>
            </label>
            <div class="mc-list" id="minibia-copilot-visible-creatures-list"></div>
          </div>
        </div>

        <div class="mc-tab-pane" data-tab="combat" hidden>
          <div class="mc-section">
            <div class="mc-label">Auto Attack</div>
            <div class="mc-stack">
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-auto-attack-enabled" />
                <span>Enable Auto Attack</span>
              </label>
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-auto-attack-melee" />
                <span>Melee Mode</span>
              </label>
              <div class="mc-field-grid">
                <label class="mc-field" for="minibia-copilot-auto-attack-hotkey">
                  <span class="mc-field-label">Target Hotkey (1-12)</span>
                  <input type="number" id="minibia-copilot-auto-attack-hotkey" min="1" max="12" placeholder="3" />
                </label>
                <label class="mc-field" for="minibia-copilot-auto-attack-rune-hotkey">
                  <span class="mc-field-label">Rune Hotkey (1-12)</span>
                  <input type="number" id="minibia-copilot-auto-attack-rune-hotkey" min="1" max="12" placeholder="4" />
                </label>
              </div>
              <div class="mc-small-note">Melee mode uses the target hotkey, then walks adjacent. Non-melee uses target hotkey to acquire, rune hotkey to cast.</div>
            </div>
          </div>

          <div class="mc-section">
            <div class="mc-label">Auto Utamo Vita</div>
            <label class="mc-toggle">
              <input type="checkbox" id="minibia-copilot-auto-magic-shield-enabled" />
              <span>Re-cast magic shield when down</span>
            </label>
            <div class="mc-small-note">Casts utamo vita whenever magic shield is not active.</div>
          </div>

          <div class="mc-section">
            <div class="mc-label">Auto Invisible</div>
            <label class="mc-toggle">
              <input type="checkbox" id="minibia-copilot-auto-invisible-enabled" />
              <span>Re-cast invisibility when down</span>
            </label>
            <div class="mc-small-note">Casts utana vid whenever invisibility is not active.</div>
          </div>
        </div>

        <div class="mc-tab-pane" data-tab="survival" hidden>
          <div class="mc-section">
            <div class="mc-label">Auto Heal</div>
            <div class="mc-stack">
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-auto-heal-enabled" />
                <span>Enable Auto Heal</span>
              </label>
              <div class="mc-field-grid">
                <label class="mc-field" for="minibia-copilot-auto-heal-min-hp">
                  <span class="mc-field-label">Minimum HP</span>
                  <input type="number" id="minibia-copilot-auto-heal-min-hp" min="0" placeholder="250" />
                </label>
                <label class="mc-field" for="minibia-copilot-auto-heal-hp-hotkey">
                  <span class="mc-field-label">HP Hotkey (1-12)</span>
                  <input type="number" id="minibia-copilot-auto-heal-hp-hotkey" min="1" max="12" placeholder="1" />
                </label>
                <label class="mc-field" for="minibia-copilot-auto-heal-min-mana">
                  <span class="mc-field-label">Minimum Mana</span>
                  <input type="number" id="minibia-copilot-auto-heal-min-mana" min="0" placeholder="150" />
                </label>
                <label class="mc-field" for="minibia-copilot-auto-heal-mana-hotkey">
                  <span class="mc-field-label">Mana Hotkey (1-12)</span>
                  <input type="number" id="minibia-copilot-auto-heal-mana-hotkey" min="1" max="12" placeholder="2" />
                </label>
              </div>
              <div class="mc-small-note">Polled ~20×/sec. HP fires before mana.</div>
            </div>
          </div>

          <div class="mc-section">
            <div class="mc-label">Auto Eat</div>
            <label class="mc-toggle">
              <input type="checkbox" id="minibia-copilot-auto-eat-enabled" />
              <span>Enable Auto Eat</span>
            </label>
            <label class="mc-field" for="minibia-copilot-auto-eat-hotkey">
              <span class="mc-field-label">Eat Hotkey (1-12)</span>
              <input type="number" id="minibia-copilot-auto-eat-hotkey" min="1" max="12" placeholder="10" />
            </label>
          </div>

          <div class="mc-section">
            <div class="mc-label">Equip Ring</div>
            <label class="mc-toggle">
              <input type="checkbox" id="minibia-copilot-equip-ring-enabled" />
              <span>Keep ring equipped</span>
            </label>
          </div>

          <div class="mc-section">
            <div class="mc-label">Magic Wall Timer</div>
            <div class="mc-stack">
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-magic-wall-enabled" />
                <span>Show on-screen MW timer</span>
              </label>
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-magic-wall-audio" />
                <span>Alarm at lead time</span>
              </label>
              <div class="mc-field-grid">
                <label class="mc-field" for="minibia-copilot-magic-wall-duration">
                  <span class="mc-field-label">Duration (s)</span>
                  <input type="number" id="minibia-copilot-magic-wall-duration" min="1" max="120" placeholder="20" />
                </label>
                <label class="mc-field" for="minibia-copilot-magic-wall-lead">
                  <span class="mc-field-label">Lead (s)</span>
                  <input type="number" id="minibia-copilot-magic-wall-lead" min="0" max="20" placeholder="3" />
                </label>
              </div>
              <div class="mc-small-note" id="minibia-copilot-magic-wall-status">Status: idle</div>
            </div>
          </div>

          <div class="mc-section">
            <div class="mc-label" id="minibia-copilot-home">Panic Runner Home: not set</div>
            <div class="mc-stack">
              <button type="button" id="minibia-copilot-set-home">Set Home (current tile)</button>
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-panic-unknown" />
                <span>Trigger on unknown player</span>
              </label>
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-panic-health" />
                <span>Trigger on health loss</span>
              </label>
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-panic-return" />
                <span>Auto return after threat</span>
              </label>
              <div class="mc-field-label">Trusted names</div>
              <div class="mc-inline">
                <input type="text" id="minibia-copilot-panic-trusted-input" placeholder="Add name" />
                <button type="button" class="mc-small-button" id="minibia-copilot-panic-trusted-add">Add</button>
              </div>
              <div class="mc-list" id="minibia-copilot-panic-trusted-list"></div>
            </div>
          </div>

          <div class="mc-section">
            <div class="mc-label">GM Kill Switch</div>
            <div class="mc-stack">
              <div class="mc-inline">
                <input type="text" id="minibia-copilot-panic-gm-input" placeholder="Game master name" />
                <button type="button" class="mc-small-button" id="minibia-copilot-panic-gm-add">Add</button>
              </div>
              <div class="mc-list" id="minibia-copilot-panic-gm-list"></div>
            </div>
          </div>
        </div>

        <div class="mc-tab-pane" data-tab="navigation" hidden>
          <div class="mc-section">
            <div class="mc-label">Cave Bot</div>
            <div class="mc-stack">
              <label class="mc-field" for="minibia-copilot-cave-preset-select">
                <span class="mc-field-label">Active preset</span>
                <select id="minibia-copilot-cave-preset-select"></select>
              </label>
              <div class="mc-actions mc-actions-inline-two">
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-preset-new">New Preset</button>
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-preset-delete">Delete</button>
              </div>
              <div class="mc-field-label">Record waypoint at current spot</div>
              <div class="mc-actions mc-actions-inline-two">
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-record">+ Node</button>
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-record-stand">+ Stand</button>
              </div>
              <div class="mc-actions mc-actions-inline-three">
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-record-rope">+ Rope</button>
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-record-ladder">+ Ladder</button>
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-record-shovel">+ Shovel</button>
              </div>
              <div class="mc-actions mc-actions-inline-two">
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-record-use">+ Use Tile</button>
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-remove-last">Remove Last</button>
              </div>
              <div class="mc-small-note" id="minibia-copilot-cave-closest">Closest start: no waypoints</div>
              <div class="mc-small-note" id="minibia-copilot-cave-transition-status">Transitions learned: none</div>
              <div class="mc-actions mc-actions-inline-two">
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-start">Start</button>
                <button type="button" class="mc-small-button" id="minibia-copilot-cave-stop">Stop</button>
              </div>
              <div class="mc-small-note" id="minibia-copilot-cave-status">Status: no waypoints</div>
            </div>
          </div>
        </div>

        <div class="mc-tab-pane" data-tab="utility" hidden>
          <div class="mc-section">
            <div class="mc-label">Magic Level Trainer</div>
            <div class="mc-stack">
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-rune-enabled" />
                <span>Enable rune loop</span>
              </label>
              <label class="mc-field" for="minibia-copilot-rune-spell">
                <span class="mc-field-label">Spell words</span>
                <input type="text" id="minibia-copilot-rune-spell" placeholder="adori vita vis" />
              </label>
              <label class="mc-field" for="minibia-copilot-rune-mana">
                <span class="mc-field-label">Mana per cast</span>
                <input type="number" id="minibia-copilot-rune-mana" min="0" placeholder="600" />
              </label>
            </div>
          </div>

          <div class="mc-section">
            <div class="mc-label">Talk (Chat AI)</div>
            <div class="mc-stack">
              <label class="mc-toggle">
                <input type="checkbox" id="minibia-copilot-talk-enabled" />
                <span>Enable Auto Reply</span>
              </label>
              <label class="mc-field" for="minibia-copilot-talk-api-key">
                <span class="mc-field-label">Gemini API key</span>
                <input type="password" id="minibia-copilot-talk-api-key" placeholder="paste key" />
              </label>
              <label class="mc-field" for="minibia-copilot-talk-prompt">
                <span class="mc-field-label">Reply style prompt</span>
                <textarea id="minibia-copilot-talk-prompt" placeholder="e.g. terse, in-character"></textarea>
              </label>
              <div class="mc-small-note" id="minibia-copilot-talk-status">Status: idle</div>
              <div class="mc-small-note">Replies only to the newest unseen message in Default chat. Won't admit it is a bot.</div>
            </div>
          </div>
        </div>

      </div>
    `;
    document.body.appendChild(panel);

    const unlockAudio = () => {
      bot.unlockAudio?.();
    };

    panel.addEventListener("pointerdown", unlockAudio, { passive: true });
    panel.addEventListener("keydown", unlockAudio);

    bot.addCleanup(() => {
      panel.removeEventListener("pointerdown", unlockAudio);
      panel.removeEventListener("keydown", unlockAudio);
    });

    applySavedPanelPosition(panel);
    enableDrag(panel);
    setPanelCollapsed(panel, getSavedPanelCollapsed());

    const spellInput = panel.querySelector("#minibia-copilot-rune-spell");
    const manaInput = panel.querySelector("#minibia-copilot-rune-mana");
    const runeEnabledInput = panel.querySelector("#minibia-copilot-rune-enabled");
    const autoEatEnabledInput = panel.querySelector("#minibia-copilot-auto-eat-enabled");
    const autoEatHotkeyInput = panel.querySelector("#minibia-copilot-auto-eat-hotkey");
    const autoInvisibleEnabledInput = panel.querySelector("#minibia-copilot-auto-invisible-enabled");
    const autoMagicShieldEnabledInput = panel.querySelector("#minibia-copilot-auto-magic-shield-enabled");
    const equipRingEnabledInput = panel.querySelector("#minibia-copilot-equip-ring-enabled");
    const autoHealEnabledInput = panel.querySelector("#minibia-copilot-auto-heal-enabled");
    const autoHealMinHpInput = panel.querySelector("#minibia-copilot-auto-heal-min-hp");
    const autoHealHpHotkeyInput = panel.querySelector("#minibia-copilot-auto-heal-hp-hotkey");
    const autoHealMinManaInput = panel.querySelector("#minibia-copilot-auto-heal-min-mana");
    const autoHealManaHotkeyInput = panel.querySelector("#minibia-copilot-auto-heal-mana-hotkey");
    const autoAttackEnabledInput = panel.querySelector("#minibia-copilot-auto-attack-enabled");
    const autoAttackMeleeInput = panel.querySelector("#minibia-copilot-auto-attack-melee");
    const autoAttackHotkeyInput = panel.querySelector("#minibia-copilot-auto-attack-hotkey");
    const autoAttackRuneHotkeyInput = panel.querySelector("#minibia-copilot-auto-attack-rune-hotkey");
    const talkEnabledInput = panel.querySelector("#minibia-copilot-talk-enabled");
    const talkApiKeyInput = panel.querySelector("#minibia-copilot-talk-api-key");
    const talkPromptInput = panel.querySelector("#minibia-copilot-talk-prompt");
    const panicGmNameInput = panel.querySelector("#minibia-copilot-panic-gm-input");
    const panicGmAddButton = panel.querySelector("#minibia-copilot-panic-gm-add");
    const panicUnknownInput = panel.querySelector("#minibia-copilot-panic-unknown");
    const panicHealthInput = panel.querySelector("#minibia-copilot-panic-health");
    const panicReturnInput = panel.querySelector("#minibia-copilot-panic-return");
    const panicTrustedInput = panel.querySelector("#minibia-copilot-panic-trusted-input");
    const panicTrustedAddButton = panel.querySelector("#minibia-copilot-panic-trusted-add");
    const xrayOverlayButton = panel.querySelector("#minibia-copilot-xray-overlay-toggle");
    const xrayFloorSelect = panel.querySelector("#minibia-copilot-xray-floor-select");
    const collapseButton = panel.querySelector("#minibia-copilot-collapse");
    const reloadButton = panel.querySelector("#minibia-copilot-reload");
    const caveRecordButton = panel.querySelector("#minibia-copilot-cave-record");
    const caveRemoveLastButton = panel.querySelector("#minibia-copilot-cave-remove-last");
    const caveStartButton = panel.querySelector("#minibia-copilot-cave-start");
    const caveStopButton = panel.querySelector("#minibia-copilot-cave-stop");
    const cavePresetSelect = panel.querySelector("#minibia-copilot-cave-preset-select");
    const cavePresetNewButton = panel.querySelector("#minibia-copilot-cave-preset-new");
    const cavePresetDeleteButton = panel.querySelector("#minibia-copilot-cave-preset-delete");
    const caveRecordRopeButton = panel.querySelector("#minibia-copilot-cave-record-rope");
    const caveRecordLadderButton = panel.querySelector("#minibia-copilot-cave-record-ladder");
    const caveRecordShovelButton = panel.querySelector("#minibia-copilot-cave-record-shovel");
    const caveRecordUseButton = panel.querySelector("#minibia-copilot-cave-record-use");
    const caveRecordStandButton = panel.querySelector("#minibia-copilot-cave-record-stand");
    const magicWallEnabledInput = panel.querySelector("#minibia-copilot-magic-wall-enabled");
    const magicWallAudioInput = panel.querySelector("#minibia-copilot-magic-wall-audio");
    const magicWallDurationInput = panel.querySelector("#minibia-copilot-magic-wall-duration");
    const magicWallLeadInput = panel.querySelector("#minibia-copilot-magic-wall-lead");
    const huntRefreshButton = panel.querySelector("#minibia-copilot-hunt-refresh");
    const huntStartButton = panel.querySelector("#minibia-copilot-hunt-start");
    const huntStopButton = panel.querySelector("#minibia-copilot-hunt-stop");
    const huntResetButton = panel.querySelector("#minibia-copilot-hunt-reset");
    const huntPauseButton = panel.querySelector("#minibia-copilot-hunt-pause");
    const huntAutoPollInput = panel.querySelector("#minibia-copilot-hunt-autopoll");

    if (collapseButton) {
      collapseButton.addEventListener("click", () => {
        const isCollapsed = panel.dataset.collapsed === "true";
        setPanelCollapsed(panel, !isCollapsed);
      });
    }

    if (reloadButton) {
      reloadButton.addEventListener("click", () => {
        window.minibiaCopilotReload?.();
      });
    }

    function addTrustedName() {
      const rawName = panicTrustedInput?.value?.trim() || "";
      if (!rawName) {
        return;
      }

      const currentNames = bot.panic?.config?.trustedNames || [];
      const exists = currentNames.some(
        (name) => String(name).trim().toLowerCase() === rawName.toLowerCase()
      );

      if (!exists) {
        bot.panic.updateConfig({ trustedNames: [...currentNames, rawName] });
      }

      if (panicTrustedInput) {
        panicTrustedInput.value = "";
      }

      renderTrustedNames();
    }

    function addGameMasterName() {
      const rawName = panicGmNameInput?.value?.trim() || "";
      if (!rawName) {
        return;
      }

      const currentNames = bot.panic?.config?.gameMasterNames || [];
      const exists = currentNames.some(
        (name) => String(name).trim().toLowerCase() === rawName.toLowerCase()
      );

      if (!exists) {
        bot.panic.updateConfig({ gameMasterNames: [...currentNames, rawName] });
      }

      if (panicGmNameInput) {
        panicGmNameInput.value = "";
      }

      renderGameMasterNames();
    }

    if (panicGmAddButton) {
      panicGmAddButton.addEventListener("click", addGameMasterName);
    }

    if (panicGmNameInput) {
      panicGmNameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addGameMasterName();
        }
      });
    }

    if (panicTrustedAddButton) {
      panicTrustedAddButton.addEventListener("click", addTrustedName);
    }

    if (panicTrustedInput) {
      panicTrustedInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addTrustedName();
        }
      });
    }

    if (spellInput) {
      spellInput.value = bot.rune?.config?.runeSpellWords || "";
      spellInput.addEventListener("change", () => {
        bot.rune.updateConfig({ runeSpellWords: spellInput.value.trim() });
      });
    }

    if (manaInput) {
      manaInput.value = String(bot.rune?.config?.runeManaCost ?? 0);
      manaInput.addEventListener("change", () => {
        const runeManaCost = Math.max(0, Number(manaInput.value) || 0);
        manaInput.value = String(runeManaCost);
        bot.rune.updateConfig({ runeManaCost });
      });
    }

    if (runeEnabledInput) {
      runeEnabledInput.checked = !!bot.rune?.status?.().running;
      runeEnabledInput.addEventListener("change", () => {
        const runeSpellWords = spellInput?.value?.trim() || bot.rune.config.runeSpellWords;
        const runeManaCost = Math.max(0, Number(manaInput?.value) || bot.rune.config.runeManaCost || 0);

        if (runeEnabledInput.checked) {
          bot.rune.start({ runeSpellWords, runeManaCost });
        } else {
          bot.rune.stop();
        }

        refreshRuneStatus();
      });
    }

    if (autoEatHotkeyInput) {
      autoEatHotkeyInput.value = String(bot.eat?.config?.eatHotbarSlot ?? 10);
      autoEatHotkeyInput.addEventListener("change", () => {
        const eatHotbarSlot = Math.min(12, Math.max(1, Number(autoEatHotkeyInput.value) || 1));
        autoEatHotkeyInput.value = String(eatHotbarSlot);
        bot.eat.updateConfig({ eatHotbarSlot });
      });
    }

    if (autoEatEnabledInput) {
      autoEatEnabledInput.checked = !!bot.eat?.status?.().running;
      autoEatEnabledInput.addEventListener("change", () => {
        const eatHotbarSlot = Math.min(
          12,
          Math.max(1, Number(autoEatHotkeyInput?.value) || bot.eat.config.eatHotbarSlot || 1)
        );

        if (autoEatEnabledInput.checked) {
          bot.eat.start({ eatHotbarSlot });
        } else {
          bot.eat.stop();
        }

        refreshAutoEatStatus();
      });
    }

    if (autoInvisibleEnabledInput) {
      autoInvisibleEnabledInput.checked = !!bot.invisible?.status?.().running;
      autoInvisibleEnabledInput.addEventListener("change", () => {
        if (autoInvisibleEnabledInput.checked) {
          bot.invisible.start();
        } else {
          bot.invisible.stop();
        }

        refreshAutoInvisibleStatus();
      });
    }

    if (autoMagicShieldEnabledInput) {
      autoMagicShieldEnabledInput.checked = !!bot.magicShield?.status?.().running;
      autoMagicShieldEnabledInput.addEventListener("change", () => {
        if (autoMagicShieldEnabledInput.checked) {
          bot.magicShield.start();
        } else {
          bot.magicShield.stop();
        }

        refreshAutoMagicShieldStatus();
      });
    }

    if (equipRingEnabledInput) {
      equipRingEnabledInput.checked = !!bot.equipRing?.status?.().running;
      equipRingEnabledInput.addEventListener("change", () => {
        if (equipRingEnabledInput.checked) {
          bot.equipRing.start();
        } else {
          bot.equipRing.stop();
        }

        refreshEquipRingStatus();
      });
    }

    if (caveRecordButton) {
      caveRecordButton.addEventListener("click", () => {
        bot.cave.addWaypointCurrentSpot();
        refreshCavePresetControls();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (caveRemoveLastButton) {
      caveRemoveLastButton.addEventListener("click", () => {
        bot.cave.removeLastWaypoint();
        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    function bindCaveActionRecord(button, recorder) {
      if (!button) return;
      button.addEventListener("click", () => {
        recorder?.();
        refreshCavePresetControls();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    bindCaveActionRecord(caveRecordRopeButton, () => bot.cave?.addRopeWaypointCurrentSpot?.());
    bindCaveActionRecord(caveRecordLadderButton, () => bot.cave?.addLadderWaypointCurrentSpot?.());
    bindCaveActionRecord(caveRecordShovelButton, () => bot.cave?.addShovelWaypointCurrentSpot?.());
    bindCaveActionRecord(caveRecordUseButton, () => bot.cave?.addUseWaypointCurrentSpot?.());
    bindCaveActionRecord(caveRecordStandButton, () => bot.cave?.addStandWaypointCurrentSpot?.());

    if (magicWallEnabledInput) {
      magicWallEnabledInput.addEventListener("change", () => {
        if (magicWallEnabledInput.checked) {
          bot.magicWall?.start?.();
        } else {
          bot.magicWall?.stop?.();
        }
        refreshMagicWallStatus();
      });
    }

    if (magicWallAudioInput) {
      magicWallAudioInput.addEventListener("change", () => {
        bot.magicWall?.updateConfig?.({ audioOnExpiry: !!magicWallAudioInput.checked });
        refreshMagicWallStatus();
      });
    }

    function applyMagicWallDuration() {
      if (!magicWallDurationInput) return;
      const seconds = Math.max(1, Math.min(120, Number(magicWallDurationInput.value) || 20));
      const status = bot.magicWall?.status?.();
      const next = (status?.config?.patternSpecs || []).map((spec) => {
        if (spec && String(spec.name || "").toLowerCase().includes("magic wall")) {
          return { ...spec, durationMs: seconds * 1000 };
        }
        return spec;
      });
      bot.magicWall?.updateConfig?.({ patternSpecs: next });
      refreshMagicWallStatus();
    }

    if (magicWallDurationInput) {
      magicWallDurationInput.addEventListener("change", applyMagicWallDuration);
    }

    if (magicWallLeadInput) {
      magicWallLeadInput.addEventListener("change", () => {
        const seconds = Math.max(0, Math.min(20, Number(magicWallLeadInput.value) || 3));
        bot.magicWall?.updateConfig?.({ flashLeadMs: seconds * 1000, audioLeadMs: seconds * 1000 });
        refreshMagicWallStatus();
      });
    }

    if (huntRefreshButton) {
      huntRefreshButton.addEventListener("click", () => {
        bot.hunt?.refresh?.();
        window.setTimeout(refreshHuntStatus, 300);
      });
    }
    if (huntStartButton) {
      huntStartButton.addEventListener("click", () => {
        bot.hunt?.startSession?.();
        window.setTimeout(refreshHuntStatus, 300);
      });
    }
    if (huntStopButton) {
      huntStopButton.addEventListener("click", () => {
        bot.hunt?.stopSession?.();
        window.setTimeout(refreshHuntStatus, 300);
      });
    }
    if (huntResetButton) {
      huntResetButton.addEventListener("click", () => {
        bot.hunt?.resetSession?.();
        window.setTimeout(refreshHuntStatus, 300);
      });
    }
    if (huntPauseButton) {
      huntPauseButton.addEventListener("click", () => {
        const info = bot.hunt?.getLastInfo?.();
        if (info?.paused) {
          bot.hunt?.resumeSession?.();
        } else {
          bot.hunt?.pauseSession?.();
        }
        window.setTimeout(refreshHuntStatus, 300);
      });
    }
    if (huntAutoPollInput) {
      huntAutoPollInput.addEventListener("change", () => {
        bot.hunt?.updateConfig?.({ autoPoll: huntAutoPollInput.checked });
        refreshHuntStatus();
      });
    }

    if (caveStartButton) {
      caveStartButton.addEventListener("click", () => {
        bot.cave.start();
        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (caveStopButton) {
      caveStopButton.addEventListener("click", () => {
        bot.cave.stop();
        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (cavePresetSelect) {
      cavePresetSelect.addEventListener("change", () => {
        const name = cavePresetSelect.value || "";
        const activePresetName = bot.cave?.getActivePresetName?.() || "";
        if (!name || name === activePresetName) {
          refreshCavePresetControls();
          return;
        }

        const loadedPreset = bot.cave.loadPreset(name);
        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (cavePresetNewButton) {
      cavePresetNewButton.addEventListener("click", () => {
        const name = window.prompt("Name the new cave preset:");
        if (name == null) {
          return;
        }

        const createdPreset = bot.cave.createPreset(name);
        if (!createdPreset) {
          return;
        }

        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (cavePresetDeleteButton) {
      cavePresetDeleteButton.addEventListener("click", () => {
        const name = cavePresetSelect?.value || "";
        if (!name) {
          return;
        }

        const deleted = bot.cave.deletePreset(name);
        if (!deleted) {
          return;
        }

        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (autoHealMinHpInput) {
      autoHealMinHpInput.value = String(bot.heal?.config?.minHp ?? 0);
      autoHealMinHpInput.addEventListener("change", () => {
        const minHp = Math.max(0, Number(autoHealMinHpInput.value) || 0);
        autoHealMinHpInput.value = String(minHp);
        bot.heal.updateConfig({ minHp });
      });
    }

    if (autoHealHpHotkeyInput) {
      autoHealHpHotkeyInput.value = String(bot.heal?.config?.hpHotbarSlot ?? 1);
      autoHealHpHotkeyInput.addEventListener("change", () => {
        const hpHotbarSlot = Math.min(12, Math.max(1, Number(autoHealHpHotkeyInput.value) || 1));
        autoHealHpHotkeyInput.value = String(hpHotbarSlot);
        bot.heal.updateConfig({ hpHotbarSlot });
      });
    }

    if (autoHealMinManaInput) {
      autoHealMinManaInput.value = String(bot.heal?.config?.minMana ?? 0);
      autoHealMinManaInput.addEventListener("change", () => {
        const minMana = Math.max(0, Number(autoHealMinManaInput.value) || 0);
        autoHealMinManaInput.value = String(minMana);
        bot.heal.updateConfig({ minMana });
      });
    }

    if (autoHealManaHotkeyInput) {
      autoHealManaHotkeyInput.value = String(bot.heal?.config?.manaHotbarSlot ?? 1);
      autoHealManaHotkeyInput.addEventListener("change", () => {
        const manaHotbarSlot = Math.min(12, Math.max(1, Number(autoHealManaHotkeyInput.value) || 1));
        autoHealManaHotkeyInput.value = String(manaHotbarSlot);
        bot.heal.updateConfig({ manaHotbarSlot });
      });
    }

    if (autoHealEnabledInput) {
      autoHealEnabledInput.checked = !!bot.heal?.status?.().running;
      autoHealEnabledInput.addEventListener("change", () => {
        const minHp = Math.max(0, Number(autoHealMinHpInput?.value) || bot.heal.config.minHp || 0);
        const hpHotbarSlot = Math.min(
          12,
          Math.max(1, Number(autoHealHpHotkeyInput?.value) || bot.heal.config.hpHotbarSlot || 1)
        );
        const minMana = Math.max(0, Number(autoHealMinManaInput?.value) || bot.heal.config.minMana || 0);
        const manaHotbarSlot = Math.min(
          12,
          Math.max(1, Number(autoHealManaHotkeyInput?.value) || bot.heal.config.manaHotbarSlot || 1)
        );

        if (autoHealEnabledInput.checked) {
          bot.heal.start({ minHp, hpHotbarSlot, minMana, manaHotbarSlot });
        } else {
          bot.heal.stop();
        }

        refreshAutoHealStatus();
      });
    }

    if (autoAttackHotkeyInput) {
      autoAttackHotkeyInput.value = String(bot.attack?.config?.targetHotbarSlot ?? 3);
      autoAttackHotkeyInput.addEventListener("change", () => {
        const targetHotbarSlot = Math.min(12, Math.max(1, Number(autoAttackHotkeyInput.value) || 1));
        autoAttackHotkeyInput.value = String(targetHotbarSlot);
        bot.attack.updateConfig({ targetHotbarSlot });
      });
    }

    if (autoAttackRuneHotkeyInput) {
      autoAttackRuneHotkeyInput.value = bot.attack?.config?.runeHotbarSlot
        ? String(bot.attack.config.runeHotbarSlot)
        : "";
      autoAttackRuneHotkeyInput.addEventListener("change", () => {
        const rawValue = Number(autoAttackRuneHotkeyInput.value);
        const runeHotbarSlot = Number.isFinite(rawValue) && rawValue >= 1 && rawValue <= 12
          ? Math.trunc(rawValue)
          : null;
        autoAttackRuneHotkeyInput.value = runeHotbarSlot ? String(runeHotbarSlot) : "";
        bot.attack.updateConfig({ runeHotbarSlot });
      });
    }

    if (autoAttackMeleeInput) {
      autoAttackMeleeInput.checked = bot.attack?.config?.meleeMode !== false;
      autoAttackMeleeInput.addEventListener("change", () => {
        bot.attack.updateConfig({ meleeMode: autoAttackMeleeInput.checked });
      });
    }

    if (autoAttackEnabledInput) {
      autoAttackEnabledInput.checked = !!bot.attack?.status?.().running;
      autoAttackEnabledInput.addEventListener("change", () => {
        const targetHotbarSlot = Math.min(
          12,
          Math.max(1, Number(autoAttackHotkeyInput?.value) || bot.attack.config.targetHotbarSlot || 1)
        );
        const runeHotbarSlot = (() => {
          const rawValue = Number(autoAttackRuneHotkeyInput?.value);
          if (Number.isFinite(rawValue) && rawValue >= 1 && rawValue <= 12) {
            return Math.trunc(rawValue);
          }

          return bot.attack.config.runeHotbarSlot ?? null;
        })();
        const meleeMode = !!autoAttackMeleeInput?.checked;

        if (autoAttackEnabledInput.checked) {
          bot.attack.start({ targetHotbarSlot, runeHotbarSlot, meleeMode });
        } else {
          bot.attack.stop();
        }

        refreshAutoAttackStatus();
      });
    }

    if (talkApiKeyInput) {
      talkApiKeyInput.value = bot.talk?.config?.apiKey || "";
      talkApiKeyInput.addEventListener("change", () => {
        bot.talk.updateConfig({ apiKey: talkApiKeyInput.value.trim() });
        refreshTalkStatus();
      });
    }

    if (talkPromptInput) {
      talkPromptInput.value = bot.talk?.config?.systemPrompt || "";
      talkPromptInput.addEventListener("change", () => {
        bot.talk.updateConfig({ systemPrompt: talkPromptInput.value.trim() });
      });
    }

    if (talkEnabledInput) {
      talkEnabledInput.checked = !!bot.talk?.status?.().running;
      talkEnabledInput.addEventListener("change", () => {
        if (talkEnabledInput.checked) {
          bot.talk.updateConfig({
            apiKey: talkApiKeyInput?.value?.trim() || "",
            systemPrompt: talkPromptInput?.value?.trim() || bot.talk.config.systemPrompt || "",
          });
          const started = bot.talk.start();
          if (!started) {
            talkEnabledInput.checked = false;
          }
        } else {
          bot.talk.stop();
        }

        refreshTalkStatus();
      });
    }

    if (panicUnknownInput) {
      panicUnknownInput.checked = !!bot.panic?.status?.().config?.unknownPlayerEnabled;
      panicUnknownInput.addEventListener("change", () => {
        bot.panic.updateConfig({ unknownPlayerEnabled: panicUnknownInput.checked });
        refreshPanicStatus();
      });
    }

    if (panicHealthInput) {
      panicHealthInput.checked = !!bot.panic?.status?.().config?.healthLossEnabled;
      panicHealthInput.addEventListener("change", () => {
        bot.panic.updateConfig({ healthLossEnabled: panicHealthInput.checked });
        refreshPanicStatus();
      });
    }

    if (panicReturnInput) {
      panicReturnInput.checked = !!bot.panic?.status?.().config?.returnToOriginEnabled;
      panicReturnInput.addEventListener("change", () => {
        bot.panic.updateConfig({ returnToOriginEnabled: panicReturnInput.checked });
        refreshPanicStatus();
      });
    }

    if (xrayOverlayButton) {
      xrayOverlayButton.addEventListener("click", () => {
        const enabled = !!bot.xray?.status?.().config?.overlayEnabled;
        bot.xray?.setOverlayEnabled?.(!enabled);
        refreshXrayStatus();
      });
    }

    if (xrayFloorSelect) {
      xrayFloorSelect.addEventListener("change", () => {
        const rawValue = xrayFloorSelect.value;
        bot.xray?.setSelectedFloor?.(rawValue === "all" ? null : Number(rawValue));
        refreshXrayStatus();
        refreshVisibleCreatures();
      });
    }

    panel.querySelector("#minibia-copilot-set-home")?.addEventListener("click", () => {
      bot.pz.setHomePzCurrentSpot();
      refreshHomeLabel();
    });

    panel.querySelectorAll(".mc-tab-button").forEach((button) => {
      button.addEventListener("click", () => activateTab(button.dataset.tab));
    });
    const initialTab = bot.storage.get(tabStorageKey, defaultTab) || defaultTab;
    activateTab(initialTab);
    refreshPlayerSnapshot();
    refreshStatusPillbar();

    refreshHomeLabel();
    refreshPanicStatus();
    refreshXrayStatus();
    renderGameMasterNames();
    renderTrustedNames();
    refreshRuneStatus();
    refreshAutoHealStatus();
    refreshAutoInvisibleStatus();
    refreshAutoMagicShieldStatus();
    refreshAutoAttackStatus();
    refreshAutoEatStatus();
    refreshCaveStatus();
    refreshEquipRingStatus();
    refreshTalkStatus();
    refreshMagicWallStatus();
    refreshHuntStatus();
    refreshVisibleCreatures();
    refreshCavePresetControls();
    refreshCaveClosestStatus();
    refreshCaveTransitionStatus();

    const visibleCreaturesTimerId = window.setInterval(refreshVisibleCreatures, 1000);
    bot.addCleanup(() => {
      window.clearInterval(visibleCreaturesTimerId);
    });

    const talkStatusTimerId = window.setInterval(refreshTalkStatus, 1000);
    bot.addCleanup(() => {
      window.clearInterval(talkStatusTimerId);
    });

    const caveStatusTimerId = window.setInterval(() => {
      refreshCaveStatus();
      refreshCavePresetControls();
      refreshCaveClosestStatus();
      refreshCaveTransitionStatus();
    }, 1000);
    bot.addCleanup(() => {
      window.clearInterval(caveStatusTimerId);
    });

    const magicWallStatusTimerId = window.setInterval(refreshMagicWallStatus, 1000);
    bot.addCleanup(() => {
      window.clearInterval(magicWallStatusTimerId);
    });

    const snapshotTimerId = window.setInterval(() => {
      refreshPlayerSnapshot();
      refreshStatusPillbar();
      refreshHuntStatus();
    }, 1000);
    bot.addCleanup(() => {
      window.clearInterval(snapshotTimerId);
    });
  }

  bot.ui = {
    inject,
    destroy,
    refreshHomeLabel,
    refreshPanicStatus,
    refreshXrayStatus,
    refreshRuneStatus,
    refreshAutoHealStatus,
    refreshAutoInvisibleStatus,
    refreshAutoMagicShieldStatus,
    refreshAutoAttackStatus,
    refreshAutoEatStatus,
    refreshCaveStatus,
    refreshCavePresetControls,
    refreshEquipRingStatus,
    refreshTalkStatus,
    refreshMagicWallStatus,
    refreshHuntStatus,
    refreshVisibleCreatures,
    refreshCaveClosestStatus,
    refreshCaveTransitionStatus,
    getSavedPanelPosition,
    getSavedPanelCollapsed,
    setPanelCollapsed: (collapsed) => {
      const panel = document.getElementById("minibia-copilot-panel");
      setPanelCollapsed(panel, collapsed);
    },
  };
};
