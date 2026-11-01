#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backup_dir="${DAYTRADE_BACKUP_DIR:-$project_dir/backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$backup_dir/daytrade-$timestamp.sql.gz"

mkdir -p "$backup_dir"
docker compose --project-directory "$project_dir" exec -T postgres \
  pg_dump -U daytrade -d daytrade | gzip > "$target"

find "$backup_dir" -type f -name 'daytrade-*.sql.gz' -mtime +14 -delete
printf 'Database backup created: %s\n' "$target"

