'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../public/analytics.js');

const DAY = new Date(2026, 10, 8, 0, 0, 0).getTime(); // Sun Nov 8 2026, local time
const HOUR = 3600 * 1000;

function at(hours, minutes) {
  return new Date(DAY + hours * HOUR + (minutes || 0) * 60000).toISOString();
}

function ev(app, title, startHour, endHour, extra) {
  return Object.assign({
    timestamp: at(startHour),
    duration: (endHour - startHour) * 3600,
    data: { app: app, title: title }
  }, extra || {});
}

function web(url, title, startHour, endHour) {
  return {
    timestamp: at(startHour),
    duration: (endHour - startHour) * 3600,
    data: { url: url, title: title }
  };
}

function afk(status, startHour, endHour) {
  return {
    timestamp: at(startHour),
    duration: (endHour - startHour) * 3600,
    data: { status: status }
  };
}

function usage(input) {
  return A.computeUsage(Object.assign({
    rangeStart: DAY,
    rangeEnd: DAY + 24 * HOUR
  }, input));
}

test('parseRules accepts categories and reports bad lines', () => {
  const parsed = A.parseRules([
    '# comment',
    'Work: github, jira',
    'Learning: anki, coursera',
    'NotACategory: foo',
    'missing colon',
    'Social:'
  ].join('\n'));

  assert.deepEqual(parsed.rules, [
    { category: 'work', patterns: ['github', 'jira'] },
    { category: 'learning', patterns: ['anki', 'coursera'] }
  ]);
  assert.equal(parsed.errors.length, 3);
});

test('rulesToText round-trips the defaults', () => {
  const parsed = A.parseRules(A.DEFAULT_RULES_TEXT);
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.rules, A.DEFAULT_RULES);
});

test('friendly category aliases are accepted', () => {
  const parsed = A.parseRules('Study: anki\nBinge-watch: youtube\nSocialMedia: reddit');
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.rules.map(r => r.category), ['learning', 'entertainment', 'social']);
});

test('computes app, site, category totals and metrics', () => {
  const result = usage({
    afkEvents: [afk('not-afk', 9, 12)],
    windowEvents: [
      ev('Code.exe', 'main.js - Visual Studio Code', 10, 11),
      ev('brave.exe', 'YouTube - Brave', 11, 11.5),
      ev('explorer.exe', 'Downloads', 11.5, 11.75)
    ],
    webEvents: [
      web('https://www.youtube.com/watch?v=123', 'Video - YouTube', 11, 11.5)
    ]
  });

  assert.equal(Math.round(result.totalActive), 6300);

  const categories = Object.fromEntries(result.categories.map(c => [c.id, Math.round(c.seconds)]));
  assert.equal(categories.work, 3600);
  assert.equal(categories.entertainment, 1800);
  assert.equal(categories.utilities, 900);

  assert.equal(result.appList[0].app, 'Code.exe');
  assert.equal(Math.round(result.appList[0].seconds), 3600);
  assert.equal(result.appList[0].category, 'work');

  const brave = result.appList.find(a => a.app === 'brave.exe');
  assert.equal(brave.category, 'entertainment');

  assert.equal(result.siteList.length, 1);
  assert.equal(result.siteList[0].domain, 'youtube.com');
  assert.equal(Math.round(result.siteList[0].seconds), 1800);
  assert.equal(result.siteList[0].category, 'entertainment');

  assert.equal(result.metrics.switches, 2);
  assert.equal(result.metrics.switchesPerHour, 2 / (6300 / 3600));
  assert.equal(Math.round(result.metrics.focusSeconds), 3600);
  assert.equal(Math.round(result.metrics.longestFocus), 3600);
});

test('browser app time keeps a category breakdown for its sites', () => {
  const result = usage({
    afkEvents: [afk('not-afk', 10, 13)],
    windowEvents: [
      ev('brave.exe', 'YouTube - Brave', 10, 11),
      ev('brave.exe', 'GitHub - Brave', 11, 12),
      ev('brave.exe', 'Reddit - Brave', 12, 13)
    ],
    webEvents: [
      web('https://www.youtube.com/watch?v=1', 'YouTube', 10, 11),
      web('https://github.com/', 'GitHub', 11, 12),
      web('https://www.reddit.com/', 'Reddit', 12, 13)
    ]
  });

  const brave = result.appList.find(a => a.app === 'brave.exe');
  assert.equal(Math.round(brave.seconds), 3 * 3600);
  assert.equal(Math.round(brave.cats.entertainment), 3600);
  assert.equal(Math.round(brave.cats.work), 3600);
  assert.equal(Math.round(brave.cats.social), 3600);
});

test('not-afk intervals clip and split window events', () => {
  const result = usage({
    afkEvents: [afk('not-afk', 10, 10.5), afk('not-afk', 10.75, 11)],
    windowEvents: [ev('Code.exe', 'index.ts - Visual Studio Code', 10, 11)]
  });

  assert.equal(Math.round(result.totalActive), 2700);
  assert.equal(result.segments.length, 2);
  assert.equal(result.metrics.switches, 0);
  assert.equal(result.metrics.focusRatio, 1);
});

