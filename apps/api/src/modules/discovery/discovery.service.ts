import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SettingsService } from '../settings/settings.service';

export interface DiscoveryScanOptions {
    subnets: string[];
    snmpCommunities: string[];
    concurrency: number;
    timeout: number;
}

@Injectable()
export class DiscoveryService {
    private readonly logger = new Logger(DiscoveryService.name);

    constructor(
        @InjectQueue('discovery') private readonly discoveryQueue: Queue,
        private readonly settings: SettingsService,
    ) { }

    /**
     * Queue a subnet discovery scan job.
     * Returns the job ID so the caller can poll for progress.
     */
    async startScan(options: Partial<DiscoveryScanOptions> & { subnets: string[] }) {
        // Fill defaults from settings
        const defaultCommunities = await this.settings.getString(
            'discovery.defaultCommunities', 'public'
        );
        const defaultConcurrency = await this.settings.getNumber('discovery.concurrency', 50);
        const defaultTimeout = await this.settings.getNumber('discovery.timeout', 3000);

        const resolved: DiscoveryScanOptions = {
            subnets: options.subnets,
            snmpCommunities: options.snmpCommunities?.length
                ? options.snmpCommunities
                : defaultCommunities.split(',').map(s => s.trim()).filter(Boolean),
            concurrency: options.concurrency ?? defaultConcurrency,
            timeout: options.timeout ?? defaultTimeout,
        };

        const job = await this.discoveryQueue.add('subnet-scan', resolved, {
            removeOnComplete: { age: 3600 },   // keep for 1 hour
            removeOnFail: { age: 86400 },       // keep failures for 24h
        });

        this.logger.log(
            `Discovery scan queued: job=${job.id} subnets=${resolved.subnets.join(', ')} concurrency=${resolved.concurrency}`,
        );

        return {
            jobId: job.id,
            status: 'queued',
            subnets: resolved.subnets,
        };
    }

    /**
     * Check the status of a running or completed discovery job.
     */
    async getStatus(jobId: string) {
        const job = await this.discoveryQueue.getJob(jobId);

        if (!job) {
            return { jobId, status: 'not_found' };
        }

        const state = await job.getState();
        const progress = job.progress;
        const result = job.returnvalue;
        const failedReason = job.failedReason;

        return {
            jobId,
            status: state,
            progress,
            result: state === 'completed' ? result : undefined,
            error: state === 'failed' ? failedReason : undefined,
        };
    }
}
