'use strict';

(function () {
  const A = window.AWAnalytics;

  const STORAGE_CATEGORIES = 'aw-insights.categories.v1';
  const STORAGE_RULES = 'aw-insights.rules.v1';
  const STORAGE_OVERRIDES = 'aw-insights.overrides.v1';
  const PRESET_LABELS = {
    today: 'Today',
    yesterday: 'Yesterday',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days'
  };
  const TOP_COUNT = 8;

  const FRIENDLY_APPS = {
    // Windows executables
    'brave.exe': 'Brave',
    'chrome.exe': 'Chrome',
    'msedge.exe': 'Microsoft Edge',
    'firefox.exe': 'Firefox',
    'windowsterminal.exe': 'Windows Terminal',
    'explorer.exe': 'File Explorer',
    'obsidian.exe': 'Obsidian',
    'searchhost.exe': 'Windows Search',
    'shellhost.exe': 'Quick Settings',
    'startmenuexperiencehost.exe': 'Start Menu',
    'lockapp.exe': 'Lock Screen',
    'aw-qt.exe': 'ActivityWatch',
    'rainmeter.exe': 'Rainmeter',
    'code.exe': 'VS Code',
    'notepad.exe': 'Notepad',
    'notepad++.exe': 'Notepad++',
    'winword.exe': 'Microsoft Word',
    'excel.exe': 'Microsoft Excel',
    'powerpnt.exe': 'PowerPoint',
    'outlook.exe': 'Outlook',
    'teams.exe': 'Microsoft Teams',
    'ms-teams.exe': 'Microsoft Teams',
    'discord.exe': 'Discord',
    'spotify.exe': 'Spotify',
    'vlc.exe': 'VLC',
    'systemsettings.exe': 'Settings',
    'taskmgr.exe': 'Task Manager',
    'applicationframehost.exe': 'Windows App',
    'dwm.exe': 'Desktop Window Manager',
    'snippingtool.exe': 'Snipping Tool',
    'photos.exe': 'Photos',
    'mspaint.exe': 'Paint',
    'calculatorapp.exe': 'Calculator',
    // Linux / cross-platform process names
    'google-chrome': 'Chrome',
    'google-chrome-stable': 'Chrome',
    'chromium': 'Chromium',
    'chromium-browser': 'Chromium',
    'brave-browser': 'Brave',
    'microsoft-edge': 'Microsoft Edge',
    'firefox': 'Firefox',
    'thunderbird': 'Thunderbird',
    'code': 'VS Code',
    'cursor': 'Cursor',
    'obsidian': 'Obsidian',
    'discord': 'Discord',
    'spotify': 'Spotify',
    'vlc': 'VLC',
    'steam': 'Steam',
    'nautilus': 'Files (Nautilus)',
    'dolphin': 'Dolphin File Manager',
    'thunar': 'Thunar File Manager',
    'nemo': 'Nemo File Manager',
    'gnome-terminal': 'GNOME Terminal',
    'konsole': 'Konsole',
    'alacritty': 'Alacritty',
    'kitty': 'Kitty',
    'wezterm': 'WezTerm',
    'tilix': 'Tilix',
    'xterm': 'XTerm',
    'aw-qt': 'ActivityWatch',
    'aw-server': 'ActivityWatch Server',
    'gimp': 'GIMP',
    'inkscape': 'Inkscape',
    'libreoffice': 'LibreOffice',
    'soffice': 'LibreOffice',
    'evince': 'Document Viewer',
    'eog': 'Image Viewer',
    'totem': 'Videos',
    'rhythmbox': 'Rhythmbox',
    'audacity': 'Audacity',
    'krita': 'Krita',
    'blender': 'Blender',
    'zoom': 'Zoom',
    'slack': 'Slack',
    'teams': 'Microsoft Teams',
    'signal': 'Signal',
    'telegram-desktop': 'Telegram',
    'telegramdesktop': 'Telegram',
    'gnome-calculator': 'Calculator',
    'kcalc': 'Calculator',
    'systemsettings5': 'System Settings',
    'gnome-control-center': 'Settings',
    'gnome-system-monitor': 'System Monitor'
  };

  const state = {
    preset: 'today',
    rangeStart: null,
    rangeEnd: null,
    info: null,
    buckets: null,
    raw: null,
    usage: null,
    categories: loadCategories(),
    categoryById: new Map(),
    rulesText: loadText(STORAGE_RULES) || A.DEFAULT_RULES_TEXT,
    rules: [],
    overrides: { apps: {}, sites: {} },
    showAllApps: false,
    showAllSites: false,
    loading: false,
    requestId: 0,
    lastUpdated: null,
    lastGood: null,
    popover: null,
    popoverAnchor: null
  };
  state.categoryById = new Map(state.categories.map(function (c) { return [c.id, c]; }));
  state.overrides = loadOverrides();

  const parsedInitial = A.parseRules(state.rulesText, state.categories);
  state.rules = parsedInitial.errors.length ? A.parseRules(A.DEFAULT_RULES_TEXT, state.categories).rules : parsedInitial.rules;
  if (parsedInitial.errors.length || !state.rules.length) {
    state.rulesText = A.DEFAULT_RULES_TEXT;
  }

  /* ------------------------------------------------------------------ *
   * Elements
   * ------------------------------------------------------------------ */

  const els = {};
  const $ = function (id) { return document.getElementById(id); };

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function loadText(key) {
    try { return localStorage.getItem(key); } catch (err) { return null; }
  }

  function saveText(key, value) {
    try { localStorage.setItem(key, value); } catch (err) { /* ignore */ }
  }

  function loadCategories() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_CATEGORIES) || 'null');
      if (Array.isArray(raw) && raw.length) {
        const valid = raw.filter(function (c) {
          return c && typeof c.id === 'string' && typeof c.label === 'string' && typeof c.color === 'string';
        });
        if (valid.length) return valid;
      }
    } catch (err) { /* ignore */ }
    return A.DEFAULT_CATEGORIES.map(function (c) { return Object.assign({}, c); });
  }

  function saveCategories() {
    saveText(STORAGE_CATEGORIES, JSON.stringify(state.categories));
    state.categoryById = new Map(state.categories.map(function (c) { return [c.id, c]; }));
  }

  function loadOverrides() {
    try {
      return A.sanitizeOverrides(JSON.parse(localStorage.getItem(STORAGE_OVERRIDES) || '{}'), state.categories);
    } catch (err) {
      return { apps: {}, sites: {} };
    }
  }

  function saveOverrides() {
    state.overrides = A.sanitizeOverrides(state.overrides, state.categories);
    saveText(STORAGE_OVERRIDES, JSON.stringify(state.overrides));
  }

  function fmtDuration(seconds) {
    const s = Math.max(0, Math.round(Number(seconds) || 0));
    if (s < 60) return s + 's';
    const totalMinutes = Math.round(s / 60);
    if (totalMinutes < 60) return totalMinutes + 'm';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? hours + 'h ' + minutes + 'm' : hours + 'h';
  }

  function fmtPercent(seconds, total) {
    if (!total) return '0%';
    const percent = (seconds / total) * 100;
    if (percent > 0 && percent < 1) return '<1%';
    return Math.round(percent) + '%';
  }

  function fmtClock(ts) {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date(ts));
  }

  function longDate(ts) {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long', month: 'long', day: 'numeric'
    }).format(new Date(ts));
  }

  function mediumDate(ts) {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short', day: 'numeric'
    }).format(new Date(ts));
  }

  function shortWeekday(ts) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(ts));
  }

  function fullDate(ts) {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short', month: 'short', day: 'numeric'
    }).format(new Date(ts));
  }

  function rangeTitle(range, preset) {
    if (preset === 'today' || preset === 'yesterday') return longDate(range.start);
    const end = range.end - 1;
    const startDate = new Date(range.start);
    const endDate = new Date(end);
    const sameYear = startDate.getFullYear() === endDate.getFullYear();
    return mediumDate(range.start) + ' – ' + mediumDate(end) +
      (sameYear ? ', ' + endDate.getFullYear() : ', ' + startDate.getFullYear() + ' – ' + endDate.getFullYear());
  }

  function category(id) {
    return state.categoryById.get(id) || state.categoryById.get('other') || state.categories[0] || { id: 'other', label: 'Other', color: '#475569' };
  }

  function categoryLabel(id) {
    return category(id).label;
  }

  function categoryColor(id) {
    return category(id).color;
  }

  function hexToRgba(hex, alpha) {
    const clean = String(hex).replace('#', '');
    const value = parseInt(clean.length === 3
      ? clean.split('').map(function (c) { return c + c; }).join('')
      : clean, 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  function prettyApp(app) {
    const raw = String(app || 'Unknown');
    const key = raw.toLowerCase();
    if (FRIENDLY_APPS[key]) return FRIENDLY_APPS[key];
    return raw.replace(/\.exe$/i, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  }

  function appLetter(app) {
    const name = prettyApp(app).replace(/[^a-zA-Z0-9]/g, '');
    return (name.charAt(0) || '?').toUpperCase();
  }

  function domainLetter(domain) {
    return (String(domain || '?').replace(/[^a-zA-Z0-9]/g, '').charAt(0) || '?').toUpperCase();
  }

  function faviconUrl(domain) {
    if (!domain) return null;
    if (domain === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) return null;
    return 'https://icons.duckduckgo.com/ip3/' + encodeURIComponent(domain) + '.ico';
  }

  function topCategory(cats) {
    let best = 'other';
    let seconds = -1;
    Object.keys(cats || {}).forEach(function (id) {
      if (cats[id] > seconds) {
        seconds = cats[id];
        best = id;
      }
    });
    return best;
  }

  function activeCategoryList(usage) {
    return usage.categories
      .filter(function (c) { return c.seconds >= 1; })
      .sort(function (a, b) { return b.seconds - a.seconds; });
  }

  /* ------------------------------------------------------------------ *
   * API / data loading
   * ------------------------------------------------------------------ */

  async function api(path) {
    const res = await fetch(path, { cache: 'no-store' });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (err) { data = text; }

    if (!res.ok) {
      const message = data && typeof data === 'object' && data.error
        ? data.error + (data.detail ? ' — ' + data.detail : '')
        : 'Request failed with status ' + res.status;
      throw new Error(message);
    }
    return data;
  }

  function addDays(timestamp, amount) {
    const d = new Date(timestamp);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + amount).getTime();
  }

  function getRange(preset) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    switch (preset) {
      case 'yesterday':
        return { start: addDays(today, -1), end: today };
      case '7d':
        return { start: addDays(today, -6), end: now.getTime() };
      case '30d':
        return { start: addDays(today, -29), end: now.getTime() };
      case 'today':
      default:
        return { start: today, end: now.getTime() };
    }
  }

  async function discover() {
    const results = await Promise.all([
      api('/api/0/info'),
      api('/api/0/buckets/')
    ]);
    state.info = results[0];
    state.buckets = results[1];
  }

  function bucketEntries(type) {
    if (!state.buckets) return [];
    return Object.keys(state.buckets)
      .map(function (id) { return { id: id, info: state.buckets[id] }; })
      .filter(function (entry) { return entry.info && entry.info.type === type; });
  }

  function hostPool(entries) {
    const hostname = state.info && state.info.hostname;
    const host = entries.filter(function (entry) {
      return hostname && entry.info.hostname === hostname;
    });
    return host.length ? host : entries;
  }

  function sortByRecent(entries) {
    return entries.slice().sort(function (a, b) {
      const at = Date.parse(a.info.last_updated || 0) || 0;
      const bt = Date.parse(b.info.last_updated || 0) || 0;
      return bt - at;
    });
  }

  function pickBucket(type) {
    const entries = bucketEntries(type);
    if (!entries.length) return null;
    return sortByRecent(hostPool(entries))[0].id;
  }

  function pickWebBuckets() {
    const entries = bucketEntries('web.tab.current');
    if (!entries.length) return [];

    const hostname = state.info && state.info.hostname;
    const host = entries.filter(function (entry) {
      return hostname && entry.info.hostname === hostname;
    });

    // One bucket per browser on this host: merge them all.
    // If the host has no own buckets, use only the newest to avoid
    // double-counting duplicated watcher data.
    if (host.length) return sortByRecent(host).map(function (entry) { return entry.id; });
    return [sortByRecent(entries)[0].id];
  }

  function fetchEvents(bucketId, range) {
    const params = new URLSearchParams({
      start: new Date(range.start).toISOString(),
      end: new Date(range.end).toISOString(),
      limit: '-1'
    });
    return api('/api/0/buckets/' + encodeURIComponent(bucketId) + '/events?' + params.toString());
  }

  function setStatus(ok, text) {
    els.connState.classList.toggle('is-offline', !ok);
    els.connText.textContent = text;
  }

  function showBanner(message) {
    els.bannerDetail.textContent = message ? ' ' + message : '';
    els.banner.hidden = false;
  }

  function hideBanner() {
    els.banner.hidden = true;
  }

  async function loadData(options) {
    const opts = options || {};
    const requestId = ++state.requestId;
    const range = getRange(state.preset);
    const firstLoad = !state.usage;

    state.rangeStart = range.start;
    state.rangeEnd = range.end;
    state.loading = true;
    hideTooltip();
    els.progress.classList.add('active');
    els.refreshBtn.disabled = true;
    if (firstLoad && !opts.silent) els.loader.hidden = false;

    try {
      await discover();

      const windowBucket = pickBucket('currentwindow');
      if (!windowBucket) {
        throw new Error('No window watcher bucket found. Is aw-watcher-window running?');
      }
      const afkBucket = pickBucket('afkstatus');
      const webBuckets = pickWebBuckets();

      const webRequest = webBuckets.length
        ? Promise.all(webBuckets.map(function (id) { return fetchEvents(id, range); }))
            .then(function (lists) { return lists.flat(); })
        : Promise.resolve([]);

      const requests = [
        fetchEvents(windowBucket, range),
        afkBucket ? fetchEvents(afkBucket, range) : Promise.resolve([]),
        webRequest
      ];
      const responses = await Promise.all(requests);
      if (requestId !== state.requestId) return;

      state.raw = {
        windowEvents: responses[0] || [],
        afkEvents: responses[1] || [],
        webEvents: responses[2] || [],
        rangeStart: range.start,
        rangeEnd: range.end
      };

      setStatus(true, state.info.hostname);
      hideBanner();
      state.lastUpdated = new Date();
      state.lastGood = { preset: state.preset, rangeStart: range.start, rangeEnd: range.end };
      applyAndRender();
    } catch (err) {
      if (requestId !== state.requestId) return;
      setStatus(false, 'Offline');
      showBanner(err && err.message ? err.message : String(err));

      if (state.usage && state.lastGood) {
        state.preset = state.lastGood.preset;
        state.rangeStart = state.lastGood.rangeStart;
        state.rangeEnd = state.lastGood.rangeEnd;
        setActivePreset(state.preset);
      } else {
        state.usage = A.computeUsage({ rangeStart: range.start, rangeEnd: range.end, categories: state.categories });
        render();
      }
    } finally {
      if (requestId === state.requestId) {
        state.loading = false;
        els.progress.classList.remove('active');
        els.refreshBtn.disabled = false;
        els.loader.hidden = true;
      }
    }
  }

  function applyAndRender() {
    if (!state.raw) return;
    state.usage = A.computeUsage({
      windowEvents: state.raw.windowEvents,
      webEvents: state.raw.webEvents,
      afkEvents: state.raw.afkEvents,
      rangeStart: state.raw.rangeStart,
      rangeEnd: state.raw.rangeEnd,
      categories: state.categories,
      rules: state.rules,
      overrides: state.overrides
    });
    render();
  }

  /* ------------------------------------------------------------------ *
   * Render
   * ------------------------------------------------------------------ */

  function render() {
    hideTooltip();
    const usage = state.usage;
    if (!usage) return;

    renderRangeInfo(usage);
    renderStats(usage);
    renderCategories(usage);
    renderAppList(usage);
    renderSiteList(usage);
    renderRhythm(usage);
    renderUpdatedAt();
  }

  function renderRangeInfo(usage) {
    const range = { start: state.rangeStart, end: state.rangeEnd };
    let title = rangeTitle(range, state.preset);
    els.rangeTitle.textContent = title;
    document.title = 'Activity Insights · ' + PRESET_LABELS[state.preset];

    const parts = [PRESET_LABELS[state.preset]];
    if (usage.totalActive > 0) {
      parts.push(fmtDuration(usage.totalActive) + ' active');
      parts.push(usage.appList.length + ' app' + (usage.appList.length === 1 ? '' : 's'));
      if (usage.siteList.length) {
        parts.push(usage.siteList.length + ' site' + (usage.siteList.length === 1 ? '' : 's'));
      }
    }
    if (state.lastUpdated) {
      parts.push('updated ' + fmtClock(state.lastUpdated.getTime()));
    }
    els.rangeSub.textContent = parts.join(' · ');
  }

  function statCard(label, value, sub, color, small) {
    return '<div class="stat" style="--stat-color:' + color + '">' +
      '<div class="stat-label">' + esc(label) + '</div>' +
      '<div class="stat-value' + (small ? ' small' : '') + '" title="' + esc(value) + '">' + esc(value) + '</div>' +
      '<div class="stat-sub" title="' + esc(sub) + '">' + esc(sub) + '</div>' +
      '</div>';
  }

  function renderStats(usage) {
    const m = usage.metrics;
    const topApp = usage.appList[0];

    const cards = [];
    cards.push(statCard(
      'Active time',
      fmtDuration(usage.totalActive),
      usage.appList.length + ' apps · ' + usage.siteList.length + ' sites',
      '#4f8cff'
    ));
    cards.push(statCard(
      'Focus time',
      fmtDuration(m.focusSeconds),
      Math.round(m.focusRatio * 100) + '% in work + learning',
      '#a78bfa'
    ));
    cards.push(statCard(
      'Longest focus',
      m.longestFocus > 0 ? fmtDuration(m.longestFocus) : '—',
      'uninterrupted work/learning',
      '#7c9cff'
    ));
    cards.push(statCard(
      'Top app',
      topApp ? prettyApp(topApp.app) : '—',
      topApp ? topAppSummary(topApp) : 'No activity yet',
      topApp ? categoryColor(topApp.category) : '#475569',
      true
    ));

    els.stats.innerHTML = cards.join('');
  }

  function topAppSummary(app) {
    const cats = appCategoryEntries(app);
    if (cats.length <= 1) {
      return fmtDuration(app.seconds) + ' · ' + categoryLabel(app.category);
    }
    return fmtDuration(app.seconds) + ' · ' + cats.slice(0, 2).map(function (entry) {
      const share = app.seconds > 0 ? Math.round((entry.seconds / app.seconds) * 100) : 0;
      return categoryLabel(entry.id) + ' ' + share + '%';
    }).join(' · ');
  }

  function renderCategories(usage) {
    const total = usage.totalActive;
    const list = activeCategoryList(usage);
    const R = 62;
    const C = 2 * Math.PI * R;

    let svg = '<circle cx="80" cy="80" r="' + R + '" fill="none" stroke="rgba(255,255,255,0.055)" stroke-width="16"/>';
    let offset = 0;
    for (const cat of list) {
      const fraction = total > 0 ? cat.seconds / total : 0;
      const length = fraction * C;
      const gap = length > 4 ? 1.7 : 0;
      svg += '<circle cx="80" cy="80" r="' + R + '" fill="none" stroke="' + cat.color + '"' +
        ' stroke-width="16" stroke-dasharray="' + Math.max(0, length - gap) + ' ' + (C - length + gap) + '"' +
        ' stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 80 80)">' +
        '<title>' + esc(cat.label + ' · ' + fmtDuration(cat.seconds)) + '</title></circle>';
      offset += length;
    }
    els.donutSvg.innerHTML = svg;
    els.donutTotal.textContent = fmtDuration(total);

    if (!list.length) {
      els.legend.innerHTML = '<div class="empty">No activity recorded in this range yet.</div>';
    } else {
      els.legend.innerHTML = list.map(function (cat) {
        return '<div class="legend-row">' +
          '<span class="legend-dot" style="background:' + cat.color + '"></span>' +
          '<span class="legend-name">' + esc(cat.label) + '</span>' +
          '<span class="legend-time">' + fmtDuration(cat.seconds) + '</span>' +
          '<span class="legend-pct">' + fmtPercent(cat.seconds, total) + '</span>' +
          '</div>';
      }).join('');
    }

    els.categorySub.textContent = total > 0
      ? 'Focus ' + Math.round(usage.metrics.focusRatio * 100) + '% · ' + list.length + ' categories in use'
      : 'What kind of content got your attention';
  }

  /* ------------------------------------------------------------------ *
   * App / site lists
   * ------------------------------------------------------------------ */

  function overrideFor(scope, key) {
    if (scope === 'app') return state.overrides.apps[key] || null;
    return state.overrides.sites[key] || null;
  }

  function appCategoryEntries(app) {
    return Object.keys(app.cats || {})
      .map(function (id) { return { id: id, seconds: app.cats[id] || 0 }; })
      .filter(function (entry) { return entry.seconds >= 1; })
      .sort(function (a, b) { return b.seconds - a.seconds; });
  }

  function renderAppList(usage) {
    const apps = usage.appList;
    if (!apps.length) {
      els.appList.innerHTML = '<div class="empty"><strong>No application activity yet.</strong><br>' +
        'Make sure aw-watcher-window is running, then use your computer for a bit.</div>';
      els.appsAllBtn.hidden = true;
      return;
    }

    const maxSeconds = apps[0].seconds || 1;
    const visible = state.showAllApps ? apps : apps.slice(0, TOP_COUNT);
    const MAX_CHIPS = 6;

    els.appList.innerHTML = visible.map(function (app) {
      const name = prettyApp(app.app);
      const cats = appCategoryEntries(app);
      const dominant = category(cats.length ? cats[0].id : app.category);
      const manual = overrideFor('app', app.key);
      const barWidth = clamp((app.seconds / maxSeconds) * 100, 1, 100);
      const showPct = cats.length > 1;
      const chipCats = cats.length > 1
        ? cats.filter(function (entry) { return entry.seconds / app.seconds >= 0.01; })
        : cats;

      const shown = chipCats.slice(0, MAX_CHIPS);
      const rest = chipCats.slice(MAX_CHIPS);

      // A single-category app can be overridden with one click. When the time
      // is split across categories (typically a browser), the chips stay
      // informational so one click cannot silently collapse the breakdown.
      const clickable = cats.length <= 1;

      const chips = shown.map(function (entry) {
        const cat = category(entry.id);
        const pct = app.seconds > 0 ? Math.round((entry.seconds / app.seconds) * 100) : 0;
        const detail = cat.label + ' · ' + fmtDuration(entry.seconds) + ' (' + pct + '%)';
        const cls = 'cat-chip' + (manual === entry.id ? ' is-manual' : '') + (clickable ? '' : ' is-static');
        const body = esc(cat.label) +
          (showPct ? '<span class="cat-chip-amount">' + esc(fmtDuration(entry.seconds)) + '</span>' : '');

        if (clickable) {
          return '<button type="button" class="' + cls + '" style="--c:' + cat.color + '"' +
            ' data-scope="app" data-key="' + esc(app.key) + '"' +
            ' data-name="' + esc(name) + '" data-cat="' + esc(entry.id) + '"' +
            ' title="' + esc(detail + ' — click to change this app category') + '">' + body + '</button>';
        }
        return '<span class="' + cls + '" style="--c:' + cat.color + '"' +
          ' title="' + esc(detail) + '">' + body + '</span>';
      }).join('');

      const restChip = rest.length
        ? '<span class="cat-chip is-summary" title="' +
          esc(rest.map(function (entry) {
            return categoryLabel(entry.id) + ' · ' + fmtDuration(entry.seconds);
          }).join(' · ')) + '">+' + rest.length + ' more</span>'
        : '';

      const segments = cats.map(function (entry) {
        const cat = category(entry.id);
        return '<span style="width:' + ((entry.seconds / app.seconds) * 100).toFixed(3) +
          '%;background:' + cat.color + '" title="' +
          esc(cat.label + ' · ' + fmtDuration(entry.seconds)) + '"></span>';
      }).join('');

      return '<div class="item">' +
        '<div class="item-icon" style="--c:' + dominant.color + ';background:' + hexToRgba(dominant.color, 0.13) + '">' +
        esc(appLetter(app.app)) + '</div>' +
        '<div class="item-body">' +
        '<div class="item-top"><span class="item-name" title="' + esc(name) + '">' + esc(name) + '</span>' +
        '<span class="item-time">' + fmtDuration(app.seconds) + '</span></div>' +
        '<div class="item-meta app-cats">' + chips + restChip +
        '<span class="item-pct">' + fmtPercent(app.seconds, usage.totalActive) + '</span>' +
        '</div>' +
        '<div class="item-bar app-bar"><div class="item-bar-fill" style="width:' + barWidth.toFixed(2) + '%">' +
        segments + '</div></div>' +
        '</div></div>';
    }).join('');

    els.appsAllBtn.hidden = apps.length <= TOP_COUNT;
    els.appsAllBtn.textContent = state.showAllApps
      ? 'Show fewer'
      : 'Show all ' + apps.length + ' apps';
  }

  function renderSiteList(usage) {
    const sites = usage.siteList;
    if (!sites.length) {
      els.siteList.innerHTML = '<div class="empty"><strong>No website activity in this range.</strong><br>' +
        'Site detail comes from the ActivityWatch Web Watcher browser extension.</div>';
      els.sitesAllBtn.hidden = true;
      els.sitesNote.textContent = 'Websites are counted only while a browser window is active. If you just installed the extension, browse a little and refresh.';
      return;
    }

    els.sitesNote.textContent = '';
    const maxSeconds = sites[0].seconds || 1;
    const visible = state.showAllSites ? sites : sites.slice(0, TOP_COUNT);

    els.siteList.innerHTML = visible.map(function (site) {
      const cat = category(site.category);
      const manual = overrideFor('site', site.key);
      const barWidth = clamp((site.seconds / maxSeconds) * 100, 1, 100);
      const favicon = faviconUrl(site.domain);
      return '<div class="item">' +
        '<div class="item-icon site-icon" style="--c:' + cat.color + ';background:' + hexToRgba(cat.color, 0.13) + '">' +
        (favicon
          ? '<img src="' + esc(favicon) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
            ' onerror="this.style.display=\'none\'">'
          : '') +
        '<span class="item-letter">' + esc(domainLetter(site.domain)) + '</span>' +
        '</div>' +
        '<div class="item-body">' +
        '<div class="item-top"><span class="item-name" title="' + esc(site.domain) + '">' + esc(site.domain) + '</span>' +
        '<span class="item-time">' + fmtDuration(site.seconds) + '</span></div>' +
        '<div class="item-meta">' +
        '<button type="button" class="cat-chip' + (manual ? ' is-manual' : '') + '"' +
        ' style="--c:' + cat.color + '" data-scope="site" data-key="' + esc(site.key) + '"' +
        ' data-name="' + esc(site.domain) + '" data-cat="' + esc(site.category) + '"' +
        ' title="' + (manual ? 'Custom category — click to change' : "Click to change this site's category") + '">' +
        esc(cat.label) + '</button>' +
        '<span class="item-pct">' + fmtPercent(site.seconds, usage.totalActive) + '</span>' +
        '</div>' +
        '<div class="item-bar"><span style="width:' + barWidth.toFixed(2) + '%;background:' + cat.color + '"></span></div>' +
        '</div></div>';
    }).join('');

    els.sitesAllBtn.hidden = sites.length <= TOP_COUNT;
    els.sitesAllBtn.textContent = state.showAllSites
      ? 'Show fewer'
      : 'Show all ' + sites.length + ' sites';
  }

  /* ------------------------------------------------------------------ *
   * Rhythm: hourly chart (one day) or heatmap (many days)
   * ------------------------------------------------------------------ */

  function renderRhythm(usage) {
    const days = usage.days || [];
    if (days.length <= 1) {
      renderHourly(usage, days[0]);
    } else {
      renderHeatmap(usage, days);
    }
  }

  function renderHourly(usage, day) {
    els.rhythmTitle.textContent = "When you're active";

    if (!day) {
      els.rhythmBody.innerHTML = '<div class="empty">No activity in this period.</div>';
      els.rhythmBadge.textContent = '—';
      return;
    }

    const hours = day.hourly || [];
    let maxSeconds = 0;
    hours.forEach(function (slot) { maxSeconds = Math.max(maxSeconds, slot.total); });
    maxSeconds = Math.max(maxSeconds, 60);

    const peak = usage.metrics.busiestHour;
    els.rhythmBadge.textContent = day.total > 0
      ? 'Peak ' + String(peak).padStart(2, '0') + ':00'
      : 'No activity';

    const cols = hours.map(function (slot, hour) {
      const height = slot.total > 0 ? Math.max(4, (slot.total / maxSeconds) * 100) : 1.5;
      const cats = state.categories
        .filter(function (c) { return (slot.cats[c.id] || 0) >= 0.5; })
        .map(function (c) {
          const share = (slot.cats[c.id] / slot.total) * 100;
          return '<span style="height:' + share.toFixed(3) + '%;background:' + c.color + '"></span>';
        }).join('');

      const breakdown = state.categories
        .filter(function (c) { return (slot.cats[c.id] || 0) >= 0.5; })
        .sort(function (a, b) { return (slot.cats[b.id] || 0) - (slot.cats[a.id] || 0); })
        .map(function (c) {
          return '<div class="tip-sub"><span style="color:' + c.color + '">■</span> ' +
            esc(c.label) + ' · ' + fmtDuration(slot.cats[c.id]) + '</div>';
        }).join('');

      const tip = '<div class="tip-title">' + esc(fullDate(day.start)) + ', ' +
        String(hour).padStart(2, '0') + ':00–' + String(hour + 1).padStart(2, '0') + ':00</div>' +
        '<div class="tip-sub">' + fmtDuration(slot.total) + ' active</div>' + breakdown;

      return '<div class="hour-col" data-tip="' + esc(tip) + '">' +
        '<div class="hour-bar" style="height:' + height.toFixed(2) + '%">' + cats + '</div>' +
        '</div>';
    }).join('');

    const labels = hours.map(function (slot, hour) {
      return '<span>' + (hour % 3 === 0 ? String(hour).padStart(2, '0') : '') + '</span>';
    }).join('');

    els.rhythmBody.innerHTML = '<div class="hourly">' + cols + '</div>' +
      '<div class="hour-labels">' + labels + '</div>' +
      '<div class="heat-legend">' +
      state.categories.filter(function (c) {
        return usage.categories.some(function (u) { return u.id === c.id && u.seconds >= 1; });
      }).map(function (c) {
        return '<span class="chip" style="--c:' + c.color + '"><span class="legend-dot" style="background:' + c.color + '"></span>' + esc(c.label) + '</span>';
      }).join('') +
      '</div>';
  }

  function renderHeatmap(usage, days) {
    els.rhythmTitle.textContent = "When you're active";

    const peak = usage.metrics.busiestHour;
    els.rhythmBadge.textContent = usage.totalActive > 0
      ? 'Peak ' + String(peak).padStart(2, '0') + ':00'
      : 'No activity';

    let html = '<div class="heatmap-scroll"><div class="heatmap' +
      (days.length > 14 ? ' is-compact' : '') + '">';

    html += '<div class="heat-label"></div>';
    for (let hour = 0; hour < 24; hour++) {
      html += '<div class="heat-hour">' + (hour % 3 === 0 ? String(hour).padStart(2, '0') : '') + '</div>';
    }

    days.forEach(function (day) {
      const label = shortWeekday(day.start) + ' ' + new Date(day.start).getDate();
      html += '<div class="heat-label" title="' + esc(fullDate(day.start)) + '">' + esc(label) + '</div>';

      for (let hour = 0; hour < 24; hour++) {
        const slot = day.hourly[hour] || { total: 0, cats: {} };
        const minutes = slot.total / 60;
        let style = '';
        let dominant = null;

        if (minutes > 0.1) {
          dominant = category(topCategory(slot.cats));
          const alpha = 0.14 + 0.82 * Math.sqrt(Math.min(1, minutes / 60));
          style = 'background:' + hexToRgba(dominant.color, alpha.toFixed(3));
        }

        const breakdown = state.categories
          .filter(function (c) { return (slot.cats[c.id] || 0) >= 0.5; })
          .sort(function (a, b) { return (slot.cats[b.id] || 0) - (slot.cats[a.id] || 0); })
          .slice(0, 4)
          .map(function (c) {
            return '<div class="tip-sub"><span style="color:' + c.color + '">■</span> ' +
              esc(c.label) + ' · ' + fmtDuration(slot.cats[c.id]) + '</div>';
          }).join('');

        const tip = '<div class="tip-title">' + esc(fullDate(day.start)) + ', ' +
          String(hour).padStart(2, '0') + ':00–' + String(hour + 1).padStart(2, '0') + ':00</div>' +
          '<div class="tip-sub">' + fmtDuration(slot.total) + ' active</div>' + breakdown;

        html += '<div class="heat-cell" style="' + style + '" data-tip="' + esc(tip) + '"></div>';
      }
    });

    html += '</div></div>';

    const used = state.categories.filter(function (c) {
      return usage.categories.some(function (u) { return u.id === c.id && u.seconds >= 1; });
    });

    html += '<div class="heat-legend"><span>Less</span><span class="heat-scale">' +
      [0.16, 0.32, 0.5, 0.7, 0.92].map(function (a) {
        return '<i style="background:' + hexToRgba('#ffffff', a) + '"></i>';
      }).join('') + '</span><span>More</span><span style="margin-left:14px"></span>' +
      used.map(function (c) {
        return '<span class="chip"><span class="legend-dot" style="background:' + c.color + '"></span>' + esc(c.label) + '</span>';
      }).join('') + '</div>';

    els.rhythmBody.innerHTML = html;
  }

  /* ------------------------------------------------------------------ *
   * Tooltip
   * ------------------------------------------------------------------ */

  function showTooltip(html, x, y) {
    els.tooltip.innerHTML = html;
    els.tooltip.hidden = false;
    positionTooltip(x, y);
  }

  function positionTooltip(x, y) {
    if (els.tooltip.hidden) return;
    const rect = els.tooltip.getBoundingClientRect();
    const half = rect.width / 2;
    const left = clamp(x, half + 8, window.innerWidth - half - 8);
    els.tooltip.classList.toggle('below', y - rect.height - 16 < 8);
    els.tooltip.style.left = left + 'px';
    els.tooltip.style.top = y + 'px';
  }

  function hideTooltip() {
    els.tooltip.hidden = true;
  }

  /* ------------------------------------------------------------------ *
   * Category popover
   * ------------------------------------------------------------------ */

  function buildPopoverOptions(current) {
    els.popOptions.innerHTML = state.categories.map(function (cat) {
      return '<button type="button" class="pop-option' + (cat.id === current ? ' current' : '') + '"' +
        ' data-cat="' + cat.id + '">' +
        '<span class="dot" style="background:' + cat.color + '"></span>' +
        '<span>' + esc(cat.label) + '</span>' +
        (cat.id === current ? '<span class="check">✓</span>' : '') +
        '</button>';
    }).join('');
  }

  function openPopover(anchor, scope, key, name, current) {
    state.popover = { scope: scope, key: key };
    state.popoverAnchor = anchor;
    els.popName.textContent = name;
    buildPopoverOptions(current);
    els.catPop.hidden = false;

    const anchorRect = anchor.getBoundingClientRect();
    const popRect = els.catPop.getBoundingClientRect();
    const left = clamp(anchorRect.left, 10, window.innerWidth - popRect.width - 10);
    let top = anchorRect.bottom + 6;
    if (top + popRect.height > window.innerHeight - 10) {
      top = anchorRect.top - popRect.height - 6;
    }
    els.catPop.style.left = left + 'px';
    els.catPop.style.top = Math.max(10, top) + 'px';
  }

  function hidePopover() {
    if (els.catPop.hidden) return;
    els.catPop.hidden = true;
    state.popover = null;
    state.popoverAnchor = null;
  }

  function chooseCategory(categoryId) {
    if (!state.popover) return;
    const scope = state.popover.scope;
    const key = state.popover.key;
    if (categoryId) {
      if (scope === 'app') state.overrides.apps[key] = categoryId;
      else state.overrides.sites[key] = categoryId;
    } else {
      if (scope === 'app') delete state.overrides.apps[key];
      else delete state.overrides.sites[key];
    }
    saveOverrides();
    hidePopover();
    applyAndRender();
  }

  /* ------------------------------------------------------------------ *
   * Rules modal & category manager
   * ------------------------------------------------------------------ */

  function renderModalCategories() {
    els.modalCats.innerHTML = state.categories.map(function (cat) {
      const isOther = cat.id === 'other';
      const badge = cat.productive ? '<span class="modal-cat-badge" title="Counts toward focus time">Focus</span>' : '';
      const removeBtn = !isOther && state.categories.length > 1
        ? '<button type="button" class="modal-cat-remove" data-cat-id="' + esc(cat.id) + '" title="Remove category \'' + esc(cat.label) + '\'">✕</button>'
        : '';
      return '<span class="modal-cat">' +
        '<span class="dot" style="background:' + cat.color + '"></span>' +
        '<span class="modal-cat-name">' + esc(cat.label) + '</span>' +
        badge +
        removeBtn +
        '</span>';
    }).join('');
  }

  function openAddCategory() {
    els.addCatPanel.hidden = false;
    els.addCatError.hidden = true;
    els.addCatError.textContent = '';
    els.newCatName.value = '';
    els.newCatProductive.checked = false;

    const PALETTE = ['#38bdf8', '#ec4899', '#14b8a6', '#f43f5e', '#8b5cf6', '#f59e0b', '#06b6d4', '#10b981', '#e11d48', '#6366f1'];
    const usedColors = new Set(state.categories.map(function (c) { return c.color.toLowerCase(); }));
    const available = PALETTE.find(function (col) { return !usedColors.has(col.toLowerCase()); }) || PALETTE[0];
    els.newCatColor.value = available;
    els.newCatName.focus();
  }

  function closeAddCategory() {
    els.addCatPanel.hidden = true;
    els.addCatError.hidden = true;
    els.addCatError.textContent = '';
    els.newCatName.value = '';
  }

  function submitAddCategory() {
    const rawName = els.newCatName.value.trim();
    if (!rawName) {
      els.addCatError.textContent = 'Please enter a category name.';
      els.addCatError.hidden = false;
      els.newCatName.focus();
      return;
    }

    const slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('cat_' + Date.now());
    const lowerName = rawName.toLowerCase();

    const exists = state.categories.some(function (c) {
      return c.id === slug || c.label.toLowerCase() === lowerName;
    });
    if (exists) {
      els.addCatError.textContent = 'A category with this name already exists.';
      els.addCatError.hidden = false;
      els.newCatName.focus();
      return;
    }

    const newCat = {
      id: slug,
      label: rawName,
      color: els.newCatColor.value || '#38bdf8',
      productive: Boolean(els.newCatProductive.checked)
    };

    const otherIdx = state.categories.findIndex(function (c) { return c.id === 'other'; });
    if (otherIdx >= 0) {
      state.categories.splice(otherIdx, 0, newCat);
    } else {
      state.categories.push(newCat);
    }
    state.categoryById = new Map(state.categories.map(function (c) { return [c.id, c]; }));

    const currentRules = els.rulesText.value.trimEnd();
    els.rulesText.value = (currentRules ? currentRules + '\n' : '') + rawName + ': ';

    renderModalCategories();
    closeAddCategory();
    els.rulesText.focus();
    els.rulesText.setSelectionRange(els.rulesText.value.length, els.rulesText.value.length);
  }

  function removeCategory(catId) {
    if (catId === 'other' || state.categories.length <= 1) return;
    const cat = state.categories.find(function (c) { return c.id === catId; });
    if (!cat) return;

    state.categories = state.categories.filter(function (c) { return c.id !== catId; });
    state.categoryById = new Map(state.categories.map(function (c) { return [c.id, c]; }));

    const catLabelLower = cat.label.toLowerCase();
    const lines = els.rulesText.value.split(/\r?\n/);
    const updatedLines = lines.filter(function (line) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return true;
      const colon = trimmed.indexOf(':');
      if (colon < 0) return true;
      const rawCat = trimmed.slice(0, colon).trim().toLowerCase();
      return rawCat !== catId && rawCat !== catLabelLower;
    });
    els.rulesText.value = updatedLines.join('\n');

    renderModalCategories();
  }

  function openRules() {
    closeAddCategory();
    renderModalCategories();
    els.rulesText.value = state.rulesText;
    els.rulesErrors.hidden = true;
    els.rulesErrors.textContent = '';
    els.rulesModal.hidden = false;
    els.rulesText.focus();
    els.rulesText.setSelectionRange(0, 0);
    els.rulesText.scrollTop = 0;
  }

  function closeRules() {
    closeAddCategory();
    els.rulesModal.hidden = true;
  }

  function saveRules() {
    const parsed = A.parseRules(els.rulesText.value, state.categories);
    const errors = parsed.errors.slice();

    if (!parsed.rules.length && !errors.length) {
      errors.push('Add at least one rule line.');
    }
    if (errors.length) {
      els.rulesErrors.hidden = false;
      els.rulesErrors.textContent = errors.join('\n');
      return;
    }

    state.rules = parsed.rules;
    state.rulesText = els.rulesText.value.trim();
    saveText(STORAGE_RULES, state.rulesText);
    saveCategories();
    saveOverrides();
    closeRules();
    applyAndRender();
  }

  function clearOverrides() {
    state.overrides = { apps: {}, sites: {} };
    saveOverrides();
    applyAndRender();
    els.clearOverridesBtn.textContent = 'Overrides cleared ✓';
    setTimeout(function () {
      els.clearOverridesBtn.textContent = 'Clear overrides';
    }, 1600);
  }

  /* ------------------------------------------------------------------ *
   * CSV export
   * ------------------------------------------------------------------ */

  function csvCell(value) {
    return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
  }

  function downloadCsv(rows, filename) {
    const csv = rows.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportApps() {
    if (!state.usage) return;
    const rows = [['App', 'Category', 'Seconds', 'Time']];
    state.usage.appList.forEach(function (app) {
      rows.push([prettyApp(app.app), categoryLabel(app.category), Math.round(app.seconds), fmtDuration(app.seconds)]);
    });
    downloadCsv(rows, 'activity-apps-' + A._internal.dayKey(state.rangeStart) + '.csv');
  }

  function exportSites() {
    if (!state.usage) return;
    const rows = [['Domain', 'Category', 'Seconds', 'Time']];
    state.usage.siteList.forEach(function (site) {
      rows.push([site.domain, categoryLabel(site.category), Math.round(site.seconds), fmtDuration(site.seconds)]);
    });
    downloadCsv(rows, 'activity-sites-' + A._internal.dayKey(state.rangeStart) + '.csv');
  }

  /* ------------------------------------------------------------------ *
   * Wiring
   * ------------------------------------------------------------------ */

  function cacheElements() {
    [
      'progress', 'connState', 'connText', 'rangeTabs', 'refreshBtn', 'rulesBtn',
      'banner', 'bannerDetail', 'retryBtn', 'loader', 'rangeTitle', 'rangeSub',
      'stats', 'donutSvg', 'donutTotal', 'legend', 'categorySub',
      'appList', 'appsAllBtn', 'appsCsvBtn',
      'siteList', 'sitesAllBtn', 'sitesCsvBtn', 'sitesNote',
      'rhythmTitle', 'rhythmSub', 'rhythmBadge', 'rhythmBody',
      'updatedAt', 'tooltip', 'catPop', 'popName', 'popOptions', 'popAuto',
      'rulesModal', 'modalCats', 'openAddCatBtn', 'addCatPanel', 'newCatName',
      'newCatColor', 'newCatProductive', 'submitAddCatBtn', 'cancelAddCatBtn',
      'addCatError', 'rulesText', 'rulesErrors',
      'resetRulesBtn', 'clearOverridesBtn', 'cancelRulesBtn', 'saveRulesBtn'
    ].forEach(function (id) {
      els[id] = $(id);
    });
  }

  function setActivePreset(preset) {
    Array.prototype.forEach.call(els.rangeTabs.querySelectorAll('button'), function (tab) {
      const active = tab.getAttribute('data-preset') === preset;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function bindEvents() {
    els.rangeTabs.addEventListener('click', function (event) {
      const button = event.target.closest('button[data-preset]');
      if (!button) return;
      const preset = button.getAttribute('data-preset');
      if (preset === state.preset) return;
      state.preset = preset;
      state.showAllApps = false;
      state.showAllSites = false;
      hideTooltip();
      hidePopover();
      setActivePreset(preset);
      loadData();
    });

    els.refreshBtn.addEventListener('click', function () { loadData(); });
    els.retryBtn.addEventListener('click', function () { loadData(); });

    els.appsAllBtn.addEventListener('click', function () {
      state.showAllApps = !state.showAllApps;
      if (state.usage) renderAppList(state.usage);
    });
    els.sitesAllBtn.addEventListener('click', function () {
      state.showAllSites = !state.showAllSites;
      if (state.usage) renderSiteList(state.usage);
    });

    els.appsCsvBtn.addEventListener('click', exportApps);
    els.sitesCsvBtn.addEventListener('click', exportSites);

    document.addEventListener('click', function (event) {
      const chip = event.target.closest('.cat-chip[data-scope]');
      if (chip) {
        event.preventDefault();
        openPopover(
          chip,
          chip.getAttribute('data-scope'),
          chip.getAttribute('data-key'),
          chip.getAttribute('data-name'),
          chip.getAttribute('data-cat')
        );
        return;
      }
      if (!els.catPop.hidden && !els.catPop.contains(event.target)) hidePopover();
    });

    els.popOptions.addEventListener('click', function (event) {
      const option = event.target.closest('.pop-option');
      if (!option) return;
      chooseCategory(option.getAttribute('data-cat'));
    });
    els.popAuto.addEventListener('click', function () { chooseCategory(null); });

    els.rulesBtn.addEventListener('click', openRules);
    els.cancelRulesBtn.addEventListener('click', closeRules);
    els.saveRulesBtn.addEventListener('click', saveRules);
    els.resetRulesBtn.addEventListener('click', function () {
      state.categories = A.DEFAULT_CATEGORIES.map(function (c) { return Object.assign({}, c); });
      state.categoryById = new Map(state.categories.map(function (c) { return [c.id, c]; }));
      els.rulesText.value = A.DEFAULT_RULES_TEXT;
      els.rulesErrors.hidden = true;
      closeAddCategory();
      renderModalCategories();
    });
    els.clearOverridesBtn.addEventListener('click', clearOverrides);

    els.openAddCatBtn.addEventListener('click', openAddCategory);
    els.cancelAddCatBtn.addEventListener('click', closeAddCategory);
    els.submitAddCatBtn.addEventListener('click', submitAddCategory);
    els.newCatName.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitAddCategory();
      } else if (event.key === 'Escape') {
        closeAddCategory();
      }
    });

    els.modalCats.addEventListener('click', function (event) {
      const btn = event.target.closest('.modal-cat-remove');
      if (!btn) return;
      event.preventDefault();
      const catId = btn.getAttribute('data-cat-id');
      removeCategory(catId);
    });

    els.rulesModal.addEventListener('click', function (event) {
      if (event.target === els.rulesModal) closeRules();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (!els.addCatPanel.hidden) closeAddCategory();
      else if (!els.rulesModal.hidden) closeRules();
      else hidePopover();
      hideTooltip();
    });

    window.addEventListener('scroll', hidePopover, true);

    document.addEventListener('pointerover', function (event) {
      const target = event.target.closest ? event.target.closest('[data-tip]') : null;
      if (!target) return;
      showTooltip(target.getAttribute('data-tip'), event.clientX, event.clientY);
    });

    document.addEventListener('pointermove', function (event) {
      if (els.tooltip.hidden) return;
      positionTooltip(event.clientX, event.clientY);
    });

    document.addEventListener('pointerout', function (event) {
      const target = event.target.closest ? event.target.closest('[data-tip]') : null;
      if (!target) return;
      if (event.relatedTarget && target.contains(event.relatedTarget)) return;
      hideTooltip();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      if (state.preset !== 'today' || state.loading || !state.lastUpdated) return;
      if (Date.now() - state.lastUpdated.getTime() > 120000) loadData({ silent: true });
    });
  }

  function renderUpdatedAt() {
    if (!state.lastUpdated) {
      els.updatedAt.textContent = '—';
      return;
    }
    els.updatedAt.textContent = 'Updated ' + fmtClock(state.lastUpdated.getTime());
  }

  function init() {
    cacheElements();
    renderModalCategories();
    bindEvents();

    setInterval(function () {
      if (state.preset === 'today' && document.visibilityState === 'visible' && !state.loading) {
        loadData({ silent: true });
      }
    }, 5 * 60 * 1000);

    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
