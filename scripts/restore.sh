#!/usr/bin/env bash
# ==============================================================================
# Nexam Assessment System - Database Restore Script
# Usage: ./scripts/restore.sh <path_to_backup.sql.gz>
# ==============================================================================

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Penggunaan: $0 <path_to_backup.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: File cadangan '${BACKUP_FILE}' tidak ditemukan."
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: Variabel lingkungan DATABASE_URL tidak ditemukan."
  exit 1
fi

echo "=== Memulai Pemulihan Database Nexam ==="
echo "Target File: ${BACKUP_FILE}"
read -p "PERINGATAN: Tindakan ini akan menimpa database saat ini. Lanjutkan? (y/N): " CONFIRM
if [[ "${CONFIRM}" != [yY] && "${CONFIRM}" != [yY][eE][sS] ]]; then
  echo "Pemulihan dibatalkan."
  exit 0
fi

echo "1. Memulihkan skema dan data database..."
CLEAN_DB_URL="${DATABASE_URL%%\?*}"
gunzip -c "${BACKUP_FILE}" | psql "${CLEAN_DB_URL}"

echo "✓ Pemulihan database berhasil diselesaikan."
echo "=========================================="
