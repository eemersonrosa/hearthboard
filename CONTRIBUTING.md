# Contributing to Hearthboard

This guide covers how to set up a development environment, what stability
guarantees the project makes, and what a good change looks like.

## Ground rules: stability first

Hearthboard is infrastructure for a household — a broken dashboard on the
kitchen wall is a bad morning. Two rules follow from that:

1. **The HTTP API is a contract.** Endpoints, request shapes, and response
   shapes in [docs/reference/backend-api.md](docs/reference/backend-api.md)
   don't change silently. `server/tests/apiEndpoints.test.js` encodes the
   contract; if your change breaks a test, that's the test doing its job —
   either your change is wrong, or you are deliberately changing the contract
   and must update the test *and* the docs in the same commit.
2. **Features ship with tests.** Any new endpoint, scheduling behavior, or
   client utility gets a test that will fail if its behavior changes later.
   Server tests run against a real server + SQLite instance (`npm test` in
   `server/`); client tests use vitest (`npm test` in `client/`), with jsdom
   available for hook/component tests (see
   `client/src/utils/useScheduledRefresh.test.jsx` for the pattern).

## Development setup

Prerequisites: Node 24+, npm.

```bash
# Backend — Fastify + better-sqlite3, http://localhost:5000
cd server
npm install
npm run dev

# Frontend — React 19 + Vite + MUI, http://localhost:3000
cd client
npm install
npm run dev
```

The client dev server proxies API calls to the backend. If you change ports,
set `PORT` for the server and `VITE_REACT_APP_API_URL` for the client.

There is no seed data: the server creates the SQLite database
(`server/data/tasks.db`) and all tables on first boot. Delete the file to
start fresh.

## Repository layout

```
client/           React app (widgets, dock, admin panel)
  src/components/   One file per widget/panel
  src/utils/        Shared logic — keep it testable and DOM-free where possible
server/           Fastify app
  index.js          All routes (large; keep new domains in services/)
  services/         Integrations: Google, CalDAV, Home Assistant
  migrations/       Schema setup + numbered migrations
  tests/            Contract tests that boot the real server
docs/             Architecture, guides, and reference
```

## Making a change

1. Branch from `main`.
2. Make the change. Match the style of the file you're in; don't reformat
   surrounding code.
3. Add or update tests (see ground rules above).
4. Run everything:
   ```bash
   cd server && npm test
   cd client && npm test && npm run build
   ```
5. Check both themes (the app defaults to dark — verify light too), desktop
   grid layout, and the mobile stacked view (< 700px).
6. Update the docs that describe what you touched:
   - API changes → `docs/reference/backend-api.md`
   - Schema changes → `docs/architecture/database.md`
   - New settings/widgets → `docs/reference/configuration.md`
7. If you added or updated a dependency, commit the updated
   `package-lock.json` too — CI installs with `npm ci` and will fail without it.
8. Commit with a message that says *why*, then open a PR. CI runs the same
   tests on every push.

## Conventions worth knowing

- **Widget refreshes** never use bare `setInterval`. Use
  `useScheduledRefresh(intervalMs, callback, enabled)` from
  `client/src/utils/useScheduledRefresh.js` — it pauses while the screen is
  off and catches up on wake.
- **Device settings** are stored server-side per device profile
  (`/api/devices/:name/settings`). All displays share the `shared` profile
  unless personalized; don't stash per-display state in `localStorage` unless
  it is truly display-local (theme, dock behavior, screensaver).
- **Secrets** (like the Home Assistant token) are encrypted at rest when
  `ENCRYPTION_KEY` is set, and must never be returned by the generic
  `/api/settings` endpoints. Follow the pattern in
  `server/services/homeAssistant.js`.
- **New server domains** (integrations, features with several endpoints) live
  in `server/services/<name>.js` with thin route handlers in `index.js`.
- **Migrations**: schema changes go through a new numbered file in
  `server/migrations/`, registered in the boot sequence in `index.js`. Never
  edit an existing migration that may have run somewhere.

## Plugin widgets

Custom widgets are single HTML files served into an iframe-like wrapper.
See [docs/guides/custom-widgets.md](docs/guides/custom-widgets.md).

## License

Hearthboard is AGPL-3.0 (see [LICENSE](LICENSE) and [NOTICE](NOTICE)); it is a
derivative of [HomeGlow](https://github.com/jherforth/HomeGlow). Contributions
are accepted under the same license.
