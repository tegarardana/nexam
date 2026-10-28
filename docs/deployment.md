# Nexam – Deployment Documentation

**Version:** 0.2  
**Last updated:** 2026-10-23  
**Status:** Phase 0 revised draft – to be validated on actual school hardware before production use  
**Changes from v0.1:** Runtime updated to Node.js 26 LTS (Node 20 reached EOL in April 2026); Next.js version reference updated to 16.x; Prisma version pinned to 7.x stable (not `@latest` which resolves to RC); Docker build note added for Node 26 base image; `pino` structured logging confirmed.

---

## 1. Architecture Principle

Nexam uses a **single-application, single-database topology**. There is one PostgreSQL instance that is the authoritative source of truth for all examination records. There are no local-and-remote database pairs, no offline sync, and no distributed writes.

```
┌───────────────────────────────────────────────────────────────┐
│                      School Network (LAN)                     │
│                                                               │
│  Student / Teacher laptops                                    │
│  ────────────────────┐                                        │
│                      ▼                                        │
│             ┌──────────────────┐                              │
│             │  Nginx (TLS)     │ :443  ←─── LAN DNS / IP     │
│             └────────┬─────────┘                              │
│                      │ HTTP/1.1 upstream                      │
│             ┌────────▼─────────┐                              │
│             │  Next.js App     │ :3000                        │
│             └────────┬─────────┘                              │
│                      │                                        │
│        ┌─────────────┼──────────────┐                         │
│        ▼             ▼              ▼                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐                │
│  │PostgreSQL│  │  MinIO   │  │ Log / backup │                │
│  │ :5432    │  │  :9000   │  │ destination  │                │
│  └──────────┘  └──────────┘  └──────────────┘                │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                               │
                Optional secure remote access
                               │
                    ┌──────────▼──────────┐
                    │  Internet clients   │
                    │  (via VPN or HTTPS  │
                    │   public endpoint)  │
                    └─────────────────────┘
```

---

## 2. Prerequisites

### Server Hardware (Minimum Recommendation)

| Resource | Minimum | Recommended for 200 concurrent sessions |
|----------|---------|----------------------------------------|
| CPU | 4 cores | 8 cores |
| RAM | 8 GB | 16 GB |
| SSD | 50 GB | 200 GB (for media, backups, logs) |
| NIC | 100 Mbps | 1 Gbps (LAN) |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Software Requirements

- Docker Engine 25+ (supports BuildKit by default)
- Docker Compose v2
- Nginx 1.24+ (can run in Docker or natively)
- Git (for deployment pulls)
- `openssl` (for TLS certificate generation)

> **Node.js base image:** The application Docker image must use `node:26-alpine` (or `node:26-bookworm-slim`). Node.js 20 reached EOL in April 2026 and must not be used. Do not use the generic `node:latest` tag in production images.

> **Prisma CLI:** Use `npx prisma@7` (or pin `"prisma": "^7.10.1"` in `package.json`). `npx prisma@latest` currently resolves to `8.0.0-rc.x` (release candidate) and must not be used in production until Prisma 8 reaches stable.

---

## 3. Docker Compose Services

```yaml
# docker-compose.yml (production – outline only; final version will be in the repository)
services:
  app:
    image: nexam-app:latest
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}       # injected from .env; never committed
      SESSION_SECRET: ${SESSION_SECRET}
      MINIO_ENDPOINT: ${MINIO_ENDPOINT}
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
      APP_URL: ${APP_URL}
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "3000:3000"                       # Nginx proxies to this; not exposed to internet

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 5
    ports: []                             # NEVER expose 5432 to the network

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    ports: []                             # Only accessible by the app container

volumes:
  pg_data:
  minio_data:
```

### Environment Variables

Create a `.env` file (from `.env.example`) on the server. **Never commit `.env` to version control.**

```bash
# .env.example (committed; no real values)
NODE_ENV=production
APP_URL=https://exam.schoolname.sch.id

DATABASE_URL=postgresql://nexam_user:CHANGE_ME@db:5432/nexam
POSTGRES_DB=nexam
POSTGRES_USER=nexam_user
POSTGRES_PASSWORD=CHANGE_ME

SESSION_SECRET=CHANGE_ME_AT_LEAST_64_CHARS

MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=CHANGE_ME
MINIO_SECRET_KEY=CHANGE_ME

HEARTBEAT_INTERVAL_SECONDS=30
MAX_UPLOAD_SIZE_MB=10
```

---

## 4. LAN Access Configuration

### Step 1: Assign a Static IP to the Server

