#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────
#  NetMon — Bare-Metal Installation Script
#  Supports: Ubuntu/Debian, RHEL/Fedora/CentOS, macOS
#
#  Quick install:
#    curl -fsSL https://raw.githubusercontent.com/arramandhanu/bit-netmon/main/install.sh -o install.sh
#    chmod +x install.sh && sudo ./install.sh
#
#  Options:
#    --unattended     Non-interactive mode (use all defaults)
#    --version TAG    Install a specific git tag/branch
#    --nginx          Set up Nginx reverse proxy only
#    --help           Show help
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

# ─── Globals ─────────────────────────────────────────────
REPO_URL="https://github.com/arramandhanu/bit-netmon.git"
INSTALL_DIR=""
NODE_VERSION="20"
PG_VERSION="16"
OS=""
PKG_MANAGER=""
SUDO_CMD=""
NETMON_USER="${NETMON_USER:-netmon}"
API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-3001}"
INSTALL_PATH="${INSTALL_PATH:-/opt/netmon}"
UNATTENDED="${UNATTENDED:-false}"
VERSION_TAG="${VERSION_TAG:-main}"
GENERATED_DB_PASS=""
GENERATED_REDIS_PASS=""

# ─── Helpers ─────────────────────────────────────────────

banner() {
    echo ""
    echo -e "${CYAN}${BOLD}"
    echo "  ╔═══════════════════════════════════════════╗"
    echo "  ║        NetMon Installation Script         ║"
    echo "  ║        Network Monitoring Platform        ║"
    echo "  ╚═══════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
}

log()     { echo -e "  ${GREEN}✓${NC} $1"; }
warn()    { echo -e "  ${YELLOW}⚠${NC} $1"; }
error()   { echo -e "  ${RED}✗${NC} $1"; exit 1; }
info()    { echo -e "  ${BLUE}→${NC} $1"; }
section() { echo ""; echo -e "  ${BOLD}━━━ $1 ━━━${NC}"; echo ""; }

generate_secret() {
    local length="${1:-64}"
    openssl rand -base64 "$length" | tr -dc 'a-zA-Z0-9' | head -c "$length"
}

command_exists() {
    command -v "$1" &>/dev/null
}

# Detect the machine's primary LAN IP address
detect_local_ip() {
    local ip=""
    case "$OSTYPE" in
        darwin*)
            # macOS: get IP of the active network interface
            ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
            ;;
        *)
            # Linux: get the default route interface IP
            ip=$(ip -4 route get 8.8.8.8 2>/dev/null | awk '{print $7; exit}' || hostname -I 2>/dev/null | awk '{print $1}' || echo "")
            ;;
    esac

    # Fallback to localhost if detection fails
    if [[ -z "$ip" ]]; then
        ip="localhost"
    fi

    echo "$ip"
}

# ─── Spinner (for long-running tasks) ────────────────────

spinner() {
    local pid=$1
    local msg="${2:-Working...}"
    local spin='⣾⣽⣻⢿⡿⣟⣯⣷'
    local i=0

    while kill -0 "$pid" 2>/dev/null; do
        i=$(( (i + 1) % ${#spin} ))
        printf "\r  ${CYAN}%s${NC} %s" "${spin:$i:1}" "$msg"
        sleep 0.1
    done
    printf "\r\033[K"  # Clear the spinner line
    wait "$pid"
    return $?
}

run_with_spinner() {
    local msg="$1"
    shift
    "$@" &>/dev/null &
    local pid=$!
    spinner "$pid" "$msg"
}

# ─── System Resource Check ───────────────────────────────

check_resources() {
    section "System Resource Check"

    local min_ram_mb=1024
    local min_disk_gb=3
    local warnings=0

    # Check RAM
    local ram_mb=0
    if [[ "$OS" == "macos" ]]; then
        ram_mb=$(( $(sysctl -n hw.memsize) / 1024 / 1024 ))
    else
        ram_mb=$(awk '/MemTotal/ {printf "%.0f", $2/1024}' /proc/meminfo 2>/dev/null || echo 0)
    fi

    if [[ "$ram_mb" -gt 0 ]]; then
        if [[ "$ram_mb" -lt "$min_ram_mb" ]]; then
            warn "Low RAM: ${ram_mb}MB detected (recommended: ≥${min_ram_mb}MB)"
            warnings=$((warnings + 1))
        else
            log "RAM: ${ram_mb}MB ✓"
        fi
    fi

    # Check disk space
    local disk_gb=0
    if [[ "$OS" == "macos" ]]; then
        disk_gb=$(df -g / | awk 'NR==2 {print $4}')
    else
        disk_gb=$(df -BG / | awk 'NR==2 {gsub(/G/,""); print $4}')
    fi

    if [[ "$disk_gb" -lt "$min_disk_gb" ]]; then
        warn "Low disk space: ${disk_gb}GB available (recommended: ≥${min_disk_gb}GB)"
        warnings=$((warnings + 1))
    else
        log "Disk: ${disk_gb}GB available ✓"
    fi

    # Check CPU cores
    local cores=0
    if [[ "$OS" == "macos" ]]; then
        cores=$(sysctl -n hw.ncpu)
    else
        cores=$(nproc 2>/dev/null || echo 1)
    fi
    log "CPU: ${cores} cores ✓"

    if [[ "$warnings" -gt 0 ]] && [[ "$UNATTENDED" == "false" ]]; then
        echo ""
        read -rp "  Continue anyway? [Y/n] " response
        if [[ "${response,,}" == "n" ]]; then
            echo "  Installation cancelled."
            exit 0
        fi
    fi
}

# ─── OS Detection ────────────────────────────────────────

detect_os() {
    section "Detecting Operating System"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        PKG_MANAGER="brew"
        SUDO_CMD=""
        log "Detected macOS ($(sw_vers -productVersion))"
    elif [[ -f /etc/os-release ]]; then
        . /etc/os-release
        case "$ID" in
            ubuntu|debian|pop|linuxmint)
                OS="debian"
                PKG_MANAGER="apt"
                SUDO_CMD="sudo"
                log "Detected $PRETTY_NAME"
                ;;
            rhel|centos|rocky|almalinux|fedora)
                OS="rhel"
                if command_exists dnf; then
                    PKG_MANAGER="dnf"
                else
                    PKG_MANAGER="yum"
                fi
                SUDO_CMD="sudo"
                log "Detected $PRETTY_NAME"
                ;;
            *)
                error "Unsupported Linux distribution: $ID. Supported: Ubuntu, Debian, RHEL, CentOS, Fedora, Rocky"
                ;;
        esac
    else
        error "Unable to detect operating system"
    fi
}

