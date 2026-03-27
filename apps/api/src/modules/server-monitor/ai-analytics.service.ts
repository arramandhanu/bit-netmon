import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class AiAnalyticsService {
    private readonly logger = new Logger(AiAnalyticsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly settings: SettingsService,
    ) {}

    private async getApiKey(): Promise<string | null> {
        return this.settings.get('ai.groqApiKey');
    }

    async testConnection(apiKey?: string): Promise<{ ok: boolean; model?: string; error?: string }> {
        const key = apiKey || (await this.getApiKey());
        if (!key) return { ok: false, error: 'No API key configured' };
        try {
            const res = await fetch('https://api.groq.com/openai/v1/models', {
                headers: { Authorization: `Bearer ${key}` },
            });
            if (!res.ok) return { ok: false, error: `API returned ${res.status}` };
            return { ok: true, model: 'llama-3.3-70b-versatile' };
        } catch (err: any) {
            return { ok: false, error: err.message };
        }
    }

    async analyzeServer(serverId: number): Promise<any> {
        try {
            const key = await this.getApiKey();
            if (!key) return { error: 'No Groq API key configured. Go to Settings → AI / Integrations.' };

            const server = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT * FROM server_monitors WHERE server_id = $1 LIMIT 1`, serverId,
            );
            if (!server.length) return { error: 'Server not found' };
            const srv = server[0];

            const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const metrics = await this.prisma.$queryRawUnsafe<any[]>(`
                SELECT time, cpu_user, cpu_system, cpu_load1, cpu_load5, cpu_load15, cpu_cores,
                       mem_total, mem_used, mem_percent, swap_total, swap_used,
                       disk_json, net_json, processes_json, uptime_seconds
                FROM server_metrics WHERE server_id = $1 AND time > $2
                ORDER BY time DESC LIMIT 50
            `, serverId, since);

            if (!metrics.length) return { error: 'No recent metrics data available for analysis.' };

            const latest = metrics[0];
            const avgCpu = metrics.reduce((s: number, m: any) => s + (Number(m.cpu_user) || 0) + (Number(m.cpu_system) || 0), 0) / metrics.length;
            const avgMem = metrics.reduce((s: number, m: any) => s + (Number(m.mem_percent) || 0), 0) / metrics.length;
            const maxCpu = Math.max(...metrics.map((m: any) => (Number(m.cpu_user) || 0) + (Number(m.cpu_system) || 0)));
            const maxMem = Math.max(...metrics.map((m: any) => Number(m.mem_percent) || 0));

            const prompt = `You are an expert Infrastructure & DevOps analyst. Analyze the following server monitoring data and provide actionable insights.

SERVER: ${srv.name} (${srv.server_type})
IP: ${srv.ip_address || 'N/A'}, Status: ${srv.status}
Data points: ${metrics.length}

METRICS SUMMARY:
- CPU: avg=${avgCpu.toFixed(1)}%, max=${maxCpu.toFixed(1)}%, cores=${Number(latest.cpu_cores) || 'N/A'}
- Load: 1m=${Number(latest.cpu_load1) || 0}, 5m=${Number(latest.cpu_load5) || 0}, 15m=${Number(latest.cpu_load15) || 0}
- Memory: avg=${avgMem.toFixed(1)}%, max=${maxMem.toFixed(1)}%, total=${this.fmtB(Number(latest.mem_total))}, used=${this.fmtB(Number(latest.mem_used))}
- Swap: total=${this.fmtB(Number(latest.swap_total))}, used=${this.fmtB(Number(latest.swap_used))}
- Uptime: ${this.fmtUp(Number(latest.uptime_seconds))}
${latest.disk_json ? `- Disks: ${JSON.stringify(latest.disk_json)}` : ''}
${latest.processes_json ? `- Top Processes: ${JSON.stringify((latest.processes_json as any[]).slice(0, 5))}` : ''}

Respond ONLY with JSON (no markdown):
{"healthScore":<0-100>,"status":"<healthy|warning|critical>","summary":"<2-3 sentences>","findings":[{"severity":"<info|warning|critical>","title":"<title>","detail":"<detail>"}],"recommendations":[{"priority":"<high|medium|low>","title":"<title>","action":"<action>"}],"capacityForecast":"<brief>"}`;

            return this.callGroq(key, prompt);
        } catch (err: any) {
            this.logger.error(`analyzeServer failed: ${err.message}`, err.stack);
            return { error: `Analysis failed: ${err.message}` };
        }
    }

    async analyzeFleet(): Promise<any> {
        try {
            const key = await this.getApiKey();
            if (!key) return { error: 'No Groq API key configured. Go to Settings → AI / Integrations.' };

            const servers = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM server_monitors`);
            if (!servers.length) return { error: 'No servers configured.' };

            const lines: string[] = [];
            for (const s of servers) {
                try {
                    const m = await this.prisma.$queryRawUnsafe<any[]>(
                        `SELECT cpu_user, cpu_system, mem_percent, cpu_load1, uptime_seconds FROM server_metrics WHERE server_id = $1 ORDER BY time DESC LIMIT 1`, s.server_id,
                    );
                    const d = m[0];
                    const cpuVal = d ? ((Number(d.cpu_user) || 0) + (Number(d.cpu_system) || 0)).toFixed(1) : 'N/A';
                    const memVal = d ? Number(d.mem_percent) || 0 : 'N/A';
                    const loadVal = d ? Number(d.cpu_load1) || 0 : 'N/A';
                    const upVal = d ? this.fmtUp(Number(d.uptime_seconds)) : 'N/A';
                    lines.push(`- ${s.name} (${s.server_type}, ${s.status}): CPU=${cpuVal}%, Mem=${memVal}%, Load=${loadVal}, Up=${upVal}`);
                } catch (err: any) {
                    this.logger.warn(`Failed to get metrics for server ${s.name}: ${err.message}`);
                    lines.push(`- ${s.name} (${s.server_type}, ${s.status}): CPU=N/A, Mem=N/A, Load=N/A, Up=N/A`);
                }
            }

            const prompt = `You are an expert Infrastructure analyst. Analyze this server fleet and provide strategic insights.

FLEET: ${servers.length} servers
${lines.join('\n')}

Respond ONLY with JSON (no markdown):
{"fleetHealthScore":<0-100>,"status":"<healthy|warning|critical>","summary":"<2-3 sentences>","findings":[{"severity":"<info|warning|critical>","title":"<title>","detail":"<detail>","servers":["<names>"]}],"recommendations":[{"priority":"<high|medium|low>","title":"<title>","action":"<action>"}],"riskAreas":["<areas>"]}`;

            return this.callGroq(key, prompt);
        } catch (err: any) {
            this.logger.error(`analyzeFleet failed: ${err.message}`, err.stack);
            return { error: `Analysis failed: ${err.message}` };
        }
    }

    async generateReport(options: { type: string; serverId?: number }): Promise<any> {
        const key = await this.getApiKey();
        if (!key) return { error: 'No Groq API key configured. Go to Settings → AI / Integrations.' };

        let context = '';
        if (options.serverId) {
            const srv = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT * FROM server_monitors WHERE server_id = $1`, options.serverId,
            );
            const metrics = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT * FROM server_metrics WHERE server_id = $1 ORDER BY time DESC LIMIT 100`, options.serverId,
            );
            context = `Server: ${srv[0]?.name}, Type: ${srv[0]?.server_type}, Status: ${srv[0]?.status}\nData points: ${metrics.length}\n${metrics.length > 0 ? `Latest CPU: ${((Number(metrics[0].cpu_user) || 0) + (Number(metrics[0].cpu_system) || 0)).toFixed(1)}%, Memory: ${metrics[0].mem_percent}%` : 'No data'}`;
        } else {
            const servers = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM server_monitors`);
            context = `Fleet of ${servers.length} servers: ${servers.map((s: any) => `${s.name}(${s.status})`).join(', ')}`;
        }

        const types: Record<string, string> = {
            health: 'Generate a comprehensive Server Health Report with sections: Executive Summary, Server Status, Performance Analysis, Resource Utilization, Anomalies, and Recommendations.',
            capacity: 'Generate a Capacity Planning Report with sections: Current Usage, Growth Trends, Bottleneck Analysis, Scaling Recommendations, Cost Optimization.',
            security: 'Generate a Security Audit Report with sections: Security Posture, Vulnerability Assessment, Patch Management, Access Concerns, Recommendations.',
            executive: 'Generate an Executive Summary Report with sections: Infrastructure Overview, Key Metrics, Risk Assessment, Notable Events, Strategic Recommendations.',
        };

        const prompt = `You are an expert Infrastructure analyst generating a formal report.\n\nCONTEXT:\n${context}\n\nTASK: ${types[options.type] || types.health}\n\nFormat in clean markdown with headers, bullet points, and tables where appropriate.`;

        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
                body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 4096 }),
            });
            if (!res.ok) { const e = await res.text(); return { error: `Groq API error: ${res.status} - ${e}` }; }
            const data: any = await res.json();
            return { report: data.choices?.[0]?.message?.content || 'No response generated.' };
        } catch (err: any) {
            return { error: `Failed to call Groq API: ${err.message}` };
        }
    }

    private async callGroq(apiKey: string, prompt: string): Promise<any> {
        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 2048 }),
            });
            if (!res.ok) { const e = await res.text(); this.logger.error(`Groq: ${res.status} - ${e}`); return { error: `Groq API error: ${res.status}` }; }
            const data: any = await res.json();
            const content = data.choices?.[0]?.message?.content || '{}';
            try { return JSON.parse(content); } catch { return { rawResponse: content }; }
        } catch (err: any) {
            this.logger.error(`Groq call failed: ${err.message}`);
            return { error: `Failed to call Groq API: ${err.message}` };
        }
    }

    private fmtB(bytes: number | null): string {
        if (!bytes) return 'N/A';
        if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
        if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
        if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
        return `${(bytes / 1e3).toFixed(0)} KB`;
    }

    private fmtUp(seconds: number | null): string {
        if (!seconds) return 'N/A';
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        return `${d}d ${h}h`;
    }
}
