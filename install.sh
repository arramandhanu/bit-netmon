#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────
#  NetMon — Bare-Metal Installation Script
#  Supports: Ubuntu/Debian, RHEL/Fedora/CentOS, macOS
#
#  Features:
#  - Pre-flight checks (ports, disk, services)
#  - SNMP native dependencies
#  - Dynamic service names
#  - Database tuning (TimescaleDB, WAL)
#  - Prisma validate before migrate
#  - Verbose and log file options
#  - Improved error handling
#
#  Quick install:
#    chmod +x install.sh && sudo ./install.sh
#
#  Options:
#    --unattended     Non-interactive mode (use all defaults)
#    --version TAG    Install a specific git tag/branch
#    --nginx          Set up Nginx reverse proxy only
#    --verbose        Enable verbose output
#    --log-file FILE  Write logs to file
#    --skip-ssl       Skip SSL certificate setup
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
VERBOSE="${VERBOSE:-false}"
LOG_FILE=""
SKIP_SSL="${SKIP_SSL:-false}"
GENERATED_DB_PASS=""
GENERATED_REDIS_PASS=""
POSTGRES_SERVICE=""
REDIS_SERVICE=""

# ─── Root Check ───────────────────────────────────────────

check_root() {
    if [[ "$OS" != "macos" ]] && [[ "$EUID" -ne 0 ]]; then
        error "This script must be run as root on Linux. Use: sudo ./install.sh"
    fi
}

# ─── Helpers ─────────────────────────────────────────────

banner() {
    echo ""
    echo -e "${CYAN}${BOLD}"
    echo "  ╔═══════════════════════════════════════════════════╗"
    echo "  ║     NetMon Installation Script                   ║"
    echo "  ║        Network Monitoring Platform               ║"
    echo "  ╚═══════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
}

log()     { echo -e "  ${GREEN}✓${NC} $1"; }
warn()    { echo -e "  ${YELLOW}⚠${NC} $1"; }
error()   { echo -e "  ${RED}✗${NC} $1" | tee -a "$LOG_FILE" 2>/dev/null; exit 1; }
info()    { echo -e "  ${BLUE}→${NC} $1"; }
section() { echo ""; echo -e "  ${BOLD}━━━ $1 ━━━${NC}" | tee -a "$LOG_FILE" 2>/dev/null; echo ""; }
verbose() { [[ "$VERBOSE" == "true" ]] && echo -e "  ${DIM}$1${NC}"; }

log_to_file() {
    if [[ -n "$LOG_FILE" ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
    fi
}

generate_secret() {
    local length="${1:-64}"
    openssl rand -base64 "$length" | tr -dc 'a-zA-Z0-9' | head -c "$length"
}

command_exists() {
    command -v "$1" &>/dev/null
}

detect_local_ip() {
    local ip=""
    case "$OSTYPE" in
        darwin*)
            ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
            ;;
        *)
            ip=$(ip -4 route get 8.8.8.8 2>/dev/null | awk '{print $7; exit}' || hostname -I 2>/dev/null | awk '{print $1}' || echo "")
            ;;
    esac
    echo "${ip:-localhost}"
}

# ─── Spinner ─────────────────────────────────────────────

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
    printf "\r\033[K"
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

# ─── Pre-flight Checks ────────────────────────────────────

