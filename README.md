# Activity Insights

A local, category-aware dashboard for [ActivityWatch](https://activitywatch.net/) that answers:

- **Which apps am I actually using?**
- **Which websites take the most time?**
- **Is that time work, learning, social media, entertainment, gaming…?**
- **When during the day am I active or focused?**

It is a **separate UI** — it reads ActivityWatch's API and never modifies your data. Everything runs locally on your machine. No accounts, no cloud sync, no telemetry.

> **Requirements:** [ActivityWatch](https://activitywatch.net/downloads/) running + [Node.js 18+](https://nodejs.org/)

---

## Quick start

### Windows

Double-click **`start.bat`** — the server and system-tray icon start in the background, your browser opens automatically, and the CMD window closes on its own.

```bat
:: Or from a terminal:
node server.js
```

**Tray controls:**
- **Left-click** the tray icon → opens the dashboard
- **Right-click** → Open Dashboard / Stop

**Stop the server:**

```bat
stop.bat
```

### Linux & macOS

```bash
chmod +x start.sh stop.sh
./start.sh           # starts server in background, opens browser
./stop.sh            # stop it
```

Or run directly in the foreground:

```bash
node server.js
```

Press `Ctrl+C` to stop.

---

## Options

| Environment variable | Default | Description |
|---|---|---|
| `PORT` | `5601` | Dashboard port |
| `AW_URL` | `http://127.0.0.1:5600` | ActivityWatch API URL |
| `NO_OPEN` | — | Set to `1` to skip browser auto-open |

**Windows:**
```bat
set PORT=5602 && node server.js
```

**Linux / macOS:**
```bash
PORT=5602 node server.js
```

The dashboard opens at **http://localhost:5601/** by default.

---

## What you get

| Panel | Description |
|---|---|
| **Summary cards** | Active time, focus time, longest focus block, top app with category mix |
| **Time by category** | Donut chart + legend across Work, Learning, Communication, Social media, Entertainment, Gaming, Web browsing, System & utilities, Other |
| **Activity timeline** | 24-hour strip for a single day — hover a block to see app, website, title, time range, and category |
| **Daily activity** | Stacked bar per day for 7 or 30 day ranges |
| **Top applications** | Ranked by time with per-category composition; browsers show their domain mix |
| **Top websites** | Ranked by time, from the ActivityWatch Web Watcher extension |
| **When you're active** | Hourly bar chart (1 day) or day × hour heatmap (7/30 days) |
| **CSV export** | Export the app or site list |
| **Editable rules** | Live-editable category rules, stored in your browser |

### Date ranges

`Today`, `Yesterday`, `Last 7 days`, `Last 30 days`. "Today" and multi-day ranges end at the current moment.

### Website data

Website data comes from the [ActivityWatch Web Watcher](https://github.com/ActivityWatch/aw-watcher-web) browser extension (`aw-watcher-web-*` buckets). App-level data works without it. Internal browser pages (`chrome://…`, new tab) and non-HTTP URLs are ignored. If more than one browser has a web-watcher bucket, their events are merged.

---

## How categories work

Rules live in **Categories** (top-right of the dashboard). Each line:

```
Category: pattern, pattern, pattern
```

- Matching is **case-insensitive**
- Rules are checked **in order; first match wins**
- Plain patterns match the app name, window title, and website domain as substrings
- Patterns with a dot are treated as **domains** — `x.com` matches `x.com` but not `linux.com`
- A leading `^` matches the **application name only** — `^explorer.exe`, `^firefox`
- Available categories: `Work`, `Learning`, `Communication`, `Social media`, `Entertainment`, `Gaming`, `Web browsing`, `System & utilities`, `Other`
- Friendly aliases: `Study` → Learning, `Binge-watch` → Entertainment, `SocialMedia` → Social media

**Example rules:**
```
Work: visual studio code, windows terminal, github, jira, docs.google.com
Learning: anki, coursera, udemy, stackoverflow, arxiv
Social media: facebook, instagram, x.com, reddit, tiktok
Entertainment: youtube, netflix, twitch, spotify
```

To reclassify YouTube as Learning: add `Learning: youtube, youtu.be` **above** the Entertainment line and save.

### One-click overrides

Click the category chip on a **single-category app** (in Top applications) or any **website** chip (in Top websites) to pick a different category. Overrides:
- Apply immediately
- Are stored only in this browser (`localStorage`)
- Beat rules
- Show a small dot on the chip

Use **Categories → Clear overrides** to reset them.

When a browser's time is split across multiple categories (e.g. Work on GitHub, Entertainment on YouTube), its chips are informational. Change those at the **website** level instead.

---

## How time is calculated

```
active window time  = window events ∩ not-afk events
app time            = active window time, grouped by application
website time        = web-watcher events ∩ browser window time ∩ not-afk
category time       = active window time, labelled per event
```

- If no AFK bucket exists, the whole selected range is considered active
- A browser event's category comes from the website overlapping that window; otherwise from the window title
- Website percentages are relative to total active time — site time is always a subset of browser time
- **Longest focus** merges consecutive Work/Learning blocks separated by gaps of ≤ 2 minutes
- The heatmap uses local time

---

## Project layout

```
aw-insights/
├── server.js              static server + /api proxy (zero npm deps)
├── start.bat              Windows launcher (background, tray icon)
├── stop.bat               Windows: stop server + tray
├── start.sh               Linux/macOS launcher (background)
├── stop.sh                Linux/macOS: stop server
├── tray.ps1               Windows system-tray companion (PowerShell)
├── package.json
├── LICENSE                MIT
├── CONTRIBUTING.md
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── analytics.js       pure time/category engine (also unit-tested)
│   └── app.js             UI, charts, rules, overrides, CSV export
└── test/
    └── analytics.test.js  13 unit tests (Node built-in test runner)
```

---

## Running tests

```bash
npm test
```

No install required — zero npm dependencies.

---

## Troubleshooting

**"Could not reach ActivityWatch"**

Check ActivityWatch is running and its API responds at `http://localhost:5600/api/0/info`, then press **Retry**.

**No websites showing**

- Install the [ActivityWatch Web Watcher](https://github.com/ActivityWatch/aw-watcher-web) extension
- Check a `web.tab.current` bucket exists at `http://localhost:5600/api/0/buckets/`
- Browse a normal `http://`/`https://` page for a minute, then refresh
- Website time only counts while a browser window is the active window

**Wrong category**

Click the category chip on the app/site, or edit the rules in Categories.

**Port 5601 already in use**

```bash
# Linux/macOS
PORT=5602 node server.js

# Windows
set PORT=5602 && node server.js
```

`start.bat` and `start.sh` detect an already-running instance and just open the browser instead.

**Linux: `start.sh` permission denied**

```bash
chmod +x start.sh stop.sh
```

**The date looks off**

Timestamps are converted to your computer's local timezone. Check your system clock settings.

---

## Extending it

- **New categories or colors:** edit `CATEGORIES` in `public/analytics.js` and add default patterns to `DEFAULT_RULES`. The UI reads the same list automatically.
- **More date ranges:** add a `data-preset` button in `index.html` and a case in `getRange()` in `public/app.js`.
- **Different look:** all styling is in `public/styles.css` using CSS custom properties.
- **New app name mappings:** add entries to `FRIENDLY_APPS` in `public/app.js` for any process name that should display with a nicer label.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports, rule improvements, and Linux/macOS app-name mappings are especially welcome.

## License

[MIT](LICENSE)