# ─── Root Check ──────────────────────────────────────────

check_root() {
    if [[ "$OS" != "macos" ]] && [[ "$EUID" -ne 0 ]]; then
        error "This script must be run as root on Linux. Use: sudo ./install.sh"
    fi
}

# ─── System Prerequisites ────────────────────────────────

install_prerequisites() {
    section "System Prerequisites"

    case "$OS" in
        debian)
            $SUDO_CMD apt-get update -qq
            $SUDO_CMD apt-get install -y -qq curl wget git openssl build-essential python3 lsb-release gnupg2 ca-certificates
            ;;
        rhel)
            $SUDO_CMD $PKG_MANAGER install -y -q curl wget git openssl gcc gcc-c++ make python3 ca-certificates
            ;;
        macos)
            if ! command_exists git; then
                xcode-select --install 2>/dev/null || true
            fi
            if ! command_exists openssl; then
                brew install openssl
            fi
            ;;
    esac

    log "System prerequisites installed (curl, git, openssl, build tools)"
}

# ─── Clone or Detect Repo ────────────────────────────────

clone_or_detect_repo() {
    section "Project Setup"

    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)" || script_dir="$(pwd)"

    # Check if we're already inside the repo
    if [[ -f "${script_dir}/package.json" ]] && grep -q '"netmon"' "${script_dir}/package.json" 2>/dev/null; then
        INSTALL_DIR="$script_dir"
        log "Running from existing repo: ${INSTALL_DIR}"
        return
    fi

    # Downloaded standalone via curl — clone the repo
    info "Standalone install detected — cloning repository..."

    if [[ -d "${INSTALL_PATH}" ]] && [[ -f "${INSTALL_PATH}/package.json" ]]; then
        warn "Existing installation found at ${INSTALL_PATH}"
        info "Pulling latest changes..."
        cd "$INSTALL_PATH"
        git pull origin "$VERSION_TAG" 2>&1 | tail -1
    else
        info "Cloning to ${INSTALL_PATH}..."
        git clone --branch "$VERSION_TAG" "$REPO_URL" "$INSTALL_PATH"
    fi

    INSTALL_DIR="$INSTALL_PATH"
    log "Repository ready at ${INSTALL_DIR}"

    # Re-execute from the cloned repo
    info "Re-executing installer from cloned repo..."
    exec bash "${INSTALL_DIR}/install.sh" "$@"
}

# ─── Node.js ─────────────────────────────────────────────

install_nodejs() {
    section "Node.js ${NODE_VERSION}.x"

    if command_exists node; then
        local current_version
        current_version=$(node -v | sed 's/v//' | cut -d. -f1)
        if [[ "$current_version" -ge "$NODE_VERSION" ]]; then
            log "Node.js $(node -v) already installed — skipping"
            return
        fi
        warn "Node.js v${current_version} found but v${NODE_VERSION}+ required — upgrading"
    fi

    info "Installing Node.js ${NODE_VERSION}.x..."

    case "$OS" in
        debian)
            curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | $SUDO_CMD bash -
            $SUDO_CMD apt-get install -y nodejs
            ;;
        rhel)
            curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | $SUDO_CMD bash -
            $SUDO_CMD $PKG_MANAGER install -y nodejs
            ;;
        macos)
            if ! command_exists brew; then
                error "Homebrew is required on macOS. Install from https://brew.sh"
            fi
            brew install node@${NODE_VERSION}
            brew link --overwrite node@${NODE_VERSION} 2>/dev/null || true
            ;;
    esac

    log "Node.js $(node -v) installed"
    log "npm $(npm -v) installed"
}

# ─── PostgreSQL + TimescaleDB ────────────────────────────

