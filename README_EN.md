<p align="center">
  <img src="chrome-extension/icons/icon128.png" width="80" height="80" alt="Linux.do Level Monitor">
</p>

<h1 align="center">Linux.do Level Monitor</h1>

<p align="center">
  <strong>An elegant Chrome extension for monitoring Linux.do forum trust levels and Credit balance</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v6.2.0-blue" alt="version">
  <img src="https://img.shields.io/badge/Manifest-V3-green" alt="manifest">
  <img src="https://img.shields.io/badge/license-MIT-orange" alt="license">
</p>

<p align="center">
  English | <a href="./README.md">简体中文</a>
</p>

---

## Screenshots

### Level Monitor & Credit Panel

<p align="center">
  <img src="screenshots/theme-card-level.png" width="280" alt="Card Theme - Level Monitor">
  <img src="screenshots/credit.png" width="280" alt="Credit Panel">
</p>
<p align="center">
  <em>Left: Card theme level monitor with detailed upgrade progress &nbsp;|&nbsp; Right: Credit panel showing LDC balance and 7-day transaction history</em>
</p>

### Multiple Game Themes

<p align="center">
  <img src="screenshots/theme-rpg-level.png" width="200" alt="RPG Theme">
  <img src="screenshots/theme-pixel-level.png" width="200" alt="Pixel Theme">
  <img src="screenshots/theme-card-purple-level.png" width="200" alt="Card Theme">
  <img src="screenshots/theme-cyber-level.png" width="200" alt="Cyber Theme">
</p>
<p align="center">
  <em>Left to right: ⚔️ RPG &nbsp;|&nbsp; 👾 Pixel &nbsp;|&nbsp; 🃏 Card &nbsp;|&nbsp; 🌆 Cyber</em>
</p>

---

## Features

### Trust Level Monitoring
- Real-time display of current trust level (Lv.0 ~ Lv.3)
- Detailed breakdown of upgrade requirements and current progress
- Multi-dimensional metrics: activity, engagement, compliance, etc.
- Max level detection with celebration animation

### Credit Integration
- Real-time LDC balance display
- Daily remaining quota
- 7-day income/expense statistics with daily breakdown
- User avatar and nickname display

### 5 Game-Themed Skins

| Theme | Style |
|-------|-------|
| 🎨 **Default** | Modern & minimal, orange gradient |
| ⚔️ **RPG** | Medieval fantasy, golden tone |
| 👾 **Pixel** | Retro terminal, CRT screen feel |
| 🃏 **Card** | Trading card game, gem decorations |
| 🌆 **Cyber** | Cyberpunk, neon glow effects |

### More
- Floating widget auto-expands on hover, auto-collapses on leave
- Level / Credit dual-tab layout with last selection memory
- Smart caching (level: 1 hour, credit: 30 minutes)
- Auto cache clearing on account switch
- Quick theme switching via popup

## Installation

### From Source (Developer Mode)

1. Clone this repository

```bash
git clone https://github.com/njyaoyao2019/linuxdo-level-monitor.git
```

2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** in the top right corner
4. Click **Load unpacked**
5. Select the `chrome-extension` folder from the project

## Usage

1. Visit [linux.do](https://linux.do) — a floating widget appears on the right side
2. **Hover** over the widget to see detailed level/credit information
3. **Click** the widget button to cycle through themes
4. Click the extension icon in the toolbar to select a theme from the popup

## Project Structure

```
chrome-extension/
├── manifest.json          # Extension config (Manifest V3)
├── background.js          # Background Service Worker for cross-origin requests
├── content.js             # Content Script, core business logic
├── popup/
│   ├── popup.html         # Popup page
│   ├── popup.js           # Popup logic
│   └── popup.css          # Popup styles
├── themes/
│   ├── base.css           # Base styles
│   ├── rpg.css            # RPG theme
│   ├── pixel.css          # Pixel theme
│   ├── card.css           # Card theme
│   └── cyber.css          # Cyber theme
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Architecture

```
┌─ Popup (popup/)
│  └─ Theme selection & version display
│
├─ Content Script (content.js)
│  ├─ Inject floating widget into page DOM
│  ├─ Parse level data (connect.linux.do / summary.json)
│  ├─ Fetch Credit data (credit.linux.do API)
│  └─ UI interaction & theme switching
│
└─ Background Service Worker (background.js)
   └─ Cross-origin request proxy (with cookies)
```

**Data Sources**

| Data | Source | Description |
|------|--------|-------------|
| Lv.2–3 progress | `connect.linux.do` | Parses progress bars and values from HTML |
| Lv.0–1 progress | `linux.do/u/{user}/summary.json` | Discourse API with CSRF token |
| Credit balance | `credit.linux.do/api/v1/*` | RESTful JSON API |

## Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Local storage for theme preferences and cached data |
| `activeTab` | Access current tab information |
| `https://linux.do/*` | Access forum pages, obtain CSRF token and summary data |
| `https://connect.linux.do/*` | Fetch user level progress |
| `https://credit.linux.do/*` | Fetch Credit balance data |

## Level Requirements Reference

### Lv.0 → Lv.1

| Requirement | Target |
|-------------|--------|
| Topics Entered | 5 |
| Posts Read | 30 |
| Read Time | 10 min |

### Lv.1 → Lv.2

| Requirement | Target |
|-------------|--------|
| Days Visited | 15 |
| Likes Given | 1 |
| Likes Received | 1 |
| Posts Created | 3 |
| Topics Entered | 20 |
| Posts Read | 100 |
| Read Time | 60 min |

> Lv.2 → Lv.3 requirements are dynamically displayed on the `connect.linux.do` page.

## License

[MIT License](./LICENSE)

## Author

**YaoYao**