preflight_checks() {
    section "Pre-flight Checks"

    # Check root
    if [[ "$OS" != "macos" ]] && [[ "$EUID" -ne 0 ]]; then
        error "This script must be run as root on Linux. Use: sudo ./install.sh"
    fi

    # Check required commands
    local missing_cmds=()
    for cmd in curl wget git openssl; do
        if ! command_exists "$cmd"; then
            missing_cmds+=("$cmd")
        fi
    done

    if [[ ${#missing_cmds[@]} -gt 0 ]]; then
        warn "Missing commands: ${missing_cmds[*]}"
        info "Installing missing prerequisites..."
        install_prerequisites
    fi

    # Check ports
    info "Checking port availability..."
    local ports=("$API_PORT" "$WEB_PORT" "5432" "6379")
    local port_conflicts=()
    for port in "${ports[@]}"; do
        if command_exists lsof; then
            if lsof -i ":$port" &>/dev/null; then
                port_conflicts+=("$port")
            fi
        elif command_exists ss; then
            if ss -tuln 2>/dev/null | grep -q ":$port "; then
                port_conflicts+=("$port")
            fi
        fi
    done

    if [[ ${#port_conflicts[@]} -gt 0 ]]; then
        warn "Ports in use: ${port_conflicts[*]}"
        if [[ "$UNATTENDED" == "false" ]]; then
            echo "  Continue anyway? [Y/n]"
            read -r response
            if [[ "${response,,}" == "n" ]]; then
                error "Installation cancelled"
            fi
        fi
    else
        log "All required ports available ✓"
    fi

    # Check disk space (minimum 5GB)
    local min_disk_gb=5
    local disk_gb=0
    if [[ "$OS" == "macos" ]]; then
        disk_gb=$(df -g / | awk 'NR==2 {print $4}')
    else
        disk_gb=$(df -BG / | awk 'NR==2 {gsub(/G/,""); print $4}')
    fi

    if [[ "$disk_gb" -lt "$min_disk_gb" ]]; then
        warn "Low disk space: ${disk_gb}GB (recommended: ≥${min_disk_gb}GB)"
    else
        log "Disk space: ${disk_gb}GB available ✓"
    fi

    # Detect existing services
    detect_services
    log "Pre-flight checks complete ✓"
}

detect_services() {
    case "$OS" in
        debian)
            if command_exists systemctl; then
                if systemctl list-units --type=service | grep -q "postgresql.*\.service"; then
                    POSTGRES_SERVICE="postgresql"
                else
                    POSTGRES_SERVICE="postgresql-${PG_VERSION}"
                fi
                if systemctl list-units --type=service | grep -q "redis.*\.service"; then
                    REDIS_SERVICE="redis-server" || REDIS_SERVICE="redis"
                fi
            fi
            ;;
        rhel)
            POSTGRES_SERVICE="postgresql-${PG_VERSION}"
            REDIS_SERVICE="redis"
            ;;
        macos)
            POSTGRES_SERVICE="postgresql@${PG_VERSION}"
            REDIS_SERVICE="redis"
            ;;
        *)
            POSTGRES_SERVICE="postgresql"
            REDIS_SERVICE="redis"
            ;;
    esac
    verbose "Detected PostgreSQL service: $POSTGRES_SERVICE"
    verbose "Detected Redis service: $REDIS_SERVICE"
}

# ─── System Resource Check ───────────────────────────────

check_resources() {
    section "System Resource Check"

    local min_ram_mb=1024
    local min_disk_gb=3
    local warnings=0

    local ram_mb=0
    if [[ "$OS" == "macos" ]]; then
        ram_mb=$(( $(sysctl -n hw.memsize) / 1024 / 1024 ))
    else
        ram_mb=$(awk '/MemTotal/ {printf "%.0f", $2/1024}' /proc/meminfo 2>/dev/null || echo 0)
    fi

    if [[ "$ram_mb" -gt 0 ]]; then
        if [[ "$ram_mb" -lt "$min_ram_mb" ]]; then
            warn "Low RAM: ${ram_mb}MB (recommended: ≥${min_ram_mb}MB)"
            warnings=$((warnings + 1))
        else
            log "RAM: ${ram_mb}MB ✓"
        fi
    fi

    local disk_gb=0
    if [[ "$OS" == "macos" ]]; then
        disk_gb=$(df -g / | awk 'NR==2 {print $4}')
    else
        disk_gb=$(df -BG / | awk 'NR==2 {gsub(/G/,""); print $4}')
    fi

    if [[ "$disk_gb" -lt "$min_disk_gb" ]]; then
        warn "Low disk space: ${disk_gb}GB (recommended: ≥${min_disk_gb}GB)"
        warnings=$((warnings + 1))
    else
        log "Disk: ${disk_gb}GB available ✓"
    fi

    local cores=0
    if [[ "$OS" == "macos" ]]; then
        cores=$(sysctl -n hw.ncpu)
    else
        cores=$(nproc 2>/dev/null || echo 1)
    fi
    log "CPU: ${cores} cores ✓"

    if [[ "$warnings" -gt 0 ]] && [[ "$UNATTENDED" == "false" ]]; then
        read -rp "  Continue anyway? [Y/n] " response
        if [[ "${response,,}" == "n" ]]; then
            error "Installation cancelled"
        fi
    fi
}

# ─── OS Detection ────────────────────────────────────────

detect_os() {
    section "Detecting Operating System"

    if [[ -n "$OS" ]] && [[ "$OS" != "" ]]; then
        log "OS already detected: $OS"
        return 0
    fi

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
                warn "Could not detect OS from /etc/os-release (ID=$ID)"
                OS="debian"
                PKG_MANAGER="apt"
                SUDO_CMD="sudo"
                log "Assuming Debian-based Linux"
                ;;
        esac
    else
        warn "/etc/os-release not found, assuming Debian"
        OS="debian"
        PKG_MANAGER="apt"
        SUDO_CMD="sudo"
    fi
}

# ─── System Prerequisites ────────────────────────────────

install_prerequisites() {
    section "System Prerequisites"

    case "$OS" in
        debian)
            $SUDO_CMD apt-get update -qq
            $SUDO_CMD apt-get install -y -qq curl wget git openssl build-essential python3 lsb-release gnupg2 ca-certificates libsnmp-dev
            ;;
        rhel)
            $SUDO_CMD $PKG_MANAGER install -y -q curl wget git openssl gcc gcc-c++ make python3 ca-certificates net-snmp-devel
            ;;
        macos)
            if ! command_exists git; then
                xcode-select --install 2>/dev/null || true
            fi
            if ! command_exists openssl; then
                brew install openssl
            fi
            if ! command_exists snmpget; then
                brew install net-snmp
            fi
            ;;
    esac

    log "System prerequisites installed (curl, git, openssl, build tools, SNMP)"
}