install_postgresql() {
    section "PostgreSQL ${PG_VERSION} + TimescaleDB"

    if command_exists psql; then
        log "PostgreSQL already installed — skipping binary install"
    else
        info "Installing PostgreSQL ${PG_VERSION}..."

        case "$OS" in
            debian)
                echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | \
                    $SUDO_CMD tee /etc/apt/sources.list.d/pgdg.list >/dev/null
                wget -qO - https://www.postgresql.org/media/keys/ACCC4CF8.asc | \
                    $SUDO_CMD gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg 2>/dev/null || true
                $SUDO_CMD apt-get update -qq
                $SUDO_CMD apt-get install -y -qq postgresql-${PG_VERSION} postgresql-client-${PG_VERSION}
                ;;
            rhel)
                $SUDO_CMD $PKG_MANAGER install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-$(rpm -E %{rhel})-x86_64/pgdg-redhat-repo-latest.noarch.rpm || true
                $SUDO_CMD $PKG_MANAGER install -y postgresql${PG_VERSION}-server postgresql${PG_VERSION}
                $SUDO_CMD /usr/pgsql-${PG_VERSION}/bin/postgresql-${PG_VERSION}-setup initdb
                ;;
            macos)
                brew install postgresql@${PG_VERSION}
                brew services start postgresql@${PG_VERSION}
                ;;
        esac

        log "PostgreSQL ${PG_VERSION} installed"
    fi

    # Install TimescaleDB extension
    info "Installing TimescaleDB extension..."

    case "$OS" in
        debian)
            # Official packagecloud method: https://packagecloud.io/timescale/timescaledb/install
            $SUDO_CMD mkdir -p /etc/apt/keyrings
            curl -fsSL https://packagecloud.io/timescale/timescaledb/gpgkey | \
                $SUDO_CMD gpg --dearmor --yes -o /etc/apt/keyrings/timescale_timescaledb-archive-keyring.gpg
            echo "deb [signed-by=/etc/apt/keyrings/timescale_timescaledb-archive-keyring.gpg] https://packagecloud.io/timescale/timescaledb/ubuntu/ $(lsb_release -cs) main" | \
                $SUDO_CMD tee /etc/apt/sources.list.d/timescale_timescaledb.list >/dev/null
            $SUDO_CMD apt-get update -qq
            $SUDO_CMD apt-get install -y -qq timescaledb-2-postgresql-${PG_VERSION} || {
                warn "TimescaleDB package not found — install manually: https://docs.timescale.com/install"
            }
            ;;
        rhel)
            cat <<TSEOF | $SUDO_CMD tee /etc/yum.repos.d/timescale_timescaledb.repo >/dev/null
[timescale_timescaledb]
name=timescale_timescaledb
baseurl=https://packagecloud.io/timescale/timescaledb/el/$(rpm -E %{rhel})/\$basearch
gpgcheck=0
enabled=1
TSEOF
            $SUDO_CMD $PKG_MANAGER install -y timescaledb-2-postgresql-${PG_VERSION} || {
                warn "TimescaleDB package not found — install manually"
            }
            ;;
        macos)
            brew install timescaledb
            if command_exists timescaledb-tune; then
                timescaledb-tune --quiet --yes || true
            fi
            ;;
    esac

    # Enable TimescaleDB in postgresql.conf
    if [[ "$OS" != "macos" ]]; then
        local pg_conf
        pg_conf=$(find /etc/postgresql -name "postgresql.conf" 2>/dev/null | head -1)
        if [[ -z "$pg_conf" ]]; then
            pg_conf="/var/lib/pgsql/${PG_VERSION}/data/postgresql.conf"
        fi
        if [[ -f "$pg_conf" ]]; then
            if ! grep -q "timescaledb" "$pg_conf"; then
                echo "shared_preload_libraries = 'timescaledb'" | $SUDO_CMD tee -a "$pg_conf" >/dev/null
                log "TimescaleDB added to shared_preload_libraries"
            fi
        fi
    fi

    # Fix pg_hba.conf for password auth (RHEL defaults to ident)
    if [[ "$OS" == "rhel" ]]; then
        local pg_hba
        pg_hba=$(find /var/lib/pgsql -name "pg_hba.conf" 2>/dev/null | head -1)
        if [[ -n "$pg_hba" ]] && grep -q "ident" "$pg_hba"; then
            $SUDO_CMD sed -i 's/ident/md5/g' "$pg_hba"
            log "Updated pg_hba.conf to use md5 authentication"
        fi
    fi

    # Start/restart PostgreSQL
    case "$OS" in
        debian)
            $SUDO_CMD systemctl enable postgresql
            $SUDO_CMD systemctl restart postgresql
            ;;
        rhel)
            $SUDO_CMD systemctl enable postgresql-${PG_VERSION}
            $SUDO_CMD systemctl restart postgresql-${PG_VERSION}
            ;;
        macos)
            brew services restart postgresql@${PG_VERSION}
            ;;
    esac

    log "PostgreSQL + TimescaleDB configured"
}

# ─── Redis ───────────────────────────────────────────────

