# Trace

A self-hosted, single-user photo memory and journaling app with AI-powered image tagging.

---

## Requirements

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/)
- A `.env` file with a session secret (see below)

---

## First-time setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd trace
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

`.env` is never committed. It is listed in `.gitignore` and must stay local.

Open `.env` and set `SESSION_SECRET` to a long random string:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Paste the output as the value of `SESSION_SECRET`.

### 3. Start the app

```bash
docker compose up -d
```

This builds the image, runs database migrations, and starts both services.

### 4. Create your admin account

Open `http://localhost:5000` in your browser.

On first launch, Trace shows a **Create account** screen. Enter a password
(minimum 10 characters). This is the only account — there is no username field.
The password is stored as a hashed value in the database; it is never logged.

On all subsequent launches, Trace shows a normal login form.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | **Yes** | Random 64-char hex string. Signs session cookies. Changing it logs everyone out. |
| `DATABASE_URL` | Local dev only | PostgreSQL connection string. Set automatically by Docker Compose. |

Generate `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Local development (without Docker)

Requires Node 20 and a running PostgreSQL instance.

```bash
cp .env.example .env
# fill in SESSION_SECRET and DATABASE_URL in .env

npm install
npm run dev
```

Apply the database schema:
```bash
npm run db:push
```

---

## Backup and restore

### Database

**Backup** (produces a plain-SQL file):
```bash
docker compose exec db pg_dump -U trace trace > backup_$(date +%Y%m%d).sql
```

**Restore** (stop the app first to avoid conflicts):
```bash
docker compose stop app
docker compose exec -T db psql -U trace trace < backup_YYYYMMDD.sql
docker compose start app
```

For large libraries, use the custom format (`-Fc`) for a compressed binary dump
and `pg_restore` to replay it — faster and smaller than plain SQL.

### Uploads directory

The `./uploads/` folder on the host holds all imported photos and videos.
It is bind-mounted into the container and is not inside any Docker volume.

**Backup:**
```bash
tar -czf uploads_$(date +%Y%m%d).tar.gz uploads/
```

**Restore:**
```bash
tar -xzf uploads_YYYYMMDD.tar.gz
```

### What to back up

| Location | What | How often |
|---|---|---|
| `backup_YYYYMMDD.sql` | All metadata, albums, journals, user account | After changes |
| `uploads_YYYYMMDD.tar.gz` | All photo and video files | After imports |

Keep both together — a database backup without its matching uploads (or vice versa)
will have broken references.

---

## LAN exposure

By default the app binds to `0.0.0.0:5000` and is reachable by any device on
your local network. Authentication is required to access any content.

**Do not expose port 5000 directly to the internet.** If you need remote access:

- Place Trace behind a reverse proxy (nginx, Caddy) with a valid TLS certificate.
- Restrict access by IP or VPN rather than opening the port publicly.
- The session cookie is marked `httpOnly` and `sameSite: lax` but is **not**
  `secure` — it will be sent over plain HTTP. On a trusted LAN this is acceptable;
  over the internet it is not.
