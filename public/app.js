'use strict';

(function () {
  const A = window.AWAnalytics;
  const CATEGORIES = A.CATEGORIES;
  const CATEGORY_BY_ID = A.CATEGORY_BY_ID;

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
    rulesText: loadText(STORAGE_RULES) || A.DEFAULT_RULES_TEXT,
    rules: [],
    overrides: loadOverrides(),
    showAllApps: false,
    showAllSites: false,
    loading: false,
    requestId: 0,
    lastUpdated: null,
    lastGood: null,
    popover: null,
    popoverAnchor: null
  };

  const parsedInitial = A.parseRules(state.rulesText);
  state.rules = parsedInitial.errors.length ? A.parseRules(A.DEFAULT_RULES_TEXT).rules : parsedInitial.rules;
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

  function loadOverrides() {
    try {
      return A.sanitizeOverrides(JSON.parse(localStorage.getItem(STORAGE_OVERRIDES) || '{}'));
    } catch (err) {
      return { apps: {}, sites: {} };
    }
  }

  function saveOverrides() {
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
    return CATEGORY_BY_ID.get(id) || CATEGORY_BY_ID.get('other');
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
        state.usage = A.computeUsage({ rangeStart: range.start, rangeEnd: range.end });
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

  function renderTimeline(usage) {
    state.timeline = null;
    const days = usage.days || [];

    if (days.length <= 1) {
      renderDayTimeline(usage, days[0]);
      return;
    }

    els.timelineTitle.textContent = 'Daily activity';
    els.timelineSub.textContent = 'Active time per day, split by category';
    els.timelineBadge.textContent = fmtDuration(usage.totalActive / days.length) + ' / day avg';
    els.timelineFooter.innerHTML = '<span>Hover a bar for the day\'s breakdown</span><span>' +
      days.length + ' days</span>';

    const maxTotal = Math.max.apply(null, days.map(function (d) { return d.total; }).concat([1]));
    const labelEvery = Math.max(1, Math.ceil(days.length / 8));

    const cols = days.map(function (day, index) {
      const cats = activeCategoryList({
        categories: CATEGORIES.map(function (c) {
          return Object.assign({}, c, { seconds: day.cats[c.id] || 0 });
        })
      }).sort(function (a, b) {
        return CATEGORIES.findIndex(function (c) { return c.id === a.id; }) -
          CATEGORIES.findIndex(function (c) { return c.id === b.id; });
      });

      const height = day.total > 0
        ? Math.max(3, (day.total / maxTotal) * 180)
        : 2;

      const segments = cats.map(function (cat) {
        return '<span style="height:' + ((cat.seconds / day.total) * 100).toFixed(3) +
          '%;background:' + cat.color + '"></span>';
      }).join('');

      const breakdown = cats.map(function (cat) {
        return '<div class="tip-sub"><span style="color:' + cat.color + '">■</span> ' +
          esc(cat.label) + ' · ' + fmtDuration(cat.seconds) + '</div>';
      }).join('');

      const tip = '<div class="tip-title">' + esc(fullDate(day.start)) + '</div>' +
        '<div class="tip-sub">' + fmtDuration(day.total) + ' active</div>' + breakdown;

      const showLabel = days.length <= 10 || index % labelEvery === 0 || index === days.length - 1;

      return '<div class="day-col" data-tip="' + esc(tip) + '">' +
        '<div class="day-bar" style="height:' + height.toFixed(1) + 'px">' + segments + '</div>' +
        '<div class="day-label">' + (showLabel ? esc(shortWeekday(day.start) + ' ' + new Date(day.start).getDate()) : '') + '</div>' +
        '</div>';
    }).join('');

    els.timelineArea.innerHTML = '<div class="timeline-bars" style="height:210px">' + cols + '</div>';
  }

  function renderDayTimeline(usage, day) {
    if (!day) {
      els.timelineTitle.textContent = 'Activity timeline';
      els.timelineSub.textContent = 'No day data';
      els.timelineBadge.textContent = '—';
      els.timelineArea.innerHTML = '<div class="empty">No activity in this range.</div>';
      els.timelineFooter.innerHTML = '';
      return;
    }

    const dayStart = day.start;
    const dayEnd = new Date(new Date(dayStart).getFullYear(), new Date(dayStart).getMonth(), new Date(dayStart).getDate() + 1).getTime();
    const segments = usage.segments.filter(function (seg) {
      return seg.end > dayStart && seg.start < dayEnd;
    });

    els.timelineTitle.textContent = 'Activity timeline';
    els.timelineSub.textContent = 'Every active block, colored by category';
    els.timelineBadge.textContent = fmtDuration(day.total) + ' active';
    els.timelineArea.innerHTML = '<canvas id="timelineCanvas" class="timeline-canvas" aria-label="Activity timeline"></canvas>';
    els.timelineFooter.innerHTML = '<span>Hover a block to see the app and website</span>' +
      '<span>Blank space = away from keyboard</span>' +
      (state.lastUpdated ? '<span>Updated ' + esc(fmtClock(state.lastUpdated.getTime())) + '</span>' : '');

    const canvas = $('timelineCanvas');
    if (!canvas) return;
    state.timeline = {
      canvas: canvas,
      segments: segments,
      dayStart: dayStart,
      dayEnd: dayEnd
    };

    drawDayTimeline();

    canvas.addEventListener('mousemove', function (event) {
      const rect = canvas.getBoundingClientRect();
      const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const t = dayStart + ratio * (dayEnd - dayStart);
      const seg = findSegmentAt(segments, t);
      if (!seg) {
        hideTooltip();
        return;
      }
      const cat = category(seg.category);
      const title = seg.domain || prettyApp(seg.app);
      const subtitle = (seg.title ? esc(seg.title) : 'No window title') +
        ' · ' + fmtClock(seg.start) + '–' + fmtClock(seg.end) +
        ' · ' + fmtDuration((seg.end - seg.start) / 1000);
      showTooltip(
        '<div class="tip-title">' + esc(title) + '</div>' +
        '<div class="tip-sub">' + subtitle + '</div>' +
        '<div class="tip-cat" style="--c:' + cat.color + '">' + esc(cat.label) + '</div>',
        event.clientX,
        event.clientY
      );
    });

    canvas.addEventListener('mouseleave', hideTooltip);
  }

  function drawDayTimeline() {
    const data = state.timeline;
    if (!data) return;
    const canvas = data.canvas;
    if (!canvas.isConnected) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const laneTop = 30;
    const laneHeight = 44;
    const dayMs = data.dayEnd - data.dayStart;

    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    fillRoundRect(ctx, 0, laneTop, width, laneHeight, 8);

    for (const seg of data.segments) {
      const x1 = ((seg.start - data.dayStart) / dayMs) * width;
      const x2 = ((seg.end - data.dayStart) / dayMs) * width;
      const segmentWidth = Math.max(1, x2 - x1 - 0.35);
      if (x2 <= 0 || x1 >= width) continue;
      ctx.fillStyle = categoryColor(seg.category);
      const x = clamp(x1, 0, width);
      const w = Math.min(segmentWidth, width - x);
      if (w <= 0) continue;
      if (w > 4) {
        fillRoundRect(ctx, x, laneTop, w, laneHeight, 2);
      } else {
        ctx.fillRect(x, laneTop, w, laneHeight);
      }
    }

    /* hour grid and labels */
    ctx.strokeStyle = 'rgba(255,255,255,0.055)';
    ctx.fillStyle = 'rgba(155,166,190,0.75)';
    ctx.font = '10px ui-sans-serif, system-ui, "Segoe UI", sans-serif';
    ctx.textBaseline = 'top';

    for (let hour = 0; hour <= 24; hour += 3) {
      const x = (hour / 24) * width;
      const isEdge = hour === 0 || hour === 24;
      if (!isEdge) {
        ctx.beginPath();
        ctx.moveTo(x, laneTop - 5);
        ctx.lineTo(x, laneTop + laneHeight + 5);
        ctx.stroke();
      }
      const label = String(hour).padStart(2, '0') + ':00';
      if (hour === 24) {
        ctx.textAlign = 'right';
        ctx.fillText(label, x - 2, laneTop + laneHeight + 16);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(label, isEdge ? 1 : x + 3, laneTop + laneHeight + 16);
      }
    }

    /* now marker */
    const now = Date.now();
    if (now >= data.dayStart && now < data.dayEnd) {
      const x = ((now - data.dayStart) / dayMs) * width;
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(x, laneTop - 10);
      ctx.lineTo(x, laneTop + laneHeight + 10);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(233,237,247,0.8)';
      ctx.textAlign = x > width - 30 ? 'right' : 'left';
      ctx.fillText('now', x > width - 30 ? x - 4 : x + 4, laneTop - 22);
    }

    if (!data.segments.length) {
      ctx.fillStyle = 'rgba(140,150,173,0.7)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No activity recorded in this period', width / 2, laneTop + laneHeight / 2);
    }
  }

  function fillRoundRect(ctx, x, y, width, height, radius) {
    if (width <= 0 || height <= 0) return;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, Math.min(radius, width / 2, height / 2));
      ctx.fill();
    } else {
      ctx.fillRect(x, y, width, height);
    }
  }

  function findSegmentAt(segments, t) {
    let lo = 0;
    let hi = segments.length - 1;
    let index = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (segments[mid].start <= t) {
        index = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    for (let i = Math.max(0, index - 2); i <= Math.min(segments.length - 1, index + 2); i++) {
      if (t >= segments[i].start && t < segments[i].end) return segments[i];
    }
    return null;
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
      const cats = CATEGORIES
        .filter(function (c) { return (slot.cats[c.id] || 0) >= 0.5; })
        .map(function (c) {
          const share = (slot.cats[c.id] / slot.total) * 100;
          return '<span style="height:' + share.toFixed(3) + '%;background:' + c.color + '"></span>';
        }).join('');

      const breakdown = CATEGORIES
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
      CATEGORIES.filter(function (c) {
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

        const breakdown = CATEGORIES
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

    const used = CATEGORIES.filter(function (c) {
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
    els.popOptions.innerHTML = CATEGORIES.map(function (cat) {
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
   * Rules modal
   * ------------------------------------------------------------------ */

  function renderModalCategories() {
    els.modalCats.innerHTML = CATEGORIES.map(function (cat) {
      return '<span class="modal-cat"><span class="dot" style="background:' + cat.color + '"></span>' +
        esc(cat.label) + '</span>';
    }).join('');
  }

  function openRules() {
    els.rulesText.value = state.rulesText;
    els.rulesErrors.hidden = true;
    els.rulesErrors.textContent = '';
    els.rulesModal.hidden = false;
    els.rulesText.focus();
    els.rulesText.setSelectionRange(0, 0);
    els.rulesText.scrollTop = 0;
  }

  function closeRules() {
    els.rulesModal.hidden = true;
  }

  function saveRules() {
    const parsed = A.parseRules(els.rulesText.value);
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
      'rulesModal', 'modalCats', 'rulesText', 'rulesErrors',
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
      els.rulesText.value = A.DEFAULT_RULES_TEXT;
      els.rulesErrors.hidden = true;
    });
    els.clearOverridesBtn.addEventListener('click', clearOverrides);

    els.rulesModal.addEventListener('click', function (event) {
      if (event.target === els.rulesModal) closeRules();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (!els.rulesModal.hidden) closeRules();
      else hidePopover();
      hideTooltip();
    });

    window.addEventListener('resize', function () {
      drawDayTimeline();
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
