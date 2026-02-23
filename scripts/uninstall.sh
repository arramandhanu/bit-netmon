#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────
#  NetMon — Uninstall Script
#  Removes services, cron jobs, and optionally drops database.
#  Usage:    sudo ./scripts/uninstall.sh
# ───────────────────────────────────────────────────────────

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

log()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC} $1"; }
info()  { echo -e "  ${BLUE}→${NC} $1"; }

# ─── Find project root ──────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo ""
echo -e "  ${RED}${BOLD}NetMon — Uninstall${NC}"
echo ""

# ─── Confirmation ────────────────────────────────────────
echo -e "  ${YELLOW}This will remove all NetMon services from your system.${NC}"
echo ""
read -rp "  Are you sure you want to continue? [y/N] " confirm
if [[ "${confirm,,}" != "y" ]]; then
    echo "  Cancelled."
    exit 0
fi

removed=()

# ─── Stop & Remove Systemd Services (Linux) ─────────────
if command -v systemctl &>/dev/null; then
    info "Stopping systemd services..."

    for svc in netmon-api netmon-web; do
        if systemctl is-active "$svc" &>/dev/null; then
            sudo systemctl stop "$svc"
            log "Stopped ${svc}"
        fi
        if systemctl is-enabled "$svc" &>/dev/null; then
            sudo systemctl disable "$svc" 2>/dev/null || true
        fi
        if [[ -f "/etc/systemd/system/${svc}.service" ]]; then
            sudo rm -f "/etc/systemd/system/${svc}.service"
            removed+=("${svc}.service")
        fi
    done

    sudo systemctl daemon-reload
    log "Systemd units cleaned up"
fi

# ─── Stop & Remove LaunchDaemons (macOS) ─────────────────
if [[ "$OSTYPE" == "darwin"* ]]; then
    info "Stopping launchd services..."

    for plist in com.netmon.api com.netmon.web; do
        if sudo launchctl list "$plist" &>/dev/null; then
            sudo launchctl unload "/Library/LaunchDaemons/${plist}.plist" 2>/dev/null || true
            log "Unloaded ${plist}"
        fi
        if [[ -f "/Library/LaunchDaemons/${plist}.plist" ]]; then
            sudo rm -f "/Library/LaunchDaemons/${plist}.plist"
            removed+=("${plist}.plist")
        fi
    done

    log "LaunchDaemons cleaned up"
fi

# ─── Remove Nginx Config ────────────────────────────────
for conf in /etc/nginx/sites-available/netmon /etc/nginx/sites-enabled/netmon /etc/nginx/conf.d/netmon.conf /usr/local/etc/nginx/servers/netmon.conf; do
    if [[ -f "$conf" ]]; then
        sudo rm -f "$conf"
        removed+=("nginx config")
    fi
done
if [[ "${#removed[@]}" -gt 0 ]] && command -v nginx &>/dev/null; then
    sudo nginx -t 2>/dev/null && {
        sudo systemctl reload nginx 2>/dev/null || brew services restart nginx 2>/dev/null || true
    }
fi

# ─── Remove Watchdog Cron ────────────────────────────────
if crontab -l 2>/dev/null | grep -q "netmon.*watchdog"; then
    crontab -l 2>/dev/null | grep -v "netmon.*watchdog" | crontab -
    removed+=("watchdog cron")
    log "Watchdog cron removed"
fi

# ─── Remove Certbot Renewal Cron ─────────────────────────
# (only if it references netmon)
if crontab -l 2>/dev/null | grep -q "certbot renew"; then
    info "Certbot auto-renewal cron found — keeping it (not NetMon-specific)"
fi

# ─── Remove Logrotate Config ────────────────────────────
if [[ -f /etc/logrotate.d/netmon ]]; then
    sudo rm -f /etc/logrotate.d/netmon
    removed+=("logrotate config")
    log "Logrotate config removed"
fi

# ─── Remove Log Files ───────────────────────────────────
for logfile in /var/log/netmon-api.log /var/log/netmon-api-error.log /var/log/netmon-web.log /var/log/netmon-web-error.log /var/log/netmon-watchdog.log; do
    if [[ -f "$logfile" ]]; then
        sudo rm -f "$logfile"
    fi
done
log "Log files removed"

# ─── Firewall Rules ─────────────────────────────────────
echo ""
read -rp "  Remove firewall rules (ports 3000, 3001)? [y/N] " rm_fw
if [[ "${rm_fw,,}" == "y" ]]; then
    if command -v ufw &>/dev/null; then
        sudo ufw delete allow 3000/tcp 2>/dev/null || true
        sudo ufw delete allow 3001/tcp 2>/dev/null || true
        log "UFW rules removed"
    elif command -v firewall-cmd &>/dev/null; then
        sudo firewall-cmd --permanent --remove-port=3000/tcp 2>/dev/null || true
        sudo firewall-cmd --permanent --remove-port=3001/tcp 2>/dev/null || true
        sudo firewall-cmd --reload 2>/dev/null || true
        log "Firewalld rules removed"
    fi
    removed+=("firewall rules")
fi

# ─── Database Cleanup (Optional) ────────────────────────
echo ""
read -rp "  Drop the NetMon database? This will DELETE ALL DATA. [y/N] " drop_db
if [[ "${drop_db,,}" == "y" ]]; then
    local_db_name="netmon"
    local_db_user="netmon"
    if [[ -f "${PROJECT_ROOT}/.env" ]]; then
        local_db_name=$(grep -E "^POSTGRES_DB=" "${PROJECT_ROOT}/.env" | cut -d= -f2 || echo "netmon")
        local_db_user=$(grep -E "^POSTGRES_USER=" "${PROJECT_ROOT}/.env" | cut -d= -f2 || echo "netmon")
    fi

    info "Dropping database '${local_db_name}'..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        dropdb "$local_db_name" 2>/dev/null || true
        dropuser "$local_db_user" 2>/dev/null || true
    else
        sudo -u postgres dropdb "$local_db_name" 2>/dev/null || true
        sudo -u postgres dropuser "$local_db_user" 2>/dev/null || true
    fi
    log "Database '${local_db_name}' and user '${local_db_user}' dropped"
    removed+=("database")
fi

# ─── Build Artifacts (Optional) ─────────────────────────
echo ""
read -rp "  Remove node_modules and build artifacts? [y/N] " clean_build
if [[ "${clean_build,,}" == "y" ]]; then
    info "Cleaning build artifacts..."
    rm -rf "${PROJECT_ROOT}/node_modules"
    rm -rf "${PROJECT_ROOT}/apps/api/dist"
    rm -rf "${PROJECT_ROOT}/apps/web/.next"
    rm -rf "${PROJECT_ROOT}/backups"
    log "Build artifacts removed"
    removed+=("build artifacts")
fi

# ─── Summary ─────────────────────────────────────────────
echo ""
echo -e "  ${GREEN}${BOLD}Uninstall complete.${NC}"
echo ""
echo -e "  ${BOLD}Removed:${NC}"
for item in "${removed[@]}"; do
    echo "    • ${item}"
done
echo ""
echo -e "  ${BOLD}Not removed:${NC}"
echo "    • Source code (${PROJECT_ROOT})"
echo "    • .env file"
echo "    • System packages (Node.js, PostgreSQL, Redis, Nginx)"
[[ "${drop_db,,}" != "y" ]] && echo "    • Database and user"
echo ""
echo -e "  To fully remove everything: ${CYAN}sudo rm -rf ${PROJECT_ROOT}${NC}"
echo ""
