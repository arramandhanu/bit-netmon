#!/usr/bin/env bash
# ─── NetMon Database Backup Script ──────────────────
# Usage: bash infra/scripts/backup-db.sh
# Cron:  0 2 * * * /path/to/infra/scripts/backup-db.sh >> /var/log/netmon-backup.log 2>&1

set -euo pipefail

# ─── Configuration ──────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/root/backups/netmon}"
CONTAINER_NAME="${CONTAINER_NAME:-netmon-postgres}"
POSTGRES_USER="${POSTGRES_USER:-netmon}"
POSTGRES_DB="${POSTGRES_DB:-netmon}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="netmon_${TIMESTAMP}.sql.gz"

# ─── Create backup directory ────────────────────────
mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting backup of ${POSTGRES_DB}..."

# ─── Run pg_dump inside the container ────────────────
docker exec "${CONTAINER_NAME}" \
    pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
    --no-owner --no-privileges --clean --if-exists \
    | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
echo "[$(date)] Backup completed: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ─── Remove old backups ─────────────────────────────
DELETED=$(find "${BACKUP_DIR}" -name "netmon_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete -print | wc -l)
echo "[$(date)] Cleaned up ${DELETED} backup(s) older than ${RETENTION_DAYS} days"

echo "[$(date)] Backup finished successfully"
