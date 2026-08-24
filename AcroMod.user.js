// ==UserScript==
// @name         AcroMod
// @namespace    https://rlsimulator.com/
// @version      1.1
// @description  AcroMod - a lightweight in-page menu for RLSimulator, toggled with F2.
// @author       Acrostic
// @match        https://rlsimulator.com/*
// @icon         https://rlsimulator.com/favicon.ico
// @updateURL    https://raw.githubusercontent.com/Acrosticc/AcroMod/main/AcroMod.user.js
// @downloadURL  https://raw.githubusercontent.com/Acrosticc/AcroMod/main/AcroMod.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/**
 * AcroMod
 * -----------------------------------------------------------------------
 * A small draggable menu (F2 to toggle) that hosts optional feature
 * panels:
 *
 *  - Duel Stats: there is no historic-duel API endpoint - /api/duels
 *    only returns currently OPEN duels. This module polls the endpoint,
 *    watches for duels involving your own account, and records the
 *    result the moment a `winner` first appears on a duel you're part
 *    of. Results persist in localStorage, so they survive page reloads
 *    (but only ever contain duels that resolved while this script was
 *    running somewhere). Key/item values from the API are stored in
 *    hundredths (e.g. 600 = 6 keys) - toKeys() converts for display.
 *
 *  - Preferences: toggles that watch for iziToast notification popups
 *    (sell confirmations, crate-opening rate-limit warnings) and remove
 *    them from the DOM before they're seen, based on their message text.
 * -----------------------------------------------------------------------
 */
