import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { UrlMonitorService } from './url-monitor.service';

interface UrlCheckJobData {
    monitorId: number;
}

@Processor('url-monitor', { concurrency: 5 })
export class UrlMonitorProcessor extends WorkerHost implements OnModuleInit {
    private readonly logger = new Logger(UrlMonitorProcessor.name);
    // @ts-ignore - reserved for future use
    private schedulerInterval: NodeJS.Timeout | null = null;

    constructor(
        private readonly urlMonitorService: UrlMonitorService,
        @InjectQueue('url-monitor') private readonly queue: Queue,
    ) {
        super();
    }

    onModuleInit() {
        // Schedule URL checks every 60 seconds
        this.schedulerInterval = setInterval(() => this.scheduleChecks(), 60_000);
        // Run once at startup after a short delay
        setTimeout(() => this.scheduleChecks(), 10_000);
        this.logger.log('URL monitor scheduler started');
    }

    async process(job: Job<UrlCheckJobData>): Promise<any> {
        const { monitorId } = job.data;

        try {
            const monitor = await this.urlMonitorService.findOne(monitorId);
            if (!monitor || !monitor.enabled) {
                return { skipped: true, reason: 'Monitor not found or disabled' };
            }

            const result = await this.urlMonitorService.performCheck(monitor);
            await this.urlMonitorService.recordCheckResult(monitorId, result);

            this.logger.log(
                `URL check ${monitor.name} (${monitor.url}): ${result.isUp ? 'UP' : 'DOWN'} - ${result.responseMs}ms`,
            );

            return {
                monitorId,
                url: monitor.url,
                ...result,
            };
        } catch (err: any) {
            this.logger.warn(`URL check failed for monitor #${monitorId}: ${err.message}`);
            return { monitorId, error: err.message };
        }
    }

    /**
     * Enqueue monitors whose check_interval has elapsed since last_checked_at.
     */
    private async scheduleChecks() {
        try {
            const monitors = await this.urlMonitorService.getEnabledMonitors();
            const now = Date.now();

            for (const monitor of monitors) {
                const lastChecked = monitor.last_checked_at
                    ? new Date(monitor.last_checked_at).getTime()
                    : 0;
                const intervalMs = (monitor.check_interval || 300) * 1000;

                if (now - lastChecked >= intervalMs) {
                    await this.queue.add('url-check', {
                        monitorId: monitor.url_monitor_id,
                    }, {
                        jobId: `url-check-${monitor.url_monitor_id}-${Date.now()}`,
                    });
                }
            }
        } catch (err: any) {
            this.logger.warn(`Failed to schedule URL checks: ${err.message}`);
        }
    }
}