# ─── Clone or Detect Repo ───────────────────────────────

clone_or_detect_repo() {
    section "Project Setup"

    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)" || script_dir="$(pwd)"

    if [[ -f "${script_dir}/package.json" ]] && grep -q '"netmon"' "${script_dir}/package.json" 2>/dev/null; then
        INSTALL_DIR="$script_dir"
        log "Running from existing repo: ${INSTALL_DIR}"
        return
    fi

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

    info "Installing TimescaleDB extension..."

    case "$OS" in
        debian)
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
            if ! grep -q "timescaledb.telemetry_level" "$pg_conf"; then
                echo "timescaledb.telemetry_level = 'off'" | $SUDO_CMD tee -a "$pg_conf" >/dev/null
                log "TimescaleDB telemetry disabled"
            fi
            if ! grep -q "max_wal_size" "$pg_conf"; then
                echo "max_wal_size = '1GB'" | $SUDO_CMD tee -a "$pg_conf" >/dev/null
                log "WAL size tuned for hypertables"
            fi
        fi
    fi

    if [[ "$OS" == "rhel" ]]; then
        local pg_hba
        pg_hba=$(find /var/lib/pgsql -name "pg_hba.conf" 2>/dev/null | head -1)
        if [[ -n "$pg_hba" ]] && grep -q "ident" "$pg_hba"; then
            $SUDO_CMD sed -i 's/ident/md5/g' "$pg_hba"
            log "Updated pg_hba.conf to use md5 authentication"
        fi
    fi

    case "$OS" in
        debian)
            $SUDO_CMD systemctl enable postgresql
            $SUDO_CMD systemctl restart postgresql
            ;;
        rhel)
            $SUDO_CMD systemctl enable ${POSTGRES_SERVICE}
            $SUDO_CMD systemctl restart ${POSTGRES_SERVICE}
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

    if [[ "$OS" != "macos" ]]; then
        local redis_conf
        redis_conf=$(find /etc -name "redis.conf" 2>/dev/null | head -1)
        if [[ -n "$redis_conf" ]]; then
            if grep -q "^# requirepass " "$redis_conf" || grep -q "^requirepass " "$redis_conf"; then
                $SUDO_CMD sed -i "s/^# requirepass .*/requirepass ${GENERATED_REDIS_PASS}/" "$redis_conf"
                $SUDO_CMD sed -i "s/^requirepass .*/requirepass ${GENERATED_REDIS_PASS}/" "$redis_conf"
            else
                echo "requirepass ${GENERATED_REDIS_PASS}" | $SUDO_CMD tee -a "$redis_conf" >/dev/null
            fi
            log "Redis password configured"
        fi
    fi

    case "$OS" in
        debian|rhel)
            $SUDO_CMD systemctl enable ${REDIS_SERVICE} 2>/dev/null || true
            $SUDO_CMD systemctl restart ${REDIS_SERVICE} 2>/dev/null || true
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

