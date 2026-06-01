# Database backups

This directory is the **host-side target** for the SQLite backup sidecar
(`scripts/backup.js`, wired into `docker-compose.yml` as service `backup`).

## What lives here

Files named `app-YYYYMMDD-HHMMSS.db` (or `.db.gz` when `BACKUP_COMPRESS=1`).
Each file is a complete, point-in-time snapshot of the live DB taken via the
SQLite online-backup API — safe to take while the app is writing.

## Behaviour

- Snapshots run every `BACKUP_INTERVAL_SECONDS` seconds (default **6 h**).
- The sidecar keeps the newest `BACKUP_KEEP` snapshots and prunes the rest
  (default **60** ≈ 15 days at the 6 h cadence).
- One snapshot is also taken immediately on every container start.

## Tuning (set in `.env` next to `docker-compose.yml`)

```env
BACKUP_INTERVAL_SECONDS=21600   # 6 h
BACKUP_KEEP=60
BACKUP_COMPRESS=1               # gzip each snapshot
TZ=Asia/Ho_Chi_Minh
```

## Restore

Stop the app, copy a snapshot into the live volume, restart:

```bash
docker compose stop app
gunzip -k backups/app-20260601-031500.db.gz       # if compressed
docker run --rm \
  -v paper-manager-cs_paper-data:/data \
  -v "$(pwd)/backups:/backups:ro" \
  alpine sh -c 'cp /backups/app-20260601-031500.db /data/app.db && \
                rm -f /data/app.db-wal /data/app.db-shm'
docker compose up -d app
```

## Off-host backups

This directory is local to the host. For disaster recovery copy it elsewhere
periodically (e.g. `rsync`/`rclone` to an off-site target, or a host-level cron
tarball uploaded to object storage).