install_redis() {
    section "Redis"

    GENERATED_REDIS_PASS="$(generate_secret 32)"

    if command_exists redis-server; then
        log "Redis already installed — skipping binary install"
    else
        info "Installing Redis..."

        case "$OS" in
            debian)
                $SUDO_CMD apt-get install -y -qq redis-server
                ;;
            rhel)
                $SUDO_CMD $PKG_MANAGER install -y -q redis
                ;;
            macos)
                brew install redis
                ;;
        esac

        log "Redis installed"
    fi

    # Configure Redis password
    if [[ "$OS" != "macos" ]]; then
        local redis_conf
        redis_conf=$(find /etc -name "redis.conf" 2>/dev/null | head -1)
        if [[ -n "$redis_conf" ]]; then
            # Set password
            if grep -q "^# requirepass " "$redis_conf" || grep -q "^requirepass " "$redis_conf"; then
                $SUDO_CMD sed -i "s/^# requirepass .*/requirepass ${GENERATED_REDIS_PASS}/" "$redis_conf"
                $SUDO_CMD sed -i "s/^requirepass .*/requirepass ${GENERATED_REDIS_PASS}/" "$redis_conf"
            else
                echo "requirepass ${GENERATED_REDIS_PASS}" | $SUDO_CMD tee -a "$redis_conf" >/dev/null
            fi
            log "Redis password configured"
        fi
    fi

    # Start & enable Redis
    case "$OS" in
        debian|rhel)
            $SUDO_CMD systemctl enable redis-server 2>/dev/null || $SUDO_CMD systemctl enable redis 2>/dev/null || true
            $SUDO_CMD systemctl restart redis-server 2>/dev/null || $SUDO_CMD systemctl restart redis 2>/dev/null || true
            ;;
        macos)
            brew services start redis
            ;;
    esac

    log "Redis running (password-protected)"
}

# ─── Database Setup ──────────────────────────────────────

setup_database() {
    section "Database Configuration"

    local db_name="${POSTGRES_DB:-netmon}"
    local db_user="${POSTGRES_USER:-netmon}"
    local db_pass="${POSTGRES_PASSWORD:-$(generate_secret 32)}"

    GENERATED_DB_PASS="$db_pass"

    info "Creating database user and database..."

    case "$OS" in
        macos)
            psql postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='${db_user}'" | grep -q 1 || \
                createuser -s "$db_user" 2>/dev/null || true
            psql postgres -tc "SELECT 1 FROM pg_database WHERE datname='${db_name}'" | grep -q 1 || \
                createdb -O "$db_user" "$db_name" 2>/dev/null || true
            psql -d "$db_name" -c "ALTER USER ${db_user} WITH PASSWORD '${db_pass}';" 2>/dev/null || true
            psql -d "$db_name" -c "CREATE EXTENSION IF NOT EXISTS timescaledb;" 2>/dev/null || true
            ;;
        *)
            $SUDO_CMD -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${db_user}'" | grep -q 1 || \
                $SUDO_CMD -u postgres createuser -s "$db_user" 2>/dev/null || true
            $SUDO_CMD -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${db_name}'" | grep -q 1 || \
                $SUDO_CMD -u postgres createdb -O "$db_user" "$db_name" 2>/dev/null || true
            $SUDO_CMD -u postgres psql -d "$db_name" -c "ALTER USER ${db_user} WITH PASSWORD '${db_pass}';" 2>/dev/null || true
            $SUDO_CMD -u postgres psql -d "$db_name" -c "CREATE EXTENSION IF NOT EXISTS timescaledb;" 2>/dev/null || true
            ;;
    esac

    log "Database '${db_name}' ready (user: ${db_user})"
}

# ─── Environment File ───────────────────────────────────

generate_env() {
    section "Environment Configuration"

    local env_file="${INSTALL_DIR}/.env"
    local db_host="127.0.0.1"
    local db_name="${POSTGRES_DB:-netmon}"
    local db_user="${POSTGRES_USER:-netmon}"
    local db_pass="${GENERATED_DB_PASS:-$(generate_secret 32)}"
    local redis_host="127.0.0.1"
    local redis_port="6379"
    local redis_pass="${GENERATED_REDIS_PASS:-$(generate_secret 32)}"
    local jwt_secret
    local encryption_key
    local api_domain="${API_DOMAIN:-$(detect_local_ip)}"

    jwt_secret="$(generate_secret 64)"
    encryption_key="$(generate_secret 32)"

    if [[ -f "$env_file" ]]; then
        warn ".env file already exists — backing up to .env.backup"
        cp "$env_file" "${env_file}.backup.$(date +%s)"
    fi

    cat > "$env_file" <<EOF
# ─── NetMon Environment Configuration ───────────────────
# Generated on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ─────────────────────────────────────────────────────────

# Database
POSTGRES_USER=${db_user}
POSTGRES_PASSWORD=${db_pass}
POSTGRES_DB=${db_name}
POSTGRES_PORT=5432
DATABASE_URL=postgresql://${db_user}:${db_pass}@${db_host}:5432/${db_name}?schema=public

# Redis
REDIS_HOST=${redis_host}
REDIS_PORT=${redis_port}
REDIS_PASSWORD=${redis_pass}
REDIS_MAXMEMORY=512mb

# Application
NODE_ENV=production
API_PORT=${API_PORT}
WEB_PORT=${WEB_PORT}

# Security — auto-generated, keep these safe!
JWT_SECRET=${jwt_secret}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_KEY=${encryption_key}

# SNMP
SNMP_DEFAULT_TIMEOUT=5000
SNMP_DEFAULT_RETRIES=1
SNMP_POLLING_INTERVAL=300

# Logging
LOG_LEVEL=info

# Frontend URLs
NEXT_PUBLIC_API_URL=http://${api_domain}:${API_PORT}/api/v1
NEXT_PUBLIC_WS_URL=http://${api_domain}:${API_PORT}

# Notifications (optional)
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_CHAT_ID=
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
EOF

    chmod 600 "$env_file"
    log ".env file generated at ${env_file}"
    info "Database password: ${db_pass}"
    info "Redis password:    ${redis_pass}"
    warn "Save these credentials — they won't be shown again!"
}

