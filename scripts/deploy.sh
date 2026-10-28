#!/usr/bin/env bash
# ==============================================================================
# Nexam Assessment System - VPS Auto-Deploy Script
# ==============================================================================

set -euo pipefail

APP_DIR="${1:-$HOME/nexam}"

echo "=== [$(date '+%Y-%m-%d %H:%M:%S')] Memulai Auto-Deploy Nexam ==="

cd "${APP_DIR}"

# 1. Pastikan branch experiment aktif dan tarik perubahan terbaru
git fetch origin experiment
git checkout experiment
git pull origin experiment

# 2. Update dependencies
npm install

# 3. Sinkronisasi database Prisma
npx prisma db push

# 4. Compile / Build Next.js
npm run build

# 5. Restart service PM2
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart nexam || pm2 start npm --name "nexam" -- start
else
  echo "Peringatan: PM2 tidak ditemukan di PATH. Jalankan 'pm2 restart nexam' secara manual."
fi

echo "=== [$(date '+%Y-%m-%d %H:%M:%S')] Deploy Berhasil Diselesaikan! ==="