# ─── Environment File ────────────────────────────────────

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

    local db_name="${POSTGRES_DB:-netmon}"
    local db_user="${POSTGRES_USER:-netmon}"
    local db_pass="${GENERATED_DB_PASS:-${POSTGRES_PASSWORD:-}}"

    info "Checking for stale migration state..."
    local run_psql=""
    case "$OS" in
        macos)
            run_psql="psql -d $db_name"
            ;;
        *)
            run_psql="PGPASSWORD=$db_pass psql -U $db_user -h 127.0.0.1 -d $db_name"
            ;;
    esac

    local has_failed=""
    has_failed=$(eval "$run_psql -tAc \"
        SELECT count(*) FROM information_schema.tables
        WHERE table_name = '_prisma_migrations'
    \"" 2>/dev/null || echo "0")

    if [[ "$has_failed" == "1" ]]; then
        local bad_rows
        bad_rows=$(eval "$run_psql -tAc \"
            SELECT count(*) FROM _prisma_migrations
            WHERE finished_at IS NULL
               OR rolled_back_at IS NOT NULL
               OR logs IS NOT NULL
        \"" 2>/dev/null || echo "0")

        if [[ "$bad_rows" -gt 0 ]]; then
            warn "Found ${bad_rows} failed/stale migration entries — cleaning up..."
            eval "$run_psql -c 'DROP TABLE IF EXISTS _prisma_migrations;'" 2>/dev/null || true
            log "Stale migration state cleared"
        else
            log "Migration state is clean"
        fi
    else
        log "Fresh database — no migration history yet"
    fi

    local has_wrong_cols=""
    has_wrong_cols=$(eval "$run_psql -tAc \"
        SELECT count(*) FROM information_schema.columns
        WHERE table_name = 'device_metrics' AND column_name = 'cpu_usage'
    \"" 2>/dev/null || echo "0")

    if [[ "$has_wrong_cols" == "1" ]]; then
        warn "Found device_metrics with wrong column names — dropping old tables..."
        eval "$run_psql -c '
            DROP MATERIALIZED VIEW IF EXISTS device_metrics_hourly CASCADE;
            DROP MATERIALIZED VIEW IF EXISTS device_metrics_daily CASCADE;
            DROP MATERIALIZED VIEW IF EXISTS interface_metrics_hourly CASCADE;
            DROP MATERIALIZED VIEW IF EXISTS interface_metrics_daily CASCADE;
            DROP TABLE IF EXISTS device_metrics CASCADE;
            DROP TABLE IF EXISTS interface_metrics CASCADE;
            DROP TABLE IF EXISTS wireless_metrics CASCADE;
        '" 2>/dev/null || true
        log "Old hypertable objects removed"
    fi

    info "Validating Prisma schema..."
    if ! out=$(npx prisma validate --schema=packages/database/prisma/schema.prisma 2>&1); then
        warn "Prisma schema validation warnings: $out"
    else
        log "Prisma schema valid ✓"
    fi

    info "Running database migrations..."
    local migrate_attempts=0
    local migrate_max=5
    local migrate_ok=false

    while [[ "$migrate_attempts" -lt "$migrate_max" ]]; do
        migrate_attempts=$((migrate_attempts + 1))

        if out=$(npm run db:migrate 2>&1); then
            migrate_ok=true
            break
        fi

        if echo "$out" | grep -q "P3009"; then
            warn "Failed migration detected (attempt ${migrate_attempts}/${migrate_max})..."
            local failed_migration
            failed_migration=$(echo "$out" | grep -oP 'The `\K[^`]+(?=` migration .* failed)' 2>/dev/null || echo "")
            if [[ -z "$failed_migration" ]]; then
                failed_migration=$(echo "$out" | sed -n 's/.*The `\([^`]*\)` migration .* failed.*/\1/p')
            fi
            if [[ -n "$failed_migration" ]]; then
                info "Resolving: ${failed_migration}..."
                if npx prisma migrate resolve --rolled-back "$failed_migration" --schema=packages/database/prisma/schema.prisma 2>&1; then
                    log "Marked '${failed_migration}' as rolled-back"
                    continue
                fi
            fi
        fi

        if echo "$out" | grep -q "P3018"; then
            warn "Migration apply error (attempt ${migrate_attempts}/${migrate_max})..."
            local apply_failed
            apply_failed=$(echo "$out" | sed -n 's/.*Migration name: \(.*\)/\1/p' | tr -d '[:space:]')
            if [[ -n "$apply_failed" ]]; then
                info "Resolving: ${apply_failed}..."
                if npx prisma migrate resolve --rolled-back "$apply_failed" --schema=packages/database/prisma/schema.prisma 2>&1; then
                    log "Marked '${apply_failed}' as rolled-back"
                    continue
                fi
            fi
        fi

        echo -e "\n  ${RED}Database migration failed. Output:${NC}\n$out\n"
        error "Database migration failed after ${migrate_attempts} attempt(s)."
    done

    if [[ "$migrate_ok" != "true" ]]; then
        error "Database migration failed after ${migrate_max} attempts."
    fi
    log "Database migrations applied"

    info "Seeding database with default admin user..."
    if ! out=$(npx prisma db seed --schema=packages/database/prisma/schema.prisma 2>&1); then
        warn "Seeding skipped or failed — you may need to create an admin user manually."
        verbose "Seed output: $out"
    else
        log "Database seeded (default: admin / admin)"
    fi

    info "Building production assets..."
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

