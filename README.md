# Hearthboard

**A self-hosted family dashboard for the wall, the fridge, and your pocket.**

Hearthboard is a private, self-hosted dashboard for touch displays and phones. It puts the
family calendar, chores, weather, photos, and Home Assistant controls on one screen —
no subscriptions, no cloud accounts, everything runs on your own hardware.

> Hearthboard is a derivative work of
> [HomeGlow](https://github.com/jherforth/HomeGlow) (AGPL-3.0). See [NOTICE](NOTICE).

**[▶ Try the live demo](https://eemersonrosa.github.io/hearthboard/)** — the real
dashboard running entirely in your browser with sample data (no backend, no
account; changes reset on reload).

## Highlights

**Design & experience**
- **Dark mode by default**, with light mode a tap away.
- **Right-side dock** with tabs, settings, and theme toggle. **Auto-hides when
  idle by default** and reappears on any touch or scroll, so widgets get the
  full screen width.
- **Drag-and-drop layout** on a 12-column grid for wall displays.
- **Mobile view**: on phones the grid becomes a single stacked column — chores on
  top for quick access, a compact next-7-days agenda calendar, and plugins at
  full screen width. No photo widget on mobile.
- **Screensaver** that cycles tabs or photos to prevent burn-in.

**Screen-aware refreshes**
- Every widget refresh is scheduled against a timestamp, not a bare interval.
- When the display's screen is off, all refreshes and the screensaver pause;
  when it wakes, anything overdue refreshes immediately and the schedule resumes.

**Family management**
- **Chores**: define chores, schedule them per person with flexible recurrence
  (daily, weekly, until-completed, once-completed), mark them done from the
  dashboard, and **reassign a chore to someone else in two taps**. Optional
  "bonus" chores are unassigned extras anyone can pick up; they reset daily.
  No points, prizes, or gamification.
- **Users need only a name** — no email addresses.
- **Calendar**: multiple sources (ICS, CalDAV, Google), month/week views, and a
  simple agenda view on mobile.
- **Photos**: Immich integration (v2 and v3) with a daily random sample per
  source, slideshow, and screensaver mode.

**Home Assistant**
- **Control panel widget**: search your entities, star favorites, and toggle
  lights, switches, fans, covers, locks, scenes, and scripts from the dashboard.
- **Weather without an API key**: use your Home Assistant weather entity as the
  weather widget's data source instead of OpenWeatherMap.
- **Alerts**: server-evaluated rules ("front door open", "garage light on for
  2+ hours") appear as banners on every display.

**Devices**
- All displays share **one profile by default** — same tabs, same widgets everywhere.
- Any display can be **personalized** from the admin panel; it starts as a copy
  of the shared profile and can be reverted at any time.
- **Backup & migrate**: export the entire configuration (settings, tabs, widget
  layouts, users, chores, calendar and photo sources) to a single file —
  optionally passphrase-encrypted — and import it on a fresh deployment to
  recreate the same setup on another machine.

**Plugins**
- Upload single-file HTML widgets or install them from a GitHub repository.
- Per-plugin refresh intervals with visible countdown, transparency, and tab assignment.

## Quick start (Docker)

```bash
cp env.example .env   # set TZ and ports
docker compose up -d
```

Open `http://<host>:3000`. The compose file is tuned for light hardware
(Raspberry Pi, thin clients): alpine images, memory caps, log rotation, and
healthchecks. See [docs/guides/deployment.md](docs/guides/deployment.md).

## Development

```bash
# Backend (Fastify + SQLite)
cd server && npm install && npm run dev

# Frontend (React 19 + Vite + MUI)
cd client && npm install && npm run dev
```

Run the tests before you push — the API is covered by contract tests that are
meant to fail loudly when behavior changes:

```bash
cd server && npm test
cd client && npm test
```

## Documentation

| | |
|---|---|
| [Getting started](docs/guides/getting-started.md) | First run, initial configuration |
| [Deployment](docs/guides/deployment.md) | Docker, reverse proxies, low-power hardware |
| [Contributing](CONTRIBUTING.md) | Workflow, stability rules, testing expectations |
| [Architecture overview](docs/architecture/overview.md) | How the client, server, and DB fit together |
| [Database](docs/architecture/database.md) | Schema and migrations |
| [Backend API](docs/reference/backend-api.md) | Endpoint reference |
| [Custom widgets](docs/guides/custom-widgets.md) | Writing plugin widgets |

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
