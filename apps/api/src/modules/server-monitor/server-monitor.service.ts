import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { randomBytes } from 'crypto';
import { TenantUser, isSuperAdmin } from '../../common/guards/tenant.guard';

// ─── DTOs ───────────────────────────────────────────────

export interface CreateServerDto {
    name: string;
    serverType: 'linux' | 'windows';
    ipAddress?: string;
    hostname?: string;
    agentInterval?: number;
    locationId?: number;
    monitorOptions?: {
        cpu?: boolean;
        memory?: boolean;
        disk?: string[];       // mount points / drive letters
        diskio?: string[];     // device names
        network?: string[];    // interface names
        process?: string[];    // process names (empty = all top-20)
    };
}

export interface ServerMetricsPayload {
    cpuUser?: number;
    cpuSystem?: number;
    cpuLoad1?: number;
    cpuLoad5?: number;
    cpuLoad15?: number;
    cpuCores?: number;
    memTotal?: number;
    memUsed?: number;
    memPercent?: number;
    swapTotal?: number;
    swapUsed?: number;
    disk?: Array<{ mountpoint: string; total: number; used: number; percent: number; fstype: string }>;
    diskIo?: Array<{ device: string; readBytes: number; writeBytes: number; readOps?: number; writeOps?: number }>;
    network?: Array<{ interface: string; bytesIn: number; bytesOut: number; packetsIn?: number; packetsOut?: number }>;
    processes?: Array<{ pid: number; name: string; cpu: number; memory: number; threads?: number }>;
    uptimeSeconds?: number;
    osInfo?: string;
    agentVersion?: string;
}

export interface ServerOverview {
    totalServers: number;
    serversUp: number;
    serversDown: number;
    serversUnknown: number;
    avgCpuPercent: number;
    avgMemPercent: number;
    servers: any[];
}

// ─── Service ────────────────────────────────────────────

@Injectable()
export class ServerMonitorService {
    private readonly logger = new Logger(ServerMonitorService.name);

    constructor(private readonly prisma: PrismaService) {}

    // ─── CRUD ───────────────────────────────────────────

