import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from './notification.service';

export interface MetricSnapshot {
    cpu_utilization?: number | null;
    memory_percent?: number | null;
    response_time_ms?: number | null;
    device_status?: string;
    in_utilization?: number | null;
    out_utilization?: number | null;
}

// In-memory store for duration tracking
interface BreachTracker {
    firstBreachTime: number;
    lastValue: number;
}

@Injectable()
export class AlertEvaluatorService {
    private readonly logger = new Logger(AlertEvaluatorService.name);

    // Track sustained breaches: key = `ruleId-deviceId`
    private breachTrackers = new Map<string, BreachTracker>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly notifications: NotificationService,
    ) { }

    /**
     * Evaluate all alert rules against the latest metrics for a device.
     * Called after each poll cycle by PollingProcessor.
     */
    async evaluate(deviceId: number, metrics: MetricSnapshot) {
        // Load device info
        const device = await this.prisma.device.findUnique({
            where: { id: deviceId },
            select: {
                id: true,
                hostname: true,
                ipAddress: true,
                groups: { select: { groupId: true } },
            },
        });

        if (!device) return;

        const groupIds = device.groups.map((g) => g.groupId);

        // Load matching alert rules:
        // - Rules with no device group (apply to all devices)
        // - Rules matching this device's groups
        const rules = await this.prisma.alertRule.findMany({
            where: {
                enabled: true,
                OR: [
                    { deviceGroupId: null },
                    { deviceGroupId: { in: groupIds.length > 0 ? groupIds : [-1] } },
                ],
            },
        });

        for (const rule of rules) {
            const metricValue = this.resolveMetricValue(rule.metricName, metrics);
            if (metricValue === null || metricValue === undefined) continue;

            const isBreaching = this.checkCondition(metricValue, rule.condition, rule.threshold);
            const trackerKey = `${rule.id}-${deviceId}`;

            if (isBreaching) {
                await this.handleBreach(trackerKey, rule, device, metricValue);
            } else {
                await this.handleClear(trackerKey, rule, device, metricValue);
            }
        }
    }

    /**
     * Map metric name to the value in the snapshot.
     */
    private resolveMetricValue(metricName: string, metrics: MetricSnapshot): number | null {
        const map: Record<string, number | null | undefined> = {
            cpu_utilization: metrics.cpu_utilization,
            memory_percent: metrics.memory_percent,
            response_time_ms: metrics.response_time_ms,
            in_utilization: metrics.in_utilization,
            out_utilization: metrics.out_utilization,
        };

        // Also support device_status as numeric (1=up, 0=down)
        if (metricName === 'device_status') {
            return metrics.device_status === 'up' ? 1 : 0;
        }

        return map[metricName] ?? null;
    }

    /**
     * Evaluate the condition against the threshold.
     */
    private checkCondition(value: number, condition: string, threshold: number): boolean {
        switch (condition) {
            case '>': return value > threshold;
            case '<': return value < threshold;
            case '>=': return value >= threshold;
            case '<=': return value <= threshold;
            case '==': return value === threshold;
            case '!=': return value !== threshold;
            default: return false;
        }
    }

    /**
     * Handle a metric breach: track duration, fire alert if sustained.
     */
    private async handleBreach(
        trackerKey: string,
        rule: any,
        device: any,
        metricValue: number,
    ) {
        const now = Date.now();
        let tracker = this.breachTrackers.get(trackerKey);

        if (!tracker) {
            tracker = { firstBreachTime: now, lastValue: metricValue };
            this.breachTrackers.set(trackerKey, tracker);
        } else {
            tracker.lastValue = metricValue;
        }

        // Check if sustained long enough
        const durationMs = (rule.duration || 0) * 1000;
        const elapsed = now - tracker.firstBreachTime;

        if (elapsed < durationMs) {
            return; // Not sustained long enough yet
        }

        // Check if already have an active (triggered) alert
        const existingAlert = await this.prisma.alertHistory.findFirst({
            where: {
                ruleId: rule.id,
                deviceId: device.id,
                state: 'triggered',
            },
        });

        if (existingAlert) {
            return; // Already alerted, don't duplicate
        }

        // Fire new alert
        const message = `${rule.metricName} is ${metricValue} (${rule.condition} ${rule.threshold}) on ${device.hostname}`;

        const alert = await this.prisma.alertHistory.create({
            data: {
                deviceId: device.id,
                ruleId: rule.id,
                severity: rule.severity,
                state: 'triggered',
                message,
                metricValue,
            },
        });

        this.logger.warn(
            `🔔 Alert TRIGGERED: ${rule.name} — ${message} (alert #${alert.id})`,
        );

        // Dispatch notifications
        if (rule.notifyChannels && rule.notifyChannels.length > 0) {
            await this.notifications.dispatch(rule.notifyChannels, {
                ruleName: rule.name,
                severity: rule.severity,
                deviceHostname: device.hostname,
                deviceIp: device.ipAddress,
                metricName: rule.metricName,
                metricValue,
                threshold: rule.threshold,
                condition: rule.condition,
                state: 'triggered',
                message,
                triggeredAt: new Date(),
            });
        }
    }

    /**
     * Handle a metric returning to normal: auto-resolve any active alert.
     */
    private async handleClear(
        trackerKey: string,
        rule: any,
        device: any,
        metricValue: number,
    ) {
        // Clear breach tracker
        this.breachTrackers.delete(trackerKey);

        // Find and resolve any active alert for this rule+device
        const activeAlert = await this.prisma.alertHistory.findFirst({
            where: {
                ruleId: rule.id,
                deviceId: device.id,
                state: 'triggered',
            },
        });

        if (!activeAlert) return;

        await this.prisma.alertHistory.update({
            where: { id: activeAlert.id },
            data: {
                state: 'resolved',
                resolvedAt: new Date(),
            },
        });

        this.logger.log(
            `✅ Alert RESOLVED: ${rule.name} on ${device.hostname} (alert #${activeAlert.id})`,
        );

        // Dispatch resolution notification
        if (rule.notifyChannels && rule.notifyChannels.length > 0) {
            const message = `${rule.metricName} returned to normal (${metricValue}) on ${device.hostname}`;

            await this.notifications.dispatch(rule.notifyChannels, {
                ruleName: rule.name,
                severity: rule.severity,
                deviceHostname: device.hostname,
                deviceIp: device.ipAddress,
                metricName: rule.metricName,
                metricValue,
                threshold: rule.threshold,
                condition: rule.condition,
                state: 'resolved',
                message,
                triggeredAt: activeAlert.triggeredAt,
            });
        }
    }
}
