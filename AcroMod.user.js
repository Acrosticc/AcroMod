// ==UserScript==
// @name         AcroMod
// @namespace    https://rlsimulator.com/
// @version      1.0
// @description  AcroMod - RLSimulator Menu
// @author       Acrostic
// @match        https://rlsimulator.com/*
// @icon         https://rlsimulator.com/favicon.ico
// @updateURL    https://raw.githubusercontent.com/Acrosticc/AcroMod/main/AcroMod.user.js
// @downloadURL  https://raw.githubusercontent.com/Acrosticc/AcroMod/main/AcroMod.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const ACROMOD_VERSION = "1.0";
  const UPDATE_URL = "https://raw.githubusercontent.com/Acrosticc/AcroMod/main/AcroMod.user.js";

  // Update checker
  const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  // =========================================================================
  // Shared helpers
  // =========================================================================

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {}
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function toKeys(rawValue) {
    return rawValue / 100;
  }

  function fmt(n) {
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function fmtSigned(n) {
    const sign = n > 0 ? "+" : n < 0 ? "-" : "";
    return sign + fmt(Math.abs(n));
  }

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

      saveJSON(positionKey, {
        left: rect.left,
        top: rect.top
      });
    });
  }

  function placePanel(container, positionKey, fallback) {
    const pos = loadJSON(positionKey, null);

    if (pos) {
      const width = container.offsetWidth || 320;
      const height = container.offsetHeight || 200;

      const maxLeft = Math.max(window.innerWidth - width, 0);
      const maxTop = Math.max(window.innerHeight - height, 0);

      container.style.left =
        Math.min(Math.max(pos.left, 0), maxLeft) + "px";

      container.style.top =
        Math.min(Math.max(pos.top, 0), maxTop) + "px";
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
      #acromod-menu {
        position: fixed;
        width: 480px;
        height: 360px;
        background: #101214;
        color: #e8e8e8;
        border: 1px solid #23262b;
        border-radius: 6px;
        font-family: "SF Mono", "Consolas", "Roboto Mono", monospace;
        font-size: 12.5px;
        z-index: 10000;
        box-shadow: 0 10px 32px rgba(0,0,0,0.6);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      #acromod-menu .am-header {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 9px 14px;
        background: #0b0d0f;
        border-bottom: 1px solid #23262b;
        cursor: grab;
        user-select: none;
      }

      #acromod-menu .am-header.am-dragging {
        cursor: grabbing;
      }

      #acromod-menu .am-header-left {
        font-size: 10px;
        color: #52585e;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      #acromod-menu .am-header-right {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      #acromod-menu .am-logo-img {
        width: 16px;
        height: 16px;
        object-fit: contain;
      }

      #acromod-menu .am-title {
        font-weight: 700;
        font-size: 13px;
        letter-spacing: 0.4px;
        color: #f2f2f2;
        font-family: sans-serif;
      }

      #acromod-menu .am-body {
        flex: 1;
        display: flex;
        min-height: 0;
      }

      #acromod-menu .am-sidebar {
        width: 150px;
        flex: 0 0 auto;
        background: #0b0d0f;
        border-right: 1px solid #23262b;
        overflow-y: auto;
        padding: 6px 0;
      }

      #acromod-menu .am-nav-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 12px;
        cursor: pointer;
        border-left: 2px solid transparent;
        color: #8a9098;
        font-family: sans-serif;
      }

      #acromod-menu .am-nav-item:hover {
        background: #15181b;
        color: #dcdcdc;
      }

      #acromod-menu .am-nav-item.am-active {
        background: #15181b;
        color: #fff;
        border-left-color: #00c896;
      }

      #acromod-menu .am-nav-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex: 0 0 auto;
        background: #3a3f45;
        transition: background .15s, box-shadow .15s;
      }

      #acromod-menu .am-nav-dot.on {
        background: #00c896;
        box-shadow: 0 0 6px #00c896;
      }

      #acromod-menu .am-content {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 14px;
        font-family: sans-serif;
      }

      #acromod-menu .am-module-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
      }

      #acromod-menu .am-module-title {
        font-size: 15px;
        font-weight: 700;
        color: #fff;
      }

      #acromod-menu .am-module-desc {
        font-size: 11px;
        color: #7d838a;
        margin-top: 4px;
      }

      #acromod-menu .am-toggle {
        width: 38px;
        height: 20px;
        border-radius: 10px;
        background: #2a2d31;
        position: relative;
        cursor: pointer;
        flex: 0 0 auto;
        transition: background .15s;
        margin-top: 2px;
      }

      #acromod-menu .am-toggle.on {
        background: #00966e;
      }

      #acromod-menu .am-toggle .am-toggle-knob {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #fff;
        transition: left .15s;
      }

      #acromod-menu .am-toggle.on .am-toggle-knob {
        left: 20px;
      }

      #acromod-menu .am-mini-stats {
        display: flex;
        gap: 8px;
      }

      #acromod-menu .am-mini-box {
        flex: 1;
        background: #0b0d0f;
        border: 1px solid #1d2024;
        border-radius: 4px;
        padding: 9px;
        text-align: center;
      }

      #acromod-menu .am-mini-label {
        font-size: 9px;
        color: #5c6167;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      #acromod-menu .am-mini-value {
        font-size: 15px;
        font-weight: 700;
        margin-top: 4px;
      }

      #acromod-menu .am-info-box {
        background: #0b0d0f;
        border: 1px solid #1d2024;
        border-radius: 4px;
        padding: 10px 12px;
        font-size: 11px;
        line-height: 1.6;
        color: #9aa0a6;
      }

      #acromod-menu .am-info-box strong {
        color: #cfd3d6;
      }

      #acromod-menu .am-pref-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        background: #0b0d0f;
        border: 1px solid #1d2024;
        border-radius: 4px;
        padding: 10px 12px;
      }

      #acromod-menu .am-pref-label {
        font-size: 12px;
        color: #e8e8e8;
        font-weight: 600;
      }

      #acromod-menu .am-pref-desc {
        font-size: 10.5px;
        color: #7d838a;
        margin-top: 3px;
      }

      #acromod-menu .am-footer {
        flex: 0 0 auto;
        padding: 7px 14px;
        background: #0b0d0f;
        border-top: 1px solid #23262b;
        font-size: 10.5px;
        color: #5c6167;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-family: sans-serif;
      }

      #acromod-menu .am-footer-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #00c896;
        box-shadow: 0 0 6px #00c896;
      }

      #dl-widget {
        position: fixed;
        width: 360px;
        background: #17191c;
        color: #fff;
        border: 1px solid #2b2e33;
        border-radius: 10px;
        font-family: sans-serif;
        font-size: 13px;
        z-index: 9999;
        box-shadow: 0 6px 20px rgba(0,0,0,0.5);
        display: flex;
        flex-direction: column;
      }

      #dl-widget .dl-header {
        flex: 0 0 auto;
        background: #17191c;
        padding: 10px 12px 12px;
        border-bottom: 1px solid #35393f;
        cursor: grab;
        user-select: none;
      }

      #dl-widget .dl-header.am-dragging {
        cursor: grabbing;
      }

      #dl-widget .dl-title-row {
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-bottom:8px;
      }

      #dl-widget .dl-title {
        font-weight: bold;
        font-size: 14px;
      }

      #dl-widget .dl-title::before {
        content: "\\2630";
        margin-right: 6px;
        color: #666;
        font-size: 12px;
      }

      #dl-widget .dl-close {
        font-size: 11px;
        color: #9aa0a6;
        cursor: pointer;
      }

      #dl-widget .dl-stats {
        display: flex;
        gap: 8px;
      }

      #dl-widget .dl-stat-box {
        flex: 1;
        background: #0f1113;
        border-radius: 6px;
        padding: 6px 8px;
        text-align: center;
      }

      #dl-widget .dl-stat-label {
        font-size: 10px;
        color: #9aa0a6;
        text-transform: uppercase;
      }

      #dl-widget .dl-stat-value {
        font-size: 15px;
        font-weight: bold;
        margin-top: 2px;
      }

      #dl-widget .dl-body {
        flex: 0 0 auto;
        height: 360px;
        overflow-y: auto;
        background: #121316;
      }

      #dl-widget .dl-entry {
        padding: 8px 12px;
        border-bottom: 1px solid #232629;
      }

      #dl-widget .dl-entry-top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 4px;
      }

      #dl-widget .dl-badge {
        display: inline-block;
        font-weight: bold;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 11px;
        line-height: 1.2;
        width: fit-content;
      }

      #dl-widget .dl-badge.win {
        background: rgba(76,175,80,0.15);
        color: #4caf50;
      }

      #dl-widget .dl-badge.loss {
        background: rgba(244,67,54,0.15);
        color: #f44336;
      }

      #dl-widget .dl-net {
        font-weight: bold;
      }

      #dl-widget .dl-meta {
        font-size: 11px;
        color: #9aa0a6;
        margin-bottom: 6px;
      }

      #dl-widget .dl-sides {
        display: flex;
        gap: 6px;
        align-items: stretch;
      }

      #dl-widget .dl-side {
        flex: 1;
        background: #0f1113;
        border-radius: 6px;
        padding: 4px;
        display: flex;
        flex-direction: column;
      }

      #dl-widget .dl-side-label {
        font-size: 10px;
        color: #9aa0a6;
        margin-bottom: 2px;
        padding-left: 2px;
      }

      #dl-widget .dl-side-value {
        font-size: 10px;
        color: #cfd3d6;
        padding-left: 2px;
        margin-top: auto;
        padding-top: 4px;
      }

      #dl-widget .dl-empty {
        padding: 16px 12px;
        color: #9aa0a6;
        text-align: center;
      }

      #dl-widget .dl-show-more {
        display: block;
        width: 100%;
        padding: 10px;
        background: none;
        border: none;
        color: #9aa0a6;
        cursor: pointer;
        font-size: 12px;
      }

      #dl-widget .dl-show-more:hover {
        color: #fff;
      }

      #am-update-toast {
        position: fixed;
        top: 12px;
        right: 12px;
        width: 280px;
        background: #17191c;
        color: #fff;
        border: 1px solid #2b2e33;
        border-radius: 10px;
        font-family: sans-serif;
        font-size: 12.5px;
        z-index: 10001;
        box-shadow: 0 6px 20px rgba(0,0,0,0.5);
        padding: 12px 14px;
      }

      #am-update-toast .am-update-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }

      #am-update-toast .am-update-title {
        font-weight: 700;
        font-size: 13px;
      }

      #am-update-toast .am-update-desc {
        color: #9aa0a6;
        line-height: 1.5;
        margin-bottom: 10px;
      }

      #am-update-toast .am-update-btn {
        background: #00966e;
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 7px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        width: 100%;
      }

      #am-update-toast .am-update-btn:hover {
        background: #00c896;
      }
    `;

    document.head.appendChild(style);
  }

  // =========================================================================
  // AcroMod menu
  // =========================================================================

  const ACROMOD_OPEN_KEY = "acromod_open_v1";
  const ACROMOD_POS_KEY = "acromod_pos_v1";
  const ACROMOD_TAB_KEY = "acromod_selected_tab_v1";
  const ACROMOD_LOGO_URL = "https://rlsimulator.com/images/logo.png";

  let acroModOpen = loadJSON(ACROMOD_OPEN_KEY, false);

  const modules = [
    {
      id: "duelStats",

      label: "Duel Stats",

      description:
        "Recent duels, win rate & net value. Toggle the floating panel on or off.",

      isActive: () => duelWidgetVisible,

      toggle: () => setDuelWidgetVisible(!duelWidgetVisible),

      renderContent() {
        const stats = computeStats();

        const netColor =
          stats.net > 0
            ? "#4caf50"
            : stats.net < 0
            ? "#f44336"
            : "#cfd3d6";

        const winRateColor =
          stats.total > 0 && stats.winRate >= 50
            ? "#4caf50"
            : "#f44336";

        return `
          <div class="am-module-header">
            <div>
              <div class="am-module-title">${escapeHtml(this.label)}</div>
              <div class="am-module-desc">${escapeHtml(this.description)}</div>
            </div>

            <div class="am-toggle ${
              this.isActive() ? "on" : ""
            }" data-no-drag id="am-duelstats-toggle">
              <div class="am-toggle-knob"></div>
            </div>
          </div>

          <div class="am-mini-stats">
            <div class="am-mini-box">
              <div class="am-mini-label">W-L</div>
              <div class="am-mini-value">
                <span style="color:#4caf50">${stats.wins}</span>-
                <span style="color:#f44336">${stats.losses}</span>
              </div>
            </div>

            <div class="am-mini-box">
              <div class="am-mini-label">Win rate</div>
              <div class="am-mini-value"
                   style="color:${
                     stats.total > 0 ? winRateColor : "#cfd3d6"
                   }">
                ${
                  stats.total > 0
                    ? stats.winRate.toFixed(1) + "%"
                    : "-"
                }
              </div>
            </div>

            <div class="am-mini-box">
              <div class="am-mini-label">Net</div>
              <div class="am-mini-value"
                   style="color:${netColor}">
                ${fmtSigned(toKeys(stats.net))}
              </div>
            </div>
          </div>

          <div class="am-info-box">
            <strong>How this works:</strong> No history endpoint exists, so AcroMod polls
            <code>GET /api/duels</code> on an interval and diffs each response against an
            in-memory snapshot. The instant a tracked duel's <code>winner</code> field
            flips from unset, the result is parsed and pushed into
            <code>localStorage</code> - so your stats persist across reloads, but only
            duels resolved while AcroMod was actively polling get captured.
          </div>

          <div class="am-info-box">
            AcroMod has captured
            <strong>${stats.total}</strong>
            duel${stats.total === 1 ? "" : "s"} so far.
          </div>
        `;
      },

      bind(contentEl) {
        const toggleEl =
          contentEl.querySelector("#am-duelstats-toggle");

        if (toggleEl) {
          toggleEl.addEventListener("click", () => {
            this.toggle();
            renderAcroModMenu();
          });
        }
      }
    },

    {
      id: "preferences",

      label: "Preferences",

      description:
        "Small tweaks to clean up your experience.",

      isActive: () =>
        hideSoldToasts || hideSpamToasts || hideDuelResultToasts,

      toggle: () => {},

      renderContent() {
        return `
          <div class="am-module-header">
            <div>
              <div class="am-module-title">${escapeHtml(this.label)}</div>
              <div class="am-module-desc">${escapeHtml(
                this.description
              )}</div>
            </div>
          </div>

          <div class="am-pref-row">
            <div>
              <div class="am-pref-label">
                Hide successfully sold item messages
              </div>

              <div class="am-pref-desc">
                Hides the green success popup that appears bottom-left
                after selling an item.
              </div>
            </div>

            <div class="am-toggle ${
              hideSoldToasts ? "on" : ""
            }"
              data-no-drag
              id="am-pref-hide-sold">
              <div class="am-toggle-knob"></div>
            </div>
          </div>

          <div class="am-pref-row">
            <div>
              <div class="am-pref-label">
                Hide "Please dont spam the crate opening!" messages
              </div>

              <div class="am-pref-desc">
                Hides the red error popup that appears bottom-left
                when opening crates too fast.
              </div>
            </div>

            <div class="am-toggle ${
              hideSpamToasts ? "on" : ""
            }"
              data-no-drag
              id="am-pref-hide-spam">
              <div class="am-toggle-knob"></div>
            </div>
          </div>

          <div class="am-pref-row">
            <div>
              <div class="am-pref-label">
                Hide duel results messages
              </div>

              <div class="am-pref-desc">
                Hides the won/lost duel result popup that appears bottom-left.
              </div>
            </div>

            <div class="am-toggle ${
              hideDuelResultToasts ? "on" : ""
            }"
              data-no-drag
              id="am-pref-hide-duel-result">
              <div class="am-toggle-knob"></div>
            </div>
          </div>
        `;
      },

      bind(contentEl) {
        const soldEl =
          contentEl.querySelector("#am-pref-hide-sold");

        if (soldEl) {
          soldEl.addEventListener("click", () => {
            setHideSoldToasts(!hideSoldToasts);
            renderAcroModMenu();
          });
        }

        const spamEl =
          contentEl.querySelector("#am-pref-hide-spam");

        if (spamEl) {
          spamEl.addEventListener("click", () => {
            setHideSpamToasts(!hideSpamToasts);
            renderAcroModMenu();
          });
        }

        const duelResultEl =
          contentEl.querySelector("#am-pref-hide-duel-result");

        if (duelResultEl) {
          duelResultEl.addEventListener("click", () => {
            setHideDuelResultToasts(!hideDuelResultToasts);
            renderAcroModMenu();
          });
        }
      }
    }
  ];

  const savedTabId =
    loadJSON(ACROMOD_TAB_KEY, null);

  let selectedModuleId =
    modules.some((m) => m.id === savedTabId)
      ? savedTabId
      : modules[0]?.id ?? null;

  function renderAcroModMenu() {
    ensureStyles();

    let container =
      document.getElementById("acromod-menu");

    let isNew = false;

    if (!container) {
      isNew = true;

      container =
        document.createElement("div");

      container.id = "acromod-menu";

      document.body.appendChild(container);
    }

    const activeModule =
      modules.find(
        (m) => m.id === selectedModuleId
      ) || modules[0] || null;

    const username =
      getOwnUsername();

    const sidebarHtml =
      modules
        .map(
          (m) => `
          <div class="am-nav-item ${
            m.id === activeModule?.id
              ? "am-active"
              : ""
          }"
            data-module-id="${m.id}">

            <span>${escapeHtml(m.label)}</span>

            <span class="am-nav-dot ${
              m.isActive() ? "on" : ""
            }"></span>
          </div>
        `
        )
        .join("");

    const contentHtml =
      activeModule
        ? activeModule.renderContent()
        : `<div class="am-module-desc">
             No module selected.
           </div>`;

    container.innerHTML = `
      <div class="am-header" id="acromod-header">

        <span class="am-header-right">
          <img
            class="am-logo-img"
            src="${ACROMOD_LOGO_URL}"
            alt=""
          />

          <span class="am-title">
            AcroMod
          </span>
        </span>

        <span class="am-header-left">
          v${ACROMOD_VERSION}
        </span>

      </div>

      <div class="am-body">

        <div class="am-sidebar">
          ${sidebarHtml}
        </div>

        <div class="am-content">
          ${contentHtml}
        </div>

      </div>

      <div class="am-footer">
        <span>
          ${
            username
              ? "Tracking " + escapeHtml(username)
              : "Not logged in"
          }
        </span>

        <span class="am-footer-dot"></span>
      </div>
    `;

    container.style.display =
      acroModOpen ? "flex" : "none";

    if (isNew) {
      placePanel(
        container,
        ACROMOD_POS_KEY,
        {
          left: "20px",
          top: "70px"
        }
      );
    }

    container
      .querySelectorAll(".am-nav-item")
      .forEach((el) => {
        el.addEventListener("click", () => {

          selectedModuleId =
            el.dataset.moduleId;

          saveJSON(
            ACROMOD_TAB_KEY,
            selectedModuleId
          );

          renderAcroModMenu();
        });
      });

    if (activeModule?.bind) {
      const contentEl =
        container.querySelector(".am-content");

      if (contentEl) {
        activeModule.bind(contentEl);
      }
    }

    const header =
      document.getElementById("acromod-header");

    if (header) {
      makeDraggable(
        container,
        header,
        ACROMOD_POS_KEY
      );
    }
  }

  function setAcroModOpen(open) {
    acroModOpen = open;

    saveJSON(
      ACROMOD_OPEN_KEY,
      acroModOpen
    );

    renderAcroModMenu();
  }

  document.addEventListener("keydown", (evt) => {
    if (evt.key !== "F2") return;

    const tag =
      document.activeElement?.tagName;

    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      document.activeElement?.isContentEditable
    ) {
      return;
    }

    evt.preventDefault();

    setAcroModOpen(!acroModOpen);
  });

  // =========================================================================
  // Preferences
  // =========================================================================

  const PREF_HIDE_SOLD_KEY =
    "acromod_hide_sold_toast_v1";

  const PREF_HIDE_SPAM_KEY =
    "acromod_hide_spam_toast_v1";

  const PREF_HIDE_DUEL_RESULT_KEY =
    "acromod_hide_duel_result_toast_v1";

  let hideSoldToasts =
    loadJSON(PREF_HIDE_SOLD_KEY, false);

  let hideSpamToasts =
    loadJSON(PREF_HIDE_SPAM_KEY, false);

  let hideDuelResultToasts =
    loadJSON(PREF_HIDE_DUEL_RESULT_KEY, false);

  function setHideSoldToasts(value) {
    hideSoldToasts = value;

    saveJSON(
      PREF_HIDE_SOLD_KEY,
      hideSoldToasts
    );
  }

  function setHideSpamToasts(value) {
    hideSpamToasts = value;

    saveJSON(
      PREF_HIDE_SPAM_KEY,
      hideSpamToasts
    );
  }

  function setHideDuelResultToasts(value) {
    hideDuelResultToasts = value;

    saveJSON(
      PREF_HIDE_DUEL_RESULT_KEY,
      hideDuelResultToasts
    );
  }

  const SOLD_MESSAGE_RE =
    /successfully sold/i;

  const SPAM_MESSAGE_RE =
    /please\s+don'?t\s+spam\s+the\s+crate\s+opening/i;

  function maybeHideToast(toastEl) {
    const message =
      toastEl.querySelector(
        ".iziToast-message"
      )?.textContent || "";

    const isSoldToast =
      SOLD_MESSAGE_RE.test(message);

    const isSpamToast =
      SPAM_MESSAGE_RE.test(message);

    // The site reuses this same id for both the "Win" and "Lose"
    // duel-result toast, so matching on it covers both outcomes
    // without needing separate message patterns.
    const isDuelResultToast =
      toastEl.id === "duel-result";

    if (
      (isSoldToast && hideSoldToasts) ||
      (isSpamToast && hideSpamToasts) ||
      (isDuelResultToast && hideDuelResultToasts)
    ) {
      const capsule =
        toastEl.closest(
          ".iziToast-capsule"
        ) || toastEl;

      capsule.remove();
    }
  }

  function handleAddedNode(node) {
    if (!(node instanceof Element)) return;

    if (node.matches?.(".iziToast")) {
      maybeHideToast(node);
      return;
    }

    node
      .querySelectorAll?.(".iziToast")
      .forEach(maybeHideToast);
  }

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(
        handleAddedNode
      );
    }
  }).observe(document.body, {
    childList: true,
    subtree: true
  });

  // =========================================================================
  // Duel Stats
  // =========================================================================

  const DUELS_ENDPOINT =
    "https://rlsimulator.com/api/duels";

  const POLL_INTERVAL_MS = 5000;

  const LOG_KEY =
    "rls_duel_log_v2";

  const MAX_LOG_ENTRIES = 500;

  const DUEL_POS_KEY =
    "rls_duel_log_pos_v1";

  const DUEL_VISIBLE_KEY =
    "rls_duel_widget_visible_v1";

  const WIDGET_ID =
    "dl-widget";

  let log =
    loadJSON(LOG_KEY, []);

  let visibleCount = 15;

  let duelWidgetVisible =
    loadJSON(
      DUEL_VISIBLE_KEY,
      true
    );

  const tracked = new Map();

  const USERNAME_SELECTORS = [
    '#username-label span[style*="color"]',
    "a.selfProfile.profile-link span[style]",
    'a.menu-item[href^="/profile/"] span[style*="color"]'
  ];

  function getOwnUsername() {
    for (const sel of USERNAME_SELECTORS) {
      const el =
        document.querySelector(sel);

      const text =
        el?.textContent.trim();

      if (text) return text;
    }

    return null;
  }

  function saveLog() {
    saveJSON(
      LOG_KEY,
      log.slice(-MAX_LOG_ENTRIES)
    );
  }

  function itemsTotal(items) {
    return (items || []).reduce(
      (sum, i) =>
        sum + (i.item?.price ?? 0),
      0
    );
  }

  function simplifyItems(items) {
    return (items || []).map((i) => ({
      name: i.item.name,
      image: i.item.image,
      price: i.item.price,
      paint: i.item.paint
    }));
  }

  function setDuelWidgetVisible(visible) {
    duelWidgetVisible = visible;

    saveJSON(
      DUEL_VISIBLE_KEY,
      duelWidgetVisible
    );

    renderDuelWidget();
  }

  function ensurePanelsExist() {
    if (
      !document.getElementById(
        "acromod-menu"
      )
    ) {
      renderAcroModMenu();
    }

    if (
      !document.getElementById(
        WIDGET_ID
      )
    ) {
      renderDuelWidget();
    }
  }

  async function poll() {
    ensurePanelsExist();

    const username =
      getOwnUsername();

    if (!username) return;

    let duels;

    try {
      const res =
        await fetch(
          DUELS_ENDPOINT,
          {
            credentials: "include"
          }
        );

      if (!res.ok) {
        throw new Error(
          "HTTP " + res.status
        );
      }

      duels = await res.json();

    } catch (err) {
      return;
    }

    const currentIds =
      new Set();

    for (const duel of duels) {
      currentIds.add(duel.id);

      const isCreator =
        duel.creator?.username ===
        username;

      const isJoiner =
        duel.joiner?.username ===
        username;

      if (!isCreator && !isJoiner) {
        continue;
      }

      const prev =
        tracked.get(duel.id);

      tracked.set(
        duel.id,
        {
          winner: duel.winner
        }
      );

      const justResolved =
        duel.winner > 0 &&
        (!prev || prev.winner === 0);

      if (justResolved) {
        recordResult(
          duel,
          username,
          isCreator
        );
      }
    }

    for (
      const id of Array.from(
        tracked.keys()
      )
    ) {
      if (!currentIds.has(id)) {
        tracked.delete(id);
      }
    }
  }

  function recordResult(
    duel,
    username,
    isCreator
  ) {
    if (
      log.some(
        (e) => e.id === duel.id
      )
    ) {
      return;
    }

    const self =
      isCreator
        ? duel.creator
        : duel.joiner;

    const opponent =
      isCreator
        ? duel.joiner
        : duel.creator;

    const selfSide =
      isCreator ? 1 : 2;

    const won =
      duel.winner === selfSide;

    const selfValue =
      itemsTotal(self?.items);

    const opponentValue =
      itemsTotal(opponent?.items);

    const entry = {
      id: duel.id,
      timestamp: Date.now(),
      won,
      opponentUsername:
        opponent?.username ??
        "Unknown",
      selfItems:
        simplifyItems(
          self?.items
        ),
      opponentItems:
        simplifyItems(
          opponent?.items
        ),
      selfValue,
      opponentValue,
      netChange:
        won
          ? opponentValue
          : -selfValue
    };

    log.push(entry);

    saveLog();

    renderDuelWidget();

    renderAcroModMenu();
  }

  function computeStats() {
    let wins = 0;
    let losses = 0;
    let net = 0;

    for (const e of log) {
      if (e.won) {
        wins++;
      } else {
        losses++;
      }

      net += e.netChange;
    }

    const total =
      wins + losses;

    const winRate =
      total > 0
        ? (wins / total) * 100
        : 0;

    return {
      wins,
      losses,
      total,
      winRate,
      net
    };
  }

  function itemThumbs(items) {
    return items
      .map(
        (i) => `
          <img
            src="${escapeHtml(i.image)}"
            alt="${escapeHtml(i.name)}"
            title="${escapeHtml(
              i.name
            )} - ${fmt(
              toKeys(i.price)
            )}"
            style="
              width:28px;
              height:28px;
              object-fit:contain;
              border-radius:4px;
              background:#0f1113;
              margin:2px;
            "
          />
        `
      )
      .join("");
  }

  function renderDuelWidget() {
    ensureStyles();

    let container =
      document.getElementById(
        WIDGET_ID
      );

    let isNew = false;

    if (!container) {
      isNew = true;

      container =
        document.createElement("div");

      container.id =
        WIDGET_ID;

      document.body.appendChild(
        container
      );

      placePanel(
        container,
        DUEL_POS_KEY,
        {
          right: "12px",
          bottom: "12px"
        }
      );
    }

    container.style.display =
      duelWidgetVisible
        ? "flex"
        : "none";

    if (!duelWidgetVisible) {
      return;
    }

    const stats =
      computeStats();

    const netColor =
      stats.net > 0
        ? "#4caf50"
        : stats.net < 0
        ? "#f44336"
        : "#cfd3d6";

    const winRateColor =
      stats.total > 0 &&
      stats.winRate >= 50
        ? "#4caf50"
        : "#f44336";

    const reversed =
      log.slice().reverse();

    const shown =
      reversed.slice(
        0,
        visibleCount
      );

    const remaining =
      reversed.length -
      shown.length;

    const entriesHtml =
      shown
        .map((e) => {
          const netColorEntry =
            e.netChange > 0
              ? "#4caf50"
              : "#f44336";

          return `
            <div class="dl-entry">

              <div class="dl-entry-top">
                <span>
                  <span class="dl-badge ${
                    e.won
                      ? "win"
                      : "loss"
                  }">
                    ${
                      e.won
                        ? "WIN"
                        : "LOSS"
                    }
                  </span>

                  vs
                  <b>
                    ${escapeHtml(
                      e.opponentUsername
                    )}
                  </b>
                </span>

                <span
                  class="dl-net"
                  style="color:${netColorEntry}">
                  ${fmtSigned(
                    toKeys(
                      e.netChange
                    )
                  )}
                </span>
              </div>

              <div class="dl-meta">
                ${new Date(
                  e.timestamp
                ).toLocaleString()}
              </div>

              <div class="dl-sides">

                <div class="dl-side">
                  <div class="dl-side-label">
                    Your items
                  </div>

                  <div>
                    ${itemThumbs(
                      e.selfItems
                    )}
                  </div>

                  <div class="dl-side-value">
                    ${fmt(
                      toKeys(
                        e.selfValue
                      )
                    )}
                  </div>
                </div>

                <div class="dl-side">
                  <div class="dl-side-label">
                    Opponent items
                  </div>

                  <div>
                    ${itemThumbs(
                      e.opponentItems
                    )}
                  </div>

                  <div class="dl-side-value">
                    ${fmt(
                      toKeys(
                        e.opponentValue
                      )
                    )}
                  </div>
                </div>

              </div>

            </div>
          `;
        })
        .join("");

    const showMoreHtml =
      remaining > 0
        ? `
          <button
            class="dl-show-more"
            id="dl-more">
            Show ${Math.min(
              remaining,
              15
            )} more
          </button>
        `
        : "";

    // Rebuilding container.innerHTML wipes .dl-body's scroll position,
    // which is jarring when clicking "Show more" mid-list - capture it
    // here and restore it right after the rebuild below.
    const previousBody =
      container.querySelector(".dl-body");

    const previousScrollTop =
      previousBody ? previousBody.scrollTop : 0;

    container.innerHTML = `
      <div
        class="dl-header"
        id="dl-header">

        <div class="dl-title-row">

          <span class="dl-title">
            Recent Duels
          </span>

          <span
            class="dl-close"
            id="dl-close">
            hide
          </span>

        </div>

        <div class="dl-stats">

          <div class="dl-stat-box">
            <div class="dl-stat-label">
              Tracked W-L
            </div>

            <div class="dl-stat-value">
              <span style="color:#4caf50">
                ${stats.wins}
              </span>
              -
              <span style="color:#f44336">
                ${stats.losses}
              </span>
            </div>
          </div>

          <div class="dl-stat-box">
            <div class="dl-stat-label">
              Win rate
            </div>

            <div
              class="dl-stat-value"
              style="color:${
                stats.total > 0
                  ? winRateColor
                  : "#cfd3d6"
              }">

              ${
                stats.total > 0
                  ? stats.winRate.toFixed(
                      1
                    ) + "%"
                  : "-"
              }

            </div>
          </div>

          <div class="dl-stat-box">
            <div class="dl-stat-label">
              Net
            </div>

            <div
              class="dl-stat-value"
              style="color:${netColor}">
              ${fmtSigned(
                toKeys(
                  stats.net
                )
              )}
            </div>
          </div>

        </div>

      </div>

      <div class="dl-body">
        ${
          entriesHtml ||
          '<div class="dl-empty">No duels recorded yet.</div>'
        }

        ${showMoreHtml}
      </div>
    `;

    const newBody =
      container.querySelector(".dl-body");

    if (newBody) {
      newBody.scrollTop = previousScrollTop;
    }

    const closeBtn =
      document.getElementById(
        "dl-close"
      );

    if (closeBtn) {
      closeBtn.onclick = (evt) => {
        evt.stopPropagation();

        setDuelWidgetVisible(
          false
        );

        renderAcroModMenu();
      };
    }

    const moreBtn =
      document.getElementById(
        "dl-more"
      );

    if (moreBtn) {
      moreBtn.onclick = () => {
        visibleCount += 15;
        renderDuelWidget();
      };
    }

    const header =
      document.getElementById(
        "dl-header"
      );

    if (header) {
      makeDraggable(
        container,
        header,
        DUEL_POS_KEY
      );
    }
  }

  // =========================================================================
  // Update checker
  // =========================================================================

  function parseVersion(str) {
    return String(str)
      .trim()
      .split(".")
      .map(
        (part) =>
          parseInt(part, 10) || 0
      );
  }

  function isNewerVersion(
    remote,
    local
  ) {
    const r =
      parseVersion(remote);

    const l =
      parseVersion(local);

    for (
      let i = 0;
      i < Math.max(
        r.length,
        l.length
      );
      i++
    ) {
      const rv = r[i] || 0;
      const lv = l[i] || 0;

      if (rv !== lv) {
        return rv > lv;
      }
    }

    return false;
  }

  function renderUpdateToast(
    remoteVersion
  ) {
    ensureStyles();

    let toast =
      document.getElementById(
        "am-update-toast"
      );

    if (!toast) {
      toast =
        document.createElement(
          "div"
        );

      toast.id =
        "am-update-toast";

      document.body.appendChild(
        toast
      );
    }

    toast.innerHTML = `
      <div class="am-update-title-row">

        <span class="am-update-title">
          Update required
        </span>

      </div>

      <div class="am-update-desc">
        AcroMod v${escapeHtml(
          remoteVersion
        )} is out - you're on v${escapeHtml(
      ACROMOD_VERSION
    )}. Please update to keep using AcroMod.
      </div>

      <button
        class="am-update-btn"
        id="am-update-btn">
        Update now
      </button>
    `;

    document.getElementById(
      "am-update-btn"
    ).onclick = () => {
      window.open(
        UPDATE_URL,
        "_blank"
      );
    };
  }

  let updateCheckInProgress =
    false;

  async function checkForUpdate() {
    if (updateCheckInProgress) {
      return;
    }

    updateCheckInProgress = true;

    try {
      const url =
        UPDATE_URL +
        "?update_check=" +
        Date.now();

      const res =
        await fetch(url, {
          method: "GET",
          cache: "no-store"
        });

      if (!res.ok) {
        throw new Error(
          "HTTP " +
          res.status
        );
      }

      const text =
        await res.text();

      const match =
        text.match(
          /@version\s+([^\s]+)/i
        );

      if (!match) {
        return;
      }

      const remoteVersion =
        match[1].trim();

      if (
        isNewerVersion(
          remoteVersion,
          ACROMOD_VERSION
        )
      ) {
        renderUpdateToast(
          remoteVersion
        );
      }

    } catch (err) {
      // Silently ignore update-check errors.
    } finally {
      updateCheckInProgress =
        false;
    }
  }

  // =========================================================================
  // Boot
  // =========================================================================

  renderAcroModMenu();
  renderDuelWidget();

  poll();
  setInterval(
    poll,
    POLL_INTERVAL_MS
  );

  // Check immediately on startup.
  checkForUpdate();

  // Fallback update check every 5 minutes.
  setInterval(
    checkForUpdate,
    UPDATE_CHECK_INTERVAL_MS
  );

  // Check when the SPA changes URL using pushState.
  const originalPushState =
    history.pushState;

  history.pushState =
    function (...args) {
      const result =
        originalPushState.apply(
          this,
          args
        );

      checkForUpdate();

      return result;
    };

  // Check when the SPA changes URL using replaceState.
  const originalReplaceState =
    history.replaceState;

  history.replaceState =
    function (...args) {
      const result =
        originalReplaceState.apply(
          this,
          args
        );

      checkForUpdate();

      return result;
    };

  // Check when navigating back/forward.
  window.addEventListener(
    "popstate",
    checkForUpdate
  );

  // Keep panels alive if the site replaces body content.
  new MutationObserver(
    ensurePanelsExist
  ).observe(
    document.body,
    {
      childList: true
    }
  );
})();