    async create(dto: CreateServerDto, user?: TenantUser): Promise<any> {
        const agentToken = this.generateToken();

        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `INSERT INTO server_monitors (name, server_type, ip_address, hostname, agent_token, agent_interval, monitor_options, location_id, tenant_id, updated_at)
             VALUES ($1, $2::server_type, $3, $4, $5, $6, $7::jsonb, $8, $9, NOW())
             RETURNING *`,
            dto.name,
            dto.serverType,
            dto.ipAddress || null,
            dto.hostname || null,
            agentToken,
            dto.agentInterval || 300,
            dto.monitorOptions ? JSON.stringify(dto.monitorOptions) : null,
            dto.locationId || null,
            user?.tenantId || null,
        );
        return this.serializeRow(rows[0]);
    }

    async findAll(user?: TenantUser): Promise<any[]> {
        try {
            const tenantFilter = user && !isSuperAdmin(user) ? `WHERE sm.tenant_id = ${user.tenantId}` : '';
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT sm.*, l.name AS location_name, l.latitude, l.longitude
                 FROM server_monitors sm
                 LEFT JOIN locations l ON sm.location_id = l.location_id
                 ${tenantFilter}
                 ORDER BY sm.name`,
            );
            return rows.map(this.serializeRow);
        } catch (err: any) {
            this.logger.warn(`Failed to list servers: ${err.message}`);
            return [];
        }
    }

    async findOne(id: number, user?: TenantUser): Promise<any> {
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM server_monitors WHERE server_id = $1`,
            id,
        );
        if (rows.length === 0) throw new NotFoundException(`Server #${id} not found`);
        const server = this.serializeRow(rows[0]);
        if (user && !isSuperAdmin(user) && server.tenant_id !== user.tenantId) {
            throw new NotFoundException(`Server #${id} not found`);
        }
        return server;
    }

    async update(id: number, dto: Partial<CreateServerDto>, user?: TenantUser): Promise<any> {
        await this.findOne(id, user);

        const sets: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (dto.name !== undefined) { sets.push(`name = $${idx++}`); values.push(dto.name); }
        if (dto.serverType !== undefined) { sets.push(`server_type = $${idx++}::server_type`); values.push(dto.serverType); }
        if (dto.ipAddress !== undefined) { sets.push(`ip_address = $${idx++}`); values.push(dto.ipAddress); }
        if (dto.hostname !== undefined) { sets.push(`hostname = $${idx++}`); values.push(dto.hostname); }
        if (dto.agentInterval !== undefined) { sets.push(`agent_interval = $${idx++}`); values.push(dto.agentInterval); }
        if (dto.monitorOptions !== undefined) { sets.push(`monitor_options = $${idx++}::jsonb`); values.push(JSON.stringify(dto.monitorOptions)); }
        if ((dto as any).locationId !== undefined) { sets.push(`location_id = $${idx++}`); values.push((dto as any).locationId || null); }

        sets.push(`updated_at = NOW()`);

        if (sets.length <= 1) return this.findOne(id);

        values.push(id);
        const rows = await this.prisma.$queryRawUnsafe<any[]>(
            `UPDATE server_monitors SET ${sets.join(', ')} WHERE server_id = $${idx} RETURNING *`,
            ...values,
        );
        return this.serializeRow(rows[0]);
    }

    async delete(id: number, user?: TenantUser): Promise<void> {
        await this.findOne(id, user);
        await this.prisma.$executeRawUnsafe(
            `DELETE FROM server_monitors WHERE server_id = $1`,
            id,
        );
        // Also clean up metrics
        await this.prisma.$executeRawUnsafe(
            `DELETE FROM server_metrics WHERE server_id = $1`,
            id,
        );
    }

    // ─── Agent Authentication ───────────────────────────

    async authenticateAgent(token: string): Promise<any | null> {
        try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT * FROM server_monitors WHERE agent_token = $1 AND enabled = true`,
                token,
            );
            return rows.length > 0 ? this.serializeRow(rows[0]) : null;
        } catch {
            return null;
        }
    }

    // ─── Metrics Ingestion ──────────────────────────────

    async ingestMetrics(serverId: number, payload: ServerMetricsPayload): Promise<void> {
        try {
            await Promise.all([
                // Insert metrics into hypertable
                this.prisma.$executeRawUnsafe(
                    `INSERT INTO server_metrics (
                        time, server_id,
                        cpu_user, cpu_system, cpu_load1, cpu_load5, cpu_load15, cpu_cores,
                        mem_total, mem_used, mem_percent,
                        swap_total, swap_used,
                        disk_json, disk_io_json, net_json, processes_json,
                        uptime_seconds
                    ) VALUES (
                        NOW(), $1,
                        $2, $3, $4, $5, $6, $7,
                        $8, $9, $10,
                        $11, $12,
                        $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb,
                        $17
                    )`,
                    serverId,
                    payload.cpuUser ?? null,
                    payload.cpuSystem ?? null,
                    payload.cpuLoad1 ?? null,
                    payload.cpuLoad5 ?? null,
                    payload.cpuLoad15 ?? null,
                    payload.cpuCores ?? null,
                    payload.memTotal ?? null,
                    payload.memUsed ?? null,
                    payload.memPercent ?? null,
                    payload.swapTotal ?? null,
                    payload.swapUsed ?? null,
                    payload.disk ? JSON.stringify(payload.disk) : null,
                    payload.diskIo ? JSON.stringify(payload.diskIo) : null,
                    payload.network ? JSON.stringify(payload.network) : null,
                    payload.processes ? JSON.stringify(payload.processes) : null,
                    payload.uptimeSeconds ?? null,
                ),
                // Update server status
                this.prisma.$executeRawUnsafe(
                    `UPDATE server_monitors SET
                        status = 'up',
                        last_reported_at = NOW(),
                        os_info = COALESCE($2, os_info),
                        agent_version = COALESCE($3, agent_version),
                        updated_at = NOW()
                     WHERE server_id = $1`,
                    serverId,
                    payload.osInfo || null,
                    payload.agentVersion || null,
                ),
            ]);
        } catch (err: any) {
            this.logger.warn(`Failed to ingest metrics for server #${serverId}: ${err.message}`);
            throw err;
        }
    }

    // ─── Metrics Query ──────────────────────────────────

    async getLatestMetrics(serverId: number): Promise<any | null> {
        try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT * FROM server_metrics
                 WHERE server_id = $1
                 ORDER BY time DESC
                 LIMIT 1`,
                serverId,
            );
            return rows.length > 0 ? this.serializeRow(rows[0]) : null;
        } catch {
            return null;
        }
    }

    async getMetricsHistory(
        serverId: number,
        from?: string,
        to?: string,
        bucket: string = '5 minutes',
    ): Promise<any[]> {
        const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const toDate = to ? new Date(to) : new Date();

        try {
            const rows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT
                    time_bucket($1::interval, time) AS bucket,
                    server_id,
                    AVG(cpu_user)::numeric(5,2) AS cpu_user,
                    AVG(cpu_system)::numeric(5,2) AS cpu_system,
                    AVG(cpu_load1)::numeric(5,2) AS cpu_load1,
                    AVG(mem_percent)::numeric(5,2) AS mem_percent,
                    AVG(mem_used)::bigint AS mem_used,
                    MAX(mem_total)::bigint AS mem_total,
                    MAX(uptime_seconds)::bigint AS uptime_seconds,
                    COUNT(*) AS sample_count
                 FROM server_metrics
                 WHERE server_id = $2
                   AND time >= $3
                   AND time <= $4
                 GROUP BY bucket, server_id
                 ORDER BY bucket DESC
                 LIMIT 500`,
                bucket,
                serverId,
                fromDate,
                toDate,
            );
            return rows.map(this.serializeRow);
        } catch (err: any) {
            this.logger.warn(`Server metrics query failed: ${err.message}`);
            return [];
        }
    }

    // ─── Overview ───────────────────────────────────────

    async getOverview(user?: TenantUser): Promise<ServerOverview> {
        const servers = await this.findAll(user);
        const up = servers.filter(s => s.status === 'up').length;
        const down = servers.filter(s => s.status === 'down').length;
        const unknown = servers.filter(s => s.status === 'unknown').length;

        // Get latest metrics for each server
        for (const server of servers) {
            try {
                const latest = await this.getLatestMetrics(server.server_id);
                server.latestMetrics = latest;
            } catch {
                server.latestMetrics = null;
            }
        }

        const withCpu = servers.filter(s => s.latestMetrics?.cpu_user != null);
        const avgCpu = withCpu.length > 0
            ? Math.round(withCpu.reduce((sum, s) => sum + Number(s.latestMetrics.cpu_user || 0) + Number(s.latestMetrics.cpu_system || 0), 0) / withCpu.length * 100) / 100
            : 0;

        const withMem = servers.filter(s => s.latestMetrics?.mem_percent != null);
        const avgMem = withMem.length > 0
            ? Math.round(withMem.reduce((sum, s) => sum + Number(s.latestMetrics.mem_percent || 0), 0) / withMem.length * 100) / 100
            : 0;

        return {
            totalServers: servers.length,
            serversUp: up,
            serversDown: down,
            serversUnknown: unknown,
            avgCpuPercent: avgCpu,
            avgMemPercent: avgMem,
            servers,
        };
    }

    // ─── Agent Install Script ───────────────────────────

    generateInstallScript(
        server: any,
        apiBaseUrl: string,
    ): string {
        if (server.server_type === 'linux') {
            return this.generateLinuxScript(server, apiBaseUrl);
        } else {
            return this.generateWindowsScript(server, apiBaseUrl);
        }
    }

    private generateLinuxScript(server: any, apiBaseUrl: string): string {
        const interval = server.agent_interval || 300;
        const intervalMin = Math.max(1, Math.round(interval / 60));
        const apiUrl = `${apiBaseUrl}/api/v1/server-monitors/${server.server_id}/metrics`;
        const agentToken = server.agent_token;

        // Build the collector script as a plain string — will be base64-encoded
        // into the install script to completely avoid shell escaping issues.
        const collectorScript = [
            '#!/bin/bash',
            'set -e',
            '',
            'API_URL="$1"',
            'AGENT_TOKEN="$2"',
            'SERVER_ID="$3"',
            '',
            '# ── CPU (delta-based, two snapshots 1s apart) ──',
            "read -r c1_user c1_nice c1_sys c1_idle c1_iow c1_irq c1_sirq _ < <(grep '^cpu ' /proc/stat | awk '{$1=\"\"; print $0}')",
            'sleep 1',
            "read -r c2_user c2_nice c2_sys c2_idle c2_iow c2_irq c2_sirq _ < <(grep '^cpu ' /proc/stat | awk '{$1=\"\"; print $0}')",
            '',
            'd_user=$((c2_user - c1_user))',
            'd_nice=$((c2_nice - c1_nice))',
            'd_sys=$((c2_sys - c1_sys + c2_irq - c1_irq + c2_sirq - c1_sirq))',
            'd_idle=$((c2_idle - c1_idle + c2_iow - c1_iow))',
            'd_total=$((d_user + d_nice + d_sys + d_idle))',
            '',
            'if [ "$d_total" -gt 0 ]; then',
            "    cpu_user=$(awk -v a=\"$d_user\" -v b=\"$d_total\" 'BEGIN {printf \"%.2f\", a/b*100}')",
            "    cpu_system=$(awk -v a=\"$d_sys\" -v b=\"$d_total\" 'BEGIN {printf \"%.2f\", a/b*100}')",
            'else',
            '    cpu_user="0"',
            '    cpu_system="0"',
            'fi',
            'cpu_cores=$(nproc 2>/dev/null || echo 1)',
            'read -r cpu_load1 cpu_load5 cpu_load15 _ < /proc/loadavg',
            '',
            '# ── Memory ──',
            "mem_total=$(awk '/^MemTotal:/ {printf \"%d\", $2*1024}' /proc/meminfo)",
            "mem_free=$(awk '/^MemFree:/ {printf \"%d\", $2*1024}' /proc/meminfo)",
            "mem_available=$(awk '/^MemAvailable:/ {printf \"%d\", $2*1024}' /proc/meminfo)",
            "mem_buffers=$(awk '/^Buffers:/ {printf \"%d\", $2*1024}' /proc/meminfo)",
            "mem_cached=$(awk '/^Cached:/ {printf \"%d\", $2*1024}' /proc/meminfo)",
            'mem_used=$((mem_total - mem_free - mem_buffers - mem_cached))',
            'if [ "$mem_total" -gt 0 ]; then',
            "    mem_percent=$(awk -v a=\"$mem_used\" -v b=\"$mem_total\" 'BEGIN {printf \"%.2f\", a/b*100}')",
            'else',
            '    mem_percent="0"',
            'fi',
            '',
            '# ── Swap ──',
            "swap_total=$(awk '/^SwapTotal:/ {printf \"%d\", $2*1024}' /proc/meminfo)",
            "swap_free=$(awk '/^SwapFree:/ {printf \"%d\", $2*1024}' /proc/meminfo)",
            'swap_used=$((swap_total - swap_free))',
            '',
            '# ── Uptime ──',
            "uptime_seconds=$(awk '{printf \"%d\", $1}' /proc/uptime)",
            '',
            '# ── OS Info ──',
            'if [ -f /etc/os-release ]; then',
            '    os_info=$(. /etc/os-release && echo "$PRETTY_NAME ($(uname -r))")',
            'else',
            '    os_info="Linux $(uname -r)"',
            'fi',
            '',
            '# ── Helper: quote char ──',
            "Q='\"'",
            '',
            '# ── Disk ──',
            'disk_json="["',
            'first=1',
            'while IFS= read -r line; do',
            "    mp=$(echo \"$line\" | awk '{print $6}')",
            "    total=$(echo \"$line\" | awk '{printf \"%d\", $2*1024}')",
            "    used=$(echo \"$line\" | awk '{printf \"%d\", $3*1024}')",
            "    avail=$(echo \"$line\" | awk '{printf \"%d\", $4*1024}')",
            "    pct=$(echo \"$line\" | awk '{gsub(/%/,\"\"); print $5}')",
            "    fstype=$(df -T \"$mp\" 2>/dev/null | awk 'NR==2{print $2}')",
            '    [ $first -eq 0 ] && disk_json+=","',
            '    disk_json+="{${Q}mountpoint${Q}:${Q}${mp}${Q},${Q}total${Q}:${total},${Q}used${Q}:${used},${Q}percent${Q}:${pct},${Q}fstype${Q}:${Q}${fstype}${Q}}"',
            '    first=0',
            "done < <(df -BK --output=source,size,used,avail,pcent,target 2>/dev/null | tail -n +2 | grep -E '^/')",
            'disk_json+="]"',
            '',
            '# ── Disk I/O ──',
            'diskio_json="["',
            'first=1',
            'while IFS= read -r line; do',
            "    dev=$(echo \"$line\" | awk '{print $3}')",
            "    reads=$(echo \"$line\" | awk '{printf \"%d\", $6 * 512}')",
            "    writes=$(echo \"$line\" | awk '{printf \"%d\", $10 * 512}')",
            "    read_ops=$(echo \"$line\" | awk '{print $4}')",
            "    write_ops=$(echo \"$line\" | awk '{print $8}')",
            "    echo \"$dev\" | grep -qE '^(loop|ram)' && continue",
            '    [ $first -eq 0 ] && diskio_json+=","',
            '    diskio_json+="{${Q}device${Q}:${Q}${dev}${Q},${Q}readBytes${Q}:${reads},${Q}writeBytes${Q}:${writes},${Q}readOps${Q}:${read_ops},${Q}writeOps${Q}:${write_ops}}"',
            '    first=0',
            'done < <(cat /proc/diskstats)',
            'diskio_json+="]"',
            '',
            '# ── Network ──',
            'net_json="["',
            'first=1',
            'while IFS= read -r line; do',
            "    iface=$(echo \"$line\" | awk -F: '{gsub(/ /,\"\",$1); print $1}')",
            '    [ "$iface" = "lo" ] && continue',
            "    bytes_in=$(echo \"$line\" | awk -F: '{print $2}' | awk '{print $1}')",
            "    packets_in=$(echo \"$line\" | awk -F: '{print $2}' | awk '{print $2}')",
            "    bytes_out=$(echo \"$line\" | awk -F: '{print $2}' | awk '{print $9}')",
            "    packets_out=$(echo \"$line\" | awk -F: '{print $2}' | awk '{print $10}')",
            '    [ $first -eq 0 ] && net_json+=","',
            '    net_json+="{${Q}interface${Q}:${Q}${iface}${Q},${Q}bytesIn${Q}:${bytes_in},${Q}bytesOut${Q}:${bytes_out},${Q}packetsIn${Q}:${packets_in},${Q}packetsOut${Q}:${packets_out}}"',
            '    first=0',
            'done < <(tail -n +3 /proc/net/dev)',
            'net_json+="]"',
            '',
            '# ── Processes (top 20 by CPU) ──',
            'proc_json="["',
            'first=1',
            'while IFS= read -r line; do',
            "    pid=$(echo \"$line\" | awk '{print $2}')",
            "    cpu=$(echo \"$line\" | awk '{print $3}')",
            "    mem=$(echo \"$line\" | awk '{print $4}')",
            "    name=$(echo \"$line\" | awk '{print $11}')",
            '    threads=$(ls /proc/$pid/task 2>/dev/null | wc -l)',
            '    [ $first -eq 0 ] && proc_json+=","',
            '    proc_json+="{${Q}pid${Q}:${pid},${Q}name${Q}:${Q}${name}${Q},${Q}cpu${Q}:${cpu},${Q}memory${Q}:${mem},${Q}threads${Q}:${threads}}"',
            '    first=0',
            'done < <(ps aux --sort=-%cpu 2>/dev/null | head -21 | tail -20)',
            'proc_json+="]"',
            '',
            '# ── Build JSON ──',
            'json_payload=$(cat <<JSON',
            '{',
            '  "cpuUser": $cpu_user,',
            '  "cpuSystem": $cpu_system,',
            '  "cpuLoad1": $cpu_load1,',
            '  "cpuLoad5": $cpu_load5,',
            '  "cpuLoad15": $cpu_load15,',
            '  "cpuCores": $cpu_cores,',
            '  "memTotal": $mem_total,',
            '  "memUsed": $mem_used,',
            '  "memPercent": $mem_percent,',
            '  "swapTotal": $swap_total,',
            '  "swapUsed": $swap_used,',
            '  "disk": $disk_json,',
            '  "diskIo": $diskio_json,',
            '  "network": $net_json,',
            '  "processes": $proc_json,',
            '  "uptimeSeconds": $uptime_seconds,',
            '  "osInfo": "$os_info",',
            '  "agentVersion": "1.0.0"',
            '}',
            'JSON',
            ')',
            '',
            '# ── Send to API ──',
            'curl -s -X POST "$API_URL" \\',
            '    -H "Content-Type: application/json" \\',
            '    -H "X-Agent-Token: $AGENT_TOKEN" \\',
            '    -d "$json_payload" \\',
            '    -o /dev/null -w "HTTP %{http_code}" || echo "FAILED"',
            '',
            '# ── Systemd Services (DevOps) ──',
            'DEVOPS_URL=$(echo "$API_URL" | sed "s|/server-monitors/.*/metrics|/devops/agent/$SERVER_ID/services|")',
            'svc_json="{${Q}services${Q}:["',
            'svc_first=1',
            'while IFS= read -r line; do',
            '    svc_name=$(echo "$line" | awk \'{print $1}\')',
            '    svc_load=$(echo "$line" | awk \'{print $2}\')',
            '    svc_active=$(echo "$line" | awk \'{print $3}\')',
            '    svc_sub=$(echo "$line" | awk \'{print $4}\')',
            '    svc_desc=$(echo "$line" | awk \'{for(i=5;i<=NF;i++) printf "%s ", $i; print ""}\'| sed \'s/ *$//\')',
            '    [ -z "$svc_name" ] && continue',
            '    [ $svc_first -eq 0 ] && svc_json+=","',
            '    svc_json+="{${Q}name${Q}:${Q}${svc_name}${Q},${Q}loadState${Q}:${Q}${svc_load}${Q},${Q}activeState${Q}:${Q}${svc_active}${Q},${Q}subState${Q}:${Q}${svc_sub}${Q},${Q}description${Q}:${Q}${svc_desc}${Q}}"',
            '    svc_first=0',
            'done < <(systemctl list-units --type=service --all --no-pager --plain --no-legend 2>/dev/null)',
            '',
            '# Get unit file states',
            'while IFS= read -r line; do',
            '    uf_name=$(echo "$line" | awk \'{print $1}\')',
            '    uf_state=$(echo "$line" | awk \'{print $2}\')',
            '    [ -z "$uf_name" ] && continue',
            '    svc_json=$(echo "$svc_json" | sed "s|${Q}name${Q}:${Q}${uf_name}${Q}|${Q}name${Q}:${Q}${uf_name}${Q},${Q}unitFileState${Q}:${Q}${uf_state}${Q}|")',
            'done < <(systemctl list-unit-files --type=service --no-pager --plain --no-legend 2>/dev/null)',
            '',
            'svc_json+="]}"',
            'curl -s -X POST "$DEVOPS_URL" \\',
            '    -H "Content-Type: application/json" \\',
            '    -H "X-Agent-Token: $AGENT_TOKEN" \\',
            '    -d "$svc_json" \\',
            '    -o /dev/null -w "" || true',
        ].join('\n');


        // Base64-encode the collector script so it survives intact through bash
        const collectorB64 = Buffer.from(collectorScript).toString('base64');

        return `#!/bin/bash
# ═══════════════════════════════════════════════════════════
# NetMon Agent Installer — Linux Server
# Server: ${server.name}
# ═══════════════════════════════════════════════════════════
set -e

API_URL="${apiUrl}"
AGENT_TOKEN="${agentToken}"
SERVER_ID="${server.server_id}"
INSTALL_DIR="/opt/netmon-agent"
INTERVAL_SEC=${interval}

echo "╔═══════════════════════════════════════════════╗"
echo "║       NetMon Agent Installer (Linux)          ║"
echo "╚═══════════════════════════════════════════════╝"

# Check root
if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: Please run with sudo or as root"
    exit 1
fi

# Check prerequisites
for cmd in curl base64; do
    if ! command -v $cmd &>/dev/null; then
        echo "ERROR: $cmd is required. Install it first."
        exit 1
    fi
done

# Create install directory
mkdir -p "$INSTALL_DIR"

# ─── Write Collector Script (base64-decoded to avoid escaping issues) ───
echo "${collectorB64}" | base64 -d > "$INSTALL_DIR/collector.sh"
chmod +x "$INSTALL_DIR/collector.sh"

# ─── Write systemd service ──────────────────────────────
cat > /etc/systemd/system/netmon-agent.service << SVCEOF
[Unit]
Description=NetMon Server Monitoring Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=$INSTALL_DIR/collector.sh $API_URL $AGENT_TOKEN $SERVER_ID
StandardOutput=append:$INSTALL_DIR/agent.log
StandardError=append:$INSTALL_DIR/agent.log
SVCEOF

cat > /etc/systemd/system/netmon-agent.timer << TMREOF
[Unit]
Description=NetMon Agent Timer

[Timer]
OnBootSec=30s
OnUnitActiveSec=${interval}s
AccuracySec=5s

[Install]
WantedBy=timers.target
TMREOF

# Enable and start
systemctl daemon-reload
systemctl enable netmon-agent.timer
systemctl start netmon-agent.timer

# Run first collection
echo ""
echo "Running first data collection..."
bash "$INSTALL_DIR/collector.sh" "$API_URL" "$AGENT_TOKEN" "$SERVER_ID"

echo ""
echo "NetMon Agent installed successfully!"
echo "   Install dir: $INSTALL_DIR"
echo "   Timer: systemctl status netmon-agent.timer"
echo "   Logs:  $INSTALL_DIR/agent.log"
echo "   Interval: every ${intervalMin} minute(s)"
`;
    }
    private generateWindowsScript(server: any, apiBaseUrl: string): string {
        const interval = server.agent_interval || 300;
        const intervalMin = Math.max(1, Math.round(interval / 60));

        return `# ═══════════════════════════════════════════════════════════
# NetMon Agent Installer — Windows Server
# Server: ${server.name}
# ═══════════════════════════════════════════════════════════
# Run as Administrator in PowerShell

$ErrorActionPreference = "Stop"

$ApiUrl = "${apiBaseUrl}/api/v1/server-monitors/${server.server_id}/metrics"
$AgentToken = "${server.agent_token}"
$InstallDir = "C:\\netmon-agent"
$IntervalMin = ${intervalMin}

Write-Host "╔═══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     NetMon Agent Installer (Windows)          ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════╝" -ForegroundColor Cyan

# Check admin
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Please run as Administrator" -ForegroundColor Red
    exit 1
}

# Create install directory
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

# ─── Write Collector Script ─────────────────────────────
$collectorScript = @'
param(
    [string]$ApiUrl,
    [string]$AgentToken
)

$ErrorActionPreference = "SilentlyContinue"

# ── CPU ──
$cpu = Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average
$cpuUser = [math]::Round($cpu.Average, 2)
$cpuCores = (Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfCores -Sum).Sum
$cpuLogical = (Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum

# ── Memory ──
$os = Get-CimInstance Win32_OperatingSystem
$memTotal = [long]$os.TotalVisibleMemorySize * 1024
$memFree = [long]$os.FreePhysicalMemory * 1024
$memUsed = $memTotal - $memFree
$memPercent = if ($memTotal -gt 0) { [math]::Round($memUsed / $memTotal * 100, 2) } else { 0 }

# ── Swap ──
$pageFile = Get-CimInstance Win32_PageFileUsage -ErrorAction SilentlyContinue | Select-Object -First 1
$swapTotal = if ($pageFile) { [long]$pageFile.AllocatedBaseSize * 1MB } else { 0 }
$swapUsed = if ($pageFile) { [long]$pageFile.CurrentUsage * 1MB } else { 0 }

# ── Uptime ──
$bootTime = $os.LastBootUpTime
$uptimeSeconds = [math]::Floor(((Get-Date) - $bootTime).TotalSeconds)

# ── OS Info ──
$osInfo = "$($os.Caption) $($os.Version) Build $($os.BuildNumber)"

# ── Disk ──
$disks = @()
Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
    $total = [long]$_.Size
    $free = [long]$_.FreeSpace
    $used = $total - $free
    $pct = if ($total -gt 0) { [math]::Round($used / $total * 100, 1) } else { 0 }
    $disks += @{
        mountpoint = $_.DeviceID
        total = $total
        used = $used
        percent = $pct
        fstype = $_.FileSystem
    }
}

# ── Disk I/O ──
$diskIo = @()
Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne "_Total" } | ForEach-Object {
    $diskIo += @{
        device = $_.Name
        readBytes = [long]$_.DiskReadBytesPerSec
        writeBytes = [long]$_.DiskWriteBytesPerSec
    }
}

# ── Network ──
$netData = @()
Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue | ForEach-Object {
    $netData += @{
        interface = $_.Name
        bytesIn = [long]$_.BytesReceivedPerSec
        bytesOut = [long]$_.BytesSentPerSec
        packetsIn = [long]$_.PacketsReceivedPerSec
        packetsOut = [long]$_.PacketsSentPerSec
    }
}

# ── Processes (top 20 by CPU) ──
$procs = @()
Get-Process | Sort-Object CPU -Descending | Select-Object -First 20 | ForEach-Object {
    $procs += @{
        pid = $_.Id
        name = $_.ProcessName
        cpu = [math]::Round($_.CPU, 2)
        memory = [math]::Round($_.WorkingSet64 / 1MB, 2)
        threads = $_.Threads.Count
    }
}

# ── Build JSON ──
$payload = @{
    cpuUser = $cpuUser
    cpuSystem = 0
    cpuLoad1 = $cpuUser
    cpuLoad5 = $cpuUser
    cpuLoad15 = $cpuUser
    cpuCores = $cpuCores
    memTotal = $memTotal
    memUsed = $memUsed
    memPercent = $memPercent
    swapTotal = $swapTotal
    swapUsed = $swapUsed
    disk = $disks
    diskIo = $diskIo
    network = $netData
    processes = $procs
    uptimeSeconds = $uptimeSeconds
    osInfo = $osInfo
    agentVersion = "1.0.0"
} | ConvertTo-Json -Depth 5

# ── Send to API ──
try {
    $headers = @{
        "Content-Type" = "application/json"
        "X-Agent-Token" = $AgentToken
    }
    Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $payload -Headers $headers -TimeoutSec 30
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Metrics sent successfully" -ForegroundColor Green
} catch {
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Failed to send metrics: $_" -ForegroundColor Red
}
'@

Set-Content -Path "$InstallDir\\collector.ps1" -Value $collectorScript -Encoding UTF8

# ─── Create Scheduled Task ──────────────────────────────
$taskName = "NetMon-Agent"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File \`"$InstallDir\\collector.ps1\`" -ApiUrl \`"$ApiUrl\`" -AgentToken \`"$AgentToken\`""
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes $IntervalMin) -Once -At (Get-Date)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

# Remove existing task if any
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -User "SYSTEM" -RunLevel Highest -Description "NetMon Server Monitoring Agent"

# Run first collection
Write-Host ""
Write-Host "Running first data collection..." -ForegroundColor Yellow
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$InstallDir\\collector.ps1" -ApiUrl "$ApiUrl" -AgentToken "$AgentToken"

Write-Host ""
Write-Host "NetMon Agent installed successfully!" -ForegroundColor Green
Write-Host "   Install dir: $InstallDir"
Write-Host "   Task: $taskName"
Write-Host "   Interval: every $IntervalMin minute(s)"
Write-Host ""
Write-Host "Your netmon agent is running and functioning properly." -ForegroundColor Green
`;
    }

    // ─── Status Check ───────────────────────────────────

    /**
     * Mark servers as 'down' if they haven't reported within 2x their interval.
     */
    async checkStaleServers(): Promise<void> {
        try {
            await this.prisma.$executeRawUnsafe(
                `UPDATE server_monitors
                 SET status = 'down', updated_at = NOW()
                 WHERE enabled = true
                   AND status = 'up'
                   AND last_reported_at IS NOT NULL
                   AND last_reported_at < NOW() - (agent_interval * 2 || ' seconds')::interval`,
            );
        } catch (err: any) {
            this.logger.warn(`Stale server check failed: ${err.message}`);
        }
    }

    // ─── Helpers ────────────────────────────────────────

    private generateToken(): string {
        return 'nma_' + randomBytes(32).toString('hex');
    }

    private serializeRow(row: any): any {
        const out: any = {};
        for (const [key, value] of Object.entries(row)) {
            if (typeof value === 'bigint') {
                out[key] = Number(value);
            } else if (value instanceof Date) {
                out[key] = value.toISOString();
            } else {
                out[key] = value;
            }
        }
        return out;
    }
}