test('only not-afk / browser time is attributed to websites', () => {
  const result = usage({
    afkEvents: [afk('not-afk', 10, 11)],
    windowEvents: [
      ev('brave.exe', 'YouTube - Brave', 10, 10.5),
      ev('Code.exe', 'main.js - Visual Studio Code', 10.5, 11)
    ],
    webEvents: [web('https://www.youtube.com/', 'YouTube', 10, 11)]
  });

  assert.equal(Math.round(result.siteList[0].seconds), 1800);
});

test('websites are ignored when no browser window is active', () => {
  const result = usage({
    afkEvents: [afk('not-afk', 10, 11)],
    windowEvents: [ev('Code.exe', 'main.js - Visual Studio Code', 10, 11)],
    webEvents: [web('https://www.youtube.com/', 'YouTube', 10, 11)]
  });

  assert.equal(result.siteList.length, 0);
  assert.equal(Math.round(result.totalActive), 3600);
});

test('category overrides win over rules, sites over apps', () => {
  const overrides = {
    apps: { 'brave.exe': 'gaming' },
    sites: { 'youtube.com': 'learning' }
  };

  const result = usage({
    afkEvents: [afk('not-afk', 10, 11)],
    windowEvents: [ev('brave.exe', 'YouTube - Brave', 10, 11)],
    webEvents: [web('https://www.youtube.com/', 'YouTube', 10, 11)],
    overrides: overrides
  });

  assert.equal(result.categories.find(c => c.id === 'learning').seconds, 3600);
  assert.equal(result.categories.find(c => c.id === 'gaming').seconds, 0);
  assert.equal(result.siteList[0].category, 'learning');
});

test('domain rules are boundary-aware (x.com vs linux.com)', () => {
  const result = usage({
    afkEvents: [afk('not-afk', 10, 10.2)],
    windowEvents: [
      ev('brave.exe', 'Linux news', 10, 10.1),
      ev('brave.exe', 'Home', 10.1, 10.2)
    ],
    webEvents: [
      web('https://linux.com/', 'Linux news', 10, 10.1),
      web('https://x.com/home', 'Home / X', 10.1, 10.2)
    ]
  });

  const cats = Object.fromEntries(result.categories.map(c => [c.id, Math.round(c.seconds)]));
  assert.equal(cats.browsing, 360);
  assert.equal(cats.social, 360);
});

test('a missing AFK bucket means the whole range is considered active', () => {
  const result = usage({
    windowEvents: [ev('Code.exe', 'app.ts - Visual Studio Code', 8, 9)]
  });
  assert.equal(Math.round(result.totalActive), 3600);
});

test('empty ranges and empty events are safe', () => {
  const result = A.computeUsage({ rangeStart: DAY, rangeEnd: DAY, windowEvents: [] });
  assert.equal(result.totalActive, 0);
  assert.deepEqual(result.appList, []);
  assert.deepEqual(result.siteList, []);
  assert.equal(result.metrics.longestFocus, 0);
});

test('days are split at local midnight', () => {
  const result = A.computeUsage({
    rangeStart: DAY,
    rangeEnd: DAY + 48 * 3600 * 1000,
    windowEvents: [ev('Code.exe', 'night shift - Visual Studio Code', 23, 25)]
  });
  assert.equal(result.days.length, 2);
  assert.equal(Math.round(result.days[0].total), 3600);
  assert.equal(Math.round(result.days[1].total), 3600);
});

test('parseRules and computeUsage support custom added and removed categories', () => {
  const customCategories = [
    { id: 'design', label: 'Design', color: '#ec4899', productive: true },
    { id: 'leisure', label: 'Leisure', color: '#f59e0b', productive: false },
    { id: 'other', label: 'Other', color: '#475569', productive: false }
  ];

  const parsed = A.parseRules('Design: figma, sketch\nLeisure: netflix\nWork: vs code', customCategories);
  assert.deepEqual(parsed.rules, [
    { category: 'design', patterns: ['figma', 'sketch'] },
    { category: 'leisure', patterns: ['netflix'] }
  ]);
  // Work is unknown because it was not included in customCategories
  assert.equal(parsed.errors.length, 1);
  assert.match(parsed.errors[0], /unknown category "Work"/);

  const result = usage({
    categories: customCategories,
    rules: parsed.rules,
    afkEvents: [afk('not-afk', 10, 12)],
    windowEvents: [
      ev('Figma.exe', 'Design system', 10, 11),
      ev('brave.exe', 'Netflix', 11, 12)
    ],
    webEvents: [
      web('https://www.netflix.com/watch', 'Movie', 11, 12)
    ]
  });

  const catMap = Object.fromEntries(result.categories.map(c => [c.id, Math.round(c.seconds)]));
  assert.equal(catMap.design, 3600);
  assert.equal(catMap.leisure, 3600);
  // Design is productive, so focusSeconds must equal 3600
  assert.equal(Math.round(result.metrics.focusSeconds), 3600);
});

test('sanitizeOverrides filters out removed categories', () => {
  const customCategories = [
    { id: 'work', label: 'Work', color: '#4f8cff', productive: true },
    { id: 'other', label: 'Other', color: '#475569', productive: false }
  ];

  const sanitized = A.sanitizeOverrides({
    apps: { 'code.exe': 'work', 'steam.exe': 'gaming' },
    sites: { 'github.com': 'work', 'youtube.com': 'entertainment' }
  }, customCategories);

  assert.deepEqual(sanitized, {
    apps: { 'code.exe': 'work' },
    sites: { 'github.com': 'work' }
  });
});