Configure the server NIC with a static IP on the school LAN, e.g., `192.168.1.100`.

### Step 2: Configure Local DNS (Recommended)

Ask the school's network administrator to add a DNS A record:

```
exam.sekolah.local → 192.168.1.100
```

Students and teachers access the application at `https://exam.sekolah.local`.

If the school has no local DNS server, access by IP (`https://192.168.1.100`) is acceptable for LAN use.

### Step 3: TLS Certificate for LAN

For HTTPS on a LAN without a public domain:

**Option A – Self-signed certificate (simplest):**
```bash
openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt \
  -days 3650 -nodes \
  -subj "/CN=exam.sekolah.local" \
  -addext "subjectAltName=IP:192.168.1.100,DNS:exam.sekolah.local"
```

Distribute the `server.crt` to school devices as a trusted root certificate (via MDM or manual install). Students will see a browser warning without this step.

**Option B – Internal CA:**
Set up a school CA (e.g., using `step-ca`) to issue certificates trusted by all school devices.

### Step 4: Nginx LAN Configuration

```nginx
# /etc/nginx/sites-available/nexam
server {
    listen 443 ssl http2;
    server_name exam.sekolah.local 192.168.1.100;

    ssl_certificate     /etc/nginx/ssl/server.crt;
    ssl_certificate_key /etc/nginx/ssl/server.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # SSE (live proctoring) – disable buffering
    location /api/proctoring/stream {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Connection '';
        proxy_set_header   Cache-Control 'no-cache';
        proxy_buffering    off;
        proxy_read_timeout 300s;
    }

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Block access to MinIO and Postgres from outside
    # (These services should not be on a public-facing port at all)
}

server {
    listen 80;
    server_name exam.sekolah.local 192.168.1.100;
    return 301 https://$host$request_uri;  # Force HTTPS
}
```

---

## 5. Internet Access Configuration

### Approach A – Public HTTPS Endpoint (Preferred for Small Schools)

Requirements:
1. A registered domain name (e.g., `nexam.schoolname.sch.id`).
2. A public static IP OR a dynamic DNS (DDNS) service.
3. Port 443 (and 80 for redirect) forwarded through the school firewall/router to the server's LAN IP.
4. A TLS certificate from Let's Encrypt:
   ```bash
   certbot --nginx -d nexam.schoolname.sch.id
   ```
5. ISP must allow inbound traffic on port 443.

**Risks:**
- School ISP may block inbound ports; verify before promising internet access.
- Dynamic IP requires DDNS renewal; Let's Encrypt cert renewal requires port 80.

### Approach B – VPN (Most Secure)

Set up WireGuard or OpenVPN on the server. Remote users connect to the VPN before accessing the LAN URL. No ports need to be opened on the school firewall.

```bash
# WireGuard example (outline only)
apt install wireguard
# Generate server keypair, configure wg0.conf, distribute client configs
```

**Advantage:** No public-facing surface for the application; internet access is gated by VPN credentials.

### Approach C – Secure Tunnel (Simplest for Temporary Internet Access)

Use Cloudflare Tunnel (`cloudflared`) for zero-ingress-port internet access:

```bash
cloudflared tunnel create nexam
cloudflared tunnel route dns nexam nexam.schoolname.sch.id
cloudflared tunnel run nexam
```

**Limitation:** Requires a Cloudflare account and DNS delegation; not appropriate if the school's network policy prohibits external tunnels.

### ⚠️ Internet Access Risks

| Risk | Mitigation |
|------|-----------|
| Database exposed to internet | PostgreSQL port 5432 must NEVER be in Docker's published ports for internet access |
| Brute-force login attacks | Rate limiting on `/api/auth/login` (10 req/min per IP); account lockout after N failures |
| Large-scale DDoS | School-grade mitigation (Cloudflare proxy, if using approach C) |
| TLS certificate expiry | Automate Let's Encrypt renewal via `certbot renew` cron |
| ISP dynamic IP change | Use DDNS or VPN to avoid dependency on static IP |

---

## 6. Database Migrations

Migrations are managed by Prisma Migrate.

```bash
# Development: generate and apply a migration
npx prisma migrate dev --name <migration_name>

# Production: apply pending migrations (run before starting the app)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

**Production deployment checklist:**
1. Take a database backup before every migration.
2. Run `prisma migrate deploy` in the app container before routing traffic.
3. If a migration fails, restore from the pre-migration backup.
4. Never run `prisma migrate reset` on production data.

---

## 7. Database Backup and Restore

### Backup

```bash
#!/bin/bash
# backup.sh – run via cron: 0 2 * * * /opt/nexam/backup.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/nexam_${TIMESTAMP}.sql.gz"

