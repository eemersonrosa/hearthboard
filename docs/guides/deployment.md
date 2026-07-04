# Deployment

Hearthboard ships as two Docker images published to GitHub Container Registry (GHCR):

- `ghcr.io/eemersonrosa/hearthboard-frontend` — Nginx serving the built SPA + reverse proxy.
- `ghcr.io/eemersonrosa/hearthboard-backend` — Fastify API + SQLite.

Target environment: Linux hosts, including low-power devices (Raspberry Pi,
Proxmox VMs). Portainer is fully supported.

## Recommended: Docker Compose with pre-built images

```bash
# 1. Download the compose file
wget https://raw.githubusercontent.com/eemersonrosa/hearthboard/main/docker-compose.yml

# 2. Create a .env next to it
cat > .env <<'EOF'
FRONTEND_PORT=3000
TZ=America/New_York
ENCRYPTION_KEY=REPLACE_WITH_openssl_rand_base64_32
EOF

# 3. Start
docker compose up -d

# 4. Open http://your-server-ip:3000  and configure via the ⚙️ Admin Panel
```

[`docker-compose.yml`](../../docker-compose.yml) defines:
- `hearthboard-backend` — bind-mounts `./hearthboard/data` (DB) and `./hearthboard/uploads`
  (photos/avatars/widgets); env `PORT`, `TZ`, `NODE_ENV=production`.
- `hearthboard-frontend` — publishes `FRONTEND_PORT`; knows the backend via
  `BACKEND_SERVICE`/`BACKEND_PORT` on the shared `hearthboard-network`.

> Add `ENCRYPTION_KEY` to the backend service's environment (and your `.env`) if you
> use Google/CalDAV connections — see [Configuration](../reference/configuration.md).

### Updating
```bash
docker compose pull && docker compose up -d
```

## Building from source

```bash
git clone https://github.com/eemersonrosa/hearthboard.git && cd hearthboard
docker compose -f docker-compose-dev.yml up --build
```
This builds both images locally using [`client/Dockerfile`](../../client/Dockerfile)
and [`server/Dockerfile`](../../server/Dockerfile). See
[Getting Started](getting-started.md) for the dev ports and native (npm) workflow.

## How the images are built

- **Frontend** ([`client/Dockerfile`](../../client/Dockerfile)): multi-stage —
  `node:20-alpine` builds the Vite bundle, then `nginx:alpine` serves `dist/`. An
  entrypoint runs `envsubst` on [`nginx.conf`](../../client/nginx.conf) so
  `FRONTEND_PORT`/`BACKEND_SERVICE`/`BACKEND_PORT` are applied at container start.
- **Backend** ([`server/Dockerfile`](../../server/Dockerfile)): `node:24`, installs
  build tooling, `npm ci` against the committed lockfile, rebuilds `better-sqlite3`
  from source, and runs `node index.js`. `uploads/` and `widgets/` are created with
  open permissions.

## CI/CD (GitHub Actions)

- [`.github/workflows/ci-tests.yml`](../../.github/workflows/ci-tests.yml) — runs
  frontend and backend test suites (Node 20) on every push to any branch.
- [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — runs both suites
  plus the client production build (Node 24) on pushes to `main` and PRs.
- [`.github/workflows/docker-image.yml`](../../.github/workflows/docker-image.yml) —
  on a `v*` tag (or manual dispatch), builds and pushes both images to GHCR, injecting
  version/commit/repo build args. Tags produced: the release tag and `latest-test`.

Both test workflows install with `npm ci` against the committed
`package-lock.json` files (with setup-node's npm cache keyed on them), so
installs are reproducible and lockfile changes must be committed alongside
dependency changes.

To cut a release, push a `v*` tag (e.g. `git tag v1.4 && git push --tags`).

## Reverse proxy / HTTPS

The app has no built-in TLS or auth. For HTTPS and a custom domain, front it with a
reverse proxy (Nginx, Traefik, Caddy, or Cloudflare Tunnel) and add access control.
Only the **frontend** port needs to be exposed; the backend stays on the internal
Docker network.

## Data & backups

Back up the two bind-mounted directories:
- `./hearthboard/data/` — SQLite database (`tasks.db`, `.encryption-key`).
- `./hearthboard/uploads/` — user avatars, uploaded photos, and custom widgets.

## Migrating to a new host

Use the built-in configuration backup (Admin Panel → **Backup**):

1. On the old host, **Export Configuration** — enable the encryption toggle and
   set a passphrase (unencrypted exports contain API keys and passwords in
   plain text).
2. Deploy a fresh Hearthboard on the new host (compose steps above).
3. Open its Admin Panel → Backup → **Import Configuration**, pick the file,
   enter the passphrase, and confirm. The import replaces the fresh instance's
   configuration wholesale: settings, devices, tabs, widget layouts, users,
   chores, calendar/photo sources, and the admin PIN.

Stored credentials are re-encrypted with the new host's `ENCRYPTION_KEY`
automatically — the keys don't need to match. Not covered by the export:
uploaded files (copy `./hearthboard/uploads/` manually if you need them) and
linked Google accounts (re-link on the new host). See
[Features → Configuration backup](../reference/features.md#configuration-backup-export--import).
