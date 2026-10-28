#!/usr/bin/env bash
# ==============================================================================
# Nexam Assessment System - Database Backup Script
# Usage: ./scripts/backup.sh [output_dir]
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/nexam_db_${TIMESTAMP}.sql.gz"

echo "=== Memulai Pencadangan Database Nexam ==="
mkdir -p "${BACKUP_DIR}"

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: Variabel lingkungan DATABASE_URL tidak ditemukan."
  exit 1
fi

echo "1. Membuat dump PostgreSQL dari DATABASE_URL..."
CLEAN_DB_URL="${DATABASE_URL%%\?*}"
pg_dump "${CLEAN_DB_URL}" --clean --if-exists --no-owner --no-privileges | gzip > "${BACKUP_FILE}"

FILESIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "✓ Pencadangan selesai: ${BACKUP_FILE} (${FILESIZE})"
echo "=========================================="
