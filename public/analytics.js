/*
 * Activity Insights — data processing
 * Pure JS, no DOM. Used by the dashboard and by the unit tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AWAnalytics = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Categories
   * ------------------------------------------------------------------ */

  const DEFAULT_CATEGORIES = [
    { id: 'work',          label: 'Work',                color: '#4f8cff', productive: true  },
    { id: 'learning',      label: 'Learning',            color: '#a78bfa', productive: true  },
    { id: 'communication', label: 'Communication',       color: '#2dd4bf', productive: false },
    { id: 'social',        label: 'Social media',        color: '#fb7185', productive: false },
    { id: 'entertainment', label: 'Entertainment',       color: '#fb923c', productive: false },
    { id: 'gaming',        label: 'Gaming',              color: '#a3e635', productive: false },
    { id: 'browsing',      label: 'Web browsing',        color: '#94a3b8', productive: false },
    { id: 'utilities',     label: 'System & utilities',  color: '#64748b', productive: false },
    { id: 'other',         label: 'Other',               color: '#475569', productive: false }
  ];

  const DEFAULT_CATEGORY_BY_ID = new Map(DEFAULT_CATEGORIES.map(function (c) { return [c.id, c]; }));

  /*
   * Rules are checked in order, first match wins.
   * Plain patterns are matched against "<app> <window title>" (and against the
   * domain when one is known). Patterns containing a dot are treated as domains,
   * so "x.com" matches x.com but not linux.com.
   */
  const DEFAULT_RULES = [
    {
      category: 'work',
      patterns: [
        'visual studio code', 'vscode', 'code.exe', 'cursor', 'sublime', 'notepad++',
        'windows terminal', 'windowsterminal', 'powershell', 'pwsh', 'cmd.exe',
        'intellij', 'pycharm', 'webstorm', 'android studio', 'xcode', 'eclipse',
        'obsidian', 'notion', 'jira', 'confluence', 'trello', 'asana', 'clickup',
        'monday.com', 'airtable', 'miro', 'figma', 'canva',
        'github', 'gitlab', 'bitbucket', 'postman', 'docker', 'kubernetes',
        'excel', 'winword', 'powerpoint', 'onenote', 'outlook', 'microsoft word',
        'slack', 'microsoft teams', 'teams.exe', 'zoom.us', 'zoom.exe',
        'docs.google.com', 'sheets.google.com', 'slides.google.com', 'drive.google.com',
        'calendar.google.com', 'mail.google.com', 'office.com', 'sharepoint',
        'wordpress', 'localhost', '127.0.0.1', 'stack overflow for teams',
        'aws.amazon.com', 'portal.azure.com', 'cloud.google.com', 'vercel.com',
        'netlify.com', 'railway.app', 'supabase.com', 'firebase'
      ]
    },
    {
      category: 'learning',
      patterns: [
        'anki', 'coursera', 'udemy', 'khan academy', 'khanacademy', 'duolingo',
        'quizlet', 'brilliant', 'edx', 'freecodecamp', 'w3schools', 'sololearn',
        'codecademy', 'scrimba', 'exercism', 'roadmap.sh', 'frontendmentor',
        'developer.mozilla', 'mdn', 'stackoverflow', 'stack overflow',
        'wikipedia', 'arxiv', 'scholar.google', 'leetcode', 'hackerrank',
        'codewars', 'geeksforgeeks', 'javatpoint', 'tutorialspoint',
        'learn.', 'academy', 'tutorial', 'documentation',
        'msigmagokulam', 'gemini.google.com', 'aistudio.google.com', 'chatgpt',
        'claude.ai', 'perplexity', 'deepseek', 'grok.com', 'copilot.microsoft.com',
        'kaggle', 'datacamp', 'pluralsight', 'skillshare',
        'readthedocs', 'devdocs.io'
      ]
    },
    {
      category: 'communication',
      patterns: [
        'whatsapp', 'telegram', 'discord', 'messenger', 'signal', 'viber',
        'skype', 'wechat', 'zoom', 'meet.google.com', 'google meet',
        'gmail', 'thunderbird', 'outlook web', 'protonmail'
      ]
    },
    {
      category: 'social',
      patterns: [
        'facebook', 'instagram', 'twitter', 'x.com', 'threads.net', 'reddit',
        'tiktok', 'snapchat', 'pinterest', 'tumblr', 'linkedin', 'quora',
        '9gag', 'weibo', 'vk.com', 'mastodon'
      ]
    },
    {
      category: 'entertainment',
      patterns: [
        'youtube', 'youtu.be', 'netflix', 'primevideo', 'hotstar', 'disneyplus',
        'hulu', 'twitch', 'spotify', 'soundcloud', 'music.youtube', 'mxplayer',
        'bilibili', 'dailymotion', 'vimeo', 'pandora', 'gaana', 'jiosaavn',
        'letterboxd', 'imdb', '9anime', 'crunchyroll', 'kick.com'
      ]
    },
    {
      category: 'gaming',
      patterns: [
        'steam', 'epic games', 'epicgames', 'riot client', 'valorant', 'league of legends',
        'minecraft', 'grand theft auto', 'gta', 'counter-strike', 'csgo', 'cs2',
        'dota', 'pubg', 'genshin', 'call of duty', 'fortnite', 'roblox', 'emulator',
        'battle.net', 'ubisoft', 'ea app', 'origin.exe'
      ]
    },
    {
      category: 'utilities',
      // A leading ^ means "match the application name only", which keeps
      // generic words like "settings" from hijacking web page titles.
      patterns: [
        // Windows
        '^explorer.exe', '^searchhost', '^shellhost', '^startmenuexperiencehost',
        '^lockapp', '^rainmeter', '^aw-qt', '^systemsettings', '^taskmgr',
        '^dwm.exe', '^applicationframehost', '^nvidia', '^realtek',
        '^snipping', '^calculator', '^mspaint', '^photos', '^clock',
        '^windows security', '^quick settings',
        // Linux / cross-platform
        '^nautilus', '^dolphin', '^thunar', '^nemo', '^pcmanfm',
        '^gnome-control-center', '^systemsettings5', '^kcmshell5',
        '^gnome-system-monitor', '^ksysguard', '^htop', '^btop',
        '^gnome-calculator', '^kcalc', '^eog', '^evince', '^okular',
        '^aw-qt', '^aw-server'
      ]
    }
  ];

  const BROWSER_RE = /(brave|chrome|chromium|firefox|msedge|opera|vivaldi|arc|waterfox|librewolf|safari)/i;

  function isBrowser(app) {
    return BROWSER_RE.test(String(app || ''));
  }

  /* ------------------------------------------------------------------ *
   * Small time helpers
   * ------------------------------------------------------------------ */

  function toMs(value) {
    if (typeof value === 'number') return value;
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }

  function localDayStart(ts) {
    const d = new Date(ts);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  function nextDayStart(ts) {
    const d = new Date(ts);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  }

  function dayKey(ts) {
    const d = new Date(ts);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function listDayStarts(rangeStart, rangeEnd) {
    const out = [];
    let t = localDayStart(rangeStart);
    let guard = 0;
    while (t < rangeEnd && guard < 400) {
      out.push({ key: dayKey(t), start: t });
      t = nextDayStart(t);
      guard++;
    }
    if (!out.length) out.push({ key: dayKey(rangeStart), start: localDayStart(rangeStart) });
    return out;
  }

  function splitByHour(start, end, cb) {
    let t = start;
    let guard = 0;
    while (t < end && guard < 10000) {
      const d = new Date(t);
      const boundary = new Date(
        d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1, 0, 0, 0
      ).getTime();
      const pieceEnd = Math.min(end, boundary > t ? boundary : t + 3600000);
      cb(t, pieceEnd, dayKey(t), d.getHours());
      t = pieceEnd;
      guard++;
    }
  }

  /* ------------------------------------------------------------------ *
   * Interval helpers
   * ------------------------------------------------------------------ */

  function mergeIntervals(intervals, toleranceMs) {
    const tol = toleranceMs == null ? 1000 : toleranceMs;
    const sorted = (intervals || [])
      .filter(function (iv) { return iv && iv[1] > iv[0]; })
      .map(function (iv) { return [iv[0], iv[1]]; })
      .sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    const out = [];
    for (const iv of sorted) {
      const last = out[out.length - 1];
      if (last && iv[0] <= last[1] + tol) {
        if (iv[1] > last[1]) last[1] = iv[1];
      } else {
        out.push([iv[0], iv[1]]);
      }
    }
    return out;
  }

  function intersectRange(start, end, intervals) {
    const out = [];
    if (!intervals || !intervals.length || end <= start) return out;

    // First interval whose end is after `start`
    let lo = 0, hi = intervals.length - 1, first = intervals.length;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (intervals[mid][1] > start) {
        first = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }

    for (let i = first; i < intervals.length; i++) {
      const iv = intervals[i];
      if (iv[0] >= end) break;
      const a = Math.max(iv[0], start);
      const b = Math.min(iv[1], end);
      if (b > a) out.push([a, b]);
    }
    return out;
  }

  function sumIntervals(intervals) {
    let total = 0;
    for (const iv of intervals || []) total += iv[1] - iv[0];
    return total / 1000;
  }

  function buildActiveIntervals(afkEvents, rangeStart, rangeEnd) {
    if (!afkEvents || !afkEvents.length) return [[rangeStart, rangeEnd]];

    const raw = [];
    for (const ev of afkEvents) {
      const data = ev.data || {};
      if (String(data.status) !== 'not-afk') continue;
      const start = toMs(ev.timestamp);
      if (start === null) continue;
      const end = start + Math.max(0, Number(ev.duration) || 0) * 1000;
      const a = Math.max(start, rangeStart);
      const b = Math.min(end, rangeEnd);
      if (b > a) raw.push([a, b]);
    }
    return mergeIntervals(raw, 1000);
  }

  /* ------------------------------------------------------------------ *
   * Event normalization
   * ------------------------------------------------------------------ */

  function normalizeWindowEvents(rawEvents, rangeStart, rangeEnd) {
    const out = [];
    for (const ev of rawEvents || []) {
      const data = ev.data || {};
      const start = toMs(ev.timestamp);
      if (start === null) continue;
      const end = start + Math.max(0, Number(ev.duration) || 0) * 1000;
      if (end <= start) continue;
      if (end <= rangeStart || start >= rangeEnd) continue;
      out.push({
        start: Math.max(start, rangeStart),
        end: Math.min(end, rangeEnd),
        app: String(data.app || 'Unknown'),
        title: String(data.title || '')
      });
    }
    out.sort(function (a, b) { return a.start - b.start || a.end - b.end; });
    return out;
  }

  function domainOf(url) {
    try {
      const u = new URL(String(url));
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u.hostname.toLowerCase().replace(/^www\./, '');
    } catch (err) {
      return null;
    }
  }

  function normalizeWebEvents(rawEvents, rangeStart, rangeEnd) {
    const out = [];
    for (const ev of rawEvents || []) {
      const data = ev.data || {};
      const start = toMs(ev.timestamp);
      if (start === null) continue;
      const end = start + Math.max(0, Number(ev.duration) || 0) * 1000;
      if (end < rangeStart || start > rangeEnd) continue;
      const domain = domainOf(data.url);
      if (!domain) continue;
      out.push({
        start: start,
        end: Math.max(end, start),
        domain: domain,
        url: String(data.url || ''),
        title: String(data.title || '')
      });
    }
    out.sort(function (a, b) { return a.start - b.start || a.end - b.end; });
    return out;
  }

  function findWebForWindow(webEvents, windowEvent) {
    if (!webEvents || !webEvents.length) return null;
    const pad = 5000;
    let best = null;
    let bestOverlap = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < webEvents.length; i++) {
      const w = webEvents[i];
      if (w.start > windowEvent.end + pad) break;
      if (w.end < windowEvent.start - pad) continue;
      const overlap = Math.min(windowEvent.end, w.end) - Math.max(windowEvent.start, w.start);
      const distance = Math.abs(w.start - windowEvent.start);
      if (overlap > bestOverlap || (overlap === bestOverlap && distance < bestDistance)) {
        best = w;
        bestOverlap = overlap;
        bestDistance = distance;
      }
    }
    return best;
  }

  /* ------------------------------------------------------------------ *
   * Rules / overrides
   * ------------------------------------------------------------------ */

  function buildCategoryIndex(categoriesList) {
    const list = categoriesList && categoriesList.length ? categoriesList : DEFAULT_CATEGORIES;
    const map = new Map();
    for (const c of list) {
      map.set(c.id, c.id);
      map.set(c.label.toLowerCase(), c.id);
    }
    // Friendly aliases people naturally type in the rules editor.
    map.set('study', 'learning');
    map.set('binge', 'entertainment');
    map.set('binge-watch', 'entertainment');
    map.set('binge watching', 'entertainment');
    map.set('socialmedia', 'social');
    return map;
  }

  function parseRules(text, categoriesList) {
    const index = buildCategoryIndex(categoriesList);
    const rules = [];
    const errors = [];

    String(text || '').split(/\r?\n/).forEach(function (line, i) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const colon = trimmed.indexOf(':');
      if (colon < 0) {
        errors.push('Line ' + (i + 1) + ': expected "Category: pattern, pattern"');
        return;
      }
      const rawCategory = trimmed.slice(0, colon).trim();
      const category = index.get(rawCategory.toLowerCase());
      if (!category) {
        errors.push('Line ' + (i + 1) + ': unknown category "' + rawCategory + '"');
        return;
      }
      const patterns = trimmed
        .slice(colon + 1)
        .split(',')
        .map(function (p) { return p.trim().toLowerCase(); })
        .filter(Boolean);
      if (!patterns.length) {
        errors.push('Line ' + (i + 1) + ': no patterns found');
        return;
      }
      rules.push({ category: category, patterns: patterns });
    });
    return { rules: rules, errors: errors };
  }

  function rulesToText(rules, categoriesList) {
    const list = categoriesList && categoriesList.length ? categoriesList : DEFAULT_CATEGORIES;
    const labelOf = new Map(list.map(function (c) { return [c.id, c.label]; }));
    return (rules || []).map(function (rule) {
      return (labelOf.get(rule.category) || rule.category) + ': ' + rule.patterns.join(', ');
    }).join('\n');
  }

  function patternMatches(pattern, haystack, domain, appLower) {
    if (pattern.startsWith('^')) {
      return appLower.indexOf(pattern.slice(1)) !== -1;
    }
    if (pattern.indexOf('.') !== -1) {
      if (!domain) return false;
      if (pattern.endsWith('.')) {
        return domain.startsWith(pattern) || domain.indexOf('.' + pattern) !== -1;
      }
      return domain === pattern || domain.endsWith('.' + pattern);
    }
    return haystack.indexOf(pattern) !== -1;
  }

  function pickCategory(event, rules, overrides, fallbackCategory, categoriesList) {
    const app = String(event.app || '');
    const appKey = app.toLowerCase();
    const title = String(event.title || '');
    const domain = event.domain || null;
    const browser = isBrowser(app);

    // Site overrides take highest priority whenever a domain is known
    if (domain && overrides && overrides.sites && overrides.sites[domain]) {
      return overrides.sites[domain];
    }
    // For non-browser apps, manual app overrides take priority over rules
    if (!browser && appKey && overrides && overrides.apps && overrides.apps[appKey]) {
      return overrides.apps[appKey];
    }

    const haystack = (app + ' ' + title + ' ' + (domain || '')).toLowerCase();
    const usable = rules && rules.length ? rules : DEFAULT_RULES;
    for (const rule of usable) {
      for (const pattern of rule.patterns) {
        if (patternMatches(pattern, haystack, domain, appKey)) return rule.category;
      }
    }

    // For browsers, manual app override acts as a fallback for untracked/unclassified pages
    if (browser && appKey && overrides && overrides.apps && overrides.apps[appKey]) {
      return overrides.apps[appKey];
    }

    const fallback = fallbackCategory || 'other';
    const hasBrowsing = categoriesList
      ? categoriesList.some(function (c) { return c.id === 'browsing'; })
      : true;
    return browser ? (hasBrowsing ? 'browsing' : fallback) : fallback;
  }

  function sanitizeOverrides(raw, categoriesList) {
    const list = categoriesList && categoriesList.length ? categoriesList : DEFAULT_CATEGORIES;
    const valid = new Set(list.map(function (c) { return c.id; }));
    const out = { apps: {}, sites: {} };
    if (!raw || typeof raw !== 'object') return out;
    for (const scope of ['apps', 'sites']) {
      const source = raw[scope];
      if (!source || typeof source !== 'object') continue;
      for (const key of Object.keys(source)) {
        if (valid.has(source[key])) out[scope][String(key).toLowerCase()] = source[key];
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Main computation
   * ------------------------------------------------------------------ */

  function computeUsage(input) {
    const opts = input || {};
    const rangeStart = opts.rangeStart;
    const rangeEnd = opts.rangeEnd;
    const categoriesList = opts.categories && opts.categories.length ? opts.categories : DEFAULT_CATEGORIES;
    if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) {
      return emptyUsage(rangeStart, rangeEnd, categoriesList);
    }

    const rules = opts.rules && opts.rules.length ? opts.rules : DEFAULT_RULES;
    const overrides = sanitizeOverrides(opts.overrides, categoriesList);

    const activeIntervals = buildActiveIntervals(opts.afkEvents, rangeStart, rangeEnd);
    const windowEvents = normalizeWindowEvents(opts.windowEvents, rangeStart, rangeEnd);
    const webEvents = normalizeWebEvents(opts.webEvents, rangeStart, rangeEnd);

    const fallbackCatId = categoriesList.some(function (c) { return c.id === 'other'; })
      ? 'other'
      : (categoriesList[0] ? categoriesList[0].id : 'other');

    /* --- window segments ------------------------------------------- */
    const segments = [];
    for (const ev of windowEvents) {
      const pieces = intersectRange(ev.start, ev.end, activeIntervals);
      if (!pieces.length) continue;

      const browser = isBrowser(ev.app);

      if (!browser || !webEvents.length) {
        const category = pickCategory({ app: ev.app, title: ev.title, domain: null }, rules, overrides, fallbackCatId, categoriesList);
        for (const piece of pieces) {
          segments.push({
            start: piece[0],
            end: piece[1],
            app: ev.app,
            title: ev.title,
            domain: null,
            category: category
          });
        }
        continue;
      }

      // For browser windows with web events, slice each active piece by visited web events
      for (const piece of pieces) {
        const pStart = piece[0];
        const pEnd = piece[1];
        if (pEnd <= pStart) continue;

        const overlapping = [];
        for (let i = 0; i < webEvents.length; i++) {
          const w = webEvents[i];
          if (w.start >= pEnd) break;
          if (w.end > pStart) {
            overlapping.push(w);
          }
        }

        if (!overlapping.length) {
          const category = pickCategory({ app: ev.app, title: ev.title, domain: null }, rules, overrides, fallbackCatId, categoriesList);
          segments.push({
            start: pStart,
            end: pEnd,
            app: ev.app,
            title: ev.title,
            domain: null,
            category: category
          });
          continue;
        }

        const boundaries = new Set();
        boundaries.add(pStart);
        boundaries.add(pEnd);
        for (let i = 0; i < overlapping.length; i++) {
          const w = overlapping[i];
          const s = Math.max(pStart, Math.min(pEnd, w.start));
          const e = Math.max(pStart, Math.min(pEnd, w.end));
          if (s > pStart && s < pEnd) boundaries.add(s);
          if (e > pStart && e < pEnd) boundaries.add(e);
        }
        const sortedBounds = Array.from(boundaries).sort(function (a, b) { return a - b; });

        for (let i = 0; i < sortedBounds.length - 1; i++) {
          const s = sortedBounds[i];
          const e = sortedBounds[i + 1];
          if (e <= s) continue;
          const mid = (s + e) / 2;

          let bestWeb = null;
          for (let j = 0; j < overlapping.length; j++) {
            const w = overlapping[j];
            if (w.start <= mid && w.end >= mid) {
              if (!bestWeb || w.start > bestWeb.start || (w.start === bestWeb.start && w.end > bestWeb.end)) {
                bestWeb = w;
              }
            }
          }

          const domain = bestWeb ? bestWeb.domain : null;
          const title = (bestWeb && bestWeb.title) ? bestWeb.title : ev.title;
          const category = pickCategory({ app: ev.app, title: title, domain: domain }, rules, overrides, fallbackCatId, categoriesList);

          const last = segments[segments.length - 1];
          if (last && last.end === s && last.app === ev.app && last.category === category && last.domain === domain && last.title === title) {
            last.end = e;
          } else {
            segments.push({
              start: s,
              end: e,
              app: ev.app,
              title: title,
              domain: domain,
              category: category
            });
          }
        }
      }
    }
    segments.sort(function (a, b) { return a.start - b.start || a.end - b.end; });

    const totalActive = sumIntervals(mergeIntervals(segments.map(function (s) {
      return [s.start, s.end];
    }), 0));

    /* --- per-category, per-app, per-day ---------------------------- */
    const categories = categoriesList.map(function (c) {
      return Object.assign({}, c, { seconds: 0, share: 0 });
    });
    const categoryById = new Map(categories.map(function (c) { return [c.id, c]; }));

    const appMap = new Map();
    const dayStarts = listDayStarts(rangeStart, rangeEnd);
    const daily = new Map();
    const hourlyByDay = new Map();
    const hourTotals = new Array(24).fill(0);

    for (const d of dayStarts) {
      daily.set(d.key, { key: d.key, start: d.start, total: 0, cats: {} });
      hourlyByDay.set(d.key, Array.from({ length: 24 }, function () {
        return { total: 0, cats: {} };
      }));
    }

    for (const seg of segments) {
      const seconds = (seg.end - seg.start) / 1000;
      if (seconds <= 0) continue;

      const appKey = seg.app.toLowerCase();
      let app = appMap.get(appKey);
      if (!app) {
        app = { key: appKey, app: seg.app, seconds: 0, cats: {} };
        appMap.set(appKey, app);
      }
      app.seconds += seconds;
      app.cats[seg.category] = (app.cats[seg.category] || 0) + seconds;

      const cat = categoryById.get(seg.category) || categoryById.get(fallbackCatId) || categories[0];
      if (cat) cat.seconds += seconds;

      splitByHour(seg.start, seg.end, function (s, e, key, hour) {
        const part = (e - s) / 1000;
        if (part <= 0) return;

        const day = daily.get(key);
        if (day) {
          day.total += part;
          day.cats[seg.category] = (day.cats[seg.category] || 0) + part;
        }
        hourTotals[hour] += part;

        const hours = hourlyByDay.get(key);
        if (hours) {
          const slot = hours[hour];
          slot.total += part;
          slot.cats[seg.category] = (slot.cats[seg.category] || 0) + part;
        }
      });
    }

    for (const cat of categories) {
      cat.share = totalActive > 0 ? Math.min(1, cat.seconds / totalActive) : 0;
    }

    const appList = Array.from(appMap.values()).map(function (app) {
      const top = topCategory(app.cats, fallbackCatId);
      return {
        key: app.key,
        app: app.app,
        seconds: app.seconds,
        category: top,
        cats: app.cats
      };
    }).sort(function (a, b) { return b.seconds - a.seconds; });

    /* --- websites (browser window time ∩ web-watcher events) ------- */
    const browserIntervals = mergeIntervals(
      segments.filter(function (s) { return isBrowser(s.app); })
        .map(function (s) { return [s.start, s.end]; }),
      0
    );
    const siteBase = browserIntervals.length
      ? browserIntervals
      : (windowEvents.length ? [] : activeIntervals);

    const siteMap = new Map();
    for (const web of webEvents) {
      if (web.end <= web.start) continue;
      const pieces = intersectRange(web.start, web.end, siteBase);
      const seconds = sumIntervals(pieces);
      if (seconds <= 0) continue;

      const category = pickCategory({ app: '', title: web.title, domain: web.domain }, rules, overrides, fallbackCatId, categoriesList);
      let site = siteMap.get(web.domain);
      if (!site) {
        site = {
          key: web.domain,
          domain: web.domain,
          seconds: 0,
          cats: {},
          title: web.title
        };
        siteMap.set(web.domain, site);
      }
      site.seconds += seconds;
      site.cats[category] = (site.cats[category] || 0) + seconds;
      if (!site.title && web.title) site.title = web.title;
    }

    const siteList = Array.from(siteMap.values()).map(function (site) {
      return {
        key: site.key,
        domain: site.domain,
        seconds: site.seconds,
        category: topCategory(site.cats, fallbackCatId),
        cats: site.cats,
        title: site.title
      };
    }).sort(function (a, b) { return b.seconds - a.seconds; });

    /* --- metrics --------------------------------------------------- */
    let switches = 0;
    let previousApp = null;
    let previousEnd = null;
    for (const seg of segments) {
      const appKey = seg.app.toLowerCase();
      if (previousApp !== null && appKey !== previousApp) {
        const gap = seg.start - previousEnd;
        if (gap >= -1000 && gap <= 5 * 60000) switches++;
      }
      previousApp = appKey;
      previousEnd = seg.end;
    }

    const productive = new Set(
      categories.filter(function (c) { return c.productive; }).map(function (c) { return c.id; })
    );

    let focusSeconds = 0;
    let longestFocus = 0;
    let streakStart = null;
    let streakEnd = null;

    for (const seg of segments) {
      const seconds = (seg.end - seg.start) / 1000;
      if (seconds <= 0) continue;
      if (!productive.has(seg.category)) {
        streakStart = null;
        streakEnd = null;
        continue;
      }
      focusSeconds += seconds;
      if (streakStart !== null && seg.start - streakEnd <= 120000) {
        streakEnd = Math.max(streakEnd, seg.end);
      } else {
        streakStart = seg.start;
        streakEnd = seg.end;
      }
      longestFocus = Math.max(longestFocus, (streakEnd - streakStart) / 1000);
    }

    let busiestHour = 0;
    for (let h = 1; h < 24; h++) {
      if (hourTotals[h] > hourTotals[busiestHour]) busiestHour = h;
    }

    const activeHours = totalActive / 3600;
    const days = dayStarts.map(function (d) {
      const record = daily.get(d.key);
      return {
        key: d.key,
        start: d.start,
        total: record ? record.total : 0,
        cats: record ? record.cats : {},
        hourly: hourlyByDay.get(d.key) || []
      };
    });

    return {
      rangeStart: rangeStart,
      rangeEnd: rangeEnd,
      totalActive: totalActive,
      categories: categories,
      appList: appList,
      siteList: siteList,
      segments: segments,
      days: days,
      hourTotals: hourTotals,
      metrics: {
        focusSeconds: focusSeconds,
        focusRatio: totalActive > 0 ? Math.min(1, focusSeconds / totalActive) : 0,
        switches: switches,
        switchesPerHour: activeHours > 0 ? switches / activeHours : 0,
        longestFocus: longestFocus,
        busiestHour: busiestHour,
        activeHours: activeHours
      }
    };
  }

  function topCategory(cats, fallback) {
    let best = fallback || 'other';
    let bestSeconds = -1;
    for (const id of Object.keys(cats || {})) {
      if (cats[id] > bestSeconds) {
        best = id;
        bestSeconds = cats[id];
      }
    }
    return best;
  }

  function emptyUsage(rangeStart, rangeEnd, categoriesList) {
    const list = categoriesList && categoriesList.length ? categoriesList : DEFAULT_CATEGORIES;
    return {
      rangeStart: rangeStart,
      rangeEnd: rangeEnd,
      totalActive: 0,
      categories: list.map(function (c) {
        return Object.assign({}, c, { seconds: 0, share: 0 });
      }),
      appList: [],
      siteList: [],
      segments: [],
      days: [],
      hourTotals: new Array(24).fill(0),
      metrics: {
        focusSeconds: 0, focusRatio: 0, switches: 0, switchesPerHour: 0,
        longestFocus: 0, busiestHour: 0, activeHours: 0
      }
    };
  }

  return {
    CATEGORIES: DEFAULT_CATEGORIES,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES,
    CATEGORY_BY_ID: DEFAULT_CATEGORY_BY_ID,
    DEFAULT_RULES: DEFAULT_RULES,
    DEFAULT_RULES_TEXT: rulesToText(DEFAULT_RULES, DEFAULT_CATEGORIES),
    isBrowser: isBrowser,
    parseRules: parseRules,
    rulesToText: rulesToText,
    sanitizeOverrides: sanitizeOverrides,
    computeUsage: computeUsage,
    // exported for tests
    _internal: {
      mergeIntervals: mergeIntervals,
      intersectRange: intersectRange,
      splitByHour: splitByHour,
      domainOf: domainOf,
      dayKey: dayKey,
      localDayStart: localDayStart,
      listDayStarts: listDayStarts
    }
  };
});
