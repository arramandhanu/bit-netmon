import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

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
    ) { }

    /**
     * Queue a subnet discovery scan job.
     * Returns the job ID so the caller can poll for progress.
     */
    async startScan(options: DiscoveryScanOptions) {
        const job = await this.discoveryQueue.add('subnet-scan', options, {
            removeOnComplete: { age: 3600 },   // keep for 1 hour
            removeOnFail: { age: 86400 },       // keep failures for 24h
        });

        this.logger.log(
            `Discovery scan queued: job=${job.id} subnets=${options.subnets.join(', ')} concurrency=${options.concurrency}`,
        );

        return {
            jobId: job.id,
            status: 'queued',
            subnets: options.subnets,
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
