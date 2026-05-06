window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installPanel = function installPanel(bot) {
  const panelPositionKey = "minibiaBot.ui.panelPosition";
  const panelCollapsedKey = "minibiaBot.ui.panelCollapsed";

  function destroy() {
    document.getElementById("minibia-bot-panel")?.remove();
    document.getElementById("minibia-bot-style")?.remove();
  }

  function savePanelPosition(position) {
    bot.storage.set(panelPositionKey, position);
  }

  function getSavedPanelPosition() {
    return bot.storage.get(panelPositionKey, null);
  }

  function savePanelCollapsed(collapsed) {
    bot.storage.set(panelCollapsedKey, !!collapsed);
  }

  function getSavedPanelCollapsed() {
    return !!bot.storage.get(panelCollapsedKey, false);
  }

  function refreshHomeLabel() {
    const homeLabel = document.getElementById("minibia-bot-home");
    if (!homeLabel) return;

    const home = bot.pz?.getHomePz?.();
    homeLabel.textContent = home
      ? `Panic Runner Home: ${home.x}, ${home.y}, ${home.z}`
      : "Panic Runner Home: not set";
  }

  function refreshPanicStatus() {
    const unknownToggle = document.getElementById("minibia-bot-panic-unknown");
    const healthToggle = document.getElementById("minibia-bot-panic-health");
    const status = bot.panic?.status?.();

    if (unknownToggle) {
      unknownToggle.checked = !!status?.config?.unknownPlayerEnabled;
    }

    if (healthToggle) {
      healthToggle.checked = !!status?.config?.healthLossEnabled;
    }
  }

  function refreshXrayStatus() {
    const status = bot.xray?.status?.();
    const overlayButton = document.getElementById("minibia-bot-xray-overlay-toggle");
    const overlayLabel = document.getElementById("minibia-bot-xray-overlay-status");

    if (overlayButton) {
      overlayButton.textContent = status?.config?.overlayEnabled ? "Disable Overlay" : "Enable Overlay";
    }

    if (overlayLabel) {
      overlayLabel.textContent = status?.config?.overlayEnabled ? "Overlay: on" : "Overlay: off";
    }
  }

  function renderTrustedNames() {
    const list = document.getElementById("minibia-bot-panic-trusted-list");
    if (!list) return;

    const trustedNames = bot.panic?.config?.trustedNames || [];
    list.innerHTML = "";

    if (!trustedNames.length) {
      const empty = document.createElement("div");
      empty.className = "mb-small-note";
      empty.textContent = "No trusted names saved.";
      list.appendChild(empty);
      return;
    }

    trustedNames.forEach((name, index) => {
      const row = document.createElement("div");
      row.className = "mb-list-row";

      const label = document.createElement("span");
      label.textContent = name;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "mb-small-button";
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
    const list = document.getElementById("minibia-bot-panic-gm-list");
    if (!list) return;

    const gameMasterNames = bot.panic?.config?.gameMasterNames || [];
    list.innerHTML = "";

    if (!gameMasterNames.length) {
      const empty = document.createElement("div");
      empty.className = "mb-small-note";
      empty.textContent = "No game master names saved.";
      list.appendChild(empty);
      return;
    }

    gameMasterNames.forEach((name, index) => {
      const row = document.createElement("div");
      row.className = "mb-list-row";

      const label = document.createElement("span");
      label.textContent = name;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "mb-small-button";
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
    const runeToggle = document.getElementById("minibia-bot-rune-enabled");
    const running = !!bot.rune?.status?.().running;

    if (runeToggle) {
      runeToggle.checked = running;
    }
  }

  function refreshAutoEatStatus() {
    const autoEatToggle = document.getElementById("minibia-bot-auto-eat-enabled");
    if (!autoEatToggle) return;

    autoEatToggle.checked = !!bot.eat?.status?.().running;
  }

  function refreshAutoHealStatus() {
    const autoHealToggle = document.getElementById("minibia-bot-auto-heal-enabled");
    if (!autoHealToggle) return;

    autoHealToggle.checked = !!bot.heal?.status?.().running;
  }

  function refreshVisibleCreatures() {
    const list = document.getElementById("minibia-bot-visible-creatures-list");
    if (!list) return;

    const me = bot.getPlayerPosition?.();
    const creatures = bot.xray?.status?.().visibleCreatures || [];
    list.innerHTML = "";

    if (!me) {
      const empty = document.createElement("div");
      empty.className = "mb-small-note";
      empty.textContent = "Current position unavailable.";
      list.appendChild(empty);
      return;
    }

    const getFloorOffset = (creature) => (creature.position?.z || 0) - me.z;
    const getFloorDistance = (creature) => Math.abs(getFloorOffset(creature));

    const visibleCreatures = creatures
      .filter((creature) => creature?.position?.z != null && creature.position.z !== me.z)
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
      empty.className = "mb-small-note";
      empty.textContent = "No off-floor creatures.";
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
        floorLabel.className = "mb-floor-label";
        floorLabel.textContent = `Floor ${floor} (${floorOffsetLabel})`;
        list.appendChild(floorLabel);
      }

      const row = document.createElement("div");
      row.className = "mb-creature-row";

      const name = document.createElement("div");
      name.className = "mb-creature-name";
      name.textContent = creature.name || (creature.type === 0 ? "Player" : "Mob");

      const meta = document.createElement("div");
      meta.className = "mb-small-note";
      meta.textContent = `${creature.type === 0 ? "Player" : "Mob"} at ${creature.position.x}, ${creature.position.y}, ${creature.position.z}`;

      row.appendChild(name);
      row.appendChild(meta);
      list.appendChild(row);
    });
  }

  function setPanelCollapsed(panel, collapsed) {
    if (!panel) return;

    const body = panel.querySelector(".mb-body");
    const toggle = panel.querySelector("#minibia-bot-collapse");
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

  function applySavedPanelPosition(panel) {
    const position = getSavedPanelPosition();
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

  function enableDrag(panel) {
    const handle = panel.querySelector(".mb-title");
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
      savePanelPosition({ left: rect.left, top: rect.top });
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
    style.id = "minibia-bot-style";
    style.textContent = `
      #minibia-bot-panel {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 999999;
        width: 640px;
        max-width: calc(100vw - 32px);
        padding: 12px;
        border: 1px solid rgba(224, 200, 148, 0.45);
        border-radius: 10px;
        background: linear-gradient(180deg, rgba(30, 23, 15, 0.95), rgba(15, 11, 8, 0.97));
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        color: #f1e2b8;
        font: 12px/1.35 Verdana, sans-serif;
        user-select: none;
      }

      #minibia-bot-panel[data-collapsed="true"] {
        width: 220px;
      }

      #minibia-bot-panel .mb-title {
        margin: 0;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        cursor: move;
      }

      #minibia-bot-panel .mb-titlebar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin: 0 0 8px;
      }

      #minibia-bot-panel .mb-icon-button {
        width: 24px;
        min-width: 24px;
        padding: 2px 0;
        border-radius: 6px;
        font-weight: 700;
        line-height: 1;
      }

      #minibia-bot-panel[data-collapsed="true"] .mb-titlebar {
        margin-bottom: 0;
      }

      #minibia-bot-panel .mb-body {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 240px;
        gap: 12px;
        align-items: start;
      }

      #minibia-bot-panel .mb-body[hidden] {
        display: none !important;
      }

      #minibia-bot-panel .mb-side-column,
      #minibia-bot-panel .mb-main-column {
        display: grid;
        gap: 10px;
      }

      #minibia-bot-panel .mb-section {
        padding-top: 10px;
        border-top: 1px solid rgba(224, 200, 148, 0.16);
      }

      #minibia-bot-panel .mb-column-section:first-child {
        padding-top: 0;
        border-top: 0;
      }

      #minibia-bot-panel .mb-label {
        margin: 0 0 8px;
        color: #d3c49d;
        word-break: break-word;
      }

      #minibia-bot-panel .mb-actions {
        display: grid;
        gap: 6px;
      }

      #minibia-bot-panel button {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid rgba(224, 200, 148, 0.35);
        border-radius: 8px;
        background: linear-gradient(180deg, #635133, #3f321f);
        color: #f7eccf;
        font: inherit;
        cursor: pointer;
      }

      #minibia-bot-panel button:hover {
        background: linear-gradient(180deg, #755f3d, #4f4028);
      }

      #minibia-bot-panel input,
      #minibia-bot-panel textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 8px 10px;
        border: 1px solid rgba(224, 200, 148, 0.35);
        border-radius: 8px;
        background: rgba(16, 12, 8, 0.88);
        color: #f7eccf;
        font: inherit;
      }

      #minibia-bot-panel textarea {
        min-height: 72px;
        resize: vertical;
      }

      #minibia-bot-panel .mb-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #d3c49d;
      }

      #minibia-bot-panel .mb-toggle input[type="checkbox"] {
        width: auto;
        margin: 0;
      }

      #minibia-bot-panel .mb-row {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: 8px;
      }

      #minibia-bot-panel .mb-row .mb-toggle {
        white-space: nowrap;
      }

      #minibia-bot-panel .mb-row input[type="text"] {
        min-width: 0;
      }

      #minibia-bot-panel .mb-row-three {
        display: grid;
        grid-template-columns: auto minmax(120px, 1fr) 72px;
        align-items: center;
        gap: 8px;
      }

      #minibia-bot-panel .mb-row-three input[type="text"],
      #minibia-bot-panel .mb-row-three input[type="number"] {
        min-width: 0;
      }

      #minibia-bot-panel .mb-row-five {
        display: grid;
        grid-template-columns: auto 82px 72px 82px 72px;
        align-items: center;
        gap: 8px;
      }

      #minibia-bot-panel .mb-row-five input[type="number"] {
        min-width: 0;
      }

      #minibia-bot-panel .mb-field-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      #minibia-bot-panel .mb-field {
        display: grid;
        gap: 4px;
      }

      #minibia-bot-panel .mb-field-label {
        color: #d3c49d;
        font-size: 11px;
      }

      #minibia-bot-panel .mb-stack {
        display: grid;
        gap: 8px;
      }

      #minibia-bot-panel .mb-inline {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px;
        align-items: center;
      }

      #minibia-bot-panel .mb-list {
        display: grid;
        gap: 6px;
      }

      #minibia-bot-panel .mb-list-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px;
        align-items: center;
        color: #d3c49d;
      }

      #minibia-bot-panel .mb-creature-row {
        padding: 6px 8px;
        border: 1px solid rgba(224, 200, 148, 0.14);
        border-radius: 8px;
        background: rgba(255, 244, 212, 0.04);
      }

      #minibia-bot-panel .mb-creature-name {
        color: #f7eccf;
        word-break: break-word;
      }

      #minibia-bot-panel .mb-floor-label {
        margin-top: 4px;
        color: #e2cf9c;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      #minibia-bot-panel .mb-side-column .mb-list {
        max-height: 340px;
        overflow-y: auto;
        padding-right: 2px;
      }

      #minibia-bot-panel #minibia-bot-panic-trusted-list {
        max-height: 140px;
        overflow-y: auto;
        padding-right: 2px;
      }

      #minibia-bot-panel .mb-small-button {
        width: auto;
        padding: 4px 8px;
        border-radius: 6px;
      }

      #minibia-bot-panel .mb-small-note {
        color: #b7a67d;
        font-size: 11px;
      }

      #minibia-bot-panel .mb-note {
        margin-top: 8px;
        color: #b7a67d;
        font-size: 11px;
      }

      @media (max-width: 760px) {
        #minibia-bot-panel {
          width: min(420px, calc(100vw - 32px));
        }

        #minibia-bot-panel .mb-body {
          grid-template-columns: 1fr;
        }

        #minibia-bot-panel .mb-field-grid {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);

    const panel = document.createElement("div");
    panel.id = "minibia-bot-panel";
    panel.innerHTML = `
        <div class="mb-titlebar">
        <div class="mb-title">Minibia Bot</div>
        <button type="button" class="mb-icon-button" id="minibia-bot-collapse" aria-label="Minimize panel" title="Minimize">−</button>
      </div>
      <div class="mb-body">
        <div class="mb-main-column">
          <div class="mb-actions mb-column-section">
            <button type="button" id="minibia-bot-reload">Reload Bot</button>
          </div>
          <div class="mb-section mb-column-section">
            <div class="mb-label" id="minibia-bot-home">Panic Runner Home: not set</div>
            <div class="mb-stack">
              <button type="button" id="minibia-bot-set-home">Set Home</button>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-panic-unknown" />
                <span>Unknown Player</span>
              </label>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-panic-health" />
                <span>Lose Health</span>
              </label>
              <div class="mb-inline">
                <input type="text" id="minibia-bot-panic-trusted-input" placeholder="Trusted name" />
                <button type="button" class="mb-small-button" id="minibia-bot-panic-trusted-add">Add</button>
              </div>
              <div class="mb-list" id="minibia-bot-panic-trusted-list"></div>
            </div>
          </div>
          <div class="mb-section mb-column-section">
            <div class="mb-label">GM Kill Switch</div>
            <div class="mb-stack">
              <div class="mb-inline">
                <input type="text" id="minibia-bot-panic-gm-input" placeholder="Game master name" />
                <button type="button" class="mb-small-button" id="minibia-bot-panic-gm-add">Add</button>
              </div>
              <div class="mb-list" id="minibia-bot-panic-gm-list"></div>
            </div>
          </div>
          <div class="mb-section mb-column-section">
            <div class="mb-actions">
              <div class="mb-row-three">
                <label class="mb-toggle">
                  <input type="checkbox" id="minibia-bot-rune-enabled" />
                  <span>Magic Level Trainer</span>
                </label>
                <input type="text" id="minibia-bot-rune-spell" placeholder="Spell words" />
                <input type="number" id="minibia-bot-rune-mana" min="0" placeholder="Mana" />
              </div>
              <div class="mb-row">
                <label class="mb-toggle">
                  <input type="checkbox" id="minibia-bot-auto-eat-enabled" />
                  <span>Auto Eat</span>
                </label>
                <div></div>
              </div>
            </div>
          </div>
          <div class="mb-note">Loaded routines: Panic Runner, magic level trainer, and auto eat.</div>
        </div>
        <div class="mb-side-column">
          <div class="mb-section mb-column-section">
            <div class="mb-label">Xray</div>
            <button type="button" class="mb-small-button" id="minibia-bot-xray-overlay-toggle">Disable Overlay</button>
            <div class="mb-small-note" id="minibia-bot-xray-overlay-status">Overlay: on</div>
            <div class="mb-list" id="minibia-bot-visible-creatures-list"></div>
          </div>
          <div class="mb-section mb-column-section">
            <div class="mb-label">Auto Heal</div>
            <div class="mb-stack">
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-auto-heal-enabled" />
                <span>Enable Auto Heal</span>
              </label>
              <div class="mb-field-grid">
                <label class="mb-field" for="minibia-bot-auto-heal-min-hp">
                  <span class="mb-field-label">Minimum HP</span>
                  <input type="number" id="minibia-bot-auto-heal-min-hp" min="0" placeholder="250" />
                </label>
                <label class="mb-field" for="minibia-bot-auto-heal-hp-hotkey">
                  <span class="mb-field-label">HP Hotkey (1-12)</span>
                  <input type="number" id="minibia-bot-auto-heal-hp-hotkey" min="1" max="12" placeholder="1" />
                </label>
                <label class="mb-field" for="minibia-bot-auto-heal-min-mana">
                  <span class="mb-field-label">Minimum Mana</span>
                  <input type="number" id="minibia-bot-auto-heal-min-mana" min="0" placeholder="150" />
                </label>
                <label class="mb-field" for="minibia-bot-auto-heal-mana-hotkey">
                  <span class="mb-field-label">Mana Hotkey (1-12)</span>
                  <input type="number" id="minibia-bot-auto-heal-mana-hotkey" min="1" max="12" placeholder="2" />
                </label>
              </div>
              <div class="mb-small-note">Checks once per second. HP is used before mana if both are low.</div>
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

    const spellInput = panel.querySelector("#minibia-bot-rune-spell");
    const manaInput = panel.querySelector("#minibia-bot-rune-mana");
    const runeEnabledInput = panel.querySelector("#minibia-bot-rune-enabled");
    const autoEatEnabledInput = panel.querySelector("#minibia-bot-auto-eat-enabled");
    const autoHealEnabledInput = panel.querySelector("#minibia-bot-auto-heal-enabled");
    const autoHealMinHpInput = panel.querySelector("#minibia-bot-auto-heal-min-hp");
    const autoHealHpHotkeyInput = panel.querySelector("#minibia-bot-auto-heal-hp-hotkey");
    const autoHealMinManaInput = panel.querySelector("#minibia-bot-auto-heal-min-mana");
    const autoHealManaHotkeyInput = panel.querySelector("#minibia-bot-auto-heal-mana-hotkey");
    const panicGmNameInput = panel.querySelector("#minibia-bot-panic-gm-input");
    const panicGmAddButton = panel.querySelector("#minibia-bot-panic-gm-add");
    const panicUnknownInput = panel.querySelector("#minibia-bot-panic-unknown");
    const panicHealthInput = panel.querySelector("#minibia-bot-panic-health");
    const panicTrustedInput = panel.querySelector("#minibia-bot-panic-trusted-input");
    const panicTrustedAddButton = panel.querySelector("#minibia-bot-panic-trusted-add");
    const xrayOverlayButton = panel.querySelector("#minibia-bot-xray-overlay-toggle");
    const collapseButton = panel.querySelector("#minibia-bot-collapse");
    const reloadButton = panel.querySelector("#minibia-bot-reload");

    if (collapseButton) {
      collapseButton.addEventListener("click", () => {
        const isCollapsed = panel.dataset.collapsed === "true";
        setPanelCollapsed(panel, !isCollapsed);
      });
    }

    if (reloadButton) {
      reloadButton.addEventListener("click", () => {
        window.minibiaBotReload?.();
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

    if (autoEatEnabledInput) {
      autoEatEnabledInput.checked = !!bot.eat?.status?.().running;
      autoEatEnabledInput.addEventListener("change", () => {
        if (autoEatEnabledInput.checked) {
          bot.eat.start();
        } else {
          bot.eat.stop();
        }

        refreshAutoEatStatus();
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

    if (xrayOverlayButton) {
      xrayOverlayButton.addEventListener("click", () => {
        const enabled = !!bot.xray?.status?.().config?.overlayEnabled;
        bot.xray?.setOverlayEnabled?.(!enabled);
        refreshXrayStatus();
      });
    }

    panel.querySelector("#minibia-bot-set-home")?.addEventListener("click", () => {
      bot.pz.setHomePzCurrentSpot();
      refreshHomeLabel();
    });

    refreshHomeLabel();
    refreshPanicStatus();
    refreshXrayStatus();
    renderGameMasterNames();
    renderTrustedNames();
    refreshRuneStatus();
    refreshAutoHealStatus();
    refreshAutoEatStatus();
    refreshVisibleCreatures();

    const visibleCreaturesTimerId = window.setInterval(refreshVisibleCreatures, 1000);
    bot.addCleanup(() => {
      window.clearInterval(visibleCreaturesTimerId);
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
    refreshAutoEatStatus,
    refreshVisibleCreatures,
    getSavedPanelPosition,
    getSavedPanelCollapsed,
    setPanelCollapsed: (collapsed) => {
      const panel = document.getElementById("minibia-bot-panel");
      setPanelCollapsed(panel, collapsed);
    },
  };
};
