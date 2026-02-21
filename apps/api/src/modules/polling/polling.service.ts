import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PollingService implements OnModuleInit {
    private readonly logger = new Logger(PollingService.name);
    private readonly defaultInterval: number;

    constructor(
        @InjectQueue('polling') private readonly pollingQueue: Queue,
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {
        this.defaultInterval = this.config.get<number>('snmp.pollingInterval', 300);
    }

    /**
     * On startup, schedule repeatable polling jobs for all enabled devices.
     */
    async onModuleInit() {
        this.logger.log('Initializing polling scheduler…');
        await this.syncPollingJobs();
    }

    /**
     * Synchronize BullMQ repeatable jobs with the current set of polling-enabled devices.
     * - Adds jobs for new devices
     * - Removes jobs for deleted/disabled devices
     * - Updates intervals for changed devices
     */
    async syncPollingJobs() {
        const devices = await this.prisma.device.findMany({
            where: { pollingEnabled: true },
            select: {
                id: true,
                hostname: true,
                pollingInterval: true,
            },
        });

        // Get current repeatable jobs
        const existingJobs = await this.pollingQueue.getRepeatableJobs();
        const existingJobMap = new Map(
            existingJobs.map((j) => [j.id, j]),
        );

        const activeDeviceIds = new Set<string>();

        for (const device of devices) {
            const jobId = `poll-device-${device.id}`;
            activeDeviceIds.add(jobId);

            const interval = (device.pollingInterval || this.defaultInterval) * 1000;
            const existing = existingJobMap.get(jobId);

            // Skip if job exists with the same interval
            if (existing && Number(existing.every) === interval) {
                continue;
            }

            // Remove old job if interval changed
            if (existing) {
                await this.pollingQueue.removeRepeatableByKey(existing.key);
            }

            // Add new repeatable job
            await this.pollingQueue.add(
                'poll-device',
                { deviceId: device.id },
                {
                    jobId,
                    repeat: { every: interval },
                    removeOnComplete: { count: 10 },
                    removeOnFail: { count: 50 },
                },
            );

            this.logger.log(
                `Scheduled polling for ${device.hostname} (ID=${device.id}) every ${device.pollingInterval || this.defaultInterval}s`,
            );
        }

        // Remove jobs for deleted/disabled devices
        for (const [jobId, job] of existingJobMap) {
            if (!activeDeviceIds.has(jobId || '')) {
                await this.pollingQueue.removeRepeatableByKey(job.key);
                this.logger.log(`Removed polling job: ${jobId}`);
            }
        }

        this.logger.log(
            `Polling sync complete: ${devices.length} device(s) scheduled`,
        );
    }

    /**
     * Trigger an immediate poll for a single device.
     */
    async triggerPoll(deviceId: number) {
        const device = await this.prisma.device.findUnique({
            where: { id: deviceId },
            select: { id: true, hostname: true },
        });

        if (!device) {
            throw new Error(`Device #${deviceId} not found`);
        }

        const job = await this.pollingQueue.add(
            'poll-device',
            { deviceId },
            {
                removeOnComplete: { count: 5 },
                removeOnFail: { count: 10 },
            },
        );

        this.logger.log(`Manual poll triggered for ${device.hostname} (job=${job.id})`);

        return {
            jobId: job.id,
            deviceId,
            hostname: device.hostname,
            status: 'queued',
        };
    }

    /**
     * Get polling status overview
     */
    async getStatus() {
        const [totalDevices, pollingEnabled, jobCounts] = await Promise.all([
            this.prisma.device.count(),
            this.prisma.device.count({ where: { pollingEnabled: true } }),
            this.pollingQueue.getJobCounts(),
        ]);

        const repeatableJobs = await this.pollingQueue.getRepeatableJobs();

        return {
            totalDevices,
            pollingEnabled,
            scheduledJobs: repeatableJobs.length,
            queueStatus: jobCounts,
        };
    }
}