# ─── Application Setup ──────────────────────────────────

setup_application() {
    section "Application Setup"

    cd "$INSTALL_DIR"

    info "Installing npm dependencies..."
    run_with_spinner "Installing npm dependencies..." npm install --production=false
    log "npm dependencies installed"

    info "Generating Prisma client..."
    if ! out=$(npm run db:generate 2>&1); then
        echo -e "\n  ${RED}Failed to generate Prisma client. Output:${NC}\n$out\n"
        error "Prisma client generation failed."
    fi
    log "Prisma client generated"

    info "Running database migrations..."
    if ! out=$(npm run db:migrate 2>&1); then
        # Check if failure is due to a previously failed migration (Prisma P3009)
        if echo "$out" | grep -q "P3009"; then
            warn "Detected a previously failed migration — attempting automatic recovery..."
            # Extract the failed migration name from the error output
            local failed_migration
            failed_migration=$(echo "$out" | grep -oP 'The `\K[^`]+(?=` migration .* failed)' || echo "")
            if [[ -z "$failed_migration" ]]; then
                # Fallback: try alternative pattern
                failed_migration=$(echo "$out" | sed -n 's/.*The `\([^`]*\)` migration .* failed.*/\1/p')
            fi
            if [[ -n "$failed_migration" ]]; then
                info "Resolving failed migration: ${failed_migration}..."
                if npx prisma migrate resolve --rolled-back "$failed_migration" --schema=packages/database/prisma/schema.prisma 2>&1; then
                    log "Migration '${failed_migration}' marked as rolled-back"
                    info "Retrying database migrations..."
                    if ! out=$(npm run db:migrate 2>&1); then
                        echo -e "\n  ${RED}Failed to run database migrations after recovery. Output:${NC}\n$out\n"
                        error "Database migration failed."
                    fi
                else
                    echo -e "\n  ${RED}Failed to resolve migration. Output:${NC}\n$out\n"
                    error "Database migration failed. Run manually: npx prisma migrate resolve --rolled-back ${failed_migration} --schema=packages/database/prisma/schema.prisma"
                fi
            else
                echo -e "\n  ${RED}Failed to run database migrations. Output:${NC}\n$out\n"
                error "Database migration failed. A previous migration failed — resolve it manually with: npx prisma migrate resolve --rolled-back <migration_name> --schema=packages/database/prisma/schema.prisma"
            fi
        else
            echo -e "\n  ${RED}Failed to run database migrations. Output:${NC}\n$out\n"
            error "Database migration failed."
        fi
    fi
    log "Database migrations applied"

    info "Seeding database with default admin user..."
    if ! out=$(npx prisma db seed --schema=packages/database/prisma/schema.prisma 2>&1); then
        warn "Seeding skipped or failed — you may need to create an admin user manually."
        echo -e "  ${DIM}Seed output:\n$out${NC}"
    else
        log "Database seeded (default: admin / admin)"
    fi

    info "Building production assets (this may take a few minutes)..."
    run_with_spinner "Building production assets..." npm run build
    log "Production build complete"
}

# ─── Firewall Rules ─────────────────────────────────────

setup_firewall() {
    section "Firewall Configuration"

    if [[ "$OS" == "macos" ]]; then
        log "macOS — firewall managed via System Preferences, skipping"
        return
    fi

    if command_exists ufw; then
        info "Configuring UFW firewall..."
        $SUDO_CMD ufw allow "${API_PORT}/tcp" comment "NetMon API" 2>/dev/null || true
        $SUDO_CMD ufw allow "${WEB_PORT}/tcp" comment "NetMon Web" 2>/dev/null || true
        $SUDO_CMD ufw allow 80/tcp comment "HTTP" 2>/dev/null || true
        $SUDO_CMD ufw allow 443/tcp comment "HTTPS" 2>/dev/null || true

        # Enable UFW if not active
        if ! $SUDO_CMD ufw status | grep -q "Status: active"; then
            if [[ "$UNATTENDED" == "true" ]]; then
                echo "y" | $SUDO_CMD ufw enable 2>/dev/null || true
            else
                info "Enable UFW firewall? (required for rules to take effect)"
                $SUDO_CMD ufw enable || true
            fi
        fi
        log "UFW: ports ${API_PORT}, ${WEB_PORT}, 80, 443 opened"

    elif command_exists firewall-cmd; then
        info "Configuring firewalld..."
        $SUDO_CMD firewall-cmd --permanent --add-port="${API_PORT}/tcp" 2>/dev/null || true
        $SUDO_CMD firewall-cmd --permanent --add-port="${WEB_PORT}/tcp" 2>/dev/null || true
        $SUDO_CMD firewall-cmd --permanent --add-service=http 2>/dev/null || true
        $SUDO_CMD firewall-cmd --permanent --add-service=https 2>/dev/null || true
        $SUDO_CMD firewall-cmd --reload 2>/dev/null || true
        log "firewalld: ports ${API_PORT}, ${WEB_PORT}, 80, 443 opened"

    else
        warn "No firewall detected (ufw/firewalld) — ensure ports ${API_PORT}, ${WEB_PORT} are accessible"
    fi
}

