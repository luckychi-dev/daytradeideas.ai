#!/usr/bin/env bash
set -euo pipefail

backup_dir="/opt/daytrade-ai/backups"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="${backup_dir}/daytrade-ai-${timestamp}.sql.gz"
temporary="${target}.tmp"

umask 077
mkdir -p "$backup_dir"
trap 'rm -f "$temporary"' EXIT

docker exec daytrade-ai-postgres-1 \
  pg_dump --clean --if-exists --no-owner --no-privileges \
  -U daytrade -d daytrade | gzip -9 >"$temporary"
mv "$temporary" "$target"

find "$backup_dir" -type f -name 'daytrade-ai-*.sql.gz' -mtime +14 -delete
echo "Created $target"