# ─── Systemd Services ────────────────────────────────────

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

    cat > "${service_dir}/netmon-api.service" <<EOF
[Unit]
Description=NetMon API Server
Documentation=https://github.com/arramandhanu/bit-netmon
After=network.target ${POSTGRES_SERVICE}.service ${REDIS_SERVICE}.service
Requires=${POSTGRES_SERVICE}.service ${REDIS_SERVICE}.service

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

NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${INSTALL_DIR}
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

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

NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${INSTALL_DIR}
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

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

API_URL="http://localhost:${API_PORT:-3000}/health"
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

if command -v curl &>/dev/null; then
    if ! curl -sf "$API_URL" &>/dev/null; then
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] WARN: API health check failed — restarting..." >> "$LOG"
        systemctl restart netmon-api
    fi
fi
WATCHDOG

    chmod +x "$watchdog_script"

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
        if curl -sf "http://localhost:${API_PORT}/health" &>/dev/null; then
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
# NetMon — Nginx Reverse Proxy
# Generated by install.sh

upstream netmon_api {
    server 127.0.0.1:${API_PORT};
}

upstream netmon_web {
    server 127.0.0.1:${WEB_PORT};
}

server {
    listen 80;
    server_name ${domain};

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

    location /socket.io/ {
        proxy_pass http://netmon_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

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

    if [[ "$SKIP_SSL" == "false" ]]; then
        setup_ssl "$domain"
    else
        info "SSL setup skipped (--skip-ssl)"
    fi
}

# ─── SSL Auto-Setup ─────────────────────────────────────

setup_ssl() {
    local domain="$1"

    if [[ -z "$domain" || "$domain" == "localhost" ]]; then
        return
    fi

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

    info "Installing certbot..."
    case "$OS" in
        debian) $SUDO_CMD apt-get install -y -qq certbot python3-certbot-nginx ;;
        rhel)   $SUDO_CMD $PKG_MANAGER install -y -q certbot python3-certbot-nginx ;;
        macos)  brew install certbot ;;
    esac

    if command_exists certbot; then
        info "Obtaining SSL certificate for ${domain}..."
        if certbot --nginx -d "$domain" --non-interactive --agree-tos --email "admin@${domain}" 2>&1; then
            log "SSL certificate obtained ✓"
        else
            warn "SSL certificate failed — continue without HTTPS"
        fi
    fi
}