# ─── Systemd Services ───────────────────────────────────

setup_systemd() {
    section "Systemd Services"

    if [[ "$OS" == "macos" ]]; then
        setup_launchd
        return
    fi

    local service_dir="/etc/systemd/system"
    local run_user="${SUDO_USER:-root}"
    local node_path
    node_path="$(which node)"

    # API Service
    cat > "${service_dir}/netmon-api.service" <<EOF
[Unit]
Description=NetMon API Server
Documentation=https://github.com/arramandhanu/bit-netmon
After=network.target postgresql.service redis.service
Requires=postgresql.service redis.service

[Service]
Type=simple
User=${run_user}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=${node_path} apps/api/dist/main.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=netmon-api

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${INSTALL_DIR}
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

    # Web Service
    cat > "${service_dir}/netmon-web.service" <<EOF
[Unit]
Description=NetMon Web Frontend
Documentation=https://github.com/arramandhanu/bit-netmon
After=network.target netmon-api.service

[Service]
Type=simple
User=${run_user}
WorkingDirectory=${INSTALL_DIR}/apps/web
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=${node_path} ${INSTALL_DIR}/node_modules/.bin/next start -H 0.0.0.0 -p \${WEB_PORT:-3001}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=netmon-web

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${INSTALL_DIR}
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

    # Reload and enable
    systemctl daemon-reload
    systemctl enable netmon-api netmon-web
    systemctl start netmon-api
    sleep 3
    systemctl start netmon-web

    log "netmon-api.service — enabled & started"
    log "netmon-web.service — enabled & started"
}

# ─── macOS LaunchDaemons ─────────────────────────────────

setup_launchd() {
    section "macOS LaunchDaemons"

    local plist_dir="/Library/LaunchDaemons"
    local node_path
    node_path="$(which node)"
    local run_user="${USER}"

    # API plist
    cat > "${plist_dir}/com.netmon.api.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.netmon.api</string>
    <key>ProgramArguments</key>
    <array>
        <string>${node_path}</string>
        <string>${INSTALL_DIR}/apps/api/dist/main.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${INSTALL_DIR}</string>
    <key>UserName</key>
    <string>${run_user}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/netmon-api.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/netmon-api-error.log</string>
</dict>
</plist>
EOF

    # Web plist
    cat > "${plist_dir}/com.netmon.web.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.netmon.web</string>
    <key>ProgramArguments</key>
    <array>
        <string>${node_path}</string>
        <string>${INSTALL_DIR}/node_modules/.bin/next</string>
        <string>start</string>
        <string>-p</string>
        <string>${WEB_PORT}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${INSTALL_DIR}/apps/web</string>
    <key>UserName</key>
    <string>${run_user}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/netmon-web.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/netmon-web-error.log</string>
</dict>
</plist>
EOF

    # Load services
    sudo launchctl load "${plist_dir}/com.netmon.api.plist" 2>/dev/null || true
    sleep 3
    sudo launchctl load "${plist_dir}/com.netmon.web.plist" 2>/dev/null || true

    log "com.netmon.api — loaded & running"
    log "com.netmon.web — loaded & running"
    info "Manage: sudo launchctl list | grep netmon"
    info "Logs:   tail -f /var/log/netmon-api.log"
}

# ─── Log Rotation ────────────────────────────────────────

setup_logrotate() {
    section "Log Rotation"

    if [[ "$OS" == "macos" ]]; then
        log "macOS uses newsyslog — log rotation handled automatically"
        return
    fi

    if ! command_exists logrotate; then
        info "Installing logrotate..."
        case "$OS" in
            debian) $SUDO_CMD apt-get install -y -qq logrotate ;;
            rhel)   $SUDO_CMD $PKG_MANAGER install -y -q logrotate ;;
        esac
    fi

    cat > /etc/logrotate.d/netmon <<EOF
/var/log/netmon-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        systemctl restart netmon-api netmon-web >/dev/null 2>&1 || true
    endscript
}
EOF

    log "Log rotation configured (14 days, compressed)"
}

# ─── Watchdog Healthcheck Cron ───────────────────────────

setup_watchdog() {
    section "Watchdog Healthcheck"

    if [[ "$OS" == "macos" ]]; then
        warn "macOS LaunchDaemons have built-in KeepAlive — skipping cron watchdog"
        return
    fi

    local watchdog_script="${INSTALL_DIR}/scripts/watchdog.sh"

    cat > "$watchdog_script" <<'WATCHDOG'
#!/usr/bin/env bash
# NetMon Watchdog — auto-restart crashed services
# Runs every 5 minutes via cron

API_URL="http://localhost:${API_PORT:-3000}/api/v1/health"
LOG="/var/log/netmon-watchdog.log"

check_and_restart() {
    local service="$1"
    if ! systemctl is-active "$service" &>/dev/null; then
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] WARN: $service is down — restarting..." >> "$LOG"
        systemctl restart "$service"
        sleep 5
        if systemctl is-active "$service" &>/dev/null; then
            echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] OK: $service restarted successfully" >> "$LOG"
        else
            echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ERROR: $service failed to restart" >> "$LOG"
        fi
    fi
}