(function () {
  "use strict";

  // =========================================================================
  // Shared helpers (storage, drag, formatting)
  // =========================================================================

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.warn("[AcroMod] failed to parse " + key + ", using fallback", err);
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn("[AcroMod] failed to save " + key, err);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Item/duel values come back from the API in hundredths of a key
  // (e.g. 600 -> 6 keys, 1750 -> 17.5 keys). Everything is stored raw
  // (as the API gives it) and only converted at display time, so old
  // localStorage data keeps working.
  function toKeys(rawValue) {
    return rawValue / 100;
  }

  function fmt(n) {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtSigned(n) {
    const sign = n > 0 ? "+" : n < 0 ? "-" : "";
    return sign + fmt(Math.abs(n));
  }

  // Generic draggable-panel behaviour, reused by the AcroMod menu itself
  // and by the Duel Stats panel. Position is persisted per positionKey.
  function makeDraggable(container, header, positionKey) {
    if (header.dataset.dragBound) return;
    header.dataset.dragBound = "1";

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener("mousedown", (evt) => {
      if (evt.target.closest("[data-no-drag]")) return;

      dragging = true;
      header.classList.add("am-dragging");

      const rect = container.getBoundingClientRect();
      offsetX = evt.clientX - rect.left;
      offsetY = evt.clientY - rect.top;

      container.style.left = rect.left + "px";
      container.style.top = rect.top + "px";
      container.style.right = "auto";
      container.style.bottom = "auto";

      evt.preventDefault();
    });

    window.addEventListener("mousemove", (evt) => {
      if (!dragging) return;

      let left = evt.clientX - offsetX;
      let top = evt.clientY - offsetY;

      const maxLeft = window.innerWidth - container.offsetWidth;
      const maxTop = window.innerHeight - container.offsetHeight;
      left = Math.min(Math.max(left, 0), Math.max(maxLeft, 0));
      top = Math.min(Math.max(top, 0), Math.max(maxTop, 0));

      container.style.left = left + "px";
      container.style.top = top + "px";
    });

    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      header.classList.remove("am-dragging");

      const rect = container.getBoundingClientRect();
      saveJSON(positionKey, { left: rect.left, top: rect.top });
    });
  }

  // Positions a freshly-created panel: restore saved position (clamped to
  // the viewport) or fall back to the given default.
  function placePanel(container, positionKey, fallback) {
    const pos = loadJSON(positionKey, null);
    if (pos) {
      const width = container.offsetWidth || 320;
      const height = container.offsetHeight || 200;
      const maxLeft = Math.max(window.innerWidth - width, 0);
      const maxTop = Math.max(window.innerHeight - height, 0);
      container.style.left = Math.min(Math.max(pos.left, 0), maxLeft) + "px";
      container.style.top = Math.min(Math.max(pos.top, 0), maxTop) + "px";
    } else if (fallback.left !== undefined) {
      container.style.left = fallback.left;
      container.style.top = fallback.top;
    } else {
      container.style.right = fallback.right;
      container.style.bottom = fallback.bottom;
    }
  }

  function ensureStyles() {
    if (document.getElementById("acromod-styles")) return;
    const style = document.createElement("style");
    style.id = "acromod-styles";
    style.textContent = `
      /* ---- AcroMod main menu: techy dashboard, ~4:3 ---- */
      #acromod-menu { position: fixed; width: 480px; height: 360px;
        background: #101214; color: #e8e8e8; border: 1px solid #23262b;
        border-radius: 6px; font-family: "SF Mono", "Consolas", "Roboto Mono", monospace;
        font-size: 12.5px; z-index: 10000; box-shadow: 0 10px 32px rgba(0,0,0,0.6);
        display: flex; flex-direction: column; overflow: hidden; }

      #acromod-menu .am-header { flex: 0 0 auto; display: flex;
        align-items: center; justify-content: space-between; padding: 9px 14px;
        background: #0b0d0f; border-bottom: 1px solid #23262b;
        cursor: grab; user-select: none; }
      #acromod-menu .am-header.am-dragging { cursor: grabbing; }
      #acromod-menu .am-header-left { font-size: 10px; color: #52585e;
        text-transform: uppercase; letter-spacing: 1px; }
      #acromod-menu .am-header-right { display: flex; align-items: center; gap: 6px; }
      #acromod-menu .am-logo-img { width: 16px; height: 16px; object-fit: contain; }
      #acromod-menu .am-title { font-weight: 700; font-size: 13px;
        letter-spacing: 0.4px; color: #f2f2f2; font-family: sans-serif; }

      #acromod-menu .am-body { flex: 1; display: flex; min-height: 0; }

      #acromod-menu .am-sidebar { width: 150px; flex: 0 0 auto;
        background: #0b0d0f; border-right: 1px solid #23262b;
        overflow-y: auto; padding: 6px 0; }
      #acromod-menu .am-nav-item { display: flex; align-items: center;
        justify-content: space-between; gap: 8px; padding: 10px 12px;
        cursor: pointer; border-left: 2px solid transparent;
        border-bottom: none; outline: none; box-shadow: none;
        color: #8a9098; font-family: sans-serif; }
      #acromod-menu .am-nav-item:hover { background: #15181b; color: #dcdcdc; }
      #acromod-menu .am-nav-item.am-active { background: #15181b; color: #fff;
        border-left-color: #00c896; border-bottom: none; outline: none; box-shadow: none; }
      #acromod-menu .am-nav-dot { width: 6px; height: 6px; border-radius: 50%;
        flex: 0 0 auto; background: #3a3f45; transition: background .15s, box-shadow .15s; }
      #acromod-menu .am-nav-dot.on { background: #00c896; box-shadow: 0 0 6px #00c896; }

      #acromod-menu .am-content { flex: 1; padding: 16px; overflow-y: auto;
        display: flex; flex-direction: column; gap: 14px; font-family: sans-serif; }
      #acromod-menu .am-module-header { display: flex; justify-content: space-between;
        align-items: flex-start; gap: 10px; }
      #acromod-menu .am-module-title { font-size: 15px; font-weight: 700; color: #fff; }
      #acromod-menu .am-module-desc { font-size: 11px; color: #7d838a; margin-top: 4px; }

      #acromod-menu .am-toggle { width: 38px; height: 20px; border-radius: 10px;
        background: #2a2d31; position: relative; cursor: pointer; flex: 0 0 auto;
        transition: background .15s; margin-top: 2px; }
      #acromod-menu .am-toggle.on { background: #00966e; }
      #acromod-menu .am-toggle .am-toggle-knob { position: absolute; top: 2px; left: 2px;
        width: 16px; height: 16px; border-radius: 50%; background: #fff;
        transition: left .15s; }
      #acromod-menu .am-toggle.on .am-toggle-knob { left: 20px; }

      #acromod-menu .am-mini-stats { display: flex; gap: 8px; }
      #acromod-menu .am-mini-box { flex: 1; background: #0b0d0f;
        border: 1px solid #1d2024; border-radius: 4px; padding: 9px; text-align: center; }
      #acromod-menu .am-mini-label { font-size: 9px; color: #5c6167;
        text-transform: uppercase; letter-spacing: 0.5px; }
      #acromod-menu .am-mini-value { font-size: 15px; font-weight: 700; margin-top: 4px; }

      #acromod-menu .am-info-box { background: #0b0d0f; border: 1px solid #1d2024;
        border-radius: 4px; padding: 10px 12px; font-size: 11px; line-height: 1.6;
        color: #9aa0a6; }
      #acromod-menu .am-info-box strong { color: #cfd3d6; }

      #acromod-menu .am-pref-row { display: flex; justify-content: space-between;
        align-items: center; gap: 10px; background: #0b0d0f; border: 1px solid #1d2024;
        border-radius: 4px; padding: 10px 12px; }
      #acromod-menu .am-pref-label { font-size: 12px; color: #e8e8e8; font-weight: 600; }
      #acromod-menu .am-pref-desc { font-size: 10.5px; color: #7d838a; margin-top: 3px; }

      #acromod-menu .am-footer { flex: 0 0 auto; padding: 7px 14px;
        background: #0b0d0f; border-top: 1px solid #23262b; font-size: 10.5px;
        color: #5c6167; display: flex; justify-content: space-between;
        align-items: center; font-family: sans-serif; }
      #acromod-menu .am-footer-dot { width: 6px; height: 6px; border-radius: 50%;
        background: #00c896; box-shadow: 0 0 6px #00c896; }

      /* ---- Duel Stats panel ---- */
      #dl-widget { position: fixed; width: 360px; background: #17191c;
        color: #fff; border: 1px solid #2b2e33; border-radius: 10px;
        font-family: sans-serif; font-size: 13px; z-index: 9999;
        box-shadow: 0 6px 20px rgba(0,0,0,0.5); display: flex; flex-direction: column; }
      #dl-widget .dl-header { flex: 0 0 auto; background: #17191c;
        padding: 10px 12px 12px; border-bottom: 1px solid #35393f;
        box-shadow: 0 1px 0 rgba(0,0,0,0.35);
        cursor: grab; user-select: none; }
      #dl-widget .dl-header.am-dragging { cursor: grabbing; }
      #dl-widget .dl-title-row { display:flex; justify-content:space-between;
        align-items:center; margin-bottom:8px; }
      #dl-widget .dl-title { font-weight: bold; font-size: 14px; }
      #dl-widget .dl-title::before { content: "\\2630"; margin-right: 6px; color: #666; font-size: 12px; }
      #dl-widget .dl-close { font-size: 11px; color: #9aa0a6; cursor: pointer; }
      #dl-widget .dl-stats { display: flex; gap: 8px; }
      #dl-widget .dl-stat-box { flex: 1; background: #0f1113; border-radius: 6px;
        padding: 6px 8px; text-align: center; }
      #dl-widget .dl-stat-label { font-size: 10px; color: #9aa0a6; text-transform: uppercase; }
      #dl-widget .dl-stat-value { font-size: 15px; font-weight: bold; margin-top: 2px; }
      #dl-widget .dl-body { flex: 0 0 auto; height: 360px; overflow-y: auto; background: #121316; }
      #dl-widget .dl-entry { padding: 8px 12px; border-bottom: 1px solid #232629; }
      #dl-widget .dl-entry-top { display: flex; justify-content: space-between;
        align-items: baseline; margin-bottom: 4px; }
      #dl-widget .dl-badge { font-weight: bold; padding: 1px 6px; border-radius: 4px; font-size: 11px; }
      #dl-widget .dl-badge.win { background: rgba(76,175,80,0.15); color: #4caf50; }
      #dl-widget .dl-badge.loss { background: rgba(244,67,54,0.15); color: #f44336; }
      #dl-widget .dl-net { font-weight: bold; }
      #dl-widget .dl-meta { font-size: 11px; color: #9aa0a6; margin-bottom: 6px; }
      #dl-widget .dl-sides { display: flex; gap: 6px; align-items: stretch; }
      #dl-widget .dl-side { flex: 1; background: #0f1113; border-radius: 6px;
        padding: 4px; display: flex; flex-direction: column; }
      #dl-widget .dl-side-label { font-size: 10px; color: #9aa0a6; margin-bottom: 2px; padding-left: 2px; }
      #dl-widget .dl-side-value { font-size: 10px; color: #cfd3d6; padding-left: 2px;
        margin-top: auto; padding-top: 4px; }
      #dl-widget .dl-empty { padding: 16px 12px; color: #9aa0a6; text-align: center; }
      #dl-widget .dl-show-more { display: block; width: 100%; padding: 10px;
        background: none; border: none; color: #9aa0a6; cursor: pointer; font-size: 12px; }
      #dl-widget .dl-show-more:hover { color: #fff; }
    `;
    document.head.appendChild(style);
  }

  // =========================================================================
  // AcroMod menu shell
  // =========================================================================

  const ACROMOD_OPEN_KEY = "acromod_open_v1";
  const ACROMOD_POS_KEY = "acromod_pos_v1";
  const ACROMOD_TAB_KEY = "acromod_selected_tab_v1";
  const ACROMOD_LOGO_URL = "https://rlsimulator.com/images/logo.png";

  let acroModOpen = loadJSON(ACROMOD_OPEN_KEY, false);

  // Modules are declared here so new features can be added later just by
  // pushing another entry with a label/description/isActive/toggle/
  // renderContent (and optionally bind, for wiring up event handlers on
  // the rendered content).
  const modules = [
    {
      id: "duelStats",
      label: "Duel Stats",
      description: "Recent duels, win rate & net value. Toggle the floating panel on or off.",
      isActive: () => duelWidgetVisible,
      toggle: () => setDuelWidgetVisible(!duelWidgetVisible),
      renderContent() {
        const stats = computeStats();
        const netColor = stats.net > 0 ? "#4caf50" : stats.net < 0 ? "#f44336" : "#cfd3d6";
        const winRateColor = stats.total > 0 && stats.winRate >= 50 ? "#4caf50" : "#f44336";

        return `
          <div class="am-module-header">
            <div>
              <div class="am-module-title">${escapeHtml(this.label)}</div>
              <div class="am-module-desc">${escapeHtml(this.description)}</div>
            </div>
            <div class="am-toggle ${this.isActive() ? "on" : ""}" data-no-drag id="am-duelstats-toggle">
              <div class="am-toggle-knob"></div>
            </div>
          </div>
          <div class="am-mini-stats">
            <div class="am-mini-box">
              <div class="am-mini-label">W-L</div>
              <div class="am-mini-value">
                <span style="color:#4caf50">${stats.wins}</span>-<span style="color:#f44336">${stats.losses}</span>
              </div>
            </div>
            <div class="am-mini-box">
              <div class="am-mini-label">Win rate</div>
              <div class="am-mini-value" style="color:${stats.total > 0 ? winRateColor : "#cfd3d6"}">
                ${stats.total > 0 ? stats.winRate.toFixed(1) + "%" : "-"}
              </div>
            </div>
            <div class="am-mini-box">
              <div class="am-mini-label">Net</div>
              <div class="am-mini-value" style="color:${netColor}">${fmtSigned(toKeys(stats.net))}</div>
            </div>
          </div>
          <div class="am-info-box">
            <strong>How this works:</strong> no history endpoint exists, so AcroMod polls
            <code>GET /api/duels</code> on an interval and diffs each response against an
            in-memory snapshot. The instant a tracked duel's <code>winner</code> field
            flips from unset, the result is parsed and pushed into
            <code>localStorage</code> - so your stats persist across reloads, but only
            duels resolved while AcroMod was actively polling get captured.
          </div>
          <div class="am-info-box">
            AcroMod has captured <strong>${stats.total}</strong> duel${stats.total === 1 ? "" : "s"}
            so far - only counted while it's been running.
          </div>
        `;
      },
      bind(contentEl) {
        const toggleEl = contentEl.querySelector("#am-duelstats-toggle");
        if (toggleEl) {
          toggleEl.addEventListener("click", () => {
            this.toggle();
            renderAcroModMenu();
          });
        }
      },
    },
    {
      id: "preferences",
      label: "Preferences",
      description: "Small tweaks to clean up your experience.",
      isActive: () => hideSoldToasts || hideSpamToasts,
      toggle: () => {},
      renderContent() {
        return `
          <div class="am-module-header">
            <div>
              <div class="am-module-title">${escapeHtml(this.label)}</div>
              <div class="am-module-desc">${escapeHtml(this.description)}</div>
            </div>
          </div>
          <div class="am-pref-row">
            <div>
              <div class="am-pref-label">Hide successfully sold item messages</div>
              <div class="am-pref-desc">Hides the green success popup that appears bottom-left after selling an item.</div>
            </div>
            <div class="am-toggle ${hideSoldToasts ? "on" : ""}" data-no-drag id="am-pref-hide-sold">
              <div class="am-toggle-knob"></div>
            </div>
          </div>
          <div class="am-pref-row">
            <div>
              <div class="am-pref-label">Hide "Please dont spam the crate opening!" messages</div>
              <div class="am-pref-desc">Hides the red error popup that appears bottom-left when opening crates too fast.</div>
            </div>
            <div class="am-toggle ${hideSpamToasts ? "on" : ""}" data-no-drag id="am-pref-hide-spam">
              <div class="am-toggle-knob"></div>
            </div>
          </div>
        `;
      },
      bind(contentEl) {
        const soldEl = contentEl.querySelector("#am-pref-hide-sold");
        if (soldEl) {
          soldEl.addEventListener("click", () => {
            setHideSoldToasts(!hideSoldToasts);
            renderAcroModMenu();
          });
        }
        const spamEl = contentEl.querySelector("#am-pref-hide-spam");
        if (spamEl) {
          spamEl.addEventListener("click", () => {
            setHideSpamToasts(!hideSpamToasts);
            renderAcroModMenu();
          });
        }
      },
    },
  ];

  const savedTabId = loadJSON(ACROMOD_TAB_KEY, null);
  let selectedModuleId = modules.some((m) => m.id === savedTabId) ? savedTabId : modules[0]?.id ?? null;

  function renderAcroModMenu() {
    ensureStyles();
    let container = document.getElementById("acromod-menu");
    let isNew = false;
    if (!container) {
      isNew = true;
      container = document.createElement("div");
      container.id = "acromod-menu";
      document.body.appendChild(container);
    }

    const activeModule = modules.find((m) => m.id === selectedModuleId) || modules[0] || null;
    const username = getOwnUsername();

    const sidebarHtml = modules
      .map(
        (m) => `
        <div class="am-nav-item ${m.id === activeModule?.id ? "am-active" : ""}" data-module-id="${m.id}">
          <span>${escapeHtml(m.label)}</span>
          <span class="am-nav-dot ${m.isActive() ? "on" : ""}"></span>
        </div>`
      )
      .join("");

    const contentHtml = activeModule
      ? activeModule.renderContent()
      : `<div class="am-module-desc">No module selected.</div>`;

    container.innerHTML = `
      <div class="am-header" id="acromod-header">
        <span class="am-header-right">
          <img class="am-logo-img" src="${ACROMOD_LOGO_URL}" alt="" />
          <span class="am-title">AcroMod</span>
        </span>
        <span class="am-header-left">v1.0 TEST FOR UPDATE</span>
      </div>
      <div class="am-body">
        <div class="am-sidebar">${sidebarHtml}</div>
        <div class="am-content">${contentHtml}</div>
      </div>
      <div class="am-footer">
        <span>${username ? "Tracking " + escapeHtml(username) : "Not logged in"}</span>
        <span class="am-footer-dot"></span>
      </div>
    `;

    container.style.display = acroModOpen ? "flex" : "none";

    if (isNew) {
      placePanel(container, ACROMOD_POS_KEY, { left: "20px", top: "70px" });
    }

    container.querySelectorAll(".am-nav-item").forEach((el) => {
      el.addEventListener("click", () => {
        selectedModuleId = el.dataset.moduleId;
        saveJSON(ACROMOD_TAB_KEY, selectedModuleId);
        renderAcroModMenu();
      });
    });

    if (activeModule?.bind) {
      const contentEl = container.querySelector(".am-content");
      if (contentEl) activeModule.bind(contentEl);
    }

    const header = document.getElementById("acromod-header");
    if (header) makeDraggable(container, header, ACROMOD_POS_KEY);
  }

  function setAcroModOpen(open) {
    acroModOpen = open;
    saveJSON(ACROMOD_OPEN_KEY, acroModOpen);
    renderAcroModMenu();
  }

  document.addEventListener("keydown", (evt) => {
    if (evt.key !== "F2") return;

    // Don't hijack F2 while the user is typing somewhere.
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;

    evt.preventDefault();
    setAcroModOpen(!acroModOpen);
  });

  // =========================================================================
  // Preferences module (toast hiding)
  // =========================================================================

  const PREF_HIDE_SOLD_KEY = "acromod_hide_sold_toast_v1";
  const PREF_HIDE_SPAM_KEY = "acromod_hide_spam_toast_v1";

  let hideSoldToasts = loadJSON(PREF_HIDE_SOLD_KEY, false);
  let hideSpamToasts = loadJSON(PREF_HIDE_SPAM_KEY, false);

  function setHideSoldToasts(value) {
    hideSoldToasts = value;
    saveJSON(PREF_HIDE_SOLD_KEY, hideSoldToasts);
  }

  function setHideSpamToasts(value) {
    hideSpamToasts = value;
    saveJSON(PREF_HIDE_SPAM_KEY, hideSpamToasts);
  }

  // Matches the "You have successfully sold your item for X keys!" toast.
  const SOLD_MESSAGE_RE = /successfully sold/i;
  // Matches "Please dont spam the crate opening!" (also tolerates an
  // apostrophe, in case the site's copy ever changes to "don't").
  const SPAM_MESSAGE_RE = /please\s+don'?t\s+spam\s+the\s+crate\s+opening/i;

  function maybeHideToast(toastEl) {
    const message = toastEl.querySelector(".iziToast-message")?.textContent || "";

    const isSoldToast = SOLD_MESSAGE_RE.test(message);
    const isSpamToast = SPAM_MESSAGE_RE.test(message);

    if ((isSoldToast && hideSoldToasts) || (isSpamToast && hideSpamToasts)) {
      // Remove the whole capsule (not just the toast) so no empty gap
      // is left behind in the wrapper.
      const capsule = toastEl.closest(".iziToast-capsule") || toastEl;
      capsule.remove();
    }
  }

  function handleAddedNode(node) {
    if (!(node instanceof Element)) return;
    if (node.matches?.(".iziToast")) {
      maybeHideToast(node);
      return;
    }
    node.querySelectorAll?.(".iziToast").forEach(maybeHideToast);
  }

  // iziToast toasts get appended into a wrapper under <body>. Watching
  // body's subtree catches new toasts as soon as they're inserted,
  // before the person ever sees them.
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(handleAddedNode);
    }
  }).observe(document.body, { childList: true, subtree: true });

  // =========================================================================
  // Duel Stats module
  // =========================================================================

  const DUELS_ENDPOINT = "https://rlsimulator.com/api/duels";
  const POLL_INTERVAL_MS = 5000;
  const LOG_KEY = "rls_duel_log_v2";
  const MAX_LOG_ENTRIES = 500;
  const DUEL_POS_KEY = "rls_duel_log_pos_v1"; // unchanged, keeps existing saved position
  const DUEL_VISIBLE_KEY = "rls_duel_widget_visible_v1";
  const WIDGET_ID = "dl-widget";

  let log = loadJSON(LOG_KEY, []);
  let visibleCount = 30; // how many entries to render before "show more"
  let duelWidgetVisible = loadJSON(DUEL_VISIBLE_KEY, true);
  // duelId -> last known { winner } snapshot, only for duels we've
  // decided are relevant to us
  const tracked = new Map();

  // The site renders different nav markup on different pages (e.g. the
  // ranking page uses #username-label / .menu-loggedin, while other pages
  // use .selfProfile.profile-link) - try known patterns in order, falling
  // back to a generic "profile link with a colored username span" match.
  const USERNAME_SELECTORS = [
    '#username-label span[style*="color"]',
    "a.selfProfile.profile-link span[style]",
    'a.menu-item[href^="/profile/"] span[style*="color"]',
  ];

  function getOwnUsername() {
    for (const sel of USERNAME_SELECTORS) {
      const el = document.querySelector(sel);
      const text = el?.textContent.trim();
      if (text) return text;
    }
    return null;
  }

  function saveLog() {
    saveJSON(LOG_KEY, log.slice(-MAX_LOG_ENTRIES));
  }

  function itemsTotal(items) {
    return (items || []).reduce((sum, i) => sum + (i.item?.price ?? 0), 0);
  }

  function simplifyItems(items) {
    return (items || []).map((i) => ({
      name: i.item.name,
      image: i.item.image,
      price: i.item.price,
      paint: i.item.paint,
    }));
  }

  function setDuelWidgetVisible(visible) {
    duelWidgetVisible = visible;
    saveJSON(DUEL_VISIBLE_KEY, duelWidgetVisible);
    renderDuelWidget();
  }

  // Re-creates the AcroMod menu and/or Duel Stats panel if their DOM
  // nodes were removed - e.g. by a client-side route change that
  // re-renders content directly appended to <body>.
  function ensurePanelsExist() {
    if (!document.getElementById("acromod-menu")) renderAcroModMenu();
    if (!document.getElementById(WIDGET_ID)) renderDuelWidget();
  }

  async function poll() {
    ensurePanelsExist();

    const username = getOwnUsername();
    if (!username) return; // not logged in, or nav markup not present here

    let duels;
    try {
      const res = await fetch(DUELS_ENDPOINT, { credentials: "include" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      duels = await res.json();
    } catch (err) {
      console.warn("[AcroMod] failed to fetch /api/duels", err);
      return;
    }

    const currentIds = new Set();

    for (const duel of duels) {
      currentIds.add(duel.id);

      const isCreator = duel.creator?.username === username;
      const isJoiner = duel.joiner?.username === username;
      if (!isCreator && !isJoiner) continue;

      const prev = tracked.get(duel.id);
      tracked.set(duel.id, { winner: duel.winner });

      const justResolved = duel.winner > 0 && (!prev || prev.winner === 0);
      if (justResolved) {
        recordResult(duel, username, isCreator);
      }
    }

    for (const id of Array.from(tracked.keys())) {
      if (!currentIds.has(id)) tracked.delete(id);
    }
  }

  function recordResult(duel, username, isCreator) {
    if (log.some((e) => e.id === duel.id)) return;

    const self = isCreator ? duel.creator : duel.joiner;
    const opponent = isCreator ? duel.joiner : duel.creator;
    const selfSide = isCreator ? 1 : 2;
    const won = duel.winner === selfSide;

    const selfValue = itemsTotal(self?.items);
    const opponentValue = itemsTotal(opponent?.items);

    const entry = {
      id: duel.id,
      timestamp: Date.now(),
      won,
      opponentUsername: opponent?.username ?? "Unknown",
      selfItems: simplifyItems(self?.items),
      opponentItems: simplifyItems(opponent?.items),
      selfValue,
      opponentValue,
      netChange: won ? opponentValue : -selfValue,
    };

    log.push(entry);
    saveLog();
    renderDuelWidget();
    renderAcroModMenu();
    console.log("[AcroMod] duel recorded", entry);
  }

  function computeStats() {
    let wins = 0;
    let losses = 0;
    let net = 0;
    for (const e of log) {
      if (e.won) wins++;
      else losses++;
      net += e.netChange;
    }
    const total = wins + losses;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    return { wins, losses, total, winRate, net };
  }

  function itemThumbs(items) {
    return items
      .map(
        (i) => `
        <img src="${escapeHtml(i.image)}" alt="${escapeHtml(i.name)}"
             title="${escapeHtml(i.name)} - ${fmt(toKeys(i.price))}"
             style="width:28px;height:28px;object-fit:contain;border-radius:4px;
                    background:#0f1113;margin:2px;" />`
      )
      .join("");
  }

  function renderDuelWidget() {
    ensureStyles();
    let container = document.getElementById(WIDGET_ID);
    let isNew = false;
    if (!container) {
      isNew = true;
      container = document.createElement("div");
      container.id = WIDGET_ID;
      document.body.appendChild(container);
      // Position immediately on creation, regardless of starting
      // visibility - otherwise a panel created while hidden never gets
      // placed, and toggling it visible later leaves it unpositioned
      // until the next full page load re-creates it.
      placePanel(container, DUEL_POS_KEY, { right: "12px", bottom: "12px" });
    }

    container.style.display = duelWidgetVisible ? "flex" : "none";
    if (!duelWidgetVisible) return; // no need to build markup while hidden

    const stats = computeStats();
    const netColor = stats.net > 0 ? "#4caf50" : stats.net < 0 ? "#f44336" : "#cfd3d6";
    const winRateColor = stats.total > 0 && stats.winRate >= 50 ? "#4caf50" : "#f44336";

    const reversed = log.slice().reverse();
    const shown = reversed.slice(0, visibleCount);
    const remaining = reversed.length - shown.length;

    const entriesHtml = shown
      .map((e) => {
        const netColorEntry = e.netChange > 0 ? "#4caf50" : "#f44336";
        return `
        <div class="dl-entry">
          <div class="dl-entry-top">
            <span>
              <span class="dl-badge ${e.won ? "win" : "loss"}">${e.won ? "WIN" : "LOSS"}</span>
              vs <b>${escapeHtml(e.opponentUsername)}</b>
            </span>
            <span class="dl-net" style="color:${netColorEntry}">${fmtSigned(toKeys(e.netChange))}</span>
          </div>
          <div class="dl-meta">${new Date(e.timestamp).toLocaleString()}</div>
          <div class="dl-sides">
            <div class="dl-side">
              <div class="dl-side-label">Your items</div>
              <div>${itemThumbs(e.selfItems)}</div>
              <div class="dl-side-value">${fmt(toKeys(e.selfValue))}</div>
            </div>
            <div class="dl-side">
              <div class="dl-side-label">Opponent items</div>
              <div>${itemThumbs(e.opponentItems)}</div>
              <div class="dl-side-value">${fmt(toKeys(e.opponentValue))}</div>
            </div>
          </div>
        </div>`;
      })
      .join("");

    const showMoreHtml =
      remaining > 0
        ? `<button class="dl-show-more" id="dl-more">Show ${Math.min(remaining, 30)} more (${remaining} left)</button>`
        : "";

    container.innerHTML = `
      <div class="dl-header" id="dl-header">
        <div class="dl-title-row">
          <span class="dl-title">Recent Duels</span>
          <span class="dl-close" id="dl-close">hide</span>
        </div>
        <div class="dl-stats">
          <div class="dl-stat-box">
            <div class="dl-stat-label">Tracked W-L</div>
            <div class="dl-stat-value">
              <span style="color:#4caf50">${stats.wins}</span>-<span style="color:#f44336">${stats.losses}</span>
            </div>
          </div>
          <div class="dl-stat-box">
            <div class="dl-stat-label">Win rate</div>
            <div class="dl-stat-value" style="color:${stats.total > 0 ? winRateColor : "#cfd3d6"}">${stats.total > 0 ? stats.winRate.toFixed(1) + "%" : "-"}</div>
          </div>
          <div class="dl-stat-box">
            <div class="dl-stat-label">Net</div>
            <div class="dl-stat-value" style="color:${netColor}">${fmtSigned(toKeys(stats.net))}</div>
          </div>
        </div>
      </div>
      <div class="dl-body">
        ${entriesHtml || '<div class="dl-empty">No duels recorded yet.</div>'}
        ${showMoreHtml}
      </div>
    `;

    const closeBtn = document.getElementById("dl-close");
    if (closeBtn) {
      closeBtn.onclick = (evt) => {
        evt.stopPropagation();
        setDuelWidgetVisible(false);
        renderAcroModMenu();
      };
    }

    const moreBtn = document.getElementById("dl-more");
    if (moreBtn) {
      moreBtn.onclick = () => {
        visibleCount += 30;
        renderDuelWidget();
      };
    }

    const header = document.getElementById("dl-header");
    if (header) makeDraggable(container, header, DUEL_POS_KEY);
  }

  // =========================================================================
  // Boot
  // =========================================================================
  renderAcroModMenu();
  renderDuelWidget();
  poll();
  setInterval(poll, POLL_INTERVAL_MS);

  // Some routes (e.g. the dashboard) re-render in a way that wipes out
  // elements appended directly to <body>, including our panels. Watching
  // body directly catches that instantly instead of waiting up to
  // POLL_INTERVAL_MS for the next poll's self-heal check to run.
  new MutationObserver(ensurePanelsExist).observe(document.body, { childList: true });
})();
