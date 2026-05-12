# Trace

A self-hosted, single-user photo memory and journaling app with AI-powered image tagging.

---

## Running with Docker

The simplest way to run Trace. No Node installation required.

**Requirements:** Docker and Docker Compose.

### Setup

```bash
git clone <repo-url>
cd trace
cp .env.example .env
```

Open `.env` and set `SESSION_SECRET` to a long random string:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Then start the app:

```bash
docker compose up -d
```

Open `http://localhost:5000`. On first launch, Trace shows a **Create account** screen. Enter a password (minimum 10 characters). This is the only account — there is no username field.

### What Docker manages

- Builds the app from source
- Runs database migrations automatically on every startup
- Stores the database at `./data/trace.db` on the host (bind-mounted into the container)
- Stores uploaded photos at `./uploads/` on the host (bind-mounted)

Both `data/` and `uploads/` are plain host directories — there are no Docker-managed volumes.

---

## Running locally (without Docker)

**Requirements:** Node 20+.

For reliable HEIC import (iPhone photos), also install `libheif-examples`:

```bash
sudo apt install libheif-examples
```

Docker handles this automatically. On other platforms, HEIC files encoded with HEVC (H.265) will fail to import without this package.

```bash
cp .env.example .env
# set SESSION_SECRET in .env

npm install
```

Apply the database schema before first run:

```bash
DATABASE_PATH=./data/trace.db npx drizzle-kit push
```

Start the development server:

```bash
npm run dev
```

> **Note:** `npm run dev` does not run migrations. If the schema changes (new migration files added), re-run `npx drizzle-kit push` or use the build + migrate flow below.

For a production-like local run:

```bash
npm run build
node dist/migrate.js   # applies pending migrations
npm start
```

---

## Electron (Desktop Prototype)

> **Prototype only.** This is a minimal desktop shell — no installer, no auto-update, no packaging. The goal is to verify that Trace launches as a native desktop window.

**Requirements:** Same as "Running locally" above — Node 20+, `.env` with `SESSION_SECRET`, `npm install`.

### Production mode (single command)

Builds the client and server, then opens Trace in a desktop window. Express runs as a child process; closing the window stops it.

```bash
npm run electron:start
```

### Dev mode (two terminals)

```bash
# terminal 1 — start the dev server with Vite HMR
npm run dev

# terminal 2 — once "serving on port 5000" appears, open the Electron window
npm run electron:dev
```

`electron:dev` skips the build step and connects to the already-running dev server, so hot-reload works normally.

### Electron scripts reference

| Script | What it does |
|---|---|
| `electron:build` | Compiles `electron/main.ts` → `dist/electron/main.js` |
| `electron:dev` | Builds Electron main, opens window against existing dev server on port 5000 |
| `electron:start` | Full build (client + server + Electron main), spawns Express, opens window |

### Setup notes

- **Port 5000 must be free** before launching. If the Docker container `trace-app-1` is running, it binds port 5000 on the host. Stop it first: `docker stop trace-app-1`.
- **Node.js version change:** `better-sqlite3` is a native addon compiled against a specific Node ABI. If you switch Node versions, run `npm rebuild better-sqlite3` before starting.
- **`.env` required:** `SESSION_SECRET` must be set. Copy `.env.example` to `.env` and generate a value if you have not already.

---

## Storage

### Database

The database is a single SQLite file. All metadata, albums, journals, and the user account live here.

| Mode | Default location |
|---|---|
| Docker | `./data/trace.db` on the host (bind-mounted to `/app/data/trace.db` in the container) |
| Local | `./data/trace.db` relative to the working directory |

Set `DATABASE_PATH` in `.env` to use a different location. The `data/` directory is created automatically on startup if it does not exist.

All path resolution goes through `server/paths.ts` — that is the single file to update if the storage location ever needs to change (e.g. for a desktop packaging context).

### Uploads

Imported photos and videos are stored in `./uploads/`. In Docker, `./uploads/` on the host is bind-mounted to `/app/uploads` inside the container.

### Scanning local photo folders with Docker

To scan folders already on the host, add volume mounts in `docker-compose.yaml`:

```yaml
volumes:
  - ./uploads:/app/uploads
  - ./data:/app/data
  - /home/user/Pictures:/app/media/Pictures  # add host folder here
```

Then add `/app/media/Pictures` as a folder in the Trace UI. The path you enter in the UI must be the container-side path, not the host path.

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SESSION_SECRET` | **Yes** | — | Long random string. Signs session cookies. Changing it logs everyone out. |
| `DATABASE_PATH` | No | `./data/trace.db` | Path to the SQLite database file. Docker Compose sets this automatically. |

Generate `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

`.env` is never committed — it is listed in `.gitignore`.

---

## Backup

### Database

The database is a single file. Back it up while the app is stopped, or use SQLite's online backup to avoid stopping:

**File copy (stop app first):**
```bash
# Docker
docker compose stop
cp data/trace.db backup_$(date +%Y%m%d).db
docker compose start

# Local
cp data/trace.db backup_$(date +%Y%m%d).db
```

**Online backup (app can stay running):**
```bash
sqlite3 data/trace.db ".backup backup_$(date +%Y%m%d).db"
```

In Docker, the database is on the host at `./data/trace.db` — back it up from the host with either method above.

### Uploads

```bash
tar -czf uploads_$(date +%Y%m%d).tar.gz uploads/
```

### What to back up

| Path | Contents | When |
|---|---|---|
| `data/trace.db` | All metadata, albums, journals, user account | After any changes |
| `uploads/` | All photo and video files | After imports |

Keep both together — a database backup without its matching uploads will have broken references.

---

## LAN exposure

By default, Trace binds to `0.0.0.0:5000` and is reachable by any device on your local network. Authentication is required to access any content.

**Do not expose port 5000 directly to the internet.** If you need remote access, place Trace behind a reverse proxy (nginx, Caddy) with a valid TLS certificate. The session cookie is marked `httpOnly` and `sameSite: lax` but is not `secure` — it is sent over plain HTTP. On a trusted LAN this is acceptable; over the internet it is not.
