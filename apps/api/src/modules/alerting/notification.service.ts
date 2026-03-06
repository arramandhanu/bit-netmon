import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';

interface AlertNotification {
    ruleName: string;
    severity: string;
    deviceHostname: string;
    deviceIp: string;
    metricName: string;
    metricValue: number;
    threshold: number;
    condition: string;
    state: 'triggered' | 'resolved';
    message: string;
    triggeredAt: Date;
}

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        private readonly config: ConfigService,
        private readonly settings: SettingsService,
    ) { }

    /**
     * Dispatch notification to the specified channels.
     */
    async dispatch(channels: string[], alert: AlertNotification) {
        const results: Record<string, boolean> = {};

        for (const channel of channels) {
            try {
                switch (channel.toLowerCase()) {
                    case 'telegram':
                        await this.sendTelegram(alert);
                        results.telegram = true;
                        break;
                    case 'email':
                        await this.sendEmail(alert);
                        results.email = true;
                        break;
                    case 'webhook':
                        await this.sendWebhook(alert);
                        results.webhook = true;
                        break;
                    default:
                        this.logger.warn(`Unknown notification channel: ${channel}`);
                        results[channel] = false;
                }
            } catch (err) {
                this.logger.error(`Failed to send ${channel} notification: ${err}`);
                results[channel] = false;
            }
        }

        return results;
    }

    // ─── Telegram ───────────────────────────────────────

    private async sendTelegram(alert: AlertNotification) {
        // Read live from settings (falls back to env vars)
        const tokenEnv = this.config.get<string>('telegram.botToken', '');
        const chatEnv = this.config.get<string>('telegram.chatId', '');
        const token = await this.settings.getString('notification.telegram.botToken', tokenEnv);
        const chatId = await this.settings.getString('notification.telegram.chatId', chatEnv);

        if (!token || !chatId) {
            this.logger.warn('Telegram not configured, skipping notification');
            return;
        }

        const emoji = this.severityEmoji(alert.severity, alert.state);
        const stateLabel = alert.state === 'triggered' ? '🔴 TRIGGERED' : '🟢 RESOLVED';

        const text = [
            `${emoji} *${alert.ruleName}* — ${stateLabel}`,
            '',
            `📍 *Device:* ${alert.deviceHostname} (${alert.deviceIp})`,
            `📊 *Metric:* ${alert.metricName}`,
            `📈 *Value:* ${alert.metricValue} ${alert.condition} ${alert.threshold}`,
            `⚠️ *Severity:* ${alert.severity.toUpperCase()}`,
            '',
            `💬 ${alert.message}`,
            `🕐 ${alert.triggeredAt.toISOString()}`,
        ].join('\n');

        const url = `https://api.telegram.org/bot${token}/sendMessage`;

        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
            }),
        });

        this.logger.log(`Telegram notification sent for ${alert.ruleName}`);
    }

    // ─── Email ──────────────────────────────────────────

    private async sendEmail(alert: AlertNotification) {
        // Read live from settings (falls back to env vars)
        const hostEnv = this.config.get<string>('smtp.host', '');
        const userEnv = this.config.get<string>('smtp.user', '');
        const passEnv = this.config.get<string>('smtp.pass', '');
        const portEnv = this.config.get<number>('smtp.port', 587);

        const smtpHost = await this.settings.getString('notification.smtp.host', hostEnv);
        const smtpUser = await this.settings.getString('notification.smtp.user', userEnv);
        const smtpPass = await this.settings.getString('notification.smtp.password', passEnv);
        const smtpPort = await this.settings.getNumber('notification.smtp.port', portEnv);

        if (!smtpHost || !smtpUser) {
            this.logger.warn('SMTP not configured, skipping email notification');
            return;
        }

        try {
            // Dynamic import to avoid hard dependency
            const nodemailer = await import('nodemailer');

            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpPort === 465,
                auth: {
                    user: smtpUser,
                    pass: smtpPass,
                },
            });

            const stateLabel = alert.state === 'triggered' ? '🔴 TRIGGERED' : '🟢 RESOLVED';
            const subject = `[NetMon] ${alert.severity.toUpperCase()} — ${alert.ruleName} ${stateLabel}`;

            const html = `
                <h2>${this.severityEmoji(alert.severity, alert.state)} ${alert.ruleName} — ${stateLabel}</h2>
                <table style="border-collapse:collapse;width:100%;max-width:600px">
                    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Device</strong></td>
                        <td style="padding:8px;border:1px solid #ddd">${alert.deviceHostname} (${alert.deviceIp})</td></tr>
                    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Metric</strong></td>
                        <td style="padding:8px;border:1px solid #ddd">${alert.metricName}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Value</strong></td>
                        <td style="padding:8px;border:1px solid #ddd">${alert.metricValue} ${alert.condition} ${alert.threshold}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Severity</strong></td>
                        <td style="padding:8px;border:1px solid #ddd">${alert.severity.toUpperCase()}</td></tr>
                    <tr><td style="padding:8px;border:1px solid #ddd"><strong>Time</strong></td>
                        <td style="padding:8px;border:1px solid #ddd">${alert.triggeredAt.toISOString()}</td></tr>
                </table>
                <p>${alert.message}</p>
            `;

            const emailTo = await this.settings.getString('notification.smtp.to', smtpUser);
            await transporter.sendMail({
                from: smtpUser,
                to: emailTo,
                subject,
                html,
            });

            this.logger.log(`Email notification sent for ${alert.ruleName}`);
        } catch (err) {
            this.logger.error(`Email send failed: ${err}`);
        }
    }

    // ─── Webhook ────────────────────────────────────────

    private async sendWebhook(alert: AlertNotification) {
        // Webhook URL would be stored in alert rule config.
        // For now, log the payload.
        const payload = {
            event: `alert.${alert.state}`,
            rule: alert.ruleName,
            severity: alert.severity,
            device: {
                hostname: alert.deviceHostname,
                ip: alert.deviceIp,
            },
            metric: {
                name: alert.metricName,
                value: alert.metricValue,
                condition: alert.condition,
                threshold: alert.threshold,
            },
            message: alert.message,
            timestamp: alert.triggeredAt.toISOString(),
        };

        this.logger.log(`Webhook payload: ${JSON.stringify(payload)}`);
        // TODO: Implement actual webhook POST when URL is added to AlertRule model
    }

    // ─── Helpers ────────────────────────────────────────

    private severityEmoji(severity: string, state: string): string {
        if (state === 'resolved') return '✅';
        switch (severity) {
            case 'critical': return '🔴';
            case 'warning': return '🟡';
            case 'info': return '🔵';
            default: return '⚪';
        }
    }
}