check_and_restart netmon-api
check_and_restart netmon-web

# Optional: check HTTP health
if command -v curl &>/dev/null; then
    if ! curl -sf "$API_URL" &>/dev/null; then
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] WARN: API health check failed — restarting..." >> "$LOG"
        systemctl restart netmon-api
    fi
fi
WATCHDOG

    chmod +x "$watchdog_script"

    # Add cron job (every 5 minutes)
    local cron_entry="*/5 * * * * ${watchdog_script}"
    (crontab -l 2>/dev/null | grep -v "netmon.*watchdog" ; echo "$cron_entry") | crontab -

    log "Watchdog cron installed (every 5 minutes)"
    info "Log: /var/log/netmon-watchdog.log"
}

# ─── Health Check ────────────────────────────────────────

verify_health() {
    section "Health Check"

    info "Waiting for services to start..."
    local max_retries=15
    local retry=0

    while [[ $retry -lt $max_retries ]]; do
        if curl -sf "http://localhost:${API_PORT}/api/v1/health" &>/dev/null; then
            log "API health check passed ✓"
            break
        fi
        retry=$((retry + 1))
        sleep 2
    done

    if [[ $retry -ge $max_retries ]]; then
        warn "API not responding on port ${API_PORT} — it may still be starting"
        info "Check logs: sudo journalctl -u netmon-api -f"
    fi

    # Check web
    retry=0
    while [[ $retry -lt 10 ]]; do
        if curl -sf "http://localhost:${WEB_PORT}" &>/dev/null; then
            log "Web UI health check passed ✓"
            break
        fi
        retry=$((retry + 1))
        sleep 2
    done

    if [[ $retry -ge 10 ]]; then
        warn "Web UI not responding on port ${WEB_PORT} — it may still be starting"
        info "Check logs: sudo journalctl -u netmon-web -f"
    fi
}

# ─── Nginx (Optional) ───────────────────────────────────

setup_nginx() {
    section "Nginx Reverse Proxy (Optional)"

    local domain="${API_DOMAIN:-}"

    if [[ -z "$domain" ]]; then
        warn "No API_DOMAIN set — skipping Nginx setup"
        info "To set up later: API_DOMAIN=your-domain.com sudo ./install.sh --nginx"
        return
    fi

    if ! command_exists nginx; then
        info "Installing Nginx..."
        case "$OS" in
            debian) $SUDO_CMD apt-get install -y -qq nginx ;;
            rhel)   $SUDO_CMD $PKG_MANAGER install -y -q nginx ;;
            macos)  brew install nginx ;;
        esac
    fi

    local nginx_conf
    case "$OS" in
        debian) nginx_conf="/etc/nginx/sites-available/netmon" ;;
        rhel)   nginx_conf="/etc/nginx/conf.d/netmon.conf" ;;
        macos)  nginx_conf="/usr/local/etc/nginx/servers/netmon.conf" ;;
    esac

    cat > "$nginx_conf" <<EOF
# NetMon — Nginx Reverse Proxy
# Generated by install.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")

upstream netmon_api {
    server 127.0.0.1:${API_PORT};
}

upstream netmon_web {
    server 127.0.0.1:${WEB_PORT};
}

server {
    listen 80;
    server_name ${domain};

    # ─── API ─────────────────────────
    location /api/ {
        proxy_pass http://netmon_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }

    # ─── WebSocket ───────────────────
    location /socket.io/ {
        proxy_pass http://netmon_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # ─── Web Frontend ────────────────
    location / {
        proxy_pass http://netmon_web;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    # Enable site (Debian)
    if [[ "$OS" == "debian" ]]; then
        ln -sf "$nginx_conf" /etc/nginx/sites-enabled/netmon
        rm -f /etc/nginx/sites-enabled/default
    fi

    nginx -t 2>&1 && {
        case "$OS" in
            debian|rhel)
                $SUDO_CMD systemctl enable nginx
                $SUDO_CMD systemctl reload nginx
                ;;
            macos) brew services restart nginx ;;
        esac
        log "Nginx configured for ${domain}"
    } || {
        warn "Nginx config has errors — check: nginx -t"
    }

    # Auto SSL with certbot
    setup_ssl "$domain"
}

# ─── SSL Auto-Setup ─────────────────────────────────────

setup_ssl() {
    local domain="$1"

    if [[ -z "$domain" || "$domain" == "localhost" ]]; then
        return
    fi

    # Check if cert already exists
    if [[ -d "/etc/letsencrypt/live/${domain}" ]]; then
        log "SSL certificate already exists for ${domain}"
        return
    fi

    if [[ "$UNATTENDED" == "false" ]]; then
        echo ""
        read -rp "  Set up free SSL certificate with Let's Encrypt for ${domain}? [Y/n] " ssl_response
        if [[ "${ssl_response,,}" == "n" ]]; then
            info "Skipping SSL — set up later: sudo certbot --nginx -d ${domain}"
            return
        fi
    fi

    # Install certbot
    if ! command_exists certbot; then
        info "Installing Certbot..."
        case "$OS" in
            debian)
                $SUDO_CMD apt-get install -y -qq certbot python3-certbot-nginx
                ;;
            rhel)
                $SUDO_CMD $PKG_MANAGER install -y -q certbot python3-certbot-nginx
                ;;
            macos)
                brew install certbot
                ;;
        esac
    fi

    # Run certbot
    info "Obtaining SSL certificate for ${domain}..."
    if [[ "$UNATTENDED" == "true" ]]; then
        $SUDO_CMD certbot --nginx -d "$domain" --non-interactive --agree-tos --register-unsafely-without-email 2>&1 | tail -3 || {
            warn "Certbot failed — set up SSL manually: sudo certbot --nginx -d ${domain}"
        }
    else
        $SUDO_CMD certbot --nginx -d "$domain" || {
            warn "Certbot failed — set up SSL manually later"
        }
    fi

    # Auto-renewal cron
    if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
        (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -
        log "SSL auto-renewal cron configured (daily at 3am)"
    fi
}