# ─── Usage ──────────────────────────────────────────────

usage() {
    banner
    cat <<EOF
Usage: sudo ./install.sh [OPTIONS]

Options:
  --unattended     Non-interactive mode (use all defaults)
  --version TAG    Install a specific git tag/branch (default: main)
  --nginx          Set up Nginx reverse proxy only
  --verbose        Enable verbose output
  --log-file FILE  Write logs to file
  --skip-ssl       Skip SSL certificate setup
  --help           Show this help message

Environment Variables:
  API_PORT         API port (default: 3000)
  WEB_PORT         Web port (default: 3001)
  API_DOMAIN       Domain for Nginx/SSL setup
  POSTGRES_DB      Database name (default: netmon)
  POSTGRES_USER    Database user (default: netmon)
  INSTALL_PATH     Installation directory (default: /opt/netmon)

Examples:
  # Interactive install
  sudo ./install.sh

  # Non-interactive with custom ports
  sudo API_PORT=8080 WEB_PORT=8081 ./install.sh --unattended

  # With Nginx and SSL
  sudo API_DOMAIN=netmon.example.com ./install.sh

  # With log file
  sudo ./install.sh --verbose --log-file /var/log/netmon-install.log
EOF
    exit 0
}

# ─── Main ───────────────────────────────────────────────

main() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --unattended) UNATTENDED="true" ;;
            --version) VERSION_TAG="$2"; shift ;;
            --nginx) MODE="nginx" ;;
            --verbose) VERBOSE="true" ;;
            --log-file) LOG_FILE="$2"; shift ;;
            --skip-ssl) SKIP_SSL="true" ;;
            --help|-h) usage ;;
            *) error "Unknown option: $1" ;;
        esac
        shift
    done

    if [[ -n "$LOG_FILE" ]]; then
        touch "$LOG_FILE" 2>/dev/null || true
        exec > >(tee -a "$LOG_FILE") 2>&1
    fi

    log_to_file "Starting NetMon installation"

    banner
    detect_os
    check_root

    if [[ "$MODE" == "nginx" ]]; then
        clone_or_detect_repo
        detect_services
        setup_nginx
        exit 0
    fi

    preflight_checks
    check_resources
    install_prerequisites
    clone_or_detect_repo
    detect_services
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
    verify_health

    section "Installation Complete!"
    echo "  NetMon is now installed and running."
    echo ""
    echo "  Access URLs:"
    echo "    API:   http://localhost:${API_PORT}"
    echo "    Web:   http://localhost:${WEB_PORT}"
    echo "    Health: http://localhost:${API_PORT}/health"
    echo ""
    echo "  Default credentials: admin / admin"
    echo ""
    echo "  Manage services:"
    echo "    sudo systemctl status netmon-api netmon-web"
    echo "    sudo journalctl -u netmon-api -f"
    echo ""
    warn "Save your .env file credentials — they won't be shown again!"
    echo ""
}

MODE=""
detect_os_early() {
    [[ "$OSTYPE" == "darwin"* ]] && OS="macos" && return 0
    [[ -f /etc/os-release ]] || return 1
    . /etc/os-release
    case "$ID" in
        ubuntu|debian|pop|linuxmint) OS="debian"; PKG_MANAGER="apt"; SUDO_CMD="sudo" ;;
        rhel|centos|rocky|almalinux|fedora) OS="rhel"; PKG_MANAGER="dnf"; SUDO_CMD="sudo" ;;
        *) return 1 ;;
    esac
}

detect_os_early || true
main "$@"
