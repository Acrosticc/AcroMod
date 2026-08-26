# AcroMod

**AcroMod** is a lightweight Tampermonkey userscript for **RLSimulator**, adding useful quality-of-life features and an in-page menu while keeping the experience simple and unobtrusive.

> ℹ️ **Staff Awareness:** RLSimulator staff are aware of AcroMod and its use by players. See [Staff Awareness](#-staff-awareness) below for the full statement and how this applies to future features.

## 📥 Installation

AcroMod requires **[Tampermonkey](https://www.tampermonkey.net/)**.

### Install AcroMod
**[➡️ Install AcroMod](https://raw.githubusercontent.com/Acrosticc/AcroMod/main/AcroMod.user.js)**

1. Install Tampermonkey if you haven't already.
2. Click **Install AcroMod** above.
3. Tampermonkey will open the installation page.
4. Click **Install**.

That's it! AcroMod will now be installed and ready to use on RLSimulator.

> **Note:** You do not need to manually download or install any files. Tampermonkey handles the installation for you.

## 🎮 Usage

After installing AcroMod:

1. Open **RLSimulator**.
2. Press **F2** to open or close the AcroMod menu.
3. Use the available features from the menu.

## 🔄 Updates

AcroMod checks for a newer version automatically while you play RLSimulator (on load, every 5 minutes, and whenever you navigate).

If a newer version is available, you'll see an **"Update required"** notice in the top-right corner of the page. This notice **cannot be dismissed** — it will keep reappearing until you update.

To update: click **Update now** and Tampermonkey will prompt you to install it — confirm the install and you're done.

> **Action is required from you when AcroMod is updated.** The update prompt is intentionally persistent so you can't keep using an outdated version by accident.

## 👮 Staff Awareness

RLSimulator staff have been made aware of AcroMod and its use by players. RLSimulator staff has confirmed that using AcroMod's current feature set will not result in a ban. This is **not** a blanket endorsement of every future feature — see below.

## ✅ Feature Approval Policy

To keep AcroMod's relationship with RLSimulator staff transparent and in good standing, the following policy applies to every feature, present and future:

* Every feature currently in AcroMod has been shared with and approved by staff.
* Any new feature added in a future update will only ship once it has received explicit approval from staff.
* If a feature has **not yet** received approval from all relevant staff members, it will **not** be included in AcroMod — not partially, not silently, not "for now." It simply waits until approval is given.
* This policy exists to protect users of AcroMod, not just the project itself — using an approved tool should never carry uncertainty about its standing.

## ⚠️ Disclaimer

AcroMod is an independent userscript and is **not an official RLSimulator product**, unless explicitly stated otherwise.

Use AcroMod at your own discretion.

## 📌 Current Version

**Version:** `1.0`
**Status:** Active development

## ✨ Features

### 🎛️ In-Page Menu
* Lightweight in-page interface, styled to stay out of the way.
* Toggle the menu open/closed using **F2**.
* Fully draggable — reposition it anywhere on screen.
* Remembers its position and open/closed state across page reloads and navigation.

### ⚔️ Duel Stats
RLSimulator's API only exposes currently *open* duels — there's no endpoint for duel history. AcroMod works around this by polling for open duels on an interval and watching for your own duels to resolve, recording the result the moment it happens.

* Tracks your own duel wins and losses as they happen.
* Shows a running **win/loss record**, **win rate**, and **net value** (items gained vs. lost) — both as a quick summary inside the menu and in a separate, more detailed floating panel.
* Floating panel lists your recent duels with item thumbnails for both sides, individually draggable and position-persistent.
* Only duels resolved *while AcroMod is running* are captured — there is no way to retroactively pull past duel history, since the site itself doesn't expose it.
* Panel can be shown or hidden from the menu at any time.

### 🔧 Preferences
Small toggles to clean up notification clutter:

* **Hide successfully sold item messages** — hides the green success popup shown after selling an item.
* **Hide "Please dont spam the crate opening!" messages** — hides the red error popup shown when opening crates too fast.
* **Hide duel results messages** — hides the won/lost duel result popup that appears bottom-left.

More features and improvements will be added over time — see [Feature Approval Policy](#-feature-approval-policy) above for how new features are decided.
