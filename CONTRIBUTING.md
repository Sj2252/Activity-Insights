# Contributing to Activity Insights

Thank you for considering a contribution! This is a small, focused project — please keep changes in the same spirit: zero npm dependencies, local-only privacy, and no external data collection.

## Ways to contribute

- **Bug reports** — open an issue with your OS, Node.js version, and ActivityWatch version. Include the browser console output if the dashboard fails to load.
- **Rule improvements** — if a common app or website is miscategorised by the defaults, open a PR editing `DEFAULT_RULES` in `public/analytics.js`.
- **Linux / macOS app-name mappings** — `FRIENDLY_APPS` in `public/app.js` maps process names to readable labels. Add entries for apps missing on your platform.
- **Features** — open an issue first to discuss scope before writing code.

## Ground rules

- **No npm dependencies.** The only runtime is Node.js ≥ 18 and its standard library.
- **No external requests** except the optional DuckDuckGo favicon fetch (which can be disabled). No analytics, no telemetry.
- **Keep it read-only.** Activity Insights must never write to or modify ActivityWatch data.
- **Tests must pass.** Run `npm test` before submitting a PR. Add a test for new analytics logic in `test/analytics.test.js`.
- **One concern per PR.** Small, focused pull requests are much easier to review.

## Development setup

```bash
git clone https://github.com/YOUR_USERNAME/aw-insights.git
cd aw-insights
node server.js        # start the dev server
npm test              # run the 13 unit tests
```

No install step needed — there are no dependencies to install.

## Testing

```bash
npm test
```

The test suite uses the Node.js built-in test runner (`node:test`). All 13 tests cover the analytics engine (`public/analytics.js`): AFK clipping, website attribution, category rules, overrides, and day splitting. If you change `analytics.js`, make sure the existing tests still pass and add new ones for new behaviour.

## Code style

- Plain ES5-compatible JavaScript (no TypeScript, no transpilation).
- 2-space indentation; single quotes; semicolons.
- Pure functions in `analytics.js` — no DOM, no globals other than the module export.
- UI rendering in `app.js` and `index.html`; styles in `styles.css`.
- Keep the CSS design token system (`--bg`, `--surface`, `--accent`, etc.) — avoid hard-coded colours outside `:root`.

## Commit messages

Use short, plain English imperative sentences:

```
Add LibreOffice to default work rules
Fix heatmap cell height on compact screens
Improve Linux stop.sh port detection
```

## Licence

By contributing you agree that your contribution is released under the [MIT licence](LICENSE).
