#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────
#  NetMon — Update Script
#  Pulls latest code, backs up DB, runs migrations, rebuilds,
#  and restarts services. Rolls back on failure.
#  Usage:    sudo ./scripts/update.sh [--version TAG]
# ───────────────────────────────────────────────────────────

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC} $1"; }
error() { echo -e "  ${RED}✗${NC} $1"; }
info()  { echo -e "  ${BLUE}→${NC} $1"; }

# ─── Find project root ──────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups"
VERSION_TAG="${1:-}"

cd "$PROJECT_ROOT"

echo ""
echo -e "  ${CYAN}${BOLD}NetMon — Update${NC}"
echo ""

# ─── Pre-flight checks ──────────────────────────────────
if [[ ! -f ".env" ]]; then
    error "No .env file found — is NetMon installed?"
    exit 1
fi

if [[ ! -d ".git" ]]; then
    error "Not a git repository — cannot pull updates"
    exit 1
fi

# Source .env for database credentials
set -a
source .env
set +a

# ─── Save current version ───────────────────────────────
OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
info "Current version: ${OLD_COMMIT}"

# ─── Database Backup ────────────────────────────────────
backup_database() {
    mkdir -p "$BACKUP_DIR"
    local backup_file="${BACKUP_DIR}/netmon_${OLD_COMMIT}_$(date +%Y%m%d_%H%M%S).sql.gz"

    info "Backing up database before update..."

    local db_name="${POSTGRES_DB:-netmon}"
    local db_user="${POSTGRES_USER:-netmon}"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_dump -U "$db_user" -h localhost "$db_name" 2>/dev/null | gzip > "$backup_file"
    else
        sudo -u postgres pg_dump "$db_name" 2>/dev/null | gzip > "$backup_file"
    fi

    if [[ -s "$backup_file" ]]; then
        local size
        size=$(du -h "$backup_file" | cut -f1)
        log "Database backup saved: ${backup_file} (${size})"
    else
        warn "Database backup may be empty — proceeding anyway"
        rm -f "$backup_file"
    fi

    # Cleanup old backups (keep last 10)
    ls -t "${BACKUP_DIR}"/netmon_*.sql.gz 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true

    echo "$backup_file"
}

# ─── Rollback ────────────────────────────────────────────
rollback() {
    local old_commit="$1"
    echo ""
    error "Update failed! Rolling back to ${old_commit}..."

    # Revert git
    git checkout "$old_commit" 2>/dev/null || git reset --hard "$old_commit" 2>/dev/null || true

    # Rebuild with old code
    npm install --production=false 2>&1 | tail -1
    npm run db:generate 2>&1 | tail -1
    npm run build 2>&1 | tail -1

    # Restart services
    if command -v systemctl &>/dev/null; then
        sudo systemctl restart netmon-api netmon-web 2>/dev/null || true
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        sudo launchctl kickstart -k system/com.netmon.api 2>/dev/null || true
        sudo launchctl kickstart -k system/com.netmon.web 2>/dev/null || true
    fi

    log "Rolled back to ${old_commit}"
    info "Database was not changed (backup available in ${BACKUP_DIR}/)"
    exit 1
}

# ─── Main Update ────────────────────────────────────────

# Step 1: Backup
BACKUP_FILE=$(backup_database)

# Step 2: Pull latest code
if [[ -n "$VERSION_TAG" && "$VERSION_TAG" != "--"* ]]; then
    info "Checking out version: ${VERSION_TAG}..."
    git fetch origin 2>&1 | tail -1
    git checkout "$VERSION_TAG" 2>&1 | tail -1 || {
        error "Version ${VERSION_TAG} not found"
        exit 1
    }
else
    info "Pulling latest changes from main..."
    git pull --rebase origin main 2>&1 | tail -3
fi

NEW_COMMIT=$(git rev-parse --short HEAD)
log "Updated to: ${NEW_COMMIT}"

if [[ "$OLD_COMMIT" == "$NEW_COMMIT" ]]; then
    log "Already up to date — no changes to apply"
    exit 0
fi

# Step 3: Install dependencies
info "Updating npm dependencies..."
npm install --production=false 2>&1 | tail -1 || rollback "$OLD_COMMIT"
log "Dependencies updated"

# Step 4: Regenerate Prisma client
info "Regenerating Prisma client..."
npm run db:generate 2>&1 | tail -1 || rollback "$OLD_COMMIT"
log "Prisma client regenerated"

# Step 5: Run migrations
info "Running database migrations..."
npm run db:migrate 2>&1 | tail -1 || rollback "$OLD_COMMIT"
log "Migrations applied"

# Step 6: Rebuild
info "Building production assets..."
npm run build 2>&1 | tail -3 || rollback "$OLD_COMMIT"
log "Build complete"

# Step 7: Restart services
if command -v systemctl &>/dev/null; then
    info "Restarting services..."
    sudo systemctl restart netmon-api
    sleep 3
    sudo systemctl restart netmon-web
    log "Services restarted"

    # Health check
    sleep 5
    local api_ok=false
    for i in {1..10}; do
        if curl -sf "http://localhost:${API_PORT:-3000}/api/v1/health" &>/dev/null; then
            api_ok=true
            break
        fi
        sleep 2
    done

    if [[ "$api_ok" == "true" ]]; then
        log "API health check passed ✓"
    else
        warn "API not responding — check logs: sudo journalctl -u netmon-api -f"
    fi

    echo ""
    info "Service status:"
    sudo systemctl status netmon-api --no-pager -l 2>/dev/null | head -5
    echo ""
    sudo systemctl status netmon-web --no-pager -l 2>/dev/null | head -5

elif [[ "$OSTYPE" == "darwin"* ]]; then
    info "Restarting launchd services..."
    sudo launchctl kickstart -k system/com.netmon.api 2>/dev/null || true
    sleep 3
    sudo launchctl kickstart -k system/com.netmon.web 2>/dev/null || true
    log "Services restarted"
else
    warn "No service manager found — restart services manually"
fi

echo ""
echo -e "  ${GREEN}${BOLD}Update complete!${NC} ${OLD_COMMIT} → ${NEW_COMMIT}"
[[ -n "$BACKUP_FILE" ]] && echo -e "  ${DIM}Backup: ${BACKUP_FILE}${NC}"
echo ""