# ─── Summary ─────────────────────────────────────────────

print_summary() {
    echo ""
    echo -e "${GREEN}${BOLD}"
    echo "  ╔═══════════════════════════════════════════╗"
    echo "  ║       Installation Complete! 🎉           ║"
    echo "  ╚═══════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo -e "  ${BOLD}Access your NetMon instance:${NC}"
    echo ""
    echo -e "  ${CYAN}Web UI:${NC}      http://localhost:${WEB_PORT}"
    echo -e "  ${CYAN}API:${NC}         http://localhost:${API_PORT}/api/v1"
    echo ""
    echo -e "  ${BOLD}Default Login:${NC}"
    echo -e "  ${CYAN}Admin:${NC}       admin / admin"
    echo ""
    echo -e "  ${BOLD}Generated Credentials:${NC}"
    echo -e "  ${CYAN}DB Password:${NC}    ${GENERATED_DB_PASS}"
    echo -e "  ${CYAN}Redis Password:${NC} ${GENERATED_REDIS_PASS}"
    echo ""
    echo -e "  ${BOLD}Useful Commands:${NC}"
    echo ""

    if [[ "$OS" != "macos" ]]; then
        echo -e "  ${CYAN}Status:${NC}      sudo systemctl status netmon-api netmon-web"
        echo -e "  ${CYAN}Logs:${NC}        sudo journalctl -u netmon-api -f"
        echo -e "  ${CYAN}Restart:${NC}     sudo systemctl restart netmon-api netmon-web"
    else
        echo -e "  ${CYAN}Status:${NC}      sudo launchctl list | grep netmon"
        echo -e "  ${CYAN}Logs:${NC}        tail -f /var/log/netmon-api.log"
        echo -e "  ${CYAN}Restart:${NC}     sudo launchctl kickstart -k system/com.netmon.api"
    fi

    echo -e "  ${CYAN}Update:${NC}      sudo ./scripts/update.sh"
    echo -e "  ${CYAN}Uninstall:${NC}   sudo ./scripts/uninstall.sh"
    echo ""
    echo -e "  ${BOLD}Config:${NC}      ${INSTALL_DIR}/.env"
    echo ""
    echo -e "  ${YELLOW}⚠ Change the default admin password immediately after login!${NC}"
    echo ""
}

# ─── Main ────────────────────────────────────────────────

main() {
    banner
    detect_os
    check_root
    clone_or_detect_repo "$@"
    check_resources
    install_prerequisites
    install_nodejs
    install_postgresql
    install_redis
    setup_database
    generate_env
    setup_application
    setup_firewall
    setup_systemd
    setup_logrotate
    setup_watchdog
    setup_nginx
    verify_health
    print_summary
}

# ─── Parse Arguments ─────────────────────────────────────

while [[ $# -gt 0 ]]; do
    case "$1" in
        --unattended)
            UNATTENDED="true"
            shift
            ;;
        --version)
            VERSION_TAG="${2:-main}"
            shift 2
            ;;
        --nginx)
            detect_os
            # Set INSTALL_DIR for nginx-only mode
            INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
            setup_nginx
            exit 0
            ;;
        --help|-h)
            echo ""
            echo "  Usage: sudo ./install.sh [OPTIONS]"
            echo ""
            echo "  Options:"
            echo "    --unattended      Non-interactive mode, accept all defaults"
            echo "    --version TAG     Install a specific git tag/branch (default: main)"
            echo "    --nginx           Set up Nginx reverse proxy only"
            echo "    --help            Show this help"
            echo ""
            echo "  Environment variables:"
            echo "    API_DOMAIN          Domain for Nginx + SSL (e.g. netmon.example.com)"
            echo "    API_PORT            API port (default: 3000)"
            echo "    WEB_PORT            Web port (default: 3001)"
            echo "    INSTALL_PATH        Installation directory (default: /opt/netmon)"
            echo "    POSTGRES_USER       DB user (default: netmon)"
            echo "    POSTGRES_PASSWORD   DB password (auto-generated if empty)"
            echo "    POSTGRES_DB         DB name (default: netmon)"
            echo ""
            echo "  Examples:"
            echo "    sudo ./install.sh                              # Interactive install"
            echo "    sudo ./install.sh --unattended                 # Fully automatic"
            echo "    sudo ./install.sh --version v1.0.0             # Install specific version"
            echo "    API_DOMAIN=netmon.example.com sudo ./install.sh # With Nginx + SSL"
            echo ""
            exit 0
            ;;
        *)
            warn "Unknown option: $1"
            shift
            ;;
    esac
done

main