docker compose exec db pg_dump \
  -U "${POSTGRES_USER}" \
  "${POSTGRES_DB}" | gzip > "${BACKUP_FILE}"

# Optional: copy to off-site location
# rclone copy "${BACKUP_FILE}" remote:nexam-backups/
```

Recommended schedule:
- Full backup daily at 02:00 (low-traffic window).
- Before every deployment.
- Before any bulk data operation (bulk import, academic year transition).
- Retain at least 30 days of backups.

### Restore

```bash
# 1. Stop the application
docker compose stop app

# 2. Restore the database
gunzip -c /backups/nexam_20260101_020000.sql.gz | \
  docker compose exec -T db psql -U "${POSTGRES_USER}" "${POSTGRES_DB}"

# 3. Restart the application
docker compose start app
```

Test restore procedures at least monthly on a **separate** environment.

---

## 8. Health Checks

### Application Health Endpoint

The Next.js app exposes `GET /api/health`:

```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-10-20T07:39:41.000Z"
}
```

Nginx upstream health check:

```nginx
upstream nexam {
    server 127.0.0.1:3000;
    keepalive 32;
}
```

### Monitoring (Recommended)

For production use, add monitoring to:
- Application process (systemd or Docker health check).
- PostgreSQL connection pool.
- Disk space (alert at 80% full).
- SSL certificate expiry (alert 14 days before expiry).

---

## 9. Logging

- **Application logs:** structured JSON via `pino` to stdout → collected by Docker's logging driver.
- **Nginx access logs:** standard combined format.
- **Audit logs:** stored in PostgreSQL `audit_logs` table (queryable via admin UI).
- **Error logs:** structured errors logged with request context; no stack traces in responses.

Rotate logs with `logrotate` or Docker's `--log-opt max-size` and `max-file` options.

---

## 10. Upgrade and Rollback

### Upgrade

```bash
# 1. Pull new image or code
git pull origin main  # or docker pull nexam-app:new_version

# 2. Take a database backup
./backup.sh

# 3. Run migrations
docker compose run --rm app npx prisma migrate deploy

# 4. Restart the app with zero downtime (if multiple replicas available)
docker compose up -d --no-deps app

# 5. Verify health check
curl -sk https://exam.sekolah.local/api/health
```

### Rollback

```bash
# 1. Stop the app
docker compose stop app

# 2. Restore the pre-upgrade database backup
gunzip -c /backups/nexam_pre_upgrade.sql.gz | \
  docker compose exec -T db psql -U "${POSTGRES_USER}" "${POSTGRES_DB}"

# 3. Revert to the previous image or commit
git checkout <previous_tag>
# or: docker compose pull nexam-app:<previous_version>

# 4. Restart
docker compose up -d app
```

---

## 11. Security Hardening Checklist

- [ ] `ufw` firewall enabled; only ports 22 (SSH), 80, 443 open externally.
- [ ] PostgreSQL not bound to a public interface.
- [ ] MinIO not bound to a public interface.
- [ ] SSH key-based authentication; password SSH login disabled.
- [ ] Automatic security updates enabled (`unattended-upgrades`).
- [ ] `.env` file permissions: `chmod 600 .env`.
- [ ] Backup files stored outside the Docker volume mount; tested restore confirmed.
- [ ] TLS certificate valid and auto-renewing.
- [ ] HTTPS redirect enforced (HTTP → HTTPS).
- [ ] `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy` headers set by Nginx.
- [ ] Application error pages do not expose stack traces.
- [ ] Database user (`nexam_user`) has only `CONNECT`, `SELECT`, `INSERT`, `UPDATE`, `DELETE` on the `nexam` database; no `SUPERUSER`.

---

## 12. Unresolved Deployment Questions

| ID | Question |
|----|----------|
| DQ-01 | Does the school have a local DNS server, or will students use IP addresses? |
| DQ-02 | Is internet access required from day 1, or only in a later phase? |
| DQ-03 | What is the school's ISP, and do they allow inbound port 443? |
| DQ-04 | Is there a NAS or cloud backup destination for off-site backups? |
| DQ-05 | What is the target hardware (CPU, RAM, disk)? Needed to validate 200-session load target. |
| DQ-06 | Will the server run Windows or Linux? (Linux strongly recommended.) |
| DQ-07 | Is a managed MDM available to deploy the LAN TLS certificate to student devices? |
